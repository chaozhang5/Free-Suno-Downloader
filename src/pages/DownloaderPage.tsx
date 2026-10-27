import { DownloaderTool } from '../features/downloader/DownloaderTool';
import { Link } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { localizePath, selectedLanguage } from '../languages';
import articles from '../content/articles.json';
import { tr } from '../i18n';
import { trackNavigation } from '../analytics/posthog';

const discoveryGroups = [
  { title: 'Downloads', links: [['how-to-download-suno-songs', 'Download a song'], ['suno-mp3-download', 'Download as MP3'], ['suno-wav-download', 'Get a WAV file'], ['suno-video-download', 'Download a video'], ['suno-cover-art-download', 'Save cover art'], ['download-multiple-suno-songs', 'Download as ZIP'], ['suno-audio-upload-guide', 'Upload audio'], ['suno-extend-song-guide', 'Extend a song'], ['suno-stem-separation-guide', 'Separate stems']] },
  { title: 'Lyrics', links: [['suno-lyrics-download', 'Save lyrics'], ['suno-lyrics-structure-tags', 'Structure tags'], ['suno-lyrics-timestamps', 'Lyrics timestamps'], ['write-better-suno-prompts', 'Write a prompt'], ['suno-style-prompt-examples', 'Prompt examples'], ['suno-custom-mode-tutorial', 'Custom mode'], ['suno-replace-section-guide', 'Replace a section'], ['suno-persona-guide', 'Reuse a Persona'], ['suno-voices-guide', 'Use your voice'], ['suno-studio-2-guide', 'Suno Studio 2.0']] },
  { title: 'Rights', links: [['suno-share-link-guide', 'Share, song, and Hook links'], ['suno-download-not-working', 'Download not working'], ['organize-suno-song-files', 'Organize song files'], ['suno-commercial-use', 'Commercial use'], ['use-suno-songs-on-youtube', 'Use on YouTube'], ['suno-download-credits-limits', 'Download credits']] },
];

