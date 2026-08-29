# Changelog

所有显著变更都会记录在此文件。版本遵循 [Semantic Versioning](https://semver.org/)。

## [0.3.0] - 2026-08-29

### ✨ Added

- 🤖 **多智能体写作（Planner → Researchers → Writer）**
  - 4 个 Agent 协同：
    - 🧭 **Planner**：主编，把主题拆解为 N 个章节的大纲
    - 🔍 **Researcher** × N：并行调研员，每个章节独立收集素材（可调用 RAG + 联网搜索）
    - ✍️ **Writer**：撰稿人，综合所有章节素材生成最终文章
  - 3 种长度预设：简短（约 1000 字）/ 中等（约 2000 字）/ 深度（约 3500 字）
  - 4 种风格预设：博客 / 学术 / 商业报告 / 社交媒体
  - 可选自定义大纲（每行一章）
  - SSE 流式推送每个 Agent 的状态变化，前端实时可视化流水线
  - 一键下载最终文章为 `.md` 文件
- 新增 `POST /api/write/article`（SSE 流式）+ `POST /api/write/article/sync`（同步调试）+ `GET /api/write/article/{task_id}`（任务历史）
- 新增前端页面 `/write`：左侧表单 + 右侧双 Tab（流水线视图 / 文章预览）

### 🔧 Changed

- `app/main.py`：版本号 0.2.0 → 0.3.0，新增 write 路由
- `app/models/schemas.py`：新增 `WriteRequest` / `OutlineSection` / `SectionResearch` / `WritingResultResponse`
- `Sidebar`：新增"✍️ 多智能体写作"入口
- `README.md`：功能矩阵更新、Roadmap 多智能体条目标记完成

### 🎯 设计目标

- ✅ 痛点 P2「多智能体协作」：「对复杂任务，能自己分解（如市场竞品分析）→ 自动调用搜索Agent、数据整理Agent、报告撰写Agent」
- ✅ 痛点 P3「操作可视化 / ReAct 推理链条」：前端展示每个 Agent 的运行状态 + 输出内容

---

## [0.2.0] - 2026-08-29

### ✨ Added

- 🛠️ **Function Calling（工具调用）** —— OpenAI 兼容 `tools` 标准，支持多轮工具调用循环
  - 内置 5 个实用工具：`get_current_time` / `calculate` / `web_search` / `query_knowledge` / `read_file`
  - 自动循环最多 3 轮；前端琥珀色折叠卡片可视化

---

## [0.1.0] - 2026-08-29

### ✨ Added

- 🎉 首个 MVP：多模型 + RAG + 联网搜索 + 对话记忆 + 流式输出 + Docker 一键部署
