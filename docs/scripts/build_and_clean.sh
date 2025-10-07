
# RUN from TimelessWords/docs/scripts: 
# chmod +x build_and_clean.sh && ./build_and_clean.sh

#!/usr/bin/env bash
set -euo pipefail

# create and enter venv under docs/scripts
python3 -m venv .venv
source .venv/bin/activate

# upgrade pip and install deps
python -m pip install -U pip
pip install numpy onnxruntime tokenizers

# run your pipeline
python run.py

# ensure no open handles before cleanup
deactivate || true

# cleanup
sqlite3 ../assets/data/semantic/library.semantic.v01.sqlite 'PRAGMA wal_checkpoint(TRUNCATE);'
sqlite3 ../assets/data/semantic/library.semantic.v01.sqlite 'PRAGMA journal_mode=DELETE;'
rm -f ../assets/data/semantic/library.semantic.v01.sqlite-{wal,shm}

rm -rf .venv/

# done
echo "Done!"