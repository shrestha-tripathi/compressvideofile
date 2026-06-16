/**
 * Compress Video File — 100% client-side video compression via ffmpeg.wasm.
 *
 * The user's video NEVER uploads. Only the ffmpeg WebAssembly binary is fetched
 * from a CDN (it's code, not user data), converted to a same-origin blob URL via
 * toBlobURL so it works under COEP: require-corp. Compression runs in a Web
 * Worker on the user's machine.
 *
 * Engine: @ffmpeg/ffmpeg 0.12.15 + @ffmpeg/util 0.12.2.
 *   - Preferred: multithreaded core (@ffmpeg/core-mt) — needs SharedArrayBuffer,
 *     which needs COOP/COEP headers (set in public/_headers).
 *   - Fallback: single-threaded core (@ffmpeg/core) when SAB is unavailable
 *     (e.g. headers not applied, some iOS contexts) — slower but works.
 */
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

const CORE_VERSION = "0.12.10"; // matches @ffmpeg/ffmpeg 0.12.15
const BASE_MT = `https://unpkg.com/@ffmpeg/core-mt@${CORE_VERSION}/dist/esm`;
const BASE_ST = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`;

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

  const setupPanel = $("cvf-setup");
  const origMeta = $("cvf-orig-meta");
  const origName = $("cvf-orig-name");
  const presetWrap = $("cvf-presets");
  const customRange = $<HTMLInputElement>("cvf-custom");
  const customVal = $("cvf-custom-val");
  const resSelect = $<HTMLSelectElement>("cvf-res");
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
  const reduceEl = $("cvf-reduce");
  const resultHint = $("cvf-result-hint");
  const sizeBeforeEl = $("cvf-size-before");
  const sizeAfterEl = $("cvf-size-after");
  const downloadBtn = $<HTMLAnchorElement>("cvf-download");
  const againBtn = $("cvf-again");

  if (!dropzone || !fileInput) return; // not the /app page

  // ---- state ----
  let file: File | null = null;
  let durationSec = 0;
  let vidW = 0;
  let vidH = 0;
  let targetMB = 25;
  let ffmpeg: FFmpeg | null = null;
  let ffmpegLoaded = false;
  let usingMT = false;
  let resultUrl: string | null = null;
  let cancelled = false;

  const show = (el: HTMLElement | null) => el?.classList.remove("hidden");
  const hide = (el: HTMLElement | null) => el?.classList.add("hidden");

  // ---- load ffmpeg lazily, prefer multithread ----
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

    const hasSAB = typeof SharedArrayBuffer !== "undefined";
    const base = hasSAB ? BASE_MT : BASE_ST;
    usingMT = hasSAB;

    const cfg: {
      coreURL: string;
      wasmURL: string;
      workerURL?: string;
    } = {
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
    };
    if (hasSAB) {
      cfg.workerURL = await toBlobURL(
        `${base}/ffmpeg-core.worker.js`,
        "text/javascript",
      );
    }
    await ffmpeg.load(cfg);
    ffmpegLoaded = true;
    return ffmpeg;
  }

  // ---- ingest a chosen file ----
  function ingest(f: File): void {
    if (!f.type.startsWith("video/") && !/\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(f.name)) {
      alert("Please choose a video file (mp4, mov, webm, mkv, avi).");
      return;
    }
    file = f;
    cancelled = false;
    if (origName) origName.textContent = f.name;

    // Probe duration + dimensions with a throwaway <video> (no upload).
    const probe = document.createElement("video");
    probe.preload = "metadata";
    const url = URL.createObjectURL(f);
    probe.onloadedmetadata = () => {
      durationSec = probe.duration || 0;
      vidW = probe.videoWidth || 0;
      vidH = probe.videoHeight || 0;
      URL.revokeObjectURL(url);
      if (origMeta) {
        const dims = vidW && vidH ? `${vidW}×${vidH} · ` : "";
        origMeta.textContent = `${fmtBytes(f.size)} · ${dims}${fmtDuration(durationSec)}`;
      }
      updateEstimate();
    };
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      if (origMeta) origMeta.textContent = `${fmtBytes(f.size)} · (metadata unavailable)`;
    };
    probe.src = url;

    hide($("cvf-intro"));
    show(setupPanel);
    hide(resultPanel);
    hide(workPanel);
  }

  // ---- estimate + warnings ----
  function targetVideoKbps(): number {
    const audioKbps = 128;
    const totalKbps = (targetMB * 8192) / Math.max(1, durationSec);
    return Math.max(120, Math.floor(totalKbps - audioKbps));
  }
  function updateEstimate(): void {
    if (!estimateEl) return;
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
    if (workStatus)
      workStatus.textContent =
        "Loading the compressor (one-time, ~25 MB)… your video stays on your device.";

    let ff: FFmpeg;
    try {
      ff = await ensureFfmpeg();
    } catch (err) {
      if (workStatus)
        workStatus.textContent =
          "Couldn't load the compressor. Check your connection and try again.";
      console.error("[cvf] ffmpeg load failed", err);
      return;
    }
    if (cancelled) return;
    if (workStatus)
      workStatus.textContent = `Compressing on your device${usingMT ? " (multi-threaded)" : ""}… nothing is uploaded.`;

    const inName = "input" + (file.name.match(/\.[a-z0-9]+$/i)?.[0] ?? ".mp4");
    const outName = "output.mp4";
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      await ff.writeFile(inName, buf);

      const vKbps = targetVideoKbps();
      const args = ["-i", inName];
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

      await ff.exec(args);
      if (cancelled) return;

      const data = (await ff.readFile(outName)) as Uint8Array;
      // Copy into a fresh ArrayBuffer so the Blob owns clean memory.
      const out = new Uint8Array(data.byteLength);
      out.set(data);
      const blob = new Blob([out], { type: "video/mp4" });

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

    if (resultVideo) resultVideo.src = resultUrl;
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
            "This video is already compressed about as much as it usefully can be at this target — your original is the smaller file. Try a smaller target size or lower resolution to shrink it further.";
      }
    }
    if (downloadBtn) {
      downloadBtn.href = resultUrl;
      const stem = (file?.name ?? "video").replace(/\.[a-z0-9]+$/i, "");
      downloadBtn.download = `${stem}-compressed.mp4`;
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
    if (fileInput) fileInput.value = "";
    hide(setupPanel);
    hide(workPanel);
    hide(resultPanel);
    show($("cvf-intro"));
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

  // ================= wire up =================
  pickBtn?.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const f = fileInput.files?.[0];
    if (f) ingest(f);
  });

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

  // build preset buttons
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

  customRange?.addEventListener("input", () => {
    targetMB = Number(customRange.value);
    if (customVal) customVal.textContent = `${targetMB} MB`;
    // deselect preset chips when manually overriding
    presetWrap?.querySelectorAll("[data-preset]").forEach((b) => b.classList.remove("is-active"));
    updateEstimate();
  });
  resSelect?.addEventListener("change", updateEstimate);

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

  // default preset
  selectPreset("email");
}
