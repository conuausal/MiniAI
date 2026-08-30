"""个人工作生活管理 —— 通用 CRUD 辅助（按 user_id 隔离）。"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Type, TypeVar

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")

_PROTECTED = {"id", "user_id", "created_at", "updated_at"}


async def list_rows(db: AsyncSession, model: Type[T], *, user_id: int, order_by=None, **filters) -> List[T]:
    stmt = select(model).where(model.user_id == user_id)
    for k, v in filters.items():
        if v is not None:
            stmt = stmt.where(getattr(model, k) == v)
    if order_by is not None:
        if isinstance(order_by, tuple):
            stmt = stmt.order_by(*order_by)
        else:
            stmt = stmt.order_by(order_by)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_row(db: AsyncSession, model: Type[T], obj_id: int, user_id: int, name: str = "对象") -> T:
    """按 id + user_id 双重校验，防止越权访问。"""
    stmt = select(model).where(model.id == obj_id, model.user_id == user_id)
    obj = (await db.execute(stmt)).scalar_one_or_none()
    if obj is None:
        raise HTTPException(status_code=404, detail=f"{name}不存在")
    return obj


async def create_row(db: AsyncSession, model: Type[T], data: Dict[str, Any], user_id: int) -> T:
    # 不允许客户端指定主键 / 用户 / 时间戳
    clean = {k: v for k, v in data.items() if k not in _PROTECTED}
    obj = model(user_id=user_id, **clean)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def update_row(db: AsyncSession, model: Type[T], obj_id: int, data: Dict[str, Any], user_id: int, name: str = "对象") -> T:
    obj = await get_row(db, model, obj_id, user_id, name)
    for k, v in data.items():
        if k not in _PROTECTED and hasattr(obj, k):
            setattr(obj, k, v)
    await db.commit()
    await db.refresh(obj)
    return obj


async def delete_row(db: AsyncSession, model: Type[T], obj_id: int, user_id: int, name: str = "对象") -> T:
    obj = await get_row(db, model, obj_id, user_id, name)
    await db.delete(obj)
    await db.commit()
    return obj
