
# Why SQLite?
**Prebuilt SQLite in the browser (WASM + FTS5) is about as good as it gets for a static site** today. It gives you one canonical dataset, fast diacritic-insensitive search, true pagination, and zero server code.
* **Single source of truth**: one `.sqlite` file (no JSON duplication).
* **Snappy search**: FTS5 with `unicode61 remove_diacritics` ⇒ “e” matches “é/è/ê/ē”, “krishna” matches “kṛṣṇa”, plus ranking & snippets.
* **Small runtime code**: a WASM engine (\~1–1.5 MB, cached) and thin JS.
* **Lazy data**: with http-VFS chunking, the browser fetches only the pages it needs; you’re not loading 200 books up front.
* **Clean pages**: `SELECT … LIMIT/OFFSET` for real pagination; simple queries for
  * Home: `SELECT id,title,author,chapter_count,verse_count FROM books…`
  * Book: `SELECT number,title FROM chapters WHERE book_id=?…`
  * Chapter: `SELECT number,translation FROM verses WHERE book_id=? AND chapter=?…`
  * Verse: `SELECT devanagari,iast,translation,wfw FROM verses WHERE …`
* **Works on GitHub Pages**: all static assets; no server required.
* **Offline-friendly**: add a tiny Service Worker and it works after the first visit.
* **Trade-offs to be aware of**
    * **First load** includes the WASM (\~1–1.5 MB). After caching, it’s negligible.
    * **DB size** matters. Use http-VFS packing so only touched chunks download. (Single monolithic file is fine if small.)
    * **JS-rendered content**: if SEO matters, prerender critical pages or ship a small static “top pages” set.
* **“Production-ready” checklist**
    1. **Build the DB once** (schema + FTS5, diacritic folding).
    2. **Pack for http-VFS** (chunked) and commit `db/*.bin` + `canon.config.json`.
    3. Serve `assets/sql-wasm.wasm` + `assets/sqlite.worker.js`.
    4. Replace your JSON loaders with tiny query helpers (as in the previous message’s `db.js`).
    5. **Pagination** via `LIMIT/OFFSET`.
    6. Optional: add a **Service Worker** to cache `/assets/*` and `/db/*` (stale-while-revalidate).



## SQLite DB Schema

### `work_types`

* **code (TEXT, PK)**: Canonical type string from JSON (`"Maha Puranas"`, `"Upanishads"`, etc.).
* **label (TEXT)**: Display label (often same as `code`).
* **description (TEXT)**: Optional blurb for the site.
  **Why**: Powers homepage/search filters and keeps type values consistent.

### `works`

* **work\_id (INTEGER, PK)**: Surrogate ID.
* **title\_en (TEXT, NOT NULL)**: Display title (English or your preferred language).
* **title\_sa (TEXT)**: Sanskrit title (optional).
* **author (TEXT)**: From JSON if provided.
* **canonical\_ref (TEXT)**: Note on the reference system (optional).
* **slug (TEXT, UNIQUE)**: Stable identifier (usually JSON `id` or slugified title); used for idempotent import.
* **work\_type\_code (TEXT, FK→work\_types.code, NOT NULL)**: Book type for filters.
* **date\_origin\_start (INTEGER)**: Signed year (e.g., `-200` for 200 BCE).
* **date\_origin\_end (INTEGER)**: Signed year (range end if uncertain).
* **date\_published (TEXT)**: ISO date when known (optional).
  **Why**: One row per book; stores the type and dates so you can filter/sort on the homepage and in search.

### `divisions`

* **division\_id (INTEGER, PK)**
* **work\_id (INTEGER, FK)**: Which book.
* **parent\_id (INTEGER, FK→divisions.division\_id)**: Enables nesting (book → canto → chapter…).
* **level\_name (TEXT, NOT NULL)**: `"book"`, `"canto"`, `"chapter"`, etc.
* **ordinal (INTEGER)**: Position under the parent (1-based).
* **label (TEXT)**: Display label (e.g., “Chapter 1”).
* **slug (TEXT)**: Stable per-division within a work.
* **UNIQUE (work\_id, COALESCE(parent\_id,0), level\_name, ordinal)**
  **Why**: Flexible hierarchy without schema changes; unique key prevents duplicate chapters on re-import.

