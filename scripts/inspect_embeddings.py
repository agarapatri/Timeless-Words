# Inspect the contents of the embeddings database - checks if it is transformer based or not.

from pathlib import Path
import sqlite3
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "assets" / "data" / "semantic" / "library.semantic.v01.sqlite"

def table_exists(cur, name):
    q = "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?"
    return cur.execute(q, (name,)).fetchone() is not None

def main():
    if not DB_PATH.exists():
        raise FileNotFoundError(f"DB not found: {DB_PATH}")

    con = sqlite3.connect(str(DB_PATH))
    cur = con.cursor()

    print(f"DB: {DB_PATH}")

    # Meta
    if table_exists(cur, "meta"):
        meta = dict(cur.execute("SELECT key, value FROM meta").fetchall())
        print("meta keys:", sorted(meta.keys()))
        if "dim" in meta:
            print("declared dim:", meta["dim"])

    # Counts
    emb_n = cur.execute("SELECT COUNT(*) FROM embeddings").fetchone()[0] if table_exists(cur, "embeddings") else 0
    pas_n = cur.execute("SELECT COUNT(*) FROM passages").fetchone()[0] if table_exists(cur, "passages") else 0
    print(f"rows: embeddings={emb_n}, passages={pas_n}")

    # Sample vector
    if emb_n:
        row = cur.execute("SELECT id, vector FROM embeddings LIMIT 1").fetchone()
        vec = np.frombuffer(row[1], dtype=np.float32)
        print(f"sample id: {row[0]}  shape: {vec.shape}  l2_norm: {np.linalg.norm(vec):.4f}")

    # Basic integrity check: 1-1 mapping if passages exist
    if emb_n and pas_n:
        mismatches = cur.execute("""
            SELECT COUNT(*)
            FROM passages p
            LEFT JOIN embeddings e ON e.id = p.id
            WHERE e.id IS NULL
        """).fetchone()[0]
        print(f"id mapping mismatches: {mismatches}")

    con.close()

if __name__ == "__main__":
    main()
