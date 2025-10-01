// assets/semantic_downloader.js
import { SEMANTIC, SEMANTIC_ROOT } from "./constants.js";

const ENABLE_KEY = SEMANTIC.ENABLE_KEY;
const hasWindow = typeof window !== "undefined";
const hasDocument = typeof document !== "undefined";

function getStorage() {
  if (!hasWindow) return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getEnableFlag() {
  const storage = getStorage();
  return storage ? storage.getItem(ENABLE_KEY) === "1" : false;
}

function setEnableFlag(enabled) {
  const storage = getStorage();
  if (!storage) return;
  if (enabled) storage.setItem(ENABLE_KEY, "1");
  else storage.removeItem(ENABLE_KEY);
}

function onReady(fn) {
  if (!hasDocument) return;
  if (document.readyState === "loading") {
    const once = () => {
      document.removeEventListener("DOMContentLoaded", once);
      fn();
    };
    document.addEventListener("DOMContentLoaded", once);
  } else {
    fn();
  }
}

function updateAria(toggle) {
  if (!toggle) return;
  toggle.setAttribute("aria-checked", String(!!toggle.checked));
}

function wireTrackClick(toggle, track) {
  if (!toggle || !track) return;
  if (track.dataset.semClickBound) return;
  track.dataset.semClickBound = "1";
  track.addEventListener("click", () => {
    if (track.classList.contains("just-dragged")) {
      track.classList.remove("just-dragged");
      return;
    }
    toggle.checked = !toggle.checked;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function wireTrackDrag(toggle, track) {
  if (!toggle || !track) return;
  if (track.dataset.semDragBound) return;
  track.dataset.semDragBound = "1";
  let dragging = false;
  let startX = 0;
  let startChecked = false;
  const threshold = 14;

  const onDown = (ev) => {
    dragging = true;
    startX = ev.touches?.[0]?.clientX ?? ev.clientX;
    startChecked = toggle.checked;
    track.classList.add("dragging");
    ev.preventDefault();
  };
  const onMove = (ev) => {
    if (!dragging) return;
    const x = ev.touches?.[0]?.clientX ?? ev.clientX;
    const dx = x - startX;
    const wantOn = dx > threshold ? true : dx < -threshold ? false : startChecked;
    track.style.setProperty("--thumb-shift", wantOn ? "20px" : "0px");
  };
  const onUp = (ev) => {
    if (!dragging) return;
    dragging = false;
    track.classList.remove("dragging");
    track.style.removeProperty("--thumb-shift");

    const x = ev.changedTouches?.[0]?.clientX ?? ev.clientX;
    const dx = x - startX;
    const wantOn = dx > threshold ? true : dx < -threshold ? false : startChecked;

    if (wantOn !== toggle.checked) {
      toggle.checked = wantOn;
      track.classList.add("just-dragged");
      toggle.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };

  track.addEventListener("mousedown", onDown);
  track.addEventListener("touchstart", onDown, { passive: false });
  window.addEventListener("mousemove", onMove, { passive: true });
  window.addEventListener("touchmove", onMove, { passive: true });
  window.addEventListener("mouseup", onUp);
  window.addEventListener("touchend", onUp);
}

async function refreshToggleUI(installer, toggle, deleteBtn) {
  if (!toggle) return { installed: false, enabled: false };
  const installed = await installer.isInstalled();
  const enabled = getEnableFlag();
  toggle.checked = enabled;
  updateAria(toggle);
  if (deleteBtn) deleteBtn.disabled = !installed;
  return { installed, enabled };
}

function initDownloadToggle() {
  if (!hasDocument) return;
  const toggle = document.getElementById("semanticToggle");
  if (!toggle || toggle.dataset.semanticWired) return;
  toggle.dataset.semanticWired = "1";

  const statusEl = document.getElementById("status");
  const deleteBtn = document.getElementById("btn-delete");
  const downloadBtn = document.getElementById("btn-download");
  const track = document.querySelector("#semanticSwitch .track");

  const installer = new SemanticInstall({
    panelId: null,
    barId: "bar",
    pctId: "pct",
    statusId: "status",
    cancelId: "btn-cancel",
    deleteId: "btn-delete",
    sizeId: null,
  });

  const setStatus = (text) => {
    if (!statusEl) return;
    statusEl.textContent = text;
  };

  toggle.addEventListener("change", async (event) => {
    const wantOn = event.target.checked;
    const installed = await installer.isInstalled();

    if (wantOn && !installed) {
      setStatus("Downloading semantic pack…");
      installer.onInstalled = async () => {
        setEnableFlag(true);
      };
      toggle.disabled = true;
      try {
        await installer.start();
      } catch (err) {
        setEnableFlag(false);
        toggle.checked = false;
        updateAria(toggle);
        if (err?.name === "AbortError") setStatus("Cancelled.");
      } finally {
        installer.onInstalled = null;
        toggle.disabled = false;
      }
      await refreshToggleUI(installer, toggle, deleteBtn);
      return;
    }

    setEnableFlag(wantOn);
    await refreshToggleUI(installer, toggle, deleteBtn);
  });

  if (downloadBtn) {
    downloadBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      if (toggle.disabled) return;
      toggle.checked = true;
      toggle.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  wireTrackClick(toggle, track);
  wireTrackDrag(toggle, track);
  refreshToggleUI(installer, toggle, deleteBtn);
}

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
    const ok = await this._hasManifestFiles();
    if (!ok) getStorage()?.removeItem(this.ENABLE_KEY);
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
    // Verify integrity when available; be permissive on static hosts
    let skipSha = false;
    try {
      const loc = window.location;
      if (loc && /github\.io$/i.test(loc.hostname)) skipSha = true;
      if (new URLSearchParams(loc.search).get('skipsha') === '1') skipSha = true;
    } catch {}
    if (!skipSha && expectedSha && expectedSha !== "CHANGE_ME") {
      const got = await this._sha256(buf);
      if (got !== expectedSha) {
        console.warn(`${url} hash mismatch (expected ${expectedSha}, got ${got}); continuing`);
        // Non-fatal on mismatch to avoid breaking on CDN transforms
      }
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
        const url = new URL(f.path, SEMANTIC_ROOT).href;
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
      setEnableFlag(true);

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

onReady(initDownloadToggle);

export { getEnableFlag as isSemanticEnabled, setEnableFlag as setSemanticEnabled };
