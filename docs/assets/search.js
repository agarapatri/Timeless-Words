/* Deep Search with substring + optional regex */
(function () {
  let STATE = { results: [], page: 1, perPage: 25 }; // default page size

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
      try { return re.test(String(hay || '')); } catch { return false; }
    }
    // substring (accent-insensitive)
    return norm(hay).includes(norm(query));
  }

  async function init() {
    const library = await window.Library.loadLibrary();
    const data = await window.Library.loadAllBooks();

    // Build book checklist
    const booksSel = document.getElementById('fBooks');
    library.forEach(b => {
      const id = `b_${b.id}`;
      const label = document.createElement('label');
      label.setAttribute('for', id);
      label.innerHTML = `<input id="${id}" type="checkbox" value="${b.id}"> <span>${b.title}</span>`;
      booksSel.appendChild(label);
    });

    // Prefill from q if navigated from home
    const q = new URLSearchParams(location.search).get('q');
    if (q) document.getElementById('q').value = q;

    const run = () => search(data);
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

  function readFilters() {
    const allowedIds = Array.from(document.querySelectorAll('#fBooks input[type="checkbox"]:checked')).map(i => i.value);
    const scopes = { deva:false, iast:false, trans:false, wfw:false };
    const actives = document.querySelectorAll('#chipbar button.active');
    if (actives.length === 0) { Object.keys(scopes).forEach(k => scopes[k] = true); }
    else { actives.forEach(b => { scopes[b.getAttribute('data-scope')] = true; }); }
    return { q: document.getElementById('q').value.trim(), allowedIds, scopes };
  }

  function matchesFilters(book, chapter, verse, f) {
    if (f.allowedIds.length && !f.allowedIds.includes(book.id)) return false;
    if (!f.q) return false;
    const haystacks = [];
    if (f.scopes.deva)  haystacks.push(verse.devanagari);
    if (f.scopes.iast)  haystacks.push(verse.iast);
    if (f.scopes.trans) haystacks.push(verse.translation);
    if (f.scopes.wfw && Array.isArray(verse.word_by_word)) {
      verse.word_by_word.forEach(p => haystacks.push(`${p.sanskrit||p[0]} ${p.english||p[1]}`));
    }
    return haystacks.some(h => matchText(h || '', f.q));
  }

  function search(data) {
    const f = readFilters();

    if (!f.q) {
      document.getElementById('results').innerHTML = '';
      document.getElementById('resultsInfo').textContent = '';
      STATE.results = [];
      STATE.page = 1;
      const pager = document.getElementById('pager');
      if (pager) pager.remove();
      return;
    }

    const results = [];
    data.books.forEach(book => {
      book.chapters.forEach(ch => {
        ch.verses.forEach(v => {
          if (matchesFilters(book, ch, v, f)) results.push({ book, ch, v });
        });
      });
    });

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
      const { book, ch, v } = STATE.results[i];
      const li = document.createElement('li');
      const href = `verse.html?book=${encodeURIComponent(book.id)}&c=${encodeURIComponent(ch.number)}&v=${encodeURIComponent(v.number)}`;
      li.dataset.href = href;

      const a = document.createElement('a');
      a.href = href;

      const snippets = pickSnippets(book, v, f, qVal);
      const lines = snippets.slice(0, 3).map(snp => `
        <div class="line">
          ${snp.label ? `<span class="ref">${snp.label}</span> · ` : ''}
          ${highlight(snp.text, qVal)}
        </div>
      `).join('');

      a.innerHTML = `
        <div class="line">
          <span class="ref notranslate" translate="no">${book.short || book.title} ${ch.number}.${v.number}</span>
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

  // boot
  window.addEventListener('DOMContentLoaded', init);
})();
