# Fix the UNIQUE constraint error by removing expressions in the editions UNIQUE clause.
import sqlite3, os, json, pandas as pd

json_path = "/mnt/data/shiva_puran.json"
db_path = "/mnt/data/vedas_puranas.sqlite"

# Reset DB
if os.path.exists(db_path):
    os.remove(db_path)
con = sqlite3.connect(db_path)
cur = con.cursor()
cur.execute("PRAGMA foreign_keys = ON;")

schema_sql = """
CREATE TABLE works (
  work_id       INTEGER PRIMARY KEY,
  title_en      TEXT NOT NULL,
  title_sa      TEXT,
  category      TEXT NOT NULL,
  subcategory   TEXT,
  canonical_ref TEXT,
  slug          TEXT UNIQUE
);

CREATE TABLE divisions (
  division_id   INTEGER PRIMARY KEY,
  work_id       INTEGER NOT NULL REFERENCES works(work_id) ON DELETE CASCADE,
  parent_id     INTEGER REFERENCES divisions(division_id) ON DELETE CASCADE,
  level_name    TEXT NOT NULL,
  ordinal       INTEGER,
  label         TEXT,
  slug          TEXT,
  UNIQUE(work_id, parent_id, ordinal)
);

CREATE TABLE verses (
  verse_id      INTEGER PRIMARY KEY,
  work_id       INTEGER NOT NULL REFERENCES works(work_id) ON DELETE CASCADE,
  division_id   INTEGER NOT NULL REFERENCES divisions(division_id) ON DELETE CASCADE,
  ref_citation  TEXT NOT NULL,
  ordinal       INTEGER NOT NULL,
  ref_level1    INTEGER,
  ref_level2    INTEGER,
  ref_level3    TEXT,
  UNIQUE(work_id, ref_citation)
);

CREATE TABLE editions (
  edition_id    INTEGER PRIMARY KEY,
  work_id       INTEGER NOT NULL REFERENCES works(work_id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,
  language      TEXT NOT NULL,
  script        TEXT,
  translator    TEXT,
  publisher     TEXT,
  year          INTEGER,
  license       TEXT,
  is_default    INTEGER NOT NULL DEFAULT 0,
  UNIQUE(work_id, kind, language, script, translator, publisher, year)
);

CREATE TABLE verse_texts (
  verse_id      INTEGER NOT NULL REFERENCES verses(verse_id) ON DELETE CASCADE,
  edition_id    INTEGER NOT NULL REFERENCES editions(edition_id) ON DELETE CASCADE,
  body          TEXT NOT NULL,
  notes_json    TEXT,
  PRIMARY KEY (verse_id, edition_id)
);

CREATE TABLE tokens (
  token_id      INTEGER PRIMARY KEY,
  verse_id      INTEGER NOT NULL REFERENCES verses(verse_id) ON DELETE CASCADE,
  edition_id    INTEGER NOT NULL REFERENCES editions(edition_id) ON DELETE CASCADE,
  pos           INTEGER NOT NULL,
  surface       TEXT NOT NULL,
  lemma         TEXT,
  morph         TEXT,
  start_char    INTEGER,
  end_char      INTEGER
);
CREATE UNIQUE INDEX idx_tokens_unique ON tokens(verse_id, edition_id, pos);

CREATE TABLE token_glosses (
  token_id      INTEGER NOT NULL REFERENCES tokens(token_id) ON DELETE CASCADE,
  target_lang   TEXT NOT NULL,
  gloss         TEXT NOT NULL,
  PRIMARY KEY (token_id, target_lang)
);

CREATE INDEX idx_divisions_work ON divisions(work_id);
CREATE INDEX idx_verses_division ON verses(division_id, ordinal);
CREATE INDEX idx_verse_texts_edition ON verse_texts(edition_id);
"""
cur.executescript(schema_sql)

cur.execute("""
CREATE VIRTUAL TABLE fts_verse_texts USING fts5(
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
""")

def slugify(s: str) -> str:
    import re
    s = s.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s

# Load JSON
with open(json_path, "r", encoding="utf-8") as f:
    data = json.load(f)

work_count = 0
div_count = 0
verse_count = 0
token_count = 0

