"""
Simplified batch generator.

Input: a plain Python list of book titles.
Behavior: for each title, call the OpenAI API in a while-loop, requesting up to 10 verses per call.
Stopping: the model must reply with {"status":"END BOOK"} when no more verses remain. The loop breaks on that.
Safety: abort a book immediately on any API error OR if any verse has null/empty Sanskrit or translation.
Parsimony: very few retries, no speculative calls.


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
"""

from __future__ import annotations
import os, json, time, logging
from typing import List, Dict, Any, Optional

# -------------------- config --------------------
MODEL = "gpt-5-2025-08-07"
TEMPERATURE = 0.1
TOP_P = 1.0
SEED = 7  # for reproducibility
CHUNK_VERSES = 10  # verses per API call
MAX_RETRIES = 2    # strict: very few retries
RETRY_BACKOFF = 2.0

OUT_DIR = "out_books"

# -------------------- logging -------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
log = logging.getLogger("vedic_books_json")

# -------------------- client --------------------
try:
    from openai import OpenAI
    client = OpenAI()
except Exception as e:
    client = None
    log.error("OpenAI client not available: %s", e)


# -------------------- helpers -------------------
STYLE_BLOCK = """
You are an expert Sanskrit philologist and a Bhakti-era translator with deep familiarity with Śrīla A.C. Bhaktivedānta Swami Prabhupāda’s cadence and method.

GOAL
Produce renderings in a Prabhupāda-like cadence while avoiding verbatim copying. Emulate tone and method, not exact phrasing.

OUTPUT FORMAT (STRICT JSON OBJECT; NO MARKDOWN)
Either:
{"status":"END BOOK"}
or:
{
  "work": "<book title>",
  "section": "<canto/samhitā if applicable, else empty string>",
  "chapter": <int>,
  "verses": [
    {
      "number": <int>,
      "devanagari": "<full verse in Devanāgarī with line breaks>",
      "iast": "<IAST with line breaks>",
      "translation_prabhupada_style": "<2–4 short sentences in Prabhupāda-like cadence>",
      "purport_prabhupada_style": [
        "<principle>",
        "<practice>",
        "<cross-reference paraphrase>"
      ],
      "notes": "<optional textual note or empty string>"
    }
  ]
}

CONSTRAINTS
- Return JSON only.
- Output at most {chunk} verses per response; fewer if fewer remain.
- If there are no more verses for this book, return {"status":"END BOOK"}.
- Do NOT guess Sanskrit. If verse text is unavailable, return {"status":"END BOOK"}.
- No verbatim quotes from copyrighted translations; paraphrase only.
- Be faithful to Sanskrit sense. Mark doctrinal extensions as “inference” inside purport.
"""

def build_inputs(book_title: str, chapter: int, start_verse: int, count: int):
    return [
        {"role": "system", "content": STYLE_BLOCK.replace("{chunk}", str(count))},
        {"role": "user",
         "content": (
            f"BOOK: {book_title}\n"
            f"CHAPTER: {chapter}\n"
            f"START_VERSE: {start_verse}\n"
            f"COUNT: {count}\n"
            "Task: Output the next block of verses for this book and chapter in the required JSON schema. "
            "If this chapter ends, increment chapter and continue. "
            "If the book has no more verses, return {\"status\":\"END BOOK\"}."
         )},
    ]

def _extract_text(resp) -> str:
    # Robust parsing for Responses API
    txt = getattr(resp, "output_text", None)
    if txt:
        return txt
    # Fallback to raw tree
    try:
        return resp.output[0].content[0].text
    except Exception:
        pass
    raise RuntimeError("Could not extract text from Responses API result")

def safe_responses_json(inputs) -> dict:
    # Ensure OpenAI client is available even if initial import failed.
    # Minimal fix: lazy-init the client so client is not None at call time.
    global client
    if client is None:
        try:
            from openai import OpenAI
            client = OpenAI()
        except Exception as _e:
            raise RuntimeError(f"OpenAI client initialization failed: {_e}")
    last_err = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = client.responses.create(
                model=MODEL,
                input=inputs,
            )
            content = _extract_text(resp)
            return json.loads(content)
        except Exception as e:
            last_err = e
            if attempt >= MAX_RETRIES:
                break
            time.sleep(RETRY_BACKOFF ** attempt)
    raise RuntimeError(f"Responses API failed after {MAX_RETRIES} attempts: {last_err}")

