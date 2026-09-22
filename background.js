const UA_VERSION = "128";
const CHROME_UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${UA_VERSION}.0.0.0 Safari/537.36`;
const SEC_CH_UA = `"Google Chrome";v="${UA_VERSION}", "Chromium";v="${UA_VERSION}", "Not=A?Brand";v="24"`;
const SEC_CH_UA_PLATFORM = '"Windows"';
const SEC_CH_UA_MOBILE = "?0";

const TARGET_PATTERN = "*://*.snapchat.com/*";

let enabled = false;

function updateBadge() {
  browser.browserAction.setBadgeText({ text: enabled ? "ON" : "" });
  browser.browserAction.setBadgeBackgroundColor({ color: "#17c964" });
  browser.browserAction.setTitle({
    title: enabled ? "Snap for Firefox — spoofing ON" : "Snap for Firefox — spoofing OFF"
  });
}

browser.storage.local.get("enabled").then((res) => {
  enabled = !!res.enabled;
  updateBadge();
});

browser.storage.onChanged.addListener((changes) => {
  if ("enabled" in changes) {
    enabled = !!changes.enabled.newValue;
    updateBadge();
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

    function showToast() {
      const toast = document.createElement("div");
      toast.textContent = "Snap for Firefox — spoofing Chrome";
      Object.assign(toast.style, {
        position: "fixed",
        top: "16px",
        right: "16px",
        zIndex: "2147483647",
        background: "#121214",
        color: "#fffc00",
        font: "600 12.5px -apple-system, \\"Segoe UI\\", Roboto, sans-serif",
        padding: "10px 14px",
        borderRadius: "9px",
        boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
        border: "1px solid rgba(255,252,0,0.25)",
        opacity: "0",
        transform: "translateY(-6px)",
        transition: "opacity 0.2s ease, transform 0.2s ease",
        pointerEvents: "none"
      });
      document.body.appendChild(toast);
      requestAnimationFrame(() => {
        toast.style.opacity = "1";
        toast.style.transform = "translateY(0)";
      });
      setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(-6px)";
        setTimeout(() => toast.remove(), 250);
      }, 2600);
    }
    if (document.body) showToast();
    else document.addEventListener("DOMContentLoaded", showToast, { once: true });
  })();`;
}

browser.webNavigation.onCommitted.addListener((details) => {
  if (!enabled) return;
  if (!SNAPCHAT_URL_RE.test(details.url)) return;

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

// Snapchat sometimes serves a stale cached "Browser not supported" response
// (from before spoofing kicked in, or from a session-restored tab) that a
// normal reload won't fix — only a cache-bypassing reload does. Detect that
// page after load and self-heal with one bypassCache reload automatically.
const retriedTabs = new Set();

browser.webNavigation.onCompleted.addListener(async (details) => {
  if (!enabled) return;
  if (details.frameId !== 0) return;
  if (!SNAPCHAT_URL_RE.test(details.url)) return;

  if (retriedTabs.has(details.tabId)) {
    retriedTabs.delete(details.tabId);
    return;
  }

  try {
    const [isUnsupported] = await browser.tabs.executeScript(details.tabId, {
      frameId: 0,
      code: "document.body && document.body.innerText.includes('Browser not supported')"
    });

    if (isUnsupported) {
      retriedTabs.add(details.tabId);
      browser.tabs.reload(details.tabId, { bypassCache: true }).catch(() => {
        retriedTabs.delete(details.tabId);
      });
    }
  } catch (e) {}
});

browser.tabs.onRemoved.addListener((tabId) => retriedTabs.delete(tabId));
