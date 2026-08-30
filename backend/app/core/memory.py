"""对话记忆：基于 SQLite 的会话/消息持久化。"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import Message, Session
from app.models.schemas import ChatMessage


def _new_session_id() -> str:
    return uuid.uuid4().hex


class MemoryStore:
    """封装会话与消息的 CRUD。"""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ---------- Session ----------

    async def create_session(self, title: str = "新对话", model: str = "deepseek-chat", user_id: int = 0) -> Session:
        sess = Session(id=_new_session_id(), title=title, model=model, user_id=user_id)
        self.db.add(sess)
        await self.db.commit()
        await self.db.refresh(sess)
        return sess

    async def get_session(self, session_id: str, user_id: Optional[int] = None) -> Optional[Session]:
        stmt = select(Session).where(Session.id == session_id)
        if user_id is not None:
            stmt = stmt.where(Session.user_id == user_id)
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def list_sessions(self, user_id: int, limit: int = 50) -> List[Session]:
        stmt = select(Session).where(Session.user_id == user_id).order_by(Session.updated_at.desc()).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update_session(
        self, session_id: str, user_id: int, *, title: Optional[str] = None, model: Optional[str] = None
    ) -> Optional[Session]:
        sess = await self.get_session(session_id, user_id)
        if not sess:
            return None
        if title is not None:
            sess.title = title
        if model is not None:
            sess.model = model
        sess.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(sess)
        return sess

    async def delete_session(self, session_id: str, user_id: int) -> bool:
        sess = await self.get_session(session_id, user_id)
        if not sess:
            return False
        await self.db.delete(sess)
        await self.db.commit()
        return True

    # ---------- Message ----------

    async def append_message(self, session_id: str, role: str, content: str, extra: dict | None = None) -> Message:
        msg = Message(
            session_id=session_id,
            role=role,
            content=content,
            extra=extra or {},
        )
        self.db.add(msg)
        # 顺便更新会话时间
        sess = await self.get_session(session_id)
        if sess:
            sess.updated_at = datetime.utcnow()
            # 若首条 user 消息，自动生成标题
            if sess.title == "新对话" and role == "user":
                sess.title = content[:30].replace("\n", " ")
        await self.db.commit()
        await self.db.refresh(msg)
        return msg

    async def get_messages(self, session_id: str) -> List[Message]:
        stmt = select(Message).where(Message.session_id == session_id).order_by(Message.created_at)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def to_chat_history(
        self, session_id: str, *, system_prompt: Optional[str] = None
    ) -> List[dict]:
        """构造 LLM 需要的 messages 格式。"""
        msgs: List[dict] = []
        if system_prompt:
            msgs.append({"role": "system", "content": system_prompt})
        for m in await self.get_messages(session_id):
            msgs.append({"role": m.role, "content": m.content})
        return msgs

    async def clear_messages(self, session_id: str) -> None:
        await self.db.execute(delete(Message).where(Message.session_id == session_id))
        await self.db.commit()

    # ---------- 便捷转换 ----------

    @staticmethod
    def to_openai_messages(items: List[ChatMessage]) -> List[dict]:
        return [{"role": m.role, "content": m.content} for m in items]
