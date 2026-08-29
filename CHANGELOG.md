# Changelog

所有显著变更都会记录在此文件。版本遵循 [Semantic Versioning](https://semver.org/)。

## [0.6.0] - 2026-08-30

### ✨ Added — 语音交互

- **🎙️ 语音输入（STT）**：基于浏览器原生 `SpeechRecognition`
  - 输入框左侧加麦克风按钮，点击开始录音
  - 录音中浮层实时显示识别中间结果
  - 自动停止后文字直接填入并发送（或填到输入框让你确认）
  - 兼容 Chrome / Edge（推荐），Safari 部分支持，Firefox 不支持
- **🔊 语音输出（TTS）**：基于浏览器原生 `SpeechSynthesis`
  - 顶部 🔊/🔇 开关控制是否自动朗读助手回复
  - 自动清理 Markdown 符号（`**` / `#` / 代码块）
  - 中文音色支持，语速 1.05x
  - 用户开始新对话时自动停掉上一段朗读
- **零成本**：完全使用浏览器 API，无需后端 Whisper / TTS
- **顶部双开关**：🎙️ 语音输入开关 + 🔊 语音输出开关，独立控制

### 📝 已知限制

- STT 准确率依赖浏览器（Chrome/Edge 中文识别好）
- 不支持 Firefox STT（TTS 仍可用）
- 首次使用需用户授权麦克风权限
- 不适合嘈杂环境（无降噪）

### 🔧 Changed

- `frontend/lib/voice.ts`：新增（STT/TTS 封装 + 能力检测）
- `frontend/lib/store.ts`：增加 `enableVoiceInput` / `enableVoiceOutput`
- `frontend/components/VoiceInputButton.tsx`：新增（录音按钮 + 浮层）
- `frontend/components/Topbar.tsx`：增加 🔊/🎙️ 开关按钮
- `frontend/components/ChatWindow.tsx`：集成语音按钮 + 自动 TTS

---

## [0.5.0] - 2026-08-30

### ✨ Added

- 25 个内置模型（7 个 provider）+ 自定义 OpenAI 兼容服务

## [0.4.0] - 2026-08-29

### ✨ Added

- 多租户 API Key + 全新 UI 设计系统 + 暗色模式

## [0.3.0] - 2026-08-29

### ✨ Added

- 多智能体写作

## [0.2.0] - 2026-08-29

### ✨ Added

- Function Calling（5 个内置工具）

## [0.1.0] - 2026-08-29

### ✨ Added

- MVP：多模型 + RAG + 联网搜索 + 对话记忆
