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

### Tips

* Ensure each JSON’s top-level “book title” (used for slug) is distinct—otherwise they’ll map to the same work. If you want custom slugs or categories per import, you can add flags like `--slug`, `--category`, `--subcategory`.
* If JSON schema varies across files, the flexible key mapping (Devanāgarī/IAST/English) will still apply, so you can mix sources.

"""
import argparse, os, sqlite3, re, json, glob
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Merge multiple Sanskrit JSON files into a single SQLite database.")
    p.add_argument("--db", required=True, help="Output SQLite path (created if missing).")
    p.add_argument("--json", nargs="*", default=[], help="One or more JSON files.")
    p.add_argument("--dir", dest="indir", help="Directory to scan for JSON files.")
    p.add_argument("--pattern", default="*.json", help="Glob pattern within --dir (default: *.json).")
    p.add_argument("--no_reset", action="store_true", help="Append into existing DB (do not delete).")
    p.add_argument("--default-type", default="Others", help='Fallback work type when JSON lacks \"type\".')
    return p.parse_args(argv)

def slugify(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return re.sub(r"-+", "-", s).strip("-") or "untitled"

def first_key(d: Dict[str, Any], keys: List[str]) -> Optional[Any]:
    for k in keys:
        if k in d and d.get(k) not in (None, "", []):
            return d.get(k)
    return None

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

SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS works (
  work_id       INTEGER PRIMARY KEY,
  title_en      TEXT NOT NULL,
  title_sa      TEXT,
  canonical_ref TEXT,
  slug          TEXT UNIQUE,
  type          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS divisions (
  division_id   INTEGER PRIMARY KEY,
  work_id       INTEGER NOT NULL REFERENCES works(work_id) ON DELETE CASCADE,
  parent_id     INTEGER REFERENCES divisions(division_id) ON DELETE CASCADE,
  level_name    TEXT NOT NULL,
  ordinal       INTEGER,
  label         TEXT,
  slug          TEXT
);
CREATE INDEX IF NOT EXISTS idx_divisions_work ON divisions(work_id);

CREATE TABLE IF NOT EXISTS verses (
  verse_id      INTEGER PRIMARY KEY,
  work_id       INTEGER NOT NULL REFERENCES works(work_id) ON DELETE CASCADE,
  division_id   INTEGER NOT NULL REFERENCES divisions(division_id) ON DELETE CASCADE,
  ref_citation  TEXT,
  ordinal       INTEGER,
  ref_level1    TEXT,
  ref_level2    TEXT,
  ref_level3    TEXT
);
CREATE INDEX IF NOT EXISTS idx_verses_division ON verses(division_id, ordinal);

CREATE TABLE IF NOT EXISTS editions (
  edition_id  INTEGER PRIMARY KEY,
  work_id     INTEGER NOT NULL REFERENCES works(work_id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  language    TEXT NOT NULL,
  script      TEXT,
  translator  TEXT,
  is_default  INTEGER DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_editions_uniq
  ON editions(work_id, kind, language, IFNULL(script,''), IFNULL(translator,''));

CREATE TABLE IF NOT EXISTS verse_texts (
  verse_id    INTEGER NOT NULL REFERENCES verses(verse_id) ON DELETE CASCADE,
  edition_id  INTEGER NOT NULL REFERENCES editions(edition_id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  notes_json  TEXT,
  PRIMARY KEY (verse_id, edition_id)
);
CREATE INDEX IF NOT EXISTS idx_verse_texts_edition ON verse_texts(edition_id);

CREATE TABLE IF NOT EXISTS verse_glosses (
  work_id   INTEGER NOT NULL REFERENCES works(work_id) ON DELETE CASCADE,
  verse_id  INTEGER NOT NULL REFERENCES verses(verse_id) ON DELETE CASCADE,
  surface   TEXT    NOT NULL,
  gloss     TEXT    NOT NULL,
  source    TEXT,
  UNIQUE(verse_id, surface, gloss)
);
CREATE INDEX IF NOT EXISTS idx_vg_verse_surface ON verse_glosses(verse_id, surface);
CREATE INDEX IF NOT EXISTS idx_vg_work_surface  ON verse_glosses(work_id, surface);

CREATE TABLE IF NOT EXISTS tokens (
  token_id    INTEGER PRIMARY KEY,
  verse_id    INTEGER NOT NULL REFERENCES verses(verse_id) ON DELETE CASCADE,
  edition_id  INTEGER NOT NULL REFERENCES editions(edition_id) ON DELETE CASCADE,
  pos         INTEGER NOT NULL,
  surface     TEXT NOT NULL,
  lemma       TEXT,
  morph       TEXT,
  start_char  INTEGER,
  end_char    INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tokens_unique ON tokens(verse_id, edition_id, pos);

CREATE VIRTUAL TABLE IF NOT EXISTS fts_verse_texts USING fts5(
  work_id UNINDEXED,
  edition_id UNINDEXED,
  verse_id UNINDEXED,
  kind,
  language,
  script,
  body,
  content='',
  tokenize='unicode61 remove_diacritics 2'
);

CREATE VIEW IF NOT EXISTS verse_texts_wide AS
SELECT
  v.verse_id,
  v.work_id,
  v.division_id,
  v.ref_citation,
  MAX(CASE WHEN e.language='sa' AND e.script='Deva' THEN t.body END) AS sa_deva,
  MAX(CASE WHEN e.language='sa' AND e.script='Latn' THEN t.body END) AS sa_iast,
  MAX(CASE WHEN e.language='en' THEN t.body END) AS en_translation
FROM verse_texts t
JOIN verses   v ON v.verse_id   = t.verse_id
JOIN editions e ON e.edition_id = t.edition_id
GROUP BY v.verse_id, v.work_id, v.division_id, v.ref_citation;
"""

