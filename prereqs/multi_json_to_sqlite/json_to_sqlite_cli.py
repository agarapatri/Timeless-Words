"""
Multi-JSON → Single SQLite converter for Sanskrit corpus

You can load **multiple JSON files into the same SQLite DB**—two key points:

1. **Don’t delete the DB between runs**
   Use the existing `--no_reset` flag (i.e., append mode).

2. **Make schema + inserts idempotent**
   The importer only creates the schema if it’s missing, and it will **reuse an existing work** by `slug` (so running the same file twice won’t duplicate the work).


### Workflow

```bash
# 1) Multiple specific files → one DB (create new DB)

python json_to_sqlite_cli.py \
  --db /path/to/library.sqlite \
  --json /path/to/vishnu_puran.json /path/to/shiva_puran.json

# 2) Append more later (keep existing DB)

python json_to_sqlite_cli.py \
  --db /path/to/library.sqlite \
  --json /path/to/padma_puran.json \
  --no_reset

# 3) Import a whole folder

python json_to_sqlite_cli.py \
  --db /path/to/library.sqlite \
  --dir /path/to/maha_puranas \
  --pattern "*.json" \
  --no_reset
```

### What it does

* Creates a future-proof schema (works, divisions, verses, editions, verse\_texts, tokens, verse\_glosses, FTS + a wide view).
* Reads each JSON (supports `{"books":[...]}`, a single work object, or a top-level list).
* Takes **`type`** directly from your JSON per work (no hardcoding).
* Stores **Devanāgarī / IAST / English as separate editions** and also provides a **`verse_texts_wide` view** for one-row-per-verse display.
* Saves **word-by-word meanings per verse** (`verse_glosses`) so context never overwrites.
* Future: CLI flags to force a specific `type` override, auto-infer chapter labels, or stricter JSON key validation.

* **Schema guard:** Before running `CREATE TABLE ...`, the script checks `sqlite_master` for `works`. If present, it **skips** schema creation (avoids errors).
* **Append mode:** `--no_reset` prevents deleting the DB if it exists.
* **Idempotent work insert:** It checks `works.slug` first; if found, it **reuses** that `work_id` instead of inserting a duplicate.

- Accepts multiple JSON files (via --json ... or --dir + --pattern)
- Appends all works into one SQLite DB
- Reads "type" per work straight from JSON (no hardcoded categories)
- Adds a work_types table for site filters; works references it via work_type_code
- Stores origin/published dates on works
- Keeps text variants normalized (editions + verse_texts) and exposes a 'wide' view
- Stores word-by-word meanings per verse (verse_glosses)

### JSON shapes supported:
  A) { "type": "...", "title": "...", "chapters": [ {..., "verses": [...] } ] }
  B) { "books": [ { ...work object as in (A)... }, ... ] }
  C) [ { ...work object as in (A)... }, ... ]

### Tips

* Ensure each JSON’s top-level “book title” (used for slug) is distinct—otherwise they’ll map to the same work. If you want custom slugs or categories per import, you can add flags like `--slug`, `--category`, `--subcategory`.
* If JSON schema varies across files, the flexible key mapping (Devanāgarī/IAST/English) will still apply, so you can mix sources.

"""
import argparse, os, sqlite3, re, json, glob
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Convert VP-style JSON files into a single SQLite DB.")
    p.add_argument("--db", required=True, help="Output SQLite path (created if missing).")
    p.add_argument("--json", nargs="*", default=[], help="One or more JSON files of the VP style.")
    p.add_argument("--dir", dest="indir", help="Directory to scan for JSON files.")
    p.add_argument("--pattern", default="*.json", help="Glob pattern within --dir (default: *.json).")
    p.add_argument("--no_reset", action="store_true", help="Append into existing DB (do not delete).")
    return p.parse_args(argv)

