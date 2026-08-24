/**
 * /trim — standalone lossless trim tool.
 *
 * The KEY difference from /app: this does NOT re-encode by default.
 *
 *   Fast mode  : -ss X -i in -t D -c copy   → remuxes the container.
 *                A 500 MB 4K clip cuts in well under a second with ZERO quality
 *                loss, because no decode/encode happens at all. The trade-off is
 *                that `-c copy` can only cut on KEYFRAMES, so the real start can
 *                land a second or two before the requested mark.
 *   Precise    : re-encodes with libx264 -crf 20 for a frame-exact cut.
 *
 * CRF (quality-constant), not target-bitrate, is correct here: a trim is not a
 * size-targeting operation, so we hold quality and let the size fall where it
 * may. (Size targeting is /app's job.)
 *
 * Audio always uses `-c copy` — audio frames are short enough that copy-trimming
 * is effectively sample-accurate, so the quality toggle is hidden in audio mode.
 *
 * ⚠️ ARGUMENT ORDER IS LOAD-BEARING:
 *   -ss BEFORE -i  = input seek. Instant — ffmpeg jumps in the container.
 *   -ss AFTER  -i  = output seek. Decodes and discards everything before the
 *                    mark. On a long file this is catastrophically slow.
 * ffmpeg-engine.runJob() enforces the split via inputArgs/outputArgs.
 *
 * ⚠️ We pass `-t <duration>`, never `-to <endpoint>`. The meaning of `-to`
 * relative to a preceding `-ss` has changed between ffmpeg versions; computing
 * the duration in JS is unambiguous everywhere.
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
  fileExt,
} from "./media-file";

type TrimQuality = "fast" | "precise";

const $ = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
  document.getElementById(id) as T | null;

/**
 * Containers that tolerate a straight stream copy from an arbitrary source.
 * Anything else gets remuxed into MP4 (video) or kept as-is (audio), because
 * e.g. copying H.264 into a WebM container is invalid and ffmpeg will refuse.
 */
const COPY_SAFE_VIDEO = new Set(["mp4", "mov", "m4v", "mkv", "ts"]);

