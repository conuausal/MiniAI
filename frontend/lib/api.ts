/** 与后端交互的客户端封装。 */

const BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: Role;
  content: string;
  name?: string | null;
  tool_calls?: any[] | null;
  tool_call_id?: string | null;
  thinking?: string | null; // 思考过程（推理模型 / demo 合成），仅 assistant 消息
}

export interface UserPreferences {
  system_prompt: string;
  custom_tools: Array<{
    name: string;
    description: string;
    url: string;
    parameters: Record<string, any>;
  }>;
}

export interface ModelInfo { id: string; label: string; provider: string; enabled: boolean; tags?: string[]; }

export interface SessionInfo {
  id: string; title: string; model: string;
  created_at: string; updated_at: string;
}

export interface KnowledgeDoc {
  id: string; name: string; source: string;
  chunks: number; collection: string; created_at: string;
}

export interface ToolInfo {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface ToolCallRecord {
  name: string;
  args: Record<string, any>;
  result: string;
}

// ============== 普通 REST ==============

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

export const api = {
  health: () => jsonFetch<{ status: string }>('/health'),

  listModels: () => jsonFetch<{ models: ModelInfo[] }>('/api/models'),
  reloadModels: () => jsonFetch<{ reloaded: boolean; count: number }>('/api/models/reload', { method: 'POST' }),

  listSessions: () => jsonFetch<SessionInfo[]>('/api/sessions'),
  createSession: (title?: string, model?: string) =>
    jsonFetch<SessionInfo>('/api/sessions', { method: 'POST', body: JSON.stringify({ title, model }) }),
  getSession: (id: string) => jsonFetch<SessionInfo & { messages: ChatMessage[] }>(`/api/sessions/${id}`),
  deleteSession: (id: string) => jsonFetch<{ deleted: string }>(`/api/sessions/${id}`, { method: 'DELETE' }),

  uploadDoc: async (file: File, collection = 'default') => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('collection', collection);
    const res = await fetch(`${BASE}/api/knowledge/upload?collection=${collection}`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error(`上传失败: ${await res.text()}`);
    return res.json() as Promise<KnowledgeDoc>;
  },
  listDocs: (collection = 'default') =>
    jsonFetch<KnowledgeDoc[]>(`/api/knowledge/documents?collection=${collection}`),
  deleteDoc: (id: string, collection = 'default') =>
    jsonFetch<{ deleted: string }>(`/api/knowledge/documents/${id}?collection=${collection}`, { method: 'DELETE' }),
  queryKb: (question: string, collection = 'default', top_k = 4) =>
    jsonFetch<{ question: string; contexts: Array<{ content: string; source: string; score: number }> }>(
      '/api/knowledge/query',
      { method: 'POST', body: JSON.stringify({ question, collection, top_k }) },
    ),

  listTools: () => jsonFetch<{ tools: ToolInfo[] }>('/api/tools'),

  getPreferences: () => jsonFetch<UserPreferences>('/api/preferences'),
  savePreferences: (prefs: UserPreferences) =>
    jsonFetch<UserPreferences>('/api/preferences', { method: 'PUT', body: JSON.stringify(prefs) }),

  randomAnime: () => jsonFetch<{ url: string }>('/api/anime/random'),
};

// ============== 流式聊天（SSE） ==============

export interface ChatStreamHandlers {
  onMeta?: (data: { session_id: string; model: string }) => void;
  onDelta?: (delta: string) => void;
  onThinking?: (delta: string) => void; // 推理模型思考过程（逐块）
  onToolCall?: (data: { round: number; tool_calls: any[] }) => void;
  onToolResult?: (data: { name: string; args: Record<string, any>; result: string }) => void;
  onDone?: (session_id: string) => void;
  onError?: (message: string) => void;
}

export async function streamChat(
  body: {
    session_id?: string | null;
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    max_tokens?: number;
    enable_rag?: boolean;
    enable_search?: boolean;
    enable_tools?: boolean;
  },
  handlers: ChatStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${BASE}/api/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ ...body, stream: true }),
    signal,
  });
  if (!res.ok || !res.body) {
    handlers.onError?.(`HTTP ${res.status}: ${await res.text()}`);
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const lines = raw.split('\n');
      let event = 'message';
      const dataLines: string[] = [];
      for (const ln of lines) {
        if (ln.startsWith('event:')) event = ln.slice(6).trim();
        else if (ln.startsWith('data:')) dataLines.push(ln.slice(5).trim());
      }
      if (!dataLines.length) continue;
      try {
        const data = JSON.parse(dataLines.join('\n'));
        if (event === 'meta') handlers.onMeta?.(data);
        else if (event === 'delta') handlers.onDelta?.(data.content ?? '');
        else if (event === 'thinking') handlers.onThinking?.(data.content ?? '');
        else if (event === 'tool_call') handlers.onToolCall?.(data);
        else if (event === 'tool_result') handlers.onToolResult?.(data);
        else if (event === 'done') handlers.onDone?.(data.session_id);
        else if (event === 'error') handlers.onError?.(data.message ?? 'unknown');
      } catch {
        /* ignore parse error */
      }
    }
  }
}
