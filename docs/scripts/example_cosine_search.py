# This script demonstrates how to perform a cosine similarity search
# on vector embeddings stored in a SQLite database.
# It retrieves the top-k most similar vectors to a given query vector.

import sqlite3, numpy as np
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "assets" / "data" / "semantic" / "library.semantic.v01.sqlite"

def cosine_topk(q, k=5):
    q = q.astype(np.float32)
    q /= np.linalg.norm(q) + 1e-12  # unit norm
    with sqlite3.connect(str(DB)) as con:
        cur = con.cursor()
        rows = cur.execute("SELECT id, vector FROM embeddings").fetchall()
    sims = []
    for _id, blob in rows:
        v = np.frombuffer(blob, dtype=np.float32)
        sims.append((_id, float(np.dot(q, v))))  # dot == cosine for unit-norm
    sims.sort(key=lambda x: x[1], reverse=True)
    return sims[:k]

# Example: use one DB vector as a fake query
with sqlite3.connect(str(DB)) as con:
    cur = con.cursor()
    _, blob = cur.execute("SELECT id, vector FROM embeddings LIMIT 1 OFFSET 10").fetchone()
q = np.frombuffer(blob, dtype=np.float32)
print(cosine_topk(q, k=5))
