/* Create saveTo button element */
const saveTo = document.createElement("div");
saveTo.id = "saveToPlaylist";
saveTo.className = "saveToWatchLater";

/* ===== CARD INJECTION CONFIG ===== */
const CARD_WL_INJECTED = "data-wl-injected";
const CARD_IMAGE_SELECTORS = [
  ".yt-lockup-view-model__content-image",
  "yt-lockup-view-model yt-thumbnail-view-model",
  "ytd-rich-item-renderer yt-thumbnail-view-model",
  "ytd-video-renderer yt-thumbnail-view-model",
  "ytd-compact-video-renderer yt-thumbnail-view-model",
  "ytd-video-renderer ytd-thumbnail",
  "ytd-rich-item-renderer ytd-thumbnail",
  "ytd-compact-video-renderer ytd-thumbnail",
  "yt-lockup-view-model ytd-thumbnail",
  "ytd-reel-item-renderer ytd-thumbnail"
];
const CARD_RENDERER_SELECTORS = [
  "ytd-rich-item-renderer",
  "ytd-compact-video-renderer",
  "ytd-video-renderer",
  "yt-lockup-view-model",
  "ytd-reel-item-renderer"
];
const CARD_RENDERER_SELECTOR = CARD_RENDERER_SELECTORS.join(", ");
const RESULTS_CARD_IMAGE_SELECTORS = [
  "ytd-video-renderer ytd-thumbnail",
  "ytd-video-renderer yt-thumbnail-view-model",
  "ytd-compact-video-renderer ytd-thumbnail",
  "ytd-compact-video-renderer yt-thumbnail-view-model",
  "yt-lockup-view-model ytd-thumbnail",
  "yt-lockup-view-model yt-thumbnail-view-model"
];
const RESULTS_CARD_RENDERER_SELECTORS = [
  "ytd-video-renderer",
  "ytd-compact-video-renderer",
  "yt-lockup-view-model"
];
const RESULTS_CARD_RENDERER_SELECTOR = RESULTS_CARD_RENDERER_SELECTORS.join(", ");
const CARD_LINK_SELECTOR = 'a[href*="/watch?v="], a[href*="/shorts/"]';
const CARD_MOUNT_SELECTORS = {
  resultsMenu: ":scope > ytd-menu-renderer",
  resultsMenuFallback: "ytd-menu-renderer",
  resultsPrimary: "#dismissible",
  homePrimary: "#dismissible"
};
const RESULTS_PATHNAME = "/results";
const CARD_LOCATION_CLASS = {
  home: "home",
  results: "results",
  shortsHome: "shortsHomePage"
};
const SHORTS_SHELF_SELECTOR = "ytd-rich-shelf-renderer[is-shorts], ytd-reel-shelf-renderer";
const CARD_MOUNT_BEHAVIOR = {
  skipOnResultsWithoutMenu: true,
  resultsInsertion: "prepend",
  homeInsertion: "append"
};
const CARD_SCAN_ROOT_SELECTORS = {
  results: [
    "ytd-search #contents",
    "ytd-two-column-search-results-renderer #primary",
    "#primary"
  ],
  browse: [
    "ytd-browse[page-subtype='home'] #contents",
    "ytd-rich-grid-renderer #contents",
    "#contents.ytd-rich-grid-renderer"
  ]
};
const AD_RENDERER_SELECTORS = [
  "ytd-ad-slot-renderer",
  "ytd-promoted-video-renderer",
  "ytd-display-ad-renderer",
  "ytd-promoted-sparkles-web-renderer"
];
const AD_BADGE_SELECTOR = "ytd-badge-supported-renderer.badge-style-type-ad";
const WATCH_BUTTON_MOUNT_SELECTORS = [
  "ytd-watch-metadata ytd-menu-renderer.style-scope.ytd-watch-metadata",
  "ytd-watch-metadata ytd-menu-renderer",
  "#top-level-buttons-computed",
  "ytd-watch-metadata #top-level-buttons-computed"
];
const WATCH_OBSERVER_TARGET_SELECTORS = [
  "ytd-watch-flexy",
  "ytd-watch-metadata",
  "#above-the-fold",
  "#columns",
  "body"
];
const SHORTS_ACTION_BAR_SELECTOR = "reel-action-bar-view-model";
const SHORTS_BUTTON_MOUNT_SELECTORS = [SHORTS_ACTION_BAR_SELECTOR];
const SHORTS_OBSERVER_TARGET_SELECTORS = [SHORTS_ACTION_BAR_SELECTOR, "ytd-shorts", "body"];
const WATCH_LATER_ACTION = {
  add: "add",
  remove: "remove"
};
const WL_ADDED_CLASS = "is-added";
const WL_UNDO_ACTIVE_CLASS = "is-undo-active";
const WL_ERROR_CLASS = "is-error";
const WL_UNDO_WINDOW_MS = 10000;
const WL_ERROR_FLASH_MS = 800;
const REINIT_DEDUP_WINDOW_MS = 350;

