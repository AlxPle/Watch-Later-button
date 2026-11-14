const extApi = typeof browser !== "undefined" ? browser : chrome;

const uiLang = extApi?.i18n?.getUILanguage?.();
if (uiLang) {
  document.documentElement.lang = uiLang;
}

document.querySelectorAll("[data-i18n]").forEach((el) => {
  const msg = extApi?.i18n?.getMessage?.(el.dataset.i18n);
  if (msg) el.textContent = msg;
});

document.querySelectorAll("[data-i18n-title]").forEach((el) => {
  const msg = extApi?.i18n?.getMessage?.(el.dataset.i18nTitle);
  if (msg) el.title = msg;
});

const version = extApi?.runtime?.getManifest?.()?.version;
if (version) {
  document.getElementById("ext-version").textContent = `v${version}`;
}


// Navigation
const mainView = document.getElementById("main-view");
const settingsView = document.getElementById("settings-view");
const mainHeader = document.querySelector(".popup-header");

const openSettings = () => {
  mainHeader.hidden = true;
  mainView.hidden = true;
  settingsView.hidden = false;
};

const closeSettings = () => {
  settingsView.hidden = true;
  mainHeader.hidden = false;
  mainView.hidden = false;
};

document.getElementById("open-settings-row-btn")?.addEventListener("click", openSettings);
document.getElementById("back-to-main-btn")?.addEventListener("click", closeSettings);

// Defaults & Constants
const DEFAULT_COLOR = "#e50914";
const DEFAULT_ALPHA = 100;
const DEFAULT_SHORTCUT = {
  alt: true,
  ctrl: false,
  shift: false,
  meta: false,
  key: "w",
  code: "KeyW",
  display: "Alt + W"
};
const DEFAULT_UNDO_SECONDS = 10;
const DEFAULT_SURFACES = {
  watch: true,
  shorts: true,
  cards: true
};

// Color Settings Elements
const colorPicker = document.getElementById("color-picker");
const colorHex = document.getElementById("color-hex");
const opacitySlider = document.getElementById("opacity-slider");
const opacityVal = document.getElementById("opacity-val");
const rgbaOutput = document.getElementById("rgba-output");
const previewBtn = document.getElementById("btn-preview");
const resetBtn = document.getElementById("reset-color-btn");
const updateNotificationToggle = document.getElementById("update-notification-toggle");

// Surface Toggles Elements
const surfaceWatchToggle = document.getElementById("surface-watch-toggle");
const surfaceShortsToggle = document.getElementById("surface-shorts-toggle");
const surfaceCardsToggle = document.getElementById("surface-cards-toggle");

// Shortcut & Undo Elements
const shortcutBtn = document.getElementById("shortcut-btn");
const shortcutHint = document.getElementById("shortcut-hint");
const undoPills = document.querySelectorAll(".undo-pill");
const customUndoContainer = document.getElementById("custom-undo-container");
const customUndoInput = document.getElementById("custom-undo-input");
const undoActiveBadge = document.getElementById("undo-active-badge");
const undoStepDown = document.getElementById("undo-step-down");
const undoStepUp = document.getElementById("undo-step-up");

let saveTimer = null;
let pendingSyncPayload = null;
let currentShortcut = { ...DEFAULT_SHORTCUT };
let isRecordingShortcut = false;
let currentUndoSeconds = DEFAULT_UNDO_SECONDS;
let currentSurfaces = { ...DEFAULT_SURFACES };

function safeStorageSet(area, data) {
  try {
    const store = extApi?.storage?.[area];
    if (!store) return;
    const res = store.set(data, () => {
      void extApi?.runtime?.lastError;
    });
    if (res && typeof res.catch === "function") {
      res.catch(() => {});
    }
  } catch {}
}

function flushSync() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (pendingSyncPayload) {
    const payload = pendingSyncPayload;
    pendingSyncPayload = null;
    safeStorageSet("sync", { buttonColor: payload });
  }
}

