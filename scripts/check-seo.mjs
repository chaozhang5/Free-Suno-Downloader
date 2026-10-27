import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { manifest, routes, localePrefixes } from './route-data.mjs';

const dist = new URL('../dist/', import.meta.url);
const { pages } = manifest;
const indexableLocales = manifest.indexableLocales ?? ['en'];
const articles = JSON.parse(readFileSync(new URL('../src/content/articles.json', import.meta.url), 'utf8'));
const articleCtas = JSON.parse(readFileSync(new URL('../src/content/article-cta.json', import.meta.url), 'utf8'));
const articlesBySlug = new Map(articles.map((article) => [article.slug, article]));
const localizedArticles = Object.fromEntries(Object.keys(localePrefixes).map((locale) => [locale,
  locale === 'en' ? articles : JSON.parse(readFileSync(new URL(`../src/content/articles.${locale}.json`, import.meta.url), 'utf8'))]));
const messages = Object.fromEntries(Object.keys(localePrefixes).map((locale) => [locale,
  locale === 'en' ? {} : JSON.parse(readFileSync(new URL(`../src/i18n/messages.${locale}.json`, import.meta.url), 'utf8'))]));
const overrides = JSON.parse(readFileSync(new URL('../src/i18n/overrides.json', import.meta.url), 'utf8'));
for (const locale of Object.keys(localePrefixes)) Object.assign(messages[locale], overrides[locale] ?? {});
const englishMessages = JSON.parse(readFileSync(new URL('../src/i18n/messages.en.json', import.meta.url), 'utf8'));
for (const locale of Object.keys(localePrefixes).filter((item) => item !== 'en')) {
  for (const key of Object.keys(englishMessages)) assert.ok(messages[locale][key], `${locale} is missing UI translation: ${key}`);
}
const siteOrigin = process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : '';

function find(html, expression, label) {
  const match = html.match(expression);
  assert.ok(match, `${label} must appear in prerendered HTML`);
  return match[1];
}

assert.equal(articles.length, manifest.routes.filter(({ page }) => page === 'article').length, 'each article needs a manifest route');
assert.equal(new Set(articles.map(({ slug }) => slug)).size, articles.length, 'article slugs must be unique');
for (const [locale, prefix] of Object.entries(localePrefixes)) {
  assert.deepEqual(routes.filter((route) => route.page === 'article' && route.locale === locale).map(({ slug }) => slug).sort(),
    articles.map(({ slug }) => slug).sort(), `each article needs a ${locale} SEO route`);
  const articleIndex = readFileSync(new URL(`${prefix.slice(1)}${prefix ? '/' : ''}articles/index.html`, dist), 'utf8');
  for (const { slug } of articles) assert.ok(articleIndex.includes(`${prefix}/articles/${slug}/`), `${slug} needs a ${locale} index link`);
  assert.deepEqual(localizedArticles[locale].map(({ slug }) => slug), articles.map(({ slug }) => slug));
  for (const item of localizedArticles[locale]) {
    const source = articlesBySlug.get(item.slug);
    assert.equal(item.sections.length, source.sections.length, `${locale}/${item.slug} needs all sections`);
    assert.equal(item.faq.length, source.faq.length, `${locale}/${item.slug} needs all questions`);
    assert.ok(item.title && item.description && item.intro && item.toolLabel, `${locale}/${item.slug} needs all core fields`);
    if (locale !== 'en') assert.notEqual(item.intro, source.intro, `${locale}/${item.slug} needs translated body text`);
  }
}
for (const article of articles) {
  assert.ok(article.sections.length >= 3, `${article.slug} needs a complete body`);
  assert.ok(article.related.length >= 2 && article.related.every((slug) => articlesBySlug.has(slug)), `${article.slug} needs working related links`);
  assert.ok(article.sections.every((section) => section.paragraphs.length >= 1), `${article.slug} needs section content`);
  assert.ok(article.faq.length >= 2, `${article.slug} needs useful follow-up answers`);
}