let actionsObserver = null;
let actionsObserverTimeoutId = null;
let reinitTimerId = null;
let watchBackfillTimerIds = [];
let cardObserver = null;
let cardObserverTarget = null;
let cardInjectTimer = null;
let isInjectingCards = false;
let cardInjectRunAgain = false;
let reinitAttempts = 0;
let reinitSuccess = 0;
let reinitFailed = 0;
let lastReinitKey = "";
let lastReinitAt = 0;
const buttonUndoState = new WeakMap();
const buttonErrorState = new WeakMap();

function getI18nMessage(key, fallback) {
  try {
    const msg = chrome?.i18n?.getMessage?.(key);
    return msg || fallback;
  } catch (error) {
    return fallback;
  }
}

const WL_TEXT = {
  defaultTitle: getI18nMessage("wlButtonDefaultTitle", "Watch Later"),
  deleteTitle: getI18nMessage("wlButtonDeleteTitle", "Delete from Watch Later"),
};

saveTo.dataset.defaultTitle = WL_TEXT.defaultTitle;
saveTo.title = saveTo.dataset.defaultTitle;

// Persist URL debug flag to sessionStorage before YouTube strips it via history.replaceState
(function persistUrlDebugFlag() {
  try {
    if (new URL(window.location.href).searchParams.get("watchLaterDebug") === "1") {
      window.sessionStorage.setItem("watchLaterDebug", "1");
    }
  } catch (e) { }
})();

function getStorageDebugFlag(storage) {
  try {
    return storage && storage.getItem("watchLaterDebug") === "1";
  } catch (error) {
    return false;
  }
}

function isDebugEnabled() {
  try {
    if (window.__WATCH_LATER_DEBUG__ === true) {
      return true;
    }

    if (getStorageDebugFlag(window.localStorage) || getStorageDebugFlag(window.sessionStorage)) {
      return true;
    }

    return new URL(window.location.href).searchParams.get("watchLaterDebug") === "1";
  } catch (error) {
    return false;
  }
}

function logInfo(msg, ...args) {
  if (isDebugEnabled()) {
    console.log(`[Watch Later] ${msg}`, ...args);
  }
}

function isWatchPage() {
  try {
    const url = new URL(window.location.href);
    return url.pathname === "/watch" && Boolean(url.searchParams.get("v"));
  } catch (error) {
    return false;
  }
}

function isShortsPage() {
  try {
    const url = new URL(window.location.href);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[0] === "shorts";
  } catch (error) {
    return false;
  }
}

function isWatchOrShortsPage() {
  return isWatchPage() || isShortsPage();
}

function getActiveMountSelectors() {
  return isShortsPage() ? SHORTS_BUTTON_MOUNT_SELECTORS : WATCH_BUTTON_MOUNT_SELECTORS;
}

function getActiveObserverTargetSelectors() {
  return isShortsPage() ? SHORTS_OBSERVER_TARGET_SELECTORS : WATCH_OBSERVER_TARGET_SELECTORS;
}

function getCurrentReinitKey() {
  try {
    const url = new URL(window.location.href);
    const videoId = url.searchParams.get("v") || "";
    return `${url.pathname}?v=${videoId}`;
  } catch (error) {
    return window.location.href;
  }
}

/* Error handler function with [Watch Later] prefix for better debugging */
function handleError(msg, error) {
  if (error) {
    console.error(`[Watch Later] ${msg}`, error);
  } else {
    console.error(`[Watch Later] ${msg}`);
  }
}

/**
 * FIX #3: Add retry logic with exponential backoff
 * Retry up to 5 times if #top-level-buttons-computed not found
 * This solves race condition where appendItem is not yet in DOM
 */
function findFirstExistingElement(selectors) {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      return el;
    }
  }

  return null;
}

