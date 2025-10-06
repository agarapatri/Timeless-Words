# Timeless Words – Documentation (v2)

This document summarises every file in the `docs/` site bundle, explains
required downloads, and lists the scripts to run when updating data or models.
Follow the workflows near the end whenever the SQLite library or semantic
embedding pack changes.

---

## 1. Quick Start

1. **Serve locally (with COOP/COEP)**
   ```bash
   cd docs
   node tests/serve.js
   # open http://localhost:8000/views/search.html
   ```
   The Express server adds the headers SQLite/ONNX need for threaded WebAssembly.

2. **Install Python tooling (optional scripts)**
   ```bash
   cd docs/scripts
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt  # see scripts/script_docs.md for the list
   ```

3. **Download semantic pack from the UI**
   * Toggle “by meaning” on the search page. The downloader stores files in
     OPFS under `tw-semantic/` so they persist across sessions.

---

## 2. Directory Overview

| Path | Purpose |
| --- | --- |
| `index.html` | Landing page linking into the views. |
| `views/` | Page templates rendered from the static dataset. |
| `assets/` | Site CSS, fonts, imagery, and SQLite/semantic data. |
| `js/` | All browser logic (DB access, search, semantic wiring). |
| `tests/` | Local development helpers (server, quick PoC). |
| `scripts/` | Python utilities for rebuilding data packs and models. |
| `DOCUMENTATION_v2.md` | This file (project reference). |

### Hidden metadata
Mac-specific `.DS_Store` files exist in most folders; they have no effect and
can be removed safely.

---

## 3. File Reference (by directory)

### Root
- `index.html` – Static home page; loads CSS/JS from `assets`/`js`.
- `directory_structure.txt` – Optional helper listing tree layout.
- `DOCUMENTATION_v2.md` – Current project documentation (v2).

### `views/`
- `views/book.html` – Book-level detail page (templated with DB queries).
- `views/chapter.html` – Chapter navigation view.
- `views/verse.html` – Individual verse presentation.
- `views/search.html` – Main search UI (lexical + semantic toggle).
- `views/semantic_download.html` – Stand-alone installer/help page.

### `assets/`
- `assets/css/styles.css` – Global styling (includes search layout classes).
- `assets/data/library.{{DB_VERSION}}.sqlite` – Primary content database
  generated from `json_to_sqlite_cli.py` (external). Update this when corpus
  changes.
- `assets/data/semantic/manifest.json` – List of semantic pack files + hashes
  consumed by `js/semantic_downloader.js`.
- `assets/data/semantic/library.semantic.v01.sqlite` – Vector DB backing
  semantic search (passages + embedding blobs). Rebuild whenever the corpus or
  encoder changes.
- `assets/data/semantic/onnx_model/*.json|.onnx|.txt` – Transformer model,
  tokenizer, and metadata used by `transformer_encoder.js`.
  - `model.onnx` – FP32 encoder (86 MB).
  - `onnx/model_quantized.onnx` – INT8 encoder kept for optional use.
  - `model_simplified*.onnx` – Intermediates produced by optimisation scripts.
  - `tokenizer.json|tokenizer_config.json|vocab.txt` – Tokenizer resources.
  - `ort_config.json` – Hints for ONNX Runtime (threading/optimisation flags).
- `assets/fonts/*.woff2` – Inter/ Noto serif webfonts.
- `assets/images/*.svg|.avif` – UI imagery (favicons, icons, banner).

### `js/`
- `js/app.js` – Bootstraps shared UI features (menus, theming).
- `js/constants.js` – URLs, filenames, feature flags (e.g., semantic manifest).
- `js/db.js` – Lazily loads the SQLite WASM engine, attaches helper query
  functions (`loadDb`, `query`).
- `js/search.js` – Implements lexical search, pagination, filter handling, and
  the semantic branch (imports `transformer_encoder` + `vec_db`).
- `js/semantic_downloader.js` – Installs semantic packs into OPFS and manages
  the toggle state in `localStorage`.
- `js/transformer_encoder.js` – Wraps `transformers.js` to load the local ONNX
  model (single-threaded WASM, SIMD enabled) and produce L2-normalised vectors.
- `js/vec_db.js` – Loads `library.semantic.v01.sqlite` via sql.js, keeps an
  in-memory Float32Array matrix, and performs cosine search.
- `js/footer.js` – Injects the shared footer component.
- `js/debug.js` – Console helpers for inspecting OPFS, toggles, etc.
- `js/constants.js` – Shared constants (DB filenames, search hints).

#### `js/sql_helpers/`
Sql.js runtime bundle pulled from upstream:
- `sql-wasm.js`, `sql-wasm.wasm`, `sqlite.worker.js`, `sqlite3.mjs`, `sqlite3.wasm`
  – Provide SQLite-in-the-browser support. No manual edits needed.

