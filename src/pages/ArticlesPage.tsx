import { Link } from 'react-router-dom';
import { useState } from 'react';
import articles from '../content/articles.json';
import { localizePath, selectedLanguage } from '../languages';
import { useLocation } from 'react-router-dom';
import { tr } from '../i18n';
import { trackNavigation } from '../analytics/posthog';

const categories = ['Downloads', 'Lyrics', 'Cover art', 'Prompts', 'Tutorials', 'Rights'];
const prioritySlugs = ['suno-download-not-working', 'suno-cover-art-download'];
const priorityRank = (slug: string) => {
  const rank = prioritySlugs.indexOf(slug);
  return rank < 0 ? prioritySlugs.length : rank;
};
const categoryId = (category: string) => category.toLowerCase().replaceAll(' ', '-');

export function ArticlesPage({ articles: localizedArticles = articles }: { articles?: typeof articles }) {
  const code = selectedLanguage(useLocation().pathname).code;
  const [activeCategory, setActiveCategory] = useState(categories[0]);
  const to = (path: string) => localizePath(path, code);
  const articleCount = (category: string) => localizedArticles.filter((article) => article.category === category).length;
  const priorityArticles = prioritySlugs.flatMap((slug) => {
    const article = localizedArticles.find((item) => item.slug === slug);
    return article ? [article] : [];
  });
  return <main className="content-page article-index">
    <header className="content-hero shell">
      <h1>Suno guides for the task in front of you.</h1>
      <p>Practical answers for downloading your own songs, working with lyrics and cover art, writing better prompts, and understanding usage rights.</p>
    </header>
    <div className="article-library shell">
      <nav className="article-hub-tools" aria-label="Start with a tool">
        <Link to={to('/tools/downloader/')} onClick={() => trackNavigation(to('/tools/downloader/'), 'articles_index_tools', 'downloader')}><strong>{tr('Suno Song Downloader')}</strong><span>{tr('Audio, video & cover art')} →</span></Link>
        <Link to={to('/tools/prompt-builder/')} onClick={() => trackNavigation(to('/tools/prompt-builder/'), 'articles_index_tools', 'prompt_builder')}><strong>{tr('Prompt Builder')}</strong><span>{tr('Build focused music prompts')} →</span></Link>
      </nav>
      <section className="article-priority" aria-labelledby="article-priority-title">
        <div className="article-priority-heading"><span>{tr('Articles')}</span><h2 id="article-priority-title">{tr('Popular guides')}</h2></div>
        <div className="article-priority-grid">{priorityArticles.map((article) => <article key={article.slug}>
          <Link to={to(`/articles/${article.slug}/`)} aria-label={tr('Read {title}').replace('{title}', article.title)} onClick={() => trackNavigation(to(`/articles/${article.slug}/`), 'articles_featured', article.slug)}>
            <span>{tr(article.category)}</span><h3>{article.title}</h3><p>{article.description}</p><strong>{tr('READ GUIDE ↗')}</strong>
          </Link>
        </article>)}</div>
      </section>
      <nav className="article-categories" aria-label="Article topics">{categories.map((category) => <a
        aria-current={activeCategory === category ? 'location' : undefined}
        className={activeCategory === category ? 'is-current' : undefined}
        key={category}
        href={`#${categoryId(category)}`}
        onClick={() => setActiveCategory(category)}
      >
        <span>{tr(category)}</span>
        <small>{articleCount(category)}</small>
      </a>)}</nav>
      {categories.map((category) => <section className="article-category" id={categoryId(category)} key={category} aria-labelledby={`heading-${categoryId(category)}`}>
        <div className="article-category-heading"><h2 id={`heading-${categoryId(category)}`}>{tr(category)}</h2><span>{tr('Guides: {count}').replace('{count}', String(articleCount(category)))}</span></div>
        <div className="article-grid">{localizedArticles.filter((article) => article.category === category).sort((a, b) => priorityRank(a.slug) - priorityRank(b.slug)).map((article) => <article key={article.slug}>
          <Link to={to(`/articles/${article.slug}/`)} aria-label={tr('Read {title}').replace('{title}', article.title)} onClick={() => trackNavigation(to(`/articles/${article.slug}/`), 'articles_index', article.slug)}>
            <div><span>{tr(article.category)}</span><small>READ GUIDE ↗</small></div>
            <h4>{article.title}</h4>
            <p>{article.description}</p>
          </Link>
        </article>)}</div>
      </section>)}
    </div>
  </main>;
}
