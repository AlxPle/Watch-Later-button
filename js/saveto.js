setTimeout(() => {
  /* Wait for bar is load */
  let appendItem = document.getElementById("top-level-buttons-computed");

  if (appendItem) {
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
  }
}, 4000);

/* style-scope ytd-menu-service-item-renderer */
