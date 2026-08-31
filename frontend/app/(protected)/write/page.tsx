'use client';

import { useEffect, useState } from 'react';
import Topbar from '@/components/Topbar';
import AgentPipeline from '@/components/AgentPipeline';
import { useChatStore } from '@/lib/store';
import {
  initialPipelineState, streamWriteArticle, PipelineState,
  WriteRequest, Style, Length,
} from '@/lib/write';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import clsx from 'clsx';
import { useUserKeys } from '@/lib/user-keys';

const STYLES: Array<{ v: Style; label: string; desc: string; emoji: string; gradient: string }> = [
  { v: 'blog', label: '博客', desc: '轻松、技术向', emoji: '📝', gradient: 'glass-purple' },
  { v: 'academic', label: '学术', desc: '严谨、引证', emoji: '🎓', gradient: 'glass-blue' },
  { v: 'report', label: '报告', desc: '数据、结论先行', emoji: '📊', gradient: 'glass-cyan' },
  { v: 'social', label: '社交', desc: '短小、抓眼球', emoji: '💬', gradient: 'glass-pink' },
];

const LENGTHS: Array<{ v: Length; label: string; words: string }> = [
  { v: 'short', label: '简短', words: '~1k 字 / 3 章' },
  { v: 'medium', label: '中等', words: '~2k 字 / 4 章' },
  { v: 'long', label: '深度', words: '~3.5k 字 / 6 章' },
];

