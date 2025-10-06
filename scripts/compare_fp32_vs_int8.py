# This script compares the outputs of FP32 and INT8 ONNX models using cosine similarity.
# It uses dummy inputs to simulate a batch and prints the cosine similarity of the first output vector.
# Usage: python scripts/compare_fp32_vs_int8.py
# Optional sanity check to confirm quantization didn’t change outputs materially.

from pathlib import Path
import numpy as np, onnxruntime as ort
from transformers import AutoTokenizer

ROOT = Path(__file__).resolve().parent.parent
MD = ROOT / "assets" / "data" / "semantic" / "onnx_model"
FP32 = MD / "model_simplified.onnx"
INT8 = MD / "onnx" / "model_quantized.onnx"
MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"  # change if different

tok = AutoTokenizer.from_pretrained(MODEL_ID)

def encode(sess, text):
    t = tok(text, return_tensors="np", padding="max_length", truncation=True, max_length=16)
    feed = {i.name: t.get(i.name, t.get(i.name.replace(":", "_"), None)) for i in sess.get_inputs()}
    # fallback mapping
    for k in list(feed.keys()):
        if feed[k] is None:
            name = k.split(":")[0]
            feed[k] = t.get(name, np.zeros([1,16], dtype=np.int64))
    out = sess.run(None, feed)[0]
    if out.ndim == 3:  # [B, T, H]
        out = out.mean(axis=1)
    v = out[0].astype(np.float32)
    v /= np.linalg.norm(v) + 1e-12
    return v

s_fp = ort.InferenceSession(str(FP32), providers=["CPUExecutionProvider"])
s_i8 = ort.InferenceSession(str(INT8), providers=["CPUExecutionProvider"])

text = "The quick brown fox jumps over the lazy dog."
v_fp = encode(s_fp, text)
v_i8 = encode(s_i8, text)
cos = float(np.dot(v_fp, v_i8))
print(f"cos(fp32,int8) ≈ {cos:.6f}  (target ≥ 0.995)")

