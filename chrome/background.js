/**
 * Background service worker for Watch Later Button extension
 * Handles extension lifecycle events
 */

/**
 * Listener for extension installation or update
 * Logs the event for debugging purposes
 */
chrome.runtime.onInstalled.addListener((details) => {
  const { reason, previousVersion } = details;
  
  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    console.log('Watch Later Button extension installed');
  } else if (reason === chrome.runtime.OnInstalledReason.UPDATE) {
    console.log(`Watch Later Button extension updated from version ${previousVersion}`);
  }
});