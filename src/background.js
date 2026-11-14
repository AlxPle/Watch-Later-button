const extAPI = globalThis.browser ?? globalThis.chrome;

extAPI.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === "install") {
    extAPI.tabs.create({ url: extAPI.runtime.getURL("pages/welcome.html") });
  } else if (reason === "update") {
    try {
      const syncData = await extAPI.storage.sync.get("showUpdateNotification");
      let enabled = syncData?.showUpdateNotification;
      if (enabled === undefined) {
        const localData = await extAPI.storage.local.get("showUpdateNotification");
        enabled = localData?.showUpdateNotification;
      }
      if (enabled !== false) {
        extAPI.tabs.create({ url: extAPI.runtime.getURL("pages/update.html") });
      }
    } catch {
      extAPI.tabs.create({ url: extAPI.runtime.getURL("pages/update.html") });
    }
  }
});
