"""联网搜索：默认走 Tavily（专为 AI 优化的搜索 API），可替换为 SerpAPI / Bing。"""
from __future__ import annotations

from typing import List

from loguru import logger

from app.config import settings


async def web_search(query: str, max_results: int = 5) -> List[dict]:
    """返回结构化搜索结果。

    每条结果形如：{"title": str, "url": str, "content": str}
    """
    if not settings.tavily_api_key:
        logger.warning("TAVILY_API_KEY 未配置，跳过联网搜索")
        return []

    try:
        from tavily import TavilyClient

        client = TavilyClient(api_key=settings.tavily_api_key)
        resp = client.search(
            query=query,
            max_results=max_results,
            search_depth="basic",
            include_raw_content=False,
        )
        results: List[dict] = []
        for item in resp.get("results", []):
            results.append(
                {
                    "title": item.get("title", ""),
                    "url": item.get("url", ""),
                    "content": item.get("content", ""),
                }
            )
        return results
    except Exception as e:
        logger.exception("联网搜索失败: {}", e)
        return []


def format_for_prompt(results: List[dict]) -> str:
    """把搜索结果格式化成可注入 prompt 的上下文。"""
    if not results:
        return ""
    blocks = []
    for i, r in enumerate(results, 1):
        blocks.append(f"[{i}] {r['title']}\n{r['content']}\n来源: {r['url']}")
    return "\n\n".join(blocks)
