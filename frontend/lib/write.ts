/** 多智能体写作：API + SSE 客户端。 */

const BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export type Style = 'blog' | 'academic' | 'report' | 'social';
export type Length = 'short' | 'medium' | 'long';

export interface WriteRequest {
  topic: string;
  style: Style;
  length: Length;
  outline?: string[] | null;
  model: string;
  enable_rag?: boolean;
  enable_search?: boolean;
  collection?: string;
}

export interface OutlineSection {
  section_id: string;
  title: string;
  focus: string;
  angle?: string;
  search_queries?: string[];
}

export interface SectionResearch {
  section_id: string;
  title: string;
  notes: string;
  sources: string[];
}

export interface WritingResult {
  topic: string;
  style: string;
  length: string;
  word_count: number;
  outline: OutlineSection[];
  sections: SectionResearch[];
  article_md: string;
  events?: any[];
}

// ---------- 同步接口（测试用） ----------

export async function writeArticleSync(req: WriteRequest): Promise<WritingResult> {
  const res = await fetch(`${BASE}/api/write/article/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

// ---------- 流式接口（SSE） ----------

export type AgentStatus = 'pending' | 'running' | 'done' | 'error';

export interface PipelineState {
  // 元信息
  taskId: string | null;
  topic: string;
  // Planner
  planner: { status: AgentStatus; outline: OutlineSection[] };
  // Researchers（每个 section 一个）
  researchers: Array<{
    section_id: string;
    title: string;
    status: AgentStatus;
    notes: string;
    sources: string[];
  }>;
  // Writer
  writer: { status: AgentStatus; article: string; wordCount: number };
  // 总状态
  overall: 'idle' | 'running' | 'done' | 'error';
  elapsed?: number; // 已用时（秒），heartbeat 推送
  error?: string;
}

export const initialPipelineState = (): PipelineState => ({
  taskId: null,
  topic: '',
  planner: { status: 'pending', outline: [] },
  researchers: [],
  writer: { status: 'pending', article: '', wordCount: 0 },
  overall: 'idle',
});

export type PipelineUpdater = (updater: (s: PipelineState) => PipelineState) => void;

export async function streamWriteArticle(
  req: WriteRequest,
  update: PipelineUpdater,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${BASE}/api/write/article`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

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
      const dataLines: string[] = [];
      for (const ln of lines) {
        if (ln.startsWith('data:')) dataLines.push(ln.slice(5).trim());
      }
      if (!dataLines.length) continue;
      try {
        const payload = JSON.parse(dataLines.join('\n'));
        handleEvent(payload, update);
      } catch (e) {
        // 不再静默吞错：任何事件处理异常都浮出来，避免"卡在 0% 无反馈"
        update((s) => ({ ...s, overall: 'error', error: `事件处理失败: ${String(e)}` }));
      }
    }
  }
}

function handleEvent(p: any, update: PipelineUpdater) {
  const ev = p.event;
  if (ev === 'start') {
    update((s) => ({ ...s, taskId: p.task_id, topic: p.topic, overall: 'running' }));
  } else if (ev === 'planner_start') {
    update((s) => ({ ...s, planner: { ...s.planner, status: 'running' } }));
  } else if (ev === 'planner_done') {
    update((s) => ({
      ...s,
      planner: {
        status: 'done',
        outline: p.outline || [],
      },
    }));
  } else if (ev === 'researchers_start') {
    update((s) => ({
      ...s,
      researchers: (s.planner.outline || []).map((o) => ({
        section_id: o.section_id,
        title: o.title,
        status: 'running',
        notes: '',
        sources: [],
      })),
    }));
  } else if (ev === 'researcher_done') {
    // 单个章节调研完成：实时更新该章节状态（不影响其他章节）
    update((s) => {
      const idx = s.researchers.findIndex((r) => r.section_id === p.section_id);
      if (idx < 0) return s;
      const next = [...s.researchers];
      if (p.status === 'error') {
        next[idx] = { ...next[idx], status: 'error' as AgentStatus, notes: p.error || '调研失败' };
      } else {
        next[idx] = {
          ...next[idx],
          status: 'done' as AgentStatus,
          notes: p.notes || '',
          sources: p.sources || [],
        };
      }
      return { ...s, researchers: next };
    });
  } else if (ev === 'researchers_done') {
    update((s) => {
      const map = new Map((p.sections || []).map((sec: any) => [sec.section_id, sec]));
      const next = s.researchers.map((r) => {
        const found = map.get(r.section_id) as any;
        if (!found) return r;
        return { ...r, status: 'done' as AgentStatus, notes: found.notes || '', sources: found.sources || [] };
      });
      return { ...s, researchers: next };
    });
  } else if (ev === 'writer_start') {
    update((s) => ({ ...s, writer: { ...s.writer, status: 'running' } }));
  } else if (ev === 'writer_delta') {
    // Writer 流式输出：实时追加，打字机效果
    update((s) => ({
      ...s,
      writer: {
        status: 'running',
        article: (s.writer.article || '') + (p.text || ''),
        wordCount: (s.writer.wordCount || 0) + (p.text ? p.text.length : 0),
      },
    }));
  } else if (ev === 'writer_done') {
    update((s) => ({
      ...s,
      writer: { status: 'done', article: p.article || '', wordCount: p.word_count || 0 },
    }));
  } else if (ev === 'heartbeat') {
    update((s) => ({ ...s, elapsed: p.elapsed }));
  } else if (ev === 'done') {
    update((s) => ({ ...s, overall: 'done' }));
  } else if (ev === 'error') {
    update((s) => ({ ...s, overall: 'error', error: p.message }));
  }
}
