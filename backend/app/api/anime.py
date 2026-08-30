"""随机二次元 API：代理外部随机图片接口，返回最终图片 URL。"""
from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException

from app.config import settings

router = APIRouter()


@router.get("/random")
async def random_anime() -> dict:
    """获取一张随机二次元图片 URL。"""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
            resp = await client.get(settings.random_anime_api)
            if resp.status_code >= 400:
                raise HTTPException(status_code=502, detail=f"外部接口返回 {resp.status_code}")
            return {"url": str(resp.url), "source": "elaina"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"获取随机二次元图片失败: {e}") from e
