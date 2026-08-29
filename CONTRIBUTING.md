# 🤝 贡献指南

非常欢迎你加入 MiniAI！无论是提交代码、改进文档、报告 Bug 还是提出新点子，都是对项目的巨大帮助。

## 🧭 行为准则

- 友善、包容、就事论事
- 任何 PR 都需要通过 CI 才能合并

## 🚀 开发流程

### 1. Fork & Clone

```bash
git clone https://github.com/<your-username>/MiniAI.git
cd MiniAI
git checkout -b feature/your-feature-name
```

### 2. 本地起服务

后端：

```bash
cd backend
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # 填入 API Key
uvicorn app.main:app --reload
```

前端：

```bash
cd frontend
npm install
npm run dev
```

### 3. 代码风格

- **Python**：使用 [Ruff](https://github.com/astral-sh/ruff)（`pip install ruff && ruff check .`）
- **TypeScript**：遵循 Next.js / ESLint 默认规则
- 提交前确保 `ruff check .` 和 `npm run lint` 通过

### 4. 提交规范（Conventional Commits）

```
feat: 新增 XXX 功能
fix: 修复 XXX Bug
docs: 更新文档
refactor: 重构 XXX
chore: 构建/依赖变更
test: 添加/调整测试
```

示例：`feat(knowledge): support .epub upload`

### 5. PR 流程

1. 推送到你的 fork：`git push origin feature/xxx`
2. 在 GitHub 创建 Pull Request
3. 等待 CI 通过 + 维护者 review
4. 合入后会自动出现在 README 的 Contributors 中

## 🐛 报告 Bug

请使用 [Issue 模板](../../issues/new)，并附上：

- 复现步骤
- 预期 vs 实际行为
- 截图 / 报错堆栈
- 环境信息（OS / Python / Node 版本）

## 💡 提出新功能

先在 [Discussions](../../discussions) 描述使用场景与设计思路，得到维护者 ✅ 后再开 PR。
这样可以避免做出来发现方向不对。

## 🔌 添加新模型 / 新工具

- 新模型：编辑 `backend/app/core/llm.py` 的 `MODEL_REGISTRY`，并在 `_client()` 里加上对应的 base_url / api_key
- 新工具（Function Calling）：在 `backend/app/core/tools/` 下添加实现，并在 `chat.py` 注册 schema

## 📦 发布流程

1. 更新 `CHANGELOG.md`
2. Bump 版本号（`backend/app/main.py` + `frontend/package.json`）
3. 打 tag：`git tag v0.x.y && git push --tags`
4. GitHub Actions 自动构建镜像 + 创建 Release

## 🙏 致谢

- 灵感来自 [LangChain](https://github.com/langchain-ai/langchain)、[Dify](https://github.com/langgenius/dify)、[ChatGPT-Next-Web](https://github.com/ChatGPTNextWeb/ChatGPT-Next-Web)
- 感谢所有贡献者 ❤️
