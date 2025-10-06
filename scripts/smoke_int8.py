# This script tests loading and running an INT8 quantized ONNX model using ONNX Runtime.

from pathlib import Path
import numpy as np
import onnx
import onnxruntime as ort

ROOT = Path(__file__).resolve().parent.parent
MD = ROOT / "assets" / "data" / "semantic" / "onnx_model"
INT8 = MD / "onnx" / "model_quantized.onnx"

# Discover vocab size from the word embedding initializer
def detect_vocab_size(model_path: Path) -> int:
    m = onnx.load(str(model_path))
    # common names to check
    keys = [
        "word_embeddings",
        "embeddings.word_embeddings",
        "/embeddings/word_embeddings",
        "bert.embeddings.word_embeddings.weight",
        "roberta.embeddings.word_embeddings.weight",
        "model.embed_tokens.weight",
    ]
    for init in m.graph.initializer:
        name = init.name
        if any(k in name for k in keys):
            # embedding weight has shape [vocab, hidden]
            if len(init.dims) >= 2:
                return int(init.dims[0])
    # fallback
    return 30522  # typical BERT base

def build_feed(sess: ort.InferenceSession, seq_len: int = 16):
    vocab = detect_vocab_size(INT8)
    feed = {}
    for inp in sess.get_inputs():
        shape = []
        for d in inp.shape:
            if isinstance(d, int):
                shape.append(d)
            else:
                # dynamic dims -> set batch=1, seq=seq_len, others=seq_len if 2D
                shape.append(1 if len(inp.shape) == 2 and d == inp.shape[0] else seq_len)
        name = inp.name.lower()
        if "mask" in name:
            arr = np.ones(shape, dtype=np.int64)
        elif "token_type" in name or "segment" in name:
            arr = np.zeros(shape, dtype=np.int64)  # 0 for all tokens
        elif "input_ids" in name or "ids" in name:
            arr = np.random.randint(0, vocab, size=shape, dtype=np.int64)
        else:
            # default to zeros int64
            arr = np.zeros(shape, dtype=np.int64)
        feed[inp.name] = arr
    return feed

sess = ort.InferenceSession(str(INT8), providers=["CPUExecutionProvider"])
feed = build_feed(sess, seq_len=16)
out = sess.run(None, feed)
print("OK. Output[0] shape:", out[0].shape)

