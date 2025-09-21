/* Deep Search with substring + optional regex */
(function () {
  let STATE = { results: [], page: 1, perPage: 25 }; // default page size
  let DB = null;
  let ALL = { types: [], books: [], verses: [], wfwByVerse: new Map() };

  function ensurePager() {
    let pager = document.getElementById('pager');
    const list = document.getElementById('results');
    if (!pager && list) {
      pager = document.createElement('div');
      pager.id = 'pager';
      pager.className = 'pager';
      list.after(pager);
      pager.innerHTML = `
        <button id="prevPage" type="button" class="btn ghost" aria-label="Previous page">‹ Prev</button>
        <span id="pageInfo" class="muted"></span>
        <button id="nextPage" type="button" class="btn ghost" aria-label="Next page">Next ›</button>
        <select id="pageSize" aria-label="Results per page">
          <option value="25" selected>25</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
      `;
      pager.querySelector('#prevPage').addEventListener('click', () => changePage(-1));
      pager.querySelector('#nextPage').addEventListener('click', () => changePage(+1));
      pager.querySelector('#pageSize').addEventListener('change', (e) => {
        STATE.perPage = parseInt(e.target.value, 10) || 25;
        STATE.page = 1;
        renderPage();
      });
    }
  }

  function changePage(delta) {
    const totalPages = Math.max(1, Math.ceil(STATE.results.length / STATE.perPage));
    STATE.page = Math.min(totalPages, Math.max(1, STATE.page + delta));
    renderPage(true);
  }

  // --- query parsing ---
  function parseRegexQuery(q) {
    // Accept /pattern/flags (flags optional). If not in this form, return null.
    const m = String(q || '').match(/^\/(.+)\/([a-z]*)$/i);
    if (!m) return null;
    try {
      return new RegExp(m[1], m[2]);
    } catch {
      return null; // invalid regex -> treat as normal text later
    }
  }

  // accent-insensitive normalization for substring search
  function norm(s) {
    const x = (s || '').toLowerCase().normalize('NFKD');
    return x.replace(/[\u0300-\u036f]/g, '').replace(/[\u2013\u2014]/g, '-');
  }

  // match helpers
  function matchText(hay, query) {
    if (!query) return false;
    const re = parseRegexQuery(query);
    if (re) {
      try {
        const s = String(hay || '');
        if (re.test(s)) return true; // exact regex match
        // Diacritic-insensitive fallback: normalize both pattern and haystack
        const normSrc = norm(re.source);
        const re2 = new RegExp(normSrc, re.flags);
        return re2.test(norm(s));
      } catch {
        return false;
      }
    }
    // simple wildcards (* and ?) on normalized text
    const qn = norm(query);
    if (/[\*\?]/.test(qn)) {
      // escape all regex specials except * and ?
      const esc = qn.replace(/[\-\/\\\^\$\+\.\(\)\|\[\]\{\}]/g, '\\$&');
      const patt = esc.replace(/\*/g, '.*').replace(/\?/g, '.');
      try {
        const wre = new RegExp(patt, 'i');
        return wre.test(norm(hay));
      } catch { /* fall through */ }
    }
    // substring (accent-insensitive)
    return norm(hay).includes(qn);
  }

  async function init() {
    await loadDb();
    await loadCatalog();
    await loadVerses();

    // Prefill from q if navigated from home
    const q = new URLSearchParams(location.search).get('q');
    if (q) document.getElementById('q').value = q;

    const run = () => search();
    document.getElementById('filters').addEventListener('submit', (e) => { e.preventDefault(); });
    document.getElementById('q').addEventListener('input', run);
    document.getElementById('fBooks').addEventListener('change', run);

    const bar = document.getElementById('chipbar');
    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-scope]');
      if (!btn) return;
      const active = btn.classList.toggle('active');
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      run();
    });

    // Click anywhere on result row
    const resEl = document.getElementById('results');
    resEl.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (link && resEl.contains(link)) return;
      const li = e.target.closest('li');
      if (li && li.dataset.href) location.href = li.dataset.href;
    });

    if (q && q.trim()) run();
    else {
      document.getElementById('results').innerHTML = '';
      document.getElementById('resultsInfo').textContent = '';
    }
  }

  async function loadDb() {
    if (DB) return DB;
    const SQL = await initSqlJs({ locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${f}` });
    const res = await fetch(`data/library.sqlite?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch SQLite');
    const buf = new Uint8Array(await res.arrayBuffer());
    DB = new SQL.Database(buf);
    return DB;
  }

  async function loadCatalog() {
    const typesOut = DB.exec(`SELECT code, label FROM work_types ORDER BY label`);
    ALL.types = (typesOut[0]?.values || []).map(r => ({ code: r[0], label: r[1] }));
    const booksOut = DB.exec(`SELECT work_id, title_en, work_type_code FROM works ORDER BY title_en`);
    ALL.books = (booksOut[0]?.values || []).map(r => ({ id: String(r[0]), work_id: r[0], title: r[1] || '', type: r[2] || '' }));

    // Checklists are built by initTypeFilter and initBookFilter on DOMContentLoaded
  }

  async function loadVerses() {
    // Load verses with texts and refs
    const out = DB.exec(`
      SELECT vs.verse_id, vs.work_id, vs.division_id, vs.ordinal as vord,
             d.ordinal as cord, vs.ref_citation,
             COALESCE(vw.sa_deva,''), COALESCE(vw.sa_iast,''), COALESCE(vw.en_translation,''),
             w.title_en, w.work_type_code
      FROM verses vs
      JOIN verse_texts_wide vw ON vw.verse_id = vs.verse_id
      JOIN divisions d ON d.division_id = vs.division_id
      JOIN works w ON w.work_id = vs.work_id
      ORDER BY vs.work_id, d.ordinal, vs.ordinal
    `);
    ALL.verses = (out[0]?.values || []).map(r => ({
      verse_id: r[0], work_id: String(r[1]), division_id: r[2], vord: r[3], cord: r[4], ref: r[5] || `${r[4]}.${r[3]}`,
      deva: r[6], iast: r[7], trans: r[8], title: r[9] || '', type: r[10] || ''
    }));

    // Word-for-word map
    const wfw = DB.exec(`
      SELECT t.verse_id, GROUP_CONCAT(COALESCE(t.surface,'') || ' — ' || COALESCE((SELECT gloss FROM verse_glosses g WHERE g.verse_id=t.verse_id AND g.surface=t.surface LIMIT 1),'') , '; ') AS wfw
      FROM tokens t GROUP BY t.verse_id
    `);
    ALL.wfwByVerse = new Map();
    if (wfw[0]) for (const row of wfw[0].values) ALL.wfwByVerse.set(row[0], row[1] || '');
  }

  function readFilters() {
    const allowedIds = Array.from(document.querySelectorAll('#fBooks input[type="checkbox"]:checked')).map(i => i.value);
    const scopes = { deva:false, iast:false, trans:false, wfw:false };
    const actives = document.querySelectorAll('#chipbar button.active');
    if (actives.length > 0) { actives.forEach(b => { scopes[b.getAttribute('data-scope')] = true; }); }
    // if none active => all scopes false (show none)
    const anyScope = scopes.deva || scopes.iast || scopes.trans || scopes.wfw;
    return { q: document.getElementById('q').value.trim(), allowedIds, scopes, anyScope };
  }

  function matchesFilters(row, f) {
    if (f.allowedIds.length && !f.allowedIds.includes(row.work_id)) return false;
    if (!f.q) return false;
    const haystacks = [];
    if (f.scopes.deva)  haystacks.push(row.deva);
    if (f.scopes.iast)  haystacks.push(row.iast);
    if (f.scopes.trans) haystacks.push(row.trans);
    if (f.scopes.wfw)  haystacks.push(ALL.wfwByVerse.get(row.verse_id) || '');
    return haystacks.some(h => matchText(h || '', f.q));
  }

  function search() {
    const f = readFilters();

    if (!f.q || !f.anyScope || f.allowedIds.length === 0) {
      document.getElementById('results').innerHTML = '';
      document.getElementById('resultsInfo').textContent = '';
      STATE.results = [];
      STATE.page = 1;
      const pager = document.getElementById('pager');
      if (pager) pager.remove();
      return;
    }

    const results = ALL.verses.filter(r => matchesFilters(r, f));

    STATE.results = results;
    STATE.page = 1;
    ensurePager();
    renderPage();
  }

  function pickSnippets(book, verse, f, q) {
    const scopesOrder = ['deva','iast','trans','wfw'];
    const active = scopesOrder.filter(k => f.scopes[k]);

    const fields = {
      deva: () => ({ key:'deva',  label:'Devanāgarī', text: verse.devanagari || verse.original_sanskrit || '' }),
      iast: () => ({ key:'iast',  label:'IAST',       text: verse.iast || verse.iast_transliteration || '' }),
      trans: () => ({ key:'trans',label:'Translation',text: verse.translation || verse.translation_en || '' }),
      wfw:  () => {
        const arr = Array.isArray(verse.word_by_word) ? verse.word_by_word : [];
        const line = arr.map(p => Array.isArray(p) ? `${p[0]} — ${p[1]}` : `${p.sanskrit} — ${p.english}`).join('; ');
        return { key:'wfw', label:'Word-for-word', text: line };
      }
    };

    const out = [];
    active.forEach(k => out.push(fields[k]()));
    return out.filter(x => (x.text || '').trim());
  }

  function highlight(text, query) {
    // fall back to simple (non-regex) highlight; your page render also shows the ref header prominently.
    if (!query) return (text || '');
    const re = parseRegexQuery(query);
    if (re) {
      try {
        return String(text || '').replace(re, m => `<span class="hit">${m}</span>`);
      } catch {
        // invalid regex -> no highlight
      }
    }
    const qn = norm(query);
    if (!qn) return (text || '');
    const hay = String(text || '');
    // naive non-overlapping highlight by case-insensitive substring on normalized forms
    const H = norm(hay);
    const parts = [];
    let i = 0, j;
    while ((j = H.indexOf(qn, i)) !== -1) {
      parts.push(hay.slice(i, j));
      parts.push(`<span class="hit">${hay.slice(j, j + qn.length)}</span>`);
      i = j + qn.length;
    }
    parts.push(hay.slice(i));
    return parts.join('');
  }

  function renderPage(scrollToTop = false) {
    const resEl = document.getElementById('results');
    const info  = document.getElementById('resultsInfo');
    const qVal  = document.getElementById('q').value || '';
    const f     = readFilters();

    resEl.innerHTML = '';
    const total = STATE.results.length;
    const totalPages = Math.max(1, Math.ceil(total / STATE.perPage));
    const page = Math.min(STATE.page, totalPages);
    const start = (page - 1) * STATE.perPage;
    const end = Math.min(start + STATE.perPage, total);

    for (let i = start; i < end; i++) {
      const row = STATE.results[i];
      const li = document.createElement('li');
      const href = `verse.html?book=${encodeURIComponent(row.work_id)}&d=${encodeURIComponent(row.division_id)}&v=${encodeURIComponent(row.vord)}`;
      li.dataset.href = href;

      const a = document.createElement('a');
      a.href = href;

      const snippets = pickSnippetsRow(row, f, qVal);
      const lines = snippets.slice(0, 3).map(snp => `
        <div class="line">
          ${snp.label ? `<span class="ref">${snp.label}</span> · ` : ''}
          ${highlight(snp.text, qVal)}
        </div>
      `).join('');

      a.innerHTML = `
        <div class="line">
          <span class="ref notranslate" translate="no">${initials(row.title)} ${row.cord}.${row.vord}</span>
        </div>
        ${lines}
      `;
      li.appendChild(a);
      resEl.appendChild(li);
    }

    info.textContent = `${total} result${total===1?'':'s'} · Page ${page} of ${totalPages}`;

    const prev = document.getElementById('prevPage');
    const next = document.getElementById('nextPage');
    const pi   = document.getElementById('pageInfo');
    if (prev && next && pi) {
      prev.disabled = page <= 1 || total === 0;
      next.disabled = page >= totalPages || total === 0;
      pi.textContent = `Page ${page} / ${totalPages}`;
      const sel = document.getElementById('pageSize');
      if (sel) sel.value = String(STATE.perPage);
    }

    if (scrollToTop) {
      const top = Math.max(0, (document.getElementById('results').offsetTop || 0) - 80);
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  function initials(title) {
    return String(title||'').trim().split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase();
  }

  function pickSnippetsRow(row, f, q) {
    const scopesOrder = ['deva','iast','trans','wfw'];
    const active = scopesOrder.filter(k => f.scopes[k]);
    const out = [];
    if (active.includes('deva') && (row.deva||'').trim()) out.push({ key:'deva', label:'Devanāgarī', text: row.deva });
    if (active.includes('iast') && (row.iast||'').trim()) out.push({ key:'iast', label:'IAST', text: row.iast });
    if (active.includes('trans') && (row.trans||'').trim()) out.push({ key:'trans', label:'Translation', text: row.trans });
    if (active.includes('wfw')) {
      const line = ALL.wfwByVerse.get(row.verse_id) || '';
      if (line.trim()) out.push({ key:'wfw', label:'Word-for-word', text: line });
    }
    return out;
  }

  // boot
  window.addEventListener('DOMContentLoaded', init);

  /* --------------------------------------- */
  
function byId(id){ return document.getElementById(id); }

function initBookFilter(){
  const searchEl = byId('bookSearch');
  const listEl   = byId('bookChecklist');
  if (!searchEl || !listEl) return; // not on this page

  const state = { all: [], filtered: [], selected: new Set(), byType: new Map() };

  // load books
  (async () => {
    try {
      await loadDb();
      const booksOut = DB.exec(`SELECT work_id, title_en, work_type_code FROM works ORDER BY title_en`);
      const rows = (booksOut[0]?.values || []).map(r => ({ id:String(r[0]), title: r[1] || '', type: r[2] || '' }));
      state.all = rows;
      state.filtered = rows.slice();
      state.selected = new Set(rows.map(b => b.id));
      // Build type -> books map
      state.byType = new Map();
      rows.forEach(b => { if(!state.byType.has(b.type)) state.byType.set(b.type, []); state.byType.get(b.type).push(b.id); });
      render();
      document.dispatchEvent(new CustomEvent('books:changed', { detail: { selected: Array.from(state.selected) } }));
      listEl.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {
      listEl.innerHTML = '<div class="muted">Could not load books.</div>';
    }
  })();

  // mini search (title) with diacritic-insensitive normalization
  searchEl.addEventListener('input', () => {
    const q = norm(searchEl.value.trim());
    state.filtered = q
      ? state.all.filter(b => norm(b.title||'').includes(q))
      : state.all.slice();
    render();
  });

  function render(){
    if (!state.filtered.length){
      listEl.innerHTML = '<div class="muted" aria-live="polite">No books</div>';
      return;
    }
    const frag = document.createDocumentFragment();

    state.filtered.forEach(b => {
      const idAttr = `book_${String(b.id).replace(/\W+/g,'_')}`;

      const label = document.createElement('label');
      label.setAttribute('role','option');
      label.htmlFor = idAttr;

      const box = document.createElement('input');
      box.type = 'checkbox';
      box.id = idAttr;
      box.value = b.id;
      box.checked = state.selected.has(b.id);   // ✅ now true on first render
      function updateParentFor(typeCode){
        const typeBox = document.querySelector(`#typeChecklist input[data-type='${CSS.escape(typeCode)}']`);
        if (!typeBox) return;
        const typeList = state.byType.get(typeCode) || [];
        const selectedCount = typeList.filter(id => state.selected.has(id)).length;
        if (selectedCount === 0) { typeBox.checked = false; typeBox.indeterminate = false; }
        else if (selectedCount === typeList.length) { typeBox.checked = true; typeBox.indeterminate = false; }
        else { typeBox.checked = true; typeBox.indeterminate = true; }
      }

      box.addEventListener('change', () => {
        if (box.checked) state.selected.add(b.id);
        else state.selected.delete(b.id);

        // Update parent checkbox to reflect tri-state (all/some/none)
        updateParentFor(b.type);

        document.dispatchEvent(new CustomEvent('books:changed', { detail: { selected: Array.from(state.selected) } }));
        listEl.dispatchEvent(new Event('change', { bubbles: true }));
      });

      const span = document.createElement('span');
      span.textContent = b.title;

      label.appendChild(box);
      label.appendChild(span);
      frag.appendChild(label);
    });

    listEl.innerHTML = '';
    listEl.appendChild(frag);
  }
  // Clear button in Book panel
  const bookPanel = document.getElementById('fBooks');
  const bookClear = bookPanel?.querySelector('.panel-header2 .btn');
  if (bookClear) bookClear.addEventListener('click', () => {
    state.selected.clear();
    // Uncheck all book checkboxes
    listEl.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    // Also uncheck all Book Type checkboxes to keep filters in sync
    const typeList = document.getElementById('typeChecklist');
    if (typeList) {
      typeList.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; cb.indeterminate = false; });
      // notify any listeners that types changed
      document.dispatchEvent(new CustomEvent('types:changed', { detail: { selected: [] } }));
    }
    render();
    document.dispatchEvent(new CustomEvent('books:changed', { detail: { selected: [] } }));
    listEl.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

window.addEventListener('DOMContentLoaded', initBookFilter, { once:true });


  /* ----------------------------------------------------- */

  function initTypeFilter(){
    const listEl = document.getElementById('typeChecklist');
    if (!listEl) return;

    (async () => {
      await loadDb();
      const out = DB.exec(`SELECT code, label FROM work_types ORDER BY label`);
      const types = (out[0]?.values || []).map(r => ({ code: r[0], label: r[1] }));
      const frag = document.createDocumentFragment();
      types.forEach((t, idx) => {
        const idAttr = `type_${idx}`;
        const label  = document.createElement('label');
        label.setAttribute('role','option');
        label.htmlFor = idAttr;

        const box = document.createElement('input');
        box.type = 'checkbox';
        box.id = idAttr;
        box.value = t.code;
        box.dataset.type = t.code;
        box.checked = true;

        box.addEventListener('change', () => {
          // Parent semantics:
          // - If checked: select all books of this type
          // - If unchecked: deselect all books of this type
          const bookBoxes = document.querySelectorAll(`#fBooks input[type='checkbox']`);
          bookBoxes.forEach(bx => {
            const row = ALL.books.find(x => x.id === bx.value);
            if (row && row.type === t.code) {
              if (bx.checked !== box.checked) { bx.checked = box.checked; bx.dispatchEvent(new Event('change', { bubbles: true })); }
            }
          });

          document.dispatchEvent(new CustomEvent('types:changed', { detail: { selected: getSelectedTypes() } }));
          rebuildBookListForTypes();
        });

        const span = document.createElement('span');
        span.textContent = t.label;
        label.appendChild(box);
        label.appendChild(span);
        frag.appendChild(label);
      });
      listEl.innerHTML = '';
      listEl.appendChild(frag);

      // Clear button for types panel
      const typePanel = document.getElementById('fTypes');
      const typeClear = typePanel?.querySelector('.panel-header2 .btn');
      if (typeClear) typeClear.addEventListener('click', () => {
        // Uncheck all types
        listEl.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; cb.indeterminate = false; });
        // Uncheck all books as parent cascade
        const bookList = document.getElementById('bookChecklist');
        if (bookList) {
          bookList.querySelectorAll('input[type="checkbox"]').forEach(cb => { if (cb.checked) { cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true })); } });
        }
        document.dispatchEvent(new CustomEvent('types:changed', { detail: { selected: [] } }));
        rebuildBookListForTypes();
      });
    })();

    function getSelectedTypes(){
      return Array.from(listEl.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.value);
    }
  }

  window.addEventListener('DOMContentLoaded', initTypeFilter, { once:true });

  function getSelectedTypes(){
    const el = document.getElementById('typeChecklist');
    if (!el) return [];
    return Array.from(el.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.value);
  }

  function rebuildBookListForTypes(){
    const active = new Set(getSelectedTypes());
    const listEl = byId('bookChecklist');
    if (!listEl) return;
    // Hide books whose types are not active; if no type selected, show none
    listEl.querySelectorAll('label').forEach(lbl => {
      const cb = lbl.querySelector('input[type="checkbox"]');
      const row = ALL.books.find(x => x.id === cb.value);
      const visible = row ? (active.size === 0 ? false : active.has(row.type)) : true;
      lbl.style.display = visible ? '' : 'none';
      if (row && !visible) {
        cb.checked = false;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
      }
      // When re-enabling a type, do not auto-check here; the type checkbox change handler already checked relevant books
    });
  }

  document.addEventListener('types:changed', rebuildBookListForTypes);

})();
