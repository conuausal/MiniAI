"""咨询工作：客户 + 进度 + 收费（按用户隔离）。"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.life import _crud
from app.core.auth import get_current_user
from app.db.database import get_session
from app.models import life
from app.models.life_schemas import ConsultClientIn, ConsultIncomeIn, ConsultRecordIn
from app.models.user import User

router = APIRouter()


# ---------- 客户 ----------

@router.get("/consult/clients", response_model=list[ConsultClientIn])
async def list_clients(db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await _crud.list_rows(db, life.LifeConsultClient, user_id=user.id, order_by=desc(life.LifeConsultClient.created_at))


@router.post("/consult/clients", response_model=ConsultClientIn)
async def create_client(payload: ConsultClientIn, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await _crud.create_row(db, life.LifeConsultClient, payload.model_dump(exclude_unset=True), user.id)


@router.patch("/consult/clients/{obj_id}", response_model=ConsultClientIn)
async def update_client(obj_id: int, payload: ConsultClientIn, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await _crud.update_row(db, life.LifeConsultClient, obj_id, payload.model_dump(exclude_unset=True), user.id)


@router.delete("/consult/clients/{obj_id}")
async def delete_client(obj_id: int, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    await _crud.delete_row(db, life.LifeConsultClient, obj_id, user.id)
    return {"deleted": obj_id}


# ---------- 进度记录 ----------

@router.get("/consult/records", response_model=list[ConsultRecordIn])
async def list_records(client_id: Optional[int] = None, status: Optional[str] = None,
                       db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await _crud.list_rows(db, life.LifeConsultRecord, user_id=user.id, order_by=desc(life.LifeConsultRecord.created_at), client_id=client_id, status=status)


@router.post("/consult/records", response_model=ConsultRecordIn)
async def create_record(payload: ConsultRecordIn, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await _crud.create_row(db, life.LifeConsultRecord, payload.model_dump(exclude_unset=True), user.id)


@router.patch("/consult/records/{obj_id}", response_model=ConsultRecordIn)
async def update_record(obj_id: int, payload: ConsultRecordIn, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await _crud.update_row(db, life.LifeConsultRecord, obj_id, payload.model_dump(exclude_unset=True), user.id)


@router.delete("/consult/records/{obj_id}")
async def delete_record(obj_id: int, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    await _crud.delete_row(db, life.LifeConsultRecord, obj_id, user.id)
    return {"deleted": obj_id}


# ---------- 收费记录 + 统计 ----------

@router.get("/consult/income", response_model=list[ConsultIncomeIn])
async def list_income(client_id: Optional[int] = None, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await _crud.list_rows(db, life.LifeConsultIncome, user_id=user.id, order_by=desc(life.LifeConsultIncome.income_date), client_id=client_id)


@router.post("/consult/income", response_model=ConsultIncomeIn)
async def create_income(payload: ConsultIncomeIn, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await _crud.create_row(db, life.LifeConsultIncome, payload.model_dump(exclude_unset=True), user.id)


@router.patch("/consult/income/{obj_id}", response_model=ConsultIncomeIn)
async def update_income(obj_id: int, payload: ConsultIncomeIn, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await _crud.update_row(db, life.LifeConsultIncome, obj_id, payload.model_dump(exclude_unset=True), user.id)


@router.delete("/consult/income/{obj_id}")
async def delete_income(obj_id: int, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    await _crud.delete_row(db, life.LifeConsultIncome, obj_id, user.id)
    return {"deleted": obj_id}


@router.get("/consult/summary")
async def consult_summary(db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    total = float((await db.execute(
        select(func.coalesce(func.sum(life.LifeConsultIncome.amount), 0))
        .where(life.LifeConsultIncome.user_id == user.id)
    )).scalar_one())
    rows = await _crud.list_rows(db, life.LifeConsultIncome, user_id=user.id, order_by=desc(life.LifeConsultIncome.income_date))
    by_month: dict[str, float] = {}
    for r in rows:
        key = r.income_date.strftime("%Y-%m")
        by_month[key] = round(by_month.get(key, 0) + float(r.amount), 2)
    return {"total": total, "by_month": by_month}
