"""
Batch generator for Sanskrit verse JSON via OpenAI Responses API.

- Input: list of book titles.
- For each book: loop calling Responses API in chunks of up to CHUNK_VERSES verses.
- The model must return either a JSON chunk (with chapters/verses) or {"status":"END BOOK"} to stop.
- All fields are PARSED into typed objects and preserved, including `word_by_word`.
- Output: one compiled JSON file per book under OUT_DIR.

Prereqs: pip install openai
Env:     OPENAI_API_KEY must be set.


Then for permanent storage:
export OPENAI_API_KEY="sk-xxxx"


For one-off use both at once:
export OPENAI_API_KEY="sk-xxxx"
python your_script.py


titles = [
        "Isa Upanishad",
        "Kena Upanishad",
        "Katha Upanishad",
        "Prasna Upanishad",
        "Munda Upanishad",
        "Mandukya Upanishad",
        "Taittiri Upanishad",
        "Aitareya Upanishad",
        "Chandogya Upanishad",
        "Brihadaranyaka Upanishad",

        "Brahma Upanishad",
        "Kaivalya Upanishad",
        "Jabala Upanishad",
        "Svetasva Upanishad",
        "Hamsa Upanishad",
        "Aruni Upanishad",
        "Garbha Upanishad",
        "Narayana Upanishad",
        "Paramahamsa Upanishad",
        "Amritabindu Upanishad",

        "Rig Veda",
        "Yajur Veda",
        "Sama Veda",
        "Atharva Veda",
        "Valmiki Ramayana",
        "Mahabharata",
        "Vishnu Purana",
        "Shiva Purana",
        "Devi Bhagavata Purana",
    ]

Notes:
- Uses Responses API. Do NOT send temperature/top_p/seed to reasoning-style models.


* Single book:

```
python batch_generate_vedic_json.py \
  --model gpt-4.1 \
  --books "Isa Upanishad" \
  --out-dir out_books
```

* Multiple books:

```
python batch_generate_vedic_json.py \
  --model gpt-4.1 \
  --books "Isa Upanishad" "Kena Upanishad" "Katha Upanishad" \
  --out-dir out_books
```
"""

from __future__ import annotations
import argparse
import json
import os
import sys
import time
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional

# -------------------- config --------------------
DEFAULT_MODEL = "gpt-5-2025-08-07"   # Use a Responses-capable model available to your account
CHUNK_VERSES = 10
MAX_RETRIES = 2
RETRY_BACKOFF = 1.8
OUT_DIR = "out_books"
BOOKS = [
        "Isa Upanishad",
    ]

# -------------------- client --------------------
try:
    from openai import OpenAI
except Exception as e:
    print(f"Import error: {e}", file=sys.stderr)
    sys.exit(2)

def _client() -> OpenAI:
    try:
        return OpenAI()
    except Exception as e:
        raise RuntimeError(f"OpenAI client initialization failed: {e}")

# -------------------- model I/O helpers --------------------
def _extract_text(resp: Any) -> str:
    txt = getattr(resp, "output_text", None)
    if isinstance(txt, str) and txt.strip():
        return txt
    try:
        return resp.output[0].content[0].text
    except Exception:
        pass
    try:
        payload = resp.model_dump()
        out = payload.get("output") or []
        if isinstance(out, list) and out:
            content = out[0].get("content") or []
            if isinstance(content, list) and content:
                text = content[0].get("text")
                if isinstance(text, str) and text.strip():
                    return text
    except Exception:
        pass
    raise RuntimeError("Could not extract text from Responses API result")

def call_responses_json(model: str, prompt: str) -> Dict[str, Any]:
    cli = _client()
    last_err: Optional[Exception] = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = cli.responses.create(model=model, input=prompt)
            return json.loads(_extract_text(resp))
        except Exception as e:
            last_err = e
            if attempt >= MAX_RETRIES:
                break
            time.sleep(RETRY_BACKOFF ** attempt)
    raise RuntimeError(f"Responses API failed after {MAX_RETRIES} attempts: {last_err}")

# -------------------- schema --------------------
@dataclass
class Gloss:
    sanskrit: str
    english: str

    @staticmethod
    def parse(d: Dict[str, Any]) -> "Gloss":
        return Gloss(
            sanskrit=str(d.get("sanskrit", "")).strip(),
            english=str(d.get("english", "")).strip(),
        )

