import { Link } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { localizePath, selectedLanguage } from '../languages';

export function AboutPage() {
  const to = (path: string) => localizePath(path, selectedLanguage(useLocation().pathname).code);
  return <main className="content-page about-page">
    <header className="content-hero shell">
      <h1>Small, practical tools for better AI music workflows.</h1>
      <p>Suno Download is an independent resource built to make everyday music tasks clearer—from working with public song links to organizing prompts, lyrics, and project files.</p>
    </header>
    <div className="about-layout shell">
      <article className="about-copy">
        <section><h2>Why we built Suno Download</h2><p>AI music creation moves quickly, but the work around a song can still be fragmented. Creators often need to inspect a public link, find the files a page actually provides, clean up a prompt, structure lyrics, or keep project assets organized. We build focused tools for those practical steps.</p></section>
        <section><h2>Useful, not complicated</h2><p>Each tool is designed around one clear job. We explain what it can do, what it cannot do, and where results depend on the source. Our goal is a calm, understandable experience that helps creators spend less time on repetitive work.</p></section>
        <section><h2>Respect for creators</h2><p>A public link is not the same as permission to reuse a song. Suno Download is intended for content you own, have permission to use, or may otherwise use lawfully. We do not ask for your Suno password, and we encourage users to rely on official exports whenever account access or original-quality files are required.</p></section>
        <section><h2>Independent by design</h2><p>Suno Download is not affiliated with, endorsed by, or sponsored by Suno, Inc. Product names belong to their respective owners. We describe supported workflows accurately so users can make informed decisions.</p></section>
      </article>
      <aside className="about-card"><h2>Try the first tool</h2><p>Paste a public Suno song, share, or Hook link to see the media that page makes available.</p><Link to={to('/tools/downloader/')}>Open Suno Downloader <span aria-hidden="true">→</span></Link></aside>
    </div>
  </main>;
}
