/* pages.js */
const extApi = typeof browser !== "undefined" ? browser : chrome;

const initPages = async () => {
  const uiLang = extApi?.i18n?.getUILanguage?.();
  if (uiLang) {
    document.documentElement.lang = uiLang;
  }

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    const message = extApi?.i18n?.getMessage?.(key);
    if (message) {
      // Гарантируем пробел перед "v1.x.x" в update.html, если переводчик его опустил
      el.textContent = key === "updateVersionMessage" && !/\s$/.test(message)
        ? `${message} `
        : message;
    }
  });

  const version = extApi?.runtime?.getManifest?.()?.version;
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
    const keys = ["buttonColor", "buttonColorUpdatedAt"];
    const storageData = { local: {}, sync: {} };
    let ready = false;
    const applyCurrentTheme = () => {
      const { local, sync } = storageData;
      const localTime = local.buttonColorUpdatedAt || 0;
      const syncTime = sync.buttonColorUpdatedAt || 0;
      const color = local.buttonColor !== undefined && (sync.buttonColor === undefined || localTime >= syncTime)
        ? local.buttonColor : sync.buttonColor;
      applyButtonTheme(color);
    };

    extApi.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync" && area !== "local") return;
      let changed = false;
      for (const key of keys) {
        if (!(key in changes)) continue;
        storageData[area][key] = changes[key].newValue;
        changed = true;
      }
      if (ready && changed) applyCurrentTheme();
    });

    for (const area of ["local", "sync"]) {
      try {
        const data = await extApi.storage[area].get(keys);
        storageData[area] = { ...data, ...storageData[area] };
      } catch {}
    }
    ready = true;
    applyCurrentTheme();
  } catch {}

  const demoBtn = document.getElementById("demo-btn");
  if (demoBtn) {
    const defaultTitle = extApi?.i18n?.getMessage?.("wlButtonDefaultTitle") || "Watch Later";
    const deleteTitle = extApi?.i18n?.getMessage?.("wlButtonDeleteTitle") || "Delete from Watch Later";

    const setDemoState = (isAdded) => {
      demoBtn.classList.toggle("is-added", isAdded);
      demoBtn.classList.toggle("is-undo-active", isAdded);
      const label = isAdded ? deleteTitle : defaultTitle;
      demoBtn.title = label;
      demoBtn.setAttribute("aria-label", label);
    };

    setDemoState(false);

    let undoTimer = null;
    demoBtn.addEventListener("click", () => {
      clearTimeout(undoTimer);
      if (demoBtn.matches(".is-added, .is-undo-active")) {
        setDemoState(false);
      } else {
        setDemoState(true);
        undoTimer = setTimeout(() => setDemoState(false), 10000);
      }
    });
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPages);
} else {
  initPages();
}