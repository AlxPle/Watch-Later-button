const puppeteer = require('puppeteer');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');

const extensionPath = process.env.EXTENSION_PATH || path.resolve(__dirname, '../dist/chrome');
const videoId = 'PRgS7hBgR1k';
const fixture = `<!doctype html><html><body>
  <ytd-app>
    <ytd-watch-flexy><ytd-watch-metadata><ytd-menu-renderer></ytd-menu-renderer></ytd-watch-metadata></ytd-watch-flexy>
    <ytd-shorts hidden>
      <ytd-reel-video-renderer hidden><div id="actions" data-slot="first"></div></ytd-reel-video-renderer>
      <ytd-reel-video-renderer is-active><div id="actions" data-slot="second"></div></ytd-reel-video-renderer>
    </ytd-shorts>
    <ytd-video-renderer><div id="dismissible"><ytd-thumbnail></ytd-thumbnail><a href="/watch?v=${videoId}">Video</a></div></ytd-video-renderer>
    <input aria-label="Search">
  </ytd-app>
</body></html>`;

jest.setTimeout(30000);

describe('Watch Later interactions with isolated YouTube responses', () => {
  let browser;
  let page;
  let errors;
  let popupUrl;

  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: true, pipe: true, enableExtensions: [extensionPath] });
    const welcome = await browser.waitForTarget(target => target.url().endsWith('/pages/welcome.html'));
    popupUrl = new URL('/popup/popup.html', welcome.url()).href;
    await (await welcome.page()).close();
  });

  async function openPopup() {
    const popup = await browser.newPage();
    popup.on('pageerror', error => errors.push(error.message));
    await popup.setViewport({ width: 350, height: 600 });
    await popup.goto(popupUrl);
    return popup;
  }

  afterAll(async () => { await browser?.close(); });

  beforeEach(async () => {
    errors = [];
    const popup = await openPopup();
    try {
      await popup.evaluate(async () => {
        await chrome.storage.local.clear();
        await chrome.storage.sync.clear();
      });
    } finally {
      await popup.close();
    }
    page = await browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.isNavigationRequest()) {
        void request.respond({ status: 200, contentType: 'text/html', body: fixture });
      } else {
        void request.abort();
      }
    });
    await page.evaluateOnNewDocument(() => {
      window.actions = [];
      window.responseMode = 'success';
      document.addEventListener('yt-action', event => {
        if (event.detail?.actionName !== 'yt-service-request') return;
        const endpoint = event.detail.args[1].playlistEditEndpoint;
        window.actions.push(endpoint);
        if (window.responseMode === 'missing') return;
        const ajaxPromise = new Promise((resolve, reject) => {
          window.finishRequest = status => resolve({ data: { status } });
          if (window.responseMode === 'network-error') reject(new Error('Network unavailable'));
          else if (window.responseMode === 'success') resolve({ data: { status: 'STATUS_SUCCEEDED' } });
          else if (window.responseMode === 'failed') resolve({ data: { status: 'STATUS_FAILED' } });
          else if (window.responseMode === 'empty') resolve({});
        });
        event.detail.returnValue.push({ ajaxPromise });
      });
    });
    await page.goto(`https://www.youtube.com/watch?v=${videoId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#saveToPlaylist');
  });

  afterEach(async () => {
    await page?.close();
    if (errors) expect(errors).toEqual([]);
  });

  async function waitForState(className) {
    await page.waitForFunction(name => document.querySelector('#saveToPlaylist').classList.contains(name), {}, className);
  }

  test('waits for confirmation and prevents concurrent clicks across buttons', async () => {
    await page.evaluate(() => { window.responseMode = 'pending'; });
    await page.click('#saveToPlaylist');
    await waitForState('is-pending');
    expect(await page.$eval('#saveToPlaylist', el => el.classList.contains('is-added'))).toBe(false);
    expect(await page.$eval('#saveToPlaylist', el => el.getAttribute('aria-busy'))).toBe('true');
    await page.click('#saveToPlaylist');
    await page.click('ytd-video-renderer .saveToWatchLater');
    expect(await page.evaluate(() => window.actions.length)).toBe(1);
    await page.evaluate(() => window.finishRequest('STATUS_SUCCEEDED'));
    await waitForState('is-added');
    expect(await page.$eval('#saveToPlaylist', el => el.hasAttribute('aria-busy'))).toBe(false);
    expect(await page.evaluate(() => window.actions[0])).toEqual({ playlistId: 'WL', actions: [{ action: 'ACTION_ADD_VIDEO', addedVideoId: videoId }] });
    await page.evaluate(() => { window.responseMode = 'success'; });
    await page.click('#saveToPlaylist');
    await page.waitForFunction(() => !document.querySelector('#saveToPlaylist').classList.contains('is-added'));
    expect(await page.evaluate(() => window.actions[1].actions[0])).toEqual({ action: 'ACTION_REMOVE_VIDEO_BY_VIDEO_ID', removedVideoId: videoId });
  });

  test.each(['missing', 'network-error', 'failed', 'empty'])('does not claim success for %s responses', async mode => {
    await page.evaluate(mode => { window.responseMode = mode; }, mode);
    await page.click('#saveToPlaylist');
    await waitForState('is-error');
    expect(await page.$eval('#saveToPlaylist', el => el.classList.contains('is-added'))).toBe(false);
    expect(await page.$eval('#saveToPlaylist', el => el.hasAttribute('aria-busy'))).toBe(false);
    expect(await page.$eval('.wl-action-status', el => el.textContent)).toContain('not confirmed');
  });

  test('times out without a false success and ignores a late response', async () => {
    await page.evaluate(() => { window.responseMode = 'pending'; });
    await page.click('#saveToPlaylist');
    await waitForState('is-error');
    await page.evaluate(() => window.finishRequest('STATUS_SUCCEEDED'));
    expect(await page.$eval('#saveToPlaylist', el => el.classList.contains('is-added'))).toBe(false);
  });

  test('ignores unrelated responses while waiting', async () => {
    await page.evaluate(() => { window.responseMode = 'pending'; });
    await page.click('#saveToPlaylist');
    await page.evaluate(() => {
      document.dispatchEvent(new CustomEvent('wl-playlist-response', { detail: '{broken' }));
      document.dispatchEvent(new CustomEvent('wl-playlist-response', { detail: JSON.stringify({ requestId: crypto.randomUUID(), ok: true }) }));
    });
    expect(await page.$eval('#saveToPlaylist', el => el.classList.contains('is-pending'))).toBe(true);
    await page.evaluate(() => window.finishRequest('STATUS_SUCCEEDED'));
    await waitForState('is-added');
  });

  test('does not undo when the shortcut or Enter repeats', async () => {
    await page.keyboard.down('Alt');
    await page.keyboard.down('w');
    await waitForState('is-added');
    await page.keyboard.down('w');
    await page.keyboard.up('w');
    await page.keyboard.up('Alt');
    expect(await page.evaluate(() => window.actions.length)).toBe(1);
    await page.focus('#saveToPlaylist');
    await page.keyboard.down('Enter');
    await page.waitForFunction(() => window.actions.length === 2 && !document.querySelector('#saveToPlaylist').classList.contains('is-pending'));
    await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    expect(await page.evaluate(() => window.actions.length)).toBe(2);
    await page.focus('input');
    await page.keyboard.down('Alt');
    await page.keyboard.press('w');
    await page.keyboard.up('Alt');
    expect(await page.evaluate(() => window.actions.length)).toBe(2);
  });

  test('discards confirmation after SPA navigation', async () => {
    await page.evaluate(() => { window.responseMode = 'pending'; });
    await page.click('#saveToPlaylist');
    await page.evaluate(() => {
      history.pushState({}, '', '/watch?v=dQw4w9WgXcQ');
      document.dispatchEvent(new Event('yt-navigate-finish'));
      window.finishRequest('STATUS_SUCCEEDED');
    });
    expect(await page.$eval('#saveToPlaylist', el => el.classList.contains('is-added') || el.classList.contains('is-pending'))).toBe(false);
  });

  test('mounts only in the active Short and follows attribute-only changes', async () => {
    await page.evaluate(() => {
      history.pushState({}, '', '/shorts/dQw4w9WgXcQ');
      document.querySelector('ytd-shorts').removeAttribute('hidden');
      document.dispatchEvent(new Event('yt-navigate-finish'));
    });
    await page.waitForFunction(() => document.querySelector('#saveToPlaylist').parentElement.dataset.slot === 'second');
    await page.evaluate(() => {
      const [first, second] = document.querySelectorAll('ytd-reel-video-renderer');
      first.removeAttribute('hidden');
      first.setAttribute('is-active', '');
      second.removeAttribute('is-active');
      second.setAttribute('hidden', '');
    });
    await page.waitForFunction(() => document.querySelector('#saveToPlaylist').parentElement.dataset.slot === 'first');
    expect(await page.$eval('#saveToPlaylist', el => !!el.closest('[hidden]'))).toBe(false);
  });

  test.each([false, true])('restores a removed card button with thumbnail replacement=%s', async replaceThumbnail => {
    await page.waitForSelector('ytd-video-renderer .saveToWatchLater');
    await page.evaluate(replaceThumbnail => {
      document.querySelector('ytd-video-renderer .saveToWatchLater').remove();
      if (replaceThumbnail) {
        document.querySelector('ytd-thumbnail').replaceWith(document.createElement('ytd-thumbnail'));
        document.dispatchEvent(new Event('yt-navigate-finish'));
      }
    }, replaceThumbnail);
    await page.waitForSelector('ytd-video-renderer .saveToWatchLater');
    await page.evaluate(() => {
      document.dispatchEvent(new Event('yt-navigate-finish'));
      document.dispatchEvent(new Event('yt-navigate-finish'));
    });
    expect(await page.$$eval('ytd-video-renderer .saveToWatchLater', buttons => buttons.length)).toBe(1);
    await page.click('ytd-video-renderer .saveToWatchLater');
    await page.waitForSelector('ytd-video-renderer .is-undo-active');
    await page.click('ytd-video-renderer .saveToWatchLater');
    await page.waitForFunction(() => window.actions.length === 2);
    expect(await page.evaluate(() => window.actions[1].actions[0].action)).toBe('ACTION_REMOVE_VIDEO_BY_VIDEO_ID');
  });

  test.each(['success', 'failed', 'pending'])('resets a detached card button after a %s response', async mode => {
    await page.evaluate(mode => { window.responseMode = mode; }, mode);
    await page.click('ytd-video-renderer .saveToWatchLater');
    const state = mode === 'success' ? 'is-undo-active' : mode === 'failed' ? 'is-error' : 'is-pending';
    await page.waitForSelector(`ytd-video-renderer .${state}`);
    await page.evaluate(async () => {
      window.detachedCard = document.querySelector('ytd-video-renderer');
      window.detachedCard.remove();
      await new Promise(requestAnimationFrame);
      document.querySelector('ytd-app').append(window.detachedCard);
    });
    const buttonState = await page.$eval('ytd-video-renderer .saveToWatchLater', button => ({
      state: button.matches('.is-added, .is-undo-active, .is-pending, .is-error'),
      title: button.title,
      label: button.getAttribute('aria-label'),
      busy: button.hasAttribute('aria-busy')
    }));
    expect(buttonState.state).toBe(false);
    expect(buttonState.busy).toBe(false);
    expect(buttonState.title).toContain('Watch Later');
    expect(buttonState.title).not.toContain('Delete');
    expect(buttonState.label).toBe(buttonState.title);
    if (mode === 'pending') {
      await page.evaluate(() => window.finishRequest('STATUS_SUCCEEDED'));
      expect(await page.$eval('ytd-video-renderer .saveToWatchLater', button => button.classList.contains('is-added'))).toBe(false);
    }
    await page.evaluate(() => { window.responseMode = 'success'; });
    await page.click('ytd-video-renderer .saveToWatchLater');
    await page.waitForFunction(() => window.actions.length === 2);
    expect(await page.evaluate(() => window.actions[1].actions[0].action)).toBe('ACTION_ADD_VIDEO');
  });

  test('clears undo when a connected card is reused for another video', async () => {
    await page.click('ytd-video-renderer .saveToWatchLater');
    await page.waitForSelector('ytd-video-renderer .is-undo-active');
    await page.evaluate(() => {
      document.querySelector('ytd-video-renderer a').href = '/watch?v=dQw4w9WgXcQ';
    });
    await page.waitForFunction(() => !document.querySelector('ytd-video-renderer .saveToWatchLater').classList.contains('is-undo-active'));
    expect(await page.$eval('ytd-video-renderer .saveToWatchLater', button => button.title)).not.toContain('Delete');
    await page.click('ytd-video-renderer .saveToWatchLater');
    await page.waitForFunction(() => window.actions.length === 2);
    expect(await page.evaluate(() => window.actions[1].actions[0])).toEqual({ action: 'ACTION_ADD_VIDEO', addedVideoId: 'dQw4w9WgXcQ' });
  });

  test.each([
    ['local', 200, 100, 7],
    ['sync', 100, 200, 15],
    ['legacy local', undefined, undefined, 7]
  ])('loads %s settings consistently in the popup and content script', async (name, localTime, syncTime, expectedSeconds) => {
    const popup = await openPopup();
    try {
      await popup.evaluate(async ({ localTime, syncTime }) => {
        const local = { buttonUndoSeconds: 7 };
        const sync = { buttonUndoSeconds: 15 };
        if (localTime !== undefined) local.buttonUndoSecondsUpdatedAt = localTime;
        if (syncTime !== undefined) sync.buttonUndoSecondsUpdatedAt = syncTime;
        await chrome.storage.local.set(local);
        await chrome.storage.sync.set(sync);
      }, { localTime, syncTime });
      await popup.reload();
      await popup.waitForFunction(seconds => document.querySelector('#undo-active-badge').textContent === `${seconds}s`, {}, expectedSeconds);
      await page.bringToFront();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#saveToPlaylist');
      await page.click('#saveToPlaylist');
      await waitForState('is-undo-active');
      expect(await page.$eval('#saveToPlaylist', button => button.style.getPropertyValue('--wl-undo-ms'))).toBe(`${expectedSeconds * 1000}ms`);
    } finally {
      await popup.close();
    }
  });

  test('ignores stale sync changes but accepts newer remote changes', async () => {
    const popup = await openPopup();
    try {
      await popup.evaluate(async () => {
        await chrome.storage.local.set({ buttonUndoSeconds: 7, buttonUndoSecondsUpdatedAt: 200 });
      });
      await page.bringToFront();
      await page.click('#saveToPlaylist');
      await waitForState('is-undo-active');
      expect(await page.$eval('#saveToPlaylist', button => button.style.getPropertyValue('--wl-undo-ms'))).toBe('7000ms');
      await page.click('#saveToPlaylist');
      await page.waitForFunction(() => !document.querySelector('#saveToPlaylist').classList.contains('is-undo-active'));
      await popup.evaluate(async () => {
        await chrome.storage.sync.set({ buttonUndoSeconds: 15, buttonUndoSecondsUpdatedAt: 100 });
      });
      await page.click('#saveToPlaylist');
      await waitForState('is-undo-active');
      expect(await page.$eval('#saveToPlaylist', button => button.style.getPropertyValue('--wl-undo-ms'))).toBe('7000ms');
      await page.click('#saveToPlaylist');
      await page.waitForFunction(() => !document.querySelector('#saveToPlaylist').classList.contains('is-undo-active'));
      await popup.evaluate(async () => {
        await chrome.storage.sync.set({ buttonUndoSeconds: 15, buttonUndoSecondsUpdatedAt: 300 });
      });
      await page.click('#saveToPlaylist');
      await waitForState('is-undo-active');
      expect(await page.$eval('#saveToPlaylist', button => button.style.getPropertyValue('--wl-undo-ms'))).toBe('15000ms');
    } finally {
      await popup.close();
    }
  });

  test('keeps a local setting when writing to sync fails', async () => {
    const popup = await openPopup();
    try {
      await popup.evaluate(async () => {
        await chrome.storage.sync.set({ buttonUndoSeconds: 15 });
      });
      await popup.reload();
      await popup.waitForFunction(() => document.querySelector('#undo-active-badge').textContent === '15s');
      await popup.evaluate(() => {
        chrome.storage.sync.set = async () => { throw new Error('Sync quota exceeded'); };
        document.querySelector('.undo-pill[data-seconds="custom"]').click();
        const input = document.querySelector('#custom-undo-input');
        input.value = '7';
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await popup.waitForFunction(async () => (await chrome.storage.local.get('buttonUndoSeconds')).buttonUndoSeconds === 7);
      const stored = await popup.evaluate(async () => ({ local: await chrome.storage.local.get(['buttonUndoSeconds', 'buttonUndoSecondsUpdatedAt']), sync: await chrome.storage.sync.get('buttonUndoSeconds') }));
      expect(stored.local.buttonUndoSecondsUpdatedAt).toBeGreaterThan(0);
      expect(stored.sync.buttonUndoSeconds).toBe(15);
      await popup.reload();
      await popup.waitForFunction(() => document.querySelector('#undo-active-badge').textContent === '7s');
    } finally {
      await popup.close();
    }
  });

  test('selects the latest theme on extension pages and ignores stale changes', async () => {
    const popup = await openPopup();
    const welcome = await browser.newPage();
    welcome.on('pageerror', error => errors.push(error.message));
    try {
      await popup.evaluate(async () => {
        await chrome.storage.local.set({ buttonColor: { hex: '#010203', alpha: 100, rgba: 'rgb(1, 2, 3)' }, buttonColorUpdatedAt: 200 });
        await chrome.storage.sync.set({ buttonColor: { hex: '#040506', alpha: 100, rgba: 'rgb(4, 5, 6)' }, buttonColorUpdatedAt: 100 });
      });
      await welcome.goto(new URL('/pages/welcome.html', popupUrl).href);
      await welcome.waitForFunction(() => document.documentElement.style.getPropertyValue('--wl-color-default') === 'rgb(1, 2, 3)');
      await popup.evaluate(async () => {
        await chrome.storage.sync.set({ buttonColor: { hex: '#070809', alpha: 100, rgba: 'rgb(7, 8, 9)' }, buttonColorUpdatedAt: 150 });
      });
      expect(await welcome.evaluate(() => document.documentElement.style.getPropertyValue('--wl-color-default'))).toBe('rgb(1, 2, 3)');
      await popup.evaluate(async () => {
        await chrome.storage.sync.set({ buttonColor: { hex: '#0a0b0c', alpha: 100, rgba: 'rgb(10, 11, 12)' }, buttonColorUpdatedAt: 300 });
      });
      await welcome.waitForFunction(() => document.documentElement.style.getPropertyValue('--wl-color-default') === 'rgb(10, 11, 12)');
      await popup.reload();
      await popup.bringToFront();
      await popup.waitForFunction(() => document.querySelector('#color-picker').value === '#0a0b0c');
      await popup.evaluate(async () => {
        await chrome.storage.sync.set({ buttonColor: { hex: '#336699', alpha: 50, rgba: 'rgba(51, 102, 153, 0.5)' }, buttonColorUpdatedAt: 400 });
      });
      await popup.reload();
      await popup.waitForFunction(() => document.querySelector('#color-picker').value === '#336699');
      expect(await popup.$eval('#opacity-slider', slider => slider.value)).toBe('50');
    } finally {
      await welcome.close();
      await popup.close();
    }
  });

  test('stops recording shortcuts on reset and allows a new recording', async () => {
    const popup = await openPopup();
    try {
      await popup.click('#open-settings-row-btn');
      await popup.waitForSelector('#settings-view:not([inert])');
      await popup.click('#shortcut-btn');
      await popup.waitForSelector('#shortcut-btn.is-recording');
      await popup.$eval('#reset-color-btn', button => button.scrollIntoView());
      await popup.click('#reset-color-btn');
      await popup.keyboard.down('Alt');
      await popup.keyboard.press('x');
      await popup.keyboard.up('Alt');
      expect(await popup.$eval('#shortcut-btn', button => button.textContent)).toBe('Alt + W');
      await popup.$eval('#shortcut-btn', button => button.scrollIntoView());
      await popup.click('#shortcut-btn');
      await popup.keyboard.down('Alt');
      await popup.keyboard.press('x');
      await popup.keyboard.up('Alt');
      await popup.waitForFunction(async () => (await chrome.storage.local.get('buttonShortcut')).buttonShortcut?.code === 'KeyX');
      expect(await popup.$eval('#shortcut-btn', button => button.textContent)).toBe('Alt + X');
      await popup.click('#shortcut-btn');
      await popup.keyboard.press('Escape');
      await popup.keyboard.down('Alt');
      await popup.keyboard.press('y');
      await popup.keyboard.up('Alt');
      expect(await popup.$eval('#shortcut-btn', button => button.textContent)).toBe('Alt + X');
    } finally {
      await popup.close();
    }
  });

  test('persists popup settings to local and sync storage', async () => {
    const popup = await openPopup();
    try {
      await popup.click('#open-settings-row-btn');
      await popup.waitForSelector('#settings-view:not([inert])');
      await popup.focus('#opacity-slider');
      await popup.keyboard.press('Home');
      await popup.waitForFunction(async () => {
        const local = await chrome.storage.local.get('buttonColor');
        const sync = await chrome.storage.sync.get('buttonColor');
        return local.buttonColor?.alpha === 0 && sync.buttonColor?.alpha === 0;
      });
      await popup.reload();
      await popup.waitForFunction(() => document.querySelector('#opacity-slider').value === '0');
      expect(await popup.$eval('#opacity-val', el => el.textContent)).toBe('0%');
      const stored = await popup.evaluate(async () => ({
        local: await chrome.storage.local.get('buttonColorUpdatedAt'),
        sync: await chrome.storage.sync.get('buttonColorUpdatedAt')
      }));
      expect(stored.local.buttonColorUpdatedAt).toBeGreaterThan(0);
      expect(stored.sync.buttonColorUpdatedAt).toBe(stored.local.buttonColorUpdatedAt);
    } finally {
      await popup.close();
    }
  });
});

describe('Update notification settings in the service worker', () => {
  test.each([
    [{ showUpdateNotification: false, showUpdateNotificationUpdatedAt: 200 }, { showUpdateNotification: true, showUpdateNotificationUpdatedAt: 100 }, false],
    [{ showUpdateNotification: true, showUpdateNotificationUpdatedAt: 100 }, { showUpdateNotification: false, showUpdateNotificationUpdatedAt: 200 }, false],
    [{ showUpdateNotification: false }, { showUpdateNotification: true }, false],
    [{}, { showUpdateNotification: false }, false],
    [{}, {}, true],
    [null, { showUpdateNotification: false }, false],
    [{ showUpdateNotification: false }, null, false]
  ])('uses the latest available notification preference: local=%j sync=%j', async (local, sync, shouldOpen) => {
    let onInstalled;
    const tabs = { create: jest.fn() };
    const chrome = {
      runtime: {
        onInstalled: { addListener: listener => { onInstalled = listener; } },
        getURL: file => file
      },
      storage: {
        local: { get: async () => { if (local === null) throw new Error('Local unavailable'); return local; } },
        sync: { get: async () => { if (sync === null) throw new Error('Sync unavailable'); return sync; } }
      },
      tabs
    };
    vm.runInNewContext(fs.readFileSync(path.join(extensionPath, 'background.js'), 'utf8'), { chrome });
    await onInstalled({ reason: 'update' });
    expect(tabs.create).toHaveBeenCalledTimes(shouldOpen ? 1 : 0);
    if (shouldOpen) expect(tabs.create).toHaveBeenCalledWith({ url: 'pages/update.html' });
  });
});
