/* Watch Later Button - Content Script */

const CARD_WL_INJECTED = "data-wl-injected";
const CARD_RENDERER_SELECTOR = "ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-video-renderer, yt-lockup-view-model, ytd-reel-item-renderer";
const CARD_IMAGE_NOT_INJECTED_SELECTOR = ":is(.yt-lockup-view-model__content-image, yt-thumbnail-view-model, ytd-thumbnail):not([data-wl-injected])";
const CARD_LINK_SELECTOR = 'a[href*="/watch?v="], a[href*="/shorts/"]';
const SHORTS_SHELF_SELECTOR = "ytd-rich-shelf-renderer[is-shorts], ytd-reel-shelf-renderer";
const AD_SELECTORS = "ytd-ad-slot-renderer, ytd-promoted-video-renderer, ytd-display-ad-renderer, ytd-badge-supported-renderer.badge-style-type-ad";

const WATCH_MOUNT_SELECTORS = "ytd-watch-metadata ytd-menu-renderer.style-scope.ytd-watch-metadata, ytd-watch-metadata ytd-menu-renderer, #top-level-buttons-computed, ytd-watch-metadata #top-level-buttons-computed";
const SHORTS_MOUNT_SELECTORS = "reel-action-bar-view-model, ytd-shorts ytd-reel-video-renderer #actions";

const WL_ADDED_CLASS = "is-added";
const WL_UNDO_ACTIVE_CLASS = "is-undo-active";
const WL_ERROR_CLASS = "is-error";
const WL_UNDO_WINDOW_MS = 10000;
const WL_ERROR_FLASH_MS = 800;

const getI18nMessage = (key, fallback) => chrome?.i18n?.getMessage?.(key) || fallback;

const WL_TEXT = {
  defaultTitle: getI18nMessage("wlButtonDefaultTitle", "Watch Later"),
  deleteTitle: getI18nMessage("wlButtonDeleteTitle", "Delete from Watch Later")
};

function applyButtonTheme(colorData) {
  if (!colorData) return;
  const root = document.documentElement;
  if (colorData.rgba) root.style.setProperty("--wl-color-default", colorData.rgba);
  if (colorData.hoverRgba) root.style.setProperty("--wl-color-default-hover", colorData.hoverRgba);
}

try {
  chrome.storage?.sync?.get("buttonColor", (data) => {
    if (data?.buttonColor) {
      applyButtonTheme(data.buttonColor);
    } else {
      chrome.storage?.local?.get("buttonColor", (localData) => {
        if (localData?.buttonColor) applyButtonTheme(localData.buttonColor);
      });
    }
  });
  chrome.storage?.onChanged?.addListener((changes) => {
    if (changes.buttonColor?.newValue) {
      applyButtonTheme(changes.buttonColor.newValue);
    }
  });
} catch {}

