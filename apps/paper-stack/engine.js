/* Paper Stack — engine build.
 *
 * Hand-rolled WebGL2 plus an XPBD solver. Every sheet is a real deformable
 * surface: a grid of particles held together by distance constraints
 * (paper does not stretch) and bending constraints (paper resists folding).
 * Lift one by a corner and the far end droops because it is actually
 * drooping, not because a rotateX was keyframed.
 *
 * Units are millimetres, +Y is up, the table is the plane y = 0.
 *
 * Depends on art.js for the edition data and the print generators.
 */

'use strict';

/* ─────────────────────────── tunables ─────────────────────────── */

const DEFAULTS = {
  gravity: 2400,    // mm/s², scaled well past 9810 reads as lead, below as foam
  stretch: 0.0,     // ×1e-6 compliance of the spans; 0 = truly inextensible
  bend: 3.5,        // ×1e-5 bending compliance; 1 is card, 30 is tissue
  drag: 0.9,        // air damping per second
  iters: 10,         // solver iterations per substep
  substeps: 4,
  lift: 120,        // mm the grabbed point rises above the table
  light: 38,        // degrees the key light sits off vertical
  shadow: 0.6,
  grid: 11,         // particles across the short edge
  autoFlatten: 0.6, // how strongly a resting sheet is pressed flat
};

const SETTINGS_KEY = 'paper-stack/engine/1';
const cfg = { ...DEFAULTS, ...readJSON(SETTINGS_KEY) };

function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)) || null; } catch { return null; } }
function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } }

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ───────────────────────── small vector helpers ───────────────────────── */

const V = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};

/* ───────────────────────────── matrices ───────────────────────────── */

function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

function lookAt(eye, at, up) {
  const z = V.norm(V.sub(eye, at));
  const x = V.norm(V.cross(up, z));
  const y = V.cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -V.dot(x, eye), -V.dot(y, eye), -V.dot(z, eye), 1,
  ]);
}

function mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return o;
}

/* ───────────────────────── a sheet of paper ─────────────────────────
 * Particles on a regular grid. Three families of constraints:
 *   structural  neighbours along the grid — the sheet's inextensibility
 *   shear       diagonals — stops the grid guillotining into a rhombus
 *   bend        two-apart neighbours — the only thing that makes it paper
 *               rather than cloth
 */

class Sheet {
  constructor(piece, index) {
    this.piece = piece;
    this.index = index;
    this.title = piece.t;

    const short = Math.min(piece.mm[0], piece.mm[1]);
    const n = cfg.grid;
    this.cols = piece.mm[0] >= piece.mm[1] ? Math.round((n * piece.mm[0]) / short) : n;
    this.rows = piece.mm[1] > piece.mm[0] ? Math.round((n * piece.mm[1]) / short) : n;
    this.w = piece.mm[0];
    this.h = piece.mm[1];
    this.count = this.cols * this.rows;

    this.pos = new Float32Array(this.count * 3);
    this.prev = new Float32Array(this.count * 3);
    this.vel = new Float32Array(this.count * 3);
    this.inv = new Float32Array(this.count).fill(1);
    this.uv = new Float32Array(this.count * 2);

    this.restY = 0;
    this.pinned = -1;
    this.pinTo = [0, 0, 0];
    this.pinAt = [0, 0, 0];
    /** A sheet lying still is not simulated at all. Most of them always are. */
    this.asleep = false;
    this.scale = 1;

    this.buildConstraints();
    this.layFlat(0, 0, 0);
    this.buildIndices();
  }

  at(c, r) { return r * this.cols + c; }

