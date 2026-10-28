/* Paper Stack — a kinetic gallery of prints on a cutting mat.
 *
 * Approach under test: DOM elements + CSS 3D transforms, one shared
 * perspective, a hand-rolled spring integrator, and an explicit ordered
 * array as the single source of truth for stacking. See APPROACHES.md.
 */

'use strict';

/* ─────────────────────────── tunables ─────────────────────────── */

const DEFAULTS = {
  lift: 58,        // px of translateZ while a sheet is held
  tilt: 16,        // max degrees of lean, driven by drag velocity
  bow: 7,          // max degrees the sheet bends while held
  stiff: 200,      // spring stiffness for tilt / lift / settle
  damp: 22,        // spring damping
  mess: 4.5,       // degrees of random rotation added on each drop
  fling: 0.86,     // how much release velocity carries (0 = dead stop)
  drop: 'top',     // top | under | bottom
  persp: true,
  sheen: true,
  texture: true,
  curl: true,
};

const SETTINGS_KEY = 'paper-stack/settings/1';
const LAYOUT_KEY = 'paper-stack/layout/1';

const cfg = { ...DEFAULTS, ...readJSON(SETTINGS_KEY) };

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ─────────────────────────── utilities ─────────────────────────── */

function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}
const CAPTION_H = 34;

/* ───────────────────────────── state ───────────────────────────── */

const stage = document.getElementById('stage');
const scrim = document.getElementById('scrim');
const live = document.getElementById('live');

/** Bottom-to-top stacking order. The single source of truth. */
let order = [];
const sheets = new Map();
/** Sheets with live springs, stepped each frame. */
const active = new Set();

let unit = 1;
let selected = null;
let focusedId = null;
let altDown = false;
let lastTap = { t: 0, id: null };
/** Only one sheet may be held at a time; stray pointers are ignored. */
let heldId = null;

const Z = { drag: 7000, focus: 8100 };

/* ───────────────────────────── build ───────────────────────────── */

function buildSheets() {
  const frag = document.createDocumentFragment();

  PIECES.forEach((p, i) => {
    const id = 'p' + i;
    const rng = mulberry32(p.seed);
    const w = Math.round(p.mm[0] * MM);
    const h = Math.round(p.mm[1] * MM) + CAPTION_H;
    const inks = p.inks.map((k) => INKS[k] || k);

    const el = document.createElement('article');
    el.className = 'sheet';
    el.dataset.id = id;
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label',
      `${p.t}. ${p.med}, edition ${p.ed}, ${p.mm[0]} by ${p.mm[1]} millimetres. Press Enter to inspect, arrow keys to move, bracket keys to restack.`);

    el.innerHTML =
      `<div class="bow"><div class="face${cfg.texture ? ' texture' : ''}">` +
        `<div class="art"><svg viewBox="0 0 ${w} ${h - CAPTION_H}" aria-hidden="true">` +
          ART[p.art](rng, w, h - CAPTION_H, inks) +
        `</svg></div>` +
        `<i class="crop tl"></i><i class="crop tr"></i><i class="crop bl"></i><i class="crop br"></i>` +
        `<div class="sheen"></div><div class="curl"></div>` +
        `<div class="caption"><span class="t">${p.t}</span>` +
        `<span class="s">${p.med} · Ed. ${p.ed} · ${p.mm[0]}×${p.mm[1]} mm · ${p.gsm} gsm</span></div>` +
      `</div></div>` +
      `<button class="handle resize" data-role="resize" tabindex="-1" aria-label="Resize ${p.t}"></button>` +
      `<button class="handle rotate" data-role="rotate" tabindex="-1" aria-label="Rotate ${p.t}">` +
        `<svg viewBox="0 0 24 24" aria-hidden="true">` +
          `<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4.2V10h-5.8"/>` +
        `</svg></button>`;

    const s = {
      id, el, piece: p, bw: w, bh: h,
      x: 0, y: 0, rot: 0, scale: 1,
      vx: 0, vy: 0, vrot: 0,
      tx: 0, ty: 0, vtx: 0, vty: 0, txT: 0, tyT: 0,
      v_x: 0, v_y: 0, v_rot: 0, v_scale: 0,
      lift: 0, vlift: 0, liftT: 0,
      bow: 0, vbow: 0, bowT: 0,
      z: 0,
      pop: 0, vpop: 0, popT: 0,
      dragging: false, pinching: false,
      goal: null, home: null,
      face: el.querySelector('.face'),
      sheen: el.querySelector('.sheen'),
      curl: el.querySelector('.curl'),
    };

    sheets.set(id, s);
    order.push(id);
    frag.appendChild(el);
  });

  stage.appendChild(frag);
}

