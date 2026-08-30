"""应用配置：从 .env 加载。"""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "MiniAI"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    app_secret_key: str = "change-me"

    database_url: str = "mysql+aiomysql://miniai:miniai@localhost:3307/miniai"

    vector_store_dir: str = "./data/vector_store"
    embedding_model: str = "BAAI/bge-small-zh-v1.5"

    # ===== Redis 对话记忆窗口 =====
    redis_url: str = "redis://localhost:6379/0"
    memory_window_rounds: int = 20  # 保留最近 N 轮对话

    # ===== RAG 重排序 =====
    # 默认 bge-reranker-v2-m3（国内镜像可达）；若要用 GTE 系列改 RERANK_MODEL 即可
    rerank_model: str = "BAAI/bge-reranker-v2-m3"
    hf_endpoint: str = ""  # 国内可填 https://hf-mirror.com 加速模型下载

    # ===== 随机二次元 =====
    random_anime_api: str = "https://api.elaina.cat/random/"

    # ===== 多 provider API Keys（用户也可在前端 🔑 配置） =====
    # DeepSeek
    deepseek_api_key: str = ""
    deepseek_base_url: str = ""
    # OpenAI
    openai_api_key: str = ""
    openai_base_url: str = ""
    # MiniMax
    MiniMax_api_key: str = ""
    MiniMax_base_url: str = ""
    # 智谱 GLM
    zhipuai_api_key: str = ""
    zhipuai_base_url: str = ""
    # Moonshot Kimi
    moonshot_api_key: str = ""
    # 通义千问 Qwen
    qwen_api_key: str = ""
    # Google Gemini
    gemini_api_key: str = ""

    # Tavily
    tavily_api_key: str = ""

    # 阿里云百炼（DashScope）Web Search（联网搜索），与 qwen 共用同一个 key
    dashscope_api_key: str = ""

    cors_origins: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
