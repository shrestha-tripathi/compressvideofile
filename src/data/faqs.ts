/** Shared FAQ copy — used by /faq/ (visible + FAQPage JSON-LD) and /llms-full.txt. */
export const faqs: { q: string; a: string }[] = [
  {
    q: `Is it really free?`,
    a: `Yes — completely free. No signup, no watermark, no premium tier, and no ads on the compressor itself. Because the entire tool runs in your browser using WebAssembly, there are no upload servers or storage to pay for, so there's simply nothing to charge you for. Compress as many videos as you like.`,
  },
  {
    q: `Does my video get uploaded?`,
    a: `No. Your video is processed entirely on your own device and never leaves your browser. The only thing that loads from the network is the compressor's code (the ffmpeg.wasm binary) — that's program code, not your file. Once it has loaded, the actual compression happens locally in memory. You can even disconnect from the internet after it loads and it still works.`,
  },
  {
    q: `How do I compress a video for WhatsApp?`,
    a: `Open the compressor, drop your video in, and tap the “WhatsApp (16 MB)” preset (or “WhatsApp HD doc (64 MB)” for the document-send path). We calculate the right bitrate to hit that size, compress on your device, and give you a download — all without uploading the clip to any website first. This is the private way to shrink a video for WhatsApp.`,
  },
  {
    q: `Will it lose quality?`,
    a: `Compression always trades some quality for a smaller size, but you stay in control. A larger target size keeps more detail; a small target (like the 16 MB WhatsApp preset on a long clip) trades more. For most short clips the difference is barely noticeable. You can also lower the resolution (e.g. 1080p → 720p) to spend the bitrate more efficiently.`,
  },
  {
    q: `Can I compress an MP3 or an audio file?`,
    a: `Yes. Switch to the Audio tab and drop in an MP3, M4A, AAC, WAV, FLAC, OGG or Opus file — including WhatsApp voice notes. Instead of a target size you pick a bitrate: 192 or 128 kbps for music, 64 kbps for speech. The output is MP3 (plays everywhere) or M4A/AAC (smaller at the same quality). Like video, it's all processed on your device and never uploaded.`,
  },
  {
    q: `Can I trim a video or audio file?`,
    a: `Yes, two ways. The compressor has an optional “Trim” panel where you set a start and end time before compressing. Or use the dedicated trim tool, which cuts without compressing — scrub the preview, hit “Playhead” to drop each marker, and download. Both accept times as mm:ss or hh:mm:ss.`,
  },
  {
    q: `Does trimming lose quality?`,
    a: `Not in fast mode. Cutting a file doesn't inherently require re-encoding it — the audio and video streams can simply be copied into a new container between two points, which is why a large clip trims in about a second and comes out identical to the original. Precise mode does re-encode, so it's frame-exact but slightly lossy, like any re-encode.`,
  },
  {
    q: `Why did my trimmed video start earlier than I asked?`,
    a: `That's the keyframe snap. A lossless stream copy can only begin cutting at a keyframe, and video files only place keyframes every few seconds — so if your start time falls between two of them, the cut begins at the previous one and you get a slightly longer clip. The tool tells you when this happens. Switch to Precise mode for a cut that lands exactly where you asked.`,
  },
  {
    q: `What video formats are supported?`,
    a: `You can drop in MP4, MOV (iPhone), WebM, MKV, AVI, and most common formats. The output is always H.264 MP4 with AAC audio and +faststart, which plays everywhere — phones, browsers, WhatsApp, email, Discord — and starts playing before it finishes downloading.`,
  },
  {
    q: `Does it work on iPhone?`,
    a: `Yes — it runs in Safari and Chrome on iOS, and it handles .mov files from your camera roll. Because phones have less memory than laptops, very large or very long videos can be tight on iOS; if a file is huge, the app shows a gentle warning and you can pick a smaller target or trim the clip first. Android Chrome handles large files comfortably.`,
  },
  {
    q: `Is there a file size limit?`,
    a: `There's no hard limit we impose — the practical ceiling is your device's memory, since everything is processed in-browser. Short clips and typical phone videos compress quickly. Multi-gigabyte files work best on a desktop with plenty of RAM. The app warns you before attempting something that might strain your device's memory.`,
  },
  {
    q: `How is this different from FreeConvert, Clideo, or VEED?`,
    a: `Those tools upload your video to their servers, compress it there, then let you download it — which is slower and means a copy of your personal video sits on someone else's machine. Compress Video File does the compression on your own device, so your video never uploads at all. That's the whole point: same result, none of the privacy trade-off.`,
  },
  {
    q: `Do I need to install anything?`,
    a: `No install and no account. It runs in any modern browser. You can optionally “install” it as a lightweight app from your browser's menu (Add to Home Screen / Install) for a one-tap icon, but every feature works directly from the browser tab.`,
  },
  {
    q: `Can I choose the exact output size?`,
    a: `Yes. Besides the purpose presets (WhatsApp, Email, Discord, Discord Nitro), there's a custom target-size slider so you can aim for an exact number of megabytes, plus a resolution selector (Keep / 1080p / 720p / 480p). We compute the matching video bitrate and warn you if a target is implausibly small for the clip's length.`,
  },
];
