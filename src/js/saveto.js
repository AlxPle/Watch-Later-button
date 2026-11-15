/* Watch Later Button - Content Script */

const CARD_WL_INJECTED = "data-wl-injected";
const CARD_RENDERER_SELECTOR = "ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-video-renderer, yt-lockup-view-model, ytd-reel-item-renderer";
const CARD_IMAGE_NOT_INJECTED_SELECTOR = ":is(.yt-lockup-view-model__content-image, yt-thumbnail-view-model, ytd-thumbnail):not([data-wl-injected])";
const CARD_LINK_SELECTOR = 'a[href*="/watch?v="], a[href*="/shorts/"]';
const SHORTS_SHELF_SELECTOR = "ytd-rich-shelf-renderer[is-shorts], ytd-reel-shelf-renderer";
const AD_SELECTORS = "ytd-ad-slot-renderer, ytd-promoted-video-renderer, ytd-display-ad-renderer, ytd-badge-supported-renderer.badge-style-type-ad";

const WATCH_MOUNT_SELECTORS = [
  "ytd-watch-flexy:not([hidden]) ytd-watch-metadata ytd-menu-renderer.style-scope.ytd-watch-metadata",
  "ytd-watch-flexy:not([hidden]) ytd-watch-metadata ytd-menu-renderer",
  "ytd-watch-flexy:not([hidden]) ytd-watch-metadata #top-level-buttons-computed"
].join(", ");

const SHORTS_MOUNT_SELECTORS = "reel-action-bar-view-model, #actions";

const WL_ADDED_CLASS = "is-added";
const WL_UNDO_ACTIVE_CLASS = "is-undo-active";
const WL_ERROR_CLASS = "is-error";
const DEFAULT_UNDO_SECONDS = 10;
const DEFAULT_SHORTCUT = {
  alt: true,
  ctrl: false,
  shift: false,
  meta: false,
  key: "w",
  code: "KeyW",
  display: "Alt + W"
};
const DEFAULT_SURFACES = {
  watch: true,
  shorts: true,
  cards: true
};

let currentShortcut = { ...DEFAULT_SHORTCUT };
let currentUndoSeconds = DEFAULT_UNDO_SECONDS;
let currentSurfaces = { ...DEFAULT_SURFACES };
const WL_ERROR_FLASH_MS = 800;

const getI18nMessage = (key, fallback) => chrome?.i18n?.getMessage?.(key) || fallback;

const WL_TEXT = {
  defaultTitle: getI18nMessage("wlButtonDefaultTitle", "Watch Later"),
  deleteTitle: getI18nMessage("wlButtonDeleteTitle", "Delete from Watch Later"),
  pending: getI18nMessage("wlButtonPendingTitle", "Waiting for YouTube…"),
  error: getI18nMessage("wlButtonErrorTitle", "Change not confirmed. Check your Watch Later playlist, connection, and YouTube sign-in before trying again."),
  saved: getI18nMessage("wlButtonSaved", "Saved to Watch Later"),
  removed: getI18nMessage("wlButtonRemoved", "Removed from Watch Later")
};

function getDefaultButtonTitle() {
  if (currentShortcut && currentShortcut.display) {
    return `${WL_TEXT.defaultTitle} (${currentShortcut.display})`;
  }
  return WL_TEXT.defaultTitle;
}

function updateAllButtonsDefaultTitle() {
  const title = getDefaultButtonTitle();
  saveTo.dataset.defaultTitle = title;
  if (!buttonErrorState.has(saveTo)) restoreButtonTitle(saveTo);
  document.querySelectorAll(".saveToWatchLater:not(#saveToPlaylist)").forEach((btn) => {
    btn.dataset.defaultTitle = title;
    if (!buttonErrorState.has(btn)) restoreButtonTitle(btn);
  });
}

function applyButtonTheme(colorData) {
  if (!colorData) return;
  const root = document.documentElement;
  if (colorData.rgba) root.style.setProperty("--wl-color-default", colorData.rgba);
  if (colorData.hoverRgba) root.style.setProperty("--wl-color-default-hover", colorData.hoverRgba);
  root.style.setProperty("--wl-icon-color", colorData.iconColor || "#ffffff");
}