window.addEventListener("pagehide", flushSync);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) flushSync();
});

function hexToRgba(hex, alpha) {
  const clean = hex.replace("#", "").slice(0, 6);
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  const a = +(Math.round(alpha) / 100).toFixed(2);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function hexToHoverRgba(hex, alpha) {
  const clean = hex.replace("#", "").slice(0, 6);
  const r = Math.round((parseInt(clean.slice(0, 2), 16) || 0) * 0.8);
  const g = Math.round((parseInt(clean.slice(2, 4), 16) || 0) * 0.8);
  const b = Math.round((parseInt(clean.slice(4, 6), 16) || 0) * 0.8);
  const a = +(Math.round(alpha) / 100).toFixed(2);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function hexToHex8(hex, alpha) {
  const clean = hex.replace("#", "").slice(0, 6).toUpperCase();
  if (alpha >= 100) return `#${clean}`;
  const aByte = Math.round((Math.max(0, Math.min(100, alpha)) / 100) * 255);
  const aHex = aByte.toString(16).padStart(2, "0").toUpperCase();
  return `#${clean}${aHex}`;
}

function persistUpdateNotification(enabled) {
  safeStorageSet("local", { showUpdateNotification: enabled });
  safeStorageSet("sync", { showUpdateNotification: enabled });
}

function persistColor(payload, immediate = false) {
  safeStorageSet("local", { buttonColor: payload });

  pendingSyncPayload = payload;
  if (saveTimer) clearTimeout(saveTimer);

  if (immediate) {
    flushSync();
  } else {
    saveTimer = setTimeout(flushSync, 500);
  }
}

function persistShortcut(shortcut) {
  safeStorageSet("local", { buttonShortcut: shortcut });
  safeStorageSet("sync", { buttonShortcut: shortcut });
}

function persistUndoSeconds(seconds) {
  safeStorageSet("local", { buttonUndoSeconds: seconds });
  safeStorageSet("sync", { buttonUndoSeconds: seconds });
}

function persistSurfaces(surfaces) {
  safeStorageSet("local", { buttonSurfaces: surfaces });
  safeStorageSet("sync", { buttonSurfaces: surfaces });
}

function applySurfaces(surfaces, save = true) {
  currentSurfaces = {
    watch: surfaces?.watch !== false,
    shorts: surfaces?.shorts !== false,
    cards: surfaces?.cards !== false
  };

  if (surfaceWatchToggle) surfaceWatchToggle.checked = currentSurfaces.watch;
  if (surfaceShortsToggle) surfaceShortsToggle.checked = currentSurfaces.shorts;
  if (surfaceCardsToggle) surfaceCardsToggle.checked = currentSurfaces.cards;

  if (save) persistSurfaces(currentSurfaces);
}

function applyColor(hex, alpha, save = true, immediate = false) {
  const clampedAlpha = Math.max(0, Math.min(100, Math.round(Number(alpha))));
  const cleanHex = hex.startsWith("#") ? hex.slice(0, 7) : `#${hex.slice(0, 6)}`;
  const rgba = hexToRgba(cleanHex, clampedAlpha);
  const hoverRgba = hexToHoverRgba(cleanHex, clampedAlpha);

  colorPicker.value = cleanHex.toLowerCase();
  colorHex.value = hexToHex8(cleanHex, clampedAlpha);
  opacitySlider.value = clampedAlpha;
  opacityVal.textContent = `${clampedAlpha}%`;
  rgbaOutput.value = rgba;

  if (previewBtn) {
    previewBtn.style.setProperty("--wl-color-default", rgba);
    previewBtn.style.setProperty("--wl-color-default-hover", hoverRgba);
  }

  if (save) {
    persistColor({ hex: cleanHex.toLowerCase(), alpha: clampedAlpha, rgba, hoverRgba }, immediate);
  }
}

function applyShortcut(shortcut, save = true) {
  currentShortcut = shortcut || { ...DEFAULT_SHORTCUT };
  if (shortcutBtn) {
    shortcutBtn.textContent = currentShortcut.display || "Alt + W";
    shortcutBtn.classList.remove("is-recording");
  }
  if (shortcutHint) shortcutHint.hidden = true;
  isRecordingShortcut = false;
  if (save) persistShortcut(currentShortcut);
}

function formatKeyDisplay(key, code) {
  if (code && code.startsWith("Key")) return code.replace("Key", "");
  if (code && code.startsWith("Digit")) return code.replace("Digit", "");
  if (key === " ") return "Space";
  if (key.length === 1) return key.toUpperCase();
  return key;
}

function isReservedBrowserShortcut(e) {
  const hasPrimaryModifier = (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey;
  if (!hasPrimaryModifier) return false;
  const blockedCodes = ["KeyW", "KeyR", "KeyT", "KeyN", "KeyQ"];
  return blockedCodes.includes(e.code);
}

function handleKeyRecord(e) {
  e.preventDefault();
  e.stopPropagation();

  if (e.key === "Escape") {
    window.removeEventListener("keydown", handleKeyRecord, true);
    applyShortcut(currentShortcut, false);
    return;
  }

  if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
    return;
  }

  const isMac = typeof navigator !== "undefined" && navigator.platform?.toUpperCase()?.includes("MAC");
  const parts = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push(isMac ? "Option" : "Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push(isMac ? "Cmd" : "Win");

  // Требуем минимум один модификатор и блокируем системные комбинации закрытия/обновления вкладки
  if (parts.length === 0 || isReservedBrowserShortcut(e)) {
    return;
  }

  const keyDisplay = formatKeyDisplay(e.key, e.code);
  parts.push(keyDisplay);

  const shortcutData = {
    alt: Boolean(e.altKey),
    ctrl: Boolean(e.ctrlKey),
    shift: Boolean(e.shiftKey),
    meta: Boolean(e.metaKey),
    key: e.key.toLowerCase(),
    code: e.code || "",
    display: parts.join(" + ")
  };

  window.removeEventListener("keydown", handleKeyRecord, true);
  applyShortcut(shortcutData, true);
}

function applyUndoSeconds(seconds, isCustom = false, save = true) {
  const val = Math.max(0, Math.min(60, Math.round(Number(seconds) || 0)));
  currentUndoSeconds = val;

  let matchedPill = false;
  undoPills.forEach((pill) => {
    const secAttr = pill.dataset.seconds;
    if (!isCustom && secAttr !== "custom" && Number(secAttr) === val) {
      pill.classList.add("active");
      matchedPill = true;
    } else if (secAttr !== "custom") {
      pill.classList.remove("active");
    }
  });

  const customPill = document.querySelector('.undo-pill[data-seconds="custom"]');
  if (isCustom || !matchedPill) {
    customPill?.classList.add("active");
    if (customUndoContainer) customUndoContainer.hidden = false;
    if (customUndoInput && document.activeElement !== customUndoInput) customUndoInput.value = val;
  } else {
    customPill?.classList.remove("active");
    if (customUndoContainer) customUndoContainer.hidden = true;
  }

  if (undoActiveBadge) {
    if (val === 0) {
      undoActiveBadge.textContent = extApi?.i18n?.getMessage?.("undoOff") || "Off";
    } else {
      undoActiveBadge.textContent = `${val}s`;
    }
  }

  if (save) persistUndoSeconds(val);
}

// Интерактивное тестирование кнопки в превью настроек
if (previewBtn) {
  const defaultTitle = extApi?.i18n?.getMessage?.("wlButtonDefaultTitle") || "Watch Later";
  const deleteTitle = extApi?.i18n?.getMessage?.("wlButtonDeleteTitle") || "Delete from Watch Later";
  previewBtn.title = defaultTitle;
  previewBtn.setAttribute("aria-label", defaultTitle);

  let previewTimer = null;

  const resetPreviewState = () => {
    clearTimeout(previewTimer);
    previewBtn.classList.remove("is-added", "is-undo-active");
    previewBtn.title = defaultTitle;
    previewBtn.setAttribute("aria-label", defaultTitle);
  };

  const togglePreview = () => {
    if (previewBtn.classList.contains("is-added")) {
      resetPreviewState();
      return;
    }

    clearTimeout(previewTimer);
    if (currentUndoSeconds <= 0) {
      previewBtn.classList.add("is-added");
      previewTimer = setTimeout(resetPreviewState, 800);
    } else {
      const ms = currentUndoSeconds * 1000;
      previewBtn.style.setProperty("--wl-undo-ms", `${ms}ms`);
      previewBtn.classList.add("is-added", "is-undo-active");
      previewBtn.title = deleteTitle;
      previewBtn.setAttribute("aria-label", deleteTitle);
      previewTimer = setTimeout(resetPreviewState, ms);
    }
  };

  previewBtn.addEventListener("click", togglePreview);
  previewBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      togglePreview();
    }
  });
}

