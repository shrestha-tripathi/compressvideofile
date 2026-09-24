/**
 * Types for the programmatic SEO guides (src/pages/guides/[slug].astro).
 * Claims must match what the app does: ffmpeg.wasm in the browser, output is
 * H.264/AAC MP4 (+faststart), target size via bitrate math, optional downscale
 * to 1080p/720p/480p, optional trim. Inputs MP4/MOV/WebM/MKV/AVI. No upload.
 */
export interface PseoFaq { q: string; a: string }
export interface PseoEntry {
  slug: string;
  title: string;
  h1: string;
  metaDescription: string;
  intro: string;
  steps: string[];
  tips: string[];
  faqs: PseoFaq[];
  related: string[];
  /** Query string for the /app/ CTA (e.g. "?preset=wa"). */
  cta: string;
  ctaLabel: string;
}
