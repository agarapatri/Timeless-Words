import initWasmModule from './ort-wasm-simd-threaded.mjs';

export default function init(moduleArg = {}) {
  // The JSEP build in onnxruntime 1.22 no longer ships a separate worker stub.
  // We reuse the main threaded module so the loader still receives a promise
  // and resolves to the compiled WASM instance.
  return initWasmModule(moduleArg);
}
