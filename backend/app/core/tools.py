"""工具注册表：内置若干实用工具，统一以 OpenAI tools schema 暴露给 LLM。

调用流程：
  LLM 看到 tools -> 决定调用哪个 -> 返回 tool_calls
  -> 我们根据 name 找到实现 -> 执行 -> 把结果以 role=tool 回填 -> LLM 再生成

每个工具有：
  schema : OpenAI tools 格式（type/function/name/description/parameters）
  run    : async def run(**kwargs) -> str  返回给 LLM 的字符串结果
"""
from __future__ import annotations

import ast
import asyncio
import operator
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, List

from loguru import logger

from app.config import settings


# ============== 工具实现 ==============

async def get_current_time(timezone_offset_hours: float = 8.0) -> str:
    """获取当前时间（默认 UTC+8 中国时区）。"""
    from datetime import timezone, timedelta

    tz = timezone(timedelta(hours=timezone_offset_hours))
    now = datetime.now(tz)
    weekdays = ["一", "二", "三", "四", "五", "六", "日"]
    return (
        f"当前时间：{now.strftime('%Y-%m-%d %H:%M:%S')} (UTC{timezone_offset_hours:+.0f})\n"
        f"星期{weekdays[now.weekday()]}\n"
        f"ISO: {now.isoformat()}"
    )


# 安全的算术运算（不允许访问任何 Python 内建）
_BIN_OPS: Dict[type, Any] = {
    ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
    ast.Div: operator.truediv, ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod, ast.Pow: operator.pow,
}
_UNARY_OPS: Dict[type, Any] = {ast.UAdd: operator.pos, ast.USub: operator.neg}


def _safe_eval(expr: str) -> float:
    """受限的算术表达式求值：只允许数字、四则运算、括号。"""
    tree = ast.parse(expr, mode="eval")

    def _eval(node: ast.AST) -> float:
        if isinstance(node, ast.Expression):
            return _eval(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return float(node.value)
        if isinstance(node, ast.BinOp) and type(node.op) in _BIN_OPS:
            return _BIN_OPS[type(node.op)](_eval(node.left), _eval(node.right))
        if isinstance(node, ast.UnaryOp) and type(node.op) in _UNARY_OPS:
            return _UNARY_OPS[type(node.op)](_eval(node.operand))
        raise ValueError(f"不支持的表达式节点: {type(node).__name__}")

    return _eval(tree)


async def calculate(expression: str) -> str:
    """计算数学表达式，支持 + - * / // % ** 括号。"""
    try:
        expr = expression.strip()
        if not expr or len(expr) > 200:
            return "错误：表达式为空或过长（>200 字符）"
        # 只允许数字、运算符、括号、小数点、空格
        if not re.fullmatch(r"[\d\s+\-*/().%]+", expr):
            return "错误：表达式包含非法字符，仅支持数字与四则运算"
        value = _safe_eval(expr)
        # 整数就不显示小数
        if value.is_integer():
            return f"{expression} = {int(value)}"
        return f"{expression} = {value:.6f}".rstrip("0").rstrip(".")
    except Exception as e:
        return f"计算失败: {e}"


# 受允许的读文件根目录（防止路径穿越）
_ALLOWED_READ_ROOTS = [
    Path.cwd(),
    Path.cwd() / "data" / "uploads",
    Path(settings.vector_store_dir).parent / "uploads",
]


def _safe_resolve(path_str: str) -> Path:
    """解析路径并校验其在白名单内。"""
    p = Path(path_str).expanduser().resolve()
    for root in _ALLOWED_READ_ROOTS:
        try:
            p.relative_to(root.resolve())
            return p
        except ValueError:
            continue
    raise PermissionError(f"路径不被允许: {path_str}")


async def read_file(path: str, max_chars: int = 8000) -> str:
    """读取文本文件（仅允许项目目录与上传目录），截断到 max_chars。"""
    try:
        p = _safe_resolve(path)
    except PermissionError as e:
        return f"错误：{e}"
    if not p.exists() or not p.is_file():
        return f"错误：文件不存在 {path}"
    suffix = p.suffix.lower()
    if suffix in {".pdf", ".docx"}:
        return f"提示：{suffix} 是二进制文档，请先用 query_knowledge 工具检索其内容。"
    try:
        content = p.read_text(encoding="utf-8", errors="ignore")
    except Exception as e:
        return f"读取失败: {e}"
    truncated = len(content) > max_chars
    head = content[:max_chars]
    return f"文件: {p}\n大小: {len(content)} 字符\n{truncated and '(已截断到前 ' + str(max_chars) + ' 字符)' or ''}\n\n{head}"


async def web_search_tool(query: str, max_results: int = 5) -> str:
    """联网搜索工具（包装 core.web_search）。"""
    from app.core.web_search import format_for_prompt, web_search

    results = await web_search(query, max_results=min(max_results, 10))
    if not results:
        return "未找到相关结果（可能未配置 TAVILY_API_KEY）。"
    return format_for_prompt(results)


async def query_knowledge_tool(
    question: str,
    top_k: int = 4,
    collection: str = "default",
) -> str:
    """RAG 检索工具：从指定集合召回相关片段。"""
    from app.core.rag import rag_engine

    chunks = await rag_engine.query(question, top_k=top_k, collection=collection)
    if not chunks:
        return f"知识库 ({collection}) 中未找到相关内容。"
    blocks = []
    for i, c in enumerate(chunks, 1):
        blocks.append(f"[{i}] {c['content']}\n来源: {c['source']} (相关度 {c.get('score', 0):.2f})")
    return "\n\n".join(blocks)


# ============== 注册表 ==============

ToolRun = Callable[..., Awaitable[str]]


class _Tool:
    def __init__(self, name: str, description: str, parameters: dict, run: ToolRun) -> None:
        self.name = name
        self.description = description
        self.parameters = parameters
        self.run = run

    def to_schema(self) -> dict:
        """生成 OpenAI tools schema。"""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


_REGISTRY: Dict[str, _Tool] = {}


def _register(name: str, description: str, parameters: dict, run: ToolRun) -> None:
    _REGISTRY[name] = _Tool(name, description, parameters, run)


# ---- 注册所有内置工具 ----

_register(
    name="get_current_time",
    description="获取当前日期与时间（默认 UTC+8 中国时区）。当用户问'现在几点'、'今天几号'、'周几'时调用。",
    parameters={
        "type": "object",
        "properties": {
            "timezone_offset_hours": {
                "type": "number",
                "description": "时区偏移（小时），例如 8 表示 UTC+8，0 表示 UTC。默认 8。",
                "default": 8.0,
            }
        },
    },
    run=get_current_time,
)

_register(
    name="calculate",
    description="计算数学表达式。仅支持四则运算 + - * / // % 与括号。常用于'xxx 加 xx 是多少'、'算一下'。",
    parameters={
        "type": "object",
        "properties": {
            "expression": {
                "type": "string",
                "description": "数学表达式，如 '(3+5)*2' 或 '100/3'",
            }
        },
        "required": ["expression"],
    },
    run=calculate,
)

_register(
    name="web_search",
    description="实时联网搜索。当问题涉及最新新闻、实时数据、训练数据之外的信息时调用。",
    parameters={
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "搜索关键词或问题"},
            "max_results": {"type": "integer", "description": "返回条数，1-10，默认 5"},
        },
        "required": ["query"],
    },
    run=web_search_tool,
)