/* ─────────────────────── sizing and layout ─────────────────────── */

function stageSize() {
  return { w: stage.clientWidth, h: stage.clientHeight };
}

function applyUnit() {
  const { w, h } = stageSize();
  const next = clamp(Math.min(w / 1180, h / 760), 0.66, 1);
  const ratio = next / unit;
  unit = next;
  for (const s of sheets.values()) {
    s.w = s.bw * unit;
    s.h = s.bh * unit;
    s.el.style.width = s.w + 'px';
    s.el.style.height = s.h + 'px';
    if (ratio !== 1) { s.x *= ratio; s.y *= ratio; }
  }
}

/** Messy pile: everything roughly centred, hand-dropped angles. */
function scatter(seed) {
  const rng = mulberry32(seed);
  const { w, h } = stageSize();
  const spreadX = Math.min(w * 0.3, 330);
  const spreadY = Math.min(h * 0.26, 210);
  order.forEach((id) => {
    const s = sheets.get(id);
    s.x = (rng() - 0.5) * 2 * spreadX;
    s.y = (rng() - 0.5) * 2 * spreadY + h * 0.02;
    s.rot = (rng() - 0.5) * 46;
    s.scale = 0.92 + rng() * 0.22;
    settleTo(s);
  });
}

/** Neat fan, like a stack squared up against a table edge. */
function tidy() {
  const n = order.length;
  order.forEach((id, i) => {
    const s = sheets.get(id);
    const t = i / Math.max(1, n - 1);
    s.x = (t - 0.5) * 34;
    s.y = (t - 0.5) * 22;
    s.rot = (t - 0.5) * 9;
    s.scale = 1;
    settleTo(s);
  });
}

/** Contact sheet: everything visible at once, nothing overlapping. */
function spread() {
  const { w, h } = stageSize();
  const cols = w < 700 ? 3 : 4;
  const rows = Math.ceil(order.length / cols);
  const cw = Math.min(w / (cols + 0.4), 260);
  const ch = Math.min(h / (rows + 0.4), 280);
  order.forEach((id, i) => {
    const s = sheets.get(id);
    const c = i % cols;
    const r = Math.floor(i / cols);
    s.x = (c - (cols - 1) / 2) * cw;
    s.y = (r - (rows - 1) / 2) * ch;
    s.rot = 0;
    s.scale = Math.min(cw / s.w, ch / s.h) * 0.94;
    settleTo(s);
  });
}

function settleTo(s) {
  s.vx = s.vy = s.vrot = 0;
  wake(s);
}

/* ───────────────────────── stacking order ─────────────────────────
 * One array, one integer pass. Nothing anywhere else writes z-index, so
 * the stack can never drift out of sync or climb toward 2^31.
 */

function reflow() {
  order.forEach((id, i) => {
    const s = sheets.get(id);
    s.z = i + 1;
    if (!s.dragging && focusedId !== s.id) s.el.style.zIndex = s.z;
  });
  paintZList();
}

function promote(id, policy, point) {
  const at = order.indexOf(id);
  if (at < 0) return;
  order.splice(at, 1);

  if (policy === 'bottom') {
    order.unshift(id);
  } else if (policy === 'under' && point) {
    const below = sheetAt(point, id);
    const idx = below ? order.indexOf(below) : -1;
    if (idx >= 0) order.splice(idx, 0, id);
    else order.push(id);
  } else {
    order.push(id);
  }
  reflow();
  announce(id, policy);
}

/** Topmost sheet under a screen point, honouring rotation. */
function sheetAt(point, exceptId) {
  const hits = document.elementsFromPoint(point.x, point.y);
  for (const el of hits) {
    const sheetEl = el.closest && el.closest('.sheet');
    if (sheetEl && sheetEl.dataset.id !== exceptId) return sheetEl.dataset.id;
  }
  return null;
}

function announce(id, policy) {
  const s = sheets.get(id);
  if (!s) return;
  const pos = order.indexOf(id) + 1;
  const where = policy === 'bottom' ? 'to the bottom' : policy === 'under' ? 'under the sheet below the pointer' : 'to the top';
  live.textContent = `${s.piece.t} moved ${where}. Position ${pos} of ${order.length}.`;
}

