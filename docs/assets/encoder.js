// assets/encoder.js
// Lightweight query encoder that mirrors the hashed embeddings used in
// build_semantic_pack.py.  It uses deterministic FNV-1a hashing on tokens and
// character n-grams, then L2 normalises the resulting vector.

const FNV_OFFSET = BigInt('0xcbf29ce484222325');
const FNV_PRIME = BigInt('0x100000001b3');
const MASK64 = BigInt('0xffffffffffffffff');
const textEncoder = new TextEncoder();
let unicodeAlphaNum = null;
const FALLBACK_PUNCT = new Set(['।', '॥', '–', '—', '…']);
try {
  unicodeAlphaNum = new RegExp('[\\p{L}\\p{N}]', 'u');
} catch (err) {
  unicodeAlphaNum = null;
}

function fnv1a64(bytes) {
  let hash = FNV_OFFSET;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & MASK64;
  }
  return hash;
}

function isAlphaNum(ch) {
  if (unicodeAlphaNum) {
    unicodeAlphaNum.lastIndex = 0;
    if (unicodeAlphaNum.test(ch)) return true;
  }
  const code = ch.codePointAt(0);
  if (code === undefined) return false;
  if (code >= 48 && code <= 57) return true; // 0-9
  if (code <= 0x7f) {
    // ASCII letters
    return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
  }
  // Fallback heuristic: treat most non-ASCII characters as letters except
  // for a small set of known punctuation marks used in the corpus.
  return !FALLBACK_PUNCT.has(ch);
}

function tokenize(text) {
  const tokens = [];
  let current = '';
  for (const ch of text.toLowerCase()) {
    if (isAlphaNum(ch)) {
      current += ch;
    } else if (current) {
      tokens.push(current);
      current = '';
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

function addFeatures(vec, token, dim) {
  if (!token) return;
  const base = Number(fnv1a64(textEncoder.encode(token)) % BigInt(dim));
  vec[base] += 1;

  if (token.length >= 4) {
    for (let i = 0; i < token.length - 1; i += 1) {
      const bigram = token.slice(i, i + 2);
      const idx = Number(
        fnv1a64(textEncoder.encode(`bg:${bigram}`)) % BigInt(dim)
      );
      vec[idx] += 0.5;
    }
  }

  if (token.length >= 6) {
    for (let i = 0; i < token.length - 3; i += 1) {
      const quad = token.slice(i, i + 4);
      const idx = Number(
        fnv1a64(textEncoder.encode(`cg:${quad}`)) % BigInt(dim)
      );
      vec[idx] += 0.25;
    }
  }
}

function embedText(textParts, dim) {
  const vec = new Float32Array(dim);
  for (const part of textParts) {
    if (!part) continue;
    for (const token of tokenize(part)) {
      addFeatures(vec, token, dim);
    }
  }
  let norm = 0;
  for (let i = 0; i < vec.length; i += 1) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < vec.length; i += 1) vec[i] /= norm;
  }
  return vec;
}

export class QueryEncoder {
  constructor(opts = {}) {
    this.dim = opts.dimension || 384;
  }

  setDimension(d) {
    this.dim = d;
  }

  encode(text) {
    const merged = Array.isArray(text) ? text : [text];
    return embedText(merged, this.dim);
  }
}
