# This script demonstrates how to perform dynamic quantization on an ONNX model using the ONNX Runtime.
# It reduces the model size and can improve inference speed, especially on CPU.

from pathlib import Path
import onnx
from onnx import shape_inference
from onnxruntime.quantization import quantize_dynamic, QuantType

ROOT = Path(__file__).resolve().parent.parent
MODEL_DIR = ROOT / "assets" / "data" / "semantic" / "onnx_model"
SRC = MODEL_DIR / "model_simplified.onnx"   # produced by onnxsim
TYPED = MODEL_DIR / "model_simplified_typed.onnx"
OUT_DIR = MODEL_DIR / "onnx"
OUT_DIR.mkdir(parents=True, exist_ok=True)
QOUT = OUT_DIR / "model_quantized.onnx"

def main():
    if not SRC.exists():
        raise FileNotFoundError(f"Missing ONNX model: {SRC}")

    # 1) Ensure shapes and dtypes are stamped into the graph
    print(f"Inferring shapes/types:\n  in : {SRC}\n  out: {TYPED}")
    m = onnx.load(str(SRC))
    m = shape_inference.infer_shapes(m)
    onnx.save(m, str(TYPED))

    # 2) Quantize with a default tensor type hint
    print(f"Quantizing:\n  in : {TYPED}\n  out: {QOUT}")
    extra_options = {"DefaultTensorType": onnx.TensorProto.FLOAT}
    try:
        quantize_dynamic(
            model_input=str(TYPED),
            model_output=str(QOUT),
            weight_type=QuantType.QInt8,
            per_channel=True,
            extra_options=extra_options,
        )
    except TypeError:
        # Fallback if this ORT build lacks per_channel or extra_options signature changes
        quantize_dynamic(
            model_input=str(TYPED),
            model_output=str(QOUT),
            weight_type=QuantType.QInt8,
            extra_options=extra_options,
        )
    print(f"Done. Wrote {QOUT}")

if __name__ == "__main__":
    main()
