"""登录注册 API。"""
from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    clear_auth_cookie, create_token, get_current_user,
    hash_password, set_auth_cookie, verify_password,
)
from app.db.database import get_session
from app.models.user import User

router = APIRouter()


class AuthPayload(BaseModel):
    username: str
    password: str


def _validate(username: str, password: str) -> None:
    if not re.fullmatch(r"[A-Za-z0-9_\-一-鿿]{3,32}", username):
        raise HTTPException(status_code=400, detail="用户名需为 3-32 位字母/数字/下划线/中文")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="密码至少 6 位")


@router.post("/register")
async def register(payload: AuthPayload, response: Response, db: AsyncSession = Depends(get_session)):
    _validate(payload.username, payload.password)
    exists = (await db.execute(select(User).where(User.username == payload.username))).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=400, detail="用户名已被注册")
    user = User(username=payload.username, password_hash=hash_password(payload.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    set_auth_cookie(response, create_token(user))
    return {"user": {"id": user.id, "username": user.username}}


@router.post("/login")
async def login(payload: AuthPayload, response: Response, db: AsyncSession = Depends(get_session)):
    user = (await db.execute(select(User).where(User.username == payload.username))).scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    set_auth_cookie(response, create_token(user))
    return {"user": {"id": user.id, "username": user.username}}


@router.post("/logout")
async def logout(response: Response):
    clear_auth_cookie(response)
    return {"ok": True}


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return {"user": {"id": user.id, "username": user.username}}