#### `js/onyx/`
ONNX Runtime Web build (v1.22).
- `ort.wasm.mjs`, `ort.wasm.min.mjs`, `ort.wasm.bundle.min.mjs` – Loader entrypoints.
- `ort-wasm-simd-threaded.mjs`, `ort-wasm-simd-threaded.wasm` – SIMD build.
- `ort-wasm-simd-threaded.jsep.mjs`, `ort-wasm-simd-threaded.jsep.wasm` – JSEP
  loader packaged as a shim; we run single-threaded (proxy disabled) but keep
  the files so ORT initialises cleanly.

#### `js/vendor/`
- `transformers.min.js` – Xenova’s Transformers.js bundle (feature extraction).

### `tests/`
- `tests/serve.js` – Express static server with COOP/COEP headers to unlock OPFS
  + threaded WASM locally.
- `tests/vec-poc.html` – Minimal prototype page for vector search experiments.

### `scripts/`
Python tooling for data/model preparation. Commands assume a virtualenv with
`onnx`, `onnxruntime`, `tokenizers`, `numpy`, etc. (see `scripts/how_to_run.md`).

| Script | Summary |
| --- | --- |
| `build_semantic_pack.py` | Creates the semantic SQLite pack (passages table + placeholder embeddings). Uses the hashed encoder by default; run `encode_semantic.py` afterwards to overwrite vectors with transformer embeddings. |
| `encode_semantic.py` | Recomputes embeddings inside `library.semantic.v01.sqlite` using the local ONNX model + tokenizer (mean pooling, L2 normalisation). |
| `build_semantic_manifest.py` | Regenerates `assets/data/semantic/manifest.json` with accurate sizes and SHA-256 sums for the installer. |
| `compare_fp32_vs_int8.py` | Checks cosine similarity between FP32 and INT8 models. |
| `example_cosine_search.py` | Standalone cosine search demo over embeddings. |
| `inspect_embeddings.py` | Quality checks (norms, duplicates) on generated embeddings. |
| `optimize_onnx.py`, `quantize_dynamic.py`, `simplify_light.py` | ONNX graph simplification + quantisation pipeline. |
| `smoke_int8.py`, `verify_quantized.py`, `quick_checks.py`, `sanity_report.py` | Validation utilities for optimised/quantised models. |
| `compare_fp32_vs_int8.py`, `smoke_int8.py`, `verify_quantized.py` | Accuracy/latency comparisons between model variants. |
| `scripts/how_to_run.md` | Environment setup instructions for the Python toolchain. |
| `scripts/script_docs.md` | Full pipeline description (simplify → optimise → quantise → validate → embed → pack). |
| `scripts/quantize_dynamic.py` | Dynamic quantisation helper (INT8). |
| `scripts/compare_fp32_vs_int8.py` | Cosine comparison of FP32 vs INT8 embeddings. |
| `scripts/smoke_int8.py` | Quick inference smoke-test for INT8 model. |
| `scripts/example_cosine_search.py` | Example CLI cosine search. |
| `scripts/sanity_report.py` | Aggregates outputs into markdown summary. |

(Any script not listed above is auxiliary; see in-file docstrings.)

### `assets/images/`
All icons and illustrations are single-purpose static assets:
- `banner.avif`, `favicon.svg`, `search.svg`, `search-dark.svg`, `chev.svg`,
  `external.svg`, `filter.svg`.

### Fonts
- `assets/fonts/inter-*.woff2` – UI sans serif weights (400, 700).
- `assets/fonts/noto-serif-*.woff2` – Body serif (400, 700).

---

## 4. External Downloads & Assets

| Item | Source | Notes |
| --- | --- | --- |
| `library.{{DB_VERSION}}.sqlite` | Generated via external data pipeline (json → SQLite). | Replace when corpus updates. |
| ONNX model + tokenizer | Stored in repo under `assets/data/semantic/onnx_model/`. | To refresh, follow the scripts pipeline in §6. |
| Semantic pack (OPFS) | Installed client-side using `semantic_downloader.js`. | Files listed in `manifest.json` are fetched relative to the site root. |
| SQLite WASM runtime | Already bundled inside `js/sql_helpers/`. | No additional download needed. |
| ONNX Runtime Web | Bundled in `js/onyx/`. | Worker threads disabled by default (proxy=false) for GitHub Pages compatibility. |

To re-download or refresh the semantic assets on a machine, run:
```bash
cd docs
python3 scripts/build_semantic_manifest.py   # updates sizes + hashes
yarn install --immutable                      # if you need node modules for serve.js
node tests/serve.js                           # serves site with COOP/COEP
```
(The site itself is static—no npm build step is required.)

---

## 5. Data Refresh & Build Workflows

