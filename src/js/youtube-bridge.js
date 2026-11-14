(() => {
  document.addEventListener("wl-playlist-request", async (event) => {
    let request;
    try {
      request = JSON.parse(event.detail);
    } catch {
      return;
    }
    if (!request || typeof request.requestId !== "string" ||
        !/^[a-f0-9-]{36}$/.test(request.requestId) ||
        !["add", "remove"].includes(request.action) ||
        typeof request.videoId !== "string" || !/^[\w-]{11}$/.test(request.videoId)) return;

    let ok = false;
    let timeout;
    try {
      const app = document.querySelector("ytd-app");
      if (!app) return;
      const action = request.action === "add"
        ? { action: "ACTION_ADD_VIDEO", addedVideoId: request.videoId }
        : { action: "ACTION_REMOVE_VIDEO_BY_VIDEO_ID", removedVideoId: request.videoId };
      const detail = {
        actionName: "yt-service-request",
        returnValue: [],
        args: [
          { data: {} },
          {
            clickTrackingParams: "",
            commandMetadata: { webCommandMetadata: { sendPost: true, apiUrl: "/youtubei/v1/browse/edit_playlist" } },
            playlistEditEndpoint: { playlistId: "WL", actions: [action] }
          }
        ],
        optionalAction: false
      };
      app.dispatchEvent(new CustomEvent("yt-action", { bubbles: true, composed: true, detail }));
      // YouTube returns an ajaxPromise in the page realm, not a dispatch success flag.
      const result = detail.returnValue.find(value => typeof value?.ajaxPromise?.then === "function");
      if (!result) return;
      const response = await Promise.race([
        result.ajaxPromise,
        new Promise(resolve => { timeout = setTimeout(() => resolve(null), 12000); })
      ]);
      ok = response?.data?.status === "STATUS_SUCCEEDED";
    } catch {
      ok = false;
    } finally {
      clearTimeout(timeout);
      document.dispatchEvent(new CustomEvent("wl-playlist-response", {
        detail: JSON.stringify({ requestId: request.requestId, ok })
      }));
    }
  });
})();
