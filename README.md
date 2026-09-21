# Privacy Mask 🔒

A production-ready, privacy-first Google Chrome Extension (Manifest V3) that empowers users to visually hide sensitive information on webpages—including salaries, bank balances, email addresses, phone numbers, employee IDs, and confidential text.

---

## 🌟 Key Features

- **🎯 Interactive Point-and-Click Masking**: Hover over elements with live highlighting or highlight text to mask instantly.
- **🛡️ 100% Local & Privacy-Preserving**: Runs entirely inside your browser sandbox. Zero analytics, zero telemetry, zero external server calls. Works completely offline.
- **🧠 Robust Selector Engine**: Prioritizes semantic IDs, `data-testid`, `data-*` attributes, semantic tags, and DOM paths while automatically ignoring fragile dynamic classes (e.g. `css-1a2b3c`, `sc-bdfBwQ`, `_abc123`).
- **🔐 Web Crypto SHA-256 Fingerprinting**: Generates one-way normalized cryptographic hashes for fallback locator matching without storing raw sensitive values.
- **⚡ Dynamic DOM & SPA Ready**: Seamlessly maintains masking across single-page application (SPA) client-side routing (`pushState`, `replaceState`, `popstate`) and dynamic AJAX/React/Vue/Angular DOM mutations using debounced `MutationObserver`.
- **👁️ Temporary Reveal**: Hover or click the reveal icon on any masked element to view original text for a configurable duration (default: 5 seconds) before automatically re-masking.
- **⏸️ Global Pause / Resume**: Temporarily disable all masks across a site with one click from the popup.
- **⚙️ Comprehensive Dashboard**: Manage, edit, search, filter, enable/disable, export, and import rules from the Options page.

---

## 📁 Project Architecture

```text
privacy-mask/
├── package.json               # Scripts, dependencies & types
├── tsconfig.json              # TypeScript strict configuration
├── vitest.config.ts           # Unit test configuration
├── build.js                   # esbuild bundler and asset pipeline
├── generate-icons.js          # Standalone icon generation script
├── README.md                  # Documentation
│
├── src/
│   ├── manifest.json          # Chrome Manifest V3 configuration
│   │
│   ├── background/
│   │   └── service-worker.ts  # Manifest V3 service worker & badge counter
│   │
│   ├── content/
│   │   ├── content.ts         # Content script orchestrator
│   │   ├── selection.ts       # Interactive selection & hover box
│   │   ├── masking.ts         # Visual overlay & text node masking engine
│   │   ├── observer.ts        # Debounced MutationObserver for dynamic DOM
│   │   ├── selector.ts        # Robust selector generator & fallback matcher
│   │   ├── fingerprint.ts     # Web Crypto SHA-256 text fingerprinting
│   │   ├── spa.ts             # SPA navigation detector
│   │   └── styles.css         # High z-index isolated styles
│   │
│   ├── popup/
│   │   ├── popup.html         # Modern popup interface
│   │   ├── popup.ts           # Popup controller
│   │   └── popup.css          # Glassmorphic dark styling
│   │
│   ├── options/
│   │   ├── options.html       # Rule management dashboard & settings
│   │   ├── options.ts         # Options controller & JSON import/export
│   │   └── options.css        # Dashboard styling
│   │
│   ├── shared/
│   │   ├── types.ts           # Strong TypeScript interfaces
│   │   ├── constants.ts       # Config constants & regex patterns
│   │   ├── storage.ts         # chrome.storage.local abstraction
│   │   └── messages.ts        # Typed message passing helpers
│   │
│   └── icons/                 # Extension icon assets (16x16, 48x48, 128x128)
│
├── tests/
│   ├── selector.test.ts       # Selector generation & stability tests
│   ├── fingerprint.test.ts    # Web Crypto hashing & normalization tests
│   ├── storage.test.ts        # Storage CRUD & scoping unit tests
│   ├── masking.test.ts        # Visual masking & idempotency tests
│   └── test-page.html         # Interactive test bench
│
└── dist/                      # Production-ready extension bundle
```

---

## 🚀 Installation & Building

### 1. Prerequisites
- Node.js (v18 or higher recommended)
- Google Chrome or any Chromium-based browser (Brave, Edge, Opera)

### 2. Install Dependencies
```bash
npm install
```

### 3. Build the Extension
```bash
npm run build
```
This compiles TypeScript files and bundles all assets into the `dist/` folder.

To run in watch mode during development:
```bash
npm run dev
```

### 4. Load into Chrome
1. Open Google Chrome and navigate to `chrome://extensions`.
2. Toggle **Developer mode** in the top right corner.
3. Click the **Load unpacked** button.
4. Select the `dist/` directory inside this project folder.
5. The **Privacy Mask** icon will appear in your Chrome toolbar!

---

## 📖 How to Use

1. Navigate to any webpage (or open `tests/test-page.html` in your browser).
2. Click the **Privacy Mask** icon in the Chrome toolbar.
3. Click the **Start Masking** button.
4. Move your mouse over any element (e.g., salary, balance, email) or highlight a text snippet. The target is highlighted with an active red outline.
5. Click the element. The content is immediately replaced with `****` (or your chosen mask text).
6. The masking rule is stored locally in `chrome.storage.local`.
7. Reload the page or navigate away and return—the mask is automatically applied!
8. Need to peek at the value? Click the 👁️ icon on the masked element to reveal it for 5 seconds.
9. Click **Manage Masks** or **Settings** in the popup to view, configure, export, or delete rules.

---

## 🧪 Testing

Run the full automated unit test suite:
```bash
npm test
```

Run TypeScript strict type checking:
```bash
npm run typecheck
```

### Manual Interactive Testing
Open `tests/test-page.html` in Google Chrome after loading the extension. You can test:
- Static compensation cards
- PII fields (email, phone, address, employee IDs)
- Live 3-second dynamic DOM mutations (verifies MutationObserver re-masks updated content)
- Temporary reveal countdown timers

---

## 🔒 Security & Privacy Commitments

- **No Remote Network Requests**: Does not communicate with any external server or API.
- **No Analytics / Telemetry**: No tracking scripts, metrics, or third-party SDKs.
- **Offline First**: Operates 100% locally using standard browser APIs.
- **No Plaintext Sensitive Data Storage**: Web Crypto SHA-256 fingerprints are used for structural fallbacks.
- **CSP & MV3 Compliant**: Uses standard Manifest V3 service workers, isolated content scripts, and strictly avoids `eval()` or inline scripts.

---

## 📄 License
MIT License
