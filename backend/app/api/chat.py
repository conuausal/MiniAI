"""聊天 API：支持流式（SSE）+ RAG 增强 + 联网搜索增强 + 工具调用（Function Calling） + 对话记忆。"""
from __future__ import annotations

import asyncio
import json
from typing import AsyncIterator, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.auth import get_current_user
from app.core.llm import (
    LLM_ERROR_PREFIX, LLM_FAILED_PREFIX,
    chat_once, parse_custom_providers, parse_user_keys, stream_chat,
)
from app.core.memory import MemoryStore
from app.core.memory_window import delete_window, get_window, push_window
from app.core.rag import rag_engine
from app.core.tools import execute_tool, list_tools
from app.core.web_search import format_for_prompt, web_search
from app.api.preferences import load_user_preferences
from app.db.database import AsyncSessionLocal, get_session
from app.models.schemas import ChatRequest
from app.models.user import User

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


def _is_error_text(text: str) -> bool:
    """LLM 调用失败/未配置 Key 的错误文本不应写入对话记忆（污染后续上下文）。"""
    t = text.strip()  # stream_chat 的失败文本带前导 \n\n
    return t.startswith(LLM_ERROR_PREFIX.strip()) or t.startswith(LLM_FAILED_PREFIX.strip())


async def _persist_assistant_message(session_id: str, text: str, extra: dict | None = None) -> None:
    """独立会话持久化助手回复，失败仅告警不影响响应。"""
    try:
        async with AsyncSessionLocal() as session:
            await MemoryStore(session).append_message(session_id, "assistant", text, extra=extra)
        await push_window(session_id, "assistant", text)
    except Exception as e:
        logger.warning("助手消息持久化失败（session={}）: {}", session_id, e)


def get_user_keys(x_user_api_keys: Optional[str] = Header(default=None)) -> dict:
    """FastAPI Depends：从请求头读取用户 API Keys。"""
    return parse_user_keys(x_user_api_keys)


def get_custom_providers(x_user_custom_providers: Optional[str] = Header(default=None)) -> dict:
    """FastAPI Depends：从请求头读取用户自定义 provider。"""
    return parse_custom_providers(x_user_custom_providers)


async def _ensure_session(db: AsyncSession, req: ChatRequest, user_id: int) -> tuple[MemoryStore, str]:
    store = MemoryStore(db)
    if req.session_id:
        sess = await store.get_session(req.session_id, user_id)
        if not sess:
            raise HTTPException(status_code=404, detail=f"session {req.session_id} 不存在")
        return store, sess.id
    first_user_msg = next((m.content for m in req.messages if m.role == "user"), "新对话")
    sess = await store.create_session(
        title=first_user_msg[:30] or "新对话",
        model=req.model,
        user_id=user_id,
    )
    return store, sess.id


KB_STRICT_PROMPT = (
    "【知识库严格模式】你必须仅依据上文提供的知识库检索片段回答用户问题。"
    "若片段未覆盖用户的问题，直接回答'知识库中没有相关内容'，"
    "禁止编造、禁止使用你自身的知识补充。引用片段时请标注 [n] 序号。"
)


async def _build_initial_messages(
    store: MemoryStore,
    session_id: str,
    req: ChatRequest,
    user_id: int = 0,
    user_system_prompt: str = "",
    kb_strict: bool = False,
) -> tuple[list[dict], list[dict]]:
    """构造发给 LLM 的完整 messages：N 轮记忆窗口 + RAG + 联网。

    记忆窗口优先从 Redis 读取（滑动窗口，最近 N 轮）；
    Redis 未命中或不可用时回退到 MySQL 最近 N 轮。

    返回 (history, rag_hits)：rag_hits 供前端展示检索命中信息（source/score/preview）。
    """
    # 1) 记忆窗口（不含 system）
    window = await get_window(session_id)
    if window is None:
        full = await store.to_chat_history(session_id, system_prompt=None)
        cap = max(1, int(settings.memory_window_rounds)) * 2
        window = full[-cap:] if full else []
    history: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    # 用户自定义系统提示词：追加为第二条 system 消息，与基础设定叠加
    if user_system_prompt.strip():
        history.append({
            "role": "system",
            "content": f"以下是本用户自定义的补充系统设定，请严格遵守：\n{user_system_prompt.strip()}",
        })
    # 知识库严格模式：防编造指令
    if kb_strict:
        history.append({"role": "system", "content": KB_STRICT_PROMPT})
    history += list(window)

    # 2) RAG / 联网增强最后一条 user 消息
    last_user = next((m for m in reversed(req.messages) if m.role == "user"), None)
    extra_context_blocks: list[str] = []
    rag_hits: list[dict] = []

    if last_user and req.enable_rag:
        chunks = await rag_engine.query(last_user.content, top_k=4, user_id=user_id)
        rag_hits = [
            {"source": c["source"], "score": c.get("score", 0.0), "preview": c["content"][:120]}
            for c in chunks
        ]
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
        target = None
        for i in range(len(history) - 1, -1, -1):
            if history[i]["role"] == "user":
                target = i
                break
        if target is not None:
            history[target] = {**history[target], "content": augmented}
        else:
            history.append({"role": "user", "content": augmented})

    return history, rag_hits


