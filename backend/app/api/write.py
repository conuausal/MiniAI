"""多智能体写作 API：以 SSE 流式推送 Planner → Researchers → Writer 的每个阶段进度。"""
from __future__ import annotations

import asyncio
import json
import uuid
from typing import AsyncIterator, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse

from app.core.llm import parse_user_keys
from app.core.writing_agents import OutlineItem, run_writing_pipeline
from app.models.schemas import WriteRequest

router = APIRouter()


_PROGRESS_STORE: Dict[str, List[dict]] = {}


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


def get_user_keys(x_user_api_keys: Optional[str] = Header(default=None)) -> dict:
    return parse_user_keys(x_user_api_keys)


@router.post("/article")
async def write_article(
    req: WriteRequest,
    user_keys: dict = Depends(get_user_keys),
) -> StreamingResponse:
    if not req.topic.strip():
        raise HTTPException(status_code=400, detail="topic 不能为空")

    task_id = uuid.uuid4().hex
    _PROGRESS_STORE[task_id] = []

    async def event_gen() -> AsyncIterator[str]:
        queue: asyncio.Queue = asyncio.Queue()

        def emit(payload: dict) -> None:
            payload_with_id = {**payload, "task_id": task_id}
            queue.put_nowait(payload_with_id)
            _PROGRESS_STORE.setdefault(task_id, []).append(payload)

        yield _sse({"event": "start", "task_id": task_id, "topic": req.topic})

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
    events = _PROGRESS_STORE.get(task_id)
    if events is None:
        raise HTTPException(status_code=404, detail="task 不存在或已过期")
    return {"task_id": task_id, "events": events}


@router.post("/article/sync")
async def write_article_sync(
    req: WriteRequest,
    user_keys: dict = Depends(get_user_keys),
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
