"""饮食计划：三餐 + 食谱库 + 营养目标（按用户隔离）。"""
from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.life import _crud
from app.core.auth import get_current_user
from app.db.database import get_session
from app.models import life
from app.models.life_schemas import MealIn, NutritionGoalIn, RecipeIn
from app.models.user import User

router = APIRouter()


# ---------- 三餐记录 ----------

@router.get("/diet/meals", response_model=list[MealIn])
async def list_meals(meal_date: Optional[date] = None, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await _crud.list_rows(db, life.LifeMeal, user_id=user.id, order_by=desc(life.LifeMeal.meal_date), meal_date=meal_date)


@router.post("/diet/meals", response_model=MealIn)
async def create_meal(payload: MealIn, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await _crud.create_row(db, life.LifeMeal, payload.model_dump(exclude_unset=True), user.id)


@router.patch("/diet/meals/{obj_id}", response_model=MealIn)
async def update_meal(obj_id: int, payload: MealIn, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await _crud.update_row(db, life.LifeMeal, obj_id, payload.model_dump(exclude_unset=True), user.id)


@router.delete("/diet/meals/{obj_id}")
async def delete_meal(obj_id: int, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    await _crud.delete_row(db, life.LifeMeal, obj_id, user.id)
    return {"deleted": obj_id}


@router.get("/diet/summary")
async def diet_summary(meal_date: date, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    meals = await _crud.list_rows(db, life.LifeMeal, user_id=user.id, meal_date=meal_date)
    totals = {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0}
    for m in meals:
        totals["calories"] += float(m.calories or 0)
        totals["protein"] += float(m.protein or 0)
        totals["carbs"] += float(m.carbs or 0)
        totals["fat"] += float(m.fat or 0)
    goal = None
    rows = await _crud.list_rows(db, life.LifeNutritionGoal, user_id=user.id, goal_date=meal_date)
    if rows:
        g = rows[0]
        goal = {"calories": float(g.calories), "protein": float(g.protein), "carbs": float(g.carbs), "fat": float(g.fat)}
    return {"date": meal_date.isoformat(), "meals": meals, "totals": totals, "goal": goal}


# ---------- 食谱库 ----------

@router.get("/diet/recipes", response_model=list[RecipeIn])
async def list_recipes(db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await _crud.list_rows(db, life.LifeRecipe, user_id=user.id, order_by=desc(life.LifeRecipe.created_at))


@router.post("/diet/recipes", response_model=RecipeIn)
async def create_recipe(payload: RecipeIn, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await _crud.create_row(db, life.LifeRecipe, payload.model_dump(exclude_unset=True), user.id)


@router.patch("/diet/recipes/{obj_id}", response_model=RecipeIn)
async def update_recipe(obj_id: int, payload: RecipeIn, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await _crud.update_row(db, life.LifeRecipe, obj_id, payload.model_dump(exclude_unset=True), user.id)


@router.delete("/diet/recipes/{obj_id}")
async def delete_recipe(obj_id: int, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    await _crud.delete_row(db, life.LifeRecipe, obj_id, user.id)
    return {"deleted": obj_id}


# ---------- 营养目标 ----------

@router.get("/diet/goals", response_model=list[NutritionGoalIn])
async def list_goals(goal_date: Optional[date] = None, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await _crud.list_rows(db, life.LifeNutritionGoal, user_id=user.id, goal_date=goal_date)


@router.post("/diet/goals", response_model=NutritionGoalIn)
async def create_goal(payload: NutritionGoalIn, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await _crud.create_row(db, life.LifeNutritionGoal, payload.model_dump(exclude_unset=True), user.id)


@router.patch("/diet/goals/{obj_id}", response_model=NutritionGoalIn)
async def update_goal(obj_id: int, payload: NutritionGoalIn, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    return await _crud.update_row(db, life.LifeNutritionGoal, obj_id, payload.model_dump(exclude_unset=True), user.id)


@router.delete("/diet/goals/{obj_id}")
async def delete_goal(obj_id: int, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    await _crud.delete_row(db, life.LifeNutritionGoal, obj_id, user.id)
    return {"deleted": obj_id}
