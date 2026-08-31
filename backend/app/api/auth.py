"""登录注册 API。"""
from __future__ import annotations

import re
import time

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
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
    if len(password.encode("utf-8")) > 72:
        # bcrypt 只取前 72 字节，超长部分静默失效——直接拒绝而不是截断
        raise HTTPException(status_code=400, detail="密码过长（UTF-8 编码后不超过 72 字节）")


# ---- 登录限流（进程内滑动窗口，仅单 worker 有效；多 worker 需换 Redis）----
_LOGIN_FAILURES: dict[str, list[float]] = {}
_LOGIN_MAX_FAILURES = 5
_LOGIN_WINDOW_SECONDS = 300


def _login_blocked(username: str) -> bool:
    stamps = _LOGIN_FAILURES.get(username, [])
    now = time.monotonic()
    stamps = [t for t in stamps if now - t < _LOGIN_WINDOW_SECONDS]
    _LOGIN_FAILURES[username] = stamps
    return len(stamps) >= _LOGIN_MAX_FAILURES


def _record_login_failure(username: str) -> None:
    stamps = [t for t in _LOGIN_FAILURES.get(username, []) if time.monotonic() - t < _LOGIN_WINDOW_SECONDS]
    stamps.append(time.monotonic())
    _LOGIN_FAILURES[username] = stamps
    # 兜底清理：条目过多时丢弃已过期的
    if len(_LOGIN_FAILURES) > 10000:
        for k in [k for k, v in _LOGIN_FAILURES.items() if not v]:
            _LOGIN_FAILURES.pop(k, None)


@router.post("/register")
async def register(payload: AuthPayload, response: Response, db: AsyncSession = Depends(get_session)):
    _validate(payload.username, payload.password)
    exists = (await db.execute(select(User).where(User.username == payload.username))).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=400, detail="用户名已被注册")
    user = User(username=payload.username, password_hash=hash_password(payload.password))
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        # 并发注册同名用户时由数据库 unique 约束兜底
        await db.rollback()
        raise HTTPException(status_code=409, detail="用户名已被注册，请更换用户名")
    await db.refresh(user)
    set_auth_cookie(response, create_token(user))
    return {"user": {"id": user.id, "username": user.username}}


@router.post("/login")
async def login(payload: AuthPayload, response: Response, db: AsyncSession = Depends(get_session)):
    if _login_blocked(payload.username):
        raise HTTPException(status_code=429, detail="尝试过于频繁，请 5 分钟后再试")
    user = (await db.execute(select(User).where(User.username == payload.username))).scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        _record_login_failure(payload.username)
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    _LOGIN_FAILURES.pop(payload.username, None)
    set_auth_cookie(response, create_token(user))
    return {"user": {"id": user.id, "username": user.username}}


@router.post("/logout")
async def logout(response: Response):
    clear_auth_cookie(response)
    return {"ok": True}


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return {"user": {"id": user.id, "username": user.username}}
