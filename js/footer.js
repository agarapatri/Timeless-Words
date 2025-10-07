export async function injectFooter(slot = '#footerSlot') {
  const mount = document.querySelector(slot);
  if (!mount) return;

  try {
    // Keep your cache-busting 17e6a869 pattern if you use it elsewhere
    const url = new URL('../views/partials/footer.html', import.meta.url);
    url.searchParams.set('v', '17e6a869');
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    // Replace the slot with the fetched footer markup
    const tmp = document.createElement('div');
    tmp.innerHTML = html.trim();
    const footer = tmp.firstElementChild;
    if (footer) mount.replaceWith(footer);
  } catch (err) {
    console.error('Footer load failed:', err);
    // Optional: fall back to a minimal inline footer if desired
    // mount.innerHTML = '<footer class="site-footer"><div class="container"><small>…</small></div></footer>';
  }
}
