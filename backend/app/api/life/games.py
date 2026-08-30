"""游戏娱乐：游戏库 + 游玩记录。"""
from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.life import _crud
from app.db.database import get_session
from app.models import life
from app.models.life_schemas import GameIn, GameRecordIn

router = APIRouter()


# ---------- 游戏库 ----------

@router.get("/games", response_model=list[GameIn])
async def list_games(status: Optional[str] = None, db: AsyncSession = Depends(get_session)):
    return await _crud.list_rows(db, life.LifeGame, order_by=desc(life.LifeGame.created_at), status=status)


@router.post("/games", response_model=GameIn)
async def create_game(payload: GameIn, db: AsyncSession = Depends(get_session)):
    return await _crud.create_row(db, life.LifeGame, payload.model_dump(exclude_unset=True))


@router.patch("/games/{obj_id}", response_model=GameIn)
async def update_game(obj_id: int, payload: GameIn, db: AsyncSession = Depends(get_session)):
    return await _crud.update_row(db, life.LifeGame, obj_id, payload.model_dump(exclude_unset=True))


@router.delete("/games/{obj_id}")
async def delete_game(obj_id: int, db: AsyncSession = Depends(get_session)):
    await _crud.delete_row(db, life.LifeGame, obj_id)
    return {"deleted": obj_id}


# ---------- 游玩记录 ----------

@router.get("/games/records", response_model=list[GameRecordIn])
async def list_records(game_id: Optional[int] = None, record_date: Optional[date] = None, db: AsyncSession = Depends(get_session)):
    return await _crud.list_rows(db, life.LifeGameRecord, order_by=desc(life.LifeGameRecord.record_date), game_id=game_id, record_date=record_date)


@router.post("/games/records", response_model=GameRecordIn)
async def create_record(payload: GameRecordIn, db: AsyncSession = Depends(get_session)):
    return await _crud.create_row(db, life.LifeGameRecord, payload.model_dump(exclude_unset=True))


@router.patch("/games/records/{obj_id}", response_model=GameRecordIn)
async def update_record(obj_id: int, payload: GameRecordIn, db: AsyncSession = Depends(get_session)):
    return await _crud.update_row(db, life.LifeGameRecord, obj_id, payload.model_dump(exclude_unset=True))


@router.delete("/games/records/{obj_id}")
async def delete_record(obj_id: int, db: AsyncSession = Depends(get_session)):
    await _crud.delete_row(db, life.LifeGameRecord, obj_id)
    return {"deleted": obj_id}