  buildConstraints() {
    const ds = [];
    const push = (a, b, compliance) => {
      const d = Math.hypot(
        this.rest[a * 3] - this.rest[b * 3],
        this.rest[a * 3 + 2] - this.rest[b * 3 + 2],
      );
      ds.push(a, b, d, compliance);
    };

    // rest layout first, so constraint lengths come from the real geometry
    this.rest = new Float32Array(this.count * 3);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const i = this.at(c, r);
        this.rest[i * 3] = (c / (this.cols - 1) - 0.5) * this.w;
        this.rest[i * 3 + 1] = 0;
        this.rest[i * 3 + 2] = (r / (this.rows - 1) - 0.5) * this.h;
        this.uv[i * 2] = c / (this.cols - 1);
        this.uv[i * 2 + 1] = r / (this.rows - 1);
      }
    }

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const i = this.at(c, r);
        if (c + 1 < this.cols) push(i, this.at(c + 1, r), 0);
        if (r + 1 < this.rows) push(i, this.at(c, r + 1), 0);
        if (c + 1 < this.cols && r + 1 < this.rows) {
          push(i, this.at(c + 1, r + 1), 0);
          push(this.at(c + 1, r), this.at(c, r + 1), 0);
        }
        if (c + 2 < this.cols) push(i, this.at(c + 2, r), 1);
        if (r + 2 < this.rows) push(i, this.at(c, r + 2), 1);
      }
    }

    this.cons = new Float32Array(ds);
    this.nCons = ds.length / 4;
    this.lambda = new Float32Array(this.nCons);
  }

  buildIndices() {
    const idx = [];
    for (let r = 0; r + 1 < this.rows; r++) {
      for (let c = 0; c + 1 < this.cols; c++) {
        const a = this.at(c, r), b = this.at(c + 1, r), d = this.at(c, r + 1), e = this.at(c + 1, r + 1);
        idx.push(a, d, b, b, d, e);
      }
    }
    this.indices = new Uint16Array(idx);
  }

  /** Drop the sheet flat on the table at x, z, turned by `rot` radians. */
  layFlat(x, z, rot) {
    this.asleep = false;
    const cos = Math.cos(rot), sin = Math.sin(rot);
    for (let i = 0; i < this.count; i++) {
      const rx = this.rest[i * 3] * this.scale;
      const rz = this.rest[i * 3 + 2] * this.scale;
      this.pos[i * 3] = x + rx * cos - rz * sin;
      this.pos[i * 3 + 1] = this.restY;
      this.pos[i * 3 + 2] = z + rx * sin + rz * cos;
    }
    this.prev.set(this.pos);
    this.vel.fill(0);
  }

  centre() {
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < this.count; i++) { x += this.pos[i * 3]; y += this.pos[i * 3 + 1]; z += this.pos[i * 3 + 2]; }
    return [x / this.count, y / this.count, z / this.count];
  }

  /** Grow or shrink the sheet by rescaling every constraint's rest length. */
  rescale(k) {
    this.asleep = false;
    const next = clamp(this.scale * k, 0.35, 2.4);
    const f = next / this.scale;
    this.scale = next;
    for (let i = 0; i < this.nCons; i++) this.cons[i * 4 + 2] *= f;
    const [cx, , cz] = this.centre();
    for (let i = 0; i < this.count; i++) {
      this.pos[i * 3] = cx + (this.pos[i * 3] - cx) * f;
      this.pos[i * 3 + 2] = cz + (this.pos[i * 3 + 2] - cz) * f;
    }
    this.prev.set(this.pos);
  }

  /** Spin the sheet about its own centre, for the pinch gesture. */
  spin(dr) {
    this.asleep = false;
    const [cx, , cz] = this.centre();
    const cos = Math.cos(dr), sin = Math.sin(dr);
    for (let i = 0; i < this.count; i++) {
      const dx = this.pos[i * 3] - cx, dz = this.pos[i * 3 + 2] - cz;
      this.pos[i * 3] = cx + dx * cos - dz * sin;
      this.pos[i * 3 + 2] = cz + dx * sin + dz * cos;
    }
    this.prev.set(this.pos);
  }

  /** Rest distance from the held particle to every other, for the LRA pass. */
  buildLRA(pinned) {
    if (!this.lra || this.lra.length !== this.count) this.lra = new Float32Array(this.count);
    const px = this.rest[pinned * 3] * this.scale;
    const pz = this.rest[pinned * 3 + 2] * this.scale;
    for (let i = 0; i < this.count; i++) {
      this.lra[i] = Math.hypot(this.rest[i * 3] * this.scale - px, this.rest[i * 3 + 2] * this.scale - pz);
    }
  }

  /** Nothing may hang further from the held point than the paper is long. */
  solveLRA() {
    const o = this.pinned * 3;
    const ax = this.pos[o], ay = this.pos[o + 1], az = this.pos[o + 2];
    for (let i = 0; i < this.count; i++) {
      if (i === this.pinned || this.inv[i] === 0) continue;
      const io = i * 3;
      const dx = this.pos[io] - ax, dy = this.pos[io + 1] - ay, dz = this.pos[io + 2] - az;
      const len = Math.hypot(dx, dy, dz);
      const max = this.lra[i];
      if (len <= max || len < 1e-6) continue;
      const k = (len - max) / len;
      this.pos[io] -= dx * k;
      this.pos[io + 1] -= dy * k;
      this.pos[io + 2] -= dz * k;
    }
  }

  /** A sheet at rest on the table relaxes back to flat, keeping where it
   *  lies and which way it faces. Paper creases; a prototype should not. */
  relax(dt) {
    const k = cfg.autoFlatten;
    if (k <= 0) return;
    let cx = 0, cz = 0;
    for (let i = 0; i < this.count; i++) { cx += this.pos[i * 3]; cz += this.pos[i * 3 + 2]; }
    cx /= this.count; cz /= this.count;

    // orientation from the long axis of the grid, measured in the XZ plane
    const a = this.at(0, 0) * 3, b = this.at(this.cols - 1, 0) * 3;
    const yaw = Math.atan2(this.pos[b + 2] - this.pos[a + 2], this.pos[b] - this.pos[a]);
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    const t = Math.min(1, k * dt * 4);

    for (let i = 0; i < this.count; i++) {
      const rx = this.rest[i * 3] * this.scale;
      const rz = this.rest[i * 3 + 2] * this.scale;
      const tx = cx + rx * cos - rz * sin;
      const tz = cz + rx * sin + rz * cos;
      const io = i * 3;
      this.pos[io] += (tx - this.pos[io]) * t;
      this.pos[io + 1] += (this.restY - this.pos[io + 1]) * t;
      this.pos[io + 2] += (tz - this.pos[io + 2]) * t;
    }
  }

  /* ───────────────── XPBD step ───────────────── */

  simulate(dt) {
    const sub = cfg.substeps;
    const h = dt / sub;
    const g = -cfg.gravity;
    const damp = Math.exp(-cfg.drag * h);

    // the grabbed particle becomes infinitely heavy, so the solver treats it
    // as the fixed end of the sheet instead of something to fight
    if (this.pinned >= 0) {
      this.inv[this.pinned] = 0;
      // ease the pin toward the pointer, capped in mm/s. Teleporting it is a
      // shock no number of iterations can absorb, and it is the single thing
      // that was crumpling sheets on pick-up.
      const cap = 2600 * dt;
      for (let a = 0; a < 3; a++) {
        const d = this.pinTo[a] - this.pinAt[a];
        const m = Math.abs(d);
        this.pinAt[a] += m > cap ? Math.sign(d) * cap : d * 0.45;
      }
      const o = this.pinned * 3;
      this.pos[o] = this.pinAt[0];
      this.pos[o + 1] = this.pinAt[1];
      this.pos[o + 2] = this.pinAt[2];
      this.vel[o] = this.vel[o + 1] = this.vel[o + 2] = 0;
    }

    for (let s = 0; s < sub; s++) {
      // predict
      for (let i = 0; i < this.count; i++) {
        if (this.inv[i] === 0) continue;
        const o = i * 3;
        this.vel[o + 1] += g * h;
        this.vel[o] *= damp; this.vel[o + 1] *= damp; this.vel[o + 2] *= damp;
        this.prev[o] = this.pos[o]; this.prev[o + 1] = this.pos[o + 1]; this.prev[o + 2] = this.pos[o + 2];
        const sp = Math.hypot(this.vel[o], this.vel[o + 1], this.vel[o + 2]);
        if (sp > 6000) { const k = 6000 / sp; this.vel[o] *= k; this.vel[o + 1] *= k; this.vel[o + 2] *= k; }
        this.pos[o] += this.vel[o] * h;
        this.pos[o + 1] += this.vel[o + 1] * h;
        this.pos[o + 2] += this.vel[o + 2] * h;
      }

      this.lambda.fill(0);
      for (let it = 0; it < cfg.iters; it++) {
        this.solve(h);
        if (this.pinned >= 0) this.solveLRA();
      }
      this.collide();

      // recover velocity from the corrected positions
      const invH = 1 / h;
      for (let i = 0; i < this.count; i++) {
        const o = i * 3;
        this.vel[o] = (this.pos[o] - this.prev[o]) * invH;
        this.vel[o + 1] = (this.pos[o + 1] - this.prev[o + 1]) * invH;
        this.vel[o + 2] = (this.pos[o + 2] - this.prev[o + 2]) * invH;
      }
    }

    if (this.pinned < 0) this.relax(dt);
  }

  solve(h) {
    const h2 = h * h;
    const c = this.cons;
    for (let k = 0; k < this.nCons; k++) {
      const a = c[k * 4], b = c[k * 4 + 1], rest = c[k * 4 + 2];
      // XPBD compares alpha = compliance/h² against the inverse-mass sum, so
      // a useful compliance for millimetre-scale paper at a ~4 ms substep is
      // on the order of 1e-5. The sliders are in those units.
      const compliance = c[k * 4 + 3] === 1 ? cfg.bend * 1e-5 : cfg.stretch * 1e-6;
      const wa = this.inv[a], wb = this.inv[b];
      const wsum = wa + wb;
      if (wsum === 0) continue;

      const ao = a * 3, bo = b * 3;
      let dx = this.pos[ao] - this.pos[bo];
      let dy = this.pos[ao + 1] - this.pos[bo + 1];
      let dz = this.pos[ao + 2] - this.pos[bo + 2];
      const len = Math.hypot(dx, dy, dz);
      if (len < 1e-6) continue;

      const err = len - rest;
      const alpha = compliance / h2;
      const dl = (-err - alpha * this.lambda[k]) / (wsum + alpha);
      this.lambda[k] += dl;

      const s = dl / len;
      dx *= s; dy *= s; dz *= s;
      this.pos[ao] += dx * wa; this.pos[ao + 1] += dy * wa; this.pos[ao + 2] += dz * wa;
      this.pos[bo] -= dx * wb; this.pos[bo + 1] -= dy * wb; this.pos[bo + 2] -= dz * wb;
    }
  }

  collide() {
    // the table, and the sheets already stacked below this one
    const floor = this.restY;
    const held = this.pinned >= 0;
    for (let i = 0; i < this.count; i++) {
      const o = i * 3;
      if (this.pos[o + 1] < floor) {
        this.pos[o + 1] = floor;
        if (this.vel[o + 1] < 0) this.vel[o + 1] = 0;
        // friction against the table, so a dropped sheet stays put
        this.vel[o] *= 0.55; this.vel[o + 2] *= 0.55;
      }
    }
  }

  /** Mean distance from the resting plane, in mm. */
  get bow() {
    let b = 0;
    for (let i = 0; i < this.count; i++) b += Math.abs(this.pos[i * 3 + 1] - this.restY);
    return b / this.count;
  }

  /** Is anything still moving? Lets the whole table go to sleep. */
  get energy() {
    let e = 0;
    for (let i = 0; i < this.count * 3; i++) e += this.vel[i] * this.vel[i];
    return e / this.count;
  }

  /** Möller–Trumbore against the deformed surface. */
  raycast(ro, rd) {
    let best = Infinity, hit = -1;
    const idx = this.indices, p = this.pos;
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const e1x = p[b] - p[a], e1y = p[b + 1] - p[a + 1], e1z = p[b + 2] - p[a + 2];
      const e2x = p[c] - p[a], e2y = p[c + 1] - p[a + 1], e2z = p[c + 2] - p[a + 2];
      const hx = rd[1] * e2z - rd[2] * e2y;
      const hy = rd[2] * e2x - rd[0] * e2z;
      const hz = rd[0] * e2y - rd[1] * e2x;
      const det = e1x * hx + e1y * hy + e1z * hz;
      if (det > -1e-7 && det < 1e-7) continue;
      const f = 1 / det;
      const sx = ro[0] - p[a], sy = ro[1] - p[a + 1], sz = ro[2] - p[a + 2];
      const u = f * (sx * hx + sy * hy + sz * hz);
      if (u < 0 || u > 1) continue;
      const qx = sy * e1z - sz * e1y;
      const qy = sz * e1x - sx * e1z;
      const qz = sx * e1y - sy * e1x;
      const v = f * (rd[0] * qx + rd[1] * qy + rd[2] * qz);
      if (v < 0 || u + v > 1) continue;
      const dist = f * (e2x * qx + e2y * qy + e2z * qz);
      if (dist > 1 && dist < best) {
        best = dist;
        // nearest grid particle to the hit, which becomes the grab point
        const bary = [1 - u - v, u, v];
        const verts = [idx[t], idx[t + 1], idx[t + 2]];
        hit = verts[bary.indexOf(Math.max(...bary))];
      }
    }
    return hit < 0 ? null : { dist: best, particle: hit };
  }
}

