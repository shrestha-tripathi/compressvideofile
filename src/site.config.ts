/**
 * Single source of truth for all brand strings + site metadata.
 *
 * NEVER hardcode the brand name or domain anywhere in src/ — always import
 * from here. Every user-facing string is overridable via PUBLIC_SITE_* env
 * vars so a rebrand is a `.env`-only change (no code edits).
 *
 * Includes the `.pages.dev` rejection guard: Cloudflare Pages deploys often
 * set PUBLIC_SITE_URL / PUBLIC_SITE_DOMAIN to the *.pages.dev preview URL in
 * the dashboard, and that stale value otherwise poisons canonical/OG/sitemap
 * forever. We reject any *.pages.dev value and fall back to the real domain.
 */
const env = import.meta.env;

const DEFAULT_DOMAIN = "compressvideofile.com";
const DEFAULT_URL = `https://${DEFAULT_DOMAIN}`;

const rawSiteUrl = env.PUBLIC_SITE_URL ?? DEFAULT_URL;
const siteUrl = /\.pages\.dev/i.test(rawSiteUrl) ? DEFAULT_URL : rawSiteUrl;

const rawDomain = env.PUBLIC_SITE_DOMAIN ?? DEFAULT_DOMAIN;
const domain = /\.pages\.dev/i.test(rawDomain) ? DEFAULT_DOMAIN : rawDomain;

export const site = {
  /** Brand / product name. */
  name: env.PUBLIC_SITE_NAME ?? "Compress Video File",
  /** Short brand name for tight UI (nav, footer wordmark, OG site_name). */
  shortName: env.PUBLIC_SITE_SHORT_NAME ?? "Compress Video",
  /**
   * Short tagline — feeds the homepage <title> (composed as "Brand — tagline")
   * and og:image:alt. Kept short so the homepage title stays ≤ 60 chars and
   * doesn't truncate in Google SERPs.
   */
  tagline:
    env.PUBLIC_SITE_TAGLINE ?? "Compress video in your browser — no upload",
  /** One-sentence description for <meta description> + OG. */
  description:
    env.PUBLIC_SITE_DESCRIPTION ??
    "Free online video compressor that works 100% in your browser. Shrink MP4, MOV, WebM files for WhatsApp, email or Discord — your video never leaves your device. No upload, no watermark, no signup.",
  /** Bare domain (no protocol), e.g. for display + sitemap. */
  domain,
  /** Canonical site origin (protocol + domain, no trailing slash). */
  url: siteUrl,

  /** Contact email for trust pages. */
  contactEmail: env.PUBLIC_SITE_CONTACT_EMAIL ?? "shrestha.tripathi@gmail.com",
  /** Operator/author name — data controller in the privacy policy. */
  author: env.PUBLIC_SITE_AUTHOR ?? "Shrestha Tripathi",
  /** Public GitHub repo (optional; powers "open source" links). */
  githubRepo:
    env.PUBLIC_SITE_GITHUB_REPO ??
    "https://github.com/shrestha-tripathi/compressvideofile",
  /** Legal jurisdiction for the Terms page governing-law clause. */
  jurisdiction: env.PUBLIC_SITE_JURISDICTION ?? "India",

  /**
   * Google Analytics 4 Measurement ID (format: G-XXXXXXXXXX). Empty string
   * disables the gtag.js snippet entirely. Only injected in production builds
   * so localhost dev never pollutes the analytics property. Baked prod default;
   * override per-environment via PUBLIC_GA_MEASUREMENT_ID (set "" to disable
   * for forks/self-hosts).
   */
  gaId: env.PUBLIC_GA_MEASUREMENT_ID ?? "G-BX5CYJVWMK",
} as const;

export type SiteConfig = typeof site;

/**
 * Append a trailing slash to a path so it matches what Cloudflare Pages serves
 * (CF 308-redirects /foo -> /foo/ and returns 200 only at the slash form).
 *
 * Leaves alone:
 *   - the bare root ("" or "/")  -> "/" (never "//")
 *   - query/hash suffixes        -> slash goes before "?"/"#", not after
 *   - real files (…/sitemap.xml) -> a last segment containing "." is untouched
 *
 * Use this for every absolute URL WE emit (canonical, OG, sitemap <loc>,
 * breadcrumb JSON-LD items) so the sitemap/breadcrumb never disagree with the
 * page canonical.
 */
export const withTrailingSlash = (path: string): string => {
  const [base, ...rest] = path.split(/(?=[?#])/);
  const suffix = rest.join("");
  if (base === "" || base === "/") return `/${suffix}`;
  const lastSeg = base.split("/").pop() ?? "";
  if (lastSeg.includes(".")) return `${base}${suffix}`; // /sitemap.xml, /og.png
  return base.endsWith("/") ? `${base}${suffix}` : `${base}/${suffix}`;
};

/**
 * Build an absolute, trailing-slash-normalized URL from a path-only input.
 * `absoluteUrl("/faq")` -> "https://compressvideofile.com/faq/". The single
 * source of truth for canonical / OG / sitemap / breadcrumb absolute URLs.
 *
 * NOTE: this is for real page URLs only. Schema.org `@id` graph anchors that
 * carry a "#fragment" (e.g. `${site.url}/#organization`) must keep their exact
 * raw form for node-stitching and should NOT be routed through here.
 */
export const absoluteUrl = (path: string): string => {
  const origin = site.url.replace(/\/$/, "");
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${withTrailingSlash(clean)}`;
};
