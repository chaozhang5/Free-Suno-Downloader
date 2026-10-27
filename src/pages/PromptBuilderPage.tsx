import { PromptBuilder } from '../features/prompt-builder/PromptBuilder';
import { Link, useLocation } from 'react-router-dom';
import { localizePath, selectedLanguage } from '../languages';
import { tr } from '../i18n';
import { trackNavigation } from '../analytics/posthog';

export function PromptBuilderPage() {
  const { pathname } = useLocation();
  const downloaderPath = localizePath('/tools/downloader/', selectedLanguage(pathname).code);
  return <main className="pb-page">
    <section className="pb-hero">
      <div className="pb-hero-copy shell"><h1>Free <span>Suno Prompt Builder</span></h1><p>Shape a focused Suno Style prompt across eight musical dimensions. Fill only the directions you want to hear.</p></div>
    </section>
    <section className="shell pb-main"><PromptBuilder /></section>
    <section className="shell pb-guide-links" aria-label={tr('Prompt guides')}>
      <Link to={localizePath('/articles/write-better-suno-prompts/', selectedLanguage(pathname).code)} onClick={() => trackNavigation(localizePath('/articles/write-better-suno-prompts/', selectedLanguage(pathname).code), 'prompt_builder_guides', 'write_better_suno_prompts')}>{tr('Write a prompt')} <span aria-hidden="true">→</span></Link>
      <Link to={localizePath('/articles/suno-style-prompt-examples/', selectedLanguage(pathname).code)} onClick={() => trackNavigation(localizePath('/articles/suno-style-prompt-examples/', selectedLanguage(pathname).code), 'prompt_builder_guides', 'suno_style_prompt_examples')}>{tr('Prompt examples')} <span aria-hidden="true">→</span></Link>
    </section>
    <section className="shell pb-related-tool">
      <Link className="tool-crosslink" to={downloaderPath} onClick={() => trackNavigation(downloaderPath, 'prompt_builder_related_tool', 'downloader')}>
        <span><strong>{tr('Suno Song Downloader')}</strong><small>{tr('Audio, video & cover art')}</small></span>
        <span className="tool-crosslink-arrow" aria-hidden="true">→</span>
      </Link>
    </section>
  </main>;
}