### 5.1 When the main SQLite DB changes
1. Replace `assets/data/library.{{DB_VERSION}}.sqlite` with the new export
   (keep the template placeholder if versioning is templated at deploy time).
2. Rebuild the semantic pack:
   ```bash
   cd docs
   python3 scripts/build_semantic_pack.py \
     --source assets/data/library.{{DB_VERSION}}.sqlite \
     --out assets/data/semantic/library.semantic.v01.sqlite \
     --dim 384
   ```
3. Overwrite embeddings with transformer vectors (required for semantic search):
   ```bash
   python3 scripts/encode_semantic.py
   ```
   This script reads the ONNX model & tokenizer from `assets/data/semantic/onnx_model/`.
4. Update the pack manifest so the downloader knows the new sizes/checksums:
   ```bash
   python3 scripts/build_semantic_manifest.py
   ```
5. Optional sanity checks:
   ```bash
   python3 scripts/example_cosine_search.py --query "example" --topk 5
   ```
6. Commit updated SQLite, semantic DB, manifest, and any regenerated reports.

### 5.2 When the ONNX model or tokenizer changes
Follow the pipeline in `scripts/script_docs.md` (simplify → optimise → quantise
→ encode). The minimal commands:
```bash
python3 scripts/simplify_light.py --in new_model.onnx --out assets/data/semantic/onnx_model/model_simplified.onnx
python3 scripts/optimize_onnx.py --in assets/data/semantic/onnx_model/model_simplified.onnx --out assets/data/semantic/onnx_model/model.onnx
python3 scripts/quantize_dynamic.py --in assets/data/semantic/onnx_model/model.onnx --out assets/data/semantic/onnx_model/onnx/model_quantized.onnx
python3 scripts/encode_semantic.py
python3 scripts/build_semantic_manifest.py
```
Re-run the validation scripts (`verify_quantized.py`, `compare_fp32_vs_int8.py`)
if you publish the INT8 path.

### 5.3 Rebuilding the semantic pack from scratch
1. Ensure main SQLite and ONNX assets are in place.
2. Run `build_semantic_pack.py` to create the SQLite shell.
3. Run `encode_semantic.py` to populate embeddings.
4. Run `build_semantic_manifest.py`.
5. Increment the pack version string in `assets/data/semantic/manifest.json` if
   you intend to invalidate caches.

### 5.4 Deployment checklist
- Run `node tests/serve.js` and smoke-test lexical + semantic search.
- Toggle “by meaning”, confirm vectors load without console errors.
- Verify manifest entries match the files by running `python3 scripts/build_semantic_manifest.py` and checking `git diff`.
- Ensure `localStorage.getItem('tw_semantic_enabled')` defaults to previous state after deploying (no code change needed).

---

## 6. Edge Cases & Caveats

- **Cross-Origin Isolation**: GitHub Pages does not allow COOP/COEP, so ONNX
  Runtime runs in single-threaded mode. We set `env.backends.onnx.wasm.worker = false`.
  Local Express server adds the headers so you can test threaded builds if
  desired.
- **OPFS availability**: Semantic packs require the browser to support
  `navigator.storage.getDirectory()`. `semantic_downloader.js` surfaces friendly
  messaging if unavailable.
- **Manifest hashes**: `manifest.json` currently uses placeholder `CHANGE_ME`
  for the SQLite entry. If you need strong integrity checks, run the manifest
  builder and paste the real SHA-256.
- **`build_semantic_pack.py` embeds hashed vectors**: Always follow it with
  `encode_semantic.py` so the stored vectors match the transformer encoder.
- **Large downloads**: ONNX model (~86 MB) and SQLite DB (~0.4 MB) ship with the
  repository; GitHub Pages automatically serves them from `/assets/data/semantic`.
  The client downloads them via the manifest when semantic mode is enabled.
- **Testing without OPFS**: When OPFS is unavailable, semantic search throws
  “Semantic not ready”. Ensure the downloader guard is triggered before enabling
  the toggle in production.

---

## 7. Useful Commands & Scripts

| Task | Command |
| --- | --- |
| Launch dev server | `node tests/serve.js` |
| Rebuild semantic manifest | `python3 scripts/build_semantic_manifest.py` |
| Recompute embeddings | `python3 scripts/encode_semantic.py` |
| Build semantic pack shell | `python3 scripts/build_semantic_pack.py --source … --out … --dim 384` |
| Run transformer sanity check in browser | Open DevTools and run the snippet in §1. |
| Clear OPFS cache (browser console) | `await window.clearOPFS?.()` (provided by `debug.js`). |

---

## 8. Version History

- **v2 (current)** – Transformer-only semantic search, ONNX Runtime single-threaded
  configuration documented, full repo file listing with update workflows.

---

_Questions or patch notes? Add them beneath this section so future maintainers
see the timeline of changes._

