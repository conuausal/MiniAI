"""下载 RAG 模型到本地模型目录（绕过 HF 网络问题，SentenceTransformer 本地路径离线加载）。

用法：cd backend && python scripts/download_embedding.py [--rerank]
  默认下载 embedding 模型 BAAI/bge-small-zh-v1.5（~92MB）
  --rerank 额外下载重排模型 BAAI/bge-reranker-v2-m3（~2.2GB）
配合 .env：EMBEDDING_MODEL=./data/models/bge-small-zh-v1.5
          RERANK_MODEL=./data/models/bge-reranker-v2-m3
幂等：已下载的文件自动跳过。
"""
import sys
import time
from pathlib import Path

import requests

MIRROR = "https://hf-mirror.com"

TARGETS = {
    "embedding": {
        "repo": "BAAI/bge-small-zh-v1.5",
        "files": [
            "config.json",
            "config_sentence_transformers.json",
            "modules.json",
            "model.safetensors",
            "tokenizer.json",
            "tokenizer_config.json",
            "vocab.txt",
            "special_tokens_map.json",
            "1_Pooling/config.json",
        ],
    },
    "rerank": {
        "repo": "BAAI/bge-reranker-v2-m3",
        "files": [
            "config.json",
            "model.safetensors",
            "tokenizer.json",
            "tokenizer_config.json",
            "special_tokens_map.json",
            "sentencepiece.bpe.model",
            "tokenizer.model",
            "1_Classifier/config.json",
        ],
    },
}

models_root = Path(__file__).resolve().parent.parent / "data" / "models"


def download(repo: str, fname: str) -> None:
    dest = models_root / repo.split("/")[-1] / fname
    if dest.exists() and dest.stat().st_size > 0:
        print(f"  [skip] {fname} ({dest.stat().st_size // 1048576}MB)")
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    url = f"{MIRROR}/{repo}/resolve/main/{fname}"
    print(f"  [get ] {fname}")
    t0 = time.time()
    with requests.get(url, stream=True, timeout=60) as r:
        r.raise_for_status()
        total = int(r.headers.get("content-length", 0))
        done = 0
        tmp = dest.with_suffix(dest.suffix + ".part")
        with open(tmp, "wb") as f:
            for chunk in r.iter_content(chunk_size=1024 * 256):
                f.write(chunk)
                done += len(chunk)
                if total:
                    print(f"\r    {done * 100 // total}% ({done // 1048576}MB/{total // 1048576}MB)", end="", flush=True)
        print(f"    done ({time.time() - t0:.1f}s)")
        tmp.rename(dest)


def run_target(name: str) -> int:
    t = TARGETS[name]
    print(f"[{name}] repo: {t['repo']} -> {models_root / t['repo'].split('/')[-1]}")
    for fname in t["files"]:
        try:
            download(t["repo"], fname)
        except Exception as e:
            print(f"  [FAIL] {fname} -> {type(e).__name__}: {e}")
            return 1
    return 0


def main() -> int:
    targets = ["embedding"] + (["rerank"] if "--rerank" in sys.argv else [])
    for name in targets:
        if run_target(name) != 0:
            return 1
    size_mb = sum(f.stat().st_size for f in models_root.rglob("*") if f.is_file()) // 1048576
    print(f"\n[DONE] models ready ({size_mb}MB total). restart backend to apply.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
