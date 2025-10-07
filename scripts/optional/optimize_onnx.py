# This script optimizes an ONNX model by applying a series of graph optimization passes.
# If per_channel=True errors on your model, retry with per_channel=False.

from pathlib import Path
import onnx
try:
    from onnxsim import simplify
except ImportError as e:
    raise SystemExit(
        "onnxsim not installed. Install with: pip install onnxsim"
    ) from e

ROOT = Path(__file__).resolve().parent.parent
MODEL_DIR = ROOT / "assets" / "data" / "semantic" / "onnx_model"
INP = MODEL_DIR / "model.onnx"
OUT = MODEL_DIR / "model_simplified.onnx"

def main():
    if not INP.exists():
        raise FileNotFoundError(f"Missing ONNX model: {INP}")

    print(f"Simplifying: {INP}")
    model = onnx.load(str(INP))
    model_simp, check = simplify(model)
    if not check:
        raise RuntimeError("ONNX simplification check failed")
    onnx.save(model_simp, str(OUT))
    print(f"Wrote {OUT}")

if __name__ == "__main__":
    main()
