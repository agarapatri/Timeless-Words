# This script checks the integrity of vector embeddings stored in a SQLite database.
# It verifies that all vectors have the expected dimensionality and are approximately unit-norm.

import sqlite3, numpy as np
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "assets" / "data" / "semantic" / "library.semantic.v01.sqlite"

with sqlite3.connect(str(DB)) as con:
    cur = con.cursor()
    dim = int(dict(cur.execute("SELECT key,value FROM meta").fetchall())["dim"])
    cnt = cur.execute("SELECT COUNT(*) FROM embeddings").fetchone()[0]
    bad_shape = 0
    bad_norm = 0
    for (_id, blob) in cur.execute("SELECT id, vector FROM embeddings"):
        v = np.frombuffer(blob, dtype=np.float32)
        if v.size != dim:
            bad_shape += 1
            continue
        n = np.linalg.norm(v)
        if not (0.99 <= n <= 1.01):
            bad_norm += 1
    print(f"dim={dim}, rows={cnt}, bad_shape={bad_shape}, bad_norm={bad_norm}")
