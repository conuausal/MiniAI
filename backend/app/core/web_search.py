"""联网搜索：基于阿里云百炼（DashScope）Web Search（通义千问 enable_search）。

DashScope 兼容 OpenAI 的 Chat Completions，加 `enable_search: true` 即触发实时联网搜索
（仅支持流式）。返回的是带来源标注（（来源：[N] 媒体, 日期））的综合回答，
这里把回答作为一条搜索结果返回，供对话增强 / 工具 / 写作流水线引用。

Key 来源：DASHSCOPE_API_KEY 环境变量 / 后端 .env 的 DASHSCOPE_API_KEY（与 qwen 共用）。
未配置时回退到旧的 Tavily（若配了 TAVILY_API_KEY）。
"""
from __future__ import annotations

import asyncio
import json
from typing import List, Optional

import httpx
from loguru import logger

from app.config import settings

SEARCH_ENDPOINT = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
SEARCH_MODEL = "qwen-plus"

# DeepSeek 原生联网搜索（Anthropic 兼容端点 + 服务端 web_search 工具）：
# 搜索/网页抓取/解密全部在 DeepSeek 服务端完成，返回综合答案+来源链接，无需第三方搜索 API
DEEPSEEK_ANTHROPIC_URL = "https://api.deepseek.com/anthropic/v1/messages"
DEEPSEEK_SEARCH_MODEL = "deepseek-v4-flash"
_DEEPSEEK_SEARCH_SYSTEM = (
    "You are a web search assistant. Follow these rules strictly:\n"
    "1. Use web_search to find relevant, up-to-date information for the user's query.\n"
    "2. After receiving search results, write a comprehensive, well-structured answer "
    "in plain text based on what you found. Include specific details, dates, and facts.\n"
    "3. Do NOT output tool-call XML (no <invoke> tags).\n"
    "4. Do NOT call web_search again after you have results.\n"
    "5. Answer in the same language the user used in their query.\n"
    "6. If search results are poor or irrelevant, explain why and suggest better keywords.\n"
    "Your response must be the final answer, not another search request."
)


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
        # 搜索应在数秒内返回；20s 已是极宽上限，避免工具调用期间前端长时间无反馈
        async with httpx.AsyncClient(timeout=20) as client:
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
        # 同步网络调用放线程池，避免阻塞事件循环
        resp = await asyncio.to_thread(
            client.search, query=query, max_results=max_results, search_depth="basic"
        )
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


async def _search_via_deepseek(query: str) -> List[dict]:
    """DeepSeek 原生联网搜索（服务端 web_search_20250305 工具，Anthropic 兼容端点）。"""
    key = (settings.deepseek_api_key or "").strip()
    if not key:
        return []
    try:
        # 抓取网页内容需要时间，30s 已是宽上限
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                DEEPSEEK_ANTHROPIC_URL,
                headers={"x-api-key": key, "content-type": "application/json"},
                json={
                    "model": DEEPSEEK_SEARCH_MODEL,
                    "max_tokens": 4096,
                    "messages": [
                        {"role": "system", "content": _DEEPSEEK_SEARCH_SYSTEM},
                        {"role": "user", "content": query},
                    ],
                    "tools": [{"type": "web_search_20250305", "name": "web_search"}],
                    "tool_choice": {"type": "auto"},
                },
            )
        if resp.status_code != 200:
            logger.warning("DeepSeek 原生搜索 HTTP {}: {}", resp.status_code, resp.text[:200])
            return []
        data = resp.json()
        text_parts: List[str] = []
        urls: List[tuple] = []
        for block in data.get("content") or []:
            btype = block.get("type")
            if btype == "text" and (block.get("text") or "").strip():
                text_parts.append(block["text"].strip())
            elif btype == "web_search_tool_result":
                for item in block.get("content") or []:
                    if item.get("type") == "web_search_result":
                        urls.append((item.get("title") or "Untitled", item.get("url") or "", item.get("page_age")))
        answer = "\n\n".join(text_parts).strip()
        if not answer and not urls:
            return []
        content = answer or "（无综合回答，仅来源列表）"
        if urls:
            src = "\n".join(
                f"{i}. {t} {u}" + (f"（{age}）" if age else "")
                for i, (t, u, age) in enumerate(urls, 1)
            )
            content += f"\n\n来源链接：\n{src}"
        return [{
            "title": f"DeepSeek 联网搜索：{query}",
            "url": urls[0][1] if urls else "",
            "content": content[:8000],
        }]
    except Exception as e:
        logger.exception("DeepSeek 原生联网搜索失败: {}", e)
        return []


def _ordered_backends() -> List[str]:
    """按 SEARCH_BACKEND 配置或已配置的 Key 决定搜索后端优先级。"""
    pref = (settings.search_backend or "auto").strip().lower()
    if pref in ("dashscope", "deepseek", "tavily"):
        return [pref]
    order: List[str] = []
    if _dashscope_key():
        order.append("dashscope")
    if (settings.deepseek_api_key or "").strip():
        order.append("deepseek")
    if (settings.tavily_api_key or "").strip():
        order.append("tavily")
    return order


async def web_search(query: str, max_results: int = 5) -> List[dict]:
    """返回搜索结果。按 SEARCH_BACKEND（auto/dashscope/deepseek/tavily）依次尝试。"""
    backends = _ordered_backends()
    if not backends:
        logger.warning("未配置任何搜索后端的 Key（DASHSCOPE / DEEPSEEK / TAVILY），联网搜索不可用")
        return []
    for name in backends:
        try:
            if name == "dashscope":
                results = await _search_via_dashscope(query)
            elif name == "deepseek":
                results = await _search_via_deepseek(query)
            elif name == "tavily":
                results = await _search_via_tavily(query, max_results=min(max_results, 10))
            else:
                continue
        except Exception as e:
            logger.warning("搜索后端 {} 异常: {}", name, e)
            results = []
        if results:
            return results
        logger.warning("搜索后端 {} 无结果，尝试下一个", name)
    logger.warning("所有搜索后端均无结果: {}", backends)
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
