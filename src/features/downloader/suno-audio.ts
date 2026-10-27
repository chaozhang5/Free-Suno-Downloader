const AUDIO_BASE = 'https://d2lwuy8qc234o3.cloudfront.net/1/clip/';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AUDIO_BYTES = 120 * 1024 * 1024;
const BLOCK_BYTES = 16;

export type SunoRights = { key: string; iv: string; glt: string };
export type DecryptedAudio = { blob: Blob; extension: 'm4a' | 'mp3' | 'webm' };

type Options = {
  signal?: AbortSignal;
  onProgress?: (received: number, total: number | null) => void;
  fetcher?: typeof fetch;
};

function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new Error('Suno returned invalid audio rights data.');
  }
}

async function unwrap(value: string, id: string, userKey: CryptoKey): Promise<Uint8Array<ArrayBuffer>> {
  const wrapped = decodeBase64(value);
  if (wrapped.byteLength < 28) throw new Error('Suno returned incomplete audio rights data.');
  try {
    const raw = await crypto.subtle.decrypt({
      name: 'AES-GCM',
      iv: wrapped.slice(0, 12),
      additionalData: new TextEncoder().encode(id),
    }, userKey, wrapped.slice(12));
    return new Uint8Array(raw);
  } catch {
    throw new Error('Suno audio rights could not be opened.');
  }
}

function counterAt(iv: Uint8Array, blockOffset: bigint): Uint8Array<ArrayBuffer> {
  let value = 0n;
  for (const byte of iv) value = (value << 8n) | BigInt(byte);
  value = (value + blockOffset) & ((1n << 128n) - 1n);
  const counter = new Uint8Array(BLOCK_BYTES);
  for (let index = BLOCK_BYTES - 1; index >= 0; index -= 1) {
    counter[index] = Number(value & 255n);
    value >>= 8n;
  }
  return counter;
}

function audioType(bytes: Uint8Array): Pick<DecryptedAudio, 'extension'> & { mime: string } {
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return { mime: 'audio/webm', extension: 'webm' };
  }
  if ((bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33)
    || (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) {
    return { mime: 'audio/mpeg', extension: 'mp3' };
  }
  if (bytes.length >= 8 && String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp') {
    return { mime: 'audio/mp4', extension: 'm4a' };
  }
  throw new Error('The decrypted file is not a supported audio format.');
}

export async function decryptSunoAudio(contentId: string, rights: SunoRights, options: Options = {}): Promise<DecryptedAudio> {
  const id = contentId.toLowerCase();
  if (!UUID.test(id)) throw new Error('Suno returned an invalid song ID.');
  if (!globalThis.crypto?.subtle) throw new Error('This browser cannot decrypt Suno audio.');
  if (!rights || !['key', 'iv', 'glt'].every((name) => typeof rights[name as keyof SunoRights] === 'string'
    && rights[name as keyof SunoRights].length > 0)) {
    throw new Error('Suno returned incomplete audio rights data.');
  }
  options.signal?.throwIfAborted();

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rights.glt));
  const userKey = await crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['decrypt']);
  const rawKey = await unwrap(rights.key, id, userKey);
  const iv = await unwrap(rights.iv, id, userKey);
  if (iv.length !== BLOCK_BYTES) throw new Error('Suno returned an invalid audio IV.');
  const contentKey = await crypto.subtle.importKey('raw', rawKey, 'AES-CTR', false, ['decrypt']);
  options.signal?.throwIfAborted();

  const response = await (options.fetcher || fetch)(AUDIO_BASE + encodeURIComponent(id) + '.m4a', {
    signal: options.signal,
    cache: 'no-store',
  });
  if (!response.ok || !response.body) throw new Error('The encrypted Suno audio is unavailable.');
  const declared = Number(response.headers.get('content-length')) || null;
  if (declared && declared > MAX_AUDIO_BYTES) {
    await response.body.cancel();
    throw new Error('This audio is too large to process in the browser.');
  }

  const reader = response.body.getReader();
  const chunks: ArrayBuffer[] = [];
  let pending = new Uint8Array(0);
  let received = 0;
  let blockOffset = 0n;
  let complete = false;
  try {
    while (true) {
      options.signal?.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_AUDIO_BYTES) throw new Error('This audio is too large to process in the browser.');
      const merged = new Uint8Array(pending.length + value.length);
      merged.set(pending);
      merged.set(value, pending.length);
      const fullLength = Math.floor(merged.length / BLOCK_BYTES) * BLOCK_BYTES;
      if (fullLength) {
        try {
          chunks.push(await crypto.subtle.decrypt({
            name: 'AES-CTR', counter: counterAt(iv, blockOffset), length: 128,
          }, contentKey, merged.slice(0, fullLength)));
        } catch {
          throw new Error('The Suno audio could not be decrypted.');
        }
        blockOffset += BigInt(fullLength / BLOCK_BYTES);
      }
      pending = merged.slice(fullLength);
      options.onProgress?.(received, declared);
    }
    if (pending.length) {
      try {
        chunks.push(await crypto.subtle.decrypt({
          name: 'AES-CTR', counter: counterAt(iv, blockOffset), length: 128,
        }, contentKey, pending));
      } catch {
        throw new Error('The Suno audio could not be decrypted.');
      }
    }
    complete = true;
  } finally {
    if (!complete) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  if (!chunks.length) throw new Error('Suno returned an empty audio file.');
  const type = audioType(new Uint8Array(chunks[0]));
  return { blob: new Blob(chunks, { type: type.mime }), extension: type.extension };
}
