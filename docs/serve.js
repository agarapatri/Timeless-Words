// https://sqlite.org/wasm/doc/trunk/persistence.md#coop-coep
// SQLite WASM falls back to “no OPFS/threads” if the page isn’t cross-origin isolated.
// For production / big semantic DBs: enable COOP/COEP so the DB can live in OPFS and persist across reloads. That prevents re-downloading large packs and unlocks better performance.

// serve.js
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));

// Required for cross-origin isolation
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  next();
});

// Static files (add CORP for wasm just in case)
app.use(express.static(root, {
  setHeaders: (res, p) => {
    if (p.endsWith(".wasm")) res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  }
}));

app.listen(8000, () => console.log("http://localhost:8000"));
