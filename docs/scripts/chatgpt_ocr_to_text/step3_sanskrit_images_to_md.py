#!/usr/bin/env python3
"""
PDF → Images → OpenAI OCR+Translate → Single Markdown

- Input: one PDF
- Renders every page to PNG (PyMuPDF / fitz), then calls OpenAI Responses API
- Model returns Markdown in your exact verse format; we just append to one .md
- No local OCR logic: API does the heavy lifting. writes **one combined `.md` file**.

Install:
  pip install pymupdf
  pip install openai pymupdf tqdm python-dotenv
  export OPENAI_API_KEY="sk-..." # or put in a .env next to the script

Usage:
  python step3_sanskrit_images_to_md.py \
    --pdf "/path/to/book.pdf" \
    --out "/path/to/output.md" \
    --model "gpt-5.1" \
    --title "Bhaviṣya Purāṇa — Brāhmaparvan" \
    --dpi 300 \
    [--max-pages 20] [--keep-images]

Notes:
- Use --max-pages during testing to limit cost.
- Use --keep-images if you want to keep the rendered PNGs.

On Mac - Cut PDFs into multiple files based on page len - break into 10 pages. Merge those 8 page pdfs into single image to reduce API calls to ChatGPT
* command: pdfcpu split -m span input_file.pdf output_dir/ page_num
"""

import os
import re
import sys
import base64
import argparse
import tempfile
import time
from pathlib import Path

import fitz  # PyMuPDF
from tqdm import tqdm
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
client = OpenAI()

# ---------- Prompt enforcing YOUR exact format ----------
SYSTEM_PROMPT = """You are an expert Sanskrit philologist and translator.
You will be given a page IMAGE of a Sanskrit manuscript (may contain multiple verses).
Perform OCR yourself and return **only Markdown**, in the EXACT structure below for each verse.

For EACH verse on the page, output this block (repeat for multiple verses in reading order):

### <chapter>.<verse>            # e.g. "### 1.1"; if chapter not visible, use "### <verse>"

**Sanskrit (Devanāgarī)**
<Devanāgarī verse text, preserve original line breaks>

**Sanskrit (IAST)**
<IAST transliteration>

**Word-for-word**
- SanskritWord — EnglishGloss
- SanskritWord — EnglishGloss
- ...

**Translation**
<clear English translation>

---

Rules:
- Output **Markdown only** (no JSON, no commentary).
- Use standard IAST diacritics (ā ī ū ṛ ṝ ḷ ṃ ṁ ṇ ṭ ḍ ś ṣ ñ).
- If chapter or verse number is not visible, omit the chapter and use "### <verse>".
- If neither chapter nor verse number is visible, still output the block but use a generic header like "### 0.0".
- Keep punctuation like "।" and "॥" in Devanāgarī where present.
"""

USER_INSTRUCTION_TMPL = """Return the verses for this page as Markdown in the exact format above.
Work title (for context only): "{title}".
Do NOT include any top-level headers or notes; only the verse blocks with separators."""

def b64_data_url(image_path: Path) -> str:
    ext = image_path.suffix.lower().lstrip(".")
    mime = {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "tif": "image/tiff",
        "tiff": "image/tiff",
        "webp": "image/webp",
        "bmp": "image/bmp",
        "gif": "image/gif",
        "jfif": "image/jpeg",
    }.get(ext, "image/png")
    data = image_path.read_bytes()
    return f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}"

import time

def call_api_markdown(image_path: Path, model: str, title: str, max_retries: int = 3) -> str:
    """
    Call the OpenAI Responses API with an image.
    Retries up to max_retries on failure; raises after that.
    """
    image_url = b64_data_url(image_path)

    attempt = 0
    while attempt < max_retries:
        try:
            resp = client.responses.create(
                model=model,
                input=[
                    {
                        "role": "system",
                        "content": [
                            {"type": "input_text", "text": SYSTEM_PROMPT}
                        ],
                    },
                    {
                        "role": "user",
                        "content": [
                            {"type": "input_text", "text": USER_INSTRUCTION_TMPL.format(title=title)},
                            {"type": "input_image", "image_url": image_url},
                        ],
                    },
                ],
            )
            return resp.output_text.strip()

        except Exception as e:
            attempt += 1
            print(f"[{image_path.name}] API call failed (attempt {attempt}/{max_retries}): {e}")
            if attempt >= max_retries:
                # terminate process if 3 consecutive failures
                raise RuntimeError(f"Failed {max_retries} times for {image_path.name}. Aborting.")
            time.sleep(2 * attempt)  # simple backoff

