# SPEC — Audio on the homepage + Trim (in-app & standalone tool)

**Repo:** `compressvideofile` · **Date:** 2026-08-24 · Status: **AWAITING APPROVAL**

Three asks:
1. Homepage reads as video-only — surface the audio compressor.
2. Add trim (custom start/end timestamps) to the compress flow.
3. A separate trim-only tool in the same app.

---

## 0. Pushback / scope re-negotiation (read this first)

### 0.1 ✅ Keep #2 and #3 as separate surfaces — but ONE engine

My first instinct was "3 is redundant, trim is just a checkbox in 2." **I was wrong, for
an SEO reason, not a product reason.** `/app/` currently ranks (or will) on *compress*
stems. "trim video online", "cut mp3 online", "trim video without uploading" are a
**different keyword cluster** and cannot be won from a page whose H1 says "Compress a
video." A dedicated `/trim/` page is a second indexable entry point at near-zero marginal
build cost once the engine is shared.

**But** they must not be two implementations. Plan is: extract the shared engine, then
both pages are thin controllers over it.

### 0.2 🔑 The trim tool's whole differentiator is that it does NOT re-encode

This is the design decision that matters most and it's easy to get wrong.

Compression = `libx264` re-encode = slow, lossy. **Trimming needs neither.**
`-c copy` remuxes the container: a 500 MB 4K clip trims in **~0.4 s with zero quality
loss**, and — critically — **skips the ~25 MB ffmpeg wasm CPU cost entirely** on the
encode side. That's a genuinely different, much better product than "compressor with a
range slider."

The catch: `-c copy` can only cut on **keyframes**, so the actual start can land up to
~2–10 s before your mark. So we ship **two modes**:

| Mode | Args | Speed | Quality | Accuracy |
|---|---|---|---|---|
| **Fast (default)** | `-ss X -i in -t D -c copy` | instant | **lossless** | snaps to nearest keyframe |
| **Precise** | `-ss X -i in -t D -c:v libx264 -preset veryfast -c:a aac` | slow | re-encoded | exact to the frame |

Default = Fast, with a one-line honest explainer + a "start is slightly off?" nudge to
Precise. Audio trims are effectively always frame-accurate on copy, so for audio we
hide the toggle and always use copy.

⚠️ **`-ss` must go BEFORE `-i`** (input seek — instant). After `-i` it decodes and
discards everything up to the mark, which on a long file is catastrophically slow.
And use **`-t <duration>`, never `-to <endpoint>`** — `-to`'s meaning relative to a
preceding `-ss` has changed between ffmpeg versions and is a real footgun. Compute
`D = end - start` in JS and pass `-t D`. Unambiguous everywhere.

### 0.3 ⚠️ Brand dilution — flagging, not blocking

Domain is `compressvideofile.com`. A trim tool is adjacent but off-name. I think it's
worth it (same audience, same moat, same engine, new keywords), and it's how every
competitor in this space grew. But it does mean the site becomes "a browser media
toolkit" rather than "a video compressor" — the homepage and nav have to acknowledge
that or it reads as scope creep. **§2 handles this.** Say the word if you'd rather keep
the site single-purpose and put trim in a separate repo/domain instead.

### 0.4 🩸 Trim-inside-compress has a warning case you must not skip

If someone trims 60 s → 10 s **and** keeps the "WhatsApp 16 MB" preset, the bitrate
math (`targetMB*8192 / duration`) now divides by 10 s instead of 60 s → the video
bitrate goes 6× higher. Output is still ≤16 MB (correct!) but the estimate line and the
"very small target" warning both go stale the instant the trim changes.
**`updateEstimate()` must use the trimmed duration, not the source duration.** This is
a one-line bug that would otherwise ship silently.

### 0.5 ❌ Out of scope (calling it now)

- Waveform / thumbnail scrubbing strip. Nice, but it's a whole feature and needs
  decode-to-canvas work. Ship v1 with the native `<video>` preview + "Set start from
  playhead" buttons, which gets 90% of the ergonomics for ~5% of the work.
- Multi-segment / cut-out-the-middle. One range only.
- Fade in/out, volume normalise.

---

## 1. Architecture — extract the engine first

`src/lib/compressor.ts` is 672 lines and welded to `cvf-*` IDs. Copy-pasting it for
`/trim/` would be the worst possible outcome. Refactor:

```
src/lib/
  ffmpeg-engine.ts   NEW  — CORE_VERSION, BASE_ST, ensureFfmpeg(), the 45s load
                            race, terminate(). Zero DOM. Single owner of the
                            ffmpeg.wasm gotchas documented in the skill.
  media-file.ts      NEW  — AUDIO_EXT / VIDEO_EXT, acceptFor(mode),
                            probeMedia(File) → {durationSec, w, h},
                            fmtBytes(), fmtDuration(), parseTimecode(),
                            formatTimecode()
  compressor.ts      EDIT — imports both; drops its local copies
  trimmer.ts         NEW  — /trim/ controller
```