function applySurfacesConfig(surfaces) {
  if (!surfaces) return;
  const prevCards = currentSurfaces.cards;

  currentSurfaces = {
    watch: surfaces.watch !== false,
    shorts: surfaces.shorts !== false,
    cards: surfaces.cards !== false
  };

  if (isWatchPage()) {
    if (!currentSurfaces.watch && saveTo.parentElement) {
      saveTo.remove();
    } else if (currentSurfaces.watch && !saveTo.parentElement) {
      mountWatchButton();
    }
  }

  if (isShortsPage()) {
    if (!currentSurfaces.shorts && saveTo.parentElement) {
      saveTo.remove();
    } else if (currentSurfaces.shorts && !saveTo.parentElement) {
      mountWatchButton();
    }
  }

  if (!currentSurfaces.cards && prevCards) {
    document.querySelectorAll(".saveToWatchLater:not(#saveToPlaylist)").forEach((btn) => {
      clearButtonTimers(btn);
      btn.remove();
    });
    document.querySelectorAll(`[${CARD_WL_INJECTED}]`).forEach((el) => {
      el.removeAttribute(CARD_WL_INJECTED);
    });
  } else if (currentSurfaces.cards && !prevCards) {
    injectIntoAllCards();
  }
}

function applyStorageConfig(cfg) {
  if (!cfg) return;
  if (cfg.buttonColor) applyButtonTheme(cfg.buttonColor);
  if (cfg.buttonShortcut) {
    currentShortcut = cfg.buttonShortcut;
    updateAllButtonsDefaultTitle();
  }
  if (cfg.buttonUndoSeconds !== undefined) {
    currentUndoSeconds = Number(cfg.buttonUndoSeconds);
  }
  if (cfg.buttonSurfaces) {
    applySurfacesConfig(cfg.buttonSurfaces);
  }
}

async function loadStorageConfig() {
  const keys = ["buttonColor", "buttonShortcut", "buttonUndoSeconds", "buttonSurfaces"];
  const storageKeys = keys.flatMap(key => [key, `${key}UpdatedAt`]);
  const storageData = { local: {}, sync: {} };
  let ready = false;

  const applyCurrentConfig = () => {
    const cfg = {};
    for (const key of keys) {
      const local = storageData.local;
      const sync = storageData.sync;
      const localTime = local[`${key}UpdatedAt`] || 0;
      const syncTime = sync[`${key}UpdatedAt`] || 0;
      cfg[key] = local[key] !== undefined && (sync[key] === undefined || localTime >= syncTime)
        ? local[key] : sync[key];
    }
    applyStorageConfig(cfg);
  };

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" && area !== "sync") return;
    let changed = false;
    for (const key of storageKeys) {
      if (!(key in changes)) continue;
      storageData[area][key] = changes[key].newValue;
      changed = true;
    }
    if (ready && changed) applyCurrentConfig();
  });

  for (const area of ["local", "sync"]) {
    try {
      const data = await chrome.storage[area].get(storageKeys);
      storageData[area] = { ...data, ...storageData[area] };
    } catch {}
  }
  ready = true;
  applyCurrentConfig();
}

function handleButtonKeyDown(e) {
  if (e.repeat || e.isComposing) return;
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    e.currentTarget.click();
  }
}

function decorateButtonAccessibility(button) {
  const defaultTitle = button.dataset.defaultTitle || WL_TEXT.defaultTitle;
  button.setAttribute("role", "button");
  button.setAttribute("aria-label", defaultTitle);
  button.setAttribute("tabindex", "0");
  button.addEventListener("keydown", handleButtonKeyDown);
}

/* Create main player watch later button */
const saveTo = document.createElement("div");
saveTo.id = "saveToPlaylist";
saveTo.className = "saveToWatchLater";
const initialDefaultTitle = getDefaultButtonTitle();
saveTo.dataset.defaultTitle = initialDefaultTitle;
saveTo.title = initialDefaultTitle;
decorateButtonAccessibility(saveTo);

const buttonUndoState = new WeakMap();
const buttonErrorState = new WeakMap();

function isWatchPage() {
  return location.pathname === "/watch" && Boolean(new URLSearchParams(location.search).get("v"));
}

function isShortsPage() {
  return location.pathname.startsWith("/shorts");
}

