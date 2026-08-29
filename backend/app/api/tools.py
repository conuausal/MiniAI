"""工具清单 API。"""
from __future__ import annotations

from fastapi import APIRouter

from app.core.tools import list_tools
from app.models.schemas import ToolListResponse

router = APIRouter()


@router.get("", response_model=ToolListResponse)
async def get_tools() -> ToolListResponse:
    """返回所有可用工具的元信息（schema）。"""
    schemas = list_tools()
    return ToolListResponse(
        tools=[
            {
                "name": t["function"]["name"],
                "description": t["function"]["description"],
                "parameters": t["function"]["parameters"],
            }
            for t in schemas
        ]
    )