/* ───────────────────────────── textures ─────────────────────────────
 * Each print is rasterised once: the SVG from art.js, then the caption
 * drawn on top in the same type as the DOM build.
 */

const TEX_SHORT = 720;

function printTexture(piece) {
  const short = Math.min(piece.mm[0], piece.mm[1]);
  const W = Math.round((TEX_SHORT * piece.mm[0]) / short);
  const H = Math.round((TEX_SHORT * piece.mm[1]) / short);
  const capH = Math.round(H * 0.082);
  const artH = H - capH;

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f6f4ee';
  ctx.fillRect(0, 0, W, H);

  const rng = mulberry32(piece.seed);
  const inks = piece.inks.map((k) => INKS[k] || k);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${artH}" width="${W}" height="${artH}">` +
    ART[piece.art](rng, W, artH, inks) + '</svg>';

  const img = new Image();
  const done = new Promise((resolve) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0, W, artH);
      caption();
      resolve();
    };
    img.onerror = () => { caption(); resolve(); };
  });
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

  function caption() {
    ctx.fillStyle = '#f6f4ee';
    ctx.fillRect(0, artH, W, capH);
    ctx.fillStyle = 'rgba(205,199,184,0.9)';
    ctx.fillRect(0, artH, W, 2);

    const pad = Math.round(W * 0.028);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#1c2124';
    ctx.font = `700 ${Math.round(capH * 0.36)}px Archivo, Helvetica, Arial, sans-serif`;
    ctx.fillText(piece.t, pad, artH + capH * 0.46, W - pad * 2);
    ctx.fillStyle = '#4e585c';
    ctx.font = `500 ${Math.round(capH * 0.24)}px "IBM Plex Mono", ui-monospace, monospace`;
    ctx.fillText(
      `${piece.med} · Ed. ${piece.ed} · ${piece.mm[0]}×${piece.mm[1]} mm · ${piece.gsm} gsm`,
      pad, artH + capH * 0.8, W - pad * 2);

    // crop marks, as in the DOM build
    ctx.strokeStyle = 'rgba(78,88,92,0.55)';
    ctx.lineWidth = Math.max(1, W * 0.0015);
    const m = W * 0.018, len = W * 0.022;
    for (const [x, y] of [[m, m], [W - m, m], [m, artH - m], [W - m, artH - m]]) {
      ctx.beginPath();
      ctx.moveTo(x - len / 2, y); ctx.lineTo(x + len / 2, y);
      ctx.moveTo(x, y - len / 2); ctx.lineTo(x, y + len / 2);
      ctx.stroke();
    }
  }

  return { canvas, ready: done };
}

