<div align="center">

# 🧠 MiniAI

**开源、轻量、可私有化部署的个人 AI 助手**

[English](#english) · [简体中文](#简体中文) · [功能特性](#✨-功能特性) · [快速开始](#🚀-快速开始) · [部署上线](#🌐-部署上线) · [Roadmap](#🗺️-roadmap)

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-green.svg)](https://www.python.org/)
[![Node 20+](https://img.shields.io/badge/node-20+-green.svg)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

## ✨ 功能特性

基于日常痛点清单打造，覆盖 AI 助手 4 项核心刚需 + 多项高级能力：

| 优先级 | 能力 | 状态 |
|:--|:--|:--:|
| **P1** | 多模型自由切换（DeepSeek / OpenAI / 智谱 等 OpenAI 兼容协议） | ✅ |
| **P1** | RAG 知识库（PDF / DOCX / TXT / MD，本地向量库 ChromaDB） | ✅ |
| **P1** | 联网搜索（Tavily，可替换） | ✅ |
| **P1** | 对话记忆（SQLite 持久化 + 会话管理） | ✅ |
| **P2** | 流式输出（SSE，token-by-token） | ✅ |
| **P2** | 多集合知识库（隔离不同业务文档） | ✅ |
| **P3** | Docker 一键部署 / SaaS 化 | ✅ |
| **P2** | 多智能体协作（任务分解 + 工具调度） | 🚧 |
| **P2** | 语音输入 / 输出（Whisper + TTS） | 🚧 |
| **P3** | 操作可视化（ReAct 推理链） | 🚧 |

---

## 🏗️ 架构

```
┌──────────────────┐         ┌────────────────────────────────┐
│   Next.js 14     │  HTTP   │          FastAPI               │
│  (Chat UI)       │ ──────► │  ┌─────────────────────────┐   │
│  - 流式 SSE      │         │  │   Router (chat/...)     │   │
│  - Markdown      │         │  └────────────┬────────────┘   │
│  - TailwindCSS   │         │       ┌──────┴───────┐         │
└──────────────────┘         │       ▼              ▼         │
                             │   LLM Router     RAG Engine    │
                             │   (OpenAI 协议)  (ChromaDB)    │
                             │       │              │         │
                             │       ▼              ▼         │
                             │  DeepSeek / GPT  Embeddings    │
                             │  Claude / GLM   bge-small-zh   │
                             │       │                        │
                             │       ▼                        │
                             │  ┌──────────────────┐         │
                             │  │  Web Search      │         │
                             │  │  (Tavily)        │         │
                             │  └──────────────────┘         │
                             │       │                        │
                             │       ▼                        │
                             │  ┌──────────────────┐         │
                             │  │  SQLite          │         │
                             │  │  (sessions/msgs)  │         │
                             │  └──────────────────┘         │
                             └────────────────────────────────┘
```

---

## 🚀 快速开始

### 方式一：Docker Compose（推荐）

```bash
# 1. 克隆仓库
git clone https://github.com/<your-username>/MiniAI.git
cd MiniAI

# 2. 配置 API Key
cp backend/.env.example backend/.env
# 编辑 backend/.env，至少填入一个模型的 API Key（推荐 DeepSeek）

# 3. 启动
docker compose up -d

# 浏览器访问 http://localhost:3000
```

### 方式二：本地开发模式

#### 后端

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# 填入 API Key

uvicorn app.main:app --reload --port 8000
```

API 文档：访问 `http://localhost:8000/docs`

#### 前端

```bash
cd frontend
npm install
npm run dev
```

访问 `http://localhost:3000`

---

## 🌐 部署上线

### 推荐平台（免费额度起步）

| 平台 | 用途 | 费用 |
|:--|:--|:--|
| [Railway](https://railway.app) | 部署后端 + 持久化卷 | $5/月赠送额度 |
| [Render](https://render.com) | 部署后端 / 全栈 | 免费层 + $7/月 |
| [Vercel](https://vercel.com) | 部署 Next.js 前端 | 免费 |
| [Fly.io](https://fly.io) | 全球边缘部署 | 免费层 |
| 自有 VPS | Docker Compose 一键 | 仅 VPS 费用 |

### 部署到 Railway（示例）

1. 把仓库推到 GitHub
2. Railway → New Project → Deploy from GitHub
3. 选择 `backend` 目录作为 Root
4. 配置环境变量（从 `backend/.env` 复制）
5. 添加一个 Volume 挂载到 `/app/data` 用于持久化向量库
6. 部署完成后拿到后端 URL，类似 `https://xxx.up.railway.app`
7. 部署前端到 Vercel：Root = `frontend`，环境变量 `NEXT_PUBLIC_API_BASE` = 后端 URL

### 部署到自有 VPS

```bash
# 一台 2C2G 的 VPS 足够
scp -r ./* user@your-server:/opt/miniai
ssh user@your-server "cd /opt/miniai && docker compose up -d"
# 反向代理建议使用 Caddy 或 Nginx + Let's Encrypt 自动 HTTPS
```

---

## 🗂️ 目录结构

```
MiniAI/
├── backend/                # FastAPI 后端
│   ├── app/
│   │   ├── api/            # REST 路由
│   │   ├── core/           # LLM / RAG / Web Search / Memory
│   │   ├── db/             # 数据库
│   │   ├── models/         # ORM + Pydantic
│   │   └── main.py
│   ├── data/               # 运行时数据（git 忽略）
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/               # Next.js 14 前端
│   ├── app/                # App Router
│   ├── components/
│   ├── lib/                # API 客户端 + 状态
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── .github/workflows/      # CI
├── README.md
├── LICENSE                 # MIT
└── CONTRIBUTING.md
```

---

## 🔌 接入新模型

所有模型走 OpenAI 兼容协议，只需在 `backend/.env` 添加 base_url + api_key，然后编辑 `backend/app/core/llm.py` 注册模型即可：

```python
MODEL_REGISTRY["my-model"] = {
    "provider": "myprovider",   # 在 _client() 里加上对应 base/key
    "label": "我的模型",
}
```

如果你用的是 vLLM / Ollama / LM Studio 本地部署，只需把 base_url 指向本地地址（如 `http://localhost:11434/v1`）。

---

## 🗺️ Roadmap

- [x] MVP：多模型 + RAG + 联网 + 记忆（0.1.0）
- [x] Function Calling + 工具可视化（0.2.0）
- [ ] 多智能体协作（Planner-Worker 模式）
- [x] 工具调用（Function Calling）：5 个内置工具（时间/计算/搜索/检索/读文件）+ 可视化卡片
- [ ] 语音交互（Whisper ASR + Edge TTS）
- [ ] Web 搜索结果可视化（引用卡片）
- [ ] 自定义工具（用户上传 JSON Schema）
- [x] 工具调用可视化（折叠卡片）
- [ ] 用户系统 + 多租户
- [ ] 移动端 PWA
- [ ] 浏览器扩展

详见 [GitHub Projects](https://github.com/<your-username>/MiniAI/projects)。

---

## 🤝 参与贡献

欢迎任何形式的贡献！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

- 🐛 报告 Bug：[Issues](../../issues)
- 💡 提出新功能：[Discussions](../../discussions)
- 🔧 提交 PR：[Pull Requests](../../pulls)

---

## 📄 License

本项目基于 [MIT](LICENSE) 开源。

---

## 简体中文

> 如果你是中文用户，上面的内容已经够用了 😊。

### 痛点驱动的设计

MiniAI 起始于一份个人痛点清单（见 [`我的日常痛点.md.md`](./我的日常痛点.md.md)），
针对 6 个真实场景（早汇报、长文档摘要、周报生成、查资料、会议记录、下班日报）
定义了 3 档优先级功能。本次发布覆盖 **P1 核心刚需** 与部分 P2 体验优化。

### 推荐的入门路径

1. 先用 DeepSeek（成本低、中文强）跑通"对话 + 联网"主流程
2. 在知识库页面上传 2~3 份你的真实文档（产品手册 / 周报模板），体验 RAG
3. 在 `backend/.env` 接入更多模型（GPT-4o 适合创意，o1 适合复杂推理）
4. 一键 Docker 部署后即可在任何设备访问



### 🔧 Function Calling 怎么用？

勾选对话页右上角的 **🔧 工具** 开关，然后试试这些问题：

| 你的输入 | MiniAI 自动做的 |
|:--|:--|
| 「现在几点了？」 | 调用 get_current_time 返回准确时间 |
| 「(123+456)*7 等于多少」 | 调用 calculate 安全求值 |
| 「帮我搜下今天 AI 新闻」 | 调用 web_search 实时检索 |
| 「之前上传的那份文档说了什么」 | 调用 query_knowledge RAG 召回 |
| 「打开 README.md 看看」 | 调用 ead_file 读取项目内文件 |

调用过程会显示在助手消息下方的一个**琥珀色折叠卡片**里，展开能看到每个工具的名称、参数、结果 —— 这正是你痛点 P3「操作可视化」的落地。

如果你想加自己的工具（比如"查日历"、"发邮件"），只需在 ackend/app/core/tools.py 里再 _register(...) 一行即可。
### 我能不能纯本地跑、不花钱？

可以。三个步骤：

1. 用 [Ollama](https://ollama.com) 本地跑模型（如 `ollama run qwen2.5:7b`）
2. 把 Ollama 当作 OpenAI 兼容后端（base_url = `http://host.docker.internal:11434/v1`）
3. 不需要联网搜索 API，关闭 Tavily 即可

向量库的 Embedding 模型（`BAAI/bge-small-zh-v1.5`）首次启动会从 HuggingFace 下载，约 90 MB。

---

## English

### What is MiniAI?

MiniAI is an **open-source, lightweight, self-hostable personal AI assistant**.
It addresses the everyday pain points documented in [`我的日常痛点.md.md`](./我的日常痛点.md.md)
(morning briefings, document summarization, weekly reports, research, meeting notes, end-of-day summaries).

### Features

- **Multi-model** — switch between DeepSeek, OpenAI, Zhipu GLM, or any OpenAI-compatible endpoint (vLLM, Ollama, LM Studio…)
- **RAG** — upload PDFs / DOCX / TXT / Markdown, chat with your own knowledge base
- **Web search** — Tavily-powered real-time search injection
- **Conversation memory** — persistent sessions with auto-titling
- **Streaming** — SSE token-by-token output
- **Docker-first** — one command to ship anywhere

### Quick Start

```bash
git clone https://github.com/<your-username>/MiniAI.git
cd MiniAI
cp backend/.env.example backend/.env
$EDITOR backend/.env          # fill in at least one API key
docker compose up -d
open http://localhost:3000
```

### Stack

- **Backend**: Python 3.11 / FastAPI / SQLAlchemy 2 / ChromaDB / OpenAI SDK
- **Frontend**: Next.js 14 / React 18 / TailwindCSS / Zustand / SWR
- **Infra**: Docker / Docker Compose / GitHub Actions

### License

MIT — see [LICENSE](LICENSE).
