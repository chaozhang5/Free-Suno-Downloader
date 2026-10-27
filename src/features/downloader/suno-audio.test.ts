import test from 'node:test';
import assert from 'node:assert/strict';
import { decryptSunoAudio } from './suno-audio.ts';

test('unwraps Suno rights and decrypts uneven AES-CTR stream chunks', async () => {
  const id = '92c641b1-1686-40bb-90de-1b02844dbd6b';
  const glt = 'fixture-guest-token';
  const additionalData = new TextEncoder().encode(id);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(glt));
  const userKey = await crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt']);
  const rawKey = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
  const iv = Uint8Array.from({ length: 16 }, (_, index) => index + 4);
  async function wrap(raw: Uint8Array<ArrayBuffer>, nonceSeed: number) {
    const nonce = new Uint8Array(12).fill(nonceSeed);
    const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData }, userKey, raw));
    return Buffer.concat([nonce, encrypted]).toString('base64');
  }
  const rights = { key: await wrap(rawKey, 7), iv: await wrap(iv, 9), glt };
  const contentKey = await crypto.subtle.importKey('raw', rawKey, 'AES-CTR', false, ['encrypt']);
  const clear = new Uint8Array(111);
  clear.set([0, 0, 0, 28, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  for (let index = 12; index < clear.length; index += 1) clear[index] = index;
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CTR', counter: iv, length: 128 }, contentKey, clear));
  const sizes = [3, 14, 1, 23, 8, 62];
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let offset = 0;
      for (const size of sizes) {
        controller.enqueue(encrypted.slice(offset, offset + size));
        offset += size;
      }
      controller.close();
    },
  });
  const fetcher: typeof fetch = async (input) => {
    assert.equal(input, `https://d2lwuy8qc234o3.cloudfront.net/1/clip/${id}.m4a`);
    return new Response(stream, { headers: { 'content-length': String(encrypted.length) } });
  };
  const result = await decryptSunoAudio(id, rights, { fetcher });
  assert.equal(result.extension, 'm4a');
  assert.equal(result.blob.type, 'audio/mp4');
  assert.deepEqual(new Uint8Array(await result.blob.arrayBuffer()), clear);
});
