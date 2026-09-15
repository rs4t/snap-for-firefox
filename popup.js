const toggle = document.getElementById("toggle");
const statusText = document.getElementById("status-text");
const reloadBtn = document.getElementById("reload-btn");

function render(enabled) {
  toggle.setAttribute("aria-checked", String(enabled));
  statusText.textContent = enabled ? "On" : "Off";
}

async function isSnapchatTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab && tab.url && /^https?:\/\/([^/]*\.)?snapchat\.com\//.test(tab.url) ? tab : null;
}

browser.storage.local.get("enabled").then((res) => {
  render(!!res.enabled);
});

toggle.addEventListener("click", async () => {
  const next = toggle.getAttribute("aria-checked") !== "true";
  await browser.storage.local.set({ enabled: next });
  render(next);

  const tab = await isSnapchatTab();
  reloadBtn.hidden = !tab;
});

reloadBtn.addEventListener("click", async () => {
  const tab = await isSnapchatTab();
  if (tab) browser.tabs.reload(tab.id, { bypassCache: true });
  reloadBtn.hidden = true;
});
