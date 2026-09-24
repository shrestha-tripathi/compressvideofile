import type { PseoEntry } from "./pseo-types";

/** Format / source guides and target-size guides. */
export const pseoB: PseoEntry[] = [
  {
    slug: "compress-mp4-video",
    title: "Compress an MP4 Video — Free, Online, No Upload",
    h1: "Compress an MP4 video without uploading it",
    metaDescription:
      "Reduce MP4 file size to an exact target in MB, in your browser. H.264/AAC output, no watermark, no upload, no signup.",
    intro:
      "MP4 is already a compressed format, so shrinking it further means re-encoding at a lower bitrate. Instead of guessing a quality setting, you pick the size you need in MB and the tool works out the bitrate from the video's duration. The output is a standard H.264/AAC MP4 with faststart, so it plays anywhere and streams quickly.",
    steps: [
      "Open the compressor.",
      "Load your MP4.",
      "Choose a preset (WhatsApp, email, Discord) or set a custom size with the slider (2–500 MB).",
      "Optionally lower the resolution — this matters most for long videos at small sizes.",
      "Compress and download the new MP4.",
    ],
    tips: [
      "If the target is bigger than the original's bitrate allows, the file won't shrink — you can't add quality back.",
      "Bitrate ≈ target size ÷ duration. Halving the length lets you double the quality at the same size.",
      "Very long or 4K MP4s are limited by browser memory; trimming first helps on phones.",
    ],
    faqs: [
      { q: "Will compressing an MP4 lose quality?", a: "Some, since it's re-encoded at a lower bitrate. At sensible targets (and with a lower resolution for long clips) the difference is often hard to see on phones and laptops." },
      { q: "Is there a file size limit?", a: "There's no server limit because nothing is uploaded. The practical limit is your device's memory, which is tighter on iPhones." },
      { q: "Why is it slower than desktop apps?", a: "Encoding runs in WebAssembly inside the browser, which is slower than native software with hardware encoders. The trade-off is that your file never leaves your device." },
    ],
    related: ["compress-mov-video", "reduce-video-size-to-25mb", "compress-video-for-email"],
    cta: "",
    ctaLabel: "Compress an MP4",
  },
  {
    slug: "compress-mov-video",
    title: "Compress a MOV Video and Convert to MP4 — Free",
    h1: "Compress a MOV file (and convert it to MP4)",
    metaDescription:
      "Shrink large MOV files from iPhone, Mac or cameras and convert them to widely compatible MP4 in one step. Runs in your browser, no upload.",
    intro:
      "MOV is Apple's QuickTime container, used by iPhones, macOS screen recordings and many cameras. The files are often huge and don't always play on Windows or Android. Compressing here re-encodes the video to H.264/AAC in an MP4 container, so you get a smaller file and better compatibility at the same time.",
    steps: [
      "Open the compressor.",
      "Load your MOV file.",
      "Pick a target size — Email (25 MB) is a good default for sharing.",
      "Lower the resolution to 1080p or 720p if the MOV is 4K.",
      "Compress and download — the result is an .mp4 file.",
    ],
    tips: [
      "ProRes MOVs from cameras are very large; memory limits may apply, so trim first if you can.",
      "The output keeps your aspect ratio, including vertical video.",
      "If a MOV won't load, it may use a codec the browser build can't decode — try exporting it as H.264 first.",
    ],
    faqs: [
      { q: "Does it convert MOV to MP4?", a: "Yes. Video output is always H.264/AAC in an MP4 container, regardless of input format." },
      { q: "Can I compress iPhone HEVC MOV files?", a: "Usually yes. HEVC decoding runs in ffmpeg.wasm; it's slower than H.264, and very long 4K clips can hit memory limits on phones." },
      { q: "Is my MOV uploaded?", a: "No. The file stays in your browser's memory and is processed locally." },
    ],
    related: ["compress-iphone-video", "compress-mp4-video", "compress-screen-recording"],
    cta: "?preset=email",
    ctaLabel: "Compress a MOV to MP4",
  },
  {
    slug: "compress-iphone-video",
    title: "Compress an iPhone Video — Free, Right in Safari",
    h1: "Compress an iPhone video",
    metaDescription:
      "Shrink big iPhone videos (4K, HEVC, MOV) to a shareable MP4 right in Safari. No app to install, no upload, free.",
    intro:
      "Recent iPhones record 4K HEVC video by default, which can use a lot of space per minute and often isn't accepted by messaging apps and email. You can compress it straight from Safari: choose the video from your Photos library, pick a size, and save a much smaller MP4 to Files or share it directly.",
    steps: [
      "Open the compressor in Safari on your iPhone.",
      "Tap to choose a file and pick the video from your Photo Library.",
      "Choose a preset (WhatsApp, Email) or a custom size, and set 1080p or 720p.",
      "Keep Safari in the foreground while it compresses — iOS may pause background tabs.",
      "Download the MP4 and save or share it from the Files app.",
    ],
    tips: [
      "iPhones give browsers less memory than desktops. For long 4K clips, trim first or compress on a computer.",
      "Picking 720p speeds up encoding noticeably on a phone.",
    ],
    faqs: [
      { q: "Does it work on iPhone?", a: "Yes, in Safari and other iOS browsers. Performance and maximum file size depend on the phone's memory, so very long 4K videos may be too large." },
      { q: "Where does the compressed video go?", a: "It downloads to the Files app (usually Downloads). From there you can save it to Photos or share it." },
      { q: "Is the video uploaded?", a: "No. Compression runs locally in the browser on your iPhone." },
    ],
    related: ["compress-mov-video", "compress-video-for-whatsapp", "compress-video-for-instagram"],
    cta: "?preset=email&res=720",
    ctaLabel: "Compress an iPhone video",
  },
  {
    slug: "compress-screen-recording",
    title: "Compress a Screen Recording — Keep Text Sharp",
    h1: "Compress a screen recording",
    metaDescription:
      "Shrink screen recordings from macOS, Windows, OBS or Loom-style captures to a small MP4 while keeping text readable. Free, private, in-browser.",
    intro:
      "Screen recordings are often recorded at high bitrates and full display resolution, so a few minutes can reach hundreds of MB. The good news is that screen content compresses extremely well — most pixels stay still between frames. Keeping resolution at 1080p and lowering the size target usually gives a small file with perfectly readable text.",
    steps: [
      "Open the compressor with 1080p resolution and a 25 MB target.",
      "Load your recording (macOS MOV, Windows MP4, OBS MKV all work).",
      "Trim off the start and end where you're setting up or stopping the recording.",
      "Compress and download the MP4.",
      "Share it in Slack, email, a ticket or docs.",
    ],
    tips: [
      "Resolution matters more than bitrate for text: prefer 1080p at a lower size over 480p at a higher size.",
      "Retina/4K screen captures shrink dramatically at 1080p with little visible loss for UI.",
      "Recordings with lots of scrolling or video playback need a larger target.",
    ],
    faqs: [
      { q: "Why are screen recordings so large?", a: "Recorders use high bitrates so capture doesn't drop frames. Re-encoding afterwards at a targeted size removes most of that overhead." },
      { q: "Will text stay readable?", a: "At 1080p it usually does, even at small sizes, because static screen areas cost very little bitrate." },
      { q: "Is it safe for confidential recordings?", a: "The recording is processed on your device and never uploaded, which makes it suitable for internal material." },
    ],
    related: ["compress-video-for-slack", "compress-mov-video", "compress-mkv-video"],
    cta: "?mb=25&res=1080",
    ctaLabel: "Compress a screen recording",
  },
  {
    slug: "compress-mkv-video",
    title: "Compress an MKV Video and Convert to MP4 — Free",
    h1: "Compress an MKV video (and convert it to MP4)",
    metaDescription:
      "Shrink MKV files from OBS or other sources and convert them to MP4 that plays on phones, Discord and social apps. In-browser, no upload.",
    intro:
      "MKV (Matroska) is popular for OBS recordings because it survives crashes, but many apps and phones won't play or accept it. Compressing it here converts to H.264/AAC MP4 in the same pass, so the clip becomes both smaller and shareable almost everywhere.",
    steps: [
      "Open the compressor.",
      "Load your .mkv file.",
      "Choose a target — Discord (10 MB) for clips, or a custom size for longer recordings.",
      "Set 720p for long gameplay; keep 1080p for short highlights.",
      "Compress and download the MP4.",
    ],
    tips: [
      "If your OBS setup records mic and game audio to separate tracks, mix them into one track in OBS so the clip has all the sound you expect.",
      "Long, high-bitrate MKVs may exceed browser memory — trim the part you need.",
    ],
    faqs: [
      { q: "Does it convert MKV to MP4?", a: "Yes. Video output is always an H.264/AAC MP4." },
      { q: "Why won't my MKV play on my phone?", a: "Many phone players and social apps don't support the MKV container. Converting to MP4 fixes that." },
      { q: "Is anything uploaded?", a: "No. The MKV is processed locally in your browser." },
    ],
    related: ["compress-video-for-discord", "compress-webm-video", "compress-screen-recording"],
    cta: "?preset=discord",
    ctaLabel: "Compress an MKV",
  },
  {
    slug: "compress-webm-video",
    title: "Compress a WebM Video and Convert to MP4 — Free",
    h1: "Compress a WebM video (and convert it to MP4)",
    metaDescription:
      "Turn WebM recordings from browsers and screen tools into small MP4s that play on iPhone, WhatsApp and email clients. Free and private.",
    intro:
      "WebM (VP8/VP9 video) is what many browser-based recorders and web tools produce. It's efficient, but some apps and older Apple devices don't play it well. Compressing here converts WebM to H.264/AAC MP4 at the size you choose, giving you a file that plays essentially everywhere.",
    steps: [
      "Open the compressor.",
      "Load your .webm file.",
      "Pick a preset or custom target size.",
      "Lower resolution for long recordings.",
      "Compress and download the MP4.",
    ],
    tips: [
      "WebM is already efficient, so converting at a similar bitrate may not shrink it much — pick a smaller target.",
      "Some browser-recorded WebMs lack duration metadata; if the size estimate looks off, trimming can help.",
      "Opus audio is re-encoded to AAC for MP4 compatibility.",
    ],
    faqs: [
      { q: "Does it convert WebM to MP4?", a: "Yes. The output is always H.264/AAC MP4." },
      { q: "Why doesn't my WebM play on iPhone?", a: "Support for WebM varies across Apple apps and older iOS versions. MP4 with H.264 is universally supported." },
      { q: "Is my file uploaded?", a: "No — conversion and compression happen in your browser." },
    ],
    related: ["compress-mkv-video", "compress-mp4-video", "compress-video-for-whatsapp"],
    cta: "?preset=email",
    ctaLabel: "Compress a WebM",
  },
  {
    slug: "reduce-video-size-to-10mb",
    title: "Reduce Video Size to 10 MB — Free, In Browser",
    h1: "Reduce a video to under 10 MB",
    metaDescription:
      "Compress any video to under 10 MB for Discord, forms, and strict email servers. Pick 10 MB and download an MP4. Free, no upload.",
    intro:
      "10 MB is the limit for Discord free uploads and a common cap on web forms, job portals and corporate email. It's tight: at 10 MB, one minute of video gets roughly 1.3 Mbps after audio. That's fine for 480p–720p, so combining a lower resolution with a trim is the key to a result that still looks good.",
    steps: [
      "Open the compressor with a 10 MB target (the button below sets it).",
      "Load your video.",
      "Trim to the essential part.",
      "Pick 720p for clips under a minute, 480p for longer.",
      "Compress and download the MP4.",
    ],
    tips: [
      "Approximate video bitrate at 10 MB: 30 s ≈ 2.5 Mbps, 60 s ≈ 1.2 Mbps, 3 min ≈ 0.4 Mbps.",
      "Below ~0.5 Mbps even 480p gets blocky — trim harder instead.",
      "Talking-head and screen content hold up much better than sports or gameplay.",
    ],
    faqs: [
      { q: "How long a video fits in 10 MB?", a: "Roughly 1 minute at decent 720p quality, or 2–3 minutes at 480p. Motion-heavy footage needs more." },
      { q: "Will it be exactly 10 MB?", a: "It targets just under 10 MB with a small safety margin; the final size can vary slightly." },
      { q: "Is it free?", a: "Yes, with no watermark and no upload." },
    ],
    related: ["compress-video-for-discord", "reduce-video-size-to-25mb", "compress-video-for-outlook"],
    cta: "?mb=10",
    ctaLabel: "Compress to 10 MB",
  },
  {
    slug: "reduce-video-size-to-25mb",
    title: "Reduce Video Size to 25 MB — Free, No Upload",
    h1: "Reduce a video to under 25 MB",
    metaDescription:
      "Compress a video to under 25 MB for Gmail and most email attachments. Choose the size, get an MP4. Private, in-browser, free.",
    intro:
      "25 MB is Gmail's attachment limit and a common upper limit for email in general. At 25 MB you have about 3.3 Mbps for a one-minute video — comfortably enough for sharp 1080p talking-head footage, or several minutes at 720p.",
    steps: [
      "Open the compressor with the 25 MB Email preset.",
      "Load your video.",
      "Trim if needed.",
      "Keep 1080p for clips under ~1 minute; choose 720p for 2–5 minutes.",
      "Compress and download the MP4.",
    ],
    tips: [
      "Approximate video bitrate at 25 MB: 1 min ≈ 3.2 Mbps, 3 min ≈ 1 Mbps, 5 min ≈ 0.6 Mbps.",
      "For email, a little under 25 MB is safer because of attachment encoding overhead.",
      "Long lectures or meetings: 480p keeps them under 25 MB for longer runtimes.",
    ],
    faqs: [
      { q: "How long a video fits in 25 MB?", a: "About 1–2 minutes at good 1080p, or around 3–5 minutes at 720p, depending on motion." },
      { q: "Can I email a 25 MB video with Gmail?", a: "Aim slightly lower (20–24 MB) because the limit applies to the encoded email, which is larger than the file." },
      { q: "Does it add a watermark?", a: "No." },
    ],
    related: ["compress-video-for-gmail", "reduce-video-size-to-10mb", "reduce-video-size-to-50mb"],
    cta: "?preset=email",
    ctaLabel: "Compress to 25 MB",
  },
  {
    slug: "reduce-video-size-to-50mb",
    title: "Reduce Video Size to 50 MB — Free, In Browser",
    h1: "Reduce a video to under 50 MB",
    metaDescription:
      "Compress a video to under 50 MB for uploads, chat apps and portals with a 50 MB cap. Pick 50 MB and download an MP4. No upload.",
    intro:
      "50 MB is a frequent cap on upload forms, LMS/assignment portals and some chat tools, and it's a comfortable size for sharing a few minutes of good-quality video. At 50 MB, a three-minute clip gets roughly 2 Mbps — solid 720p or decent 1080p.",
    steps: [
      "Open the compressor with a 50 MB target.",
      "Load your video.",
      "Trim unwanted sections.",
      "Keep 1080p for up to ~3 minutes; 720p for longer.",
      "Compress and download the MP4.",
    ],
    tips: [
      "Approximate video bitrate at 50 MB: 1 min ≈ 6.5 Mbps, 3 min ≈ 2 Mbps, 10 min ≈ 0.6 Mbps.",
      "For assignment portals, check whether the limit is 50 MB or 50 MiB — the tool's margin covers both.",
      "If the original is already under ~6 Mbps, a 1-minute clip won't get smaller at 50 MB.",
    ],
    faqs: [
      { q: "How long a video fits in 50 MB?", a: "Roughly 3–5 minutes at 1080p or up to ~10 minutes at 720p for low-motion content." },
      { q: "Why didn't my file get smaller?", a: "If its current bitrate is already below what 50 MB allows, re-encoding can't reduce it meaningfully. Choose a smaller target." },
      { q: "Is it private?", a: "Yes. It runs in your browser; the video isn't uploaded." },
    ],
    related: ["reduce-video-size-to-25mb", "reduce-video-size-to-100mb", "compress-video-for-telegram"],
    cta: "?mb=50",
    ctaLabel: "Compress to 50 MB",
  },
  {
    slug: "reduce-video-size-to-100mb",
    title: "Reduce Video Size to 100 MB — Free, No Upload",
    h1: "Reduce a video to under 100 MB",
    metaDescription:
      "Compress large phone or camera videos to under 100 MB while keeping high quality. Choose 100 MB, get an MP4. Free and private.",
    intro:
      "100 MB is a common limit for upload forms and file-sharing tools, and a sensible size for high-quality longer clips. It's generous: ten minutes of 1080p still gets over 1 Mbps, and short 4K phone clips can be cut from hundreds of MB to 100 MB with little visible loss.",
    steps: [
      "Open the compressor with a 100 MB target.",
      "Load your video.",
      "Trim if you only need part of it.",
      "Keep the original resolution for short clips; choose 1080p for 4K sources.",
      "Compress and download the MP4.",
    ],
    tips: [
      "Approximate video bitrate at 100 MB: 2 min ≈ 6.5 Mbps, 5 min ≈ 2.5 Mbps, 10 min ≈ 1.2 Mbps.",
      "Large inputs take longer and need more memory; desktop browsers handle them best.",
      "Downscaling 4K to 1080p is usually the single biggest size win with the least visible cost.",
    ],
    faqs: [
      { q: "How long a video fits in 100 MB?", a: "Roughly 5–10 minutes at good 1080p quality, depending on motion." },
      { q: "Can I compress a 1 GB file?", a: "Often yes on a desktop browser with enough memory. Phones may run out of memory with files that large." },
      { q: "Is there a cost?", a: "No. It's free, with no account and no watermark." },
    ],
    related: ["reduce-video-size-to-50mb", "compress-video-for-instagram", "compress-mov-video"],
    cta: "?mb=100",
    ctaLabel: "Compress to 100 MB",
  },
];
