# This script performs quick checks on the semantic embedding database to ensure data integrity.

from pathlib import Path
import sqlite3, numpy as np

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "assets" / "data" / "semantic" / "library.semantic.v01.sqlite"

with sqlite3.connect(str(DB)) as con:
    cur = con.cursor()
    # 1) Confirm dims
    dim = int(dict(cur.execute("SELECT key,value FROM meta").fetchall())["dim"])
    id0, blob = cur.execute("SELECT id, vector FROM embeddings LIMIT 1").fetchone()
    vec = np.frombuffer(blob, dtype=np.float32)
    assert vec.shape[0] == dim, f"dim mismatch: {vec.shape[0]} vs {dim}"
    # 2) Check normalization
    norm = np.linalg.norm(vec)
    print(f"dim={dim}, id={id0}, norm≈{norm:.4f}")