@dataclass
class Verse:
    number: int
    ref: str
    devanagari: str
    iast: str
    translation: str
    word_by_word: List[Gloss] = field(default_factory=list)

    # Optional scholarly fields
    padaccheda: Optional[str] = None
    anvaya: Optional[str] = None
    meter: Optional[str] = None
    synonyms: List[Gloss] = field(default_factory=list)
    notes: Optional[str] = None
    variants: List[str] = field(default_factory=list)
    source: Optional[str] = None
    commentary: Optional[str] = None
    speaker: Optional[str] = None
    addressed_to: Optional[str] = None
    context: Optional[str] = None

    # Any additional unknown fields are preserved here
    extra: Dict[str, Any] = field(default_factory=dict)

    @staticmethod
    def _as_int(x: Any, default: int = 0) -> int:
        try:
            return int(x)
        except Exception:
            return default

    @staticmethod
    def parse(d: Dict[str, Any]) -> "Verse":
        # Required core
        number = Verse._as_int(d.get("number"))
        ref = str(d.get("ref", "")).strip()
        dev = str(d.get("devanagari", "")).strip()
        iast = str(d.get("iast", "")).strip()
        trans = str(d.get("translation", "")).strip()

        # Required: word_by_word
        wb = d.get("word_by_word", [])
        if not isinstance(wb, list) or not wb:
            raise ValueError("word_by_word must be a non-empty list")
        word_by_word = [Gloss.parse(x) for x in wb]

        # Optionals
        synonyms_raw = d.get("synonyms", [])
        synonyms = [Gloss.parse(x) for x in synonyms_raw] if isinstance(synonyms_raw, list) else []

        variants = d.get("variants", [])
        if not isinstance(variants, list):
            variants = []

        # Collect any unexpected extras (without overwriting typed fields)
        known = {
            "number","ref","devanagari","iast","translation","word_by_word","padaccheda","anvaya",
            "meter","synonyms","notes","variants","source","commentary","speaker","addressed_to",
            "context"
        }
        extra = {k: v for k, v in d.items() if k not in known}

        # Basic emptiness checks
        if number <= 0 or not ref or not dev or not iast or not trans:
            raise ValueError("Verse missing required non-empty fields")

        return Verse(
            number=number,
            ref=ref,
            devanagari=dev,
            iast=iast,
            translation=trans,
            word_by_word=word_by_word,
            padaccheda=(str(d["padaccheda"]).strip() if d.get("padaccheda") else None),
            anvaya=(str(d["anvaya"]).strip() if d.get("anvaya") else None),
            meter=(str(d["meter"]).strip() if d.get("meter") else None),
            synonyms=synonyms,
            notes=(str(d["notes"]).strip() if d.get("notes") else None),
            variants=[str(x) for x in variants],
            source=(str(d["source"]).strip() if d.get("source") else None),
            commentary=(str(d["commentary"]).strip() if d.get("commentary") else None),
            speaker=(str(d["speaker"]).strip() if d.get("speaker") else None),
            addressed_to=(str(d["addressed_to"]).strip() if d.get("addressed_to") else None),
            context=(str(d["context"]).strip() if d.get("context") else None),
            extra=extra,
        )

    def to_json(self) -> Dict[str, Any]:
        # Serialize while preserving optional and extra fields
        j = {
            "number": self.number,
            "ref": self.ref,
            "devanagari": self.devanagari,
            "iast": self.iast,
            "word_by_word": [asdict(g) for g in self.word_by_word],
            "translation": self.translation,
        }
        # Optionals only if present
        if self.padaccheda: j["padaccheda"] = self.padaccheda
        if self.anvaya: j["anvaya"] = self.anvaya
        if self.meter: j["meter"] = self.meter
        if self.synonyms: j["synonyms"] = [asdict(g) for g in self.synonyms]
        if self.notes: j["notes"] = self.notes
        if self.variants: j["variants"] = self.variants
        if self.source: j["source"] = self.source
        if self.commentary: j["commentary"] = self.commentary
        if self.speaker: j["speaker"] = self.speaker
        if self.addressed_to: j["addressed_to"] = self.addressed_to
        if self.context: j["context"] = self.context
        # Extras
        for k, v in self.extra.items():
            if k not in j:
                j[k] = v
        return j

