# Implementation Plan - Production-Ready Privacy Mask Chrome Extension

Build a production-ready, privacy-first Manifest V3 Chrome Extension called **Privacy Mask** in TypeScript. It allows users to visually mask sensitive information on any webpage with persistent, robust selectors, dynamic SPA & MutationObserver support, Web Crypto SHA-256 fingerprinting, zero network dependencies, and a modern UI.

## User Review Required

> [!IMPORTANT]
> - **Build toolchain**: We will use `esbuild` + `typescript` + `vitest` for blazing fast builds, bundling Manifest V3 background service workers, content scripts, and popup/options pages without bloated runtime overhead.
> - **Zero Server/Network Calls**: The extension operates 100% locally via `chrome.storage.local` and Web Crypto API.

## Proposed Changes

### Project Configuration & Build System

#### [NEW] [package.json](file:///c:/Ai_learning/extension/package.json)
- Scripts: `build`, `dev`, `typecheck`, `test`, `lint`.
- Dependencies & DevDependencies: `typescript`, `esbuild`, `vitest`, `@types/chrome`, `jsdom`.

#### [NEW] [tsconfig.json](file:///c:/Ai_learning/extension/tsconfig.json)
- TypeScript strict configuration targeting ES2022 / DOM.

#### [NEW] [build.js](file:///c:/Ai_learning/extension/build.js)
- Build script bundling `src/background/service-worker.ts`, `src/content/content.ts`, `src/popup/popup.ts`, `src/options/options.ts`, copying `src/manifest.json`, HTML/CSS files, and generating icon assets to `dist/`.

---

### Manifest V3 & Shared Modules

#### [NEW] [src/manifest.json](file:///c:/Ai_learning/extension/src/manifest.json)
- Manifest V3 specification with `storage`, `activeTab` permissions, `run_at: "document_idle"`, `all_frames: true`, action popup, options page, and background service worker.

#### [NEW] [src/shared/types.ts](file:///c:/Ai_learning/extension/src/shared/types.ts)
- Data types: `MaskRule`, `SelectorInfo`, `MaskSettings`, `RuleStatus`, `SelectionTarget`, `ExtensionMessage`.

#### [NEW] [src/shared/constants.ts](file:///c:/Ai_learning/extension/src/shared/constants.ts)
- Default settings (mask text `****`, reveal duration 5s, matchScope `domain`), dynamic CSS class detection regexes, message action constants.

#### [NEW] [src/shared/storage.ts](file:///c:/Ai_learning/extension/src/shared/storage.ts)
- Centralized `chrome.storage.local` wrapper: `getMaskRules()`, `saveMaskRule()`, `updateMaskRule()`, `deleteMaskRule()`, `clearMaskRules()`, `getRulesForSite()`, `getSettings()`, `saveSettings()`.

#### [NEW] [src/shared/messages.ts](file:///c:/Ai_learning/extension/src/shared/messages.ts)
- Type-safe message passing utilities between popup, background, and content scripts.

---

### Content Script Modules

#### [NEW] [src/content/fingerprint.ts](file:///c:/Ai_learning/extension/src/content/fingerprint.ts)
- Web Crypto SHA-256 fingerprinting with normalization (whitespace trimming, multiple-space collapsing, case normalization).

#### [NEW] [src/content/selector.ts](file:///c:/Ai_learning/extension/src/content/selector.ts)
- Robust selector generation prioritizing: ID -> `data-testid` / `data-*` -> semantic attributes -> stable classes (filtering `css-*`, `sc-*`, `hash-*`, `_*` via `isLikelyStableClass`) -> DOM hierarchy & nth-of-type. Fallback resolution mechanism for stale rule health.

#### [NEW] [src/content/selection.ts](file:///c:/Ai_learning/extension/src/content/selection.ts)
- Selection mode controller:
  - `getBestTarget(element)` avoiding huge wrapper containers.
  - `resolveSelectionTarget()` supporting both element clicks and text range selections.
  - Hover highlight overlay (`privacy-mask-hover`) with isolated z-index.
  - Interception & cancellation of clicks/forms during selection mode.
  - ESC key cancellation and cleanup.

#### [NEW] [src/content/masking.ts](file:///c:/Ai_learning/extension/src/content/masking.ts)
- Safe visual masking engine:
  - Mode A: Safe text masking without breaking React/Vue DOM bindings.
  - Mode B: Absolute/sticky overlay masking with resize & scroll tracking.
  - Temporary reveal functionality with countdown timer (re-masks after configured seconds).
  - Global pause support and idempotent rule application (prevents duplicate `****`).

