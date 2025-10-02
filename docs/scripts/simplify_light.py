# This script performs a light simplification of an ONNX model by applying shape inference.
# It annotates the model with shape information, which can be useful for further processing.

from pathlib import Path
import onnx
from onnx import shape_inference

ROOT = Path(__file__).resolve().parent.parent
MODEL_DIR = ROOT / "assets" / "data" / "semantic" / "onnx_model"
INP = MODEL_DIR / "model.onnx"
OUT = MODEL_DIR / "model_simplified.onnx"

def main():
    if not INP.exists():
        raise FileNotFoundError(f"Missing ONNX model: {INP}")
    print(f"Shape-inference simplify: {INP}")
    m = onnx.load(str(INP))
    m = shape_inference.infer_shapes(m)  # annotate shapes
    # Keep external data layout unchanged
    onnx.save(m, str(OUT))
    print(f"Wrote {OUT}")

if __name__ == "__main__":
    main()
