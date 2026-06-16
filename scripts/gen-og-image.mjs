// Generate the Open Graph preview image (1200x630, social-card standard).
// Run via `node scripts/gen-og-image.mjs`.
//
// Design: deep near-black background with a blue accent glow, the Compress
// Video File brand mark + wordmark, a big headline, a subline, and a
// "compress %" pill — so the card reads as a privacy-first video compressor
// when links unfurl on WhatsApp / X / Discord / iMessage.
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const W = 1200;
const H = 630;

// Brand mark — same geometry as public/favicon.svg, flat white, scaled.
const brandMark = `
  <g transform="translate(80, 96) scale(0.34)">
    <rect x="64" y="118" width="312" height="276" rx="46"
          fill="none" stroke="#ffffff" stroke-width="30"/>
    <circle cx="150" cy="256" r="30" fill="#ffffff"/>
    <path d="M376 196 L456 142 L456 370 L376 316 Z" fill="#ffffff"/>
    <g stroke="#ffffff" stroke-width="30" stroke-linecap="round"
       stroke-linejoin="round" fill="none">
      <path d="M236 200 L236 300"/>
      <path d="M196 266 L236 308 L276 266"/>
    </g>
  </g>
`;

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0a0a"/>
      <stop offset="100%" stop-color="#141821"/>
    </linearGradient>
    <radialGradient id="glow" cx="84%" cy="18%" r="62%">
      <stop offset="0%" stop-color="#2563eb" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="#2563eb" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- Subtle grid texture -->
  <g stroke="#ffffff" stroke-opacity="0.04" stroke-width="1">
    ${Array.from({ length: 24 }, (_, i) => `<line x1="${i * 50}" y1="0" x2="${i * 50}" y2="${H}"/>`).join("")}
    ${Array.from({ length: 13 }, (_, i) => `<line x1="0" y1="${i * 50}" x2="${W}" y2="${i * 50}"/>`).join("")}
  </g>

  ${brandMark}

  <!-- Wordmark next to the logo -->
  <text x="232" y="190" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="46" font-weight="700" fill="#ffffff" letter-spacing="-0.5">Compress Video File</text>

  <!-- Big headline -->
  <g transform="translate(80, 360)">
    <text font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="72" font-weight="700" fill="#ffffff" letter-spacing="-2">
      <tspan x="0" y="0">Compress any video,</tspan>
      <tspan x="0" y="90">right in your browser.</tspan>
    </text>
  </g>

  <!-- Subline -->
  <g transform="translate(80, 568)">
    <text font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="29" font-weight="400" fill="#a1a7b3">
      It never uploads · No watermark · No signup · Free
    </text>
  </g>

  <!-- Accent pill bottom-right -->
  <g transform="translate(${W - 300}, ${H - 92})">
    <rect width="220" height="46" rx="23" fill="#2563eb"/>
    <text x="110" y="30" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="16" font-weight="600" fill="#ffffff" letter-spacing="0.5">100% ON-DEVICE</text>
  </g>
</svg>
`;

const buf = await sharp(Buffer.from(svg)).png({ quality: 92 }).toBuffer();
writeFileSync("public/og-image.png", buf);
console.log(`✓ public/og-image.png (${W}x${H}, ${(buf.length / 1024).toFixed(1)} KB)`);
