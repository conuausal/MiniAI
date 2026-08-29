# Changelog

所有显著变更都会记录在此文件。版本遵循 [Semantic Versioning](https://semver.org/)。

## [0.5.0] - 2026-08-30

### ✨ Added — 模型大幅扩充

- **内置 25 个模型，覆盖 7 个 provider**：
  - 🐋 DeepSeek (3)：V3 / R1 / Coder-V2
  - 🧠 OpenAI (6)：GPT-4o / 4o-mini / 4-Turbo / 3.5-Turbo / o1 / o1-mini
  - 🤖 **MiniMax (3)：M3 / Text-01 / abab6.5s**  ← 新增
  - 🀄 智谱 GLM (3)：4-Plus / 4-Flash (免费) / 4-Long
  - 🌙 Moonshot Kimi (3)：128K / 32K / 8K
  - ☁️ 通义千问 Qwen (4)：Max / Plus / Turbo / Long
  - 💎 Google Gemini (3)：1.5 Pro / 1.5 Flash / 2.0 Flash Exp
- **自定义 OpenAI 兼容服务**：
  - 用户可在 🔑 抽屉里添加任意 provider（Ollama / One-API / OpenRouter / 公司内网代理…）
  - 填：Base URL + API Key + 模型列表
  - 存 localStorage，请求时通过 `X-User-Custom-Providers` header 传给后端
  - 后端在生成 client 时合并内置 + 自定义 provider
- **模型标签系统**：每个模型有 tags（推荐 / 推理 / 代码 / 快速 / 经济 / 中文 / 长文本 / 多模态 / 免费 / 最新），前端 ModelSelector 按标签显示彩色徽章
- **ModelSelector 重做**：
  - 按 provider 分组下拉（替代原来扁平 select）
  - 当前模型显示 emoji + label
  - 标签彩色徽章
  - 已启用 / 未配置 分两段

### 📝 Notes on "DeepSeek V4"

- 截至 v0.5.0 发布，DeepSeek 没有官方 V4 公开模型
- 我们用真实存在的 **DeepSeek-V3** + **R1** + **Coder-V2** 替代
- 当 DeepSeek 发布 V4 时，只需在 `backend/app/core/llm.py` 的 `MODEL_REGISTRY` 加一行即可

### 🔧 Changed

- `backend/app/config.py`：扩展支持 7 个 provider 的 env key
- `backend/.env.example`：列出所有 provider 的环境变量
- `backend/app/models/schemas.py`：`ModelInfo` 增加 `tags: List[str]`
- `frontend/lib/user-keys.ts`：重写，支持自定义 provider + fetch 拦截器注入两个 header
- `frontend/components/ApiKeyDrawer.tsx`：增加自定义服务编辑器弹窗
- `frontend/components/ModelSelector.tsx`：完全重写为分组下拉

---

## [0.4.0] - 2026-08-29

### ✨ Added

- 多租户 API Key（用户在前端填自己的 Key，存 localStorage）
- 全新 UI 设计系统 + 暗色模式

## [0.3.0] - 2026-08-29

### ✨ Added

- 多智能体写作（Planner → Researchers → Writer）

## [0.2.0] - 2026-08-29

### ✨ Added

- Function Calling（5 个内置工具）

## [0.1.0] - 2026-08-29

### ✨ Added

- MVP：多模型 + RAG + 联网搜索 + 对话记忆 + 流式输出 + Docker
