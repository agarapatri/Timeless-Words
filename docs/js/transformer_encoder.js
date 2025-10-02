// Transformer-based query encoder using Xenova transformers.js and local ONNX assets.
// Produces pooled (mean) and L2-normalized sentence embeddings.

import { pipeline, env } from "./vendor/transformers/transformers.min.js";

// Configure to load local model assets only (GitHub Pages friendly)
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.useBrowserCache = true;
// Point to the directory that contains the model folder ("onnx_model/")
env.localModelPath = new URL("../assets/data/semantic/", import.meta.url).href;
// Ensure ORT wasm resolves from our bundled path
try {
  // Some versions expose this nested path; guard if unavailable
  const wasmBase = new URL("./onyx/", import.meta.url).href;
  if (env.backends?.onnx?.wasm) {
    env.backends.onnx.wasm.wasmPaths = wasmBase;
    // GitHub Pages / localhost typically lack COOP/COEP → disable JSEP threads
    env.backends.onnx.wasm.numThreads = 1;
    env.backends.onnx.wasm.simd = true;
    // Force single-threaded (no worker) since GitHub Pages lacks cross-origin isolation
    env.backends.onnx.wasm.proxy = false;
    env.backends.onnx.wasm.worker = false;
  }
} catch {}

// Patch fetch to redirect expected /onnx/model.onnx → /model.onnx within our onnx_model folder
const BASE = new URL("../assets/data/semantic/onnx_model/", import.meta.url).href;
const originalFetch = globalThis.fetch?.bind(globalThis);
if (originalFetch) {
  globalThis.fetch = (input, init) => {
    try {
      const url = typeof input === "string" ? input : input.url;
      const u = new URL(url, globalThis.location?.href || BASE);
      // Map .../onnx/model.onnx → .../model.onnx
      if (u.href.startsWith(BASE + "onnx/model.onnx")) {
        const redirected = BASE + "model.onnx";
        if (typeof input === "string") return originalFetch(redirected, init);
        const req = new Request(redirected, input);
        return originalFetch(req, init);
      }
      // Do not remap quantized path: your tree stores it under /onnx/model_quantized.onnx
    } catch {}
    return originalFetch(input, init);
  };
}

export class TransformerEncoder {
  constructor(opts = {}) {
    this.modelId = opts.modelId || "onnx_model"; // folder name under env.localModelPath
    this.dim = null;
    this._extractor = null;
    this._ready = false;
  }

  async init() {
    if (this._ready) return this;
    // Prefer quantized for performance if available, else fallback to fp32
    try {
      this._extractor = await pipeline("feature-extraction", this.modelId, { quantized: true });
    } catch (e) {
      this._extractor = await pipeline("feature-extraction", this.modelId, { quantized: false });
    }
    this._ready = true;
    return this;
  }

  setDimension(d) {
    this.dim = Number(d) || this.dim;
  }

  async encode(text) {
    if (!this._ready) await this.init();
    const s = Array.isArray(text) ? text.filter(Boolean).join("\n") : String(text || "");
    if (!s) return new Float32Array(this.dim || 0);
    const out = await this._extractor(s, { pooling: "mean", normalize: true });
    // transformers.js returns a Tensor with a Float32Array in .data
    let data = out && out.data ? out.data : out;
    if (Array.isArray(data)) data = new Float32Array(data);
    if (!(data instanceof Float32Array)) data = new Float32Array(data);
    if (!this.dim) this.dim = data.length;
    return data;
  }
}