// Load saved settings from local + sync
async function loadStoredSettings() {
  const KEYS = ["buttonColor", "showUpdateNotification", "buttonShortcut", "buttonUndoSeconds", "buttonSurfaces"];
  let localData = {};
  let syncData = {};

  try {
    localData = (await extApi?.storage?.local?.get(KEYS)) || {};
  } catch {}

  try {
    syncData = (await extApi?.storage?.sync?.get(KEYS)) || {};
  } catch {}

  const cfg = { ...localData, ...syncData };

  const { hex = DEFAULT_COLOR, alpha = DEFAULT_ALPHA } = cfg.buttonColor || {};
  applyColor(hex, alpha !== undefined ? alpha : DEFAULT_ALPHA, false);

  if (updateNotificationToggle) {
    updateNotificationToggle.checked = cfg.showUpdateNotification !== false;
  }

  applyShortcut(cfg.buttonShortcut || DEFAULT_SHORTCUT, false);

  const storedSec = cfg.buttonUndoSeconds !== undefined ? Number(cfg.buttonUndoSeconds) : DEFAULT_UNDO_SECONDS;
  const isCustomVal = ![0, 10, 15].includes(storedSec);
  applyUndoSeconds(storedSec, isCustomVal, false);

  applySurfaces(cfg.buttonSurfaces || DEFAULT_SURFACES, false);
}

