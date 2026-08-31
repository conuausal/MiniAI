# Changelog

## [0.11.0] - 2026-08-31

### ✨ 聊天高级体验四件套

#### 主动建议
- 每轮对话结束后，基于上下文毫秒级生成建议 chips（检测代码块 → 解释/优化/找 bug；报错 → 分析原因；长文 → 总结要点；链接 → 解读；无命中 → 通用追问）
- 纯规则实现，零额外 token 成本，点击直接发送

#### 个性化定制（随账号生效，多设备同步）
- **自定义系统提示词**：设置页配置人格/规则/偏好，作为第二条 system 消息注入所有对话
- **Webhook 自定义工具**：填写工具名/描述/参数 Schema/URL，模型可真实调用（后端 POST `{name, arguments}` 到你的服务，响应作为工具结果回填）；设置页可视化 CRUD，带模板

#### 思考过程可视化
- 捕获推理模型的 `reasoning_content`（DeepSeek-R1 / GLM / MiniMax M3 等），以 `💭 思考过程` 折叠卡实时流式展示
- demo 模型在调用工具前合成思考文本，完整体验 ReAct 链
- 思考内容随消息持久化（截断 20k 字符），重开会话不丢失

#### 流式输出升级
- 思考过程逐块流式推送（新 `event: thinking`）
- 渲染层打字机平滑：delta 先入缓冲，rAF 逐帧追赶式上屏，突发 token 不再跳变
- 流式中的消息尾部显示闪烁光标

### 🔧 其他
- 新增 `user_preferences` 表与 `GET/PUT /api/preferences`
- 自定义工具 schema 校验（名称冲突/URL 协议/参数类型），demo 模式支持按名称触发自定义工具

---

## [0.10.1] - 2026-08-31

### 🔒 安全加固

- **修复 `read_file` 工具密钥泄露**：新增敏感文件拒绝清单（`.env` / 密钥 / 数据库 / 日志 / `.git` 等），工具无法再读取服务端配置
- **修复 `calculate` 幂运算 DoS**：幂指数限制 `|n| ≤ 1000`，求值移入线程池 + 2 秒超时，大整数幂不再阻塞事件循环
- **补齐鉴权缺口**：写作任务回放接口增加归属校验（跨用户 404）；`/api/models/reload`、`/api/tools` 需登录
- **知识库上传限制 20MB**：后端 413 + 前端预检
- **登录限流**：同用户名 5 次失败 / 5 分钟 → 429（进程内实现，单 worker 有效）

### 🛠️ 稳定性修复

- **SSE 中断不再丢回复**：客户端断开/异常时，已生成的部分回复自动落库并进入记忆窗口（独立任务 + 独立数据库会话，脱离请求生命周期）
- **流式工具轮耗尽后有收敛回答**：补一轮无工具生成，对齐非流式行为
- **LLM 错误文本不写入对话记忆**：避免 `[MiniAI 错误]` / `[MiniAI 调用失败]` 污染后续上下文
- **Redis 记忆窗口增加 7 天 TTL**，删除会话时同步清理窗口 key，不再无界增长
- **阻塞 I/O 移出事件循环**：ChromaDB / BM25 / 交叉编码器重排 / Tavily 搜索全部改 `asyncio.to_thread`，单 worker 不再被慢检索卡住
- **中文 embedding 模型真正启用**：懒加载 `BAAI/bge-small-zh-v1.5`（60 秒超时），失败自动回退 Chroma 默认模型
- **修复 BM25 阶段 metadata 错位**（空文档过滤后与 metadatas 未同步过滤）
- 修复注册并发竞态 500（冲突返回 409）、JWT `sub` 非法值 500（返回 401）、注册密码超 72 字节静默截断（改为 400 明确提示）

### 💡 体验优化

- 工具调用 JSON 解析失败时向前端发送 error 事件，不再静默吞文本
- demo 模型 calculate 意图检测收紧（"版本 2-3 个" 这类文本不再误触发计算）
- 写作任务回放事件数上限 2000
- 前端：用户主动停止生成不再显示 ⚠️ AbortError；新建/打开/删除会话失败有 alert 提示

---

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
