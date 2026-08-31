# Changelog

## [0.10.0] - 2026-08-31

### 🏠 个人工作生活管理（9 模块）
- 总览 / 今日计划 / 自媒体 / 开发 / 咨询 / 健身 / 饮食 / 游戏 / 数据与设置
- 各模块独立业务字段（非通用任务列表），共 20 张 `life_*` 表（MySQL）
- 首页聚合摘要：今日待办 + 置顶便签 + 各模块要点

### 🔐 多用户账号
- 用户名 + 密码自助注册 / 登录（bcrypt + JWT httpOnly Cookie `miniai_token`）
- 全站需登录，`(protected)` 路由组守卫，数据按 `user_id` 隔离

### 🌐 联网搜索升级
- 接入阿里云百炼 DashScope Web Search（通义千问 `enable_search`），Tavily 降级为回退

### ✍️ 多智能体写作体验
- 文章预览弹窗
- SSE 事件错误不再静默吞掉，浮出到 UI

### 🐋 模型
- DeepSeek-V4 拆分为 Pro / Flash 两个可选模型

### 🔧 部署修复
- docker-compose 前端 API 地址改用服务名 `backend`
- 拆分客户端 / 服务端 rewrite 变量，修复前端 API 地址内联 bug
- 后端容器改单 worker，避免 SSE 任务进度跨进程不一致

---

## [0.9.0] - 2026-08-30

### 🗄️ 存储升级
- SQLite → MySQL（docker 容器映射宿主 3307）
- 引入 Redis（6379）作为对话记忆窗口

### 🔍 RAG 升级
- 混合检索（BM25 + 向量）+ 交叉编码器重排（`bge-reranker-v2-m3`）
- 重排模型缺失时自动降级 RRF 融合

### 🎀 随机二次元
- 随机二次元图片功能，本地缓存稳定 URL，修复"打开原图"每次换图问题

---

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
