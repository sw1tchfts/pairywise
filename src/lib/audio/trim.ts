let _ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  return getContext();
}

function getContext(): AudioContext {
  if (!_ctx) {
    const Ctor =
      typeof window !== 'undefined'
        ? window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext
        : null;
    if (!Ctor) throw new Error('Web Audio API is not available in this environment.');
    _ctx = new Ctor();
  }
  return _ctx;
}

export async function decodeAudioFile(file: Blob): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const ctx = getContext();
  return await ctx.decodeAudioData(arrayBuffer.slice(0));
}

/** Compute per-bucket peak amplitudes (0..1) across all channels for waveform rendering. */
export function computePeaks(buffer: AudioBuffer, bucketCount: number): Float32Array {
  const peaks = new Float32Array(bucketCount);
  const frames = buffer.length;
  if (frames === 0 || bucketCount === 0) return peaks;
  const channels = buffer.numberOfChannels;
  const samplesPerBucket = Math.max(1, Math.floor(frames / bucketCount));
  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < bucketCount; i++) {
      const start = i * samplesPerBucket;
      const end = Math.min(start + samplesPerBucket, frames);
      let max = 0;
      for (let j = start; j < end; j++) {
        const v = Math.abs(data[j]);
        if (v > max) max = v;
      }
      if (max > peaks[i]) peaks[i] = max;
    }
  }
  return peaks;
}

/** Encode a time range of an AudioBuffer as a 16-bit PCM WAV Blob. */
export function encodeWav(
  buffer: AudioBuffer,
  startSec: number,
  endSec: number,
): Blob {
  const sampleRate = buffer.sampleRate;
  const channels = Math.min(2, buffer.numberOfChannels);
  const startFrame = Math.max(0, Math.floor(startSec * sampleRate));
  const endFrame = Math.min(buffer.length, Math.floor(endSec * sampleRate));
  const frames = Math.max(0, endFrame - startFrame);

  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = frames * blockAlign;
  const bufferSize = 44 + dataSize;
  const ab = new ArrayBuffer(bufferSize);
  const view = new DataView(ab);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < channels; ch++) channelData.push(buffer.getChannelData(ch));

  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let ch = 0; ch < channels; ch++) {
      const sample = channelData[ch][startFrame + i] ?? 0;
      const clamped = Math.max(-1, Math.min(1, sample));
      const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      view.setInt16(offset, int16 | 0, true);
      offset += 2;
    }
  }

  return new Blob([ab], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
}
