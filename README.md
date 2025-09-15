# Timeless Words
Collection of Vedic texts

### Website demo
* https://agarapatri.github.io/Timeless-Words/

### What’s inside
- Pure HTML/CSS + tiny vanilla JS (no libraries)
- Pages: `index.html`, `search.html`, `book.html`, `verse.html`
- Data: `data/books.json` (sample)
- Responsive, mobile‑first layout. Font stack uses Helvetica Neue.

### Structure
- `index.html`: Home with search bar and list of books
- `search.html`: Advanced search with six filters
- `book.html`: Book overview; expandable chapters; verse list
- `verse.html`: Verse detail with Devanāgarī, IAST, word‑for‑word, translation
- `assets/styles.css`: Styles
- `assets/app.js`: Data loader and helpers
- `assets/search.js`: Search logic
- `data/books.json`: Example data format

### Data model
Each book contains chapters and verses. Verse fields map to your required sections:
- `number`, `ref` (e.g., "1.1")
- `devanagari` (Sanskrit Devanāgarī)
- `iast` (transliteration)
- `word_by_word`: array of `{ sanskrit, english }`
- `translation`

### Web Assembly
This uses SQLite as backend for data storage. WebAssembly (WASM) support across major browsers, WebViews, and proxy/cloud browsers.

* **Desktop browsers**

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


* **Mobile browsers**

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


* **WebViews & in-app browsers**

| Container                                     | WebAssembly               |
| --------------------------------------------- | ------------------------- |
| Android System WebView                        | Yes                       |
| iOS WKWebView (in-app browsers on iOS)        | Yes                       |
| Windows WebView2 (Edge/Chromium)              | Yes                       |
| Generic in-app browsers (FB/IG/Twitter, etc.) | Yes (inherits OS WebView) |


* **Proxy / cloud browsers (render on server)**

| Browser         | WebAssembly                                        |
| --------------- | -------------------------------------------------- |
| Opera Mini      | No (server-rendered)                               |
| Puffin          | Proxy/Varies (cloud-rendered; no client-side Wasm) |
| UC Browser Mini | Proxy/Varies                                       |

* Notes
    * “Chromium-based” browsers (Brave, Vivaldi, etc.) generally match Chrome’s WASM support because they share the Chromium/Blink engine. Specific site issues you might see are usually MIME/CSP/config problems, not lack of engine support.
    * Feature-level differences (SIMD, threads, GC, etc.) vary by version; 
    * **Core WebAssembly (MVP)** is supported in all major browsers as shown in the table above.
    * Newer features: **SIMD** is now supported across all major browsers (Safari added it in **16.4**, Mar 2023).
    * **Threads/SharedArrayBuffer** are supported, but only when the page is **cross-origin isolated** (special HTTP headers). GitHub Pages doesn’t let you set those headers directly, so **Wasm threads won’t work there by default**. 
    * Using **sql.js / sql.js-httpvfs** only requires **WebAssembly + Web Workers** (both widely supported). The library itself notes that if the browser doesn’t support either, it won’t work—this mostly affects very old or niche browsers.
    * Avoid features that require **SharedArrayBuffer/threads** on GitHub Pages unless you add a service-worker workaround to emulate COOP/COEP (possible, but extra plumbing).
    * If you later want thread-powered performance, you’ll need cross-origin isolation headers (COOP/COEP). That generally requires hosting where you can set headers, not stock GitHub Pages.


### Why SQLite?
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



### Upcoming Features

* Lazy load books in deep search with loader
* Separate chapter content from translation content
* Show num of chapters and total num of verses in each book in library
* Dark mode switch
* Font size adjustment slider
* Serif Font or San Serif font switch
* Text-to-Speech for chapters and verses
* Advanced SQL & Regex query search - AWS OpenSearch
* Plan to **show a friendly unsupported message** for Opera Mini and very old browsers.

