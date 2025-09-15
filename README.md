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


### Upcoming Features

* Lazy load books in deep search with loader
* Separate chapter content from translation content
* Show num of chapters and total num of verses in each book in library
* Dark mode switch
* Font size adjustment slider
* Serif Font or San Serif font switch
* Text-to-Speech for chapters and verses
* Advanced SQL & Regex query search - AWS OpenSearch