# Snap for Firefox (SFF)

Firefox extension that makes Snapchat Web work in Firefox by spoofing Chrome — just Snapchat, one toggle.

Snapchat Web blocks Firefox with a "Browser not supported" screen. This extension fakes being Chrome only on `snapchat.com`: it rewrites the `User-Agent` and `Sec-CH-UA*` headers on the network side, and patches `navigator.userAgent` / `navigator.userAgentData` on the page side, so both the server-side and client-side checks pass.

## Install (temporary, until signed)

1. Clone or download this repo.
2. In Firefox, go to `about:debugging` → **This Firefox** → **Load Temporary Add-on…**.
3. Select `manifest.json` from the repo folder.
4. Click the extension icon and flip the toggle **On** — the current Snapchat tab (if you're on one) reloads automatically.

Temporary add-ons unload on browser restart — you'll need to reload it each time until it's signed for permanent install.

## How it works

- `background.js` — rewrites `User-Agent` and adds `Sec-CH-UA`, `Sec-CH-UA-Mobile`, `Sec-CH-UA-Platform` headers on requests to `*.snapchat.com`. Also self-heals: if a Snapchat tab loads a stale cached "Browser not supported" page, it automatically does one cache-bypassing reload.
- `patch.js` — dynamically registered as a real content script (`browser.contentScripts.register()`, not `tabs.executeScript({code})` — that variant runs through an eval-like path some sites' CSP silently blocks) on `snapchat.com` at `document_start`. Patches `navigator.userAgent`/`platform`/`vendor`/`userAgentData` using Firefox's `wrappedJSObject` + `exportFunction`/`cloneInto`, which modifies the page's real objects directly and is exempt from the page's CSP.
- `toast.js` — same registration mechanism; shows a small "spoofing Chrome" toast top-right on page load, confirming it's active.
- `popup.html` / `popup.js` / `popup.css` — the on/off toggle (auto-reloads the active Snapchat tab), and one smart action button that adapts to context: **Reload Snapchat tab** when you're already on one, **Switch to Snapchat tab** when one's open elsewhere, or **Open Snapchat** when none is open.
- `shared.js` — the `snapchat.com` URL matcher shared across scripts.
- A green **ON** badge on the toolbar icon shows spoofing is active, so you don't need to open the popup to check.

Only active on `snapchat.com`. Toggle it off (and reload) and everything reverts to normal Firefox.

## License

MIT
