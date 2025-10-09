# Timeless Words — Project Flow

This document explains the structure of the site under `docs/`, how the two search modes work, and all steps and assets involved in enabling semantic (meaning‑based) search. It’s written to help both maintainers and contributors.

## Contents

- Overview
- Directory Layout
- Runtime Data Flow
- Search Modes
- Semantic Search (end‑to‑end)
- JavaScript Modules
- HTML Views
- Assets and Data
- Build Scripts (maintainers)
- Hosting Notes (GitHub Pages)
- Troubleshooting

---

## Overview

The site is a static, client‑side application served from `docs/`. It offers:

- Browsing a library of Vedic texts
- “Deep Search” in two modes:
  - Regex/wildcards (default)
  - Semantic (meaning‑based), optional download that runs offline in the browser

All logic runs client‑side. Data is stored in SQLite files fetched at runtime and in OPFS (Origin Private File System) for the semantic pack.

---

## Directory Layout

```
docs/
  index.html                     # Home page
  views/                         # Individual screens
    search.html                  # Deep Search UI (+ semantic overlay)
    semantic_download.html       # Standalone semantic installer page
    book.html, chapter.html, verse.html
    partials/                    # Shared snippets (menu, footer, favicon)
  js/                            # Front‑end modules
    app.js, constants.js, search.js
    semantic_downloader.js, encoder.js, vec_db.js
    sql_helpers/ (sql.js loader), onyx/ (onnx wasm)
  assets/
    css/styles.css               # All styles
    data/                        # SQLite and semantic pack
      library.{{DB_VERSION}}.sqlite
      semantic/
        manifest.json
        library.semantic.v01.sqlite
        onnx_model/ (model + tokenizer files)
    images/, fonts/
  scripts/                       # Build semantic pack + manifest (maintainers)
  tests/                         # Optional test area
```

---

## Runtime Data Flow

1. HTML view loads modules from `js/`.
2. For regex search, `js/search.js` queries the main SQLite via sql.js and filters results in memory.
3. For semantic search, a one‑time download installs a “semantic pack” into OPFS. Future queries use `encoder.js` (client‑side vectorizer) + `vec_db.js` (vector DB reader) to rank passages.

---

## Search Modes

- Regex/wildcards: default mode. Uses the main DB `assets/data/library.{{DB_VERSION}}.sqlite`.
- Semantic: optional. Toggle in `views/search.html` downloads the pack and flips `tw_semantic_enabled` in `localStorage`.

`window.__TW_SEMANTIC_MODE__` (boolean) indicates the active mode in `views/search.html` and `js/search.js`.

---

## Semantic Search (end‑to‑end)

### What gets downloaded

`assets/data/semantic/manifest.json` lists all files. Paths are relative to `assets/data/semantic/`:

- `library.semantic.v01.sqlite` — compact vector DB (passages + embeddings)
- `onnx_model/config.json`
- `onnx_model/model.onnx`
- `onnx_model/ort_config.json`
- `onnx_model/special_tokens_map.json`
- `onnx_model/tokenizer.json`
- `onnx_model/tokenizer_config.json`
- `onnx_model/vocab.txt`

On GitHub Pages, direct URLs look like:

- `{site}/assets/data/semantic/manifest.json`
- `{site}/assets/data/semantic/library.semantic.v01.sqlite`
- `{site}/assets/data/semantic/onnx_model/model.onnx`

Replace `{site}` with your Pages base, for example: `https://<user>.github.io/<repo>`.

### Where files are stored (browser)

- OPFS directory: `tw-semantic` (see `js/constants.js`)
- Same relative subpaths as in the manifest
- A `version.txt` is written with the pack version
- Enable flag: `localStorage["tw_semantic_enabled"] = "1"`

### Install flow

- User toggles “by meaning” ON in `views/search.html`.
- `SemanticInstall` (from `js/semantic_downloader.js`) fetches `manifest.json` and streams each file to OPFS, updating a progress bar.
- On completion it writes `version.txt`, sets `tw_semantic_enabled`, and closes the overlay.
- From there, semantic mode uses `encoder.js` + `vec_db.js`.

### Query flow in semantic mode

- `js/encoder.js` builds a normalized Float32 vector from the query text using hashing and character n‑grams (no heavy model at runtime).
- `js/vec_db.js` loads embeddings from `library.semantic.v01.sqlite` (OPFS) into memory and computes cosine similarity to return top passages.

### Integrity and host quirks

- The installer verifies SHA‑256 where available. On `github.io` hosts (or when `?skipsha=1` is present), SHA mismatch is logged as a warning and not treated as fatal, to avoid failures on static CDNs for large binaries.

---

## JavaScript Modules

- `js/constants.js`
  - `DATA_ROOT`, `JS_ROOT` — Base URLs resolved from module URL.
  - `SEMANTIC_ROOT` — Base for semantic files (`assets/data/semantic/`).
  - `DB` — DB file names and sql.js wasm path.
  - `SEARCH` — Placeholder strings for both modes.
  - `SEMANTIC` — Keys for enable flag and manifest URL.

- `js/app.js`
  - UI shell utilities: menu injection, asset URL absolutizer, theme and serif toggles, font sizing, text‑to‑speech, Google Translate toggle.
  - Exposes `window.Library.injectMenu(selector)` used by views.

- `js/search.js`
  - Loads catalog and verses from the main SQLite DB (via sql.js).
  - Handles regex search, pagination, result rendering and tips UI.
  - Semantic branch: if `window.__TW_SEMANTIC_MODE__` is true, ensures the semantic runtime is ready then runs vector search.