/* ───────────────────────────── shaders ───────────────────────────── */

const VS_SHEET = `#version 300 es
in vec3 aPos;
in vec2 aUV;
uniform mat4 uVP;
out vec2 vUV;
out vec3 vWorld;
void main() {
  vUV = aUV;
  vWorld = aPos;
  gl_Position = uVP * vec4(aPos, 1.0);
}`;

const FS_SHEET = `#version 300 es
precision highp float;
in vec2 vUV;
in vec3 vWorld;
uniform sampler2D uTex;
uniform vec3 uLight;
uniform float uSelected;
uniform float uDim;
out vec4 frag;

void main() {
  // the surface normal comes straight from the deformed geometry, so the
  // shading follows every bend without a normal buffer
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (n.y < 0.0) n = -n;

  vec3 ink = texture(uTex, vUV).rgb;

  // The back of a print is stock, not a mirror of the front. A little of the
  // ink shows through, the way it does when you hold paper up.
  if (!gl_FrontFacing) {
    ink = mix(vec3(0.941, 0.925, 0.886), ink, 0.12);
  }

  float lambert = max(dot(n, uLight), 0.0);
  float ambient = 0.62 + 0.14 * n.y;

  // paper is matte but not flat: a broad, weak sheen along the light
  vec3 view = normalize(vec3(0.0, 1.0, 0.55));
  vec3 half_ = normalize(uLight + view);
  float sheen = pow(max(dot(n, half_), 0.0), 18.0) * 0.16;

  vec3 col = ink * (ambient + lambert * 0.5) + sheen;
  col = mix(col, col * 0.45, uDim);
  col = mix(col, mix(col, vec3(0.77, 0.17, 0.48), 0.22), uSelected);
  frag = vec4(col, 1.0);
}`;

const VS_SHADOW = `#version 300 es
in vec3 aPos;
in vec2 aUV;
uniform mat4 uVP;
uniform vec3 uLight;
uniform float uPlane;
out vec2 vUV;
out float vHeight;
void main() {
  // project the deformed sheet onto the surface below it, along the light
  float t = (aPos.y - uPlane) / max(uLight.y, 0.15);
  vec3 g = vec3(aPos.x - uLight.x * t, uPlane, aPos.z - uLight.z * t);
  vUV = aUV;
  vHeight = aPos.y - uPlane;
  gl_Position = uVP * vec4(g, 1.0);
}`;

const FS_SHADOW = `#version 300 es
precision highp float;
in vec2 vUV;
in float vHeight;
uniform float uStrength;
out vec4 frag;
void main() {
  // the penumbra widens and the shadow weakens as the sheet lifts, which is
  // the whole cue for how high something is being held
  float soft = clamp(vHeight / 140.0, 0.0, 1.0);
  vec2 d = abs(vUV - 0.5) * 2.0;
  float edge = max(d.x, d.y);
  float feather = mix(0.035, 0.55, soft);
  float a = 1.0 - smoothstep(1.0 - feather, 1.0, edge);
  a *= uStrength * mix(1.0, 0.42, soft);
  frag = vec4(0.0, 0.0, 0.0, a);
}`;

const VS_TABLE = `#version 300 es
in vec2 aXZ;
uniform mat4 uVP;
out vec2 vXZ;
void main() {
  vXZ = aXZ;
  gl_Position = uVP * vec4(aXZ.x, 0.0, aXZ.y, 1.0);
}`;

const FS_TABLE = `#version 300 es
precision highp float;
in vec2 vXZ;
uniform vec3 uMat;
uniform vec3 uGrid;
uniform vec3 uRule;
out vec4 frag;

float line(vec2 p, float spacing, float width) {
  vec2 g = abs(fract(p / spacing - 0.5) - 0.5) * spacing;
  vec2 fw = fwidth(p) * width;
  vec2 a = 1.0 - smoothstep(vec2(0.0), fw, g);
  return max(a.x, a.y);
}

void main() {
  vec3 col = uMat;
  col = mix(col, uGrid, line(vXZ, 50.0, 1.0) * 0.55);
  col = mix(col, uRule, line(vXZ, 250.0, 1.2) * 0.65);
  float vig = 1.0 - smoothstep(300.0, 1700.0, length(vXZ)) * 0.35;
  frag = vec4(col * vig, 1.0);
}`;