for book in data.get("books", []):
    title = book.get("title") or book.get("short") or "Unknown"
    work_slug = slugify(title)
    cur.execute(
        "INSERT INTO works (title_en, title_sa, category, subcategory, canonical_ref, slug) VALUES (?,?,?,?,?,?)",
        (title, None, "Purana", "Shaiva", None, work_slug)
    )
    work_id = cur.lastrowid
    work_count += 1

    # editions
    cur.execute("""INSERT INTO editions (work_id, kind, language, script, translator, is_default)
                   VALUES (?,?,?,?,?,1)""", (work_id, "source", "sa", "Deva", None))
    ed_sa_deva = cur.lastrowid

    cur.execute("""INSERT INTO editions (work_id, kind, language, script, translator, is_default)
                   VALUES (?,?,?,?,?,1)""", (work_id, "source", "sa", "Latn", "IAST"))
    ed_sa_iast = cur.lastrowid

    cur.execute("""INSERT INTO editions (work_id, kind, language, script, translator, is_default)
                   VALUES (?,?,?,?,?,1)""", (work_id, "translation", "en", None, "Unknown"))
    ed_en = cur.lastrowid

    for ch in book.get("chapters", []):
        ch_num = ch.get("number")
        ch_label = ch.get("title") or f"Chapter {ch_num}"
        ch_slug = f"chapter-{ch_num}"
        cur.execute("""INSERT INTO divisions (work_id, parent_id, level_name, ordinal, label, slug)
                       VALUES (?,?,?,?,?,?)""", (work_id, None, "chapter", ch_num, ch_label, ch_slug))
        division_id = cur.lastrowid
        div_count += 1

        for v in ch.get("verses", []):
            v_num = v.get("number")
            ref = v.get("ref") or f"{ch_num}.{v_num}"
            cur.execute("""INSERT INTO verses
                           (work_id, division_id, ref_citation, ordinal, ref_level1, ref_level2, ref_level3)
                           VALUES (?,?,?,?,?,?,?)""",
                        (work_id, division_id, ref, v_num, None, ch_num, str(v_num)))
            verse_id = cur.lastrowid
            verse_count += 1

            dev = v.get("devanagari")
            iast = v.get("iast")
            en = v.get("translation")

            if dev:
                cur.execute("INSERT INTO verse_texts (verse_id, edition_id, body) VALUES (?,?,?)",
                            (verse_id, ed_sa_deva, dev))
            if iast:
                cur.execute("INSERT INTO verse_texts (verse_id, edition_id, body) VALUES (?,?,?)",
                            (verse_id, ed_sa_iast, iast))
            if en:
                cur.execute("INSERT INTO verse_texts (verse_id, edition_id, body) VALUES (?,?,?)",
                            (verse_id, ed_en, en))

            w2w = v.get("word_by_word") or []
            pos = 1
            for item in w2w:
                surface = item.get("sanskrit")
                gloss = item.get("english")
                if not surface:
                    continue
                cur.execute("""INSERT INTO tokens (verse_id, edition_id, pos, surface, lemma, morph, start_char, end_char)
                               VALUES (?,?,?,?,?,?,?,?)""",
                            (verse_id, ed_sa_deva, pos, surface, None, None, None, None))
                tok_id = cur.lastrowid
                token_count += 1
                if gloss:
                    cur.execute("""INSERT INTO token_glosses (token_id, target_lang, gloss)
                                   VALUES (?,?,?)""", (tok_id, "en", gloss))
                pos += 1

# Bulk-populate FTS
cur.execute("""
INSERT INTO fts_verse_texts (work_id, edition_id, verse_id, kind, language, script, body)
SELECT e.work_id, vt.edition_id, vt.verse_id, e.kind, e.language, IFNULL(e.script,''), vt.body
FROM verse_texts vt
JOIN editions e ON e.edition_id = vt.edition_id;
""")

con.commit()

# Show summary
summary = pd.DataFrame([{
    "db_path": db_path,
    "works": work_count,
    "divisions": div_count,
    "verses": verse_count,
    "tokens": token_count
}])
import caas_jupyter_tools
caas_jupyter_tools.display_dataframe_to_user("SQLite build summary", summary)

db_path
