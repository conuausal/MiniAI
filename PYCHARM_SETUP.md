# PyCharm 启动 MiniAI 项目指南

> 一步步教你用 PyCharm 调试这个项目（后端 + 前端 同时跑）

## 📋 前置要求

| 项目 | 要求 |
|:--|:--|
| PyCharm | **Professional**（推荐，有 Docker 插件）/ Community 也行 |
| Python | 3.11+（项目自带 `.venv`）|
| Node.js | 20+（用于前端）|
| 操作系统 | Windows / macOS / Linux 都支持 |

> 项目根目录：`D:\PycharmProjects\MiniAI`

---

## 🚀 方案一：Compound 配置（最推荐 —— 一键启后端+前端）

### 第 1 步：打开项目

```
File → Open → 选 D:\PycharmProjects\MiniAI → OK
```

PyCharm 会自动识别：
- `backend/` 是一个 Python 项目（有 `.venv`）
- `frontend/` 是一个 Node.js 项目（有 `package.json`）

### 第 2 步：配置 Python 解释器

```
File → Settings (Ctrl+Alt+S) → Project: MiniAI → Python Interpreter
```

点击齿轮图标 → Add → Virtualenv Environment → Existing：

- **Interpreter**: `D:\PycharmProjects\MiniAI\.venv\Scripts\python.exe`
  （macOS/Linux: `D:\PycharmProjects\MiniAI\.venv\bin/python`）

点击 OK。等待 PyCharm 索引依赖（可能需要 1-2 分钟）。

### 第 3 步：创建后端 Run Configuration

```
Run → Edit Configurations → 左上角 + → Python
```

填：
- **Name**: `Backend (uvicorn)`
- **Module name**: `uvicorn`
  （注意选 Module name 而不是 Script path）
- **Parameters**: `app.main:app --reload --host 127.0.0.1 --port 8000`
- **Working directory**: `D:\PycharmProjects\MiniAI\backend`
- **Python interpreter**: Project Default (MiniAI) → `.venv`

→ 保存 ✅

> 💡 **坑**：如果你之前已经手动跑过 `uvicorn` 在 8000 端口，先停掉：
> ```powershell
> Get-Process python | Where-Object { $_.CommandLine -match "uvicorn" } | Stop-Process -Force
> ```

### 第 4 步：创建前端 Run Configuration

```
Run → Edit Configurations → + → npm
```

填：
- **Name**: `Frontend (Next.js dev)`
- **package.json**: `D:\PycharmProjects\MiniAI\frontend\package.json`
- **Command**: `run`
- **Scripts**: `dev`
- 或者直接在 Parameters 写: `npx next dev -p 3000`

→ 保存 ✅

### 第 5 步：创建 Compound（一键启动两者）

```
Run → Edit Configurations → + → Compound
```

填：
- **Name**: `🚀 MiniAI Full Stack`
- **Add** → 选 `Backend (uvicorn)`
- **Add** → 选 `Frontend (Next.js dev)`

→ 保存 ✅

### 第 6 步：启动！

工具栏下拉选 **`🚀 MiniAI Full Stack`** → 点 ▶️ 运行（Shift+F10）

会同时启动：
- 后端 Uvicorn on http://127.0.0.1:8000
- 前端 Next.js on http://localhost:3000

每次改后端代码会热重载；改前端代码会自动 refresh。

---

## 🐳 方案二：Docker Compose（最省心 —— 一键全栈 + 持久化）

### 第 1 步：打开 Docker 设置

PyCharm Professional 有 Docker 插件。

```
File → Settings → Build, Execution, Deployment → Docker
```

点 `+` → 选 Docker Desktop (Windows) 或 Colima (macOS)。

### 第 2 步：运行 docker-compose

```
View → Tool Windows → Docker
```

右键 `docker-compose.yml` → **Run 'docker-compose.yml'**。

会自动：
- 构建后端 + 前端镜像
- 启动两个容器
- 创建数据卷（向量库 + 上传目录持久化）

### 第 3 步：看日志

```
View → Tool Windows → Services
```

展开 `compose` → 双击 `backend` / `frontend` 看实时日志。

---

## 🛠️ 调试技巧

### 后端断点

最佳断点位置（推荐）：

