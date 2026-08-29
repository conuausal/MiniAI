"""RAG 引擎：基于 ChromaDB + sentence-transformers 的本地向量库。

特性：
- 支持 PDF / TXT / Markdown / DOCX
- 中文友好嵌入（BAAI/bge-small-zh-v1.5）
- 自动分块 + 持久化
- 集合隔离：每个 collection 互不干扰
"""
from __future__ import annotations

import uuid
from pathlib import Path
from typing import List, Optional

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
            {"source": original_name, "chunk": i, "doc_id": doc_id}
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
            {"source": source, "chunk": i, "doc_id": doc_id} for i in range(len(chunks))
        ]
        col = self._collection(collection)
        col.add(documents=chunks, ids=ids, metadatas=metadatas)
        return {"doc_id": doc_id, "chunks": len(chunks)}

    # ---------- 检索 ----------

    async def query(
        self,
        question: str,
        top_k: int = 4,
        collection: str = "default",
    ) -> List[dict]:
        col = self._collection(collection)
        try:
            res = col.query(query_texts=[question], n_results=top_k)
        except Exception as e:
            logger.warning("向量检索失败: {}", e)
            return []
        docs = res.get("documents", [[]])[0]
        metas = res.get("metadatas", [[]])[0]
        dists = res.get("distances", [[]])[0]
        out = []
        for doc, meta, dist in zip(docs, metas, dists):
            out.append(
                {
                    "content": doc,
                    "source": (meta or {}).get("source", ""),
                    "chunk": (meta or {}).get("chunk", 0),
                    "score": 1 - dist if dist is not None else None,
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
