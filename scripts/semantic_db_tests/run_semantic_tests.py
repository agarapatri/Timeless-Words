import sys
import subprocess
from pathlib import Path

def run(title: str, script_path: Path, *args: str):
    print(f"\n=== {title} :: {script_path} ===")
    subprocess.run([sys.executable, str(script_path), *args], check=True)

def find_db() -> Path:
    # If provided on CLI, use it.
    if len(sys.argv) > 1:
        p = Path(sys.argv[1]).expanduser().resolve()
        if not p.exists():
            raise SystemExit(f"Missing embedding DB: {p}")
        return p
    # Autodetect relative to repo
    here = Path(__file__).resolve()
    docs = here.parents[2]   # .../docs
    candidates = [
        docs / "assets" / "data" / "semantic" / "library.semantic.v01.sqlite",
        docs.parent / "scripts" / "assets" / "data" / "semantic" / "library.semantic.v01.sqlite",
    ]
    for p in candidates:
        if p.exists():
            return p
    raise SystemExit("Missing embedding DB. Pass path explicitly: python run_semantic_tests.py /path/to/db.sqlite")

def main():
    here = Path(__file__).resolve().parent         # .../docs/scripts/semantic_db_tests
    qa_quick = here / "quick_checks.py"
    qa_sanity = here / "sanity_report.py"

    if not qa_quick.exists() or not qa_sanity.exists():
        raise SystemExit("semantic_db_tests scripts not found under docs/scripts/semantic_db_tests")

    db_path = find_db()

    run("Quick checks", qa_quick, str(db_path))
    run("Sanity report", qa_sanity, str(db_path))

    print("\nAll tests completed.")

if __name__ == "__main__":
    main()