function resolveCurrentVideoId() {
  if (isWatchPage()) {
    return new URLSearchParams(location.search).get("v");
  }
  if (isShortsPage()) {
    const parts = location.pathname.split("/").filter(Boolean);
    if (parts[0] === "shorts" && parts[1]) return parts[1];

    const activeShortsLink = document.querySelector(
      'ytd-reel-video-renderer[is-active] a[href*="/shorts/"], ytd-reel-video-renderer a[href*="/shorts/"]'
    );
    if (activeShortsLink?.href) {
      try {
        const activeParts = new URL(activeShortsLink.href, location.origin).pathname.split("/").filter(Boolean);
        if (activeParts[0] === "shorts" && activeParts[1]) return activeParts[1];
      } catch {}
    }
  }
  return null;
}

const pendingRequests = new Map();
const buttonPendingState = new WeakMap();
const pendingVideos = new Set();
const actionStatus = document.createElement("span");
actionStatus.className = "wl-action-status";
actionStatus.setAttribute("role", "status");
actionStatus.setAttribute("aria-live", "polite");
document.body.append(actionStatus);

document.addEventListener("wl-playlist-response", (event) => {
  let response;
  try {
    response = JSON.parse(event.detail);
  } catch {
    return;
  }
  const pending = pendingRequests.get(response?.requestId);
  if (!pending) return;
  clearTimeout(pending.timer);
  pendingRequests.delete(response.requestId);
  pending.resolve(response.ok === true);
});

function sendWatchLaterAction(action, videoId) {
  const requestId = crypto.randomUUID();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(requestId);
      resolve(false);
    }, 13000);
    pendingRequests.set(requestId, { resolve, timer });
    document.dispatchEvent(new CustomEvent("wl-playlist-request", {
      detail: JSON.stringify({ requestId, action, videoId })
    }));
  });
}

function restoreButtonTitle(button) {
  const title = buttonPendingState.has(button) ? WL_TEXT.pending
    : buttonUndoState.get(button)?.videoId ? WL_TEXT.deleteTitle
    : button.dataset.defaultTitle || getDefaultButtonTitle();
  button.title = title;
  button.setAttribute("aria-label", title);
}

function flashButtonErrorState(button) {
  const existingTimer = buttonErrorState.get(button);
  if (existingTimer) clearTimeout(existingTimer);

  button.classList.remove(WL_ERROR_CLASS);
  void button.offsetWidth;
  button.classList.add(WL_ERROR_CLASS);
  button.title = WL_TEXT.error;
  button.setAttribute("aria-label", WL_TEXT.error);
  actionStatus.textContent = WL_TEXT.error;

  const timerId = setTimeout(() => {
    button.classList.remove(WL_ERROR_CLASS);
    buttonErrorState.delete(button);
    restoreButtonTitle(button);
  }, WL_ERROR_FLASH_MS);

  buttonErrorState.set(button, timerId);
}

function clearButtonUndoState(button) {
  const undoState = buttonUndoState.get(button);
  if (undoState?.timerId) clearTimeout(undoState.timerId);

  buttonUndoState.delete(button);
  button.classList.remove(WL_ADDED_CLASS, WL_UNDO_ACTIVE_CLASS);
  restoreButtonTitle(button);
}

function setButtonUndoState(button, videoId) {
  clearButtonUndoState(button);

  if (currentUndoSeconds <= 0) {
    // Instant save without undo window: flash success icon for 800ms
    button.classList.add(WL_ADDED_CLASS);
    const timerId = setTimeout(() => {
      button.classList.remove(WL_ADDED_CLASS);
      buttonUndoState.delete(button);
    }, 800);
    buttonUndoState.set(button, { timerId, videoId: null });
    return;
  }

  const undoWindowMs = currentUndoSeconds * 1000;
  button.classList.add(WL_ADDED_CLASS, WL_UNDO_ACTIVE_CLASS);
  button.style.setProperty("--wl-undo-ms", `${undoWindowMs}ms`);
  button.title = WL_TEXT.deleteTitle;
  button.setAttribute("aria-label", WL_TEXT.deleteTitle);

  const timerId = setTimeout(() => {
    const state = buttonUndoState.get(button);
    if (state?.videoId === videoId) clearButtonUndoState(button);
  }, undoWindowMs);

  buttonUndoState.set(button, { timerId, videoId });
}

