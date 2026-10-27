import type articles from './content/articles.json';

type Articles = typeof articles;
type Loader = () => Promise<{ default: Articles }>;
const loaders = import.meta.glob<{ default: Articles }>('./content/articles*.json');
const cache = new Map<string, Articles>();

function dataPath(locale: string) {
  return locale === 'en' ? './content/articles.json' : `./content/articles.${locale}.json`;
}

export function getArticles(locale: string) {
  return cache.get(locale);
}

export async function loadArticles(locale: string) {
  const existing = cache.get(locale);
  if (existing) return existing;
  const loader = loaders[dataPath(locale)] as Loader | undefined;
  if (!loader) return [] as unknown as Articles;
  const { default: data } = await loader();
  cache.set(locale, data);
  return data;
}