| 文件 | 函数 | 看什么 |
|:--|:--|:--|
| `app/api/chat.py` | `chat_completions` | API 入参 / 流式 SSE |
| `app/api/write.py` | `write_article` | 多智能体流水线 |
| `app/core/llm.py` | `stream_chat` | 模型分发 |
| `app/core/writing_agents.py` | `planner_agent` | 大纲生成 |
| `app/core/demo_provider.py` | `_detect_tool_call` | 工具调用决策 |
| `app/core/rag.py` | `query` | 向量检索 |

### 前端断点

| 文件 | 看什么 |
|:--|:--|
| `components/ChatWindow.tsx` | SSE 事件处理 |
| `components/ModelSelector.tsx` | 模型下拉位置计算 |
| `lib/user-keys.ts` | fetch 拦截器注入逻辑 |

### 条件断点（推荐）

在 `app/api/chat.py` 第 113 行（`if not req.stream:`）右键断点 → Condition：

```python
req.messages[-1].content == "现在几点"
```

这样只在问时间时停下，不会被打断无数次。

### 远程调试后端

在 Run Configuration → Backend → Python Interpreter → 选已有的 → 勾选 **Run with Python Console**，这样可以在控制台里手动 `await ...` 测试协程。

---

## 🌐 访问入口

| URL | 说明 |
|:--|:--|
| http://localhost:3000 | 前端（用户看到的界面）|
| http://localhost:3000/write | 多智能体写作 |
| http://localhost:3000/knowledge | 知识库 |
| http://localhost:3000/settings | 设置 |
| http://127.0.0.1:8000 | 后端 API 根 |
| http://127.0.0.1:8000/docs | **Swagger API 文档（自动生成）** |
| http://127.0.0.1:8000/redoc | ReDoc API 文档（更漂亮）|

> 💡 **重点**：用 Swagger UI (`/docs`) 是最快的后端 API 调试方式！

---

## 🧪 启动后立刻试试

打开 http://localhost:3000 （默认进入 `miniai-demo` 模式）：

1. **聊天**：输入 "你好" → 收到结构化回复
2. **工具**：勾选 🔧 工具 → 输入 "现在几点" → 真实返回当前时间
3. **写作**：左侧导航切到 ✍️ → 输主题 "AI 测试" → 看 5 个 Agent 协同工作
4. **RAG**：切到 📚 → 上传 txt 文件 → 对话引用

---

## 🆘 故障排查

### 端口被占用

```
OSError: [Errno 48] Address already in use
```

→ 杀掉旧进程：
```powershell
# Windows
Get-NetTCPConnection -LocalPort 8000,3000 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

### Python 依赖没装全

```
ModuleNotFoundError: No module named 'fastapi'
```

→ 在 PyCharm 底部 Terminal（backend 目录）跑：
```powershell
..\..\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

或者用 PyCharm 的：
```
右键 requirements.txt → Install Requirements
```

### 前端 npm install 没跑

```
Error: Cannot find module 'next'
```

→ 在 PyCharm 底部 Terminal（frontend 目录）跑：
```powershell
npm install
```

### ChromaDB 启动卡住

后端启动卡 10-30 秒，因为要下载 `all-MiniLM-L6-v2` 模型（79MB）。后续启动秒级。

### ImportError: cannot import name

如果改完代码报 import 错误：
1. 右键 backend/ → Mark Directory as → Sources Root
2. File → Invalidate Caches → Invalidate and Restart

---

## 💡 推荐工作流

1. **日常开发**：
   - 方案一 Compound 启动两个服务
   - 改后端代码自动 reload
   - 改前端代码自动 HMR

2. **写新功能**：
   - 后端：在 `app/api/` 加新路由
   - 前端：在 `app/` 加新页面，在 `components/` 加新组件
   - 配合 Swagger UI 验证 API

3. **发布新版本**：
   ```powershell
   git add .
   git commit -m "feat: 新功能描述"
   git tag v0.9.0
   git push origin main --tags
   ```

---

## 🎁 Bonus：快捷键

| 操作 | 快捷键 |
|:--|:--|
| 运行 | Shift+F10 |
| 调试 | Shift+F9 |
| 切换断点 | Ctrl+F8 |
| 跳到光标处 | Alt+F9 |
| 重新加载所有 Run Configuration | Run → Reload All |
| 终端 | Alt+F12 |
| 搜索文件 | Ctrl+Shift+N |
| 搜索类 | Ctrl+N |
| 全局搜索 | Double Shift |
| 跳到定义 | Ctrl+B / Cmd+B |

---

**有问题随时问！**
