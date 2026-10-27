import { Link } from 'react-router-dom';
import articles from '../content/articles.json';
import articleCtas from '../content/article-cta.json';
import { localizePath, selectedLanguage } from '../languages';
import { useLocation } from 'react-router-dom';
import { tr } from '../i18n';
import { track, trackNavigation } from '../analytics/posthog';

type Article = typeof articles[number];
export function ArticlePage({ article, articles: localizedArticles = articles }: { article: Article; articles?: typeof articles }) {
  const articlesBySlug = new Map(localizedArticles.map((item) => [item.slug, item]));
  const code = selectedLanguage(useLocation().pathname).code;
  const to = (path: string) => localizePath(path, code);
  const promptBuilderArticle = articleCtas.promptBuilder.includes(article.slug);
  const hasDownloaderCta = articleCtas.downloader.includes(article.slug);
  const officialSource = articleCtas.officialSource.includes(article.slug) ? article.sources[0] : undefined;
  return <main className="content-page article-page">
    <div className="shell article-page-shell">
      <nav className="breadcrumbs" aria-label="Breadcrumb"><Link to={to('/')} onClick={() => trackNavigation(to('/'), 'breadcrumb', 'home')}>Home</Link><span aria-hidden="true">/</span><Link to={to('/articles/')} onClick={() => trackNavigation(to('/articles/'), 'breadcrumb', 'articles_index')}>{tr('Articles')}</Link><span aria-hidden="true">/</span><span>{tr(article.category)}</span></nav>
      <div className="article-page-layout">
        <article className="article-body">
          <header className="article-header"><span className="article-topic">{tr(article.category)}</span><h1>{article.title}</h1><p className="article-deck">{article.description}</p></header>
          <p className="article-intro">{article.intro}</p>
          <nav className="article-toc" aria-label="On this page"><strong>In this guide</strong>{article.sections.map((section, index) => <a key={section.heading} href={`#section-${index + 1}`}>{section.heading}</a>)}</nav>
          {article.sections.map((section, index) => <section className="article-section" id={`section-${index + 1}`} key={section.heading}><h2>{section.heading}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}
          <section className="article-faq" aria-labelledby="article-faq-title"><h2 id="article-faq-title">Common questions</h2>{article.faq.map((item) => <div key={item.question}><h3>{item.question}</h3><p>{item.answer}</p></div>)}</section>
          {article.sources.length > 0 && <section className="article-sources" aria-labelledby="article-sources-title"><h2 id="article-sources-title">{tr('Sources')}</h2><ul>{article.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label} ↗</a></li>)}</ul></section>}
          <nav className="article-related" aria-label="Related articles"><h2>Read next</h2><div>{article.related.map((slug) => { const related = articlesBySlug.get(slug); return related ? <Link to={to(`/articles/${related.slug}/`)} key={slug} onClick={() => track('article_cta_clicked', { article_slug: article.slug, cta_type: 'related_article', target_id: related.slug, placement: 'article_body' })}><span>{tr(related.category)}</span><strong>{related.title}</strong><span aria-hidden="true">→</span></Link> : null; })}</div></nav>
        </article>
        <aside className="article-sidebar">
          {promptBuilderArticle && <div className="article-tool-card"><span>{tr('AVAILABLE TOOL')}</span><h2>{tr('Prompt Builder')}</h2><p>{tr('Build focused music prompts')}</p><Link to={to('/tools/prompt-builder/')} onClick={() => track('article_cta_clicked', { article_slug: article.slug, cta_type: 'tool', target_id: 'prompt_builder', placement: 'article_sidebar' })}>{tr('Open Prompt Builder')} <span aria-hidden="true">→</span></Link></div>}
          {hasDownloaderCta && <div className="article-tool-card"><span>{tr('AVAILABLE TOOL')}</span><h2>{tr('Suno Song Downloader')}</h2><p>{tr('Check the media exposed by one accessible public song, share, or Hook link when you have permission to use it.')}</p><Link to={to('/tools/downloader/')} onClick={() => track('article_cta_clicked', { article_slug: article.slug, cta_type: 'tool', target_id: 'downloader', placement: 'article_sidebar' })}>{tr('Open Suno Song Downloader')} <span aria-hidden="true">→</span></Link></div>}
          {officialSource && <div className="article-tool-card"><span>{tr('Official sources')}</span><h2>{tr('Check Suno’s current guidance')}</h2><p>{tr('Usage terms and account options can change. Review Suno’s current source before acting.')}</p><a href={officialSource.url} target="_blank" rel="noopener noreferrer" onClick={() => track('article_cta_clicked', { article_slug: article.slug, cta_type: 'official_source', target_id: 'suno_official', placement: 'article_sidebar' })}>{officialSource.label} ↗</a></div>}
          <div className="article-side-link"><span>{tr('MORE GUIDES')}</span><Link to={to('/articles/')} onClick={() => track('article_cta_clicked', { article_slug: article.slug, cta_type: 'articles_index', target_id: 'articles_index', placement: 'article_sidebar' })}>{tr('Browse all {count} articles').replace('{count}', String(localizedArticles.length))} <span aria-hidden="true">→</span></Link></div>
        </aside>
      </div>
    </div>
  </main>;
}
