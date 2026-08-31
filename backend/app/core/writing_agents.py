"""多智能体写作：Planner → 并行 Researchers → Writer。

每个 Agent 都是一次独立的 LLM 调用 + （可选）RAG/联网搜索。
通过 asyncio.gather 让多个 Researcher 并行执行，最后 Writer 整合。
"""
from __future__ import annotations
from types import SimpleNamespace

import asyncio
import json
import re
from dataclasses import dataclass, field
from typing import AsyncIterator, List, Optional

from loguru import logger

from app.core.llm import chat_once, MODEL_REGISTRY
from app.core.rag import rag_engine
from app.core.web_search import format_for_prompt, web_search
from app.core.demo_provider import planner_for_demo, researcher_for_demo, writer_for_demo


# ============== 数据结构 ==============

@dataclass
class OutlineItem:
    section_id: str
    title: str           # 章节标题
    focus: str           # 章节研究焦点（一句话）
    angle: str = ""      # 推荐切入角度
    search_queries: List[str] = field(default_factory=list)


@dataclass
class SectionDraft:
    section_id: str
    title: str
    research_notes: str   # 调研得到的原始材料
    draft: str            # 撰写的章节初稿
    sources: List[str] = field(default_factory=list)  # 来源链接/文档


@dataclass
class WritingResult:
    topic: str
    style: str
    length: str
    outline: List[OutlineItem]
    sections: List[SectionDraft]
    article_md: str        # 最终文章 Markdown
    word_count: int = 0


# ============== 风格 / 长度预设 ==============

STYLE_GUIDES = {
    "blog": (
        "博客文章风格。语气轻松、个人化，可以使用比喻和小标题。"
        "段落短，多用列表，避免学术腔。读者画像：技术爱好者。"
    ),
    "academic": (
        "学术综述风格。客观严谨、引述充分、结构清晰。"
        "使用专业术语，每段开头点明论点，必要时给出参考文献占位符 [n]。"
    ),
    "report": (
        "商业报告风格。结论先行、要点清晰、数据驱动。"
        "多用 bullet、表格，章节标题用'一、二、三'或编号。读者：决策者。"
    ),
    "social": (
        "社交媒体短文风格。开头抓眼球，多用 emoji 与短句，"
        "鼓励互动。控制在 400 字以内。"
    ),
}

LENGTH_GUIDES = {
    "short": ("约 800-1200 字，2-3 个章节", 3),
    "medium": ("约 1500-2500 字，4-5 个章节", 4),
    "long": ("约 3000-4500 字，6-7 个章节", 6),
}


# ============== 1. Planner Agent ==============

PLANNER_SYSTEM = """你是一位资深的写作主编。根据用户的写作主题，输出一份结构化大纲。

要求：
1. 先理解主题的核心问题与读者画像。
2. 设计 N 个章节，每个章节聚焦一个明确的子主题，不要重复。
3. 每个章节给出：title（章节标题）、focus（一句话说明本章要回答的核心问题）、angle（建议的切入角度）。
4. 章节之间要有逻辑递进，不要平行罗列。
5. 必须以严格 JSON 格式输出，不要任何额外文字。

输出格式（仅 JSON）：
{
  "thinking": "（一句话总结你的整体思路）",
  "sections": [
    {"title": "...", "focus": "...", "angle": "...", "search_queries": ["query1", "query2"]},
    ...
  ]
}"""


