"""模型清单 API。"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Header

from app.core.llm import list_models, parse_user_keys
from app.models.schemas import ModelListResponse

router = APIRouter()


def get_user_keys(x_user_api_keys: Optional[str] = Header(default=None)) -> dict:
    return parse_user_keys(x_user_api_keys)


@router.get("", response_model=ModelListResponse)
async def get_models(user_keys: dict = Depends(get_user_keys)) -> ModelListResponse:
    """返回前端可用的模型清单（结合用户的 API Key + .env 兜底）。"""
    return ModelListResponse(models=list_models(user_keys))


@router.post("/reload")
async def reload_models() -> dict:
    from app.core import llm

    llm._clients.clear()
    return {"reloaded": True, "count": len(llm.list_models())}
