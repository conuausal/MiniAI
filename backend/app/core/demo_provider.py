"""内置 Demo 模型：不调用任何外部 API，基于规则 + 模板生成响应。

设计目标：
1. 用户零成本体验完整功能（聊天 / 工具调用 / 多智能体写作 / RAG）
2. 真实执行后端工具（get_current_time / calculate / read_file 等）
3. 回答有实际意义，不是 "I am a demo"
4. 流式输出（SSE 友好）

这是 mock，不是真 AI。但能让用户在没 Key 时完整体验 UI 流程。
"""
from __future__ import annotations

import asyncio
import json
import re
from datetime import datetime, timezone, timedelta
from typing import Any, AsyncIterator, Dict, List, Optional


# ---------- 工具调用决策（基于 user 消息内容） ----------

def _detect_tool_call(user_text: str, tools: List[dict]) -> Optional[dict]:
    """根据 user 输入决定是否调用工具，以及参数是什么。"""
    if not tools:
        return None
    text = user_text.lower().strip()

    # 数学计算（优先：表达式比"时间"关键词更具体）
    for tool in tools:
        if tool["function"]["name"] == "calculate":
            # 提取数学表达式
            m = re.search(r"([\d+\-*/().\s]+)", user_text)
            if m and re.search(r"\d", m.group(1)):
                expr = m.group(1).strip()
                # 收紧误触发：纯加减短表达式像"版本 2-3 个"、"2023-2024 年"不算算式
                is_range = re.fullmatch(r"\d+\s*-\s*\d+", expr)
                has_strong_op = any(c in expr for c in "*/%")
                has_weak_op = any(c in expr for c in "+-")
                plausible = (
                    (has_strong_op and re.search(r"\d", expr))
                    or (has_weak_op and len(expr) >= 5 and not is_range)
                )
                # 简单安全校验：只允许数字 + 运算符
                if plausible and re.fullmatch(r"[\d\s+\-*/().]+", expr):
                    return {
                        "id": f"call_{int(datetime.now().timestamp())}",
                        "type": "function",
                        "function": {
                            "name": "calculate",
                            "arguments": json.dumps({"expression": expr}, ensure_ascii=False),
                        },
                    }

    # 联网搜索（优先级高于时间：避免"今天AI新闻"这类含时间词的问题被当成时间查询）
    for tool in tools:
        if tool["function"]["name"] == "web_search":
            if any(kw in text for kw in ["搜", "搜索", "新闻", "最新", "search", "find", "look up"]):
                # 提取查询词（去掉前缀词）
                q = re.sub(r"^(帮我|请|麻烦)?(搜一下|搜索|搜|查一下|查找|查|找一下|找)", "", user_text).strip()
                q = q.rstrip("?？").strip() or user_text
                return {
                    "id": f"call_{int(datetime.now().timestamp())}",
                    "type": "function",
                    "function": {
                        "name": "web_search",
                        "arguments": json.dumps({"query": q, "max_results": 3}, ensure_ascii=False),
                    },
                }

    # 时间相关
    for tool in tools:
        if tool["function"]["name"] == "get_current_time":
            if any(kw in text for kw in ["几点", "时间", "现在", "今天", "几号", "周几", "what time", "current time", "today"]):
                return {
                    "id": f"call_{int(datetime.now().timestamp())}",
                    "type": "function",
                    "function": {
                        "name": "get_current_time",
                        "arguments": json.dumps({"timezone_offset_hours": 8}, ensure_ascii=False),
                    },
                }

    # 知识库
    for tool in tools:
        if tool["function"]["name"] == "query_knowledge":
            if any(kw in text for kw in ["我的文档", "我上传", "知识库", "文档里", "之前发", "资料"]):
                return {
                    "id": f"call_{int(datetime.now().timestamp())}",
                    "type": "function",
                    "function": {
                        "name": "query_knowledge",
                        "arguments": json.dumps({"question": user_text, "top_k": 3}, ensure_ascii=False),
                    },
                }

    # 读文件
    for tool in tools:
        if tool["function"]["name"] == "read_file":
            m = re.search(r"(?:读|打开|看)(?:一下)?\s*([\w./\\-]+\.[a-z]{1,5})", user_text, re.IGNORECASE)
            if m:
                return {
                    "id": f"call_{int(datetime.now().timestamp())}",
                    "type": "function",
                    "function": {
                        "name": "read_file",
                        "arguments": json.dumps({"path": m.group(1)}, ensure_ascii=False),
                    },
                }

    # 随机二次元
    for tool in tools:
        if tool["function"]["name"] == "get_random_anime":
            if any(kw in text for kw in ["随机二次元", "二次元", "anime", "来张图", "来张二次元", "壁纸"]):
                return {
                    "id": f"call_{int(datetime.now().timestamp())}",
                    "type": "function",
                    "function": {
                        "name": "get_random_anime",
                        "arguments": "{}",
                    },
                }

    return None