for (const route of routes) {
  const { path, page, slug, canonicalPath, indexable, locale } = route;
  const file = new URL(path === '/' ? 'index.html' : `${path.slice(1)}index.html`, dist);
  const html = readFileSync(file, 'utf8');
  const canonical = siteOrigin + canonicalPath;
  const article = page === 'article' ? localizedArticles[locale].find((item) => item.slug === slug) : undefined;
  const source = pages[page];
  const details = article ? { title: `${article.title} | Suno Download`, description: article.description }
    : ('seoTitle' in route && 'seoDescription' in route ? { title: messages[locale][route.seoTitle] ?? route.seoTitle, description: messages[locale][route.seoDescription] ?? route.seoDescription }
      : { title: messages[locale][source.title] ?? source.title, description: messages[locale][source.description] ?? source.description });
  assert.ok(details, `metadata must exist for ${path}`);
  assert.equal(find(html, /<title>([^<]+)<\/title>/, 'title'), details.title);
  assert.equal(find(html, /<meta name="description" content="([^"]+)"/, 'description'), details.description);
  assert.equal(find(html, /<link rel="canonical" href="([^"]+)"/, 'canonical'), canonical);
  assert.equal(find(html, /<meta name="robots" content="([^"]+)"/, 'robots'), indexable ? 'index,follow' : 'noindex,follow');
  assert.equal(find(html, /<meta property="og:url" content="([^"]+)"/, 'og:url'), canonical);
  assert.equal(find(html, /<html lang="([^"]+)"/, 'html lang'), locale);
  assert.ok(html.includes(`dir="${locale === 'ar' ? 'rtl' : 'ltr'}"`), `${path}: incorrect writing direction`);
  if (indexable && path === canonicalPath) {
    const base = path.slice(localePrefixes[locale].length);
    for (const [otherLocale, prefix] of Object.entries(localePrefixes).filter(([code]) => indexableLocales.includes(code))) {
      assert.ok(html.includes(`hreflang="${otherLocale}" href="${siteOrigin + prefix + base}"`));
    }
    for (const prefix of Object.values(localePrefixes)) {
      assert.ok(html.includes(`href="${prefix + base}"`), `${path} needs a language-switch link for ${prefix || 'en'}`);
    }
} else assert.doesNotMatch(html, /hreflang="[^"]+"/, `${path} must not advertise non-canonical or unapproved alternate locales`);
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1, `${path} must have one H1`);
  if (page === 'downloader' && locale === 'en') {
    assert.match(html, /Which Suno URLs can I use\?/);
    assert.match(html, /When a link does not work\./);
  }
  if (page === 'article') {
    const promptArticles = articleCtas.promptBuilder;
    const officialArticles = articleCtas.officialSource;
    const expectedTool = promptArticles.includes(slug) ? 'prompt-builder' : articleCtas.downloader.includes(slug) ? 'downloader' : null;
    const sidebar = html.match(/<aside class="article-sidebar">([\s\S]*?)<\/aside>/)?.[1] ?? '';
    if (expectedTool) assert.ok(sidebar.includes(`href="${localePrefixes[locale]}/tools/${expectedTool}/"`), `${path} needs its relevant live tool CTA`);
    if (officialArticles.includes(slug)) assert.ok(sidebar.includes(`href="${article.sources[0].url}"`), `${path} needs a direct official source CTA`);
    if (articleCtas.none.includes(slug)) assert.ok(!sidebar.includes(`${localePrefixes[locale]}/tools/downloader/`) && !sidebar.includes(`${localePrefixes[locale]}/tools/prompt-builder/`), `${path} should not show an unrelated tool CTA`);
    const visibleText = html.replaceAll('&#x27;', "'").replaceAll('&quot;', '"').replaceAll('&amp;', '&');
    for (const section of article.sections) assert.ok(visibleText.includes(section.heading), `${path} is missing ${section.heading}`);
    for (const item of article.faq) assert.ok(visibleText.includes(item.question), `${path} is missing ${item.question}`);
    for (const relatedSlug of article.related) assert.ok(html.includes(`${localePrefixes[locale]}/articles/${relatedSlug}/`), `${path} is missing a related article`);
  }
  const schema = JSON.parse(find(html, /<script type="application\/ld\+json">([^<]+)<\/script>/, 'JSON-LD'));
  const expectedType = path === `${localePrefixes[locale]}/` ? 'WebSite' : ['downloader', 'promptBuilder'].includes(page) ? 'WebApplication' : ['articles', 'tools'].includes(page) ? 'CollectionPage' : page === 'toolInfo' ? 'WebPage' : page === 'article' ? 'Article' : 'AboutPage';
  assert.equal(schema['@type'], expectedType);
  assert.equal(schema.inLanguage, locale);
}

for (const route of routes.filter(({ locale }) => !indexableLocales.includes(locale))) {
  assert.equal(route.indexable, false, `${route.path} must stay out of the index until its locale is approved`);
}

const robots = readFileSync(new URL('robots.txt', dist), 'utf8');
assert.match(robots, /Disallow: \/api\//);
const sitemapFile = new URL('sitemap.xml', dist);
if (siteOrigin) {
  assert.match(robots, new RegExp(`Sitemap: ${siteOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/sitemap\\.xml`));
  const sitemapIndex = readFileSync(sitemapFile, 'utf8');
  assert.match(sitemapIndex, /<sitemapindex\b/);
  const sitemapEntries = [...sitemapIndex.matchAll(/<sitemap>([\s\S]*?)<\/sitemap>/g)];
  assert.ok(sitemapEntries.length > 0, 'sitemap index must list child sitemaps');
  const locations = [];
  for (const [, entry] of sitemapEntries) {
    assert.match(entry, /<lastmod>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z<\/lastmod>/);
    const childUrl = find(entry, /<loc>([^<]+)<\/loc>/, 'child sitemap URL');
    const child = readFileSync(new URL(childUrl.slice(siteOrigin.length + 1), dist), 'utf8');
    assert.match(child, /<urlset\b/);
    const urlEntries = [...child.matchAll(/<url>([\s\S]*?)<\/url>/g)];
    assert.ok(urlEntries.length > 0, 'child sitemap must list URL entries');
    for (const [, urlEntry] of urlEntries) {
      assert.match(urlEntry, /<loc>[^<]+<\/loc>/);
      assert.match(urlEntry, /<lastmod>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z<\/lastmod>/);
    }
    locations.push(...[...child.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
  }
  assert.deepEqual(locations.sort(), routes.filter(({ indexable, path, canonicalPath }) => indexable && path === canonicalPath).map(({ path }) => siteOrigin + path).sort());
} else {
  assert.equal(existsSync(sitemapFile), false, 'local builds must not publish a sitemap');
  assert.equal(existsSync(new URL('sitemap/', dist)), false, 'local builds must not publish child sitemaps');
}

console.log(`SEO output verified for ${routes.length} prerendered routes.`);
