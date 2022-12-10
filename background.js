// TODO: The window object isn't available inside a ServiceWorker, and thus
// we cannot easily move from Manifest v2 to Manifest v3 yet.
// See https://github.com/w3c/webextensions/issues/229.
// chrome.runtime.onMessage.addListener(function (request) {
//     if (request.scheme == "dark") {
//         chrome.browserAction.setIcon({
//             path: {
//                 "16": "assets/icons/logo/dark-mode/iconmonstr-text-plus-lined-16.png",
//                 "32": "assets/icons/logo/dark-mode/iconmonstr-text-plus-lined-32.png",
//                 "48": "assets/icons/logo/dark-mode/iconmonstr-text-plus-lined-48.png",
//                 "128": "assets/icons/logo/dark-mode/iconmonstr-text-plus-lined-120.png"
//             }
//         });
//     }
        
// });