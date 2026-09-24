/**
 * WebMCP — progressive enhancement that exposes the EXISTING tool UI to
 * in-browser AI agents via `navigator.modelContext` (W3C WebMCP draft).
 *
 * Rules:
 *  - Feature-detect; if absent, no-op. Never throws (everything try/catch'd).
 *  - No processing logic here — tools only set the existing controls and click
 *    the existing buttons, so compressor.ts / trimmer.ts remain the single
 *    source of truth. The file itself never leaves the device.
 */

type ToolResult = { content: { type: "text"; text: string }[] };
interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
}

const text = (t: string): ToolResult => ({ content: [{ type: "text", text: t }] });
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T | null;
const visible = (el: HTMLElement | null) => !!el && !el.classList.contains("hidden");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Wait until one of the panels is visible (or timeout). */
async function waitFor(ids: string[], timeoutMs: number): Promise<string | null> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    for (const id of ids) if (visible($(id))) return id;
    await sleep(500);
  }
  return null;
}

export function registerWebMcp(tools: WebMcpTool[]): void {
  try {
    const mc = (navigator as unknown as { modelContext?: any }).modelContext;
    if (!mc) return;
    const safe = tools.map((t) => ({
      ...t,
      execute: async (args: Record<string, unknown>) => {
        try {
          return await t.execute(args ?? {});
        } catch (e) {
          return text(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
      },
    }));
    if (typeof mc.registerTool === "function") {
      for (const t of safe) {
        try {
          mc.registerTool(t);
        } catch {
          /* ignore duplicate / unsupported */
        }
      }
    } else if (typeof mc.provideContext === "function") {
      mc.provideContext({ tools: safe });
    }
  } catch {
    /* never break the page */
  }
}

const PRESET_IDS = ["wa", "wahd", "email", "discord", "nitro"] as const;

/** /app/ — drives the compressor UI built by compressor.ts. */
export const compressVideoTool: WebMcpTool = {
  name: "compress_video",
  description:
    "Compress the video loaded in this page's compressor to a target size, entirely in the user's browser (no upload). Use a preset (wa=WhatsApp 16 MB, wahd=WhatsApp document 64 MB, email=25 MB, discord=10 MB (free upload limit), nitro=500 MB) or targetMB (2–500). If no video is loaded yet, this opens the file picker and the user must choose a file, then call again.",
  inputSchema: {
    type: "object",
    properties: {
      targetMB: { type: "number", minimum: 2, maximum: 500, description: "Target output size in megabytes." },
      preset: { type: "string", enum: [...PRESET_IDS], description: "Named size preset; overrides targetMB." },
      resolution: { type: "string", enum: ["keep", "1080", "720", "480"], description: "Optional output resolution." },
    },
  },
  async execute(args) {
    // Must be in video mode.
    const tabVideo = $("cvf-tab-video");
    if (tabVideo && tabVideo.getAttribute("aria-selected") !== "true") tabVideo.click();

    const preset = typeof args.preset === "string" ? args.preset : undefined;
    const mb = typeof args.targetMB === "number" ? args.targetMB : undefined;
    let chosen = "";
    if (preset) {
      const btn = document.querySelector<HTMLElement>(`#cvf-presets [data-preset="${CSS.escape(preset)}"]`);
      if (!btn) return text(`Unknown preset "${preset}". Use one of: ${PRESET_IDS.join(", ")}.`);
      btn.click();
      chosen = `preset "${preset}"`;
    } else if (mb !== undefined) {
      const range = $<HTMLInputElement>("cvf-custom");
      if (!range) return text("Compressor controls not found on this page.");
      const v = Math.min(500, Math.max(2, Math.round(mb)));
      range.value = String(v);
      range.dispatchEvent(new Event("input", { bubbles: true }));
      chosen = `${v} MB`;
    }
    const res = typeof args.resolution === "string" ? args.resolution : undefined;
    const sel = $<HTMLSelectElement>("cvf-res");
    if (res && sel && [...sel.options].some((o) => o.value === res)) {
      sel.value = res;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }

    if (!visible($("cvf-setup"))) {
      $("cvf-pick")?.click();
      return text(
        `No video is loaded yet. I opened the file picker (target ${chosen || "unchanged"}); ask the user to choose a video, then call compress_video again. The file stays on the device.`,
      );
    }

    const warn = $("cvf-warn");
    $("cvf-compress")?.click();
    const done = await waitFor(["cvf-result", "cvf-setup"], 5 * 60_000);
    if (done === "cvf-result") {
      const before = $("cvf-size-before")?.textContent ?? "?";
      const after = $("cvf-size-after")?.textContent ?? "?";
      const reduce = $("cvf-reduce")?.textContent ?? "";
      return text(`Done (${chosen || "current target"}). ${before} → ${after} (${reduce}). The user can press Download on the page.`);
    }
    if (done === "cvf-setup" && visible(warn)) return text(`Compression did not run: ${warn?.textContent?.trim()}`);
    return text(`Compression started with ${chosen || "the current target"}; it is still running (progress shown on the page).`);
  },
};

/** /trim/ — drives the trimmer UI built by trimmer.ts. */
export const trimVideoTool: WebMcpTool = {
  name: "trim_video",
  description:
    "Trim the video or audio loaded in this page's trimmer to a start/end time (mm:ss or hh:mm:ss), in the user's browser. mode 'fast' copies streams without re-encoding (may snap to a keyframe); 'precise' re-encodes for a frame-exact cut. If no file is loaded, this opens the file picker; call again after the user picks one.",
  inputSchema: {
    type: "object",
    properties: {
      start: { type: "string", description: "Start time, e.g. 0:05" },
      end: { type: "string", description: "End time, e.g. 1:30" },
      mode: { type: "string", enum: ["fast", "precise"] },
    },
    required: ["start", "end"],
  },
  async execute(args) {
    if (!visible($("cvt-setup"))) {
      $("cvt-pick")?.click();
      return text("No file is loaded yet. I opened the file picker; ask the user to choose a file, then call trim_video again.");
    }
    const setVal = (id: string, v: unknown) => {
      const el = $<HTMLInputElement>(id);
      if (el && typeof v === "string") {
        el.value = v;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    };
    setVal("cvt-start", args.start);
    setVal("cvt-end", args.end);
    if (args.mode === "precise") $("cvt-q-precise")?.click();
    else if (args.mode === "fast") $("cvt-q-fast")?.click();

    const err = $("cvt-error");
    if (visible(err) && err?.textContent?.trim()) return text(`Invalid range: ${err.textContent.trim()}`);
    $("cvt-trim")?.click();
    const done = await waitFor(["cvt-result"], 5 * 60_000);
    if (done) {
      const len = $("cvt-result-len")?.textContent?.trim() ?? "";
      return text(`Trimmed. ${len} The user can press Download on the page.`);
    }
    return text("Trim started; still running (progress shown on the page).");
  },
};