function findShortsActionBarElement() {
  if (!isShortsPage()) {
    return null;
  }

  return document.querySelector(SHORTS_ACTION_BAR_SELECTOR);
}

function addSaveToButton(retries = 0, maxRetries = 5) {
  const isShorts = isShortsPage();
  const appendItem = isShorts
    ? findShortsActionBarElement() || findFirstExistingElement(getActiveMountSelectors())
    : findFirstExistingElement(getActiveMountSelectors());

  if (!appendItem) {
    if (!isWatchOrShortsPage()) {
      return;
    }

    if (retries < maxRetries) {
      const delay = 500 * (retries + 1); // exponential backoff: 500ms, 1s, 1.5s, 2s, 2.5s
      setTimeout(() => addSaveToButton(retries + 1, maxRetries), delay);
      logInfo(`Element not found, retrying... (${retries + 1}/${maxRetries})`);
    } else {
      logInfo(`Skipped: mount selector not found after ${maxRetries} retries`);
    }
    return;
  }

  saveTo.classList.toggle("shortsPage", isShorts);

  if (isShorts) {
    if (saveTo.parentElement !== appendItem || appendItem.lastElementChild !== saveTo) {
      appendItem.append(saveTo);
      logInfo("Button added successfully", appendItem.tagName, appendItem.className || "", "inside reel-action-bar-view-model");
    }

    return;
  }

  if (saveTo.parentElement !== appendItem || appendItem.lastElementChild !== saveTo) {
    appendItem.append(saveTo);
    logInfo("Button added successfully", appendItem.tagName, appendItem.className || "");
  }
}

function hasWatchButtonReadyTarget() {
  if (isShortsPage()) {
    return Boolean(findShortsActionBarElement() || findFirstExistingElement(getActiveMountSelectors()));
  }

  return Boolean(findFirstExistingElement(getActiveMountSelectors()));
}

function waitForWatchButtonTarget(maxWaitTime = 10000) {
  return new Promise((resolve, reject) => {
    if (hasWatchButtonReadyTarget()) {
      logInfo("Watch button target found immediately");
      resolve(true);
      return;
    }

    const startTime = Date.now();
    let settled = false;

    const observer = new MutationObserver(() => {
      if (hasWatchButtonReadyTarget()) {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        observer.disconnect();
        logInfo(`Watch button target found after ${Date.now() - startTime}ms`);
        resolve(true);
      }
    });

    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      logInfo(`Watch button target timeout (${maxWaitTime}ms); continue with fallback`);
      resolve(false);
    }, maxWaitTime);

    observer.observe(document.documentElement, { childList: true, subtree: true });
    logInfo(`Waiting for watch button target (max ${maxWaitTime}ms)`);
  });
}

function removeStaleWatchButton() {
  if (isWatchOrShortsPage()) {
    return;
  }

  clearButtonUndoState(saveTo);

  if (saveTo.parentElement) {
    saveTo.remove();
    logInfo("Removed stale watch button outside watch page");
  }
}

function isWatchButtonMountedInPreferredContainer() {
  if (!saveTo.parentElement) {
    return false;
  }

  if (isShortsPage()) {
    const actionBarElement = findShortsActionBarElement();
    return saveTo.parentElement === actionBarElement
      && actionBarElement?.lastElementChild === saveTo;
  }

  return getActiveMountSelectors().some((selector) => saveTo.parentElement.matches(selector));
}

function clearWatchBackfillTimers() {
  watchBackfillTimerIds.forEach((timerId) => clearTimeout(timerId));
  watchBackfillTimerIds = [];
}

/**
 * Schedules delayed retries after SPA navigation.
 * YouTube often re-renders watch metadata asynchronously, so a single init pass can miss the final mount point.
 */
function scheduleWatchButtonBackfill(trigger = "unknown") {
  clearWatchBackfillTimers();

  const delays = [400, 1200, 2500, 4500, 7000];
  watchBackfillTimerIds = delays.map((delay, index) => setTimeout(() => {
    if (!isWatchOrShortsPage() || isWatchButtonMountedInPreferredContainer()) {
      return;
    }

    addSaveToButton(0, 3);

    // Rebind observer periodically in case YouTube replaced #actions after initial attach.
    if (index === 0 || index === delays.length - 1) {
      observeWatchPage();
    }

    logInfo(`Backfill attempt ${index + 1}/${delays.length} (trigger=${trigger})`);
  }, delay));
}

