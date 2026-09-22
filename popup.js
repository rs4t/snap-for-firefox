const toggle = document.getElementById("toggle");
const statusText = document.getElementById("status-text");
const openBtn = document.getElementById("open-btn");

function render(enabled) {
  toggle.setAttribute("aria-checked", String(enabled));
  statusText.textContent = enabled ? "On" : "Off";
}

async function getSnapchatTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab && tab.url && SNAPCHAT_URL_RE.test(tab.url) ? tab : null;
}

async function refreshOpenButton() {
  const tab = await getSnapchatTab();
  openBtn.hidden = !!tab;
}

browser.storage.local.get("enabled").then((res) => {
  render(!!res.enabled);
});

refreshOpenButton();

toggle.addEventListener("click", async () => {
  const next = toggle.getAttribute("aria-checked") !== "true";
  await browser.storage.local.set({ enabled: next });
  render(next);

  // Apply immediately: toggling only takes effect after a hard reload.
  const tab = await getSnapchatTab();
  if (tab) browser.tabs.reload(tab.id, { bypassCache: true });
});

openBtn.addEventListener("click", async () => {
  await browser.tabs.create({ url: "https://web.snapchat.com" });
  window.close();
});
