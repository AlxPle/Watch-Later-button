const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function checkPopupDemo(page, label, screenshot) {
  await page.waitForSelector('#demo-popup-frame[data-ready="true"]');
  const element = await page.$('#demo-popup-frame');
  let frame = await element.contentFrame();
  const keyboard = page.keyboard;
  const isSaved = () => page.$eval('#demo-wl-btn', el => el.classList.contains('is-saved'));
  const frameHeight = () => page.$eval('#demo-popup-frame', el => el.getBoundingClientRect().height);
  const pressShortcut = async (key = 'w', repeat = false) => {
    await keyboard.down('Alt');
    await keyboard.down(key);
    if (repeat) await keyboard.down(key);
    await keyboard.up(key);
    await keyboard.up('Alt');
  };
  const change = async (selector, value) => {
    await frame.$eval(selector, (el, value) => {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  };
  const reset = async () => {
    await frame.click('#reset-color-btn');
    await page.waitForFunction(() => document.querySelector('#demo-wl-btn').style.getPropertyValue('--demo-opacity') === '1');
  };
  const settledHeight = async () => {
    await page.waitForFunction(() => {
      const iframe = document.querySelector('#demo-popup-frame');
      const body = iframe.contentDocument.body;
      const panel = body.querySelector('.popup-container');
      const active = body.querySelector('.view-panel.is-active');
      const slider = body.querySelector('#views-slider');
      return Math.abs(slider.getBoundingClientRect().height - active.offsetHeight) <= 1 &&
        Math.abs(iframe.clientHeight - panel.getBoundingClientRect().height) <= 1;
    });
  };
  const checkTheme = async () => {
    const dark = await page.evaluate(() => document.documentElement.dataset.theme === 'dark');
    await frame.waitForFunction(dark => matchMedia('(prefers-color-scheme: dark)').matches === dark, {}, dark);
    assert.equal(await frame.$eval('body', el => getComputedStyle(el).backgroundColor), dark ? 'rgb(15, 15, 15)' : 'rgb(255, 255, 255)');
  };

  assert.ok(await element.evaluate(el => el.title));
  assert.equal(await frame.$eval('#settings-view', el => el.inert), false);
  assert.equal(await frame.$eval('#main-view', el => el.inert), true);
  assert.equal(await frame.$eval('#ext-version', el => el.textContent), `v${JSON.parse(fs.readFileSync(path.join(__dirname, '../src/manifest.base.json'))).version}`);
  assert.equal(await frame.evaluate(() => typeof browser.runtime.sendMessage), 'undefined');
  await settledHeight();
  assert.equal(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(await frame.$eval('#settings-view', el => el.scrollHeight <= el.clientHeight + 1), true);
  await checkTheme();
  await page.click('[data-theme-toggle]');
  await checkTheme();
  await page.click('[data-theme-toggle]');
  await checkTheme();
  await screenshot(page, `${label}-popup`, '#demo-popup-frame');

  const initialHeight = await frameHeight();
  await frame.click('[data-seconds="custom"]');
  await page.waitForFunction(height => document.querySelector('#demo-popup-frame').clientHeight > height + 20, {}, initialHeight);
  await settledHeight();
  assert.ok(await frameHeight() > initialHeight + 20, 'Custom duration must resize iframe');
  await change('#custom-undo-input', '60');
  await frame.click('#undo-step-up');
  assert.equal(await frame.$eval('#custom-undo-input', el => el.value), '60');
  await change('#custom-undo-input', '1');
  await frame.click('#undo-step-down');
  assert.equal(await frame.$eval('#custom-undo-input', el => el.value), '1');
  await page.click('#demo-wl-btn');
  await page.focus('#demo-undo-btn');
  await page.waitForFunction(() => !document.querySelector('#demo-wl-btn').classList.contains('is-saved'));
  assert.equal(await page.evaluate(() => document.activeElement.id), 'demo-wl-btn');
  assert.equal(await page.$eval('#demo-yt-toast', el => getComputedStyle(el).visibility), 'hidden');
  await change('#custom-undo-input', '2');
  await page.click('#demo-wl-btn');
  await page.waitForFunction(() => document.querySelector('#demo-undo-timer').textContent === '1');
  assert.equal(await isSaved(), true);
  await page.click('#demo-undo-btn');
  assert.equal(await isSaved(), false);

  await reset();
  await frame.click('[data-color="#ffffff"]');
  await page.waitForFunction(() => document.querySelector('#demo-wl-btn').style.getPropertyValue('--demo-icon-color') === '#0f0f0f');
  await frame.click('[data-color="#3ea6ff"]');
  await page.waitForFunction(() => document.querySelector('#demo-wl-btn').style.getPropertyValue('--demo-color') === '#3ea6ff');
  await change('#color-hex', '#3698');
  assert.equal(await frame.$eval('#color-picker', el => el.value), '#3ea6ff');
  await change('#color-hex', '#33669980');
  await page.waitForFunction(() => document.querySelector('#demo-wl-btn').style.getPropertyValue('--demo-opacity') === '0.5');
  await frame.focus('#opacity-slider');
  await keyboard.press('Home');
  await page.waitForFunction(() => document.querySelector('#demo-wl-btn').style.getPropertyValue('--demo-opacity') === '0');
  assert.equal(await frame.$eval('#opacity-val', el => el.textContent), '0%');
  await change('#color-hex', '#invalid');
  assert.equal(await frame.$eval('#color-picker', el => el.value), '#336699');
  await change('#color-picker', '#abcdef');
  await change('#opacity-slider', '65');
  await frame.waitForFunction(async () => (await browser.storage.sync.get('buttonColor')).buttonColor?.alpha === 65);
  assert.equal((await frame.evaluate(() => browser.storage.local.get('buttonColor'))).buttonColor.hex, '#abcdef');

  const chrome = process.env.TEST_BROWSER !== 'firefox';
  if (chrome) await page.browserContext().overridePermissions(new URL(page.url()).origin, ['clipboard-read', 'clipboard-write']);
  await frame.evaluate(() => {
    const writeText = navigator.clipboard.writeText.bind(navigator.clipboard);
    const copy = document.execCommand.bind(document);
    navigator.clipboard.writeText = async text => {
      await writeText(text);
      window.copiedColor = text;
    };
    document.execCommand = command => {
      const result = copy(command);
      if (command === 'copy' && result) window.copiedColor = document.querySelector('#rgba-output').value;
      return result;
    };
  });
  const colorText = await frame.$eval('#rgba-output', el => el.value);
  await frame.click('#rgba-output');
  await frame.waitForFunction(text => window.copiedColor === text, {}, colorText);
  assert.equal(await frame.$eval('#rgba-copy-wrap', el => el.classList.contains('is-copied')), true);
  if (chrome) assert.equal(await frame.evaluate(() => navigator.clipboard.readText()), colorText);
  await frame.evaluate(() => {
    window.copiedColor = null;
    navigator.clipboard.writeText = async () => { throw new Error('Clipboard API unavailable'); };
  });
  await frame.click('#rgba-output');
  await frame.waitForFunction(text => window.copiedColor === text, {}, colorText);
  if (chrome) assert.equal(await frame.evaluate(() => navigator.clipboard.readText()), colorText);

  await frame.focus('#color-hex');
  await pressShortcut();
  assert.equal(await isSaved(), false);
  await frame.click('#shortcut-btn');
  await keyboard.press('Escape');
  assert.equal(await frame.$eval('#settings-view', el => el.inert), false);
  assert.equal(await frame.$eval('#shortcut-btn', el => el.textContent), 'Alt + W');
  await frame.click('#shortcut-btn');
  await pressShortcut('k');
  await page.waitForFunction(() => document.querySelector('#demo-shortcut-label').textContent === 'Alt + K');
  assert.equal(await isSaved(), false, 'Recording a shortcut must not save');
  await page.focus('#demo-wl-btn');
  await pressShortcut();
  assert.equal(await isSaved(), false, 'Old shortcut must not save');
  await pressShortcut('k', true);
  assert.equal(await isSaved(), true, 'Key repeat must not undo');
  await page.click('#demo-undo-btn');
  await frame.focus('#back-to-main-btn');
  await pressShortcut('k');
  await page.waitForFunction(() => document.querySelector('#demo-wl-btn').classList.contains('is-saved'));
  await page.click('#demo-undo-btn');

  await page.focus('#demo-wl-btn');
  await keyboard.press('Tab');
  await keyboard.down('Shift');
  await keyboard.press('Tab');
  await keyboard.up('Shift');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'demo-wl-btn');
  assert.equal(await page.$eval('#demo-wl-btn', el => el.matches(':focus-visible')), true);
  await page.waitForFunction(() => parseFloat(getComputedStyle(document.querySelector('#demo-wl-btn')).outlineWidth) >= 2);
  for (const selector of ['#color-hex', '#opacity-slider', '#shortcut-btn', '#btn-preview']) {
    await keyboard.press('Tab');
    await frame.focus(selector);
    assert.equal(await frame.$eval(selector, el => el.matches(':focus-visible')), true);
    await frame.waitForFunction(selector => {
      const style = getComputedStyle(document.querySelector(selector));
      return parseFloat(style.outlineWidth) >= 2 ||
        (selector === '#btn-preview' && style.boxShadow.includes('0px 0px 0px 4px'));
    }, {}, selector);
  }
  await frame.focus('#btn-preview');
  await keyboard.down('Enter');
  await keyboard.down('Enter');
  await keyboard.up('Enter');
  assert.equal(await frame.$eval('#btn-preview', el => el.classList.contains('is-undo-active')), true);
  await keyboard.press('Enter');
  assert.equal(await frame.$eval('#btn-preview', el => el.classList.contains('is-added')), false);
  await frame.click('#btn-preview');
  assert.equal(await frame.$eval('#btn-preview', el => el.classList.contains('is-undo-active')), true);
  await frame.click('[data-seconds="0"]');
  assert.equal(await frame.$eval('#btn-preview', el => el.classList.contains('is-added')), false);
  assert.equal(await frame.evaluate(() => previewTimer), null);
  await frame.click('#btn-preview');
  await frame.click('#btn-preview');
  assert.equal(await frame.$eval('#btn-preview', el => el.classList.contains('is-added')), true);
  assert.equal(await frame.$eval('#btn-preview', el => el.classList.contains('is-undo-active')), false);
  await frame.waitForFunction(() => !document.querySelector('#btn-preview').classList.contains('is-added'));
  await page.click('#demo-wl-btn');
  await page.click('#demo-wl-btn');
  assert.equal(await isSaved(), true);
  assert.equal(await page.$eval('#demo-undo-btn', el => el.hidden), true);
  await page.waitForFunction(() => !document.querySelector('#demo-wl-btn').classList.contains('is-saved'));

  await frame.click('label[for="surface-watch-toggle"]');
  await page.waitForFunction(() => document.querySelector('#demo-wl-btn').hidden);
  await page.focus('#demo-shortcut-label');
  await pressShortcut('k');
  assert.equal(await isSaved(), false);
  for (const id of ['surface-shorts-toggle', 'surface-cards-toggle', 'update-notification-toggle']) {
    await frame.click(`label[for="${id}"]`);
    assert.equal(await frame.$eval(`#${id}`, el => el.getAttribute('aria-checked')), 'false');
  }
  await reset();
  await page.waitForFunction(() => !document.querySelector('#demo-wl-btn').hidden);
  await frame.click('#back-to-main-btn');
  await page.waitForFunction(height => document.querySelector('#demo-popup-frame').clientHeight < height - 100, {}, initialHeight);
  await settledHeight();
  assert.ok(await frameHeight() < initialHeight - 100, 'Main view must shrink iframe');
  assert.equal(await frame.evaluate(() => document.activeElement.id), 'open-settings-row-btn');
  const links = await frame.$$eval('a', elements => elements.map(el => ({ href: el.href, target: el.target, rel: el.rel })));
  assert.ok(links.every(link => link.href.startsWith('https://') && !link.href.includes('{{')));
  assert.ok(links.every(link => link.target === '_blank' && link.rel.includes('noopener')));
  await frame.click('#open-settings-row-btn');
  assert.equal(await frame.evaluate(() => document.activeElement.id), 'back-to-main-btn');
  await settledHeight();
  await keyboard.press('Escape');
  await settledHeight();
  assert.equal(await frame.evaluate(() => document.activeElement.id), 'open-settings-row-btn');
  await frame.click('#open-settings-row-btn');
  await settledHeight();

  const before = await frameHeight();
  await page.evaluate(() => {
    const frame = document.querySelector('#demo-popup-frame');
    for (const data of [null, { channel: 'other', type: 'resize', height: 150 },
      { channel: 'wl-popup-demo', type: 'resize', height: -1 },
      { channel: 'wl-popup-demo', type: 'resize', height: '150' },
      { channel: 'wl-popup-demo', type: 'settings', settings: {} }]) {
      window.dispatchEvent(new MessageEvent('message', { origin: location.origin, source: frame.contentWindow, data }));
    }
    for (const sender of [{ origin: 'https://invalid.example', source: frame.contentWindow }, { origin: location.origin, source: window }]) {
      window.dispatchEvent(new MessageEvent('message', { ...sender, data: { channel: 'wl-popup-demo', type: 'resize', height: 150 } }));
    }
  });
  assert.equal(await frameHeight(), before, 'Invalid messages must not resize iframe');
  assert.equal(await isSaved(), false);

  const storage = await frame.evaluate(async () => {
    const value = { nested: { number: 1 } };
    await browser.storage.local.set({ isolationProbe: value });
    value.nested.number = 2;
    const result = await browser.storage.local.get('isolationProbe');
    result.isolationProbe.nested.number = 3;
    return {
      local: await browser.storage.local.get('isolationProbe'),
      sync: await browser.storage.sync.get('isolationProbe'),
      defaults: await browser.storage.local.get({ missing: 7 }),
      persistent: [localStorage.getItem('buttonColor'), sessionStorage.getItem('buttonColor')]
    };
  });
  assert.deepEqual(storage, { local: { isolationProbe: { nested: { number: 1 } } }, sync: {}, defaults: { missing: 7 }, persistent: [null, null] });
  await frame.evaluate(async () => {
    const local = await browser.storage.local.get('buttonUndoSecondsUpdatedAt');
    window.remoteUndoTime = (local.buttonUndoSecondsUpdatedAt || 0) + 1000;
    await browser.storage.sync.set({ buttonUndoSeconds: 45, buttonUndoSecondsUpdatedAt: window.remoteUndoTime });
  });
  await frame.waitForFunction(() => document.querySelector('#undo-active-badge').textContent === '45s');
  await frame.evaluate(async () => {
    await browser.storage.sync.set({ buttonUndoSeconds: 15, buttonUndoSecondsUpdatedAt: window.remoteUndoTime - 1 });
  });
  assert.equal(await frame.$eval('#undo-active-badge', el => el.textContent), '45s');
  await frame.evaluate(async () => {
    await browser.storage.sync.set({ buttonUndoSeconds: 15, buttonUndoSecondsUpdatedAt: window.remoteUndoTime + 1 });
  });
  await frame.waitForFunction(() => document.querySelector('#undo-active-badge').textContent === '15s');
  await reset();
  await frame.click('#btn-preview');
  assert.equal(await frame.$eval('#btn-preview', el => el.classList.contains('is-undo-active')), true);
  await reset();
  assert.equal(await frame.$eval('#btn-preview', el => el.classList.contains('is-added')), false);
  assert.equal(await frame.evaluate(() => previewTimer), null);
  await change('#opacity-slider', '42');
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForSelector('#demo-popup-frame[data-ready="true"]');
  frame = await (await page.$('#demo-popup-frame')).contentFrame();
  assert.equal(await frame.$eval('#opacity-slider', el => el.value), '100');
  assert.deepEqual(await frame.evaluate(() => browser.storage.local.get(null)), {});
  assert.deepEqual(await frame.evaluate(() => browser.storage.sync.get(null)), {});
}

module.exports = { checkPopupDemo };

if (require.main === module) {
  const http = require('node:http');
  const os = require('node:os');
  const puppeteer = require('puppeteer');
  const docs = path.resolve(__dirname, '../docs');
  const home = fs.readFileSync(path.join(docs, '_layouts/home.html'), 'utf8');
  const demo = home.match(/<section id="demo"[\s\S]*?<\/section>/)[0]
    .replace(/\{%[\s\S]*?%\}/g, '')
    .replace(/\{\{\s*'([^']+)'\s*\| relative_url\s*\}\}/g, '$1');
  const themeScripts = [...fs.readFileSync(path.join(docs, '_includes/custom-head.html'), 'utf8').matchAll(/<script>[\s\S]*?<\/script>/g)].map(match => match[0]).join('\n');
  const fixture = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/assets/css/tailwind.css">${themeScripts}</head><body><button type="button" data-theme-toggle>Theme</button>${demo}<script src="/assets/popup-demo/host.js"></script></body></html>`;
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/') {
      response.setHeader('Content-Type', 'text/html');
      response.end(fixture);
      return;
    }
    const file = path.resolve(docs, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(docs + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.setHeader('Content-Type', { '.css': 'text/css', '.js': 'text/javascript', '.html': 'text/html', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(response);
  });
  (async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}/`;
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wl-popup-demo-'));
    const browserName = process.env.TEST_BROWSER || 'chrome';
    let browser;
    try {
      browser = await puppeteer.launch({ headless: true, browser: browserName, executablePath: process.env.TEST_BROWSER_PATH || undefined });
      for (const width of [1440, 390, 320]) {
        for (const theme of ['light', 'dark']) {
          const context = await browser.createBrowserContext();
          const page = await context.newPage();
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          page.on('response', response => {
            if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) errors.push(`${response.status()} ${response.url()}`);
          });
          await page.setViewport({ width, height: 900 });
          await page.evaluateOnNewDocument(theme => {
            if (!localStorage.getItem('wl-docs-theme')) localStorage.setItem('wl-docs-theme', theme);
          }, theme);
          await page.goto(url, { waitUntil: 'networkidle2' });
          await checkPopupDemo(page, `${width}-${theme}`, async (page, name, selector) => {
            await (await page.$(selector)).screenshot({ path: path.join(directory, `${name}.png`) });
          });
          assert.deepEqual(errors, []);
          await context.close();
          console.log(`PASS ${browserName} ${width}-${theme}: popup integration fixture`);
        }
      }
    } finally {
      await browser?.close();
      server.close();
      console.log(`Screenshots: ${directory}`);
    }
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
