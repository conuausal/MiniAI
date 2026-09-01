"""下载 BAAI/bge-small-zh-v1.5 到本地模型目录（绕过 HF 网络问题）。

用法：cd backend && python scripts/download_embedding.py
下载到 data/models/bge-small-zh-v1.5/（普通目录），配合 .env 的
EMBEDDING_MODEL=./data/models/bge-small-zh-v1.5 使用，SentenceTransformer
直接从本地路径加载，完全离线。幂等：已下载的文件自动跳过。
"""
import sys
import time
from pathlib import Path

import requests

REPO = "BAAI/bge-small-zh-v1.5"
MIRROR = "https://hf-mirror.com"
FILES = [
    "config.json",
    "config_sentence_transformers.json",
    "modules.json",
    "model.safetensors",
    "tokenizer.json",
    "tokenizer_config.json",
    "vocab.txt",
    "special_tokens_map.json",
    "1_Pooling/config.json",
]

model_dir = Path(__file__).resolve().parent.parent / "data" / "models" / REPO.split("/")[-1]


def download(fname: str) -> None:
    dest = model_dir / fname
    if dest.exists() and dest.stat().st_size > 0:
        print(f"  [skip] {fname} ({dest.stat().st_size // 1024}KB)")
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    url = f"{MIRROR}/{REPO}/resolve/main/{fname}"
    print(f"  [get ] {url}")
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


def main() -> int:
    print(f"target: {model_dir}")
    for fname in FILES:
        try:
            download(fname)
        except Exception as e:
            print(f"  [FAIL] {fname} -> {type(e).__name__}: {e}")
            return 1
    size_mb = sum(f.stat().st_size for f in model_dir.rglob("*") if f.is_file()) // 1048576
    print(f"\n[DONE] all files ready ({size_mb}MB). restart backend to enable Chinese embedding.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
