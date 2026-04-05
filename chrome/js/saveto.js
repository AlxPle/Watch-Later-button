/**
 * YouTube Watch Later Button Extension v1.4.0
 *
 * STABILITY IMPROVEMENTS:
 * 1. Added timeout to waitForElm (max 10 seconds)
 * 2. Added timeout-based disconnect to observeActionsBlock (30 seconds)
 * 3. Added retry logic with exponential backoff to addSaveToButton (max 5 retries)
 * 4. Added popstate listener for SPA navigation handling
 * 5. Removed debug code (console.log "find menu"/"nope")
 */

/* Create saveTo button element */
const saveTo = document.createElement("div");
saveTo.id = "saveToPlaylist";
saveTo.className = "saveToWatchLater";

let actionsObserver = null;
let actionsObserverTimeoutId = null;
let reinitTimerId = null;
let watchBackfillTimerIds = [];
let reinitAttempts = 0;
let reinitSuccess = 0;
let reinitFailed = 0;

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
function addSaveToButton(retries = 0, maxRetries = 5) {
  const appendItem = document.getElementById("top-level-buttons-computed");

  if (!appendItem) {
    if (!isWatchPage()) {
      return;
    }

    if (retries < maxRetries) {
      const delay = 500 * (retries + 1); // exponential backoff: 500ms, 1s, 1.5s, 2s, 2.5s
      setTimeout(() => addSaveToButton(retries + 1, maxRetries), delay);
      logInfo(`Element not found, retrying... (${retries + 1}/${maxRetries})`);
    } else {
      logInfo(`Skipped: #top-level-buttons-computed not found after ${maxRetries} retries`);
    }
    return;
  }

  if (!document.getElementById("saveToPlaylist")) {
    appendItem.prepend(saveTo);
    logInfo("Button added successfully");
  }
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
    if (!isWatchPage() || document.getElementById("saveToPlaylist")) {
      return;
    }

    addSaveToButton(0, 3);

    // Rebind observer periodically in case YouTube replaced #actions after initial attach.
    if (index === 0 || index === delays.length - 1) {
      observeActionsBlock();
    }

    logInfo(`Backfill attempt ${index + 1}/${delays.length} (trigger=${trigger})`);
  }, delay));
}

/**
 * FIX #2: Add timeout to observer disconnect
 * Observer will disconnect after 30 seconds to prevent memory leaks
 * On SPA navigation, this will be recreated by reinitializeButton()
 */
