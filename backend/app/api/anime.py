"""随机二次元 API：返回本地缓存的稳定图片 URL，避免"打开原图"换图。"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response

from app.core.random_anime import fetch_random_anime, get_cached_image

router = APIRouter()


@router.get("/random")
async def random_anime() -> dict:
    """获取一张随机二次元图片（返回本地缓存的稳定 URL）。"""
    url = await fetch_random_anime()
    if not url.startswith("/api/anime/image/"):
        raise HTTPException(status_code=502, detail=url)
    return {"url": url, "source": "elaina"}


@router.get("/image/{image_id}")
async def anime_image(image_id: str) -> Response:
    """返回缓存中的图片字节（稳定，反复访问不变）。"""
    cached = get_cached_image(image_id)
    if cached is None:
        raise HTTPException(status_code=404, detail="图片不存在或已过期")
    content, media_type = cached
    return Response(
        content=content,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )
