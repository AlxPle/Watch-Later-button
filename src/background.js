const extAPI = globalThis.browser ?? globalThis.chrome;

extAPI.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === "install") {
    extAPI.tabs.create({ url: extAPI.runtime.getURL("pages/welcome.html") });
  } else if (reason === "update") {
    try {
      const keys = ["showUpdateNotification", "showUpdateNotificationUpdatedAt"];
      let localData = {};
      let syncData = {};
      try {
        localData = await extAPI.storage.local.get(keys);
      } catch {}
      try {
        syncData = await extAPI.storage.sync.get(keys);
      } catch {}
      const localTime = localData.showUpdateNotificationUpdatedAt || 0;
      const syncTime = syncData.showUpdateNotificationUpdatedAt || 0;
      const enabled = localData.showUpdateNotification !== undefined &&
        (syncData.showUpdateNotification === undefined || localTime >= syncTime)
        ? localData.showUpdateNotification : syncData.showUpdateNotification;
      if (enabled !== false) {
        extAPI.tabs.create({ url: extAPI.runtime.getURL("pages/update.html") });
      }
    } catch {
      extAPI.tabs.create({ url: extAPI.runtime.getURL("pages/update.html") });
    }
  }
});
