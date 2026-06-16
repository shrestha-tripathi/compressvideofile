// One-shot: generate PWA icons (192, 512, 512-maskable, apple-touch 180) +
// favicon.ico (multi-res 16/32/48) + favicon-32.png from the brand mark.
// Run via `node scripts/gen-icons.mjs`.
//
// Design: the Compress Video File mark (film frame + lens + tape wedge +
// down-arrow) rendered WHITE on the brand blue (#2563eb) so the icon reads
// crisply at every size and on any OS launcher background. The favicon.svg
// itself stays gradient-blue-on-transparent for in-browser tabs; here we
// rasterize a solid white-on-blue variant for the app-icon contexts.
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { writeFileSync } from "node:fs";

// Brand mark drawn in WHITE, viewBox 0 0 512 512 (same geometry as
// public/favicon.svg but flat white so it pops on the blue plate).
const markSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect x="64" y="118" width="312" height="276" rx="46"
        fill="none" stroke="#ffffff" stroke-width="30"/>
  <circle cx="150" cy="256" r="30" fill="#ffffff"/>
  <path d="M376 196 L456 142 L456 370 L376 316 Z" fill="#ffffff"/>
  <g stroke="#ffffff" stroke-width="30" stroke-linecap="round"
     stroke-linejoin="round" fill="none">
    <path d="M236 200 L236 300"/>
    <path d="M196 266 L236 308 L276 266"/>
  </g>
</svg>`;

// Brand blue plate (matches --color-accent / theme_color #2563eb).
const PLATE = { r: 0x25, g: 0x63, b: 0xeb, alpha: 1 };

const renderIcon = async (size, { maskable = false } = {}) => {
  // Maskable icons need a ~10% safe zone so launchers can crop to a circle
  // without clipping the mark; standard icons use a tighter inset.
  const innerScale = maskable ? 0.62 : 0.78;
  const innerSize = Math.round(size * innerScale);
  const offset = Math.round((size - innerSize) / 2);
  const inner = await sharp(Buffer.from(markSvg))
    .resize(innerSize, innerSize)
    .png()
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: PLATE },
  })
    .composite([{ input: inner, top: offset, left: offset }])
    .png()
    .toBuffer();
};

writeFileSync("public/icon-192.png", await renderIcon(192));
writeFileSync("public/icon-512.png", await renderIcon(512));
writeFileSync("public/icon-512-maskable.png", await renderIcon(512, { maskable: true }));
writeFileSync("public/apple-touch-icon.png", await renderIcon(180));
writeFileSync("public/favicon-32.png", await renderIcon(32));
console.log("✓ Icons: 192, 512, 512-maskable, apple-touch (180), favicon-32");

// favicon.ico — multi-res container (16/32/48) for Windows, legacy browsers,
// and pinned tabs.
const ico16 = await renderIcon(16);
const ico32 = await renderIcon(32);
const ico48 = await renderIcon(48);
const ico = await pngToIco([ico16, ico32, ico48]);
writeFileSync("public/favicon.ico", ico);
console.log(`✓ favicon.ico (16/32/48, ${(ico.length / 1024).toFixed(1)} KB)`);
