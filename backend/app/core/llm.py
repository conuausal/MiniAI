"""多模型路由：基于 OpenAI 兼容协议统一接入 8 个 provider · 20+ 模型。

支持的 provider：
  - 内置：DeepSeek / OpenAI / MiniMax / 智谱 GLM / Moonshot Kimi / 通义千问 Qwen / Google Gemini / Ollama（本地）
  - 自定义：用户在 ApiKeyDrawer 里填写任意 OpenAI 兼容服务的 base_url + api_key + models

API Key 来源（按优先级）：
1. 请求级 Header `X-User-API-Keys: {"deepseek":"sk-xxx"}`（用户在前端填的）
2. 请求级 Header `X-User-Custom-Providers: {...}`（用户自定义 provider）
3. 全局 `.env`（自部署兜底）
"""
from __future__ import annotations

import json
from typing import AsyncIterator, Dict, List, Optional

from loguru import logger
from openai import AsyncOpenAI

from app.config import settings
from app.models.schemas import ModelInfo


# ---------- Provider 默认配置 ----------

PROVIDER_DEFAULTS: Dict[str, Dict[str, str]] = {
    "deepseek":  {"label": "DeepSeek",        "emoji": "🐋", "base_url": "https://api.deepseek.com/v1"},
    "openai":    {"label": "OpenAI",          "emoji": "🧠", "base_url": "https://api.openai.com/v1"},
    "MiniMax":     {"label": "MiniMax",          "emoji": "🤖", "base_url": "https://api.MiniMax.chat/v1"},
    "zhipu":     {"label": "智谱 GLM",         "emoji": "🀄", "base_url": "https://open.bigmodel.cn/api/paas/v4"},
    "moonshot":  {"label": "Moonshot Kimi",    "emoji": "🌙", "base_url": "https://api.moonshot.cn/v1"},
    "qwen":      {"label": "通义千问 Qwen",    "emoji": "☁️", "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1"},
    "gemini":    {"label": "Google Gemini",    "emoji": "💎", "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/"},
    "ollama":    {"label": "Ollama 本地",      "emoji": "🦙", "base_url": "http://localhost:11434/v1"},
}


# ---------- 模型注册表（20+ 模型） ----------

MODEL_REGISTRY: Dict[str, Dict[str, object]] = {
    # === 🐋 DeepSeek ===
    "deepseek-chat":      {"provider": "deepseek",  "label": "DeepSeek-V3",       "tags": ["推荐", "中文"]},
    "deepseek-reasoner":  {"provider": "deepseek",  "label": "DeepSeek-R1",       "tags": ["推理"]},
    "deepseek-coder":     {"provider": "deepseek",  "label": "DeepSeek-Coder-V2", "tags": ["代码"]},

    # === 🧠 OpenAI ===
    "gpt-4o":             {"provider": "openai",    "label": "GPT-4o",            "tags": ["多模态"]},
    "gpt-4o-mini":        {"provider": "openai",    "label": "GPT-4o mini",       "tags": ["快速", "经济"]},
    "gpt-4-turbo":        {"provider": "openai",    "label": "GPT-4 Turbo",       "tags": []},
    "gpt-3.5-turbo":      {"provider": "openai",    "label": "GPT-3.5 Turbo",     "tags": ["经济"]},
    "o1-preview":         {"provider": "openai",    "label": "OpenAI o1",         "tags": ["推理"]},
    "o1-mini":            {"provider": "openai",    "label": "OpenAI o1 mini",    "tags": ["推理", "经济"]},

    # === 🤖 MiniMax ===
    "MiniMax-M3":           {"provider": "MiniMax",     "label": "MiniMax-M3",         "tags": ["推荐", "多模态"]},
    "MiniMax-Text-01":      {"provider": "MiniMax",     "label": "MiniMax-Text-01",    "tags": ["长文本"]},
    "abab6.5s-chat":       {"provider": "MiniMax",     "label": "abab6.5s",           "tags": []},

    # === 🀄 智谱 GLM ===
    "glm-4-plus":          {"provider": "zhipu",     "label": "GLM-4-Plus",         "tags": ["推荐"]},
    "glm-4-flash":         {"provider": "zhipu",     "label": "GLM-4-Flash",        "tags": ["免费"]},
    "glm-4-long":          {"provider": "zhipu",     "label": "GLM-4-Long",         "tags": ["长文本"]},

    # === 🌙 Moonshot Kimi ===
    "moonshot-v1-128k":    {"provider": "moonshot",  "label": "Kimi 128K",          "tags": ["长文本", "推荐"]},
    "moonshot-v1-32k":     {"provider": "moonshot",  "label": "Kimi 32K",           "tags": []},
    "moonshot-v1-8k":      {"provider": "moonshot",  "label": "Kimi 8K",            "tags": ["快速"]},

    # === ☁️ 通义千问 Qwen ===
    "qwen-max":            {"provider": "qwen",      "label": "Qwen-Max",           "tags": ["中文", "推荐"]},
    "qwen-plus":           {"provider": "qwen",      "label": "Qwen-Plus",          "tags": []},
    "qwen-turbo":          {"provider": "qwen",      "label": "Qwen-Turbo",         "tags": ["快速"]},
    "qwen-long":           {"provider": "qwen",      "label": "Qwen-Long",          "tags": ["长文本"]},

    # === 💎 Google Gemini ===
    "gemini-1.5-pro":      {"provider": "gemini",    "label": "Gemini 1.5 Pro",     "tags": ["长文本", "多模态"]},
    "gemini-1.5-flash":    {"provider": "gemini",    "label": "Gemini 1.5 Flash",   "tags": ["快速", "免费"]},
    "gemini-2.0-flash-exp":{"provider": "gemini",    "label": "Gemini 2.0 Flash (实验)", "tags": ["最新"]},
}