loadStoredSettings();

// Event Listeners
colorPicker?.addEventListener("input", (e) => {
  applyColor(e.target.value, Number(opacitySlider.value), true, false);
});
colorPicker?.addEventListener("change", (e) => {
  applyColor(e.target.value, Number(opacitySlider.value), true, true);
});

colorHex?.addEventListener("change", (e) => {
  let val = e.target.value.trim();
  if (!val.startsWith("#")) val = `#${val}`;

  if (/^#[0-9A-Fa-f]{8}$/.test(val)) {
    const hex = val.slice(0, 7).toLowerCase();
    const alpha = Math.round((parseInt(val.slice(7, 9), 16) / 255) * 100);
    applyColor(hex, alpha, true, true);
  } else if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
    applyColor(val.toLowerCase(), Number(opacitySlider.value), true, true);
  } else if (/^#[0-9A-Fa-f]{3}$/.test(val)) {
    const r = val[1], g = val[2], b = val[3];
    applyColor(`#${r}${r}${g}${g}${b}${b}`.toLowerCase(), Number(opacitySlider.value), true, true);
  } else {
    colorHex.value = hexToHex8(colorPicker.value, Number(opacitySlider.value));
  }
});

opacitySlider?.addEventListener("input", (e) => {
  applyColor(colorPicker.value, Number(e.target.value), true, false);
});
opacitySlider?.addEventListener("change", (e) => {
  applyColor(colorPicker.value, Number(e.target.value), true, true);
});