/**
 * FIX #2: Add timeout to observer disconnect
 * Observer will disconnect after 30 seconds to prevent memory leaks
 * On SPA navigation, this will be recreated by reinitializeButton()
 */
function observeWatchPage(timeoutMs = 30000) {
  if (!isWatchOrShortsPage()) {
    return;
  }

  let target = null;
  let targetSelector = "unknown";

  if (isShortsPage()) {
    target = findShortsActionBarElement();
    if (target) {
      targetSelector = SHORTS_ACTION_BAR_SELECTOR;
    }
  }

  if (!target) {
    for (const selector of getActiveObserverTargetSelectors()) {
      const el = document.querySelector(selector);
      if (el) {
        target = el;
        targetSelector = selector;
        break;
      }
    }
  }

  if (!target) {
    logInfo("Skip observing watch page: no stable observer target found");
    return;
  }

  if (actionsObserver) {
    actionsObserver.disconnect();
    actionsObserver = null;
  }

  if (actionsObserverTimeoutId) {
    clearTimeout(actionsObserverTimeoutId);
    actionsObserverTimeoutId = null;
  }

  actionsObserver = new MutationObserver(() => {
    addSaveToButton();
  });

  actionsObserver.observe(target, { childList: true, subtree: true });
  logInfo(`Observing watch page changes via ${targetSelector}`);

  // Auto-disconnect after timeout to prevent memory leak
  // (on SPA navigation, new observer will be created by popstate handler)
  actionsObserverTimeoutId = setTimeout(() => {
    if (actionsObserver) {
      actionsObserver.disconnect();
      actionsObserver = null;
    }
    actionsObserverTimeoutId = null;
    logInfo("Observer disconnected (timeout)");
  }, timeoutMs);
}

/**
 * FIX #4: Add SPA navigation handler
 * YouTube is a Single Page Application - reinitialize on browser navigation
 * Handles back/forward button clicks
 */
function reinitializeButton(eventName = "unknown") {
  const reinitKey = getCurrentReinitKey();
  const now = Date.now();
  if (reinitKey === lastReinitKey && now - lastReinitAt < REINIT_DEDUP_WINDOW_MS) {
    logInfo(`Reinit dedup skipped: trigger=${eventName}, key=${reinitKey}`);
    return;
  }

  lastReinitKey = reinitKey;
  lastReinitAt = now;

  reinitAttempts += 1;
  logInfo(`SPA navigation detected, reinitializing... trigger=${eventName}, attempt=${reinitAttempts}`);

  // Reset transient visual states before remount/rebind to avoid stale undo UI on SPA transitions.
  clearButtonUndoState(saveTo);

  removeStaleWatchButton();

  injectIntoAllCards();
  startCardObserver(true);

  if (!isWatchOrShortsPage()) {
    logInfo(`Reinit skipped watch-page setup (trigger=${eventName})`);
    return;
  }

  if (reinitTimerId) {
    clearTimeout(reinitTimerId);
    reinitTimerId = null;
  }

  // Early pass for home/results -> watch transitions where metadata mounts late.
  addSaveToButton(0, 1);
  observeWatchPage();
  scheduleWatchButtonBackfill(`${eventName}-early`);

  reinitTimerId = setTimeout(async () => {
    logInfo(`Reinit trigger: ${eventName}`);
    try {
      await waitForWatchButtonTarget(10000);
      addSaveToButton();
      observeWatchPage();
      scheduleWatchButtonBackfill(eventName);
      reinitSuccess += 1;
      logInfo(`Reinit stats: attempts=${reinitAttempts}, success=${reinitSuccess}, failed=${reinitFailed}`);
    } catch (error) {
      scheduleWatchButtonBackfill(`${eventName}-fallback`);
      reinitFailed += 1;
      handleError(
        `Reinitialization failed (trigger=${eventName}, attempts=${reinitAttempts}, success=${reinitSuccess}, failed=${reinitFailed}):`,
        error,
      );
    }
  }, 150);
}

// Listen to browser back/forward navigation
window.addEventListener("popstate", () => reinitializeButton("popstate"));

// Listen to YouTube SPA events (more reliable than popstate on YouTube)
window.addEventListener("yt-navigate-finish", () => reinitializeButton("yt-navigate-finish"));
window.addEventListener("yt-page-data-updated", () => reinitializeButton("yt-page-data-updated"));
document.addEventListener("yt-navigate-finish", () => reinitializeButton("doc-yt-navigate-finish"), true);
document.addEventListener("yt-page-data-updated", () => reinitializeButton("doc-yt-page-data-updated"), true);

