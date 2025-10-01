// assets/semantic_downloader.js
import { SEMANTIC, SEM_ONNX_ROOT } from "./constants.js";

export class SemanticInstall {
  constructor(cfg = {}) {
    this.OPFS_DIR = SEMANTIC.OPFS_DIR;
    this.MANIFEST_URL = cfg.manifestUrl || SEMANTIC.MANIFEST_URL;
    this.ENABLE_KEY = SEMANTIC.ENABLE_KEY;

    // UI (blocker)
    this.overlay = document.getElementById(cfg.overlayId);
    this.bar = document.getElementById(cfg.barId);
    this.pct = document.getElementById(cfg.pctId);
    this.status = document.getElementById(cfg.statusId);
    this.btnCancel = document.getElementById(cfg.cancelId);

    this.supported =
      typeof navigator !== "undefined" &&
      navigator.storage &&
      typeof navigator.storage.getDirectory === "function";

    this.controller = null;
    this.boundBeforeUnload = null;
    this.onInstalled = null;

    this.btnCancel?.addEventListener("click", () => this.cancel());
  }

  show() {
    if (this.overlay) this.overlay.hidden = false;
    document.documentElement.style.overflow = "hidden";
  }
  hide() {
    if (this.overlay) this.overlay.hidden = true;
    document.documentElement.style.overflow = "";
  }

  async _getDirHandle(create = true) {
    const root = await navigator.storage.getDirectory();
    return root.getDirectoryHandle(this.OPFS_DIR, { create });
  }

  _splitPath(path) {
    return String(path || "")
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  async _getFileHandle(path, { createDirs = false, createFile = false } = {}) {
    const segments = this._splitPath(path);
    if (!segments.length) throw new Error(`Invalid path: ${path}`);
    const fileName = segments.pop();
    let scope = await this._getDirHandle(createDirs);
    for (const segment of segments) {
      scope = await scope.getDirectoryHandle(segment, { create: createDirs });
    }
    return scope.getFileHandle(fileName, { create: createFile });
  }

  async _hasManifestFiles() {
    try {
      const manifest = await fetch(this.MANIFEST_URL, {
        cache: "no-store",
      }).then((r) => r.json());
      for (const file of manifest.files || []) {
        await this._getFileHandle(file.path, {
          createDirs: false,
          createFile: false,
        });
      }
      return true;
    } catch {
      return false;
    }
  }
  async isInstalled() {
    if (!this.supported) return false;
    if (!localStorage.getItem(this.ENABLE_KEY)) return false;
    const ok = await this._hasManifestFiles();
    if (!ok) localStorage.removeItem(this.ENABLE_KEY);
    return ok;
  }
  cancel() {
    if (this.controller) this.controller.abort();
  }

  async _sha256(buf) {
    const h = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(h))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  _fmt(n) {
    const u = ["B", "KB", "MB", "GB"];
    let i = 0;
    while (n >= 1024 && i < u.length - 1) {
      n /= 1024;
      i++;
    }
    return `${n.toFixed(1)} ${u[i]}`;
  }
  _setStatus(t, cls = "muted") {
    if (this.status) {
      this.status.textContent = t;
      this.status.className = cls;
    }
  }

  _lockUnload() {
    this.boundBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "Downloading semantic pack…";
    };
    window.addEventListener("beforeunload", this.boundBeforeUnload);
  }
  _unlockUnload() {
    if (this.boundBeforeUnload) {
      window.removeEventListener("beforeunload", this.boundBeforeUnload);
      this.boundBeforeUnload = null;
    }
  }

  async _downloadOne(url, expectedSha, onProgress) {
    this.controller = new AbortController();
    const res = await fetch(url, { signal: this.controller.signal });
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
    const total = Number(res.headers.get("content-length")) || 0;
    const reader = res.body.getReader();
    let received = 0;
    const chunks = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      if (total && onProgress) onProgress(received / total);
    }
    const blob = new Blob(chunks);
    const buf = await blob.arrayBuffer();
    if (expectedSha && expectedSha !== "CHANGE_ME") {
      const got = await this._sha256(buf);
      if (got !== expectedSha) throw new Error(`${url} hash mismatch`);
    }
    return new Blob([buf]);
  }

  async _writeOPFS(path, blob) {
    const fh = await this._getFileHandle(path, {
      createDirs: true,
      createFile: true,
    });
    const w = await fh.createWritable();
    await blob.stream().pipeTo(w);
  }

  async start() {
    try {
      if (!this.supported) {
        this._setStatus(
          "Semantic pack needs a newer browser (OPFS support).",
          "danger"
        );
        throw new Error("OPFS not supported");
      }

      // Ask for persistent storage to raise quota in some browsers
      if (navigator.storage && navigator.storage.persist) {
        try {
          await navigator.storage.persist();
        } catch {}
      }

      this._lockUnload();
      const manifest = await fetch(this.MANIFEST_URL).then((r) => r.json());
      const total = manifest.files.reduce((s, f) => s + f.size, 0);
      if (this.pct) this.pct.textContent = "0%";
      this._setStatus("Starting…");

      const est = await navigator.storage.estimate();
      const free = (est.quota ?? 0) - (est.usage ?? 0);
      if (free < total + 2_000_000) {
        throw new Error(
          `Not enough storage space. Need ~${Math.ceil(
            total / 1e6
          )}MB, free ~${Math.floor(free / 1e6)}MB`
        );
      }

      let done = 0;

      for (const f of manifest.files) {
        const url = new URL(f.path, SEM_ONNX_ROOT).href;
        this._setStatus(`Downloading ${f.path}…`);
        const blob = await this._downloadOne(url, f.sha256, (p) => {
          const cur = Math.round(((done + f.size * p) / total) * 100);
          if (this.bar) this.bar.value = cur;
          if (this.pct) this.pct.textContent = `${cur}%`;
        });
        await this._writeOPFS(f.path, blob);
        done += f.size;
      }

      // Mark installed
      const dir = await this._getDirHandle(true);
      const vh = await dir.getFileHandle("version.txt", { create: true });
      const w = await vh.createWritable();
      await w.write(manifest.version || "1");
      await w.close();
      localStorage.setItem(this.ENABLE_KEY, "1");

      if (this.bar) this.bar.value = 100;
      if (this.pct) this.pct.textContent = "100%";
      this._setStatus("Done.", "ok");
      if (this.onInstalled) this.onInstalled();
    } catch (e) {
      if (e.name === "AbortError") this._setStatus("Cancelled.", "muted");
      else this._setStatus(e.message || "Error", "danger");
      throw e; // let caller uncheck the switch
    } finally {
      this._unlockUnload();
    }
  }
}