#### [NEW] [src/content/observer.ts](file:///c:/Ai_learning/extension/src/content/observer.ts)
- Debounced MutationObserver that checks dynamically added or modified DOM nodes and reapplies active rules.

#### [NEW] [src/content/spa.ts](file:///c:/Ai_learning/extension/src/content/spa.ts)
- SPA navigation detector (`pushState`, `replaceState`, `popstate`) triggering rule reload without full page refreshes.

#### [NEW] [src/content/styles.css](file:///c:/Ai_learning/extension/src/content/styles.css)
- Isolated, ultra-high z-index styling for hover highlights, mask overlays, reveal buttons, and badges.

#### [NEW] [src/content/content.ts](file:///c:/Ai_learning/extension/src/content/content.ts)
- Main content script integrating selection, masking, observer, and messaging.

---

### Background Worker

#### [NEW] [src/background/service-worker.ts](file:///c:/Ai_learning/extension/src/background/service-worker.ts)
- Service worker managing badge counters (number of active masks on current tab), keyboard shortcuts, and message routing.

---

### Popup & Options UI

#### [NEW] [src/popup/popup.html](file:///c:/Ai_learning/extension/src/popup/popup.html) & [popup.ts](file:///c:/Ai_learning/extension/src/popup/popup.ts) & [popup.css](file:///c:/Ai_learning/extension/src/popup/popup.css)
- Sleek modern dark UI displaying:
  - "Start Masking" primary CTA.
  - Current site and active masked elements count.
  - Quick Pause / Resume toggle.
  - Quick list of active masks on the current page with temporary reveal / delete.
  - "Manage Masks" & "Settings" buttons.

#### [NEW] [src/options/options.html](file:///c:/Ai_learning/extension/src/options/options.html) & [options.ts](file:///c:/Ai_learning/extension/src/options/options.ts) & [options.css](file:///c:/Ai_learning/extension/src/options/options.css)
- Comprehensive dashboard:
  - Grouping rules by domain/page with rule health status (`active`, `not-found`, `disabled`).
  - Search / filter rules.
  - Actions: Enable, Disable, Delete, Clear All, Export/Import rules (JSON).
  - Settings: Default Mask text (`****`, `████`, `HIDDEN`, `••••`), Reveal duration (3s, 5s, 10s, 30s), Default match scope (Current Page vs Entire Website).

---

### Icons & Assets

#### [NEW] [src/icons/](file:///c:/Ai_learning/extension/src/icons/) & Icon generator script
- Standard extension icons (16x16, 48x48, 128x128).

---

### Test Suite & Test Page

#### [NEW] [tests/selector.test.ts](file:///c:/Ai_learning/extension/tests/selector.test.ts)
- Tests for selector generation, stability heuristics, dynamic class avoidance, fallback matching.

#### [NEW] [tests/fingerprint.test.ts](file:///c:/Ai_learning/extension/tests/fingerprint.test.ts)
- Tests for text normalization, SHA-256 consistency and collision avoidance.

#### [NEW] [tests/storage.test.ts](file:///c:/Ai_learning/extension/tests/storage.test.ts)
- Tests for CRUD operations on rules and settings.

#### [NEW] [tests/masking.test.ts](file:///c:/Ai_learning/extension/tests/masking.test.ts)
- Tests for element/text masking, idempotency, duplicate prevention, and reveal/unmask.

#### [NEW] [tests/test-page.html](file:///c:/Ai_learning/extension/tests/test-page.html)
- Interactive local test page with salary cards, dynamic React-like updates, forms, and email/phone elements.

---

### Documentation

#### [NEW] [README.md](file:///c:/Ai_learning/extension/README.md)
- Complete setup, build, installation, usage, privacy assurances, and architecture documentation.

## Verification Plan

### Automated Tests
- `npm run typecheck` to verify TypeScript strict types.
- `npm run test` (Vitest) to run the full unit test suite covering selectors, fingerprinting, storage, and masking.
- `npm run build` to verify clean generation of the `dist/` bundle.

### Manual Verification
- Verify generated `dist/` directory has all required assets, HTML, CSS, JS bundles and valid `manifest.json`.
- Test `tests/test-page.html` with selection and dynamic DOM masking scenarios.
