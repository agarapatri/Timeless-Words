// Lightweight debug helpers. Safe to ship; only runs when imported.

/* 
Usage in Console when dev is on:
* listOPFS()
* clearOPFS(); clearFlag(); then flip switch
* forceInstall()
*/

console.log('[debug] loaded');

(function wireSemanticToggleLog() {
  const sem = document.getElementById('sem-check');
  if (!sem) return;
  sem.addEventListener('change', e =>
    console.log('[debug] semantic changed:', e.target.checked)
  );
})();

export async function listOPFS() {
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle('tw-semantic').catch(() => null);
  if (!dir) return console.log('[debug] no tw-semantic dir');
  for await (const e of dir.values()) console.log(e.kind, e.name);
}

export async function clearOPFS() {
  await (await navigator.storage.getDirectory())
    .removeEntry('tw-semantic', { recursive: true })
    .catch(() => {});
  console.log('[debug] OPFS cleared');
}

export function clearFlag() {
  localStorage.removeItem('tw:semanticEnabled');
  console.log('[debug] flag cleared');
}

export async function forceInstall() {
  const { SemanticInstall } = await import('./semantic_downloader.js');
  const p = new SemanticInstall({
    overlayId: 'tw-sem-overlay',
    barId: 'tw-sem-progress',
    pctId: 'tw-sem-pct',
    statusId: 'tw-sem-status',
    cancelId: 'tw-sem-cancel',
  });
  p.onInstalled = () => console.log('[debug] SEM installed');
  await p.start();
}
