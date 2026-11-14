const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const puppeteer = require('puppeteer');

const baseUrl = process.env.DOCS_URL || 'http://127.0.0.1:4000/';
const { version } = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/manifest.base.json'), 'utf8'));
const postsDirectory = path.join(__dirname, '../docs/_posts');
const posts = fs.readdirSync(postsDirectory).filter(name => name.endsWith('.md'));
const screenshotDirectory = process.argv.includes('--screenshots')
  ? fs.mkdtempSync(path.join(os.tmpdir(), 'watch-later-docs-'))
  : null;
const viewports = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 }
];

async function navigate(page, route) {
  const response = await page.goto(new URL(route, baseUrl).href, { waitUntil: 'networkidle2' });
  assert.equal(response.status(), 200, route);
  await page.evaluate(() => document.fonts.ready);
  const dimensions = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    pluralVoice: /\b(?:we|our|us)\b/i.test(document.body.innerText)
  }));
  assert.ok(dimensions.document <= dimensions.viewport, `${route}: horizontal overflow`);
  assert.equal(dimensions.pluralVoice, false, `${route}: plural developer voice`);
}

async function screenshot(page, name, selector) {
  if (!screenshotDirectory) return;
  const target = selector ? await page.$(selector) : page;
  await target.screenshot({ path: path.join(screenshotDirectory, `${name}.png`) });
}

async function checkFocus(page, selector) {
  await page.keyboard.press('Tab');
  await page.focus(selector);
  await page.waitForFunction(selector => parseFloat(getComputedStyle(document.querySelector(selector)).outlineWidth) >= 2, {}, selector);
  const focused = await page.$eval(selector, element => {
    const style = getComputedStyle(element);
    return {
      active: document.activeElement === element,
      visible: element.matches(':focus-visible'),
      outline: style.outlineStyle,
      width: parseFloat(style.outlineWidth),
      color: style.outlineColor
    };
  });
  assert.equal(focused.active, true, `${selector}: focus`);
  assert.equal(focused.visible, true, `${selector}: focus-visible`);
  assert.notEqual(focused.outline, 'none', `${selector}: outline`);
  assert.ok(focused.width >= 2, `${selector}: outline width`);
  assert.notEqual(focused.color, 'rgba(0, 0, 0, 0)', `${selector}: transparent outline`);
}

