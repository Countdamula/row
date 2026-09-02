// =============================================================
// make-hero-library.mjs — the Asclepion's hero photograph.
//
// Turns the source JPG into images_by_admin/asclepion/hero-library.webp.
// Run it again and it reproduces the same file; the original in
// Downloads is never written to, and neither is anything already in
// images_by_admin.
//
// WHY WEBP, WHEN THE SOURCE IS ALREADY ONLY 108KB
// Not for the bytes. The picture is 736x1308 and the hero is
// full-screen, so at 1920 wide the browser upscales it 2.6x — and a
// 2.6x upscale of JPEG's 8x8 blocks turns the smooth near-black
// gradients of this room into visible banding. WebP's larger
// transform and better handling of low-amplitude gradients survives
// that enlargement noticeably better. The page also lays a fine
// grain over it, which is what actually hides the rest.
//
// NO IMAGE LIBRARY IS INSTALLED, so the encode runs in headless
// Chrome's <canvas> — the same route clean-hero-figure.mjs took.
// =============================================================
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire('C:/Users/Damian/Desktop/WEBSITE BUILDING/package.json');
const puppeteer = require('puppeteer');

const SRC = process.argv[2] || 'C:/Users/Damian/Downloads/891ff84ca68abc20be50742ac14220aa.jpg';
const OUT = path.join('C:/Users/Damian/row/images_by_admin/asclepion', 'hero-library.webp');

if (!fs.existsSync(SRC)) {
  console.error('source not found: ' + SRC);
  process.exit(1);
}

const b64 = fs.readFileSync(SRC).toString('base64');
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');

const data = await page.evaluate(async (src) => {
  const img = new Image();
  img.src = 'data:image/jpeg;base64,' + src;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  // 0.92, not 0.8. The whole picture lives in the bottom fifth of the
  // range, where quantisation error is proportionally enormous — the
  // usual "you cannot see the difference" quality settings are set for
  // pictures that use the whole range.
  return { url: c.toDataURL('image/webp', 0.92), w: c.width, h: c.height };
}, b64);

await browser.close();

const bytes = Buffer.from(data.url.split(',')[1], 'base64');
fs.writeFileSync(OUT, bytes);
console.log(`${OUT}\n${data.w}x${data.h}  ${bytes.length.toLocaleString()} bytes ` +
  `(source ${fs.statSync(SRC).size.toLocaleString()})`);
