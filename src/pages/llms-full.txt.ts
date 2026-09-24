import type { APIRoute } from "astro";
import { buildLlms } from "../lib/llms";

export const GET: APIRoute = () =>
  new Response(buildLlms([], true), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
