chrome.runtime.onMessage.addListener(function (request) {
    if (request.scheme == "dark")
        chrome.browserAction.setIcon({
            path: {
                "16": "assets/icons/dark-mode/iconmonstr-text-plus-lined-16.png",
                "32": "assets/icons/dark-mode/iconmonstr-text-plus-lined-32.png",
                "48": "assets/icons/dark-mode/iconmonstr-text-plus-lined-48.png",
                "128": "assets/icons/dark-mode/iconmonstr-text-plus-lined-120.png"
            }
        });
});