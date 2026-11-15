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

// Navigation & Dynamic Slider Height
const viewsSlider = document.getElementById("views-slider");
const mainView = document.getElementById("main-view");
const settingsView = document.getElementById("settings-view");

function syncSliderHeight(activeEl) {
  if (!viewsSlider || !activeEl) return;
  viewsSlider.style.height = `${activeEl.offsetHeight}px`;
}

const openSettings = () => {
  mainView.classList.remove("is-active");
  mainView.classList.add("is-hidden-left");
  mainView.setAttribute("inert", "");

  settingsView.removeAttribute("inert");
  settingsView.classList.add("is-active");
  syncSliderHeight(settingsView);
};

const closeSettings = () => {
  settingsView.classList.remove("is-active");
  settingsView.setAttribute("inert", "");

  mainView.removeAttribute("inert");
  mainView.classList.remove("is-hidden-left");
  mainView.classList.add("is-active");
  syncSliderHeight(mainView);
};

if (typeof ResizeObserver !== "undefined" && viewsSlider) {
  const resizeObserver = new ResizeObserver(() => {
    const active = settingsView.classList.contains("is-active") ? settingsView : mainView;
    syncSliderHeight(active);
  });
  resizeObserver.observe(mainView);
  resizeObserver.observe(settingsView);
}

requestAnimationFrame(() => syncSliderHeight(settingsView.classList.contains("is-active") ? settingsView : mainView));

document.getElementById("open-settings-row-btn")?.addEventListener("click", () => {
  openSettings();
  document.getElementById("back-to-main-btn").focus({ preventScroll: true });
});
document.getElementById("back-to-main-btn")?.addEventListener("click", () => {
  closeSettings();
  document.getElementById("open-settings-row-btn").focus({ preventScroll: true });
});

// Возврат на главный экран по клавише Esc
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !isRecordingShortcut && settingsView.classList.contains("is-active")) {
    e.preventDefault();
    closeSettings();
    document.getElementById("open-settings-row-btn").focus({ preventScroll: true });
  }
});

// Defaults & Constants
const DEFAULT_COLOR = "#e50914";
const DEFAULT_ALPHA = 100;
const PRESET_COLORS = ["#e50914", "#ffffff", "#3ea6ff", "#2ba640"];
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
const presetChips = document.querySelectorAll(".preset-chip[data-color]");
const customSwatchBtn = document.getElementById("custom-swatch-btn");
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
const undoActiveThumb = document.getElementById("undo-active-thumb");
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

