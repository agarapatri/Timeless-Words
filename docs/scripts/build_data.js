#!/usr/bin/env node
// Build a single JS data bundle that works over file:// by embedding JSON
// Usage: node scripts/build_data.js
const fs = require('fs');
const path = require('path');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }

const ROOT = path.resolve(__dirname, '..');
const dataDir = path.join(ROOT, 'data');
const libPath = path.join(dataDir, 'library.json');
if (!exists(libPath)) { console.error('Missing data/library.json'); process.exit(1); }
const library = readJson(libPath);

const rows = {};
for (const item of library) {
  const file = item.file;
  const candidates = [
    path.join(dataDir, 'maha_puranas', file),
    path.join(dataDir, file)
  ];
  const src = candidates.find(exists);
  if (!src) { console.warn('WARN: Missing file for', item.id, file); continue; }
  const raw = readJson(src);
  let arr;
  if (Array.isArray(raw)) arr = raw;
  else {
    const bookObj = Array.isArray(raw.books) ? raw.books[0] : raw;
    arr = [];
    (bookObj.chapters||[]).forEach(ch => (ch.verses||[]).forEach(v => {
      arr.push({
        chapter: ch.number,
        verse: v.number,
        original_sanskrit: v.devanagari,
        iast_transliteration: v.iast,
        word_by_word: Array.isArray(v.word_by_word) ? v.word_by_word.map(p => [p.sanskrit, p.english]) : v.word_by_word,
        translation_en: v.translation
      });
    }));
  }
  rows[item.id] = arr;
}

const bundle = `window.DATA = ${JSON.stringify({ library, rows })};\n`;
const outFile = path.join(ROOT, 'assets', 'data-bundle.js');
fs.writeFileSync(outFile, bundle);
console.log('Wrote', path.relative(ROOT, outFile));