// Hook history API because YouTube SPA may navigate without reliably bubbling events to window.
(function patchHistoryForSpaNavigation() {
  try {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      reinitializeButton("history.pushState");
      return result;
    };

    history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args);
      reinitializeButton("history.replaceState");
      return result;
    };
  } catch (error) {
    logInfo("History patch failed", error);
  }
})();

// Event-driven fallback URL watcher for edge cases where no SPA events fire.
let lastKnownHref = window.location.href;
function checkUrlOnce(trigger = "fallback") {
  const currentHref = window.location.href;
  if (currentHref !== lastKnownHref) {
    lastKnownHref = currentHref;
    reinitializeButton(`url-changed:${trigger}`);
  }
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    checkUrlOnce("visibilitychange");
  }
});

window.addEventListener("focus", () => {
  checkUrlOnce("focus");
});

window.addEventListener("pageshow", () => {
  checkUrlOnce("pageshow");
});

// Initial setup
if (isWatchOrShortsPage()) {
  (async () => {
    try {
      await waitForWatchButtonTarget(10000);
      addSaveToButton();
      observeWatchPage();
      scheduleWatchButtonBackfill("initial");
    } catch (error) {
      scheduleWatchButtonBackfill("initial-fallback");
      handleError("Initial setup failed:", error);
    }
  })();
}

/**
 * Function: getAddVideoParams
 * Returns parameters to add a video to the Watch Later playlist
 *
 * Parameters:
 *   - videoId: The ID of the video to be added
 * Returns:
 *   Object with click tracking params, command metadata, and playlist edit endpoint
 */
const getAddVideoParams = (videoId) => ({
  clickTrackingParams: "",
  commandMetadata: { webCommandMetadata: { sendPost: true, apiUrl: "/youtubei/v1/browse/edit_playlist" } },
  playlistEditEndpoint: { playlistId: "WL", actions: [{ addedVideoId: videoId, action: "ACTION_ADD_VIDEO" }] },
});

/**
 * Function: getRemoveVideoParams
 * Returns parameters to remove a video from the Watch Later playlist
 *
 * Parameters:
 *   - videoId: The ID of the video to be removed
 * Returns:
 *   Object with click tracking parameters, command metadata, and playlist edit endpoint
 */
const getRemoveVideoParams = (videoId) => ({
  clickTrackingParams: "",
  commandMetadata: { webCommandMetadata: { sendPost: true, apiUrl: "/youtubei/v1/browse/edit_playlist" } },
  playlistEditEndpoint: { playlistId: "WL", actions: [{ action: "ACTION_REMOVE_VIDEO_BY_VIDEO_ID", removedVideoId: videoId }] },
});

function resolveCurrentVideoId() {
  try {
    const url = new URL(window.location.href);
    const watchVideoId = url.searchParams.get("v");
    if (watchVideoId) {
      return watchVideoId;
    }

    if (isShortsPage()) {
      const shortsPathId = url.pathname.split("/").filter(Boolean)[1];
      if (shortsPathId) {
        return shortsPathId;
      }

      const canonicalHref = document.querySelector('link[rel="canonical"]')?.href;
      if (canonicalHref) {
        try {
          const canonicalUrl = new URL(canonicalHref, location.origin);
          const canonicalParts = canonicalUrl.pathname.split("/").filter(Boolean);
          if (canonicalParts[0] === "shorts" && canonicalParts[1]) {
            return canonicalParts[1];
          }
        } catch (error) { }
      }

      const activeShortsLink = document.querySelector(
        'ytd-reel-video-renderer[is-active] a[href*="/shorts/"], ytd-reel-video-renderer a[href*="/shorts/"]'
      );
      if (activeShortsLink?.href) {
        try {
          const activeShortsUrl = new URL(activeShortsLink.href, location.origin);
          const activeParts = activeShortsUrl.pathname.split("/").filter(Boolean);
          if (activeParts[0] === "shorts" && activeParts[1]) {
            return activeParts[1];
          }
        } catch (error) { }
      }

      return null;
    }
  } catch (error) {
    return null;
  }

  return null;
}

function buildWatchLaterParams(action, videoId) {
  if (action === WATCH_LATER_ACTION.add) {
    return getAddVideoParams(videoId);
  }

  if (action === WATCH_LATER_ACTION.remove) {
    return getRemoveVideoParams(videoId);
  }

  return null;
}

