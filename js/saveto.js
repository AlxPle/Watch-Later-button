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

waitForElm("#actions").then((elm) => {
  console.log('Element is ready');
  let appendItem = document.getElementById("top-level-buttons-computed");

  /* Create saveTo button */
  let saveTo = document.createElement("div");
  /* Set id to element */
  saveTo.id = "saveToPlaylist";
  /* Set class name to element */
  saveTo.className = "save-to";

  /* Create saveTo button in DOM */
  appendItem.prepend(saveTo);

  /* Find "Save" btn */
  function searchSaveBtn() {
    var saveBtn = document.evaluate(
      "//yt-formatted-string[contains(., 'Save')]",
      document,
      null,
      XPathResult.ANY_TYPE,
      null
    );
    var thisBtn = saveBtn.iterateNext();
    var parentBtn = thisBtn.parentElement;
    var nextParentBtn = parentBtn.parentElement;
    nextParentBtn.click();
  }
  /* Setup Click event */
  saveTo.addEventListener("click", () => {
    document.querySelector("#button-shape > button").click();
    searchSaveBtn();
  });
});

/* style-scope ytd-menu-service-item-renderer */
