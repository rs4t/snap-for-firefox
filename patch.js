(function () {
  const UA_VERSION = "128";
  const CHROME_UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${UA_VERSION}.0.0.0 Safari/537.36`;

  try {
    const win = window.wrappedJSObject;
    const navProto = win.Navigator.prototype;
    const props = {
      userAgent: CHROME_UA,
      appVersion: CHROME_UA.replace(/^Mozilla\//, ""),
      vendor: "Google Inc.",
      platform: "Win32"
    };
    for (const [key, value] of Object.entries(props)) {
      try {
        Object.defineProperty(navProto, key, {
          get: exportFunction(function () { return value; }, win),
          configurable: true
        });
      } catch (e) {}
    }

    const brandsData = [
      { brand: "Google Chrome", version: UA_VERSION },
      { brand: "Chromium", version: UA_VERSION },
      { brand: "Not=A?Brand", version: "24" }
    ];

    try {
      const uaData = cloneInto({ brands: brandsData, mobile: false, platform: "Windows" }, win);
      uaData.toJSON = exportFunction(function () {
        return cloneInto({ brands: brandsData, mobile: false, platform: "Windows" }, win);
      }, win);
      uaData.getHighEntropyValues = exportFunction(function (hints) {
        if (!Array.isArray(hints)) return win.Promise.reject(new win.TypeError("hints must be an array"));
        const r = { brands: brandsData, mobile: false, platform: "Windows" };
        if (hints.includes("architecture")) r.architecture = "x86";
        if (hints.includes("bitness")) r.bitness = "64";
        if (hints.includes("model")) r.model = "";
        if (hints.includes("platformVersion")) r.platformVersion = "10.0.0";
        if (hints.includes("uaFullVersion")) r.uaFullVersion = UA_VERSION + ".0.0.0";
        if (hints.includes("fullVersionList")) r.fullVersionList = brandsData;
        return win.Promise.resolve(cloneInto(r, win));
      }, win);

      Object.defineProperty(navProto, "userAgentData", {
        get: exportFunction(function () { return uaData; }, win),
        configurable: true
      });
    } catch (e) {}

    console.log("[SFF] patch.js applied");
  } catch (e) {
    console.error("[SFF] patch.js failed", e);
  }
})();
