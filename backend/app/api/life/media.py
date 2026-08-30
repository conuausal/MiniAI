"""自媒体：内容（选题/草稿/发布）+ 平台数据（按用户隔离）。"""
from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.life import _crud
from app.core.auth import get_current_user
from app.db.database import get_session
from app.models import life
from app.models.life_schemas import MediaPostIn, MediaStatIn
from app.models.user import User

router = APIRouter()


# ---------- 内容 ----------

@router.get("/media/posts", response_model=list[MediaPostIn])
async def list_posts(kind: Optional[str] = None, status: Optional[str] = None,
                     db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await _crud.list_rows(db, life.LifeMediaPost, user_id=user.id,
                                 order_by=desc(life.LifeMediaPost.created_at), kind=kind, status=status)


@router.post("/media/posts", response_model=MediaPostIn)
async def create_post(payload: MediaPostIn, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await _crud.create_row(db, life.LifeMediaPost, payload.model_dump(exclude_unset=True), user.id)


@router.patch("/media/posts/{obj_id}", response_model=MediaPostIn)
async def update_post(obj_id: int, payload: MediaPostIn, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await _crud.update_row(db, life.LifeMediaPost, obj_id, payload.model_dump(exclude_unset=True), user.id)


@router.delete("/media/posts/{obj_id}")
async def delete_post(obj_id: int, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    await _crud.delete_row(db, life.LifeMediaPost, obj_id, user.id)
    return {"deleted": obj_id}


# ---------- 平台数据 ----------

@router.get("/media/stats", response_model=list[MediaStatIn])
async def list_stats(platform: Optional[str] = None, start_date: Optional[date] = None, end_date: Optional[date] = None,
                     db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    stmt = select(life.LifeMediaStat).where(life.LifeMediaStat.user_id == user.id).order_by(life.LifeMediaStat.stat_date.desc())
    if platform:
        stmt = stmt.where(life.LifeMediaStat.platform == platform)
    if start_date:
        stmt = stmt.where(life.LifeMediaStat.stat_date >= start_date)
    if end_date:
        stmt = stmt.where(life.LifeMediaStat.stat_date <= end_date)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("/media/stats", response_model=MediaStatIn)
async def create_stat(payload: MediaStatIn, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await _crud.create_row(db, life.LifeMediaStat, payload.model_dump(exclude_unset=True), user.id)


@router.patch("/media/stats/{obj_id}", response_model=MediaStatIn)
async def update_stat(obj_id: int, payload: MediaStatIn, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await _crud.update_row(db, life.LifeMediaStat, obj_id, payload.model_dump(exclude_unset=True), user.id)


@router.delete("/media/stats/{obj_id}")
async def delete_stat(obj_id: int, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    await _crud.delete_row(db, life.LifeMediaStat, obj_id, user.id)
    return {"deleted": obj_id}