async function handleWatchLaterToggle(button, explicitVideoId = null) {
  const videoId = explicitVideoId || resolveCurrentVideoId();
  if (!videoId) {
    flashButtonErrorState(button);
    return;
  }
  if (buttonPendingState.has(button) || pendingVideos.has(videoId)) return;

  const undoState = buttonUndoState.get(button);
  const action = undoState?.videoId === videoId ? "remove" : "add";
  const operation = { videoId };
  buttonPendingState.set(button, operation);
  pendingVideos.add(videoId);
  clearTimeout(buttonErrorState.get(button));
  buttonErrorState.delete(button);
  button.classList.remove(WL_ERROR_CLASS);
  button.classList.add("is-pending");
  button.setAttribute("aria-busy", "true");
  restoreButtonTitle(button);
  actionStatus.textContent = WL_TEXT.pending;

  const ok = await sendWatchLaterAction(action, videoId);
  pendingVideos.delete(videoId);
  if (buttonPendingState.get(button) !== operation) return;
  buttonPendingState.delete(button);
  button.classList.remove("is-pending");
  button.removeAttribute("aria-busy");
  restoreButtonTitle(button);

  const currentVideoId = button === saveTo ? resolveCurrentVideoId() : getVideoIdFromCard(button);
  if (!button.isConnected || currentVideoId !== videoId) return;
  if (!ok) {
    flashButtonErrorState(button);
    return;
  }
  if (action === "remove") clearButtonUndoState(button);
  else setButtonUndoState(button, videoId);
  actionStatus.textContent = action === "add" ? WL_TEXT.saved : WL_TEXT.removed;
}

saveTo.addEventListener("click", () => handleWatchLaterToggle(saveTo));

function getShortsMount() {
  const shorts = document.querySelector("ytd-shorts:not([hidden])");
  if (!shorts) return null;
  const active = shorts.querySelector("ytd-reel-video-renderer[is-active]:not([hidden])");
  if (active) return active.querySelector(SHORTS_MOUNT_SELECTORS);

  const standalone = [...shorts.querySelectorAll("reel-action-bar-view-model")].find(element =>
    !element.closest("ytd-reel-video-renderer, [hidden], [aria-hidden='true']"));
  if (standalone) return standalone;

  const visibleReels = [...shorts.querySelectorAll("ytd-reel-video-renderer")].filter(element =>
    !element.closest("[hidden], [aria-hidden='true']"));
  return visibleReels.length === 1 ? visibleReels[0].querySelector(SHORTS_MOUNT_SELECTORS) : null;
}

function mountWatchButton() {
  if (!isWatchPage() && !isShortsPage()) {
    if (saveTo.parentElement) saveTo.remove();
    return;
  }

  if (isWatchPage() && !currentSurfaces.watch) {
    if (saveTo.parentElement) saveTo.remove();
    return;
  }

  if (isShortsPage() && !currentSurfaces.shorts) {
    if (saveTo.parentElement) saveTo.remove();
    return;
  }

  const isShorts = isShortsPage();
  const container = isShorts ? getShortsMount() : document.querySelector(WATCH_MOUNT_SELECTORS);

  if (!container) {
    if (saveTo.parentElement) saveTo.remove();
    return;
  }

  saveTo.classList.toggle("shortsPage", isShorts);
  if (saveTo.parentElement !== container) {
    container.append(saveTo);
  }

  if (isShorts) {
    const currentVideoId = resolveCurrentVideoId();
    const currentUndo = buttonUndoState.get(saveTo);
    if (currentUndo && currentUndo.videoId !== currentVideoId) {
      clearButtonUndoState(saveTo);
    }
  }
}

// P2: single persistent observer — never recreated, only re-targeted when needed
let watchObserverTarget = null;
const watchObserver = new MutationObserver(() => {
  if (!isWatchPage() && !isShortsPage()) return;
  mountWatchButton();
});

function startWatchObserver() {
  if (!isWatchPage() && !isShortsPage()) return;

  const target = document.querySelector("ytd-app") || document.body;
  if (!target) return;

  // Only re-observe if the target element has changed
  if (target === watchObserverTarget) return;
  if (watchObserverTarget) watchObserver.disconnect();
  watchObserverTarget = target;
  watchObserver.observe(target, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["is-active", "hidden"]
  });
}

/* ===== Card Injection ===== */

function getVideoIdFromCard(elementInsideCard) {
  const renderer = elementInsideCard.closest(CARD_RENDERER_SELECTOR);
  if (!renderer) return null;

  const link = renderer.querySelector(CARD_LINK_SELECTOR);
  if (!link?.href) return null;

  try {
    const url = new URL(link.href, location.origin);
    if (url.searchParams.get("v")) return url.searchParams.get("v");
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "shorts" && parts[1]) return parts[1];
  } catch {}

  return null;
}

