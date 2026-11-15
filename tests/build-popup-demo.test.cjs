const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
test('demo generation follows popup sources and rejects broken dependencies', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'wl-demo-build-'));
  try {
    for (const relative of ['src/popup', 'src/assets', 'src/_locales', 'src/manifest.base.json',
      'docs/_config.yml', 'docs/_data/stores.yml', 'docs/node_modules/yaml',
      'docs/scripts/build-popup-demo.mjs', 'docs/scripts/popup-demo-adapter.js', 'docs/scripts/popup-demo-host.js']) {
      fs.cpSync(path.join(root, relative), path.join(fixture, relative), { recursive: true });
    }
    const build = () => execFileSync(process.execPath, [path.join(fixture, 'docs/scripts/build-popup-demo.mjs')], { encoding: 'utf8', stdio: 'pipe' });
    const generated = relative => path.join(fixture, 'docs/assets/popup-demo', relative);
    build();
    for (const file of ['popup.js', 'popup.css']) {
      assert.equal(fs.readFileSync(generated(`popup/${file}`), 'utf8'), fs.readFileSync(path.join(root, 'src/popup', file), 'utf8'));
    }
    let html = fs.readFileSync(generated('popup/popup.html'), 'utf8');
    assert.ok(html.indexOf('demo-adapter.js') < html.indexOf('src="popup.js"'));
    assert.ok(!html.includes('{{'));
    assert.ok(!fs.existsSync(generated('js')));
    const popupSource = path.join(fixture, 'src/popup/popup.html');
    fs.appendFileSync(popupSource, '\n<p>Updated popup source text</p>\n');
    const styleSource = path.join(fixture, 'src/popup/popup.css');
    fs.appendFileSync(styleSource, '\n:root { --source-update-probe: 1; }\n');
    const manifestPath = path.join(fixture, 'src/manifest.base.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath));
    manifest.version = '9.8.7';
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    const localePath = path.join(fixture, 'src/_locales/en/messages.json');
    const messages = JSON.parse(fs.readFileSync(localePath));
    messages.settings.message = 'Updated source settings';
    fs.writeFileSync(localePath, JSON.stringify(messages));
    build();
    html = fs.readFileSync(generated('popup/popup.html'), 'utf8');
    assert.ok(html.includes('Updated popup source text'));
    assert.ok(fs.readFileSync(generated('popup/popup.css'), 'utf8').includes('--source-update-probe: 1'));
    const data = fs.readFileSync(generated('popup/demo-data.js'), 'utf8');
    assert.ok(data.includes('9.8.7'));
    assert.ok(data.includes('Updated source settings'));
    fs.appendFileSync(popupSource, '<img src="missing.png">');
    assert.throws(build, /ENOENT/);
    fs.copyFileSync(path.join(root, 'src/popup/popup.html'), popupSource);
    fs.appendFileSync(popupSource, '<a href="{{UNKNOWN_URL}}">Unknown</a>');
    assert.throws(build, /No site link configured/);
    fs.copyFileSync(path.join(root, 'src/popup/popup.html'), popupSource);
    fs.appendFileSync(popupSource, '<script src="../js/youtube-bridge.js"></script>');
    assert.throws(build, /Unexpected popup resource/);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
