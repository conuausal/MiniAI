# Changelog

## [0.8.0] - 2026-08-30

### 🔥 重大修复：内置 Demo 模型（让功能真正可用）

之前所有功能在用户没有 API Key 时完全无法使用。现新增内置 demo 模型：

- **🎭 miniai-demo 模型**（永远 enabled，无需任何 Key）
  - 智能意图识别（问候/解释/创作/计算/搜索等）
  - 真正调用后端工具（get_current_time/calculate/web_search/query_knowledge/read_file 都能跑）
  - 多智能体写作全流程（Planner → Researchers → Writer）
  - 流式输出（SSE）
- **前端默认模型改为 miniai-demo** — 用户开箱即用
- **修了 4 个隐藏 bug**：
  - `chat.py` 返回类型 `StreamingResponse | dict` 不被 FastAPI 支持
  - `writing_agents.py` 没适配 v0.2.0 的 `chat_once` 返回格式
  - `tc.model_dump()` 对 demo dict 报错
  - Demo 第二次调用时只找 user role 消息，导致工具循环失败
  - `writer_for_demo` 用 dict 访问属性，OutlineItem 是 dataclass
- **完整端到端测试通过**：
  - 聊天 ✅
  - get_current_time 工具 ✅
  - calculate 工具 ✅
  - 多智能体写作（同步）✅ 1302 字文章
  - 多智能体写作（SSE）✅ 8 个事件全到
  - RAG 检索 ✅

---

## [0.7.0] - 2026-08-30