- `js/semantic_downloader.js`
  - `SemanticInstall` handles the full installer flow: progress UI, OPFS writes, integrity checks, `tw_semantic_enabled` flag update.
  - Public helpers:
    - `isSemanticEnabled()` / `setSemanticEnabled(true|false)`
  - Auto‑wires the standalone installer UI in `views/semantic_download.html` (toggle + download button) when present.

- `js/encoder.js`
  - `QueryEncoder` implements deterministic token + n‑gram hashing with L2 normalization. No ONNX runtime required at query time.

- `js/vec_db.js`
  - `SemanticDB` opens the OPFS vector DB, loads embeddings into a dense matrix, and exposes `vecSearch(queryVec, topK)` using cosine similarity.

- `js/sql_helpers/*`
  - `sql-wasm.js` loader for sql.js; used by lexical search and DB reads.

- `js/onyx/*`
  - ONNX Runtime WASM and shims used by the build pipeline (not needed at runtime when using `encoder.js`).

- `js/footer.js`
  - Fetches and injects `views/partials/footer.html`.

---

## HTML Views

- `index.html`
  - Home page with “Deep Search” entry and library listing.
  - Injects the shared menu and footer.

- `views/search.html`
  - Deep Search page. Contains the “by meaning” toggle and the blocking overlay for the semantic downloader.
  - Wires `SemanticInstall` to overlay elements and flips the mode via `setSemanticEnabled()`.

- `views/semantic_download.html`
  - Standalone installer panel with a simple switch and progress bar. The downloader module auto‑wires this page by element IDs.

- `views/book.html`, `views/chapter.html`, `views/verse.html`
  - Content views that render book/chapter/verse content.

- `views/partials/*`
  - `menu.html`, `footer.html`, `favicon.html` used by injected UI in `app.js`.

---

## Assets and Data

- `assets/css/styles.css` — All site styles.
- `assets/data/library.{{DB_VERSION}}.sqlite` — Main site DB for lexical search.
- `assets/data/semantic/manifest.json` — Semantic pack descriptor.
- `assets/data/semantic/library.semantic.v01.sqlite` — Vector DB used by semantic mode.
- `assets/data/semantic/onnx_model/*` — Model/tokenizer used during embedding generation (build time).
- `assets/images/*`, `assets/fonts/*` — Media and fonts.

---

## Build Scripts (maintainers)

- `scripts/build_semantic_pack.py`
  - Creates `library.semantic.<version>.sqlite` with tables: `passages`, `embeddings`, `meta`.
- `scripts/encode_semantic.py`
  - Batch‑encodes passages using ONNX + tokenizer, writes normalized vectors to the DB.
- `scripts/build_semantic_manifest.py`
  - Generates `assets/data/semantic/manifest.json` with size + SHA for all required files.

Typical update flow:

1) Rebuild the vector DB (pack) with the latest content.
2) Regenerate `manifest.json`.
3) Commit `assets/data/semantic/*` and deploy.

---

## Hosting Notes (GitHub Pages)

- Paths are made absolute where needed (`js/app.js`) to work from nested routes.
- OPFS is required for semantic install (recent browsers only).
- SHA verification for large files is tolerated on `github.io`; add `?skipsha=1` to the page URL to skip hashes globally during testing.

---

## Troubleshooting

- Toggle flips OFF after download:
  - Hard‑refresh the page. If on `github.io`, mismatched SHA is tolerated and should not block install.
  - Check DevTools → Application → OPFS to see if files exist under `tw-semantic/`.
  - Ensure `localStorage["tw_semantic_enabled"] === "1"`.

- Semantic search returns “not ready”:
  - Open `views/semantic_download.html` and re‑install.
  - Clear site data (including OPFS) and retry.

- Path issues on Pages:
  - Confirm that `assets/data/semantic/manifest.json` is accessible under your Pages base URL.

---


ORT runs ONNX models in the browser. The SQL helpers stream and query SQLite in the browser.

Difference:

* **`onyx/ort-*.{mjs,wasm}`** = ONNX Runtime Web.

  * Runs ONNX models client-side.
  * Files:

    * `ort-wasm-simd-threaded.*` uses WebAssembly SIMD + Web Workers for speed.
    * `.jsep.*` = JS Execution Provider fallback for ops not in WASM.
    * `ort.wasm.mjs` / `ort.wasm.min.mjs` = module loader.
    * `ort.wasm.bundle.min.mjs` = self-contained bundle.
  * Use when you must compute embeddings or any model inference in the browser.

* **`sql_helpers/sqljs-httpvfs/*` and `sql-*.{js,wasm}` / `sqlite*.{mjs,wasm}`** = SQLite-in-browser.

  * Streams a remote `.sqlite` over HTTP range requests and queries it locally via WebAssembly.
  * `sql-wasm.{js,wasm}` = sql.js build.
  * `sqlite3.{mjs,wasm}` = official SQLite WASM build.
  * `sqlite.worker.js` = runs DB in a worker.
  * `index.js` = HTTPVFS glue to mount the remote DB.
  * Use to read your 1 GB embedding DB on GitHub Pages without full download.

Implication:

* If you **only search with precomputed embeddings**, you need the SQL helpers, not ORT.
* If you **compute query embeddings in the browser**, you need ORT (plus the ONNX model). You still need the SQL helpers to fetch vectors efficiently.


