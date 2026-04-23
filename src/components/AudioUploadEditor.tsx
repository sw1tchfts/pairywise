'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  computePeaks,
  decodeAudioFile,
  encodeWav,
  getAudioContext,
} from '@/lib/audio/trim';
import { uploadAudioClip } from '@/lib/cloud/storage';

type Props = {
  /** Existing URL to show when nothing is being edited locally. */
  value?: string;
  /** Called with the final public URL after upload, or empty string when cleared. */
  onChange: (url: string) => void;
};

const WAVEFORM_BUCKETS = 240;

export function AudioUploadEditor({ value, onChange }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const stopTimerRef = useRef<number | null>(null);

  const duration = buffer?.duration ?? 0;

  async function handleFile(f: File) {
    setError(null);
    setLoading(true);
    try {
      const decoded = await decodeAudioFile(f);
      const next = computePeaks(decoded, WAVEFORM_BUCKETS);
      setFile(f);
      setBuffer(decoded);
      setPeaks(next);
      setStartSec(0);
      setEndSec(decoded.duration);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not decode audio file.');
      setFile(null);
      setBuffer(null);
      setPeaks(null);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    stopPreview();
    setFile(null);
    setBuffer(null);
    setPeaks(null);
    setStartSec(0);
    setEndSec(0);
    setError(null);
  }

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks) return;
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    if (canvas.width !== cssWidth * dpr) canvas.width = cssWidth * dpr;
    if (canvas.height !== cssHeight * dpr) canvas.height = cssHeight * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const mid = cssHeight / 2;
    const selStartX =
      duration > 0 ? (startSec / duration) * cssWidth : 0;
    const selEndX = duration > 0 ? (endSec / duration) * cssWidth : cssWidth;

    ctx.fillStyle = 'rgba(127,127,127,0.18)';
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    ctx.fillStyle = 'rgba(59,130,246,0.18)';
    ctx.fillRect(selStartX, 0, Math.max(0, selEndX - selStartX), cssHeight);

    const bucketW = cssWidth / peaks.length;
    for (let i = 0; i < peaks.length; i++) {
      const x = i * bucketW;
      const h = peaks[i] * (cssHeight * 0.9);
      const inside = x + bucketW >= selStartX && x <= selEndX;
      ctx.fillStyle = inside ? 'rgb(37,99,235)' : 'rgba(127,127,127,0.55)';
      ctx.fillRect(x, mid - h / 2, Math.max(1, bucketW - 0.5), h);
    }
  }, [peaks, duration, startSec, endSec]);

  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  useEffect(() => {
    if (!peaks) return;
    const onResize = () => drawWaveform();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [peaks, drawWaveform]);

  function secondsFromClientX(clientX: number): number {
    const track = trackRef.current;
    if (!track || duration === 0) return 0;
    const rect = track.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return frac * duration;
  }

  function beginDrag(handle: 'start' | 'end', e: React.PointerEvent) {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const move = (ev: PointerEvent) => {
      const t = secondsFromClientX(ev.clientX);
      if (handle === 'start') {
        setStartSec(Math.min(t, endSec - 0.05));
      } else {
        setEndSec(Math.max(t, startSec + 0.05));
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function stopPreview() {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {
        // already stopped
      }
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (stopTimerRef.current != null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }

  function playPreview() {
    if (!buffer) return;
    stopPreview();
    const audioCtx = getAudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    const length = Math.max(0.05, endSec - startSec);
    source.start(0, startSec, length);
    sourceRef.current = source;
    stopTimerRef.current = window.setTimeout(() => {
      stopPreview();
    }, length * 1000 + 50);
  }

  useEffect(() => () => stopPreview(), []);

  async function handleUpload() {
    if (!buffer) return;
    setError(null);
    setUploading(true);
    try {
      const blob = encodeWav(buffer, startSec, endSec);
      const url = await uploadAudioClip(blob, { extension: 'wav' });
      onChange(url);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  const selectionDuration = useMemo(
    () => Math.max(0, endSec - startSec),
    [startSec, endSec],
  );

  const startPct = duration > 0 ? (startSec / duration) * 100 : 0;
  const endPct = duration > 0 ? (endSec / duration) * 100 : 100;

  return (
    <div className="space-y-2">
      {value && !buffer && (
        <div className="flex items-center gap-2">
          <audio
            src={value}
            controls
            preload="metadata"
            className="w-full"
          />
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-xs text-foreground/60 hover:text-foreground"
          >
            Remove
          </button>
        </div>
      )}

      {!buffer && (
        <label className="flex items-center gap-2 text-xs">
          <span className="px-2 py-1 rounded border border-foreground/20 hover:bg-foreground/5 cursor-pointer">
            {value ? 'Replace with upload…' : 'Upload audio file…'}
          </span>
          <input
            type="file"
            accept="audio/*"
            className="sr-only"
            disabled={loading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />
          {loading && <span className="text-foreground/60">Decoding…</span>}
        </label>
      )}

      {buffer && peaks && (
        <div className="space-y-2">
          <div
            ref={trackRef}
            className="relative h-16 rounded-md bg-foreground/5 overflow-hidden select-none"
          >
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
            />
            <Handle side="start" percent={startPct} onPointerDown={(e) => beginDrag('start', e)} />
            <Handle side="end" percent={endPct} onPointerDown={(e) => beginDrag('end', e)} />
          </div>

          <div className="flex items-center justify-between text-[11px] text-foreground/70">
            <span>
              {formatTime(startSec)} – {formatTime(endSec)}
            </span>
            <span>
              selection: {formatTime(selectionDuration)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={playPreview}
              className="text-xs px-2 py-1 rounded border border-foreground/20 hover:bg-foreground/5"
            >
              Preview
            </button>
            <button
              type="button"
              onClick={stopPreview}
              className="text-xs px-2 py-1 rounded border border-foreground/20 hover:bg-foreground/5"
            >
              Stop
            </button>
            <button
              type="button"
              onClick={reset}
              className="text-xs px-2 py-1 rounded hover:bg-foreground/5 text-foreground/70"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || selectionDuration <= 0}
              className="text-xs px-2 py-1 rounded bg-foreground text-background font-medium disabled:opacity-40 ml-auto"
            >
              {uploading ? 'Uploading…' : 'Save clip'}
            </button>
          </div>

          {file && (
            <p className="text-[11px] text-foreground/50 truncate">
              Source: {file.name}
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function Handle({
  side,
  percent,
  onPointerDown,
}: {
  side: 'start' | 'end';
  percent: number;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      role="slider"
      aria-label={side === 'start' ? 'Trim start' : 'Trim end'}
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      onPointerDown={onPointerDown}
      className="absolute top-0 bottom-0 w-3 -translate-x-1/2 cursor-ew-resize touch-none"
      style={{ left: `${percent}%` }}
    >
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] bg-blue-600" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-6 rounded-sm bg-blue-600 shadow" />
    </div>
  );
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}