function dispatchNativeYouTubeAction(params) {
  const appElement = document.querySelector("ytd-app");
  if (!appElement) {
    return { ok: false, status: "no-app-element" };
  }

  let detail = {
    actionName: "yt-service-request",
    returnValue: [],
    args: [{ data: {} }, params],
    optionalAction: false,
  };

  if (typeof cloneInto !== "undefined") {
    detail = cloneInto(detail, document.defaultView);
  }

  appElement.dispatchEvent(
    new window.CustomEvent("yt-action", {
      bubbles: true,
      composed: true,
      detail,
    }),
  );

  return { ok: true, status: "sent" };
}

/**
 * ACTION SENDER
 * Dispatches custom events to YouTube's native API handler
 * Uses the yt-action event system to communicate with YouTube's internal services
 */
const executeWatchLaterAction = (action, explicitVideoId = null) => {
  try {
    const videoId = explicitVideoId || resolveCurrentVideoId();
    if (!videoId) {
      return { ok: false, status: "no-video-id" };
    }

    const params = buildWatchLaterParams(action, videoId);
    if (!params) {
      return { ok: false, status: "unsupported-action", videoId };
    }

    const result = dispatchNativeYouTubeAction(params);
    if (!result.ok) {
      return { ...result, videoId, action };
    }

    logInfo(`Action ${action} sent for video: ${videoId}`);
    return { ok: true, status: "sent", videoId, action };
  } catch (error) {
    return { ok: false, status: "exception", action, error };
  }
};

function decorateButtonAccessibility(button) {
  const defaultTitle = button.dataset.defaultTitle || WL_TEXT.defaultTitle;
  button.setAttribute("role", "button");
  button.setAttribute("aria-label", defaultTitle);
}

function flashButtonErrorState(button) {
  const existingTimer = buttonErrorState.get(button);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  button.classList.remove(WL_ERROR_CLASS);
  // Restart animation when class is re-applied quickly.
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
  if (undoState && undoState.timerId) {
    clearTimeout(undoState.timerId);
  }

  buttonUndoState.delete(button);
  button.classList.remove(WL_ADDED_CLASS);
  button.classList.remove(WL_UNDO_ACTIVE_CLASS);
  button.title = button.dataset.defaultTitle || WL_TEXT.defaultTitle;
  button.setAttribute("aria-label", button.dataset.defaultTitle || WL_TEXT.defaultTitle);
}

function setButtonUndoState(button, videoId) {
  clearButtonUndoState(button);

  button.classList.add(WL_ADDED_CLASS);
  button.classList.add(WL_UNDO_ACTIVE_CLASS);
  button.style.setProperty("--wl-undo-ms", `${WL_UNDO_WINDOW_MS}ms`);
  button.title = WL_TEXT.deleteTitle;
  button.setAttribute("aria-label", WL_TEXT.deleteTitle);

  const timerId = setTimeout(() => {
    const state = buttonUndoState.get(button);
    if (!state || state.videoId !== videoId) {
      return;
    }

    clearButtonUndoState(button);
  }, WL_UNDO_WINDOW_MS);

  buttonUndoState.set(button, { timerId, videoId });
}

function handleWatchLaterToggle(button, explicitVideoId = null) {
  const resolvedVideoId = explicitVideoId || resolveCurrentVideoId();
  if (!resolvedVideoId) {
    flashButtonErrorState(button);
    handleError("Failed: missing videoId");
    return;
  }

  const undoState = buttonUndoState.get(button);
  if (undoState && undoState.videoId === resolvedVideoId) {
    const removeResult = executeWatchLaterAction(WATCH_LATER_ACTION.remove, resolvedVideoId);
    if (!removeResult.ok) {
      flashButtonErrorState(button);
      handleError(`Remove action failed (status=${removeResult.status})`, removeResult.error);
      return;
    }

    clearButtonUndoState(button);
    return;
  }

  const addResult = executeWatchLaterAction(WATCH_LATER_ACTION.add, resolvedVideoId);
  if (!addResult.ok) {
    flashButtonErrorState(button);
    handleError(`Add action failed (status=${addResult.status})`, addResult.error);
    return;
  }

  setButtonUndoState(button, resolvedVideoId);
}

/**
 * Button click handler
 * Dispatches the "Add to Watch Later" action when user clicks the button
 */
