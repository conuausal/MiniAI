"""个人工作生活管理 —— ORM 模型（约 20 张表，挂在 Base 上，create_all 自动建表）。"""
from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class TimestampsMixin:
    """公共主键、时间戳与用户归属。"""
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============ 今日计划 / 快速备忘 ============

class LifeTodo(TimestampsMixin, Base):
    __tablename__ = "life_todos"
    title: Mapped[str] = mapped_column(String(255))
    priority: Mapped[str] = mapped_column(String(8), default="mid")  # low/mid/high
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    due_time: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    status: Mapped[str] = mapped_column(String(12), default="todo")  # todo/done/canceled
    module: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)  # 可选关联模块
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)


class LifeNote(TimestampsMixin, Base):
    __tablename__ = "life_notes"
    content: Mapped[str] = mapped_column(Text)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)


# ============ 自媒体 ============

class LifeMediaPost(TimestampsMixin, Base):
    __tablename__ = "life_media_posts"
    title: Mapped[str] = mapped_column(String(255))
    platform: Mapped[str] = mapped_column(String(32), default="")
    kind: Mapped[str] = mapped_column(String(16), default="idea")  # idea/draft/published
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    publish_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="active")  # active/archived


class LifeMediaStat(TimestampsMixin, Base):
    __tablename__ = "life_media_stats"
    platform: Mapped[str] = mapped_column(String(32))
    stat_date: Mapped[date] = mapped_column(Date)
    followers: Mapped[int] = mapped_column(Integer, default=0)
    views: Mapped[int] = mapped_column(Integer, default=0)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    comments: Mapped[int] = mapped_column(Integer, default=0)


# ============ 开发工作 ============

class LifeDevProject(TimestampsMixin, Base):
    __tablename__ = "life_dev_projects"
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="active")  # active/paused/done
    repo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)


class LifeDevTask(TimestampsMixin, Base):
    __tablename__ = "life_dev_tasks"
    project_id: Mapped[int] = mapped_column(ForeignKey("life_dev_projects.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(12), default="todo")  # todo/doing/done
    priority: Mapped[str] = mapped_column(String(8), default="mid")
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)


class LifeDevBug(TimestampsMixin, Base):
    __tablename__ = "life_dev_bugs"
    project_id: Mapped[int] = mapped_column(ForeignKey("life_dev_projects.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255))
    severity: Mapped[str] = mapped_column(String(8), default="low")  # low/mid/high
    status: Mapped[str] = mapped_column(String(12), default="open")  # open/fixing/fixed/closed
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class LifeDevNote(TimestampsMixin, Base):
    __tablename__ = "life_dev_notes"
    project_id: Mapped[Optional[int]] = mapped_column(ForeignKey("life_dev_projects.id", ondelete="CASCADE"), nullable=True)
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)


# ============ 咨询工作 ============

class LifeConsultClient(TimestampsMixin, Base):
    __tablename__ = "life_consult_clients"
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # 咨询类型
    contact: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class LifeConsultRecord(TimestampsMixin, Base):
    __tablename__ = "life_consult_records"
    client_id: Mapped[int] = mapped_column(ForeignKey("life_consult_clients.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="in_progress")  # in_progress/delivered/closed
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)


class LifeConsultIncome(TimestampsMixin, Base):
    __tablename__ = "life_consult_income"
    client_id: Mapped[Optional[int]] = mapped_column(ForeignKey("life_consult_clients.id", ondelete="SET NULL"), nullable=True)
    record_id: Mapped[Optional[int]] = mapped_column(ForeignKey("life_consult_records.id", ondelete="SET NULL"), nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    income_date: Mapped[date] = mapped_column(Date)
    note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)


# ============ 健身计划 ============

class LifeFitnessPlan(TimestampsMixin, Base):
    __tablename__ = "life_fitness_plans"
    name: Mapped[str] = mapped_column(String(255))
    parts: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # 训练部位
    exercises: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # [{name, sets, reps, weight}]
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class LifeFitnessCheckin(TimestampsMixin, Base):
    __tablename__ = "life_fitness_checkins"
    checkin_date: Mapped[date] = mapped_column(Date)
    plan_id: Mapped[Optional[int]] = mapped_column(ForeignKey("life_fitness_plans.id", ondelete="SET NULL"), nullable=True)
    exercises: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    completed: Mapped[bool] = mapped_column(Boolean, default=True)
    note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)


class LifeBodyMetric(TimestampsMixin, Base):
    __tablename__ = "life_body_metrics"
    metric_date: Mapped[date] = mapped_column(Date)
    weight: Mapped[Optional[float]] = mapped_column(Numeric(5, 1), nullable=True)
    body_fat: Mapped[Optional[float]] = mapped_column(Numeric(4, 1), nullable=True)


# ============ 饮食计划 ============

class LifeMeal(TimestampsMixin, Base):
    __tablename__ = "life_meals"
    meal_date: Mapped[date] = mapped_column(Date)
    meal_type: Mapped[str] = mapped_column(String(12), default="lunch")  # breakfast/lunch/dinner/snack
    content: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    calories: Mapped[float] = mapped_column(Numeric(8, 1), default=0)
    protein: Mapped[float] = mapped_column(Numeric(6, 1), default=0)
    carbs: Mapped[float] = mapped_column(Numeric(6, 1), default=0)
    fat: Mapped[float] = mapped_column(Numeric(6, 1), default=0)


class LifeRecipe(TimestampsMixin, Base):
    __tablename__ = "life_recipes"
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    ingredients: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    calories: Mapped[float] = mapped_column(Numeric(8, 1), default=0)
    protein: Mapped[float] = mapped_column(Numeric(6, 1), default=0)
    carbs: Mapped[float] = mapped_column(Numeric(6, 1), default=0)
    fat: Mapped[float] = mapped_column(Numeric(6, 1), default=0)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class LifeNutritionGoal(TimestampsMixin, Base):
    __tablename__ = "life_nutrition_goals"
    goal_date: Mapped[date] = mapped_column(Date)
    calories: Mapped[float] = mapped_column(Numeric(8, 1), default=0)
    protein: Mapped[float] = mapped_column(Numeric(6, 1), default=0)
    carbs: Mapped[float] = mapped_column(Numeric(6, 1), default=0)
    fat: Mapped[float] = mapped_column(Numeric(6, 1), default=0)


# ============ 游戏娱乐 ============

class LifeGame(TimestampsMixin, Base):
    __tablename__ = "life_games"
    name: Mapped[str] = mapped_column(String(255))
    platform: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="wishlist")  # wishlist/playing/finished
    rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    total_hours: Mapped[float] = mapped_column(Numeric(6, 1), default=0)
    note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)


class LifeGameRecord(TimestampsMixin, Base):
    __tablename__ = "life_game_records"
    game_id: Mapped[int] = mapped_column(ForeignKey("life_games.id", ondelete="CASCADE"))
    record_date: Mapped[date] = mapped_column(Date)
    hours: Mapped[float] = mapped_column(Numeric(6, 1), default=0)
    note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)


# ============ 设置 ============

class LifeSetting(Base):
    """设置项：复合主键 (key, user_id)，每个用户各自的设置互不干扰。"""
    __tablename__ = "life_settings"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    value: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