_register(
    name="query_knowledge",
    description="从本地知识库检索相关片段（基于上传的 PDF/文档）。当用户引用'我上传的'、'之前的资料'或问与上传内容相关的问题时调用。",
    parameters={
        "type": "object",
        "properties": {
            "question": {"type": "string", "description": "检索问题"},
            "top_k": {"type": "integer", "description": "返回片段数，默认 4"},
            "collection": {"type": "string", "description": "知识库集合名，默认 'default'"},
        },
        "required": ["question"],
    },
    run=query_knowledge_tool,
)

_register(
    name="read_file",
    description="读取本地文本文件（限项目目录与上传目录）。文件不存在或越权会返回错误。",
    parameters={
        "type": "object",
        "properties": {
            "path": {"type": "string", "description": "相对或绝对路径"},
            "max_chars": {"type": "integer", "description": "最多返回多少字符，默认 8000"},
        },
        "required": ["path"],
    },
    run=read_file,
)


# ============== 对外 API ==============

def list_tools() -> List[dict]:
    """返回所有工具的 OpenAI schema 列表。"""
    return [t.to_schema() for t in _REGISTRY.values()]


def get_tool_names() -> List[str]:
    return list(_REGISTRY.keys())


async def execute_tool(name: str, arguments: Dict[str, Any]) -> str:
    """执行指定工具，返回字符串结果。"""
    tool = _REGISTRY.get(name)
    if not tool:
        return f"错误：未知工具 {name}"
    try:
        # 过滤掉模型可能传入的非法键
        valid_keys = set(tool.parameters.get("properties", {}).keys())
        clean_args = {k: v for k, v in (arguments or {}).items() if k in valid_keys}
        return await tool.run(**clean_args)
    except Exception as e:
        logger.exception("工具 {name} 执行失败", name=name)
        return f"工具执行出错: {type(e).__name__}: {e}"
