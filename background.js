const UA_VERSION = "128";
const CHROME_UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${UA_VERSION}.0.0.0 Safari/537.36`;
const SEC_CH_UA = `"Google Chrome";v="${UA_VERSION}", "Chromium";v="${UA_VERSION}", "Not=A?Brand";v="24"`;
const SEC_CH_UA_PLATFORM = '"Windows"';
const SEC_CH_UA_MOBILE = "?0";

const TARGET_PATTERN = "*://*.snapchat.com/*";

let enabled = false;
console.log("[SFF] background script loaded");

function updateBadge() {
  browser.browserAction.setBadgeText({ text: enabled ? "ON" : "" });
  browser.browserAction.setBadgeBackgroundColor({ color: "#17c964" });
  browser.browserAction.setTitle({
    title: enabled ? "Snap for Firefox — spoofing ON" : "Snap for Firefox — spoofing OFF"
  });
}

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

// JS-side spoofing: navigator.userAgent/platform/vendor AND navigator.userAgentData,
// plus a small confirmation toast. Registered as real FILE-based content scripts via
// browser.contentScripts.register() rather than tabs.executeScript({code: ...}).
// Firefox's code-string executeScript variant runs through an eval-like path that
// some sites' CSP silently blocks (it fails with no catchable error); file-based
// content scripts — declarative or dynamically registered — are documented to be
// exempt from the page's CSP entirely, which is what patch.js/toast.js rely on.
let patchRegistration = null;
let toastRegistration = null;

async function registerContentScripts() {
  if (patchRegistration) return;
  try {
    patchRegistration = await browser.contentScripts.register({
      matches: [TARGET_PATTERN],
      js: [{ file: "patch.js" }],
      runAt: "document_start",
      allFrames: true
    });
    toastRegistration = await browser.contentScripts.register({
      matches: [TARGET_PATTERN],
      js: [{ file: "toast.js" }],
      runAt: "document_start",
      allFrames: false
    });
    console.log("[SFF] content scripts registered");
  } catch (e) {
    console.error("[SFF] contentScripts.register failed", e);
  }
}

function unregisterContentScripts() {
  if (patchRegistration) {
    patchRegistration.unregister();
    patchRegistration = null;
  }
  if (toastRegistration) {
    toastRegistration.unregister();
    toastRegistration = null;
  }
  console.log("[SFF] content scripts unregistered");
}

function syncRegistration() {
  if (enabled) registerContentScripts();
  else unregisterContentScripts();
}

browser.storage.local.get("enabled").then((res) => {
  enabled = !!res.enabled;
  console.log("[SFF] initial enabled state:", enabled);
  updateBadge();
  syncRegistration();
});

browser.storage.onChanged.addListener((changes) => {
  if ("enabled" in changes) {
    enabled = !!changes.enabled.newValue;
    console.log("[SFF] enabled changed to:", enabled);
    updateBadge();
    syncRegistration();
  }
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
