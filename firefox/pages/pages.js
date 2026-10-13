document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const message = chrome.i18n?.getMessage(el.dataset.i18n);
    if (message) el.textContent = message;
  });

  const version = chrome.runtime?.getManifest?.()?.version;
  if (version) {
    document.querySelectorAll(".version-num").forEach((el) => {
      el.textContent = version;
    });
  }

  function applyButtonTheme(colorData) {
    if (!colorData) return;
    const root = document.documentElement;
    if (colorData.rgba) root.style.setProperty("--wl-color-default", colorData.rgba);
    if (colorData.hoverRgba) root.style.setProperty("--wl-color-default-hover", colorData.hoverRgba);
  }

  try {
    const storageApi = (typeof browser !== "undefined" ? browser.storage : chrome?.storage) || chrome?.storage;
    storageApi?.sync?.get("buttonColor", (data) => {
      if (data?.buttonColor) {
        applyButtonTheme(data.buttonColor);
      } else {
        storageApi?.local?.get("buttonColor", (localData) => {
          if (localData?.buttonColor) applyButtonTheme(localData.buttonColor);
        });
      }
    });

    storageApi?.onChanged?.addListener((changes, area) => {
      if ((area === "sync" || area === "local") && changes.buttonColor?.newValue) {
        applyButtonTheme(changes.buttonColor.newValue);
      }
    });
  } catch (e) {
    // ignore
  }

  const demoBtn = document.getElementById("demo-btn");
  if (demoBtn) {
    let undoTimer = null;
    demoBtn.addEventListener("click", () => {
      if (demoBtn.matches(".is-added, .is-undo-active")) {
        clearTimeout(undoTimer);
        demoBtn.classList.remove("is-added", "is-undo-active");
      } else {
        demoBtn.classList.add("is-added", "is-undo-active");
        clearTimeout(undoTimer);
        undoTimer = setTimeout(() => demoBtn.classList.remove("is-undo-active"), 10000);
      }
    });
  }
});

