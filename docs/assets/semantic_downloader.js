// assets/semantic_downloader.js
// Inline, resumable downloader. Stores files in OPFS. Non-blocking UI.

const SEM_ROOT = new URL("../semantic/", import.meta.url).href; // always /semantic/ next to /assets/

export class SemanticInstall {
  constructor(cfg) {
    this.OPFS_DIR = "tw-semantic";
    this.MANIFEST_URL = new URL("manifest.json?v={{VERSION}}", SEM_ROOT).href; // resolve once
    this.ENABLE_KEY = "tw_semantic_enabled"; // "1" when enabled, absent when disabled
    this.VERSION_KEY = "tw_semantic_version"; // stores last installed version (optional)

    this.panel = document.getElementById(cfg.panelId);
    this.bar = document.getElementById(cfg.barId);
    this.pct = document.getElementById(cfg.pctId);
    this.status = document.getElementById(cfg.statusId);
    this.btnCancel = document.getElementById(cfg.cancelId);
    this.btnDelete = document.getElementById(cfg.deleteId);
    this.sizeEl = document.getElementById(cfg.sizeId);

    this.controller = null;
    this.boundBeforeUnload = null;
    this.onInstalled = null;

    this.btnCancel?.addEventListener("click", () => this.cancel());
    this.btnDelete?.addEventListener("click", () => this.deletePack());
  }

  show() {
    if (this.panel) this.panel.style.display = "";
  }
  hide() {
    if (this.panel) this.panel.style.display = "none";
  }
  async isInstalled() {
    try {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle(this.OPFS_DIR, {
        create: false,
      });
      await dir.getFileHandle("version.txt", { create: false });
      return true;
    } catch {
      return false;
    }
  }

  async deletePack() {
    const root = await navigator.storage.getDirectory();
    try {
      await root.removeEntry(this.OPFS_DIR, { recursive: true });
      localStorage.removeItem(this.ENABLE_KEY);
      this._setStatus("Semantic pack deleted.");
      this.bar.value = 0;
      this.pct.textContent = "0%";
    } catch {
      this._setStatus("Nothing to delete.");
    }
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
    this.status.textContent = t;
    this.status.className = cls;
  }

  async _getDir() {
    const root = await navigator.storage.getDirectory();
    return root.getDirectoryHandle(this.OPFS_DIR, { create: true });
  }

  _lockUnload() {
    this.boundBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "Downloading semantic pack...";
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
      if (total) onProgress(received / total);
    }
    const blob = new Blob(chunks);
    const buf = await blob.arrayBuffer();
    if (expectedSha && expectedSha !== "CHANGE_ME") {
      const got = await this._sha256(buf);
      if (got !== expectedSha) throw new Error(`${url} hash mismatch`);
    }
    return new Blob([buf]);
  }

  async _writeOPFS(dir, name, blob) {
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await blob.stream().pipeTo(w);
  }

  async start() {
    try {
      this._lockUnload();
      console.log("Manifest URL:", this.MANIFEST_URL);
      const manifest = await fetch(this.MANIFEST_URL).then((r) => r.json());
      const total = manifest.files.reduce((s, f) => s + f.size, 0);
      if (this.sizeEl) this.sizeEl.textContent = `Total: ${this._fmt(total)}`;

      // Storage headroom check
      const est = await navigator.storage.estimate();
      if (est.quota - est.usage < total + 2_000_000) {
        this._setStatus("Not enough storage space.", "danger");
        return;
      }

      const dir = await this._getDir();
      let done = 0;

      for (const f of manifest.files) {
        const url = new URL(f.path, SEM_ROOT).href; // resolve under /semantic/
        console.log("Downloading:", url);
        this._setStatus(`Downloading ${f.path}…`);
        const blob = await this._downloadOne(url, f.sha256, (p) => {
          const cur = Math.round(((done + f.size * p) / total) * 100);
          this.bar.value = cur;
          this.pct.textContent = `${cur}%`;
        });
        await this._writeOPFS(dir, f.path, blob);
        done += f.size;
      }

      // Write version + mark installed & enabled
      const vh = await dir.getFileHandle("version.txt", { create: true });
      const w = await vh.createWritable();
      await w.write(manifest.version);
      await w.close();
      localStorage.setItem(this.VERSION_KEY, manifest.version);
      localStorage.setItem(this.ENABLE_KEY, "1");

      this.bar.value = 100;
      this.pct.textContent = "100%";
      this._setStatus("Semantic pack installed. Semantic is now On.", "ok");
      if (this.onInstalled) this.onInstalled();
    } catch (e) {
      if (e.name === "AbortError") this._setStatus("Cancelled.", "muted");
      else this._setStatus(e.message, "danger");
    } finally {
      this._unlockUnload();
    }
  }
}
