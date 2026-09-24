import type { APIRoute } from "astro";
import { buildLlms } from "../lib/llms";
import { pseo } from "../data/pseo";

const guides = [
  { path: "/guides/", desc: "Index of all video compression guides." },
  ...pseo.map((e) => ({ path: `/guides/${e.slug}/`, desc: e.metaDescription })),
];

export const GET: APIRoute = () =>
  new Response(buildLlms(guides, true), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
