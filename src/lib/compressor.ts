/**
 * Compress Video File — /app controller: 100% client-side video + audio
 * compression via ffmpeg.wasm, with optional trimming.
 *
 * The user's file NEVER uploads. All the ffmpeg core pins, the ESM-vs-UMD trap
 * and the multi-threaded-core crash are owned by `ffmpeg-engine.ts` — do NOT
 * re-add them here. File-type guards, picker `accept` strings and metadata
 * probing live in `media-file.ts` and are shared with /trim.
 *
 * TWO MODES (one engine, one wasm):
 *  - VIDEO: target a SIZE (MB); bitrate is derived from size/duration; libx264.
 *  - AUDIO: target a BITRATE (kbps) directly; libmp3lame (MP3) or aac (M4A).
 * The audio path is strictly lighter than video (no libx264), so it's the more
 * robust of the two on low-memory mobile. The same 0.12.9 wasm ships
 * libmp3lame + aac, so audio needs ZERO new deps and ZERO new wasm.
 *
 * TRIM (optional, both modes): -ss before -i (instant input seek) + -t duration.
 * Trimming changes the EFFECTIVE duration, which the bitrate math depends on —
 * see effectiveDuration() and its callers.
 */
import { ensureFfmpeg, terminateFfmpeg, runJob } from "./ffmpeg-engine";
import {
  type MediaMode,
  acceptFor,
  isAcceptable,
  probeMedia,
  fmtBytes,
  fmtDuration,
  formatTimecode,
  parseTimecode,
  fileStem,
} from "./media-file";

interface PresetDef {
  id: string;
  label: string;
  sub: string;
  targetMB: number;
}
const PRESETS: PresetDef[] = [
  { id: "wa", label: "WhatsApp", sub: "16 MB", targetMB: 16 },
  { id: "wahd", label: "WhatsApp HD", sub: "64 MB doc", targetMB: 64 },
  { id: "email", label: "Email", sub: "25 MB", targetMB: 25 },
  { id: "discord", label: "Discord", sub: "25 MB", targetMB: 25 },
  { id: "nitro", label: "Discord Nitro", sub: "500 MB", targetMB: 500 },
];

// Audio targets a BITRATE directly (the audio-native mental model — "128k MP3"
// is universal), so output size is predictable and we sidestep the size-target
// inversion weirdness ("compress this 3 MB song to 25 MB" → already compressed).
interface AudioPresetDef {
  id: string;
  label: string;
  sub: string;
  kbps: number;
}
const AUDIO_PRESETS: AudioPresetDef[] = [
  { id: "320", label: "Max", sub: "320 kbps", kbps: 320 },
  { id: "256", label: "High", sub: "256 kbps", kbps: 256 },
  { id: "192", label: "Great", sub: "192 kbps", kbps: 192 },
  { id: "128", label: "Standard", sub: "128 kbps", kbps: 128 },
  { id: "96", label: "Small", sub: "96 kbps", kbps: 96 },
  { id: "64", label: "Voice", sub: "64 kbps", kbps: 64 },
];

type AudioFmt = "mp3" | "m4a";

const $ = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
  document.getElementById(id) as T | null;


