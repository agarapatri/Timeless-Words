/* Search implementation with 6 filters */
(function () {
  let STATE = { results: [], page: 1, perPage: 25 }; // <-- set default page size here

  function ensurePager() {
    let pager = document.getElementById('pager');
    const list = document.getElementById('results');   // <- use the list, not the info line
    if (!pager && list) {
      pager = document.createElement('div');
      pager.id = 'pager';
      pager.className = 'pager';
      list.after(pager);                                // <- move it below the results
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


  function norm(s) {
    const x = (s || '').toLowerCase().normalize('NFKD');
    // Strip diacritics and common punctuation for accent-insensitive search
    return x.replace(/[\u0300-\u036f]/g, '').replace(/[\u2013\u2014]/g, '-');
  }
  function includes(hay, needle) {
    const H = norm(hay);
    const N = norm(needle);
    return N ? H.includes(N) : false;
  }

  async function init() {
    const library = await window.Library.loadLibrary();
    const data = await window.Library.loadAllBooks();
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

    // Make results reliably clickable even when clicking outside the link text
    const resEl = document.getElementById('results');
    resEl.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (link && resEl.contains(link)) return;
      const li = e.target.closest('li');
      if (li && li.dataset.href) location.href = li.dataset.href;
    });

    if (q && q.trim()) {
      run();
    } else {
      document.getElementById('results').innerHTML = '';
      document.getElementById('resultsInfo').textContent = '';
    }
  }

  function matchesFilters(book, chapter, verse, f) {
    if (f.allowedIds.length && !f.allowedIds.includes(book.id)) return false;
    if (!f.q) return false;
    const haystacks = [];
    if (f.scopes.deva)  haystacks.push(verse.devanagari);
    if (f.scopes.iast)  haystacks.push(verse.iast);
    if (f.scopes.trans) haystacks.push(verse.translation);
    if (f.scopes.wfw) {
      if (Array.isArray(verse.word_by_word)) {
        verse.word_by_word.forEach(p => haystacks.push(`${p.sanskrit||p[0]} ${p.english||p[1]}`));
      }
    }
    return haystacks.some(h => includes(h || '', f.q));
  }

  function readFilters() {
    const allowedIds = Array.from(document.querySelectorAll('#fBooks input[type="checkbox"]:checked')).map(i => i.value);
    // Read chip scopes; default to all if none active
    const scopes = { deva:false, iast:false, trans:false, wfw:false };
    const actives = document.querySelectorAll('#chipbar button.active');
    if (actives.length === 0) {
      Object.keys(scopes).forEach(k => scopes[k] = true);
    } else {
      actives.forEach(b => { scopes[b.getAttribute('data-scope')] = true; });
    }
    return {
      q: document.getElementById('q').value.trim(),
      allowedIds,
      scopes
    };
  }

  function search(data) {
    const f = readFilters();

    // No query: clear UI and remove pager
    if (!f.q) {
      document.getElementById('results').innerHTML = '';
      document.getElementById('resultsInfo').textContent = '';
      STATE.results = [];
      STATE.page = 1;
      const pager = document.getElementById('pager');
      if (pager) pager.remove();
      return;
    }

    // Build results
    const results = [];
    data.books.forEach(book => {
      book.chapters.forEach(ch => {
        ch.verses.forEach(v => {
          if (matchesFilters(book, ch, v, f)) {
            results.push({ book, ch, v });
          }
        });
      });
    });

    // Store & render page 1
    STATE.results = results;
    STATE.page = 1;
    ensurePager();
    renderPage();
  }

  function renderPage(scrollToTop = false) {
    const resEl = document.getElementById('results');
    const info  = document.getElementById('resultsInfo');
    const qVal  = document.getElementById('q').value || '';
    const f     = readFilters(); // respect currently selected scopes

    resEl.innerHTML = '';
    const total = STATE.results.length;
    const totalPages = Math.max(1, Math.ceil(total / STATE.perPage));
    const page = Math.min(STATE.page, totalPages);
    const start = (page - 1) * STATE.perPage;
    const end = Math.min(start + STATE.perPage, total);

    // Build only the current page
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
          <span class="ref">${book.short || book.title} ${ch.number}.${v.number}</span>
        </div>
        ${lines}
      `;
      li.appendChild(a);
      resEl.appendChild(li);
    }

    // Info + pager UI
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

  function pickSnippets(book, verse, f, q) {
    const scopesOrder = ['deva','iast','trans','wfw'];              // title/author removed
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

    // 1) Prefer scopes that actually matched the query
    const matches = [];
    for (const k of active) {
      const o = fields[k]();
      if (includes(o.text, q)) matches.push(o);
    }
    if (matches.length) return matches;

    // 2) Otherwise show the selected scopes that have text (prevents blank cards)
    const fallbacks = active.map(k => fields[k]()).filter(o => o.text);
    if (fallbacks.length) return fallbacks;

    // 3) Last resort: sensible single fallback
    for (const k of ['trans','iast','deva','wfw']) {
      if (f.scopes[k]) {
        const o = fields[k]();
        if (o.text) return [o];
      }
    }
    return [{ label:'', text:'' }];
  }

  function highlight(text, needle) {
    if (!needle) return escapeHtml(text || '');
    const n = needle.trim();
    if (!n) return escapeHtml(text || '');
    const re = new RegExp(`(${escapeRegExp(n)})`, 'ig');
    return escapeHtml(text || '').replace(re, '<span class="hit">$1</span>');
  }

  function escapeHtml(s) { return (s||'').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
  function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  window.addEventListener('DOMContentLoaded', init);
})();
