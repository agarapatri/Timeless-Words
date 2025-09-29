#!/usr/bin/env python3
"""Build a lightweight semantic pack from the site SQLite.

This script creates a compact SQLite database containing:
  - passages: verse metadata + flattened text
  - embeddings: per-verse Float32 vectors (stored as BLOB)
  - meta: dense metadata (dimension, algorithm, timestamp)

The embedding algorithm is intentionally simple and deterministic so the
front-end can reproduce query vectors without large ML models.  It mixes
word frequency with character n-grams using a 64-bit FNV-1a hash and L2
normalisation.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import hashlib
import math
import os
import sqlite3
import struct
import sys
from pathlib import Path
from typing import Iterable, Sequence

FNV_OFFSET = 0xcbf29ce484222325
FNV_PRIME = 0x100000001b3
MASK64 = 0xFFFFFFFFFFFFFFFF


def fnv1a64(data: bytes) -> int:
    h = FNV_OFFSET
    for b in data:
        h ^= b
        h = (h * FNV_PRIME) & MASK64
    return h


def tokenize(text: str) -> Iterable[str]:
    token = []
    for ch in text.lower():
        if ch.isalnum():
            token.append(ch)
        else:
            if token:
                yield "".join(token)
                token.clear()
    if token:
        yield "".join(token)


def add_features(vec: list[float], token: str, dim: int) -> None:
    if not token:
        return
    h = fnv1a64(token.encode("utf-8")) % dim
    vec[h] += 1.0
    if len(token) >= 4:
        for i in range(len(token) - 1):
            bigram = token[i : i + 2]
            h2 = fnv1a64(("bg:" + bigram).encode("utf-8")) % dim
            vec[h2] += 0.5
    if len(token) >= 6:
        for i in range(len(token) - 3):
            quad = token[i : i + 4]
            h3 = fnv1a64(("cg:" + quad).encode("utf-8")) % dim
            vec[h3] += 0.25


def embed_text(texts: Sequence[str], dim: int) -> bytes:
    vec = [0.0] * dim
    for raw in texts:
        if not raw:
            continue
        for token in tokenize(raw):
            add_features(vec, token, dim)
    norm = math.sqrt(sum(v * v for v in vec))
    if norm:
        vec = [v / norm for v in vec]
    return struct.pack("<%df" % dim, *vec)


def gather_rows(con: sqlite3.Connection) -> list[dict]:
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    rows = cur.execute(
        """
        SELECT v.verse_id, v.work_id, v.division_id, v.ordinal AS verse_ord,
               d.ordinal AS chapter_ord,
               COALESCE(w.sa_deva, '') AS sa_deva,
               COALESCE(w.sa_iast, '') AS sa_iast,
               COALESCE(w.en_translation, '') AS en_translation
        FROM verses v
        JOIN divisions d ON d.division_id = v.division_id
        JOIN verse_texts_wide w ON w.verse_id = v.verse_id
        ORDER BY v.verse_id
        """
    ).fetchall()
    return [dict(r) for r in rows]


def build_semantic_db(source: Path, out: Path, dim: int) -> None:
    if not source.exists():
        raise SystemExit(f"Source SQLite not found: {source}")
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        out.unlink()

    src = sqlite3.connect(str(source))
    rows = gather_rows(src)
    src.close()

    if not rows:
        raise SystemExit("No verses found in source database")

    dest = sqlite3.connect(str(out))
    dest.execute("PRAGMA journal_mode = WAL;")
    cur = dest.cursor()

    cur.executescript(
        """
        CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE passages (
          id INTEGER PRIMARY KEY,
          work_id INTEGER NOT NULL,
          division_id INTEGER NOT NULL,
          chapter INTEGER NOT NULL,
          verse_start INTEGER NOT NULL,
          verse_end INTEGER NOT NULL,
          text TEXT NOT NULL
        );
        CREATE TABLE embeddings (
          id INTEGER PRIMARY KEY,
          vector BLOB NOT NULL
        );
        CREATE INDEX idx_passages_work ON passages(work_id);
        """
    )

    ts = _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()
    cur.executemany(
        "INSERT INTO meta(key, value) VALUES (?, ?)",
        [
            ("dim", str(dim)),
            ("algorithm", "hashed-fnv1a64"),
            ("built_at", ts),
            ("source", str(source)),
        ],
    )

    for row in rows:
        verse_id = int(row["verse_id"])
        text_parts = [row.get("en_translation"), row.get("sa_iast"), row.get("sa_deva")]
        combined = "\n".join(part.strip() for part in text_parts if part and part.strip())
        if not combined:
            combined = ""
        vec_blob = embed_text(text_parts, dim)
        cur.execute(
            "INSERT INTO passages(id, work_id, division_id, chapter, verse_start, verse_end, text)"
            " VALUES (?,?,?,?,?,?,?)",
            (
                verse_id,
                int(row["work_id"]),
                int(row["division_id"]),
                int(row.get("chapter_ord") or 0),
                int(row.get("verse_ord") or 0),
                int(row.get("verse_ord") or 0),
                combined,
            ),
        )
        cur.execute(
            "INSERT INTO embeddings(id, vector) VALUES (?, ?)",
            (verse_id, sqlite3.Binary(vec_blob)),
        )

    dest.commit()
    dest.close()
    print(f"Semantic DB written to {out} (rows={len(rows)}, dim={dim})")


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Build semantic embeddings SQLite pack")
    p.add_argument("--source", required=True, help="Path to the content SQLite (from json_to_sqlite_cli.py)")
    p.add_argument("--out", required=True, help="Destination semantic SQLite path")
    p.add_argument("--dim", type=int, default=384, help="Vector dimension (default: 384)")
    return p.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> None:
    args = parse_args(argv)
    build_semantic_db(Path(args.source), Path(args.out), args.dim)


if __name__ == "__main__":
    main(sys.argv[1:])
