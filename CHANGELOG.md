# Changelog

所有显著变更都会记录在此文件。版本遵循 [Semantic Versioning](https://semver.org/)。

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

### 📝 Notes

- 默认推荐使用 DeepSeek 作为入门模型（性价比 + 中文能力强）
- Embedding 模型 `BAAI/bge-small-zh-v1.5` 首次启动自动下载（约 90 MB）
- 下个版本（0.2.0）计划：Function Calling / 多智能体 / 语音交互