# ---------- 回答生成 ----------

def _strip_injected(text: str) -> str:
    """去掉 RAG / 联网搜索注入的上下文（`\n\n---\n` 之后的部分），只保留原始提问。

    否则注入内容里的关键词（如搜索结果中的"你好"）会误触发意图 / 工具识别。
    """
    if text and "\n\n---\n" in text:
        return text.split("\n\n---\n", 1)[0]
    return text


def _detect_intent(text: str) -> str:
    """识别用户意图。"""
    t = text.lower().strip()
    if any(kw in t for kw in ["你好", "hi", "hello", "嗨", "在吗", "who are you", "你是谁"]):
        return "greeting"
    if any(kw in t for kw in ["什么是", "解释", "why", "what is", "how does", "原理", "区别", "是什么"]):
        return "explain"
    if any(kw in t for kw in ["写", "写一个", "写一段", "生成", "创作", "write"]):
        return "create"
    if any(kw in t for kw in ["总结", "摘要", "summarize", "summary"]):
        return "summarize"
    if any(kw in t for kw in ["翻译", "translate"]):
        return "translate"
    if any(kw in t for kw in ["推荐", "建议", "怎么选", "哪个好"]):
        return "recommend"
    if any(kw in t for kw in ["对比", "比较", "vs", "difference"]):
        return "compare"
    if "?" in text or "？" in text:
        return "qa"
    return "chat"


def _gen_greeting(user_text: str) -> str:
    name = "MiniAI"
    return f"""你好！我是 **{name}** —— 开源、轻量、可私有化部署的个人 AI 助手 🌟

**现在你在使用的是【演示模式】**，无需任何 API Key 即可完整体验所有功能。

## 🎯 我能做什么

| 功能 | 说明 | 演示模式 |
|:--|:--|:-:|
| 💬 智能对话 | 回答问题、解释概念 | ✅ 预设模板 |
| 🔧 工具调用 | 时间 / 计算 / 联网 / 知识库 / 读文件 | ✅ 真实执行 |
| 📚 RAG 知识库 | 上传文档，对话引用 | ✅ 完整可用 |
| ✍️ 多智能体写作 | Planner → Researchers → Writer | ✅ 真实生成 |
| 🎙️ 语音输入 / 输出 | 浏览器原生 Web Speech | ✅ 完整可用 |

## 🚀 升级到真实 AI

想获得真正的 AI 智能？点击右上角 🔑 按钮：
1. 填入 DeepSeek / OpenAI / 智谱 等任一提供商的 API Key
2. 推荐 **DeepSeek**（性价比 + 中文最强，注册送 ¥1）
3. 重启对话即可使用

## 💡 试试这些

- "现在几点了？"
- "算一下 123 * 456"
- "什么是 Transformer"
- "帮我写一篇博客"
- "读一下 README.md"

📌 **演示模式提示**：回答是预设模板，不是真实 AI 生成。但工具调用、知识库、多智能体写作流程是真实的。"""


