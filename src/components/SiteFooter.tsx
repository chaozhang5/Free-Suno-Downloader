import { Link, useLocation } from 'react-router-dom';
import { localizePath, selectedLanguage } from '../languages';
import { tr } from '../i18n';
import { trackNavigation } from '../analytics/posthog';

export function SiteFooter() {
  const { pathname } = useLocation();
  const to = (path: string) => localizePath(path, selectedLanguage(pathname).code);
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <div className="footer-about">
          <Link className="brand" to={to('/')} onClick={() => trackNavigation(to('/'), 'footer', 'brand_home')}><span className="brand-mark" aria-hidden="true">S</span><span>Suno Download</span></Link>
          <p>Focused utilities and practical guides for clearer AI music workflows.</p>
        </div>
        <nav className="footer-group" aria-label="Explore"><h2>{tr('Explore')}</h2><Link to={to('/')} onClick={() => trackNavigation(to('/'), 'footer', 'home')}>{tr('Home')}</Link><Link to={to('/tools/')} onClick={() => trackNavigation(to('/tools/'), 'footer', 'tools_index')}>Tools</Link><Link to={to('/articles/')} onClick={() => trackNavigation(to('/articles/'), 'footer', 'articles_index')}>{tr('Articles')}</Link><Link to={to('/about/')} onClick={() => trackNavigation(to('/about/'), 'footer', 'about')}>{tr('About Us')}</Link></nav>
        <nav className="footer-group" aria-label="Tools"><h2>{tr('Tools')}</h2><Link to={to('/tools/downloader/')} onClick={() => trackNavigation(to('/tools/downloader/'), 'footer', 'downloader')}>{tr('Suno Song Downloader')}</Link><Link to={to('/tools/prompt-builder/')} onClick={() => trackNavigation(to('/tools/prompt-builder/'), 'footer', 'prompt_builder')}>{tr('Prompt Builder')}</Link></nav>
        <nav className="footer-group" aria-label="Articles"><h2>{tr('Articles')}</h2><Link to={to('/articles/how-to-download-suno-songs/')}>{tr('Downloads')}</Link><Link to={to('/articles/write-better-suno-prompts/')}>{tr('Prompts')}</Link><Link to={to('/articles/suno-commercial-use/')}>{tr('Commercial use')}</Link></nav>
        <nav className="footer-group" aria-label="Resources"><h2>Resources</h2><a href="https://help.suno.com/en/articles/13926081" target="_blank" rel="noopener noreferrer">Official download help ↗</a><a href="https://suno.com/terms-of-service" target="_blank" rel="noopener noreferrer">Suno Terms of Service ↗</a></nav>
      </div>
      <div className="shell footer-bottom"><span>© 2026 Suno Download</span><span>Independent resource. Not affiliated with Suno, Inc.</span></div>
    </footer>
  );
}
