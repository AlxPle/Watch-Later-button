# Development Setup

This repository contains two main parts:

1. **Watch Later Button Extension (v1.6.5 unified architecture)**
   - `src/` — unified single source codebase for both Chrome and Firefox.
   - `dist/` — generated unpacked extensions (`dist/chrome`, `dist/firefox`) and release `.zip` archives.
   - `scripts/` — zero-dependency build and debug tooling (`build.mjs`, `start-chrome-debug.ps1`, `start-chrome-debug.sh`).
   - `tests/` — Puppeteer & Jest test suites (locale validations for all 26 languages and YouTube E2E flows).

2. **Official Website & Docs**
   - `docs/` — Jekyll-based website (`watchlater.alxple.com`) deployed via GitHub Actions.

---

## Prerequisites

| Tool | Required For | Recommended Version |
| :--- | :--- | :--- |
| **Node.js** | Extension builds & testing | Node.js 18+ or 20+ LTS (tested on Node 22/26) |
| **npm** | Package management | npm 9+ |
| **Google Chrome** | Local testing & debugging | Latest stable |
| **Ruby & Bundler** | Full website builds, serving & regression checks; not needed for extension builds or standalone demo tests | Ruby 3.2 (matches deployment), Bundler 2.x |
| **Git** | Source control | Any recent version |

---

## 1. Extension Quick Start

### Build the extension

The extension builder is written in pure Node.js and requires **no external npm packages**:

```bash
# Full build: generates dist/chrome, dist/firefox, and release .zip archives
npm run build

# Fast build (skips .zip creation, ideal for rapid local development)
npm run build:fast
```

The build script automatically:
1. Validates JSON syntax across `src/manifest.base.json` and all 26 locale files in `src/_locales/*/messages.json`.
2. Generates target-specific manifests:
   - `dist/chrome/manifest.json` (with `service_worker: "background.js"`).
   - `dist/firefox/manifest.json` (with `gecko.id`, permissions, and `scripts: ["background.js"]`).
3. Replaces store placeholders (`{{STORE_URL}}`, `{{REVIEWS_URL}}`, `{{SUPPORT_URL}}`) with platform-specific links.
4. Performs Post-Build Lint: verifies no `chromewebstore.google.com` links leak into the Firefox build and no unresolved `{{...}}` tokens remain.
5. Packs production-ready zip files (`dist/watch-later-chrome-v*.zip` and `dist/watch-later-firefox-v*.zip`).

---

## 2. Load the Extension in Your Browser

### In Google Chrome / Brave / Edge / Chromium:

1. Run `npm run build` or `npm run build:fast`.
2. Open `chrome://extensions` in your browser.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the `dist/chrome` folder.
5. Whenever you make changes to `src/`, run `npm run build:fast` and click the reload icon on the extension card.

### In Mozilla Firefox:

1. Run `npm run build` or `npm run build:fast`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on...**.
4. Select `dist/firefox/manifest.json` (or any file inside `dist/firefox`).
5. After updating `src/` and running `npm run build:fast`, click **Reload** under the temporary add-on.

---

## 3. Chrome Remote Debugging

Remote debugging allows VS Code or automated scripts to attach to Chrome and inspect extension views.

### On Windows (PowerShell):

```powershell
# Starts Chrome with an isolated debug profile on port 9222 and auto-loads dist/chrome
npm run chrome:debug
```

*Or enable debugging directly inside your running Chrome:*
1. Navigate to `chrome://inspect/#remote-debugging`.
2. Turn on **Allow remote debugging for this browser instance**.

### On Linux / macOS (Bash):

```bash
# Uses mirror profile (preserves settings/extensions)
npm run chrome:debug:main

# Uses isolated clean profile
npm run chrome:debug:isolated
```

### Verify Debug Endpoint:

```bash
npm run chrome:debug:check
# Returns JSON version info when port 9222 is active
```

### VS Code Attachment:

This repository includes [./.vscode/launch.json](./.vscode/launch.json). Once Chrome is running on port `9222`, press **F5** in VS Code (or select **Attach: Chrome on :9222** in Run & Debug) to inspect content scripts and service workers.

---

## 4. Running Tests

Install test dependencies once:

```bash
cd tests
npm install
cd ..
```

### Run Locale & Layout Validation (Fast & Offline)

Validates all 26 languages for `popup.html`, `welcome.html`, and `update.html`, ensuring all translations exist, the popup does not exceed `350px` width, and text is not clipped inside controls (undo timer segments, settings labels and sublabels):

```bash
npm test
# or:
npm run test:locales
```

You can also run the locale check against the Firefox build:

```bash
node tests/check-locales-puppeteer.js dist/firefox
```

### Run Live YouTube E2E Tests

Executes end-to-end integration tests using Puppeteer on YouTube video pages, Shorts, search feeds, and video cards:

