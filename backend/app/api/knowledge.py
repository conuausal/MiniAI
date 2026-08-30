"""知识库 API：上传 / 列表 / 删除 / 检索。"""
from __future__ import annotations

import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.rag import rag_engine
from app.db.database import get_session
from app.models.orm import KnowledgeDoc
from app.models.schemas import (
    KnowledgeDocInfo,
    KnowledgeQueryRequest,
    KnowledgeQueryResponse,
)

router = APIRouter()

UPLOAD_DIR = Path(settings.vector_store_dir).parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/upload", response_model=KnowledgeDocInfo)
async def upload_document(
    file: UploadFile = File(...),
    collection: str = Form(default="default"),
    db: AsyncSession = Depends(get_session),
) -> KnowledgeDocInfo:
    """上传 PDF / DOCX / TXT / Markdown，自动入库向量库。"""
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".pdf", ".txt", ".md", ".markdown", ".docx"}:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型: {suffix}")

    doc_id = uuid.uuid4().hex
    dest = UPLOAD_DIR / f"{doc_id}{suffix}"
    content = await file.read()
    dest.write_bytes(content)

    try:
        info = await rag_engine.add_document(str(dest), file.filename or dest.name, collection=collection)
    except Exception as e:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"入库失败: {e}") from e

    rec = KnowledgeDoc(
        id=info["doc_id"],
        name=file.filename or dest.name,
        source=str(dest),
        chunks=info["chunks"],
        collection=collection,
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)

    return KnowledgeDocInfo(
        id=rec.id, name=rec.name, source=rec.source, chunks=rec.chunks,
        collection=rec.collection, created_at=rec.created_at,
    )


@router.get("/documents", response_model=list[KnowledgeDocInfo])
async def list_documents(collection: str = "default", db: AsyncSession = Depends(get_session)) -> list[KnowledgeDocInfo]:
    rows = await rag_engine.list_documents(collection=collection)
    # DB 记录是 created_at 的权威来源（上传时写入），Chroma 元数据作兜底
    result = await db.execute(select(KnowledgeDoc))
    db_created = {rec.id: rec.created_at for rec in result.scalars()}
    now = datetime.utcnow()
    return [
        KnowledgeDocInfo(
            id=r["doc_id"], name=r["source"], source=r["source"],
            chunks=r["chunks"], collection=r["collection"],
            created_at=db_created.get(r["doc_id"]) or now,
        )
        for r in rows
    ]


@router.delete("/documents/{doc_id}")
async def delete_document(
    doc_id: str,
    collection: str = "default",
    db: AsyncSession = Depends(get_session),
) -> dict:
    ok = await rag_engine.delete_document(doc_id, collection=collection)
    if not ok:
        raise HTTPException(status_code=404, detail="文档不存在")
    # 同步删除 DB 记录，避免 DB 与向量库漂移
    await db.execute(delete(KnowledgeDoc).where(KnowledgeDoc.id == doc_id))
    await db.commit()
    return {"deleted": doc_id}


@router.post("/query", response_model=KnowledgeQueryResponse)
async def query_knowledge(payload: KnowledgeQueryRequest) -> KnowledgeQueryResponse:
    """纯检索（不调 LLM），前端可展示命中片段。"""
    contexts = await rag_engine.query(payload.question, top_k=payload.top_k, collection=payload.collection)
    return KnowledgeQueryResponse(question=payload.question, contexts=contexts)
