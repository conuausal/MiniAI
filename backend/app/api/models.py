"""模型清单 API。"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Header

from app.core.llm import list_models, parse_custom_providers, parse_user_keys
from app.models.schemas import ModelListResponse

router = APIRouter()


def get_user_keys(x_user_api_keys: Optional[str] = Header(default=None)) -> dict:
    return parse_user_keys(x_user_api_keys)


def get_custom_providers(x_user_custom_providers: Optional[str] = Header(default=None)) -> dict:
    return parse_custom_providers(x_user_custom_providers)


@router.get("", response_model=ModelListResponse)
async def get_models(
    user_keys: dict = Depends(get_user_keys),
    custom_providers: dict = Depends(get_custom_providers),
) -> ModelListResponse:
    return ModelListResponse(models=list_models(user_keys, custom_providers))


@router.post("/reload")
async def reload_models() -> dict:
    """刷新模型清单（无缓存，直接重算）。"""
    from app.core import llm
    return {"reloaded": True, "count": len(llm.list_models())}
