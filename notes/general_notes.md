# Operational limits to note:
* Git push hard limit: 100 MB per file. You are below it.
* GitHub Pages usage: ~1 GB site size and ~100 GB/month bandwidth. Heavy traffic may require a CDN.
* COOP/COEP: not needed for single-threaded WASM.
* Keep INT8 fallback for safety.


# Start a server
* For local testing
```bash
cd /Users/harekrsna/Desktop/Work/TimelessWords/docs
python3 -m http.server 8000
```


The `serve.js` file is a **simple server script** written using **Node.js** and the **Express framework**. Its primary function is to serve your static web files (HTML, CSS, JS, WASM, etc.) while setting specific HTTP headers required to enable advanced features for **SQLite WebAssembly (WASM)**.

Here's what it does and why it's structured the way it is:

-----

## 1\. Core Function: Serving Static Files

  * It uses Express to create a web server listening on port **`8000`** (`http://localhost:8000`).
  * The line `app.use(express.static(root, ...))` serves all the files in the same directory where `serve.js` is run (the `root` of your project, or `docs/` in the refactored structure).

-----

## 2\. Enabling SQLite WASM Persistence (COOP/COEP Headers)

This is the most critical purpose of the script. SQLite WASM needs the browser to be in a **Cross-Origin Isolated** state to unlock key features like:

  * **Persistent Storage (OPFS):** Allowing the large semantic database to be stored in the browser's origin-private file system (OPFS) so it doesn't need to be re-downloaded on every page reload.
  * **Threading/Performance:** Enabling multi-threading for better performance.

The script enables this by setting two mandatory HTTP headers:

  * `res.setHeader("Cross-Origin-Opener-Policy", "same-origin");` (**COOP**)
  * `res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");` (**COEP**)

Without these headers, your complex features, particularly those relying on the large semantic database and model, would fall back to a less performant mode, likely requiring re-downloading large packs and losing persistence.

-----

## Placement in the Refactored Structure

The `serve.js` file is a **development/utility script**, not an asset to be served to the end user.

  * **Original Location:** It was placed inside `docs/`.
  * **Recommended Refactored Location:** It should be moved **out of the web-served directory** (out of `public/` or `docs/`) and placed in the **project root** or a **dedicated `scripts`** folder if you have other server-side utilities.

**Recommended Placement:**

```
.
├── serve.js   <-- RECOMMENDED: Place in the project root
├── public/    <-- Where Express will serve the static files from
│   ├── index.html
│   └── ...
└── scripts/
    └── ... (Python build scripts)
```

That context is crucial\! Since your site is hosted on **GitHub Pages** and is configured to serve content directly from the **`docs`** directory, the `serve.js` file is **not required for deployment** and should **not** be run on GitHub Pages.

Here is what you need to know about `serve.js` in this scenario and its recommended placement:

-----

## `serve.js` on GitHub Pages

The `serve.js` script is a **Node.js/Express server** designed for **local development and testing**.

### 1\. Why `serve.js` is Not Needed for Deployment

GitHub Pages is a static file hosting service. It does not run Node.js or any server-side code like Express. It simply serves the files (HTML, CSS, JS, WASM) as-is from your repository. Therefore, you **cannot** use `serve.js` for your live site.

### 2\. The Critical Header Problem

The main function of `serve.js` is to add two HTTP headers (`Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy`) necessary to enable persistent storage and threading for **SQLite WASM**.

**GitHub Pages does not allow you to set custom headers.**

| Header | Purpose (Requires Node.js Server) | Status on GitHub Pages |
| :--- | :--- | :--- |
| **COOP/COEP** | Enables SQLite WASM persistence and threading. | **Cannot be set.** Your SQLite WASM will run in a fallback mode (no OPFS/threads). |

For your application to work, you must accept that the SQLite WASM persistence and performance will be limited on GitHub Pages. You must keep the file structure simple and ensure all your internal paths are correct relative to the `docs` directory.

### 3\. Recommended Placement

Since `serve.js` is strictly a development tool used only when working on your machine, it should be moved out of the deployed site's main directory.

**Action:** Move `serve.js` from the `docs` directory to the **project root** (`.`).

This placement signifies that it's a utility for the entire repository, not content to be served by GitHub Pages.

