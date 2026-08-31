"""Redis 对话记忆窗口：只保留最近 N 轮（每轮 = 1 条 user + 1 条 assistant）。

- 每条消息序列化为 JSON 存到 Redis List，key = miniai:win:{session_id}
- push 时自动 ltrim 到 N*2 条，实现滑动窗口
- 读取时返回最近 N 轮消息（不含 system）
- 优雅降级：Redis 不可用返回 None，调用方回退到 MySQL 最近 N 轮
"""
from __future__ import annotations

import json
from typing import List, Optional

from loguru import logger

from app.config import settings

_client = None


def _redis():
    global _client
    if _client is None:
        import redis.asyncio as aioredis
        _client = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _client


def _cap() -> int:
    """窗口容量 = N 轮 * 2 条消息。"""
    return max(1, int(settings.memory_window_rounds)) * 2


# 窗口 key 的 TTL：每次写入刷新，防止被删除/放弃的会话留下永不过期的 key
WINDOW_TTL_SECONDS = 7 * 24 * 3600


async def push_window(session_id: str, role: str, content: str) -> bool:
    """把一条消息写入窗口，超出容量自动裁剪旧消息。"""
    if not session_id:
        return False
    try:
        r = _redis()
        key = f"miniai:win:{session_id}"
        await r.rpush(key, json.dumps({"role": role, "content": content}, ensure_ascii=False))
        length = await r.llen(key)
        cap = _cap()
        if length > cap:
            await r.ltrim(key, length - cap, -1)
        await r.expire(key, WINDOW_TTL_SECONDS)
        return True
    except Exception as e:
        logger.warning("Redis 窗口写入失败（回退 MySQL）: {}", e)
        return False


async def delete_window(session_id: str) -> bool:
    """删除会话对应的窗口 key（随会话删除一起调用）。"""
    if not session_id:
        return False
    try:
        await _redis().delete(f"miniai:win:{session_id}")
        return True
    except Exception as e:
        logger.warning("Redis 窗口删除失败: {}", e)
        return False


async def get_window(session_id: str) -> Optional[List[dict]]:
    """读取窗口消息；未命中或 Redis 不可用返回 None。"""
    if not session_id:
        return None
    try:
        r = _redis()
        key = f"miniai:win:{session_id}"
        raw = await r.lrange(key, 0, -1)
        if not raw:
            return None
        msgs = [json.loads(x) for x in raw if x]
        if not msgs:
            return None
        # 只取最近 cap 条，防止与后端窗口配置不一致
        return msgs[-_cap():]
    except Exception as e:
        logger.warning("Redis 窗口读取失败（回退 MySQL）: {}", e)
        return None
