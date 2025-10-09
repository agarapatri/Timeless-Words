# Tools

## Image Compression 
AVIF Image Format.
```bash
brew install libavif
avifenc --min 20 --max 30 --speed 6 input.jpg output.avif
```
### 1. `avifenc`

* The CLI tool that converts images (JPEG, PNG, etc.) into **AVIF**.

### 2. `--min 20`

* Lower Q → higher quality, larger file.

### 3. `--max 30`

* Higher Q → more compression, lower quality.
* Together, `--min 20 --max 30` tells the encoder: “Stay between high quality (Q=20) and reasonable compression (Q=30).” Values range **0 (lossless)** to **63 (lowest quality)**.

### 4. `--speed 6`

* Range: `0` (slowest, best compression efficiency) to `10` (fastest, least efficient).

### 5. `input.jpg`

* Your source file.

### 6. `output.avif`

* The destination AVIF file.


## Generate Directory Structure
```bash
brew install tree
tree --version
```
* Navigate to the directory you want tree to be generated.
```bash
tree > directory_structure.txt
```
* Output `directory_structure.txt` will be in the same directory.

---

## Cut PDF
* In terminal, to cut PDFs into multiple files based on page length
```bash
pdfcpu split -m span input_file.pdf output_dir/ page_count
```