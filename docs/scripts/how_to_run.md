# How to run these scripts
* Almost all of them require these steps and better to do it in a separate virtual env within the scripts dir
```bash
cd /TimelessWords/docs/scripts/
python3 -m venv venv
source venv/bin/activate
pip install numpy
pip install onnxruntime
pip install tokenizers
pip install onnx
pip install onnxsim # This can fail. check below
python3 encode_semantic.py/quantize_dynamic.pt/... etc
deactivate
```

* To install onnxsim
```bash
brew install pyenv
brew install pyenv pyenv-virtualenv
pyenv virtualenv 3.11.9 onnxsim311
pyenv activate onnxsim311
pip install onnx onnxsim # This fails. Seek help.
python -m onnxsim assets/data/semantic/onnx_model/model.onnx assets/data/semantic/onnx_model/model_simplified.onnx
```

* Result of the installs

┏━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━┓
┃                        ┃ Original Model ┃ Simplified Model ┃
┡━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━┩
│ Add                    │ 2              │ 2                │
│ Attention              │ 6              │ 6                │
│ BiasGelu               │ 6              │ 6                │
│ Cast                   │ 1              │ 1                │
│ Constant               │ 84             │ 81               │
│ Gather                 │ 4              │ 4                │
│ LayerNormalization     │ 1              │ 1                │
│ MatMul                 │ 18             │ 18               │
│ ReduceSum              │ 1              │ 1                │
│ Shape                  │ 1              │ 1                │
│ SkipLayerNormalization │ 12             │ 12               │
│ Slice                  │ 1              │ 1                │
│ Unsqueeze              │ 1              │ 1                │
│ Model Size             │ 86.1MiB        │ 86.1MiB          │
└────────────────────────┴────────────────┴──────────────────┘


# ONNX Semantic Search Model Optimization and Packaging Pipeline
Goal: simplify → optimize → quantize → validate → compare → embed → inspect → pack → search.

## 0) Environment

Use your 3.11 venv (`onnxsim311`) to avoid ABI issues with ONNX/ORT.

**File:** `create_env.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

# Use pyenv's 3.11.9 if available
if command -v pyenv >/dev/null 2>&1; then
  pyenv install -s 3.11.9
  pyenv local 3.11.9
fi

python -V
python -m venv onnxsim311
source onnxsim311/bin/activate
python -m pip install -U pip wheel setuptools
pip install -r requirements.txt
```

**File:** `requirements.txt`

```txt
onnx>=1.14
onnxsim>=0.4
onnxruntime>=1.18
onnxruntime-tools>=1.7
numpy>=1.24
scipy>=1.10
pandas>=2.0
tqdm>=4.66
scikit-learn>=1.3
matplotlib>=3.8
faiss-cpu>=1.8
pyyaml>=6.0
```

Run:

```bash
bash create_env.sh
```

## 1) Inputs

Assume:

* FP32 ONNX model at `models/base/model_fp32.onnx`
* Calibration or sample data at `data/` (texts or tensors)
* Working dir is your `scripts/` folder

Adjust paths below if different.

## 2) Pipeline order and commands

1. **Light simplification**
   Removes no-op nodes and merges subgraphs for numerical equivalence.

```bash
python simplify_light.py \
  --in models/base/model_fp32.onnx \
  --out models/work/model_simplified.onnx
```

2. **Graph optimization**
   Fuses ops, constant-folds, sets graph-level flags.

```bash
python optimize_onnx.py \
  --in models/work/model_simplified.onnx \
  --out models/work/model_optimized_fp32.onnx
```

3. **Dynamic quantization to INT8**
   Produces smaller model for CPU inference.

```bash
python quantize_dynamic.py \
  --in models/work/model_optimized_fp32.onnx \
  --out models/work/model_int8.onnx
```

4. **Basic sanity checks**
   Shape, dtype, node counts, top-level metadata.

```bash
python quick_checks.py \
  --models models/work/model_optimized_fp32.onnx models/work/model_int8.onnx
```

5. **Functional verification**
   Run a fixed batch through both models and compare outputs with tolerances.

```bash
python verify_quantized.py \
  --fp32 models/work/model_optimized_fp32.onnx \
  --int8 models/work/model_int8.onnx \
  --data data/sample_inputs.npy \
  --rtol 1e-3 --atol 1e-3
```

6. **Smoke test on INT8**
   Quick forward pass timing and basic correctness.

```bash
python smoke_int8.py \
  --model models/work/model_int8.onnx \
  --data data/sample_inputs.npy
```

7. **Compare FP32 vs INT8 accuracy/latency**
   Summary table and plots.

```bash
python compare_fp32_vs_int8.py \
  --fp32 models/work/model_optimized_fp32.onnx \
  --int8 models/work/model_int8.onnx \
  --dataset data/benchmark.jsonl \
  --out reports/compare_fp32_int8.json
```