/* ───────────────────────── render + simulation ───────────────────────── */

function paint(s) {
  const z = s.lift * cfg.lift + s.pop * 130;
  s.el.style.transform =
    `translate3d(${(s.x - s.w / 2).toFixed(2)}px, ${(s.y - s.h / 2).toFixed(2)}px, ${z.toFixed(2)}px)` +
    ` rotateZ(${s.rot.toFixed(2)}deg)` +
    ` rotateX(${s.tx.toFixed(2)}deg) rotateY(${s.ty.toFixed(2)}deg)` +
    ` scale(${s.scale.toFixed(4)})`;
  s.el.style.setProperty('--lift', s.lift.toFixed(3));
  s.el.style.setProperty('--bow', (-s.bow).toFixed(2));
  // light stays put while the sheet turns, so the sheen sweeps across it
  s.el.style.setProperty('--sheen-angle', (118 - s.rot - s.ty * 1.6).toFixed(1));
}

function wake(s) {
  active.add(s);
  if (!running) start();
}

function sleep(s) {
  active.delete(s);
}

function step(dt) {
  const k = cfg.stiff;
  const c = cfg.damp;

  for (const s of Array.from(active)) {
    // tilt, lift and bend are always springs — that is where the weight lives
    let a = (s.txT - s.tx) * k - s.vtx * c; s.vtx += a * dt; s.tx += s.vtx * dt;
    a = (s.tyT - s.ty) * k - s.vty * c; s.vty += a * dt; s.ty += s.vty * dt;
    a = (s.liftT - s.lift) * k - s.vlift * c; s.vlift += a * dt; s.lift += s.vlift * dt;
    a = (s.bowT - s.bow) * k - s.vbow * c; s.vbow += a * dt; s.bow += s.vbow * dt;

    a = (s.popT - s.pop) * k - s.vpop * c; s.vpop += a * dt; s.pop += s.vpop * dt;

    // position is 1:1 with the pointer while held; momentum only after release
    if (!s.dragging && !s.pinching && !s.goal) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rot += s.vrot * dt;
      const fr = Math.exp(-6.5 * dt);
      s.vx *= fr; s.vy *= fr; s.vrot *= fr;
      bounds(s);
    }

    // inspect mode drives the sheet to a goal transform and, on the way back,
    // to the exact transform it was lifted from
    if (s.goal) {
      const kk = k * 0.5;
      const cc = c * 0.78;
      for (const key of ['x', 'y', 'rot', 'scale']) {
        const vk = 'v_' + key;
        const acc = (s.goal[key] - s[key]) * kk - s[vk] * cc;
        s[vk] += acc * dt;
        s[key] += s[vk] * dt;
      }
      const near = Math.abs(s.goal.x - s.x) < 0.4 && Math.abs(s.goal.y - s.y) < 0.4 &&
        Math.abs(s.goal.rot - s.rot) < 0.2 && Math.abs(s.goal.scale - s.scale) < 0.004;
      if (near) {
        s.x = s.goal.x; s.y = s.goal.y; s.rot = s.goal.rot; s.scale = s.goal.scale;
        s.v_x = s.v_y = s.v_rot = s.v_scale = 0;
        s.goal = null;
        if (focusedId !== s.id) s.el.style.zIndex = s.z;
      }
    }

    paint(s);

    const asleep =
      !s.dragging && !s.pinching && !s.goal &&
      Math.abs(s.vx) < 1 && Math.abs(s.vy) < 1 && Math.abs(s.vrot) < 0.4 &&
      Math.abs(s.vtx) < 0.4 && Math.abs(s.vty) < 0.4 &&
      Math.abs(s.tx - s.txT) < 0.05 && Math.abs(s.ty - s.tyT) < 0.05 &&
      Math.abs(s.lift - s.liftT) < 0.002 && Math.abs(s.bow - s.bowT) < 0.03 &&
      Math.abs(s.pop - s.popT) < 0.002;
    if (asleep) {
      s.tx = s.txT; s.ty = s.tyT; s.lift = s.liftT; s.bow = s.bowT; s.pop = s.popT;
      s.vx = s.vy = s.vrot = 0;
      paint(s);
      sleep(s);
    }
  }
}

