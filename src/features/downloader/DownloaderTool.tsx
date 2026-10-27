import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { decodeAudio, encodeMp3, encodeWav } from './audio';
import { decryptSunoAudio } from './suno-audio';
import type { SunoRights } from './suno-audio';
import type { DownloadAsset, SongResult } from './types';
import { createZip } from './zip';
import { tr, currentLanguage } from '../../i18n';
import { track } from '../../analytics/posthog';

const example = 'https://suno.com/s/WIz33BYjyEeTR9bz';
const apiOrigin = (import.meta.env.VITE_API_ORIGIN
  || (import.meta.env.DEV ? 'https://suno-dl-backend-dev.flyworks.ai' : '')).replace(/\/+$/, '');
type Kind = DownloadAsset['type'] | 'lyrics';
type AudioFormat = 'original' | 'wav' | 'mp3';
type DownloadProgress = { message: string; percent: number | null };
const labels: Record<Kind, string> = { audio: 'Audio', video: 'Video', image: 'Cover art', lyrics: 'Lyrics' };
const maxDownloadBytes = 250_000_000;
const audioFormatStorageKey = 'suno-tools:audio-format';

function getSavedAudioFormat(): AudioFormat {
  if (typeof window === 'undefined') return 'original';
  try {
    const saved = window.localStorage.getItem(audioFormatStorageKey);
    return saved === 'wav' || saved === 'mp3' ? saved : 'original';
  } catch {
    return 'original';
  }
}

function apiUrl(url: string): string {
  return apiOrigin && url.startsWith('/api/') ? apiOrigin + url : url;
}

function ResultIcon({ kind }: { kind: Kind | 'archive' }) {
  const shape = {
    audio: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
    video: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m10 9 5 3-5 3V9Z" fill="currentColor" stroke="none" /></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m4 17 5-5 4 4 3-3 4 4" /></>,
    lyrics: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></>,
    archive: <><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v11h14V9M10 13h4" /></>,
  }[kind];
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shape}</svg>;
}

function FactIcon({ kind }: { kind: 'clock' | 'calendar' | 'play' | 'heart' }) {
  const shape = {
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18" /></>,
    play: <path d="m8 5 11 7-11 7V5Z" />,
    heart: <path d="M20.8 9c0 4.4-8.8 10-8.8 10S3.2 13.4 3.2 9a4.5 4.5 0 0 1 8.8-1.1A4.5 4.5 0 0 1 20.8 9Z" />,
  }[kind];
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shape}</svg>;
}

