# Changelog

所有显著变更都会记录在此文件。版本遵循 [Semantic Versioning](https://semver.org/)。

## [0.7.0] - 2026-08-30

### ✨ Added — Apple Liquid Glass 设计语言

参考 Apple WWDC 2025 Liquid Glass 设计语言全面重做视觉系统：

- **设计令牌完全重写**：
  - 8 种鲜艳渐变：`bg-hero`（粉→紫→蓝）/ `bg-aurora` / `bg-sunset` / `bg-ocean` / `bg-magic`（紫）/ `bg-fire`（橙→红）等
  - 6 种彩色玻璃卡：`.glass-pink` / `.glass-cyan` / `.glass-purple` / `.glass-orange` / `.glass-red` / `.glass-blue`，每张都自带彩色发光阴影
  - 多层玻璃工具类：`.glass` / `.glass-strong` / `.glass-card`（hover 自动 lift+放大）
  - 三色发光阴影：`shadow-glow-blue` / `shadow-glow-pink` / `shadow-glow-purple`
- **Topbar 重做**：
  - 渐变 Logo 方块 + `text-hero` 渐变文字（粉→紫→蓝）
  - 顶栏底加 1px 渐变细线 + 8s 流动动画
  - 顶部按钮彩色化（语音输入紫、语音输出粉、key 琥珀）
- **主界面 Hero**：
  - "Liquid AI / for everyone" 巨型衬线标题（带 aurora 渐变）
  - 4 张彩色玻璃建议卡（紫/粉/青/橙），hover 上浮放大
  - 5 个能力徽章（薄荷/紫/青/橙/粉）
- **消息气泡**：用户消息用 `bg-hero` 渐变 + 发光阴影
- **多智能体写作页**：
  - 5 个 Agent 卡片每张配独立渐变色 + 图标（Planner 紫、Researcher 蓝/青/绿、Writer 粉红）
  - 进度条用 `bg-aurora` + 8s 流动动画
  - 表单选中态用主色 + 紫色双重强调
- **知识库**：
  - 拖拽区 hover 时边框变主色 + 缩放动画
  - 文档卡 5 色循环渐变背景
  - 相似度徽章用主→紫渐变
- **设置页**：
  - 3 张 StatCard 渐变背景（绿/主色紫/橙）
  - 模型启用态用 emerald 渐变；工具卡用琥珀渐变
- **新动画**：`animate-aurora`（8s 背景流动）/ `animate-float`（4s 浮动）
- **噪点纹理**：`.noise` 类为玻璃增加微观质感（SVG inline data）

### 🔧 Changed

- `frontend/app/globals.css`：完全重写设计系统
- `frontend/tailwind.config.js`：扩展颜色 / 字体 / 阴影
- 所有页面组件都改用玻璃 + 渐变工具类

---

## [0.6.0] - 2026-08-30

### ✨ Added

- 语音输入（Web SpeechRecognition）+ 语音输出（SpeechSynthesis）

## [0.5.0] - 2026-08-30

### ✨ Added

- 25 个内置模型（7 provider）+ 自定义 OpenAI 兼容服务

## [0.4.0] - 2026-08-29

### ✨ Added

- 多租户 API Key + UI 设计系统 v1 + 暗色模式

## [0.3.0] - 2026-08-29

### ✨ Added

- 多智能体写作

## [0.2.0] - 2026-08-29

### ✨ Added

- Function Calling（5 个内置工具）

## [0.1.0] - 2026-08-29

### ✨ Added

- MVP：多模型 + RAG + 联网搜索 + 对话记忆