/* ───────────────────────────── renderer ───────────────────────────── */

const canvas = document.getElementById('gl');
const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });

if (!gl) {
  document.getElementById('nogl').hidden = false;
  document.getElementById('scene').hidden = true;
  throw new Error('WebGL2 unavailable');
}

function compile(vsSrc, fsSrc) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vsSrc], [gl.FRAGMENT_SHADER, fsSrc]]) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    gl.attachShader(p, sh);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));

  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    u[info.name] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

const progSheet = compile(VS_SHEET, FS_SHEET);
const progShadow = compile(VS_SHADOW, FS_SHADOW);
const progTable = compile(VS_TABLE, FS_TABLE);

const anisoExt = gl.getExtension('EXT_texture_filter_anisotropic');

/* table quad */
const tableVAO = gl.createVertexArray();
gl.bindVertexArray(tableVAO);
const tableBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, tableBuf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
  -2600, -2600, 2600, -2600, 2600, 2600, -2600, -2600, 2600, 2600, -2600, 2600,
]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
gl.bindVertexArray(null);

/* ───────────────────────────── the table ───────────────────────────── */

const sheets = [];
/** Bottom-to-top stacking order, exactly as in the DOM build. */
let order = [];
let selected = null;
let heldIdx = -1;
let inspecting = null;

const STACK_GAP = 1.4; // mm between resting sheets

PIECES.forEach((piece, i) => {
  const s = new Sheet(piece, i);
  const { canvas: tc, ready } = printTexture(piece);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([246, 244, 238, 255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  s.tex = tex;

  ready.then(() => {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tc);
    gl.generateMipmap(gl.TEXTURE_2D);
    if (anisoExt) {
      const max = gl.getParameter(anisoExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
      gl.texParameterf(gl.TEXTURE_2D, anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max));
    }
    wake();
  });

  s.vao = gl.createVertexArray();
  gl.bindVertexArray(s.vao);
  s.posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, s.posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, s.pos, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

  const uvBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
  gl.bufferData(gl.ARRAY_BUFFER, s.uv, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);

  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, s.indices, gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  sheets.push(s);
  order.push(i);
});

/* ───────────────────────── stacking order ─────────────────────────
 * The same single-owner model as the DOM build. In 3D the order maps to a
 * resting height instead of a z-index, which the depth buffer then enforces
 * — no painter's-algorithm bookkeeping, and nothing to drift out of sync.
 */

function reflow() {
  order.forEach((id, i) => {
    const s = sheets[id];
    const was = s.restY;
    s.restY = i * STACK_GAP;
    if (was !== s.restY) {
      const d = s.restY - was;
      for (let k = 0; k < s.count; k++) s.pos[k * 3 + 1] += d;
      s.prev.set(s.pos);
      s.asleep = false;
    }
  });
  paintZList();
  wake();
}

function promote(id, policy, hitId) {
  const at = order.indexOf(id);
  if (at < 0) return;
  order.splice(at, 1);
  if (policy === 'bottom') order.unshift(id);
  else if (policy === 'under' && hitId != null && hitId !== id) {
    const idx = order.indexOf(hitId);
    order.splice(idx < 0 ? order.length : idx, 0, id);
  } else order.push(id);
  reflow();
  announce(id, policy);
}

function announce(id, policy) {
  const where = policy === 'bottom' ? 'to the bottom' : policy === 'under' ? 'underneath' : 'to the top';
  live.textContent = `${sheets[id].title} moved ${where}. Position ${order.indexOf(id) + 1} of ${order.length}.`;
}

/* ───────────────────────────── camera ───────────────────────────── */

const cam = { dist: 1550, pitch: 0.92, yaw: 0, target: [0, 0, 0] };
let VP = perspective(0.62, 1, 100, 6000);

function eyePos() {
  return [
    cam.target[0] + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist,
    cam.target[1] + Math.sin(cam.pitch) * cam.dist,
    cam.target[2] + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist,
  ];
}

function updateCamera() {
  const aspect = canvas.width / canvas.height;
  const proj = perspective(0.62, aspect, 100, 6000);
  VP = mul(proj, lookAt(eyePos(), cam.target, [0, 1, 0]));
}

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round(canvas.clientWidth * dpr);
  const h = Math.round(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w; canvas.height = h;
  }
  // frame the whole table on a narrow screen
  cam.dist = canvas.clientWidth < 700 ? 2150 : 1680;
  updateCamera();
  wake();
}

function lightDir() {
  const a = (cfg.light * Math.PI) / 180;
  return V.norm([Math.sin(a) * 0.55, Math.cos(a), Math.sin(a) * 0.8]);
}

/* ───────────────────────────── draw ───────────────────────────── */

