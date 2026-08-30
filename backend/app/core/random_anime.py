"""随机二次元：拉取外部随机图片并缓存为本地稳定 URL。

外部接口 https://api.elaina.cat/random/ 直接在该 URL 返回随机图片（不重定向到具体文件），
若把该 URL 直接给前端，每次访问都会得到一张新图（"打开原图"就换图了）。
这里把图片字节缓存到 backend/data/anime_cache/，返回我们自己的稳定 URL
`/api/anime/image/{id}`，保证同一张图反复访问不变。
"""
from __future__ import annotations

import time
import uuid
from pathlib import Path
from typing import Optional, Tuple

import httpx
from loguru import logger

from app.config import settings

# 缓存目录：与知识库上传目录同级的 backend/data/anime_cache
CACHE_DIR = Path(settings.vector_store_dir).parent / "anime_cache"
CACHE_TTL_SECONDS = 60 * 30  # 30 分钟
MAX_CACHE_FILES = 50


async def fetch_random_anime() -> str:
    """从外部接口拉一张随机二次元图并缓存，返回本地稳定 URL。

    失败时返回错误描述字符串（不以 /api/anime/image/ 开头）。
    """
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=20) as client:
            resp = await client.get(settings.random_anime_api)
            if resp.status_code >= 400:
                return f"获取失败：外部接口返回 {resp.status_code}"
            content = resp.content
            media_type = resp.headers.get("content-type") or "image/jpeg"
    except Exception as e:
        logger.warning("获取随机二次元失败: {}", e)
        return f"获取随机二次元图片失败: {e}"

    image_id = uuid.uuid4().hex
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        (CACHE_DIR / f"{image_id}.img").write_bytes(content)
        (CACHE_DIR / f"{image_id}.meta").write_text(media_type, encoding="utf-8")
        _cleanup_cache()
    except Exception as e:
        logger.warning("缓存随机二次元图片失败: {}", e)
        return f"缓存图片失败: {e}"
    return f"/api/anime/image/{image_id}"


def get_cached_image(image_id: str) -> Optional[Tuple[bytes, str]]:
    """读取缓存图片，返回 (bytes, media_type)；不存在或过期返回 None。"""
    img = CACHE_DIR / f"{image_id}.img"
    if not img.exists():
        return None
    media_type = "image/jpeg"
    meta = CACHE_DIR / f"{image_id}.meta"
    if meta.exists():
        media_type = meta.read_text(encoding="utf-8").strip() or media_type
    return img.read_bytes(), media_type


def _cleanup_cache() -> None:
    """淘汰超量/过期缓存，防止磁盘与目录无界增长。"""
    now = time.time()
    files = sorted(CACHE_DIR.glob("*.img"), key=lambda p: p.stat().st_mtime, reverse=True)
    for f in files[MAX_CACHE_FILES:]:
        _remove_pair(f)
    for f in files:
        if now - f.stat().st_mtime > CACHE_TTL_SECONDS:
            _remove_pair(f)


def _remove_pair(img: Path) -> None:
    img.unlink(missing_ok=True)
    (CACHE_DIR / (img.stem + ".meta")).unlink(missing_ok=True)
