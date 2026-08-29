"""多模型路由：基于 OpenAI 兼容协议统一接入 GPT / Claude / DeepSeek / 智谱 / 自部署 vLLM 等。

支持两种 API Key 来源（按优先级）：
1. 请求级：HTTP Header `X-User-API-Keys: {"deepseek":"sk-xxx"}`（推荐，多租户）
2. 全局级：backend/.env 配置（兜底，单租户/自部署）

本版本同时支持：
- 普通聊天（流式 / 非流式）
- Function Calling（通过 OpenAI tools 标准）
"""
from __future__ import annotations

import json
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


# ---------- Key 解析 ----------

def parse_user_keys(header_value: Optional[str]) -> Dict[str, str]:
    """解析请求头中的用户 API Keys。格式：JSON 对象 {provider: key}。"""
    if not header_value:
        return {}
    try:
        data = json.loads(header_value)
        if not isinstance(data, dict):
            return {}
        return {str(k).lower(): str(v) for k, v in data.items() if v}
    except Exception as e:
        logger.warning("X-User-API-Keys 解析失败: {}", e)
        return {}


def get_effective_keys(user_keys: Dict[str, str]) -> Dict[str, Dict[str, str]]:
    """合并用户 keys（优先）和 .env keys（兜底），返回每个 provider 的有效 key + base_url。

    返回格式：{provider: {"api_key": str, "base_url": str}}
    """
    env_keys = {
        "openai": {"api_key": settings.openai_api_key, "base_url": settings.openai_base_url},
        "deepseek": {"api_key": settings.deepseek_api_key, "base_url": settings.deepseek_base_url},
        "zhipu": {"api_key": settings.zhipuai_api_key, "base_url": settings.zhipuai_base_url},
    }
    for provider, val in env_keys.items():
        user_key = user_keys.get(provider, "").strip()
        if user_key:
            val["api_key"] = user_key
            val["source"] = "user"
        else:
            val["source"] = "env"
    return env_keys


def _client(provider: str, effective_keys: Optional[Dict[str, Dict[str, str]]] = None) -> AsyncOpenAI | None:
    """根据 provider 拿到对应 OpenAI 兼容客户端。"""
    info = (effective_keys or get_effective_keys({})).get(provider)
    if not info:
        return None
    api_key = info.get("api_key", "")
    base_url = info.get("base_url", "")
    if not api_key or not base_url:
        return None
    return AsyncOpenAI(api_key=api_key, base_url=base_url)


# ---------- 模型可用性查询 ----------

def list_models(user_keys: Optional[Dict[str, str]] = None) -> List[ModelInfo]:
    """返回前端可用的模型清单（含是否启用，enabled = 是否有任一有效 key）。"""
    keys = get_effective_keys(user_keys or {})
    out: List[ModelInfo] = []
    for mid, info in MODEL_REGISTRY.items():
        provider = info["provider"]
        client = _client(provider, keys)
        out.append(
            ModelInfo(
                id=mid,
                label=info["label"],
                provider=provider,
                enabled=client is not None,
            )
        )
    return out


def get_client(model_id: str, user_keys: Optional[Dict[str, str]] = None) -> AsyncOpenAI | None:
    """获取某个模型的 OpenAI 客户端（带 user key 支持）。"""
    info = MODEL_REGISTRY.get(model_id)
    if not info:
        return None
    provider = info["provider"]
    return _client(provider, get_effective_keys(user_keys or {}))


# ---------- 流式对话 ----------

async def stream_chat(
    model: str,
    messages: List[dict],
    temperature: float = 0.7,
    max_tokens: int = 2048,
    tools: Optional[List[dict]] = None,
    user_keys: Optional[Dict[str, str]] = None,
) -> AsyncIterator[str]:
    """流式输出 token（带 function calling 检测）。"""
    client = get_client(model, user_keys)
    if not client:
        yield f"[MiniAI 错误] 模型 {model} 未配置 API Key。请在前端 🔑 密钥管理 中填入。"
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

        tool_calls_acc: Dict[int, Dict] = {}

        async for chunk in stream:
            if not chunk.choices:
                continue
            choice = chunk.choices[0]
            delta = choice.delta

            if delta.content:
                yield delta.content

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

            if choice.finish_reason == "tool_calls" and tool_calls_acc:
                payload = [tool_calls_acc[k] for k in sorted(tool_calls_acc.keys())]
                yield f"\n\n<<<TOOL_CALLS>>>{json.dumps(payload, ensure_ascii=False)}<<<END>>>"
                break
    except Exception as e:
        logger.exception("LLM 调用失败: {}", e)
        yield f"\n\n[MiniAI 调用失败] {type(e).__name__}: {e}"


async def chat_once(
    model: str,
    messages: List[dict],
    temperature: float = 0.7,
    max_tokens: int = 2048,
    tools: Optional[List[dict]] = None,
    user_keys: Optional[Dict[str, str]] = None,
) -> dict:
    """非流式一次返回（含 tool_calls）。"""
    client = get_client(model, user_keys)
    if not client:
        return {"text": f"[MiniAI 错误] 模型 {model} 未配置 API Key。请在前端 🔑 密钥管理 中填入。", "tool_calls": [], "finish_reason": "error"}

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
