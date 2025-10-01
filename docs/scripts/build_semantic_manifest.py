#!/usr/bin/env python3
import json, hashlib, os, glob
from pathlib import Path

ROOT = Path(".")
OUT_MANIFEST = ROOT / "assets/data/semantic/manifest.json"

def sha256(p, chunk=1<<20):
  h = hashlib.sha256()
  with open(p, "rb") as f:
    for b in iter(lambda: f.read(chunk), b""):
      h.update(b)
  return h.hexdigest()

# Discover actual vector DB file even if versioned, e.g. library.semantic.v01.sqlite
vec_db_matches = sorted(glob.glob("assets/data/semantic/library.semantic.*.sqlite"))

# Fixed files as per project tree
onnx_model_files = [
  "assets/data/semantic/onnx_model/config.json",
  "assets/data/semantic/onnx_model/model.onnx",
  "assets/data/semantic/onnx_model/ort_config.json",
  "assets/data/semantic/onnx_model/special_tokens_map.json",
  "assets/data/semantic/onnx_model/tokenizer.json",
  "assets/data/semantic/onnx_model/tokenizer_config.json",
  "assets/data/semantic/onnx_model/vocab.txt",
]

wasm_runtime_files = [
  "js/onyx/ort.wasm.mjs",
  "js/onyx/ort.wasm.min.mjs",
  "js/onyx/ort.wasm.bundle.min.mjs",
  "js/onyx/ort-wasm-simd-threaded.wasm",
  "js/onyx/ort-wasm-simd-threaded.jsep.wasm",
]

files = vec_db_matches + onnx_model_files + wasm_runtime_files

items = []
for rel in files:
  p = ROOT / rel
  if not p.exists():
    raise FileNotFoundError(f"Missing expected file: {rel}")
  items.append({"path": rel, "size": p.stat().st_size, "sha256": sha256(p)})

manifest = {"version": "v01", "files": items}

OUT_MANIFEST.parent.mkdir(parents=True, exist_ok=True)
OUT_MANIFEST.write_text(json.dumps(manifest, indent=2))
print(f"{OUT_MANIFEST} written with {len(items)} files")
