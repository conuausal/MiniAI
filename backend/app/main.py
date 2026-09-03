"""MiniAI 后端 - FastAPI 应用入口。"""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.api import anime, auth, chat, knowledge, life, models, preferences, sessions, tools, write
from app.config import settings
from app.core.rag import rag_engine
from app.db.database import init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    """应用启动/关闭钩子：初始化 DB、加载向量库。"""
    logger.info("🚀 启动 MiniAI | env={} | port={}", settings.app_env, settings.app_port)
    Path(settings.vector_store_dir).mkdir(parents=True, exist_ok=True)
    await init_db()
    await rag_engine.bootstrap()
    yield
    logger.info("👋 MiniAI 已关闭")


# 生产环境关闭 API 文档，避免暴露接口清单
IS_PRODUCTION = settings.app_env.strip().lower() == "production"

app = FastAPI(
    title="MiniAI API",
    description="开源的个人 AI 助手：多模型 + RAG + 联网搜索 + 工具调用 + 多智能体写作 + 对话记忆",
    version="0.12.0",
    lifespan=lifespan,
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(knowledge.router, prefix="/api/knowledge", tags=["knowledge"])
app.include_router(models.router, prefix="/api/models", tags=["models"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["sessions"])
app.include_router(tools.router, prefix="/api/tools", tags=["tools"])
app.include_router(write.router, prefix="/api/write", tags=["write"])
app.include_router(anime.router, prefix="/api/anime", tags=["anime"])
app.include_router(life.router, prefix="/api/life", tags=["life"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(preferences.router, prefix="/api/preferences", tags=["preferences"])


@app.get("/health", tags=["meta"])
async def health() -> dict:
    return {"status": "ok", "app": settings.app_name, "version": "0.12.0"}
