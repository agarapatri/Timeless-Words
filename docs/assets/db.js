import { DB } from "./constants.js";

const initSqlJs = globalThis.initSqlJs; // provided by the classic script tag
if (typeof initSqlJs !== "function") {
  throw new Error(
    'sql.js: initSqlJs global missing (check the <script src=".../sql-wasm.js"> tag)'
  );
}

let _dbPromise;
export async function loadDb() {
  if (_dbPromise) return _dbPromise;

  _dbPromise = (async () => {
    // 1) Init sql.js using your local wasm
    const SQL = await initSqlJs({
      locateFile: () => DB.SQL_WASM_URL,
    });

    // 2) Fetch the DB and open it in-memory (read-only)
    const resp = await fetch(DB.DB_URL);
    if (!resp.ok)
      throw new Error(`Failed to fetch DB: ${resp.status} ${resp.statusText}`);
    const buf = await resp.arrayBuffer();
    const db = new SQL.Database(new Uint8Array(buf));

    // 3) Adapter compatible with your page’s `query(...)` usage
    return {
      query: async (sql, params = []) => {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) rows.push(stmt.get());
        const columns = stmt.getColumnNames();
        stmt.free();
        return { columns, rows };
      },
    };
  })();

  return _dbPromise;
}

export async function query(sql, params) {
  const db = await loadDb();
  return db.query(sql, params);
}

// (optional) if you need it again
export async function findWork(token) {
  const db = await loadDb();
  const t = String(token ?? "");
  if (/^\d+$/.test(t)) {
    const r = await db.query(
      "SELECT work_id, slug, title_en, author FROM works WHERE work_id = ? LIMIT 1",
      [Number(t)]
    );
    return r.rows?.[0] ?? null;
  }
  const r1 = await db.query(
    "SELECT work_id, slug, title_en, author FROM works WHERE slug = ? LIMIT 1",
    [t]
  );
  if (r1.rows?.length) return r1.rows[0];
  const r2 = await db.query(
    "SELECT work_id, slug, title_en, author FROM works WHERE lower(title_en)=lower(?) LIMIT 1",
    [t]
  );
  return r2.rows?.[0] ?? null;
}
