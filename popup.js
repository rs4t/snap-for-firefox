const toggle = document.getElementById("toggle");
const statusText = document.getElementById("status-text");
const actionBtn = document.getElementById("action-btn");
const actionIcon = document.getElementById("action-icon");
const actionLabel = document.getElementById("action-label");

const ICONS = {
  // refresh-2, iconsax-style linear icon
  reload: `<path d="M4 12a8 8 0 0 1 14.6-4.5M20 12a8 8 0 0 1-14.6 4.5"
      stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    <path d="M18.5 3v5h-5M5.5 21v-5h5" stroke="currentColor" stroke-width="1.5"
      stroke-linecap="round" stroke-linejoin="round" />`,
  // arrow-right, iconsax-style linear icon
  switch: `<path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="1.5"
      stroke-linecap="round" stroke-linejoin="round" />`,
  // export-2 / open-in-new, iconsax-style linear icon
  open: `<path d="M18 13.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4.5"
      stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M14 4h6v6M20 4l-9 9" stroke="currentColor" stroke-width="1.5"
      stroke-linecap="round" stroke-linejoin="round" />`
};

let action = { mode: "open", tab: null };

function render(enabled) {
  toggle.setAttribute("aria-checked", String(enabled));
  statusText.textContent = enabled ? "On" : "Off";
}

async function computeAction() {
  const [active] = await browser.tabs.query({ active: true, currentWindow: true });
  if (active && active.url && SNAPCHAT_URL_RE.test(active.url)) {
    return { mode: "reload", tab: active };
  }

  const snapTabs = await browser.tabs.query({ url: "*://*.snapchat.com/*" });
  if (snapTabs.length > 0) {
    return { mode: "switch", tab: snapTabs[0] };
  }

  return { mode: "open", tab: null };
}

async function refreshAction() {
  action = await computeAction();
  actionIcon.innerHTML = ICONS[action.mode];
  actionBtn.classList.toggle("btn-outline", action.mode !== "reload");

  if (action.mode === "reload") actionLabel.textContent = "Reload Snapchat tab";
  else if (action.mode === "switch") actionLabel.textContent = "Switch to Snapchat tab";
  else actionLabel.textContent = "Open Snapchat";
}

browser.storage.local.get("enabled").then((res) => {
  render(!!res.enabled);
});

refreshAction();

toggle.addEventListener("click", async () => {
  const next = toggle.getAttribute("aria-checked") !== "true";
  await browser.storage.local.set({ enabled: next });
  render(next);

  // Apply immediately: toggling only takes effect after a hard reload.
  if (action.mode === "reload" && action.tab) {
    browser.tabs.reload(action.tab.id, { bypassCache: true });
  }
});

actionBtn.addEventListener("click", async () => {
  if (action.mode === "reload" && action.tab) {
    browser.tabs.reload(action.tab.id, { bypassCache: true });
  } else if (action.mode === "switch" && action.tab) {
    await browser.tabs.update(action.tab.id, { active: true });
    await browser.windows.update(action.tab.windowId, { focused: true });
    window.close();
  } else {
    await browser.tabs.create({ url: "https://web.snapchat.com" });
    window.close();
  }
});
