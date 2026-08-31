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

from app.core.demo_provider import (
    DemoClient, generate_reply, is_demo_provider,
    planner_for_demo, researcher_for_demo, writer_for_demo,
)

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
    "demo":      {"label": "MiniAI 演示",       "emoji": "🎭", "base_url": ""},
}


# ---------- 模型注册表（20+ 模型） ----------

MODEL_REGISTRY: Dict[str, Dict[str, object]] = {
    # === 🎭 MiniAI 演示模式（免 Key） ===
    "miniai-demo":      {"provider": "demo",      "label": "MiniAI 演示模式",   "tags": ["免Key", "演示"]},
    "miniai-demo-fast": {"provider": "demo",      "label": "MiniAI Demo (快速)", "tags": ["免Key", "演示", "快速"]},
    # === 🐋 DeepSeek ===
    "deepseek-chat":      {"provider": "deepseek",  "label": "DeepSeek-V3",       "tags": ["推荐", "中文"]},
    "deepseek-reasoner":  {"provider": "deepseek",  "label": "DeepSeek-R1",       "tags": ["推理"]},
    "deepseek-v4-pro":    {"provider": "deepseek",  "label": "DeepSeek-V4 Pro",    "tags": ["推荐", "最新", "推理"]},
    "deepseek-v4-flash":  {"provider": "deepseek",  "label": "DeepSeek-V4 Flash",  "tags": ["最新", "快速", "经济"]},

    # === 🧠 OpenAI ===
    "gpt-4o":             {"provider": "openai",    "label": "GPT-4o",            "tags": ["多模态"]},
    "gpt-4o-mini":        {"provider": "openai",    "label": "GPT-4o mini",       "tags": ["快速", "经济"]},

    # === 🤖 MiniMax ===
    "MiniMax-M3":           {"provider": "MiniMax",     "label": "MiniMax-M3",         "tags": ["推荐", "多模态"]},

    # === 🀄 智谱 GLM ===
    "glm-4-plus":          {"provider": "zhipu",     "label": "GLM-4-Plus",         "tags": ["推荐"]},
    "glm-4-flash":         {"provider": "zhipu",     "label": "GLM-4-Flash",        "tags": ["免费"]},

    # === 🌙 Moonshot Kimi ===
    "moonshot-v1-128k":    {"provider": "moonshot",  "label": "Kimi 128K",          "tags": ["长文本", "推荐"]},

    # === ☁️ 通义千问 Qwen ===
    "qwen-max":            {"provider": "qwen",      "label": "Qwen-Max",           "tags": ["中文", "推荐"]},
    "qwen-plus":           {"provider": "qwen",      "label": "Qwen-Plus",          "tags": []},

    # === 💎 Google Gemini ===
    "gemini-2.0-flash-exp":{"provider": "gemini",    "label": "Gemini 2.0 Flash (实验)", "tags": ["最新"]},
}


# ---------- Key / 自定义 provider 解析 ----------

def parse_user_keys(header_value: Optional[str]) -> Dict[str, str]:
    """解析 X-User-API-Keys header。格式：JSON {provider: key}。

    保留原始大小写（因为 provider id 可能大小写敏感，如 "MiniMax"）。
    """
    if not header_value:
        return {}
    try:
        data = json.loads(header_value)
        if not isinstance(data, dict):
            return {}
        return {str(k): str(v) for k, v in data.items() if v}
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
        "demo":      {"api_key": "__demo__", "base_url": "__demo__"},
    }


def get_effective_keys(user_keys: Dict[str, str]) -> Dict[str, Dict[str, str]]:
    """合并 user keys + .env，每个 provider 返回 {api_key, base_url}。

    大小写不敏感查找（支持 "MiniMax" / "minimax" / "MINIMAX" 任意大小写）。
    """
    env = _get_env_keys()
    # 把 user_keys 标准化成小写 key 索引
    user_keys_lower = {k.lower(): v for k, v in user_keys.items()}
    for provider, val in env.items():
        user_key = user_keys_lower.get(provider.lower(), "").strip()
        if user_key:
            val["api_key"] = user_key
            val["source"] = "user"
        else:
            val["source"] = "env"
    return env


def _client(provider: str, effective_keys: Dict[str, Dict[str, str]]) -> Optional[AsyncOpenAI]:
    """演示模式：永远可用。其他 provider 必须有 key。"""
    if is_demo_provider(provider):
        return DemoClient()  # type: ignore[return-value]
    info = effective_keys.get(provider)
    if not info:
        return None
    api_key = (info.get("api_key") or "").strip()
    base_url = (info.get("base_url") or "").strip()
    if not api_key or not base_url:
        return None
    return AsyncOpenAI(api_key=api_key, base_url=base_url, timeout=settings.llm_timeout_seconds, max_retries=1)


