// assets/vec_db.js
// Semantic DB adapter. Opens the OPFS-stored SQLite and exposes vecSearch().
// Uses sql.js HTTPVFS worker you already ship, but we read the DB from OPFS.

import { createDbWorker } from './sql_helpers/sqljs-httpvfs/index.js';

async function getOPFSFileBuffer(dirName, fileName) {
  const root = await navigator.storage.getDirectory();
  const dir  = await root.getDirectoryHandle(dirName, { create: false });
  const fh   = await dir.getFileHandle(fileName);
  const file = await fh.getFile();
  return await file.arrayBuffer();
}

export class SemanticDB {
  constructor(opts = {}) {
    this.dir = opts.opfsDir || 'tw-semantic';
    this.dbFile = opts.dbFile || 'library.semantic.v01.sqlite';
    this.sqlWasm = opts.sqlWasm || 'sql-wasm.wasm';
    this.sqliteVec = opts.sqliteVec || 'sqlite-vec.wasm';
    this.worker = null;
  }

  async open() {
    if (this.worker) return this.worker;

    // Load wasm binaries and database from OPFS
    const [wasmBin, vecWasm, dbBuf] = await Promise.all([
      getOPFSFileBuffer(this.dir, this.sqlWasm),
      getOPFSFileBuffer(this.dir, this.sqliteVec),
      getOPFSFileBuffer(this.dir, this.dbFile),
    ]);

    // Boot the worker. Many builds of sql.js-httpvfs accept wasmBinary and extensions.
    // If your version differs, we can adapt in the next step.
    this.worker = await createDbWorker(
      [{ from: 'buffer', buffer: dbBuf }],       // open from ArrayBuffer (no network)
      /* wasmModuleOrPath */ null,
      {
        wasmBinary: wasmBin,                     // use OPFS wasm
        extensions: [{ name: 'sqlite-vec', wasm: vecWasm }],
      }
    );

    return this.worker;
  }

  /**
   * Run a vector search using sqlite-vec and join back to passages.
   * @param {Float32Array} qvec  normalized vector
   * @param {number} topK
   * @returns array of rows: { id, work_id, chapter, verse_start, verse_end, text, distance }
   */
  async vecSearch(qvec, topK = 100) {
    await this.open();

    // Pass raw ArrayBuffer to the query param so sqlite-vec can read it
    const rows = await this.worker.db.query(
      `
      SELECT p.id, p.work_id, p.chapter, p.verse_start, p.verse_end, p.text, v.distance
      FROM vss_search('embeddings', $vec, $k) AS v
      JOIN passages p ON p.id = v.rowid
      ORDER BY v.distance ASC
      `,
      { $vec: qvec.buffer, $k: topK }
    );
    return rows;
  }

  /**
   * Optional: hybrid — blend BM25 from FTS with dense scores.
   * Requires an FTS table named passages_fts(content=passages, content_rowid=id).
   */
  async hybridSearch(qtext, qvec, { denseK = 150, bm25K = 300, alpha = 0.6 } = {}) {
    await this.open();

    // Dense
    const dense = await this.worker.db.query(
      `SELECT rowid AS id, distance FROM vss_search('embeddings', $vec, $k)`,
      { $vec: qvec.buffer, $k: denseK }
    );
    const denseMap = new Map(dense.map(r => [r.id, 1 / (1 + r.distance)]));

    // Lexical (BM25)
    const bm = await this.worker.db.query(
      `SELECT rowid AS id, bm25(passages_fts) AS bm FROM passages_fts WHERE passages_fts MATCH $q LIMIT $k`,
      { $q: qtext, $k: bm25K }
    );
    const bmMap = new Map(bm.map(r => [r.id, r.bm]));

    // Combine scores
    const ids = new Set([...denseMap.keys(), ...bmMap.keys()]);
    const scores = [];
    for (const id of ids) {
      const d = denseMap.get(id) || 0;
      const b = bmMap.get(id) || 0;
      // normalize BM25 roughly by max; fetch max lazily
      scores.push([id, alpha * d + (1 - alpha) * (b)]);
    }
    scores.sort((a,b) => b[1] - a[1]);
    const top = scores.slice(0, 100).map(x => x[0]);

    // Fetch rows
    const placeholders = top.map(()=>'?').join(',');
    if (!placeholders) return [];
    const rows = await this.worker.db.query(
      `SELECT id, work_id, chapter, verse_start, verse_end, text
       FROM passages WHERE id IN (${placeholders})`,
      top
    );
    // order rows by our ranking
    const order = new Map(top.map((id,i)=>[id,i]));
    rows.sort((a,b)=> order.get(a.id) - order.get(b.id));
    return rows.map(r => ({ ...r, distance: undefined }));
  }
}
