import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxParser, createFile } from 'mp4box';
import { decodeAudio, encodeMp3, encodeWav, readAudioBytes } from './audio.ts';

function opusSilence(channels = 2, duration = 960): ArrayBuffer {
  const file = createFile();
  const header = new BoxParser.box.dOps();
  Object.assign(header, {
    Version: 0, OutputChannelCount: channels, PreSkip: 312,
    InputSampleRate: 48000, OutputGain: 0, ChannelMappingFamily: 0,
  });
  const id = file.addTrack({
    type: 'Opus', timescale: 48000, samplerate: 48000, channel_count: channels,
    hdlr: 'soun', description_boxes: [header],
  });
  for (let index = 0; index < 6; index += 1) {
    // Standard Opus silence packet, 20 ms per packet.
    file.addSample(id, new Uint8Array([0xf8, 0xff, 0xfe]), {
      duration, dts: index * duration, cts: index * duration, is_sync: true,
    });
  }
  return file.getBuffer().buffer;
}

test('native decoding keeps its successful result', async () => {
  const expected = { numberOfChannels: 1, length: 1, sampleRate: 44100, getChannelData: () => new Float32Array(1) };
  assert.equal(await decodeAudio(new ArrayBuffer(1), async () => expected), expected);
});

test('MP4 Opus converts to WAV and MP3 after WebKit rejects and detaches the source', async () => {
  const bytes = opusSilence();
  const audio = await decodeAudio(bytes, async (input) => {
    structuredClone(input, { transfer: [input] });
    throw new Error('Decoding failed');
  });
  assert.ok(bytes.byteLength > 0);
  assert.equal(audio.numberOfChannels, 2);
  assert.equal(audio.sampleRate, 48000);
  assert.equal(audio.length, 6 * 960 - 312);
  assert.ok(audio.getChannelData(0).every((sample) => Math.abs(sample) < 0.001));
  assert.equal(encodeWav(audio).size, 44 + audio.length * 4);
  assert.ok((await encodeMp3(audio)).size > 100);
});

test('Opus fallback supports mono without a native audio context', async () => {
  const audio = await decodeAudio(opusSilence(1));
  assert.equal(audio.numberOfChannels, 1);
  assert.equal(audio.getChannelData(0).length, audio.length);
});

test('Opus fallback rejects unsupported input and limits decoded memory', async () => {
  await assert.rejects(decodeAudio(new ArrayBuffer(12)), /cannot decode audio/);
  await assert.rejects(decodeAudio(opusSilence(2, 48000 * 60)), /too large/);
});

test('WAV encoder writes stereo PCM samples', async () => {
  const blob = encodeWav({
    numberOfChannels: 2,
    length: 2,
    sampleRate: 44100,
    getChannelData(index: number) {
      return index === 0 ? new Float32Array([-1, 1]) : new Float32Array([0, 0.5]);
    },
  });
  const view = new DataView(await blob.arrayBuffer());
  assert.equal(String.fromCharCode(...new Uint8Array(view.buffer, 0, 4)), 'RIFF');
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(40, true), 8);
  assert.equal(view.getInt16(44, true), -32768);
  assert.equal(view.getInt16(48, true), 32767);
});

test('oversized source audio is rejected before decoding', async () => {
  const response = new Response(new Uint8Array(12), { headers: { 'content-type': 'audio/mpeg' } });
  await assert.rejects(readAudioBytes(response, 8), /too large/);
});

test('MP3 encoder returns an MPEG audio file', async () => {
  const samples = new Float32Array(4410);
  for (let index = 0; index < samples.length; index += 1) samples[index] = Math.sin(index / 10) * 0.25;
  const blob = await encodeMp3({
    numberOfChannels: 1,
    length: samples.length,
    sampleRate: 44100,
    getChannelData: () => samples,
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(blob.type, 'audio/mpeg');
  assert.ok(bytes.length > 100);
  assert.equal(bytes[0], 0xff);
  assert.equal(bytes[1] & 0xe0, 0xe0);
});

test('MP3 encoder handles stereo audio at 48 kHz', async () => {
  const sampleRate = 48000;
  const frames = sampleRate * 2;
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  for (let index = 0; index < frames; index += 1) {
    left[index] = Math.sin(index * 440 * 2 * Math.PI / sampleRate) * 0.2;
    right[index] = Math.sin(index * 660 * 2 * Math.PI / sampleRate) * 0.2;
  }
  const blob = await encodeMp3({
    numberOfChannels: 2,
    length: frames,
    sampleRate,
    getChannelData(channel) { return channel === 0 ? left : right; },
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(blob.type, 'audio/mpeg');
  assert.ok(bytes.length > 1000);
  assert.equal(bytes[0], 0xff);
  assert.equal(bytes[1] & 0xe0, 0xe0);
});