function validSunoUrl(value: string): boolean {
  let url: URL;
  try { url = new URL(value.trim()); } catch { return false; }
  return url.protocol === 'https:' && ['suno.com', 'www.suno.com', 'app.suno.ai'].includes(url.hostname.toLowerCase())
    && !url.username && !url.password && /^\/(s|song|hook)\/[^/]+\/?$/i.test(url.pathname);
}
function sunoLinkKind(value: string): 'song' | 'share' | 'hook' | 'other' {
  try {
    const path = new URL(value.trim()).pathname.toLowerCase();
    if (path.startsWith('/s/')) return 'share';
    if (path.startsWith('/song/')) return 'song';
    if (path.startsWith('/hook/')) return 'hook';
  } catch { /* Invalid input is reported as an unclassified URL. */ }
  return 'other';
}
function lookupFailureCategory(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/HTTP 404/.test(message)) return 'not_found';
  if (/HTTP 5\d\d/.test(message)) return 'upstream_error';
  if (error instanceof TypeError) return 'network_or_cors_error';
  return 'lookup_failed';
}
function filename(title: string, extension: string): string {
  const base = title.normalize('NFKD').replace(/[^a-z0-9 _-]/gi, '').trim().replace(/\s+/g, '-').slice(0, 70) || 'suno-song';
  return `${base}.${extension}`;
}
function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
function downloadUrl(url: string, name: string) {
  const link = document.createElement('a');
  link.href = apiUrl(url);
  link.download = name;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
}
function nextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}
async function readDownload(response: Response, onProgress: (ratio: number | null) => void, maxBytes = maxDownloadBytes): Promise<Blob> {
  if (!response.ok || !response.body) throw new Error('The file could not be downloaded.');
  const declared = Number(response.headers.get('content-length'));
  if (declared > maxBytes) throw new Error('This file is too large to download in the browser.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  onProgress(declared > 0 ? 0 : null);
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new Error('This file is too large to download in the browser.');
    }
    chunks.push(value);
    onProgress(declared > 0 ? Math.min(1, received / declared) : null);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  onProgress(1);
  return new Blob([bytes.buffer], { type: response.headers.get('content-type') || 'application/octet-stream' });
}
async function convertAudioAsset(url: string, format: 'wav' | 'mp3', onProgress: (ratio: number | null) => void): Promise<Blob> {
  const response = await fetch(apiUrl(url));
  const source = await readDownload(response, onProgress, 40 * 1024 * 1024);
  const bytes = await source.arrayBuffer();
  const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const context = AudioContextConstructor ? new AudioContextConstructor() : null;
  try {
    const audio = await decodeAudio(bytes, context ? (input) => context.decodeAudioData(input) : undefined);
    return format === 'wav' ? encodeWav(audio) : await encodeMp3(audio);
  } finally {
    await context?.close().catch(() => {});
  }
}
function formatDuration(seconds?: number | null): string | null {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}
function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(currentLanguage(), { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
async function fetchJson<T>(url: string, signal: AbortSignal, options?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(url), { ...options, headers: { Accept: 'application/json', ...options?.headers }, signal });
  const data = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok) {
    const fallback = url.startsWith('/api/song-details') && response.status === 404
      ? 'Song details endpoint is unavailable. Restart the backend.'
      : `${tr('Request failed.')} (HTTP ${response.status})`;
    throw new Error(tr(data?.error || fallback));
  }
  if (!data) throw new Error(tr('The server returned an invalid song response.'));
  return data;
}

