"""RAG 引擎：基于 ChromaDB + sentence-transformers 的本地向量库。

特性：
- 支持 PDF / TXT / Markdown / DOCX
- 中文友好嵌入（BAAI/bge-small-zh-v1.5）
- 自动分块 + 持久化
- 集合隔离：每个 collection 互不干扰
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import chromadb
from chromadb.config import Settings as ChromaSettings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from loguru import logger

from app.config import settings


class RagEngine:
    def __init__(self) -> None:
        self._client: Optional[chromadb.PersistentClient] = None
        self._splitter = RecursiveCharacterTextSplitter(
            chunk_size=600,
            chunk_overlap=80,
            separators=["\n\n", "\n", "。", "！", "？", ".", " ", ""],
        )
        self._reranker = None  # 交叉编码器重排模型（懒加载）

    async def bootstrap(self) -> None:
        """启动时初始化持久化向量库客户端。"""
        Path(settings.vector_store_dir).mkdir(parents=True, exist_ok=True)
        self._client = chromadb.PersistentClient(
            path=settings.vector_store_dir,
            settings=ChromaSettings(anonymized_telemetry=False, allow_reset=False),
        )
        logger.info("✅ ChromaDB 已加载: {}", settings.vector_store_dir)

    # ---------- 内部工具 ----------

    def _collection(self, name: str = "default"):
        if not self._client:
            raise RuntimeError("RAG 引擎未初始化")
        return self._client.get_or_create_collection(
            name=name,
            metadata={"hnsw:space": "cosine"},
        )

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

    # ---------- 文档入库 ----------

    async def add_document(
        self,
        file_path: str,
        original_name: str,
        collection: str = "default",
    ) -> dict:
        text = self._load_text(Path(file_path))
        if not text.strip():
            raise ValueError(f"文件 {original_name} 内容为空或无法解析")

        chunks = self._splitter.split_text(text)
        doc_id = uuid.uuid4().hex
        ids = [f"{doc_id}-{i}" for i in range(len(chunks))]
        metadatas = [
            {"source": original_name, "chunk": i, "doc_id": doc_id, "created_at": datetime.utcnow().isoformat()}
            for i in range(len(chunks))
        ]
        col = self._collection(collection)
        col.add(documents=chunks, ids=ids, metadatas=metadatas)
        logger.info("📥 入库 {} → {} chunks (collection={})", original_name, len(chunks), collection)
        return {"doc_id": doc_id, "chunks": len(chunks)}

    async def add_text(
        self,
        text: str,
        source: str = "manual",
        collection: str = "default",
    ) -> dict:
        if not text.strip():
            raise ValueError("文本为空")
        chunks = self._splitter.split_text(text)
        doc_id = uuid.uuid4().hex
        ids = [f"{doc_id}-{i}" for i in range(len(chunks))]
        metadatas = [
            {"source": source, "chunk": i, "doc_id": doc_id, "created_at": datetime.utcnow().isoformat()}
            for i in range(len(chunks))
        ]
        col = self._collection(collection)
        col.add(documents=chunks, ids=ids, metadatas=metadatas)
        return {"doc_id": doc_id, "chunks": len(chunks)}

    # ---------- 检索（混合检索 + 重排序） ----------

    @staticmethod
    def _tokenize(text: str) -> List[str]:
        """粗粒度 tokenization：中文按单字、英文/数字按连续串，供 BM25 使用。"""
        return re.findall(r"[A-Za-z0-9_]+|[一-鿿]", text)

    def _get_reranker(self):
        """懒加载交叉编码器重排模型（首次查询时下载，不阻塞启动）。"""
        if self._reranker is None:
            if settings.hf_endpoint:
                import os
                os.environ.setdefault("HF_ENDPOINT", settings.hf_endpoint)
            from sentence_transformers import CrossEncoder
            logger.info("⏳ 加载重排模型: {}", settings.rerank_model)
            self._reranker = CrossEncoder(settings.rerank_model, max_length=512)
            logger.info("✅ 重排模型已加载")
        return self._reranker

    async def query(
        self,
        question: str,
        top_k: int = 4,
        collection: str = "default",
    ) -> List[dict]:
        """混合检索流水线：稠密向量 + BM25 稀疏 → RRF 融合 → 交叉编码器重排。

        重排失败时自动降级为 RRF 融合结果，不阻断检索。
        """
        col = self._collection(collection)

        # ---- 1) 稠密检索（ChromaDB 向量） ----
        dense_k = max(top_k * 4, 10)
        dense_docs: List[str] = []
        try:
            res = col.query(query_texts=[question], n_results=dense_k)
            dense_docs = [d for d in res.get("documents", [[]])[0] if d]
        except Exception as e:
            logger.warning("向量检索失败: {}", e)

        # ---- 2) 稀疏检索（BM25，查询时现算） ----
        sparse_docs: List[str] = []
        meta_by_doc: Dict[str, dict] = {}
        try:
            all_items = col.get(include=["documents", "metadatas"])
            all_docs = [d for d in (all_items.get("documents") or []) if d]
            all_metas = list(all_items.get("metadatas") or [])
            meta_by_doc = {d: (m or {}) for d, m in zip(all_docs, all_metas)}
            if all_docs:
                from rank_bm25 import BM25Okapi
                bm25 = BM25Okapi([self._tokenize(d) for d in all_docs])
                scores = bm25.get_scores(self._tokenize(question))
                ordered = sorted(range(len(all_docs)), key=lambda i: scores[i], reverse=True)
                sparse_docs = [all_docs[i] for i in ordered if scores[i] > 0]
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
        cand_top = [doc for doc, _ in candidates[: max(top_k * 3, 5)]]

        # ---- 4) 交叉编码器重排 ----
        try:
            reranker = self._get_reranker()
            scores = reranker.predict([[question, doc] for doc in cand_top])
            ordered = [cand_top[i] for i in sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)]
            top_docs = ordered[:top_k]
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

    async def list_documents(self, collection: str = "default") -> List[dict]:
        col = self._collection(collection)
        items = col.get(include=["metadatas"])
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

    async def delete_document(self, doc_id: str, collection: str = "default") -> bool:
        col = self._collection(collection)
        items = col.get(where={"doc_id": doc_id})
        if not items.get("ids"):
            return False
        col.delete(ids=items["ids"])
        return True


# 单例
rag_engine = RagEngine()