export function initCompressor(): void {
  const dropzone = $("cvf-dropzone");
  const fileInput = $<HTMLInputElement>("cvf-file");
  const pickBtn = $("cvf-pick");

  // mode tabs + the bits of copy that swap with the mode
  const tabVideo = $("cvf-tab-video");
  const tabAudio = $("cvf-tab-audio");
  const appTitle = $("cvf-app-title");
  const appSub = $("cvf-app-sub");
  const dzTitle = $("cvf-dz-title");
  const dzFormats = $("cvf-dz-formats");
  const pickLabel = $("cvf-pick-label");

  const setupPanel = $("cvf-setup");
  const setupVideo = $("cvf-setup-video");
  const setupAudio = $("cvf-setup-audio");
  const origMeta = $("cvf-orig-meta");
  const origName = $("cvf-orig-name");
  const presetWrap = $("cvf-presets");
  const audioPresetWrap = $("cvf-presets-audio");
  const customRange = $<HTMLInputElement>("cvf-custom");
  const customVal = $("cvf-custom-val");
  const resSelect = $<HTMLSelectElement>("cvf-res");
  const fmtSelect = $<HTMLSelectElement>("cvf-fmt");
  const estimateEl = $("cvf-estimate");
  const compressBtn = $("cvf-compress");
  const warnEl = $("cvf-warn");

  // trim controls
  const trimDetails = $<HTMLDetailsElement>("cvf-trim");
  const trimPreviewVideo = $<HTMLVideoElement>("cvf-trim-video");
  const trimPreviewAudio = $<HTMLAudioElement>("cvf-trim-audio");
  const trimStartInput = $<HTMLInputElement>("cvf-trim-start");
  const trimEndInput = $<HTMLInputElement>("cvf-trim-end");
  const trimSetStart = $("cvf-trim-set-start");
  const trimSetEnd = $("cvf-trim-set-end");
  const trimReset = $("cvf-trim-reset");
  const trimInfo = $("cvf-trim-info");
  const trimError = $("cvf-trim-error");

  const workPanel = $("cvf-working");
  const progressFill = $("cvf-progress");
  const progressPct = $("cvf-progress-pct");
  const workStatus = $("cvf-work-status");
  const cancelBtn = $("cvf-cancel");

  const resultPanel = $("cvf-result");
  const resultVideo = $<HTMLVideoElement>("cvf-result-video");
  const resultAudio = $<HTMLAudioElement>("cvf-result-audio");
  const reduceEl = $("cvf-reduce");
  const resultHint = $("cvf-result-hint");
  const sizeBeforeEl = $("cvf-size-before");
  const sizeAfterEl = $("cvf-size-after");
  const downloadBtn = $<HTMLAnchorElement>("cvf-download");
  const againBtn = $("cvf-again");

  if (!dropzone || !fileInput) return; // not the /app page

  // ---- state ----
  let mode: MediaMode = "video";
  let file: File | null = null;
  let durationSec = 0;
  let vidW = 0;
  let vidH = 0;
  let targetMB = 25; // video target
  let audioKbps = 128; // audio target
  let audioFmt: AudioFmt = "mp3";
  let resultUrl: string | null = null;
  let cancelled = false;
  // ---- trim state (null/null = no trim) ----
  let trimStart: number | null = null;
  let trimEnd: number | null = null;
  let previewUrl: string | null = null;

  const show = (el: HTMLElement | null) => el?.classList.remove("hidden");
  const hide = (el: HTMLElement | null) => el?.classList.add("hidden");

  // ---- progress plumbing (engine owns the ffmpeg lifecycle) ----
  function onProgress(pct: number): void {
    if (cancelled) return;
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressPct) progressPct.textContent = `${pct}%`;
    progressFill?.classList.remove("is-indeterminate");
  }

  // ---- ingest a chosen file ----
  async function ingest(f: File): Promise<void> {
    if (!isAcceptable(f, mode)) {
      alert(
        mode === "video"
          ? "Please choose a video file (mp4, mov, webm, mkv, avi)."
          : "Please choose an audio file (mp3, m4a, wav, flac, ogg, opus).",
      );
      return;
    }
    file = f;
    cancelled = false;
    clearTrim();
    if (origName) origName.textContent = f.name;

    hide($("cvf-intro"));
    show(setupPanel);
    // Show only the controls for the active mode.
    if (mode === "video") {
      show(setupVideo);
      hide(setupAudio);
    } else {
      hide(setupVideo);
      show(setupAudio);
    }
    hide(resultPanel);
    hide(workPanel);

    // Source preview for the trim panel — created up front so "use playhead"
    // works the moment the user expands it. Revoked in reset().
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(f);
    const player = mode === "video" ? trimPreviewVideo : trimPreviewAudio;
    const other = mode === "video" ? trimPreviewAudio : trimPreviewVideo;
    other?.removeAttribute("src");
    hide(other);
    show(player);
    if (player) player.src = previewUrl;

    // Probe metadata (browser-native, no ffmpeg, no upload).
    const meta = await probeMedia(f);
    durationSec = meta.durationSec;
    vidW = meta.width;
    vidH = meta.height;
    if (origMeta) {
      if (!durationSec) {
        origMeta.textContent = `${fmtBytes(f.size)} · (metadata unavailable)`;
      } else {
        const dims = mode === "video" && vidW && vidH ? `${vidW}×${vidH} · ` : "";
        origMeta.textContent = `${fmtBytes(f.size)} · ${dims}${fmtDuration(durationSec)}`;
      }
    }
    // Seed the trim inputs with the full range so the fields are never blank.
    if (durationSec) {
      if (trimStartInput) trimStartInput.value = formatTimecode(0);
      if (trimEndInput) trimEndInput.value = formatTimecode(durationSec);
    }
    updateTrimInfo();
    updateEstimate();
  }

  // ---- trim helpers ----
  /**
   * The duration the OUTPUT will actually have. Every bitrate/size calculation
   * must use this, not durationSec — otherwise trimming 60s→10s while a size
   * preset is active leaves the estimate and the "target too small" warning
   * describing a file that will never exist.
   */
  function effectiveDuration(): number {
    if (trimStart !== null && trimEnd !== null) return trimEnd - trimStart;
    return durationSec;
  }
  const isTrimmed = (): boolean => trimStart !== null && trimEnd !== null;

  function clearTrim(): void {
    trimStart = null;
    trimEnd = null;
    if (trimStartInput) trimStartInput.value = durationSec ? formatTimecode(0) : "";
    if (trimEndInput) trimEndInput.value = durationSec ? formatTimecode(durationSec) : "";
    hide(trimError);
    updateTrimInfo();
    updateEstimate();
  }

  /**
   * Read + validate both timecode fields. Sets trimStart/trimEnd (or clears them
   * when the range is the full file, so we skip -ss/-t entirely) and returns
   * whether the current input is VALID. Invalid input disables Compress rather
   * than alerting — inline errors, no modal interruptions.
   */
  function readTrim(): boolean {
    if (!durationSec) return true; // can't validate without a duration; let ffmpeg try
    const rawS = trimStartInput?.value ?? "";
    const rawE = trimEndInput?.value ?? "";
    const s = parseTimecode(rawS);
    const e = parseTimecode(rawE);

    const fail = (msg: string): boolean => {
      if (trimError) {
        trimError.textContent = msg;
        show(trimError);
      }
      trimStart = null;
      trimEnd = null;
      return false;
    };

    if (s === null || e === null) return fail("Use mm:ss or hh:mm:ss (e.g. 0:12 or 1:02:30).");
    if (s < 0 || e < 0) return fail("Times can't be negative.");
    if (e > durationSec + 0.25) return fail(`End is past the end of the file (${fmtDuration(durationSec)}).`);
    if (s >= e) return fail("Start must be before end.");
    if (e - s < 0.5) return fail("That's shorter than half a second — pick a wider range.");

    hide(trimError);
    // Full range → treat as "no trim" so we don't pay for pointless -ss/-t.
    if (s <= 0.05 && e >= durationSec - 0.05) {
      trimStart = null;
      trimEnd = null;
    } else {
      trimStart = s;
      trimEnd = e;
    }
    return true;
  }

  function updateTrimInfo(): void {
    if (!trimInfo) return;
    if (!durationSec) {
      trimInfo.textContent = "";
      return;
    }
    trimInfo.textContent = isTrimmed()
      ? `Trimmed length: ${fmtDuration(effectiveDuration())} (from ${fmtDuration(durationSec)})`
      : `Full file: ${fmtDuration(durationSec)}`;
  }

  function onTrimInput(): void {
    const ok = readTrim();
    if (compressBtn) {
      (compressBtn as HTMLButtonElement).disabled = !ok;
      compressBtn.classList.toggle("is-disabled", !ok);
    }
    updateTrimInfo();
    updateEstimate();
  }

  /** Current playhead of whichever preview element is live for this mode. */
  function playheadSec(): number {
    const player = mode === "video" ? trimPreviewVideo : trimPreviewAudio;
    return player?.currentTime ?? 0;
  }

  // ---- estimate + warnings ----
  function targetVideoKbps(): number {
    const audioBudget = 128;
    // effectiveDuration(), not durationSec — a trim shrinks the content we have
    // to fit into targetMB, so the available bitrate goes UP proportionally.
    const totalKbps = (targetMB * 8192) / Math.max(1, effectiveDuration());
    return Math.max(120, Math.floor(totalKbps - audioBudget));
  }
  // Approx source audio bitrate (kbps) from bytes ÷ duration, same 1024-based
  // convention as the video math. Used only to warn when the chosen target is
  // ≥ the source (re-encoding up won't shrink — and may grow — the file).
  function approxSourceKbps(): number {
    if (!file || !durationSec) return 0;
    return ((file.size * 8) / 1024) / durationSec;
  }
  function updateEstimate(): void {
    if (!estimateEl) return;

    const trimNote = isTrimmed() ? ` · trimmed to ${fmtDuration(effectiveDuration())}` : "";

    if (mode === "audio") {
      if (!durationSec) {
        estimateEl.textContent = `Target ≈ ${audioKbps} kbps ${audioFmt.toUpperCase()}`;
      } else {
        const outMB = (audioKbps * effectiveDuration()) / 8192;
        estimateEl.textContent = `Target ≈ ${outMB.toFixed(1)} MB · ${audioKbps} kbps ${audioFmt.toUpperCase()} · ${fmtDuration(effectiveDuration())}${trimNote ? " (trimmed)" : ""}`;
      }
      if (warnEl) {
        const src = approxSourceKbps();
        if (src > 0 && audioKbps >= src * 0.98) {
          warnEl.textContent =
            "⚠ That bitrate is at or above this file's existing quality — the output may not get smaller (you can't add quality back). Pick a lower bitrate to shrink it.";
          show(warnEl);
        } else {
          hide(warnEl);
        }
      }
      return;
    }

    // video
    if (!durationSec) {
      estimateEl.textContent = "";
      return;
    }
    const vk = targetVideoKbps();
    estimateEl.textContent = `Target ≈ ${targetMB} MB · video bitrate ~${vk} kbps${trimNote}`;
    // Warn if the target is implausibly small for the content.
    if (warnEl) {
      if (vk <= 150) {
        warnEl.textContent =
          "⚠ That target is very small for this video's length — quality may be low. Consider a larger size or shorter clip.";
        show(warnEl);
      } else {
        hide(warnEl);
      }
    }
  }

  // ---- run compression ----
  async function compress(): Promise<void> {
    if (!file) return;
    if (!readTrim()) return; // invalid trim range — inline error already shown
    cancelled = false;
    if (resultHint) resultHint.textContent = "";
    hide(setupPanel);
    show(workPanel);
    hide(resultPanel);
    if (progressFill) {
      progressFill.style.width = "0%";
      progressFill.classList.add("is-indeterminate");
    }
    if (progressPct) progressPct.textContent = "";
    const noun = mode === "video" ? "video" : "audio";
    if (workStatus)
      workStatus.textContent = `Loading the compressor (one-time, ~25 MB)… your ${noun} stays on your device.`;

    try {
      await ensureFfmpeg(onProgress);
    } catch (err) {
      console.error("[cvf] ffmpeg load failed", err);
      terminateFfmpeg();
      // Return the user to the setup panel with a visible error + retry path.
      hide(workPanel);
      show(setupPanel);
      if (warnEl) {
        warnEl.textContent =
          "⚠ Couldn't load the compressor engine. This needs a modern desktop browser (Chrome or Edge) and a working connection. Please try again.";
        show(warnEl);
      }
      return;
    }
    if (cancelled) return;
    if (workStatus)
      workStatus.textContent = `Compressing on your device… nothing is uploaded.`;

    const inName = "input" + (file.name.match(/\.[a-z0-9]+$/i)?.[0] ?? (mode === "video" ? ".mp4" : ".bin"));
    const outName = mode === "video" ? "output.mp4" : `output.${audioFmt}`;
    try {
      // TRIM: -ss goes BEFORE -i (instant input seek — after -i it would decode
      // and discard everything up to the mark). -t <duration>, never -to
      // <endpoint>: -to's meaning relative to a preceding -ss has changed
      // between ffmpeg versions, so we compute the duration ourselves.
      const inputArgs: string[] = [];
      if (isTrimmed()) {
        inputArgs.push("-ss", String(trimStart));
      }
      const outputArgs: string[] = [];
      if (isTrimmed()) {
        outputArgs.push("-t", String(effectiveDuration()));
      }

      if (mode === "video") {
        const vKbps = targetVideoKbps();
        // Resolution downscale (never upscale).
        const res = resSelect?.value ?? "keep";
        if (res !== "keep") {
          const targetH = parseInt(res, 10);
          if (vidH && targetH < vidH) {
            // scale by height, keep aspect, ensure even width
            outputArgs.push("-vf", `scale=-2:${targetH}`);
          }
        }
        outputArgs.push(
          "-c:v", "libx264",
          "-b:v", `${vKbps}k`,
          "-maxrate", `${Math.floor(vKbps * 1.45)}k`,
          "-bufsize", `${vKbps * 2}k`,
          "-preset", "veryfast",
          "-c:a", "aac",
          "-b:a", "128k",
          "-movflags", "+faststart",
        );
      } else {
        // AUDIO: drop any video/cover-art stream (-vn) so libx264 never fires on
        // an embedded still, then re-encode the audio at the chosen bitrate.
        const codec = audioFmt === "mp3" ? "libmp3lame" : "aac";
        outputArgs.push("-vn", "-c:a", codec, "-b:a", `${audioKbps}k`);
        if (audioFmt === "m4a") outputArgs.push("-movflags", "+faststart");
      }

      const mime =
        mode === "video"
          ? "video/mp4"
          : audioFmt === "mp3"
            ? "audio/mpeg"
            : "audio/mp4";

      const blob = await runJob({
        file,
        inName,
        outName,
        inputArgs,
        outputArgs,
        mime,
        onProgress,
        isCancelled: () => cancelled,
      });
      if (!blob || cancelled) return;
      showResult(blob);
    } catch (err) {
      if (cancelled) return;
      console.error("[cvf] compress failed", err);
      if (workStatus)
        workStatus.textContent =
          "Compression failed — the file may be too large for this device's memory, or the format isn't supported. Try a smaller clip or a larger target size.";
    }
  }

  function showResult(blob: Blob): void {
    hide(workPanel);
    show(resultPanel);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = URL.createObjectURL(blob);

    const before = file?.size ?? 0;
    const after = blob.size;
    const pct = before > 0 ? Math.round((1 - after / before) * 100) : 0;

    // Preview with the right element for the mode.
    if (mode === "video") {
      show(resultVideo);
      hide(resultAudio);
      if (resultVideo) resultVideo.src = resultUrl;
      if (resultAudio) resultAudio.removeAttribute("src");
    } else {
      hide(resultVideo);
      show(resultAudio);
      if (resultAudio) resultAudio.src = resultUrl;
      if (resultVideo) resultVideo.removeAttribute("src");
    }

    if (sizeBeforeEl) sizeBeforeEl.textContent = fmtBytes(before);
    if (sizeAfterEl) sizeAfterEl.textContent = fmtBytes(after);
    if (reduceEl) {
      if (pct >= 1) {
        // normal success — file got smaller
        reduceEl.textContent = `${pct}% smaller`;
        reduceEl.style.color = "var(--color-success)";
      } else {
        // Already-compressed source: re-encoding didn't help. Be honest rather
        // than showing a misleading "0% smaller". The original is the better file.
        reduceEl.textContent = isTrimmed() ? "Trimmed" : "Already well compressed";
        reduceEl.style.color = "var(--color-fg)";
        if (resultHint)
          resultHint.textContent =
            mode === "video"
              ? "This video is already compressed about as much as it usefully can be at this target — your original is the smaller file. Try a smaller target size or lower resolution to shrink it further."
              : "This audio is already at or below the bitrate you picked — your original is the smaller file. Choose a lower bitrate to shrink it further.";
      }
    }
    if (downloadBtn) {
      downloadBtn.href = resultUrl;
      const fallback = mode === "video" ? "video" : "audio";
      const stem = fileStem(file?.name ?? fallback, fallback);
      const ext = mode === "video" ? "mp4" : audioFmt;
      const mid = isTrimmed() ? "-trimmed" : "";
      downloadBtn.download = `${stem}${mid}-compressed.${ext}`;
    }
  }

  function reset(): void {
    cancelled = true;
    file = null;
    durationSec = 0;
    trimStart = null;
    trimEnd = null;
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      resultUrl = null;
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
    trimPreviewVideo?.removeAttribute("src");
    trimPreviewAudio?.removeAttribute("src");
    if (trimDetails) trimDetails.open = false;
    if (trimStartInput) trimStartInput.value = "";
    if (trimEndInput) trimEndInput.value = "";
    hide(trimError);
    updateTrimInfo();
    if (compressBtn) {
      (compressBtn as HTMLButtonElement).disabled = false;
      compressBtn.classList.remove("is-disabled");
    }
    if (resultVideo) resultVideo.removeAttribute("src");
    if (resultAudio) resultAudio.removeAttribute("src");
    if (fileInput) fileInput.value = "";
    hide(setupPanel);
    hide(workPanel);
    hide(resultPanel);
    show($("cvf-intro"));
  }

  // ---- mode switching (Video ⇄ Audio tabs) ----
  // Switching always returns to a fresh intro for the new mode — a file picked in
  // one mode can't carry into the other, and any in-flight job is cancelled.
  function applyModeCopy(): void {
    const isVideo = mode === "video";
    tabVideo?.classList.toggle("is-active", isVideo);
    tabVideo?.setAttribute("aria-selected", String(isVideo));
    tabAudio?.classList.toggle("is-active", !isVideo);
    tabAudio?.setAttribute("aria-selected", String(!isVideo));

    if (appTitle) appTitle.textContent = isVideo ? "Compress a video" : "Compress audio";
    if (appSub)
      appSub.innerHTML = isVideo
        ? 'Shrink any video for WhatsApp, email or Discord. <span class="text-[var(--color-fg)] font-medium">Your video never uploads</span> — it\'s compressed right here on your device.'
        : 'Shrink any audio file — MP3, M4A, WAV and more. <span class="text-[var(--color-fg)] font-medium">Your audio never uploads</span> — it\'s compressed right here on your device.';
    if (dzTitle) dzTitle.textContent = isVideo ? "Drop a video here" : "Drop an audio file here";
    if (dzFormats)
      dzFormats.textContent = isVideo
        ? "MP4, MOV, WebM, MKV, AVI · nothing is uploaded"
        : "MP3, M4A, WAV, FLAC, OGG, Opus · nothing is uploaded";
    if (pickLabel) pickLabel.textContent = isVideo ? "Choose a video" : "Choose audio";
    // The Windows empty-picker trap and the iOS double-picker trap are both
    // encoded in acceptFor() — see media-file.ts. Do not inline this.
    fileInput?.setAttribute("accept", acceptFor(mode));
    if (compressBtn) compressBtn.textContent = isVideo ? "Compress video" : "Compress audio";
  }
  function switchMode(next: MediaMode): void {
    if (next === mode) return;
    // Cancel any in-flight job + free the engine so the new mode starts clean.
    cancelled = true;
    mode = next;
    applyModeCopy();
    reset();
  }

  // ---- preset UI ----
  function selectPreset(id: string): void {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    targetMB = p.targetMB;
    presetWrap?.querySelectorAll("[data-preset]").forEach((b) => {
      b.classList.toggle("is-active", (b as HTMLElement).dataset.preset === id);
    });
    // sync the custom slider to the preset value
    if (customRange) {
      customRange.value = String(p.targetMB);
      if (customVal) customVal.textContent = `${p.targetMB} MB`;
    }
    updateEstimate();
  }
  function selectAudioPreset(id: string): void {
    const p = AUDIO_PRESETS.find((x) => x.id === id);
    if (!p) return;
    audioKbps = p.kbps;
    audioPresetWrap?.querySelectorAll("[data-apreset]").forEach((b) => {
      b.classList.toggle("is-active", (b as HTMLElement).dataset.apreset === id);
    });
    updateEstimate();
  }

  // ================= wire up =================
  // File picker: the dropzone opens it on click. The "Choose a video" button is
  // INSIDE the dropzone, so its click must NOT also bubble to the dropzone —
  // otherwise the picker fires twice per tap, and iOS Safari (one picker per
  // user gesture) silently dismisses BOTH, leaving the user stuck on the
  // dropzone with no file. stopPropagation keeps it to exactly one picker.
  pickBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.click();
  });
  dropzone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const f = fileInput.files?.[0];
    if (f) void ingest(f);
  });

  // mode tabs
  tabVideo?.addEventListener("click", () => switchMode("video"));
  tabAudio?.addEventListener("click", () => switchMode("audio"));

  // drag + drop
  let dragDepth = 0;
  const isFileDrag = (e: DragEvent) =>
    Array.from(e.dataTransfer?.types ?? []).includes("Files");
  dropzone.addEventListener("dragenter", (e) => {
    if (!isFileDrag(e as DragEvent)) return;
    e.preventDefault();
    dragDepth++;
    dropzone.classList.add("is-dragover");
  });
  dropzone.addEventListener("dragover", (e) => {
    if (isFileDrag(e as DragEvent)) e.preventDefault();
  });
  dropzone.addEventListener("dragleave", (e) => {
    if (!isFileDrag(e as DragEvent)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dropzone.classList.remove("is-dragover");
  });
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dragDepth = 0;
    dropzone.classList.remove("is-dragover");
    const f = (e as DragEvent).dataTransfer?.files?.[0];
    if (f) void ingest(f);
  });

  // build video preset buttons
  if (presetWrap) {
    presetWrap.innerHTML = PRESETS.map(
      (p) => `
      <button type="button" data-preset="${p.id}"
        class="cvf-preset flex flex-col items-start rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-left transition-colors hover:border-[var(--color-accent)]">
        <span class="text-sm font-semibold text-[var(--color-fg)]">${p.label}</span>
        <span class="text-xs text-[var(--color-fg-muted)]">${p.sub}</span>
      </button>`,
    ).join("");
    presetWrap.querySelectorAll("[data-preset]").forEach((b) => {
      b.addEventListener("click", () =>
        selectPreset((b as HTMLElement).dataset.preset ?? "email"),
      );
    });
  }

  // build audio preset buttons
  if (audioPresetWrap) {
    audioPresetWrap.innerHTML = AUDIO_PRESETS.map(
      (p) => `
      <button type="button" data-apreset="${p.id}"
        class="cvf-preset flex flex-col items-start rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-left transition-colors hover:border-[var(--color-accent)]">
        <span class="text-sm font-semibold text-[var(--color-fg)]">${p.label}</span>
        <span class="text-xs text-[var(--color-fg-muted)]">${p.sub}</span>
      </button>`,
    ).join("");
    audioPresetWrap.querySelectorAll("[data-apreset]").forEach((b) => {
      b.addEventListener("click", () =>
        selectAudioPreset((b as HTMLElement).dataset.apreset ?? "128"),
      );
    });
  }

  customRange?.addEventListener("input", () => {
    targetMB = Number(customRange.value);
    if (customVal) customVal.textContent = `${targetMB} MB`;
    // deselect preset chips when manually overriding
    presetWrap?.querySelectorAll("[data-preset]").forEach((b) => b.classList.remove("is-active"));
    updateEstimate();
  });
  resSelect?.addEventListener("change", updateEstimate);
  fmtSelect?.addEventListener("change", () => {
    const v = fmtSelect.value === "m4a" ? "m4a" : "mp3";
    audioFmt = v;
    updateEstimate();
  });

  compressBtn?.addEventListener("click", () => void compress());
  cancelBtn?.addEventListener("click", () => {
    cancelled = true;
    terminateFfmpeg();
    reset();
  });
  againBtn?.addEventListener("click", reset);
  $("cvf-again2")?.addEventListener("click", reset);

  // ---- trim wiring ----
  trimStartInput?.addEventListener("input", onTrimInput);
  trimEndInput?.addEventListener("input", onTrimInput);
  // "Use current playhead" — the ergonomic core of the trim UI. Scrub the
  // preview to the frame you want, click, done. No waveform needed.
  trimSetStart?.addEventListener("click", () => {
    if (trimStartInput) trimStartInput.value = formatTimecode(playheadSec());
    onTrimInput();
  });
  trimSetEnd?.addEventListener("click", () => {
    if (trimEndInput) trimEndInput.value = formatTimecode(playheadSec());
    onTrimInput();
  });
  trimReset?.addEventListener("click", (e) => {
    e.preventDefault();
    clearTrim();
    onTrimInput();
  });

  // defaults
  // Deep link: /app/?mode=audio starts on the Audio tab (used by the homepage
  // "Compress audio" CTA and any audio-targeted landing copy).
  const wantAudio = new URLSearchParams(location.search).get("mode") === "audio";
  if (wantAudio) mode = "audio";
  applyModeCopy();
  selectPreset("email");
  selectAudioPreset("128");
}
