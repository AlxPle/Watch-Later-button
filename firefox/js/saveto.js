/* https://stackoverflow.com/questions/5525071/how-to-wait-until-an-element-exists */
/* https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver */
function waitForElm(selector) {
  return new Promise((resolve) => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }

    const observer = new MutationObserver((mutations) => {
      if (document.querySelector(selector)) {
        resolve(document.querySelector(selector));
        observer.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}

/* Create saveTo button */
const saveTo = document.createElement("div");
/* Set id to element */
saveTo.id = "saveToPlaylist";
/* Set class name to element */
saveTo.className = "save-to";

waitForElm("#actions").then((elm) => {
  const appendItem = document.getElementById("top-level-buttons-computed");
  /* Create saveTo button in DOM */
  appendItem.prepend(saveTo);
});

/* ADD VIDEO TO WATCH LATER */
const getAddVideoParams = (videoId) => ({
  clickTrackingParams: "",
  commandMetadata: { webCommandMetadata: { sendPost: true, apiUrl: "/youtubei/v1/browse/edit_playlist" } },
  playlistEditEndpoint: { playlistId: "WL", actions: [{ addedVideoId: videoId, action: "ACTION_ADD_VIDEO" }] },
});

/* REMOVE VIDEO FROM WATCH LATER */
const getRemoveVideoParams = (videoId) => ({
  clickTrackingParams: "",
  commandMetadata: { webCommandMetadata: { sendPost: true, apiUrl: "/youtubei/v1/browse/edit_playlist" } },
  playlistEditEndpoint: { playlistId: "WL", actions: [{ action: "ACTION_REMOVE_VIDEO_BY_VIDEO_ID", removedVideoId: videoId }] },
});

/* ACTION SENDER */
const sendActionToNativeYouTubeHandler = (getParams) => {
  const videoId = new URL(window.location.href).searchParams.get("v");
  const appElement = document.querySelector("ytd-app");

  if (!videoId || !appElement) {
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
};

/* Button listener */
saveTo.addEventListener("click", () => {
  sendActionToNativeYouTubeHandler(getAddVideoParams);
});
