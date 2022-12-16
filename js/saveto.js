document.addEventListener("DOMContentLoaded", () => {
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

  function searchSaveBtn() {
    let saveBtn = document.evaluate(
      "//yt-formatted-string[contains(., 'Save')]",
      document,
      null,
      XPathResult.ANY_TYPE,
      null
    );
    let thisBtn = saveBtn.iterateNext();
    let parentBtn = thisBtn.parentElement;
    let nextParentBtn = parentBtn.parentElement;
    nextParentBtn.click();
    console.log("Save btn click");
  }
  function searchWatchLaterBtn() {
    let WatchLaterBtn = document.evaluate(
      "//yt-formatted-string[contains(., 'Watch later')]",
      document,
      null,
      XPathResult.ANY_TYPE,
      null
    );
    let thisBtn = WatchLaterBtn.iterateNext();
    let AddBtn = thisBtn.closest("#checkbox");
    AddBtn.click();
    console.log("Later btn click");
  }

  waitForElm("#actions").then((elm) => {
    let appendItem = document.getElementById("top-level-buttons-computed");

    /* Create saveTo button */
    let saveTo = document.createElement("div");
    /* Set id to element */
    saveTo.id = "saveToPlaylist";
    /* Set class name to element */
    saveTo.className = "save-to";
    /* Create saveTo button in DOM */
    appendItem.prepend(saveTo);

    /* Event handler for fast way "Save to" */
    saveTo.addEventListener("click", () => {
      /* Click kebab menu */
      document.querySelector("#button-shape > button").click();

      /* Setup click to "Save btn" */
      setTimeout(() => {
        searchSaveBtn();
      }, 1000);
      /* Setup click to "Watch later" */
      setTimeout(() => {
        searchWatchLaterBtn();
      }, 2000);
    });
  });
});
