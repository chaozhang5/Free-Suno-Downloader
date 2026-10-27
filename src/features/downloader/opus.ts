import { BoxParser, createFile } from 'mp4box';
import type { Sample, Track } from 'mp4box';
import { OpusDecoder } from 'opus-decoder';
import type { AudioSamples } from './audio.ts';

const sampleRate = 48000;
const maxPcmBytes = 120 * 1024 * 1024;

// Loaded only after native decoding fails. No server upload or audio playback is needed.
export async function decodeMp4Opus(bytes: ArrayBuffer): Promise<AudioSamples> {
  const file = createFile(true);
  let track: Track | undefined;
  let parseError = false;
  const samples: Sample[] = [];
  file.onError = () => { parseError = true; };
  file.onReady = (info) => {
    track = info.audioTracks.find((item) => item.codec.toLowerCase() === 'opus');
    if (track) {
      file.setExtractionOptions(track.id, undefined, { nbSamples: 100 });
      file.start();
    }
  };
  file.onSamples = (_id, _user, batch) => { samples.push(...batch); };
  file.appendBuffer(Object.assign(bytes, { fileStart: 0 }));
  file.flush();
  file.stop();
  if (parseError || !track || !samples.length || samples.some((sample) => !sample.data)) {
    throw new Error('This browser cannot decode audio.');
  }
  const description = samples[0].description;
  const header = 'boxes' in description ? description.boxes?.find((box) => box instanceof BoxParser.box.dOps) : undefined;
  if (!(header instanceof BoxParser.box.dOps) || header.OutputChannelCount < 1 || header.OutputChannelCount > 2
    || header.ChannelMappingFamily !== 0) {
    throw new Error('This browser cannot decode audio.');
  }
  const channels = header.OutputChannelCount;
  // Honor the Opus encoder delay, MP4 edit start, and final packet padding.
  const edit = track.edits?.find((item) => item.media_time >= 0);
  const skip = Math.max(header.PreSkip, edit ? Math.round(edit.media_time / track.timescale * sampleRate) : 0);
  const packetFrames = Math.round(samples.reduce((total, sample) => total + sample.duration / sample.timescale * sampleRate, 0));
  const presentationFrames = edit ? Math.round(edit.segment_duration / track.movie_timescale * sampleRate) : packetFrames - skip;
  const length = Math.min(packetFrames - skip, presentationFrames);
  if (!Number.isSafeInteger(length) || length <= 0 || length * channels * 4 > maxPcmBytes) {
    throw new Error('This audio is too large to convert in the browser.');
  }
  const output = Array.from({ length: channels }, () => new Float32Array(length));
  const gain = Math.pow(10, header.OutputGain / (20 * 256));
  const decoder = new OpusDecoder({ channels, preSkip: skip });
  let written = 0;
  try {
    await decoder.ready;
    for (let index = 0; index < samples.length; index += 1) {
      const decoded = decoder.decodeFrame(samples[index].data!);
      if (decoded.errors.length) throw new Error('This browser cannot decode audio.');
      const count = Math.min(decoded.samplesDecoded, length - written);
      for (let channel = 0; channel < channels; channel += 1) {
        const source = decoded.channelData[channel];
        for (let frame = 0; frame < count; frame += 1) output[channel][written + frame] = source[frame] * gain;
      }
      written += count;
      file.releaseUsedSamples(track.id, samples[index].number + 1);
      if (index % 100 === 99) await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    if (written !== length) throw new Error('This browser cannot decode audio.');
    return { numberOfChannels: channels, length, sampleRate, getChannelData: (channel) => output[channel] };
  } finally {
    decoder.free();
  }
}
