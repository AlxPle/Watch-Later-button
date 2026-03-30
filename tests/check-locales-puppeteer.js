const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const extensionPath = path.resolve(__dirname, '..', 'chrome');
const userDataDir = path.resolve('/tmp', 'puppeteer_watch_later_profile');

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ],
        userDataDir
    });

    // Try to detect loaded extension (may not be present in test env)
    console.log('Extension path:', extensionPath);
    let extensionId = null;
    for (let i = 0; i < 40 && !extensionId; i++) {
        const targets = await browser.targets();
        const extTarget = targets.find(t => {
            const u = t.url();
            return u && u.startsWith('chrome-extension://');
        });
        if (extTarget) {
            extensionId = extTarget.url().split('/')[2];
            break;
        }
        await new Promise(r => setTimeout(r, 300));
    }

    // Prepare popup files and locales
    const popupHtmlPath = path.join(extensionPath, 'popup', 'popup.html');
    const popupJsPath = path.join(extensionPath, 'popup', 'popup.js');
    if (!fs.existsSync(popupHtmlPath) || !fs.existsSync(popupJsPath)) {
        console.error('popup files not found:', popupHtmlPath, popupJsPath);
        await browser.close();
        process.exit(7);
    }
    const popupHtml = fs.readFileSync(popupHtmlPath, 'utf8');
    const popupJs = fs.readFileSync(popupJsPath, 'utf8');

    const localesDir = path.join(extensionPath, '_locales');
    const locales = fs.existsSync(localesDir)
        ? fs.readdirSync(localesDir).filter(d => fs.statSync(path.join(localesDir, d)).isDirectory())
        : ['en'];

    const keyToId = {
        extensionName: 'extension-name',
        issues: 'issues',
        feedback: 'feedback',
        donate: 'donate',
        contact: 'contact',
        website: 'website',
        whatsNew: 'whats-new'
    };

    let overallFailed = false;

    for (const locale of locales) {
        const messagesPath = path.join(localesDir, locale, 'messages.json');
        if (!fs.existsSync(messagesPath)) {
            console.warn(`Skipping locale ${locale}: messages.json missing`);
            continue;
        }
        const messages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));

        // If extension page is available, use it; otherwise render locally with mocked chrome.i18n
        let page;
        if (extensionId) {
            const popupUrl = `chrome-extension://${extensionId}/popup/popup.html`;
            page = await browser.newPage();
            await page.goto(popupUrl, { waitUntil: 'networkidle2' });
        } else {
            const messagesForWindow = {};
            for (const k of Object.keys(messages)) messagesForWindow[k] = messages[k].message;
            const manifest = require(path.join(extensionPath, 'manifest.json'));
            const mockChrome = `<script>window.__MESSAGES = ${JSON.stringify(messagesForWindow)}; window.chrome = { i18n: { getMessage: function(k){ return window.__MESSAGES && window.__MESSAGES[k] || ''; } }, runtime: { getManifest: function(){ return { version: '${manifest.version}' } } };</script>`;
            const content = popupHtml
                .replace('<script src="popup.js"></script>', `${mockChrome}\n<script>${popupJs}</script>`)
                .replace(/<link rel="stylesheet" href="popup.css">/, '');
            page = await browser.newPage();
            await page.setContent(content, { waitUntil: 'networkidle0' });

            // Debug: check mock presence inside page
            try {
                const dbg = await page.evaluate(() => {
                    return {
                        hasChrome: !!window.chrome,
                        sampleGet: (window.chrome && window.chrome.i18n && window.chrome.i18n.getMessage('issues')) || null,
                        keys: Object.keys(window.__MESSAGES || {}).slice(0, 20)
                    };
                });
                console.log('DEBUG page mock:', dbg);
            } catch (e) {
                console.log('DEBUG eval error', e.message);
            }
        }

        console.log(`Checking locale: ${locale}`);

        for (const [key, id] of Object.entries(keyToId)) {
            const expected = messages[key] && messages[key].message;
            if (!expected) {
                console.warn(`Locale ${locale}: missing key ${key} in messages.json`);
                continue;
            }

            await page.waitForSelector(`#${id}`, { timeout: 3000 }).catch(() => { });
            const text = await page.$eval(`#${id}`, el => el.textContent.trim()).catch(() => null);
            if (text === null) {
                console.error(`Locale ${locale}: Element #${id} not found in popup`);
                overallFailed = true;
                continue;
            }

            if (text !== expected) {
                console.error(`Locale ${locale}: mismatch for ${key}: expected="${expected}" got="${text}"`);
                overallFailed = true;
            } else {
                console.log(`OK: ${locale} ${key} -> ${text}`);
            }
        }

        await page.close();
    }

    await browser.close();
    if (overallFailed) {
        console.error('One or more locale checks failed');
        process.exit(6);
    }
    console.log('All locale checks passed.');
    process.exit(0);
})().catch(err => {
    console.error(err);
    process.exit(1);
});