export function initTrimmer(): void {
  const dropzone = $("cvt-dropzone");
  const fileInput = $<HTMLInputElement>("cvt-file");
  const pickBtn = $("cvt-pick");
  if (!dropzone || !fileInput) return; // not the /trim page

  const tabVideo = $("cvt-tab-video");
  const tabAudio = $("cvt-tab-audio");
  const dzTitle = $("cvt-dz-title");
  const dzFormats = $("cvt-dz-formats");
  const pickLabel = $("cvt-pick-label");
  const appTitle = $("cvt-app-title");
  const appSub = $("cvt-app-sub");

  const setupPanel = $("cvt-setup");
  const origName = $("cvt-orig-name");
  const origMeta = $("cvt-orig-meta");
  const previewVideo = $<HTMLVideoElement>("cvt-preview-video");
  const previewAudio = $<HTMLAudioElement>("cvt-preview-audio");
  const startInput = $<HTMLInputElement>("cvt-start");
  const endInput = $<HTMLInputElement>("cvt-end");
  const setStartBtn = $("cvt-set-start");
  const setEndBtn = $("cvt-set-end");
  const rangeChips = $("cvt-chips");
  const infoEl = $("cvt-info");
  const errorEl = $("cvt-error");
  const qualityWrap = $("cvt-quality-wrap");
  const qFast = $("cvt-q-fast");
  const qPrecise = $("cvt-q-precise");
  const qualityNote = $("cvt-quality-note");
  const trimBtn = $<HTMLButtonElement>("cvt-trim");
  const againBtn = $("cvt-again");

  const workPanel = $("cvt-working");
  const progressFill = $("cvt-progress");
  const progressPct = $("cvt-progress-pct");
  const workStatus = $("cvt-work-status");
  const cancelBtn = $("cvt-cancel");

  const resultPanel = $("cvt-result");
  const resultVideo = $<HTMLVideoElement>("cvt-result-video");
  const resultAudio = $<HTMLAudioElement>("cvt-result-audio");
  const resultLen = $("cvt-result-len");
  const sizeBefore = $("cvt-size-before");
  const sizeAfter = $("cvt-size-after");
  const resultHint = $("cvt-result-hint");
  const downloadBtn = $<HTMLAnchorElement>("cvt-download");
  const again2Btn = $("cvt-again2");

  // ---- state ----
  let mode: MediaMode = "video";
  let quality: TrimQuality = "fast";
  let file: File | null = null;
  let durationSec = 0;
  let vidH = 0;
  let startSec = 0;
  let endSec = 0;
  let previewUrl: string | null = null;
  let resultUrl: string | null = null;
  let cancelled = false;

  const show = (el: HTMLElement | null) => el?.classList.remove("hidden");
  const hide = (el: HTMLElement | null) => el?.classList.add("hidden");

  function onProgress(pct: number): void {
    if (cancelled) return;
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressPct) progressPct.textContent = `${pct}%`;
    progressFill?.classList.remove("is-indeterminate");
  }

  // ---- mode ----
  function applyModeCopy(): void {
    const isVideo = mode === "video";
    tabVideo?.classList.toggle("is-active", isVideo);
    tabVideo?.setAttribute("aria-selected", String(isVideo));
    tabAudio?.classList.toggle("is-active", !isVideo);
    tabAudio?.setAttribute("aria-selected", String(!isVideo));

    if (appTitle) appTitle.textContent = isVideo ? "Trim a video" : "Trim audio";
    if (appSub)
      appSub.innerHTML = isVideo
        ? 'Cut a video to an exact start and end time. <span class="text-[var(--color-fg)] font-medium">Nothing is uploaded</span> — and the fast mode doesn\'t re-encode, so there\'s no quality loss.'
        : 'Cut an audio file to an exact start and end time. <span class="text-[var(--color-fg)] font-medium">Nothing is uploaded</span> — and it\'s a lossless stream copy, so quality is untouched.';
    if (dzTitle) dzTitle.textContent = isVideo ? "Drop a video here" : "Drop an audio file here";
    if (dzFormats)
      dzFormats.textContent = isVideo
        ? "MP4, MOV, WebM, MKV, AVI · nothing is uploaded"
        : "MP3, M4A, WAV, FLAC, OGG, Opus · nothing is uploaded";
    if (pickLabel) pickLabel.textContent = isVideo ? "Choose a video" : "Choose audio";
    // acceptFor() carries the Windows empty-picker + iOS double-picker fixes.
    fileInput?.setAttribute("accept", acceptFor(mode));
    // Audio copy-trims are effectively sample-accurate, so the fast/precise
    // trade-off doesn't exist there — hide the control rather than offer a
    // choice that has no downside.
    if (isVideo) show(qualityWrap);
    else hide(qualityWrap);
    if (trimBtn) trimBtn.textContent = isVideo ? "Trim video" : "Trim audio";
  }

  function switchMode(next: MediaMode): void {
    if (next === mode) return;
    cancelled = true;
    mode = next;
    applyModeCopy();
    reset();
  }

  function applyQuality(): void {
    const fast = quality === "fast";
    qFast?.classList.toggle("is-active", fast);
    qFast?.setAttribute("aria-selected", String(fast));
    qPrecise?.classList.toggle("is-active", !fast);
    qPrecise?.setAttribute("aria-selected", String(!fast));
    if (qualityNote)
      qualityNote.textContent = fast
        ? "Keeps the original quality and finishes almost instantly — but the cut snaps to the nearest keyframe, so the start can land a second or two early."
        : "Exact to the frame, but re-encodes the video — slower, and a small quality loss like any re-encode.";
  }

  // ---- ingest ----
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
    if (origName) origName.textContent = f.name;

    hide($("cvt-intro"));
    show(setupPanel);
    hide(resultPanel);
    hide(workPanel);

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(f);
    const player = mode === "video" ? previewVideo : previewAudio;
    const other = mode === "video" ? previewAudio : previewVideo;
    other?.removeAttribute("src");
    hide(other);
    show(player);
    if (player) player.src = previewUrl;

    const meta = await probeMedia(f);
    durationSec = meta.durationSec;
    vidH = meta.height;
    if (origMeta) {
      if (!durationSec) {
        origMeta.textContent = `${fmtBytes(f.size)} · (metadata unavailable — you can still trim, but enter times manually)`;
      } else {
        const dims = mode === "video" && meta.width && meta.height ? `${meta.width}×${meta.height} · ` : "";
        origMeta.textContent = `${fmtBytes(f.size)} · ${dims}${fmtDuration(durationSec)}`;
      }
    }
    startSec = 0;
    endSec = durationSec;
    if (startInput) startInput.value = formatTimecode(0);
    if (endInput) endInput.value = formatTimecode(durationSec);
    validate();
  }

  // ---- validation ----
  /** Reads both fields, updates startSec/endSec, returns validity. */
  function validate(): boolean {
    const s = parseTimecode(startInput?.value ?? "");
    const e = parseTimecode(endInput?.value ?? "");

    const fail = (msg: string): boolean => {
      if (errorEl) {
        errorEl.textContent = msg;
        show(errorEl);
      }
      if (trimBtn) {
        trimBtn.disabled = true;
        trimBtn.classList.add("is-disabled");
      }
      if (infoEl) infoEl.textContent = "";
      return false;
    };

    if (s === null || e === null) return fail("Use mm:ss or hh:mm:ss (e.g. 0:12 or 1:02:30).");
    if (s < 0 || e < 0) return fail("Times can't be negative.");
    if (s >= e) return fail("Start must be before end.");
    if (e - s < 0.5) return fail("That's shorter than half a second — pick a wider range.");
    // Only bound against duration when we actually managed to probe it.
    if (durationSec && e > durationSec + 0.25)
      return fail(`End is past the end of the file (${fmtDuration(durationSec)}).`);

    startSec = s;
    endSec = e;
    hide(errorEl);
    if (trimBtn) {
      trimBtn.disabled = false;
      trimBtn.classList.remove("is-disabled");
    }
    if (infoEl) {
      const kept = e - s;
      const cut = durationSec - kept;
      // fmtDuration(0) renders "—", so don't say "cutting —" on a full-length
      // selection; say nothing was cut.
      infoEl.textContent = !durationSec
        ? `Keeping ${fmtDuration(kept)}`
        : cut < 0.5
          ? `Keeping the full ${fmtDuration(durationSec)} — nothing will be cut`
          : `Keeping ${fmtDuration(kept)} of ${fmtDuration(durationSec)} — cutting ${fmtDuration(cut)}`;
    }
    return true;
  }

  function playheadSec(): number {
    const player = mode === "video" ? previewVideo : previewAudio;
    return player?.currentTime ?? 0;
  }

  function setRange(s: number, e: number): void {
    if (startInput) startInput.value = formatTimecode(Math.max(0, s));
    if (endInput) endInput.value = formatTimecode(e);
    validate();
  }

  // ---- run ----
  async function doTrim(): Promise<void> {
    if (!file || !validate()) return;
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

    const copyMode = mode === "audio" || quality === "fast";
    if (workStatus)
      workStatus.textContent =
        "Loading the engine (one-time, ~25 MB)… your file stays on your device.";

    try {
      await ensureFfmpeg(onProgress);
    } catch (err) {
      console.error("[cvt] ffmpeg load failed", err);
      terminateFfmpeg();
      hide(workPanel);
      show(setupPanel);
      if (errorEl) {
        errorEl.textContent =
          "⚠ Couldn't load the engine. This needs a modern desktop browser (Chrome or Edge) and a working connection. Please try again.";
        show(errorEl);
      }
      return;
    }
    if (cancelled) return;
    if (workStatus)
      workStatus.textContent = copyMode
        ? "Cutting on your device — copying the streams, no re-encode. This is quick."
        : "Re-encoding on your device for a frame-exact cut… nothing is uploaded.";

    const srcExt = fileExt(file.name);
    const inName = `input.${srcExt || (mode === "video" ? "mp4" : "bin")}`;

    // Output container: on a stream copy we keep the source container when it's
    // a safe target (copying H.264 into WebM, for example, is invalid). On a
    // re-encode we always land in MP4.
    let outExt: string;
    let mime: string;
    if (mode === "audio") {
      outExt = srcExt || "mp3";
      mime = outExt === "mp3" ? "audio/mpeg" : outExt === "m4a" ? "audio/mp4" : "application/octet-stream";
    } else if (copyMode && COPY_SAFE_VIDEO.has(srcExt)) {
      outExt = srcExt;
      mime = srcExt === "mkv" ? "video/x-matroska" : "video/mp4";
    } else {
      outExt = "mp4";
      mime = "video/mp4";
    }
    const outName = `output.${outExt}`;

    try {
      // -ss BEFORE -i (input seek — instant). See the file header.
      const inputArgs = ["-ss", String(startSec)];
      // -t <duration>, never -to <endpoint>.
      const outputArgs = ["-t", String(endSec - startSec)];

      if (copyMode) {
        outputArgs.push("-c", "copy");
        // -avoid_negative_ts make_zero rebases timestamps to 0 after a keyframe
        // cut; without it some players show a long blank lead-in or refuse to
        // seek in the trimmed file.
        outputArgs.push("-avoid_negative_ts", "make_zero");
      } else {
        outputArgs.push(
          "-c:v", "libx264",
          "-preset", "veryfast",
          "-crf", "20",
          "-c:a", "aac",
          "-b:a", "128k",
        );
      }
      if (outExt === "mp4" || outExt === "m4a" || outExt === "mov") {
        outputArgs.push("-movflags", "+faststart");
      }

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
      showResult(blob, outExt, copyMode);
    } catch (err) {
      if (cancelled) return;
      console.error("[cvt] trim failed", err);
      if (workStatus)
        workStatus.textContent = copyMode
          ? "Trim failed — this file's streams may not copy cleanly into that container. Try Precise mode, which re-encodes."
          : "Trim failed — the file may be too large for this device's memory, or the format isn't supported. Try a shorter range.";
    }
  }

  function showResult(blob: Blob, outExt: string, copyMode: boolean): void {
    hide(workPanel);
    show(resultPanel);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = URL.createObjectURL(blob);

    if (mode === "video") {
      show(resultVideo);
      hide(resultAudio);
      if (resultVideo) resultVideo.src = resultUrl;
      resultAudio?.removeAttribute("src");
    } else {
      hide(resultVideo);
      show(resultAudio);
      if (resultAudio) resultAudio.src = resultUrl;
      resultVideo?.removeAttribute("src");
    }

    // A trim's headline stat is DURATION, not size — and note we deliberately do
    // NOT run /app's "already well compressed" honesty guard here. On a stream
    // copy the size ratio is just the duration ratio, so a smaller file is the
    // expected outcome every time, not a signal worth commenting on.
    //
    // ⚠️ We show the REQUESTED length only until the real one is known. On a
    // keyframe-snapped copy the output can be materially LONGER than requested
    // (a clip whose only keyframe is at 0 will cut from 0 no matter what start
    // you asked for). Printing the requested length as if it were fact is a lie
    // the user can immediately disprove by watching the result, so as soon as
    // the preview reports its real duration we correct the label and say why.
    const requested = endSec - startSec;
    if (resultLen) resultLen.textContent = `${fmtDuration(durationSec)} → ${fmtDuration(requested)}`;
    if (sizeBefore) sizeBefore.textContent = fmtBytes(file?.size ?? 0);
    if (sizeAfter) sizeAfter.textContent = fmtBytes(blob.size);

    const baseHint = copyMode
      ? "Cut without re-encoding, so the quality is identical to the original."
      : "Re-encoded for a frame-exact cut.";
    if (resultHint) resultHint.textContent = baseHint;

    const player = mode === "video" ? resultVideo : resultAudio;
    if (player) {
      player.onloadedmetadata = () => {
        const actual = player.duration;
        if (!isFinite(actual) || actual <= 0) return;
        if (resultLen)
          resultLen.textContent = `${fmtDuration(durationSec)} → ${fmtDuration(actual)}`;
        // >0.75s of drift is visible to a human; explain it rather than let them
        // wonder why they got more than they asked for.
        if (copyMode && Math.abs(actual - requested) > 0.75 && resultHint) {
          resultHint.textContent =
            `${baseHint} You asked for ${fmtDuration(requested)} but got ${fmtDuration(actual)}: a lossless cut can only start on a keyframe, and the nearest one was earlier in the file. Switch to Precise mode for an exact cut.`;
        }
      };
    }

    if (downloadBtn) {
      downloadBtn.href = resultUrl;
      const stem = fileStem(file?.name ?? "clip", "clip");
      downloadBtn.download = `${stem}-trimmed.${outExt}`;
    }
  }

  function reset(): void {
    cancelled = true;
    file = null;
    durationSec = 0;
    startSec = 0;
    endSec = 0;
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      resultUrl = null;
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
    previewVideo?.removeAttribute("src");
    previewAudio?.removeAttribute("src");
    resultVideo?.removeAttribute("src");
    resultAudio?.removeAttribute("src");
    if (fileInput) fileInput.value = "";
    if (startInput) startInput.value = "";
    if (endInput) endInput.value = "";
    hide(errorEl);
    if (infoEl) infoEl.textContent = "";
    if (trimBtn) {
      trimBtn.disabled = false;
      trimBtn.classList.remove("is-disabled");
    }
    hide(setupPanel);
    hide(workPanel);
    hide(resultPanel);
    show($("cvt-intro"));
  }

  // ================= wire up =================
  // The pick button lives INSIDE the dropzone, and both open the picker. Without
  // stopPropagation one tap fires it twice, and iOS Safari (one picker per user
  // gesture) silently dismisses BOTH — leaving the user stuck. See commit
  // e687278 on /app for the original bug.
  pickBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.click();
  });
  dropzone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const f = fileInput.files?.[0];
    if (f) void ingest(f);
  });

  tabVideo?.addEventListener("click", () => switchMode("video"));
  tabAudio?.addEventListener("click", () => switchMode("audio"));
  qFast?.addEventListener("click", () => { quality = "fast"; applyQuality(); });
  qPrecise?.addEventListener("click", () => { quality = "precise"; applyQuality(); });

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

  startInput?.addEventListener("input", validate);
  endInput?.addEventListener("input", validate);
  setStartBtn?.addEventListener("click", () => {
    if (startInput) startInput.value = formatTimecode(playheadSec());
    validate();
  });
  setEndBtn?.addEventListener("click", () => {
    if (endInput) endInput.value = formatTimecode(playheadSec());
    validate();
  });

  rangeChips?.querySelectorAll("[data-range]").forEach((b) => {
    b.addEventListener("click", () => {
      const kind = (b as HTMLElement).dataset.range;
      if (!durationSec) return;
      if (kind === "first30") setRange(0, Math.min(30, durationSec));
      else if (kind === "last30") setRange(Math.max(0, durationSec - 30), durationSec);
      else if (kind === "middle") {
        const mid = durationSec / 2;
        const half = Math.min(15, durationSec / 4);
        setRange(mid - half, mid + half);
      } else setRange(0, durationSec);
    });
  });

  trimBtn?.addEventListener("click", () => void doTrim());
  cancelBtn?.addEventListener("click", () => {
    cancelled = true;
    terminateFfmpeg();
    reset();
  });
  againBtn?.addEventListener("click", reset);
  again2Btn?.addEventListener("click", reset);

  // defaults
  const wantAudio = new URLSearchParams(location.search).get("mode") === "audio";
  if (wantAudio) mode = "audio";
  applyModeCopy();
  applyQuality();
  // vidH is probed for parity with /app's ingest and to keep future resolution
  // work honest; referenced here so strict TS doesn't flag it as unused.
  void vidH;
}