### `verses`

* **verse\_id (INTEGER, PK)**
* **work\_id (INTEGER, FK)**: Which book.
* **division\_id (INTEGER, FK)**: Which chapter (or lowest division).
* **ref\_citation (TEXT)**: Reference string like `1.1`, `1.2.15`, etc.
* **ordinal (INTEGER)**: Verse order inside that division (1-based).
* **UNIQUE (work\_id, division\_id, ordinal)**
  **Why**: A single anchor per verse. Unique key prevents duplicate verses across multiple runs.

### `editions`

* **edition\_id (INTEGER, PK)**
* **work\_id (INTEGER, FK)**
* **kind (TEXT, NOT NULL)**: `'source'` or `'translation'`.
* **language (TEXT, NOT NULL)**: e.g., `sa`, `en`, `hi`.
* **script (TEXT)**: e.g., `Deva` (Devanāgarī), `Latn` (IAST); usually NULL for translations.
* **translator (TEXT)**: Optional, for identifying versions.
* **is\_default (INTEGER)**: UI preference toggle.
* **UNIQUE (work\_id, kind, language, COALESCE(script,''), COALESCE(translator,''))**
  **Why**: Lets you add Devanāgarī, IAST, multiple translations, more languages—without new columns.

### `verse_texts`

* **verse\_id (INTEGER, FK)**: Which verse.
* **edition\_id (INTEGER, FK)**: Which edition (e.g., `sa/Deva`, `sa/Latn`, `en`).
* **body (TEXT, NOT NULL)**: The actual text.
* **notes\_json (TEXT)**: Optional JSON for footnotes/provenance.
* **PRIMARY KEY (verse\_id, edition\_id)**
  **Why**: One row per (verse × edition). Clean, scalable storage for multiple scripts/translations.

### `tokens`

* **token\_id (INTEGER, PK)**
* **verse\_id (INTEGER, FK)**: The verse this word belongs to.
* **edition\_id (INTEGER, FK)**: Which source edition was tokenized (typically `sa/Deva`).
* **pos (INTEGER, NOT NULL)**: 1-based position in the verse.
* **surface (TEXT, NOT NULL)**: Word form as printed (usually Devanāgarī).
* **UNIQUE (verse\_id, edition\_id, pos)**
  **Why**: Drives word-level alignment/highlighting. Unique constraint avoids duplicate token positions on re-import.

### `verse_glosses`

* **work\_id (INTEGER, FK)**: Scope (in case verse\_id overlaps across works).
* **verse\_id (INTEGER, FK)**: Which verse.
* **surface (TEXT, NOT NULL)**: Word form (usually matches token’s surface).
* **gloss (TEXT, NOT NULL)**: Meaning for **this verse** (context-dependent).
* **source (TEXT)**: Provenance (`json`, `user`, `dict`, …).
* **UNIQUE (verse\_id, surface, gloss)**
  **Why**: Sanskrit is context-sensitive; meanings are stored **per verse** so the same word can differ elsewhere without conflicts.

### `fts_verse_texts` (FTS5 virtual table)

* **work\_id, edition\_id, verse\_id**: Context for results (UNINDEXED ID columns).
* **kind, language, script**: From `editions`, to filter queries.
* **body**: The searchable text.
  **Why**: Fast, diacritic-aware full-text search, scoped by language/script if needed.

### `verse_texts_wide` (VIEW)

* **verse\_id, work\_id, division\_id, ref\_citation**
* **sa\_deva**: Devanāgarī body if present.
* **sa\_iast**: IAST body if present.
* **en\_translation**: English translation if present.
  **Why**: A convenient UI/view layer: **one row per verse**, while the underlying storage stays flexible.