# ---------- Key / 自定义 provider 解析 ----------

def parse_user_keys(header_value: Optional[str]) -> Dict[str, str]:
    """解析 X-User-API-Keys header。格式：JSON {provider: key}。"""
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


def parse_custom_providers(header_value: Optional[str]) -> Dict[str, dict]:
    """解析 X-User-Custom-Providers header。

    格式：
    {
      "my_openai_compat": {
        "label": "我的服务",
        "emoji": "🔧",
        "base_url": "https://api.example.com/v1",
        "api_key": "sk-xxx",
        "models": [{"id": "my-model", "label": "我的模型", "tags": []}]
      },
      ...
    }
    """
    if not header_value:
        return {}
    try:
        data = json.loads(header_value)
        if not isinstance(data, dict):
            return {}
        # 简单校验每个 provider 至少有 base_url 和至少 1 个 model
        cleaned = {}
        for pid, p in data.items():
            if not isinstance(p, dict):
                continue
            base_url = str(p.get("base_url", "")).strip()
            api_key = str(p.get("api_key", "")).strip()
            models = p.get("models") or []
            if not base_url or not isinstance(models, list) or not models:
                continue
            valid_models = []
            for m in models:
                if not isinstance(m, dict):
                    continue
                mid = str(m.get("id", "")).strip()
                if not mid:
                    continue
                valid_models.append({
                    "id": mid,
                    "label": str(m.get("label", mid)),
                    "tags": m.get("tags") or [],
                })
            if valid_models:
                cleaned[str(pid)] = {
                    "label": str(p.get("label", pid)),
                    "emoji": str(p.get("emoji", "⚙️")),
                    "base_url": base_url,
                    "api_key": api_key,
                    "models": valid_models,
                }
        return cleaned
    except Exception as e:
        logger.warning("X-User-Custom-Providers 解析失败: {}", e)
        return {}


def _get_env_keys() -> Dict[str, Dict[str, str]]:
    """从 .env 读各 provider 的 api_key + base_url。"""
    return {
        "deepseek":  {"api_key": settings.deepseek_api_key,  "base_url": settings.deepseek_base_url  or PROVIDER_DEFAULTS["deepseek"]["base_url"]},
        "openai":    {"api_key": settings.openai_api_key,    "base_url": settings.openai_base_url    or PROVIDER_DEFAULTS["openai"]["base_url"]},
        "MiniMax":     {"api_key": settings.MiniMax_api_key,     "base_url": settings.MiniMax_base_url     or PROVIDER_DEFAULTS["MiniMax"]["base_url"]},
        "zhipu":     {"api_key": settings.zhipuai_api_key,   "base_url": settings.zhipuai_base_url   or PROVIDER_DEFAULTS["zhipu"]["base_url"]},
        "moonshot":  {"api_key": settings.moonshot_api_key,  "base_url": PROVIDER_DEFAULTS["moonshot"]["base_url"]},
        "qwen":      {"api_key": settings.qwen_api_key,      "base_url": PROVIDER_DEFAULTS["qwen"]["base_url"]},
        "gemini":    {"api_key": settings.gemini_api_key,    "base_url": PROVIDER_DEFAULTS["gemini"]["base_url"]},
    }


