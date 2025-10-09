export const APP_VERSION = "803c9879";
export const DB_VERSION = "a92481a93ce3";
export const SEM_VERSION = "e952cb2b31f1";

const MOD = new URL(".", import.meta.url); // /docs/js/
export const DATA_ROOT = new URL("../assets/data/", MOD);
export const JS_ROOT = new URL("./", MOD);
export const SEMANTIC_ROOT = new URL("../assets/data/semantic/", import.meta.url);
export const SEM_ONNX_ROOT = new URL("../assets/data/semantic/onnx_model/", import.meta.url);

export const ENABLE_SEMANTIC = false;

export const DB = {
  DB_NAME: "library.a92481a93ce3.sqlite",
  VEC_DB_NAME: "library.semantic.v01.sqlite", // check manifest.json
  SQL_WASM_PATH: `sql_helpers/sql-wasm.wasm?v=${APP_VERSION}`,
};

export const SEARCH = {
  SEARCH_HINT_REGEX: "Search (regex, phrases, wildcards)…",
  SEARCH_HINT_SEMANTIC: 'Type "Who was the mother of Lord Krishna?"',
};

export const SEMANTIC = {
  ENABLE_KEY: "tw_semantic_enabled",
  OPFS_DIR: "tw-semantic",
  VERSION: SEM_VERSION,
  MANIFEST_URL: new URL(
    `../assets/data/semantic/manifest.json?v=${SEM_VERSION}`,
    import.meta.url
  ).href,
};
