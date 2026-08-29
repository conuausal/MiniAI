"""Pydantic 请求/响应 schema。"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


# ============== Models ==============

class ModelInfo(BaseModel):
    id: str
    label: str
    provider: str
    enabled: bool


class ModelListResponse(BaseModel):
    models: List[ModelInfo]


# ============== Chat ==============

class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant", "tool"]
    content: str
    name: Optional[str] = None
    tool_calls: Optional[List[Dict[str, Any]]] = None
    tool_call_id: Optional[str] = None


class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    model: str = "deepseek-chat"
    messages: List[ChatMessage]
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=2048, ge=1, le=32000)
    enable_rag: bool = False
    enable_search: bool = False
    enable_tools: bool = False
    stream: bool = True


class SessionInfo(BaseModel):
    id: str
    title: str
    model: str
    created_at: datetime
    updated_at: datetime


class SessionCreate(BaseModel):
    title: Optional[str] = "新对话"
    model: Optional[str] = "deepseek-chat"


class SessionDetail(SessionInfo):
    messages: List[Dict[str, Any]]


# ============== Knowledge ==============

class KnowledgeDocInfo(BaseModel):
    id: str
    name: str
    source: str
    chunks: int
    collection: str
    created_at: datetime


class KnowledgeQueryRequest(BaseModel):
    question: str
    top_k: int = Field(default=4, ge=1, le=20)
    collection: str = "default"


class KnowledgeQueryResponse(BaseModel):
    question: str
    contexts: List[Dict[str, Any]]
    answer: Optional[str] = None


# ============== Tools ==============

class ToolInfo(BaseModel):
    name: str
    description: str
    parameters: Dict[str, Any]


class ToolListResponse(BaseModel):
    tools: List[ToolInfo]


# ============== Multi-Agent Writing ==============

class WriteRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=300, description="写作主题")
    style: Literal["blog", "academic", "report", "social"] = "blog"
    length: Literal["short", "medium", "long"] = "medium"
    outline: Optional[List[str]] = Field(default=None, description="可选的自定义章节标题")
    model: str = "deepseek-chat"
    enable_rag: bool = False
    enable_search: bool = False
    collection: str = "default"


class OutlineSection(BaseModel):
    section_id: str
    title: str
    focus: str
    angle: str = ""
    search_queries: List[str] = []


class SectionResearch(BaseModel):
    section_id: str
    title: str
    notes: str
    sources: List[str] = []


class WritingResultResponse(BaseModel):
    topic: str
    style: str
    length: str
    word_count: int
    outline: List[OutlineSection]
    sections: List[SectionResearch]
    article_md: str
