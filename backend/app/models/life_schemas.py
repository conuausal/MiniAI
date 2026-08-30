"""个人工作生活管理 —— Pydantic 请求/响应 schema。

统一约定：字段全部 Optional，可作新增/更新（仅提交有值的字段）；
`from_attributes=True` 允许直接序列化 ORM 对象为响应。
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class _ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ============ 今日计划 / 快速备忘 ============

class TodoIn(_ORM):
    title: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[date] = None
    due_time: Optional[str] = None
    status: Optional[str] = None
    module: Optional[str] = None
    sort_order: Optional[int] = None
    note: Optional[str] = None


class NoteIn(_ORM):
    content: Optional[str] = None
    pinned: Optional[bool] = None


# ============ 自媒体 ============

class MediaPostIn(_ORM):
    title: Optional[str] = None
    platform: Optional[str] = None
    kind: Optional[str] = None
    content: Optional[str] = None
    publish_date: Optional[date] = None
    url: Optional[str] = None
    status: Optional[str] = None


class MediaStatIn(_ORM):
    platform: Optional[str] = None
    stat_date: Optional[date] = None
    followers: Optional[int] = None
    views: Optional[int] = None
    likes: Optional[int] = None
    comments: Optional[int] = None


# ============ 开发工作 ============

class DevProjectIn(_ORM):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    repo_url: Optional[str] = None


class DevTaskIn(_ORM):
    project_id: Optional[int] = None
    title: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[date] = None


class DevBugIn(_ORM):
    project_id: Optional[int] = None
    title: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class DevNoteIn(_ORM):
    project_id: Optional[int] = None
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[str] = None


# ============ 咨询工作 ============

class ConsultClientIn(_ORM):
    name: Optional[str] = None
    category: Optional[str] = None
    contact: Optional[str] = None
    notes: Optional[str] = None


class ConsultRecordIn(_ORM):
    client_id: Optional[int] = None
    title: Optional[str] = None
    content: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[date] = None


class ConsultIncomeIn(_ORM):
    client_id: Optional[int] = None
    record_id: Optional[int] = None
    amount: Optional[float] = None
    income_date: Optional[date] = None
    note: Optional[str] = None


# ============ 健身计划 ============

class FitnessPlanIn(_ORM):
    name: Optional[str] = None
    parts: Optional[str] = None
    exercises: Optional[List[Dict[str, Any]]] = None
    note: Optional[str] = None


class FitnessCheckinIn(_ORM):
    checkin_date: Optional[date] = None
    plan_id: Optional[int] = None
    exercises: Optional[List[Dict[str, Any]]] = None
    completed: Optional[bool] = None
    note: Optional[str] = None


class BodyMetricIn(_ORM):
    metric_date: Optional[date] = None
    weight: Optional[float] = None
    body_fat: Optional[float] = None


# ============ 饮食计划 ============

class MealIn(_ORM):
    meal_date: Optional[date] = None
    meal_type: Optional[str] = None
    content: Optional[str] = None
    calories: Optional[float] = None
    protein: Optional[float] = None
    carbs: Optional[float] = None
    fat: Optional[float] = None


class RecipeIn(_ORM):
    name: Optional[str] = None
    category: Optional[str] = None
    ingredients: Optional[str] = None
    calories: Optional[float] = None
    protein: Optional[float] = None
    carbs: Optional[float] = None
    fat: Optional[float] = None
    notes: Optional[str] = None


class NutritionGoalIn(_ORM):
    goal_date: Optional[date] = None
    calories: Optional[float] = None
    protein: Optional[float] = None
    carbs: Optional[float] = None
    fat: Optional[float] = None


# ============ 游戏娱乐 ============

class GameIn(_ORM):
    name: Optional[str] = None
    platform: Optional[str] = None
    status: Optional[str] = None
    rating: Optional[int] = None
    total_hours: Optional[float] = None
    note: Optional[str] = None


class GameRecordIn(_ORM):
    game_id: Optional[int] = None
    record_date: Optional[date] = None
    hours: Optional[float] = None
    note: Optional[str] = None


# ============ 设置 ============

class SettingIn(_ORM):
    key: str
    value: Optional[Dict[str, Any]] = None


# ============ 首页总览 / 统计 ============

class ModuleSummary(BaseModel):
    media_publish_today: int = 0
    dev_active_projects: int = 0
    dev_tasks_today: int = 0
    consult_in_progress: int = 0
    fitness_checked_today: bool = False
    diet_recorded_today: bool = False
    game_hours_today: float = 0


class HomeOverview(BaseModel):
    date: str
    todos: List[TodoIn] = []
    notes: List[NoteIn] = []
    modules: ModuleSummary


class StatsResponse(BaseModel):
    todo_total: int = 0
    todo_done: int = 0
    todo_rate: float = 0
    fitness_streak: int = 0
    consult_income_total: float = 0
    media_last_views: List[Any] = []
    game_total_hours: float = 0
