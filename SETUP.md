# Development Setup

This repository contains:

- `chrome/` — the Chrome extension source code
- `docs/` — the Jekyll website used for GitHub Pages
- `tests/` — the JavaScript test tooling and E2E tests

## Requirements

Make sure the following tools are installed:

- Ruby
- Bundler
- Node.js and npm
- Git

## Install system dependencies

### Fedora / CentOS / RHEL

```bash
sudo dnf install ruby-devel gcc gcc-c++ make openssl-devel
```

## Install Bundler and Jekyll

If Bundler or Jekyll are not installed yet, run:

```bash
gem install bundler jekyll
```

## Install project dependencies

The website and test tooling are configured separately:

- Run Jekyll commands from `docs/`
- Run JavaScript test commands from `tests/`

The docs site also includes Node-based automation scripts for SEO/schema tasks
(for example, refreshing `aggregateRating` data before build).

### Install Ruby gems

```bash
cd docs
bundle install
```

This installs the Jekyll dependencies defined in `docs/Gemfile`, including:

- `jekyll`
- `minima`
- `jekyll-seo-tag`
- `jekyll-sitemap`

### Install Node.js dependencies

```bash
cd tests
npm install
```

This installs the JavaScript development dependencies defined in `tests/package.json`.

### Docs automation scripts (optional)

From `docs/`:

```bash
cd docs
npm install
```

This initializes npm scripts in `docs/package.json` used for SEO automation.
No external npm dependencies are required right now, but this keeps setup
consistent for future script updates.

## Run the site locally

From the `docs/` directory:

```bash
bundle exec jekyll serve
```

Or use the dev config + rating refresh in one command:

```bash
cd docs
npm run serve:dev
```

## Run tests

From the `tests/` directory:

```bash
npm test
```

## Chrome + VS Code attach debugging (Linux)

Use this workflow when you need Chrome with your existing extensions and want to inspect or forward element data into VS Code.

### 1) Start Chrome with remote debugging

Main profile mirror (recommended, keeps your installed extensions):

```bash
npm run chrome:debug:main
```

Why mirror is needed: Chrome blocks DevTools remote debugging on its default profile directory.
This command clones `~/.config/google-chrome` into a dedicated debug folder and starts Chrome from that mirror.

Important: close all regular Chrome windows first, otherwise profile sync may be incomplete.

Fallback profile (clean isolated profile):

```bash
npm run chrome:debug:isolated
```

### 2) Verify DevTools endpoint

```bash
npm run chrome:debug:check
```

If the command returns JSON, VS Code can attach to Chrome on port `9222`.

### 3) Attach from VS Code

This repository includes [./.vscode/launch.json](./.vscode/launch.json) with configuration:

- `Attach: Chrome on :9222`

Run this launch config from VS Code Run and Debug panel.

### 4) Start local relay for captured DevTools data

```bash
npm run devtools:relay
```

Captured payloads are appended to `.devtools-relay/captures.ndjson`.

### 5) Send selected element info from Chrome DevTools Console

Select an element in Elements panel (`$0` should point to it), then run:

```js
fetch("http://127.0.0.1:3030/capture", {
	method: "POST",
	headers: { "content-type": "application/json" },
	body: JSON.stringify({
		page: location.href,
		ts: new Date().toISOString(),
		element: {
			html: $0?.outerHTML ?? null,
			rect: $0?.getBoundingClientRect?.() ?? null,
			computed: $0 ? {
				position: getComputedStyle($0).position,
				top: getComputedStyle($0).top,
				right: getComputedStyle($0).right,
				bottom: getComputedStyle($0).bottom,
				left: getComputedStyle($0).left,
				zIndex: getComputedStyle($0).zIndex,
				width: getComputedStyle($0).width,
				height: getComputedStyle($0).height
			} : null
		}
	})
});
```

You can now inspect the incoming data in `.devtools-relay/captures.ndjson` directly from VS Code.

## Useful commands

```bash
# Check installed versions
ruby --version
bundle --version
node --version
npm --version

# Build the site
cd docs
bundle exec jekyll build

# Refresh Chrome Web Store rating data (dry-run)
cd docs
npm run rating:check

# Refresh rating data and save to docs/_data/store_rating.json
cd docs
npm run rating:update

# Full production SEO build (rating update + Jekyll build)
cd docs
npm run build:seo

# Clean generated files
cd docs
bundle exec jekyll clean

# Install test dependencies
cd ../tests
npm install

# Run E2E tests
npm test
```

## Automatic deploy on commit (recommended)

This repository includes a GitHub Actions workflow at `.github/workflows/deploy-docs.yml`.
It automatically builds the Jekyll site from `docs/` and uploads `docs/_site/` to your server
on every push to `main` (and can also be started manually).

Add these repository secrets in GitHub:

- `DEPLOY_HOST` — your server hostname (for example `watchlater.alxple.com`)
- `DEPLOY_USER` — SSH user for deployment
- `DEPLOY_SSH_KEY` — private SSH key used by GitHub Actions
- `DEPLOY_PATH` — target directory on server (for example `/var/www/watchlater.alxple.com`)
- `DEPLOY_PORT` — optional SSH port (defaults to `22`)

After secrets are configured, deployment is fully automatic on commit.

### Manual trigger (GitHub CLI)

You can start the deploy workflow manually using the GitHub CLI. Example:

```bash
# trigger the workflow by its display name on the `master` branch
gh workflow run "Build and Deploy Docs" --ref master

# or trigger by workflow filename
gh workflow run deploy-docs.yml --ref master

# list recent runs for the workflow
gh run list --workflow=deploy-docs.yml

# open a specific run in the browser (use run id from the list)
gh run view <run-id> --web
```

## Manual deploy from server (alternative)

If you prefer manual deployment:

```bash
cd /path/to/repo
git pull
cd docs
bundle install
npm run build
rsync -az --delete _site/ /var/www/watchlater.alxple.com/
```

Manual deploy works, but automation is safer and more repeatable.

## Project structure

- `chrome/` — Chrome extension source
- `docs/` — Jekyll site source
- `docs/_posts/` — blog and update posts
- `docs/_layouts/` — Jekyll layouts
- `docs/_includes/` — shared Jekyll partials
- `docs/_sass/` — SCSS sources
- `docs/assets/` — site assets
- `docs/Gemfile` — Ruby dependencies
- `tests/` — JavaScript test workspace
- `tests/e2e.test.js` — E2E test for the extension
- `tests/package.json` — Node.js dependencies for tests