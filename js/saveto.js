function searchSaveBtn() {
    var saveBtn = document.evaluate("//yt-formatted-string[contains(., 'Save')]", document, null, XPathResult.ANY_TYPE, null );
    var thisBtn = saveBtn.iterateNext();
    var parentBtn = thisBtn.parentElement;
    var nextParentBtn = parentBtn.parentElement;

    nextParentBtn.click();
    var popUp = document.querySelector('#menu > ytd-menu-renderer');
    popUp.removeAttribute('menu-active');
}

/* Wait for bar is load */
setTimeout(() => {
    /* Create saveTo button */
    let saveTo = document.createElement('div');

    /* Find bottom bar under vider */
    let appendItem = document.getElementById('top-level-buttons-computed');
    /* Set id to element */
    saveTo.id = 'saveToPlaylist';
    /* Set class name to element */
    saveTo.className = 'save-to';

    /* Create saveTo button in DOM */
    appendItem.prepend(saveTo);

    
}, "3000"); 

/* Setup Click event */
setTimeout(() => {
    let saveBtn = document.getElementById('saveToPlaylist');
    saveBtn.addEventListener('click', () => {
        document.querySelector('#button-shape > button').click();
        searchSaveBtn();
    })
}, "3001");


