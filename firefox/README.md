# Watch Later Button - Firefox Edition

This is the Firefox version of the Watch Later Button extension for YouTube.

## Structure

```
firefox/
├── manifest.json          # Extension manifest (Manifest V3)
├── background.js          # Service worker
├── popup/                 # Extension popup
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── js/                    # Content scripts
│   └── saveto.js
├── assets/                # Static assets
│   ├── styles/
│   │   └── style.css
│   ├── app-icons/         # Extension icons
│   └── fonts/             # Web fonts
└── _locales/              # Translation files (26 languages)
```

## Key Differences from Chrome Version

1. **Manifest Background**: Uses `"scripts"` instead of `"service_worker"` for better Firefox compatibility
2. **Icon Sizes**: Icon at 96px for Firefox (instead of 128px for Chrome)
3. **Links**: Updated links to point to official Firefox Add-ons addon page: https://addons.mozilla.org/en-US/firefox/addon/watch-later-button/

## Installation

1. Open `about:debugging#/runtime/this-firefox` in Firefox
2. Click "Load Temporary Add-on"
3. Select the `manifest.json` file from this folder
4. The extension will be loaded in Firefox

## For Official Release

To publish on Mozilla Add-ons:
1. Create a developer account at https://addons.mozilla.org/
2. Sign in and submit the extension for review
3. Ensure all manifest requirements are met

## Supported Languages

The extension includes translations for 26 languages:
- English (en, en_GB)
- Spanish (es), French (fr), German (de), Italian (it), Portuguese (pt_BR, pt_PT)
- Russian (ru), Polish (pl), Romanian (ro), Czech (cs)
- Dutch (nl), Norwegian (no), Swedish (sv)
- Japanese (ja), Korean (ko), Chinese (zh_CN, zh_TW)
- Arabic (ar), Farsi (fa), Hindi (hi), Indonesian (id), Turkish (tr), Ukrainian (uk), Greek (el)

## Features

- Quick "Watch Later" button on YouTube watch pages
- Quick "Watch Later" buttons on video cards (homepage, search results, shorts)
- Undo functionality with countdown timer
- Keyboard accessible (ARIA labels)
- Multi-language support
