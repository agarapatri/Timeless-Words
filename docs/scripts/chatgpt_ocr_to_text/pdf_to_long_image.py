#!/usr/bin/env python3
"""
Batch: Convert each PDF in a directory into one long (tall) image.

Usage:
  python pdf_to_image.py \
      --pdf-dir "/path/to/pdf_dir" \
      --out-dir "/path/to/output_dir" \
      [--dpi 150]

Each PDF will be rendered into a single tall PNG image with the same base filename.
"""

import argparse
from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image


def pdf_to_long_image(pdf_path: Path, out_path: Path, dpi: int = 150):
    """Convert one PDF into a single tall PNG image."""
    doc = fitz.open(pdf_path)
    images = []

    for page in doc:
        pix = page.get_pixmap(dpi=dpi)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        images.append(img)

    if not images:
        print(f"⚠️ Skipped empty PDF: {pdf_path}")
        return

    total_height = sum(img.height for img in images)
    max_width = max(img.width for img in images)

    merged = Image.new("RGB", (max_width, total_height), "white")

    y = 0
    for img in images:
        merged.paste(img, (0, y))
        y += img.height

    merged.save(out_path)
    print(f"✅ Saved {out_path}")


def main():
    parser = argparse.ArgumentParser(description="Convert all PDFs in a directory to long images.")
    parser.add_argument("--pdf-dir", required=True, help="Directory containing PDF files")
    parser.add_argument("--out-dir", required=True, help="Directory to save output PNGs")
    parser.add_argument("--dpi", type=int, default=150, help="Render DPI (default 150)")
    args = parser.parse_args()

    pdf_dir = Path(args.pdf_dir).expanduser().resolve()
    out_dir = Path(args.out_dir).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    pdf_files = sorted(pdf_dir.glob("*.pdf"))
    if not pdf_files:
        print(f"No PDFs found in {pdf_dir}")
        return

    for pdf in pdf_files:
        out_file = out_dir / (pdf.stem + ".png")
        try:
            pdf_to_long_image(pdf, out_file, dpi=args.dpi)
        except Exception as e:
            print(f"❌ Error processing {pdf}: {e}")


if __name__ == "__main__":
    main()
