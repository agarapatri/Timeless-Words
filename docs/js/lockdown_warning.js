(function () {
  if (typeof window !== "object" || window.__twLockdownWarnInit) return;
  window.__twLockdownWarnInit = true;

  var alreadyShown = false;

  function emitWarning(err) {
    if (alreadyShown) return;
    alreadyShown = true;

    var nav = window.navigator || {};
    var ua = typeof nav.userAgent === "string" ? nav.userAgent : "";
    var platform = typeof nav.platform === "string" ? nav.platform : "";
    var maxTouchPoints =
      typeof nav.maxTouchPoints === "number" ? nav.maxTouchPoints : 0;

    var isIOS =
      /iP(ad|hone|od)/.test(ua) ||
      (platform === "MacIntel" && maxTouchPoints > 1);
    var isMac = !isIOS && /Macintosh|Mac OS X/.test(ua);
    var isAndroid = /Android/.test(ua);
    var isOperaMini = ua.indexOf("Opera Mini") >= 0 || ua.indexOf("OPiOS") >= 0;
    var isOpera =
      !isOperaMini && (ua.indexOf("OPR/") >= 0 || ua.indexOf("Opera") >= 0);

    var hints = [];
    hints.push("Timeless Words needs WebAssembly to read the offline library.");

    if (isOperaMini) {
      hints.push(
        "Opera Mini's data-saving mode does not support WebAssembly. Switch to a full browser mode or use another browser to access the library."
      );
    } else if (isOpera) {
      hints.push(
        "Opera security/data-saver settings may be blocking WebAssembly. Disable Opera's data saving or enhanced security for this site, then reload."
      );
    } else if (isIOS || isMac) {
      hints.push(
        "It looks like Safari's Lockdown Mode is preventing WebAssembly from running. Please disable Lockdown Mode for this site on your device and reload the page.\n\n" +
          "Go to Settings > Safari > Privacy & Security > Lockdown Mode and turn off Lockdown Mode for this site.\n\n" +
          "If you are on iOS and you are using a third-party browser, you may need to disable Lockdown Mode for this app in iOS Settings.\n\n" +
          "Go to Settings > Safari > Privacy & Security > Lockdown Mode > Configure Web Browsing"
      );
    } else if (isAndroid) {
      hints.push(
        "A device security setting is blocking WebAssembly. Try disabling enhanced security or lockdown features for your browser and reload."
      );
    } else {
      hints.push(
        "A browser security feature is blocking WebAssembly. Adjust the setting and reload."
      );
    }

    if (err) {
      var details = err.message ? err.message : String(err);
      if (details) hints.push("Details: " + details);
    }

    if (typeof alert === "function") {
      alert(hints.join("\n\n"));
    }
  }

  if (typeof WebAssembly !== "object" || !WebAssembly) {
    emitWarning();
    return;
  }

  if (typeof Uint8Array !== "function" || typeof Uint8Array === "undefined") {
    emitWarning();
    return;
  }

  if (typeof WebAssembly.instantiate !== "function") {
    emitWarning();
    return;
  }

  var bytes = [
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x04, 0x01, 0x60,
    0x00, 0x00, 0x03, 0x02, 0x01, 0x00, 0x07, 0x07, 0x01, 0x03, 0x72, 0x75,
    0x6e, 0x00, 0x00, 0x0a, 0x04, 0x01, 0x02, 0x00, 0x0b,
  ];

  var testModule;
  try {
    testModule = new Uint8Array(bytes);
  } catch (err) {
    emitWarning(err);
    return;
  }

  var validated = true;
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

  var instantiateResult;
  try {
    instantiateResult = WebAssembly.instantiate(testModule);
  } catch (err) {
    emitWarning(err);
    return;
  }

  if (!instantiateResult) {
    emitWarning();
    return;
  }

  if (typeof instantiateResult.then === "function") {
    instantiateResult.then(
      function () {
        // WebAssembly works; nothing else to do.
      },
      function (err) {
        emitWarning(err);
      }
    );
  }
  // If instantiateResult is a module instance (synchronous success), do nothing.
})();
