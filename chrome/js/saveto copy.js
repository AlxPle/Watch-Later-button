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

/* Function to wait for the element */
function waitForElm(selector) {
  // Create a promise to wait for the element
  return new Promise((resolve) => {
    // Check if the element is already available
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }

    // Create a MutationObserver to listen for element availability
    const observer = new MutationObserver((mutations) => {
      if (document.querySelector(selector)) {
        resolve(document.querySelector(selector));
        observer.disconnect();
      }
    });

    // Observe changes in the document body
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}

/* 
Function: addSaveToButtonToDOM
Description: Wait for the element with id "#actions" to be available, then add the saveTo button to the DOM.
*/
waitForElm("#actions").then((elm) => {
  const appendItem = document.getElementById("top-level-buttons-computed");
  /* Create saveTo button in DOM */
  if (appendItem) {
    appendItem.prepend(saveTo);
  }
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
  // Get the video ID from the URL
  const videoId = new URL(window.location.href).searchParams.get("v");
  // Find the app element on the page
  const appElement = document.querySelector("ytd-app");

  // If videoId or appElement is not found, return early
  if (!videoId || !appElement) {
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
};

/* Check if saveTo button is created if not create it */
if (saveTo) {
  console.log("find menu");
} else {
  console.log("nope");
}

/* Button listener */
saveTo.addEventListener("click", () => {
  sendActionToNativeYouTubeHandler(getAddVideoParams);
});
