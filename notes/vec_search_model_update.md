# Model Update
Update model for semantic search to get more accurate results.

## Github Limitations
* Max file size on GitHub is 1 to 2GB per file when marked as a large file.
* Max file size that we can push to github normally is 100MB. So larger models must be served differently to download the file when marked as large file in github attributes. Else github will only serve the pointer to the file and not the actual file itself when downloading the model.
* Also there are browser cache limitations based on the type of browser you use. Some browsers have aggressive cache clearing policies and can scrap the model files during low memory situations.

## Models

| Model                            | Best For                 | Size    | Dimensions | MTEB Score | Use Case                           | Download Link                                                   |
| -------------------------------- | ------------------------ | ------- | ---------- | ---------- | ---------------------------------- | --------------------------------------------------------------- |
| **Xenova/bge-small-en-v1.5**     | English, web-ready       | ~130 MB | 384        | ~51        | ✅ Web or localhost                 | [Download](https://huggingface.co/Xenova/bge-small-en-v1.5)     |
| **Xenova/bge-base-en-v1.5**      | English, balanced        | ~440 MB | 768        | ~58        | ✅ Better accuracy (offline OK)     | [Download](https://huggingface.co/Xenova/bge-base-en-v1.5)      |
| **Xenova/bge-large-en-v1.5**     | English, higher accuracy | ~1.3 GB | 1024       | ~64        | ⭐ Best single-vector BGE (offline) | [Download](https://huggingface.co/Xenova/bge-large-en-v1.5)     |
| **Xenova/multilingual-e5-small** | 100+ languages           | ~470 MB | 384        | ~54        | ✅ Cross-lingual search             | [Download](https://huggingface.co/Xenova/multilingual-e5-small) |
| **Xenova/gte-small**             | English, fast            | ~130 MB | 384        | ~52        | ✅ Lightweight swap                 | [Download](https://huggingface.co/Xenova/gte-small)             |
| **Xenova/gte-base**              | English, balanced        | ~400 MB | 768        | ~57        | ✅ Accuracy ↑ vs small              | [Download](https://huggingface.co/Xenova/gte-base)              |
| **Xenova/gte-large**             | English, higher accuracy | ~1.3 GB | 1024       | ~64–65     | ⭐ Strong offline choice            | [Download](https://huggingface.co/Xenova/gte-large)             |
| **Salesforce/SFR-Embedding-2_R** | State-of-the-art English (needs conversion) | ~7GB    | 4096       | ~69        | ⚠️ If size no issue                 | [Download](https://huggingface.co/Salesforce/SFR-Embedding-2_R) |


* **For local deployment (your case):**

   1. **Best choice**: `BAAI/bge-large-en-v1.5` - 20% better accuracy, manageable size
   2. **Budget option**: `BAAI/bge-base-en-v1.5` - Good middle ground
   3. **Maximum accuracy**: `Salesforce/SFR-Embedding-2_R` - If 7GB is acceptable

* **For browser/GitHub Pages:**
   - `Xenova/bge-small-en-v1.5` (ONNX-ready)

*  Note on Xenova vs BAAI

   - **Xenova models** = Pre-converted ONNX versions of BAAI models
   - Use Xenova if deploying to browser
   - Use BAAI if running locally with Python (better ecosystem support)

* Replace these files in your repo and re-encode the DB.

   * `docs/assets/data/semantic/onnx_model/model.onnx` → from Xenova repo. Your loader tries fp32 first. 
   * `docs/assets/data/semantic/onnx_model/model_quantized.onnx` → from Xenova repo. Your loader falls back to the quantized build. 
   * `docs/assets/data/semantic/onnx_model/config.json` → model config matching BGE-small-en-v1.5. 
   * `docs/assets/data/semantic/onnx_model/tokenizer.json` → tokenizer bundle for BGE. 
   * `docs/assets/data/semantic/onnx_model/tokenizer_config.json` → tokenizer settings. 
   * `docs/assets/data/semantic/onnx_model/special_tokens_map.json` → special tokens. 
   * `docs/assets/data/semantic/onnx_model/vocab.txt` → WordPiece vocab for BGE. 

* Also update after swapping the model

   * Rebuild and replace `docs/assets/data/semantic/library.semantic.v01.sqlite` with embeddings produced by **the same** BGE-small-en-v1.5 model. Your `SemanticDB` reads `meta.dim` and enforces query dim equality. 
   * Regenerate `docs/assets/data/semantic/manifest.json` (sizes + sha256 for all replaced files). Your manifest currently lists each ONNX and tokenizer asset. Run the command given below.

## How to create or update local database?

* Below are steps to create or update `library.{{DB_VERSION}}.sqlite` and `library.semantic.v01.sqlite`
* Before running the script, add json files into `TimelessWords/docs/scripts/json_samples`. Then run below command. The json data is present in `TimelessWords/extras/json_samples`. If you have your own data, you must follow the same json format and put them in this directory.
* Run below command from `TimelessWords/docs/scripts` directory: 
```bash
chmod +x build_db.sh && ./build_db.sh
```
* This will create a new library sqlite db and the semantic sqlite db with the new data that is present in `scripts/json_samples`. This is the only step needed to add new data to the sqlite db.
* Verify sqlite with tests. Run below command from `TimelessWords/docs/scripts` directory:
```bash
chmod +x semantic_db_tests/run_tests.sh && ./semantic_db_tests/run_tests.sh
```