async function checkHome(page, viewport, label) {
  await navigate(page, '/');
  assert.ok((await page.$eval('body', element => element.innerText)).includes(`v${version}`), 'Version differs from manifest');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), label.endsWith('-dark') ? 'dark' : 'light');
  const heroBelowNavigation = await page.evaluate(() => {
    const badge = document.querySelector('.home > div > section:first-child > div:first-child');
    const navigation = document.querySelector('nav[aria-label="Main Navigation"]');
    return badge.getBoundingClientRect().top >= navigation.getBoundingClientRect().bottom;
  });
  assert.ok(heroBelowNavigation, 'Hero badge obscured by fixed navigation');
  const browserBadges = await page.$$eval('[id^="store-link-"]', elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, left: rect.left, right: rect.right };
  }));
  assert.equal(browserBadges.length, 3);
  assert.ok(browserBadges.every(badge => Math.abs(badge.top - browserBadges[0].top) < 1));
  assert.ok(browserBadges.every(badge => badge.left >= 0 && badge.right <= viewport.width));
  const hiddenDisplays = await page.$$eval('#demo-ext-popup [hidden]', elements =>
    elements.map(element => getComputedStyle(element).display));
  assert.ok(hiddenDisplays.every(display => display === 'none'), 'Hidden popup panels are visible');
  assert.equal(await page.$eval('#demo-yt-toast', element => getComputedStyle(element).visibility), 'hidden');
  assert.equal(await page.$eval('#demo-wl-btn', element => element.getBoundingClientRect().width), 40);
  const stats = await page.$eval('.grid[class~="sm:grid-cols-3"]', element =>
    [...element.children].map(child => ({ align: getComputedStyle(child).alignItems, text: getComputedStyle(child).textAlign })));
  assert.ok(stats.every(stat => stat.align === 'center' && stat.text === 'center'));
  await screenshot(page, `${label}-home`);
  await screenshot(page, `${label}-demo`, '#demo');
  await screenshot(page, `${label}-stats`, 'section:has(.grid[class~="sm:grid-cols-3"])');

  for (const selector of ['[data-theme-toggle]', '#hero-primary-cta', '#demo-wl-btn', '#demo-popup-color-hex', '#demo-popup-opacity-slider', '#demo-popup-shortcut-btn']) {
    await checkFocus(page, selector);
  }
  await page.click('#demo-wl-btn');
  assert.equal(await page.$eval('#demo-wl-btn', element => element.classList.contains('is-saved')), true);
  await page.waitForSelector('#demo-undo-btn', { visible: true });
  await screenshot(page, `${label}-saved`, '.yt-mockup');
  await page.click('#demo-undo-btn');
  assert.equal(await page.$eval('#demo-wl-btn', element => element.classList.contains('is-saved')), false);

  await page.focus('#demo-wl-btn');
  await page.keyboard.down('Alt');
  await page.keyboard.down('w');
  await page.keyboard.down('w');
  await page.keyboard.up('w');
  await page.keyboard.up('Alt');
  assert.equal(await page.$eval('#demo-wl-btn', element => element.classList.contains('is-saved')), true);
  await page.click('#demo-undo-btn');
  await page.focus('#demo-popup-color-hex');
  await page.keyboard.down('Alt');
  await page.keyboard.press('w');
  await page.keyboard.up('Alt');
  assert.equal(await page.$eval('#demo-wl-btn', element => element.classList.contains('is-saved')), false);

  await page.click('#demo-popup-color-hex', { clickCount: 3 });
  await page.type('#demo-popup-color-hex', '#336699');
  assert.equal(await page.$eval('#demo-wl-btn', element => element.style.getPropertyValue('--demo-color')), '#336699');
  await page.focus('#demo-popup-opacity-slider');
  await page.keyboard.press('Home');
  assert.equal(await page.$eval('#demo-popup-opacity-val', element => element.textContent), '0%');
  assert.equal(await page.$eval('#demo-wl-btn', element => element.style.getPropertyValue('--demo-opacity')), '0');
  await page.click('#demo-popup-color-hex', { clickCount: 3 });
  await page.type('#demo-popup-color-hex', '#invalid');
  assert.equal(await page.$eval('#demo-wl-btn', element => element.style.getPropertyValue('--demo-color')), '#336699');

  await page.click('[data-seconds="custom"]');
  await page.waitForSelector('#demo-popup-custom-undo', { visible: true });
  await page.click('#demo-custom-undo-input', { clickCount: 3 });
  await page.type('#demo-custom-undo-input', '60');
  await page.click('#demo-undo-step-up');
  assert.equal(await page.$eval('#demo-custom-undo-input', element => element.value), '60');
  await page.click('#demo-custom-undo-input', { clickCount: 3 });
  await page.type('#demo-custom-undo-input', '1');
  await page.click('#demo-undo-step-down');
  assert.equal(await page.$eval('#demo-custom-undo-input', element => element.value), '1');
  await page.click('#demo-wl-btn');
  await page.focus('#demo-undo-btn');
  await page.waitForFunction(() => !document.querySelector('#demo-wl-btn').classList.contains('is-undo-active'));
  assert.equal(await page.$eval('#demo-yt-toast', element => getComputedStyle(element).visibility), 'hidden');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'demo-wl-btn');
  assert.equal(await page.$eval('#demo-wl-btn', element => element.classList.contains('is-saved')), false);
  await page.click('#demo-wl-btn');
  assert.equal(await page.$eval('#demo-wl-btn', element => element.classList.contains('is-undo-active')), true);
  await page.click('#demo-undo-btn');

  await page.click('#demo-popup-reset-btn');
  assert.equal(await page.$eval('#demo-popup-opacity-val', element => element.textContent), '100%');
  assert.equal(await page.$eval('#demo-popup-custom-undo', element => getComputedStyle(element).display), 'none');
  await page.click('[data-seconds="0"]');
  await page.click('#demo-wl-btn');
  assert.equal(await page.$eval('#demo-undo-btn', element => getComputedStyle(element).display), 'none');
  await page.click('#demo-wl-btn');
  assert.equal(await page.$eval('#demo-wl-btn', element => element.classList.contains('is-saved')), true);
  assert.equal(await page.$eval('#demo-wl-btn', element => element.classList.contains('is-undo-active')), false);
  await page.waitForFunction(() => !document.querySelector('#demo-wl-btn').classList.contains('is-saved'));
  await page.click('#demo-wl-btn');
  await page.click('#demo-popup-reset-btn');
  await page.click('[data-seconds="custom"]');
  await page.$eval('#demo-custom-undo-input', element => {
    element.value = '2';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('#demo-wl-btn');
  await page.waitForFunction(() => document.querySelector('#demo-undo-timer').textContent === '1');
  assert.equal(await page.$eval('#demo-wl-btn', element => element.classList.contains('is-undo-active')), true);
  assert.equal(await page.$eval('#demo-yt-toast', element => getComputedStyle(element).visibility), 'visible');
  assert.notEqual(await page.$eval('#demo-undo-btn', element => getComputedStyle(element).display), 'none');
  await page.click('#demo-popup-reset-btn');

  await page.$eval('#demo-back-btn', element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await screenshot(page, `${label}-before-back`);
  await page.click('#demo-back-btn');
  assert.equal(await page.$eval('#demo-settings-view', element => getComputedStyle(element).display), 'none');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'demo-open-settings-btn');
  await page.click('#demo-open-settings-btn');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'demo-back-btn');
  assert.equal(await page.$eval('#demo-popup-header', element => getComputedStyle(element).display), 'none');
  await page.click('#review-dropdown-btn');
  await page.focus('#review-dropdown-menu a');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'review-dropdown-btn');
  assert.equal(await page.$eval('#review-dropdown-btn', element => element.getAttribute('aria-expanded')), 'false');
  await page.click('.faq-item:nth-child(2) summary');
  assert.equal(await page.$eval('.faq-item:nth-child(2)', element => element.open), true);
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.click('[data-theme-toggle]');
  assert.notEqual(await page.evaluate(() => document.documentElement.dataset.theme), theme);
  await page.reload({ waitUntil: 'networkidle2' });
  assert.notEqual(await page.evaluate(() => document.documentElement.dataset.theme), theme);
}