**Non-negotiable:** `ffmpeg-engine.ts` keeps the single-threaded ESM `@ffmpeg/core@0.12.9`
pin and the "MT is disabled because it crashes with `function signature mismatch`"
comment verbatim. That comment is the most expensive line in this repo.

---

## 2. Homepage — stop looking video-only

Current state: H1, hero sub, all 6 features, all 3 steps, both CTAs, every FAQ teaser
and the JSON-LD `featureList` are 100% video. Audio compression shipped in `bad9a6e`
and is **invisible to a visitor**.

Changes to `src/pages/index.astro`:

- **Eyebrow:** `Video & audio compressor · 100% in your browser · Never uploads`
- **H1:** `Compress any video or audio — right in your browser.` *(keeps "compress" +
  "video" stems dominant for SEO; adds the audio stem)*
- **Hero sub:** mention MP3/M4A/WAV alongside MP4/MOV/WebM.
- **CTA row → three buttons:** `Compress a video` (accent) · `Compress audio` (outline,
  → `/app/?mode=audio`) · `Trim a clip` (outline, → `/trim/`).
- **New "What's in the toolkit" section** (3 cards, above How-it-works) — this is the
  §0.3 fix. Cards: Video compressor / Audio compressor / **Trim & cut (new)**. Each
  links to its surface. Makes the site legibly multi-tool instead of looking like scope
  drift.
- **Feature grid:** swap the weakest card for **"Audio too — MP3, M4A, WAV, FLAC"**;
  add **"Trim without re-encoding"**.
- **Steps:** step 1 → "Drop your video *or audio*"; step 2 mentions trimming.
- **FAQ teasers:** add *"Can I compress an MP3 or voice note?"* and *"Can I cut a clip
  without losing quality?"*
- **JSON-LD `featureList`:** add the audio + trim entries, add `alternateName`
  `"Audio compressor"`, `"Trim video online"`.

**Header** (`Header.astro`): nav gains `Trim`; CTA label `Compress a video` → **`Open the app`**
(it currently mislabels a two-mode tool).

### 2.1 `?mode=audio` deep link
`/app/` reads `?mode=audio` on init and starts on the Audio tab. Needed for the new
homepage CTA and for any future "compress mp3 online" landing copy. Trivial: parse in
`applyModeCopy()` bootstrap, before `selectPreset`.

---

## 3. Trim inside `/app/` (the compress flow)

**Where:** a collapsed `<details>` block in the setup panel, *below* the mode-specific
controls, above the estimate line. Collapsed by default — must not add friction to the
"drop → preset → go" path that works today.

```
▸ Trim (optional) — cut to just the part you need
```

Expanded contents:
- A `<video>`/`<audio>` **preview of the source file** (object URL, revoked on reset).
- **Start** and **End** text inputs, `mm:ss` or `hh:mm:ss` (`inputmode="numeric"`).
- Two **"Use current playhead"** buttons, one per field. This is the ergonomic win —
  scrub, click, done. No waveform needed.
- Live label: `Trimmed length: 0:12 (from 1:34)`.
- A `Reset trim` link.

**State:** `trimStart: number|null`, `trimEnd: number|null` (seconds). Both null = no trim.

**Validation:** `0 ≤ start < end ≤ durationSec`; min length **0.5 s**; on invalid, the
Compress button disables and an inline (not `alert()`) message shows.

**Args:** when trimming, prepend `-ss <start>` **before** `-i` and add `-t <end-start>`
after `-i`. Everything else in the existing encode path is untouched.

**§0.4 fix:** `effectiveDuration()` = `trimmed ? end-start : durationSec`, and
`targetVideoKbps()` + `updateEstimate()` both switch to it. Estimate line gains
`· trimmed to 0:12` when active.

**Download name:** `{stem}-compressed.{ext}` → `{stem}-trimmed-compressed.{ext}`.

**Reset:** `reset()` and `switchMode()` clear trim state and revoke the preview URL.

---

## 4. `/trim/` — the standalone tool

