"""聊天 API：支持流式（SSE）+ RAG 增强 + 联网搜索增强 + 工具调用（Function Calling） + 对话记忆。"""
from __future__ import annotations

import json
from typing import AsyncIterator, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.llm import chat_once, parse_custom_providers, parse_user_keys, stream_chat
from app.core.memory import MemoryStore
from app.core.rag import rag_engine
from app.core.tools import execute_tool, list_tools
from app.core.web_search import format_for_prompt, web_search
from app.db.database import get_session
from app.models.schemas import ChatRequest

router = APIRouter()

SYSTEM_PROMPT = """你是 MiniAI，一个开源、轻量、可私有化部署的个人 AI 助手。

回答风格要求：
1. 简洁直接，避免冗余套话。
2. 涉及数据/事实时，主动标注来源（文档名 / 搜索链接 / 工具名称）。
3. 当上下文足够时直接给结论，不确定时说明不确定。
4. 默认使用中文；如果用户使用其他语言，跟随用户语言。

关于工具调用：
- 当问题涉及实时信息（时间、新闻、最新数据）或数学计算时，主动调用相应工具。
- 当用户提到"我上传的"、"之前的资料"、"那份文档"时，调用 query_knowledge。
- 工具调用结果会作为上下文回填给你，请基于真实结果回答，不要编造。
- 一次回答中最多连续调用 3 轮工具，避免无限循环。
"""

MAX_TOOL_ROUNDS = 3


def get_user_keys(x_user_api_keys: Optional[str] = Header(default=None)) -> dict:
    """FastAPI Depends：从请求头读取用户 API Keys。"""
    return parse_user_keys(x_user_api_keys)


def get_custom_providers(x_user_custom_providers: Optional[str] = Header(default=None)) -> dict:
    """FastAPI Depends：从请求头读取用户自定义 provider。"""
    return parse_custom_providers(x_user_custom_providers)


async def _ensure_session(db: AsyncSession, req: ChatRequest) -> tuple[MemoryStore, str]:
    store = MemoryStore(db)
    if req.session_id:
        sess = await store.get_session(req.session_id)
        if not sess:
            raise HTTPException(status_code=404, detail=f"session {req.session_id} 不存在")
        return store, sess.id
    first_user_msg = next((m.content for m in req.messages if m.role == "user"), "新对话")
    sess = await store.create_session(
        title=first_user_msg[:30] or "新对话",
        model=req.model,
    )
    return store, sess.id


