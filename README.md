# Watch Later Button

Save YouTube videos to Watch Later in one click. Clean, minimal, privacy-first extension for Chrome, Firefox, and Edge. Zero data collection.

## Download & Install

<div align="center">

<a href="https://chromewebstore.google.com/detail/watch-later-button/igehcnnhegiagilpnablldbbcnjabkab">
  <img src="/banner/get_for_chrome.svg" alt="Chrome Web Store" width="220" height="60">
</a>
<a href="https://addons.mozilla.org/en-US/firefox/addon/watchlaterbutton/">
  <img src="/banner/get_for_firefox.svg" alt="Firefox Add-ons" width="220" height="60">
</a>
<a href="https://microsoftedge.microsoft.com/addons/detail/poopocdoinnkiddflgklibkgmmlidfpa">
  <img src="/banner/get_for_edge.svg" alt="Microsoft Edge Add-ons" width="220" height="60">
</a>

</div>

## Key Features

- 🎯 **One-click save** - Add videos to Watch Later instantly without opening extra menus.
- 🎬 **Everywhere on YouTube** - Works seamlessly on regular video pages (`/watch`), YouTube Shorts (`/shorts`), and video card thumbnails across Home and Search feeds.
- ⏱️ **Instant undo** - 10-second countdown timer after every save so you can undo accidental clicks.
- ⌨️ **Custom keyboard shortcut** - Save or undo videos from anywhere on YouTube using a customizable hotkey (default: `Alt + W`).
- 🎨 **Appearance controls** - Customize button color, hover tone, and opacity directly in the extension popup.
- 🌍 **26 languages** - Complete native localization for 26 languages worldwide.
- 🔒 **Privacy-first** - Zero analytics, zero tracking, no remote scripts, and no user data collection.

## How to Use

1. **Watch Page:** Click the dedicated red button below any video player to save it immediately.
2. **Shorts:** Click the button in the action panel next to any Short.
3. **Feeds & Search:** Hover over any video thumbnail on the home feed or search results and click the button in the corner.
4. **Keyboard:** Press `Alt + W` (or your custom shortcut) while watching a video or hovering over a card.

## Development & Build

This project uses a unified codebase in `src/` with a zero-dependency build script in pure Node.js:

```bash
# Build unpacked extensions for Chrome and Firefox + release .zip packages
npm run build

# Fast build without creating zip archives (for rapid dev iterations)
npm run build:fast

# Run offline locale and popup layout tests across all 26 languages
npm test

# Launch an isolated Chrome debug profile on port 9222
npm run chrome:debug
```

For full environment setup, testing details, and debugging instructions, see [SETUP.md](SETUP.md).

## Feedback & Support

- [📖 Official Website & Blog](https://watchlater.alxple.com/) - Documentation and release notes
- [🐛 Report an Issue](https://github.com/alxple/Watch-Later-button/issues) - GitHub Issues
- [⭐ Chrome Reviews](https://chromewebstore.google.com/detail/watch-later-button/igehcnnhegiagilpnablldbbcnjabkab/reviews) - Rate on Chrome Web Store
- [⭐ Firefox Reviews](https://addons.mozilla.org/en-US/firefox/addon/watchlaterbutton/reviews/) - Rate on Mozilla Add-ons
- [☕ Buy Me a Coffee](https://www.buymeacoffee.com/pletnovalex) - Support project development

## Privacy & Security

This extension does **not**:
- Collect personal data
- Track user activity or browsing history
- Communicate with external analytics or tracking servers
- Request unnecessary host or identity permissions

All actions execute locally in your browser.

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

Made with ❤️ for YouTube lovers everywhere.
