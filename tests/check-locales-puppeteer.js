const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const os = require('os');

const extensionPath = process.env.EXTENSION_PATH || process.argv[2] || path.resolve(__dirname, '..', 'dist', 'chrome');
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wl-locales-'));

(async () => {
    console.log(`\x1b[36m[TEST:LOCALES]\x1b[0m Checking locales on extension: ${extensionPath}`);

    if (!fs.existsSync(extensionPath)) {
        console.error(`\x1b[31m[ERROR]\x1b[0m Extension path does not exist: ${extensionPath}`);
        console.error('Make sure to run `npm run build` before running tests.');
        process.exit(1);
    }

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

    const chromePath = findChromeExecutable();
    if (chromePath) {
        launchOptions.executablePath = chromePath;
        console.log(`Using Chrome binary: ${chromePath}`);
    }

    let failedLocales = 0;
    let totalChecks = 0;
    let browser;
    let locales = [];
    try {
        const localesDir = path.join(extensionPath, '_locales');
        locales = fs.existsSync(localesDir)
            ? fs.readdirSync(localesDir).filter(d => fs.statSync(path.join(localesDir, d)).isDirectory())
            : [];

        if (locales.length === 0) {
            console.error(`\x1b[31m[ERROR]\x1b[0m No locales found in ${localesDir}`);
            process.exit(1);
        }

        browser = await puppeteer.launch(launchOptions);

    console.log(`Found ${locales.length} locales to check.`);

    // Read templates and scripts
    const popupHtml = fs.readFileSync(path.join(extensionPath, 'popup', 'popup.html'), 'utf8');
    const popupCss = fs.readFileSync(path.join(extensionPath, 'popup', 'popup.css'), 'utf8');
    const styleCss = fs.readFileSync(path.join(extensionPath, 'assets', 'styles', 'style.css'), 'utf8');
    const popupJs = fs.readFileSync(path.join(extensionPath, 'popup', 'popup.js'), 'utf8');

    const welcomeHtml = fs.readFileSync(path.join(extensionPath, 'pages', 'welcome.html'), 'utf8');
    const updateHtml = fs.readFileSync(path.join(extensionPath, 'pages', 'update.html'), 'utf8');
    const pagesCss = fs.readFileSync(path.join(extensionPath, 'pages', 'pages.css'), 'utf8');
    const pagesJs = fs.readFileSync(path.join(extensionPath, 'pages', 'pages.js'), 'utf8');

    const manifest = JSON.parse(fs.readFileSync(path.join(extensionPath, 'manifest.json'), 'utf8'));


    for (const locale of locales) {
        const messagesPath = path.join(localesDir, locale, 'messages.json');
        if (!fs.existsSync(messagesPath)) {
            console.error(`Locale ${locale}: messages.json missing!`);
            failedLocales++;
            continue;
        }

        const messages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
        const messagesMap = {};
        for (const k of Object.keys(messages)) {
            messagesMap[k] = messages[k].message;
        }

        const mockScript = `
            <script>
                window.__MESSAGES = ${JSON.stringify(messagesMap)};
                window.mockI18n = {
                    getMessage: function(key) {
                        return window.__MESSAGES && window.__MESSAGES[key] !== undefined ? window.__MESSAGES[key] : '';
                    },
                    getUILanguage: function() { return '${locale}'; }
                };
                window.mockRuntime = {
                    getManifest: function() { return { version: '${manifest.version}' }; },
                    getURL: function(path) { return path; }
                };
                window.mockStorage = {
                    sync: { get: () => Promise.resolve({}), set: () => Promise.resolve() },
                    local: { get: () => Promise.resolve({}), set: () => Promise.resolve() },
                    onChanged: { addListener: () => {} }
                };
                window.chrome = { i18n: window.mockI18n, runtime: window.mockRuntime, storage: window.mockStorage };
                window.browser = { i18n: window.mockI18n, runtime: window.mockRuntime, storage: window.mockStorage };
            </script>
        `;

        const page = await browser.newPage();
        page.on('pageerror', err => console.error(`  [CONSOLE ERROR] ${locale}:`, err.message));
        page.on('console', msg => console.log(`  [CONSOLE LOG] ${locale}:`, msg.text()));
        await page.setViewport({ width: 320, height: 600 });

        let localeErrors = 0;

        // 1. Check Popup
        const preparedPopup = popupHtml
            .replace(/<link rel="stylesheet" href="\.\.\/assets\/styles\/style\.css">/, `<style>${styleCss}</style>`)
            .replace(/<link rel="stylesheet" href="popup\.css">/, `<style>${popupCss}</style>`)
            .replace(/<script src="popup\.js"><\/script>/, `${mockScript}\n<script>{\n${popupJs}\n}</script>`);

        await page.setContent(preparedPopup, { waitUntil: 'load' });

        // Check popup scrollWidth
        const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
        if (scrollWidth > 320) {
            console.error(`  [FAIL] ${locale} [popup]: Horizontal overflow detected! scrollWidth=${scrollWidth}px (max 320px)`);
            localeErrors++;
        }

        // Check all [data-i18n] in popup
        const popupI18nResults = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('[data-i18n]'));
            return elements.map(el => ({
                key: el.dataset.i18n,
                text: el.textContent.trim()
            }));
        });

        for (const { key, text } of popupI18nResults) {
            totalChecks++;
            const expected = messages[key]?.message?.trim();
            if (!expected) {
                console.error(`  [FAIL] ${locale} [popup]: Missing key '${key}' in messages.json`);
                localeErrors++;
            } else if (text !== expected) {
                console.error(`  [FAIL] ${locale} [popup]: Key '${key}' mismatch. Expected "${expected}", got "${text}"`);
                localeErrors++;
            }
        }

        // 2. Check Welcome Page
        const preparedWelcome = welcomeHtml
            .replace(/<link rel="stylesheet" href="pages\.css">/, `<style>${pagesCss}</style>`)
            .replace(/<script src="pages\.js"><\/script>/, `${mockScript}\n<script>{\n${pagesJs}\n}</script>`);

        await page.setContent(preparedWelcome, { waitUntil: 'load' });
        const welcomeI18nResults = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('[data-i18n]'));
            return elements.map(el => ({
                key: el.dataset.i18n,
                text: el.textContent.trim()
            }));
        });

        for (const { key, text } of welcomeI18nResults) {
            totalChecks++;
            const expected = messages[key]?.message?.trim();
            if (!expected) {
                console.error(`  [FAIL] ${locale} [welcome]: Missing key '${key}' in messages.json`);
                localeErrors++;
            } else if (text !== expected) {
                console.error(`  [FAIL] ${locale} [welcome]: Key '${key}' mismatch. Expected "${expected}", got "${text}"`);
                localeErrors++;
            }
        }

        // 3. Check Update Page
        const preparedUpdate = updateHtml
            .replace(/<link rel="stylesheet" href="pages\.css">/, `<style>${pagesCss}</style>`)
            .replace(/<script src="pages\.js"><\/script>/, `${mockScript}\n<script>{\n${pagesJs}\n}</script>`);

        await page.setContent(preparedUpdate, { waitUntil: 'load' });
        const updateI18nResults = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('[data-i18n]'));
            return elements.map(el => ({
                key: el.dataset.i18n,
                text: el.textContent.trim()
            }));
        });

        for (const { key, text } of updateI18nResults) {
            totalChecks++;
            const expected = messages[key]?.message?.trim();
            if (!expected) {
                console.error(`  [FAIL] ${locale} [update]: Missing key '${key}' in messages.json`);
                localeErrors++;
            } else if (!text.includes(expected)) {
                console.error(`  [FAIL] ${locale} [update]: Key '${key}' mismatch. Expected to contain "${expected}", got "${text}"`);
                localeErrors++;
            }
        }

        await page.close();

        if (localeErrors > 0) {
            failedLocales++;
        } else {
            console.log(`  ✓ Locale '${locale}' passed (popup, welcome, update, width <= 320px).`);
        }
    }
    } finally {
        if (browser) {
            await browser.close().catch(() => {});
        }
        try {
            fs.rmSync(userDataDir, { recursive: true, force: true });
        } catch {}
    }

    console.log('\n----------------------------------------');
    if (failedLocales > 0) {
        console.error(`\x1b[31m[FAILED]\x1b[0m ${failedLocales} of ${locales.length} locales failed (${totalChecks} elements verified).`);
        process.exit(1);
    } else {
        console.log(`\x1b[32m[PASSED]\x1b[0m All ${locales.length} locales passed (${totalChecks} elements checked across popup, welcome, update)!`);
        process.exit(0);
    }
})().catch(err => {
    console.error('\x1b[31m[UNHANDLED ERROR]\x1b[0m', err);
    process.exit(1);
});
