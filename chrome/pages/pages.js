document.addEventListener("DOMContentLoaded", () => {
  const hasExtensionApi = typeof chrome !== "undefined" && chrome.i18n && chrome.runtime;

  // Translate elements with data-i18n attribute
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (hasExtensionApi) {
      const message = chrome.i18n.getMessage(key);
      if (message) {
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
          el.placeholder = message;
        } else {
          el.textContent = message;
        }
      }
    }
  });

  // Inject version if elements exist
  const versionElements = document.querySelectorAll(".version-num, #version-num");
  if (versionElements.length > 0) {
    let version = "1.5.5";
    if (hasExtensionApi) {
      try {
        const manifest = chrome.runtime.getManifest();
        version = manifest.version;
      } catch (e) { }
    }
    versionElements.forEach((el) => {
      el.textContent = version;
    });
  }
});