@dataclass
class Chapter:
    number: int
    title: str
    section: int
    section_title: str
    verses: List[Verse] = field(default_factory=list)

    @staticmethod
    def _as_int(x: Any, default: int = 0) -> int:
        try:
            return int(x)
        except Exception:
            return default

    @staticmethod
    def parse(d: Dict[str, Any]) -> "Chapter":
        number = Chapter._as_int(d.get("number"))
        title = str(d.get("title", "")).strip()
        section = Chapter._as_int(d.get("section"))
        section_title = str(d.get("section_title", "")).strip()
        verses_raw = d.get("verses", [])
        if not isinstance(verses_raw, list) or not verses_raw:
            raise ValueError("Chapter.verses must be a non-empty list")
        verses = [Verse.parse(v) for v in verses_raw]
        if number <= 0 or not title:
            # Title can be empty in some corpora; relax title but keep number
            title = title  # no-op; allow empty
        return Chapter(number=number, title=title, section=section, section_title=section_title, verses=verses)

    def to_json(self) -> Dict[str, Any]:
        return {
            "number": self.number,
            "title": self.title,
            "section": self.section,
            "section_title": self.section_title,
            "verses": [v.to_json() for v in self.verses],
        }

@dataclass
class Book:
    id: str = ""
    short: str = ""
    title: str = ""
    author: str = ""
    type: str = ""
    date_of_origin: str = ""
    chapters: List[Chapter] = field(default_factory=list)

    @staticmethod
    def parse_chunk(d: Dict[str, Any]) -> "Book":
        if "chapters" not in d or not isinstance(d["chapters"], list):
            raise ValueError("Chunk missing 'chapters' list")
        chapters = [Chapter.parse(ch) for ch in d["chapters"]]
        return Book(
            id=str(d.get("id", "")).strip(),
            short=str(d.get("short", "")).strip(),
            title=str(d.get("title", "")).strip(),
            author=str(d.get("author", "")).strip(),
            type=str(d.get("type", "")).strip(),
            date_of_origin=str(d.get("date_of_origin", "")).strip(),
            chapters=chapters,
        )

    def to_json(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "short": self.short,
            "title": self.title,
            "author": self.author,
            "type": self.type,
            "date_of_origin": self.date_of_origin,
            "chapters": [ch.to_json() for ch in self.chapters],
        }

# -------------------- merge logic --------------------
def _find_chapter(book: Book, ch_num: int) -> Optional[Chapter]:
    for ch in book.chapters:
        if ch.number == ch_num:
            return ch
    return None

def merge_chunk(agg: Book, chunk: Book) -> None:
    # Fill top-level metadata once if missing
    for attr in ["id", "short", "title", "author", "type", "date_of_origin"]:
        if not getattr(agg, attr) and getattr(chunk, attr):
            setattr(agg, attr, getattr(chunk, attr))

    for ch in chunk.chapters:
        dest = _find_chapter(agg, ch.number)
        if dest is None:
            # Insert deep copy
            agg.chapters.append(Chapter(
                number=ch.number,
                title=ch.title,
                section=ch.section,
                section_title=ch.section_title,
                verses=list(ch.verses),
            ))
        else:
            # Update missing metadata
            if not dest.title and ch.title: dest.title = ch.title
            if not dest.section and ch.section: dest.section = ch.section
            if not dest.section_title and ch.section_title: dest.section_title = ch.section_title
            # Append all verses as parsed Verse objects
            dest.verses.extend(ch.verses)

def next_pointer_from_chunk(chunk: Book) -> Optional[tuple[int, int]]:
    last_ch = None
    last_v = None
    for ch in chunk.chapters:
        if not ch.verses:
            continue
        vnum = ch.verses[-1].number
        if last_ch is None or ch.number > last_ch or (ch.number == last_ch and vnum > (last_v or 0)):
            last_ch, last_v = ch.number, vnum
    if last_ch is None or last_v is None:
        return None
    return last_ch, last_v + 1