```
.
├── serve.js   <-- MOVED HERE (Used for local testing only)
├── README.md
├── directory_structure.txt
├── docs/      <-- GitHub Pages entry point (contains all deployed assets)
│   ├── index.html
│   ├── views/
│   ├── js/
│   └── assets/
└── prereqs/
```

We are discussing the **persistence of the 1GB SQLite vector database** on your **GitHub Pages** site, given the WebAssembly (WASM) implementation.

Here is the final, definitive answer regarding the repeated downloading:

## The Critical Answer: Why It Works (Mostly)

Based on the URL you provided and the reality of modern browser caching, **No, your users should generally NOT have to re-download the 1GB file every time they hit the site.**

The application manages this through the **Browser's HTTP Cache**, which serves as a replacement for the persistent storage (OPFS) you lost by not using the Express server (`serve.js`).

### How Persistence Works on GitHub Pages

| Feature | `serve.js` (Local Dev) | GitHub Pages (Live Site) |
| :--- | :--- | :--- |
| **Persistence Method** | **Origin Private File System (OPFS)** enabled by COOP/COEP headers. **Permanent Storage.** | **Standard HTTP Cache** managed by the browser and GitHub's headers. **Volatile/Temporary Storage.** |
| **Download Frequency** | Only once per user lifetime (unless the user clears the site data). | Once, until the **cache expires** or the **user manually clears the cache.** |
| **Cache Headers** | GitHub Pages automatically sets **long cache headers** (e.g., `max-age=1 year`) for static assets like `.sqlite`, `.wasm`, and `.onnx`. |

When a user visits your site and downloads the 1GB file, their browser saves it locally. On subsequent visits, the browser sends a request to GitHub Pages. Because GitHub Pages responds with a "File is still fresh" signal (based on the cache headers), the browser skips the download and loads the 1GB file instantly from its local disk.

### Conclusion on Downloads

You must accept the limitation that you are relying on the browser's standard, temporary cache, but for 99% of normal use, the user will only download the 1GB file **once**.

The scenarios where re-downloading *will* occur are:
1.  The user visits in **Incognito/Private Mode**.
2.  The user manually **clears their browser cache/site data**.
3.  The user hits the site after a very long period (e.g., a year) and the cache headers expire.

---

Reason: Your separation of roles is right: GitHub Pages won’t run Node/Express or set COOP/COEP, so `serve.js` is not used in production; caching will usually prevent repeated 1 GB downloads. Minor caveats: exact cache lifetimes on GitHub Pages are not user-configurable, private windows bypass cache, and immutable filenames help avoid accidental re-downloads after updates.

Answer: Keep `serve.js` in the repo root for local development only; it is unnecessary for GitHub Pages deployment.

Use it if:

* You want to test SQLite WASM with OPFS and threads locally (needs COOP/COEP).
* You want the `/docs/*` URL rewrite during local testing.

Safe to remove if:

* You only build and test the static site without OPFS/threading locally.
* You deploy solely to GitHub Pages and accept cache-based persistence.

Practical steps:

* Move to project root and add an npm script like: `dev: node serve.js`.
* Keep it out of `docs/` so it’s never served.
* For the 1 GB asset, use content-hashed filenames to leverage browser cache on GitHub Pages.

---

* fully-offline path is embeddings + a local vector index, optionally hybridized with a tiny lexical index and an on-device re-ranker.

---

# Assessment of steps to generate sqlite

The above steps are broadly correct for a transformers-based semantic search pipeline.  

Correctness rating: 8/10
Reason: The doc covers the end-to-end ONNX flow: simplify → optimize → quantize → verify → embed → index/search. It also includes cosine scoring and packaging. Gaps: tokenizer and pooling details are implicit, INT8 use for embedding quality needs caution, and large-scale ANN indexing choices are not specified.

Key confirmations

* Tokenizer artifacts exist and align with the model. 
* Cosine similarity is the right metric with L2-normalized embeddings. 
* The encode → inspect → search steps reflect a standard semantic search loop. 

High-impact fixes and additions

1. Make pooling explicit
   Specify how sentence embeddings are formed: CLS pooling vs mean pooling over token embeddings after attention mask. Ensure the script matches the model’s recommended pooling.

2. Be strict about preprocessing
   State that text must be tokenized with the exact tokenizer files shipped alongside the ONNX model (no manual lowercasing or stripping unless the tokenizer does it). 

