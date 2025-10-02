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
  --dim 768 \
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

If you share any script `--help` output or errors, I will map flags precisely to your code.
