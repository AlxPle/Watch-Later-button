/**
 * Popup script for Watch Later Button extension
 * Initializes the popup UI with localized text
 */

/**
 * Safely sets the text content of an element
 * @param {string} elementId - The ID of the element to update
 * @param {string} messageKey - The i18n message key to retrieve
 */
function setLocalizedText(elementId, messageKey) {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      console.error(`Element with ID "${elementId}" not found`);
      return;
    }
    const message = chrome.i18n.getMessage(messageKey);
    if (!message) {
      console.warn(`No translation found for key "${messageKey}"`);
      return;
    }
    element.textContent = message;
  } catch (error) {
    console.error(`Error setting localized text for "${elementId}":`, error);
  }
}

// Initialize all localized text elements
setLocalizedText('extension-name', 'extensionName');
setLocalizedText('issues', 'issues');
setLocalizedText('feedback', 'feedback');
setLocalizedText('donate', 'donate');