"""联网搜索：基于阿里云百炼（DashScope）Web Search（通义千问 enable_search）。

DashScope 兼容 OpenAI 的 Chat Completions，加 `enable_search: true` 即触发实时联网搜索
（仅支持流式）。返回的是带来源标注（（来源：[N] 媒体, 日期））的综合回答，
这里把回答作为一条搜索结果返回，供对话增强 / 工具 / 写作流水线引用。

Key 来源：DASHSCOPE_API_KEY 环境变量 / 后端 .env 的 DASHSCOPE_API_KEY（与 qwen 共用）。
未配置时回退到旧的 Tavily（若配了 TAVILY_API_KEY）。
"""
from __future__ import annotations

import json
from typing import List, Optional

import httpx
from loguru import logger

from app.config import settings

SEARCH_ENDPOINT = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
SEARCH_MODEL = "qwen-plus"


def _dashscope_key() -> str:
    """取 DashScope key：优先显式配置的 dashscope，其次 qwen（二者本就是同一个 key）。"""
    return (settings.dashscope_api_key or settings.qwen_api_key or "").strip()


async def _search_via_dashscope(query: str) -> List[dict]:
    """调用 DashScope enable_search 流式接口，返回综合回答（含来源标注）。"""
    key = _dashscope_key()
    if not key:
        return []
    payload = []
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            async with client.stream(
                "POST",
                SEARCH_ENDPOINT,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={
                    "model": SEARCH_MODEL,
                    "messages": [{"role": "user", "content": query}],
                    "enable_search": True,
                    "search_options": {"search_strategy": "agent", "enable_source": True},
                    "stream": True,
                },
            ) as resp:
                if resp.status_code != 200:
                    logger.warning("DashScope 联网搜索 HTTP {}", resp.status_code)
                    return []
                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if not data or data == "[DONE]":
                        continue
                    try:
                        chunk = json.loads(data)
                    except Exception:
                        continue
                    for ch in chunk.get("choices", []):
                        delta = ch.get("delta") or {}
                        t = delta.get("content")
                        if t:
                            payload.append(t)
    except Exception as e:
        logger.exception("DashScope 联网搜索失败: {}", e)
        return []
    text = "".join(payload).strip()
    if not text:
        return []
    return [{
        "title": f"联网搜索：{query}",
        "url": "",
        "content": text,
    }]


async def _search_via_tavily(query: str, max_results: int) -> List[dict]:
    """旧的 Tavily 兜底实现。"""
    try:
        from tavily import TavilyClient

        client = TavilyClient(api_key=settings.tavily_api_key)
        resp = client.search(query=query, max_results=max_results, search_depth="basic")
        results: List[dict] = []
        for item in resp.get("results", []):
            results.append({
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "content": item.get("content", ""),
            })
        return results
    except Exception as e:
        logger.exception("Tavily 联网搜索失败: {}", e)
        return []


async def web_search(query: str, max_results: int = 5) -> List[dict]:
    """返回搜索结果。优先 DashScope，未配置 key 时回退 Tavily。"""
    if _dashscope_key():
        return await _search_via_dashscope(query)
    if settings.tavily_api_key:
        return await _search_via_tavily(query, max_results=min(max_results, 10))
    logger.warning("未配置 DASHSCOPE_API_KEY / TAVILY_API_KEY，联网搜索不可用")
    return []


def format_for_prompt(results: List[dict]) -> str:
    """把搜索结果格式化成可注入 prompt 的上下文。"""
    if not results:
        return ""
    blocks = []
    for i, r in enumerate(results, 1):
        line = f"[{i}] {r['title']}\n{r['content']}"
        if r.get("url"):
            line += f"\n来源: {r['url']}"
        blocks.append(line)
    return "\n\n".join(blocks)
