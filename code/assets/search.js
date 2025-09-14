/* Search implementation with 6 filters */
(function () {
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
    // Single query across book + verse fields and multi-select books filter
    if (f.allowedIds.length && !f.allowedIds.includes(book.id)) return false;
    if (!f.q) return false; // require query
    // Build haystacks from selected scopes
    const haystacks = [];
    if (f.scopes.title) haystacks.push(book.title);
    if (f.scopes.author) haystacks.push(book.author);
    if (f.scopes.deva) haystacks.push(verse.devanagari);
    if (f.scopes.iast) haystacks.push(verse.iast);
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
    const scopes = { title:false, author:false, deva:false, iast:false, trans:false, wfw:false };
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
    if (!f.q) {
      document.getElementById('results').innerHTML = '';
      document.getElementById('resultsInfo').textContent = '';
      return;
    }
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

    const resEl = document.getElementById('results');
    resEl.innerHTML = '';
    const info = document.getElementById('resultsInfo');
    info.textContent = `${results.length} result${results.length===1?'':'s'}`;

    const qVal = document.getElementById('q').value || '';
    results.slice(0, 500).forEach(({ book, ch, v }) => {
      const li = document.createElement('li');
      const href = `verse.html?book=${encodeURIComponent(book.id)}&c=${encodeURIComponent(ch.number)}&v=${encodeURIComponent(v.number)}`;
      li.dataset.href = href;
      const a = document.createElement('a');
      a.href = href;
      const s = pickSnippet(book, v, f, qVal);
      a.innerHTML = `
        <div class="line"><span class="ref">${book.short || book.title} ${ch.number}.${v.number}</span> ${s.label ? `<span class="ref">· ${s.label}</span>` : ''}</div>
        <div class="line">${highlight(s.text, qVal)}</div>
      `;
      li.appendChild(a);
      resEl.appendChild(li);
    });
  }

  function pickSnippet(book, verse, f, q) {
    const scopesOrder = [ 'title','author','deva','iast','trans','wfw' ];
    // Build ordered list using active scopes or all if none (shouldn't happen)
    const active = scopesOrder.filter(k => f.scopes[k]);
    const tryField = {
      title: () => ({ label:'Title', text: book.title || '' }),
      author: () => ({ label:'Author', text: book.author || '' }),
      deva: () => ({ label:'Devanāgarī', text: verse.devanagari || verse.original_sanskrit || '' }),
      iast: () => ({ label:'IAST', text: verse.iast || verse.iast_transliteration || '' }),
      trans: () => ({ label:'Translation', text: verse.translation || verse.translation_en || '' }),
      wfw: () => {
        const arr = Array.isArray(verse.word_by_word) ? verse.word_by_word : [];
        const line = arr.map(p => Array.isArray(p)? `${p[0]} — ${p[1]}` : `${p.sanskrit} — ${p.english}`).join('; ');
        return { label:'Word‑for‑word', text: line };
      }
    };
    for (const k of active) {
      const { label, text } = tryField[k]();
      if (includes(text, q)) return { label, text };
    }
    // Fallback preferences if none matched in selected scopes
    const fallback = tryField.trans().text || tryField.iast().text || tryField.deva().text || tryField.title().text;
    return { label:'', text: fallback };
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