/** Keep a sheet from sailing off the table. */
function bounds(s) {
  const { w, h } = stageSize();
  const mx = w / 2 + s.w * 0.3;
  const my = h / 2 + s.h * 0.3;
  if (s.x < -mx) { s.x = -mx; s.vx *= -0.3; }
  if (s.x > mx) { s.x = mx; s.vx *= -0.3; }
  if (s.y < -my) { s.y = -my; s.vy *= -0.3; }
  if (s.y > my) { s.y = my; s.vy *= -0.3; }
}

let running = false;
let last = 0;
let acc = 0;
let frames = 0;
let fpsAt = 0;
const fpsOut = document.getElementById('fps');

function frame(now) {
  if (!running) return;
  const dtReal = Math.min(0.05, (now - last) / 1000) || 0;
  last = now;

  // fixed substeps keep the springs stable at any frame rate
  acc += dtReal;
  const H = 1 / 120;
  let guard = 8;
  while (acc >= H && guard-- > 0) { step(H); acc -= H; }
  if (guard <= 0) acc = 0;

  frames++;
  if (now - fpsAt > 500) {
    if (fpsOut) fpsOut.textContent = String(Math.round((frames * 1000) / (now - fpsAt))).padStart(2, '0') + ' fps';
    frames = 0;
    fpsAt = now;
  }

  if (active.size === 0) { running = false; if (fpsOut) fpsOut.textContent = 'idle'; return; }
  requestAnimationFrame(frame);
}

function start() {
  if (running) return;
  running = true;
  last = performance.now();
  fpsAt = last;
  frames = 0;
  acc = 0;
  requestAnimationFrame(frame);
}

/* ───────────────────────────── pointers ─────────────────────────────
 * One sheet can hold two pointers: the second turns a drag into a pinch,
 * which scales and rotates about the midpoint between the fingers.
 */

const live2 = new Map(); // pointerId -> { id, x, y }
const grips = new Map(); // sheetId -> { ids: [], ... }

function stagePoint(e) {
  const r = stage.getBoundingClientRect();
  return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
}

stage.addEventListener('pointerdown', (e) => {
  const handleEl = e.target.closest && e.target.closest('.handle');
  const el = e.target.closest && e.target.closest('.sheet');
  if (!el) { select(null); return; }
  const s = sheets.get(el.dataset.id);
  if (!s) return;

  // Nothing native is wanted here: no text selection, no image drag, no
  // long-press menu, no synthetic mouse events. Focus is moved by hand
  // instead, and the double-tap is detected from the grip, so suppressing
  // the default costs nothing.
  e.preventDefault();

  // A second finger that lands on a different sheet is a slip, not a
  // gesture. Without this guard two sheets drag at once.
  if (heldId && heldId !== s.id) return;

  select(s.id);
  if (focusedId && focusedId !== s.id) exitFocus();
  if (document.activeElement !== el) el.focus({ preventScroll: true });

  if (handleEl) { beginHandle(s, e, handleEl.dataset.role); return; }
  beginGrip(s, e);
}, { passive: false });

function beginGrip(s, e) {
  const p = stagePoint(e);
  live2.set(e.pointerId, { id: s.id, x: p.x, y: p.y });

  let g = grips.get(s.id);
  if (!g) {
    g = { ids: [], mode: 'drag' };
    grips.set(s.id, g);
    heldId = s.id;
    s.el.classList.add('dragging');
    s.el.style.zIndex = Z.drag;
    s.dragging = true;
    s.liftT = 1;
    s.bowT = reduced ? 0 : cfg.bow;
    s.vx = s.vy = s.vrot = 0;
    wake(s);
  }
  if (g.ids.length >= 2) { live2.delete(e.pointerId); return; }
  g.ids.push(e.pointerId);

  if (g.ids.length === 1) {
    g.grabX = p.x - s.x;
    g.grabY = p.y - s.y;
    g.lastX = p.x; g.lastY = p.y; g.lastT = performance.now();
    g.downX = p.x; g.downY = p.y; g.downT = performance.now();
    g.travel = 0;
    g.vx = 0; g.vy = 0;
  } else if (g.ids.length === 2) {
    startPinch(s, g);
  }
}