async def _build_initial_messages(
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
        for i in range(len(history) - 1, -1, -1):
            if history[i]["role"] == "user":
                history[i]["content"] = augmented
                break
        else:
            history.append({"role": "user", "content": augmented})

    return history


@router.post("/completions", response_model=None)
async def chat_completions(
    req: ChatRequest,
    db: AsyncSession = Depends(get_session),
    user_keys: dict = Depends(get_user_keys),
    custom_providers: dict = Depends(get_custom_providers),
) -> StreamingResponse | dict:
    """主入口：流式 SSE 输出（含 function calling 自动循环）。"""
    store, session_id = await _ensure_session(db, req)

    user_msgs = [m for m in req.messages if m.role == "user"]
    if user_msgs:
        await store.append_message(session_id, "user", user_msgs[-1].content)

    full_messages = await _build_initial_messages(store, session_id, req)
    tools_schema = list_tools() if req.enable_tools else None

    if not req.stream:
        text, _ = await _run_with_tools(
            store=store,
            session_id=session_id,
            model=req.model,
            messages=full_messages,
            tools=tools_schema,
            temperature=req.temperature,
            max_tokens=req.max_tokens,
            max_rounds=MAX_TOOL_ROUNDS,
            user_keys=user_keys,
            custom_providers=custom_providers,
        )
        await store.append_message(session_id, "assistant", text)
        return {"session_id": session_id, "content": text}

    async def event_gen() -> AsyncIterator[str]:
        assistant_buf: list[str] = []
        try:
            yield f"event: meta\ndata: {json.dumps({'session_id': session_id, 'model': req.model}, ensure_ascii=False)}\n\n"

            current_messages = list(full_messages)
            for _round in range(MAX_TOOL_ROUNDS):
                round_buf: list[str] = []
                tool_calls_raw: List[dict] = []

                buf = ""
                async for delta in stream_chat(
                    model=req.model,
                    messages=current_messages,
                    temperature=req.temperature,
                    max_tokens=req.max_tokens,
                    tools=tools_schema,
                    user_keys=user_keys,
                    custom_providers=custom_providers,
                ):
                    if "<<<TOOL_CALLS>>>" in delta:
                        before, _, after = delta.partition("<<<TOOL_CALLS>>>")
                        json_part, _, _ = after.partition("<<<END>>>")
                        if before:
                            round_buf.append(before)
                            assistant_buf.append(before)
                            yield f"event: delta\ndata: {json.dumps({'content': before}, ensure_ascii=False)}\n\n"
                        try:
                            tool_calls_raw = json.loads(json_part)
                        except Exception:
                            tool_calls_raw = []
                    else:
                        round_buf.append(delta)
                        assistant_buf.append(delta)
                        yield f"event: delta\ndata: {json.dumps({'content': delta}, ensure_ascii=False)}\n\n"

                if not tool_calls_raw:
                    break

                yield f"event: tool_call\ndata: {json.dumps({'round': _round + 1, 'tool_calls': tool_calls_raw}, ensure_ascii=False)}\n\n"

                tool_msgs = []
                for tc in tool_calls_raw:
                    name = tc.get("function", {}).get("name", "")
                    args_raw = tc.get("function", {}).get("arguments", "{}")
                    try:
                        args = json.loads(args_raw) if isinstance(args_raw, str) else (args_raw or {})
                    except Exception:
                        args = {}
                    result = await execute_tool(name, args)
                    yield f"event: tool_result\ndata: {json.dumps({'name': name, 'args': args, 'result': result[:4000]}, ensure_ascii=False)}\n\n"
                    tool_msgs.append({
                        "role": "tool",
                        "tool_call_id": tc.get("id", ""),
                        "name": name,
                        "content": result,
                    })

                round_text = "".join(round_buf)
                current_messages.append({"role": "assistant", "content": round_text, "tool_calls": tool_calls_raw})
                current_messages.extend(tool_msgs)

            final = "".join(assistant_buf)
            await store.append_message(session_id, "assistant", final)
            yield f"event: done\ndata: {json.dumps({'session_id': session_id}, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'message': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream")


async def _run_with_tools(
    *,
    store: MemoryStore,
    session_id: str,
    model: str,
    messages: list[dict],
    tools: list[dict] | None,
    temperature: float,
    max_tokens: int,
    max_rounds: int,
    user_keys: dict,
    custom_providers: dict,
) -> tuple[str, list[dict]]:
    current = list(messages)
    all_records: list[dict] = []
    for _round in range(max_rounds):
        result = await chat_once(
            model=model, messages=current, temperature=temperature,
            max_tokens=max_tokens, tools=tools,
            user_keys=user_keys, custom_providers=custom_providers,
        )
        if not result["tool_calls"]:
            return result["text"], all_records
        tool_msgs = []
        for tc in result["tool_calls"]:
            name = (tc.get("function") or {}).get("name", "")
            args_raw = (tc.get("function") or {}).get("arguments", "{}")
            try:
                args = json.loads(args_raw) if isinstance(args_raw, str) else (args_raw or {})
            except Exception:
                args = {}
            tool_result = await execute_tool(name, args)
            all_records.append({"name": name, "args": args, "result": tool_result})
            tool_msgs.append({
                "role": "tool",
                "tool_call_id": tc.get("id", ""),
                "name": name,
                "content": tool_result,
            })
        current.append({
            "role": "assistant",
            "content": result["text"],
            "tool_calls": result["tool_calls"],
        })
        current.extend(tool_msgs)
    final = await chat_once(model=model, messages=current, temperature=temperature, max_tokens=max_tokens, user_keys=user_keys, custom_providers=custom_providers)
    return final["text"], all_records


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
