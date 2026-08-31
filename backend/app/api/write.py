"""多智能体写作 API：以 SSE 流式推送 Planner → Researchers → Writer 的每个阶段进度。"""
from __future__ import annotations

import asyncio
import json
import time
import uuid
from typing import AsyncIterator, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse
from loguru import logger

from app.core.auth import get_current_user
from app.core.llm import parse_custom_providers, parse_user_keys
from app.core.writing_agents import OutlineItem, run_writing_pipeline
from app.models.schemas import WriteRequest
from app.models.user import User

router = APIRouter()


_PROGRESS_STORE: Dict[str, List[dict]] = {}
# task_id -> 创建者 user_id（回放接口按此做归属校验）
_TASK_OWNER: Dict[str, int] = {}
# 防止无界增长：最多保留最近 MAX_TASKS 个任务的事件，更早的淘汰
MAX_TASKS = 100
# 单任务回放事件数上限（SSE 实时推送不受限，只影响事后回放）
MAX_EVENTS_PER_TASK = 2000


def _evict_stale_tasks() -> None:
    """超出容量时淘汰最早的任务，避免内存泄漏。"""
    while len(_PROGRESS_STORE) > MAX_TASKS:
        _PROGRESS_STORE.pop(next(iter(_PROGRESS_STORE)), None)


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


def get_user_keys(x_user_api_keys: Optional[str] = Header(default=None)) -> dict:
    return parse_user_keys(x_user_api_keys)


def get_custom_providers(x_user_custom_providers: Optional[str] = Header(default=None)) -> dict:
    return parse_custom_providers(x_user_custom_providers)


@router.post("/article")
async def write_article(
    req: WriteRequest,
    user_keys: dict = Depends(get_user_keys),
    custom_providers: dict = Depends(get_custom_providers),
    user: User = Depends(get_current_user),
) -> StreamingResponse:
    if not req.topic.strip():
        raise HTTPException(status_code=400, detail="topic 不能为空")

    task_id = uuid.uuid4().hex
    logger.info("✍️ 写作请求: task={} model={} topic={}", task_id, req.model, req.topic[:40])
    _PROGRESS_STORE[task_id] = []
    _TASK_OWNER[task_id] = user.id

    async def event_gen() -> AsyncIterator[str]:
        queue: asyncio.Queue = asyncio.Queue()

        def emit(payload: dict) -> None:
            payload_with_id = {**payload, "task_id": task_id}
            queue.put_nowait(payload_with_id)
            events = _PROGRESS_STORE.setdefault(task_id, [])
            if len(events) < MAX_EVENTS_PER_TASK:
                events.append(payload)
            _evict_stale_tasks()

        yield _sse({"event": "start", "task_id": task_id, "topic": req.topic})

        t0 = time.monotonic()

        async def heartbeat():
            """每 2 秒推送一次已用时，避免推理模型思考期间前端长时间零反馈。"""
            while True:
                await asyncio.sleep(2)
                queue.put_nowait({"event": "heartbeat", "elapsed": round(time.monotonic() - t0, 1)})

        async def runner():
            try:
                await run_writing_pipeline(
                    topic=req.topic,
                    style=req.style,
                    length=req.length,
                    model=req.model,
                    custom_outline=req.outline,
                    enable_rag=req.enable_rag,
                    enable_search=req.enable_search,
                    collection=req.collection,
                    user_keys=user_keys,
                    custom_providers=custom_providers,
                    user_id=user.id,
                    send=emit,
                )
                emit({"event": "done"})
            except asyncio.CancelledError:
                logger.info("写作管线被取消（客户端断开/停止）: task={}", task_id)
                raise
            except Exception as e:
                logger.exception("写作管线失败（task={}，model={}）: {}", task_id, req.model, e)
                emit({"event": "error", "message": str(e)})

        task = asyncio.create_task(runner())
        hb = asyncio.create_task(heartbeat())

        try:
            while True:
                payload = await queue.get()
                yield _sse(payload)
                if payload.get("event") in {"done", "error"}:
                    break
        finally:
            hb.cancel()
            client_gone = not task.done()
            if client_gone:
                task.cancel()
            _TASK_OWNER.pop(task_id, None)
            logger.info(
                "写作流结束: task={} client_disconnected={} runner_done={} total={:.1f}s",
                task_id, client_gone, task.done(), time.monotonic() - t0,
            )

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@router.get("/article/{task_id}")
async def get_writing_task(
    task_id: str,
    user: User = Depends(get_current_user),
) -> dict:
    # 归属校验：不存在与非本人统一返回 404，不泄露 task 存在性
    if _TASK_OWNER.get(task_id) != user.id:
        raise HTTPException(status_code=404, detail="task 不存在或已过期")
    events = _PROGRESS_STORE.get(task_id)
    if events is None:
        raise HTTPException(status_code=404, detail="task 不存在或已过期")
    return {"task_id": task_id, "events": events}


@router.post("/article/sync")
async def write_article_sync(
    req: WriteRequest,
    user_keys: dict = Depends(get_user_keys),
    custom_providers: dict = Depends(get_custom_providers),
    user: User = Depends(get_current_user),
) -> dict:
    if not req.topic.strip():
        raise HTTPException(status_code=400, detail="topic 不能为空")

    captured: List[dict] = []

    def collect(payload: dict) -> None:
        captured.append(payload)

    result = await run_writing_pipeline(
        topic=req.topic,
        style=req.style,
        length=req.length,
        model=req.model,
        custom_outline=req.outline,
        enable_rag=req.enable_rag,
        enable_search=req.enable_search,
        collection=req.collection,
        user_keys=user_keys,
        custom_providers=custom_providers,
        user_id=user.id,
        send=collect,
    )

    return {
        "topic": result.topic,
        "style": result.style,
        "length": result.length,
        "word_count": result.word_count,
        "outline": [o.__dict__ for o in result.outline],
        "sections": [
            {"section_id": s.section_id, "title": s.title, "notes": s.research_notes, "sources": s.sources}
            for s in result.sections
        ],
        "article_md": result.article_md,
        "events": captured,
    }
