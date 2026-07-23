chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("pages/welcome.html") });
  } else if (details.reason === "update") {
    chrome.tabs.create({ url: chrome.runtime.getURL("pages/update.html") });
  }
});