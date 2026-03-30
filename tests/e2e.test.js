const puppeteer = require('puppeteer');
const path = require('path');

// Path to the directory with your extension
const extensionPath = path.join(__dirname, '..', 'chrome');

// YouTube video URL for testing
const YOUTUBE_VIDEO_URL = 'https://www.youtube.com/watch?v=PRgS7hBgR1k';
const SECOND_YOUTUBE_VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

// Selector for the button added by the extension.
const WATCH_LATER_BUTTON_SELECTOR = '#saveToPlaylist';

describe('Watch Later Button E2E Test', () => {
  let browser;
  let page;

  // Includes extension startup and SPA navigation delays.
  jest.setTimeout(90000);

  beforeAll(async () => {
    // Launch Chromium browser
    browser = await puppeteer.launch({
      headless: true, // Set to 'true' to run in headless mode
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    // Create a new page
    page = await browser.newPage();
  });

  afterAll(async () => {
    // Close the browser after all tests
    await browser.close();
  });

  test('should inject the "Watch Later" button on a YouTube video page', async () => {
    // 1. Go to the video page
    await page.goto(YOUTUBE_VIDEO_URL, { waitUntil: 'domcontentloaded' });

    // 2. Wait for the button to appear on the page.
    // Puppeteer will wait up to 30 seconds for the element to become available.
    const button = await page.waitForSelector(WATCH_LATER_BUTTON_SELECTOR, { timeout: 45000 });

    // 3. Check that the element (button) was found.
    // If waitForSelector does not find the element, it will throw an error and the test will fail.
    // This check adds clarity.
    expect(button).not.toBeNull();
  });

  test('should keep button after real SPA navigation to another video', async () => {
    await page.goto(YOUTUBE_VIDEO_URL, { waitUntil: 'domcontentloaded' });
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
      await page.goto(SECOND_YOUTUBE_VIDEO_URL, { waitUntil: 'domcontentloaded' });
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
});