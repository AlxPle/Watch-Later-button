# Development Setup

This repository contains:

- `chrome/` — the Chrome extension source code
- `docs/` — the Jekyll website used for GitHub Pages

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

The Jekyll site lives in the `docs/` directory, so all website-related commands should be run from there.

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
cd docs
npm install
```

This installs the JavaScript development dependencies defined in `docs/package.json`.

## Run the site locally

From the `docs/` directory:

```bash
bundle exec jekyll serve
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

# Clean generated files
cd docs
bundle exec jekyll clean
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
- `docs/package.json` — Node.js dependencies