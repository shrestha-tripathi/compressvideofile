/**
 * Shared media helpers — file-type guards, the picker `accept` strings, metadata
 * probing, and formatting. Used by BOTH /app (compress) and /trim (cut).
 *
 * Zero ffmpeg here — this is all browser-native. Keep it that way so the trim
 * tool can validate + preview a file before paying the ~25 MB wasm cost.
 */

export type MediaMode = "video" | "audio";

/**
 * Accepted extensions per mode. The picker's `accept` attribute is only a HINT —
 * these regexes are the real guard in ingest(). The audio list is broad on
 * purpose: ffmpeg decodes far more than the browser can preview, and we degrade
 * gracefully when a format can't be probed for duration.
 */
export const AUDIO_EXT = /\.(mp3|m4a|aac|wav|flac|ogg|oga|opus|wma|aiff?|alac|caf|amr|m4b)$/i;
export const VIDEO_EXT = /\.(mp4|mov|webm|mkv|avi|m4v|mpe?g|wmv|flv|3gp|ts|ogv)$/i;

/**
 * The `accept` attribute for a file input in the given mode.
 *
 * ⚠️ `audio/*` ALONE IS BROKEN ON WINDOWS. Chrome resolves it against the
 * registry's per-extension Content-Type, and many audio extensions (.flac,
 * .opus, .m4a, .oga, .aiff, .wma, .caf…) often have NO registry MIME → the
 * picker shows an EMPTY list. Pinning explicit extensions matches by name and
 * bypasses the registry entirely. This list MUST mirror AUDIO_EXT.
 *
 * ⚠️ Video stays BARE ("video/*") ON PURPOSE. Widening it can reopen the iOS
 * double-picker bug (commit e687278). Do not "fix" this for symmetry.
 */
export function acceptFor(mode: MediaMode): string {
  return mode === "video"
    ? "video/*"
    : "audio/*,.mp3,.m4a,.aac,.wav,.flac,.ogg,.oga,.opus,.wma,.aiff,.aif,.alac,.caf,.amr,.m4b";
}

/** Does this File look like the right kind of media for `mode`? */
export function isAcceptable(f: File, mode: MediaMode): boolean {
  return mode === "video"
    ? f.type.startsWith("video/") || VIDEO_EXT.test(f.name)
    : f.type.startsWith("audio/") || AUDIO_EXT.test(f.name);
}

export interface MediaMeta {
  /** Seconds. 0 when the browser couldn't probe it (ffmpeg can still process). */
  durationSec: number;
  width: number;
  height: number;
}

/**
 * Probe duration (and dimensions for video) with a throwaway media element — no
 * upload, no ffmpeg. A <video> element loads audio-only files fine and reports
 * duration (videoWidth/Height stay 0), so one probe path covers both modes.
 *
 * NEVER rejects: on error it resolves with zeros. ffmpeg can still handle
 * formats the browser can't preview (e.g. flac in some browsers) — an unknown
 * duration only degrades the estimate text, not the job itself.
 */
export function probeMedia(f: File): Promise<MediaMeta> {
  return new Promise((resolve) => {
    const probe = document.createElement("video");
    probe.preload = "metadata";
    const url = URL.createObjectURL(f);
    probe.onloadedmetadata = () => {
      const meta: MediaMeta = {
        durationSec: probe.duration || 0,
        width: probe.videoWidth || 0,
        height: probe.videoHeight || 0,
      };
      URL.revokeObjectURL(url);
      resolve(meta);
    };
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ durationSec: 0, width: 0, height: 0 });
    };
    probe.src = url;
  });
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function fmtDuration(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Format seconds as a timecode for the trim inputs. Uses h:mm:ss.s past an hour,
 * m:ss.s below — matching what a user sees in a normal player, plus one decimal
 * so sub-second playhead marks survive a round-trip through the input.
 */
export function formatTimecode(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const ss = s.toFixed(1).padStart(4, "0");
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${ss}`
    : `${m}:${ss}`;
}

/**
 * Parse a user-typed timecode into seconds. Deliberately forgiving — people type
 * these by hand under time pressure:
 *   "90" / "90s"     → 90
 *   "1:30" / "1:30.5"→ 90 / 90.5
 *   "0:01:30"        → 90
 *   "1.30" (typo)    → treated as 1.3s, NOT 1:30 — ambiguous, so we trust the dot
 * Returns null when it can't be parsed at all (caller shows a validation error).
 */
export function parseTimecode(raw: string): number | null {
  const t = raw.trim().replace(/s$/i, "");
  if (!t) return null;
  const parts = t.split(":");
  if (parts.length > 3) return null;
  let total = 0;
  for (const p of parts) {
    if (!/^\d*\.?\d*$/.test(p) || p === "" || p === ".") return null;
    const n = Number(p);
    if (!isFinite(n)) return null;
    total = total * 60 + n;
  }
  return total;
}

/** Strip the extension so we can build "{stem}-trimmed.mp4" style filenames. */
export const fileStem = (name: string, fallback: string): string =>
  (name || fallback).replace(/\.[a-z0-9]+$/i, "");

/** Lowercase extension WITHOUT the dot, or "" if there isn't one. */
export const fileExt = (name: string): string =>
  (name.match(/\.([a-z0-9]+)$/i)?.[1] ?? "").toLowerCase();
