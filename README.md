# Timeless Words
Collection of Vedic texts

## Website demo
* https://agarapatri.github.io/Timeless-Words/

## What’s inside
- Pure HTML/CSS + tiny vanilla JS (no libraries)
- Pages: `index.html`, `search.html`, `book.html`, `verse.html`
- Data: `data/books.json` (sample)
- Responsive, mobile‑first layout. Font stack uses Helvetica Neue.

## Structure
- `index.html`: Home with search bar and list of books
- `search.html`: Advanced search with six filters
- `book.html`: Book overview; expandable chapters; verse list
- `verse.html`: Verse detail with Devanāgarī, IAST, word‑for‑word, translation
- `assets/styles.css`: Styles
- `assets/app.js`: Data loader and helpers
- `assets/search.js`: Search logic
- `data/books.json`: Example data format

## Data model
Each book contains chapters and verses. Verse fields map to your required sections:
- `number`, `ref` (e.g., "1.1")
- `devanagari` (Sanskrit Devanāgarī)
- `iast` (transliteration)
- `word_by_word`: array of `{ sanskrit, english }`
- `translation`

## Web Assembly
This uses SQLite as backend for data storage. WebAssembly (WASM) support across major browsers, WebViews, and proxy/cloud browsers.

#### **Desktop browsers**

| Browser                      | WebAssembly                                |
| ---------------------------- | ------------------------------------------ |
| Chrome (Windows/macOS/Linux) | Yes                                        |
| Edge (Chromium)              | Yes                                        |
| Firefox (desktop)            | Yes                                        |
| Safari (macOS)               | Yes                                        |
| Opera (desktop)              | Yes                                        |
| Brave (desktop)              | Yes                                        |
| Vivaldi (desktop)            | Yes                                        |
| Tor Browser (desktop)        | Varies (can be disabled by security level) |
| Internet Explorer 11         | No                                         |


#### **Mobile browsers**

| Browser                    | WebAssembly                                     |
| -------------------------- | ----------------------------------------------- |
| Safari on iOS/iPadOS       | Yes                                             |
| Chrome for Android         | Yes                                             |
| Firefox for Android        | Yes                                             |
| Samsung Internet (Android) | Yes                                             |
| Opera Mobile (Android)     | Yes                                             |
| UC Browser (full Android)  | Yes (modern versions)                           |
| QQ Browser (Android)       | Yes                                             |
| Baidu Browser (Android)    | Yes                                             |
| Android “AOSP” Browser     | Varies (modern forks yes; very old versions no) |
| KaiOS Browser              | Varies (newer versions yes)                     |


#### **WebViews & in-app browsers**

| Container                                     | WebAssembly               |
| --------------------------------------------- | ------------------------- |
| Android System WebView                        | Yes                       |
| iOS WKWebView (in-app browsers on iOS)        | Yes                       |
| Windows WebView2 (Edge/Chromium)              | Yes                       |
| Generic in-app browsers (FB/IG/Twitter, etc.) | Yes (inherits OS WebView) |


#### **Proxy / cloud browsers (render on server)**

| Browser         | WebAssembly                                        |
| --------------- | -------------------------------------------------- |
| Opera Mini      | No (server-rendered)                               |
| Puffin          | Proxy/Varies (cloud-rendered; no client-side Wasm) |
| UC Browser Mini | Proxy/Varies                                       |

#### Notes
* “Chromium-based” browsers (Brave, Vivaldi, etc.) generally match Chrome’s WASM support because they share the Chromium/Blink engine. Specific site issues you might see are usually MIME/CSP/config problems, not lack of engine support.
* Feature-level differences (SIMD, threads, GC, etc.) vary by version; 
* **Core WebAssembly (MVP)** is supported in all major browsers as shown in the table above.
* Newer features: **SIMD** is now supported across all major browsers (Safari added it in **16.4**, Mar 2023).
* **Threads/SharedArrayBuffer** are supported, but only when the page is **cross-origin isolated** (special HTTP headers). GitHub Pages doesn’t let you set those headers directly, so **Wasm threads won’t work there by default**. 
* Using **sql.js / sql.js-httpvfs** only requires **WebAssembly + Web Workers** (both widely supported). The library itself notes that if the browser doesn’t support either, it won’t work—this mostly affects very old or niche browsers.
* Avoid features that require **SharedArrayBuffer/threads** on GitHub Pages unless you add a service-worker workaround to emulate COOP/COEP (possible, but extra plumbing).
* If you later want thread-powered performance, you’ll need cross-origin isolation headers (COOP/COEP). That generally requires hosting where you can set headers, not stock GitHub Pages.


## Why SQLite?
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



## SQLite Table Structure

### 1. works  (one row per book)
Groups everything that belongs to the same book; stores its “type”.
* **work\_id** — numeric ID.
* **title\_en**, **title\_sa** — titles (English/Sanskrit).
* **slug** — stable short name (e.g., `vishnu-purana`) for dedup/import.
* **canonical\_ref** — notes about the reference system (optional).
* **type** — comes straight from your JSON `"type"` (e.g., *Maha Puranas*).

