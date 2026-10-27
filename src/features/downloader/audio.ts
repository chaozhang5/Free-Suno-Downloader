export type AudioSamples = Pick<AudioBuffer, 'numberOfChannels' | 'length' | 'sampleRate' | 'getChannelData'>;

export async function decodeAudio(bytes: ArrayBuffer, nativeDecode?: (bytes: ArrayBuffer) => Promise<AudioSamples>): Promise<AudioSamples> {
  if (nativeDecode) {
    try {
      // decodeAudioData can detach its input, including when decoding fails.
      return await nativeDecode(bytes.slice(0));
    } catch { /* Older WebKit cannot decode Opus in MP4. Try the local decoder. */ }
  }
  const { decodeMp4Opus } = await import('./opus.ts');
  return decodeMp4Opus(bytes);
}

function pcm16(channel: Float32Array): Int16Array {
  const output = new Int16Array(channel.length);
  for (let index = 0; index < channel.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, channel[index]));
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

export function encodeWav(audioBuffer: AudioSamples): Blob {
  const channels = Math.min(audioBuffer.numberOfChannels, 2);
  const frames = audioBuffer.length;
  const dataSize = frames * channels * 2;
  if (!channels || !frames || dataSize > 120 * 1024 * 1024) {
    throw new Error('This audio is too large to convert in the browser.');
  }
  const bytes = new ArrayBuffer(44 + dataSize);
  const view = new DataView(bytes);
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeText(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, audioBuffer.sampleRate, true);
  view.setUint32(28, audioBuffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, dataSize, true);
  const channelData = Array.from({ length: channels }, (_, index) => audioBuffer.getChannelData(index));
  let offset = 44;
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([bytes], { type: 'audio/wav' });
}

export async function encodeMp3(audioBuffer: AudioSamples): Promise<Blob> {
  const lamejs = await import('@breezystack/lamejs');
  const channels = Math.min(audioBuffer.numberOfChannels, 2);
  if (!channels || !audioBuffer.length) throw new Error('The source audio is empty.');
  const encoder = new lamejs.Mp3Encoder(channels, audioBuffer.sampleRate, 192);
  const left = pcm16(audioBuffer.getChannelData(0));
  const right = channels === 2 ? pcm16(audioBuffer.getChannelData(1)) : undefined;
  const chunks: ArrayBuffer[] = [];
  for (let offset = 0; offset < left.length; offset += 1152) {
    const leftChunk = left.subarray(offset, Math.min(offset + 1152, left.length));
    const rightChunk = right?.subarray(offset, Math.min(offset + 1152, right.length));
    const encoded = channels === 2 ? encoder.encodeBuffer(leftChunk, rightChunk!) : encoder.encodeBuffer(leftChunk);
    if (encoded.length) chunks.push(new Uint8Array(encoded).buffer as ArrayBuffer);
  }
  const finalChunk = encoder.flush();
  if (finalChunk.length) chunks.push(new Uint8Array(finalChunk).buffer as ArrayBuffer);
  return new Blob(chunks, { type: 'audio/mpeg' });
}

export async function readAudioBytes(response: Response, maxBytes = 40 * 1024 * 1024): Promise<ArrayBuffer> {
  if (!response.ok || !response.body) throw new Error('The source audio could not be loaded.');
  const declared = Number(response.headers.get('content-length'));
  if (declared > maxBytes) throw new Error('This source audio is too large for browser conversion.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error('This source audio is too large for browser conversion.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}
