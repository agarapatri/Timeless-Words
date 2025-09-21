(function () {
  const Library = window.Library || (window.Library = {});

  /* ---------------------------------- */

  function wireMenu(root) {
    const scope = root || document;
    const menuBtn = scope.querySelector('#menuBtn');
    const menuPanel = scope.querySelector('#menuPanel');
    if (!menuBtn || !menuPanel) return;
    function openMenu() {
      menuPanel.hidden = false;
      menuBtn.setAttribute('aria-expanded', 'true');
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
    function onKey(e) { if (e.key === 'Escape') { closeMenu(); menuBtn.focus(); } }
    menuBtn.addEventListener('click', () => { (menuPanel.hidden ? openMenu : closeMenu)(); });
  }
  Library.wireMenu = wireMenu;
  wireMenu(document);

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
  const darkInit = LS.get('tw.dark', false);
  if (darkInit) document.documentElement.classList.add('theme-dark');
  function bindThemeControls(root){
    const darkToggle = (root||document).querySelector('#darkToggle');
    if (!darkToggle) return;
    darkToggle.checked = document.documentElement.classList.contains('theme-dark');
    darkToggle.addEventListener('change', () => {
      document.documentElement.classList.toggle('theme-dark', darkToggle.checked);
      LS.set('tw.dark', darkToggle.checked);
    });
  }

  // Serif / Sans
  const serifInit = !!LS.get('tw.serif', false);
  document.documentElement.classList.toggle('serif', serifInit);
  function bindSerifControls(root){
    const serifToggle = (root||document).querySelector('#serifToggle');
    if (!serifToggle) return;
    serifToggle.checked = document.documentElement.classList.contains('serif');
    serifToggle.addEventListener('change', () => {
      const on = serifToggle.checked;
      document.documentElement.classList.toggle('serif', on);
      LS.set('tw.serif', on);
    });
  }

  /* ---------------------------------- */

  // ----- Font size (slider + value + reset) -----
  const MIN = 14, MAX = 20, DEFAULT = 16;
  const root = document.documentElement;

  // clamp + sanitize any previously saved value (kills old 12px saves)
  const read = () => {
    const n = Number(localStorage.getItem('tw.fontSize'));
    return Number.isFinite(n) && n >= MIN && n <= MAX ? Math.round(n) : DEFAULT;
  };

  const apply = (px) => {
    const v = Math.max(MIN, Math.min(MAX, Math.round(px)));
    root.style.fontSize = v + 'px';
    const labelEl = document.getElementById('fontSizeVal');
    if (labelEl) labelEl.textContent = String(v);
    localStorage.setItem('tw.fontSize', String(v));
  };

  // init
  const start = read();
  apply(start);

  function bindFontControls(root){
    const scope = root||document;
    const rng = scope.querySelector('#fontSizeRange');
    const lbl = scope.querySelector('#fontSizeVal');
    const resetBtn = scope.querySelector('#fontSizeReset');
    if (rng) {
      rng.min = String(MIN);
      rng.max = String(MAX);
      rng.step = '1';
      rng.value = String(read());
      if (lbl) lbl.textContent = String(read());
      rng.addEventListener('input', () => apply(rng.value));
    }
    if (resetBtn && rng) {
      resetBtn.addEventListener('click', () => {
        apply(DEFAULT);
        rng.value = String(DEFAULT);
        const lbl2 = scope.querySelector('#fontSizeVal');
        if (lbl2) lbl2.textContent = String(DEFAULT);
      });
    }
  }

  /* ---------------------------------- */

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

  function bindTTSControls(root){
    const scope = root||document;
    const ttsPlay  = scope.querySelector('#ttsPlay');
    const ttsPause = scope.querySelector('#ttsPause');
    const ttsStop  = scope.querySelector('#ttsStop');
    if (ttsPlay)  ttsPlay.addEventListener('click', () => { if (synth.paused) resume(); else speak(); });
    if (ttsPause) ttsPause.addEventListener('click', pause);
    if (ttsStop)  ttsStop.addEventListener('click', stop);
  }

  /* ---------------------------------- */

  // === Google Translate toggle (checkbox) ===
  function bindTranslateControls(root){
    const toggle = (root||document).querySelector('#gtToggle');
    if (!toggle) return;

  function isTranslated() {
    const h = location.hostname;
    // Covers translate.google.com/translate and googleusercontent proxy
    return h.includes('translate.google') || h.includes('googleusercontent.com');
  }

  function originalFromTranslateUrl() {
    // Most translate URLs carry the original in ?u=
    const sp = new URLSearchParams(location.search);
    if (sp.has('u')) {
      try { return decodeURIComponent(sp.get('u')); } catch { return sp.get('u'); }
    }
    // Fallback: if not present, just stay put
    return location.href;
  }

  function makeTranslateUrl(orig, tl) {
    const lang = (tl || (navigator.language || 'en')).split('-')[0];
    return `https://translate.google.com/translate?sl=auto&tl=${encodeURIComponent(lang)}&u=${encodeURIComponent(orig)}`;
  }

  // Initialize checkbox state from current URL
  const translatedNow = isTranslated();
  toggle.checked = translatedNow;

  toggle.addEventListener('change', () => {
    const nowTranslated = isTranslated();
    if (toggle.checked) {
      const orig = nowTranslated ? originalFromTranslateUrl() : location.href;
      location.href = makeTranslateUrl(orig);
    } else {
      if (nowTranslated) { location.href = originalFromTranslateUrl(); }
    }
  });
  }

  function bindMenuControls(root){
    bindThemeControls(root);
    bindSerifControls(root);
    bindFontControls(root);
    bindTTSControls(root);
    bindTranslateControls(root);
  }
  Library.bindMenuControls = bindMenuControls;
  bindMenuControls(document);
})();

// expose minimal API for menu injection
(function(){
  const Library = window.Library || (window.Library = {});
  Library.injectMenu = async function(slotSelector){
    try {
      const slot = document.querySelector(slotSelector);
      if (!slot) return;
      const res = await fetch('assets/menu.html', { cache: 'no-store' });
      const html = await res.text();
      slot.innerHTML = html;
      // wire and bind controls within the slot
      if (Library.wireMenu) Library.wireMenu(slot);
      if (Library.bindMenuControls) Library.bindMenuControls(slot);
    } catch (e) { /* ignore to avoid breaking page */ }
  }
})();
