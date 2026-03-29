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