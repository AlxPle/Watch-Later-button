document.getElementById('extension-name').textContent = chrome.i18n.getMessage('extensionName');
document.getElementById('issues').textContent = chrome.i18n.getMessage('issues');
document.getElementById('feedback').textContent = chrome.i18n.getMessage('feedback');
document.getElementById('donate').textContent = chrome.i18n.getMessage('donate');
document.getElementById('contact').textContent = chrome.i18n.getMessage('contact');
document.getElementById('website').textContent = chrome.i18n.getMessage('website');
document.getElementById('whats-new').textContent = chrome.i18n.getMessage('whatsNew');

const manifest = chrome.runtime.getManifest();
document.getElementById('ext-version').textContent = `v${manifest.version}`;