### Console Tests
* In “DevTools Console”, type `allow pasting`.
* To proceed once: type `allow pasting` in the **Console**, press Enter, then paste and run your code.
* To avoid the warning and keep history: use **Sources → Snippets → New Snippet**, paste code there, then **Run**.
* To make it permanent in your app: put the code in your project files and reload, not in Console.
* To re-enable the block: close DevTools or reload the page.
  Review any code before running.


**DevTools Console** — run ad-hoc while the page is open

```js
// OPFS: remove 'tw-semantic' directory
(await navigator.storage.getDirectory()).removeEntry('tw-semantic', { recursive: true })
```

**DevTools Console**

```js
// Full OPFS wipe
(async () => {
  const root = await navigator.storage.getDirectory();
  for await (const [name] of root.entries()) await root.removeEntry(name, { recursive: true });
})();
```

**DevTools Console**

```js
// Verify URLs the installer will hit
import { SEMANTIC, SEMANTIC_ROOT } from '../js/constants.js';
const m = await fetch(SEMANTIC.MANIFEST_URL).then(r=>r.json());
m.files.map(f => new URL(f.path, SEMANTIC_ROOT).href);
```

**DevTools Console**

```js
// List bucket contents after a run
const root = await navigator.storage.getDirectory();
const dir = await root.getDirectoryHandle('tw-semantic').catch(()=>null);
if (dir) for await (const e of dir.values()) console.log(e.kind, e.name);
```

**DevTools Console**

* Run this in the DevTools console to sanity-check the encoder:
```js
import('../js/transformer_encoder.js').then(async ({ TransformerEncoder }) => {
  const enc = new TransformerEncoder();
  await enc.init();                       // should succeed and load the wasm + model
  const vec = await enc.encode('who is krishna');
  console.log('encoder dim =', vec.length);
});
```

**DevTools Console**

* Toggle state when switch is ON:
Check: 
```js
localStorage.getItem('tw_semantic_enabled')
``` 
* should be "1".
* If not, turn the “by meaning” switch ON to install/enable.

* Use `SemanticInstall`, not `SemanticDownloadPanel`.
* In the Console, use dynamic `await import(...)` instead of `import ... from` (which only works in module files).

**DevTools Console**

* DB open + dimension (confirms pack is usable): Run:
```js
import('../js/vec_db.js').then(async ({ SemanticDB }) => {
const semdb = new SemanticDB({ opfsDir: 'tw-semantic', dbFile: 'library.semantic.v01.sqlite' });
await semdb.open();
console.log('dim:', semdb.getDimension());
});
```
* If this throws NotFoundError: the pack isn’t installed. Toggle ON → let it download.

**DevTools Console**

* Optional quick encoder test in Console:
```js
import('../js/transformer_encoder.js').then(async ({ TransformerEncoder }) => { const enc = new TransformerEncoder(); await enc.init(); const v = await enc.encode('who is krishna'); console.log('dim', v.length, v.slice(0,5)); });
```

**DevTools Console**

```js
// 1) Load the module correctly
const { SemanticInstall } = await import('../js/semantic_downloader.js');

// 2) Create the installer with the right element IDs (match search.html)
const p = new SemanticInstall({
  overlayId: 'tw-sem-overlay',
  barId: 'tw-sem-progress',
  pctId: 'tw-sem-pct',
  statusId: 'tw-sem-status',
  cancelId: 'tw-sem-cancel',
  // manifestUrl optional; default points to ../assets/data/semantic/manifest.json?v=...
});

// 3) Run it
p.onInstalled = () => console.log('SEM installed');
await p.start();
```

To just check install state in Console:

```js
const { SemanticInstall } = await import('../js/semantic_downloader.js');
await new SemanticInstall().isInstalled();  // true or false
```


* “`SemanticDownloadPanel is not a constructor`” → that class does not exist. The exported class is `SemanticInstall`.
* “`Cannot use import statement outside a module`” → top-level `import` is illegal in Console. Use `await import(...)`.


**Reason:** You ran the correct class (`SemanticInstall`), `start()` completed, and `isInstalled()` returned `true`. That confirms the pack is installed in OPFS.

**Answer:**
Semantic data is now installed. The toggle will not re-download; it will just enable semantic mode and read from OPFS.

Quick verifications:

**DevTools Console**

```js
// 1) Semantic mode flag should be true after you flip the switch ON
window.__TW_SEMANTIC_MODE__
localStorage.getItem('tw:semanticEnabled')

// 2) Files actually exist in OPFS
const root = await navigator.storage.getDirectory();
const dir  = await root.getDirectoryHandle('tw-semantic');
for await (const e of dir.values()) console.log(e.kind, e.name);
```

Force a fresh download later:

**DevTools Console**

```js
// Clear install + flag, then flip switch ON again
(await navigator.storage.getDirectory()).removeEntry('tw-semantic', { recursive: true });
localStorage.removeItem('tw:semanticEnabled');
```

If you want downloads to trigger on deploy without manual Console work, bump the manifest query param in your code (e.g., `?v=<new-commit>`) and deploy.
