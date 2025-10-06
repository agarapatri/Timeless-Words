// https://sqlite.org/wasm/doc/trunk/persistence.md#coop-coep
// SQLite WASM falls back to “no OPFS/threads” if the page isn’t cross-origin isolated.
// For production / big semantic DBs: enable COOP/COEP so the DB can live in OPFS and persist across reloads. That prevents re-downloading large packs and unlocks better performance.


// serve.js
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

// Required for cross-origin isolation
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  next();
});

// Allow legacy /docs/* URLs so old bookmarks keep working
app.use((req, _res, next) => {
  if (req.url === '/docs' || req.url === '/docs/') {
    req.url = '/';
  } else if (req.url.startsWith('/docs/')) {
    req.url = req.url.slice('/docs'.length);
  }
  next();
});

// Static files (add CORP for wasm just in case)
app.use(express.static(root, {
  setHeaders: (res, p) => {
    if (p.endsWith(".wasm")) res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  }
}));

app.listen(8000, () => console.log("http://localhost:8000"));