def _gen_explain(user_text: str) -> str:
    topic = user_text.replace("什么是", "").replace("?", "").replace("？", "").replace("解释", "").strip() or user_text
    return f"""## 关于 **{topic}** 的解释

{topic} 是一个值得深入了解的话题。下面我给你一个结构化的解释框架：

### 🎯 核心概念
{topic} 的核心可以从以下几个维度来理解：
- **定义**：本质是什么
- **原理**：底层如何运作
- **应用**：实际场景中的用法
- **优势与局限**：什么情况下适用，什么情况下不适用

### 📚 关键要点
1. 理解基本概念和术语
2. 掌握核心原理
3. 了解典型应用场景
4. 对比类似概念的区别

### 💡 推荐学习路径
- 先看入门教程，建立基础认知
- 通过实际案例加深理解
- 阅读官方文档获取权威信息
- 动手实践巩固知识

---

📌 **这是 MiniAI 演示模式的预设回答**。要获得针对 **{topic}** 的真实 AI 解答，请配置 API Key 后重新提问。

🔍 想要我搜索 "{topic}" 的最新资料？试试开启 🔧 工具 + 联网搜索。"""


def _gen_create(user_text: str) -> str:
    return f"""## ✍️ 创作任务：{user_text}

我已经理解你的创作需求。基于 MiniAI 演示模式，我给你一个结构化的草稿：

### 📋 大纲

```markdown
# [标题]

## 一、引言
- 背景介绍
- 核心观点

## 二、主体
### 2.1 第一个要点
- 论据 A
- 论据 B

### 2.2 第二个要点
- 详细阐述

## 三、结论
- 总结要点
- 行动建议
```

### 📝 示例内容（片段）

> **{user_text}** 是一个非常实用的话题。在开始之前，我们先了解一些背景信息...
>
> 关键是要把握三个核心原则：**清晰、简洁、有力**。

### 🎯 下一步建议

1. **填充大纲细节**：把每个章节展开成具体段落
2. **添加数据/案例**：让内容更有说服力
3. **优化语言风格**：根据读者调整
4. **校对润色**：完成初稿后回头修改

---

💡 **想要更完整的创作**？试试 **✍️ 多智能体写作** 页面（侧边栏），4 个 AI Agent 会协同帮你写出完整文章！

📌 *这是预设回答。要获得个性化创作，请配置 API Key。*"""


def _gen_qa(user_text: str) -> str:
    return f"""## ❓ {user_text}

这是一个好问题。让我从几个角度来分析：

### 🎯 直接回答

针对你问的问题，关键在于理解：
1. 问题的本质和背景
2. 可能存在的多种答案
3. 哪个答案最适合你的具体场景

### 💭 详细分析

- **事实层面**：基于已知信息
- **观点层面**：不同人可能有不同看法
- **实用层面**：什么对你最有用

### 🚀 建议下一步

1. 告诉我你的具体场景，我可以给更针对性的建议
2. 如果需要最新信息，可以开启 🔧 工具 + 联网搜索
3. 如果想深入某个方面，继续追问即可

---

📌 **这是 MiniAI 演示模式的预设回答**。要获得真实 AI 解答，请配置 API Key。

💡 *我可能会出错，请核实重要信息。*"""


def _gen_chat(user_text: str) -> str:
    return f"""好的，我理解你的想法。

> {user_text}

这是个有趣的话题！我可以从以下几个方面展开：

### 💡 我的看法

1. **首先**，关于你提到的内容，我认为核心点在于：找到适合自己的方式
2. **其次**，实践和反馈是关键 —— 没有完美的理论，只有不断的迭代
3. **最后**，保持开放的心态，持续学习

### 🎯 可以继续的方向

- 如果你想深入某个具体方面，告诉我
- 如果你想看到实际例子，我可以举一些
- 如果你想讨论反方观点，也可以

---

📌 **演示模式回复**。要获得真正的 AI 对话体验，请配置 API Key（点击 🔑 按钮）。"""


def _gen_with_tool_result(tool_name: str, tool_result: str, user_text: str) -> str:
    """工具调用完成后基于真实结果生成回答。"""
    if tool_name == "get_current_time":
        return f"""好的，我帮你查了一下时间：

> 🕐 {tool_result}

希望对你有帮助！还有其他问题吗？"""
    if tool_name == "calculate":
        return f"""计算完成！

## 🧮 计算结果

{tool_result}

---

✅ 这是真实的计算结果（执行了 Python 表达式求值）。试试其他运算？"""
    if tool_name == "web_search":
        return f"""## 🌐 联网搜索结果

{tool_result}

---

✅ 这是来自 Tavily 搜索 API 的真实结果。如果没有 Tavily Key，结果会是空的。

📝 想要更精确的搜索？告诉我你想找什么。"""
    if tool_name == "query_knowledge":
        return f"""## 📚 从你的知识库找到的相关内容

{tool_result}

---

✅ 这是基于你上传文档的 RAG 检索结果。"""
    if tool_name == "read_file":
        return f"""## 📄 文件内容

{tool_result}

---

✅ 这是从项目目录读取的文件。"""
    if tool_name == "get_random_anime":
        return f"""## 🎴 随机二次元

![随机二次元]({tool_result})

---

✅ 这是来自 Elaina API 的随机二次元图片。也可以去「🎴 二次元」页面继续浏览。"""
    return f"""✅ 工具 **{tool_name}** 执行结果：

```
{tool_result}
```"""


