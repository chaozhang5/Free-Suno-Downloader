import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { tr } from '../../i18n';
import { track } from '../../analytics/posthog';

type Dimension = { id: string; title: string; short: string; hint: string; placeholder: string; suggestions: string[] };
const dimensions: Dimension[] = [
  { id: 'genre', title: 'Genre & Style', short: 'Genre', hint: 'Choose one clear musical lane first. A second style can act as an influence.', placeholder: 'e.g. intimate cinematic pop, chamber pop', suggestions: ['Intimate Cinematic Pop', 'Chamber Pop', 'Neo-Soul R&B', 'Mandopop fusion', 'Alternative Rock', 'UK garage', 'Midwest emo', 'Baroque pop', 'Afrobeat', 'shoegaze'] },
  { id: 'instruments', title: 'Instruments & texture', short: 'Instruments', hint: 'Choose 1–3 specific phrases that describe the arrangement.', placeholder: 'e.g. delicate piano arpeggios, warm string quartet', suggestions: ['delicate piano arpeggios', 'warm string quartet', 'soft hand percussion', 'subtle synth pads', 'music box accents', 'slap bass', 'atmospheric synths', 'fingerpicked acoustic guitar'] },
  { id: 'mood', title: 'Mood & Energy', short: 'Mood & Energy', hint: 'Pair emotional color with intensity.', placeholder: 'e.g. nostalgic, intimate, restrained', suggestions: ['introspective', 'tender', 'bittersweet', 'quietly hopeful', 'cinematic', 'nostalgic', 'nocturnal', 'wistful', 'restrained', 'gently driving', 'high-energy', 'explosive'] },
  { id: 'vocal', title: 'Vocal', short: 'Vocal', hint: 'Combine lineup, delivery and harmonies where useful.', placeholder: 'e.g. breathy falsetto, layered harmonies', suggestions: ['breathy falsetto', 'forceful shout-singing', 'mumbled storytelling flow', 'emotive vibrato', 'close-mic whisper', 'belted chorus', 'spoken-word verses', 'layered harmonies', 'male-female duet', 'conversational intimacy', 'whispered call-and-response'] },
  { id: 'production', title: 'Production & Effects', short: 'Production & Effects', hint: 'Describe recording character, space, width or dynamics.', placeholder: 'e.g. warm analog production, natural room reverb', suggestions: ['cinematic production', 'minimalist and atmospheric', 'dry upfront mix', 'tape-saturated', 'sidechain-heavy pads', 'close-mic warmth', 'cozy reverb', 'wide stereo image', 'subtle tape saturation', 'organic dynamics', 'never overwhelming'] },
  { id: 'tempo', title: 'Tempo & Groove', short: 'Tempo & Groove', hint: 'Add a direction for the pulse or rhythmic feel.', placeholder: 'e.g. slow mid-tempo pulse, syncopated groove', suggestions: ['slow mid-tempo', 'driving', 'syncopated', 'swung', 'half-time', '6/8'] },
  { id: 'arc', title: 'Song Arc', short: 'Song Arc', hint: 'Describe how the arrangement opens, builds, peaks or resolves.', placeholder: 'e.g. sparse opening, gradual build', suggestions: ['sparse opening', 'gradual build', 'understated chorus', 'explosive chorus', 'stripped-back bridge', 'gentle fade-out'] },
  { id: 'melody', title: 'Melody & Harmony', short: 'Melody & Harmony', hint: 'Add key, chord language or melodic direction when it matters.', placeholder: 'e.g. minor key, suspended chords', suggestions: ['minor key', 'warm major', 'suspended chords', 'jazz chords', 'descending melody', 'unresolved ending'] },
];
const lyricsTags = ['[Intro]', '[Verse]', '[Pre-Chorus]', '[Chorus]', '[Verse 2]', '[Bridge]', '[Outro]'];
const presets: Record<string, string[]> = {
  'Dreamy Indie Pop': ['Dreamy Indie Pop', 'fingerpicked acoustic guitar, subtle synth pads', 'wistful, quietly hopeful', 'conversational intimacy, layered harmonies', 'warm analog production, cozy reverb', 'slow mid-tempo', 'gradual build, gentle fade-out', 'suspended chords'],
  'Cinematic Ballad': ['Cinematic Pop Ballad', 'piano arpeggios, warm string quartet', 'tender, bittersweet, restrained', 'emotive vibrato, belted chorus', 'cinematic production, wide stereo image', 'slow 6/8', 'sparse opening, gradual build, explosive chorus', 'minor key, descending melody'],
  'Alt Rock': ['Alternative Rock', 'driving electric guitars, live drums', 'urgent, high-energy', 'forceful shout-singing', 'raw live-room sound', 'driving, straight groove', 'understated verse, explosive chorus', 'minor key'],
};
const dimensionGroups = [
  { id: 'identity', title: 'Sound identity', hint: 'Give the track a clear musical center.', dimensions: ['genre', 'instruments'] },
  { id: 'performance', title: 'Performance & feel', hint: 'Shape the emotion, vocal delivery, and rhythmic movement.', dimensions: ['mood', 'vocal', 'tempo'] },
  { id: 'arrangement', title: 'Arrangement & finish', hint: 'Add production character and details that make the song move.', dimensions: ['production', 'arc', 'melody'] },
];

