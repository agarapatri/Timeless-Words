
# RUN from TimelessWords/docs/scripts: 
# chmod +x semantic_db_tests/run_tests.sh && ./semantic_db_tests/run_tests.sh

#!/usr/bin/env bash
set -euo pipefail

# Run from *either* docs/scripts or docs/scripts/semantic_db_tests
set -euo pipefail

# Normalize to docs/scripts as working dir
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "$(basename "$SCRIPT_DIR")" == "semantic_db_tests" ]]; then
  DOCS_SCRIPTS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
else
  DOCS_SCRIPTS_DIR="$SCRIPT_DIR"
fi
cd "$DOCS_SCRIPTS_DIR"

# create and enter venv under docs/scripts
python3 -m venv .venv
source .venv/bin/activate

# upgrade pip and install deps
python -m pip install -U pip
pip install numpy

# run your pipeline
python3 semantic_db_tests/run_semantic_tests.py

# ensure no open handles before cleanup
deactivate || true

# cleanup
rm -rf .venv/

# done
echo "Done!"