export function DownloaderPage({ articles: localizedArticles = articles }: { articles?: typeof articles }) {
  const { pathname } = useLocation();
  const to = (path: string) => localizePath(path, selectedLanguage(pathname).code);
  const priorityArticles = ['suno-download-not-working', 'suno-cover-art-download'].flatMap((slug) => {
    const article = localizedArticles.find((item) => item.slug === slug);
    return article ? [article] : [];
  });
  return (
    <main>
      <section className="hero" id="downloader" aria-labelledby="page-title">
        <div className="hero-inner shell">
          <h1 id="page-title"><span>{tr('Free Suno Song Downloader')}</span></h1>
          <p className="hero-subtitle">Paste a Suno share, song, or Hook link. Preview available audio, video, and cover art, then save files you have permission to use.</p>
          <div className="tool-area"><DownloaderTool /></div>
        </div>
      </section>

      <section className="downloader-priority shell" aria-labelledby="downloader-priority-title">
        <div className="section-heading"><h2 id="downloader-priority-title">{tr('Popular guides')}</h2></div>
        <div className="downloader-priority-grid">{priorityArticles.map((article) => <Link key={article.slug} to={to(`/articles/${article.slug}/`)} onClick={() => trackNavigation(to(`/articles/${article.slug}/`), 'downloader_featured', article.slug)}>
          <span>{tr(article.category)}</span><h3>{article.title}</h3><p>{article.description}</p><strong>{tr('READ GUIDE ↗')}</strong>
        </Link>)}</div>
      </section>

      <section className="discovery-hub shell" aria-labelledby="discovery-title">
        <div className="discovery-heading">
          <h2 id="discovery-title">Suno guides for the task in front of you.</h2>
          <p>Start with the guide closest to the file or problem you are working on.</p>
        </div>
        <div className="discovery-grid">
          {discoveryGroups.map((group, index) => <article className="discovery-card" key={group.title}>
            <div className="discovery-card-heading"><span>{String(index + 1).padStart(2, '0')}</span><h3>{tr(group.title)}</h3></div>
            <nav aria-label={tr(group.title)}>{group.links.map(([slug, label]) => (
              localizedArticles.some((item) => item.slug === slug) ? <Link key={slug} to={to(`/articles/${slug}/`)} onClick={() => trackNavigation(to(`/articles/${slug}/`), 'downloader_guides', slug)}><span>{tr(label)}</span></Link> : null
            ))}</nav>
          </article>)}
        </div>
        <Link className="tool-crosslink" to={to('/tools/prompt-builder/')} onClick={() => trackNavigation(to('/tools/prompt-builder/'), 'downloader_related_tool', 'prompt_builder')}>
          <span><strong>{tr('Prompt Builder')}</strong><small>{tr('Build focused music prompts')}</small></span>
          <span className="tool-crosslink-arrow" aria-hidden="true">→</span>
        </Link>
      </section>

      <section className="support-section shell" id="supported-links">
        <div className="section-heading"><h2>Which Suno URLs can I use?</h2><p>Paste one public song link at a time. A valid link can still have no media available to save.</p></div>
        <div className="support-grid">
          <article><h3>Share links</h3><code>suno.com/s/…</code><p>The tool checks the share code and prepares available audio in your browser. Cover art and video appear only when the public page provides them.</p></article>
          <article><h3>Song pages</h3><code>suno.com/song/…</code><p>The tool reads the public page and lists media it publishes. It cannot create an export that is absent from the page.</p></article>
          <article><h3>Hook pages</h3><code>suno.com/hook/…</code><p>Public Hook links are supported when their page exposes usable media. Private, removed, playlist, and profile links are outside this tool.</p></article>
        </div>
      </section>

      <section className="formats-section" id="formats"><div className="shell">
        <div className="section-heading centered"><h2>Pick what the song offers.</h2><p>Audio is prepared locally. Video and cover art appear only when the page includes them.</p></div>
        <div className="format-grid">
          <article><div className="format-icon audio">♫</div><h3>{tr('MP3, WAV & original audio')}</h3><p>{tr('Choose original audio for a direct copy, MP3 for compatibility, or WAV for editing. MP3 and WAV are created in your browser from playable audio.')}</p><span>{tr('Each conversion uses the available source audio.')}</span></article>
          <article><div className="format-icon video" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m10 9 5 3-5 3V9Z" fill="currentColor" stroke="none" /></svg></div><h3>Video</h3><p>Save a video only when the song page includes one.</p><span>When a video is available</span></article>
          <article><div className="format-icon cover" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m4 17 5-5 4 4 3-3 4 4" /></svg></div><h3>Cover art</h3><p>Save the cover image from the public song.</p><span>For authorized artwork use</span></article>
        </div>
      </div></section>

      <section className="troubleshooting-section shell" id="troubleshooting">
        <div className="section-heading"><h2>When a link does not work.</h2><p>Check the source song first, then try the link again.</p></div>
        <div className="troubleshooting-grid">
          <article><h3>Link not found</h3><p>Open the URL on Suno. The song may be private, deleted, or the share code may have been copied incompletely.</p></article>
          <article><h3>No audio or video option</h3><p>The public page may not expose that file, or the audio may still be processing. Check Suno’s own Download menu for official exports.</p></article>
          <article><h3>Temporary server error</h3><p>Suno may be unavailable or limiting requests. Wait a moment and retry; repeated failures may need a later check.</p></article>
        </div>
      </section>

      <section className="faq-section shell" id="faq">
        <div className="section-heading"><h2>Questions, answered.</h2><p>What to expect from public links and available files.</p></div>
        <div className="faq-list">
          <details><summary>Which Suno links work?<span>+</span></summary><p>{tr('Public suno.com/song/…, suno.com/s/…, and suno.com/hook/… links. Playlists, profiles, private, and deleted songs are outside this single-song tool.')}</p></details>
          <details><summary>Why is an audio or video option missing?<span>+</span></summary><p>Share link audio needs working access data and an available source file. Video and artwork appear only when found on the song page. Use Suno’s official Download menu for account based exports.</p></details>
          <details><summary>Can I download a WAV file?<span>+</span></summary><p>If playable audio is available, this tool can convert it locally to a 16-bit PCM WAV. That does not restore detail lost in the source or replace Suno’s official WAV export. Official WAV availability depends on your plan and device.</p></details>
          <details><summary>Can I use someone else’s song?<span>+</span></summary><p>Only save and use content when you have the creator’s permission or another valid right. A public link alone does not grant a license.</p></details>
          <details><summary>Where does my link go?<span>+</span></summary><p>Share links are sent to this site’s lookup and rights endpoints. Your browser fetches the encrypted audio from Suno’s CDN and decrypts it locally. Other available files may be streamed through this site. This site does not ask for your Suno password.</p></details>
        </div>
      </section>

      <section className="downloader-guides shell" aria-labelledby="downloader-guides-title">
        <div className="section-heading"><h2 id="downloader-guides-title">Need a little more detail?</h2><p>Start with the guide closest to the file or problem you are working on.</p></div>
        <div className="downloader-guide-links">
          <Link to={to('/articles/how-to-download-suno-songs/')}><span>GET STARTED</span><strong>How to download a Suno song</strong><span aria-hidden="true">→</span></Link>
          <Link to={to('/articles/suno-download-not-working/')}><span>TROUBLESHOOT</span><strong>Why a download may not work</strong><span aria-hidden="true">→</span></Link>
          <Link to={to('/articles/suno-lyrics-download/')}><span>LYRICS</span><strong>How to save available lyric text</strong><span aria-hidden="true">→</span></Link>
        </div>
      </section>
    </main>
  );
}