# -------------------- prompt --------------------
def build_prompt(book_title: str, chapter: int, start_verse: int, max_verses: int) -> str:
    return f"""
You are an expert Sanskrit philologist and a Bhakti-era translator with deep familiarity with Śrīla A.C. Bhaktivedānta Swami Prabhupāda’s cadence and method.

GOAL
Produce renderings in a Prabhupāda-like cadence while avoiding verbatim copying. Emulate tone and method, not exact phrasing. 
You are generating Sanskrit verses with strict JSON output. Return ONLY valid JSON. 
No commentary. No markdown. No preface or suffix text. No code fences.
Preserve key order, punctuation, diacritics, and whitespace precisely. Do not escape Unicode. Use UTF-8.

If no further verses exist at or after the requested position, return:
{{"status":"END BOOK"}}

Otherwise return a JSON object with this schema (include only chapters/verses produced in this chunk):
{{
  "id": "<short identifier>",
  "short": "<abbreviation>",
  "title": "{book_title}",
  "author": "<author attribution if applicable>",
  "type": "<genre>",
  "date_of_origin": "<historical range>",
  "chapters": [
    {{
      "number": <integer chapter>,
      "title": "<chapter title or empty>",
      "section": <integer or 0>,
      "section_title": "<string or empty>",
      "verses": [
        {{
          "number": <integer verse>,
          "ref": "<chapter.verse>",
          "devanagari": "<Devanāgarī verse>",
          "iast": "<IAST transliteration matching the Devanāgarī>",
          "word_by_word": [{{"sanskrit":"<lemma-or-segment>", "english":"<gloss>"}}],
          "translation": "<concise faithful English translation>",

          "padaccheda": "<optional>",
          "anvaya": "<optional>",
          "meter": "<optional>",
          "synonyms": [{{"sanskrit":"<lemma>", "english":"<gloss>"}}],  // optional
          "notes": "<optional>",
          "variants": ["<optional>"],
          "source": "<optional>",
          "commentary": "<optional>",
          "speaker": "<optional>",
          "addressed_to": "<optional>",
          "context": "<optional>"
        }}
      ]
    }}
  ]
}}

Constraints:
- Produce at most {max_verses} verses in this chunk, starting at chapter {chapter}, verse {start_verse}.
- Use correct Unicode for Devanāgarī and proper IAST diacritics.
- Required fields must be non-empty. "word_by_word" must be a non-empty array.
- Do not include extra top-level keys. Extra verse-level keys are allowed if accurate.
- No verbatim quotes from copyrighted translations; paraphrase only.
Request: Generate verses for "{book_title}" starting at chapter {chapter}, verse {start_verse}, up to {max_verses} verses.
""".strip()

# -------------------- driver --------------------
def process_book(model: str, book_title: str) -> Optional[Book]:
    agg = Book(title=book_title)
    chapter = 1
    start_verse = 1

    while True:
        prompt = build_prompt(book_title, chapter, start_verse, CHUNK_VERSES)
        payload = call_responses_json(model, prompt)

        if isinstance(payload, dict) and payload.get("status") == "END BOOK":
            break

        if not isinstance(payload, dict):
            raise ValueError("Model returned non-JSON-object payload")

        chunk = Book.parse_chunk(payload)
        merge_chunk(agg, chunk)

        nxt = next_pointer_from_chunk(chunk)
        if nxt is None:
            raise RuntimeError("Chunk contained no verses and no END BOOK. Stopping to avoid infinite loop.")
        chapter, start_verse = nxt

    return agg if agg.chapters else None

def write_book_json(out_dir: str, book: Book) -> str:
    os.makedirs(out_dir, exist_ok=True)
    title = book.title or "untitled"
    fname = f"{title.lower().replace(' ', '_')}.json"
    path = os.path.join(out_dir, fname)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(book.to_json(), f, ensure_ascii=False, indent=2)
    return path

def main() -> None:
    ap = argparse.ArgumentParser(description="Generate Sanskrit verse JSON for a list of books via OpenAI Responses API.")
    ap.add_argument("--model", default=DEFAULT_MODEL, help="Responses-capable model ID (e.g., gpt-4.1, gpt-4o)")
    ap.add_argument("--out-dir", default=OUT_DIR)
    ap.add_argument("--books", default=BOOKS, nargs="+", help="List of book titles, e.g. --books 'Isa Upanishad' 'Kena Upanishad'")
    args = ap.parse_args()

    failures = 0
    for title in args.books:
        try:
            book = process_book(args.model, title)
            if not book:
                print(f"[warn] No output for: {title}", file=sys.stderr)
                failures += 1
                continue
            path = write_book_json(args.out_dir, book)
            print(f"[ok] Wrote {path}")
        except Exception as e:
            print(f"[error] {title}: {e}", file=sys.stderr)
            failures += 1

    if failures:
        sys.exit(1)

if __name__ == "__main__":
    main()
