# BetterE-class Project Guidelines

## Project Scope

- BetterE-class is an unofficial Manifest V3 Chrome extension for Doshisha University's e-class (WebClass).
- Treat `extension/` as the distributable source. There is no build step, package manifest, or automated test suite.
- Use `extension/manifest.json` as the source of truth for permissions, URL matches, script order, frame scope, and runtime timing.
- Keep user-facing documentation in Japanese. Keep implementation identifiers and code comments in English.

## Architecture

- Content scripts are plain browser JavaScript and should remain isolated with IIFEs.
- Shared browser utilities live under `extension/utils/` and are exposed through `window.BetterEclassUtils`.
- `extension/background.js` owns download resolution and Chrome Downloads/Tabs API operations.
- Textbook and quiz features depend on same-origin frames and `postMessage`; preserve origin checks and avoid assuming a single frame nesting level.
- Settings currently bridge prefixed `chrome.storage.local`, legacy unprefixed local storage, and `chrome.storage.sync`. Check all readers before changing a key or storage area.
- Keep the file-extension allowlists in `extension/background.js` and `extension/content.js` synchronized.
- `extension/rules.json` removes selected `Content-Disposition` headers for in-browser previews. Review its URL filters together with preview URL generation.

## Change Safety

- Prefer narrow DOM selectors with graceful fallbacks because WebClass markup is external and can change without notice.
- Make injected UI idempotent so repeated initialization or DOM mutations do not create duplicates.
- Do not add external data transmission, broader host permissions, or new Chrome permissions without explicit approval.
- Do not edit generated `_metadata`, archived `release/` packages, or reference data unless the task explicitly requires it.
- Update `extension/manifest.json` when adding, removing, or reordering injected scripts.

## Verification

- Run `node --check` on every changed JavaScript file.
- Parse changed JSON files to confirm valid syntax.
- Run Prettier as a check when available; do not introduce a package manager solely for formatting.
- For behavior changes, manually load `extension/` from `chrome://extensions/` and test the affected real e-class page, including relevant frames and settings states.
- If real e-class access is unavailable, clearly report which behavior remains manually unverified.