def slugify(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return re.sub(r"-+", "-", s).strip("-") or "untitled"

def list_json_files(args) -> List[Path]:
    files: List[Path] = []
    files += [Path(f) for f in args.json]
    if args.indir:
        files += [Path(p) for p in glob.glob(str(Path(args.indir) / args.pattern))]
    seen, uniq = set(), []
    for f in files:
        if f.exists() and f.suffix.lower() == ".json" and str(f) not in seen:
            seen.add(str(f))
            uniq.append(f)
    return uniq

def f_parse_origin_range(text: Optional[str]) -> Tuple[Optional[int], Optional[int]]:
    if not text or not isinstance(text, str):
        return (None, None)
    t = text.strip().lower()
    m = re.search(r'(\d+)\s*(st|nd|rd|th)\s*century\s*(bce|ce)', t)
    if m:
        century = int(m.group(1)); era = m.group(3)
        if era == "bce":
            return (-century*100, -((century-1)*100+1))
        else:
            return ((century-1)*100+1, century*100)
    m2 = re.search(r'(\d{1,4})\s*(bce|ce)', t)
    if m2:
        year = int(m2.group(1)); era = m2.group(2)
        return (-year, -year) if era=="bce" else (year, year)
    return (None, None)

SCHEMA_SQL = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS work_types (code TEXT PRIMARY KEY, label TEXT NOT NULL, description TEXT);
CREATE TABLE IF NOT EXISTS works (
  work_id INTEGER PRIMARY KEY,
  title_en TEXT NOT NULL,
  title_sa TEXT,
  author TEXT,
  canonical_ref TEXT,
  slug TEXT UNIQUE,
  work_type_code TEXT NOT NULL REFERENCES work_types(code),
  date_origin_start INTEGER,
  date_origin_end INTEGER,
  date_published TEXT
);
CREATE TABLE IF NOT EXISTS divisions (
  division_id INTEGER PRIMARY KEY,
  work_id INTEGER NOT NULL REFERENCES works(work_id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES divisions(division_id) ON DELETE CASCADE,
  level_name TEXT NOT NULL,
  ordinal INTEGER,
  label TEXT,
  slug TEXT
);
CREATE INDEX IF NOT EXISTS idx_divisions_work ON divisions(work_id);
CREATE TABLE IF NOT EXISTS verses (
  verse_id INTEGER PRIMARY KEY,
  work_id INTEGER NOT NULL REFERENCES works(work_id) ON DELETE CASCADE,
  division_id INTEGER NOT NULL REFERENCES divisions(division_id) ON DELETE CASCADE,
  ref_citation TEXT,
  ordinal INTEGER
);
CREATE INDEX IF NOT EXISTS idx_verses_division ON verses(division_id, ordinal);
CREATE TABLE IF NOT EXISTS editions (
  edition_id INTEGER PRIMARY KEY,
  work_id INTEGER NOT NULL REFERENCES works(work_id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  language TEXT NOT NULL,
  script TEXT,
  translator TEXT,
  is_default INTEGER DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_editions_uniq ON editions(work_id, kind, language, IFNULL(script,''), IFNULL(translator,''));
CREATE TABLE IF NOT EXISTS verse_texts (
  verse_id INTEGER NOT NULL REFERENCES verses(verse_id) ON DELETE CASCADE,
  edition_id INTEGER NOT NULL REFERENCES editions(edition_id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  notes_json TEXT,
  PRIMARY KEY (verse_id, edition_id)
);
CREATE INDEX IF NOT EXISTS idx_verse_texts_edition ON verse_texts(edition_id);
CREATE TABLE IF NOT EXISTS verse_glosses (
  work_id INTEGER NOT NULL REFERENCES works(work_id) ON DELETE CASCADE,
  verse_id INTEGER NOT NULL REFERENCES verses(verse_id) ON DELETE CASCADE,
  surface TEXT NOT NULL,
  gloss TEXT NOT NULL,
  source TEXT,
  UNIQUE(verse_id, surface, gloss)
);
CREATE INDEX IF NOT EXISTS idx_vg_verse_surface ON verse_glosses(verse_id, surface);
CREATE INDEX IF NOT EXISTS idx_vg_work_surface ON verse_glosses(work_id, surface);
CREATE TABLE IF NOT EXISTS tokens (
  token_id INTEGER PRIMARY KEY,
  verse_id INTEGER NOT NULL REFERENCES verses(verse_id) ON DELETE CASCADE,
  edition_id INTEGER NOT NULL REFERENCES editions(edition_id) ON DELETE CASCADE,
  pos INTEGER NOT NULL,
  surface TEXT NOT NULL
);
CREATE VIRTUAL TABLE IF NOT EXISTS fts_verse_texts USING fts5(
  work_id UNINDEXED, edition_id UNINDEXED, verse_id UNINDEXED,
  kind, language, script, body, content='', tokenize='unicode61 remove_diacritics 2'
);
CREATE VIEW IF NOT EXISTS verse_texts_wide AS
SELECT v.verse_id, v.work_id, v.division_id, v.ref_citation,
  MAX(CASE WHEN e.language='sa' AND e.script='Deva' THEN t.body END) AS sa_deva,
  MAX(CASE WHEN e.language='sa' AND e.script='Latn' THEN t.body END) AS sa_iast,
  MAX(CASE WHEN e.language='en' THEN t.body END) AS en_translation
FROM verse_texts t
JOIN verses v ON v.verse_id=t.verse_id
JOIN editions e ON e.edition_id=t.edition_id
GROUP BY v.verse_id, v.work_id, v.division_id, v.ref_citation;
"""

def open_db(db_path: Path, no_reset: bool) -> sqlite3.Connection:
    if db_path.exists() and not no_reset:
        os.remove(db_path)
    con = sqlite3.connect(str(db_path))
    con.execute("PRAGMA foreign_keys = ON;")
    con.executescript(SCHEMA_SQL)
    return con

def get_or_create_type(cur: sqlite3.Cursor, code: str) -> str:
    code = (code or "").strip() or "Others"
    cur.execute("SELECT code FROM work_types WHERE code=?", (code,))
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute("INSERT INTO work_types(code, label) VALUES (?,?)", (code, code))
    return code

def get_or_create_edition(cur: sqlite3.Cursor, work_id: int, kind: str, language: str, script: Optional[str], translator: Optional[str]) -> int:
    cur.execute("""SELECT edition_id FROM editions
                   WHERE work_id=? AND kind=? AND language=? AND IFNULL(script,'')=IFNULL(?, '') AND IFNULL(translator,'')=IFNULL(?, '')""",
                (work_id, kind, language, script, translator))
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute("""INSERT INTO editions(work_id, kind, language, script, translator, is_default)
                   VALUES(?,?,?,?,?,1)""",
                (work_id, kind, language, script, translator))
    return cur.lastrowid

def import_file(cur: sqlite3.Cursor, data: Dict[str, Any]) -> int:
    title = data.get("title") or "Untitled"
    slug  = data.get("id") or slugify(title)
    author= data.get("author")
    type_code = get_or_create_type(cur, data.get("type"))

    start, end = f_parse_origin_range(data.get("date_of_origin"))

    cur.execute("SELECT work_id FROM works WHERE slug=?", (slug,))
    row = cur.fetchone()
    if row:
        work_id = row[0]
        cur.execute("""UPDATE works SET title_en=?, author=?, work_type_code=?, date_origin_start=?, date_origin_end=? WHERE work_id=?""",
                    (title, author, type_code, start, end, work_id))
    else:
        cur.execute("""INSERT INTO works (title_en, title_sa, author, canonical_ref, slug, work_type_code, date_origin_start, date_origin_end, date_published)
                       VALUES (?,?,?,?,?,?,?,?,?)""",
                    (title, None, author, None, slug, type_code, start, end, None))
        work_id = cur.lastrowid

    ed_deva = get_or_create_edition(cur, work_id, "source", "sa", "Deva", None)
    ed_iast = get_or_create_edition(cur, work_id, "source", "sa", "Latn", "IAST")
    ed_en   = get_or_create_edition(cur, work_id, "translation", "en", None, "Unknown")

    chapters = data.get("chapters") or []
    for ch in chapters:
        ch_num = int(ch.get("number") or (len(chapters)+1))
        ch_label = ch.get("title") or f"Chapter {ch_num}"
        slug_div = f"chapter-{ch_num}"
        cur.execute("""INSERT INTO divisions(work_id, parent_id, level_name, ordinal, label, slug) VALUES (?,?,?,?,?,?)""",
                    (work_id, None, "chapter", ch_num, ch_label, slug_div))
        division_id = cur.lastrowid

        verses = ch.get("verses") or []
        for v in verses:
            v_num = int(v.get("number") or (len(verses)+1))
            ref   = v.get("ref") or f"{ch_num}.{v_num}"
            cur.execute("""INSERT INTO verses(work_id, division_id, ref_citation, ordinal) VALUES (?,?,?,?)""",
                        (work_id, division_id, ref, v_num))
            verse_id = cur.lastrowid

            dev = v.get("devanagari"); iast = v.get("iast"); en = v.get("translation")
            if dev:
                cur.execute("INSERT OR REPLACE INTO verse_texts(verse_id, edition_id, body) VALUES (?,?,?)", (verse_id, ed_deva, dev))
            if iast:
                cur.execute("INSERT OR REPLACE INTO verse_texts(verse_id, edition_id, body) VALUES (?,?,?)", (verse_id, ed_iast, iast))
            if en:
                cur.execute("INSERT OR REPLACE INTO verse_texts(verse_id, edition_id, body) VALUES (?,?,?)", (verse_id, ed_en, en))

            w2w = v.get("word_by_word") or []
            pos = 1
            for item in w2w:
                surface = item.get("sanskrit"); gloss = item.get("english")
                if not surface: 
                    continue
                cur.execute("INSERT INTO tokens(verse_id, edition_id, pos, surface) VALUES (?,?,?,?)", (verse_id, ed_deva, pos, surface))
                pos += 1
                glist = [g for g in (gloss if isinstance(gloss, list) else [gloss]) if isinstance(g, str) and g and g.strip()] if gloss else []
                for g in glist:
                    cur.execute("""INSERT OR IGNORE INTO verse_glosses(work_id, verse_id, surface, gloss, source) VALUES (?,?,?,?,?)""",
                                (work_id, verse_id, surface, g.strip(), "json"))

            for ed_id, txt in ((ed_deva, dev), (ed_iast, iast), (ed_en, en)):
                if txt:
                    cur.execute("""INSERT INTO fts_verse_texts(work_id, edition_id, verse_id, kind, language, script, body)
                                   SELECT ?, e.edition_id, ?, e.kind, e.language, e.script, ? FROM editions e WHERE e.edition_id=?""",
                                (work_id, verse_id, txt, ed_id))

    return work_id

def main(argv=None):
    args = parse_args(argv)
    db_path = Path(args.db)
    files = []
    files += [Path(f) for f in args.json]
    if args.indir:
        files += [Path(p) for p in glob.glob(str(Path(args.indir) / args.pattern))]
    files = [f for f in files if f.exists() and f.suffix.lower()==".json"]

    if db_path.exists() and not args.no_reset:
        os.remove(db_path)
    con = sqlite3.connect(str(db_path))
    con.execute("PRAGMA foreign_keys = ON;")
    con.executescript(SCHEMA_SQL)
    cur = con.cursor()

    for fp in files:
        with open(fp, "r", encoding="utf-8") as f:
            data = json.load(f)
        wid = import_file(cur, data)
        con.commit()
        print(f"Imported {data.get('title')} (work_id={wid}) from {fp}")

    con.close()
    print(f"Done. SQLite DB at: {db_path}")

if __name__ == "__main__":
    main()