saveTo.addEventListener("click", () => {
  try {
    handleWatchLaterToggle(saveTo);
  } catch (error) {
    flashButtonErrorState(saveTo);
    handleError("Error handling button click:", error);
  }
});

decorateButtonAccessibility(saveTo);

/* ===== CARD INJECTION: Watch Later button on homepage / listing pages ===== */

/**
 * Extracts the videoId for a card by walking up the DOM from a card element
 * to a known card container, then querying down for a /watch?v= link.
 */
function getVideoIdFromCard(cardElement) {
  const rendererSelector = isResultsPage() ? RESULTS_CARD_RENDERER_SELECTOR : CARD_RENDERER_SELECTOR;
  let el = cardElement;
  while (el) {
    if (el.matches && el.matches(rendererSelector)) {
      const link = el.querySelector(CARD_LINK_SELECTOR);
      if (link) {
        try {
          const url = new URL(link.href, location.origin);
          const watchId = url.searchParams.get("v");
          if (watchId) return watchId;
          const parts = url.pathname.split("/").filter(Boolean);
          if (parts[0] === "shorts" && parts[1]) return parts[1];
        } catch (e) { }
      }
      break;
    }
    el = el.parentElement;
  }
  return null;
}

function isResultsPage() {
  try {
    return new URL(window.location.href).pathname === RESULTS_PATHNAME;
  } catch (error) {
    return false;
  }
}

function findFirstExistingInRoot(root, selectors) {
  for (const selector of selectors) {
    const el = root.querySelector(selector);
    if (el) {
      return el;
    }
  }

  return null;
}

function getCardScanRoot() {
  const selectorSet = isResultsPage() ? CARD_SCAN_ROOT_SELECTORS.results : CARD_SCAN_ROOT_SELECTORS.browse;
  return findFirstExistingInRoot(document, selectorSet) || document;
}

function isLikelyAdRenderer(renderer) {
  if (!renderer) {
    return false;
  }

  if (renderer.matches(AD_RENDERER_SELECTORS.join(", "))) {
    return true;
  }

  return Boolean(renderer.querySelector(`${AD_RENDERER_SELECTORS.join(", ")}, ${AD_BADGE_SELECTOR}`));
}

/**
 * Returns a stable mounting container for overlay controls so YouTube thumbnail
 * hover-preview DOM swaps do not remove our button.
 */
function getStableCardMount(cardElement) {
  const renderer = cardElement.closest(isResultsPage() ? RESULTS_CARD_RENDERER_SELECTOR : CARD_RENDERER_SELECTOR);

  if (!renderer) {
    return { renderer: null, mount: cardElement, locationClass: CARD_LOCATION_CLASS.home };
  }

  if (renderer.closest(SHORTS_SHELF_SELECTOR)) {
    return {
      renderer,
      mount: renderer.querySelector(CARD_MOUNT_SELECTORS.homePrimary) || renderer,
      locationClass: CARD_LOCATION_CLASS.shortsHome
    };
  }

  if (isResultsPage()) {
    const resultsMenu = renderer.querySelector(CARD_MOUNT_SELECTORS.resultsMenu)
      || renderer.querySelector(CARD_MOUNT_SELECTORS.resultsMenuFallback);
    if (resultsMenu) {
      return { renderer, mount: resultsMenu, locationClass: CARD_LOCATION_CLASS.results };
    }

    const resultsPrimary = renderer.querySelector(CARD_MOUNT_SELECTORS.resultsPrimary);
    if (resultsPrimary) {
      return { renderer, mount: resultsPrimary, locationClass: CARD_LOCATION_CLASS.home };
    }

    // On /results we only render inside menu area to avoid duplicate button on thumbnail/player card.
    if (CARD_MOUNT_BEHAVIOR.skipOnResultsWithoutMenu) {
      return { renderer, mount: null, locationClass: CARD_LOCATION_CLASS.results };
    }

    return { renderer, mount: renderer, locationClass: CARD_LOCATION_CLASS.home };
  }

  return {
    renderer,
    mount: renderer.querySelector(CARD_MOUNT_SELECTORS.homePrimary) || renderer,
    locationClass: CARD_LOCATION_CLASS.home
  };
}

/**
 * Injects a Watch Later button into the given card image container.
 * Marks the image container with CARD_WL_INJECTED to avoid double-injection.
 */
