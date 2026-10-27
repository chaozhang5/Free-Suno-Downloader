import { Link, useLocation } from 'react-router-dom';
import { localizePath, selectedLanguage } from '../languages';
import toolCatalog from '../content/tools.json';
import { tr } from '../i18n';

type ToolDescription = typeof toolCatalog.additional[number];

export function ToolInfoPage({ slug }: { slug: string }) {
  const pathname = useLocation().pathname;
  const tool = toolCatalog.additional.find((item) => item.slug === slug) as ToolDescription | undefined;
  if (!tool) return <main className="content-page"><section className="content-hero shell"><h1>Tool information unavailable</h1><p>This tool entry could not be found.</p><Link to={localizePath('/tools/', selectedLanguage(pathname).code)}>Browse all tools</Link></section></main>;
  const to = (path: string) => localizePath(path, selectedLanguage(pathname).code);
  return <main className="content-page tool-info-page">
    <header className="content-hero shell">
      <nav className="tool-breadcrumbs" aria-label="Breadcrumb"><Link to={to('/')}>Home</Link><span aria-hidden="true">/</span><Link to={to('/tools/')}>Tools</Link><span aria-hidden="true">/</span><span>{tr(tool.name)}</span></nav>
      <h1>{tr(tool.name)}</h1>
      <p>{tr(tool.summary)}</p>
    </header>
    <div className="tool-info-layout shell">
      <article className="tool-info-copy">
        <section><span className="eyebrow">OVERVIEW</span><h2>{tr('What {tool} does').replace('{tool}', tr(tool.name))}</h2><p>{tool.purpose}</p></section>
        <section><span className="eyebrow">KEY CAPABILITIES</span><h2>Keep the work clear and focused</h2><ul>{tool.highlights.map((item) => <li key={item}>{item}</li>)}</ul></section>
        <section><span className="eyebrow">WORKFLOW</span><h2>A simple way to use it</h2><ol>{tool.workflow.map((step) => <li key={step}>{step}</li>)}</ol></section>
        <section><span className="eyebrow">WHO IT HELPS</span><h2>Made for real songwriting tasks</h2><p>{tool.bestFor}</p></section>
      </article>
      <aside className="tool-info-card"><span className="eyebrow">SUNO DOWNLOAD</span><h2>Suno Song Downloader</h2><p>Open a public Suno song link, preview the media available on its page, and save audio, video, or cover art.</p><Link to={to('/tools/downloader/')}>Open Suno Song Downloader<span aria-hidden="true">→</span></Link></aside>
    </div>
  </main>;
}