def _custom_provider_client(custom: Dict[str, dict], provider_id: str) -> Optional[AsyncOpenAI]:
    info = custom.get(provider_id)
    if not info:
        return None
    api_key = (info.get("api_key") or "").strip()
    base_url = (info.get("base_url") or "").strip()
    if not api_key or not base_url:
        return None
    return AsyncOpenAI(api_key=api_key, base_url=base_url, timeout=settings.llm_timeout_seconds, max_retries=1)


# ---------- 模型清单 ----------

def list_models(
    user_keys: Optional[Dict[str, str]] = None,
    custom_providers: Optional[Dict[str, dict]] = None,
) -> List[ModelInfo]:
    keys = get_effective_keys(user_keys or {})
    custom = custom_providers or {}
    out: List[ModelInfo] = []

    def _has_valid_key(p: str) -> bool:
        if p == "demo":
            return True
        # 大小写不敏感查找
        info = keys.get(p) or keys.get(p.lower()) or keys.get(p.capitalize())
        if info is None:
            for k, v in keys.items():
                if k.lower() == p.lower():
                    info = v
                    break
        if info is None:
            return False
        return bool((info.get("api_key") or "").strip())

    def _custom_valid(pid: str) -> bool:
        info = custom.get(pid, {})
        base = (info.get("base_url") or "").strip()
        key = (info.get("api_key") or "").strip()
        return bool(base and key)

    for mid, info in MODEL_REGISTRY.items():
        provider = info["provider"]
        out.append(ModelInfo(
            id=mid,
            label=str(info["label"]),
            provider=str(provider),
            enabled=_has_valid_key(str(provider)),
            tags=list(info.get("tags", [])),
        ))
    for pid, p in custom.items():
        enabled = _custom_valid(pid)
        for m in p.get("models", []):
            out.append(ModelInfo(
                id=str(m["id"]),
                label=str(m["label"]),
                provider=f"custom:{pid}",
                enabled=enabled,
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

# 错误文本前缀：调用方（chat.py）据此判断不应写入对话记忆，避免污染后续上下文
LLM_ERROR_PREFIX = "[MiniAI 错误] "      # 未配置 Key 等
LLM_FAILED_PREFIX = "[MiniAI 调用失败] "  # LLM 调用异常


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
        yield f"{LLM_ERROR_PREFIX}模型 {model} 未配置 API Key。请在右上角 🔑 中填入对应 provider 的 Key。"
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
                    # demo 模型产出 dict，OpenAI SDK 产出 Pydantic 对象
                    if isinstance(tc, dict):
                        idx = tc.get("index", 0)
                        tc_id = tc.get("id") or ""
                        fn = tc.get("function") or {}
                        fn_name = fn.get("name") or ""
                        fn_args = fn.get("arguments") or ""
                    else:
                        idx = tc.index
                        tc_id = tc.id or ""
                        fn_name = tc.function.name if tc.function else ""
                        fn_args = tc.function.arguments if tc.function else ""
                    slot = tool_calls_acc.setdefault(idx, {"id": "", "type": "function", "function": {"name": "", "arguments": ""}})
                    if tc_id:
                        slot["id"] = tc_id
                    if fn_name:
                        slot["function"]["name"] += fn_name
                    if fn_args:
                        slot["function"]["arguments"] += fn_args

            if choice.finish_reason == "tool_calls" and tool_calls_acc:
                payload = [tool_calls_acc[k] for k in sorted(tool_calls_acc.keys())]
                yield f"\n\n<<<TOOL_CALLS>>>{json.dumps(payload, ensure_ascii=False)}<<<END>>>"
                break
    except Exception as e:
        logger.exception("LLM 调用失败: {}", e)
        yield f"\n\n{LLM_FAILED_PREFIX}{type(e).__name__}: {e}"


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
        return {"text": f"{LLM_ERROR_PREFIX}模型 {model} 未配置 API Key。", "tool_calls": [], "finish_reason": "error"}

    kwargs: dict = dict(model=model, messages=messages, temperature=temperature, max_tokens=max_tokens)
    if tools:
        kwargs["tools"] = tools

    try:
        resp = await client.chat.completions.create(**kwargs)
        choice = resp.choices[0]
        msg = choice.message
        return {
            "text": msg.content or "",
            "tool_calls": [tc if isinstance(tc, dict) else tc.model_dump() for tc in (msg.tool_calls or [])],
            "finish_reason": choice.finish_reason,
        }
    except Exception as e:
        logger.exception("LLM 调用失败: {}", e)
        return {"text": f"{LLM_FAILED_PREFIX}{type(e).__name__}: {e}", "tool_calls": [], "finish_reason": "error"}
