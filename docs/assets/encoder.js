// assets/encoder.js
// Minimal encoder for semantic search (browser-only).
// Requires you to include transformers.js once on pages that call this:
// <script type="module" src="https://cdn.jsdelivr.net/npm/@xenova/transformers/dist/transformers.min.js"></script>

export class QueryEncoder {
  constructor(opts = {}) {
    this.dir = opts.opfsDir || 'tw-semantic';
    this.modelPath = opts.modelPath || 'embedder.onnx';      // in OPFS
    this.tokPath   = opts.tokPath   || 'tokenizer.json';     // in OPFS
    this.pipeline = null;
  }

  async #getOPFSFile(path) {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle(this.dir, { create: false });
    const fh  = await dir.getFileHandle(path);
    return await fh.getFile();
  }

  async init() {
    if (this.pipeline) return;

    // Build a local filesystem mapping for Transformers.js
    // NOTE: We feed File objects directly as "local files" so it never fetches from network.
    const [tokFile, onnxFile] = await Promise.all([
      this.#getOPFSFile(this.tokPath),
      this.#getOPFSFile(this.modelPath),
    ]);

    // Transform OPFS files into "virtual URLs"
    const tokURL  = URL.createObjectURL(tokFile);
    const onnxURL = URL.createObjectURL(onnxFile);

    // Configure Transformers.js to use ONNX runtime, local files only.
    // eslint-disable-next-line no-undef
    const { pipeline, env } = window.transformers;
    env.allowRemoteModels = false;
    env.backends.onnx.wasm.wasmPaths = '/assets/onyx/'; // runtime loader only

    this.pipeline = await pipeline('feature-extraction', {
      // A pseudo "model" that references our local ONNX + tokenizer
      model: onnxURL,
      tokenizer: tokURL,
      dtype: 'fp32',
      quantized: false,
      // Pooling options: mean pooling is standard for sentence embeddings
      // will call .forward + mean over sequence
    });
  }

  /**
   * Encode a query string to a unit-normalized Float32Array vector.
   */
  async encode(text) {
    if (!this.pipeline) await this.init();

    // eslint-disable-next-line no-undef
    const output = await this.pipeline(text, { pooling: 'mean', normalize: true });
    // output.data is a Float32Array already normalized to L2=1
    return output.data;
  }
}
