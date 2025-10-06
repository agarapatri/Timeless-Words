#!/usr/bin/env python3
"""
Convert all PDFs in a directory into page images.

pip install pymupdf pillow tqdm

- Input: directory of PDFs
- Output: one subfolder per PDF inside the output directory,
          with PNG images (one per page)

Usage:
  python step2_pdfs_to_images.py \
      --pdf-dir "/path/to/pdf_dir" \
      --out-dir "/path/to/output_images" \
      --dpi 300
"""

import fitz  # PyMuPDF
from pathlib import Path
import argparse
from tqdm import tqdm


def pdf_to_images(pdf_path: Path, out_dir: Path, dpi: int = 300):
    """Render each page of a PDF into PNG images inside out_dir."""
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)

    for i, page in enumerate(tqdm(doc, desc=f"{pdf_path.stem}")):
        zoom = dpi / 72  # scale factor
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, alpha=False)

        out_path = out_dir / f"{pdf_path.stem}_page-{i+1:04d}.png"
        pix.save(str(out_path))

    doc.close()


def main():
    parser = argparse.ArgumentParser(description="Convert PDFs to images (separate folder per PDF).")
    parser.add_argument("--pdf-dir", required=True, help="Directory containing PDFs")
    parser.add_argument("--out-dir", required=True, help="Output directory to hold subfolders with images")
    parser.add_argument("--dpi", type=int, default=300, help="DPI for rendering (default 300)")
    args = parser.parse_args()

    pdf_dir = Path(args.pdf_dir).expanduser().resolve()
    out_dir = Path(args.out_dir).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    pdf_files = sorted(pdf_dir.glob("*.pdf"))
    if not pdf_files:
        print(f"No PDFs found in {pdf_dir}")
        return

    for pdf in pdf_files:
        pdf_out_dir = out_dir / pdf.stem
        print(f"📄 Converting {pdf.name} → {pdf_out_dir}")
        try:
            pdf_to_images(pdf, pdf_out_dir, dpi=args.dpi)
        except Exception as e:
            print(f"❌ Error processing {pdf}: {e}")


if __name__ == "__main__":
    main()
