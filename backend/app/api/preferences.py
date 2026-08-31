"""用户个性化偏好 API：自定义系统提示词 + Webhook 自定义工具。"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.tools import get_tool_names
from app.db.database import get_session
from app.models.orm import UserPreference
from app.models.user import User

router = APIRouter()

_TOOL_NAME_RE = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")
_MAX_TOOLS = 20


class CustomToolIn(BaseModel):
    name: str
    description: str
    url: str
    parameters: Dict[str, Any] = Field(default_factory=lambda: {"type": "object", "properties": {}})


class PreferencesIn(BaseModel):
    system_prompt: str = ""
    custom_tools: List[CustomToolIn] = Field(default_factory=list)


def _validate_custom_tools(tools: List[CustomToolIn]) -> List[dict]:
    if len(tools) > _MAX_TOOLS:
        raise HTTPException(status_code=400, detail=f"自定义工具最多 {_MAX_TOOLS} 个")
    builtin = set(get_tool_names())
    seen: set = set()
    out: List[dict] = []
    for t in tools:
        name = t.name.strip()
        if not _TOOL_NAME_RE.fullmatch(name):
            raise HTTPException(status_code=400, detail=f"工具名不合法（仅限字母/数字/_/-，≤64 字符）: {name}")
        if name in builtin:
            raise HTTPException(status_code=400, detail=f"工具名与内置工具冲突: {name}")
        if name in seen:
            raise HTTPException(status_code=400, detail=f"工具名重复: {name}")
        seen.add(name)
        if not t.description.strip() or len(t.description) > 500:
            raise HTTPException(status_code=400, detail=f"工具描述需为 1-500 字符: {name}")
        url = t.url.strip()
        if not re.fullmatch(r"https?://[^\s]+", url):
            raise HTTPException(status_code=400, detail=f"工具 URL 必须以 http(s):// 开头: {name}")
        params = t.parameters
        if not isinstance(params, dict) or params.get("type") != "object":
            raise HTTPException(status_code=400, detail=f"parameters 必须是 type=object 的 JSON Schema: {name}")
        out.append({"name": name, "description": t.description.strip(), "url": url, "parameters": params})
    return out


async def _get_or_create(db: AsyncSession, user_id: int) -> UserPreference:
    pref = (await db.execute(select(UserPreference).where(UserPreference.user_id == user_id))).scalar_one_or_none()
    if pref is None:
        pref = UserPreference(user_id=user_id, system_prompt="", custom_tools=[])
        db.add(pref)
        await db.commit()
        await db.refresh(pref)
    return pref


async def load_user_preferences(db: AsyncSession, user_id: int) -> tuple[str, List[dict]]:
    """供聊天/其他模块读取：返回 (system_prompt, custom_tools)，无记录时给默认值。"""
    pref = (await db.execute(select(UserPreference).where(UserPreference.user_id == user_id))).scalar_one_or_none()
    if pref is None:
        return "", []
    return (pref.system_prompt or ""), (pref.custom_tools or [])


@router.get("")
async def get_preferences(
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> dict:
    pref = await _get_or_create(db, user.id)
    return {"system_prompt": pref.system_prompt or "", "custom_tools": pref.custom_tools or []}


@router.put("")
async def put_preferences(
    payload: PreferencesIn,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> dict:
    if len(payload.system_prompt) > 4000:
        raise HTTPException(status_code=400, detail="系统提示词最长 4000 字符")
    tools = _validate_custom_tools(payload.custom_tools)
    pref = await _get_or_create(db, user.id)
    pref.system_prompt = payload.system_prompt
    pref.custom_tools = tools
    await db.commit()
    return {"system_prompt": pref.system_prompt, "custom_tools": pref.custom_tools}
