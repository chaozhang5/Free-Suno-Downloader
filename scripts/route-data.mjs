import { readFileSync } from 'node:fs';

export const manifest = JSON.parse(readFileSync(new URL('../seo-routes.json', import.meta.url), 'utf8'));
const languages = JSON.parse(readFileSync(new URL('../src/locales.json', import.meta.url), 'utf8'));
export const localePrefixes = Object.fromEntries(languages.map(({ code, prefix }) => [code, prefix]));
export const primaryRoutes = manifest.routes;
export const routes = [
  ...primaryRoutes.map((route) => ({ ...route, locale: 'en' })),
  ...Object.entries(localePrefixes).filter(([locale]) => locale !== 'en').flatMap(([locale, prefix]) =>
    primaryRoutes.filter(({ indexable, path }) => indexable || path === '/').map((route) => ({
      ...route, path: `${prefix}${route.path}`, canonicalPath: `${prefix}${route.canonicalPath}`,
      indexable: Boolean(route.indexable && (route.indexableLocales ?? manifest.indexableLocales ?? ['en']).includes(locale)), locale,
    }))),
];