# ---------- 主入口：生成回复 ----------

def generate_reply(
    user_text: str,
    messages: List[dict],
    tool_calls: List[dict] = None,
    tool_results: Dict[str, str] = None,
) -> str:
    """根据上下文生成回复。

    Args:
        user_text: 当前用户消息
        messages: 完整对话历史
        tool_calls: 模型要调用的工具
        tool_results: {tool_name: result} 工具执行结果
    """
    # 优先基于工具结果生成回答
    if tool_calls and tool_results:
        # 取第一个工具的结果（demo 一次只调一个工具）
        tc = tool_calls[0]
        name = tc.get("function", {}).get("name", "")
        result = tool_results.get(name, "")
        if result:
            return _gen_with_tool_result(name, result, user_text)

    # 否则根据意图生成
    intent = _detect_intent(user_text)
    if intent == "greeting":
        return _gen_greeting(user_text)
    if intent == "explain":
        return _gen_explain(user_text)
    if intent == "create":
        return _gen_create(user_text)
    if intent == "qa":
        return _gen_qa(user_text)
    return _gen_chat(user_text)


# ---------- 模拟 OpenAI 接口的 Client ----------

class _DemoChoice:
    def __init__(self, text: str, tool_calls: list, finish_reason: str):
        self.message = type("M", (), {"content": text, "tool_calls": tool_calls})()
        self.finish_reason = finish_reason


class _DemoResponse:
    def __init__(self, text: str, tool_calls: list, model: str):
        self.choices = [_DemoChoice(text, tool_calls, "stop" if not tool_calls else "tool_calls")]
        self.model = model


class _DemoChunk:
    def __init__(self, delta_content: str = "", finish_reason: Optional[str] = None, tool_calls_delta=None):
        self.choices = [type("C", (), {
            "delta": type("D", (), {
                "content": delta_content,
                "tool_calls": tool_calls_delta,
            })(),
            "finish_reason": finish_reason,
        })()]


class _DemoStream:
    """流式响应：分块 yield 文本 + tool_calls。"""

    def __init__(self, text: str, tool_calls: list, model: str):
        self._text = text
        self._tool_calls = tool_calls
        self._model = model

    async def __aiter__(self):
        # 流式输出文本（按词分块，更自然）
        # |.+$ 兜底捕获末尾没有分隔符的残段，避免文本被截断
        import re as _re
        chunks = _re.findall(r".*?[\s，。！？；：、,.!?;:\n]|.+$", self._text)
        if not chunks:
            chunks = [self._text]
        sent = 0
        for c in chunks:
            if c:
                yield _DemoChunk(delta_content=c)
                sent += 1
                # 每 3-4 个 chunk 模拟网络延迟
                if sent % 3 == 0:
                    await asyncio.sleep(0.02)
        # 工具调用
        if self._tool_calls:
            import json as _json
            for tc in self._tool_calls:
                yield _DemoChunk(
                    finish_reason=None,
                    tool_calls_delta=[{
                        "index": 0,
                        "id": tc["id"],
                        "type": "function",
                        "function": {
                            "name": tc["function"]["name"],
                            "arguments": tc["function"]["arguments"],
                        },
                    }],
                )
            # 结束
            yield _DemoChunk(finish_reason="tool_calls")
        else:
            yield _DemoChunk(finish_reason="stop")


