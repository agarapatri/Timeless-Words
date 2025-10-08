# This script performs quick checks on the semantic embedding database to ensure data integrity.

import sys
import sqlite3
from pathlib import Path

def autodetect_db() -> Path | None:
    here = Path(__file__).resolve()
    docs = here.parents[2]  # .../docs
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
        raise SystemExit("DB not found. Pass path: python quick_checks.py /path/to/db.sqlite")
    return p

def main():
    db_path = require_db_from_argv_or_autodetect()
    print(f"[quick_checks] DB: {db_path}")

    # Basic file checks
    size_mb = db_path.stat().st_size / (1024 * 1024)
    print(f"[quick_checks] size ≈ {size_mb:.2f} MB")

    with sqlite3.connect(str(db_path)) as con:
        con.row_factory = sqlite3.Row

        # Integrity
        ok = con.execute("PRAGMA integrity_check;").fetchone()[0]
        print(f"[quick_checks] integrity_check: {ok}")
        if ok != "ok":
            raise SystemExit("[quick_checks] integrity_check failed")

        # Quick table inventory
        rows = con.execute(
            "SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY type, name;"
        ).fetchall()
        print("[quick_checks] objects:")
        for r in rows:
            print(f"  - {r['type']}: {r['name']}")

        # Row counts for small number of tables (skip huge tables after a cap)
        for r in rows[:10]:
            if r["type"] == "table":
                try:
                    cnt = con.execute(f"SELECT COUNT(*) FROM '{r['name']}'").fetchone()[0]
                    print(f"    count({r['name']}): {cnt}")
                except sqlite3.Error:
                    print(f"    count({r['name']}): <skipped>")

    print("[quick_checks] OK")

if __name__ == "__main__":
    main()
