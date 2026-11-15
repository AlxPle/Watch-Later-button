const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const os = require('os');

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
        expect(await popup.evaluate(() => innerWidth)).toBe(350);
        expect(await popup.$eval('body', el => el.getBoundingClientRect().width)).toBe(350);
        await popup.click('#open-settings-row-btn');
        await popup.waitForFunction(() => {
          const slider = document.querySelector('#views-slider');
          const settings = document.querySelector('#settings-view');
          return settings.classList.contains('is-active') && Math.abs(slider.clientHeight - settings.offsetHeight) <= 1;
        });
        await popup.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'));
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