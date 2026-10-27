import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { languages, selectedLanguage, languageSwitchPath, localizePath, basePath } from '../languages';
import { tr } from '../i18n';
import toolCatalog from '../content/tools.json';
import { analyticsPageType, track, trackNavigation } from '../analytics/posthog';

const additionalCategories = ['Create & Edit', 'Inspect & Refine', 'Download & Collect'];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);
  const toolsButtonRef = useRef<HTMLButtonElement>(null);
  const languageRef = useRef<HTMLDivElement>(null);
  const languageButtonRef = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();
  const language = selectedLanguage(pathname);
  const path = basePath(pathname);
  const to = (target: string) => localizePath(target, language.code);
  const isHome = path === '/';
  const isTools = path.startsWith('/tools/') || /\/downloader\/?$/.test(path);

  useEffect(() => {
    setMenuOpen(false);
    setToolsOpen(false);
    setMobileToolsOpen(false);
    setLanguageOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    if (!languageOpen && !toolsOpen) return;
    function closeOnOutsideClick(event: PointerEvent) {
      const target = event.target as Node;
      if (languageOpen && !languageRef.current?.contains(target)) setLanguageOpen(false);
      if (toolsOpen && !toolsRef.current?.contains(target)) setToolsOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (toolsOpen) toolsButtonRef.current?.focus();
      else if (languageOpen) languageButtonRef.current?.focus();
      setToolsOpen(false);
      setLanguageOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [languageOpen, toolsOpen]);

  return (
    <>
      <header className="site-header">
        <Link className="brand" to={to('/')} aria-label="Suno Download home" onClick={() => trackNavigation(to('/'), 'header', 'brand_home')}>
          <span className="brand-mark" aria-hidden="true">S</span><span>Suno Download</span>
        </Link>
        <nav className="desktop-nav" aria-label={tr('Main navigation')}>
          <Link className={isHome ? 'active' : undefined} to={to('/')} onClick={() => trackNavigation(to('/'), 'header', 'home')}>{tr('Home')}</Link>
          <div className="tools-menu" ref={toolsRef}>
            <button className={isTools ? 'active' : undefined} ref={toolsButtonRef} type="button" aria-expanded={toolsOpen} aria-controls="tools-menu-panel" onClick={() => { setToolsOpen(!toolsOpen); setLanguageOpen(false); }}>
              Tools <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3.5 6 4.5 4 4.5-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {toolsOpen && <div className="tools-menu-panel" id="tools-menu-panel">
              <div className="tools-menu-content">
                <div className="tools-menu-available">
                  {toolCatalog.available.map((item) => <Link className={item.path === '/tools/downloader/' ? 'primary-tool-link' : 'secondary-tool-link'} key={item.path} to={to(item.path)} onClick={() => trackNavigation(to(item.path), 'header_tools_menu', item.path.slice(1, -1).replaceAll('/', '_'))}><strong>{tr(item.name)}<span aria-hidden="true">↗</span></strong><small>{tr(item.description)}</small></Link>)}
                </div>
                <div className="tools-menu-additional" aria-label={tr('More tools')}>
                  <div className="tools-menu-subheading"><strong>{tr('More tools')}</strong><Link to={to('/tools/')} onClick={() => trackNavigation(to('/tools/'), 'header_tools_menu', 'tools_index')}>{tr('View overview →')}</Link></div>
                  <div className="tools-menu-additional-groups">
                    {additionalCategories.map((category) => <section key={category}><h3>{tr(category)}</h3><div className="tools-menu-additional-grid">
                      {toolCatalog.additional.filter((item) => item.category === category).map((item) => <Link key={item.slug} to={to(`/tools/${item.slug}/`)} onClick={() => trackNavigation(to(`/tools/${item.slug}/`), 'header_tools_menu', item.slug)}><span>{tr(item.name)}</span><small aria-hidden="true">↗</small></Link>)}
                    </div></section>)}
                  </div>
                </div>
              </div>
            </div>}
          </div>
          <Link className={path.startsWith('/articles') ? 'active' : undefined} to={to('/articles/')} onClick={() => trackNavigation(to('/articles/'), 'header', 'articles_index')}>{tr('Articles')}</Link>
          <Link className={path.startsWith('/about') ? 'active' : undefined} to={to('/about/')} onClick={() => trackNavigation(to('/about/'), 'header', 'about')}>{tr('About Us')}</Link>
        </nav>
        <div className="header-actions">
          <div className="language-switcher" ref={languageRef}>
            <button className="language-trigger" ref={languageButtonRef} type="button" aria-label={tr('Language: {language}').replace('{language}', language.label)} aria-expanded={languageOpen} aria-controls="language-options" onClick={() => { setLanguageOpen(!languageOpen); setToolsOpen(false); }}>
              {language.code === 'pt-BR' ? 'PT' : language.code === 'zh-CN' ? 'ZH' : language.code.toUpperCase()}<svg className="language-chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3.5 6 4.5 4 4.5-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <nav className="language-options" id="language-options" aria-label="Choose language" hidden={!languageOpen}>
              {languages.map((option) => <Link key={option.code} to={languageSwitchPath(pathname, option.code)} lang={option.code} aria-current={language.code === option.code ? 'page' : undefined} onClick={() => { if (language.code !== option.code) track('language_changed', { from_locale: language.code, to_locale: option.code, page_type: analyticsPageType(pathname) }); }}>{option.label}</Link>)}
            </nav>
          </div>
          <button className="menu-toggle" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-controls="mobile-nav" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
            <span /><span /><span />
          </button>
        </div>
      </header>
      <nav className="mobile-nav" id="mobile-nav" aria-label="Mobile navigation" hidden={!menuOpen}>
        <Link to={to('/')} onClick={() => trackNavigation(to('/'), 'mobile_menu', 'home')}>{tr('Home')}</Link>
        <button className="mobile-tools-trigger" type="button" aria-expanded={mobileToolsOpen} aria-controls="mobile-tools" onClick={() => setMobileToolsOpen(!mobileToolsOpen)}>{tr('Tools')} <span>⌄</span></button>
        <div className="mobile-tools" id="mobile-tools" hidden={!mobileToolsOpen}>
          {toolCatalog.available.map((item) => <Link className={item.path === '/tools/downloader/' ? 'mobile-core-tool' : 'mobile-secondary-tool'} key={item.path} to={to(item.path)} onClick={() => trackNavigation(to(item.path), 'mobile_tools_menu', item.path.slice(1, -1).replaceAll('/', '_'))}><strong>{tr(item.name)}</strong><span>{tr(item.description)}</span></Link>)}
          {toolCatalog.additional.map((item) => <Link className="mobile-additional-tool" key={item.slug} to={to(`/tools/${item.slug}/`)} onClick={() => trackNavigation(to(`/tools/${item.slug}/`), 'mobile_tools_menu', item.slug)}><strong>{tr(item.name)}</strong><span aria-hidden="true">↗</span></Link>)}
          <Link className="mobile-tools-roadmap" to={to('/tools/')} onClick={() => trackNavigation(to('/tools/'), 'mobile_tools_menu', 'tools_index')}>{tr('View all tools →')}</Link>
        </div>
        <Link to={to('/articles/')} onClick={() => trackNavigation(to('/articles/'), 'mobile_menu', 'articles_index')}>{tr('Articles')}</Link>
        <Link to={to('/about/')} onClick={() => trackNavigation(to('/about/'), 'mobile_menu', 'about')}>{tr('About Us')}</Link>
      </nav>
    </>
  );
}
