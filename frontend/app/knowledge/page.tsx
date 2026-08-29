'use client';

import { useEffect, useRef, useState } from 'react';
import Topbar from '@/components/Topbar';
import { api, KnowledgeDoc } from '@/lib/api';
import clsx from 'clsx';

export default function KnowledgePage() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [collection, setCollection] = useState('default');
  const [uploading, setUploading] = useState(false);
  const [question, setQuestion] = useState('');
  const [hits, setHits] = useState<Array<{ content: string; source: string; score: number }>>([]);
  const [searching, setSearching] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    try {
      const list = await api.listDocs(collection);
      setDocs(list);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { refresh(); }, [collection]);

  const onUpload = async (file: File) => {
    setUploading(true);
    try {
      await api.uploadDoc(file, collection);
      await refresh();
    } catch (e: any) {
      alert('上传失败: ' + e.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onQuery = async () => {
    if (!question.trim()) return;
    setSearching(true);
    try {
      const res = await api.queryKb(question, collection);
      setHits(res.contexts);
    } catch (e) { console.error(e); }
    setSearching(false);
  };

  const onDelete = async (id: string) => {
    if (!confirm('删除这个文档？')) return;
    await api.deleteDoc(id, collection);
    await refresh();
  };

  return (
    <div className="h-screen flex flex-col bg-bg">
      <Topbar />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
          {/* 标题区 */}
          <header className="animate-slide-up">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">📚</span>
              <h1 className="font-serif text-3xl font-semibold tracking-tight">知识库</h1>
            </div>
            <p className="text-text-soft ml-12">
              上传 PDF / DOCX / TXT / Markdown，启用 RAG 后可在对话中检索相关内容。
            </p>
          </header>

          {/* 上传卡片 */}
          <section className="surface rounded-2xl p-6 shadow-soft-sm animate-slide-up" style={{ animationDelay: '50ms' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">📤 上传文档</h2>
              <div className="flex items-center gap-2">
                <label className="text-xs text-text-soft">集合：</label>
                <input
                  type="text"
                  value={collection}
                  onChange={(e) => setCollection(e.target.value)}
                  className="text-xs px-2 py-1 rounded-md border border-border bg-bg-soft w-32"
                />
              </div>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) onUpload(file);
              }}
              className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-brand-400 hover:bg-brand-50/30 transition cursor-pointer"
              onClick={() => fileRef.current?.click()}
            >
              <div className="text-4xl mb-2">📁</div>
              <div className="text-sm font-medium mb-1">
                {uploading ? '上传中…' : '拖拽文件到这里，或点击选择'}
              </div>
              <div className="text-xs text-text-mute">支持 PDF · DOCX · TXT · Markdown</div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.txt,.md,.docx"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
                disabled={uploading}
              />
            </div>
          </section>

          {/* 文档列表 */}
          <section className="surface rounded-2xl p-6 shadow-soft-sm animate-slide-up" style={{ animationDelay: '100ms' }}>
            <h2 className="font-semibold mb-4">📋 文档列表（{docs.length}）</h2>
            {docs.length === 0 ? (
              <div className="text-sm text-text-mute text-center py-8">
                还没有文档，上传一个试试看
              </div>
            ) : (
              <div className="space-y-2">
                {docs.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-bg-soft transition group"
                  >
                    <span className="text-xl">📄</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{d.name}</div>
                      <div className="text-xs text-text-mute">
                        {d.chunks} 个分块 · 集合 {d.collection} · {new Date(d.created_at).toLocaleString('zh-CN')}
                      </div>
                    </div>
                    <button
                      onClick={() => onDelete(d.id)}
                      className="opacity-0 group-hover:opacity-100 text-xs text-red-500 hover:text-red-700 transition px-2 py-1"
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 检索测试 */}
          <section className="surface rounded-2xl p-6 shadow-soft-sm animate-slide-up" style={{ animationDelay: '150ms' }}>
            <h2 className="font-semibold mb-4">🔍 检索测试</h2>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onQuery()}
                placeholder="输入问题检索相关片段"
                className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-bg-soft focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition text-sm"
              />
              <button onClick={onQuery} disabled={!question.trim() || searching} className="btn btn-primary">
                {searching ? '搜索中…' : '检索'}
              </button>
            </div>

            {hits.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-text-mute">{hits.length} 条命中</div>
                {hits.map((h, i) => (
                  <div key={i} className="p-4 rounded-lg bg-bg-soft text-sm border border-border-soft">
                    <div className="flex items-center justify-between mb-2 text-xs text-text-mute">
                      <span>来源：{h.source}</span>
                      <span className="px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                        相关度 {h.score?.toFixed(3)}
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap text-text-soft leading-relaxed">{h.content}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
