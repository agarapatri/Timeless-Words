"""
cd TimelessWords/docs/scripts
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -U pip
pip install numpy
pip install onnxruntime
pip install tokenizers
python run.py
"""

import sqlite3, subprocess, sys
from pathlib import Path

HERE   = Path(__file__).resolve().parent
DOCS   = HERE.parent
ASSETS = DOCS / "assets"
DATA   = ASSETS / "data"
SEM    = DATA / "semantic"
ONNX   = SEM / "onnx_model"

# Auto-detect source DB like docs/assets/data/library.<anything>.sqlite (but not the semantic DB)
def find_source_db() -> Path:
    cands = sorted(p for p in DATA.glob("library.*.sqlite") if p.parent == DATA)
    if not cands:
        raise SystemExit("No source DB found under docs/assets/data/. Expected library.<version>.sqlite")
    return cands[0]

# Fixed semantic DB path per repo layout
SEM_DB = SEM / "library.semantic.v01.sqlite"

def run(cmd: list[str]) -> None:
    print("+", " ".join(str(x) for x in cmd))
    subprocess.run(cmd, check=True, cwd=HERE)

def detect_dim(db_path: Path) -> int:
    con = sqlite3.connect(str(db_path))
    cur = con.cursor()
    row = cur.execute("SELECT vector FROM embeddings LIMIT 1").fetchone()
    if not row or row[0] is None:
        con.close()
        raise SystemExit("No embeddings found after encode_semantic.py")
    dim = len(row[0]) // 4  # float32 bytes
    con.close()
    return dim

def set_meta(db_path: Path, dim: int) -> None:
    con = sqlite3.connect(str(db_path))
    cur = con.cursor()
    cur.execute("UPDATE meta SET value=? WHERE key='algorithm'", ("transformer-fp32",))
    cur.execute("UPDATE meta SET value=? WHERE key='dim'", (str(dim),))
    con.commit()
    con.close()

def main():

    run([sys.executable, "build_library_sqlite_from_jsons.py"])

    # Verify required files live under docs/assets/data/semantic/onnx_model
    required = ["tokenizer.json", "model.onnx"]
    missing = [f for f in required if not (ONNX / f).exists()]
    if missing:
        raise SystemExit(f"Missing {missing} in {ONNX}")

    # 1) Build semantic DB from site content DB
    source_db = find_source_db()
    run([sys.executable, "build_semantic_pack.py", "--source", str(source_db), "--out", str(SEM_DB)])

    # 2) Overwrite embeddings in-place with transformer FP32
    #    encode_semantic.py auto-discovers docs/assets/data/semantic and updates DB there.
    run([sys.executable, "encode_semantic.py"])

    # 3) Fix meta to reflect transformer vectors
    dim = detect_dim(SEM_DB)
    set_meta(SEM_DB, dim)

    # 4) Rebuild manifest.json in docs/assets/data/semantic
    run([sys.executable, "build_semantic_manifest.py"])

    print("done")

if __name__ == "__main__":
    main()
