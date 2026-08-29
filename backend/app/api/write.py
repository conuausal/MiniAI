"""多智能体写作 API：以 SSE 流式推送 Planner → Researchers → Writer 的每个阶段进度。"""
from __future__ import annotations

import asyncio
import json
import uuid
from typing import AsyncIterator, Dict, List

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.core.writing_agents import OutlineItem, run_writing_pipeline
from app.models.schemas import WriteRequest

router = APIRouter()


# 用于汇总进度的内存存储（生产环境建议改 Redis）
_PROGRESS_STORE: Dict[str, List[dict]] = {}


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/article")
async def write_article(req: WriteRequest) -> StreamingResponse:
    """SSE 流式推送写作流水线的每个阶段。"""
    if not req.topic.strip():
        raise HTTPException(status_code=400, detail="topic 不能为空")

    task_id = uuid.uuid4().hex
    _PROGRESS_STORE[task_id] = []

    async def event_gen() -> AsyncIterator[str]:
        queue: asyncio.Queue = asyncio.Queue()

        def emit(payload: dict) -> None:
            """把阶段事件推进队列，前端通过 SSE 收到。"""
            payload_with_id = {**payload, "task_id": task_id}
            queue.put_nowait(payload_with_id)
            # 同时存到进度表，方便 /history 回顾
            _PROGRESS_STORE.setdefault(task_id, []).append(payload)

        yield _sse({"event": "start", "task_id": task_id, "topic": req.topic})

        # 在后台跑流水线，主循环从队列读事件并 yield
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
                    send=emit,
                )
                emit({"event": "done"})
            except Exception as e:
                emit({"event": "error", "message": str(e)})

        task = asyncio.create_task(runner())

        try:
            while True:
                payload = await queue.get()
                yield _sse(payload)
                if payload.get("event") in {"done", "error"}:
                    break
        finally:
            if not task.done():
                task.cancel()

    return StreamingResponse(event_gen(), media_type="text/event-stream")


@router.get("/article/{task_id}")
async def get_writing_task(task_id: str) -> dict:
    """查询一次写作任务的所有阶段事件（用于加载历史流水线）。"""
    events = _PROGRESS_STORE.get(task_id)
    if events is None:
        raise HTTPException(status_code=404, detail="task 不存在或已过期")
    return {"task_id": task_id, "events": events}


@router.post("/article/sync")
async def write_article_sync(req: WriteRequest) -> dict:
    """非流式版本：一次性返回完整结果（便于测试和简单集成）。"""
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