function handleButtonKeyDown(e) {
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
saveTo.dataset.defaultTitle = WL_TEXT.defaultTitle;
saveTo.title = WL_TEXT.defaultTitle;
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

function sendWatchLaterAction(action, videoId) {
  const appElement = document.querySelector("ytd-app");
  if (!appElement || !videoId) return false;

  const actionPayload = action === "add"
    ? { addedVideoId: videoId, action: "ACTION_ADD_VIDEO" }
    : { action: "ACTION_REMOVE_VIDEO_BY_VIDEO_ID", removedVideoId: videoId };

  const detail = {
    actionName: "yt-service-request",
    returnValue: [],
    args: [
      { data: {} },
      {
        clickTrackingParams: "",
        commandMetadata: { webCommandMetadata: { sendPost: true, apiUrl: "/youtubei/v1/browse/edit_playlist" } },
        playlistEditEndpoint: { playlistId: "WL", actions: [actionPayload] }
      }
    ],
    optionalAction: false
  };

  appElement.dispatchEvent(new CustomEvent("yt-action", { bubbles: true, composed: true, detail }));
  return true;
}

function flashButtonErrorState(button) {
  const existingTimer = buttonErrorState.get(button);
  if (existingTimer) clearTimeout(existingTimer);

  button.classList.remove(WL_ERROR_CLASS);
  void button.offsetWidth;
  button.classList.add(WL_ERROR_CLASS);

  const timerId = setTimeout(() => {
    button.classList.remove(WL_ERROR_CLASS);
    buttonErrorState.delete(button);
  }, WL_ERROR_FLASH_MS);

  buttonErrorState.set(button, timerId);
}

function clearButtonUndoState(button) {
  const undoState = buttonUndoState.get(button);
  if (undoState?.timerId) clearTimeout(undoState.timerId);

  buttonUndoState.delete(button);
  button.classList.remove(WL_ADDED_CLASS, WL_UNDO_ACTIVE_CLASS);
  const title = button.dataset.defaultTitle || WL_TEXT.defaultTitle;
  button.title = title;
  button.setAttribute("aria-label", title);
}

function setButtonUndoState(button, videoId) {
  clearButtonUndoState(button);

  button.classList.add(WL_ADDED_CLASS, WL_UNDO_ACTIVE_CLASS);
  button.style.setProperty("--wl-undo-ms", `${WL_UNDO_WINDOW_MS}ms`);
  button.title = WL_TEXT.deleteTitle;
  button.setAttribute("aria-label", WL_TEXT.deleteTitle);

  const timerId = setTimeout(() => {
    const state = buttonUndoState.get(button);
    if (state?.videoId === videoId) clearButtonUndoState(button);
  }, WL_UNDO_WINDOW_MS);

  buttonUndoState.set(button, { timerId, videoId });
}

function handleWatchLaterToggle(button, explicitVideoId = null) {
  const videoId = explicitVideoId || resolveCurrentVideoId();
  if (!videoId) {
    flashButtonErrorState(button);
    return;
  }

  const undoState = buttonUndoState.get(button);
  if (undoState && undoState.videoId === videoId) {
    if (sendWatchLaterAction("remove", videoId)) {
      clearButtonUndoState(button);
    } else {
      flashButtonErrorState(button);
    }
    return;
  }

  if (sendWatchLaterAction("add", videoId)) {
    setButtonUndoState(button, videoId);
  } else {
    flashButtonErrorState(button);
  }
}

saveTo.addEventListener("click", () => handleWatchLaterToggle(saveTo));

function mountWatchButton() {
  if (!isWatchPage() && !isShortsPage()) {
    if (saveTo.parentElement) saveTo.remove();
    return;
  }

  const isShorts = isShortsPage();
  const selector = isShorts ? SHORTS_MOUNT_SELECTORS : WATCH_MOUNT_SELECTORS;
  const container = document.querySelector(selector);

  if (!container) return;

  saveTo.classList.toggle("shortsPage", isShorts);
  if (saveTo.parentElement !== container || container.lastElementChild !== saveTo) {
    container.append(saveTo);
  }
}

let watchObserver = null;
function startWatchObserver() {
  if (watchObserver) watchObserver.disconnect();
  if (!isWatchPage() && !isShortsPage()) return;

  const target = document.querySelector("ytd-watch-flexy, ytd-shorts, ytd-app, body");
  if (!target) return;

  watchObserver = new MutationObserver(mountWatchButton);
  watchObserver.observe(target, { childList: true, subtree: true });
}

/* ===== Card Injection ===== */

function getVideoIdFromCard(cardElement) {
  const renderer = cardElement.closest(CARD_RENDERER_SELECTOR);
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
  if (contentImageEl.hasAttribute(CARD_WL_INJECTED)) return;

  const { renderer, mount, isResults, isShorts } = getStableCardMount(contentImageEl);
  if (!mount) return;

  if (renderer?.matches?.(AD_SELECTORS) || renderer?.querySelector?.(AD_SELECTORS)) {
    contentImageEl.setAttribute(CARD_WL_INJECTED, "1");
    return;
  }

  if (mount.hasAttribute(CARD_WL_INJECTED)) {
    contentImageEl.setAttribute(CARD_WL_INJECTED, "1");
    return;
  }

  const videoId = getVideoIdFromCard(contentImageEl);
  if (!videoId) return;

  contentImageEl.setAttribute(CARD_WL_INJECTED, "1");
  mount.setAttribute(CARD_WL_INJECTED, "1");

  const locationClass = isResults ? "results" : (isShorts ? "shortsHomePage" : "home");
  const btn = document.createElement("div");
  btn.className = `saveToWatchLater ${locationClass}`;
  btn.dataset.defaultTitle = WL_TEXT.defaultTitle;
  btn.dataset.videoId = videoId;
  btn.title = WL_TEXT.defaultTitle;
  decorateButtonAccessibility(btn);

  if (!isResults && window.getComputedStyle(mount).position === "static") {
    mount.style.position = "relative";
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
  const videoId = btn.dataset.videoId;
  if (videoId) handleWatchLaterToggle(btn, videoId);
}, true);

function injectIntoAllCards() {
  document.querySelectorAll(CARD_IMAGE_NOT_INJECTED_SELECTOR).forEach(addWatchLaterToCard);
}

let cardObserver = null;
let cardInjectTimer = null;

function startCardObserver() {
  if (cardObserver) cardObserver.disconnect();

  const target = document.querySelector("ytd-app, #contents, #primary") || document.body;
  cardObserver = new MutationObserver(() => {
    if (cardInjectTimer) return;
    cardInjectTimer = setTimeout(() => {
      cardInjectTimer = null;
      injectIntoAllCards();
    }, 200);
  });
  cardObserver.observe(target, { childList: true, subtree: true });
}

function onNavigation() {
  clearButtonUndoState(saveTo);
  mountWatchButton();
  startWatchObserver();
  injectIntoAllCards();
  startCardObserver();
}

document.addEventListener("yt-navigate-finish", onNavigation);
window.addEventListener("popstate", onNavigation);

// Initial bootstrap
onNavigation();

