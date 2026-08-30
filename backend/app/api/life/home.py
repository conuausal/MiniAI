"""首页总览：今日待办 + 置顶便签 + 各模块摘要。"""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.life import _crud
from app.db.database import get_session
from app.models import life
from app.models.life_schemas import HomeOverview, ModuleSummary

router = APIRouter()


async def _count(db: AsyncSession, model, **filters) -> int:
    stmt = select(func.count()).select_from(model)
    for k, v in filters.items():
        if v is not None:
            stmt = stmt.where(getattr(model, k) == v)
    return (await db.execute(stmt)).scalar_one()


async def _sum(db: AsyncSession, model, column, **filters) -> float:
    stmt = select(func.coalesce(func.sum(column), 0)).select_from(model)
    for k, v in filters.items():
        stmt = stmt.where(getattr(model, k) == v)
    return float((await db.execute(stmt)).scalar_one())


async def _exists(db: AsyncSession, model, **filters) -> bool:
    stmt = select(func.count()).select_from(model).limit(1)
    for k, v in filters.items():
        stmt = stmt.where(getattr(model, k) == v)
    return (await db.execute(stmt)).scalar_one() > 0


@router.get("/home", response_model=HomeOverview)
async def home_overview(db: AsyncSession = Depends(get_session)):
    today = date.today()

    # 今日待办：今天到期 + 未完成无日期（最多 20 条）
    todos = await _crud.list_rows(
        db, life.LifeTodo,
        order_by=(desc(life.LifeTodo.due_date), life.LifeTodo.sort_order),
        due_date=today,
    )
    open_todos = await _crud.list_rows(db, life.LifeTodo, status="todo")
    if len(todos) < 20:
        for t in open_todos:
            if t.due_date is None and len(todos) < 20:
                todos.append(t)

    notes = await _crud.list_rows(
        db, life.LifeNote,
        order_by=(desc(life.LifeNote.pinned), desc(life.LifeNote.created_at)),
    )

    modules = ModuleSummary(
        media_publish_today=await _count(db, life.LifeMediaPost, publish_date=today),
        dev_active_projects=await _count(db, life.LifeDevProject, status="active"),
        dev_tasks_today=await _count(db, life.LifeDevTask, due_date=today),
        consult_in_progress=await _count(db, life.LifeConsultRecord, status="in_progress"),
        fitness_checked_today=await _exists(db, life.LifeFitnessCheckin, checkin_date=today),
        diet_recorded_today=await _exists(db, life.LifeMeal, meal_date=today),
        game_hours_today=await _sum(db, life.LifeGameRecord, life.LifeGameRecord.hours, record_date=today),
    )

    return HomeOverview(date=today.isoformat(), todos=todos, notes=notes, modules=modules)
