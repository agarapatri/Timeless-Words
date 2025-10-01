// assets/vec_db.js
// Semantic DB helper that loads a compact SQLite pack from OPFS using sql.js
// and performs cosine similarity search fully in JavaScript.

import { DB } from "./constants.js";

async function getOPFSFileBuffer(dirName, fileName) {
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle(dirName, { create: false });
  const fh = await dir.getFileHandle(fileName);
  const file = await fh.getFile();
  return new Uint8Array(await file.arrayBuffer());
}

let sqlPromise = null;
function loadSqlModule() {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: (file) => `/js/sql_helpers/${file}`,
    });
  }
  return sqlPromise;
}

export class SemanticDB {
  constructor(opts = {}) {
    this.dir = opts.opfsDir || "tw-semantic";
    this.dbFile = opts.dbFile || DB.VEC_DB_NAME;
    this.dim = opts.dimension || null;
    this.ready = false;
    this.passages = new Map();
    this.ids = [];
    this.embeddingMatrix = null;
    this.meta = new Map();
  }

  async open() {
    if (this.ready) return this;
    const SQL = await loadSqlModule();
    const buf = await getOPFSFileBuffer(this.dir, this.dbFile);
    const db = new SQL.Database(buf);

    const metaRes = db.exec("SELECT key, value FROM meta");
    if (metaRes.length) {
      const { columns, values } = metaRes[0];
      for (const row of values) {
        this.meta.set(
          row[columns.indexOf("key")],
          row[columns.indexOf("value")]
        );
      }
    }
    if (!this.dim) {
      const metaDim = Number(this.meta.get("dim"));
      this.dim = Number.isFinite(metaDim) && metaDim > 0 ? metaDim : 384;
    }

    const passStmt = db.prepare(
      "SELECT id, work_id, division_id, chapter, verse_start, verse_end, text FROM passages ORDER BY id"
    );
    const ids = [];
    const passages = new Map();
    while (passStmt.step()) {
      const row = passStmt.getAsObject();
      const id = Number(row.id);
      ids.push(id);
      passages.set(id, {
        id,
        work_id: Number(row.work_id),
        division_id: Number(row.division_id),
        chapter: Number(row.chapter),
        verse_start: Number(row.verse_start),
        verse_end: Number(row.verse_end),
        text: String(row.text || ""),
      });
    }
    passStmt.free();

    const vecStmt = db.prepare("SELECT id, vector FROM embeddings ORDER BY id");
    const matrix = new Float32Array(ids.length * this.dim);
    const idIndex = new Map(ids.map((id, idx) => [id, idx]));
    while (vecStmt.step()) {
      const row = vecStmt.getAsObject();
      const id = Number(row.id);
      const idx = idIndex.get(id);
      if (idx === undefined) continue;
      const blob = row.vector; // Uint8Array
      const view = new Float32Array(
        blob.buffer,
        blob.byteOffset,
        blob.byteLength / 4
      );
      matrix.set(view, idx * this.dim);
    }
    vecStmt.free();
    db.close();

    this.ids = ids;
    this.passages = passages;
    this.embeddingMatrix = matrix;
    this.ready = true;
    return this;
  }

  getDimension() {
    return this.dim;
  }

  vecSearch(queryVec, topK = 100) {
    if (!this.ready) throw new Error("SemanticDB not opened");
    const dim = this.dim;
    if (!queryVec || queryVec.length !== dim) {
      throw new Error(
        `Query vector has dimension ${queryVec.length}; expected ${dim}`
      );
    }
    const scores = [];
    const matrix = this.embeddingMatrix;
    for (let row = 0; row < this.ids.length; row += 1) {
      let dot = 0;
      const offset = row * dim;
      for (let j = 0; j < dim; j += 1) {
        dot += matrix[offset + j] * queryVec[j];
      }
      scores.push({ id: this.ids[row], score: dot });
    }
    scores.sort((a, b) => b.score - a.score);
    const out = [];
    for (let i = 0; i < scores.length && out.length < topK; i += 1) {
      const { id, score } = scores[i];
      const passage = this.passages.get(id);
      if (!passage) continue;
      out.push({ ...passage, score });
    }
    return out;
  }
}
