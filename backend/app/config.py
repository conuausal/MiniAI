"""应用配置：从 .env 加载。"""
from functools import lru_cache
from typing import List

from pydantic import model_validator
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

    # ===== 登录鉴权 =====
    jwt_secret: str = "change-me-to-a-long-random-string"  # 生产环境务必在 .env 里改强
    jwt_expire_days: int = 7
    cookie_secure: bool = False  # 公网 HTTPS 部署时置 True

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

    @model_validator(mode="after")
    def _production_guard(self) -> "Settings":
        """生产环境安全守卫：拒绝默认密钥、强制 HTTPS Cookie（否则拒绝启动）。

        仅在 APP_ENV=production 时生效；本地开发不受影响。
        详见 README「🔒 部署安全提示」。
        """
        if self.app_env.strip().lower() != "production":
            return self
        problems: list[str] = []
        if self.jwt_secret == "change-me-to-a-long-random-string":
            problems.append("JWT_SECRET 仍是默认值，请设置为强随机密钥")
        if not self.cookie_secure:
            problems.append("COOKIE_SECURE 必须为 True（生产环境需 HTTPS）")
        if problems:
            raise ValueError(
                "生产环境安全配置不完整，拒绝启动：\n- " + "\n- ".join(problems)
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