function draw() {
  gl.viewport(0, 0, canvas.width, canvas.height);
  const dark = document.documentElement.classList.contains('dark-ui');
  gl.clearColor(...(dark ? [0.106, 0.122, 0.129] : [0.655, 0.702, 0.667]), 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.CULL_FACE);

  const L = lightDir();

  // table
  gl.useProgram(progTable.p);
  gl.uniformMatrix4fv(progTable.u.uVP, false, VP);
  gl.uniform3fv(progTable.u.uMat, dark ? [0.137, 0.157, 0.165] : [0.706, 0.737, 0.714]);
  gl.uniform3fv(progTable.u.uGrid, dark ? [0.169, 0.192, 0.204] : [0.604, 0.643, 0.616]);
  gl.uniform3fv(progTable.u.uRule, dark ? [0.227, 0.259, 0.275] : [0.498, 0.541, 0.518]);
  gl.bindVertexArray(tableVAO);
  gl.depthMask(false);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.depthMask(true);

  gl.enable(gl.BLEND);

  // bottom to top: each sheet's shadow lands on whatever is beneath it,
  // then the sheet itself is drawn over its own shadow
  for (let i = 0; i < order.length; i++) {
    const s = sheets[order[i]];
    gl.bindVertexArray(s.vao);

    gl.useProgram(progShadow.p);
    gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.uniformMatrix4fv(progShadow.u.uVP, false, VP);
    gl.uniform3fv(progShadow.u.uLight, L);
    gl.uniform1f(progShadow.u.uPlane, Math.max(0, s.restY - STACK_GAP * 0.5));
    gl.uniform1f(progShadow.u.uStrength, cfg.shadow * (inspecting != null && inspecting !== s.index ? 0.4 : 1));
    gl.drawElements(gl.TRIANGLES, s.indices.length, gl.UNSIGNED_SHORT, 0);
    gl.depthMask(true);

    gl.useProgram(progSheet.p);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, s.tex);
    gl.uniform1i(progSheet.u.uTex, 0);
    gl.uniformMatrix4fv(progSheet.u.uVP, false, VP);
    gl.uniform3fv(progSheet.u.uLight, L);
    gl.uniform1f(progSheet.u.uSelected, selected === s.index ? 1 : 0);
    gl.uniform1f(progSheet.u.uDim, inspecting != null && inspecting !== s.index ? 1 : 0);
    gl.drawElements(gl.TRIANGLES, s.indices.length, gl.UNSIGNED_SHORT, 0);
  }

  gl.disable(gl.BLEND);
  gl.bindVertexArray(null);
}

/* ───────────────────────────── loop ───────────────────────────── */

let running = false, last = 0, frames = 0, fpsAt = 0, idleFor = 0;
const fpsOut = document.getElementById('fps');
const awakeOut = document.getElementById('awake');
let lastAwake = -1;

function wake() { idleFor = 0; if (!running) { running = true; last = performance.now(); fpsAt = last; frames = 0; requestAnimationFrame(tick); } }

function tick(now) {
  if (!running) return;
  const dt = Math.min(1 / 30, (now - last) / 1000) || 1 / 60;
  last = now;

  let moving = heldIdx >= 0 || inspecting != null;
  let awake = 0;
  for (const s of sheets) {
    if (s.asleep) continue;
    awake++;
    s.simulate(dt);
    gl.bindBuffer(gl.ARRAY_BUFFER, s.posBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, s.pos);

    if (s.pinned < 0 && s.energy < 90 && s.bow < 0.4) {
      // settled: snap the last fraction of a millimetre out and stop paying
      // for it. Eleven of twelve sheets are in this state at any moment.
      s.relax(1);
      s.vel.fill(0);
      s.prev.set(s.pos);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, s.pos);
      s.asleep = true;
    } else {
      moving = true;
    }
  }
  if (awakeOut && awake !== lastAwake) { awakeOut.textContent = awake + ' live'; lastAwake = awake; }

  draw();

  frames++;
  if (now - fpsAt > 500) {
    if (fpsOut) fpsOut.textContent = String(Math.round((frames * 1000) / (now - fpsAt))).padStart(2, '0') + ' fps';
    frames = 0; fpsAt = now;
  }

  // the table sleeps once every sheet has settled, so an idle tab costs nothing
  idleFor = moving ? 0 : idleFor + dt;
  if (idleFor > 0.6) { running = false; if (fpsOut) fpsOut.textContent = 'idle'; return; }
  requestAnimationFrame(tick);
}

/* ───────────────────────── pointer → world ───────────────────────── */

function ray(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const ndcX = ((clientX - r.left) / r.width) * 2 - 1;
  const ndcY = 1 - ((clientY - r.top) / r.height) * 2;
  const eye = eyePos();
  const fwd = V.norm(V.sub(cam.target, eye));
  const right = V.norm(V.cross(fwd, [0, 1, 0]));
  const up = V.cross(right, fwd);
  const th = Math.tan(0.62 / 2);
  const aspect = r.width / r.height;
  const dir = V.norm([
    fwd[0] + right[0] * ndcX * th * aspect + up[0] * ndcY * th,
    fwd[1] + right[1] * ndcX * th * aspect + up[1] * ndcY * th,
    fwd[2] + right[2] * ndcX * th * aspect + up[2] * ndcY * th,
  ]);
  return { origin: eye, dir };
}

/** Where a ray meets a horizontal plane. */
function onPlane(r, y) {
  const t = (y - r.origin[1]) / r.dir[1];
  if (!isFinite(t) || t < 0) return null;
  return [r.origin[0] + r.dir[0] * t, y, r.origin[2] + r.dir[2] * t];
}

/** Topmost sheet under the pointer, tested against the deformed surface. */
function pick(clientX, clientY, skip) {
  const r = ray(clientX, clientY);
  let best = null;
  for (let i = order.length - 1; i >= 0; i--) {
    const s = sheets[order[i]];
    if (s.index === skip) continue;
    const hit = s.raycast(r.origin, r.dir);
    if (hit && (!best || hit.dist < best.dist)) best = { ...hit, sheet: s, layer: i };
  }
  return best;
}

/* ───────────────────────── gestures ─────────────────────────
 * Everything native is suppressed: selection, image drag, the long-press
 * menu, Safari's pinch-zoom and double-tap-zoom. The surface behaves like
 * a table, not a document.
 */

const pointers = new Map();
let gesture = null;
let altDown = false;
let lastTap = { t: 0, id: null };

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  // capture is a convenience, not a requirement: it throws for a pointer the
  // browser no longer considers active, and losing the gesture over that
  // would be worse than tracking the pointer without it
  try { canvas.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (gesture && pointers.size === 2) { startPinch(); return; }
  if (gesture) return;

  const hit = pick(e.clientX, e.clientY);
  if (!hit) { select(null); return; }

  select(hit.sheet.index);
  if (inspecting != null && inspecting !== hit.sheet.index) exitInspect();

  const s = hit.sheet;
  heldIdx = s.index;
  s.pinned = hit.particle;
  const o = hit.particle * 3;
  s.pinTo = [s.pos[o], s.pos[o + 1], s.pos[o + 2]];
  s.pinAt = [s.pos[o], s.pos[o + 1], s.pos[o + 2]];
  s.asleep = false;
  s.buildLRA(hit.particle);
  gesture = { id: e.pointerId, sheet: s, mode: 'drag', travel: 0, downT: performance.now(), x0: e.clientX, y0: e.clientY };
  canvas.classList.add('grabbing');
  wake();
}, { passive: false });

