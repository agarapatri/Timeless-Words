# This script verifies the integrity of a quantized ONNX model by checking if it exists and is valid.

from pathlib import Path
import onnx

ROOT = Path(__file__).resolve().parent.parent
QOUT = ROOT / "assets" / "data" / "semantic" / "onnx_model" / "onnx" / "model_quantized.onnx"

if not QOUT.exists():
    raise FileNotFoundError(f"Quantized model not found at {QOUT}")
m = onnx.load(str(QOUT))
onnx.checker.check_model(m)
print("OK:", QOUT)
