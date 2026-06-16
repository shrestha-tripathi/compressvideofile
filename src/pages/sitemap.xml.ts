import type { APIRoute } from "astro";
import { site } from "../site.config";

/**
 * Dynamic sitemap — hand-maintained static route list (small site, low churn,
 * explicit control over what's indexed). NO content collection here: this
 * project has no blog, so we emit the static list only.
 *
 * Every <loc> goes through `new URL(path, site.url)` with a trailing slash to
 * match `trailingSlash: "always"` + what Cloudflare Pages serves, so the
 * sitemap never disagrees with each page's canonical.
 *
 * Priority guide:
 *   1.0  — homepage (primary entry point)
 *   0.9  — /app (the compressor — the money/conversion page)
 *   0.7  — how-it-works, faq, about (primary content)
 *   0.5  — contact (technical)
 *   0.3  — privacy, terms (legal — trust signals, not SEO targets)
 */
export const GET: APIRoute = async () => {
  const today = new Date().toISOString().slice(0, 10);

  const pages = [
    { path: "/", priority: "1.0", changefreq: "weekly" },
    { path: "/app/", priority: "0.9", changefreq: "weekly" },
    { path: "/how-it-works/", priority: "0.7", changefreq: "monthly" },
    { path: "/faq/", priority: "0.7", changefreq: "monthly" },
    { path: "/about/", priority: "0.7", changefreq: "monthly" },
    { path: "/contact/", priority: "0.5", changefreq: "yearly" },
    { path: "/privacy/", priority: "0.3", changefreq: "yearly" },
    { path: "/terms/", priority: "0.3", changefreq: "yearly" },
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (p) => `  <url>
    <loc>${new URL(p.path, site.url).toString()}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;

  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
