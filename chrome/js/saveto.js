/**
 * Configuration constants for the Watch Later button extension
 */
const CONFIG = {
  BUTTON_ID: "saveToPlaylist",
  BUTTON_CLASS: "saveToWatchLater",
  SELECTORS: {
    ACTIONS: "#actions",
    TOP_LEVEL_BUTTONS: "#top-level-buttons-computed",
    YTD_APP: "ytd-app"
  },
  PLAYLIST_ID: "WL",
  API_URL: "/youtubei/v1/browse/edit_playlist"
};

/**
 * Create the Watch Later button element
 * For more information about MutationObserver:
 * - https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
 */
const saveTo = document.createElement("div");
saveTo.id = CONFIG.BUTTON_ID;
saveTo.className = CONFIG.BUTTON_CLASS;

/**
 * Handles and logs errors that occur in the extension
 * @param {string} msg - The error message to display
 * @param {Error} [error] - Optional error object with additional details
 */
function handleError(msg, error) {
  if (error) {
    console.error(msg, error);
  } else {
    console.error(msg);
  }
}

/**
 * Adds the Watch Later button to the page if it's not already present
 * The button is prepended to the top-level buttons container
 */
function addSaveToButton() {
  const appendItem = document.getElementById(CONFIG.SELECTORS.TOP_LEVEL_BUTTONS.substring(1));
  if (!appendItem) return;
  if (!document.getElementById(CONFIG.BUTTON_ID)) {
    appendItem.prepend(saveTo);
    console.log("'Save to Watch Later' button added");
  }
}

/**
 * Observes changes in the #actions block to handle YouTube's SPA navigation
 * Re-adds the button when the DOM changes during page transitions
 */
function observeActionsBlock() {
  const target = document.querySelector(CONFIG.SELECTORS.ACTIONS);
  if (!target) return;

  // Watch for changes inside #actions (for SPA navigation)
  const observer = new MutationObserver(() => {
    addSaveToButton();
  });

  observer.observe(target, { childList: true, subtree: true });
}

/**
 * Waits for an element to appear in the DOM
 * @param {string} selector - CSS selector for the element to wait for
 * @returns {Promise<Element>} Promise that resolves when element is found
 */
function waitForElm(selector) {
  return new Promise((resolve) => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }
    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        resolve(document.querySelector(selector));
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

waitForElm(CONFIG.SELECTORS.ACTIONS)
  .then(() => {
    addSaveToButton();
    observeActionsBlock();
  })
  .catch((error) => {
    handleError("Error while waiting for #actions element:", error);
  });

/**
 * Returns the parameters object needed to add a video to the Watch Later playlist
 * @param {string} videoId - The ID of the video to be added
 * @returns {Object} YouTube API request parameters for adding a video
 */
const getAddVideoParams = (videoId) => ({
  clickTrackingParams: "",
  commandMetadata: { 
    webCommandMetadata: { 
      sendPost: true, 
      apiUrl: CONFIG.API_URL 
    } 
  },
  playlistEditEndpoint: { 
    playlistId: CONFIG.PLAYLIST_ID, 
    actions: [{ 
      addedVideoId: videoId, 
      action: "ACTION_ADD_VIDEO" 
    }] 
  },
});

/**
 * Returns the parameters object needed to remove a video from the Watch Later playlist
 * @param {string} videoId - The ID of the video to be removed
 * @returns {Object} YouTube API request parameters for removing a video
 */
const getRemoveVideoParams = (videoId) => ({
  clickTrackingParams: "",
  commandMetadata: { 
    webCommandMetadata: { 
      sendPost: true, 
      apiUrl: CONFIG.API_URL 
    } 
  },
  playlistEditEndpoint: { 
    playlistId: CONFIG.PLAYLIST_ID, 
    actions: [{ 
      action: "ACTION_REMOVE_VIDEO_BY_VIDEO_ID", 
      removedVideoId: videoId 
    }] 
  },
});

/**
 * Sends an action to YouTube's native handler to manipulate the Watch Later playlist
 * @param {Function} getParams - Function that returns the API parameters for the action
 */
const sendActionToNativeYouTubeHandler = (getParams) => {
  try {
    // Get the video ID from the URL
    const videoId = new URL(window.location.href).searchParams.get("v");
    // Find the app element on the page
    const appElement = document.querySelector(CONFIG.SELECTORS.YTD_APP);

    // If videoId or appElement is not found, return early
    if (!videoId || !appElement) {
      handleError("Failed to get videoId or ytd-app element");
      return;
    }

    // Create a custom event to send the action to YouTube
    const event = new window.CustomEvent("yt-action", {
      detail: {
        actionName: "yt-service-request",
        returnValue: [],
        args: [{ data: {} }, getParams(videoId)],
        optionalAction: false,
      },
    });

    // Dispatch the custom event to the appElement
    appElement.dispatchEvent(event);
  } catch (error) {
    handleError("Error while sending action:", error);
  }
};

/**
 * Button click event listener
 * Handles the click on the Watch Later button
 */
saveTo.addEventListener("click", () => {
  try {
    sendActionToNativeYouTubeHandler(getAddVideoParams);
  } catch (error) {
    handleError("Error while handling button click:", error);
  }
});
