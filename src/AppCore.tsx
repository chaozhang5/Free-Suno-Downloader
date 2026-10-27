import { Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useState, type ComponentType } from 'react';
import seoRoutes from '../seo-routes.json';
import { languages, localizePath, selectedLanguage } from './languages';
import { loadLanguageMessages, tr } from './i18n';
import { analyticsPageType, trackPageView } from './analytics/posthog';

const publicRoutes = seoRoutes.routes;
const indexableLocales = new Set(seoRoutes.indexableLocales ?? ['en']);
export const localizedRoutes = [
  ...publicRoutes.map((route) => ({ ...route, locale: 'en' })),
  ...languages.filter(({ code }) => code !== 'en').flatMap(({ code, prefix }) => publicRoutes.filter(({ indexable, path }) => indexable || path === '/').map((route) => ({
    ...route, path: `${prefix}${route.path}`, canonicalPath: `${prefix}${route.canonicalPath}`,
    indexable: Boolean(route.indexable && indexableLocales.has(code)), locale: code,
  }))),
];

type Articles = typeof import('./content/articles.json');
type Article = Articles[number];
export interface AppPages {
  Header: ComponentType;
  Footer: ComponentType;
  downloader: ComponentType<{ articles: Articles }>;
  promptBuilder: ComponentType;
  tools: ComponentType;
  articles: ComponentType<{ articles: Articles }>;
  about: ComponentType;
  article: ComponentType<{ article: Article; articles: Articles }>;
  toolInfo: ComponentType<{ slug: string }>;
}

export function pageTypeForPath(pathname: string) {
  return localizedRoutes.find((route) => route.path === pathname)?.page ?? null;
}

function ArticleRoute({ slug, pages, articles }: { slug: string; pages: AppPages; articles: Articles }) {
  const article = articles.find((item) => item.slug === slug);
  return article ? <pages.article article={article} articles={articles} /> : null;
}

export function AppCore({ pages, getArticles, loadArticles }: {
  pages: AppPages;
  getArticles: (locale: string) => Articles | undefined;
  loadArticles: (locale: string) => Promise<Articles>;
}) {
  const { pathname } = useLocation();
  const locale = selectedLanguage(pathname).code;
  const routePage = pageTypeForPath(pathname);
  const needsArticleData = routePage !== null && ['downloader', 'articles', 'article'].includes(routePage);
  const [contentVersion, refreshArticles] = useState(0);
  const localized = needsArticleData ? (getArticles(locale) ?? getArticles('en') ?? []) : [];
  useEffect(() => {
    if (!needsArticleData) return;
    let active = true;
    loadArticles(locale).then(() => { if (active) refreshArticles((version) => version + 1); }).catch(() => undefined);
    return () => { active = false; };
  }, [locale, loadArticles, needsArticleData]);
  useEffect(() => {
    let active = true;
    loadLanguageMessages(locale).then(() => { if (active) refreshArticles((version) => version + 1); }).catch(() => undefined);
    return () => { active = false; };
  }, [locale]);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    const route = localizedRoutes.find((item) => item.path === pathname);
    if (!route) return;
    const article = route.page === 'article' && 'slug' in route ? localized.find((item) => item.slug === route.slug) : undefined;
    const page = seoRoutes.pages[route.page as keyof typeof seoRoutes.pages];
    const title = article ? `${article.title} | Suno Download` : tr(route.seoTitle ?? page.title);
    const description = article?.description ?? tr(route.seoDescription ?? page.description);
    document.title = title;
    const setMeta = (selector: string, value: string) => { const element = document.head.querySelector<HTMLMetaElement>(selector); if (element) element.content = value; };
    const canonical = window.location.origin + route.canonicalPath;
    setMeta('meta[name="description"]', description);
    setMeta('meta[name="robots"]', route.indexable ? 'index,follow' : 'noindex,follow');
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', description);
    setMeta('meta[property="og:url"]', canonical);
    setMeta('meta[name="twitter:title"]', title);
    setMeta('meta[name="twitter:description"]', description);
    document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute('href', canonical);
    document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((element) => element.remove());
    if (route.indexable && route.path === route.canonicalPath) {
      const base = pathname.slice(languages.find((item) => item.code === locale)?.prefix.length ?? 0);
      for (const language of languages.filter(({ code }) => indexableLocales.has(code))) {
        const link = document.createElement('link');
        link.rel = 'alternate'; link.hreflang = language.code; link.href = window.location.origin + localizePath(base, language.code);
        document.head.append(link);
      }
      const defaultLink = document.createElement('link');
      defaultLink.rel = 'alternate'; defaultLink.hreflang = 'x-default'; defaultLink.href = window.location.origin + localizePath(base, 'en');
      document.head.append(defaultLink);
    }
    trackPageView(pathname, locale, analyticsPageType(pathname), article
      ? { article_slug: article.slug, article_category: article.category }
      : {});
  }, [pathname, locale, localized, contentVersion]);

  const page = {
    downloader: <pages.downloader articles={localized} />,
    promptBuilder: <pages.promptBuilder />,
    tools: <pages.tools />,
    articles: <pages.articles articles={localized} />,
    about: <pages.about />,
  };
  return (
    <>
      <pages.Header />
      <Routes>
        {localizedRoutes.map(({ path, page: pageName, ...route }) => {
          const element = pageName === 'article' && typeof route.slug === 'string' ? <ArticleRoute slug={route.slug} pages={pages} articles={localized} />
            : pageName === 'toolInfo' && typeof route.toolSlug === 'string' ? <pages.toolInfo slug={route.toolSlug} />
              : page[pageName as keyof typeof page];
          if (!element) throw new Error(`No page registered for ${path}`);
          return <Route key={path} path={path} element={element} />;
        })}
      </Routes>
      <pages.Footer />
    </>
  );
}
