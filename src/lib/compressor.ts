/**
 * Compress Video File — 100% client-side video + audio compression via ffmpeg.wasm.
 *
 * The user's file NEVER uploads. Only the ffmpeg WebAssembly binary is fetched
 * from a CDN (it's code, not user data), converted to a same-origin blob URL via
 * toBlobURL so it works under COEP: require-corp. Compression runs in a Web
 * Worker on the user's machine.
 *
 * Engine: @ffmpeg/ffmpeg 0.12.15 + @ffmpeg/util 0.12.2, single-threaded
 * @ffmpeg/core 0.12.9 (ESM). The multi-threaded core is intentionally NOT used —
 * it crashes mid-encode in real browsers (see the BASE_ST note below).
 *
 * TWO MODES (one engine, one wasm):
 *  - VIDEO: target a SIZE (MB); bitrate is derived from size/duration; libx264.
 *  - AUDIO: target a BITRATE (kbps) directly; libmp3lame (MP3) or aac (M4A).
 * The audio path is strictly lighter than video (no libx264), so it's the more
 * robust of the two on low-memory mobile. The same 0.12.9 wasm ships
 * libmp3lame + aac (verified against the core's own --enable-libmp3lame build
 * config), so audio needs ZERO new deps and ZERO new wasm.
 */
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

