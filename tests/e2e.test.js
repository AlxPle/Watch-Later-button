const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('node:url');

// Path to the directory with your built Chrome extension
const extensionPath = process.env.EXTENSION_PATH || path.join(__dirname, '..', 'dist', 'chrome');
let userDataDir;

function findChromeExecutable() {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }
  try {
    const pptrPath = puppeteer.executablePath();
    if (fs.existsSync(pptrPath)) return pptrPath;
  } catch {}

  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return undefined;
}

// YouTube video URL for testing
const YOUTUBE_VIDEO_URL = 'https://www.youtube.com/watch?v=PRgS7hBgR1k';
const SECOND_YOUTUBE_VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const YOUTUBE_HOME_URL = 'https://www.youtube.com/';
const YOUTUBE_SHORTS_URL = 'https://www.youtube.com/shorts/dQw4w9WgXcQ';
const YOUTUBE_RESULTS_URL = 'https://www.youtube.com/results?search_query=lofi';

// Selector for the button added by the extension.
const WATCH_LATER_BUTTON_SELECTOR = '#saveToPlaylist';

async function clickAnyWatchLink(page) {
  return page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/watch?v="]'));

    for (const link of links) {
      const href = link.getAttribute('href') || '';
      if (!href || href.startsWith('#')) {
        continue;
      }

      const url = new URL(link.href, window.location.origin);
      if (url.pathname === '/watch' && url.searchParams.get('v')) {
        link.click();
        return url.searchParams.get('v');
      }
    }

    return null;
  });
}

async function gotoWithConsent(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  for (let i = 0; i < 10; i++) {
    if (page.url().includes('consent.youtube.com')) {
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  if (page.url().includes('consent.youtube.com')) {
    console.log(`Bypassing cookie consent page on: ${url}`);
    try {
      await page.waitForSelector('button', { timeout: 5000 }).catch(() => {});
      await Promise.all([
        page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('form button, button'));
          const acceptBtn = buttons.find(btn => {
            const text = btn.textContent.toLowerCase();
            return text.includes('accept') || text.includes('agree') || text.includes('принять') || text.includes('все') || text.includes('да');
          }) || buttons[buttons.length - 1];
          if (acceptBtn) {
            acceptBtn.click();
            return true;
          }
          return false;
        }),
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
      ]);
    } catch (e) {
      console.warn('Error during cookie consent bypass:', e);
    }
  }
}


describe('Chrome action popup', () => {
  jest.setTimeout(30000);

  test('keeps its width when Chrome sizes the popup and switches views', async () => {
    const browser = await puppeteer.launch({
      headless: true,
      pipe: true,
      enableExtensions: [extensionPath],
      defaultViewport: null,
      executablePath: findChromeExecutable()
    });
    try {
      const target = await browser.waitForTarget(t => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'));
      const worker = await target.worker();
      for (let opening = 0; opening < 2; opening++) {
        await worker.evaluate(() => chrome.action.openPopup());
        const popupTarget = await browser.waitForTarget(t => t.url().endsWith('/popup/popup.html'));
        const popup = await popupTarget.asPage();
        await popup.waitForSelector('#ext-version');
        await popup.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: opening === 0 ? 'light' : 'dark' }]);
        expect(await popup.evaluate(() => innerWidth)).toBe(350);
        expect(await popup.$eval('body', el => el.getBoundingClientRect().width)).toBe(350);
        await popup.click('#open-settings-row-btn');
        await popup.waitForFunction(() => {
          const slider = document.querySelector('#views-slider');
          const settings = document.querySelector('#settings-view');
          return settings.classList.contains('is-active') && Math.abs(slider.clientHeight - settings.offsetHeight) <= 1;
        });
        await popup.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'));
        expect(await popup.$eval('#settings-view', el => getComputedStyle(el).transform)).toBe('none');
        expect(await popup.$eval('#settings-view', el => getComputedStyle(el).willChange)).toBe('auto');
        expect(await popup.$eval('.undo-active-thumb', el => getComputedStyle(el).boxShadow)).toBe('none');
        await popup.click('.undo-pill[data-seconds="15"]');
        await popup.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'));
        expect(await popup.$eval('.undo-pill.active', el => el.dataset.seconds)).toBe('15');
        expect(await popup.evaluate(() => Math.abs(
          document.querySelector('.undo-active-thumb').getBoundingClientRect().left -
          document.querySelector('.undo-pill.active').getBoundingClientRect().left
        ))).toBeLessThanOrEqual(1);
        expect(await popup.$eval('body', el => el.getBoundingClientRect().width)).toBe(350);
        expect(await popup.evaluate(() => innerHeight)).toBeLessThanOrEqual(600);
        await popup.keyboard.press('Escape');
        await popup.waitForFunction(() => document.querySelector('#main-view').classList.contains('is-active'));
        expect(await popup.$eval('body', el => el.getBoundingClientRect().width)).toBe(350);
        expect(await popup.evaluate(() => document.activeElement.id)).toBe('open-settings-row-btn');
        await popup.close();
      }
    } finally {
      await browser.close();
    }
  });
});

