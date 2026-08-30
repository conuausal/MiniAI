"""数据与设置：模块开关 + 统计 + 备份（按用户隔离）。"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy import delete, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.life import _crud
from app.core.auth import get_current_user
from app.db.database import get_session
from app.models import life
from app.models.life_schemas import (
    BodyMetricIn, ConsultClientIn, ConsultIncomeIn, ConsultRecordIn,
    DevBugIn, DevNoteIn, DevProjectIn, DevTaskIn, FitnessCheckinIn,
    FitnessPlanIn, GameIn, GameRecordIn, MealIn, MediaPostIn, MediaStatIn,
    NoteIn, NutritionGoalIn, RecipeIn, SettingIn, TodoIn,
)
from app.models.user import User

router = APIRouter()

_MODEL_PAIRS: List[tuple] = [
    (life.LifeTodo, TodoIn), (life.LifeNote, NoteIn),
    (life.LifeMediaPost, MediaPostIn), (life.LifeMediaStat, MediaStatIn),
    (life.LifeDevProject, DevProjectIn), (life.LifeDevTask, DevTaskIn),
    (life.LifeDevBug, DevBugIn), (life.LifeDevNote, DevNoteIn),
    (life.LifeConsultClient, ConsultClientIn), (life.LifeConsultRecord, ConsultRecordIn),
    (life.LifeConsultIncome, ConsultIncomeIn),
    (life.LifeFitnessPlan, FitnessPlanIn), (life.LifeFitnessCheckin, FitnessCheckinIn),
    (life.LifeBodyMetric, BodyMetricIn),
    (life.LifeMeal, MealIn), (life.LifeRecipe, RecipeIn), (life.LifeNutritionGoal, NutritionGoalIn),
    (life.LifeGame, GameIn), (life.LifeGameRecord, GameRecordIn),
    (life.LifeSetting, SettingIn),
]


async def _count(db: AsyncSession, model, user_id: int, **filters) -> int:
    stmt = select(func.count()).select_from(model).where(model.user_id == user_id)
    for k, v in filters.items():
        if v is not None:
            stmt = stmt.where(getattr(model, k) == v)
    return (await db.execute(stmt)).scalar_one()


# ---------- 模块开关 ----------

@router.get("/settings")
async def get_settings(db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    rows = await _crud.list_rows(db, life.LifeSetting, user_id=user.id)
    return {r.key: r.value for r in rows}


@router.put("/settings/{key}")
async def put_setting(key: str, payload: SettingIn, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    stmt = select(life.LifeSetting).where(life.LifeSetting.key == key, life.LifeSetting.user_id == user.id)
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is None:
        db.add(life.LifeSetting(key=key, user_id=user.id, value=payload.value))
    else:
        row.value = payload.value
    await db.commit()
    return {"key": key, "value": payload.value}


# ---------- 统计 ----------

@router.get("/stats")
async def life_stats(db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    todo_total = await _count(db, life.LifeTodo, user.id)
    todo_done = await _count(db, life.LifeTodo, user.id, status="done")

    checkins = await _crud.list_rows(db, life.LifeFitnessCheckin, user_id=user.id)
    cdates = {r.checkin_date for r in checkins}
    today = date.today()
    d = today if today in cdates else today - timedelta(days=1)
    streak = 0
    while d in cdates:
        streak += 1
        d -= timedelta(days=1)

    income_total = float((await db.execute(
        select(func.coalesce(func.sum(life.LifeConsultIncome.amount), 0))
        .where(life.LifeConsultIncome.user_id == user.id)
    )).scalar_one())

    media_stats = await _crud.list_rows(db, life.LifeMediaStat, user_id=user.id, order_by=desc(life.LifeMediaStat.stat_date))
    game_records = await _crud.list_rows(db, life.LifeGameRecord, user_id=user.id)
    game_total = round(sum(float(r.hours) for r in game_records), 1)

    return {
        "todo_total": todo_total,
        "todo_done": todo_done,
        "todo_rate": round(todo_done / todo_total, 2) if todo_total else 0,
        "fitness_streak": streak,
        "consult_income_total": income_total,
        "media_last_views": [
            {"platform": s.platform, "date": s.stat_date.isoformat(), "views": s.views} for s in media_stats[:30]
        ],
        "game_total_hours": game_total,
    }


# ---------- 备份导出 / 导入 ----------

@router.get("/backup/export")
async def export_backup(db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    data: Dict[str, Any] = {}
    for model, schema in _MODEL_PAIRS:
        rows = await _crud.list_rows(db, model, user_id=user.id)
        data[model.__tablename__] = [schema.model_validate(r).model_dump(mode="json") for r in rows]
    return {
        "app": "miniai-life",
        "version": 1,
        "exported_at": datetime.utcnow().isoformat(),
        "data": data,
    }


@router.post("/backup/import")
async def import_backup(payload: dict, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    # 只清空当前用户的数据（子 → 父顺序）
    for model, _ in reversed(_MODEL_PAIRS):
        await db.execute(delete(model).where(model.user_id == user.id))
    await db.commit()
    # 插入（强制归属当前用户，保留原 id 维持内部外键）
    inserted: Dict[str, int] = {}
    for model, _ in _MODEL_PAIRS:
        tab = model.__tablename__
        cols = {c.name for c in model.__table__.columns}
        rows = data.get(tab) or []
        for row in rows:
            clean = {k: v for k, v in row.items() if k in cols and k != "user_id"}
            db.add(model(user_id=user.id, **clean))
        inserted[tab] = len(rows)
    await db.commit()
    return {"imported": inserted}
