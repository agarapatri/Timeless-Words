// Minimal shared helpers and dataset loader (no libraries)
(function () {
  const Library = {
    cache: null,
    _booksCache: new Map(),
    async load() {
      if (this.cache) return this.cache;
      // Prefer per-book JSONs under /books; fall back to data/books.json; then to inline sample
      const SOURCES = [
        { path: 'books/vishnu_puran.json', id: 'vp', title: 'Vishnu Puran', short: 'VP' },
        { path: 'books/shiva_puran.json',  id: 'sp', title: 'Shiva Puran',  short: 'SP' }
      ];
      try {
        const loaded = await Promise.all(
          SOURCES.map(async meta => {
            try {
              const v = Date.now();
              const res = await fetch(`${meta.path}?v=${v}`, { cache: 'no-store' });
              if (!res.ok) throw new Error('HTTP ' + res.status);
              const json = await res.json();
              // Normalize shapes:
              // 1) Array of verse rows [{chapter,verse,original_sanskrit,...}]
              // 2) { books:[book] } or { chapters:[...] }
              let book;
              if (Array.isArray(json)) {
                // Build chapters from flat rows
                const map = new Map();
                for (const row of json) {
                  const chNum = Number(row.chapter || 0) || 0;
                  if (!map.has(chNum)) map.set(chNum, { number: chNum, title: `Chapter ${chNum || 1}`, verses: [] });
                  const wfw = Array.isArray(row.word_by_word)
                    ? row.word_by_word.map(([sk, en]) => ({ sanskrit: sk, english: en }))
                    : (row.word_by_word || []);
                  map.get(chNum).verses.push({
                    number: Number(row.verse || 0) || 0,
                    ref: `${chNum || ''}.${row.verse || ''}`.replace(/^\./,'').trim(),
                    devanagari: row.original_sanskrit || row.devanagari || '',
                    iast: row.iast_transliteration || row.iast || '',
                    word_by_word: wfw,
                    translation: row.translation_en || row.translation || ''
                  });
                }
                const chapters = Array.from(map.values()).sort((a,b)=>a.number-b.number);
                chapters.forEach(ch => ch.verses.sort((a,b)=>a.number-b.number));
                book = { id: meta.id, title: meta.title, short: meta.short, author: 'Unknown', chapters };
              } else {
                const maybeBook = Array.isArray(json?.books) ? json.books[0] : json;
                if (!maybeBook) return null;
                book = { ...maybeBook };
                if (!Array.isArray(book.chapters) && Array.isArray(book.verses)) {
                  // Convert flat book.verses to chapters by verse.chapter
                  const map = new Map();
                  for (const v of book.verses) {
                    const chNum = Number(v.chapter || 0) || 0;
                    if (!map.has(chNum)) map.set(chNum, { number: chNum, title: `Chapter ${chNum || 1}`, verses: [] });
                    map.get(chNum).verses.push(v);
                  }
                  book.chapters = Array.from(map.values()).sort((a,b)=>a.number-b.number);
                }
              }
              // Force id/title
              book.id = book.id || meta.id;
              book.title = meta.title;
              book.short = meta.short;
              if (!book.author) book.author = 'Unknown';
              if (!Array.isArray(book.chapters)) book.chapters = [];
              return book;
            } catch (e) {
              return null;
            }
          })
        );
        const books = loaded.filter(Boolean);
        if (books.length) {
          this.cache = { books };
          console.info('Loaded books from /books:', books.map(b => ({id:b.id,title:b.title,chapters:b.chapters?.length||0})));
          return this.cache;
        }
        // Fallback to legacy single JSON if present
        const v2 = Date.now();
        const res = await fetch(`data/books.json?v=${v2}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const json = await res.json();
        this.cache = json;
        console.info('Loaded legacy data/books.json');
        return json;
      } catch (err) {
        const json = this.fallbackData();
        json._fallback = true;
        this.cache = json;
        console.warn('Using fallback sample data. Start a local server or deploy to GitHub Pages.', err);
        return json;
      }
    },
    // Metadata-only library list from data/library.json
    async loadLibrary() {
      if (this._libraryCache) return this._libraryCache;
      try {
        const res = await fetch(`data/library.json?v=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const list = await res.json();
        this._libraryCache = list;
        console.info('[Library] Loaded library.json:', list);
        return list;
      } catch (e) {
        // Fallback to two known books if missing
        const list = [
          { id: 'vp', file: 'vishnu_puran.json', title: 'Vishnu Puran', author: 'Unknown', image: '' },
          { id: 'sp', file: 'shiva_puran.json',  title: 'Shiva Puran',  author: 'Unknown', image: '' }
        ];
        this._libraryCache = list;
        console.warn('[Library] Using fallback inline library list', e);
        return list;
      }
    },
    // Load one book JSON and normalize, preferring files in data/ then books/
    async loadBook(id) {
      if (this._booksCache.has(id)) return this._booksCache.get(id);
      const lib = await this.loadLibrary();
      const meta = lib.find(b => b.id === id) || { id, file: `${id}.json`, title: id, author: 'Unknown' };
      if (window.DATA && window.DATA.rows && Array.isArray(window.DATA.rows[id])) {
        const bookFromRows = this._normalizeBook(window.DATA.rows[id], meta);
        this._booksCache.set(id, bookFromRows);
        return bookFromRows;
      }
      try {
        const res = await this._fetchFirst(this._candidatePaths(meta));
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const raw = await res.json();
        const book = this._normalizeBook(raw, meta);
        this._booksCache.set(id, book);
        return book;
      } catch (e) {
        // As a last resort return empty book, but avoid dummy content
        const book = { id: meta.id, title: meta.title, short: this._short(meta.title), author: meta.author || 'Unknown', chapters: [] };
        this._booksCache.set(id, book);
        return book;
      }
    },
    // Load raw rows for a book (as stored in JSON), prefer data/ then books/
    async loadBookRows(id) {
      const lib = await this.loadLibrary();
      const meta = lib.find(b => b.id === id);
      if (!meta) throw new Error(`Book ${id} not in library.json`);
      if (window.DATA && window.DATA.rows && Array.isArray(window.DATA.rows[id])) {
        return window.DATA.rows[id];
      }
      let raw;
      {
        const res = await this._fetchFirst(this._candidatePaths(meta));
        if (!res.ok) throw new Error('HTTP ' + res.status);
        raw = await res.json();
      }
      if (Array.isArray(raw)) return raw; // already rows
      const bookObj = Array.isArray(raw?.books) ? raw.books[0] : raw;
      const rows = [];
      (bookObj?.chapters || []).forEach(ch => {
        (ch.verses || []).forEach(v => {
          rows.push({
            chapter: ch.number,
            verse: v.number,
            original_sanskrit: v.devanagari,
            iast_transliteration: v.iast,
            word_by_word: Array.isArray(v.word_by_word) ? v.word_by_word.map(p => [p.sanskrit, p.english]) : v.word_by_word,
            translation_en: v.translation
          });
        });
      });
      return rows;
    },
    // New: for search — load all declared books
    async loadAllBooks() {
      const lib = await this.loadLibrary();
      const settled = await Promise.allSettled(lib.map(b => this.loadBook(b.id)));
      const books = settled.filter(x => x.status === 'fulfilled').map(x => x.value);
      return { books };
    },
    _normalizeBook(json, meta) {
      let book;
      if (Array.isArray(json)) {
        const map = new Map();
        for (const row of json) {
          const chNum = Number(row.chapter || 0) || 0;
          if (!map.has(chNum)) map.set(chNum, { number: chNum, title: `Chapter ${chNum || 1}`, verses: [] });
          const wfw = Array.isArray(row.word_by_word)
            ? row.word_by_word.map(([sk, en]) => ({ sanskrit: sk, english: en }))
            : (row.word_by_word || []);
          map.get(chNum).verses.push({
            number: Number(row.verse || 0) || 0,
            ref: `${chNum || ''}.${row.verse || ''}`.replace(/^\./,'').trim(),
            devanagari: row.original_sanskrit || row.devanagari || '',
            iast: row.iast_transliteration || row.iast || '',
            word_by_word: wfw,
            translation: row.translation_en || row.translation || ''
          });
        }
        const chapters = Array.from(map.values()).sort((a,b)=>a.number-b.number);
        chapters.forEach(ch => ch.verses.sort((a,b)=>a.number-b.number));
        book = { id: meta.id, title: meta.title, short: this._short(meta.title), author: meta.author || 'Unknown', chapters };
      } else {
        const maybe = Array.isArray(json?.books) ? json.books[0] : json;
        book = { ...maybe };
        if (!Array.isArray(book.chapters) && Array.isArray(book.verses)) {
          const map = new Map();
          for (const v of book.verses) {
            const chNum = Number(v.chapter || 0) || 0;
            if (!map.has(chNum)) map.set(chNum, { number: chNum, title: `Chapter ${chNum || 1}`, verses: [] });
            map.get(chNum).verses.push(v);
          }
          book.chapters = Array.from(map.values()).sort((a,b)=>a.number-b.number);
        }
        book.id = book.id || meta.id;
        book.title = meta.title || book.title;
        book.short = this._short(book.title);
        book.author = book.author || meta.author || 'Unknown';
        if (!Array.isArray(book.chapters)) book.chapters = [];
      }
      return book;
    },
    _short(title) { return (title || '').split(' ').map(s => s[0]).join('').toUpperCase().slice(0,3); },
    _candidatePaths(meta) {
      const v = Date.now();
      const file = meta.file || '';
      // If the file includes a subdirectory (e.g., "maha_puranas/vishnu_puran.json"), respect it.
      if (file.includes('/')) return [`data/${file}?v=${v}`];
      // Otherwise, try the maha_puranas folder first, then the root data folder.
      return [
        `data/maha_puranas/${file}?v=${v}`,
        `data/${file}?v=${v}`
      ];
    },
    async _fetchFirst(paths) {
      let lastErr;
      for (const p of paths) {
        try {
          const resp = await fetch(p, { cache: 'no-store' });
          if (resp.ok) return resp;
          lastErr = new Error('HTTP ' + resp.status);
        } catch (e) { lastErr = e; }
      }
      throw lastErr || new Error('All fetch attempts failed');
    },
    _loadScript(src) {
      return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => resolve();
        s.onerror = reject;
        document.head.appendChild(s);
      });
    },
    qs(name) { return new URLSearchParams(location.search).get(name); },
    ensureNotice(data) {
      if (!data || !data._fallback) return;
      if (document.querySelector('.fallback-notice')) return;
      const n = document.createElement('div');
      n.className = 'fallback-notice';
      n.textContent = 'Sample data in use. To load your full dataset, run a local server (e.g., python3 -m http.server) or deploy to GitHub Pages.';
      const container = document.querySelector('.container');
      if (container) container.prepend(n);
    },
    fallbackData() {
      // Align fallback with the new project books so local file:// opens still show expected titles
      return {
        books: [
          { id: 'vp', short: 'VP', title: 'Vishnu Puran', author: 'Unknown',
            chapters: [ { number: 1, title: 'Chapter 1', verses: [
              { number: 1, ref: '1.1', devanagari: 'ॐ नमो भगवते वासुदेवाय', iast: 'oṁ namo bhagavate vāsudevāya', word_by_word: [], translation: 'Om! I bow to the blessed Lord Vāsudeva…' },
              { number: 2, ref: '1.2', devanagari: 'viṣṇoḥ paramaṁ rūpam…', iast: 'viṣṇoḥ paramaṁ rūpaṁ…', word_by_word: [], translation: 'The supreme form of Viṣṇu is eternal…' }
            ] } ] },
          { id: 'sp', short: 'SP', title: 'Shiva Puran', author: 'Unknown',
            chapters: [ { number: 1, title: 'Chapter 1', verses: [
              { number: 1, ref: '1.1', devanagari: "namo'stu nīlakaṇṭhāya…", iast: 'namo ’stu nīlakaṇṭhāya…', word_by_word: [], translation: 'Obeisance to the blue-throated Lord Śambhu…' }
            ] } ] }
        ]
      };
    }
  };
  window.Library = Library;

  // Collapsible header controller (large title collapses to mini header)
  window.addEventListener('DOMContentLoaded', () => {
    const mh = document.querySelector('.mini-header');
    if (!mh) return;
    const revealAt = 120; // px scrolled
    const onScroll = () => {
      if (window.scrollY > revealAt) mh.classList.add('show');
      else mh.classList.remove('show');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  });

  const menuBtn   = document.getElementById('menuBtn');
  const menuPanel = document.getElementById('menuPanel');
  if (!menuBtn || !menuPanel) return;

  // ---- menu open/close
  function openMenu() {
    menuPanel.hidden = false;
    menuBtn.setAttribute('aria-expanded', 'true');
    // position is CSS; focus the first control for a11y
    const first = menuPanel.querySelector('.menu-item, a, input, button');
    if (first) first.focus({ preventScroll: true });
    document.addEventListener('mousedown', onDocClick, true);
    document.addEventListener('keydown', onKey, true);
  }
  function closeMenu() {
    menuPanel.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', onDocClick, true);
    document.removeEventListener('keydown', onKey, true);
  }
  function onDocClick(e) {
    if (!menuPanel.contains(e.target) && e.target !== menuBtn) closeMenu();
  }
  function onKey(e) {
    if (e.key === 'Escape') { closeMenu(); menuBtn.focus(); }
  }
  menuBtn.addEventListener('click', () => {
    (menuPanel.hidden ? openMenu : closeMenu)();
  });

  // After you set up open/close listeners:
  // menuPanel.addEventListener('click', (e) => {
  //   const target = e.target.closest('a,button,input,label');
  //   if (target) {
  //     // Let the action happen (link, toggle, etc.), then close
  //     setTimeout(() => {
  //       if (!menuPanel.hidden) {
  //         menuPanel.hidden = true;
  //         menuBtn.setAttribute('aria-expanded', 'false');
  //       }
  //     }, 0);
  //   }
  // });

  // ---- persisted settings
  const LS = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };

  // Dark Mode
  const darkToggle = document.getElementById('darkToggle');
  const darkInit = LS.get('tw.dark', false);
  if (darkInit) document.documentElement.classList.add('theme-dark');
  if (darkToggle) {
    darkToggle.checked = darkInit;
    darkToggle.addEventListener('change', () => {
      document.documentElement.classList.toggle('theme-dark', darkToggle.checked);
      LS.set('tw.dark', darkToggle.checked);
    });
  }

  // ----- Font size (slider + value + reset) -----
  const DEFAULT_FONT = 16;
  const root = document.documentElement;

  const rng = document.getElementById('fontSizeRange');
  const val = document.getElementById('fontSizeVal');
  const resetBtn = document.getElementById('fontSizeReset');

  if (!rng || !val || !resetBtn) return;

  function getStored() {
    const v = Number(localStorage.getItem('tw.fontSize'));
    return Number.isFinite(v) ? v : DEFAULT_FONT;
    }

  function apply(px) {
    const v = Math.max(12, Math.min(24, Math.round(px)));
    root.style.fontSize = v + 'px';
    val.textContent = String(v);      // shows like 18px (no space)
    localStorage.setItem('tw.fontSize', String(v));
  }

  // init
  const start = getStored();
  apply(start);
  rng.value = String(start);

  // live update on slide
  rng.addEventListener('input', () => {
    const v = Number(rng.value) || DEFAULT_FONT;
    apply(v);
  });

  // reset to default
  resetBtn.addEventListener('click', () => {
    apply(DEFAULT_FONT);
    rng.value = String(DEFAULT_FONT);
  });

  // Serif / Sans
  const serifToggle = document.getElementById('serifToggle');
  const serifInit = !!LS.get('tw.serif', false);
  document.documentElement.classList.toggle('font-serif', serifInit);
  if (serifToggle) {
    serifToggle.checked = serifInit;
    serifToggle.addEventListener('change', () => {
      const on = serifToggle.checked;
      document.documentElement.classList.toggle('font-serif', on);
      LS.set('tw.serif', on);
    });
  }

  // ---- Text to Speech (selection or fallback)
  const synth = window.speechSynthesis;
  let utter = null;

  function getSpeakText() {
    const s = String(window.getSelection?.().toString() || '');
    if (s.trim()) return s;
    // fallback: title + subtitle (adjust selectors if you want)
    const title = document.querySelector('.title,.book-title,h1,h2');
    const sub   = document.querySelector('.muted,.book-sub');
    return [title?.textContent || '', sub?.textContent || ''].filter(Boolean).join('. ');
  }
  function speak() {
    const txt = getSpeakText();
    if (!txt) return;
    if (utter) synth.cancel();
    utter = new SpeechSynthesisUtterance(txt);
    utter.lang = 'en'; // pick a default; change if needed
    synth.speak(utter);
  }
  function pause() { if (synth.speaking && !synth.paused) synth.pause(); }
  function resume() { if (synth.paused) synth.resume(); }
  function stop() { synth.cancel(); utter = null; }

  const ttsPlay  = document.getElementById('ttsPlay');
  const ttsPause = document.getElementById('ttsPause');
  const ttsStop  = document.getElementById('ttsStop');

  if (ttsPlay)  ttsPlay.addEventListener('click', () => { if (synth.paused) resume(); else speak(); });
  if (ttsPause) ttsPause.addEventListener('click', pause);
  if (ttsStop)  ttsStop.addEventListener('click', stop);
})();
