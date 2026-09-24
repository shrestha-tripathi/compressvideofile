import type { PseoEntry } from "./pseo-types";

/** Platform guides (messaging, email, social). */
export const pseoA: PseoEntry[] = [
  {
    slug: "compress-video-for-whatsapp",
    title: "Compress a Video for WhatsApp (16 MB) — Free, No Upload",
    h1: "Compress a video for WhatsApp",
    metaDescription:
      "Shrink a video under WhatsApp's ~16 MB media limit in your browser. Free, no upload, no watermark — outputs an MP4 that plays in every chat.",
    intro:
      "WhatsApp typically caps videos sent as regular media at around 16 MB, and it recompresses whatever you send, often heavily. Compressing the clip yourself first lets you choose the trade-off: the WhatsApp preset targets 16 MB and writes an H.264/AAC MP4, the format WhatsApp plays natively on Android, iPhone and desktop.",
    steps: [
      "Open the compressor with the WhatsApp preset (the button below sets a 16 MB target).",
      "Choose or drop your video. MP4, MOV, WebM, MKV and AVI are accepted.",
      "Optionally trim to the part you actually want to send — shorter clips keep far more quality at 16 MB.",
      "If the video is long, set resolution to 720p or 480p so the bitrate isn't spread too thin.",
      "Press Compress, then download the MP4 and attach it in WhatsApp as a normal video.",
    ],
    tips: [
      "Rough rule: at 16 MB, one minute of video gets about 2 Mbps — fine for 720p, tight for 1080p.",
      "WhatsApp may still re-encode on its side; starting at a sensible size means less damage from that second pass.",
      "Clips over a couple of minutes look better sent as a document (see the WhatsApp document guide).",
    ],
    faqs: [
      { q: "What is WhatsApp's video size limit?", a: "At the time of writing, videos sent as regular media are typically limited to about 16 MB. Files sent as documents can be much larger (up to 2 GB)." },
      { q: "Is my video uploaded to compress it?", a: "No. Compression runs in your browser with ffmpeg compiled to WebAssembly. The only download is the ffmpeg program code itself; your video stays on your device." },
      { q: "Why does my video still look blurry in WhatsApp?", a: "WhatsApp applies its own compression when sending as media. Trimming and using 720p before sending helps; sending as a document avoids WhatsApp's recompression entirely." },
    ],
    related: ["send-long-video-whatsapp-document", "compress-video-for-telegram", "compress-iphone-video"],
    cta: "?preset=wa",
    ctaLabel: "Compress for WhatsApp (16 MB)",
  },
  {
    slug: "send-long-video-whatsapp-document",
    title: "Send a Long Video on WhatsApp as a Document — Keep Quality",
    h1: "Send a long video on WhatsApp as a document",
    metaDescription:
      "Send long or high-quality videos on WhatsApp without its recompression by attaching them as a document. Shrink first to 64 MB in your browser for fast sending.",
    intro:
      "Attaching a video as a Document on WhatsApp skips the ~16 MB media limit and WhatsApp's recompression — documents can be up to 2 GB. The catch is that big files take a long time to upload on mobile data and use the recipient's storage. The WhatsApp HD preset targets 64 MB: small enough to send quickly, large enough to keep a few minutes of video looking sharp.",
    steps: [
      "Open the compressor with the WhatsApp HD preset (64 MB target).",
      "Load your video and trim it if you only need part of it.",
      "Keep the original resolution for short clips; pick 1080p or 720p for longer ones.",
      "Compress and download the MP4.",
      "In WhatsApp, tap the attach icon, choose Document (not Gallery), and pick the MP4.",
    ],
    tips: [
      "Documents arrive exactly as sent — no WhatsApp recompression — so what you download here is what they'll see.",
      "The recipient taps the file to play it; on most phones it opens in the built-in video player.",
      "Need it even smaller for a slow connection? Use a custom target, e.g. 32 MB.",
    ],
    faqs: [
      { q: "How big can a WhatsApp document be?", a: "WhatsApp allows documents up to 2 GB at the time of writing. Very large files are slow to send and receive, so compressing first is still worthwhile." },
      { q: "Will the video play inline in the chat?", a: "Documents show as a file rather than a video thumbnail. Tapping it opens the phone's player. The MP4 output here plays on Android and iPhone." },
      { q: "Why 64 MB for the HD preset?", a: "It's a practical middle ground: a few minutes of 1080p or longer 720p video at good quality, while still uploading reasonably fast on mobile data." },
    ],
    related: ["compress-video-for-whatsapp", "reduce-video-size-to-50mb", "compress-video-for-telegram"],
    cta: "?preset=wahd",
    ctaLabel: "Compress for WhatsApp document (64 MB)",
  },
  {
    slug: "compress-video-for-discord",
    title: "Compress a Video for Discord (10 MB) — Free, In Browser",
    h1: "Compress a video under Discord's 10 MB limit",
    metaDescription:
      "Get a clip under Discord's 10 MB free upload limit without an upload site. Compresses in your browser to an MP4 that embeds and plays in chat.",
    intro:
      "Discord's free upload limit is 10 MB per file; anything bigger gets rejected unless you have Nitro. The Discord preset targets 10 MB and outputs H.264/AAC MP4, which Discord embeds with an inline player. Because 10 MB is tight, the biggest wins come from trimming to the moment that matters and dropping resolution.",
    steps: [
      "Open the compressor with the Discord preset (10 MB target).",
      "Load your clip — game captures in MKV or MP4 both work.",
      "Trim to just the highlight. A 30-second clip at 10 MB gets roughly 2.5 Mbps.",
      "Set resolution to 720p for anything over ~30 seconds; 480p for over a minute.",
      "Compress, download, and drag the MP4 into your Discord channel.",
    ],
    tips: [
      "Fast motion (shooters, racing) needs more bitrate than talking heads — lean on shorter trims.",
      "The size target has a small safety margin so the result lands under 10 MB, not just over it.",
      "Have Nitro? Use the Nitro preset (500 MB) instead.",
    ],
    faqs: [
      { q: "What is the Discord upload limit without Nitro?", a: "At the time of writing, free accounts can upload files up to 10 MB. Nitro raises this considerably." },
      { q: "Will the compressed video embed in Discord?", a: "Yes. The output is H.264 video with AAC audio in an MP4 container with faststart, which Discord plays inline." },
      { q: "Can I compress OBS or ShadowPlay recordings?", a: "Yes. MKV and MP4 recordings are accepted. Very long, high-bitrate recordings are limited by your device's memory, so trim first if you only need a clip." },
    ],
    related: ["reduce-video-size-to-10mb", "compress-mkv-video", "compress-screen-recording"],
    cta: "?preset=discord",
    ctaLabel: "Compress for Discord (10 MB)",
  },
  {
    slug: "compress-video-for-gmail",
    title: "Compress a Video for Gmail (25 MB Attachment Limit)",
    h1: "Compress a video to attach in Gmail",
    metaDescription:
      "Fit a video under Gmail's 25 MB attachment limit so it attaches directly instead of as a Drive link. Free, private, in-browser compression to MP4.",
    intro:
      "Gmail lets you attach up to 25 MB per message. Go over that and Gmail swaps the attachment for a Google Drive link, which the recipient has to open separately and you have to share correctly. The Email preset targets 25 MB, and the MP4 output opens on Windows, Mac, iPhone and Android without extra software.",
    steps: [
      "Open the compressor with the Email preset (25 MB target).",
      "Load your video and trim any dead air at the start and end.",
      "For clips longer than ~2 minutes, choose 720p to keep the picture clean.",
      "Compress and download the MP4.",
      "In Gmail, click the paperclip and attach the file — it should attach directly with no Drive prompt.",
    ],
    tips: [
      "The 25 MB limit covers the whole email after encoding, so the preset leaves headroom.",
      "Sending several videos? Each counts toward the same 25 MB — compress each to a smaller custom target.",
      "Recipients on other providers may have lower receive limits; 10–20 MB is safer for unknown addresses.",
    ],
    faqs: [
      { q: "What is Gmail's attachment size limit?", a: "Gmail allows attachments up to 25 MB total per email. Larger files are offered as Google Drive links instead." },
      { q: "Why does my 24 MB video still trigger a Drive link?", a: "Attachments grow by roughly a third when encoded for email, and the limit applies to the encoded message. Aim a little lower, e.g. 20 MB, if you're right on the edge." },
      { q: "Is the video sent anywhere during compression?", a: "No. It's processed locally in your browser; nothing is uploaded until you attach it to your email yourself." },
    ],
    related: ["compress-video-for-email", "compress-video-for-outlook", "reduce-video-size-to-25mb"],
    cta: "?preset=email",
    ctaLabel: "Compress for Gmail (25 MB)",
  },
  {
    slug: "compress-video-for-outlook",
    title: "Compress a Video for Outlook (20 MB Attachment Limit)",
    h1: "Compress a video to attach in Outlook",
    metaDescription:
      "Shrink a video under Outlook.com's 20 MB attachment limit in your browser. Free, no upload, MP4 output that opens on any device.",
    intro:
      "Outlook.com typically limits attachments to around 20 MB, and many company Exchange servers set their own caps — often 10–25 MB. Bigger files get turned into OneDrive links or bounce. Targeting 20 MB (or lower for work mail) keeps the video as a real attachment that opens in Windows' built-in player.",
    steps: [
      "Open the compressor with a 20 MB custom target (the button below sets it).",
      "Load your video; trim to the part you need.",
      "Choose 720p for anything over a minute or two.",
      "Compress and download the MP4.",
      "Attach it in Outlook. If a work server rejects it, recompress to 10 MB.",
    ],
    tips: [
      "Corporate mail limits vary — if you don't know the recipient's server, 10 MB is the safe choice.",
      "Encoding overhead means a 20 MB file can exceed a 20 MB limit; the tool's safety margin helps, but 18 MB is safer still.",
      "MP4 (H.264/AAC) plays in Windows Media Player, Films & TV, QuickTime and phones without codecs.",
    ],
    faqs: [
      { q: "What is Outlook's attachment limit?", a: "At the time of writing, Outlook.com typically allows about 20 MB per message. Desktop Outlook with Exchange uses whatever limit your organisation sets." },
      { q: "Why did my attachment bounce even under the limit?", a: "The recipient's server may have a lower limit than yours. Try 10 MB, or share via a link." },
      { q: "Does this work for Outlook on Mac?", a: "Yes — the tool runs in any modern browser, and the MP4 attaches the same way." },
    ],
    related: ["compress-video-for-gmail", "compress-video-for-email", "reduce-video-size-to-10mb"],
    cta: "?mb=20",
    ctaLabel: "Compress for Outlook (20 MB)",
  },
  {
    slug: "compress-video-for-email",
    title: "Compress a Video to Send by Email — Free, No Upload",
    h1: "Compress a video small enough to email",
    metaDescription:
      "Make a video small enough to email as an attachment. Works for Gmail, Outlook, Yahoo and work mail. Free, private, in-browser.",
    intro:
      "Most email providers cap attachments somewhere between 10 and 25 MB, and the recipient's server has to accept it too. Phone videos blow past that in seconds — a minute of 4K from a modern phone can be several hundred MB. Compressing to 25 MB (or less for unknown recipients) and trimming makes a video emailable without file-sharing links.",
    steps: [
      "Open the compressor with the Email preset (25 MB).",
      "Load the video and trim it to what the recipient needs to see.",
      "Pick 720p for longer clips — on a laptop screen it's hard to tell from 1080p at this size.",
      "Compress and download the MP4.",
      "Attach it to your email as usual.",
    ],
    tips: [
      "Unsure what the recipient's server allows? Target 10 MB.",
      "Email adds encoding overhead, so a file right at the limit may still be refused.",
      "For long recordings (lectures, meetings), 480p keeps speech and slides readable at small sizes.",
    ],
    faqs: [
      { q: "What size video can I email?", a: "Gmail allows 25 MB, Outlook.com about 20 MB, and many work servers 10–25 MB. Staying under 10–20 MB is the most compatible." },
      { q: "Which format is best for email?", a: "MP4 with H.264 video and AAC audio — it opens on virtually every computer and phone. That's what this tool outputs." },
      { q: "Do I need to install anything?", a: "No. It runs in the browser; the first run downloads the ffmpeg.wasm program code, then your file is processed locally." },
    ],
    related: ["compress-video-for-gmail", "compress-video-for-outlook", "reduce-video-size-to-25mb"],
    cta: "?preset=email",
    ctaLabel: "Compress for email (25 MB)",
  },
  {
    slug: "compress-video-for-instagram",
    title: "Compress a Video for Instagram — Smaller MP4, Faster Upload",
    h1: "Compress a video for Instagram",
    metaDescription:
      "Shrink a big phone or camera video to a clean 1080p MP4 before posting to Instagram for faster, more reliable uploads. Free and private.",
    intro:
      "Instagram re-encodes everything you upload and displays Reels and Stories at up to 1080 pixels wide, so uploading a huge 4K file mostly just wastes data and time — and big files are more likely to stall on mobile. Converting to 1080p H.264 MP4 at a sensible size gives Instagram a clean source to work from.",
    steps: [
      "Open the compressor with 1080p resolution and a 100 MB target (the button below sets both).",
      "Load your video. 4K phone footage and camera MOV files are fine.",
      "Trim it to your Reel or Story length.",
      "Compress and download the MP4.",
      "Upload it in the Instagram app as usual.",
    ],
    tips: [
      "Don't go too small: Instagram compresses again, so starting from a low-bitrate file compounds the loss. 1080p at 50–100 MB for a minute is plenty.",
      "This tool keeps your aspect ratio — it doesn't crop to 9:16, so frame vertically when recording.",
      "Shorter Stories segments can use a lower target, e.g. 25 MB.",
    ],
    faqs: [
      { q: "Does compressing first improve Instagram quality?", a: "It mainly makes uploads faster and more reliable. Quality is set largely by Instagram's own encoding; a clean 1080p source avoids extra damage from downscaling on their side." },
      { q: "Will it crop my video to 9:16?", a: "No. Resolution scaling keeps the original aspect ratio. Crop in your editor or the Instagram app." },
      { q: "Is my video uploaded to your server?", a: "No — it's compressed on your device. It's only uploaded when you post it to Instagram yourself." },
    ],
    related: ["compress-iphone-video", "compress-mov-video", "reduce-video-size-to-100mb"],
    cta: "?mb=100&res=1080",
    ctaLabel: "Compress for Instagram (1080p)",
  },
  {
    slug: "compress-video-for-telegram",
    title: "Compress a Video for Telegram — Faster Sending",
    h1: "Compress a video for Telegram",
    metaDescription:
      "Telegram accepts big files, but huge videos are slow to send and download. Shrink them in your browser to a streamable MP4 first. Free, no upload.",
    intro:
      "Telegram allows very large files (up to 2 GB on free accounts at the time of writing), so the limit is rarely the problem — the time it takes you to upload and your contacts to download is. Compressing a phone video to 50 MB with faststart enabled makes it start playing quickly in the chat, even on slower connections.",
    steps: [
      "Open the compressor with a 50 MB target.",
      "Load your video and trim anything you don't need.",
      "Keep 1080p for short clips; use 720p if the video runs several minutes.",
      "Compress and download the MP4.",
      "Send it in Telegram. Sending as a video (not a file) gives an inline player.",
    ],
    tips: [
      "The output uses +faststart, so Telegram can stream it before the whole file downloads.",
      "Telegram may compress when you send as video; send as a file to deliver it untouched.",
      "Channels with many viewers benefit most — smaller files mean less data for every subscriber.",
    ],
    faqs: [
      { q: "What is Telegram's file size limit?", a: "At the time of writing, free accounts can send files up to 2 GB and Premium accounts up to 4 GB." },
      { q: "Should I send as a video or a file?", a: "As a video you get an inline player but Telegram may recompress it. As a file, it arrives exactly as compressed here." },
      { q: "Is this free?", a: "Yes — no account, no watermark, no limit on how many videos you compress." },
    ],
    related: ["compress-video-for-whatsapp", "reduce-video-size-to-50mb", "compress-mp4-video"],
    cta: "?mb=50",
    ctaLabel: "Compress for Telegram (50 MB)",
  },
  {
    slug: "compress-video-for-slack",
    title: "Compress a Video for Slack — Smaller Clips for Teammates",
    h1: "Compress a video for Slack",
    metaDescription:
      "Share screen recordings and demos in Slack as small MP4s that preview inline and download fast. Compressed privately in your browser.",
    intro:
      "Slack accepts large uploads (up to 1 GB per file at the time of writing), but workspaces on the free plan have limited visible history, and big videos are slow for teammates on VPNs or mobile. A demo or bug recording compressed to 25 MB previews inline in Slack and downloads in seconds — and since the file never leaves your browser during compression, internal footage stays internal.",
    steps: [
      "Open the compressor with a 25 MB target.",
      "Load your screen recording or clip (MOV from macOS, MP4 or MKV from OBS all work).",
      "Trim to the relevant part — the bug repro or the feature being demoed.",
      "Choose 1080p for screen recordings so text stays readable; 720p for camera footage.",
      "Compress, download and drop the MP4 into the Slack message box.",
    ],
    tips: [
      "Screen recordings compress very well because most of the screen doesn't change between frames.",
      "Text readability depends on resolution more than bitrate — avoid 480p for UI recordings.",
      "Useful for confidential material: compression happens locally, with no third-party upload site involved.",
    ],
    faqs: [
      { q: "What's Slack's file upload limit?", a: "At the time of writing, Slack allows files up to 1 GB. Smaller files still load and preview much faster for everyone." },
      { q: "Will it play inline in Slack?", a: "Slack previews common MP4 (H.264/AAC) files inline, which is the format this tool outputs." },
      { q: "Is my recording uploaded when compressing?", a: "No. It's processed on your device; it only goes to Slack when you post it." },
    ],
    related: ["compress-screen-recording", "reduce-video-size-to-25mb", "compress-mov-video"],
    cta: "?mb=25&res=1080",
    ctaLabel: "Compress for Slack (25 MB)",
  },
];