function startPinch() {
  const [a, b] = [...pointers.values()];
  gesture.mode = 'pinch';
  gesture.pinch = {
    dist: Math.max(16, Math.hypot(a.x - b.x, a.y - b.y)),
    ang: Math.atan2(b.y - a.y, b.x - a.x),
  };
}

canvas.addEventListener('pointermove', (e) => {
  const rec = pointers.get(e.pointerId);
  if (!rec) return;
  rec.x = e.clientX; rec.y = e.clientY;
  if (!gesture) return;
  const s = gesture.sheet;

  if (gesture.mode === 'pinch' && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.max(16, Math.hypot(a.x - b.x, a.y - b.y));
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    s.rescale(d / gesture.pinch.dist);
    s.spin(ang - gesture.pinch.ang);
    gesture.pinch.dist = d;
    gesture.pinch.ang = ang;
    wake();
    return;
  }

  if (gesture.id !== e.pointerId) return;
  gesture.travel = Math.max(gesture.travel, Math.hypot(e.clientX - gesture.x0, e.clientY - gesture.y0));

  // the held point rides a plane at lift height; the rest of the sheet is
  // left to the solver, which is what produces the drag and the droop
  const h = s.restY + (reduced ? 6 : cfg.lift);
  const p = onPlane(ray(e.clientX, e.clientY), h);
  if (p) { s.pinTo = p; wake(); }
}, { passive: true });

function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (!gesture) return;

  if (pointers.size === 1 && gesture.mode === 'pinch') {
    gesture.mode = 'drag';
    gesture.id = [...pointers.keys()][0];
    return;
  }
  if (pointers.size > 0) return;

  const s = gesture.sheet;
  const moved = gesture.travel > 6;
  const tap = !moved && performance.now() - gesture.downT < 400;

  if (s.pinned >= 0) s.inv[s.pinned] = 1;
  s.pinned = -1;
  s.asleep = false;
  heldIdx = -1;
  canvas.classList.remove('grabbing');

  if (!tap) {
    const under = pick(e.clientX, e.clientY, s.index);
    promote(s.index, altDown ? 'under' : dropPolicy(), under ? under.sheet.index : null);
  } else {
    const now = performance.now();
    if (lastTap.id === s.index && now - lastTap.t < 340) { lastTap = { t: 0, id: null }; toggleInspect(s.index); }
    else { lastTap = { t: now, id: s.index }; promote(s.index, 'top'); }
  }

  gesture = null;
  wake();
}

canvas.addEventListener('pointerup', endPointer, { passive: true });
canvas.addEventListener('pointercancel', endPointer, { passive: true });

for (const t of ['dragstart', 'selectstart', 'contextmenu']) canvas.addEventListener(t, (e) => e.preventDefault());
for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, (e) => e.preventDefault(), { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
window.addEventListener('keydown', (e) => { if (e.key === 'Alt') altDown = true; });
document.addEventListener('pointerdown', () => document.body.classList.add('pointing'), true);
document.addEventListener('keydown', (e) => { if (e.key === 'Tab') document.body.classList.remove('pointing'); }, true);
window.addEventListener('keyup', (e) => { if (e.key === 'Alt') altDown = false; });
window.addEventListener('blur', () => { altDown = false; });

function dropPolicy() { return document.getElementById('c-drop').value; }

/* ───────────────────────── select and inspect ───────────────────────── */

function select(idx) {
  if (selected === idx) return;
  selected = idx;
  paintZList();
  if (idx != null && !document.body.classList.contains('pointing')) {
    const btn = document.querySelector(`#mirror [data-idx="${idx}"]`);
    if (btn && document.activeElement !== btn) btn.focus({ preventScroll: true });
  }
  wake();
}

function toggleInspect(idx) { if (inspecting === idx) exitInspect(); else enterInspect(idx); }

function enterInspect(idx) {
  inspecting = idx;
  const s = sheets[idx];
  const [cx, , cz] = s.centre();
  cam.target = [cx, 0, cz];
  cam.dist = Math.max(s.w, s.h) * 1.9;
  cam.pitch = 1.32;
  updateCamera();
  document.body.classList.add('inspecting');
  live.textContent = `Inspecting ${s.title}. Press Escape to go back.`;
  wake();
}

function exitInspect() {
  inspecting = null;
  cam.target = [0, 0, 0];
  cam.pitch = 0.92;
  resize();
  document.body.classList.remove('inspecting');
  wake();
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && inspecting != null) { exitInspect(); e.preventDefault(); }
});

/* ───────────────────── accessible mirror ─────────────────────
 * The canvas is unreadable to assistive tech, so the real content also
 * exists as a list of buttons. It is the fallback and the keyboard path at
 * once: focus follows selection in both directions.
 */

const mirror = document.getElementById('mirror');
const live = document.getElementById('live');

function buildMirror() {
  mirror.innerHTML = PIECES.map((p, i) =>
    `<li><button type="button" data-idx="${i}">` +
    `<strong>${p.t}</strong> <span>${p.med} · Ed. ${p.ed} · ${p.mm[0]}×${p.mm[1]} mm · ${p.gsm} gsm</span>` +
    `</button></li>`).join('');

  mirror.addEventListener('focusin', (e) => {
    const b = e.target.closest('button');
    if (b) select(Number(b.dataset.idx));
  });

  mirror.addEventListener('keydown', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const idx = Number(b.dataset.idx);
    const s = sheets[idx];
    const step = e.shiftKey ? 4 : 28;
    let used = true;
    const shift = (dx, dz) => {
      for (let k = 0; k < s.count; k++) { s.pos[k * 3] += dx; s.pos[k * 3 + 2] += dz; }
      s.prev.set(s.pos);
      s.asleep = false;
    };
    switch (e.key) {
      case 'ArrowLeft': shift(-step, 0); break;
      case 'ArrowRight': shift(step, 0); break;
      case 'ArrowUp': shift(0, -step); break;
      case 'ArrowDown': shift(0, step); break;
      case ',': s.spin(-0.08); break;
      case '.': s.spin(0.08); break;
      case '-': case '_': s.rescale(0.94); break;
      case '=': case '+': s.rescale(1.06); break;
      case '[': nudgeOrder(idx, -1); break;
      case ']': nudgeOrder(idx, 1); break;
      case 'Home': promote(idx, 'top'); break;
      case 'End': promote(idx, 'bottom'); break;
      case 'Enter': case ' ': toggleInspect(idx); break;
      default: used = false;
    }
    if (used) { e.preventDefault(); wake(); }
  });
}