### 2. divisions  (structure like canto/chapter)
Flexible hierarchy without changing schema when a text has extra levels.
* **division\_id** — ID.
* **work\_id** — which book it belongs to.
* **parent\_id** — for nesting (book → canto → chapter).
* **level\_name** — e.g., `book`, `canto`, `chapter`.
* **ordinal** — order within parent (1, 2, 3…).
* **label**, **slug** — display text and stable name.

### 3. verses  (one row per verse)
A single “anchor” row that all verse-scoped data plugs into.
* **verse\_id** — ID.
* **work\_id**, **division\_id** — book and chapter it lives in.
* **ref\_citation** — human ref like `1.3.15`.
* **ordinal** — order in the chapter.
* **ref\_level1/2/3** — optional parsed pieces (helpful for sorting).

### 4. editions  (what “flavor” of text it is)
Lets you have Devanāgarī, IAST, English (and later Hindi, Telugu, other translators) without adding columns.
* **edition\_id** — ID.
* **work\_id** — book it belongs to.
* **kind** — `source` or `translation`.
* **language** — e.g., `sa`, `en`.
* **script** — e.g., `Deva` (Devanāgarī), `Latn` (IAST); usually NULL for translations.
* **translator** — who translated (optional).
* **is\_default** — your preferred one of that kind.

### 5. verse\_texts  (the actual text per verse × edition)
Cleanly separates Devanāgarī, IAST, English (and future languages) into their own rows; easy to filter/search.
* **verse\_id**, **edition\_id** — which verse & which edition.
* **body** — the text itself.
* **notes\_json** — optional annotations.
* **PRIMARY KEY (verse\_id, edition\_id)** — exactly one text per verse per edition.

### 6. verse\_texts\_wide  (VIEW for easy UI; one row per verse)
You want “one row per verse” in the UI; the view gives that without giving up the flexible storage above.
* **verse\_id, work\_id, division\_id, ref\_citation**
* **sa\_deva** — Devanāgarī text (from `sa/Deva` edition)
* **sa\_iast** — IAST text (from `sa/Latn`)
* **en\_translation** — English text (from `en`)

### 7. tokens  (word order within a verse)
Drives highlight/align features and keeps the word order.
* **token\_id** — ID.
* **verse\_id** — which verse.
* **edition\_id** — which source edition was tokenized (usually `sa/Deva`).
* **pos** — word position (1…n).
* **surface** — the word as printed (e.g., in Devanāgarī).
* **lemma**, **morph**, **start\_char**, **end\_char** — optional normalization, tagging, and text spans.

### 8. verse\_glosses  (word→meaning for *this verse*)
Sanskrit is context-heavy. Meanings are stored **per verse** so the same word can have different meanings in different verses without overwriting.
* **work\_id**, **verse\_id** — scope.
* **surface** — the word form (e.g., Devanāgarī).
* **gloss** — the meaning you picked for this verse.
* **source** — where it came from (`json`, `user`, `dict`, …).
* **UNIQUE(verse\_id, surface, gloss)** — same pair isn’t stored twice.

### 9. fts\_verse\_texts  (full-text search index)
Fast, diacritic-aware search across huge corpora.
* Virtual table mirroring `verse_texts` fields needed for search: **body**, plus **kind/language/script** to filter.

### Why multiple tables? (the point in 5 bullets)

1. **Flexibility** — Add a new language/translator later with **rows**, not new columns.
2. **Clean search** — FTS works best when each “document” is its own row (our `verse_texts`).
3. **Correctness** — One stable `verse_id` avoids duplication when texts multiply.
4. **Word-level features** — Tokens and verse-scoped glosses need a reliable verse anchor.
5. **Performance & maintenance** — Update only what changes (e.g., just IAST for a verse), not giant denormalized blobs.

### Pros / Cons / Trade-offs

#### Normalized (what we use)

**Pros**

* Scales to many languages/editions without schema changes.
* Precise filtering/search (e.g., only IAST; only English).
* Safer updates (one small row per edition).
* Robust word-level alignment and per-verse meanings.

**Cons**

* More joins if you query raw tables.
* Slightly more tables to understand.

**Mitigation**

* Use the **`verse_texts_wide` VIEW** for the UI (“one row per verse”).
* Keep helper queries/snippets handy (I’ve given the common ones).

#### Single “wide” table (alternative)

**Pros**

* Very simple to read/export at first.
* Fewer joins.

**Cons**

* Adding a second translation/language requires **new columns** or duplication.
* FTS and edition-level filtering are clumsy.
* Harder to keep tokens/glosses clean if you duplicate verse rows.

**When OK**

* If you are **100% sure** you’ll never exceed {Devanāgarī, IAST, one English} and never add variants.

### TL;DR

* Store the **texts** per **(verse × edition)**; show them as one row via the **VIEW**.
* Store **word meanings per verse** in `verse_glosses` to avoid context mix-ups.
* This buys you correctness now and zero schema pain later.


## Upcoming Features
* Lazy load books in deep search with loader
* Show num of chapters and total num of verses in each book in library
* Dark mode switch
* Font size adjustment slider
* Serif Font or San Serif font switch
* Text-to-Speech for chapters and verses
* Regex search 
* Plan to **show a friendly unsupported message** for Opera Mini and very old browsers.

