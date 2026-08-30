"""健身计划：训练模板 + 每日打卡 + 身体数据。"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.life import _crud
from app.db.database import get_session
from app.models import life
from app.models.life_schemas import BodyMetricIn, FitnessCheckinIn, FitnessPlanIn

router = APIRouter()


# ---------- 训练模板 ----------

@router.get("/fitness/plans", response_model=list[FitnessPlanIn])
async def list_plans(db: AsyncSession = Depends(get_session)):
    return await _crud.list_rows(db, life.LifeFitnessPlan, order_by=desc(life.LifeFitnessPlan.created_at))


@router.post("/fitness/plans", response_model=FitnessPlanIn)
async def create_plan(payload: FitnessPlanIn, db: AsyncSession = Depends(get_session)):
    return await _crud.create_row(db, life.LifeFitnessPlan, payload.model_dump(exclude_unset=True))


@router.patch("/fitness/plans/{obj_id}", response_model=FitnessPlanIn)
async def update_plan(obj_id: int, payload: FitnessPlanIn, db: AsyncSession = Depends(get_session)):
    return await _crud.update_row(db, life.LifeFitnessPlan, obj_id, payload.model_dump(exclude_unset=True))


@router.delete("/fitness/plans/{obj_id}")
async def delete_plan(obj_id: int, db: AsyncSession = Depends(get_session)):
    await _crud.delete_row(db, life.LifeFitnessPlan, obj_id)
    return {"deleted": obj_id}


# ---------- 每日打卡 ----------

@router.get("/fitness/checkins", response_model=list[FitnessCheckinIn])
async def list_checkins(checkin_date: Optional[date] = None, db: AsyncSession = Depends(get_session)):
    return await _crud.list_rows(db, life.LifeFitnessCheckin, order_by=desc(life.LifeFitnessCheckin.checkin_date), checkin_date=checkin_date)


@router.post("/fitness/checkins", response_model=FitnessCheckinIn)
async def create_checkin(payload: FitnessCheckinIn, db: AsyncSession = Depends(get_session)):
    return await _crud.create_row(db, life.LifeFitnessCheckin, payload.model_dump(exclude_unset=True))


@router.patch("/fitness/checkins/{obj_id}", response_model=FitnessCheckinIn)
async def update_checkin(obj_id: int, payload: FitnessCheckinIn, db: AsyncSession = Depends(get_session)):
    return await _crud.update_row(db, life.LifeFitnessCheckin, obj_id, payload.model_dump(exclude_unset=True))


@router.delete("/fitness/checkins/{obj_id}")
async def delete_checkin(obj_id: int, db: AsyncSession = Depends(get_session)):
    await _crud.delete_row(db, life.LifeFitnessCheckin, obj_id)
    return {"deleted": obj_id}


@router.get("/fitness/streak")
async def fitness_streak(db: AsyncSession = Depends(get_session)):
    """连续打卡天数（截至今天或昨天）。"""
    rows = await _crud.list_rows(db, life.LifeFitnessCheckin)
    dates = {r.checkin_date for r in rows}
    today = date.today()
    d = today if today in dates else today - timedelta(days=1)
    count = 0
    while d in dates:
        count += 1
        d -= timedelta(days=1)
    return {"streak": count}


# ---------- 身体数据 ----------

@router.get("/fitness/metrics", response_model=list[BodyMetricIn])
async def list_metrics(db: AsyncSession = Depends(get_session)):
    return await _crud.list_rows(db, life.LifeBodyMetric, order_by=desc(life.LifeBodyMetric.metric_date))


@router.post("/fitness/metrics", response_model=BodyMetricIn)
async def create_metric(payload: BodyMetricIn, db: AsyncSession = Depends(get_session)):
    return await _crud.create_row(db, life.LifeBodyMetric, payload.model_dump(exclude_unset=True))


@router.patch("/fitness/metrics/{obj_id}", response_model=BodyMetricIn)
async def update_metric(obj_id: int, payload: BodyMetricIn, db: AsyncSession = Depends(get_session)):
    return await _crud.update_row(db, life.LifeBodyMetric, obj_id, payload.model_dump(exclude_unset=True))


@router.delete("/fitness/metrics/{obj_id}")
async def delete_metric(obj_id: int, db: AsyncSession = Depends(get_session)):
    await _crud.delete_row(db, life.LifeBodyMetric, obj_id)
    return {"deleted": obj_id}