function startPinch(s, g) {
  const [a, b] = g.ids.map((id) => live2.get(id));
  if (!a || !b) return;
  g.mode = 'pinch';
  s.pinching = true;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  g.pinch = {
    dist: Math.max(12, Math.hypot(a.x - b.x, a.y - b.y)),
    ang: Math.atan2(b.y - a.y, b.x - a.x),
    scale0: s.scale,
    rot0: s.rot,
    // vector from the sheet's centre to the finger midpoint, so that point
    // stays pinned under the fingers as the sheet scales and turns
    vx: mid.x - s.x,
    vy: mid.y - s.y,
  };
}

window.addEventListener('pointermove', (e) => {
  const rec = live2.get(e.pointerId);
  if (!rec) return;
  const p = stagePoint(e);
  rec.x = p.x; rec.y = p.y;

  const s = sheets.get(rec.id);
  const g = grips.get(rec.id);
  if (!s) return;

  if (g && g.mode === 'pinch') {
    const [a, b] = g.ids.map((id) => live2.get(id));
    if (!a || !b) return;
    const q = g.pinch;
    const dist = Math.max(12, Math.hypot(a.x - b.x, a.y - b.y));
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const k = clamp(dist / q.dist, 0.3, 4);
    const dr = ang - q.ang;

    s.scale = clamp(q.scale0 * k, 0.3, 2.6);
    s.rot = q.rot0 + (dr * 180) / Math.PI;

    const cos = Math.cos(dr), sin = Math.sin(dr);
    const f = s.scale / q.scale0;
    const vx = (q.vx * cos - q.vy * sin) * f;
    const vy = (q.vx * sin + q.vy * cos) * f;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    s.x = mid.x - vx;
    s.y = mid.y - vy;
    wake(s);
    return;
  }

  if (g && g.mode === 'drag' && g.ids[0] === e.pointerId) {
    s.x = p.x - g.grabX;
    s.y = p.y - g.grabY;

    const now = performance.now();
    const dt = Math.max(8, now - g.lastT) / 1000;
    const ivx = (p.x - g.lastX) / dt;
    const ivy = (p.y - g.lastY) / dt;
    g.vx = g.vx * 0.72 + ivx * 0.28;
    g.vy = g.vy * 0.72 + ivy * 0.28;
    g.lastX = p.x; g.lastY = p.y; g.lastT = now;
    g.travel = Math.max(g.travel || 0, Math.hypot(p.x - g.downX, p.y - g.downY));

    if (!reduced) {
      // the sheet leans into the direction of travel
      s.tyT = clamp(g.vx / 90, -1, 1) * cfg.tilt;
      s.txT = clamp(-g.vy / 90, -1, 1) * cfg.tilt;
    }
    wake(s);
    return;
  }

  if (g && g.mode === 'handle') {
    moveHandle(s, g, p, e.shiftKey || g.shift);
  }
}, { passive: true });

function endPointer(e) {
  const rec = live2.get(e.pointerId);
  if (!rec) return;
  live2.delete(e.pointerId);

  const s = sheets.get(rec.id);
  const g = grips.get(rec.id);
  if (!s || !g) return;

  g.ids = g.ids.filter((id) => id !== e.pointerId);

  if (g.ids.length === 1) {
    // dropped to one finger: hand control back to a plain drag
    const remaining = live2.get(g.ids[0]);
    g.mode = 'drag';
    s.pinching = false;
    if (remaining) {
      g.grabX = remaining.x - s.x;
      g.grabY = remaining.y - s.y;
      g.lastX = remaining.x; g.lastY = remaining.y; g.lastT = performance.now();
      g.vx = g.vy = 0;
    }
    return;
  }

  if (g.ids.length > 0) return;

  // last pointer up: release the sheet
  grips.delete(rec.id);
  if (heldId === rec.id) heldId = null;
  s.dragging = false;
  s.pinching = false;
  s.el.classList.remove('dragging');
  s.liftT = 0;
  s.bowT = 0;
  s.txT = 0;
  s.tyT = 0;

  const moved = (g.travel || 0) > 6;
  if (g.mode === 'handle') hideAngle();

  if (g.mode !== 'handle' && !reduced && moved) {
    s.vx = (g.vx || 0) * cfg.fling;
    s.vy = (g.vy || 0) * cfg.fling;
    s.vrot = clamp((g.vx || 0) / 26, -140, 140);
    // every hand-placed sheet lands a little crooked
    s.rot += (Math.random() - 0.5) * cfg.mess;
  }

  const policy = altDown ? 'under' : cfg.drop;
  promote(s.id, policy, { x: e.clientX, y: e.clientY });
  wake(s);

  // a tap that went nowhere is a request to look closer, not a move
  if (!moved && g.mode === 'drag' && performance.now() - (g.downT || 0) < 400) {
    const now = performance.now();
    if (lastTap.id === s.id && now - lastTap.t < 340) {
      lastTap = { t: 0, id: null };
      toggleFocus(s.id);
    } else {
      lastTap = { t: now, id: s.id };
    }
  }
}

