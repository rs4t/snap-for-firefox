const UA_VERSION = "128";
const CHROME_UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${UA_VERSION}.0.0.0 Safari/537.36`;
const SEC_CH_UA = `"Google Chrome";v="${UA_VERSION}", "Chromium";v="${UA_VERSION}", "Not=A?Brand";v="24"`;
const SEC_CH_UA_PLATFORM = '"Windows"';
const SEC_CH_UA_MOBILE = "?0";

const TARGET_PATTERN = "*://*.snapchat.com/*";

let enabled = false;

browser.storage.local.get("enabled").then((res) => {
  enabled = !!res.enabled;
});

browser.storage.onChanged.addListener((changes) => {
  if ("enabled" in changes) {
    enabled = !!changes.enabled.newValue;
  }
});

// Rewrite the User-Agent header and add the Chrome Client-Hint headers
// (Sec-CH-UA / Sec-CH-UA-Mobile / Sec-CH-UA-Platform) that Firefox never
// sends on its own. Snapchat checks for these, so without them the UA
// string alone doesn't convince it.
browser.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (!enabled) return {};

    const headers = details.requestHeaders.filter(
      (h) => !h.name.toLowerCase().startsWith("sec-ch-ua")
    );

    for (const h of headers) {
      if (h.name.toLowerCase() === "user-agent") h.value = CHROME_UA;
    }

    headers.push(
      { name: "Sec-CH-UA", value: SEC_CH_UA },
      { name: "Sec-CH-UA-Mobile", value: SEC_CH_UA_MOBILE },
      { name: "Sec-CH-UA-Platform", value: SEC_CH_UA_PLATFORM }
    );

    return { requestHeaders: headers };
  },
  { urls: [TARGET_PATTERN] },
  ["blocking", "requestHeaders"]
);

// JS-side spoofing: navigator.userAgent/platform/vendor AND navigator.userAgentData
// (the Client Hints API only Chromium exposes). Everything needed is inlined into
// the injected string synchronously (no async storage lookups inside the page
// script), so it runs at document_start before the page's own scripts can read it.
function buildInjectedCode() {
  return `(function () {
    const ua = ${JSON.stringify(CHROME_UA)};
    const props = {
      userAgent: ua,
      appVersion: ua.replace(/^Mozilla\\//, ""),
      vendor: "Google Inc.",
      platform: "Win32"
    };
    for (const [key, value] of Object.entries(props)) {
      try {
        Object.defineProperty(Navigator.prototype, key, {
          get: () => value,
          configurable: true
        });
      } catch (e) {}
    }

    class NavigatorUAData {
      brands = [
        { brand: "Google Chrome", version: ${JSON.stringify(UA_VERSION)} },
        { brand: "Chromium", version: ${JSON.stringify(UA_VERSION)} },
        { brand: "Not=A?Brand", version: "24" }
      ];
      mobile = false;
      platform = "Windows";
      toJSON() {
        return { brands: this.brands, mobile: this.mobile, platform: this.platform };
      }
      getHighEntropyValues(hints) {
        const r = this.toJSON();
        if (!Array.isArray(hints)) return Promise.reject(new TypeError("hints must be an array"));
        if (hints.includes("architecture")) r.architecture = "x86";
        if (hints.includes("bitness")) r.bitness = "64";
        if (hints.includes("model")) r.model = "";
        if (hints.includes("platformVersion")) r.platformVersion = "10.0.0";
        if (hints.includes("uaFullVersion")) r.uaFullVersion = "${UA_VERSION}.0.0.0";
        if (hints.includes("fullVersionList")) r.fullVersionList = this.brands;
        return Promise.resolve(r);
      }
    }
    try {
      Object.defineProperty(Navigator.prototype, "userAgentData", {
        get: () => new NavigatorUAData(),
        configurable: true
      });
    } catch (e) {}
  })();`;
}

browser.webNavigation.onCommitted.addListener((details) => {
  if (!enabled) return;
  if (!/^https?:\/\/([^/]*\.)?snapchat\.com\//.test(details.url)) return;

  browser.tabs.executeScript(details.tabId, {
    frameId: details.frameId,
    runAt: "document_start",
    code: `{
      const script = document.createElement("script");
      script.textContent = ${JSON.stringify(buildInjectedCode())};
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    }`
  }).catch(() => {});
});
