(() => {
  // Bail out quickly if basic WebAssembly support is already missing.
  if (typeof WebAssembly !== "object") {
    emitWarning();
    return;
  }

  const testModule = new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    0x01, 0x04, 0x01, 0x60, 0x00, 0x00,
    0x03, 0x02, 0x01, 0x00,
    0x07, 0x07, 0x01, 0x03, 0x72, 0x75, 0x6e, 0x00, 0x00,
    0x0a, 0x04, 0x01, 0x02, 0x00, 0x0b,
  ]);

  // If the module cannot even be validated, warn immediately.
  let validated = true;
  if (typeof WebAssembly.validate === "function") {
    try {
      validated = WebAssembly.validate(testModule);
    } catch (err) {
      emitWarning(err);
      return;
    }

    if (!validated) {
      emitWarning();
      return;
    }
  }

  // Try instantiating a tiny module; Lockdown Mode blocks code generation here.
  WebAssembly.instantiate(testModule).then(
    () => {
      /* WebAssembly works – do nothing. */
    },
    (err) => {
      emitWarning(err);
    }
  );

  function emitWarning(err) {
    if (emitWarning.shown) return;
    emitWarning.shown = true;

    const ua = navigator.userAgent || "";
    const isIOS = /iP(ad|hone|od)/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isMac = !isIOS && /Macintosh|Mac OS X/.test(ua);
    const isAndroid = /Android/.test(ua);

    const hints = [];
    hints.push("Timeless Words needs WebAssembly to read the offline library.");

    if (isIOS || isMac) {
      hints.push(
        "It looks like Safari's Lockdown Mode is preventing WebAssembly from running. " +
          "Please disable Lockdown Mode for this site on your device and reload the page. \n\n" + 
          "Go to Settings > Safari > Privacy & Security > Lockdown Mode and turn off Lockdown Mode for this site.\n\n" + 
          "If you are on iOS and you are using a third-party browser, " + 
          "you may need to disable Lockdown Mode for this app in iOS Settings.\n\n" + 
          "Go to Settings > Safari > Privacy & Security > Lockdown Mode > Configure Web Browsing"
      );
    } else if (isAndroid) {
      hints.push(
        "A device security setting is blocking WebAssembly. Try disabling any 'enhanced' " +
          "security or lockdown features for your browser and reload."
      );
    } else {
      hints.push(
        "A browser security feature is blocking WebAssembly. Adjust the setting and reload."
      );
    }

    if (err?.message) {
      hints.push(`Details: ${err.message}`);
    }

    alert(hints.join("\n\n"));
  }
})();
