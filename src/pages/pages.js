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
    const loadTheme = async () => {
      try {
        const localData = await extApi?.storage?.local?.get("buttonColor");
        if (localData?.buttonColor) applyButtonTheme(localData.buttonColor);
      } catch {}

      try {
        const syncData = await extApi?.storage?.sync?.get("buttonColor");
        if (syncData?.buttonColor) applyButtonTheme(syncData.buttonColor);
      } catch {}
    };

    await loadTheme();

    extApi?.storage?.onChanged?.addListener((changes, area) => {
      if ((area === "sync" || area === "local") && changes.buttonColor?.newValue) {
        applyButtonTheme(changes.buttonColor.newValue);
      }
    });
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