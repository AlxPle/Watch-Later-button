document.querySelectorAll("[data-i18n]").forEach((el) => {
  const msg = chrome.i18n?.getMessage(el.dataset.i18n);
  if (msg) el.textContent = msg;
});

document.querySelectorAll("[data-i18n-title]").forEach((el) => {
  const msg = chrome.i18n?.getMessage(el.dataset.i18nTitle);
  if (msg) el.title = msg;
});

const version = chrome.runtime?.getManifest?.()?.version;
if (version) document.getElementById("ext-version").textContent = `v${version}`;

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

// Color Settings
const DEFAULT_COLOR = "#e50914";
const DEFAULT_ALPHA = 100;

const colorPicker = document.getElementById("color-picker");
const colorHex = document.getElementById("color-hex");
const opacitySlider = document.getElementById("opacity-slider");
const opacityVal = document.getElementById("opacity-val");
const rgbaOutput = document.getElementById("rgba-output");
const previewBtn = document.getElementById("btn-preview");
const resetBtn = document.getElementById("reset-color-btn");

let saveTimer = null;

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

function persistColor(payload, immediate = false) {
  // Always write immediately to local storage (no rate limits, content script listens to changes)
  try {
    chrome.storage?.local?.set({ buttonColor: payload }, () => {
      void chrome.runtime?.lastError;
    });
  } catch {}

  if (saveTimer) clearTimeout(saveTimer);

  const saveToSync = () => {
    try {
      const res = chrome.storage?.sync?.set({ buttonColor: payload }, () => {
        void chrome.runtime?.lastError;
      });
      if (res && typeof res.catch === "function") {
        res.catch(() => {});
      }
    } catch {}
  };

  if (immediate) {
    saveToSync();
  } else {
    // Only sync across devices when user pauses/stops moving controls (500ms debounce)
    saveTimer = setTimeout(saveToSync, 500);
  }
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

// Load saved settings from sync or local
function loadStoredSettings() {
  chrome.storage?.sync?.get("buttonColor", (syncData) => {
    if (syncData?.buttonColor) {
      const { hex = DEFAULT_COLOR, alpha = DEFAULT_ALPHA } = syncData.buttonColor;
      applyColor(hex, alpha !== undefined ? alpha : DEFAULT_ALPHA, false);
    } else {
      chrome.storage?.local?.get("buttonColor", (localData) => {
        const { hex = DEFAULT_COLOR, alpha = DEFAULT_ALPHA } = localData?.buttonColor || {};
        applyColor(hex, alpha !== undefined ? alpha : DEFAULT_ALPHA, false);
      });
    }
  });
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

resetBtn?.addEventListener("click", () => {
  applyColor(DEFAULT_COLOR, DEFAULT_ALPHA, true, true);
});