// Match @ffmpeg/ffmpeg 0.12.15's own declared CORE_VERSION (see its const.js) so
// the core's wasm ABI matches the library exactly.
const CORE_VERSION = "0.12.9";
// IMPORTANT: use the ESM build, NOT umd. We `import { FFmpeg } from "@ffmpeg/ffmpeg"`,
// so the bundler pulls in the library's ESM build, which spawns its worker as
// `type: "module"`. A module worker can't call importScripts(), so the worker
// loads the core via `self.createFFmpegCore = (await import(coreURL)).default`.
// Only the ESM core exposes that `export default` — the UMD core has no default
// export, so a UMD core here yields `undefined` → throw "failed to import
// ffmpeg-core.js" (ERROR_IMPORT_FAILURE). The UMD layout only works when the
// library itself is loaded as a UMD <script> (classic worker, importScripts).
// Match the build layout to the library build we bundle: ESM ↔ ESM.
//
// SINGLE-THREADED ONLY — the multi-threaded core (@ffmpeg/core-mt) is DISABLED.
// Empirically, EVERY core-mt version (0.12.4/0.12.6/0.12.9/0.12.10) crashes mid-
// encode in real browsers with `RuntimeError: function signature mismatch` (which
// surfaces as a confusing "Cannot read properties of undefined (reading
// 'startsWith')" from the library reading the dead worker's error payload). The
// single-threaded core completes the identical job flawlessly. MT would give a
// 2-4x speedup but a fast-but-crashing compressor is worse than a slower reliable
// one. If a future @ffmpeg/core-mt fixes the pthread/SIMD ABI, re-enable by
// restoring the SAB branch below and re-running the dist/ff-test.html probe.
const BASE_ST = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`;

type Mode = "video" | "audio";

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

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
function fmtDuration(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

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
  let mode: Mode = "video";
  let file: File | null = null;
  let durationSec = 0;
  let vidW = 0;
  let vidH = 0;
  let targetMB = 25; // video target
  let audioKbps = 128; // audio target
  let audioFmt: AudioFmt = "mp3";
  let ffmpeg: FFmpeg | null = null;
  let ffmpegLoaded = false;
  let resultUrl: string | null = null;
  let cancelled = false;

  const show = (el: HTMLElement | null) => el?.classList.remove("hidden");
  const hide = (el: HTMLElement | null) => el?.classList.add("hidden");

  // Accepted extensions per mode (the picker's `accept` is a hint; this regex is
  // the real guard in ingest()). Audio list is broad on purpose — ffmpeg decodes
  // far more than the browser can preview, and we degrade gracefully if a format
  // can't be probed for duration.
  const AUDIO_EXT = /\.(mp3|m4a|aac|wav|flac|ogg|oga|opus|wma|aiff?|alac|caf|amr|m4b)$/i;
  const VIDEO_EXT = /\.(mp4|mov|webm|mkv|avi|m4v|mpe?g|wmv|flv|3gp|ts|ogv)$/i;

  // ---- load ffmpeg lazily (single-threaded core; see BASE_ST note above) ----
  async function ensureFfmpeg(): Promise<FFmpeg> {
    if (ffmpeg && ffmpegLoaded) return ffmpeg;
    ffmpeg = new FFmpeg();
    ffmpeg.on("progress", ({ progress }) => {
      if (cancelled) return;
      const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
      if (progressFill) progressFill.style.width = `${pct}%`;
      if (progressPct) progressPct.textContent = `${pct}%`;
      progressFill?.classList.remove("is-indeterminate");
    });

    // Always the single-threaded core: the multi-threaded core crashes mid-encode
    // in real browsers (`function signature mismatch`) regardless of version.
    const cfg: { coreURL: string; wasmURL: string } = {
      coreURL: await toBlobURL(`${BASE_ST}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${BASE_ST}/ffmpeg-core.wasm`, "application/wasm"),
    };
    // Guard against a silent hang: if load() doesn't resolve in 45s, reject so
    // the UI can show an error + retry instead of spinning forever.
    await Promise.race([
      ffmpeg.load(cfg),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("ffmpeg load timed out after 45s")),
          45000,
        ),
      ),
    ]);
    ffmpegLoaded = true;
    return ffmpeg;
  }

  // ---- ingest a chosen file ----
  function ingest(f: File): void {
    const okType =
      mode === "video"
        ? f.type.startsWith("video/") || VIDEO_EXT.test(f.name)
        : f.type.startsWith("audio/") || AUDIO_EXT.test(f.name);
    if (!okType) {
      alert(
        mode === "video"
          ? "Please choose a video file (mp4, mov, webm, mkv, avi)."
          : "Please choose an audio file (mp3, m4a, wav, flac, ogg, opus).",
      );
      return;
    }
    file = f;
    cancelled = false;
    if (origName) origName.textContent = f.name;

    // Probe duration (and dimensions for video) with a throwaway media element —
    // no upload. A <video> element loads audio-only files fine and reports
    // duration (videoWidth/Height stay 0), so one probe path covers both modes.
    const probe = document.createElement("video");
    probe.preload = "metadata";
    const url = URL.createObjectURL(f);
    probe.onloadedmetadata = () => {
      durationSec = probe.duration || 0;
      vidW = probe.videoWidth || 0;
      vidH = probe.videoHeight || 0;
      URL.revokeObjectURL(url);
      if (origMeta) {
        const dims = mode === "video" && vidW && vidH ? `${vidW}×${vidH} · ` : "";
        origMeta.textContent = `${fmtBytes(f.size)} · ${dims}${fmtDuration(durationSec)}`;
      }
      updateEstimate();
    };
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      // ffmpeg can still compress formats the browser can't preview (e.g. flac
      // on some browsers) — duration just stays unknown, which only affects the
      // estimate text, not the actual job.
      durationSec = 0;
      if (origMeta) origMeta.textContent = `${fmtBytes(f.size)} · (metadata unavailable)`;
      updateEstimate();
    };
    probe.src = url;

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
  }

  // ---- estimate + warnings ----
  function targetVideoKbps(): number {
    const audioBudget = 128;
    const totalKbps = (targetMB * 8192) / Math.max(1, durationSec);
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

    if (mode === "audio") {
      if (!durationSec) {
        estimateEl.textContent = `Target ≈ ${audioKbps} kbps ${audioFmt.toUpperCase()}`;
      } else {
        const outMB = (audioKbps * durationSec) / 8192;
        estimateEl.textContent = `Target ≈ ${outMB.toFixed(1)} MB · ${audioKbps} kbps ${audioFmt.toUpperCase()} · ${fmtDuration(durationSec)}`;
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
    estimateEl.textContent = `Target ≈ ${targetMB} MB · video bitrate ~${vk} kbps`;
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

    let ff: FFmpeg;
    try {
      ff = await ensureFfmpeg();
    } catch (err) {
      console.error("[cvf] ffmpeg load failed", err);
      // Reset so a retry re-attempts a fresh load.
      ffmpeg = null;
      ffmpegLoaded = false;
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
      const buf = new Uint8Array(await file.arrayBuffer());
      await ff.writeFile(inName, buf);

      const args = ["-i", inName];
      if (mode === "video") {
        const vKbps = targetVideoKbps();
        // Resolution downscale (never upscale).
        const res = resSelect?.value ?? "keep";
        if (res !== "keep") {
          const targetH = parseInt(res, 10);
          if (vidH && targetH < vidH) {
            // scale by height, keep aspect, ensure even width
            args.push("-vf", `scale=-2:${targetH}`);
          }
        }
        args.push(
          "-c:v", "libx264",
          "-b:v", `${vKbps}k`,
          "-maxrate", `${Math.floor(vKbps * 1.45)}k`,
          "-bufsize", `${vKbps * 2}k`,
          "-preset", "veryfast",
          "-c:a", "aac",
          "-b:a", "128k",
          "-movflags", "+faststart",
          outName,
        );
      } else {
        // AUDIO: drop any video/cover-art stream (-vn) so libx264 never fires on
        // an embedded still, then re-encode the audio at the chosen bitrate.
        const codec = audioFmt === "mp3" ? "libmp3lame" : "aac";
        args.push("-vn", "-c:a", codec, "-b:a", `${audioKbps}k`);
        if (audioFmt === "m4a") args.push("-movflags", "+faststart");
        args.push(outName);
      }

      await ff.exec(args);
      if (cancelled) return;

      const data = (await ff.readFile(outName)) as Uint8Array;
      // Copy into a fresh ArrayBuffer so the Blob owns clean memory.
      const out = new Uint8Array(data.byteLength);
      out.set(data);
      const mime =
        mode === "video"
          ? "video/mp4"
          : audioFmt === "mp3"
            ? "audio/mpeg"
            : "audio/mp4";
      const blob = new Blob([out], { type: mime });

      // cleanup vfs
      try { await ff.deleteFile(inName); } catch { /* ignore */ }
      try { await ff.deleteFile(outName); } catch { /* ignore */ }

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
        reduceEl.textContent = "Already well compressed";
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
      const stem = (file?.name ?? fallback).replace(/\.[a-z0-9]+$/i, "");
      const ext = mode === "video" ? "mp4" : audioFmt;
      downloadBtn.download = `${stem}-compressed.${ext}`;
    }
  }

  function reset(): void {
    cancelled = true;
    file = null;
    durationSec = 0;
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      resultUrl = null;
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
    fileInput?.setAttribute("accept", isVideo ? "video/*" : "audio/*");
    if (compressBtn) compressBtn.textContent = isVideo ? "Compress video" : "Compress audio";
  }
  function switchMode(next: Mode): void {
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
    if (f) ingest(f);
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
    if (f) ingest(f);
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
    try {
      ffmpeg?.terminate();
    } catch { /* ignore */ }
    ffmpeg = null;
    ffmpegLoaded = false;
    reset();
  });
  againBtn?.addEventListener("click", reset);
  $("cvf-again2")?.addEventListener("click", reset);

  // defaults
  applyModeCopy(); // video by default
  selectPreset("email");
  selectAudioPreset("128");
}
