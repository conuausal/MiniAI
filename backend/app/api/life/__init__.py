"""个人工作生活管理 —— 路由聚合。"""
from fastapi import APIRouter

from app.api.life import consult, dev, diet, fitness, games, home, media, notes, settings, todos

router = APIRouter()
router.include_router(home.router)
router.include_router(todos.router)
router.include_router(notes.router)
router.include_router(settings.router)
router.include_router(media.router)
router.include_router(dev.router)
router.include_router(consult.router)
router.include_router(fitness.router)
router.include_router(diet.router)
router.include_router(games.router)
