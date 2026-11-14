const puppeteer = require('puppeteer');
const path = require('node:path');

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

  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: true, pipe: true, enableExtensions: [extensionPath] });
    const welcome = await browser.waitForTarget(target => target.url().endsWith('/pages/welcome.html'));
    await (await welcome.page()).close();
  });

  afterAll(async () => { await browser?.close(); });

  beforeEach(async () => {
    page = await browser.newPage();
    errors = [];
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

  test('persists popup settings to local and sync storage', async () => {
    const background = await browser.waitForTarget(target => target.type() === 'service_worker');
    const popup = await browser.newPage();
    popup.on('pageerror', error => errors.push(error.message));
    try {
      await popup.setViewport({ width: 350, height: 600 });
      await popup.goto(new URL('/popup/popup.html', background.url()).href);
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
    } finally {
      await popup.close();
    }
  });
});
