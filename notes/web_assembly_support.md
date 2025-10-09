
# **Web Assembly**
This uses SQLite as backend for data storage. WebAssembly (WASM) support across major browsers, WebViews, and proxy/cloud browsers.

## **Desktop browsers**

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


## **Mobile browsers**

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


## **WebViews & in-app browsers**

| Container                                     | WebAssembly               |
| --------------------------------------------- | ------------------------- |
| Android System WebView                        | Yes                       |
| iOS WKWebView (in-app browsers on iOS)        | Yes                       |
| Windows WebView2 (Edge/Chromium)              | Yes                       |
| Generic in-app browsers (FB/IG/Twitter, etc.) | Yes (inherits OS WebView) |


## **Proxy / cloud browsers (render on server)**

| Browser         | WebAssembly                                        |
| --------------- | -------------------------------------------------- |
| Opera Mini      | No (server-rendered)                               |
| Puffin          | Proxy/Varies (cloud-rendered; no client-side Wasm) |
| UC Browser Mini | Proxy/Varies                                       |

## Notes
* “Chromium-based” browsers (Brave, Vivaldi, etc.) generally match Chrome’s WASM support because they share the Chromium/Blink engine. Specific site issues you might see are usually MIME/CSP/config problems, not lack of engine support.
* Feature-level differences (SIMD, threads, GC, etc.) vary by version; 
* **Core WebAssembly (MVP)** is supported in all major browsers as shown in the table above.
* Newer features: **SIMD** is now supported across all major browsers (Safari added it in **16.4**, Mar 2023).
* **Threads/SharedArrayBuffer** are supported, but only when the page is **cross-origin isolated** (special HTTP headers). GitHub Pages doesn’t let you set those headers directly, so **Wasm threads won’t work there by default**. 
* Using **sql.js / sql.js-httpvfs** only requires **WebAssembly + Web Workers** (both widely supported). The library itself notes that if the browser doesn’t support either, it won’t work—this mostly affects very old or niche browsers.
* Avoid features that require **SharedArrayBuffer/threads** on GitHub Pages unless you add a service-worker workaround to emulate COOP/COEP (possible, but extra plumbing).
* If you later want thread-powered performance, you’ll need cross-origin isolation headers (COOP/COEP). That generally requires hosting where you can set headers, not stock GitHub Pages.