export function DownloaderTool() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [audioFormat, setAudioFormat] = useState<AudioFormat>(getSavedAudioFormat);
  const [audioMenuOpen, setAudioMenuOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messageState, setMessageState] = useState<'error' | 'success' | ''>('');
  const [song, setSong] = useState<SongResult | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const localAudioRef = useRef<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const audioMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    requestRef.current?.abort();
    if (localAudioRef.current) URL.revokeObjectURL(localAudioRef.current);
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem(audioFormatStorageKey, audioFormat); } catch { /* Storage may be unavailable. */ }
  }, [audioFormat]);
  useEffect(() => {
    if (!audioMenuOpen) return;
    function closeMenu(event: MouseEvent) {
      if (!audioMenuRef.current?.contains(event.target as Node)) setAudioMenuOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setAudioMenuOpen(false);
    }
    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [audioMenuOpen]);
  useEffect(() => { if (song) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [song]);

  async function loadSong(value: string, trigger: 'submit' | 'example' = 'submit') {
    if (requestRef.current) return;
    const startedAt = performance.now();
    const inputKind = sunoLinkKind(value);
    track('downloader_lookup_submitted', { input_kind: inputKind, trigger });
    if (localAudioRef.current) { URL.revokeObjectURL(localAudioRef.current); localAudioRef.current = null; }
    setSong(null);
    setDownloadStatus('');
    setDownloadError('');
    setAudioMenuOpen(false);
    if (!validSunoUrl(value)) {
      track('downloader_lookup_completed', {
        input_kind: inputKind, outcome: 'failure', duration_ms: Math.round(performance.now() - startedAt),
        failure_category: 'invalid_url', available_asset_types: [], has_lyrics: false,
      });
      setMessage(tr('Paste a complete HTTPS Suno song or Hook link.'));
      setMessageState('error');
      inputRef.current?.focus();
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setMessage(tr('Loading song details from Suno…'));
    setMessageState('');
    try {
      let page: SongResult | null = null;
      let detailsUnavailable = false;
      let detailsError = '';
      const path = new URL(value).pathname;
      if (/^\/(s|song)\//i.test(path)) {
        try { page = await fetchJson<SongResult>('/api/song-details?url=' + encodeURIComponent(value), controller.signal); }
        catch (error) {
          if (controller.signal.aborted) throw error;
          detailsUnavailable = true;
          detailsError = error instanceof Error ? tr(error.message) : tr('Song details request failed.');
        }
      }
      if (!page) {
        try { page = await fetchJson<SongResult>('/api/resolve?url=' + encodeURIComponent(value), controller.signal); }
        catch (error) { if (!/^\/s\//i.test(path)) throw error; }
      }
      let data: SongResult;
      let audioError = '';
      const audioAsset = page?.assets.find((asset) => asset.type === 'audio');
      const shareLink = /^\/s\//i.test(path);
      const encryptedAudio = audioAsset?.encrypted === true
        || (audioAsset?.encrypted == null && audioAsset?.extension === 'm4a' && Boolean(page?.contentId));
      if ((shareLink && !audioAsset) || encryptedAudio) {
        let contentId = page?.contentId || path.match(/^\/song\/([0-9a-f-]{36})\/?$/i)?.[1];
        if (!contentId && shareLink) {
          setMessage(tr('Resolving the Suno share link…'));
          const share = await fetchJson<{ content_id: string }>('/api/share-code?url=' + encodeURIComponent(value), controller.signal);
          contentId = share.content_id;
        }
        if (!contentId) {
          if (page) data = page;
          else throw new Error(tr('The song could not be loaded.'));
        } else {
          setMessage(tr('Preparing audio in your browser…'));
          try {
            const rights = await fetchJson<SunoRights>('/api/rights', controller.signal, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content_params: { content_id: contentId, content_type: 'clip' } }),
            });
            const audio = await decryptSunoAudio(contentId, rights, {
              signal: controller.signal,
              onProgress(received, total) { if (total) setMessage(`${tr('Preparing audio in your browser…')} ${Math.min(100, Math.round(received / total * 100))}%`); },
            });
            controller.signal.throwIfAborted();
            const objectUrl = URL.createObjectURL(audio.blob);
            localAudioRef.current = objectUrl;
            data = {
              ...(page || { title: 'Suno song', image: null, sourceUrl: value, assets: [] }), sourceUrl: value,
              assets: [{ type: 'audio', extension: audio.extension, previewUrl: objectUrl,
                downloadUrl: objectUrl, filename: filename(page?.title || 'suno-song', audio.extension) },
              ...(page?.assets || []).filter((asset) => asset.type !== 'audio')],
            };
          } catch (error) {
            if (controller.signal.aborted) throw error;
            audioError = error instanceof Error ? tr(error.message) : tr('Audio is unavailable.');
            if (!page) throw error;
            data = { ...page, assets: page.assets.filter((asset) => asset.type !== 'audio') };
          }
        }
      } else {
        if (!page) throw new Error(tr('The song could not be loaded.'));
        data = page;
      }
      controller.signal.throwIfAborted();
      setSong(data);
      const missingDetails = detailsUnavailable && !data.lyrics && data.duration == null;
      track('downloader_lookup_completed', {
        input_kind: inputKind,
        outcome: audioError || missingDetails ? 'partial' : 'success',
        duration_ms: Math.round(performance.now() - startedAt),
        available_asset_types: data.assets.map((asset) => asset.type),
        has_lyrics: Boolean(data.lyrics?.trim()),
        ...((audioError || missingDetails) ? { failure_category: audioError ? 'audio_unavailable' : 'partial_details' } : {}),
      });
      setMessage(audioError || (missingDetails ? `${detailsError} ${tr('Showing available files only.')}` : tr('Song loaded. Choose a file below.')));
      setMessageState(audioError || missingDetails ? 'error' : 'success');
    } catch (error) {
      if (controller.signal.aborted) return;
      track('downloader_lookup_completed', {
        input_kind: inputKind,
        outcome: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        available_asset_types: [],
        has_lyrics: false,
        failure_category: lookupFailureCategory(error),
      });
      setMessage(error instanceof Error ? tr(error.message) : tr('The song could not be loaded. Try again.'));
      setMessageState('error');
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      setBusy(false);
    }
  }

  async function download(kind: Kind) {
    if (!song || downloadBusy) return;
    const asset = song.assets.find((item) => item.type === kind);
    if (kind !== 'lyrics' && !asset) return;
    const format = kind === 'lyrics' ? 'TXT' : kind === 'audio' && audioFormat !== 'original' ? audioFormat.toUpperCase() : asset!.extension.toUpperCase();
    const startedAt = performance.now();
    track('downloader_download_started', { asset_type: kind, format: format.toLowerCase(), download_mode: 'single' });
    const progressMessage = `${tr(labels[kind])} · ${format}`;
    setDownloadBusy(true);
    setDownloadError('');
    setDownloadStatus(tr('Preparing download…'));
    setDownloadProgress({ message: progressMessage, percent: 0 });
    try {
      await nextPaint();
      if (kind === 'lyrics') {
        saveBlob(new Blob([song.lyrics || ''], { type: 'text/plain;charset=utf-8' }), filename(song.title, 'txt'));
        setDownloadProgress({ message: tr('Download started.'), percent: 100 });
      } else if (asset && kind === 'audio' && audioFormat !== 'original') {
        const converted = await convertAudioAsset(asset.previewUrl, audioFormat, (ratio) => setDownloadProgress({
          message: progressMessage, percent: ratio == null ? null : Math.round(ratio * 70),
        }));
        setDownloadProgress({ message: progressMessage, percent: 95 });
        saveBlob(converted, filename(song.title, audioFormat));
      } else if (asset) {
        downloadUrl(asset.downloadUrl, asset.filename || filename(song.title, asset.extension));
        setDownloadProgress({ message: tr('Download started.'), percent: 100 });
      }
      setDownloadStatus(tr('Download started.'));
      setDownloadProgress({ message: tr('Download started.'), percent: 100 });
      track('downloader_download_result', { asset_type: kind, format: format.toLowerCase(), outcome: 'triggered', duration_ms: Math.round(performance.now() - startedAt) });
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    } catch (error) {
      const errorMessage = error instanceof Error ? tr(error.message) : tr('The file could not be downloaded.');
      setDownloadStatus(errorMessage);
      setDownloadError(errorMessage);
      track('downloader_download_result', { asset_type: kind, format: format.toLowerCase(), outcome: 'failure', duration_ms: Math.round(performance.now() - startedAt), failure_category: 'conversion_or_download_error' });
    } finally {
      setDownloadProgress(null);
      setDownloadBusy(false);
    }
  }

  async function downloadAll() {
    if (!song || downloadBusy) return;
    const startedAt = performance.now();
    const format = audioFormat === 'original' ? 'zip' : `zip_${audioFormat}`;
    track('downloader_download_started', { asset_type: 'zip', format, download_mode: 'all' });
    setDownloadBusy(true);
    setDownloadError('');
    setDownloadStatus(tr('Packaging available files…'));
    setDownloadProgress({ message: tr('Packaging available files…'), percent: 0 });
    try {
      await nextPaint();
      const files: { name: string; bytes: Uint8Array }[] = [];
      const includesLyrics = Boolean(song.lyrics?.trim());
      const totalItems = song.assets.length + Number(includesLyrics);
      for (const [index, asset] of song.assets.entries()) {
        const outputExtension = asset.type === 'audio' && audioFormat !== 'original' ? audioFormat : asset.extension;
        const status = tr('Adding {item} to ZIP…').replace('{item}', tr(labels[asset.type]));
        setDownloadStatus(status);
        setDownloadProgress({ message: status, percent: Math.round(index / totalItems * 90) });
        let blob;
        if (asset.type === 'audio' && audioFormat !== 'original') {
          blob = await convertAudioAsset(asset.previewUrl, audioFormat, (ratio) => setDownloadProgress({
            message: status,
            percent: ratio == null ? null : Math.round((index + ratio * 0.8) / totalItems * 90),
          }));
        } else {
          const response = await fetch(apiUrl(asset.downloadUrl));
          try {
            blob = await readDownload(response, (ratio) => setDownloadProgress({
              message: status,
              percent: ratio == null ? null : Math.round((index + ratio) / totalItems * 90),
            }));
          } catch {
            throw new Error(tr('Could not load {item} for the ZIP.').replace('{item}', tr(labels[asset.type])));
          }
        }
        files.push({ name: filename(song.title, outputExtension), bytes: new Uint8Array(await blob.arrayBuffer()) });
      }
      if (includesLyrics) {
        setDownloadProgress({ message: tr('Adding {item} to ZIP…').replace('{item}', tr('Lyrics')), percent: 90 });
        files.push({ name: filename(song.title, 'txt'), bytes: new TextEncoder().encode(song.lyrics!) });
      }
      setDownloadProgress({ message: tr('Packaging available files…'), percent: 95 });
      saveBlob(createZip(files), filename(song.title, 'zip'));
      setDownloadStatus(tr('ZIP download started.'));
      setDownloadProgress({ message: tr('ZIP download started.'), percent: 100 });
      track('downloader_download_result', { asset_type: 'zip', format, outcome: 'triggered', duration_ms: Math.round(performance.now() - startedAt), file_count: files.length });
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    } catch (error) {
      const errorMessage = error instanceof Error ? tr(error.message) : tr('The ZIP could not be created.');
      setDownloadStatus(errorMessage);
      setDownloadError(errorMessage);
      track('downloader_download_result', { asset_type: 'zip', format, outcome: 'failure', duration_ms: Math.round(performance.now() - startedAt), failure_category: 'zip_or_download_error' });
    } finally {
      setDownloadProgress(null);
      setDownloadBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void loadSong(url.trim()); }
  const assets = new Map(song?.assets.map((asset) => [asset.type, asset]));
  const summaryParts = song?.description?.split(/;\s*/).map((part) => part.trim()).filter(Boolean) || [];
  const kinds: Kind[] = ['audio', 'video', 'image', 'lyrics'];
  return <>
    <form className="url-form" onSubmit={submit} noValidate>
      <label className="sr-only" htmlFor="suno-url">Public Suno song or Hook URL</label>
      <textarea ref={inputRef} id="suno-url" name="url" rows={3} inputMode="url" autoComplete="url" spellCheck={false} placeholder="Paste a suno.com/song or suno.com/s link..." value={url} onChange={(event) => setUrl(event.target.value)} required />
      <button type="submit" disabled={busy}>{busy ? tr('Loading song…') : <><span aria-hidden="true">→</span> Download options</>}</button>
    </form>
    {messageState === 'error' && <p className="form-message error" role="alert">{message}</p>}
    <div className="example"><span>Example:</span><code>{example}</code><button type="button" disabled={busy} onClick={() => { setUrl(example); void loadSong(example, 'example'); }}>Try it</button></div>
    <p className="under-note">Works with accessible Suno share, song, and Hook links.</p>
    {song && <section className="result" ref={resultRef} aria-label="Song download options">
      <div className="result-head">
        {song.image ? <img src={song.image} alt={tr('Cover art for {title}').replace('{title}', song.title)} /> : <div className="result-cover-placeholder"><ResultIcon kind="image" /></div>}
        <div className="result-copy">
          <div className="result-topline"><a href={song.sourceUrl} target="_blank" rel="noopener noreferrer">↗ View on Suno</a></div>
          <h2>{song.title || 'Suno song'}</h2>
          {song.artist && <p className="result-artist">by <strong>{song.artist}</strong></p>}
          <div className="result-facts">
            {formatDuration(song.duration) && <span><FactIcon kind="clock" />{formatDuration(song.duration)}</span>}
            {formatDate(song.createdAt) && <span><FactIcon kind="calendar" />{formatDate(song.createdAt)}</span>}
            {song.playCount != null && <span><FactIcon kind="play" />{song.playCount.toLocaleString(currentLanguage())}</span>}
            {song.likeCount != null && <span><FactIcon kind="heart" />{song.likeCount.toLocaleString(currentLanguage())}</span>}
            {song.model && <span>{song.model}</span>}
          </div>
        </div>
        {summaryParts.length > 0 && <div className="result-prompts">{summaryParts.map((part, index) => <span key={index}>{part}</span>)}</div>}
      </div>
      <div className="download-heading">DOWNLOAD</div>
      <div className="result-options">{kinds.map((kind) => {
        const asset = assets.get(kind as DownloadAsset['type']);
        const available = kind === 'lyrics' ? !!song.lyrics?.trim() : !!asset;
        const detail = available ? kind === 'lyrics' ? 'TXT' : kind === 'audio' && audioFormat !== 'original' ? audioFormat.toUpperCase() : asset!.extension.toUpperCase() : tr('{item} unavailable').replace('{item}', tr(labels[kind]));
        return <div className={'download-tile' + (available ? '' : ' unavailable')} key={kind}>
          <span className={'download-icon ' + kind}><ResultIcon kind={kind} /></span>
          <span className="download-tile-copy"><strong>{tr(labels[kind])}</strong><small>{detail}</small></span>
          {available && <button type="button" className="download-tile-button" aria-label={tr('Download {item}').replace('{item}', tr(labels[kind]))} disabled={downloadBusy} onClick={() => void download(kind)}>↓</button>}
          {kind === 'audio' && available && <div className={'audio-format' + (audioMenuOpen ? ' open' : '')} ref={audioMenuRef}>
            <button type="button" className="audio-format-trigger" aria-haspopup="listbox" aria-expanded={audioMenuOpen} onClick={() => setAudioMenuOpen((open) => !open)}>
              <span>{audioFormat === 'original' ? `${tr('Original')} ${asset!.extension.toUpperCase()}` : tr(audioFormat === 'wav' ? 'Convert to WAV' : 'Convert to MP3')}</span><span className="audio-format-chevron" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="m2.5 4.25 3.5 3.5 3.5-3.5" /></svg></span>
            </button>
            {audioMenuOpen && <div className="audio-format-menu" role="listbox" aria-label="Audio format">
              {([['original', `${tr('Original')} ${asset!.extension.toUpperCase()}`], ['wav', tr('Convert to WAV')], ['mp3', tr('Convert to MP3')]] as const).map(([value, label]) => <button type="button" role="option" aria-selected={audioFormat === value} className={audioFormat === value ? 'selected' : ''} key={value} onClick={() => { if (audioFormat !== value) track('downloader_audio_format_selected', { format: value }); setAudioFormat(value); setAudioMenuOpen(false); }}><span className="format-check" aria-hidden="true">{audioFormat === value ? '✓' : ''}</span>{label}</button>)}
            </div>}
          </div>}
        </div>;
      })}</div>
      <button type="button" className="download-all" disabled={downloadBusy || !song.assets.length && !song.lyrics?.trim()} onClick={() => void downloadAll()}><ResultIcon kind="archive" /> Download all (.zip)</button>
      {downloadError && <p className="form-message error" role="alert">{downloadError}</p>}
      <span className="sr-only" role="status" aria-live="polite">{downloadStatus}</span>
    </section>}
    {busy && createPortal(<div className="loading-overlay" role="dialog" aria-modal="true" aria-labelledby="loading-title" aria-describedby="loading-message">
      <div className="loading-dialog">
        <div className="loading-orbit" aria-hidden="true"><span /><span /></div>
        <p className="loading-eyebrow">SUNO DOWNLOAD</p>
        <h2 id="loading-title">Preparing your song</h2>
        <p id="loading-message">{message || 'Loading song details from Suno…'}</p>
        <div className="loading-track" aria-hidden="true"><span /></div>
        <p className="loading-note">This may take a few moments</p>
      </div>
    </div>, document.body)}
    {downloadBusy && downloadProgress && createPortal(<div className="loading-overlay" role="dialog" aria-modal="true" aria-labelledby="download-loading-title" aria-describedby="download-loading-message">
      <div className="loading-dialog download-loading-dialog">
        <div className="loading-orbit" aria-hidden="true"><span /><span /></div>
        <p className="loading-eyebrow">SUNO DOWNLOAD</p>
        <h2 id="download-loading-title">Preparing download…</h2>
        <p id="download-loading-message">{downloadProgress.message}</p>
        <div className={'download-progress-track' + (downloadProgress.percent == null ? ' indeterminate' : '')}
          role="progressbar" aria-label={downloadProgress.message} aria-valuemin={0} aria-valuemax={100}
          {...(downloadProgress.percent == null ? {} : { 'aria-valuenow': downloadProgress.percent })}>
          <span style={downloadProgress.percent == null ? undefined : { width: `${downloadProgress.percent}%` }} />
        </div>
        <p className="download-progress-value">{downloadProgress.percent == null ? '…' : `${downloadProgress.percent}%`}</p>
      </div>
    </div>, document.body)}
  </>;
}