async function safeStorageSet(area, data) {
  try {
    await extApi.storage[area].set(data);
  } catch (error) {
    console.warn(`Could not save ${area} settings`, error);
  }
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

function getRelativeLuminance(hex) {
  const clean = hex.replace("#", "").slice(0, 6);
  const channels = [
    parseInt(clean.slice(0, 2), 16) / 255,
    parseInt(clean.slice(2, 4), 16) / 255,
    parseInt(clean.slice(4, 6), 16) / 255
  ].map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function updatePresetSelection(normalizedHex) {
  let matchedPreset = false;
  presetChips.forEach((chip) => {
    const isMatch = chip.dataset.color?.toLowerCase() === normalizedHex;
    chip.classList.toggle("active", isMatch);
    if (isMatch) matchedPreset = true;
  });

  if (customSwatchBtn) {
    if (!matchedPreset && !PRESET_COLORS.includes(normalizedHex)) {
      customSwatchBtn.classList.add("active", "has-custom-color");
      customSwatchBtn.style.setProperty("--custom-chip-bg", normalizedHex);
      customSwatchBtn.style.color = getRelativeLuminance(normalizedHex) > 0.55 ? "#0f0f0f" : "#ffffff";
    } else {
      customSwatchBtn.classList.remove("active", "has-custom-color");
      customSwatchBtn.style.removeProperty("--custom-chip-bg");
      customSwatchBtn.style.color = "";
    }
  }
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

function syncSwitchAria(inputEl) {
  if (inputEl) {
    inputEl.setAttribute("aria-checked", String(Boolean(inputEl.checked)));
  }
}

function applySurfaces(surfaces, save = true) {
  currentSurfaces = {
    watch: surfaces?.watch !== false,
    shorts: surfaces?.shorts !== false,
    cards: surfaces?.cards !== false
  };

  if (surfaceWatchToggle) {
    surfaceWatchToggle.checked = currentSurfaces.watch;
    syncSwitchAria(surfaceWatchToggle);
  }
  if (surfaceShortsToggle) {
    surfaceShortsToggle.checked = currentSurfaces.shorts;
    syncSwitchAria(surfaceShortsToggle);
  }
  if (surfaceCardsToggle) {
    surfaceCardsToggle.checked = currentSurfaces.cards;
    syncSwitchAria(surfaceCardsToggle);
  }

  if (save) persistSurfaces(currentSurfaces);
}

function applyColor(hex, alpha, save = true, immediate = false) {
  const clampedAlpha = Math.max(0, Math.min(100, Math.round(Number(alpha))));
  const cleanHex = (hex.startsWith("#") ? hex.slice(0, 7) : `#${hex.slice(0, 6)}`).toLowerCase();
  const rgba = hexToRgba(cleanHex, clampedAlpha);
  const hoverRgba = hexToHoverRgba(cleanHex, clampedAlpha);
  const isLightFill = getRelativeLuminance(cleanHex) > 0.55 && clampedAlpha >= 45;
  const iconColor = isLightFill ? "#0f0f0f" : "#ffffff";

  colorPicker.value = cleanHex;
  colorHex.value = hexToHex8(cleanHex, clampedAlpha);
  opacitySlider.value = clampedAlpha;
  opacityVal.textContent = `${clampedAlpha}%`;
  rgbaOutput.value = rgba;
  updatePresetSelection(cleanHex);

if (previewBtn) {
    previewBtn.style.setProperty("--wl-color-default", rgba);
    previewBtn.style.setProperty("--wl-color-default-hover", hoverRgba);
    previewBtn.style.setProperty("--wl-icon-color", iconColor);
  }

  if (save) {
    persistColor({ hex: cleanHex, alpha: clampedAlpha, rgba, hoverRgba, iconColor }, immediate);
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
  if (e.repeat || e.isComposing) return;

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

  let activeIndex = 3;
  let matchedPill = false;

  undoPills.forEach((pill) => {
    const secAttr = pill.dataset.seconds;
    if (!isCustom && secAttr !== "custom" && Number(secAttr) === val) {
      pill.classList.add("active");
      matchedPill = true;
      activeIndex = Number(pill.dataset.index || 0);
    } else if (secAttr !== "custom") {
      pill.classList.remove("active");
    }
  });

  const customPill = document.querySelector('.undo-pill[data-seconds="custom"]');
  if (isCustom || !matchedPill) {
    customPill?.classList.add("active");
    activeIndex = 3;
    if (customUndoContainer) customUndoContainer.hidden = false;
    if (customUndoInput && document.activeElement !== customUndoInput) customUndoInput.value = val;
  } else {
    customPill?.classList.remove("active");
    if (customUndoContainer) customUndoContainer.hidden = true;
  }

  if (undoActiveThumb) {
    undoActiveThumb.style.transform = `translateX(${activeIndex * 100}%)`;
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

// Interactive button preview inside mini-player
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
    if (previewBtn.classList.contains("is-undo-active")) {
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
      if (!e.repeat && !e.isComposing) togglePreview();
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
    syncSwitchAria(updateNotificationToggle);
  }

  applyShortcut(cfg.buttonShortcut || DEFAULT_SHORTCUT, false);

  const storedSec = cfg.buttonUndoSeconds !== undefined ? Number(cfg.buttonUndoSeconds) : DEFAULT_UNDO_SECONDS;
  const isCustomVal = ![0, 10, 15].includes(storedSec);
  applyUndoSeconds(storedSec, isCustomVal, false);

  applySurfaces(cfg.buttonSurfaces || DEFAULT_SURFACES, false);
}

loadStoredSettings();

// Preset Swatches Events
presetChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const presetHex = chip.dataset.color;
    if (presetHex) {
      applyColor(presetHex, Number(opacitySlider.value), true, true);
    }
  });
});

customSwatchBtn?.addEventListener("click", () => {
  colorPicker?.click();
});

// Color Picker & Slider Events
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

const rgbaCopyWrap = document.getElementById("rgba-copy-wrap");
let rgbaCopyTimer = null;

rgbaOutput?.addEventListener("click", async () => {
  if (!rgbaOutput.value) return;
  try {
    await navigator.clipboard.writeText(rgbaOutput.value);
  } catch {
    rgbaOutput.select();
    document.execCommand("copy");
  }

  rgbaCopyWrap?.classList.add("is-copied");
  clearTimeout(rgbaCopyTimer);
  rgbaCopyTimer = setTimeout(() => {
    rgbaCopyWrap?.classList.remove("is-copied");
  }, 1000);
});

updateNotificationToggle?.addEventListener("change", (e) => {
  syncSwitchAria(e.target);
  persistUpdateNotification(e.target.checked);
});

surfaceWatchToggle?.addEventListener("change", (e) => {
  syncSwitchAria(e.target);
  currentSurfaces.watch = e.target.checked;
  persistSurfaces(currentSurfaces);
});

surfaceShortsToggle?.addEventListener("change", (e) => {
  syncSwitchAria(e.target);
  currentSurfaces.shorts = e.target.checked;
  persistSurfaces(currentSurfaces);
});

surfaceCardsToggle?.addEventListener("change", (e) => {
  syncSwitchAria(e.target);
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

let resetFeedbackTimer = null;

resetBtn?.addEventListener("click", () => {
  applyColor(DEFAULT_COLOR, DEFAULT_ALPHA, true, true);
  if (updateNotificationToggle) {
    updateNotificationToggle.checked = true;
    syncSwitchAria(updateNotificationToggle);
  }
  persistUpdateNotification(true);
  applyShortcut(DEFAULT_SHORTCUT, true);
  applyUndoSeconds(DEFAULT_UNDO_SECONDS, false, true);
  applySurfaces(DEFAULT_SURFACES, true);

  resetBtn.classList.add("is-reset");
  clearTimeout(resetFeedbackTimer);
  resetFeedbackTimer = setTimeout(() => {
    resetBtn.classList.remove("is-reset");
  }, 1000);
});