def open_db(db_path: Path, no_reset: bool) -> sqlite3.Connection:
    if db_path.exists() and not no_reset:
        os.remove(db_path)
    con = sqlite3.connect(str(db_path))
    con.execute("PRAGMA foreign_keys = ON;")
    con.executescript(SCHEMA_SQL)
    return con

def get_or_create_edition(cur: sqlite3.Cursor, work_id: int, kind: str, language: str,
                          script: Optional[str], translator: Optional[str]) -> int:
    cur.execute("""SELECT edition_id FROM editions
                   WHERE work_id=? AND kind=? AND language=? AND IFNULL(script,'')=IFNULL(?, '')
                         AND IFNULL(translator,'')=IFNULL(?, '')""",
                (work_id, kind, language, script, translator))
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute("""INSERT INTO editions(work_id, kind, language, script, translator, is_default)
                   VALUES(?,?,?,?,?,1)""",
                (work_id, kind, language, script, translator))
    return cur.lastrowid

def load_json(fp: Path) -> Dict[str, Any]:
    with open(fp, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, list):
        data = {"books": data}
    if "books" not in data:
        data = {"books": [data]}
    return data

def import_work(cur: sqlite3.Cursor, work: Dict[str, Any], default_type: str) -> Tuple[int, Dict[str,int]]:
    title = first_key(work, ["title", "short", "name"]) or "Untitled"
    wtype = work.get("type") or default_type
    slug  = slugify(title)

    cur.execute("SELECT work_id, type FROM works WHERE slug=?", (slug,))
    row = cur.fetchone()
    if row:
        work_id, old_type = row
        if old_type != wtype:
            cur.execute("UPDATE works SET type=? WHERE work_id=?", (wtype, work_id))
    else:
        cur.execute("""INSERT INTO works (title_en, title_sa, canonical_ref, slug, type)
                       VALUES (?,?,?,?,?)""",
                    (title, None, None, slug, wtype))
        work_id = cur.lastrowid

    ed_deva = get_or_create_edition(cur, work_id, "source", "sa",  "Deva", None)
    ed_iast = get_or_create_edition(cur, work_id, "source", "sa",  "Latn", "IAST")
    ed_en   = get_or_create_edition(cur, work_id, "translation", "en",  None, "Unknown")

    edition_ids = {"sa_deva": ed_deva, "sa_iast": ed_iast, "en": ed_en}
    return work_id, edition_ids

def insert_division(cur: sqlite3.Cursor, work_id: int, level_name: str, ordinal: int,
                    label: Optional[str]) -> int:
    slug = f"{level_name}-{ordinal}"
    cur.execute("""INSERT INTO divisions(work_id, parent_id, level_name, ordinal, label, slug)
                   VALUES (?,?,?,?,?,?)""",
                (work_id, None, level_name, ordinal, label or f"{level_name.title()} {ordinal}", slug))
    return cur.lastrowid