def get_effective_keys(user_keys: Dict[str, str]) -> Dict[str, Dict[str, str]]:
    """合并 user keys + .env，每个 provider 返回 {api_key, base_url}。"""
    env = _get_env_keys()
    for provider, val in env.items():
        user_key = user_keys.get(provider, "").strip()
        if user_key:
            val["api_key"] = user_key
            val["source"] = "user"
        else:
            val["source"] = "env"
    return env


def _client(provider: str, effective_keys: Dict[str, Dict[str, str]]) -> Optional[AsyncOpenAI]:
    info = effective_keys.get(provider)
    if not info:
        return None
    api_key = (info.get("api_key") or "").strip()
    base_url = (info.get("base_url") or "").strip()
    if not api_key or not base_url:
        return None
    return AsyncOpenAI(api_key=api_key, base_url=base_url)


def _custom_provider_client(custom: Dict[str, dict], provider_id: str) -> Optional[AsyncOpenAI]:
    info = custom.get(provider_id)
    if not info:
        return None
    api_key = (info.get("api_key") or "").strip()
    base_url = (info.get("base_url") or "").strip()
    if not api_key or not base_url:
        return None
    return AsyncOpenAI(api_key=api_key, base_url=base_url)


# ---------- 模型清单 ----------

def list_models(
    user_keys: Optional[Dict[str, str]] = None,
    custom_providers: Optional[Dict[str, dict]] = None,
) -> List[ModelInfo]:
    """返回所有可用模型。enabled = 是否有有效 key + 可解析的 client。"""
    keys = get_effective_keys(user_keys or {})
    custom = custom_providers or {}
    out: List[ModelInfo] = []
    # 内置模型
    for mid, info in MODEL_REGISTRY.items():
        provider = info["provider"]
        client = _client(provider, keys)
        out.append(ModelInfo(
            id=mid,
            label=str(info["label"]),
            provider=str(provider),
            enabled=client is not None, tags=list(info.get("tags", [])),
        ))
    # 自定义 provider 的模型
    for pid, p in custom.items():
        client = _custom_provider_client(custom, pid)
        for m in p.get("models", []):
            out.append(ModelInfo(
                id=str(m["id"]),
                label=str(m["label"]),
                provider=f"custom:{pid}",
                enabled=client is not None,
                tags=list(m.get("tags", [])),
            ))
    return out


def get_client(
    model_id: str,
    user_keys: Optional[Dict[str, str]] = None,
    custom_providers: Optional[Dict[str, dict]] = None,
) -> Optional[AsyncOpenAI]:
    """获取某个模型的 client。支持内置 + 自定义。"""
    custom = custom_providers or {}
    # 自定义 provider 模型（model_id 可能直接属于自定义，或者自定义带前缀）
    for pid, p in custom.items():
        for m in p.get("models", []):
            if m["id"] == model_id:
                return _custom_provider_client(custom, pid)
    # 内置模型
    info = MODEL_REGISTRY.get(model_id)
    if not info:
        return None
    provider = info["provider"]
    return _client(str(provider), get_effective_keys(user_keys or {}))


# ---------- 流式对话 ----------

async def stream_chat(
    model: str,
    messages: List[dict],
    temperature: float = 0.7,
    max_tokens: int = 2048,
    tools: Optional[List[dict]] = None,
    user_keys: Optional[Dict[str, str]] = None,
    custom_providers: Optional[Dict[str, dict]] = None,
) -> AsyncIterator[str]:
    """流式输出 token（带 function calling 检测）。"""
    client = get_client(model, user_keys, custom_providers)
    if not client:
        yield f"[MiniAI 错误] 模型 {model} 未配置 API Key。请在右上角 🔑 中填入对应 provider 的 Key。"
        return

    kwargs: dict = dict(model=model, messages=messages, temperature=temperature, max_tokens=max_tokens, stream=True)
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
                    slot = tool_calls_acc.setdefault(idx, {"id": "", "type": "function", "function": {"name": "", "arguments": ""}})
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
    custom_providers: Optional[Dict[str, dict]] = None,
) -> dict:
    """非流式一次返回。"""
    client = get_client(model, user_keys, custom_providers)
    if not client:
        return {"text": f"[MiniAI 错误] 模型 {model} 未配置 API Key。", "tool_calls": [], "finish_reason": "error"}

    kwargs: dict = dict(model=model, messages=messages, temperature=temperature, max_tokens=max_tokens)
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