function nudgeOrder(id, dir) {
  const at = order.indexOf(id);
  const to = clamp(at + dir, 0, order.length - 1);
  if (at === to) return;
  order.splice(at, 1);
  order.splice(to, 0, id);
  reflow();
  live.textContent = `${sheets[id].title} is now ${to + 1} of ${order.length} from the bottom.`;
}

/* ───────────────────────────── lab panel ───────────────────────────── */

const zlist = document.getElementById('zlist');

/** Match the readout's precision to the slider's own step. */
function decimals(input) {
  const step = String(input.step || '1');
  const dot = step.indexOf('.');
  return dot < 0 ? 0 : step.length - dot - 1;
}

function paintZList() {
  if (!zlist) return;
  const rows = [];
  for (let i = order.length - 1; i >= 0; i--) {
    const s = sheets[order[i]];
    const cls = [i === order.length - 1 ? 'is-top' : '', s.index === selected ? 'is-sel' : ''].join(' ').trim();
    rows.push(`<li class="${cls}"><span>${String(i + 1).padStart(2, '0')}</span><span>${s.title}</span></li>`);
  }
  zlist.innerHTML = rows.join('');
}

document.querySelectorAll('[data-cfg]').forEach((input) => {
  const key = input.dataset.cfg;
  const out = input.parentElement.querySelector('output');
  const sync = () => {
    if (input.type === 'checkbox') input.checked = !!cfg[key];
    else input.value = cfg[key];
    if (out) out.textContent = Number(cfg[key]).toFixed(decimals(input));
  };
  sync();
  input.addEventListener('input', () => {
    cfg[key] = input.type === 'checkbox' ? input.checked : Number(input.value);
    sync();
    writeJSON(SETTINGS_KEY, cfg);
    wake();
  });
});

function scatter(seed) {
  const rng = mulberry32(seed);
  order.forEach((id) => {
    const s = sheets[id];
    s.layFlat((rng() - 0.5) * 460, (rng() - 0.5) * 320, (rng() - 0.5) * 1.6);
  });
  wake();
}

document.getElementById('act-shuffle').addEventListener('click', () => {
  exitInspect();
  order = order.map((id) => ({ id, k: Math.random() })).sort((a, b) => a.k - b.k).map((o) => o.id);
  reflow();
  scatter(Math.floor(Math.random() * 1e9));
  live.textContent = 'Pile shuffled.';
});

document.getElementById('act-tidy').addEventListener('click', () => {
  exitInspect();
  order.forEach((id, i) => {
    const t = i / Math.max(1, order.length - 1);
    sheets[id].layFlat((t - 0.5) * 70, (t - 0.5) * 48, (t - 0.5) * 0.22);
  });
  live.textContent = 'Pile squared up.';
  wake();
});

document.getElementById('act-spread').addEventListener('click', () => {
  exitInspect();
  const cols = 4;
  order.forEach((id, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    sheets[id].layFlat((c - (cols - 1) / 2) * 330, (r - 1) * 370, 0);
  });
  live.textContent = 'Prints laid out as a contact sheet.';
  wake();
});

document.getElementById('act-drop').addEventListener('click', () => {
  // lift the whole pile and let it fall, which is the clearest single look
  // at what the solver is doing
  exitInspect();
  order.forEach((id, i) => {
    const s = sheets[id];
    const dx = (Math.random() - 0.5) * 90;
    const dz = (Math.random() - 0.5) * 90;
    const dy = 280 + i * 26;
    for (let k = 0; k < s.count; k++) {
      s.pos[k * 3] += dx;
      s.pos[k * 3 + 1] += dy;
      s.pos[k * 3 + 2] += dz;
    }
    s.prev.set(s.pos);
    s.vel.fill(0);
    s.asleep = false;
  });
  live.textContent = 'Dropped the pile.';
  wake();
});

document.getElementById('act-reset').addEventListener('click', () => {
  exitInspect();
  Object.assign(cfg, DEFAULTS);
  document.querySelectorAll('[data-cfg]').forEach((i) => {
    const key = i.dataset.cfg;
    if (i.type === 'checkbox') i.checked = !!cfg[key]; else i.value = cfg[key];
    const out = i.parentElement.querySelector('output');
    if (out) out.textContent = Number(cfg[key]).toFixed(decimals(i));
  });
  writeJSON(SETTINGS_KEY, cfg);
  order = PIECES.map((_, i) => i);
  reflow();
  scatter(7);
  live.textContent = 'Reset.';
});

const lab = document.getElementById('lab');
const labToggle = document.getElementById('lab-toggle');
if (window.innerWidth < 700) {
  lab.classList.add('closed');
  labToggle.textContent = '+';
  labToggle.setAttribute('aria-expanded', 'false');
}
labToggle.addEventListener('click', (e) => {
  const closed = lab.classList.toggle('closed');
  e.currentTarget.textContent = closed ? '+' : '–';
  e.currentTarget.setAttribute('aria-expanded', String(!closed));
});

/* ───────────────────────────── boot ───────────────────────────── */

function syncTheme() {
  const explicit = document.documentElement.dataset.theme;
  const dark = explicit === 'dark' ||
    (explicit !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark-ui', dark);
  wake();
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncTheme);

buildMirror();
syncTheme();
reflow();
scatter(7);
resize();
window.addEventListener('resize', resize);
wake();