export default function WritePage() {
  const { models, currentModel } = useChatStore();
  const { hasAny } = useUserKeys();
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

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
      outline: customOutline.split('\n').map((s) => s.trim().replace(/^[-*\d.、\s]+/, '')).filter(Boolean),
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
  const completedSections = state.researchers.filter((r) => r.status === 'done').length;
  const totalSteps = 1 + state.researchers.length + 1;
  const completedSteps = (state.planner.status === 'done' ? 1 : 0) + completedSections + (state.writer.status === 'done' ? 1 : 0);
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  // 写作配置面板（桌面常驻侧栏 / 移动端抽屉共用）
  const configPanel = (
    <div className="p-5 space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">✍️</span>
          <h1 className="font-serif text-xl font-semibold text-hero">多智能体写作</h1>
        </div>
        <p className="text-xs text-text-mute">5 个 Agent 协同：Planner → Researchers → Writer</p>
      </div>

      <Field label="主题" required>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="例：RAG 技术原理与实践"
          className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-bg-soft focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition min-h-[70px] resize-none"
        />
      </Field>

      <Field label="风格">
        <div className="grid grid-cols-2 gap-1.5">
          {STYLES.map((s) => (
            <button
              key={s.v}
              onClick={() => setStyle(s.v)}
              className={clsx(
                'text-left text-xs px-2.5 py-2 rounded-lg border transition',
                style === s.v
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-border hover:bg-bg-soft'
              )}
            >
              <div className="font-medium">{s.emoji} {s.label}</div>
              <div className="text-[10px] text-text-mute mt-0.5">{s.desc}</div>
            </button>
          ))}
        </div>
      </Field>

      <Field label="长度">
        <div className="space-y-1">
          {LENGTHS.map((l) => (
            <button
              key={l.v}
              onClick={() => setLength(l.v)}
              className={clsx(
                'w-full text-left text-xs px-2.5 py-2 rounded-lg border transition',
                length === l.v
                  ? 'border-accent-purple bg-accent-purple/10 text-accent-purple font-medium'
                  : 'border-border hover:bg-bg-soft'
              )}
            >
              <div className="font-medium">{l.label} <span className="font-normal text-text-mute">· {l.words}</span></div>
            </button>
          ))}
        </div>
      </Field>

      <Field label="模型">
        <select
          value={currentModel}
          onChange={(e) => useChatStore.setState({ currentModel: e.target.value })}
          disabled={isRunning}
          className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-bg-soft focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
        >
          {enabledModels.length === 0 && <option value="">先配置 API Key</option>}
          {enabledModels.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </Field>

      <Field label="增强">
        <div className="space-y-1.5">
          <CheckboxRow checked={enableRag} onChange={setEnableRag} emoji="📚" label="调用知识库" />
          <CheckboxRow checked={enableSearch} onChange={setEnableSearch} emoji="🌐" label="启用联网搜索" />
        </div>
      </Field>

      <Field label="自定义大纲" hint="可选">
        <textarea
          value={customOutline}
          onChange={(e) => setCustomOutline(e.target.value)}
          placeholder={'什么是 RAG\n核心原理\n实战案例'}
          className="w-full text-xs px-2.5 py-2 rounded-lg border border-border bg-bg-soft focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 transition min-h-[60px] resize-none"
        />
      </Field>

      {!isRunning ? (
        <button
          onClick={start}
          disabled={!topic.trim() || !hasAny}
          className="w-full btn btn-primary !py-2.5 font-medium"
        >
          ✨ 开始写作
        </button>
      ) : (
        <button onClick={stop} className="w-full btn bg-accent-red/15 text-accent-red hover:bg-accent-red/25 !py-2.5">
          停止生成
        </button>
      )}
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-bg">
      <Topbar />
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：表单（桌面常驻 / 移动端抽屉复用） */}
        <aside className="hidden lg:flex w-80 shrink-0 border-r border-border bg-surface/50 backdrop-blur-md overflow-y-auto">
          {configPanel}
        </aside>

        {/* 右侧：进度 + 文章 */}
        <div className="flex-1 flex flex-col bg-bg overflow-hidden">
          {/* 顶部进度 */}
          <div className="border-b border-border-soft bg-surface/50 backdrop-blur-md px-4 lg:px-5 py-3">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setConfigOpen(true)}
                  className="lg:hidden text-sm px-2 py-1 rounded-md text-text-soft hover:bg-bg-soft"
                  aria-label="写作配置"
                >
                  ⚙️
                </button>
                <button
                  onClick={() => setActiveTab('pipeline')}
                  className={clsx(
                    'text-sm px-2 lg:px-3 py-1 rounded-md transition',
                    activeTab === 'pipeline'
                      ? 'bg-primary/15 text-primary font-medium'
                      : 'text-text-soft hover:bg-bg-soft'
                  )}
                >
                  🔄 流水线
                </button>
                <button
                  onClick={() => setActiveTab('article')}
                  disabled={!state.writer.article}
                  className={clsx(
                    'text-sm px-2 lg:px-3 py-1 rounded-md transition',
                    activeTab === 'article'
                      ? 'bg-primary/15 text-primary font-medium'
                      : 'text-text-soft hover:bg-bg-soft disabled:opacity-40'
                  )}
                >
                  📄 文章 {state.writer.article && `· ${state.writer.wordCount}字`}
                </button>
              </div>
              {state.writer.article && (
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setPreviewOpen(true)} className="btn btn-secondary !py-1.5 text-xs">
                    👁️ 预览
                  </button>
                  <button onClick={downloadMd} className="btn btn-secondary !py-1.5 text-xs">
                    ⬇️ 下载 .md
                  </button>
                </div>
              )}
            </div>
            {/* 渐变进度条 */}
            <div className="h-1.5 bg-bg-soft rounded-full overflow-hidden relative">
              <div
                className="h-full bg-aurora animate-aurora transition-all duration-500 ease-out rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5 text-[10px] text-text-mute">
              <span>
                {state.planner.status === 'done' ? '✓' : state.planner.status === 'running' ? '⏳' : '○'} Planner ·{' '}
                {completedSections}/{state.researchers.length} Researcher ·{' '}
                {state.writer.status === 'done' ? '✓' : state.writer.status === 'running' ? '⏳' : '○'} Writer
              </span>
              <span className="font-mono">{Math.round(progress)}%</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === 'pipeline' ? (
              <div className="max-w-2xl mx-auto p-4 lg:p-6">
                <AgentPipeline state={state} />
                {state.error && (
                  <div className="mt-4 p-3 rounded-lg bg-accent-red/10 text-accent-red text-sm animate-fade-in border border-accent-red/30">
                    ⚠️ {state.error}
                  </div>
                )}
              </div>
            ) : (
              <article className="max-w-3xl mx-auto p-4 lg:p-6">
                {state.writer.article ? (
                  <div className="glass-card rounded-2xl p-6 md:p-10 animate-fade-in">
                    <div className="prose prose-base max-w-none font-serif">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{state.writer.article}</ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-text-mute py-16">
                    <div className="text-5xl mb-3">📝</div>
                    <div className="font-serif text-lg">文章生成后将显示在这里</div>
                  </div>
                )}
              </article>
            )}
          </div>
        </div>
      </div>

      {/* 移动端配置抽屉 */}
      {configOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setConfigOpen(false)} />
          <aside className="absolute top-0 bottom-0 left-0 w-[85vw] max-w-sm bg-surface shadow-xl animate-drawer-in-left flex flex-col">
            <header className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
              <span className="font-semibold">⚙️ 写作配置</span>
              <button onClick={() => setConfigOpen(false)} className="btn btn-ghost !p-1.5 rounded-lg" aria-label="关闭配置">✕</button>
            </header>
            <div className="flex-1 overflow-y-auto">{configPanel}</div>
          </aside>
        </div>
      )}

      {/* 文章预览弹窗 */}
      {previewOpen && state.writer.article && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="bg-surface rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
              <h3 className="font-serif font-semibold text-hero">📄 文章预览</h3>
              <div className="flex items-center gap-2">
                <button onClick={downloadMd} className="btn btn-secondary !py-1.5 text-xs">⬇️ 下载 .md</button>
                <button onClick={() => setPreviewOpen(false)} className="btn btn-ghost !p-2" title="关闭">✕</button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
              <article className="prose prose-base max-w-none font-serif">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{state.writer.article}</ReactMarkdown>
              </article>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center justify-between text-xs font-semibold text-text-soft mb-1.5">
        <span>{label} {required && <span className="text-accent-red">*</span>}</span>
        {hint && <span className="font-normal text-text-mute">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function CheckboxRow({ checked, onChange, emoji, label }: { checked: boolean; onChange: (v: boolean) => void; emoji: string; label: string }) {
  return (
    <label className="flex items-center gap-2 text-xs cursor-pointer hover:text-text transition">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-3.5 h-3.5 accent-primary cursor-pointer"
      />
      <span>{emoji}</span>
      <span>{label}</span>
    </label>
  );
}
