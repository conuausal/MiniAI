"""会话管理 API。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.memory import MemoryStore
from app.db.database import get_session
from app.models.schemas import SessionCreate, SessionDetail, SessionInfo

router = APIRouter()


@router.get("", response_model=list[SessionInfo])
async def list_sessions(db: AsyncSession = Depends(get_session)) -> list[SessionInfo]:
    store = MemoryStore(db)
    sessions = await store.list_sessions()
    return [
        SessionInfo(
            id=s.id,
            title=s.title,
            model=s.model,
            created_at=s.created_at,
            updated_at=s.updated_at,
        )
        for s in sessions
    ]


@router.post("", response_model=SessionInfo)
async def create_session(
    payload: SessionCreate,
    db: AsyncSession = Depends(get_session),
) -> SessionInfo:
    store = MemoryStore(db)
    s = await store.create_session(title=payload.title or "新对话", model=payload.model or "deepseek-chat")
    return SessionInfo(
        id=s.id, title=s.title, model=s.model, created_at=s.created_at, updated_at=s.updated_at
    )


@router.get("/{session_id}", response_model=SessionDetail)
async def get_session_detail(
    session_id: str,
    db: AsyncSession = Depends(get_session),
) -> SessionDetail:
    store = MemoryStore(db)
    sess = await store.get_session(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="session 不存在")
    msgs = await store.get_messages(session_id)
    return SessionDetail(
        id=sess.id,
        title=sess.title,
        model=sess.model,
        created_at=sess.created_at,
        updated_at=sess.updated_at,
        messages=[{"role": m.role, "content": m.content} for m in msgs],
    )


@router.patch("/{session_id}", response_model=SessionInfo)
async def update_session(
    session_id: str,
    payload: SessionCreate,
    db: AsyncSession = Depends(get_session),
) -> SessionInfo:
    store = MemoryStore(db)
    sess = await store.update_session(session_id, title=payload.title, model=payload.model)
    if not sess:
        raise HTTPException(status_code=404, detail="session 不存在")
    return SessionInfo(
        id=sess.id, title=sess.title, model=sess.model, created_at=sess.created_at, updated_at=sess.updated_at
    )


@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(get_session),
) -> dict:
    store = MemoryStore(db)
    ok = await store.delete_session(session_id)
    if not ok:
        raise HTTPException(status_code=404, detail="session 不存在")
    return {"deleted": session_id}
