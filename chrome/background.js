chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install" || reason === "update") {
    chrome.tabs.create({ url: chrome.runtime.getURL(`pages/${reason === "install" ? "welcome" : "update"}.html`) });
  }
});