async function checkUpdates(page, viewport, label) {
  await navigate(page, '/updates/');
  const cards = await page.$$eval('.release-card', elements => elements.map(element => ({
    href: element.getAttribute('href'),
    decoration: getComputedStyle(element).textDecorationLine,
    width: element.getBoundingClientRect().width,
    dateWidth: element.querySelector('time').getBoundingClientRect().width,
    badges: [...element.querySelectorAll('span.rounded-full')].map(badge => badge.textContent.trim()),
    summary: element.querySelector('.release-summary').textContent.trim(),
    summaryClipped: element.querySelector('.release-summary').scrollHeight > element.querySelector('.release-summary').clientHeight
  })));
  assert.equal(cards.length, posts.length, 'Archive post count');
  assert.equal(new Set(cards.map(card => card.href)).size, posts.length, 'Duplicate release URLs');
  assert.ok(cards.every(card => card.decoration === 'none'), 'Release cards inherit prose underlines');
  assert.ok(cards.every(card => card.dateWidth < card.width), 'Stretched date badge');
  assert.ok(cards.every(card => !card.summaryClipped), 'Clipped release summary');
  assert.equal(cards.filter(card => card.badges.includes('Latest')).length, 1);
  assert.ok(cards[0].badges.includes('Latest'));
  for (const category of ['Release', 'Firefox', 'Privacy', 'Announcement']) {
    assert.ok(cards.some(card => card.badges.includes(category)), `Missing ${category} badge`);
  }
  for (const name of posts) {
    const content = fs.readFileSync(path.join(postsDirectory, name), 'utf8');
    const summary = content.match(/^summary: "(.+)"$/m)?.[1];
    assert.ok(summary, `${name}: missing summary`);
    assert.ok(cards.some(card => card.summary === summary), `${name}: summary not rendered`);
  }
  await screenshot(page, `${label}-updates`);
  await checkFocus(page, '.release-card');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
    page.click('.release-card')
  ]);
  assert.ok(await page.$('.h-entry'), 'Release card navigation');
  await page.goBack({ waitUntil: 'networkidle2' });
  return cards.map(card => card.href);
}

