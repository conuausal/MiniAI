'use client';

import { useEffect, useRef, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { api, KnowledgeDoc } from '@/lib/api';

export default function KnowledgePage() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [collection, setCollection] = useState('default');
  const [uploading, setUploading] = useState(false);
  const [question, setQuestion] = useState('');
  const [hits, setHits] = useState<Array<{ content: string; source: string; score: number }>>([]);
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
    try {
      const res = await api.queryKb(question, collection);
      setHits(res.contexts);
    } catch (e) { console.error(e); }
  };

  const onDelete = async (id: string) => {
    if (!confirm('确定删除该文档？')) return;
    await api.deleteDoc(id, collection);
    await refresh();
  };

  return (
    <main className="h-screen flex">
      <Sidebar />
      <section className="flex-1 overflow-y-auto p-8 bg-slate-50 dark:bg-slate-950">
        <h1 className="text-2xl font-bold mb-1">📚 知识库</h1>
        <p className="text-sm text-slate-500 mb-6">上传 PDF / DOCX / TXT / Markdown，启用 RAG 后可在对话中检索</p>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <input
              type="text"
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
              placeholder="集合名（默认 default）"
              className="px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            />
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.md,.docx"
              onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
              className="text-sm"
              disabled={uploading}
            />
            {uploading && <span className="text-xs text-slate-500">上传中…</span>}
          </div>

          {docs.length === 0 ? (
            <div className="text-sm text-slate-400 py-6 text-center">暂无文档</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-slate-700">
                <tr><th className="py-2">文件名</th><th>分块</th><th>集合</th><th></th></tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 truncate max-w-[300px]">{d.name}</td>
                    <td>{d.chunks}</td>
                    <td>{d.collection}</td>
                    <td className="text-right">
                      <button onClick={() => onDelete(d.id)} className="text-xs text-red-500 hover:underline">删除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
          <h2 className="font-semibold mb-2">🔍 检索测试</h2>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onQuery()}
              placeholder="输入问题检索相关片段"
              className="flex-1 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            />
            <button onClick={onQuery} className="px-4 py-2 rounded-md bg-brand-500 hover:bg-brand-600 text-white text-sm">检索</button>
          </div>
          <div className="space-y-2">
            {hits.map((h, i) => (
              <div key={i} className="p-3 rounded-md bg-slate-50 dark:bg-slate-800 text-sm">
                <div className="text-xs text-slate-500 mb-1">来源: {h.source} · 相似度 {h.score?.toFixed(3)}</div>
                <div className="whitespace-pre-wrap">{h.content}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
