Vedabase‑style Static Demo

What’s inside
- Pure HTML/CSS + tiny vanilla JS (no libraries)
- Pages: `index.html`, `search.html`, `book.html`, `verse.html`
- Data: `data/books.json` (sample)
- Responsive, mobile‑first layout. Font stack uses Helvetica Neue.

Develop locally
Open `index.html` in a browser with a local server (for `fetch`). For example:

Python 3: `python3 -m http.server`

Then visit http://localhost:8000

Structure
- `index.html`: Home with search bar and list of books
- `search.html`: Advanced search with six filters
- `book.html`: Book overview; expandable chapters; verse list
- `verse.html`: Verse detail with Devanāgarī, IAST, word‑for‑word, translation
- `assets/styles.css`: Styles
- `assets/app.js`: Data loader and helpers
- `assets/search.js`: Search logic
- `data/books.json`: Example data format

Data model
Each book contains chapters and verses. Verse fields map to your required sections:
- `number`, `ref` (e.g., "1.1")
- `devanagari` (Sanskrit Devanāgarī)
- `iast` (transliteration)
- `word_by_word`: array of `{ sanskrit, english }`
- `translation`

GitHub Pages
1) Create a new GitHub repo, add these files, push.
2) In repo Settings → Pages: set Source to `main` branch, root `/`.
3) Wait for deploy, then visit the Pages URL.

Extending data
Replace `data/books.json` with your full corpus. Keep IDs stable (used in URLs). No other changes required.