window.addEventListener('pointerup', endPointer, { passive: true });
window.addEventListener('pointercancel', endPointer, { passive: true });

/* ───────────── corner handles: one resizes, one rotates ─────────────
 * Both ride the sheet's corners, so they turn with it. Rotation is about
 * the sheet's own centre and follows the pointer's angle, with Shift
 * snapping to 15° the way this gesture behaves everywhere else.
 */

const angleBadge = document.getElementById('angle');

function beginHandle(s, e, role) {
  const p = stagePoint(e);
  live2.set(e.pointerId, { id: s.id, x: p.x, y: p.y });
  const g = {
    ids: [e.pointerId],
    mode: 'handle',
    role: role === 'rotate' ? 'rotate' : 'resize',
    scale0: s.scale,
    rot0: s.rot,
    d0: Math.max(16, Math.hypot(p.x - s.x, p.y - s.y)),
    a0: Math.atan2(p.y - s.y, p.x - s.x),
  };
  grips.set(s.id, g);
  heldId = s.id;
  s.dragging = true;
  s.el.classList.add('dragging');
  s.el.style.zIndex = Z.drag;
  // a quarter lift: enough to read as picked up, not so much that the sheet
  // slides out from under the handle being held
  s.liftT = 0.4;
  if (g.role === 'rotate') showAngle(s);
  wake(s);
}

function moveHandle(s, g, p, snap) {
  if (g.role === 'rotate') {
    const a = Math.atan2(p.y - s.y, p.x - s.x);
    let deg = g.rot0 + ((a - g.a0) * 180) / Math.PI;
    if (snap) deg = Math.round(deg / 15) * 15;
    s.rot = deg;
    showAngle(s);
  } else {
    const d = Math.max(16, Math.hypot(p.x - s.x, p.y - s.y));
    s.scale = clamp(g.scale0 * (d / g.d0), 0.3, 2.6);
  }
  wake(s);
}

/** Live degrees on the mat above the sheet, wrapped to a readable range. */
function showAngle(s) {
  if (!angleBadge) return;
  let deg = s.rot % 360;
  if (deg > 180) deg -= 360;
  if (deg < -180) deg += 360;
  angleBadge.textContent = `${deg > 0 ? '+' : ''}${Math.round(deg)}\u00b0`;
  // clear the sheet's *rotated* bounding box, so the badge stays above the
  // paper at every angle rather than sliding across it
  const rad = (s.rot * Math.PI) / 180;
  const half = (Math.abs(s.w * Math.sin(rad)) + Math.abs(s.h * Math.cos(rad))) * s.scale / 2;
  angleBadge.style.transform =
    `translate(calc(-50% + ${s.x.toFixed(1)}px), calc(-50% + ${(s.y - half - 22).toFixed(1)}px))`;
  angleBadge.hidden = false;
}

function hideAngle() { if (angleBadge) angleBadge.hidden = true; }

window.addEventListener('keydown', (e) => {
  if (e.key === 'Alt') altDown = true;
  if (e.key === 'Shift') for (const g of grips.values()) g.shift = true;
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'Alt') altDown = false;
  if (e.key === 'Shift') for (const g of grips.values()) g.shift = false;
});
window.addEventListener('blur', () => { altDown = false; });

/* Native behaviours that fight a direct-manipulation surface. */
for (const type of ['dragstart', 'selectstart', 'contextmenu']) {
  stage.addEventListener(type, (e) => e.preventDefault());
}
// Safari's own pinch-zoom would otherwise swallow the two-finger gesture
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}
// and its double-tap zoom
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

/* Show the keyboard focus ring only when the keyboard is what moved focus. */
document.addEventListener('pointerdown', () => document.body.classList.add('pointing'), true);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') document.body.classList.remove('pointing');
}, true);

/* ───────────────────────────── selection ───────────────────────────── */

