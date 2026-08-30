"""今日计划：待办 CRUD。"""
from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.life import _crud
from app.db.database import get_session
from app.models import life
from app.models.life_schemas import TodoIn

router = APIRouter()


@router.get("/todos", response_model=list[TodoIn])
async def list_todos(
    status: Optional[str] = None,
    due_date: Optional[date] = None,
    module: Optional[str] = None,
    db: AsyncSession = Depends(get_session),
):
    return await _crud.list_rows(
        db, life.LifeTodo,
        order_by=(desc(life.LifeTodo.due_date), life.LifeTodo.sort_order),
        status=status, due_date=due_date, module=module,
    )


@router.post("/todos", response_model=TodoIn)
async def create_todo(payload: TodoIn, db: AsyncSession = Depends(get_session)):
    return await _crud.create_row(db, life.LifeTodo, payload.model_dump(exclude_unset=True))


@router.patch("/todos/{obj_id}", response_model=TodoIn)
async def update_todo(obj_id: int, payload: TodoIn, db: AsyncSession = Depends(get_session)):
    return await _crud.update_row(db, life.LifeTodo, obj_id, payload.model_dump(exclude_unset=True))


@router.delete("/todos/{obj_id}")
async def delete_todo(obj_id: int, db: AsyncSession = Depends(get_session)):
    await _crud.delete_row(db, life.LifeTodo, obj_id)
    return {"deleted": obj_id}
