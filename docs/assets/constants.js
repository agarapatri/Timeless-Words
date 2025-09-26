// docs/assets/constants.js  (ES module)
export const ENABLE_SEMANTIC = false;

export const DB = {
  DB_URL: "data/library.{{DB_VERSION}}.sqlite",
  WORKER_URL: "",
  SQL_WASM_URL: "assets/sql_helpers/sql-wasm.wasm",
};

export const SEARCH = {
  SEARCH_HINT_REGEX: "Search (regex, phrases, wildcards)…",
  SEARCH_HINT_SEMANTIC: 'Type "Who was the mother of Lord Krishna?"',
};

export const SEMANTIC = {
  ENABLE_KEY: "tw_semantic_enabled",
  OPFS_DIR: "tw-semantic",
  MANIFEST_URL: "semantic/manifest.json?v={{VERSION}}",
};
