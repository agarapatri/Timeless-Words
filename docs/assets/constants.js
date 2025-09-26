// docs/assets/constants.js  (ES module)
// Update this to match your actual file name
export const DB_URL = "data/library.{{DB_VERSION}}.sqlite"; // or 'data/library.1.sqlite' if you rename it

export const WORKER_URL = "";
export const SQL_WASM_URL = "assets/sql_helpers/sql-wasm.wasm";
export const ENABLE_SEMANTIC = false;

export const SEMANTIC = {
  ENABLE_KEY: 'tw_semantic_enabled',
  OPFS_DIR: 'tw-semantic',
  MANIFEST_URL: 'semantic/manifest.json?v={{VERSION}}'
};
