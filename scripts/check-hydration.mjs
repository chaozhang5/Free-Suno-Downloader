import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { JSDOM, VirtualConsole } from 'jsdom';
import { routes } from './route-data.mjs';

// Exercise the actual production client against the HTML shipped by the build.
// Keep this separate from the SEO checks: valid static HTML can still fail hydration.
const dist = new URL('../dist/', import.meta.url);
const index = await readFile(new URL('index.html', dist), 'utf8');
const entry = index.match(/<script\b[^>]*src="([^"]+)"/)[1];
const { outputFiles } = await build({
  entryPoints: [new URL(entry.slice(1), dist).pathname],
  bundle: true,
  format: 'iife',
  write: false,
  loader: { '.css': 'empty' },
});
const requestedPaths = process.argv.slice(2);
const paths = requestedPaths.length ? requestedPaths : routes.map(({ path }) => path);

for (const path of paths) {
  const html = await readFile(new URL(path === '/' ? 'index.html' : `${path.slice(1)}index.html`, dist), 'utf8');
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('error', (...args) => errors.push(args.map(String).join(' ')));
  virtualConsole.on('jsdomError', (error) => errors.push(error.message));
  const dom = new JSDOM(html, {
    url: `https://www.downloadsuno.com${path}`,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole,
  });
  try {
    dom.window.scrollTo = () => {};
    dom.window.TextEncoder = TextEncoder;
    dom.window.TextDecoder = TextDecoder;
    // Modulepreload fetches are redundant because the test bundles the built modules.
    // Use a plain mock so this check also runs on CI without native Fetch globals.
    dom.window.fetch = async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({}),
    });
    dom.window.addEventListener('error', (event) => errors.push(String(event.error ?? event.message)));
    dom.window.addEventListener('unhandledrejection', (event) => errors.push(String(event.reason)));
    const header = dom.window.document.querySelector('.site-header');
    assert.ok(header, `${path}: missing prerendered header`);
    dom.window.eval(outputFiles[0].text);
    // Allow route imports, hydration, and effects to finish, including deferred React work.
    for (let i = 0; i < 10; i++) await new Promise((resolve) => setTimeout(resolve, 10));
    assert.deepEqual(errors, [], `${path}: production hydration reported errors`);
    assert.equal(dom.window.document.querySelector('.site-header'), header,
      `${path}: React replaced the prerendered DOM`);
    // Confirm the retained server HTML has working client event handlers.
    const languageButton = dom.window.document.querySelector('.language-trigger');
    languageButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(languageButton.getAttribute('aria-expanded'), 'true', `${path}: hydration did not activate navigation`);
    assert.deepEqual(errors, [], `${path}: navigation reported errors after hydration`);
    if (path === '/') {
      // Follow real language links so lazy messages, metadata and RTL state must
      // update together without a full page reload.
      for (const [locale, direction] of [['ar', 'rtl'], ['zh-CN', 'ltr'], ['en', 'ltr']]) {
        if (languageButton.getAttribute('aria-expanded') !== 'true') {
          languageButton.click();
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        dom.window.document.querySelector(`.language-options a[lang="${locale}"]`).click();
        for (let i = 0; i < 50; i++) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          if (dom.window.document.documentElement.lang === locale
            && dom.window.document.querySelector('.language-trigger').textContent.includes(locale === 'zh-CN' ? 'ZH' : locale.toUpperCase())
            && dom.window.document.title !== 'Suno Download') break;
        }
        assert.equal(dom.window.document.documentElement.lang, locale);
        assert.equal(dom.window.document.documentElement.dir, direction);
        const copy = locale === 'en' ? {} : {
          ...JSON.parse(await readFile(new URL(`../src/i18n/messages.${locale}.json`, import.meta.url), 'utf8')),
          ...JSON.parse(await readFile(new URL('../src/i18n/overrides.json', import.meta.url), 'utf8'))[locale],
        };
        // Give lazy message loading time to finish even when the route's lang
        // effect runs before its translated chunk resolves.
        const title = copy['Free Suno Song Downloader | Suno Download'] ?? 'Free Suno Song Downloader | Suno Download';
        for (let i = 0; i < 50 && dom.window.document.title !== title; i++) await new Promise((resolve) => setTimeout(resolve, 10));
        assert.equal(dom.window.document.title, title, `${locale}: metadata did not follow language switch`);
        assert.equal(dom.window.document.querySelector('h1').textContent, copy['Free Suno Song Downloader'] ?? 'Free Suno Song Downloader');
        assert.deepEqual(errors, [], `${locale}: language switching reported errors`);
      }
    }

  } finally {
    dom.window.close();
  }
}
console.log(`Production hydration passed for ${paths.length} routes (no console errors, DOM retained, navigation interactive).`);
