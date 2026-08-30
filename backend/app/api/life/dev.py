"""开发工作：项目 + 任务 + Bug + 技术笔记。"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.life import _crud
from app.db.database import get_session
from app.models import life
from app.models.life_schemas import DevBugIn, DevNoteIn, DevProjectIn, DevTaskIn

router = APIRouter()


# ---------- 项目 ----------

@router.get("/dev/projects", response_model=list[DevProjectIn])
async def list_projects(status: Optional[str] = None, db: AsyncSession = Depends(get_session)):
    return await _crud.list_rows(db, life.LifeDevProject, order_by=desc(life.LifeDevProject.created_at), status=status)


@router.post("/dev/projects", response_model=DevProjectIn)
async def create_project(payload: DevProjectIn, db: AsyncSession = Depends(get_session)):
    return await _crud.create_row(db, life.LifeDevProject, payload.model_dump(exclude_unset=True))


@router.patch("/dev/projects/{obj_id}", response_model=DevProjectIn)
async def update_project(obj_id: int, payload: DevProjectIn, db: AsyncSession = Depends(get_session)):
    return await _crud.update_row(db, life.LifeDevProject, obj_id, payload.model_dump(exclude_unset=True))


@router.delete("/dev/projects/{obj_id}")
async def delete_project(obj_id: int, db: AsyncSession = Depends(get_session)):
    await _crud.delete_row(db, life.LifeDevProject, obj_id)
    return {"deleted": obj_id}


# ---------- 任务 ----------

@router.get("/dev/tasks", response_model=list[DevTaskIn])
async def list_tasks(project_id: Optional[int] = None, status: Optional[str] = None, db: AsyncSession = Depends(get_session)):
    return await _crud.list_rows(db, life.LifeDevTask, order_by=desc(life.LifeDevTask.created_at), project_id=project_id, status=status)


@router.post("/dev/tasks", response_model=DevTaskIn)
async def create_task(payload: DevTaskIn, db: AsyncSession = Depends(get_session)):
    return await _crud.create_row(db, life.LifeDevTask, payload.model_dump(exclude_unset=True))


@router.patch("/dev/tasks/{obj_id}", response_model=DevTaskIn)
async def update_task(obj_id: int, payload: DevTaskIn, db: AsyncSession = Depends(get_session)):
    return await _crud.update_row(db, life.LifeDevTask, obj_id, payload.model_dump(exclude_unset=True))


@router.delete("/dev/tasks/{obj_id}")
async def delete_task(obj_id: int, db: AsyncSession = Depends(get_session)):
    await _crud.delete_row(db, life.LifeDevTask, obj_id)
    return {"deleted": obj_id}


# ---------- Bug ----------

@router.get("/dev/bugs", response_model=list[DevBugIn])
async def list_bugs(project_id: Optional[int] = None, status: Optional[str] = None, db: AsyncSession = Depends(get_session)):
    return await _crud.list_rows(db, life.LifeDevBug, order_by=desc(life.LifeDevBug.created_at), project_id=project_id, status=status)


@router.post("/dev/bugs", response_model=DevBugIn)
async def create_bug(payload: DevBugIn, db: AsyncSession = Depends(get_session)):
    return await _crud.create_row(db, life.LifeDevBug, payload.model_dump(exclude_unset=True))


@router.patch("/dev/bugs/{obj_id}", response_model=DevBugIn)
async def update_bug(obj_id: int, payload: DevBugIn, db: AsyncSession = Depends(get_session)):
    return await _crud.update_row(db, life.LifeDevBug, obj_id, payload.model_dump(exclude_unset=True))


@router.delete("/dev/bugs/{obj_id}")
async def delete_bug(obj_id: int, db: AsyncSession = Depends(get_session)):
    await _crud.delete_row(db, life.LifeDevBug, obj_id)
    return {"deleted": obj_id}


# ---------- 技术笔记 ----------

@router.get("/dev/notes", response_model=list[DevNoteIn])
async def list_notes(project_id: Optional[int] = None, db: AsyncSession = Depends(get_session)):
    return await _crud.list_rows(db, life.LifeDevNote, order_by=desc(life.LifeDevNote.created_at), project_id=project_id)


@router.post("/dev/notes", response_model=DevNoteIn)
async def create_note(payload: DevNoteIn, db: AsyncSession = Depends(get_session)):
    return await _crud.create_row(db, life.LifeDevNote, payload.model_dump(exclude_unset=True))


@router.patch("/dev/notes/{obj_id}", response_model=DevNoteIn)
async def update_note(obj_id: int, payload: DevNoteIn, db: AsyncSession = Depends(get_session)):
    return await _crud.update_row(db, life.LifeDevNote, obj_id, payload.model_dump(exclude_unset=True))


@router.delete("/dev/notes/{obj_id}")
async def delete_note(obj_id: int, db: AsyncSession = Depends(get_session)):
    await _crud.delete_row(db, life.LifeDevNote, obj_id)
    return {"deleted": obj_id}
