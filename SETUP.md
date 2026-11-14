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
| **Ruby & Bundler** *(optional)* | Only needed if editing `docs/` | Ruby 3.x, Bundler 2.x |
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

### Full CI Check

Runs the complete build and validation suite:

```bash
npm run ci
```

---

## 5. Website & Docs Development (`watchlater.alxple.com`)

The website in `docs/` is built using Jekyll. You only need this if you are updating documentation or blog posts.

### System dependencies for Jekyll:

- **Ubuntu / Debian:** `sudo apt-get install ruby-full build-essential zlib1g-dev`
- **Fedora / RHEL:** `sudo dnf install ruby-devel gcc gcc-c++ make openssl-devel`
- **macOS:** `brew install ruby`
- **Windows:** Install [Ruby+Devkit](https://rubyinstaller.org/)

### Install gems & dependencies:

```bash
cd docs
gem install bundler jekyll
bundle install
```

### Run the site locally:

```bash
cd docs
bundle exec jekyll serve
# Site will be available at http://127.0.0.1:4000
```

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

The Jekyll site is automatically deployed to `watchlater.alxple.com` on every push to `master`/`main` via [.github/workflows/deploy-docs.yml](.github/workflows/deploy-docs.yml).

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
│   ├── Gemfile                 # Ruby gem dependencies
│   └── package.json            # SEO & rating automation scripts
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
│   ├── e2e.test.js             # Live YouTube integration tests (Watch, Shorts, Cards)
│   └── package.json            # Jest and Puppeteer dependencies
├── .gitignore                  # Git ignore rules (includes dist/ and *.zip)
├── package.json                # Root automation commands
├── ROADMAP_V1_6_5.md           # v1.6.5 release roadmap & unified architecture spec
├── POPUP_REDESIGN_V1_6_5.md    # Popup redesign spec (350px, preset colors, screen slider)
├── README.md                   # Public extension documentation
└── SETUP.md                    # This development guide
```