8. **Encode corpus to embeddings**
   Generates embeddings with the chosen model. Use FP32 for quality or INT8 for speed.

```bash
python encode_semantic.py \
  --model models/work/model_int8.onnx \
  --input data/corpus.tsv \
  --text-col text \
  --out embeddings/embeddings.npy \
  --id-out embeddings/ids.npy
```

9. **Inspect embeddings**
   Norms, variance, PCA preview, duplicate checks.

```bash
python inspect_embeddings.py \
  --embeddings embeddings/embeddings.npy \
  --ids embeddings/ids.npy \
  --report reports/embeddings_report.json
```

10. **Build semantic manifest**
    Creates metadata JSON for your pack.

```bash
python build_semantic_manifest.py \
  --name my_pack \
  --model-path models/work/model_int8.onnx \
  --dim 384 \
  --embedding-file embeddings/embeddings.npy \
  --ids-file embeddings/ids.npy \
  --out packs/my_pack_manifest.json
```

11. **Build semantic pack**
    Bundles model + manifest + resources.

```bash
python build_semantic_pack.py \
  --manifest packs/my_pack_manifest.json \
  --out packs/my_pack.tar.gz
```

12. **Example cosine search**
    Runs a query over the built embeddings.

```bash
python example_cosine_search.py \
  --embeddings embeddings/embeddings.npy \
  --ids embeddings/ids.npy \
  --query "example query" \
  --topk 10
```

13. **Sanity report**
    Aggregates metrics from prior steps into a single artifact.

```bash
python sanity_report.py \
  --models models/work/model_optimized_fp32.onnx models/work/model_int8.onnx \
  --compare reports/compare_fp32_int8.json \
  --emb-report reports/embeddings_report.json \
  --out reports/sanity_report.md
```

## 3) Cosine similarity reference

Equation:
[
\cos(\theta)=\frac{\mathbf{a}\cdot \mathbf{b}}{|\mathbf{a}|\ |\mathbf{b}|}
]
Read as: “cosine of theta equals dot product of vector a and vector b divided by the product of their magnitudes.”

Most scripts will L2-normalize embeddings, so cosine equals dot product.

## 4) If scripts need flags

If a script lacks the shown flags, use:

```bash
python <script>.py --help
```

or open the file to confirm argument names.

## 5) Optional helper scripts

**File:** `run_all.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
source onnxsim311/bin/activate

python simplify_light.py --in models/base/model_fp32.onnx --out models/work/model_simplified.onnx
python optimize_onnx.py --in models/work/model_simplified.onnx --out models/work/model_optimized_fp32.onnx
python quantize_dynamic.py --in models/work/model_optimized_fp32.onnx --out models/work/model_int8.onnx
python quick_checks.py --models models/work/model_optimized_fp32.onnx models/work/model_int8.onnx
python verify_quantized.py --fp32 models/work/model_optimized_fp32.onnx --int8 models/work/model_int8.onnx --data data/sample_inputs.npy --rtol 1e-3 --atol 1e-3
python smoke_int8.py --model models/work/model_int8.onnx --data data/sample_inputs.npy
python compare_fp32_vs_int8.py --fp32 models/work/model_optimized_fp32.onnx --int8 models/work/model_int8.onnx --dataset data/benchmark.jsonl --out reports/compare_fp32_int8.json
python encode_semantic.py --model models/work/model_int8.onnx --input data/corpus.tsv --text-col text --out embeddings/embeddings.npy --id-out embeddings/ids.npy
python inspect_embeddings.py --embeddings embeddings/embeddings.npy --ids embeddings/ids.npy --report reports/embeddings_report.json
python build_semantic_manifest.py --name my_pack --model-path models/work/model_int8.onnx --dim 768 --embedding-file embeddings/embeddings.npy --ids-file embeddings/ids.npy --out packs/my_pack_manifest.json
python build_semantic_pack.py --manifest packs/my_pack_manifest.json --out packs/my_pack.tar.gz
python example_cosine_search.py --embeddings embeddings/embeddings.npy --ids embeddings/ids.npy --query "example query" --topk 10
python sanity_report.py --models models/work/model_optimized_fp32.onnx models/work/model_int8.onnx --compare reports/compare_fp32_int8.json --emb-report reports/embeddings_report.json --out reports/sanity_report.md
```

## 6) Notes and common pitfalls

* Keep ONNX Runtime and ONNX versions compatible. If you see “Invalid graph” errors, re-run simplification, then optimization.
* If INT8 accuracy drops too far, try per-channel weight quantization and leave activations in FP16 or use QDQ tooling.
* Use the FP32 model for the embedding export if search quality matters more than speed.
* If FAISS is optional in your environment, remove it from `requirements.txt` and use pure NumPy search in `example_cosine_search.py`.

---

# Assessment of above steps

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
