"""重建向量库：用新配置的 embedding 模型（bge-small-zh）重灌全部文档。

前置：先跑 scripts/download_embedding.py 把模型下载到本地缓存。
流程：备份 vector_store -> 清空 -> 进程内加载 rag_engine（自动用 bge）
      -> 按 MySQL knowledge_docs 逐条重灌 -> 输出统计。
用法：cd backend && python scripts/rebuild_vector_store.py
"""
import asyncio
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402
from app.core.rag import rag_engine  # noqa: E402


async def main() -> int:
    vs = Path(settings.vector_store_dir)
    backup = vs.parent / "vector_store.bak"

    # 1) 预检 embedding 模型（直接加载，不碰 chroma，避免文件锁）
    from sentence_transformers import SentenceTransformer

    try:
        st = SentenceTransformer(settings.embedding_model)
        _ = st.encode(["预检"])
        del st
    except Exception as e:
        print(f"[FAIL] embedding 模型加载失败: {type(e).__name__}: {e}")
        print("       请先运行: python scripts/download_embedding.py")
        return 1
    print("[OK] embedding 模型已就绪 (bge-small-zh-v1.5)")

    # 2) 读 MySQL 文档清单
    from sqlalchemy import select
    from app.db.database import AsyncSessionLocal
    from app.models.orm import KnowledgeDoc

    async with AsyncSessionLocal() as db:
        rows = (await db.execute(select(KnowledgeDoc))).scalars().all()
    print(f"[OK] 待重灌文档 {len(rows)} 个")
    if not rows:
        print("[OK] 无文档，仅清空向量库即可")

    # 3) 备份并清空（此时 chroma 尚未打开，无文件锁；目录可能已不存在——幂等处理）
    if vs.exists():
        if backup.exists():
            shutil.rmtree(backup)
        shutil.copytree(vs, backup)
        shutil.rmtree(vs)
        print("[OK] 已备份到 vector_store.bak 并清空向量库")
    elif backup.exists():
        print("[OK] 向量库目录不存在（上次中断），沿用已有备份")
    else:
        print("[WARN] 向量库与备份均不存在，将创建全新向量库")

    # 4) 逐条重灌
    await rag_engine.bootstrap()  # 初始化 chroma 客户端（在清空之后，避免文件锁）
    ok_count, fail_count = 0, 0
    col_stats: dict = {}
    for i, row in enumerate(rows, 1):
        src = Path(row.source)
        if not src.exists():
            print(f"  [{i}/{len(rows)}] 跳过（源文件丢失）: {row.name}")
            fail_count += 1
            continue
        try:
            info = await rag_engine.add_document(str(src), row.name, collection=row.collection, user_id=row.user_id)
            ok_count += 1
            stat = col_stats.setdefault(row.collection, {"docs": 0, "chunks": 0})
            stat["docs"] += 1
            stat["chunks"] += info["chunks"]
            print(f"  [{i}/{len(rows)}] {row.name} -> {info['chunks']} chunks")
        except Exception as e:
            fail_count += 1
            print(f"  [{i}/{len(rows)}] 失败: {row.name} -> {type(e).__name__}: {e}")

    # 5) 统计
    print(f"\n[DONE] 成功 {ok_count}，失败 {fail_count}")
    for col, stat in col_stats.items():
        print(f"  collection '{col}': {stat['docs']} 文档 / {stat['chunks']} chunks")
    if fail_count:
        print("[WARN] 有失败条目，源文件仍在 uploads/，可修复后重跑本脚本")
    print("[DONE] 重建完成。重启后端后即可用中文语义检索。")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
