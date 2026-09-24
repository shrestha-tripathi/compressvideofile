/**
 * Shared builder for /llms.txt and /llms-full.txt (llmstxt.org format).
 * Generated at build time (static output) so brand/domain come from
 * site.config and new pages (pSEO) are listed automatically.
 */
import { site, absoluteUrl, lastUpdatedLabel } from "../site.config";
import { faqs } from "../data/faqs";

export interface LlmsPage {
  path: string;
  desc: string;
}

export const corePages: LlmsPage[] = [
  { path: "/", desc: "Homepage: what the tool does, privacy model, presets." },
  { path: "/app/", desc: "The compressor: video (target size in MB) and audio (bitrate) modes, optional trim." },
  { path: "/trim/", desc: "Standalone trimmer: cut video/audio by start/end time; fast mode copies streams without re-encoding." },
  { path: "/how-it-works/", desc: "Technical explanation: ffmpeg.wasm, bitrate math, what (doesn't) touch the network." },
  { path: "/faq/", desc: "Frequently asked questions: pricing, privacy, formats, iPhone, limits." },
  { path: "/about/", desc: "About the project." },
  { path: "/privacy/", desc: "Privacy policy." },
];

export function buildLlms(extra: LlmsPage[] = [], full = false): string {
  const lines: string[] = [];
  lines.push(`# ${site.name}`);
  lines.push("");
  lines.push(`> Free, in-browser video and audio compressor and trimmer. Files are processed on the user's device with ffmpeg compiled to WebAssembly and are never uploaded.`);
  lines.push("");
  lines.push(`What it does: shrinks MP4, MOV, WebM, MKV and AVI videos to a chosen target size (presets for WhatsApp 16 MB, email 25 MB, Discord, or a custom 2–500 MB slider, plus optional downscale to 1080p/720p/480p) and outputs H.264/AAC MP4 with +faststart. Audio mode re-encodes MP3/M4A/WAV/FLAC/OGG/Opus to MP3 or M4A at a chosen bitrate. The trim tool cuts clips by timestamp, losslessly in fast mode.`);
  lines.push("");
  lines.push(`Privacy: the only network fetch is the ffmpeg.wasm program code from a CDN; the user's file stays in browser memory. No account, no watermark, no cost.`);
  lines.push("");
  lines.push(`Limits: large or long files are bounded by device memory (tighter on iPhone), and in-browser encoding is single-threaded, so it is slower than desktop software. Fast-mode trims snap to keyframes and can be slightly longer than requested.`);
  lines.push("");
  lines.push(`Publisher: ${site.publisherName} (${site.publisherUrl}). Last updated: ${lastUpdatedLabel}.`);
  lines.push("");
  lines.push("## Pages");
  lines.push("");
  for (const p of corePages) lines.push(`- [${p.path}](${absoluteUrl(p.path)}): ${p.desc}`);
  if (extra.length) {
    lines.push("");
    lines.push("## Guides");
    lines.push("");
    for (const p of extra) lines.push(`- [${p.path}](${absoluteUrl(p.path)}): ${p.desc}`);
  }
  if (full) {
    lines.push("");
    lines.push("## FAQ");
    for (const f of faqs) {
      lines.push("");
      lines.push(`### ${f.q}`);
      lines.push("");
      lines.push(f.a);
    }
  }
  lines.push("");
  return lines.join("\n");
}
