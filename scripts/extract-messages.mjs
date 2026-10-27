import { readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { manifest } from './route-data.mjs';

const files = [
  'src/components/SiteHeader.tsx', 'src/components/SiteFooter.tsx',
  'src/pages/DownloaderPage.tsx', 'src/pages/ArticlesPage.tsx',
  'src/pages/ArticlePage.tsx', 'src/pages/AboutPage.tsx',
  'src/pages/ToolsPage.tsx', 'src/pages/ToolInfoPage.tsx',
  'src/pages/PromptBuilderPage.tsx',
  'src/features/downloader/DownloaderTool.tsx',
  'src/features/downloader/audio.ts', 'src/features/downloader/suno-audio.ts',
  'src/features/downloader/zip.ts', '../backend/server.js',
  'src/features/prompt-builder/PromptBuilder.tsx',
];
const messages = new Set();
const add = (value) => {
  const normalized = value.replaceAll('&amp;', '&').replaceAll('&apos;', "'").replace(/\s+/g, ' ').trim();
  if (!/^\{\w+\}$/.test(normalized) && /[A-Za-z]{2}/.test(normalized) && normalized.length >= 2 && !/^[-\d\W]+$/.test(normalized)) messages.add(normalized);
};
const toolsCatalog = JSON.parse(await readFile(new URL('../src/content/tools.json', import.meta.url), 'utf8'));
for (const tool of [...toolsCatalog.available, ...toolsCatalog.additional]) {
  add(tool.name);
  add(tool.category);
  add(tool.description ?? tool.summary);
  if (tool.purpose) add(tool.purpose);
  if (tool.bestFor) add(tool.bestFor);
  for (const value of [...(tool.highlights ?? []), ...(tool.workflow ?? [])]) add(value);
}
for (const file of files) {
  const source = ts.createSourceFile(file, await readFile(new URL(`../${file}`, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (node) => {
    // Literal alternatives in JSX attributes (e.g. the mobile menu label).
    if (ts.isJsxAttribute(node) && node.initializer && ts.isJsxExpression(node.initializer)
      && ['aria-label', 'placeholder', 'alt', 'title'].includes(node.name.text)) {
      const collect = (part) => { if (ts.isStringLiteral(part)) add(part.text); ts.forEachChild(part, collect); };
      collect(node.initializer);
    }
    if (ts.isPropertyAssignment(node) && node.name.getText(source) === 'links' && ts.isArrayLiteralExpression(node.initializer)) {
      for (const item of node.initializer.elements) {
        if (ts.isArrayLiteralExpression(item) && item.elements[1] && ts.isStringLiteral(item.elements[1])) add(item.elements[1].text);
      }
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && ['Error', 'ApiError'].includes(node.expression.text)) {
      const message = node.arguments?.[node.expression.text === 'ApiError' ? 1 : 0];
      if (message && ts.isStringLiteral(message)) add(message.text);
    }
    if (ts.isJsxText(node)) add(node.text);
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'tr'
      && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) add(node.arguments[0].text);
    if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)
      && ['aria-label', 'placeholder', 'alt', 'title'].includes(node.name.text)) add(node.initializer.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
}
for (const route of manifest.routes) { if (route.seoTitle) add(route.seoTitle); if (route.seoDescription) add(route.seoDescription); }
const builder = ts.createSourceFile('builder.tsx', await readFile(new URL('../src/features/prompt-builder/PromptBuilder.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const collectSuggestions = (node) => {
  if (ts.isPropertyAssignment(node) && node.name.getText(builder) === 'suggestions' && ts.isArrayLiteralExpression(node.initializer)) {
    for (const item of node.initializer.elements) if (ts.isStringLiteral(item)) add(item.text);
  }
  ts.forEachChild(node, collectSuggestions);
};
collectSuggestions(builder);
for (const page of Object.values(manifest.pages)) { add(page.title); add(page.description); }
for (const value of [
  'Language: {language}', 'Dreamy Indie Pop', 'Cinematic Ballad', 'Alt Rock',
  'Downloads', 'Lyrics', 'Cover art', 'Prompts', 'Tutorials', 'Rights', 'guides', 'Browse all', 'articles',
  'Download a song', 'Download as MP3', 'Get a WAV file', 'Download a video', 'Save cover art', 'Download as ZIP',
  'Save lyrics', 'Structure tags', 'Lyrics timestamps', 'Write a prompt', 'Prompt examples', 'Custom mode',
  'Share, song, and Hook links', 'Download not working', 'Organize song files', 'Commercial use', 'Use on YouTube', 'Download credits',
  'Songs & assets', 'Prompts & styles', 'Video & analysis', 'Audio, video & cover art', 'Download several songs',
  'Save a public playlist', 'Browse creator releases', 'Build focused music prompts', 'Refine style instructions',
  'Remove unwanted traits', 'Explore prompt directions', 'Compare two lyric drafts', 'Organize song sections',
  'Clean inconsistent tags', 'Estimate lyric timing', 'Create a lyric video', 'Inspect public song data',
  'Review creator activity', 'Audio', 'Video', 'Suno Song Downloader', 'Batch Downloader', 'Playlist Downloader',
  'Creator Downloader', 'Prompt Builder', 'Style Cleaner', 'Exclude Styles', 'Style Library', 'Lyrics Compare',
  'Structure Tags', 'Tag Normalizer', 'Duration Estimator', 'Lyrics MV Studio', 'Song Info Viewer', 'Creator Analytics',
  'Paste a complete HTTPS Suno song or Hook link.', 'Loading song details from Suno…',
  'Resolving the Suno share link…', 'Preparing audio in your browser…', 'Song loaded. Choose a file below.',
  'Preparing download…', 'Download started.', 'Packaging available files…', 'ZIP download started.',
  'The ZIP could not be created.', 'The file could not be downloaded.', 'The song could not be loaded. Try again.',
  'The song could not be loaded.', 'Audio is unavailable.', 'Song details request failed.',
  'The server returned an invalid song response.', 'This browser cannot decode audio.',
  'Song details endpoint is unavailable. Restart the backend.', 'Showing available files only.',
  'Download', 'Original', 'Original audio', 'Convert to WAV', 'unavailable', 'by', 'Suno song',
  'Read', 'View on Suno', 'Adding', 'to ZIP', 'Could not load', 'for the ZIP.',
  'Paste a valid Suno song or Hook URL.', 'Only public Suno song and Hook HTTPS links are supported.',
  'The share page redirected outside Suno.', 'Suno returned an unexpected page.',
  'Suno did not return a song page.', 'The source redirected to an unsupported address.',
  'The source returned an invalid redirect.', 'The source redirected too many times.',
  'The public page is too large to inspect.', 'Invalid download link.',
  'This download link has expired. Load the song again.',
  'This file is no longer available at its source.', 'This file is too large for the download service.',
  'The source did not return a media file.', 'Method not allowed.', 'Request failed.',
  'Invalid Suno song URL.', 'Request body is too large.', 'Send a valid JSON request body.',
  'Could not reach the Suno API. Check the server network or proxy settings.',
  'This Suno share code was not found.', 'Suno is limiting requests. Try again later.',
  'Suno did not provide the requested data.', 'Suno returned an unexpected response.',
  'Suno returned invalid JSON.', 'Paste a Suno /s/ share link.',
  'Suno did not return a valid content ID.', 'Send JSON with Content-Type: application/json.',
  'content_params must contain a valid content_id and content_type "clip".',
  'Suno did not return complete audio rights data.', 'Paste a Suno share or song link.',
  'Could not resolve this Suno share link.', 'Suno did not provide full song details. Please try again.',
  'Suno could not load this public song right now.',
  'This audio is too large to convert in the browser.', 'The source audio could not be loaded.',
  'This source audio is too large for browser conversion.', 'Suno returned invalid audio rights data.',
  'Suno returned incomplete audio rights data.', 'Suno audio rights could not be opened.',
  'The decrypted file is not a supported audio format.', 'Suno returned an invalid song ID.',
  'This browser cannot decrypt Suno audio.', 'Suno returned an invalid audio IV.',
  'The encrypted Suno audio is unavailable.', 'This audio is too large to process in the browser.',
  'The Suno audio could not be decrypted.', 'Suno returned an empty audio file.',
  'There are no files to package.', 'A file is too large for ZIP.', 'The ZIP is too large.',
  // Additional shared UI copy used by route data and the prompt builder.
  "1–2 genres; 1–3 instruments; 1–3 mood and energy traits; one vocal direction; 1–3 production traits; and only the tempo, song arc, or melody details that matter.",
  "AVAILABLE TOOL",
  "Add a direction for the pulse or rhythmic feel.",
  "Add a direction to your prompt first.",
  "Add key, chord language or melodic direction when it matters.",
  "Added to prompt",
  "Audio & WAV",
  "Available files",
  "Available formats",
  "Be specific:",
  "Build a prompt you can revise",
  "Check the media exposed by one accessible public song, share, or Hook link when you have permission to use it.",
  "Choose 1–3 specific phrases that describe the arrangement.",
  "Choose one clear musical lane first. A second style can act as an influence.",
  "Clear",
  "Clipboard unavailable. Select the text and copy it instead.",
  "Combine lineup, delivery and harmonies where useful.",
  "Compact",
  "Convert to MP3",
  "Copied",
  "Copy",
  "Current tool",
  "Describe how the arrangement opens, builds, peaks or resolves.",
  "Describe recording character, space, width or dynamics.",
  "Detailed",
  "Download a video only when Suno publishes a video URL for that specific song.",
  "Download what you own or can use.",
  "For listening and editing",
  "Free Suno Prompt Builder",
  "Genre",
  "Genre & Style",
  "Instruments",
  "Instruments & texture",
  "Keep fields focused:",
  "Keep section tags in the lyrics box, separate from Style.",
  "Key details",
  "Lyrics & tags:",
  "MORE GUIDES",
  "Melody & Harmony",
  "Mood & Energy",
  "More focused utilities are on the way.",
  "More tools coming soon",
  "One direction added",
  "One link",
  "Optional",
  "Pair emotional color with intensity.",
  "Paste a public song or Hook URL.",
  "Prefer phrases like “delicate piano arpeggios” or “warm string quartet” over lone nouns.",
  "Preset loaded.",
  "Priority:",
  "Production & Effects",
  "Prompt",
  "Prompt cleared.",
  "Prompt dimensions",
  "Prompt format",
  "Put your most important direction first. Use a second genre as an influence.",
  "Reference layout for a structured draft",
  "SOON",
  "STYLE PROMPT",
  "Save the image shown with the public song. Image size and type depend on the source.",
  "Save the original published audio, or convert a playable source to a local 16-bit PCM WAV. Conversion cannot improve source quality.",
  "Save your way",
  "See only media found on its public page.",
  "Shape a focused Suno Style prompt across eight musical dimensions. Fill only the directions you want to hear.",
  "Share link audio is prepared locally. Video and cover options depend on files available from the song page.",
  "Show",
  "Show fewer suggestions",
  "Song Arc",
  "Start with a genre, then add only the traits you want to hear. Your choices stay in this browser tab.",
  "Suggested first draft:",
  "Suno Downloader",
  "Suno official site ↗",
  "Supported links",
  "TOOLBOX",
  "Tempo & Groove",
  "Tools for your Suno workflow",
  "Use Mood for emotional color, Vocal for delivery, and Production for recording character.",
  "Vocal",
  "Waiting for a direction",
  "copied.",
  "directions added",
  "e.g. breathy falsetto, layered harmonies",
  "e.g. delicate piano arpeggios, warm string quartet",
  "e.g. intimate cinematic pop, chamber pop",
  "e.g. minor key, suspended chords",
  "e.g. nostalgic, intimate, restrained",
  "e.g. slow mid-tempo pulse, syncopated groove",
  "e.g. sparse opening, gradual build",
  "e.g. warm analog production, natural room reverb",
  "more suggestions",
  // Prompt builder copy keyed through tr() calls.
  "A useful prompt is easy to compare",
  "Add production character and details that make the song move.",
  "Added",
  "Arrangement & finish",
  "Baseline",
  "Build a baseline, then compare one deliberate change at a time.",
  "Check Suno’s current guidance",
  "Choose an anchor",
  "Choose original audio for a direct copy, MP3 for compatibility, or WAV for editing. MP3 and WAV are created in your browser from playable audio.",
  "Compare a variation",
  "Copy draft",
  "Describe audible details",
  "Each conversion uses the available source audio.",
  "Edit",
  "Edit a few details",
  "Editing",
  "Fewer ideas",
  "First draft",
  "Give the track a clear musical center.",
  "Keep the directions that worked. Adjust one field at a time so the next generation teaches you something.",
  "Keep the fields distinct",
  "Keep this draft as A, then change a direction in B.",
  "MP3, WAV & original audio",
  "More ideas",
  "Name the style or feeling that should define the track. Keep secondary influences behind that main idea.",
  "Narrative",
  "Open Prompt Builder",
  "PROMPT EXPERIMENT",
  "Performance & feel",
  "Prompt comparison",
  "Refresh version B",
  "Reset B from A",
  "Revise from what you hear",
  "Say what an instrument or voice does in the arrangement. A role is more useful than a loose inventory of sounds.",
  "Shape the emotion, vocal delivery, and rhythmic movement.",
  "Sound identity",
  "Start with an idea",
  "Start with the feeling or scene you want to create. Then shape the sound and compare a new direction against your first draft.",
  "Start with the sound you want people to notice. Generate once, listen for what is missing, then change one direction before the next version.",
  "Structured",
  "Test one change",
  "Try a variation",
  "Usage terms and account options can change. Review Suno’s current source before acting.",
  "Use Style for the sound and performance. Put words and section labels in Lyrics.",
  "Version A",
  "Version B",
  "What should this song make someone feel or picture?",
  "Your first draft will take shape here as you add directions…",
  "e.g. a late-night drive that slowly turns into a hopeful sunrise",
  "musical directions",
]) add(value);
await writeFile(new URL('../src/i18n/messages.en.json', import.meta.url), JSON.stringify(Object.fromEntries([...messages].sort().map((message) => [message, message])), null, 2) + '\n');
console.log(`Extracted ${messages.size} English UI messages.`);
