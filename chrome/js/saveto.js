/* 
   Create saveTo button element, set id to "saveToPlaylist" and class to "save-to-watch-later"
*/
const saveTo = document.createElement("div");
saveTo.id = "saveToPlaylist";
saveTo.className = "saveToWatchLater";
//const EnterPoint = document.getElementById("actions");

/**
 * This function creates a WIKI about Observer and Mutation.
 * For more information, visit:
 * - https://stackoverflow.com/questions/5525071/how-to-wait-until-an-element-exists
 * - https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
 */

/* Error handler function */
function handleError(msg, error) {
  if (error) {
    console.error(msg, error);
  } else {
    console.error(msg);
  }
}

/* Add the button if not present */
function addSaveToButton() {
  const appendItem = document.getElementById("top-level-buttons-computed");
  if (!appendItem) return;
  if (!document.getElementById("saveToPlaylist")) {
    appendItem.prepend(saveTo);
    console.log("'Save to Watch Later' button added");
  }
}

/* Observe changes in the #actions block */
function observeActionsBlock() {
  const target = document.querySelector("#actions");
  if (!target) return;

  // Watch for changes inside #actions (for SPA navigation)
  const observer = new MutationObserver(() => {
    addSaveToButton();
  });

  observer.observe(target, { childList: true, subtree: true });
}

/* Wait for #actions and set up observer */
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

waitForElm("#actions")
  .then(() => {
    addSaveToButton();
    observeActionsBlock();
  })
  .catch((error) => {
    handleError("Error while waiting for #actions element:", error);
  });

/* Function: getAddVideoParams
   Description: Returns the parameters object needed to add a video to the watch later playlist.
   Parameters:
     - videoId: The ID of the video to be added
   Returns: 
     Object with click tracking params, command metadata, and playlist edit endpoint
*/
const getAddVideoParams = (videoId) => ({
  clickTrackingParams: "",
  commandMetadata: { webCommandMetadata: { sendPost: true, apiUrl: "/youtubei/v1/browse/edit_playlist" } },
  playlistEditEndpoint: { playlistId: "WL", actions: [{ addedVideoId: videoId, action: "ACTION_ADD_VIDEO" }] },
});

/* 
  Function: getRemoveVideoParams
  Description: Returns the parameters object needed to remove a video from the watch later playlist.
  Parameters:
    - videoId: The ID of the video to be removed
  Returns: 
    Object with click tracking parameters, command metadata, and playlist edit endpoint
*/
const getRemoveVideoParams = (videoId) => ({
  clickTrackingParams: "",
  commandMetadata: { webCommandMetadata: { sendPost: true, apiUrl: "/youtubei/v1/browse/edit_playlist" } },
  playlistEditEndpoint: { playlistId: "WL", actions: [{ action: "ACTION_REMOVE_VIDEO_BY_VIDEO_ID", removedVideoId: videoId }] },
});

/* ACTION SENDER */
const sendActionToNativeYouTubeHandler = (getParams) => {
  try {
    // Get the video ID from the URL
    const videoId = new URL(window.location.href).searchParams.get("v");
    // Find the app element on the page
    const appElement = document.querySelector("ytd-app");

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

/* Check if saveTo button is created if not create it */
if (saveTo) {
  console.log("find menu");
} else {
  console.log("nope");
}

/* Button listener */
saveTo.addEventListener("click", () => {
  try {
    sendActionToNativeYouTubeHandler(getAddVideoParams);
  } catch (error) {
    handleError("Error while handling button click:", error);
  }
});
