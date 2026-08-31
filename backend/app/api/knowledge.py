"""知识库 API：上传 / 列表 / 删除 / 检索（按用户隔离）。"""
from __future__ import annotations

import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.auth import get_current_user
from app.core.rag import rag_engine
from app.db.database import get_session
from app.models.orm import KnowledgeDoc
from app.models.schemas import (
    KnowledgeDocInfo,
    KnowledgeQueryRequest,
    KnowledgeQueryResponse,
)
from app.models.user import User

router = APIRouter()

UPLOAD_DIR = Path(settings.vector_store_dir).parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# 上传大小上限（与前端 Next 侧限制一致）
MAX_UPLOAD_BYTES = 20 * 1024 * 1024


@router.post("/upload", response_model=KnowledgeDocInfo)
async def upload_document(
    file: UploadFile = File(...),
    collection: str = Form(default="default"),
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> KnowledgeDocInfo:
    """上传 PDF / DOCX / TXT / Markdown，自动入库向量库。"""
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".pdf", ".txt", ".md", ".markdown", ".docx"}:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型: {suffix}")

    doc_id = uuid.uuid4().hex
    dest = UPLOAD_DIR / f"{doc_id}{suffix}"
    if file.size is not None and file.size > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"文件过大（超过 {MAX_UPLOAD_BYTES // 1024 // 1024}MB）")
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:  # 双保险：size 属性缺失时仍拦截
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=413, detail=f"文件过大（超过 {MAX_UPLOAD_BYTES // 1024 // 1024}MB）")
    dest.write_bytes(content)

    try:
        info = await rag_engine.add_document(str(dest), file.filename or dest.name, collection=collection, user_id=user.id)
    except Exception as e:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"入库失败: {e}") from e

    rec = KnowledgeDoc(
        id=info["doc_id"], user_id=user.id, name=file.filename or dest.name,
        source=str(dest), chunks=info["chunks"], collection=collection,
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)

    return KnowledgeDocInfo(
        id=rec.id, name=rec.name, source=rec.source, chunks=rec.chunks,
        collection=rec.collection, created_at=rec.created_at,
    )


@router.get("/documents", response_model=list[KnowledgeDocInfo])
async def list_documents(collection: str = "default", db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)) -> list[KnowledgeDocInfo]:
    rows = await rag_engine.list_documents(collection=collection, user_id=user.id)
    result = await db.execute(select(KnowledgeDoc).where(KnowledgeDoc.user_id == user.id))
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
    user: User = Depends(get_current_user),
) -> dict:
    ok = await rag_engine.delete_document(doc_id, collection=collection, user_id=user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="文档不存在")
    await db.execute(delete(KnowledgeDoc).where(KnowledgeDoc.id == doc_id, KnowledgeDoc.user_id == user.id))
    await db.commit()
    return {"deleted": doc_id}


@router.post("/query", response_model=KnowledgeQueryResponse)
async def query_knowledge(payload: KnowledgeQueryRequest, user: User = Depends(get_current_user)) -> KnowledgeQueryResponse:
    """纯检索（不调 LLM），前端可展示命中片段。"""
    contexts = await rag_engine.query(payload.question, top_k=payload.top_k, collection=payload.collection, user_id=user.id)
    return KnowledgeQueryResponse(question=payload.question, contexts=contexts)