```bash
npm run test:e2e
```

### Extension CI Check

Builds both extension targets and runs content-script tests plus locale validation:

```bash
npm run ci
```

This does not build or test the website. Run the demo and full-site checks in section 5 when changing popup sources or website code.

---

## 5. Website & Docs Development (`watchlater.alxple.com`)

The website in `docs/` uses Jekyll and Tailwind. Its interactive settings demo reuses the real extension popup, so changes to `src/popup/` also require demo and website checks.

### System dependencies for Jekyll

- **Ubuntu / Debian:** `sudo apt-get install ruby-full build-essential zlib1g-dev`
- **Fedora / RHEL:** `sudo dnf install ruby-devel gcc gcc-c++ make openssl-devel`
- **macOS:** `brew install ruby`
- **Windows:** Install [Ruby+Devkit](https://rubyinstaller.org/) and enable its PATH option, or use the RubyInstaller terminal.

Verify these commands in the same terminal used to run npm:

```bash
ruby --version
bundle --version
```

If Bundler is missing, run `gem install bundler`. If Ruby is not on PATH, fix the terminal environment before attempting a full site build; successful Node-only checks do not validate Jekyll.

### Install dependencies

From the repository root:

```bash
npm --prefix docs ci
npm --prefix tests ci
cd docs
bundle install
cd ..
```

### Build and serve the site

From the repository root:

```bash
npm --prefix docs run build
npm --prefix docs run serve:dev
# Site will be available at http://127.0.0.1:4000
```

`build` regenerates assets before building Jekyll; `serve:dev` regenerates assets before starting Jekyll with local configuration. Re-run `serve:dev` after changing popup sources, locales, manifest metadata, or demo adapter scripts. Do not use bare `bundle exec jekyll serve` as the normal workflow: it skips asset generation and can serve stale or missing demo files.

### Shared popup demo: source and isolation

- Edit the UI only in `src/popup/popup.html`, `popup.css`, and `popup.js`; there is no separate website copy to maintain.
- `docs/scripts/build-popup-demo.mjs` runs during `build:assets`, copies local popup dependencies, takes the version from `src/manifest.base.json`, translations from `src/_locales/`, and links from the site configuration. Missing resources, unconfigured links, and unresolved templates fail the build.
- `docs/scripts/popup-demo-adapter.js` loads before the original popup script and implements only the popup's i18n, manifest, and asynchronous storage APIs. Local and sync storage are separate, memory-only stores, reset on reload; they do not access installed extensions, YouTube accounts, or real browser sync. YouTube interaction scripts are not copied.
- `docs/scripts/popup-demo-host.js` connects the iframe to the external demo button through messages validated by sender, origin, type, and values. The iframe starts in settings, resizes automatically, supports Back navigation, and inherits the site theme through `color-scheme`.
- Color, opacity, shortcut, undo duration, and the video-player toggle affect the demo button. Shorts, video-card, and update-notification toggles are preview controls only.
- `docs/assets/popup-demo/` is generated and Git-ignored. Never edit or commit its contents; regenerate them from source.

### Standalone demo checks (no Ruby required)

After installing the npm dependencies above, run from the repository root:

```bash
npm run test:demo
```

This rebuilds website assets, checks generation against changed popup text/styles and invalid dependencies, and starts a temporary HTTP fixture for Chrome browser tests. It checks widths of 1440, 390, and 320 pixels in both themes, iframe sizing, focus, clipboard copying, shortcuts, undo timers, message validation, and storage reset/isolation. Screenshots are saved to the temporary directory printed by the test.

For Firefox, regenerate assets first and supply the installed browser path (Git Bash example on Windows):

```bash
npm --prefix docs run build:assets
TEST_BROWSER=firefox TEST_BROWSER_PATH="C:/Program Files/Mozilla Firefox/firefox.exe" node tests/check-popup-demo.cjs
```

In PowerShell, set `$env:TEST_BROWSER` and `$env:TEST_BROWSER_PATH` before running the same Node command. Adjust the executable path for your system.

### Full website regression checks

Keep `npm --prefix docs run serve:dev` running, then use a second terminal at the repository root:

```bash
npm run test:docs
# Optional screenshots:
node tests/check-docs-puppeteer.cjs --screenshots
```

The full-site suite checks the integrated demo, navigation, release pages, legal pages, keyboard access, and mobile overflow. Set `DOCS_URL` if the server uses another address; `TEST_BROWSER` and `TEST_BROWSER_PATH` also select Firefox for this suite. Standalone demo checks do not replace a fresh Jekyll build and this full-site test.

### Updating Chrome Web Store rating schema:

```bash
cd docs
# Check current store rating
npm run rating:check

# Update rating in docs/_data/store_rating.json
npm run rating:update

# Build site with updated SEO ratings
npm run build:seo
```

### Deployment:

The Jekyll site is deployed via [.github/workflows/deploy-docs.yml](.github/workflows/deploy-docs.yml) on pushes to `master`/`main` that change `docs/**` or the workflow itself; it can also be started manually with `workflow_dispatch`.

Changes only to `src/popup/`, its assets, locales, or manifest do **not** currently trigger website deployment, even though the demo depends on them. Regenerate and verify the demo after those changes; publishing requires a manual workflow run or an eligible docs change after the sources are pushed. Expanding deployment triggers requires a separate agreed workflow change.

Required GitHub Repository Secrets:
- `DEPLOY_HOST` — server hostname
- `DEPLOY_USER` — SSH user
- `DEPLOY_SSH_KEY` — private SSH key
- `DEPLOY_PATH` — web root directory on server
- `DEPLOY_PORT` — SSH port (default: `22`)

---

## 6. Project Structure

```text
Watch-Later-button/
├── .agents/                    # Specialized AI agent skills & rules
├── .github/
│   ├── FUNDING.yml             # GitHub Sponsors / Buy Me a Coffee config
│   └── workflows/
│       └── deploy-docs.yml     # Automated Jekyll site deployment
├── banner/                     # Web Store promotional images & assets
├── docs/                       # Official Jekyll website (watchlater.alxple.com)
│   ├── _data/store_rating.json # CWS cached rating data
│   ├── _posts/                 # Release notes & articles
│   ├── assets/popup-demo/      # Generated shared popup demo (.gitignore)
│   ├── scripts/
│   │   ├── build-popup-demo.mjs # Validated popup resource generation
│   │   ├── popup-demo-adapter.js # Memory-only extension API adapter
│   │   └── popup-demo-host.js  # Validated iframe messages & external demo button
│   ├── Gemfile                 # Ruby gem dependencies
│   └── package.json            # Site/assets builds, local serving & rating automation
├── scripts/
│   ├── build.mjs               # Zero-dependency multi-target builder (Chrome + Firefox)
│   ├── devtools-relay.mjs      # Local DevTools capture relay
│   ├── start-chrome-debug.ps1  # Windows Chrome debug profile launcher
│   └── start-chrome-debug.sh   # Linux Chrome debug profile launcher
├── src/                        # UNIFIED EXTENSION SOURCE CODE
│   ├── _locales/               # 26 localized messages.json directories
│   ├── assets/
│   │   ├── app-icons/red/      # Extension icons (16, 32, 48, 120, 128)
│   │   ├── fonts/              # WOFF2 font subsets (Inter & Manrope)
│   │   └── styles/style.css    # YouTube injected styles (.saveToWatchLater, .wl-mount-relative)
│   ├── js/
│   │   └── saveto.js           # Content script (Watch page, Shorts, dynamic video cards)
│   ├── pages/
│   │   ├── pages.css           # Styling for welcome & update pages
│   │   ├── pages.js            # Localization & interactive preview demo logic
│   │   ├── update.html         # Post-update announcement page
│   │   └── welcome.html        # First-time installation onboarding page
│   ├── popup/
│   │   ├── popup.css           # Extension popup styling (dark/light mode, mobile width)
│   │   ├── popup.html          # Extension popup markup (templated store links)
│   │   └── popup.js            # Popup logic, color pickers, settings sync
│   ├── background.js           # Cross-browser Service Worker / Background script
│   └── manifest.base.json      # Base MV3 manifest without browser-specific fields
├── dist/                       # GENERATED BUILD ARTIFACTS (.gitignore)
│   ├── chrome/                 # Unpacked Chrome / Edge extension
│   ├── firefox/                # Unpacked Firefox extension
│   ├── watch-later-chrome-v*.zip
│   └── watch-later-firefox-v*.zip
├── tests/                      # AUTOMATED TEST SUITE
│   ├── check-locales-puppeteer.js # 26-language verification, 350px width & inner clipping
│   ├── build-popup-demo.test.cjs # Demo source updates & invalid dependency checks
│   ├── check-popup-demo.cjs    # Standalone Chrome/Firefox popup integration fixture
│   ├── check-docs-puppeteer.cjs # Full Jekyll site browser regressions
│   ├── e2e.test.js             # Live YouTube integration tests (Watch, Shorts, Cards)
│   └── package.json            # Jest and Puppeteer dependencies
├── .gitignore                  # Git ignore rules (includes dist/ and *.zip)
├── package.json                # Root automation commands
├── ROADMAP_V1_6_5.md           # v1.6.5 release roadmap & unified architecture spec
├── POPUP_REDESIGN_V1_6_5.md    # Popup redesign spec (350px, preset colors, screen slider)
├── README.md                   # Public extension documentation
└── SETUP.md                    # This development guide
```
