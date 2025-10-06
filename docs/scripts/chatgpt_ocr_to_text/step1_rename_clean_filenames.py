#!/usr/bin/env python3
"""
Rename all files in a directory by replacing non-alphanumeric characters with underscores.
Supports ASCII and Unicode letters/numbers.

Usage:
  python step1_rename_clean_filenames.py --dir "/path/to/folder"
"""

import argparse
from pathlib import Path

def clean_filename(name: str) -> str:
    """Replace all non-alphanumeric Unicode characters with underscores."""
    cleaned = []
    for ch in name:
        if ch.isalnum():   # True for letters/numbers across Unicode
            cleaned.append(ch)
        else:
            # print(f"Replacing {ch!r} (U+{ord(ch):04X}) with '_'")
            cleaned.append('_')
    return ''.join(cleaned)

def main():
    parser = argparse.ArgumentParser(description="Rename files by replacing non-alphanumeric chars with underscores.")
    parser.add_argument("--dir", required=True, help="Directory containing files to rename")
    args = parser.parse_args()

    target_dir = Path(args.dir).expanduser().resolve()
    if not target_dir.is_dir():
        print(f"❌ {target_dir} is not a directory")
        return

    for file in target_dir.iterdir():
        if file.is_file():
            new_name = clean_filename(file.stem) + file.suffix
            if new_name != file.name:
                new_path = file.with_name(new_name)
                print(f"Renaming: {file.name} → {new_name}")
                file.rename(new_path)

if __name__ == "__main__":
    main()
