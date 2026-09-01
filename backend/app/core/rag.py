"""RAG 引擎：基于 ChromaDB + sentence-transformers 的本地向量库。

特性：
- 支持 PDF / TXT / Markdown / DOCX
- 中文友好嵌入（BAAI/bge-small-zh-v1.5，懒加载，失败自动回退 Chroma 默认）
- 自动分块 + 持久化
- 集合隔离：每个 collection 互不干扰
"""
from __future__ import annotations

import asyncio
import os
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import chromadb
from chromadb.config import Settings as ChromaSettings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from loguru import logger

from app.config import settings

# Chroma / BM25 / 重排等均为同步阻塞调用，统一放线程池执行，避免卡住事件循环
_EMBED_LOAD_TIMEOUT = 60
_RERANK_LOAD_TIMEOUT = 30


class RagEngine:
    def __init__(self) -> None:
        self._client: Optional[chromadb.PersistentClient] = None
        self._splitter = RecursiveCharacterTextSplitter(
            chunk_size=600,
            chunk_overlap=80,
            separators=["\n\n", "\n", "。", "！", "？", ".", " ", ""],
        )
        self._reranker = None  # 交叉编码器重排模型（懒加载；False = 加载失败永久降级）
        self._embed_fn = None  # embedding 函数（懒加载；False = 加载失败永久降级）
        self._embed_checked = False

    async def bootstrap(self) -> None:
        """启动时初始化持久化向量库客户端。"""
        Path(settings.vector_store_dir).mkdir(parents=True, exist_ok=True)
        self._client = chromadb.PersistentClient(
            path=settings.vector_store_dir,
            settings=ChromaSettings(anonymized_telemetry=False, allow_reset=False),
        )
        logger.info("✅ ChromaDB 已加载: {}", settings.vector_store_dir)

    # ---------- 内部工具 ----------

    async def _ensure_embed_fn(self) -> None:
        """懒加载中文 embedding 模型；失败永久降级为 Chroma 默认（MiniLM）。

        注意：embedding_function 只在 collection 首次创建时生效，
        已存在的 collection 会沿用创建时的 embedding，行为不受影响。
        """
        if self._embed_checked:
            return
        self._embed_checked = True
        try:
            if settings.hf_endpoint:
                os.environ.setdefault("HF_ENDPOINT", settings.hf_endpoint)

            from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

            def _load():
                return SentenceTransformerEmbeddingFunction(model_name=settings.embedding_model)

            logger.info("⏳ 加载 embedding 模型: {}", settings.embedding_model)
            self._embed_fn = await asyncio.wait_for(asyncio.to_thread(_load), timeout=_EMBED_LOAD_TIMEOUT)
            logger.info("✅ embedding 模型已加载")
        except Exception as e:
            logger.warning("中文 embedding 加载失败，回退 Chroma 默认模型: {}", e)
            self._embed_fn = False

    def _collection(self, name: str = "default"):
        if not self._client:
            raise RuntimeError("RAG 引擎未初始化")
        kwargs = {"name": name, "metadata": {"hnsw:space": "cosine"}}
        if self._embed_fn:  # 仅在成功加载时传入；显式传 None 会覆盖 Chroma 默认 EF，破坏存量 collection
            kwargs["embedding_function"] = self._embed_fn
        return self._client.get_or_create_collection(**kwargs)

    def _load_text(self, path: Path) -> str:
        suffix = path.suffix.lower()
        if suffix == ".pdf":
            from pypdf import PdfReader

            reader = PdfReader(str(path))
            return "\n".join(p.extract_text() or "" for p in reader.pages)
        if suffix == ".docx":
            import docx2txt

            return docx2txt.process(str(path)) or ""
        # txt / md / 默认按 utf-8 读取
        return path.read_text(encoding="utf-8", errors="ignore")

    def _ingest_sync(self, text: str, source: str, collection: str, user_id: int) -> dict:
        """线程内执行：分块 + 构建 metadata + 向量入库（同步阻塞，勿在事件循环调用）。"""
        chunks = self._splitter.split_text(text)
        doc_id = uuid.uuid4().hex
        ids = [f"{doc_id}-{i}" for i in range(len(chunks))]
        metadatas = [
            {"source": source, "chunk": i, "doc_id": doc_id, "user_id": user_id, "created_at": datetime.utcnow().isoformat()}
            for i in range(len(chunks))
        ]
        col = self._collection(collection)
        col.add(documents=chunks, ids=ids, metadatas=metadatas)
        return {"doc_id": doc_id, "chunks": len(chunks)}

    # ---------- 文档入库 ----------

    async def add_document(
        self,
        file_path: str,
        original_name: str,
        collection: str = "default",
        user_id: int = 0,
    ) -> dict:
        await self._ensure_embed_fn()
        text = await asyncio.to_thread(self._load_text, Path(file_path))
        if not text.strip():
            raise ValueError(f"文件 {original_name} 内容为空或无法解析")
        info = await asyncio.to_thread(self._ingest_sync, text, original_name, collection, user_id)
        logger.info("📥 入库 {} → {} chunks (collection={}, user={})", original_name, info["chunks"], collection, user_id)
        return info

    async def add_text(
        self,
        text: str,
        source: str = "manual",
        collection: str = "default",
        user_id: int = 0,
    ) -> dict:
        if not text.strip():
            raise ValueError("文本为空")
        await self._ensure_embed_fn()
        return await asyncio.to_thread(self._ingest_sync, text, source, collection, user_id)

    # ---------- 检索（混合检索 + 重排序） ----------

    @staticmethod
    def _tokenize(text: str) -> List[str]:
        """粗粒度 tokenization：中文按单字、英文/数字按连续串，供 BM25 使用。"""
        return re.findall(r"[A-Za-z0-9_]+|[一-鿿]", text)

    async def _get_reranker(self):
        """懒加载交叉编码器重排模型。

        - 首次查询时尝试下载，限时 30 秒，避免因网络问题阻塞请求；
        - 加载失败缓存为 False，后续查询直接降级 RRF，不重复尝试。
        """
        if self._reranker is not None:
            return self._reranker  # 已加载成功，或已标记失败(False)
        try:
            if settings.hf_endpoint:
                os.environ.setdefault("HF_ENDPOINT", settings.hf_endpoint)
            from sentence_transformers import CrossEncoder

            def _load():
                return CrossEncoder(settings.rerank_model, max_length=512)

            logger.info("⏳ 加载重排模型: {}", settings.rerank_model)
            self._reranker = await asyncio.wait_for(asyncio.to_thread(_load), timeout=_RERANK_LOAD_TIMEOUT)
            logger.info("✅ 重排模型已加载")
        except Exception as e:
            logger.warning("重排模型加载失败（后续查询降级为 RRF）: {}", e)
            self._reranker = False
        return self._reranker

    def _sparse_search_sync(self, col, question: str, user_id: int) -> Tuple[List[str], Dict[str, dict]]:
        """线程内执行：col.get + BM25 构建/打分（同步阻塞，勿在事件循环调用）。

        返回 (稀疏检索排序文档, doc→metadata 映射)。
        映射按 ids 先配对再过滤空文档，避免 documents 过滤后与 metadatas 错位。
        """
        items = col.get(include=["documents", "metadatas"], where={"user_id": user_id})
        ids = list(items.get("ids") or [])
        docs = list(items.get("documents") or [])
        metas = list(items.get("metadatas") or [])
        meta_by_doc: Dict[str, dict] = {}
        for i, d, m in zip(ids, docs, metas):
            if d and d not in meta_by_doc:
                meta_by_doc[d] = m or {}
        all_docs = [d for d in docs if d]
        if not all_docs:
            return [], meta_by_doc
        from rank_bm25 import BM25Okapi

        bm25 = BM25Okapi([self._tokenize(d) for d in all_docs])
        scores = bm25.get_scores(self._tokenize(question))
        ordered = sorted(range(len(all_docs)), key=lambda i: scores[i], reverse=True)
        if ordered and scores[ordered[0]] > 0:
            floor = scores[ordered[0]] * 0.3  # BM25 相对分数线：单字蹭分的垃圾文本分远低于关键词命中
            sparse_docs = [all_docs[i] for i in ordered if scores[i] >= floor]
        return sparse_docs, meta_by_doc

    async def query(
        self,
        question: str,
        top_k: int = 4,
        collection: str = "default",
        user_id: int = 0,
    ) -> List[dict]:
        """混合检索流水线：稠密向量 + BM25 稀疏 → RRF 融合 → 交叉编码器重排。

        重排失败时自动降级为 RRF 融合结果，不阻断检索。
        通过 where={"user_id": ...} 保证只召回当前用户的知识库。
        """
        await self._ensure_embed_fn()
        col = self._collection(collection)

        # ---- 1) 稠密检索（ChromaDB 向量，带相似度下限过滤） ----
        dense_k = max(top_k * 4, 10)
        dense_docs: List[str] = []
        try:
            res = await asyncio.to_thread(
                col.query, query_texts=[question], n_results=dense_k, where={"user_id": user_id}
            )
            docs_all = res.get("documents", [[]])[0]
            dists = res.get("distances", [[]])[0] or []
            for d, dist in zip(docs_all, dists):
                # cosine distance -> similarity；低于阈值视为不相关（防止任何查询都有命中）
                if d and (1.0 - float(dist)) >= settings.rag_min_similarity:
                    dense_docs.append(d)
        except Exception as e:
            logger.warning("向量检索失败: {}", e)

        # ---- 2) 稀疏检索（BM25，查询时现算） ----
        sparse_docs: List[str] = []
        meta_by_doc: Dict[str, dict] = {}
        try:
            sparse_docs, meta_by_doc = await asyncio.to_thread(
                self._sparse_search_sync, col, question, user_id
            )
        except Exception as e:
            logger.warning("稀疏检索失败: {}", e)

        # ---- 3) Reciprocal Rank Fusion 融合 ----
        rrf: Dict[str, float] = {}
        for rank, doc in enumerate(dense_docs):
            rrf[doc] = rrf.get(doc, 0.0) + 1.0 / (60 + rank + 1)
        for rank, doc in enumerate(sparse_docs):
            rrf[doc] = rrf.get(doc, 0.0) + 1.0 / (60 + rank + 1)

        candidates = sorted(rrf.items(), key=lambda x: x[1], reverse=True)
        if not candidates:
            return []
        # 候选集截断：真正的相关性判定由重排概率门限（rag_rerank_min_score）负责
        cand_top = [doc for doc, _ in candidates[: max(top_k * 3, 5)]]

        # ---- 4) 交叉编码器重排（相关概率门限：>= rag_rerank_min_score 才算命中） ----
        try:
            reranker = await self._get_reranker()
            if not reranker:
                raise RuntimeError("重排模型不可用")
            scores = await asyncio.to_thread(reranker.predict, [[question, doc] for doc in cand_top])
            ranked = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
            top_docs = [
                cand_top[i] for i in ranked
                if float(scores[i]) >= settings.rag_rerank_min_score
            ][:top_k]
            if not top_docs:
                logger.info(
                    "重排判定全部候选不相关（最高相关度 {:.3f} < {:.2f}），判定为未命中",
                    float(scores[ranked[0]]), settings.rag_rerank_min_score,
                )
                return []
        except Exception as e:
            logger.warning("重排失败，降级为 RRF 融合结果: {}", e)
            top_docs = cand_top[:top_k]

        # ---- 5) 组装结果 ----
        out = []
        for doc in top_docs:
            meta = meta_by_doc.get(doc, {})
            out.append(
                {
                    "content": doc,
                    "source": meta.get("source", ""),
                    "chunk": meta.get("chunk", 0),
                    "score": rrf.get(doc, 0.0),
                }
            )
        return out

    # ---------- 列表 / 删除 ----------

    async def list_documents(self, collection: str = "default", user_id: int = 0) -> List[dict]:
        await self._ensure_embed_fn()
        col = self._collection(collection)
        items = await asyncio.to_thread(col.get, include=["metadatas"], where={"user_id": user_id})
        seen: dict[str, dict] = {}
        for meta in items.get("metadatas", []):
            did = (meta or {}).get("doc_id")
            if not did:
                continue
            if did not in seen:
                seen[did] = {
                    "doc_id": did,
                    "source": (meta or {}).get("source", ""),
                    "chunks": 0,
                    "collection": collection,
                    "created_at": (meta or {}).get("created_at"),
                }
            seen[did]["chunks"] += 1
        return list(seen.values())

    async def delete_document(self, doc_id: str, collection: str = "default", user_id: int = 0) -> bool:
        await self._ensure_embed_fn()
        col = self._collection(collection)

        def _delete() -> bool:
            # chromadb 0.5.x 多条件 where 必须用 $and 包裹
            items = col.get(where={"$and": [{"doc_id": doc_id}, {"user_id": user_id}]})
            if not items.get("ids"):
                return False
            col.delete(ids=items["ids"])
            return True

        return await asyncio.to_thread(_delete)


# 单例
rag_engine = RagEngine()
