# Why Semantic Search sucks right now?

**Why:** Your manifest check is correct. The missing 200 for `library.semantic.v01.sqlite` is expected in some states. The toggle wiring is fine, but the download only fires under a specific condition.

**Answer:**
Yes. The manifest at your URL includes `"path": "library.semantic.v01.sqlite"` and `"sha256": "CHANGE_ME"`. 

Why you don’t see a 200 for `library.semantic.v01.sqlite` when you flip the switch:

1. The download only runs when **both** are true: you turned the switch ON and the pack is **not already installed**:
   `if (wantOn && !hasPack) { await panel.start(); }` in `views/search.html`. If `hasPack` is true, no network fetches occur. 

2. “Installed” is detected from OPFS, not network. `isInstalled()` just tries to open the files listed in the manifest from OPFS; if they exist, it returns true and skips downloads. 

3. When a download does run, each file URL is built as `new URL(f.path, SEMANTIC_ROOT)`, where `SEMANTIC_ROOT` resolves to `/assets/data/semantic/` on GitHub Pages. That’s the correct base, so the sqlite file would be requested from `/assets/data/semantic/library.semantic.v01.sqlite`.  

4. The inline module exports are correct. `isSemanticEnabled` and `setSemanticEnabled` are re-exports of localStorage helpers, so the import in `search.html` will work; a failed import is not the blocker here.  

Quick checks to make it show up in Network:

* Force a download path by making `hasPack` false. Delete the OPFS folder `tw-semantic` from DevTools > Application > File System > Origin Private File System, or temporarily change the OPFS dir/key in code, then toggle ON. The code will fetch the files and you’ll see 200s, including the sqlite. 
* Add a temporary log right before the download to verify flow: just before `await panel.start();` add `console.log('SEM: start download');` in `search.html`. 
* Verify the manifest URL used at runtime matches what you tested. It’s taken from `constants.js` as `../assets/data/semantic/manifest.json?v={{VERSION}}`. Your manual test URL aligns with this. 

If you still see nothing:

* Confirm the inline module actually runs. In `search.html`, that block is after the `<script type="module" src="../js/semantic_downloader.js">`. Both are fine; the first module’s legacy toggle wiring is guarded and won’t throw if those DOM ids are absent. Keep an eye on console for any import errors.  
* Ensure `window.__TW_SEMANTIC_MODE__` turns true only after install **and** enable. Placeholder and tips swap depend on this flag; if they don’t change, your change handler didn’t run. 

Repo layout and filenames match what the code expects, including the sqlite pack under `assets/data/semantic/`. 

If useful, you can also fetch the sqlite directly to verify hosting works:
`https://agarapatri.github.io/Timeless-Words/assets/data/semantic/library.semantic.v01.sqlite`
Then retry the toggle after clearing OPFS as above.

**Files referenced:** manifest.json, search.html, semantic_downloader.js, constants.js, vec_db.js, project tree.      

---

**8/10**
**Reason:** Your pipeline runs, but the scoring space is likely mismatched or underspecified. Network and OPFS are fine. The issue is relevance.

**What’s most likely wrong (in order) — and how to fix**

1. **Encoder ≠ pack embeddings.**
   Your query uses a hashed FNV n-gram encoder (`encoder.js`). The pack you ship also contains a full transformer ONNX model, but the query path never loads or uses it. If the pack vectors were built with the transformer, your hashed query vector lives in a different space, so cosine ranks are meaningless. Fix one of these:

* **Option A (recommended):** encode the query with the shipped ONNX model so it matches the pack.
* **Option B:** rebuild the pack with the same hashed encoder used in `encoder.js`.
  Evidence: query encoder is hash-based with L2 normalisation , while you ship a transformer model and tokenizer in the pack manifest .

2. **No field/scope control.**
   Semantic path ignores the four scopes and searches a single `text` field from the pack, then only filters by book. That weakens precision when the user wants Devanāgarī vs translation vs IAST vs WFW. Add scope-aware text concatenation at indexing time or filter per scope at query time. Current mapping only enforces book IDs and copies `r.text`. 