function observeActionsBlock(timeoutMs = 30000) {
  if (!isWatchPage()) {
    return;
  }

  const target = document.querySelector("#actions");
  if (!target) {
    logInfo("Skip observing #actions: element not found");
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
  logInfo("Observing #actions for changes");

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
 * FIX #1: Add timeout to waitForElm
 * Max wait time: 10 seconds, with proper disconnect on timeout
 * Prevents infinite promise hanging and memory leaks
 */
function waitForElm(selector, maxWaitTime = 10000) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(selector)) {
      logInfo(`Element found immediately: ${selector}`);
      return resolve(document.querySelector(selector));
    }

    const startTime = Date.now();
    const observer = new MutationObserver(() => {
      // Check if element was found
      if (document.querySelector(selector)) {
        observer.disconnect();
        logInfo(`Element found after ${Date.now() - startTime}ms: ${selector}`);
        resolve(document.querySelector(selector));
        return;
      }

      // Check timeout
      if (Date.now() - startTime > maxWaitTime) {
        observer.disconnect();
        handleError(`Timeout (${maxWaitTime}ms) waiting for ${selector}`);
        reject(new Error(`Timeout waiting for ${selector}`));
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    logInfo(`Waiting for element: ${selector} (max ${maxWaitTime}ms)`);
  });
}

/**
 * FIX #4: Add SPA navigation handler
 * YouTube is a Single Page Application - reinitialize on browser navigation
 * Handles back/forward button clicks
 */
function reinitializeButton(eventName = "unknown") {
  reinitAttempts += 1;
  logInfo(`SPA navigation detected, reinitializing... trigger=${eventName}, attempt=${reinitAttempts}`);

  injectIntoAllCards();

  if (!isWatchPage()) {
    logInfo(`Reinit skipped watch-page setup (trigger=${eventName})`);
    return;
  }

  if (reinitTimerId) {
    clearTimeout(reinitTimerId);
    reinitTimerId = null;
  }

  reinitTimerId = setTimeout(() => {
    logInfo(`Reinit trigger: ${eventName}`);
    waitForElm("#actions", 10000)
      .then(() => {
        addSaveToButton();
        observeActionsBlock();
        scheduleWatchButtonBackfill(eventName);
        reinitSuccess += 1;
        logInfo(`Reinit stats: attempts=${reinitAttempts}, success=${reinitSuccess}, failed=${reinitFailed}`);
      })
      .catch((error) => {
        scheduleWatchButtonBackfill(`${eventName}-fallback`);
        reinitFailed += 1;
        handleError(
          `Reinitialization failed (trigger=${eventName}, attempts=${reinitAttempts}, success=${reinitSuccess}, failed=${reinitFailed}):`,
          error,
        );
      });
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

// Fallback URL watcher for edge cases where no SPA events fire.
let lastKnownHref = window.location.href;
setInterval(() => {
  const currentHref = window.location.href;
  if (currentHref !== lastKnownHref) {
    lastKnownHref = currentHref;
    reinitializeButton("url-changed");
  }
}, 700);

// Initial setup
if (isWatchPage()) {
  waitForElm("#actions", 10000)
    .then(() => {
      addSaveToButton();
      observeActionsBlock();
      scheduleWatchButtonBackfill("initial");
    })
    .catch((error) => {
      scheduleWatchButtonBackfill("initial-fallback");
      handleError("Initial setup failed:", error);
    });
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

/**
 * ACTION SENDER
 * Dispatches custom events to YouTube's native API handler
 * Uses the yt-action event system to communicate with YouTube's internal services
 */
const sendActionToNativeYouTubeHandler = (getParams) => {
  try {
    const videoId = new URL(window.location.href).searchParams.get("v");
    const appElement = document.querySelector("ytd-app");

    if (!videoId || !appElement) {
      handleError("Failed: missing videoId or ytd-app element");
      return;
    }

    const event = new window.CustomEvent("yt-action", {
      detail: {
        actionName: "yt-service-request",
        returnValue: [],
        args: [{ data: {} }, getParams(videoId)],
        optionalAction: false,
      },
    });

    appElement.dispatchEvent(event);
    logInfo(`Action sent for video: ${videoId}`);
  } catch (error) {
    handleError("Error sending action:", error);
  }
};

/**
 * Button click handler
 * Dispatches the "Add to Watch Later" action when user clicks the button
 */
saveTo.addEventListener("click", () => {
  try {
    sendActionToNativeYouTubeHandler(getAddVideoParams);
  } catch (error) {
    handleError("Error handling button click:", error);
  }
});

/* ===== CARD INJECTION: Watch Later button on homepage / listing pages ===== */

const CARD_WL_INJECTED = "data-wl-injected";
const CARD_IMAGE_SELECTORS = [
  ".yt-lockup-view-model__content-image",
  "ytd-video-renderer ytd-thumbnail",
  "ytd-rich-item-renderer ytd-thumbnail",
  "ytd-compact-video-renderer ytd-thumbnail",
  "yt-lockup-view-model ytd-thumbnail",
  "ytd-reel-item-renderer ytd-thumbnail"
];

/**
 * Extracts the videoId for a card by walking up the DOM from a card element
 * to a known card container, then querying down for a /watch?v= link.
 */
function getVideoIdFromCard(cardElement) {
  let el = cardElement;
  while (el) {
    if (
      el.matches &&
      el.matches(
        "ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-video-renderer, yt-lockup-view-model, ytd-reel-item-renderer",
      )
    ) {
      const link = el.querySelector('a[href*="/watch?v="]');
      if (link) {
        try {
          return new URL(link.href, location.origin).searchParams.get("v");
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
    return new URL(window.location.href).pathname === "/results";
  } catch (error) {
    return false;
  }
}

/**
 * Returns a stable mounting container for overlay controls so YouTube thumbnail
 * hover-preview DOM swaps do not remove our button.
 */
function getStableCardMount(cardElement) {
  const renderer = cardElement.closest(
    "ytd-video-renderer, ytd-rich-item-renderer, ytd-compact-video-renderer, yt-lockup-view-model, ytd-reel-item-renderer",
  );

  if (!renderer) {
    return { mount: cardElement, locationClass: "home" };
  }

  if (isResultsPage()) {
    const resultsMenu = renderer.querySelector("ytd-menu-renderer");
    if (resultsMenu) {
      return { mount: resultsMenu, locationClass: "results" };
    }

    // On /results we only render inside menu area to avoid duplicate button on thumbnail/player card.
    return { mount: null, locationClass: "results" };
  }

  return { mount: renderer.querySelector("#dismissible") || renderer, locationClass: "home" };
}

/**
 * Injects a Watch Later button into the given card image container.
 * Marks the image container with CARD_WL_INJECTED to avoid double-injection.
 */
function addWatchLaterToCard(contentImageEl) {
  const { mount, locationClass } = getStableCardMount(contentImageEl);
  if (!mount) return;
  if (mount.hasAttribute(CARD_WL_INJECTED)) return;

  const videoId = getVideoIdFromCard(contentImageEl);
  if (!videoId) return;

  mount.setAttribute(CARD_WL_INJECTED, "1");

  const btn = document.createElement("div");
  btn.className = `saveToWatchLater ${locationClass}`;
  btn.title = "Watch Later";

  // Keep absolute button positioning anchored to a stable card-level container.
  if (locationClass === "home" && window.getComputedStyle(mount).position === "static") {
    mount.style.position = "relative";
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const appElement = document.querySelector("ytd-app");
      if (!appElement) return;
      appElement.dispatchEvent(
        new window.CustomEvent("yt-action", {
          detail: {
            actionName: "yt-service-request",
            returnValue: [],
            args: [{ data: {} }, getAddVideoParams(videoId)],
            optionalAction: false,
          },
        }),
      );
      logInfo(`Card WL action sent for video: ${videoId}`);
    } catch (error) {
      handleError("Error sending card WL action:", error);
    }
  });

  if (locationClass === "results") {
    mount.prepend(btn);
  } else {
    mount.appendChild(btn);
  }
}

/** Finds all unprocessed card image containers on the page and injects Watch Later buttons. */
function injectIntoAllCards() {
  const selector = CARD_IMAGE_SELECTORS.map((s) => `${s}:not([${CARD_WL_INJECTED}])`).join(", ");
  document.querySelectorAll(selector).forEach(addWatchLaterToCard);
}

let cardObserver = null;
let cardInjectTimer = null;

/** Starts a MutationObserver on document.body to handle dynamically loaded cards (infinite scroll, SPA navigation). */
function startCardObserver() {
  if (cardObserver) return;
  cardObserver = new MutationObserver(() => {
    if (cardInjectTimer) return;
    cardInjectTimer = setTimeout(() => {
      cardInjectTimer = null;
      injectIntoAllCards();
    }, 300);
  });
  cardObserver.observe(document.body, { childList: true, subtree: true });
  logInfo("Card observer started");
}

// Run immediately and start watching for new cards
injectIntoAllCards();
startCardObserver();