New page `src/pages/trim.astro` + `src/lib/trimmer.ts`. CSS contract `.cvt-*`
(mirrors `.cvf-*`; reuses `.cvf-dropzone/-progress/-spinner/-seg` classes — **no new CSS
beyond what's needed**, and any new token must be verified present in both themes).

**Flow:** identical state machine to `/app/` — intro → setup → working → result.

**Mode tabs:** same Video/Audio segmented control. Deliberate: a combined
`video/*,audio/*` accept would need every explicit audio extension pinned (Windows
registry empty-picker trap, `6e56ab6`) *and* would widen the video `accept`, which the
project skill warns can reopen the iOS double-picker bug (`e687278`). **Two tabs = zero
new picker risk.** Reuse `acceptFor(mode)` from `media-file.ts`.

**Setup panel:**
- Source preview player (large — it's the primary control here, unlike in `/app/`).
- Start / End inputs + playhead buttons + trimmed-length readout.
- Quick-range chips: `First 30s` · `Last 30s` · `Middle` · `Full`.
- **Video only:** `Trim quality` segmented control — **`Fast (lossless)` [default]** vs
  `Precise (re-encode)`. With the honest one-liner: *"Fast keeps the original quality
  and finishes instantly, but the cut snaps to the nearest keyframe — the start can land
  a second or two early. Precise is exact but re-encodes."*
- Output format: video → keep source container where safe, else `.mp4`. Audio → keep
  source extension on copy (a copy-trimmed MP3 stays an MP3).

**Args:**
```
fast/audio : -ss {start} -i in -t {dur} -c copy -movflags +faststart out.{ext}
precise    : -ss {start} -i in -t {dur} -c:v libx264 -preset veryfast -crf 20
             -c:a aac -b:a 128k -movflags +faststart out.mp4
```
CRF 20 (not target-bitrate) — trim isn't a size-targeting operation, so quality-constant
is the right knob.

**Result panel:** preview + download + **`Compress this →`** button that hands the
trimmed blob straight to `/app/`. That handoff is the reason both tools live in one app.
v1 implementation: stash the blob in a module-level `sessionStorage`-keyed
`URL.createObjectURL` handoff — **or**, simpler and more robust, just navigate with the
trimmed file kept in an in-memory singleton since both pages are same-origin SPA-less…
⚠️ they're separate documents, so in-memory dies. **Decision: v1 ships the button as
"Download, then compress" copy pointing at `/app/`. A true blob handoff needs OPFS and
is a follow-up.** Flagging rather than silently shipping a broken handoff.

**Result stat:** trim shows **`1:34 → 0:12`** and `92 MB → 11 MB`. Note the
"Already well compressed" honesty guard is **compressor-only** — it must not fire here
(a trim legitimately produces a smaller file every time, and on `-c copy` the ratio is
just the duration ratio).

---

## 5. SEO / supporting pages

- **`sitemap.xml.ts`:** add `/trim/` at priority `0.9`, `changefreq: weekly`.
- **`trim.astro` JSON-LD:** own `WebApplication` node, `@id` `${site.url}/trim#webapp`,
  `alternateName: ["Trim video online","Cut MP3 online","Video trimmer","Audio trimmer"]`,
  plus the auto-breadcrumb already wired in `7842934`.
- **Title:** `Trim Video & Audio Online — No Upload, No Re-encode` (58 chars).
- **`faq.astro`:** +4 Q&As (audio formats · voice notes · trim quality loss · keyframe
  accuracy). These feed the existing FAQPage schema, so it's free rich-result surface.
- **`how-it-works.astro`:** new section on trim + why `-c copy` is lossless. This is the
  single best "explain the moat" page and currently doesn't mention audio at all.
- **`about.astro`:** one line — the project is now compress + trim.

---

## 6. Commits (one feature each, in order)

| # | Commit | Files |
|---|---|---|
| 1 | `refactor(lib): extract ffmpeg-engine + media-file from compressor` | new `ffmpeg-engine.ts`, `media-file.ts`; `compressor.ts` slimmed. **Zero behaviour change** — verify `/app/` still compresses video AND audio before moving on. |
| 2 | `feat(home): surface audio compression + toolkit section` | `index.astro`, `Header.astro`, `+ ?mode=audio` in `compressor.ts` |
| 3 | `feat(app): optional trim with start/end timestamps` | `app.astro`, `compressor.ts` (incl. the §0.4 effectiveDuration fix) |
| 4 | `feat(trim): standalone lossless trim tool at /trim/` | `trim.astro`, `trimmer.ts`, `global.css`, `sitemap.xml.ts` |
| 5 | `content(seo): FAQ + how-it-works cover audio & trimming` | `faq.astro`, `how-it-works.astro`, `about.astro` |

---

## 7. Verification gate (per commit)

```bash
cd ~/projects/compressvideofile
npm run build      # expect 10 pages after #4 (was 9), 0 errors
npx astro check    # 0/0/0
grep -c 'Cross-Origin-Opener-Policy' public/_headers   # must still be 1
```
Plus, per the project skill: **grep the built bundle, not just source** —
`dist/_astro/*.js` must contain `-c`,`copy`, `-ss`, `cvt-`, and still contain
`libmp3lame` + `-vn`. Source-only greps have produced false confidence here before.
Both themes: `--color-bg` present twice + a `prefers-color-scheme: dark` block.

Real-device check on your phone is the final gate — headless desktop ≠ mobile Safari.

---

## 8. Open questions for you

1. **§0.3** — happy for the site to become "browser media toolkit", or keep it
   single-purpose and put trim elsewhere?
2. **§4 handoff** — accept "Download, then compress" for v1, or do you want the real
   OPFS blob handoff now (adds ~1 commit)?
3. **§0.5** — confirm no waveform scrubber in v1?
