"""多模型路由：基于 OpenAI 兼容协议统一接入 GPT / Claude / DeepSeek / 智谱 / 自部署 vLLM 等。

本版本同时支持：
- 普通聊天（流式 / 非流式）
- Function Calling（通过 OpenAI tools 标准）
"""
from __future__ import annotations

from typing import AsyncIterator, Dict, List, Optional

from loguru import logger
from openai import AsyncOpenAI

from app.config import settings
from app.models.schemas import ModelInfo


# ---------- 模型清单（用户可在前端一键切换） ----------

MODEL_REGISTRY: Dict[str, Dict[str, str]] = {
    # ---- DeepSeek（默认推荐：性价比 + 中文强） ----
    "deepseek-chat": {"provider": "deepseek", "label": "DeepSeek-V3"},
    "deepseek-reasoner": {"provider": "deepseek", "label": "DeepSeek-R1（推理）"},
    # ---- OpenAI ----
    "gpt-4o": {"provider": "openai", "label": "GPT-4o"},
    "gpt-4o-mini": {"provider": "openai", "label": "GPT-4o mini"},
    "o1-preview": {"provider": "openai", "label": "OpenAI o1"},
    # ---- 智谱 GLM ----
    "glm-4-plus": {"provider": "zhipu", "label": "智谱 GLM-4-Plus"},
    "glm-4-flash": {"provider": "zhipu", "label": "智谱 GLM-4-Flash（免费）"},
}


def _client(provider: str) -> AsyncOpenAI | None:
    """根据 provider 拿到对应 OpenAI 兼容客户端。"""
    base_map = {
        "openai": settings.openai_base_url,
        "deepseek": settings.deepseek_base_url,
        "zhipu": settings.zhipuai_base_url,
    }
    key_map = {
        "openai": settings.openai_api_key,
        "deepseek": settings.deepseek_api_key,
        "zhipu": settings.zhipuai_api_key,
    }
    api_key = key_map.get(provider, "")
    base_url = base_map.get(provider, "")
    if not api_key or not base_url:
        logger.warning("provider={} 缺少 API Key 或 Base URL，将被禁用", provider)
        return None
    return AsyncOpenAI(api_key=api_key, base_url=base_url)


# ---------- 客户端缓存 ----------

_clients: Dict[str, AsyncOpenAI] = {}


def get_client(model_id: str) -> AsyncOpenAI | None:
    provider = MODEL_REGISTRY.get(model_id, {}).get("provider")
    if not provider:
        return None
    if provider not in _clients:
        c = _client(provider)
        if c:
            _clients[provider] = c
    return _clients.get(provider)


def list_models() -> List[ModelInfo]:
    """返回前端可用的模型清单（含是否启用）。"""
    out: List[ModelInfo] = []
    for mid, info in MODEL_REGISTRY.items():
        client = get_client(mid)
        out.append(
            ModelInfo(
                id=mid,
                label=info["label"],
                provider=info["provider"],
                enabled=client is not None,
            )
        )
    return out


# ---------- 流式对话 ----------

async def stream_chat(
    model: str,
    messages: List[dict],
    temperature: float = 0.7,
    max_tokens: int = 2048,
    tools: Optional[List[dict]] = None,
) -> AsyncIterator[str]:
    """流式输出 token（带 function calling 检测）。

    对于支持 function calling 的模型，会把 tool_calls 信息以特殊标记
    `<<<TOOL_CALLS>>>{json}<<<END>>>` 混入流，前端 / chat.py 会解析。
    """
    client = get_client(model)
    if not client:
        yield f"[MiniAI 错误] 模型 {model} 未配置 API Key，请在 backend/.env 中设置。"
        return

    kwargs: dict = dict(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        stream=True,
    )
    if tools:
        kwargs["tools"] = tools

    try:
        stream = await client.chat.completions.create(**kwargs)

        # 累积 tool_calls 流（OpenAI 协议是逐片段返回的）
        tool_calls_acc: Dict[int, Dict] = {}

        async for chunk in stream:
            if not chunk.choices:
                continue
            choice = chunk.choices[0]
            delta = choice.delta

            # 1) 文本 token
            if delta.content:
                yield delta.content

            # 2) 工具调用增量
            if delta.tool_calls:
                for tc in delta.tool_calls:
                    idx = tc.index
                    slot = tool_calls_acc.setdefault(
                        idx, {"id": "", "type": "function", "function": {"name": "", "arguments": ""}}
                    )
                    if tc.id:
                        slot["id"] = tc.id
                    if tc.function:
                        if tc.function.name:
                            slot["function"]["name"] += tc.function.name
                        if tc.function.arguments:
                            slot["function"]["arguments"] += tc.function.arguments

            # 3) 整段结束 - 一次性输出所有 tool_calls
            if choice.finish_reason == "tool_calls" and tool_calls_acc:
                import json

                payload = [tool_calls_acc[k] for k in sorted(tool_calls_acc.keys())]
                yield f"\n\n<<<TOOL_CALLS>>>{json.dumps(payload, ensure_ascii=False)}<<<END>>>"
                break  # 工具调用完成，本轮流结束
    except Exception as e:
        logger.exception("LLM 调用失败: {}", e)
        yield f"\n\n[MiniAI 调用失败] {type(e).__name__}: {e}"


async def chat_once(
    model: str,
    messages: List[dict],
    temperature: float = 0.7,
    max_tokens: int = 2048,
    tools: Optional[List[dict]] = None,
) -> dict:
    """非流式一次返回（含 tool_calls）。

    返回 dict：
      - text: 文本内容
      - tool_calls: 工具调用列表（OpenAI 原始格式）
      - finish_reason: 结束原因
    """
    client = get_client(model)
    if not client:
        return {"text": f"[MiniAI 错误] 模型 {model} 未配置 API Key。", "tool_calls": [], "finish_reason": "error"}

    kwargs: dict = dict(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    if tools:
        kwargs["tools"] = tools

    try:
        resp = await client.chat.completions.create(**kwargs)
        choice = resp.choices[0]
        msg = choice.message
        return {
            "text": msg.content or "",
            "tool_calls": [tc.model_dump() for tc in (msg.tool_calls or [])],
            "finish_reason": choice.finish_reason,
        }
    except Exception as e:
        logger.exception("LLM 调用失败: {}", e)
        return {"text": f"[MiniAI 调用失败] {type(e).__name__}: {e}", "tool_calls": [], "finish_reason": "error"}
