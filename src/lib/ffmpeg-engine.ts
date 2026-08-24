/**
 * ffmpeg.wasm engine — the SINGLE owner of every ffmpeg core gotcha in this repo.
 *
 * Both /app (compress) and /trim (cut) go through here. Do NOT instantiate
 * FFmpeg anywhere else — the pins and comments below are hard-won and must not
 * be duplicated or drift.
 *
 * The user's file NEVER uploads. Only the ffmpeg WebAssembly binary is fetched
 * from a CDN (it's code, not user data), converted to a same-origin blob URL via
 * toBlobURL so it works under COEP: require-corp. Work runs in a Web Worker on
 * the user's machine.
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

/** Called with 0-100 as the job progresses. */
export type ProgressFn = (pct: number) => void;

let ffmpeg: FFmpeg | null = null;
let loaded = false;

/**
 * Lazily create + load the ffmpeg engine. Safe to call repeatedly — the loaded
 * instance is cached. Load is deliberately deferred to the first FILE PICK, not
 * page load, so visitors never pay ~25 MB for a page they bounce off.
 *
 * Guarded by a 45s race: if load() doesn't resolve, we reject so the UI can show
 * an error + retry instead of spinning at 0% forever.
 */
export async function ensureFfmpeg(onProgress?: ProgressFn): Promise<FFmpeg> {
  if (ffmpeg && loaded) {
    if (onProgress) attachProgress(ffmpeg, onProgress);
    return ffmpeg;
  }
  const ff = new FFmpeg();
  if (onProgress) attachProgress(ff, onProgress);

  // Always the single-threaded core: the multi-threaded core crashes mid-encode
  // in real browsers (`function signature mismatch`) regardless of version.
  const cfg = {
    coreURL: await toBlobURL(`${BASE_ST}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${BASE_ST}/ffmpeg-core.wasm`, "application/wasm"),
  };
  await Promise.race([
    ff.load(cfg),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("ffmpeg load timed out after 45s")), 45000),
    ),
  ]);
  ffmpeg = ff;
  loaded = true;
  return ff;
}

let progressHandler: ((e: { progress: number }) => void) | null = null;
function attachProgress(ff: FFmpeg, onProgress: ProgressFn): void {
  if (progressHandler) {
    try { ff.off("progress", progressHandler); } catch { /* ignore */ }
  }
  progressHandler = ({ progress }) => {
    onProgress(Math.max(0, Math.min(100, Math.round(progress * 100))));
  };
  ff.on("progress", progressHandler);
}

/**
 * Kill the engine (Cancel button). The worker is terminated and the cached
 * instance dropped so the next run does a clean load — a half-dead worker
 * cannot be reused reliably.
 */
export function terminateFfmpeg(): void {
  try { ffmpeg?.terminate(); } catch { /* ignore */ }
  ffmpeg = null;
  loaded = false;
  progressHandler = null;
}

/** True once a core is loaded — lets the UI say "engine ready" on repeat runs. */
export const isFfmpegLoaded = (): boolean => loaded;

/**
 * Run one job end-to-end: write input → exec → read output → clean the virtual
 * FS. Returns a Blob of the requested mime type.
 *
 * `args` must NOT include the input or output filenames — pass them via
 * `inputArgs` (things that must precede -i, e.g. `-ss`) and `outputArgs`. This
 * split exists because argument ORDER is load-bearing in ffmpeg:
 *   -ss BEFORE -i  = input seek, instant (jumps in the container)
 *   -ss AFTER  -i  = output seek, decodes and throws away everything up to the
 *                    mark — catastrophically slow on a long file.
 */
export async function runJob(opts: {
  file: File;
  inName: string;
  outName: string;
  /** Args placed BEFORE -i (input seek etc). */
  inputArgs?: string[];
  /** Args placed AFTER -i, before the output filename. */
  outputArgs: string[];
  mime: string;
  onProgress?: ProgressFn;
  /** Checked after exec so a cancelled job doesn't produce a result. */
  isCancelled?: () => boolean;
}): Promise<Blob | null> {
  const ff = await ensureFfmpeg(opts.onProgress);
  const buf = new Uint8Array(await opts.file.arrayBuffer());
  await ff.writeFile(opts.inName, buf);

  const args = [
    ...(opts.inputArgs ?? []),
    "-i",
    opts.inName,
    ...opts.outputArgs,
    opts.outName,
  ];
  await ff.exec(args);
  if (opts.isCancelled?.()) return null;

  const data = (await ff.readFile(opts.outName)) as Uint8Array;
  // Copy into a fresh ArrayBuffer so the Blob owns clean memory.
  const out = new Uint8Array(data.byteLength);
  out.set(data);
  const blob = new Blob([out], { type: opts.mime });

  try { await ff.deleteFile(opts.inName); } catch { /* ignore */ }
  try { await ff.deleteFile(opts.outName); } catch { /* ignore */ }

  return blob;
}
