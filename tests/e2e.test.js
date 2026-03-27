const puppeteer = require('puppeteer');
const path = require('path');

// Path to the directory with your extension
const extensionPath = path.join(__dirname, 'chrome');

// YouTube video URL for testing
const YOUTUBE_VIDEO_URL = 'https://www.youtube.com/watch?v=PRgS7hBgR1k';

// Selector for the button added by your extension.
// IMPORTANT: This selector is an assumption. You need to replace it
// with the actual ID or class you assign to the button in saveto.js.
const WATCH_LATER_BUTTON_SELECTOR = '#saveToPlaylist';

describe('Watch Later Button E2E Test', () => {
  let browser;
  let page;

  // Increase the default Jest timeout, since launching the browser and loading the page may take a while
  jest.setTimeout(30000);

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
    const button = await page.waitForSelector(WATCH_LATER_BUTTON_SELECTOR);

    // 3. Check that the element (button) was found.
    // If waitForSelector does not find the element, it will throw an error and the test will fail.
    // This check adds clarity.
    expect(button).not.toBeNull();
  });
});