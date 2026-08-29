'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import AgentPipeline from '@/components/AgentPipeline';
import { useChatStore } from '@/lib/store';
import {
  initialPipelineState, streamWriteArticle, PipelineState,
  WriteRequest, Style, Length,
} from '@/lib/write';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const STYLES: Array<{ v: Style; label: string; desc: string }> = [
  { v: 'blog', label: '📝 博客', desc: '轻松、技术向' },
  { v: 'academic', label: '🎓 学术', desc: '严谨、引证' },
  { v: 'report', label: '📊 报告', desc: '数据、结论先行' },
  { v: 'social', label: '💬 社交', desc: '短小、抓眼球' },
];

const LENGTHS: Array<{ v: Length; label: string; words: string }> = [
  { v: 'short', label: '简短', words: '~1000 字 / 3 章' },
  { v: 'medium', label: '中等', words: '~2000 字 / 4 章' },
  { v: 'long', label: '深度', words: '~3500 字 / 6 章' },
];

export default function WritePage() {
  const { models, currentModel } = useChatStore();
  const enabledModels = models.filter((m) => m.enabled);

  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState<Style>('blog');
  const [length, setLength] = useState<Length>('medium');
  const [enableRag, setEnableRag] = useState(false);
  const [enableSearch, setEnableSearch] = useState(false);
  const [customOutline, setCustomOutline] = useState('');
  const [state, setState] = useState<PipelineState>(initialPipelineState());
  const [ctl, setCtl] = useState<AbortController | null>(null);
  const [activeTab, setActiveTab] = useState<'pipeline' | 'article'>('pipeline');

  useEffect(() => {
    if (models.length === 0) {
      import('@/lib/api').then(({ api }) => {
        api.listModels().then(({ models }) => useChatStore.setState({ models }));
      });
    }
  }, [models.length]);

  const start = async () => {
    if (!topic.trim() || state.overall === 'running') return;
    setState({ ...initialPipelineState(), topic, overall: 'running' });
    setActiveTab('pipeline');
    const ac = new AbortController();
    setCtl(ac);
    const req: WriteRequest = {
      topic: topic.trim(),
      style,
      length,
      model: currentModel,
      enable_rag: enableRag,
      enable_search: enableSearch,
      collection: 'default',
      outline: customOutline
        .split('\n')
        .map((s) => s.trim().replace(/^[-*\d.、\s]+/, ''))
        .filter(Boolean),
    };
    try {
      await streamWriteArticle(req, (updater) => setState((s) => updater(s)), ac.signal);
    } catch (e: any) {
      setState((s) => ({ ...s, overall: 'error', error: e?.message || String(e) }));
    } finally {
      setCtl(null);
    }
  };

  const stop = () => ctl?.abort();

  const downloadMd = () => {
    if (!state.writer.article) return;
    const blob = new Blob([state.writer.article], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.topic || 'article'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isRunning = state.overall === 'running';

  return (
    <main className="h-screen flex">
      <Sidebar />
      <section className="flex-1 flex overflow-hidden">
        {/* 左侧：表单 */}
        <aside className="w-80 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto p-5">
          <h1 className="text-xl font-bold mb-1">✍️ 多智能体写作</h1>
          <p className="text-xs text-slate-500 mb-4">Planner → Researchers → Writer，5 个 Agent 协同</p>

          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">主题 *</label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="例：RAG 技术原理与实践"
            className="w-full text-sm px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 min-h-[70px]"
          />

          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mt-4 mb-1">风格</label>
          <div className="grid grid-cols-2 gap-1.5">
            {STYLES.map((s) => (
              <button
                key={s.v}
                onClick={() => setStyle(s.v)}
                className={`text-xs px-2 py-1.5 rounded-md border ${style === s.v ? 'bg-brand-500 text-white border-brand-500' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <div className="font-medium">{s.label}</div>
                <div className="text-[10px] opacity-70">{s.desc}</div>
              </button>
            ))}
          </div>

          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mt-4 mb-1">长度</label>
          <div className="space-y-1">
            {LENGTHS.map((l) => (
              <button
                key={l.v}
                onClick={() => setLength(l.v)}
                className={`w-full text-left text-xs px-2 py-1.5 rounded-md border ${length === l.v ? 'bg-brand-50 border-brand-400 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200' : 'border-slate-200 dark:border-slate-700'}`}
              >
                <div className="font-medium">{l.label} · {l.words}</div>
              </button>
            ))}
          </div>

          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mt-4 mb-1">
            模型 <span className="font-normal text-slate-400">({enabledModels.length} 可用)</span>
          </label>
          <select
            value={currentModel}
            onChange={(e) => useChatStore.setState({ currentModel: e.target.value })}
            disabled={isRunning}
            className="w-full text-sm px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
          >
            {enabledModels.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>

          <div className="mt-4 space-y-2">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={enableRag} onChange={(e) => setEnableRag(e.target.checked)} />
              📚 调用本地知识库
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={enableSearch} onChange={(e) => setEnableSearch(e.target.checked)} />
              🌐 启用联网搜索
            </label>
          </div>

          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mt-4 mb-1">
            自定义大纲 <span className="font-normal text-slate-400">（可选，每行一章）</span>
          </label>
          <textarea
            value={customOutline}
            onChange={(e) => setCustomOutline(e.target.value)}
            placeholder={'什么是 RAG\n核心原理\n实战案例'}
            className="w-full text-xs px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 min-h-[60px]"
          />

          <div className="flex gap-2 mt-5">
            {!isRunning ? (
              <button
                onClick={start}
                disabled={!topic.trim()}
                className="flex-1 py-2 rounded-md bg-brand-500 hover:bg-brand-600 disabled:bg-slate-300 text-white text-sm font-medium"
              >开始写作</button>
            ) : (
              <button onClick={stop} className="flex-1 py-2 rounded-md bg-red-500 hover:bg-red-600 text-white text-sm font-medium">停止</button>
            )}
          </div>
        </aside>

        {/* 右侧：流水线 / 文章 */}
        <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
          <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 flex items-center gap-2">
            <button
              onClick={() => setActiveTab('pipeline')}
              className={`text-sm px-3 py-1 rounded ${activeTab === 'pipeline' ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              🔄 流水线 ({state.researchers.length})
            </button>
            <button
              onClick={() => setActiveTab('article')}
              className={`text-sm px-3 py-1 rounded ${activeTab === 'article' ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              📄 文章 {state.writer.article && `(${state.writer.wordCount}字)`}
            </button>
            <div className="flex-1" />
            {state.writer.article && (
              <button onClick={downloadMd} className="text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
                ⬇️ 下载 .md
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'pipeline' ? (
              <div className="max-w-2xl mx-auto">
                <AgentPipeline state={state} />
                {state.error && (
                  <div className="mt-4 p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
                    ⚠️ {state.error}
                  </div>
                )}
              </div>
            ) : (
              <article className="max-w-3xl mx-auto bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 prose dark:prose-invert max-w-none">
                {state.writer.article ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{state.writer.article}</ReactMarkdown>
                ) : (
                  <div className="text-center text-slate-400 py-12">
                    <div className="text-5xl mb-2">📝</div>
                    <div>文章生成后将显示在这里</div>
                  </div>
                )}
              </article>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