function DimensionIcon({ id }: { id: string }) {
  const paths: Record<string, ReactNode> = {
    genre: <><path d="M8 14V4.5L16 3v9" /><ellipse cx="5.5" cy="14.5" rx="2.5" ry="2" /><ellipse cx="13.5" cy="12.5" rx="2.5" ry="2" /></>,
    instruments: <><path d="m3 14 8-8 3 3-8 8H3v-3Z" /><path d="m10 7 3 3M4.5 15.5l1 1M15 3l2 2M13.5 4.5l2 2" /></>,
    mood: <><circle cx="10" cy="10" r="7.5" /><path d="M7 12s1 2 3 2 3-2 3-2M7.5 8h.01M12.5 8h.01" /></>,
    vocal: <><rect x="7" y="2.5" width="6" height="10" rx="3" /><path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v3M7 18h6" /></>,
    production: <><path d="M3 5h14M3 10h14M3 15h14" /><circle cx="7" cy="5" r="1.8" /><circle cx="13" cy="10" r="1.8" /><circle cx="8" cy="15" r="1.8" /></>,
  };
  return <svg className="pb-dimension-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[id]}</svg>;
}

export function PromptBuilder() {
  const [values, setValues] = useState<string[]>(Array(8).fill(''));
  const [intent, setIntent] = useState('');
  const [active, setActive] = useState('');
  const [format, setFormat] = useState<'compact' | 'detailed'>('compact');
  const [imported, setImported] = useState('');
  const [exclude, setExclude] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);
  const [showAll, setShowAll] = useState('');
  const [compareOpen, setCompareOpen] = useState(false);
  const [versionB, setVersionB] = useState('');
  const [editingVersion, setEditingVersion] = useState<'a' | 'b'>('a');
  const [message, setMessage] = useState('');
  const editorRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [popoverPosition, setPopoverPosition] = useState({ left: 16, arrow: 42 });
  const currentGroup = dimensionGroups.find((group) => group.id === active);
  const toggleDimension = (id: string) => {
    if (active === id) { setActive(''); return; }
    track('prompt_builder_dimension_group_opened', { group_id: id });
    const editor = editorRef.current;
    const button = tabRefs.current[id];
    if (editor && button) {
      const editorRect = editor.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      const gutter = window.innerWidth <= 640 ? 8 : window.innerWidth <= 760 ? 10 : 16;
      const width = Math.min(650, editor.clientWidth - gutter * 2);
      const center = buttonRect.left + buttonRect.width / 2 - editorRect.left;
      const left = Math.max(gutter, Math.min(center - width / 2, editor.clientWidth - width - gutter));
      setPopoverPosition({ left, arrow: Math.max(24, Math.min(width - 24, center - left)) });
    }
    setActive(id);
    setShowAll('');
  };
  useEffect(() => {
    if (!active) return;
    const closeOnOutside = (event: PointerEvent) => {
      if ((event.target as Element).closest('.pb-tabs, .pb-tab-content')) return;
      setActive('');
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setActive(''); };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [active]);
  const filled = dimensions.map((d, i) => ({ title: d.short, value: values[i].trim() })).filter((item) => item.value);
  const prompt = useMemo(() => {
    const lines = filled.map(({ title, value }) => `${title}: ${value}`);
    if (intent.trim()) lines.unshift(`Creative intent: ${intent.trim()}`);
    if (imported.trim()) lines.unshift(`Base prompt: ${imported.trim()}`);
    return format === 'compact' ? lines.join('\n') : filled.length || intent.trim() ? `${intent.trim() ? `Create a track that feels ${intent.trim()}. ` : 'Create a track '} ${filled.map((x) => x.value).join(', ')}.${imported.trim() ? ` Keep these existing directions in mind: ${imported.trim()}.` : ''}` : imported.trim();
  }, [filled.map((x) => `${x.title}:${x.value}`).join('|'), imported, format, intent]);
  useEffect(() => {
    if (editingVersion === 'b' && compareOpen) setVersionB(prompt);
    else setOutput(prompt);
  // Sync generated field changes into the version currently being edited. Opening
  // comparison itself must not overwrite a manually edited baseline draft.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt]);
  const updateValue = (index: number, value: string) => setValues((current) => current.map((entry, i) => i === index ? value : entry));
  const addSuggestion = (index: number, text: string) => {
    const current = values[index].split(',').map((part) => part.trim()).filter(Boolean);
    if (current.some((part) => part.toLowerCase() === text.toLowerCase())) return;
    updateValue(index, [...current, text].join(', '));
  };
  const applyPreset = (name: string) => { track('prompt_builder_preset_applied', { preset_id: name.toLowerCase().replaceAll(' ', '_') }); setValues(presets[name]); setActive('identity'); setMessage(tr('Preset loaded.')); };
  const clear = () => {
    const hadContent = values.some((value) => value.trim()) || Boolean(intent.trim() || imported.trim() || exclude.trim() || lyrics.trim());
    track('prompt_builder_cleared', { had_content: Boolean(hadContent) });
    setValues(Array(8).fill('')); setIntent(''); setImported(''); setExclude(''); setLyrics(''); setCompareOpen(false); setVersionB(''); setMessage(tr('Prompt cleared.'));
  };
  const copy = async (text: string, label = 'Prompt') => {
    if (!text.trim()) { setMessage(tr('Add a direction to your prompt first.')); return; }
    try {
      await navigator.clipboard.writeText(text);
      const copyType = label === 'Version A' ? 'version_a' : label === 'Version B' ? 'version_b' : label === 'Lyrics structure' ? 'lyrics_structure' : label === 'Exclude styles' ? 'exclude_prompt' : 'prompt';
      track('prompt_builder_copy_result', { copy_type: copyType, format });
      setCopied(true); setMessage(tr('{item} copied.').replace('{item}', tr(label))); window.setTimeout(() => setCopied(false), 1800);
    }
    catch { setMessage(tr('Clipboard unavailable. Select the text and copy it instead.')); }
  };
  const insertTag = (tag: string) => setLyrics((current) => `${current}${current && !current.endsWith('\n') ? '\n' : ''}${tag}\n`);

  return <div className="pb-tool">
    <p className="pb-editor-intro">{tr('Start with the feeling or scene you want to create. Then shape the sound and compare a new direction against your first draft.')}</p>
    <section ref={editorRef} className="pb-editor-card" aria-label="Style prompt editor">
      <div className="pb-editor-toolbar"><div><strong>{tr('PROMPT EXPERIMENT')}</strong><span>{filled.length ? tr('Musical directions: {count}').replace('{count}', String(filled.length)) : tr('Start with an idea')}</span></div><div className="pb-editor-actions"><div className="pb-mode-switch" aria-label={tr('Prompt format')}><button type="button" className={format === 'compact' ? 'selected' : ''} onClick={() => { if (format !== 'compact') track('prompt_builder_format_changed', { format: 'compact' }); setFormat('compact'); }}>{tr('Structured')}</button><button type="button" className={format === 'detailed' ? 'selected' : ''} onClick={() => { if (format !== 'detailed') track('prompt_builder_format_changed', { format: 'detailed' }); setFormat('detailed'); }}>{tr('Narrative')}</button></div><button className="pb-clear" type="button" onClick={clear}>{tr('Clear')}</button><button className="pb-copy" type="button" onClick={() => copy(output)}>{copied ? tr('Copied') : tr('Copy draft')}</button></div></div>
      <div className="pb-intent-row"><label htmlFor="pb-intent">{tr('What should this song make someone feel or picture?')}</label><input id="pb-intent" value={intent} onChange={(e) => setIntent(e.target.value)} placeholder={tr('e.g. a late-night drive that slowly turns into a hopeful sunrise')} /></div>
      <div className="pb-draft-caption"><span>{tr('Editing')}</span><strong>{compareOpen ? (editingVersion === 'a' ? 'A · ' + tr('Baseline') : 'B · ' + tr('Try a variation')) : tr('First draft')}</strong></div><textarea className="pb-output" value={compareOpen && editingVersion === 'b' ? versionB : output} onChange={(e) => editingVersion === 'b' && compareOpen ? setVersionB(e.target.value) : setOutput(e.target.value)} placeholder={tr('Your first draft will take shape here as you add directions…')} aria-label="Style prompt" />
      <div className="pb-tabs" role="tablist" aria-label={tr('Prompt dimensions')}>{dimensionGroups.map((group) => <button ref={(node) => { tabRefs.current[group.id] = node; }} key={group.id} type="button" role="tab" aria-selected={active === group.id} className={active === group.id ? 'active' : ''} onClick={() => toggleDimension(group.id)}>{group.id !== 'arrangement' && <span className="pb-group-index">{group.id === 'identity' ? '01' : '02'}</span>}{tr(group.title)}<span className="pb-group-count">{group.dimensions.filter((id) => values[dimensions.findIndex((d) => d.id === id)].trim()).length}</span></button>)}</div>
      {currentGroup && <div className="pb-tab-content pb-group-popover" role="tabpanel" style={{ left: popoverPosition.left, '--pb-arrow-x': `${popoverPosition.arrow}px` } as CSSProperties}><div className="pb-tab-heading"><div><strong>{tr(currentGroup.title)}</strong><p>{tr(currentGroup.hint)}</p></div><span>{tr('Edit a few details')}</span></div><div className="pb-group-fields">{currentGroup.dimensions.map((id) => { const index = dimensions.findIndex((item) => item.id === id); const dimension = dimensions[index]; const expanded = showAll === id; return <section className="pb-group-field" key={id}><div className="pb-field-title"><strong>{tr(dimension.title)}</strong><span>{values[index].trim() ? tr('Added') : tr('Optional')}</span></div><input className="pb-direction-input" value={values[index]} onChange={(e) => updateValue(index, e.target.value)} placeholder={tr(dimension.placeholder)} aria-label={tr(dimension.title)} /><div className="pb-chips">{dimension.suggestions.slice(0, expanded ? undefined : 4).map((suggestion) => <button type="button" key={suggestion} onClick={() => addSuggestion(index, suggestion)} aria-pressed={values[index].toLowerCase().includes(suggestion.toLowerCase())}>{suggestion}</button>)}{dimension.suggestions.length > 4 && <button className="pb-more-options" type="button" aria-expanded={expanded} onClick={() => setShowAll(expanded ? '' : id)}>{expanded ? tr('Fewer ideas') : tr('More ideas')} <span aria-hidden="true">{expanded ? '−' : '+'}</span></button>}</div></section>; })}</div></div>}
    </section>
    <div className="pb-experiment-bar"><div><strong>{tr('Test one change')}</strong><span>{tr('Keep this draft as A, then change a direction in B.')}</span></div><button type="button" onClick={() => { if (!compareOpen) track('prompt_builder_compare_started', { source: 'editor' }); setVersionB(output || prompt); setCompareOpen(true); setEditingVersion('b'); }}>{compareOpen ? tr('Refresh version B') : tr('Compare a variation')} <span aria-hidden="true">↗</span></button></div>
    {compareOpen && <section className="pb-compare-grid" aria-label={tr('Prompt comparison')}><article className="pb-version-card"><div><span>A</span><strong>{tr('Baseline')}</strong><button type="button" onClick={() => setEditingVersion('a')}>{tr('Edit')}</button><button type="button" onClick={() => copy(output, 'Version A')}>{tr('Copy')}</button></div><textarea value={output} onChange={(e) => setOutput(e.target.value)} aria-label={tr('Version A')} /></article><article className="pb-version-card pb-version-b"><div><span>B</span><strong>{tr('Try a variation')}</strong><button type="button" onClick={() => setEditingVersion('b')}>{tr('Edit')}</button><button type="button" onClick={() => copy(versionB, 'Version B')}>{tr('Copy')}</button></div><textarea value={versionB} onChange={(e) => setVersionB(e.target.value)} aria-label={tr('Version B')} /><button className="pb-reset-version" type="button" onClick={() => { setVersionB(output); setEditingVersion('b'); }}>{tr('Reset B from A')}</button></article></section>}
    <p className="pb-feedback" aria-live="polite">{message || tr('Build a baseline, then compare one deliberate change at a time.')}</p>
    <details className="pb-optional pb-advanced"><summary>More ways to start <span>Presets · Import · Lyrics · Exclude</span></summary><div className="pb-advanced-grid"><section><h3>Style presets</h3><div className="pb-chips">{Object.keys(presets).map((name) => <button type="button" key={name} onClick={() => applyPreset(name)}>{name}</button>)}</div><label className="pb-advanced-label">Refine an existing style prompt<textarea value={imported} onChange={(e) => setImported(e.target.value)} rows={3} placeholder="Paste an existing style prompt…" /></label></section><section><h3>Lyrics structure</h3><p>Section tags belong in your Lyrics field in Suno.</p><div className="pb-chips">{lyricsTags.map((tag) => <button type="button" key={tag} onClick={() => insertTag(tag)}>{tag}</button>)}</div><textarea className="pb-lyrics-area" value={lyrics} onChange={(e) => setLyrics(e.target.value)} rows={3} placeholder="[Verse]&#10;&#10;[Chorus]" aria-label="Lyrics structure" /><button className="pb-secondary-action" type="button" onClick={() => copy(lyrics, 'Lyrics structure')}>Copy lyrics structure</button></section><section><h3>Exclude styles</h3><p>Describe sounds you want to avoid.</p><textarea className="pb-lyrics-area" value={exclude} onChange={(e) => setExclude(e.target.value)} rows={3} placeholder="e.g. heavy distortion, crowd noise" aria-label="Exclude styles" /><button className="pb-secondary-action" type="button" onClick={() => copy(exclude, 'Exclude styles')}>Copy exclude prompt</button></section></div></details>
    <section className="pb-reference">
      <h2>{tr('A useful prompt is easy to compare')}</h2>
      <p className="pb-workflow-intro">{tr('Start with the sound you want people to notice. Generate once, listen for what is missing, then change one direction before the next version.')}</p>
      <div className="pb-workflow-steps">
        <article><span>01</span><div><h3>{tr('Choose an anchor')}</h3><p>{tr('Name the style or feeling that should define the track. Keep secondary influences behind that main idea.')}</p></div></article>
        <article><span>02</span><div><h3>{tr('Describe audible details')}</h3><p>{tr('Say what an instrument or voice does in the arrangement. A role is more useful than a loose inventory of sounds.')}</p></div></article>
        <article><span>03</span><div><h3>{tr('Revise from what you hear')}</h3><p>{tr('Keep the directions that worked. Adjust one field at a time so the next generation teaches you something.')}</p></div></article>
      </div>
      <p className="pb-field-note"><strong>{tr('Keep the fields distinct')}:</strong> {tr('Use Style for the sound and performance. Put words and section labels in Lyrics.')}</p>
      <div className="pb-faq"><h2>FAQ</h2><details><summary>Why use separate musical fields?</summary><p>Separate fields make each decision easier to review and revise. You can leave any field empty.</p></details><details><summary>Why doesn’t Suno sound exactly like my words?</summary><p>Suno interprets prompts statistically. Concrete descriptions of sounds give it clearer direction, but each generation can vary.</p></details><details><summary>Can I use non-English in the fields?</summary><p>You can experiment with any language. Established genre and production terms may be easier to recognize in English.</p></details><details><summary>Compact or Detailed?</summary><p>Compact keeps each musical decision visible. Detailed turns the same choices into a natural-language Style brief.</p></details></div>
    </section>
  </div>;
}
