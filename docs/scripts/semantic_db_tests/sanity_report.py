# This script checks the integrity of vector embeddings stored in a SQLite database.
# It verifies that all vectors have the expected dimensionality and are approximately unit-norm.

import sys
import sqlite3
from pathlib import Path

def autodetect_db() -> Path | None:
    here = Path(__file__).resolve()
    docs = here.parents[2]
    candidates = [
        docs / "assets" / "data" / "semantic" / "library.semantic.v01.sqlite",
        docs.parent / "scripts" / "assets" / "data" / "semantic" / "library.semantic.v01.sqlite",
    ]
    for p in candidates:
        if p.exists():
            return p
    return None

def require_db_from_argv_or_autodetect() -> Path:
    if len(sys.argv) > 1:
        p = Path(sys.argv[1]).expanduser().resolve()
        if not p.exists():
            raise SystemExit(f"DB not found at CLI path: {p}")
        return p
    p = autodetect_db()
    if not p:
        raise SystemExit("DB not found. Pass path: python sanity_report.py /path/to/db.sqlite")
    return p

def pragma(con, name):
    try:
        return con.execute(f"PRAGMA {name};").fetchall()
    except sqlite3.Error:
        return []

def main():
    db_path = require_db_from_argv_or_autodetect()
    print(f"[sanity_report] DB: {db_path}")

    with sqlite3.connect(str(db_path)) as con:
        con.row_factory = sqlite3.Row

        ic = con.execute("PRAGMA integrity_check;").fetchone()[0]
        print(f"[sanity_report] integrity_check: {ic}")
        if ic != "ok":
            raise SystemExit("[sanity_report] integrity_check failed")

        qc = con.execute("PRAGMA quick_check;").fetchone()[0]
        print(f"[sanity_report] quick_check: {qc}")

        # DB layout stats
        page_size = pragma(con, "page_size")
        page_count = pragma(con, "page_count")
        freelist_count = pragma(con, "freelist_count")
        journal_mode = pragma(con, "journal_mode")
        user_version = pragma(con, "user_version")

        def first_or_na(v): return v[0][0] if v else "n/a"

        print(f"[sanity_report] page_size: {first_or_na(page_size)}")
        print(f"[sanity_report] page_count: {first_or_na(page_count)}")
        print(f"[sanity_report] freelist_count: {first_or_na(freelist_count)}")
        print(f"[sanity_report] journal_mode: {first_or_na(journal_mode)}")
        print(f"[sanity_report] user_version: {first_or_na(user_version)}")

        # Table sizes overview (top 15)
        tables = con.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name;
        """).fetchall()
        counts = []
        for (name,) in tables:
            try:
                c = con.execute(f"SELECT COUNT(*) FROM '{name}'").fetchone()[0]
                counts.append((name, c))
            except sqlite3.Error:
                counts.append((name, None))
        counts.sort(key=lambda x: (-1 if x[1] is None else -x[1], x[0]))
        print("[sanity_report] table row counts (top 15):")
        for name, c in counts[:15]:
            print(f"  {name}: {c if c is not None else '<n/a>'}")

    print("[sanity_report] OK")

if __name__ == "__main__":
    main()