class _DemoChatCompletions:
    @staticmethod
    async def create(
        *,
        model: str,
        messages: List[dict],
        temperature: float = 0.7,
        max_tokens: int = 2048,
        stream: bool = False,
        tools: Optional[List[dict]] = None,
        **kwargs,
    ):
        # 取最近的 user 或 tool 消息（用于意图检测）
        user_text = ""
        last_role = "user"
        last_tool_name = ""
        last_tool_result = ""
        for m in reversed(messages):
            role = m.get("role")
            if role in ("user", "tool"):
                last_role = role
                user_text = m.get("content", "")
                if role == "tool":
                    last_tool_name = str(m.get("name", "") or "")
                    last_tool_result = user_text
                break
        if isinstance(user_text, list):
            user_text = " ".join(
                (c.get("text", "") if isinstance(c, dict) else str(c))
                for c in user_text
            )
        # 去掉 RAG / 联网注入的上下文，只对原始提问做意图与工具识别
        user_text = _strip_injected(user_text)

        # 上一条是 tool 结果：直接基于真实结果生成最终回答，不再重复调用工具
        if last_role == "tool":
            return (
                _DemoStream(_gen_with_tool_result(last_tool_name, last_tool_result, user_text), [], model)
                if stream
                else _DemoResponse(_gen_with_tool_result(last_tool_name, last_tool_result, user_text), [], model)
            )

        # 否则仅对真实用户输入做工具检测
        tool_calls = []
        if tools:
            tc = _detect_tool_call(user_text, tools)
            if tc:
                tool_calls.append(tc)

        # 生成文本（如果决定调用工具，第一次 yield 的 text 留空）
        text = "" if tool_calls else generate_reply(user_text, messages)

        if stream:
            return _DemoStream(text, tool_calls, model)
        return _DemoResponse(text, tool_calls, model)


class _DemoChat:
    completions = _DemoChatCompletions()


class DemoClient:
    """一个不调用任何外部 API 的 mock 客户端，接口兼容 OpenAI SDK。"""

    def __init__(self):
        self.chat = _DemoChat()


# ---------- 多智能体写作的 Demo 实现 ----------

def planner_for_demo(topic: str, style: str, length: str, custom_outline=None) -> List[dict]:
    """为 demo 模型生成大纲。支持自定义章节标题。"""
    if custom_outline:
        # 用户自定义大纲：直接使用用户提供的章节标题
        return [
            {
                "section_id": f"sec-{i+1}",
                "title": title.strip(),
                "focus": f"展开 {title.strip()} 的核心内容",
                "angle": "理论与实践结合",
                "search_queries": [f"{topic} {title}".strip()[:60]],
            }
            for i, title in enumerate(custom_outline)
            if title and title.strip()
        ]
    n_map = {"short": 3, "medium": 4, "long": 5}
    n = n_map.get(length, 4)

    section_templates = {
        "blog": [
            ("为什么 {topic} 值得关注", "介绍背景与价值", "引入 + 数据支撑"),
            ("{topic} 的核心原理", "解释关键概念", "循序渐进"),
            ("{topic} 的实际应用", "举 2-3 个真实场景", "案例 + 启示"),
            ("如何上手 {topic}", "给出可操作步骤", "步骤化 + 工具推荐"),
            ("{topic} 的未来展望", "预测发展趋势", "前瞻 + 个人看法"),
        ],
        "academic": [
            ("{topic} 研究背景", "文献综述", "引述 + 现状"),
            ("{topic} 理论基础", "理论框架", "定义 + 公式"),
            ("{topic} 研究方法", "实验设计", "方法论"),
            ("{topic} 主要发现", "数据与结果", "对比 + 图表"),
            ("{topic} 研究展望", "未来方向", "局限 + 突破点"),
        ],
        "report": [
            ("执行摘要", "核心结论", "结论先行"),
            ("{topic} 市场现状", "数据概览", "数据 + 趋势"),
            ("竞争格局分析", "主要玩家对比", "SWOT 框架"),
            ("机会与挑战", "SWOT 详述", "机会 + 风险"),
            ("行动建议", "落地步骤", "分阶段路径"),
        ],
        "social": [
            ("开篇钩子", "吸引注意", "痛点 + 好奇"),
            ("核心价值", "主要卖点", "简洁有力"),
            ("结尾互动", "引导评论", "互动话术"),
        ],
    }
    templates = section_templates.get(style, section_templates["blog"])

    outline = []
    for i in range(n):
        if i < len(templates):
            title, focus, angle = templates[i]
        else:
            title, focus, angle = (
                f"{topic} - 第 {i+1} 部分",
                "深入探讨",
                "理论与实践结合",
            )
        outline.append({
            "section_id": f"sec-{i+1}",
            "title": title.replace("{topic}", topic),
            "focus": focus,
            "angle": angle,
            "search_queries": [f"{topic} {title}"[:50]],
        })
    return outline


