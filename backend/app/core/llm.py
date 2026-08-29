"""多模型路由：基于 OpenAI 兼容协议统一接入 GPT / Claude / DeepSeek / 智谱 / 自部署 vLLM 等。"""
from __future__ import annotations

from typing import AsyncIterator, Dict, List

from loguru import logger
from openai import AsyncOpenAI

from app.config import settings
from app.models.schemas import ModelInfo


# ---------- 模型清单（用户可在前端一键切换） ----------

MODEL_REGISTRY: Dict[str, Dict[str, str]] = {
    # ---- DeepSeek（默认推荐：性价比 + 中文强） ----
    "deepseek-chat": {"provider": "deepseek", "label": "DeepSeek-V3", "base_url": "deepseek", "api_key": "deepseek"},
    "deepseek-reasoner": {"provider": "deepseek", "label": "DeepSeek-R1（推理）", "base_url": "deepseek", "api_key": "deepseek"},
    # ---- OpenAI ----
    "gpt-4o": {"provider": "openai", "label": "GPT-4o", "base_url": "openai", "api_key": "openai"},
    "gpt-4o-mini": {"provider": "openai", "label": "GPT-4o mini", "base_url": "openai", "api_key": "openai"},
    "o1-preview": {"provider": "openai", "label": "OpenAI o1", "base_url": "openai", "api_key": "openai"},
    # ---- 智谱 GLM ----
    "glm-4-plus": {"provider": "zhipu", "label": "智谱 GLM-4-Plus", "base_url": "zhipu", "api_key": "zhipu"},
    "glm-4-flash": {"provider": "zhipu", "label": "智谱 GLM-4-Flash（免费）", "base_url": "zhipu", "api_key": "zhipu"},
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
    info = MODEL_REGISTRY.get(model_id)
    if not info:
        return None
    provider = info["provider"]
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
) -> AsyncIterator[str]:
    """统一流式输出（SSE 用）。"""
    client = get_client(model)
    if not client:
        yield f"[MiniAI 错误] 模型 {model} 未配置 API Key，请在 backend/.env 中设置。"
        return

    try:
        stream = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                yield delta
    except Exception as e:
        logger.exception("LLM 调用失败: {}", e)
        yield f"\n\n[MiniAI 调用失败] {type(e).__name__}: {e}"


async def chat_once(
    model: str,
    messages: List[dict],
    temperature: float = 0.7,
    max_tokens: int = 2048,
) -> str:
    """非流式一次返回。"""
    client = get_client(model)
    if not client:
        return f"[MiniAI 错误] 模型 {model} 未配置 API Key。"
    resp = await client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return resp.choices[0].message.content or ""