describe('Welcome and update pages', () => {
  jest.setTimeout(30000);
  let browser;
  let page;
  let extensionOrigin;
  let errors;

  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: true, pipe: true, enableExtensions: [extensionPath] });
    const target = await browser.waitForTarget(t => t.url().endsWith('/pages/welcome.html'));
    extensionOrigin = target.url().replace(/\/pages\/welcome\.html$/, '');
    await (await target.page()).close();
  });

  afterAll(async () => { await browser?.close(); });

  beforeEach(async () => {
    errors = [];
    page = await browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${extensionOrigin}/pages/welcome.html`);
    await page.evaluate(async () => {
      await chrome.storage.local.clear();
      await chrome.storage.sync.clear();
    });
    await page.reload();
  });

  afterEach(async () => {
    await page?.close();
    expect(errors).toEqual([]);
  });

  test('uses the newest stored color, opacity and undo duration and supports live changes', async () => {
    await page.evaluate(async () => {
      await chrome.storage.local.set({
        buttonColor: { rgba: 'rgba(255, 255, 255, 0.5)', hoverRgba: 'rgba(200, 200, 200, 0.5)', iconColor: '#0f0f0f' },
        buttonColorUpdatedAt: 20,
        buttonUndoSeconds: 15,
        buttonUndoSecondsUpdatedAt: 10
      });
      await chrome.storage.sync.set({
        buttonColor: { rgba: 'rgba(0, 0, 255, 1)', hoverRgba: 'rgba(0, 0, 200, 1)' },
        buttonColorUpdatedAt: 10,
        buttonUndoSeconds: 1,
        buttonUndoSecondsUpdatedAt: 20
      });
    });
    await page.reload();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#demo-btn')).backgroundColor === 'rgba(255, 255, 255, 0.5)');
    expect(await page.$eval('#demo-btn', el => getComputedStyle(el).backgroundColor)).toBe('rgba(255, 255, 255, 0.5)');
    expect(await page.$eval('.demo-btn-icon', el => getComputedStyle(el).backgroundColor)).toBe('rgb(15, 15, 15)');
    await page.click('#demo-btn');
    expect(await page.$eval('#demo-btn', el => getComputedStyle(el, '::after').animationDuration)).toBe('1s');
    await page.waitForFunction(() => {
      const angle = parseFloat(getComputedStyle(document.querySelector('#demo-btn'), '::after').getPropertyValue('--wl-undo-angle'));
      return angle > 0 && angle < 350;
    });
    await page.waitForFunction(() => !document.querySelector('#demo-btn').classList.contains('is-added'));
    await page.evaluate(async () => {
      await chrome.storage.sync.set({ buttonUndoSeconds: 15, buttonUndoSecondsUpdatedAt: 30 });
    });
    await page.click('#demo-btn');
    expect(await page.$eval('#demo-btn', el => getComputedStyle(el, '::after').animationDuration)).toBe('15s');
    await page.click('#demo-btn');
    expect(await page.$eval('#demo-btn', el => el.classList.contains('is-added'))).toBe(false);
    await page.evaluate(async () => {
      await chrome.storage.local.remove(['buttonColor', 'buttonColorUpdatedAt']);
      await chrome.storage.sync.remove(['buttonColor', 'buttonColorUpdatedAt']);
    });
    await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--wl-color-default') === '');
    expect(await page.$eval('.demo-btn-icon', el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
  });

  test('shows a brief success state without undo when the timer is Off', async () => {
    await page.evaluate(async () => {
      await chrome.storage.local.set({ buttonUndoSeconds: 0, buttonUndoSecondsUpdatedAt: 10 });
    });
    await page.reload();
    await page.waitForFunction(() => document.readyState === 'complete');
    await page.focus('#demo-btn');
    await page.keyboard.press('Space');
    expect(await page.$eval('#demo-btn', el => el.classList.contains('is-added'))).toBe(true);
    expect(await page.$eval('#demo-btn', el => el.classList.contains('is-undo-active'))).toBe(false);
    expect(await page.$eval('#demo-btn', el => el.getAttribute('aria-label'))).toBe(await page.evaluate(() => chrome.i18n.getMessage('wlButtonDefaultTitle')));
    await page.waitForFunction(() => !document.querySelector('#demo-btn').classList.contains('is-added'));
  });

  test('localizes the version message and navigates CTA links in the same tab', async () => {
    await page.goto(`${extensionOrigin}/pages/update.html`);
    const expected = await page.evaluate(() => ({
      title: chrome.i18n.getMessage('updateTitle'),
      message: chrome.i18n.getMessage('updateVersionMessage', [`v${chrome.runtime.getManifest().version}`]),
      lang: chrome.i18n.getUILanguage().replace(/_/g, '-')
    }));
    expect(await page.title()).toBe(expected.title);
    expect(await page.$eval('[data-i18n="updateVersionMessage"]', el => el.textContent)).toBe(expected.message);
    expect(await page.$eval('html', el => el.lang)).toBe(expected.lang);
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.isNavigationRequest() && request.url().startsWith('https://www.youtube.com')) {
        void request.respond({ status: 200, contentType: 'text/html', body: '<!doctype html><title>YouTube fixture</title>' });
      } else {
        void request.continue();
      }
    });
    for (const name of ['welcome', 'update']) {
      for (const selector of ['.btn-primary', '.btn-secondary']) {
        await page.goto(`${extensionOrigin}/pages/${name}.html`);
        expect(await page.$eval(selector, el => el.target)).toBe('');
        const pageCount = (await browser.pages()).length;
        await Promise.all([page.waitForNavigation(), page.click(selector)]);
        expect(new URL(page.url()).hostname).toBe('www.youtube.com');
        expect((await browser.pages()).length).toBe(pageCount);
      }
    }
  });

  test('keeps the demo usable and hides unknown versions outside the extension', async () => {
    for (const name of ['welcome', 'update']) {
      await page.goto(pathToFileURL(path.join(extensionPath, 'pages', `${name}.html`)).href);
      expect(await page.$$eval('.version-label, .version-chip', els => els.every(el => el.hidden))).toBe(true);
      if (name === 'welcome') {
        await page.click('#demo-btn');
        expect(await page.$eval('#demo-btn', el => el.classList.contains('is-undo-active'))).toBe(true);
        await page.click('#demo-btn');
        expect(await page.$eval('#demo-btn', el => el.classList.contains('is-added'))).toBe(false);
      } else {
        expect(await page.$eval('[data-i18n="updateVersionMessage"]', el => el.hidden)).toBe(true);
      }
      await page.setViewport({ width: 350, height: 700 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(350);
    }
  });
});

describe('Watch Later Button E2E Test', () => {
  let browser;
  let page;

  // Includes extension startup and SPA navigation delays.
  jest.setTimeout(90000);

  beforeAll(async () => {
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wl-e2e-'));
    const launchOptions = {
      headless: true,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ],
      userDataDir
    };

    const chromePath = findChromeExecutable();
    if (chromePath) {
      launchOptions.executablePath = chromePath;
    }

    browser = await puppeteer.launch(launchOptions);
    page = await browser.newPage();
  });

  afterAll(async () => {
    if (browser) {
      await browser.close().catch(() => {});
    }
    if (userDataDir) {
      try {
        fs.rmSync(userDataDir, { recursive: true, force: true });
      } catch {}
    }
  });

  test('should inject the "Watch Later" button on a YouTube video page', async () => {
    // 1. Go to the video page
    await gotoWithConsent(page, YOUTUBE_VIDEO_URL);

    // 2. Wait for the button to appear on the page.
    // Puppeteer will wait up to 30 seconds for the element to become available.
    const button = await page.waitForSelector(WATCH_LATER_BUTTON_SELECTOR, { timeout: 45000 });

    // 3. Check that the element (button) was found.
    // If waitForSelector does not find the element, it will throw an error and the test will fail.
    // This check adds clarity.
    expect(button).not.toBeNull();
  });

  test('should keep button after real SPA navigation to another video', async () => {
    await gotoWithConsent(page, YOUTUBE_VIDEO_URL);
    await page.waitForSelector(WATCH_LATER_BUTTON_SELECTOR, { timeout: 45000 });

    const currentVideoId = await page.evaluate(() => {
      return new URL(window.location.href).searchParams.get('v');
    });

    const clickedVideoId = await page.evaluate((activeVideoId) => {
      const links = Array.from(document.querySelectorAll('a[href*="/watch?v="]'));

      for (const link of links) {
        const href = link.getAttribute('href') || '';
        if (!href || href.startsWith('#')) {
          continue;
        }

        const url = new URL(link.href, window.location.origin);
        const videoId = url.searchParams.get('v');

        if (videoId && videoId !== activeVideoId) {
          link.click();
          return videoId;
        }
      }

      return null;
    }, currentVideoId);

    // Fallback in case there is no clickable recommendation in current layout.
    if (!clickedVideoId) {
      await gotoWithConsent(page, SECOND_YOUTUBE_VIDEO_URL);
    } else {
      await page.waitForFunction(
        (expectedVideoId) => new URL(window.location.href).searchParams.get('v') === expectedVideoId,
        { timeout: 45000 },
        clickedVideoId,
      );
    }

    const buttonAfterNavigation = await page.waitForSelector(WATCH_LATER_BUTTON_SELECTOR, { timeout: 45000 });
    expect(buttonAfterNavigation).not.toBeNull();
  });

  test('should inject watch-page button after Home -> Watch SPA navigation', async () => {
    await gotoWithConsent(page, YOUTUBE_HOME_URL);

    const hasWatchLinkOnHome = await page
      .waitForFunction(
        () => document.querySelectorAll('a[href*="/watch?v="]').length > 0,
        { timeout: 15000 },
      )
      .then(() => true)
      .catch(() => false);

    if (!hasWatchLinkOnHome) {
      console.warn('Home feed has no watch links in this environment; skipping Home -> Watch scenario.');
      return;
    }

    const clickedVideoId = await clickAnyWatchLink(page);
    expect(clickedVideoId).not.toBeNull();

    await page.waitForFunction(
      (expectedVideoId) => new URL(window.location.href).searchParams.get('v') === expectedVideoId,
      { timeout: 45000 },
      clickedVideoId,
    );

    const buttonAfterNavigation = await page.waitForSelector(WATCH_LATER_BUTTON_SELECTOR, { timeout: 45000 });
    expect(buttonAfterNavigation).not.toBeNull();
  });

  test('should inject watch-page button after Results -> Watch SPA navigation', async () => {
    await gotoWithConsent(page, YOUTUBE_RESULTS_URL);

    await page.waitForSelector('a[href*="/watch?v="]', { timeout: 45000 });
    const clickedVideoId = await clickAnyWatchLink(page);
    expect(clickedVideoId).not.toBeNull();

    await page.waitForFunction(
      (expectedVideoId) => new URL(window.location.href).searchParams.get('v') === expectedVideoId,
      { timeout: 45000 },
      clickedVideoId,
    );

    const buttonAfterNavigation = await page.waitForSelector(WATCH_LATER_BUTTON_SELECTOR, { timeout: 45000 });
    expect(buttonAfterNavigation).not.toBeNull();
  });

  test('should inject the "Watch Later" button on a YouTube Shorts page', async () => {
    await gotoWithConsent(page, YOUTUBE_SHORTS_URL);

    // Diagnostic: log final URL and available Shorts-related elements
    const diagnostics = await page.evaluate(() => {
      const selectors = [
        'ytd-reel-video-renderer',
        'ytd-shorts',
        'ytd-reel-video-renderer #actions',
        'ytd-shorts ytd-reel-video-renderer #actions',
        'ytd-reel-player-overlay-renderer',
        'ytd-reel-player-overlay-renderer #actions',
        '#actions',
      ];
      return {
        url: window.location.href,
        found: selectors.filter(s => document.querySelector(s) !== null),
      };
    });
    console.log('Shorts diagnostics:', JSON.stringify(diagnostics, null, 2));

    const button = await page.waitForSelector(WATCH_LATER_BUTTON_SELECTOR, { timeout: 45000 });
    expect(button).not.toBeNull();
  });

  test('should keep button after SPA navigation from Watch to Shorts', async () => {
    await gotoWithConsent(page, YOUTUBE_VIDEO_URL);
    await page.waitForSelector(WATCH_LATER_BUTTON_SELECTOR, { timeout: 45000 });

    await gotoWithConsent(page, YOUTUBE_SHORTS_URL);

    const buttonOnShorts = await page.waitForSelector(WATCH_LATER_BUTTON_SELECTOR, { timeout: 45000 });
    expect(buttonOnShorts).not.toBeNull();
  });

  test('should inject the button into video cards on search results and prevent navigation on click', async () => {
    await gotoWithConsent(page, YOUTUBE_RESULTS_URL);

    // Wait for search result cards
    await page.waitForSelector('ytd-video-renderer, ytd-rich-item-renderer', { timeout: 45000 });

    const card = await page.$('ytd-video-renderer, ytd-rich-item-renderer');
    expect(card).not.toBeNull();
    await card.hover();

    const cardButton = await card.waitForSelector('.saveToWatchLater', { timeout: 15000 });
    expect(cardButton).not.toBeNull();

    const isMounted = await card.evaluate((el) => {
      const btn = el.querySelector('.saveToWatchLater');
      const parent = btn ? btn.parentElement : null;
      return parent ? (parent.classList.contains('wl-mount-relative') || getComputedStyle(parent).position === 'relative') : false;
    });
    expect(isMounted).toBe(true);

    const urlBeforeClick = page.url();
    await cardButton.click();
    await new Promise((r) => setTimeout(r, 1000));
    expect(page.url()).toBe(urlBeforeClick);
  });
});