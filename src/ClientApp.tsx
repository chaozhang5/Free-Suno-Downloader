import { useEffect, useState, type ComponentType } from 'react';
import { AppCore, pageTypeForPath, type AppPages } from './AppCore';
import { SiteHeader } from './components/SiteHeader';
import { SiteFooter } from './components/SiteFooter';
import { getArticles, loadArticles } from './ArticleDataClient';
import { selectedLanguage } from './languages';

type PageName = Exclude<keyof AppPages, 'Header' | 'Footer'>;
type PageModule = Record<string, ComponentType<any>>;
type PageLoader = () => Promise<ComponentType<any>>;
const resolvedPages: Partial<Record<PageName, ComponentType<any>>> = {};

function makeLoader(name: PageName, load: () => Promise<PageModule>, exportName: string): PageLoader {
  let resolved: ComponentType<any> | undefined;
  let pending: Promise<ComponentType<any>> | undefined;
  return () => {
    if (resolved) return Promise.resolve(resolved);
    if (!pending) pending = load().then((module) => {
      resolved = module[exportName];
      if (!resolved) throw new Error(`Missing ${exportName} page export`);
      resolvedPages[name] = resolved;
      return resolved;
    }).catch((error) => {
      pending = undefined;
      throw error;
    });
    return pending;
  };
}

const loaders: Record<PageName, PageLoader> = {
  downloader: makeLoader('downloader', () => import('./pages/DownloaderPage'), 'DownloaderPage'),
  promptBuilder: makeLoader('promptBuilder', () => import('./pages/PromptBuilderPage'), 'PromptBuilderPage'),
  tools: makeLoader('tools', () => import('./pages/ToolsPage'), 'ToolsPage'),
  articles: makeLoader('articles', () => import('./pages/ArticlesPage'), 'ArticlesPage'),
  about: makeLoader('about', () => import('./pages/AboutPage'), 'AboutPage'),
  article: makeLoader('article', () => import('./pages/ArticlePage'), 'ArticlePage'),
  toolInfo: makeLoader('toolInfo', () => import('./pages/ToolInfoPage'), 'ToolInfoPage'),
};

function asyncPage(name: PageName): ComponentType<any> {
  const load = loaders[name];
  return function AsyncPage(props: Record<string, unknown>) {
    const [Component, setComponent] = useState<ComponentType<any> | undefined>(() => resolvedPages[name]);
    const [failure, setFailure] = useState<unknown>();
    useEffect(() => {
      let active = true;
      load().then((page) => { if (active) setComponent(() => page); }, (error) => { if (active) setFailure(error); });
      return () => { active = false; };
    }, []);
    if (failure) throw failure;
    return Component ? <Component {...props} /> : null;
  };
}

const pages: AppPages = {
  Header: SiteHeader,
  Footer: SiteFooter,
  downloader: asyncPage('downloader'),
  promptBuilder: asyncPage('promptBuilder'),
  tools: asyncPage('tools'),
  articles: asyncPage('articles'),
  about: asyncPage('about'),
  article: asyncPage('article'),
  toolInfo: asyncPage('toolInfo'),
};

export async function preloadRoute(pathname: string) {
  const pageType = pageTypeForPath(pathname) as PageName | null;
  await Promise.all([
    pageType && ['downloader', 'articles', 'article'].includes(pageType)
      ? loadArticles(selectedLanguage(pathname).code) : undefined,
    pageType ? loaders[pageType]() : undefined,
  ]);
}

export function ClientApp() {
  return <AppCore pages={pages} getArticles={getArticles} loadArticles={loadArticles} />;
}
