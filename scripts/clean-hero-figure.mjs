import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

// Reproduces images_by_admin/asclepion/hero-figure.webp from the original
// poster. Usage:
//   node scripts/clean-hero-figure.mjs <source.jpg> [outDir]
//
// Puppeteer is not a dependency of this repo — it lives in the workshop at
// Desktop/WEBSITE BUILDING. Reached through createRequire so this script can
// stay here, next to the asset it makes, without adding a dependency to a
// repo that ships to Vercel.
const require_ = createRequire('C:/Users/Damian/Desktop/WEBSITE BUILDING/package.json');
const puppeteer = require_('puppeteer');

const SRC = process.argv[2];
const OUT = process.argv[3] || path.join(process.cwd(), 'images_by_admin', 'asclepion');
if (!SRC) { console.error('usage: node scripts/clean-hero-figure.mjs <source.jpg> [outDir]'); process.exit(1); }

async function inCanvas(fn, arg) {
  const b64 = fs.readFileSync(SRC).toString('base64');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setContent('<body style="margin:0"></body>');
  const res = await page.evaluate(new Function('b64', 'arg', 'return (' + fn.toString() + ')(b64, arg)'), b64, arg);
  await browser.close();
  return res;
}
function write(name, dataurl) {
  fs.writeFileSync(path.join(OUT, name), Buffer.from(dataurl.split(',')[1], 'base64'));
  console.log(name);
}

// =============================================================
// Removing the poster's typography from the artwork.
//
// THREE PIECES OF LETTERING, THREE DIFFERENT PROBLEMS.
//
//  1. "22 JURA", "NL" and the small katakana sit on open ground and touch
//     nothing. They fall outside the figure silhouette on their own, so
//     repainting everything outside the silhouette removes them with no
//     special case at all.
//  2. "BORUTO" and "-TWO BLUE VORTEX-" run BEHIND the head. They are only a
//     black outline away from the hair, so any region-growing method merges
//     them into the figure. Above y=340 the figure is nothing but hair, face
//     and collar — all bright — so that band uses a tight brightness core
//     instead of the silhouette.
//  3. "@AvelChan2nd" is printed ON the belt. No mask helps; the strap is
//     rebuilt column by column from its own tan.
//
// The ground itself is reconstructed by confidence-weighted push-pull over
// the whole frame, so there are no band rectangles to leave a seam.
// =============================================================

const BAND_Y = 340;          // everything above this is the lettering band
const BELT = { x0: 360, x1: 464, y0: 762, y1: 792, scanY0: 756, scanY1: 802 };

