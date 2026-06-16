// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// Static, SEO-first output for Cloudflare Pages (custom-domain, root deploy).
//
// site: canonical origin — env-driven so a domain change is a deploy-var edit.
//   The .pages.dev rejection guard lives in src/site.config.ts (used for every
//   canonical/OG/sitemap URL); this `site` value feeds Astro's own URL helpers.
// base: "/" — root deploy on a custom domain (NOT a GitHub-Pages subpath).
// trailingSlash: "always" — Cloudflare Pages 308-redirects /foo -> /foo/ and
//   serves the 200 only at the slash form. Emitting trailing slashes everywhere
//   keeps canonical, sitemap, and breadcrumb URLs aligned with what CF serves —
//   otherwise Google logs "Page with redirect" + "Alternate page with proper
//   canonical tag". Also makes the dev server match prod.
const SITE = process.env.PUBLIC_SITE_URL ?? "https://compressvideofile.com";

export default defineConfig({
  site: SITE,
  base: "/",
  trailingSlash: "always",
  vite: {
    plugins: [tailwindcss()],
    // ffmpeg.wasm ships pre-bundled ESM workers; don't let Vite try to
    // pre-bundle or transform the core packages.
    optimizeDeps: {
      exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
    },
  },
});
