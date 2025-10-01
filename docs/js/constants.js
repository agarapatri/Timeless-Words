export const JS_ROOT = new URL("./", import.meta.url);
export const SEM_ROOT = new URL("../assets/data/semantic/", import.meta.url);
export const DATA_ROOT = new URL("../assets/data/", import.meta.url);

export const ENABLE_SEMANTIC = false;

export const DB = {
  DB_NAME: "library.{{DB_VERSION}}.sqlite",
  VEC_DB_NAME: "library.semantic.{{VEC_DB_VERSION}}.sqlite", // check manifest.json
  SQL_WASM_PATH: "sql_helpers/sql-wasm.wasm",
};

export const SEARCH = {
  SEARCH_HINT_REGEX: "Search (regex, phrases, wildcards)…",
  SEARCH_HINT_SEMANTIC: 'Type "Who was the mother of Lord Krishna?"',
};

const BASE = new URL('..', import.meta.url);          // resolves to .../views/
export const SEMANTIC = {
  OPFS_DIR: "tw-semantic",
  ENABLE_KEY: 'tw_semantic_enabled',
  MANIFEST_URL: new URL('../assets/data/semantic/manifest.json', BASE).href
};