const out = await inCanvas(async function (b64, P) {
  const img = new Image(); img.src = 'data:image/jpeg;base64,' + b64; await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight, N = W * H;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
  const src = ctx.getImageData(0, 0, W, H).data;

  const luma = new Float32Array(N), chroma = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const r = src[i * 4], g = src[i * 4 + 1], b = src[i * 4 + 2];
    luma[i] = (r + g + b) / 3;
    chroma[i] = Math.max(r, g, b) - Math.min(r, g, b);
  }

  // ---------- helpers ----------
  const largest = (m) => {
    const comp = new Int32Array(N).fill(-1), stack = new Int32Array(N), sizes = [];
    let nc = 0;
    for (let s = 0; s < N; s++) {
      if (!m[s] || comp[s] >= 0) continue;
      const id = nc++; let cnt = 0, sp = 0; stack[sp++] = s; comp[s] = id;
      while (sp > 0) {
        const i = stack[--sp]; cnt++;
        const x = i % W, y = (i / W) | 0, nb = [];
        if (x > 0) nb.push(i - 1);
        if (x < W - 1) nb.push(i + 1);
        if (y > 0) nb.push(i - W);
        if (y < H - 1) nb.push(i + W);
        if (x > 0 && y > 0) nb.push(i - W - 1);
        if (x < W - 1 && y > 0) nb.push(i - W + 1);
        if (x > 0 && y < H - 1) nb.push(i + W - 1);
        if (x < W - 1 && y < H - 1) nb.push(i + W + 1);
        for (const j of nb) if (m[j] && comp[j] < 0) { comp[j] = id; stack[sp++] = j; }
      }
      sizes.push(cnt);
    }
    let best = 0; for (let i = 1; i < nc; i++) if (sizes[i] > sizes[best]) best = i;
    const o = new Uint8Array(N);
    for (let i = 0; i < N; i++) o[i] = (comp[i] === best) ? 1 : 0;
    return o;
  };
  const morph = (m, r, dilate) => {
    if (r <= 0) return m.slice();
    const pass = (inp, horiz) => {
      const o = new Uint8Array(N);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let hit = dilate ? 0 : 1;
        for (let d = -r; d <= r; d++) {
          const xx = horiz ? x + d : x, yy = horiz ? y : y + d;
          if (xx < 0 || xx >= W || yy < 0 || yy >= H) { if (!dilate) { hit = 0; break; } continue; }
          const v = inp[yy * W + xx];
          if (dilate) { if (v) { hit = 1; break; } } else if (!v) { hit = 0; break; }
        }
        o[y * W + x] = hit;
      }
      return o;
    };
    return pass(pass(m, true), false);
  };
  const fillHoles = (m) => {
    const outside = new Uint8Array(N), stack = new Int32Array(N);
    let sp = 0;
    const push = (i) => { if (!outside[i] && !m[i]) { outside[i] = 1; stack[sp++] = i; } };
    for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
    while (sp > 0) {
      const i = stack[--sp], x = i % W, y = (i / W) | 0;
      if (x > 0) push(i - 1);
      if (x < W - 1) push(i + 1);
      if (y > 0) push(i - W);
      if (y < H - 1) push(i + W);
    }
    const o = new Uint8Array(N);
    for (let i = 0; i < N; i++) o[i] = (m[i] || !outside[i]) ? 1 : 0;
    return o;
  };

  // ---------- the full silhouette (below the lettering band) ----------
  let sil = new Uint8Array(N);
  for (let i = 0; i < N; i++) sil[i] = (luma[i] > 55 || chroma[i] > 16) ? 1 : 0;
  sil = largest(sil);
  sil = morph(sil, 9, true);
  sil = morph(sil, 9, false);
  sil = fillHoles(sil);
  // The trousers are dark grey on a dark ground; nothing separates them by
  // value. Named explicitly rather than thresholded into existence.
  for (let y = 770; y < H; y++) for (let x = 235; x < 515; x++) sil[y * W + x] = 1;
  sil = morph(sil, 5, true);
  sil = morph(sil, 5, false);
  sil = fillHoles(sil);

  // ---------- the tight core (inside the lettering band) ----------
  let core = new Uint8Array(N);
  for (let i = 0; i < N; i++) core[i] = (luma[i] > 96 || chroma[i] > 22) ? 1 : 0;
  core = largest(core);
  core = morph(core, 6, true);     // seal the notches between hair spikes
  core = morph(core, 4, false);
  const rim = morph(core, 3, true);

  // KEEP: inside the band, the core plus only the DARK part of its rim — the
  // figure's own outline. Keeping the whole rim is what produced a pale halo
  // on the first pass: the 3px ring next to the hair is lettering-grey, not
  // drawing, and preserving it drew the letters back as an outline.
  const keep = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const y = (i / W) | 0;
    keep[i] = (y < P.bandY)
      ? (core[i] || (rim[i] && luma[i] < 30) ? 1 : 0)
      : sil[i];
  }

  // ---------- the ground model ----------
  const known = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const y = (i / W) | 0;
    if (keep[i]) continue;
    if (y < P.bandY) { known[i] = (chroma[i] <= 12 && luma[i] >= 8 && luma[i] <= 45) ? 1 : 0; }
    else { known[i] = (chroma[i] <= 12 && luma[i] >= 8 && luma[i] <= 62) ? 1 : 0; }
  }

  // Erode the sample set. A letter is surrounded by a ring of anti-aliased
  // pixels that still pass the ground test, and letting them into the model
  // pulled it dark around every glyph — which reads back as a faint bright
  // ghost of the glyph itself once the middle is interpolated.
  const known2 = morph(known, 4, false);
  known.set(known2);

  const levels = [];
  let lw = W, lh = H;
  let sum = new Float32Array(N * 3), wt = new Float32Array(N);
  for (let i = 0; i < N; i++) if (known[i]) {
    sum[i * 3] = src[i * 4]; sum[i * 3 + 1] = src[i * 4 + 1]; sum[i * 3 + 2] = src[i * 4 + 2];
    wt[i] = 1;
  }
  levels.push({ w: lw, h: lh, sum, wt });
  while (lw > 4 && lh > 4) {
    const nw = Math.ceil(lw / 2), nh = Math.ceil(lh / 2);
    const ns = new Float32Array(nw * nh * 3), nwt = new Float32Array(nw * nh);
    for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
      const s = y * lw + x, t = (y >> 1) * nw + (x >> 1);
      nwt[t] += wt[s];
      ns[t * 3] += sum[s * 3]; ns[t * 3 + 1] += sum[s * 3 + 1]; ns[t * 3 + 2] += sum[s * 3 + 2];
    }
    lw = nw; lh = nh; sum = ns; wt = nwt;
    levels.push({ w: lw, h: lh, sum, wt });
  }
  const upsample = (e, sw, sh, dw, dh) => {
    const o = new Float32Array(dw * dh * 3);
    for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
      const fx = Math.min(sw - 1.0001, Math.max(0, (x - 0.5) / 2));
      const fy = Math.min(sh - 1.0001, Math.max(0, (y - 0.5) / 2));
      const x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0;
      const x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1);
      for (let k = 0; k < 3; k++) {
        const a = e[(y0 * sw + x0) * 3 + k], b = e[(y0 * sw + x1) * 3 + k];
        const cc = e[(y1 * sw + x0) * 3 + k], dd = e[(y1 * sw + x1) * 3 + k];
        o[(y * dw + x) * 3 + k] = (a * (1 - tx) + b * tx) * (1 - ty) + (cc * (1 - tx) + dd * tx) * ty;
      }
    }
    return o;
  };
  const K = 0.5;
  let est = null, ew = 0, eh = 0;
  for (let L = levels.length - 1; L >= 0; L--) {
    const lv = levels[L], nx = new Float32Array(lv.w * lv.h * 3);
    const up = est ? upsample(est, ew, eh, lv.w, lv.h) : null;
    for (let i = 0; i < lv.w * lv.h; i++) {
      const w = lv.wt[i];
      for (let k = 0; k < 3; k++) {
        const s0 = lv.sum[i * 3 + k];
        const u = up ? up[i * 3 + k] : (w > 0 ? s0 / w : 0);
        nx[i * 3 + k] = (s0 + u * K) / (w + K);
      }
    }
    est = nx; ew = lv.w; eh = lv.h;
  }
  let G = est;
  const R = 7;
  for (let pass = 0; pass < 4; pass++) {
    const tmp = new Float32Array(N * 3), t2 = new Float32Array(N * 3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let n = 0, a0 = 0, a1 = 0, a2 = 0;
      for (let dx = -R; dx <= R; dx++) {
        const xx = x + dx; if (xx < 0 || xx >= W) continue;
        const j = (y * W + xx) * 3; a0 += G[j]; a1 += G[j + 1]; a2 += G[j + 2]; n++;
      }
      const o = (y * W + x) * 3; tmp[o] = a0 / n; tmp[o + 1] = a1 / n; tmp[o + 2] = a2 / n;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let n = 0, a0 = 0, a1 = 0, a2 = 0;
      for (let dy = -R; dy <= R; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= H) continue;
        const j = (yy * W + x) * 3; a0 += tmp[j]; a1 += tmp[j + 1]; a2 += tmp[j + 2]; n++;
      }
      const o = (y * W + x) * 3; t2[o] = a0 / n; t2[o + 1] = a1 / n; t2[o + 2] = a2 / n;
    }
    G = t2;
  }

  // feather the keep mask, so the join is a gradient rather than a cut
  let soft = new Float32Array(N);
  for (let i = 0; i < N; i++) soft[i] = keep[i];
  for (let pass = 0; pass < 2; pass++) {
    const t = new Float32Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = y + dy, xx = x + dx;
        if (yy < 0 || yy >= H || xx < 0 || xx >= W) continue;
        s += soft[yy * W + xx]; n++;
      }
      t[y * W + x] = s / n;
    }
    soft = t;
  }

  const im = new ImageData(W, H);
  for (let i = 0; i < N; i++) {
    const a = soft[i];
    for (let k = 0; k < 3; k++)
      im.data[i * 4 + k] = Math.round(src[i * 4 + k] * a + G[i * 3 + k] * (1 - a));
    im.data[i * 4 + 3] = 255;
  }

  // ============================================================
  // THE BELT
  //
  // ONLY THE GLYPHS. The first attempt refilled the strap's whole interior
  // with one tan and took the buckle prongs, the shadow under them and the
  // strap's lower edge with it — a flat slab with a visible step where the
  // patch ended. The strap is found per column by colour (r-b separation),
  // because it runs on a slope and a fixed rectangle would cut its edges; the
  // replacement value is that column's 80th percentile, which lands on
  // leather even where a letter covers most of the column; and only pixels
  // materially darker than that value are touched.
  // ============================================================
  const B = P.belt;
  const px = (x, y, k) => im.data[(y * W + x) * 4 + k];
  const patched = [];
  const inStrap = new Uint8Array(N), glyph = new Uint8Array(N);
  for (let x = B.x0; x < B.x1; x++) {
    let top = -1, bot = -1;
    for (let y = B.scanY0; y < B.scanY1; y++) {
      const r = px(x, y, 0), g = px(x, y, 1), b = px(x, y, 2);
      const lum = (r + g + b) / 3;
      if ((r - b) > 20 && lum > 45 && lum < 175) { if (top < 0) top = y; bot = y; }
    }
    if (top < 0 || bot - top < 8) continue;
    const cols = [[], [], []];
    for (let y = top; y <= bot; y++) {
      const lum = (px(x, y, 0) + px(x, y, 1) + px(x, y, 2)) / 3;
      if (lum < 45 || lum > 175) continue;
      for (let k = 0; k < 3; k++) cols[k].push(px(x, y, k));
    }
    if (cols[0].length < 6) continue;
    const tanRGB = cols.map(v => { v.sort((a, b) => a - b); return v[Math.floor(v.length * 0.80)]; });
    const tanLum = (tanRGB[0] + tanRGB[1] + tanRGB[2]) / 3;
    const lo = Math.max(top + 1, B.y0), hi = Math.min(bot - 1, B.y1);
    for (let y = lo; y <= hi; y++) {
      inStrap[y * W + x] = 1;
      const lum = (px(x, y, 0) + px(x, y, 1) + px(x, y, 2)) / 3;
      // the glyphs are dark BROWN. Gating on hue as well as value keeps the
      // buckle's grey prongs and the shadow under them out of the repair.
      if (lum < tanLum - 5 && (px(x, y, 0) - px(x, y, 2)) > 10) glyph[y * W + x] = 1;
      void tanRGB;
    }
  }
  // Catch the anti-aliased shoulder of every glyph. A threshold alone leaves a
  // brown fringe that still spells the word at a glance.
  const grown = new Uint8Array(N);
  for (let y = B.y0 - 1; y <= B.y1 + 1; y++) for (let x = B.x0 - 1; x <= B.x1 + 1; x++) {
    const i = y * W + x;
    if (!inStrap[i]) continue;
    if (glyph[i] || glyph[i - 1] || glyph[i + 1] || glyph[i - W] || glyph[i + W]) grown[i] = 1;
  }

  // Diffuse the leather back across the glyphs. A flat refill loses the
  // strap's own top-to-bottom shading and reads as a sticker; Jacobi
  // relaxation over the hole reproduces that shading from its own edges.
  const work = new Float32Array(N * 3);
  for (let y = B.y0 - 2; y <= B.y1 + 2; y++) for (let x = B.x0 - 2; x <= B.x1 + 2; x++)
    for (let k = 0; k < 3; k++) work[(y * W + x) * 3 + k] = im.data[(y * W + x) * 4 + k];
  for (let pass = 0; pass < 240; pass++) {
    const next = Float32Array.from(work);
    for (let y = B.y0; y <= B.y1; y++) for (let x = B.x0; x <= B.x1; x++) {
      const i = y * W + x;
      if (!grown[i]) continue;
      for (let k = 0; k < 3; k++) {
        next[i * 3 + k] = (work[(i - 1) * 3 + k] + work[(i + 1) * 3 + k] +
                           work[(i - W) * 3 + k] + work[(i + W) * 3 + k]) / 4;
      }
    }
    work.set(next);
  }
  for (let y = B.y0; y <= B.y1; y++) for (let x = B.x0; x <= B.x1; x++) {
    const i = y * W + x;
    if (!grown[i]) continue;
    for (let k = 0; k < 3; k++) im.data[i * 4 + k] = Math.round(work[i * 3 + k]);
    patched.push(i);
  }

  const c2 = document.createElement('canvas'); c2.width = W; c2.height = H;
  c2.getContext('2d').putImageData(im, 0, 0);
  const bo = new ImageData(W, H);
  for (let i = 0; i < N * 4; i += 4) {
    bo.data[i]     = Math.min(255, im.data[i]     * 2.6);
    bo.data[i + 1] = Math.min(255, im.data[i + 1] * 2.6);
    bo.data[i + 2] = Math.min(255, im.data[i + 2] * 2.6);
    bo.data[i + 3] = 255;
  }
  const c3 = document.createElement('canvas'); c3.width = W; c3.height = H;
  c3.getContext('2d').putImageData(bo, 0, 0);

  return { png: c2.toDataURL('image/png'), webp: c2.toDataURL('image/webp', 0.92) };
}, { bandY: BAND_Y, belt: BELT });

write('hero-figure-master.png', out.png);
write('hero-figure.webp', out.webp);
