(() => {
  const supportsThreads =
    !!crossOriginIsolated &&
    typeof SharedArrayBuffer === "function" &&
    typeof Atomics === "object";

  if (supportsThreads) return;

  const origFetch = window.fetch?.bind(window);
  if (!origFetch) return;

  // same file; no extra download or rename
  const NOTHREAD = "/js/sql_helpers/sql-wasm.wasm";

  window.fetch = async (input, init) => {
    let u =
      typeof input === "string"
        ? new URL(input, location.href)
        : input?.url
        ? new URL(input.url)
        : null;

    if (u && u.pathname.endsWith("/js/sql_helpers/sql-wasm.wasm")) {
      input = NOTHREAD + (u.search || "");
    }
    return origFetch(input, init);
  };

  const origIS = WebAssembly.instantiateStreaming;
  if (typeof origIS === "function") {
    WebAssembly.instantiateStreaming = async (source, imports) => {
      try {
        return await origIS(source, imports);
      } catch {
        const resp = source instanceof Response ? source : await source;
        const buf = await resp.arrayBuffer();
        return WebAssembly.instantiate(buf, imports);
      }
    };
  }
})();
