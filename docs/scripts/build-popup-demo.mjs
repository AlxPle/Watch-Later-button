import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const docs = fileURLToPath(new URL('../', import.meta.url));
const source = path.resolve(docs, '../src');
const output = path.join(docs, 'assets/popup-demo');
const read = file => fs.readFile(file, 'utf8');
const manifest = JSON.parse(await read(path.join(source, 'manifest.base.json')));
const config = parse(await read(path.join(docs, '_config.yml')));
const stores = parse(await read(path.join(docs, '_data/stores.yml')));
const locale = (config.lang || manifest.default_locale).replaceAll('-', '_');
const messages = {
  ...JSON.parse(await read(path.join(source, '_locales', manifest.default_locale, 'messages.json'))),
  ...JSON.parse(await read(path.join(source, '_locales', locale, 'messages.json')))
};
const siteRoot = new URL(`${config.baseurl || ''}/`, config.url).href;
const links = {
  'watch-later-link': stores.watch_later_playlist_url,
  'feedback-link': stores.chrome_reviews_url,
  'donate-link': stores.donate_url,
  'issues-link': stores.issues_url,
  'website-link': siteRoot,
  'whats-new': new URL('updates/', siteRoot).href
};
for (const [id, value] of Object.entries(links)) {
  if (typeof value !== 'string' || new URL(value).protocol !== 'https:') {
    throw new Error(`Missing or invalid popup link: ${id}`);
  }
}
const files = new Map();
async function collect(relative) {
  if (files.has(relative)) return;
  const absolute = path.resolve(source, relative);
  if (!absolute.startsWith(source + path.sep) ||
      !/\.(?:html|css|woff2|png|svg|webp)$/.test(relative) && relative !== 'popup/popup.js') {
    throw new Error(`Unexpected popup resource: ${relative}`);
  }
  const content = await fs.readFile(absolute);
  files.set(relative, content);
  const text = content.toString('utf8');
  const refs = relative.endsWith('.html')
    ? [...text.matchAll(/<(?:link|script|img)\b[^>]*?\b(?:src|href)="([^"]+)"/g)].map(match => match[1])
    : relative.endsWith('.css')
      ? [...text.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)].map(match => match[1])
      : [];
  for (const ref of refs) {
    if (ref.startsWith('data:') || ref.startsWith('#')) continue;
    if (/^[a-z]+:|^\//i.test(ref)) throw new Error(`Non-local popup resource: ${ref}`);
    await collect(path.posix.normalize(path.posix.join(path.posix.dirname(relative), ref)));
  }
}
await collect('popup/popup.html');
let html = files.get('popup/popup.html').toString('utf8');
html = html.replace(/<a\b[^>]*>/g, anchor => {
  const id = anchor.match(/\bid="([^"]+)"/)?.[1];
  if (!links[id]) throw new Error(`No site link configured for popup anchor: ${id}`);
  return anchor.replace(/\bhref="[^"]*"/, `href="${links[id].replaceAll('&', '&amp;').replaceAll('"', '&quot;')}"`);
});
html = html.replace('</head>', '<link rel="stylesheet" href="demo.css">\n</head>');
const script = '<script src="popup.js"></script>';
if (!html.includes(script)) throw new Error('Popup script entry point is missing');
html = html.replace(script, '<script src="demo-data.js"></script>\n<script src="demo-adapter.js"></script>\n' + script);
if (/\{\{[^}]+\}\}/.test(html)) throw new Error('Unresolved popup template links');
files.set('popup/popup.html', html);
files.set('popup/demo-data.js', `window.WL_DEMO_DATA = ${JSON.stringify({ version: manifest.version, locale, messages })};\n`);
files.set('popup/demo-adapter.js', await read(path.join(docs, 'scripts/popup-demo-adapter.js')));
files.set('host.js', await read(path.join(docs, 'scripts/popup-demo-host.js')));
files.set('popup/demo.css', '#settings-view { max-height: none; overflow: visible; }\n');
await fs.mkdir(output, { recursive: true });
await fs.rm(output, { recursive: true });
for (const [relative, content] of files) {
  const destination = path.join(output, relative);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, content);
}
console.log(`Generated popup demo v${manifest.version}: ${files.size} local resources (${locale}).`);
