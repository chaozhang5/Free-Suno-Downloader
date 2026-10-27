import { writeFile, rm, readdir, readFile, mkdir } from 'node:fs/promises';
import { manifest, routes, localePrefixes } from './route-data.mjs';

const dist = new URL('../dist/', import.meta.url);
const assets = new URL('assets/', dist);
const { pages } = manifest;
const articles = JSON.parse(await readFile(new URL('../src/content/articles.json', import.meta.url), 'utf8'));
const localizedArticles = Object.fromEntries(await Promise.all(Object.keys(localePrefixes).map(async (locale) => [locale,
  locale === 'en' ? articles : JSON.parse(await readFile(new URL(`../src/content/articles.${locale}.json`, import.meta.url), 'utf8'))])));
const messages = Object.fromEntries(await Promise.all(Object.keys(localePrefixes).map(async (locale) => [locale,
  locale === 'en' ? {} : JSON.parse(await readFile(new URL(`../src/i18n/messages.${locale}.json`, import.meta.url), 'utf8'))])));
const overrides = JSON.parse(await readFile(new URL('../src/i18n/overrides.json', import.meta.url), 'utf8'));
for (const locale of Object.keys(localePrefixes)) Object.assign(messages[locale], overrides[locale] ?? {});

function getSiteOrigin() {
  const value = process.env.SITE_URL?.trim();
  if (!value) return '';
  let url;
  try { url = new URL(value); }
  catch { throw new Error('SITE_URL must be a complete HTTPS origin, such as https://example.com'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/'
    || url.search || url.hash) {
    throw new Error('SITE_URL must be an HTTPS origin without a path, query, or fragment.');
  }
  return url.origin;
}

const siteOrigin = getSiteOrigin();
const indexablePaths = new Set(routes.filter(({ indexable }) => indexable).map(({ path }) => path));
const routePaths = new Set(routes.map(({ path }) => path));

function escapeAttribute(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

function replaceTag(html, expression, replacement, label) {
  const matches = html.match(expression);
  if (!matches || matches.length !== 1) throw new Error(`Expected one ${label} tag in prerendered HTML.`);
  return html.replace(expression, replacement);
}

function meta(html, kind, key, value) {
  return replaceTag(html, new RegExp(`<meta\\s+${kind}="${key}"[^>]*>`, 'gi'),
    `<meta ${kind}="${key}" content="${escapeAttribute(value)}">`, key);
}

for (const route of routes) {
  const { path, page, slug, canonicalPath, indexable, locale } = route;
  if (!/^\/[a-z0-9/-]*$/.test(path) || !path.endsWith('/') || !routePaths.has(canonicalPath)
    || (indexable && !indexablePaths.has(canonicalPath))) {
    throw new Error(`Invalid SEO route or canonical target: ${path}`);
  }
  const article = page === 'article' ? localizedArticles[locale].find((item) => item.slug === slug) : undefined;
  const source = pages[page];
  const details = article ? { title: `${article.title} | Suno Download`, description: article.description }
    : ('seoTitle' in route && 'seoDescription' in route ? { title: messages[locale][route.seoTitle] ?? route.seoTitle, description: messages[locale][route.seoDescription] ?? route.seoDescription }
    : { title: messages[locale][source.title] ?? source.title, description: messages[locale][source.description] ?? source.description });
  if (!details?.title || !details?.description) throw new Error(`Missing SEO metadata for ${path}`);
  const file = new URL(path === '/' ? 'index.html' : `${path.slice(1)}index.html`, dist);
  let html = await readFile(file, 'utf8');
  html = replaceTag(html, /<html\s+lang="[^"]+"/gi, `<html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}"`, 'html lang');
  const canonical = siteOrigin + canonicalPath;
  html = replaceTag(html, /<title>[\s\S]*?<\/title>/gi,
    `<title>${escapeAttribute(details.title)}</title>`, 'title');
  html = meta(html, 'name', 'description', details.description);
  html = meta(html, 'name', 'robots', indexable ? 'index,follow' : 'noindex,follow');
  html = replaceTag(html, /<link\s+rel="canonical"[^>]*>/gi,
    `<link rel="canonical" href="${escapeAttribute(canonical)}">`, 'canonical');
  html = meta(html, 'property', 'og:title', details.title);
  html = meta(html, 'property', 'og:description', details.description);
  html = meta(html, 'property', 'og:url', canonical);
  html = meta(html, 'name', 'twitter:title', details.title);
  html = meta(html, 'name', 'twitter:description', details.description);
  if (indexable && path === canonicalPath) {
    const base = path.slice(localePrefixes[locale].length);
    const alternateLinks = Object.entries(localePrefixes).filter(([language]) => manifest.indexableLocales?.includes(language) ?? language === 'en').map(([language, prefix]) =>
      `<link rel="alternate" hreflang="${language}" href="${escapeAttribute(siteOrigin + prefix + base)}">`).join('');
    html = html.replace('</head>', `${alternateLinks}<link rel="alternate" hreflang="x-default" href="${escapeAttribute(siteOrigin + base)}"></head>`);
  }

  let structuredData;
  if (path === `${localePrefixes[locale]}/`) {
    structuredData = { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Suno Download', inLanguage: locale,
      ...(siteOrigin ? { url: siteOrigin + '/' } : {}) };
  } else if (page === 'downloader') {
    structuredData = { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Suno Downloader', inLanguage: locale,
      ...(siteOrigin ? { url: canonical } : {}),
      publisher: { '@type': 'Organization', name: 'Suno Download' },
      applicationCategory: 'MultimediaApplication', operatingSystem: 'Any',
      description: details.description, isAccessibleForFree: true };
  } else if (page === 'promptBuilder') {
    structuredData = { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Suno Prompt Builder', inLanguage: locale,
      ...(siteOrigin ? { url: canonical } : {}),
      publisher: { '@type': 'Organization', name: 'Suno Download' },
      applicationCategory: 'MultimediaApplication', operatingSystem: 'Any',
      description: details.description, isAccessibleForFree: true };
  } else if (page === 'article') {
    structuredData = { '@context': 'https://schema.org', '@type': 'Article', inLanguage: locale,
      headline: article.title, description: details.description,
      ...(siteOrigin ? { mainEntityOfPage: canonical } : {}),
      author: { '@type': 'Organization', name: 'Suno Download' },
      publisher: { '@type': 'Organization', name: 'Suno Download' } };
  } else if (page === 'toolInfo') {
    structuredData = { '@context': 'https://schema.org', '@type': 'WebPage', inLanguage: locale,
      name: details.title, description: details.description,
      ...(siteOrigin ? { url: canonical } : {}),
      isPartOf: { '@type': 'WebSite', name: 'Suno Download', ...(siteOrigin ? { url: siteOrigin + '/' } : {}) } };
  } else {
    structuredData = { '@context': 'https://schema.org', inLanguage: locale,
      '@type': ['articles', 'tools'].includes(page) ? 'CollectionPage' : 'AboutPage',
      name: details.title, description: details.description,
      ...(siteOrigin ? { url: canonical } : {}),
      isPartOf: { '@type': 'WebSite', name: 'Suno Download', ...(siteOrigin ? { url: siteOrigin + '/' } : {}) } };
  }
  html = html.replace('</head>',
    `<script type="application/ld+json">${JSON.stringify(structuredData).replaceAll('<', '\\u003c')}</script></head>`);
  await writeFile(file, html);
}

const robots = 'User-agent: *\nAllow: /\nDisallow: /api/\n'
  + (siteOrigin ? `Sitemap: ${siteOrigin}/sitemap.xml\n` : '');
await writeFile(new URL('robots.txt', dist), robots);
if (siteOrigin) {
  const sitemapDirectory = new URL('sitemap/', dist);
  await rm(sitemapDirectory, { recursive: true, force: true });
  await mkdir(sitemapDirectory, { recursive: true });
  const groups = [
    ['tools', (route) => route.path.startsWith('/tools/')],
    ['articles', (route) => route.path.startsWith('/articles/')],
    ['pages', (route) => !route.path.startsWith('/tools/') && !route.path.startsWith('/articles/')],
  ].map(([name, includes]) => [name, routes.filter((route) => route.indexable && route.path === route.canonicalPath && includes(route))])
    .filter(([, groupRoutes]) => groupRoutes.length > 0);
  const lastmod = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const indexEntries = [];
  for (const [name, groupRoutes] of groups) {
    const childPath = `sitemap/${name}.xml`;
    const urls = groupRoutes.map(({ path, locale }) => {
      const base = path.slice(localePrefixes[locale].length);
      const alternates = Object.entries(localePrefixes)
        .filter(([language]) => manifest.indexableLocales?.includes(language) ?? language === 'en')
        .map(([language, prefix]) => `        <xhtml:link rel="alternate" hreflang="${language}" href="${siteOrigin + prefix + base}"/>`)
        .join('\n');
      return `  <url>\n    <loc>${siteOrigin + path}</loc>\n    <lastmod>${lastmod}</lastmod>\n${alternates}\n  </url>`;
    }).join('\n');
    const childSitemap = '<?xml version="1.0" encoding="UTF-8"?>\n'
      + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
      + `${urls}\n</urlset>\n`;
    await writeFile(new URL(childPath, dist), childSitemap);
    indexEntries.push(`  <sitemap>\n    <loc>${siteOrigin}/${childPath}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </sitemap>`);
  }
  const sitemapIndex = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + `${indexEntries.join('\n')}\n</sitemapindex>\n`;
  await writeFile(new URL('sitemap.xml', dist), sitemapIndex);
} else {
  await rm(new URL('sitemap.xml', dist), { force: true });
  await rm(new URL('sitemap/', dist), { recursive: true, force: true });
}
for (const name of await readdir(assets)) {
  if (name.startsWith('entry-prerender-') && (name.endsWith('.js') || name.endsWith('.js.map'))) {
    await rm(new URL(name, assets));
  }
}