def render_pdf_to_images(pdf_path: Path, out_dir: Path, dpi: int = 300) -> list[Path]:
    """
    Render each page of the PDF to PNG files in out_dir.
    Returns list of image paths in order.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    images = []
    for i, page in enumerate(doc):
        # PyMuPDF: zoom = dpi / 72
        zoom = dpi / 72.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img_path = out_dir / f"page-{i+1:04d}.png"
        pix.save(img_path.as_posix())
        images.append(img_path)
    return images

def main():
    ap = argparse.ArgumentParser(description="PDF → Images → OpenAI → Markdown (single file).")
    ap.add_argument("--pdf", required=True, help="Path to input PDF")
    ap.add_argument("--out", required=True, help="Path to output Markdown file")
    ap.add_argument("--model", default="gpt-5.1", help="OpenAI model (e.g., gpt-5.1, gpt-4.1, gpt-4o-mini)")
    ap.add_argument("--title", default="Sanskrit Manuscript", help="Top-level title for the Markdown")
    ap.add_argument("--dpi", type=int, default=300, help="Render DPI for PDF pages (default 300)")
    ap.add_argument("--max-pages", type=int, default=None, help="Limit pages for testing (e.g., 20)")
    ap.add_argument("--keep-images", action="store_true", help="Keep rendered page PNGs")
    args = ap.parse_args()

    pdf_path = Path(args.pdf).expanduser().resolve()
    out_file = Path(args.out).expanduser().resolve()
    out_file.parent.mkdir(parents=True, exist_ok=True)

    if not pdf_path.exists():
        print(f"PDF not found: {pdf_path}")
        sys.exit(1)

    # Temporary directory for rendered images (unless keeping)
    if args.keep_images:
        images_dir = out_file.parent / (out_file.stem + "_images")
        images_dir.mkdir(parents=True, exist_ok=True)
        cleanup = False
    else:
        tmpdir = tempfile.TemporaryDirectory(prefix="pdf_to_md_")
        images_dir = Path(tmpdir.name)
        cleanup = True

    # 1) Render PDF → PNG
    print(f"Rendering PDF pages at {args.dpi} DPI …")
    all_images = render_pdf_to_images(pdf_path, images_dir, dpi=args.dpi)
    if args.max_pages:
        all_images = all_images[: args.max_pages]

    if not all_images:
        print("No pages rendered from PDF.")
        sys.exit(1)

    # 2) Write top header & note ONCE
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(f"# {args.title}  \n")
        f.write(f"## Collected Verses\n\n")
        f.write("---\n\n")
        f.write("> **Note**: This file is prepared from OCR of your provided Sanskrit scan.  \n")
        f.write("> OCR cleanup is partial — Devanāgarī text may have minor errors. IAST and translations are included where possible.\n\n")
        f.write("---\n\n")

    # 3) Loop images → API → append Markdown
    print(f"OCR+translate {len(all_images)} page image(s) via OpenAI …")
    for img in tqdm(all_images, desc="Pages"):
        try:
            md = call_api_markdown(img, args.model, args.title)
            if md:
                with open(out_file, "a", encoding="utf-8") as f:
                    f.write(md.rstrip() + "\n\n")
        except Exception as e:
            with open(out_file, "a", encoding="utf-8") as f:
                f.write(f"<!-- ERROR {img.name}: {e} -->\n\n")

    print(f"Done. Markdown saved at: {out_file}")

    # 4) Cleanup temp images if not kept
    if cleanup:
        try:
            tmpdir.cleanup()  # type: ignore
        except Exception:
            pass

if __name__ == "__main__":
    main()