3. Quantization guidance
   Prefer FP32 (or FP16) for offline corpus embedding to preserve quality. Use INT8 mainly for online query encoding if latency is critical. If INT8 is required end-to-end, consider QDQ with calibration and per-channel weight quant, and verify semantic drift with a retrieval benchmark. 

4. Dimensions and metadata
   Regarding step 10. **Build semantic manifest**, Do not hardcode `--dim 768` unless confirmed from the model outputs. Read the ONNX graph or config to set embedding size correctly in the manifest. 

5. Indexing at scale
   The example uses brute-force cosine. Add FAISS or HNSW (IVF-PQ/HNSW) for large corpora, and persist the index with the same metric and normalization settings used at build time. 

6. Max sequence length and truncation
   Document `max_length`, truncation, and padding strategy so query and corpus follow identical rules. Validate with a smoke test over long texts. 

7. Validation beyond numeric tolerance
   Add retrieval-level checks: NDCG / Recall@K before and after quantization to catch semantic drift not visible in tensor MSE. 

8. Browser/ONNX-WASM specifics (if applicable)
   Confirm attention masks, past-key-values support, and WASM build in the docs assets align with the model exported. 

Reference equation
[
\cos(\theta)=\frac{\mathbf{a}\cdot \mathbf{b}}{\lVert \mathbf{a}\rVert,\lVert \mathbf{b}\rVert}
]
Read as: “cosine of theta equals the dot product of vector a and vector b divided by the product of their magnitudes.” With L2-normalized embeddings, cosine equals the dot product. 


---

# From config.json

Correctness rating: 7/10
Reason: Sound slim BERT encoder for embeddings. Missing explicit sentence-level pooling and L2-normalization in the model stack. Tokenizer casing behavior not declared. ANN/index dim must be 384, not 768. Some fields are inert for BERT encoders.

Assessment and fixes

* Embedding size: 384. Set your index dim to 384.
* Heads: 12 heads → 32 dims/head. Valid.
* Depth: 6 layers. Fine for speed/latency tradeoff.
* Pooling: `architectures: ["BertModel"]` exposes only token embeddings. For semantic search add explicit pooling. Prefer mean pooling with attention mask over last hidden state.
* Normalization: L2-normalize pooled vectors before cosine search.
* Tokenizer: `vocab_size: 30522` implies BERT base uncased. Confirm `do_lower_case=true` in tokenizer config and use the exact tokenizer that trained this model.
* Max length: 512. Document truncation.
* Dropouts and dtype: fine. `use_cache` is ignored for encoder-only models.
* Quantization: if using INT8, validate retrieval metrics pre/post quantization.

Equations

* Mean pooling with mask (m_i\in{0,1}):
  [
  \mathbf{e}=\frac{\sum_{i=1}^{T} m_i,\mathbf{h}*i}{\sum*{i=1}^{T} m_i}
  ]
  Read as: the embedding ( \mathbf{e} ) equals the sum of token vectors ( \mathbf{h}_i ) where the mask ( m_i=1 ), divided by the count of unmasked tokens.
* L2 normalization:
  [
  \hat{\mathbf{e}}=\frac{\mathbf{e}}{\lVert \mathbf{e}\rVert_2}
  ]
  Read as: the normalized vector equals the vector divided by its Euclidean norm.
* Cosine similarity:
  [
  \cos(\theta)=\frac{\hat{\mathbf{e}}_q\cdot \hat{\mathbf{e}}_d}{\lVert \hat{\mathbf{e}}_q\rVert,\lVert \hat{\mathbf{e}}_d\rVert}= \hat{\mathbf{e}}_q\cdot \hat{\mathbf{e}}_d
  ]
  Read as: cosine equals the dot product of the normalized query and document vectors. Since both are unit length, cosine equals their dot product.

Actionable checklist

1. Add mean-pooling over the final hidden state with attention mask.
2. Apply L2 normalization to pooled vectors.
3. Set ANN index metric to cosine (or dot if you pre-normalize). Dim = 384.
4. Confirm tokenizer casing and special tokens; keep it identical at train and serve.
5. Document max_length, truncation, and padding.
6. If you quantize, recheck Recall@K/NDCG to detect semantic drift.


---

## Why it is the way it is

* `library.semantic.v01.sqlite` does not have cache busting through CLI because `manifest.json` also references this name.

