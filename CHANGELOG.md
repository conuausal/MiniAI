# Changelog

所有显著变更都会记录在此文件。版本遵循 [Semantic Versioning](https://semver.org/)。

## [0.2.0] - 2026-08-29

### ✨ Added

- 🛠️ **Function Calling（工具调用）** —— OpenAI 兼容 `tools` 标准，支持多轮工具调用循环
  - 内置 5 个实用工具：
    - `get_current_time` ⏰ 获取当前时间（早上汇报、下班日报刚需）
    - `calculate` 🧮 安全数学计算（沙箱表达式求值）
    - `web_search` 🌐 包装现有联网搜索
    - `query_knowledge` 📚 包装现有 RAG 检索
    - `read_file` 📄 读取项目目录 / 上传目录内的文本文件（路径白名单防穿越）
  - 自动循环：检测到 `tool_calls` → 执行 → 结果以 `role=tool` 回填 → LLM 再次生成，最多 3 轮
  - 前端工具调用可视化卡片（黄色折叠面板，显示每个工具的名称 / 参数 / 结果）
  - 新增 `GET /api/tools` 列出所有可用工具
  - 新增 SSE 事件类型：`tool_call`、`tool_result`

### 🔧 Changed

- `app/core/llm.py`：流式 / 非流式接口增加 `tools` 参数，支持增量 `tool_calls` 累积
- `app/main.py`：版本号 0.1.0 → 0.2.0，新增 tools 路由
- 前端 ModelSelector 增加 🔧 工具开关（amber 配色）
- 设置页增加"Function Calling 工具"清单展示

---

## [0.1.0] - 2026-08-29

### ✨ Added

- 🎉 首个 MVP 版本
- **后端 (FastAPI)**
  - 多模型路由：DeepSeek / OpenAI / 智谱 GLM 等 OpenAI 兼容协议
  - 流式聊天 (SSE) + 自动对话记忆
  - RAG 引擎：PDF / DOCX / TXT / Markdown → ChromaDB → 向量检索
  - 联网搜索：Tavily 集成
  - SQLite 持久化会话与消息
- **前端 (Next.js 14)**
  - 聊天 UI：Markdown / 代码高亮 / 流式渲染
  - 模型选择器 + RAG / 联网开关
  - 历史会话侧边栏
  - 知识库管理：上传 / 检索 / 删除
  - 设置页：模型可用性 / 一键重新加载
- **部署**
  - `docker-compose.yml` 一键启动
  - 后端 / 前端独立 Dockerfile（多阶段构建）
- **开源**
  - MIT License
  - 中英双语 README
  - CONTRIBUTING / CHANGELOG
  - GitHub Actions CI（Python lint + 前端 lint/build）