### Why multiple tables?

* **Flexibility**: Adding a new language, script, or translator is just inserting rows into `editions` + `verse_texts`—no schema changes, no wide-table bloat.
* **Correctness**: A single `verse_id` anchors tokens and per-verse glosses; you don’t duplicate the verse when you add more text variants.
* **Searchability**: FTS works best when each document (edition text) is its own row. You can search only IAST, only Devanāgarī, or only translations.
* **Data integrity**: Unique keys on divisions/verses prevent accidental duplicates on repeated imports.
* **Performance & updates**: Updating IAST for one verse means touching one small row, not a massive denormalized record.

### Pros / Cons / Trade-offs

#### Normalized (what we use)

**Pros**

* Scales cleanly to many languages/editions/translators.
* Per-verse meanings without global overrides.
* Strong FTS and edition-level filtering.
* Minimal writes for updates; easier integrity constraints.

**Cons**

* More tables and joins if you query raw tables.

**Mitigation**

* Use the `verse_texts_wide` **VIEW** for UI and exports to keep things “one row per verse”.

#### Single wide table (alternative)

**Pros**

* Very simple to read/export at first.
* Fewer joins.

**Cons**

* Adding the 2nd translation or a new language forces schema changes or row duplication.
* FTS per edition/script becomes awkward.
* Hard to keep tokens/glosses consistent when verse rows are duplicated.

**When OK**

* If you are **certain** you’ll only ever store exactly {Devanāgarī, IAST, one English} and never add variations.


### How duplicates are prevented (important for re-imports)

* Chapters: `UNIQUE (work_id, parent_id, level_name, ordinal)`
  Importer uses **get-or-create**; existing chapter reused.
* Verses: `UNIQUE (work_id, division_id, ordinal)`
  Importer checks and **updates** `ref_citation` if found; otherwise inserts.
* Verse texts: `PRIMARY KEY (verse_id, edition_id)`
  `INSERT OR REPLACE` keeps exactly one text per edition per verse.
* Tokens: `UNIQUE (verse_id, edition_id, pos)`
  `INSERT OR IGNORE` avoids duplicating word positions.
* FTS: Importer **deletes** existing `(verse_id, edition_id)` rows before re-inserting to avoid duplicate search docs.


### Common query snippets

**Homepage filters with counts**

```sql
SELECT wt.code, wt.label, COUNT(*) AS n
FROM work_types wt
JOIN works w ON w.work_type_code = wt.code
GROUP BY wt.code, wt.label
ORDER BY n DESC;
```

**List all works with date info**

```sql
SELECT w.title_en, w.author, w.work_type_code,
       w.date_origin_start, w.date_origin_end, w.date_published
FROM works w
ORDER BY w.title_en;
```

**Render verses (UI-friendly “one row per verse”)**

```sql
SELECT v.ref_citation, vw.sa_deva, vw.sa_iast, vw.en_translation
FROM verse_texts_wide vw
JOIN verses v ON v.verse_id = vw.verse_id
WHERE v.work_id = :work_id
ORDER BY v.verse_id;
```

**Word-by-word for a verse**

```sql
SELECT t.pos, t.surface,
       GROUP_CONCAT(vg.gloss, ' | ') AS glosses
FROM tokens t
LEFT JOIN verse_glosses vg
  ON vg.verse_id = t.verse_id AND vg.surface = t.surface
WHERE t.verse_id = :verse_id
GROUP BY t.pos, t.surface
ORDER BY t.pos;
```

### TL;DR

* Store the **texts** per **(verse × edition)**; show them as one row via the **VIEW**.
* **Multiple tables** keep the data clean, fast, and future-proof (add new editions any time).
* **Per-verse glosses** guarantee context-correct meanings.
* Use the **`verse_texts_wide` view** whenever you want the simplicity of a single table for display/export—no compromise on structure under the hood.