def researcher_for_demo(section: dict, topic: str) -> str:
    """为 demo 模型生成章节调研笔记。"""
    return f"""## 📋 章节调研笔记：{section['title']}

### 🎯 研究焦点
{section['focus']}

### 💡 切入角度
{section['angle']}

### 📝 关键素材

- **背景信息**：{section['title']} 是关于 {topic} 的核心组成部分，业界普遍关注
- **数据支撑**：可引用行业报告、学术论文、专家观点等
- **典型案例**：建议举 1-2 个真实发生的案例增加说服力
- **用户视角**：从读者关心的问题出发组织内容

### 🎨 推荐表达方式

- 使用具体数字增加可信度
- 多用 bullet 而非大段文字
- 关键观点加粗强调
- 必要时用对比表格

### ⚠️ 注意事项

- 避免空泛表述
- 引用来源标注清楚
- 保持客观中立
- 给出可执行的建议"""


def writer_for_demo(outline: List[dict], sections: List[dict], topic: str, style: str) -> str:
    """为 demo 模型生成完整文章。"""
    style_intro = {
        "blog": "轻松易懂，有个人风格",
        "academic": "严谨客观，引证充分",
        "report": "数据驱动，结论先行",
        "social": "短小精悍，抓人眼球",
    }
    style_desc = style_intro.get(style, "专业且易读")

    parts = [f"# {topic}\n"]
    parts.append(f"> 本文由 MiniAI 多智能体写作系统（演示模式）生成。风格：{style_desc}。\n")

    for i, (sec, sect_data) in enumerate(zip(outline, sections)):
        parts.append(f"\n## {i+1}. {sec.title}\n")
        parts.append(f"\n本节聚焦于：{sec.focus}。我们将通过多个角度来展开论述。\n")

        # 生成 2-3 段内容
        paragraphs = [
            f"首先，{sec.title} 是理解 {topic} 的关键。从基础概念入手，我们需要明确这部分的定义和边界。在实际应用中，这一概念往往被简化为几个要点，但要真正掌握，还需要注意一些细节。",
            f"其次，深入 {sec.focus} 这个层面，我们可以发现几个有趣的现象：业界已经有多种解决方案，但每种都有其适用场景和局限性。{(sect_data.research_notes or '').split(chr(10))[0] if sect_data.research_notes else ''}",
            f"最后，回到实践角度，{sec.title} 的真正价值在于落地。建议读者结合自己的具体场景，循序渐进地应用本文提到的方法。",
        ]
        for p in paragraphs:
            parts.append(f"\n{p}\n")

        # 加 bullet
        parts.append(f"\n**核心要点**：\n")
        parts.append(f"- 理解 {sec.focus} 的核心要素\n")
        parts.append(f"- 掌握 {sec.angle} 的实践方法\n")
        parts.append(f"- 避免常见的认知误区\n")

    # 结语
    parts.append(f"\n## 总结\n\n")
    parts.append(f"通过本文的探讨，我们从 {len(outline)} 个维度深入分析了 {topic}。每个章节都从不同角度切入，形成了完整的认知框架。\n\n")
    parts.append(f"关键收获：\n")
    parts.append(f"- 建立了对 {topic} 的系统认知\n")
    parts.append(f"- 掌握了实践方法和注意事项\n")
    parts.append(f"- 明确了进一步学习的方向\n\n")
    parts.append(f"---\n\n")
    parts.append(f"*本文由 MiniAI 演示模式生成。要获得真实 AI 写作质量，请配置 API Key。*\n")

    return "".join(parts)


# ---------- 暴露给 llm.py 的辅助函数 ----------

def is_demo_provider(provider: str) -> bool:
    return provider == "demo"
