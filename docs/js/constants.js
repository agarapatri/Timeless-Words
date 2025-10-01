const MOD = new URL(".", import.meta.url); // /Timeless-Words/js/
export const DATA_ROOT = new URL("../assets/data/", MOD);
export const JS_ROOT = new URL("./", MOD);
export const SEMANTIC_ROOT = new URL("../assets/data/semantic/", import.meta.url);
export const SEM_ONNX_ROOT = new URL("../assets/data/semantic/onnx_model/", import.meta.url);

export const ENABLE_SEMANTIC = false;

export const DB = {
  DB_NAME: "library.{{DB_VERSION}}.sqlite",
  VEC_DB_NAME: "library.semantic.v01.sqlite", // check manifest.json
  SQL_WASM_PATH: "sql_helpers/sql-wasm.wasm",
};

export const SEARCH = {
  SEARCH_HINT_REGEX: "Search (regex, phrases, wildcards)…",
  SEARCH_HINT_SEMANTIC: 'Type "Who was the mother of Lord Krishna?"',
};

export const SEMANTIC = {
  ENABLE_KEY: "tw_semantic_enabled",
  OPFS_DIR: "tw-semantic",
  MANIFEST_URL: new URL(
    "../assets/data/semantic/manifest.json?v={{VERSION}}",
    MOD
  ).href,
};
