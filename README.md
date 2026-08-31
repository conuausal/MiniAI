<div align="center">

# 🧠 MiniAI

**个人 AI 助手 + 工作生活管理 —— 多模型 · RAG · 联网搜索 · 工具调用 · 多智能体写作**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-green.svg)](https://www.python.org/)
[![Node 20+](https://img.shields.io/badge/node-20+-green.svg)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

## ✨ 功能特性

| 能力 | 说明 |
|:--|:--|
| 🧠 **多模型自由切换** | DeepSeek / OpenAI / 智谱 GLM / MiniMax / Kimi / Qwen / Gemini，或任意 OpenAI 兼容服务（Ollama / vLLM / One-API） |
| 🎭 **内置演示模型** | `miniai-demo` 无需任何 API Key，开箱即可体验聊天、工具调用、多智能体写作全流程 |
| 📚 **RAG 知识库** | 上传 PDF / DOCX / TXT / Markdown，ChromaDB 向量检索 + 混合检索重排，对话中自动注入上下文 |
| 🌐 **联网搜索** | 阿里云百炼 DashScope Web Search（未配置时回退 Tavily） |
| 🔧 **Function Calling** | 5 个内置工具（时间 / 计算 / 搜索 / 知识库 / 读文件）+ 调用过程可视化折叠卡片 |
| ✍️ **多智能体写作** | Planner → 并行 Researchers → Writer 流水线，SSE 实时进度 + 文章预览 |
| 💬 **对话记忆** | MySQL 持久化会话与消息 + Redis 记忆窗口 + 自动标题 |
| ⚡ **流式输出** | SSE token-by-token |
| 🎤 **语音交互** | 浏览器原生 Web Speech API（STT + TTS），零成本 |
| 🏠 **个人工作生活管理** | 9 大模块：总览 / 今日计划 / 自媒体 / 开发 / 咨询 / 健身 / 饮食 / 游戏 / 数据与设置 |
| 🔐 **多用户账号** | 注册 / 登录（JWT httpOnly Cookie），全站数据按用户隔离 |
| 🎀 **随机二次元** | 每日随机二次元图片 |
| 🐳 **一键启动** | Docker Compose 启动全栈（后端 + 前端 + MySQL + Redis） |

---

## 🏗️ 架构

```
┌───────────────────┐         ┌─────────────────────────────────────┐
│    Next.js 14     │  HTTP   │              FastAPI                │
│  (需登录, (protected))│ ──────► │  ┌─────────────────────────────┐   │
│  - 聊天 / 写作     │  rewrite │  │ Router: chat / knowledge /    │   │
│  - 知识库 / 生活   │  /api/*  │  │         write / life / auth /  │   │
│  - 二次元 / 设置   │         │  │         sessions / models / ... │   │
└───────────────────┘         │  └──────────────┬────────────────┘   │
                              │      ┌──────────┴─────────┐          │
                              │      ▼                    ▼          │
                              │  LLM Router          RAG Engine       │
                              │  (OpenAI 兼容)       (ChromaDB)       │
                              │   + demo 模型         + 混合检索重排    │
                              │      │                               │
                              │      ├──► Web Search（阿里云/Tavily）   │
                              │      │                               │
                              │      ▼                               │
                              │  ┌─────────────────────────────┐     │
                              │  │ MySQL（用户/会话/消息/生活管理）│     │
                              │  │ Redis（对话记忆窗口）          │     │
                              │  └─────────────────────────────┘     │
                              └─────────────────────────────────────┘
```

---

## 🚀 快速开始

> 前置：需要 **Docker**（MySQL 与 Redis 跑在容器中）。国内网络建议先配置 Docker 镜像加速。

### 方式一：Docker Compose（推荐）

```bash
# 1. 克隆仓库
git clone https://github.com/conuausal/MiniAI.git
cd MiniAI

# 2. 配置环境变量（不填 API Key 也能用内置 demo 模型体验）
cp backend/.env.example backend/.env
# 编辑 backend/.env，填入 DEEPSEEK_API_KEY 等（可选）

# 3. 一键启动全栈（backend + frontend + mysql + redis）
docker compose up -d

# 浏览器访问 http://localhost:3000
```

### 方式二：本地开发模式

**第一步：启动基础设施**（MySQL 容器映射宿主 3307，Redis 6379）

```bash
docker compose up -d mysql redis
```

**第二步：后端**

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env   # 填入 API Key（可选）
uvicorn app.main:app --reload --port 8000
```

API 文档：http://localhost:8000/docs

**第三步：前端**

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:3000

### 首次使用

1. 打开 http://localhost:3000，未登录会自动跳转 `/login`
2. 注册一个账号（用户名 + 密码），登录后即可使用
3. 默认模型为内置 `miniai-demo`，无需 API Key 即可体验；也可在右上角 🔑 抽屉里填自己的模型 Key 或添加自定义 OpenAI 兼容服务

---

## 🗂️ 目录结构

```
MiniAI/
├── backend/                # FastAPI 后端
│   ├── app/
│   │   ├── api/            # REST 路由
│   │   │   ├── chat.py         # /api/chat（流式 + 工具调用）
│   │   │   ├── knowledge.py    # /api/knowledge（知识库）
│   │   │   ├── write.py        # /api/write（多智能体写作）
│   │   │   ├── life/           # /api/life（生活管理 9 模块）
│   │   │   ├── auth.py         # /api/auth（注册 / 登录）
│   │   │   └── ...             # sessions / models / tools / anime
│   │   ├── core/           # 核心能力
│   │   │   ├── llm.py          # 多模型路由
│   │   │   ├── rag.py          # ChromaDB 向量库 + 混合检索
│   │   │   ├── web_search.py   # 联网搜索（阿里云百炼 / Tavily）
│   │   │   ├── tools.py        # Function Calling 工具
│   │   │   ├── writing_agents.py # 多智能体写作流水线
│   │   │   ├── auth.py         # JWT 鉴权
│   │   │   ├── demo_provider.py # 内置演示模型
│   │   │   └── memory.py       # 会话 / 消息持久化
│   │   ├── models/         # ORM + Pydantic
│   │   ├── db/             # 数据库引擎
│   │   └── main.py
│   ├── data/               # 运行时数据（git 忽略）
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/               # Next.js 14 前端
│   ├── app/
│   │   ├── (protected)/    # 需登录页面
│   │   │   ├── page.tsx        # 对话
│   │   │   ├── write/          # 多智能体写作
│   │   │   ├── knowledge/      # 知识库
│   │   │   ├── life/           # 工作生活管理
│   │   │   ├── anime/          # 随机二次元
│   │   │   └── settings/       # 设置
│   │   └── login/          # 登录 / 注册
│   ├── components/         # UI 组件
│   ├── lib/                # API 客户端 + 状态管理
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── .github/workflows/      # CI（lint / 构建 / Docker 镜像）
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
└── LICENSE                 # MIT
```

---

## 🔌 接入新模型

所有模型走 OpenAI 兼容协议。两种方式：

1. **后端 .env 配置**：在 `backend/.env` 添加 base_url + api_key，然后在 `backend/app/core/llm.py` 的 `MODEL_REGISTRY` 注册：

```python
MODEL_REGISTRY["my-model"] = {
    "provider": "myprovider",   # 在 PROVIDER_DEFAULTS / _client() 里加上对应 base/key
    "label": "我的模型",
}
```

2. **前端动态添加**：在网页右上角 🔑 抽屉里填写任意 OpenAI 兼容服务的 Base URL + Key + 模型 ID，无需改代码。

本地模型（vLLM / Ollama / LM Studio）只需把 base_url 指向本地地址，如 `http://localhost:11434/v1`。

---

## 🗺️ 规划中

- [ ] 找回密码
- [ ] 通用多智能体任务（市场分析 / 数据报告 / 代码评审）
- [ ] 自定义工具（用户上传 JSON Schema）
- [ ] 移动端 PWA
- [ ] 浏览器扩展

---

## 🤝 参与贡献

欢迎任何形式的贡献！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

- 🐛 报告 Bug：[Issues](../../issues)
- 💡 提出新功能：[Discussions](../../discussions)
- 🔧 提交 PR：[Pull Requests](../../pulls)

---

## 📄 License

本项目基于 [MIT](LICENSE) 开源。