function getStableCardMount(contentImageEl) {
  const renderer = contentImageEl.closest(CARD_RENDERER_SELECTOR);
  if (!renderer) return { renderer: null, mount: contentImageEl, isResults: false, isShorts: false };

  const isShorts = Boolean(renderer.closest(SHORTS_SHELF_SELECTOR));
  if (isShorts) {
    const mount = renderer.querySelector("#dismissible") || renderer;
    return { renderer, mount, isResults: false, isShorts: true };
  }

  const isResults = location.pathname === "/results";
  if (isResults) {
    const resultsMenu = renderer.querySelector("ytd-menu-renderer, .yt-lockup-metadata-view-model__menu-button");
    return { renderer, mount: resultsMenu, isResults: true, isShorts: false };
  }

  const mount = renderer.querySelector("#dismissible") || renderer;
  return { renderer, mount, isResults: false, isShorts: false };
}

function addWatchLaterToCard(contentImageEl) {
  if (!currentSurfaces.cards) return;
  if (contentImageEl.hasAttribute(CARD_WL_INJECTED)) return;

  const { renderer, mount, isResults, isShorts } = getStableCardMount(contentImageEl);
  if (!mount) return;

  if (renderer?.matches?.(AD_SELECTORS) || renderer?.querySelector?.(AD_SELECTORS)) {
    contentImageEl.setAttribute(CARD_WL_INJECTED, "1");
    return;
  }

  if (mount.querySelector(":scope > .saveToWatchLater")) {
    contentImageEl.setAttribute(CARD_WL_INJECTED, "1");
    return;
  }

  const videoId = getVideoIdFromCard(contentImageEl);
  if (!videoId) return;

  contentImageEl.setAttribute(CARD_WL_INJECTED, "1");
  mount.setAttribute(CARD_WL_INJECTED, "1");

  const locationClass = isResults ? "results" : (isShorts ? "shortsHomePage" : "home");
  const btn = document.createElement("div");
  btn.dataset.videoId = videoId;
  btn.className = `saveToWatchLater ${locationClass}`;
  const defaultTitle = getDefaultButtonTitle();
  btn.dataset.defaultTitle = defaultTitle;
  btn.title = defaultTitle;
  decorateButtonAccessibility(btn);

  if (!isResults) {
    // Use class instead of getComputedStyle (P4: avoid forced reflow in a loop)
    mount.classList.add("wl-mount-relative");
  }

  if (isResults) {
    mount.prepend(btn);
  } else {
    mount.appendChild(btn);
  }
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".saveToWatchLater:not(#saveToPlaylist)");
  if (!btn) return;

  e.stopPropagation();
  e.preventDefault();

  const videoId = getVideoIdFromCard(btn);
  if (videoId) {
    handleWatchLaterToggle(btn, videoId);
  } else {
    flashButtonErrorState(btn);
  }
}, true);

let isInjecting = false;

async function injectIntoAllCards() {
  if (!currentSurfaces.cards) return;
  if (isInjecting) return;
  isInjecting = true;
  try {
    const els = [...document.querySelectorAll(CARD_IMAGE_NOT_INJECTED_SELECTOR)];
    if (!els.length) return;
    const BATCH = 8;
    for (let i = 0; i < els.length; i += BATCH) {
      els.slice(i, i + BATCH).forEach(addWatchLaterToCard);
      if (i + BATCH < els.length) {
        await (globalThis.scheduler?.yield?.() ??
               new Promise(r => setTimeout(r, 0)));
      }
    }
  } finally {
    isInjecting = false;
  }
}

let cardObserver = null;
let cardInjectTimer = null;

function clearButtonTimers(btn) {
  buttonPendingState.delete(btn);
  btn.classList.remove("is-pending", WL_ERROR_CLASS);
  btn.removeAttribute("aria-busy");
  clearTimeout(buttonErrorState.get(btn));
  buttonErrorState.delete(btn);
  clearButtonUndoState(btn);
}

function cleanupRemovedButtons(mutations) {
  let needsInjection = false;
  for (const m of mutations) {
    let removedButtons = false;
    for (const node of m.removedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE || node.isConnected) continue;
      const buttons = node.matches(".saveToWatchLater")
        ? [node] : [...node.querySelectorAll(".saveToWatchLater")];
      buttons.forEach(clearButtonTimers);
      if (buttons.length) removedButtons = true;
    }
    if (!removedButtons) continue;
    const renderer = m.target.closest(CARD_RENDERER_SELECTOR);
    if (!renderer?.isConnected) continue;
    renderer.removeAttribute(CARD_WL_INJECTED);
    renderer.querySelectorAll(`[${CARD_WL_INJECTED}]`).forEach(el => {
      el.removeAttribute(CARD_WL_INJECTED);
    });
    needsInjection = true;
  }
  return needsInjection;
}

