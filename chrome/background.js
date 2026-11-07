chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("pages/welcome.html") });
  } else if (reason === "update") {
    try {
      const syncData = await chrome.storage.sync.get("showUpdateNotification");
      let enabled = syncData?.showUpdateNotification;
      if (enabled === undefined) {
        const localData = await chrome.storage.local.get("showUpdateNotification");
        enabled = localData?.showUpdateNotification;
      }
      if (enabled !== false) {
        chrome.tabs.create({ url: chrome.runtime.getURL("pages/update.html") });
      }
    } catch {
      chrome.tabs.create({ url: chrome.runtime.getURL("pages/update.html") });
    }
  }
});
