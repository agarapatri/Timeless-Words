#!/usr/bin/env python3
# Populate the `embeddings` table in the semantic search database.

from pathlib import Path
import sqlite3
import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer


# ---------- Path resolution ----------

def find_semantic_root(start: Path) -> Path:
    """
    Walk upward from `start` until we find:
      assets/data/semantic/onnx_model/tokenizer.json
    Return the path to assets/data/semantic.
    """
    marker = ("assets", "data", "semantic", "onnx_model", "tokenizer.json")
    start = start.resolve()
    for base in (start, *start.parents):
        if (base.joinpath(*marker)).is_file():
            return base / "assets" / "data" / "semantic"
    raise FileNotFoundError(f"semantic assets not found upward from: {start}")


HERE = Path(__file__).resolve().parent
ROOT = find_semantic_root(HERE)                 # <repo>/assets/data/semantic
MDIR = ROOT / "onnx_model"

# Resolve DB (e.g., library.semantic.{{VEC_DB_VERSION}}.sqlite)
DB_CANDIDATES = sorted(ROOT.glob("library.semantic.*.sqlite"))
if not DB_CANDIDATES:
    raise FileNotFoundError(f"No semantic DB found in {ROOT}")
DB_PATH = DB_CANDIDATES[0]


# ---------- Model + tokenizer ----------

tok = Tokenizer.from_file(str(MDIR / "tokenizer.json"))
sess = ort.InferenceSession(str(MDIR / "model.onnx"), providers=["CPUExecutionProvider"])

# Resolve input/output names robustly
_input_names = {i.name for i in sess.get_inputs()}
def pick(candidates):
    for n in candidates:
        if n in _input_names:
            return n
    return None

IN_IDS  = pick(["input_ids", "ids", "input"])
IN_ATTN = pick(["attention_mask", "attn_mask", "mask"])
IN_TTOK = pick(["token_type_ids", "token_type_id", "segment_ids"])  # may be None
if IN_IDS is None or IN_ATTN is None:
    raise KeyError(f"Model inputs not recognized. Available: {sorted(_input_names)}")

OUT0 = sess.get_outputs()[0].name  # expect hidden states [B,S,H]


# ---------- Encoding ----------

def encode(texts, max_len=256):
    """
    texts: list[str] -> np.ndarray shape [B, H], L2-normalized.
    """
    batch = tok.encode_batch(texts)

    # Token ids truncated to max_len
    ids  = [e.ids[:max_len] for e in batch]
    # Attention mask of ones for actual tokens
    attn = [[1] * len(x) for x in ids]

    # Left-pad to max length in the batch
    maxL = max(len(x) for x in ids) if ids else 1
    ids  = np.array([x + [0]*(maxL - len(x)) for x in ids],  dtype=np.int64)  # [B,S]
    attn = np.array([x + [0]*(maxL - len(x)) for x in attn], dtype=np.int64)  # [B,S]

    feeds = {IN_IDS: ids, IN_ATTN: attn}
    if IN_TTOK is not None:
        feeds[IN_TTOK] = np.zeros_like(ids, dtype=np.int64)  # segment ids

    hidden = sess.run([OUT0], feeds)[0]             # [B,S,H]
    mask = attn[..., None].astype(np.float32)       # [B,S,1]

    # Mean pooling with mask:
    # μ = (Σ_t h_t * m_t) / (Σ_t m_t)
    summed = (hidden * mask).sum(axis=1)            # [B,H]
    denom = np.clip(mask.sum(axis=1), 1e-9, None)   # [B,1]
    mean = summed / denom                           # [B,H]

    # L2 normalize
    norm = np.linalg.norm(mean, axis=1, keepdims=True) + 1e-12
    emb = (mean / norm).astype(np.float32)          # [B,H]
    return emb


# ---------- Database I/O ----------

def main():
    con = sqlite3.connect(str(DB_PATH))
    cur = con.cursor()

    rows = cur.execute("SELECT id, text FROM passages ORDER BY id").fetchall()
    B = 64
    for i in range(0, len(rows), B):
        batch = rows[i:i+B]
        ids = [r[0] for r in batch]
        texts = [r[1] for r in batch]
        vecs = encode(texts)
        cur.executemany(
            "INSERT OR REPLACE INTO embeddings(id, vector) VALUES(?, ?)",
            [(pid, memoryview(vec.tobytes())) for pid, vec in zip(ids, vecs)]
        )

    con.commit()
    con.close()
    print("Done. Embeddings populated.")


if __name__ == "__main__":
    main()