function refreshCardVideo(button) {
  const videoId = getVideoIdFromCard(button) || "";
  if (button.dataset.videoId === videoId) return;
  clearButtonTimers(button);
  button.dataset.videoId = videoId;
}

function startCardObserver() {
  if (cardObserver) {
    cleanupRemovedButtons(cardObserver.takeRecords());
    cardObserver.disconnect();
  }

  const target = document.querySelector("ytd-app, #contents, #primary") || document.body || document.documentElement;
  if (!target) return;

  cardObserver = new MutationObserver((mutations) => {
    const needsInjection = cleanupRemovedButtons(mutations);
    const changedCards = new Set();
    for (const mutation of mutations) {
      const renderer = mutation.target.closest(CARD_RENDERER_SELECTOR);
      if (renderer) changedCards.add(renderer);
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.matches(CARD_RENDERER_SELECTOR)) changedCards.add(node);
        node.querySelectorAll(CARD_RENDERER_SELECTOR).forEach(card => changedCards.add(card));
      }
    }
    changedCards.forEach(renderer => {
      renderer.querySelectorAll(".saveToWatchLater").forEach(refreshCardVideo);
    });

    const hasNewElements = mutations.some(m =>
      [...m.addedNodes].some(n => n.nodeType === Node.ELEMENT_NODE)
    );
    const hasLinkChanges = mutations.some(m => m.type === "attributes");
    if (!needsInjection && !hasNewElements && !hasLinkChanges) return;

    if (cardInjectTimer) return;
    cardInjectTimer = setTimeout(() => {
      cardInjectTimer = null;
      injectIntoAllCards();
    }, 200);
  });
  cardObserver.observe(target, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["href"]
  });
}

function handleGlobalKeyDown(e) {
  if (e.repeat || e.isComposing || !currentShortcut || !currentShortcut.key) return;

  const activeEl = document.activeElement;
  const target = e.target;
  const isInputTarget = (el) =>
    el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

  if (isInputTarget(activeEl) || isInputTarget(target)) {
    return;
  }

  const altMatches = Boolean(currentShortcut.alt) === Boolean(e.altKey);
  const ctrlMatches = Boolean(currentShortcut.ctrl) === Boolean(e.ctrlKey);
  const shiftMatches = Boolean(currentShortcut.shift) === Boolean(e.shiftKey);
  const metaMatches = Boolean(currentShortcut.meta) === Boolean(e.metaKey);

  if (!altMatches || !ctrlMatches || !shiftMatches || !metaMatches) {
    return;
  }

  const codeMatches = currentShortcut.code && e.code && currentShortcut.code.toLowerCase() === e.code.toLowerCase();
  const keyMatches = currentShortcut.key && e.key && currentShortcut.key.toLowerCase() === e.key.toLowerCase();

  if (!codeMatches && !keyMatches) {
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  if (isWatchPage()) {
    if (!currentSurfaces.watch) return;
    handleWatchLaterToggle(saveTo);
    return;
  }

  if (isShortsPage()) {
    if (!currentSurfaces.shorts) return;
    handleWatchLaterToggle(saveTo);
    return;
  }

  if (!currentSurfaces.cards) return;

  const hoveredCard = document.querySelector(`:hover:is(${CARD_RENDERER_SELECTOR})`);
  if (hoveredCard) {
    const cardBtn = hoveredCard.querySelector(".saveToWatchLater");
    if (cardBtn) {
      const videoId = getVideoIdFromCard(cardBtn);
      if (videoId) {
        handleWatchLaterToggle(cardBtn, videoId);
      } else {
        flashButtonErrorState(cardBtn);
      }
    }
  }
}

window.addEventListener("keydown", handleGlobalKeyDown, true);

function onNavigation() {
  startCardObserver();
  clearButtonTimers(saveTo);
  mountWatchButton();
  startWatchObserver();
  injectIntoAllCards();
}

document.addEventListener("yt-navigate-finish", onNavigation);
window.addEventListener("popstate", onNavigation);

// Initial bootstrap
onNavigation();
loadStorageConfig();