function addWatchLaterToCard(contentImageEl) {
  if (contentImageEl.hasAttribute(CARD_WL_INJECTED)) return;

  const { renderer, mount, locationClass } = getStableCardMount(contentImageEl);
  if (isLikelyAdRenderer(renderer)) {
    // Skip promoted/ad cards and mark them processed to avoid repeated expensive checks.
    contentImageEl.setAttribute(CARD_WL_INJECTED, "1");
    return;
  }

  if (!mount) {
    // Mount point may appear later on async YouTube renders (especially on /results).
    // Keep this element retryable instead of permanently marking it as injected.
    return;
  }
  if (mount.hasAttribute(CARD_WL_INJECTED)) {
    contentImageEl.setAttribute(CARD_WL_INJECTED, "1");
    return;
  }

  const videoId = getVideoIdFromCard(contentImageEl);
  if (!videoId) {
    // Video link can be attached lazily; retry on future observer cycles.
    return;
  }

  contentImageEl.setAttribute(CARD_WL_INJECTED, "1");
  mount.setAttribute(CARD_WL_INJECTED, "1");

  const btn = document.createElement("div");
  btn.className = `saveToWatchLater ${locationClass}`;
  btn.dataset.defaultTitle = WL_TEXT.defaultTitle;
  btn.title = btn.dataset.defaultTitle;
  decorateButtonAccessibility(btn);

  // Keep absolute button positioning anchored to a stable card-level container.
  if ((locationClass === CARD_LOCATION_CLASS.home || locationClass === CARD_LOCATION_CLASS.shortsHome) && window.getComputedStyle(mount).position === "static") {
    mount.style.position = "relative";
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      handleWatchLaterToggle(btn, videoId);
    } catch (error) {
      flashButtonErrorState(btn);
      handleError("Error sending card WL action:", error);
    }
  });

  const insertionMode = locationClass === CARD_LOCATION_CLASS.results
    ? CARD_MOUNT_BEHAVIOR.resultsInsertion
    : CARD_MOUNT_BEHAVIOR.homeInsertion;

  if (insertionMode === "prepend") {
    mount.prepend(btn);
  } else {
    mount.appendChild(btn);
  }
}

/**
 * Finds unprocessed card image containers and injects Watch Later buttons in small rAF batches.
 * Batching keeps the main thread responsive on long YouTube feeds.
 */
async function injectIntoAllCards() {
  if (isInjectingCards) {
    cardInjectRunAgain = true;
    return;
  }

  isInjectingCards = true;

  try {
    do {
      cardInjectRunAgain = false;
      const activeCardImageSelectors = isResultsPage() ? RESULTS_CARD_IMAGE_SELECTORS : CARD_IMAGE_SELECTORS;
      const selector = activeCardImageSelectors.map((s) => `${s}:not([${CARD_WL_INJECTED}])`).join(", ");
      const scanRoot = getCardScanRoot();
      const targets = Array.from(scanRoot.querySelectorAll(selector));
      const BATCH_SIZE = 25;

      for (let i = 0; i < targets.length; i += BATCH_SIZE) {
        await new Promise((resolve) => {
          requestAnimationFrame(() => {
            const batch = targets.slice(i, i + BATCH_SIZE);
            batch.forEach(addWatchLaterToCard);
            resolve();
          });
        });

        if (globalThis.scheduler?.yield) {
          await scheduler.yield();
        }
      }
    } while (cardInjectRunAgain);
  } finally {
    isInjectingCards = false;
  }
}

/** Starts a MutationObserver on document.body to handle dynamically loaded cards (infinite scroll, SPA navigation). */
function startCardObserver(forceRebind = false) {
  const nextTarget = getCardScanRoot();

  if (!forceRebind && cardObserver && cardObserverTarget === nextTarget) {
    return;
  }

  if (cardObserver) {
    cardObserver.disconnect();
    cardObserver = null;
  }

  cardObserver = new MutationObserver(() => {
    if (cardInjectTimer) return;
    cardInjectTimer = setTimeout(() => {
      cardInjectTimer = null;
      void injectIntoAllCards();
    }, 300);
  });
  cardObserver.observe(nextTarget, { childList: true, subtree: true });
  cardObserverTarget = nextTarget;
  logInfo("Card observer started");
}

function initializeCardInjection() {
  void injectIntoAllCards();
  startCardObserver();
}

// Run immediately and start watching for new cards
initializeCardInjection();
