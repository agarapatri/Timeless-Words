# This script builds the semantic manifest file used by the semantic model installer. It computes
# SHA-256 hashes and sizes for a predefined list of files and writes them to manifest.json

#!/usr/bin/env python3
import json
import hashlib
from pathlib import Path

# Anchor to repo root -> semantic dir
ROOT = Path(__file__).resolve().parent.parent
SEM = ROOT / "assets" / "data" / "semantic"
OUT = SEM / "manifest.json"

# Exact list and order you requested (relative to SEM)
REL_PATHS = [
    "library.semantic.v01.sqlite",
    "onnx_model/config.json",
    "onnx_model/model.onnx",
    "onnx_model/model_quantized.onnx",
    "onnx_model/ort_config.json",
    "onnx_model/special_tokens_map.json",
    "onnx_model/tokenizer.json",
    "onnx_model/tokenizer_config.json",
    "onnx_model/vocab.txt",
]

def sha256_file(p: Path, chunk_size: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for b in iter(lambda: f.read(chunk_size), b""):
            h.update(b)
    return h.hexdigest()

def main():
    files = []
    for rel in REL_PATHS:
        p = SEM / rel
        if p.exists():
            size = p.stat().st_size
            digest = sha256_file(p)
        else:
            # Keep entry with placeholders if not present yet
            size = 0
            digest = "CHANGE_ME"
        files.append({"path": rel, "size": size, "sha256": digest})

    manifest = {"version": "v01", "files": files}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(manifest, indent=2))
    print(f"Wrote {OUT.relative_to(ROOT)} with {len(files)} files")

if __name__ == "__main__":
    main()
