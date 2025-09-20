(function () {

  /* ---------------------------------- */

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

  // Serif / Sans
  const serifToggle = document.getElementById('serifToggle');
  const serifInit = !!LS.get('tw.serif', false);
  document.documentElement.classList.toggle('serif', serifInit);
  if (serifToggle) {
    serifToggle.checked = serifInit;
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

  const rng = document.getElementById('fontSizeRange');
  const lbl = document.getElementById('fontSizeVal');
  const resetBtn = document.getElementById('fontSizeReset');
  if (!rng || !lbl) return;

  // clamp + sanitize any previously saved value (kills old 12px saves)
  const read = () => {
    const n = Number(localStorage.getItem('tw.fontSize'));
    return Number.isFinite(n) && n >= MIN && n <= MAX ? Math.round(n) : DEFAULT;
  };

  const apply = (px) => {
    const v = Math.max(MIN, Math.min(MAX, Math.round(px)));
    root.style.fontSize = v + 'px';
    lbl.textContent = String(v);
    localStorage.setItem('tw.fontSize', String(v));
  };

  // init
  const start = read();
  rng.min = String(MIN);
  rng.max = String(MAX);
  rng.step = '1';
  rng.value = String(start);
  apply(start);

  // live update
  rng.addEventListener('input', () => apply(rng.value));

  // reset to default
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      apply(DEFAULT);
      rng.value = String(DEFAULT);
    });
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

  const ttsPlay  = document.getElementById('ttsPlay');
  const ttsPause = document.getElementById('ttsPause');
  const ttsStop  = document.getElementById('ttsStop');

  if (ttsPlay)  ttsPlay.addEventListener('click', () => { if (synth.paused) resume(); else speak(); });
  if (ttsPause) ttsPause.addEventListener('click', pause);
  if (ttsStop)  ttsStop.addEventListener('click', stop);

  /* ---------------------------------- */

  // === Google Translate toggle (checkbox) ===
  const toggle = document.getElementById('gtToggle');
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
      // Turn ON translate
      const orig = nowTranslated ? originalFromTranslateUrl() : location.href;
      location.href = makeTranslateUrl(orig);
    } else {
      // Turn OFF translate -> go back to original URL
      if (nowTranslated) {
        location.href = originalFromTranslateUrl();
      } // else already original; nothing to do
    }
  });
})();
