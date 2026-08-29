"""聊天 API：支持流式（SSE）+ RAG 增强 + 联网搜索增强 + 对话记忆。"""
from __future__ import annotations

import json
import uuid
from typing import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.llm import chat_once, stream_chat
from app.core.memory import MemoryStore
from app.core.rag import rag_engine
from app.core.web_search import format_for_prompt, web_search
from app.db.database import get_session
from app.models.schemas import ChatRequest

router = APIRouter()

SYSTEM_PROMPT = """你是 MiniAI，一个开源、轻量、可私有化部署的个人 AI 助手。

回答风格要求：
1. 简洁直接，避免冗余套话。
2. 涉及数据/事实时，主动标注来源（文档名 / 搜索链接）。
3. 当上下文足够时直接给结论，不确定时说明不确定。
4. 默认使用中文；如果用户使用其他语言，跟随用户语言。
"""


async def _ensure_session(db: AsyncSession, req: ChatRequest) -> tuple[MemoryStore, str]:
    """确保有可用会话，没有就建一个。"""
    store = MemoryStore(db)
    if req.session_id:
        sess = await store.get_session(req.session_id)
        if not sess:
            raise HTTPException(status_code=404, detail=f"session {req.session_id} 不存在")
        return store, sess.id
    # 新会话
    first_user_msg = next((m.content for m in req.messages if m.role == "user"), "新对话")
    sess = await store.create_session(
        title=first_user_msg[:30] or "新对话",
        model=req.model,
    )
    return store, sess.id


async def _build_messages(
    store: MemoryStore,
    session_id: str,
    req: ChatRequest,
) -> list[dict]:
    """构造发给 LLM 的完整 messages：记忆 + RAG + 联网。"""
    history = await store.to_chat_history(session_id, system_prompt=SYSTEM_PROMPT)

    last_user = next((m for m in reversed(req.messages) if m.role == "user"), None)
    extra_context_blocks: list[str] = []

    if last_user and req.enable_rag:
        chunks = await rag_engine.query(last_user.content, top_k=4)
        if chunks:
            ctx = "\n\n".join(
                f"[{i+1}] {c['content']}\n来源: {c['source']}" for i, c in enumerate(chunks)
            )
            extra_context_blocks.append(f"以下是从本地知识库检索到的相关片段：\n{ctx}")

    if last_user and req.enable_search:
        results = await web_search(last_user.content)
        if results:
            extra_context_blocks.append(f"以下来自实时联网搜索：\n{format_for_prompt(results)}")

    if extra_context_blocks:
        augmented = last_user.content + "\n\n---\n" + "\n\n".join(extra_context_blocks)
        # 替换 history 里最后一条 user，附加上下文
        for i in range(len(history) - 1, -1, -1):
            if history[i]["role"] == "user":
                history[i]["content"] = augmented
                break
        else:
            history.append({"role": "user", "content": augmented})

    return history


@router.post("/completions")
async def chat_completions(
    req: ChatRequest,
    db: AsyncSession = Depends(get_session),
) -> StreamingResponse | dict:
    """主入口：支持流式 SSE 输出。"""
    store, session_id = await _ensure_session(db, req)

    # 持久化用户消息
    user_msgs = [m for m in req.messages if m.role == "user"]
    if user_msgs:
        last_user = user_msgs[-1]
        await store.append_message(session_id, "user", last_user.content)

    full_messages = await _build_messages(store, session_id, req)

    if not req.stream:
        # 非流式
        text = await chat_once(
            model=req.model,
            messages=full_messages,
            temperature=req.temperature,
            max_tokens=req.max_tokens,
        )
        await store.append_message(session_id, "assistant", text)
        return {"session_id": session_id, "content": text}

    # 流式
    async def event_gen() -> AsyncIterator[str]:
        assistant_buf: list[str] = []
        try:
            yield f"event: meta\ndata: {json.dumps({'session_id': session_id, 'model': req.model}, ensure_ascii=False)}\n\n"
            async for delta in stream_chat(
                model=req.model,
                messages=full_messages,
                temperature=req.temperature,
                max_tokens=req.max_tokens,
            ):
                assistant_buf.append(delta)
                yield f"event: delta\ndata: {json.dumps({'content': delta}, ensure_ascii=False)}\n\n"
            final = "".join(assistant_buf)
            await store.append_message(session_id, "assistant", final)
            yield f"event: done\ndata: {json.dumps({'session_id': session_id}, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'message': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream")


@router.get("/sessions/{session_id}/messages")
async def list_session_messages(
    session_id: str,
    db: AsyncSession = Depends(get_session),
) -> dict:
    store = MemoryStore(db)
    sess = await store.get_session(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="session 不存在")
    msgs = await store.get_messages(session_id)
    return {
        "session_id": session_id,
        "messages": [
            {"role": m.role, "content": m.content, "created_at": m.created_at.isoformat()}
            for m in msgs
        ],
    }


@router.delete("/sessions/{session_id}")
async def clear_session(
    session_id: str,
    db: AsyncSession = Depends(get_session),
) -> dict:
    store = MemoryStore(db)
    ok = await store.delete_session(session_id)
    if not ok:
        raise HTTPException(status_code=404, detail="session 不存在")
    return {"deleted": session_id}
