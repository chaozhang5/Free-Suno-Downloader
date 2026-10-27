import { Link } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { localizePath, selectedLanguage } from '../languages';
import toolCatalog from '../content/tools.json';
import { tr } from '../i18n';
import { trackNavigation } from '../analytics/posthog';

export function ToolsPage() {
  const pathname = useLocation().pathname;
  const to = (path: string) => localizePath(path, selectedLanguage(pathname).code);
  return <main className="content-page tools-directory">
    <header className="content-hero shell">
      <h1>Practical tools for your Suno workflow.</h1>
      <p>Explore practical utilities for shaping prompts, organizing lyrics, reviewing public song details, and collecting music files.</p>
    </header>
    <section className="tools-directory-section shell" aria-labelledby="available-tools-heading">
      <div className="tools-directory-heading"><div><h2 id="available-tools-heading">Recommend Tools</h2></div></div>
      <div className="tools-directory-grid">
        {toolCatalog.available.map((tool) => <Link className="directory-tool-card available" key={tool.path} to={to(tool.path)} onClick={() => trackNavigation(to(tool.path), 'tools_directory', tool.path.slice(1, -1).replaceAll('/', '_'))}><span className="directory-tool-category">{tr(tool.category)}</span><h3>{tr(tool.name)}</h3><p>{tr(tool.description)}</p><span className="directory-tool-link">Open tool <span aria-hidden="true">→</span></span></Link>)}
      </div>
    </section>
    <section className="tools-directory-section shell" aria-labelledby="more-tools-heading">
      <div className="tools-directory-heading"><div><h2 id="more-tools-heading">More Tools</h2></div></div>
      <div className="tools-directory-grid additional-tools">
        {toolCatalog.additional.map((tool) => <Link className="directory-tool-card additional-tool-card" key={tool.slug} to={to(`/tools/${tool.slug}/`)} onClick={() => trackNavigation(to(`/tools/${tool.slug}/`), 'tools_directory', tool.slug)}><span className="directory-tool-category">{tr(tool.category)}</span><h3>{tr(tool.name)}</h3><p>{tr(tool.summary)}</p></Link>)}
      </div>
      <p className="tools-roadmap-note">Choose a tool to read about its purpose, key capabilities, workflow, and the songwriting tasks it supports.</p>
    </section>
  </main>;
}
