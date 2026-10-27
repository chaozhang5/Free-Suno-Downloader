import articles from './content/articles.json';

const translatedArticles = import.meta.glob<{ default: typeof articles }>('./content/articles.*.json', { eager: true });
const articleSets: Record<string, typeof articles> = { en: articles };
for (const [path, module] of Object.entries(translatedArticles)) {
  const code = path.match(/articles\.(.+)\.json$/)?.[1];
  if (code) articleSets[code] = module.default;
}

export function getArticles(locale: string) {
  return articleSets[locale];
}
