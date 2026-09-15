# Snap for Firefox (SFF)

Firefox extension that makes Snapchat Web work in Firefox by spoofing Chrome — just Snapchat, one toggle.

Snapchat Web blocks Firefox with a "Browser not supported" screen. This extension fakes being Chrome only on `snapchat.com`: it rewrites the `User-Agent` and `Sec-CH-UA*` headers, and overrides `navigator.userAgent` / `navigator.userAgentData` in page JS, so both the server-side and client-side checks pass.

## Install (temporary, until signed)

1. Clone or download this repo.
2. In Firefox, go to `about:debugging` → **This Firefox** → **Load Temporary Add-on…**.
3. Select `manifest.json` from the repo folder.
4. Click the extension icon, flip the toggle **On**, then hit **Reload Snapchat tab**.

Temporary add-ons unload on browser restart — you'll need to reload it each time until it's signed for permanent install.

## How it works

- `background.js` — rewrites `User-Agent` and adds `Sec-CH-UA`, `Sec-CH-UA-Mobile`, `Sec-CH-UA-Platform` headers on requests to `*.snapchat.com`, and injects a `navigator.userAgentData` shim at `document_start` (before the page's own scripts run).
- `popup.html` / `popup.js` / `popup.css` — the on/off toggle and reload button.

Only active on `snapchat.com`. Toggle it off and everything reverts to normal Firefox.

## License

MIT
