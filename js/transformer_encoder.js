// Transformer-based query encoder using Xenova transformers.js and local ONNX assets.
// Produces pooled (mean) and L2-normalized sentence embeddings.

import { pipeline, env } from "./vendor/transformers/transformers.min.js?v=00a322e1";
import { SEM_VERSION, APP_VERSION } from "./constants.js";

// Configure to load local model assets only (GitHub Pages friendly)
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.useBrowserCache = true;
// Point to the directory that contains the model folder ("onnx_model/")
env.localModelPath = new URL("../assets/data/semantic/", import.meta.url).href;
// Ensure ORT wasm resolves from our bundled path
const TRANSFORMER_ROOT = new URL("./vendor/transformers/", import.meta.url);
const ONNX_RUNTIME_ROOT = new URL("./onnx_web/", import.meta.url);
const SEMANTIC_ROOT = new URL("../assets/data/semantic/", import.meta.url);
// Normalize all legacy/expected transformer paths to our flattened onnx_model directory.
const MODEL_REDIRECTS = new Map([
  [
    new URL("../assets/data/semantic/onnx_model/onnx/model.onnx", import.meta.url),
    new URL("../assets/data/semantic/onnx_model/model.onnx", import.meta.url),
  ],
  [
    new URL(
      "../assets/data/semantic/onnx_model/onnx/model_quantized.onnx",
      import.meta.url
    ),
    new URL("../assets/data/semantic/onnx_model/model_quantized.onnx", import.meta.url),
  ],
  [
    new URL("../assets/data/semantic/model.onnx", import.meta.url),
    new URL("../assets/data/semantic/onnx_model/model.onnx", import.meta.url),
  ],
  [
    new URL("../assets/data/semantic/model_quantized.onnx", import.meta.url),
    new URL("../assets/data/semantic/onnx_model/model_quantized.onnx", import.meta.url),
  ],
]);
const ORT_REDIRECTS = new Map([
  ["/js/vendor/transformers/ort-wasm-simd-threaded.jsep.mjs", "./onnx_web/ort-wasm-simd-threaded.jsep.mjs"],
  ["/js/vendor/transformers/ort-wasm-simd-threaded.jsep.wasm", "./onnx_web/ort-wasm-simd-threaded.jsep.wasm"],
  ["/js/vendor/transformers/ort-wasm-simd-threaded.mjs", "./onnx_web/ort-wasm-simd-threaded.mjs"],
  ["/js/vendor/transformers/ort-wasm-simd-threaded.wasm", "./onnx_web/ort-wasm-simd-threaded.wasm"],
  ["/js/vendor/transformers/ort.wasm.bundle.min.mjs", "./onnx_web/ort.wasm.bundle.min.mjs"],
  ["/js/vendor/transformers/ort.wasm.min.mjs", "./onnx_web/ort.wasm.min.mjs"],
  ["/js/vendor/transformers/ort.wasm.mjs", "./onnx_web/ort.wasm.mjs"],
]);

try {
  if (env.backends?.onnx?.wasm) {
    const wasmBase = new URL("./onnx_web/", import.meta.url).href;
    env.backends.onnx.wasm.wasmPaths = wasmBase;
    env.backends.onnx.wasm.numThreads = 1;
    env.backends.onnx.wasm.simd = true;
    // Force single-threaded (no worker) since GitHub Pages lacks cross-origin isolation
    env.backends.onnx.wasm.proxy = false;
    env.backends.onnx.wasm.worker = false;
  }
} catch {}

const originalFetch = globalThis.fetch?.bind(globalThis);
function versionedUrl(url) {
  let u = new URL(url, globalThis.location?.href ?? ONNX_RUNTIME_ROOT.href);
  for (const [from, to] of MODEL_REDIRECTS.entries()) {
    if (u.pathname === from.pathname) {
      const params = new URLSearchParams(u.search);
      u = new URL(to.href);
      if (params.toString()) {
        u.search = params.toString();
      }
      break;
    }
  }
  for (const [from, to] of ORT_REDIRECTS.entries()) {
    if (u.pathname.endsWith(from)) {
      const params = new URLSearchParams(u.search);
      u = new URL(to, import.meta.url);
      u.search = params.toString();
      break;
    }
  }
  if (u.href.startsWith(TRANSFORMER_ROOT.href) || u.href.startsWith(ONNX_RUNTIME_ROOT.href)) {
    u.searchParams.set("v", APP_VERSION);
  } else if (u.href.startsWith(SEMANTIC_ROOT.href)) {
    u.searchParams.set("v", SEM_VERSION);
  }
  return u;
}

if (originalFetch && !globalThis.__twVersionedFetch) {
  globalThis.__twVersionedFetch = true;
  globalThis.fetch = (input, init) => {
    try {
      if (typeof input === "string") {
        input = versionedUrl(input).href;
      } else if (input instanceof Request) {
        const url = versionedUrl(input.url).href;
        input = new Request(url, input);
      }
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

    const attempts = [
      { label: "fp32", opts: { quantized: false } },
      { label: "int8", opts: { quantized: true } },
    ];

    let lastError = null;
    for (const attempt of attempts) {
      try {
        this._extractor = await pipeline(
          "feature-extraction",
          this.modelId,
          attempt.opts
        );
        console.info(
          `[semantic] transformer encoder ready (${attempt.label})`
        );
        this._ready = true;
        return this;
      } catch (err) {
        console.warn(
          `[semantic] failed to load ${attempt.label} model, trying fallback`,
          err
        );
        lastError = err;
      }
    }

    throw lastError || new Error("semantic encoder: all model variants failed");
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