updateNotificationToggle?.addEventListener("change", (e) => {
  persistUpdateNotification(e.target.checked);
});

surfaceWatchToggle?.addEventListener("change", (e) => {
  currentSurfaces.watch = e.target.checked;
  persistSurfaces(currentSurfaces);
});

surfaceShortsToggle?.addEventListener("change", (e) => {
  currentSurfaces.shorts = e.target.checked;
  persistSurfaces(currentSurfaces);
});

surfaceCardsToggle?.addEventListener("change", (e) => {
  currentSurfaces.cards = e.target.checked;
  persistSurfaces(currentSurfaces);
});

shortcutBtn?.addEventListener("click", () => {
  if (isRecordingShortcut) {
    window.removeEventListener("keydown", handleKeyRecord, true);
    applyShortcut(currentShortcut, false);
    return;
  }

  isRecordingShortcut = true;
  shortcutBtn.classList.add("is-recording");
  const recordingText = extApi?.i18n?.getMessage?.("settingsShortcutRecording") || "Press keys...";
  shortcutBtn.textContent = recordingText;
  if (shortcutHint) shortcutHint.hidden = false;

  window.addEventListener("keydown", handleKeyRecord, true);
});

undoPills.forEach((pill) => {
  pill.addEventListener("click", () => {
    const secAttr = pill.dataset.seconds;
    if (secAttr === "custom") {
      const customVal = Math.max(1, Math.min(60, Number(customUndoInput?.value) || 7));
      if (customUndoInput) {
        customUndoInput.value = customVal;
      }
      applyUndoSeconds(customVal, true, true);
      customUndoInput?.focus();
      customUndoInput?.select();
    } else {
      applyUndoSeconds(Number(secAttr), false, true);
    }
  });
});

customUndoInput?.addEventListener("input", (e) => {
  const raw = e.target.value.trim();
  if (raw === "") return;
  const num = parseInt(raw, 10);
  if (!isNaN(num)) {
    const clamped = Math.max(1, Math.min(60, num));
    applyUndoSeconds(clamped, true, true);
  }
});

customUndoInput?.addEventListener("change", (e) => {
  const num = parseInt(e.target.value.trim(), 10);
  const clamped = isNaN(num) ? 7 : Math.max(1, Math.min(60, num));
  e.target.value = clamped;
  applyUndoSeconds(clamped, true, true);
});

customUndoInput?.addEventListener("blur", (e) => {
  const num = parseInt(e.target.value.trim(), 10);
  const clamped = isNaN(num) ? 7 : Math.max(1, Math.min(60, num));
  e.target.value = clamped;
  applyUndoSeconds(clamped, true, true);
});

undoStepDown?.addEventListener("click", () => {
  const currentVal = Math.max(1, Math.min(60, Number(customUndoInput?.value) || 7));
  const nextVal = Math.max(1, currentVal - 1);
  if (customUndoInput) customUndoInput.value = nextVal;
  applyUndoSeconds(nextVal, true, true);
});

undoStepUp?.addEventListener("click", () => {
  const currentVal = Math.max(1, Math.min(60, Number(customUndoInput?.value) || 7));
  const nextVal = Math.min(60, currentVal + 1);
  if (customUndoInput) customUndoInput.value = nextVal;
  applyUndoSeconds(nextVal, true, true);
});

resetBtn?.addEventListener("click", () => {
  applyColor(DEFAULT_COLOR, DEFAULT_ALPHA, true, true);
  if (updateNotificationToggle) {
    updateNotificationToggle.checked = true;
  }
  persistUpdateNotification(true);
  applyShortcut(DEFAULT_SHORTCUT, true);
  applyUndoSeconds(DEFAULT_UNDO_SECONDS, false, true);
  applySurfaces(DEFAULT_SURFACES, true);
});