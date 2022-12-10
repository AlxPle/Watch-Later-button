// TODO: The window object isn't available inside a ServiceWorker, and thus
// we cannot easily move from Manifest v2 to Manifest v3 yet.
// See https://github.com/w3c/webextensions/issues/229.

/* if (window.matchMedia('prefers-color-scheme: dark').matches) {
    chrome.runtime.sendMessage({ scheme: "dark" });
} */

