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

## Pipeline order and commands

1. **Encode corpus to embeddings**
   Generates embeddings with the chosen model. Use FP32 for quality or INT8 for speed.

```bash
python encode_semantic.py \
  --model models/work/model_int8.onnx \
  --input data/corpus.tsv \
  --text-col text \
  --out embeddings/embeddings.npy \
  --id-out embeddings/ids.npy
```

2. **Build semantic manifest**
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

3. **Build semantic pack**
    Bundles model + manifest + resources.

```bash
python build_semantic_pack.py \
  --manifest packs/my_pack_manifest.json \
  --out packs/my_pack.tar.gz
```
