/* Shared edition data and art generators.
 *
 * Both prototypes — the DOM one in script.js and the WebGL one in engine.js —
 * print the same twelve pieces from this file, so a comparison of the two is
 * a comparison of the rendering approach and nothing else.
 */

'use strict';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Deterministic PRNG so every reload prints the same edition. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ─────────────────────── paper grain texture ─────────────────────── */

function makeGrain() {
  const n = 180;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(n, n);
  const rng = mulberry32(99);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 236 + rng() * 19;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return `url("${c.toDataURL('image/png')}")`;
}

/* ───────────────────────── riso ink library ───────────────────────── */

const INKS = {
  pink: '#ff48b0',
  blue: '#3d5588',
  yellow: '#ffe800',
  green: '#00a95c',
  orange: '#ff6c2f',
  magenta: '#e4007f',
  teal: '#00838a',
  black: '#1b1b1b',
  grey: '#8f8f8f',
};

/* ─────────────────────────── art generators ───────────────────────────
 * Each returns an SVG string for a W×H art field. Overprint is faked with
 * mix-blend-mode: multiply, the way two riso passes actually sit.
 */

const ART = {
  halftone(rng, w, h, inks) {
    const step = 7 + Math.round(rng() * 4);
    const cx = w * (0.3 + rng() * 0.4);
    const cy = h * (0.3 + rng() * 0.4);
    const maxD = Math.hypot(w, h) * 0.62;
    let out = '';
    for (let y = step / 2; y < h; y += step) {
      for (let x = step / 2; x < w; x += step) {
        const d = Math.hypot(x - cx, y - cy) / maxD;
        const r = clamp((1 - d) * step * 0.62 + (rng() - 0.5) * 0.7, 0, step * 0.62);
        if (r > 0.25) out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}"/>`;
      }
    }
    const second = `<g fill="${inks[1]}" style="mix-blend-mode:multiply" transform="translate(${(step / 2).toFixed(1)} ${(step / 2).toFixed(1)})">${out}</g>`;
    return `<g fill="${inks[0]}">${out}</g>${second}`;
  },

  bands(rng, w, h, inks) {
    let out = '';
    let y = -h * 0.1;
    while (y < h) {
      const t = 4 + rng() * 26;
      const ink = inks[Math.floor(rng() * inks.length)];
      const dx = (rng() - 0.5) * w * 0.3;
      out += `<rect x="${dx.toFixed(1)}" y="${y.toFixed(1)}" width="${w * 1.2}" height="${t.toFixed(1)}" fill="${ink}" style="mix-blend-mode:multiply" opacity="${(0.55 + rng() * 0.45).toFixed(2)}"/>`;
      y += t + 2 + rng() * 10;
    }
    return out;
  },

  arcs(rng, w, h, inks) {
    const cx = w * (0.1 + rng() * 0.8);
    const cy = h * (0.55 + rng() * 0.5);
    let out = '';
    const rings = 9 + Math.floor(rng() * 7);
    for (let i = rings; i > 0; i--) {
      const r = (i / rings) * Math.hypot(w, h) * 0.78;
      const ink = inks[i % inks.length];
      out += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="${ink}" stroke-width="${(1 + rng() * 3.4).toFixed(2)}" style="mix-blend-mode:multiply"/>`;
    }
    return out;
  },

  modular(rng, w, h, inks) {
    const cols = 3 + Math.floor(rng() * 3);
    const rows = Math.max(3, Math.round((cols * h) / w));
    const cw = w / cols;
    const ch = h / rows;
    let out = '';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rng() < 0.34) continue;
        const ink = inks[Math.floor(rng() * inks.length)];
        const x = c * cw;
        const y = r * ch;
        const kind = rng();
        if (kind < 0.4) {
          out += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cw.toFixed(1)}" height="${ch.toFixed(1)}" fill="${ink}" style="mix-blend-mode:multiply"/>`;
        } else if (kind < 0.72) {
          out += `<path d="M${x.toFixed(1)} ${(y + ch).toFixed(1)}L${(x + cw).toFixed(1)} ${(y + ch).toFixed(1)}L${(x + cw).toFixed(1)} ${y.toFixed(1)}Z" fill="${ink}" style="mix-blend-mode:multiply"/>`;
        } else {
          out += `<circle cx="${(x + cw / 2).toFixed(1)}" cy="${(y + ch / 2).toFixed(1)}" r="${(Math.min(cw, ch) * 0.46).toFixed(1)}" fill="${ink}" style="mix-blend-mode:multiply"/>`;
        }
      }
    }
    return out;
  },

  specimen(rng, w, h, inks) {
    const glyphs = ['A', 'G', 'Q', 'R', 'K', 'S', 'W', '&amp;', '8'];
    const g = glyphs[Math.floor(rng() * glyphs.length)];
    const size = h * (0.78 + rng() * 0.2);
    let rules = '';
    for (let i = 1; i < 5; i++) {
      rules += `<rect x="${(w * 0.08).toFixed(1)}" y="${(h - 8 - i * 5).toFixed(1)}" width="${(w * (0.84 - i * 0.14)).toFixed(1)}" height="1.4" fill="${inks[1]}" style="mix-blend-mode:multiply"/>`;
    }
    return `<text x="${(w / 2).toFixed(1)}" y="${(h * 0.76).toFixed(1)}" text-anchor="middle"
      font-family="Archivo, Helvetica, Arial, sans-serif" font-weight="700"
      font-size="${size.toFixed(1)}" fill="${inks[0]}" style="mix-blend-mode:multiply">${g}</text>${rules}`;
  },

  contour(rng, w, h, inks) {
    let out = '';
    const lines = 16 + Math.floor(rng() * 12);
    for (let i = 0; i < lines; i++) {
      const base = (i / lines) * h;
      const amp = 3 + rng() * 14;
      const freq = 1 + rng() * 2.4;
      const phase = rng() * Math.PI * 2;
      let d = '';
      for (let x = 0; x <= w; x += 4) {
        const y = base + Math.sin((x / w) * freq * Math.PI * 2 + phase) * amp;
        d += `${x === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      out += `<path d="${d}" fill="none" stroke="${inks[i % inks.length]}" stroke-width="${(0.8 + rng() * 1.6).toFixed(2)}" style="mix-blend-mode:multiply"/>`;
    }
    return out;
  },
};

/* ───────────────────────────── the edition ─────────────────────────────
 * Sizes are real sheet sizes in mm; MM converts to screen units.
 */

const MM = 0.78;

const PIECES = [
  { t: 'Harbor Interference', art: 'halftone', inks: ['blue', 'pink'], mm: [297, 420], med: 'Risograph, 2 inks', ed: '7/40', gsm: 180, seed: 11 },
  { t: 'Nine Registers', art: 'modular', inks: ['orange', 'black', 'yellow'], mm: [250, 250], med: 'Screenprint', ed: '3/25', gsm: 300, seed: 23 },
  { t: 'Soft Return', art: 'contour', inks: ['teal', 'pink'], mm: [420, 297], med: 'Risograph, 2 inks', ed: '12/60', gsm: 160, seed: 37 },
  { t: 'Specimen: Ampersand', art: 'specimen', inks: ['black', 'pink'], mm: [210, 297], med: 'Letterpress, Vandercook', ed: '4/18', gsm: 270, seed: 41 },
  { t: 'Low Tide Bands', art: 'bands', inks: ['blue', 'green', 'yellow'], mm: [297, 420], med: 'Risograph, 3 inks', ed: '9/35', gsm: 180, seed: 53 },
  { t: 'Rings for a Flat Room', art: 'arcs', inks: ['magenta', 'blue'], mm: [250, 250], med: 'Giclée on rag', ed: '2/10', gsm: 310, seed: 67 },
  { t: 'Overprint Study 04', art: 'halftone', inks: ['yellow', 'teal'], mm: [210, 297], med: 'Risograph, 2 inks', ed: '21/50', gsm: 160, seed: 71 },
  { t: 'Quarter Grid', art: 'modular', inks: ['pink', 'blue'], mm: [297, 210], med: 'Screenprint', ed: '6/30', gsm: 300, seed: 83 },
  { t: 'Specimen: Double-Storey', art: 'specimen', inks: ['green', 'grey'], mm: [210, 297], med: 'Letterpress', ed: '1/12', gsm: 270, seed: 97 },
  { t: 'Weather for Ballard', art: 'contour', inks: ['orange', 'blue', 'black'], mm: [420, 297], med: 'Risograph, 3 inks', ed: '14/45', gsm: 180, seed: 103 },
  { t: 'Press Check, 6 am', art: 'bands', inks: ['black', 'orange'], mm: [250, 350], med: 'Offset proof', ed: 'A/P', gsm: 150, seed: 109 },
  { t: 'Concentric Yellow', art: 'arcs', inks: ['yellow', 'orange', 'black'], mm: [297, 297], med: 'Risograph, 3 inks', ed: '18/40', gsm: 180, seed: 127 },
];