@router.post("/completions", response_model=None)
async def chat_completions(
    req: ChatRequest,
    db: AsyncSession = Depends(get_session),
    user_keys: dict = Depends(get_user_keys),
    custom_providers: dict = Depends(get_custom_providers),
    user: User = Depends(get_current_user),
) -> StreamingResponse | dict:
    """主入口：流式 SSE 输出（含 function calling 自动循环）。"""
    store, session_id = await _ensure_session(db, req, user.id)

    user_msgs = [m for m in req.messages if m.role == "user"]
    if user_msgs:
        last_user_text = user_msgs[-1].content
        await store.append_message(session_id, "user", last_user_text)
        await push_window(session_id, "user", last_user_text)

    user_system_prompt, custom_tools = await load_user_preferences(db, user.id)
    if req.kb_strict:
        req.enable_rag = True  # 严格模式隐含开启检索（_build_initial_messages 内部读取该值）
    full_messages, rag_hits = await _build_initial_messages(
        store, session_id, req, user.id, user_system_prompt, req.kb_strict,
    )
    # 工具 schema = 内置 + 用户自定义（Webhook）工具
    custom_schemas = [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t.get("description", ""),
                "parameters": t.get("parameters") or {"type": "object", "properties": {}},
            },
        }
        for t in custom_tools
    ]
    tools_schema = (list_tools() + custom_schemas) if req.enable_tools else None

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
            user_id=user.id,
            custom_tools=custom_tools,
        )
        if not _is_error_text(text):
            await store.append_message(session_id, "assistant", text)
            await push_window(session_id, "assistant", text)
        return {
            "session_id": session_id,
            "content": text,
            "rag_hits": rag_hits if (req.enable_rag or req.kb_strict) else None,
        }

    async def event_gen() -> AsyncIterator[str]:
        assistant_buf: list[str] = []
        thinking_buf: list[str] = []
        persisted = False
        # 流式指标：首 token 延迟 / chunk 数 / thinking 块数，用于定位"无流式体验"问题
        import time as _time
        t_start = _time.monotonic()
        metrics = {"chunks": 0, "thinking_chunks": 0, "t_first": None, "t_first_thinking": None}

        def _schedule_persist() -> None:
            """幂等调度持久化助手回复；客户端中断时保存已生成的部分内容。

            用独立任务 + 独立数据库会话：客户端断开时生成器在取消上下文中收尾，
            finally 里的 await 会被直接取消（CancelledError 不走 except Exception），
            所以必须 fire-and-forget，让持久化脱离请求生命周期执行。
            """
            nonlocal persisted
            if persisted:
                return
            text = "".join(assistant_buf).strip()
            if not text or _is_error_text(text):
                return
            persisted = True
            thinking = "".join(thinking_buf)[:20000]
            extra = {"thinking": thinking} if thinking.strip() else None
            asyncio.create_task(_persist_assistant_message(session_id, text, extra))

        try:
            yield f"event: meta\ndata: {json.dumps({'session_id': session_id, 'model': req.model}, ensure_ascii=False)}\n\n"

            # 检索命中信息（RAG/严格模式开启时必发，无论命中与否，供前端展示卡片/未命中提示）
            if req.enable_rag or req.kb_strict:
                yield f"event: rag_hits\ndata: {json.dumps({'enabled': True, 'hits': rag_hits}, ensure_ascii=False)}\n\n"

            current_messages = list(full_messages)
            last_round_had_tool_calls = False
            for _round in range(MAX_TOOL_ROUNDS):
                round_buf: list[str] = []
                tool_calls_raw: List[dict] = []

                async for kind, text in stream_chat(
                    model=req.model,
                    messages=current_messages,
                    temperature=req.temperature,
                    max_tokens=req.max_tokens,
                    tools=tools_schema,
                    user_keys=user_keys,
                    custom_providers=custom_providers,
                ):
                    if kind == "thinking":
                        metrics["thinking_chunks"] += 1
                        if metrics["t_first_thinking"] is None:
                            metrics["t_first_thinking"] = _time.monotonic() - t_start
                        thinking_buf.append(text)
                        yield f"event: thinking\ndata: {json.dumps({'content': text}, ensure_ascii=False)}\n\n"
                        continue
                    delta = text
                    metrics["chunks"] += 1
                    if metrics["t_first"] is None and "<<<TOOL_CALLS>>>" not in delta:
                        metrics["t_first"] = _time.monotonic() - t_start
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
                            yield f"event: error\ndata: {json.dumps({'message': '工具调用解析失败，回复可能不完整。'}, ensure_ascii=False)}\n\n"
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
                    result = await execute_tool(name, args, user_id=user.id, custom_tools=custom_tools)
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
                last_round_had_tool_calls = True

            # 工具轮耗尽后补一轮无工具的收敛回答（与非流式 _run_with_tools 的兜底一致）
            if last_round_had_tool_calls:
                async for kind, text in stream_chat(
                    model=req.model,
                    messages=current_messages,
                    temperature=req.temperature,
                    max_tokens=req.max_tokens,
                    tools=None,
                    user_keys=user_keys,
                    custom_providers=custom_providers,
                ):
                    if kind == "thinking":
                        thinking_buf.append(text)
                        yield f"event: thinking\ndata: {json.dumps({'content': text}, ensure_ascii=False)}\n\n"
                        continue
                    assistant_buf.append(text)
                    yield f"event: delta\ndata: {json.dumps({'content': text}, ensure_ascii=False)}\n\n"

            _schedule_persist()
            logger.info(
                "聊天流指标: model={} chunks={} thinking_chunks={} 首正文={}s 首思考={}s 总={:.1f}s",
                req.model, metrics["chunks"], metrics["thinking_chunks"],
                f"{metrics['t_first']:.1f}" if metrics["t_first"] is not None else "无",
                f"{metrics['t_first_thinking']:.1f}" if metrics["t_first_thinking"] is not None else "无",
                _time.monotonic() - t_start,
            )
            yield f"event: done\ndata: {json.dumps({'session_id': session_id}, ensure_ascii=False)}\n\n"
        except Exception as e:
            _schedule_persist()
            logger.info(
                "聊天流指标(异常): model={} chunks={} thinking_chunks={} 总={:.1f}s err={}",
                req.model, metrics["chunks"], metrics["thinking_chunks"], _time.monotonic() - t_start, e,
            )
            yield f"event: error\ndata: {json.dumps({'message': str(e)}, ensure_ascii=False)}\n\n"
        finally:
            # 客户端断开（GeneratorExit）时兜底持久化已生成的部分内容；finally 中不得 yield
            _schedule_persist()

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


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
    user_id: int = 0,
    custom_tools: list[dict] | None = None,
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
            tool_result = await execute_tool(name, args, user_id=user_id, custom_tools=custom_tools)
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
    user: User = Depends(get_current_user),
) -> dict:
    store = MemoryStore(db)
    sess = await store.get_session(session_id, user.id)
    if not sess:
        raise HTTPException(status_code=404, detail="session 不存在")
    msgs = await store.get_messages(session_id)
    return {
        "session_id": session_id,
        "messages": [
            {
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat(),
                "thinking": (m.extra or {}).get("thinking"),
            }
            for m in msgs
        ],
    }


@router.delete("/sessions/{session_id}")
async def clear_session(
    session_id: str,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> dict:
    store = MemoryStore(db)
    ok = await store.delete_session(session_id, user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="session 不存在")
    await delete_window(session_id)
    return {"deleted": session_id}
