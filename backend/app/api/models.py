"""模型清单 API。"""
from __future__ import annotations

from fastapi import APIRouter

from app.core.llm import list_models
from app.models.schemas import ModelListResponse

router = APIRouter()


@router.get("", response_model=ModelListResponse)
async def get_models() -> ModelListResponse:
    return ModelListResponse(models=list_models())


@router.post("/reload")
async def reload_models() -> dict:
    """热刷新：清空客户端缓存（修改 .env 后调用）。"""
    from app.core import llm

    llm._clients.clear()
    return {"reloaded": True, "count": len(llm.list_models())}