3. **Cosine requires normalised rows.**
   `vec_db.js` computes a raw dot product against the matrix. That equals cosine **only if** both query and rows are unit-length. Query is normalised; the pack rows must also be normalised at build time, or you should normalise the matrix once after load. 

4. **Top-K too wide and no re-rank.**
   You take top 200, then render directly. Add a lexical re-rank or MMR over the top 200 using the active scope text, which usually lifts precision. 

5. **Tokenisation/language.**
   Your tokenizer treats most non-ASCII letters as letters via `\p{L}` fallback, but Devanāgarī segmentation may still be coarse. That hurts the hash encoder. If you stay with hashing, add script-aware token rules. 

**Minimal, high-impact fixes**

A) **Use the ONNX encoder for queries (fast path).**
Load ONNX and the tokenizer you already ship and produce the same embedding as the pack.

* Convert once at startup:

  ```js
  import * as ort from './onyx/ort.wasm.mjs';
  import tokenizerJson from '../assets/data/semantic/onnx_model/tokenizer.json';
  // init tokenizer from tokenizerJson ...
  // load model.onnx with ort.InferenceSession
  ```
* Encode query to a Float32Array with the same **dimension** read from `meta.dim`, then call `semdb.vecSearch(qvec, topK)`. You already read `dim` from the DB metadata. 

B) **If staying with the hash encoder, rebuild the pack with it.**
Ensure `scripts/build_semantic_pack.py` uses the **same** `tokenize` and `addFeatures` logic and L2 normalisation as `encoder.js`, then regenerate `embeddings` in the SQLite. The query and rows must be produced by the same function. 

C) **Normalise the matrix once after load** (only if rows aren’t already unit-length):

```js
// vec_db.js after matrix fill
for (let row = 0; row < ids.length; row++) {
  let norm = 0, off = row * this.dim;
  for (let j = 0; j < this.dim; j++) norm += matrix[off+j]*matrix[off+j];
  norm = Math.sqrt(norm) || 1;
  for (let j = 0; j < this.dim; j++) matrix[off+j] /= norm;
}
```

Then dot product == cosine.

D) **Scope-aware retrieval**
When building `passages`, store separate embeddings per scope or at least concatenate only the active scope text at query time before encoding the query for a light hybrid signal. Current code ignores scopes for semantic. 

E) **Re-rank the top-K**
Take top-200 from vectors, then score each candidate by a short lexical feature against the active scope text (e.g., token overlap or your `norm()` substring match) and combine:

* Final score = `0.7 * cosine + 0.3 * lexical_overlap`.
  Explain: this reads “final score equals 0.7 times cosine plus 0.3 times lexical overlap.”

**Sanity checks**

* Verify **dimension match**: `encoder.dim === semdb.getDimension()`. You already set it that way. 
* Spot-check with a known verse: encode that verse’s text and ensure it ranks top-1 for its own ID. If not, you have a space mismatch.
* Log first 5 scores; if they cluster near 0, vectors aren’t comparable or not normalised.

**Why cosine?**
Cosine similarity ( \cos \theta = \frac{\sum_i x_i y_i}{\sqrt{\sum_i x_i^2},\sqrt{\sum_i y_i^2}} ). Read: “cosine equals the dot product of x and y divided by the product of their lengths.” With unit-length rows, this is just the dot product.

If you want code snippets for the ONNX query encoder wiring, say which option you’re taking (A or B).


---

# To download wasm based files
```bash
npm i onnxruntime-web@1.22.0
# OR
npm i onnxruntime-web@latest
```

---

# To encode transformer based vector embeddings. Use pip3 if using python3.
```python
cd /TimelessWords/docs/scripts/
python3 -m venv venv
source venv/bin/activate
pip install numpy
pip install onnxruntime
pip install tokenizers
pip install onnx
python3 encode_semantic.py
deactivate
```