async def planner_agent(
    topic: str,
    style: str,
    length: str,
    custom_outline: Optional[List[str]] = None,
    *,
    model: str = "deepseek-chat",
    user_keys: Optional[dict] = None,
    custom_providers: Optional[dict] = None,
) -> List[OutlineItem]:
    """Planner：拆解主题为大纲。"""
    style_desc = STYLE_GUIDES.get(style, STYLE_GUIDES["blog"])
    length_desc, default_n = LENGTH_GUIDES.get(length, LENGTH_GUIDES["medium"])

    user_prompt_parts = [
        f"主题：{topic}",
        f"风格：{style_desc}",
        f"长度：{length_desc}",
    ]
    if custom_outline:
        user_prompt_parts.append(f"\n用户已经预设了章节标题，请基于此扩展：\n- " + "\n- ".join(custom_outline))
    else:
        user_prompt_parts.append(f"\n请设计约 {default_n} 个章节。")

    user_prompt = "\n".join(user_prompt_parts)

    # Demo 模型走专用路径
    if model in MODEL_REGISTRY and MODEL_REGISTRY[model].get("provider") == "demo":
        outline_items = planner_for_demo(topic, style, length, custom_outline=custom_outline)
        return [
            SimpleNamespace(
                section_id=f"sec-{i+1}",
                title=o["title"],
                focus=o["focus"],
                angle=o["angle"],
                search_queries=o.get("search_queries", []),
            ) for i, o in enumerate(outline_items)
        ]

    result = await chat_once(
        model=model,
        messages=[
            {"role": "system", "content": PLANNER_SYSTEM},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.6,
        max_tokens=3000,
        user_keys=user_keys,
        custom_providers=custom_providers,
    )
    raw = result["text"] if isinstance(result, dict) else result
    return _parse_outline(raw, fallback_topic=topic, length=length)


def _parse_outline(raw: str, fallback_topic: str, length: str) -> List[OutlineItem]:
    """从 LLM 输出中提取 JSON 大纲，失败则给出一个保底结构。"""
    # 尝试提取 ```json ... ``` 代码块
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    if m:
        candidate = m.group(1)
    else:
        # 抓第一个 {...}
        m2 = re.search(r"\{.*\}", raw, re.DOTALL)
        candidate = m2.group(0) if m2 else raw

    try:
        data = json.loads(candidate)
        items = []
        for i, sec in enumerate(data.get("sections", [])):
            items.append(
                OutlineItem(
                    section_id=f"sec-{i+1}",
                    title=str(sec.get("title", f"第{i+1}章")).strip(),
                    focus=str(sec.get("focus", "")).strip(),
                    angle=str(sec.get("angle", "")).strip(),
                    search_queries=list(sec.get("search_queries") or []),
                )
            )
        if items:
            return items
    except Exception as e:
        logger.warning("Planner JSON 解析失败: {}\n原始输出:\n{}", e, raw[:300])

    # 截断 JSON 抢救：max_tokens 截断的大纲往往在 sections 数组中间断掉，
    # 逐个提取已完整的扁平 section 对象（{...} 内无嵌套花括号）尽量挽救
    salvaged: List[OutlineItem] = []
    for i, sec_m in enumerate(re.finditer(r"\{[^{}]*\}", candidate)):
        try:
            sec = json.loads(sec_m.group(0))
            title = str(sec.get("title", "")).strip()
            if not title:
                continue
            salvaged.append(
                OutlineItem(
                    section_id=f"sec-{len(salvaged)+1}",
                    title=title,
                    focus=str(sec.get("focus", "")).strip(),
                    angle=str(sec.get("angle", "")).strip(),
                    search_queries=list(sec.get("search_queries") or []),
                )
            )
        except Exception:
            continue
    if salvaged:
        logger.warning("Planner JSON 截断，已抢救出 {} 个章节", len(salvaged))
        return salvaged

    # 保底：根据 length 生成默认章节
    _, default_n = LENGTH_GUIDES.get(length, LENGTH_GUIDES["medium"])
    return [
        OutlineItem(
            section_id=f"sec-{i+1}",
            title=f"{fallback_topic} - 第 {i+1} 部分",
            focus="围绕主题展开论述",
            angle="理论与实践结合",
            search_queries=[fallback_topic],
        )
        for i in range(default_n)
    ]


# ============== 2. Researcher Agent ==============

RESEARCHER_SYSTEM = """你是一位资料调研员。基于给定章节的研究焦点，结合上下文素材，输出该章节的'调研笔记'。

要求：
1. 提炼 5-10 个关键事实 / 观点 / 数据点。
2. 引用素材时保留来源标注（[来源: xxx]）。
3. 若素材不足，明确指出哪些点需要进一步研究。
4. 用 Markdown bullet 列表，结构清晰，便于后续撰稿 Agent 直接引用。
5. 不要写完整的文章段落，只输出素材笔记。"""


async def researcher_agent(
    item: OutlineItem,
    topic: str,
    *,
    model: str,
    enable_rag: bool,
    enable_search: bool,
    collection: str = "default",
    user_keys: Optional[dict] = None,
    custom_providers: Optional[dict] = None,
    user_id: int = 0,
) -> SectionDraft:
    """Researcher：为单个章节收集素材。"""
    # 1) 收集素材：RAG + 联网
    materials: List[str] = []
    sources: List[str] = []

    queries = item.search_queries or [f"{topic} {item.title}", f"{item.focus}"]
    primary_query = queries[0]

    if enable_rag:
        try:
            chunks = await rag_engine.query(primary_query, top_k=4, collection=collection, user_id=user_id)
            if chunks:
                block = "\n\n".join(
                    f"- {c['content']}\n  [来源: {c['source']}, 相关度 {c.get('score', 0):.2f}]"
                    for c in chunks
                )
                materials.append(f"## 来自本地知识库\n{block}")
                sources.extend({c["source"] for c in chunks})
        except Exception as e:
            logger.warning("RAG 检索失败: {}", e)

    if enable_search:
        try:
            results = await web_search(primary_query, max_results=5)
            if results:
                materials.append(f"## 来自联网搜索\n{format_for_prompt(results)}")
                sources.extend(r["url"] for r in results if r.get("url"))
        except Exception as e:
            logger.warning("联网搜索失败: {}", e)

    if not materials:
        materials.append("（未获取到外部素材，请基于通识展开。）")

    # 2) 让 LLM 整理为调研笔记
    user_prompt = f"""主题：{topic}
章节标题：{item.title}
研究焦点：{item.focus}
切入角度：{item.angle or '自由发挥'}

【可用素材】
{chr(10).join(materials)}

请基于以上素材，输出本章节的调研笔记（bullet 列表）。"""

    # Demo 模型
    if model in MODEL_REGISTRY and MODEL_REGISTRY[model].get("provider") == "demo":
        notes_text = researcher_for_demo({
            "title": item.title,
            "focus": item.focus,
            "angle": item.angle,
        }, topic)
        return SectionDraft(
            section_id=item.section_id,
            title=item.title,
            research_notes=notes_text,
            draft="",
            sources=[],
        )

    result = await chat_once(
        model=model,
        messages=[
            {"role": "system", "content": RESEARCHER_SYSTEM},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.4,
        max_tokens=1500,
        user_keys=user_keys,
        custom_providers=custom_providers,
    )
    notes = result["text"] if isinstance(result, dict) else result

    return SectionDraft(
        section_id=item.section_id,
        title=item.title,
        research_notes=notes,
        draft="",
        sources=sources,
    )


# ============== 3. Writer Agent ==============

WRITER_SYSTEM = """你是一位资深撰稿人。基于'章节大纲 + 各章节调研笔记'，撰写一篇完整的高质量文章。

要求：
1. 严格遵守指定风格（语气、结构、用词）。
2. 章节顺序与大纲一致；每章节用 ## 标题。
3. 引用素材时保留 [来源: xxx] 标记。
4. 全文用 Markdown，首段不要直接放标题（标题单独 #）。
5. 在文章末尾生成 "## 参考资料" 小节，列出所有来源链接。
6. 不要任何"我将..."、"让我..."的过程性语言，直接输出文章正文。"""


async def writer_agent(
    topic: str,
    style: str,
    length: str,
    outline: List[OutlineItem],
    sections: List[SectionDraft],
    *,
    model: str,
    user_keys: Optional[dict] = None,
    custom_providers: Optional[dict] = None,
) -> str:
    """Writer：综合所有章节素材，输出最终文章。"""
    style_desc = STYLE_GUIDES.get(style, STYLE_GUIDES["blog"])
    length_desc, _ = LENGTH_GUIDES.get(length, LENGTH_GUIDES["medium"])

    outline_text = "\n".join(f"{i+1}. **{o.title}** — {o.focus}" for i, o in enumerate(outline))

    notes_text_parts = []
    for o, s in zip(outline, sections):
        notes_text_parts.append(
            f"### {o.title}\n\n研究焦点：{o.focus}\n\n调研笔记：\n{s.research_notes}\n"
        )
    notes_text = "\n---\n\n".join(notes_text_parts)

    sources_all: List[str] = []
    seen = set()
    for s in sections:
        for src in s.sources:
            if src and src not in seen:
                seen.add(src)
                sources_all.append(src)
    sources_text = "\n".join(f"- {src}" for src in sources_all) or "（无外部来源）"

    user_prompt = f"""主题：{topic}
风格：{style_desc}
长度：{length_desc}

## 大纲
{outline_text}

## 各章节调研笔记
{notes_text}

## 已收集的来源清单
{sources_text}

请撰写完整文章。"""

    # Demo 模型
    if model in MODEL_REGISTRY and MODEL_REGISTRY[model].get("provider") == "demo":
        return writer_for_demo(outline, sections, topic, style)

    result = await chat_once(
        model=model,
        messages=[
            {"role": "system", "content": WRITER_SYSTEM},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.7,
        max_tokens=4000,
        user_keys=user_keys,
        custom_providers=custom_providers,
    )
    article = result["text"] if isinstance(result, dict) else result
    return article


# ============== 编排器 ==============

async def run_writing_pipeline(
    topic: str,
    *,
    style: str = "blog",
    length: str = "medium",
    model: str = "deepseek-chat",
    custom_outline: Optional[List[str]] = None,
    enable_rag: bool = False,
    enable_search: bool = False,
    collection: str = "default",
    user_keys: Optional[dict] = None,
    custom_providers: Optional[dict] = None,
    user_id: int = 0,
    emit: Optional[AsyncIterator] = None,
    send: Optional[callable] = None,
) -> WritingResult:
    """完整的多智能体写作流水线。

    emit 优先：调用方传入 async generator / sink，用于 SSE 推送。
    send 是兼容旧 (queue.put) 风格接口的别名。
    """
    # ---- Planner ----
    if send:
        send({"event": "planner_start", "topic": topic, "style": style, "length": length})
    outline = await planner_agent(
        topic=topic, style=style, length=length,
        custom_outline=custom_outline, model=model,
        user_keys=user_keys, custom_providers=custom_providers,
    )
    if send:
        send({
            "event": "planner_done",
            "outline": [o.__dict__ for o in outline],
        })

    # ---- 并行 Researchers ----
    if send:
        send({"event": "researchers_start", "count": len(outline)})
    tasks = [
        researcher_agent(
            item=item, topic=topic, model=model,
            enable_rag=enable_rag, enable_search=enable_search, collection=collection,
            user_keys=user_keys, custom_providers=custom_providers, user_id=user_id,
        )
        for item in outline
    ]
    sections: List[SectionDraft] = await asyncio.gather(*tasks, return_exceptions=False)
    if send:
        send({
            "event": "researchers_done",
            "sections": [
                {"section_id": s.section_id, "title": s.title, "notes": s.research_notes, "sources": s.sources}
                for s in sections
            ],
        })

    # ---- Writer ----
    if send:
        send({"event": "writer_start"})
    article_md = await writer_agent(
        topic=topic, style=style, length=length,
        outline=outline, sections=sections, model=model,
        user_keys=user_keys, custom_providers=custom_providers,
    )
    if send:
        send({"event": "writer_done", "article": article_md, "word_count": len(article_md)})

    return WritingResult(
        topic=topic, style=style, length=length,
        outline=outline, sections=sections, article_md=article_md,
        word_count=len(article_md),
    )
