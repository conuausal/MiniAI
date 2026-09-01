# MiniAI 后端 - 多阶段构建
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# 系统依赖（sentence-transformers / pypdf 需要的最小集合）
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# 清华 PyPI 镜像：国内服务器构建提速；海外机器同样可用
RUN pip install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple \
    && pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

COPY app ./app
COPY scripts ./scripts
COPY .env.example ./.env.example

# 数据/向量库/上传/模型 四个目录
RUN mkdir -p /app/data/vector_store /app/data/uploads /app/data/models

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -fsS http://localhost:8000/health || exit 1

# 单 worker：SSE 任务进度/内存状态跨进程不一致，个人应用单进程更稳
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