def validate_chunk(payload: Dict[str, Any]) -> None:
    if payload is None:
        raise ValueError("Empty payload")
    if payload.get("status") == "END BOOK":
        return
    # minimal checks
    for k in ("work", "chapter", "verses"):
        if k not in payload:
            raise ValueError(f"Missing key: {k}")
    if not isinstance(payload["verses"], list) or not payload["verses"]:
        raise ValueError("verses must be a non-empty list")
    for v in payload["verses"]:
        for k in ("number", "devanagari", "iast", "translation_prabhupada_style"):
            if k not in v:
                raise ValueError(f"verse missing key: {k}")
            if not v[k]:
                raise ValueError(f"null/empty verse field: {k}")
        if "purport_prabhupada_style" in v and not isinstance(v["purport_prabhupada_style"], list):
            raise ValueError("purport_prabhupada_style must be a list if present")
        if "notes" in v and v["notes"] is None:
            raise ValueError("notes must be a string (use empty string)")

def append_chunk(book_store: Dict[str, Any], payload: Dict[str, Any]) -> (int, int):
    ch_num = int(payload["chapter"])
    while len(book_store["chapters"]) < ch_num:
        book_store["chapters"].append({
            "number": len(book_store["chapters"]) + 1,
            "title": f"Chapter {len(book_store['chapters']) + 1}",
            "section": 1,
            "section_title": "",
            "verses": []
        })
    target = book_store["chapters"][ch_num - 1]
    for v in payload["verses"]:
        target["verses"].append({
            "number": v["number"],
            "ref": f"{ch_num}.{v['number']}",
            "devanagari": v["devanagari"],
            "iast": v["iast"],
            "word_by_word": v.get("word_by_word", []),
            "translation": v["translation_prabhupada_style"]
        })
    return ch_num, target["verses"][-1]["number"]

def new_book_container(title: str) -> Dict[str, Any]:
    short = "".join(w[0] for w in title.split() if w).upper()[:3]
    bid = "".join(ch.lower() for ch in title if ch.isalnum())[:8]
    return {
        "id": bid,
        "short": short,
        "title": title,
        "author": None,
        "type": None,
        "date_of_origin": None,
        "chapters": []
    }


# -------------------- main loop per book --------------------
def process_book(title: str) -> Optional[Dict[str, Any]]:
    log.info("Processing book: %s", title)
    store = new_book_container(title)
    chapter = 1
    start_verse = 1
    calls = 0

    while True:
        inputs = build_inputs(title, chapter, start_verse, CHUNK_VERSES)

        try:
            payload = safe_responses_json(inputs)
        except Exception as e:
            log.error("API error on %s ch.%d v.%d: %s", title, chapter, start_verse, e)
            # Abort this book immediately
            return None

        if isinstance(payload, dict) and payload.get("status") == "END BOOK":
            log.info("END BOOK for %s", title)
            # Return None if nothing was gathered
            if any(len(ch["verses"]) for ch in store["chapters"]):
                return store
            return None

        # Validate and extra strict null checks
        try:
            validate_chunk(payload)
        except Exception as ve:
            log.error("Validation error on %s ch.%d v.%d: %s", title, chapter, start_verse, ve)
            return None

        verses_list = payload["verses"]
        if any(
            (not v.get("devanagari")) or
            (not v.get("iast")) or
            (not v.get("translation_prabhupada_style"))
            for v in verses_list
        ):
            log.error("Null Sanskrit or translation detected. Aborting: %s", title)
            return None

        # Append
        ch_num, last_vnum = append_chunk(store, payload)
        calls += 1

        # Advance
        if len(verses_list) < CHUNK_VERSES:
            # Chapter boundary reached
            chapter += 1
            start_verse = 1
        else:
            start_verse = last_vnum + 1


# -------------------- driver --------------------
if __name__ == "__main__":

    titles = [
        "Isa Upanishad",
        "Kena Upanishad"
    ]

    os.makedirs(OUT_DIR, exist_ok=True)
    for t in titles:
        result = process_book(t)
        if result is None:
            log.warning("No output (skipped/aborted): %s", t)
            continue
        path = os.path.join(OUT_DIR, f"{t.lower().replace(' ', '_')}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        log.info("Wrote %s", path)