function select(id) {
  if (selected === id) return;
  if (selected) sheets.get(selected)?.el.classList.remove('selected');
  selected = id;
  if (id) sheets.get(id).el.classList.add('selected');
  paintZList();
}

/* ─────────────────────── inspect (focus) mode ───────────────────────
 * Raising a sheet to read it must not disturb the stack, so the order
 * array is untouched and the sheet rides an out-of-band z-index.
 */

function enterFocus(id) {
  const s = sheets.get(id);
  if (!s) return;
  if (focusedId) exitFocus();
  focusedId = id;
  s.home = { x: s.x, y: s.y, rot: s.rot, scale: s.scale };
  s.el.style.zIndex = Z.focus;
  scrim.classList.add('on');

  const { w, h } = stageSize();
  const fit = Math.min((w * 0.84) / s.w, (h * 0.84) / s.h, 2.4);
  s.goal = { x: 0, y: 0, rot: 0, scale: fit };
  s.v_x = s.v_y = s.v_rot = s.v_scale = 0;
  s.vx = s.vy = s.vrot = 0;
  s.txT = s.tyT = 0;
  s.popT = 1;
  live.textContent = `Inspecting ${s.piece.t}. Press Escape to put it back.`;
  paint(s);
  wake(s);
}

function exitFocus() {
  const s = sheets.get(focusedId);
  focusedId = null;
  scrim.classList.remove('on');
  if (!s) return;
  s.goal = s.home || { x: s.x, y: s.y, rot: s.rot, scale: s.scale };
  s.home = null;
  s.popT = 0;
  s.v_x = s.v_y = s.v_rot = s.v_scale = 0;
  wake(s);
}

function toggleFocus(id) {
  if (focusedId === id) exitFocus();
  else enterFocus(id);
}

scrim.addEventListener('pointerdown', (e) => { e.preventDefault(); exitFocus(); });

/* Double-tap and double-click are the same gesture here: two stationary
 * releases on one sheet. Detecting it from the grip rather than from the
 * native dblclick event keeps mouse and touch on identical paths. */

/* ───────────────────────────── keyboard ─────────────────────────────
 * The whole reason to keep this in the DOM: the pile is operable without
 * a pointer, and every sheet is a real focusable element.
 */

stage.addEventListener('focusin', (e) => {
  const el = e.target.closest && e.target.closest('.sheet');
  if (el) select(el.dataset.id);
});

stage.addEventListener('keydown', (e) => {
  const el = e.target.closest && e.target.closest('.sheet');
  if (!el) return;
  const s = sheets.get(el.dataset.id);
  if (!s) return;
  const nudge = e.shiftKey ? 1 : 10;
  let used = true;

  switch (e.key) {
    case 'ArrowLeft': s.x -= nudge; break;
    case 'ArrowRight': s.x += nudge; break;
    case 'ArrowUp': s.y -= nudge; break;
    case 'ArrowDown': s.y += nudge; break;
    case ',': s.rot -= e.shiftKey ? 1 : 5; flashAngle(s); break;
    case '.': s.rot += e.shiftKey ? 1 : 5; flashAngle(s); break;
    case '-': case '_': s.scale = clamp(s.scale - 0.06, 0.3, 2.6); break;
    case '=': case '+': s.scale = clamp(s.scale + 0.06, 0.3, 2.6); break;
    case '[': nudgeOrder(s.id, -1); break;
    case ']': nudgeOrder(s.id, +1); break;
    case 'Home': promote(s.id, 'top'); break;
    case 'End': promote(s.id, 'bottom'); break;
    case 'Enter': case ' ': toggleFocus(s.id); break;
    case 'Escape': if (focusedId) exitFocus(); else used = false; break;
    default: used = false;
  }

  if (used) {
    e.preventDefault();
    wake(s);
  }
});

let angleTimer = 0;
/** The same badge, briefly, when the rotation came from the keyboard. */
function flashAngle(s) {
  showAngle(s);
  clearTimeout(angleTimer);
  angleTimer = setTimeout(hideAngle, 900);
}

function nudgeOrder(id, dir) {
  const at = order.indexOf(id);
  const to = clamp(at + dir, 0, order.length - 1);
  if (at === to) return;
  order.splice(at, 1);
  order.splice(to, 0, id);
  reflow();
  const s = sheets.get(id);
  live.textContent = `${s.piece.t} is now ${to + 1} of ${order.length} from the bottom.`;
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && focusedId) { exitFocus(); e.preventDefault(); }
});