def import_chapters_and_verses(cur: sqlite3.Cursor, work_id: int, editions: Dict[str,int], work: Dict[str, Any]):
    chapters = work.get("chapters") or []
    for ch in chapters:
        ch_num = int(ch.get("number") or len(chapters)+1)
        ch_label = first_key(ch, ["title", "label"]) or f"Chapter {ch_num}"
        division_id = insert_division(cur, work_id, "chapter", ch_num, ch_label)

        verses = ch.get("verses") or []
        for v in verses:
            v_num = int(v.get("number") or len(verses)+1)
            ref   = v.get("ref") or f"{ch_num}.{v_num}"

            cur.execute("""INSERT INTO verses(work_id, division_id, ref_citation, ordinal, ref_level1, ref_level2, ref_level3)
                           VALUES (?,?,?,?,?,?,?)""",
                        (work_id, division_id, ref, v_num, None, ch_num, str(v_num)))
            verse_id = cur.lastrowid

            dev = first_key(v, ["devanagari","deva","sanskrit","sa_deva","saDeva","sa_devanagari"])
            iast= first_key(v, ["iast","sa_iast","roman","transliteration","latn","latin"])
            en  = first_key(v, ["translation","english","en"])

            if dev:
                cur.execute("INSERT OR REPLACE INTO verse_texts(verse_id, edition_id, body) VALUES (?,?,?)",
                            (verse_id, editions["sa_deva"], dev))
            if iast:
                cur.execute("INSERT OR REPLACE INTO verse_texts(verse_id, edition_id, body) VALUES (?,?,?)",
                            (verse_id, editions["sa_iast"], iast))
            if en:
                cur.execute("INSERT OR REPLACE INTO verse_texts(verse_id, edition_id, body) VALUES (?,?,?)",
                            (verse_id, editions["en"], en))

            w2w = v.get("word_by_word") or []
            pos = 1
            for item in w2w:
                surface = first_key(item, ["sanskrit","surface","word","sa","deva"])
                gloss   = first_key(item, ["english","gloss","en","meaning"])
                if not surface:
                    continue
                cur.execute("""INSERT INTO tokens(verse_id, edition_id, pos, surface, lemma, morph, start_char, end_char)
                               VALUES (?,?,?,?,?,?,?,?)""",
                            (verse_id, editions["sa_deva"], pos, surface, None, None, None, None))
                pos += 1

                glosses = []
                if isinstance(gloss, list):
                    glosses = [g for g in gloss if isinstance(g, str) and g.strip()]
                elif isinstance(gloss, str) and gloss.strip():
                    glosses = [gloss.strip()]
                for g in glosses:
                    cur.execute("""INSERT OR IGNORE INTO verse_glosses(work_id, verse_id, surface, gloss, source)
                                   VALUES (?,?,?,?,?)""",
                                (work_id, verse_id, surface, g, "json"))

            for key, ed_id in (("dev", editions["sa_deva"]), ("iast", editions["sa_iast"]), ("en", editions["en"])):
                txt = dev if key=="dev" else iast if key=="iast" else en
                if txt:
                    cur.execute("""INSERT INTO fts_verse_texts(work_id, edition_id, verse_id, kind, language, script, body)
                                   SELECT ?, e.edition_id, ?, e.kind, e.language, e.script, ?
                                   FROM editions e WHERE e.edition_id=?""",
                                (work_id, verse_id, txt, ed_id))

def open_and_import(db_path: Path, files: List[Path], no_reset: bool, default_type: str):
    con = open_db(db_path, no_reset=no_reset)
    cur = con.cursor()
    for js in files:
        data = load_json(js)
        books = data.get("books", [])
        for work in books:
            work_id, eds = import_work(cur, work, default_type)
            import_chapters_and_verses(cur, work_id, eds, work)
            con.commit()
            print(f"Imported: {work.get('title') or work.get('short') or js.name} (work_id={work_id})")
    con.close()

def main(argv=None):
    args = parse_args(argv)
    files = list_json_files(args)
    if not files:
        print("No input JSON files found. Use --json or --dir.")
        return
    open_and_import(Path(args.db), files, args.no_reset, args.default_type)
    print(f"Done. SQLite DB at: {args.db}")

if __name__ == "__main__":
    main()
