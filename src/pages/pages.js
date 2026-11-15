const extApi = globalThis.browser || globalThis.chrome;

const initPages = async () => {
  const uiLang = extApi?.i18n?.getUILanguage?.();
  if (uiLang) {
    document.documentElement.lang = uiLang.replace(/_/g, "-");
  }

  const version = extApi?.runtime?.getManifest?.()?.version;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (key === "updateVersionMessage" && !version) {
      el.hidden = true;
      return;
    }
    const substitutions = key === "updateVersionMessage" ? [`v${version}`] : undefined;
    const message = extApi?.i18n?.getMessage?.(key, substitutions);
    if (message) el.textContent = message;
  });

  document.querySelectorAll(".version-num").forEach((el) => {
    el.textContent = version || "";
  });
  document.querySelectorAll(".version-chip, .version-label").forEach((el) => {
    el.hidden = !version;
  });

  let currentUndoSeconds = 10;
  const demoBtn = document.getElementById("demo-btn");
  if (demoBtn) {
    const defaultTitle = extApi?.i18n?.getMessage?.("wlButtonDefaultTitle") || "Watch Later";
    const deleteTitle = extApi?.i18n?.getMessage?.("wlButtonDeleteTitle") || "Delete from Watch Later";
    const setDemoState = (isAdded, isUndoActive = isAdded) => {
      demoBtn.classList.toggle("is-added", isAdded);
      demoBtn.classList.toggle("is-undo-active", isUndoActive);
      const label = isUndoActive ? deleteTitle : defaultTitle;
      demoBtn.title = label;
      demoBtn.setAttribute("aria-label", label);
    };

    setDemoState(false);
    let undoTimer = null;
    demoBtn.addEventListener("click", () => {
      clearTimeout(undoTimer);
      if (demoBtn.classList.contains("is-undo-active")) {
        setDemoState(false);
        return;
      }
      const isUndoActive = currentUndoSeconds > 0;
      const durationMs = isUndoActive ? currentUndoSeconds * 1000 : 800;
      demoBtn.style.setProperty("--wl-undo-ms", `${durationMs}ms`);
      setDemoState(true, isUndoActive);
      undoTimer = setTimeout(() => setDemoState(false), durationMs);
    });
  }

  if (!extApi?.storage) return;
  const keys = ["buttonColor", "buttonUndoSeconds"];
  const storageKeys = keys.flatMap(key => [key, `${key}UpdatedAt`]);
  const storageData = { local: {}, sync: {} };
  let ready = false;
  const applyCurrentSettings = () => {
    const cfg = {};
    for (const key of keys) {
      const { local, sync } = storageData;
      const localTime = local[`${key}UpdatedAt`] || 0;
      const syncTime = sync[`${key}UpdatedAt`] || 0;
      cfg[key] = local[key] !== undefined && (sync[key] === undefined || localTime >= syncTime)
        ? local[key] : sync[key];
    }
    const root = document.documentElement;
    root.style.setProperty("--wl-color-default", cfg.buttonColor?.rgba || "");
    root.style.setProperty("--wl-color-default-hover", cfg.buttonColor?.hoverRgba || "");
    root.style.setProperty("--wl-icon-color", cfg.buttonColor?.iconColor || "");
    currentUndoSeconds = cfg.buttonUndoSeconds === undefined ? 10 : Number(cfg.buttonUndoSeconds);
  };

  extApi.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" && area !== "local") return;
    let changed = false;
    for (const key of storageKeys) {
      if (!(key in changes)) continue;
      storageData[area][key] = changes[key].newValue;
      changed = true;
    }
    if (ready && changed) applyCurrentSettings();
  });

  for (const area of ["local", "sync"]) {
    try {
      const data = await extApi.storage[area].get(storageKeys);
      storageData[area] = { ...data, ...storageData[area] };
    } catch {}
  }
  ready = true;
  applyCurrentSettings();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPages);
} else {
  initPages();
}