/* ───────────────────────────── lab panel ───────────────────────────── */

const zlist = document.getElementById('zlist');

function paintZList() {
  if (!zlist) return;
  const rows = [];
  for (let i = order.length - 1; i >= 0; i--) {
    const s = sheets.get(order[i]);
    const cls = [i === order.length - 1 ? 'is-top' : '', order[i] === selected ? 'is-sel' : ''].join(' ').trim();
    rows.push(`<li class="${cls}"><span>${String(i + 1).padStart(2, '0')}</span><span>${s.piece.t}</span></li>`);
  }
  zlist.innerHTML = rows.join('');
}

function applyCfg() {
  stage.classList.toggle('flat', !cfg.persp);
  for (const s of sheets.values()) {
    s.face.classList.toggle('texture', cfg.texture);
    s.sheen.hidden = !cfg.sheen;
    s.curl.hidden = !cfg.curl;
    paint(s);
  }
  writeJSON(SETTINGS_KEY, cfg);
}

document.querySelectorAll('[data-cfg]').forEach((input) => {
  const key = input.dataset.cfg;
  const out = input.parentElement.querySelector('output');
  const sync = () => {
    if (input.type === 'checkbox') input.checked = !!cfg[key];
    else input.value = cfg[key];
    if (out) out.textContent = Number(cfg[key]).toFixed(input.step && Number(input.step) < 1 ? 2 : 0);
  };
  sync();
  input.addEventListener('input', () => {
    cfg[key] = input.type === 'checkbox' ? input.checked
      : input.tagName === 'SELECT' ? input.value
      : Number(input.value);
    sync();
    applyCfg();
  });
});

document.getElementById('act-shuffle').addEventListener('click', () => {
  exitFocus();
  // a fresh shuffle also restacks, so the order array is rebuilt in one pass
  order = order.map((id) => ({ id, k: Math.random() })).sort((a, b) => a.k - b.k).map((o) => o.id);
  reflow();
  scatter(Math.floor(Math.random() * 1e9));
  live.textContent = 'Pile shuffled.';
});
document.getElementById('act-tidy').addEventListener('click', () => { exitFocus(); tidy(); live.textContent = 'Pile squared up.'; });
document.getElementById('act-spread').addEventListener('click', () => { exitFocus(); spread(); live.textContent = 'Prints laid out as a contact sheet.'; });
document.getElementById('act-reset').addEventListener('click', () => {
  exitFocus();
  Object.assign(cfg, DEFAULTS);
  document.querySelectorAll('[data-cfg]').forEach((i) => {
    const key = i.dataset.cfg;
    if (i.type === 'checkbox') i.checked = !!cfg[key]; else i.value = cfg[key];
    const out = i.parentElement.querySelector('output');
    if (out) out.textContent = Number(cfg[key]).toFixed(i.step && Number(i.step) < 1 ? 2 : 0);
  });
  order = PIECES.map((_, i) => 'p' + i);
  reflow();
  scatter(7);
  applyCfg();
  live.textContent = 'Reset.';
});

const lab = document.getElementById('lab');
const labToggle = document.getElementById('lab-toggle');

// on a phone the lab would cover the table, so it starts out of the way
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

document.documentElement.style.setProperty('--grain', makeGrain());

buildSheets();
applyUnit();
reflow();

const saved = readJSON(LAYOUT_KEY);
if (saved && Array.isArray(saved.order) && saved.order.length === PIECES.length) {
  order = saved.order;
  reflow();
  saved.sheets.forEach((rec) => {
    const s = sheets.get(rec.id);
    if (!s) return;
    s.x = rec.x; s.y = rec.y; s.rot = rec.rot; s.scale = rec.scale;
  });
} else {
  scatter(7);
}

applyCfg();
for (const s of sheets.values()) paint(s);

let resizeAt = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeAt);
  resizeAt = setTimeout(() => {
    applyUnit();
    for (const s of sheets.values()) { bounds(s); paint(s); }
  }, 120);
});

window.addEventListener('pagehide', () => {
  writeJSON(LAYOUT_KEY, {
    order,
    sheets: order.map((id) => {
      const s = sheets.get(id);
      return { id, x: s.x, y: s.y, rot: s.rot, scale: s.scale };
    }),
  });
});
