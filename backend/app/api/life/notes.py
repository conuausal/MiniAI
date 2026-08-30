"""快速备忘：轻量便签 CRUD。"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.life import _crud
from app.db.database import get_session
from app.models import life
from app.models.life_schemas import NoteIn

router = APIRouter()


@router.get("/notes", response_model=list[NoteIn])
async def list_notes(db: AsyncSession = Depends(get_session)):
    return await _crud.list_rows(db, life.LifeNote, order_by=(desc(life.LifeNote.pinned), desc(life.LifeNote.created_at)))


@router.post("/notes", response_model=NoteIn)
async def create_note(payload: NoteIn, db: AsyncSession = Depends(get_session)):
    return await _crud.create_row(db, life.LifeNote, payload.model_dump(exclude_unset=True))


@router.patch("/notes/{obj_id}", response_model=NoteIn)
async def update_note(obj_id: int, payload: NoteIn, db: AsyncSession = Depends(get_session)):
    return await _crud.update_row(db, life.LifeNote, obj_id, payload.model_dump(exclude_unset=True))


@router.delete("/notes/{obj_id}")
async def delete_note(obj_id: int, db: AsyncSession = Depends(get_session)):
    await _crud.delete_row(db, life.LifeNote, obj_id)
    return {"deleted": obj_id}
