import { pseoA } from "./pseo-a";
import { pseoB } from "./pseo-b";
import type { PseoEntry } from "./pseo-types";
export type { PseoEntry, PseoFaq } from "./pseo-types";

export const pseo: PseoEntry[] = [...pseoA, ...pseoB];
export const pseoBySlug = new Map(pseo.map((e) => [e.slug, e]));
