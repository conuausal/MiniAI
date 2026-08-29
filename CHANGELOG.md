# Changelog

所有显著变更都会记录在此文件。版本遵循 [Semantic Versioning](https://semver.org/)。

## [0.4.0] - 2026-08-29

### ✨ Added — 多租户 SaaS 化

- **用户级 API Key 管理**：
  - 前端 `🔑` 抽屉：可视化配置 DeepSeek / OpenAI / 智谱 三家 provider
  - Key 存储到浏览器 `localStorage`（仅本机，不上传服务器）
  - `fetch` 拦截器自动注入 `X-User-API-Keys: {"deepseek":"sk-..."}` header
  - 后端从 header 解析 → 合并 `.env` 兜底 → 仅本次请求生效（不污染全局）
  - 每用户独立 API 配额、独立隐私（部署到公网时多租户天然隔离）
- **全新 UI 系统**（向大众审美靠拢）：
  - 设计令牌系统：CSS 变量 + 暗色模式（localStorage 持久化 + 系统偏好）
  - 顶部导航 `Topbar`：玻璃拟态 + Logo + 导航 + 主题切换 + Key 入口 + GitHub
  - 主界面欢迎屏：衬线大标题 + 4 张提示卡片（呼应 ChatGPT / Notion 风格）
  - 消息气泡：左右双头像、圆角 + 阴影、代码高亮自定义
  - 输入框：自适应高度、focus 阴影增强
  - 多智能体写作：横向进度条 + 状态指示（O/⏳/✓）+ 字体用衬线（更文章感）
  - 知识库：拖拽上传区 + 状态徽章 + 命中相似度徽章
  - 设置页：3 张状态卡片 + 模型分组（已启用 / 未配置）+ 工具清单

### 🔧 Changed

- `backend/app/core/llm.py`：拆出 `parse_user_keys()` / `get_effective_keys()`，所有 client 构造都接受 `user_keys` 参数
- `backend/app/api/chat.py` / `write.py` / `models.py`：通过 `Depends(get_user_keys)` 从 header 读取
- `backend/app/core/writing_agents.py`：4 个 Agent / pipeline 都透传 `user_keys`
- `frontend/lib/user-keys.ts`：新增，含 `useUserKeys` hook + `patchFetchWithUserKeys()`
- `frontend/lib/theme.ts`：新增，含 `useDarkMode` hook
- `frontend/components/ApiKeyDrawer.tsx`：新增，右滑抽屉
- `frontend/components/Topbar.tsx`：新增
- `frontend/app/layout.tsx`：注入主题脚本（避免暗色模式闪烁）
- `frontend/tailwind.config.js` / `app/globals.css`：完全重写设计系统

---

## [0.3.0] - 2026-08-29

### ✨ Added

- 🤖 多智能体写作（Planner → Researchers → Writer）
- 8 种 SSE 事件流式可视化

## [0.2.0] - 2026-08-29

### ✨ Added

- 🛠 Function Calling（5 个内置工具）

## [0.1.0] - 2026-08-29

### ✨ Added

- 🎉 MVP：多模型 + RAG + 联网搜索 + 对话记忆 + 流式输出 + Docker 一键部署