async function checkLegal(page, label) {
  await navigate(page, '/privacy/');
  const anchors = await page.$$eval('nav[aria-label="Table of contents"] a', elements => elements.map(element => ({
    href: element.getAttribute('href'),
    exists: Boolean(document.getElementById(element.hash.slice(1)))
  })));
  assert.equal(anchors.length, 15);
  assert.ok(anchors.every(anchor => anchor.exists), `Broken TOC: ${JSON.stringify(anchors.filter(anchor => !anchor.exists))}`);
  await screenshot(page, `${label}-privacy`);
  await page.click('nav[aria-label="Table of contents"] a[href="#permissions"]');
  await page.waitForFunction(() => Math.abs(document.querySelector('#permissions').getBoundingClientRect().top - 128) < 2);
  await checkFocus(page, 'nav[aria-label="Table of contents"] a');
  await navigate(page, '/impressum/');
  assert.ok(await page.$('a[href="mailto:pletnov.alex@gmail.com"]'));
  assert.ok(await page.$('a[href="https://watchlater.alxple.com/"]'));
  assert.ok(await page.$('a[href="https://ec.europa.eu/consumers/odr/"]'));
  const text = await page.$eval('.post-content', element => element.innerText);
  assert.ok(text.includes('Digitale-Dienste-Gesetz'));
  assert.ok(text.includes('July 20, 2025'));
  assert.ok(!text.includes('TMG') && !text.includes('§ 7'));
  await checkFocus(page, 'a[href^="mailto:"]');
  await screenshot(page, `${label}-impressum`);
}

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  try {
    let releaseUrls;
    for (const viewport of viewports) {
      for (const theme of ['light', 'dark']) {
        const context = await browser.createBrowserContext();
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('response', response => {
          if (response.url().startsWith(baseUrl) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
        });
        await page.setViewport(viewport);
        await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
        const label = `${viewport.width}-${theme}`;
        await checkHome(page, viewport, label);
        await page.evaluate(theme => localStorage.setItem('wl-docs-theme', theme), theme);
        releaseUrls = await checkUpdates(page, viewport, label);
        await checkLegal(page, label);
        assert.deepEqual(errors, [], label);
        await context.close();
        console.log(`PASS ${label}: layout, keyboard, sandbox, archive, legal pages`);
      }
    }
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    for (const url of releaseUrls) {
      await navigate(page, url);
      assert.ok(await page.$('.h-entry .p-name'), `${url}: post layout missing`);
      if (url.includes('v1.6.3')) {
        assert.ok((await page.$$('kbd')).length >= 5);
        await screenshot(page, '390-hotkeys');
      }
    }
    console.log(`PASS ${releaseUrls.length} release pages: navigation, copy, mobile overflow`);
    if (screenshotDirectory) console.log(`Screenshots: ${screenshotDirectory}`);
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  if (screenshotDirectory) console.error(`Screenshots: ${screenshotDirectory}`);
  process.exitCode = 1;
});
