(function () {
  "use strict";

  // ---- the ten cues -------------------------------------------------------

  var CUES = [
    { id: "owl",       name: "Owl call",      key: "1", cap: "#6c7fd8", loop: false, fx: "moonwash",  match: ["owl", "hoot"] },
    { id: "coyote",    name: "Coyote",        key: "2", cap: "#e0902f", loop: false, fx: "horizon",   match: ["coyote", "wolf", "howl"] },
    { id: "thunder",   name: "Thunder",       key: "3", cap: "#e8ecf2", loop: false, fx: "lightning", match: ["thunder", "lightning", "storm"] },
    { id: "footsteps", name: "Footsteps",     key: "4", cap: "#7f9a4e", loop: true,  fx: "stalk",     match: ["footstep", "steps", "leaf", "leaves", "crunch", "stalk"] },
    { id: "growl",     name: "Growl",         key: "5", cap: "#b5342a", loop: false, fx: "growl",     match: ["growl", "snarl", "beast"] },
    { id: "scuttle",   name: "Scuttling",     key: "6", cap: "#c3d03a", loop: true,  fx: "scuttle",   match: ["scuttle", "insect", "bug", "chitin", "skitter", "spider"] },
    { id: "brook",     name: "Babbling brook",key: "7", cap: "#35a8a0", loop: true,  fx: "brook",     match: ["brook", "stream", "creek", "water", "river"] },
    { id: "wind",      name: "Wind & creaks", key: "8", cap: "#8aa3b8", loop: true,  fx: "wind",      match: ["wind", "branch", "creak", "trees", "gust"] },
    { id: "wail",      name: "Ghostly wail",  key: "9", cap: "#a98ad6", loop: false, fx: "wail",      match: ["wail", "moan", "ghost", "spirit", "whisper"] },
    { id: "scream",    name: "Scream",        key: "0", cap: "#e8324f", loop: false, fx: "scream",    match: ["scream", "shriek", "yell"] }
  ];

  var byId = {};
  CUES.forEach(function (c) { byId[c.id] = c; });

  var padsEl = document.getElementById("pads");
  var armedEl = document.getElementById("armed");
  var rackStateEl = document.getElementById("rackstate");
  var unmatchedEl = document.getElementById("unmatched");
  var rackEl = document.getElementById("rack");
  var consoleEl = document.getElementById("console");
  var flashEl = document.getElementById("flash");
  var canvas = document.getElementById("fx");
  var volumeEl = document.getElementById("volume");
  var runningEl = document.getElementById("running");
  var softenEl = document.getElementById("soften");
  var filesEl = document.getElementById("files");

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) { softenEl.checked = true; }

  // ---- pad markup ---------------------------------------------------------

  CUES.forEach(function (c) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "pad empty";
    b.style.setProperty("--cap", c.cap);
    b.dataset.id = c.id;
    b.setAttribute("aria-pressed", "false");
    b.innerHTML =
      '<span class="keytag">' + c.key + '</span>' +
      '<span class="led" aria-hidden="true"></span>' +
      (c.loop ? '<span class="looptag">LOOP</span>' : '') +
      '<span class="cap" aria-hidden="true"><span>' + c.key + '</span></span>' +
      '<span class="plate"><span class="name"></span><span class="meta">No clip</span></span>';
    b.querySelector(".name").textContent = c.name;
    b.addEventListener("click", function () { fire(c.id); });
    padsEl.appendChild(b);
    c.el = b;
    c.metaEl = b.querySelector(".meta");
    wirePadDrop(c);
  });

  function setMeta(c, text) { c.metaEl.textContent = text; }

  function refreshArmed() {
    var n = CUES.filter(function (c) { return !!(c.buffer || c.bytes); }).length;
    armedEl.innerHTML = n === 0
      ? "No clips loaded yet"
      : "<b>" + n + "</b> of " + CUES.length + " pads armed";
    rackStateEl.textContent = n === 0 ? "Rack empty" : n + " clip" + (n === 1 ? "" : "s") + " in the rack";
  }
  refreshArmed();

  // ---- audio --------------------------------------------------------------

  var ctx = null, master = null, bus = null;
  var playing = {};   // pad id -> the voice currently held by that pad
  var voices = [];    // every live voice, however it was started

  /*
   * Nothing may build the audio graph before the viewer has pressed something.
   * A context constructed during page load starts `suspended` under every
   * browser's autoplay policy, and while Chrome wakes it on the first gesture,
   * Safari does not reliably wake one that was born outside a gesture. So the
   * clips are only FETCHED at load; the context, and decoding with it, waits
   * for the first press. That is also why decodeAudioData isn't called here:
   * it needs a context, and asking for one is the thing we are deferring.
   */
  function audio() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { return null; }
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = Number(volumeEl.value) / 100;
      bus = ctx.createGain();           // everything plays through here, so one
      bus.gain.value = 1;               // ramp can duck the whole board at once
      bus.connect(master);
      master.connect(ctx.destination);
      unlock();
    }
    if (ctx.state === "suspended") { ctx.resume(); }
    return ctx;
  }

  // Run once, inside the gesture that created the context: wake it, push a
  // silent buffer through (what iOS wants before it will pass audio), and
  // decode everything already fetched so later pads fire without a wait.
  function unlock() {
    if (ctx.state === "suspended") { ctx.resume(); }
    try {
      var tick = ctx.createBufferSource();
      tick.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      tick.connect(ctx.destination);
      tick.start(0);
    } catch (e) { /* not fatal — the pads still decode and play */ }
    CUES.forEach(function (c) { if (c.bytes) { decodeCue(c); } });
  }

  function decode(arrayBuffer) {
    if (!ctx) { return Promise.reject(new Error("no audio context yet")); }
    return new Promise(function (resolve, reject) {
      var p = ctx.decodeAudioData(arrayBuffer, resolve, reject);
      if (p && p.then) { p.then(resolve, reject); }
    });
  }

  // A pad counts as armed once its bytes are in hand; the AudioBuffer follows
  // on first press.
  function armBytes(c, bytes, label) {
    c.bytes = bytes;
    c.label = label;
    c.el.classList.remove("empty");
    setMeta(c, label);
    refreshArmed();
  }

  function decodeCue(c) {
    if (c.buffer) { return Promise.resolve(true); }
    if (!c.bytes) { return Promise.resolve(false); }
    if (!c.decoding) {
      c.decoding = decode(c.bytes).then(function (buf) {
        c.buffer = buf;
        c.bytes = null;
        c.decoding = null;
        setMeta(c, (c.label || "Loaded") + " · " + buf.duration.toFixed(1) + "s");
        refreshArmed();
        return true;
      }).catch(function () {
        c.bytes = null;
        c.decoding = null;
        c.el.classList.add("empty");
        setMeta(c, "Clip would not decode");
        refreshArmed();
        return false;
      });
    }
    return c.decoding;
  }

  // A voice is released exactly once, whether it ended on its own, was stopped,
  // or the browser never fired `ended` (WebKit skips it on some looping nodes).
  function release(v) {
    if (v.released) { return; }
    v.released = true;
    var i = voices.indexOf(v);
    if (i !== -1) { voices.splice(i, 1); }
    try { v.src.disconnect(); } catch (e) {}
    try { v.gain.disconnect(); } catch (e) {}
    if (playing[v.id] === v) {
      delete playing[v.id];
      var c = byId[v.id];
      c.el.classList.remove("on");
      c.el.setAttribute("aria-pressed", "false");
      endEffect(v.id);
    }
    setRunning();
  }

  // Kill a voice for good: drop the loop flag first, since a looping source that
  // keeps its flag is the one case where stop() has historically been unreliable.
  function kill(v, fade) {
    if (v.killed) { return; }
    v.killed = true;
    var now = ctx ? ctx.currentTime : 0;
    try { v.src.loop = false; } catch (e) {}
    try {
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setValueAtTime(v.gain.gain.value, now);
      v.gain.gain.linearRampToValueAtTime(0.0001, now + fade);
    } catch (e) {}
    try { v.src.stop(now + fade); } catch (e) {
      try { v.src.stop(); } catch (e2) {}
    }
    setTimeout(function () { release(v); }, fade * 1000 + 220);
  }

  function stop(id) {
    var v = playing[id];
    if (v) { kill(v, 0.18); }
    var c = byId[id];
    c.el.classList.remove("on");
    c.el.setAttribute("aria-pressed", "false");
    delete playing[id];
    endEffect(id);
    setRunning();
  }

  // Stop all: duck the whole bus, then kill every live voice — not just the ones
  // the pads still have a handle on — and clear every latch and effect.
  function stopAll() {
    if (ctx && bus) {
      var now = ctx.currentTime;
      try {
        bus.gain.cancelScheduledValues(now);
        bus.gain.setValueAtTime(bus.gain.value, now);
        bus.gain.linearRampToValueAtTime(0.0001, now + 0.12);
        bus.gain.setValueAtTime(0.0001, now + 0.3);
        bus.gain.linearRampToValueAtTime(1, now + 0.42);
      } catch (e) { bus.gain.value = 1; }
    }
    voices.slice().forEach(function (v) { kill(v, 0.1); });
    playing = {};
    CUES.forEach(function (c) {
      c.el.classList.remove("on");
      c.el.setAttribute("aria-pressed", "false");
      endEffect(c.id);
    });
    consoleEl.style.transform = "";
    setRunning();
  }

  function play(c) {
    if (!audio() || !c.buffer) { return null; }
    var src = ctx.createBufferSource();
    src.buffer = c.buffer;
    src.loop = !!c.loop;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.02);
    src.connect(g); g.connect(bus);
    src.start();

    var v = { id: c.id, src: src, gain: g, released: false, killed: false };
    voices.push(v);
    playing[c.id] = v;
    src.onended = function () { release(v); };
    // Backstop for a one-shot whose `ended` never arrives.
    if (!c.loop) {
      setTimeout(function () { release(v); }, (c.buffer.duration + 0.6) * 1000);
    }
    setRunning();
    return v;
  }

  function setRunning() {
    var n = voices.filter(function (v) { return !v.killed; }).length;
    runningEl.textContent = n === 0 ? "Silent" : n + " cue" + (n === 1 ? "" : "s") + " running";
    runningEl.classList.toggle("live", n > 0);
  }

  // ---- firing a cue -------------------------------------------------------

  function fire(id) {
    var c = byId[id];

    if (!c.buffer && !c.bytes) {
      setMeta(c, "Load a clip first");
      setTimeout(function () { setMeta(c, c.label || "No clip"); }, 1600);
      return;
    }

    // First press of the session: this call builds the context, inside the
    // gesture, and decoding can finally happen.
    if (!audio()) { return; }

    if (!c.buffer) {
      // unlock() has usually started this decode already, so attach to it
      // rather than bailing out — bailing would swallow the first press.
      if (c.pendingFire) { return; }
      c.pendingFire = true;
      decodeCue(c).then(function (ok) {
        c.pendingFire = false;
        if (ok) { fireNow(c); }
      });
      return;
    }

    fireNow(c);
  }

  function fireNow(c) {
    var id = c.id;

    if (c.loop) {
      if (playing[id]) { stop(id); return; }
      if (!play(c)) { return; }
      c.el.classList.add("on");
      c.el.setAttribute("aria-pressed", "true");
      startEffect(c, true);
      return;
    }

    c.el.classList.add("hit");
    setTimeout(function () { c.el.classList.remove("hit"); }, 180);
    if (playing[id]) { kill(playing[id], 0.08); delete playing[id]; }
    play(c);
    startEffect(c, false);
  }

  // ---- effects engine -----------------------------------------------------

  var FX = {
    moonwash:  { dur: 2600, shake: 0 },
    horizon:   { dur: 3200, shake: 0 },
    lightning: { dur: 2200, shake: 2 },
    stalk:     { dur: 0,    shake: 0 },
    growl:     { dur: 2300, shake: 4 },
    scuttle:   { dur: 0,    shake: 0 },
    brook:     { dur: 0,    shake: 0 },
    wind:      { dur: 0,    shake: 0 },
    wail:      { dur: 4200, shake: 0 },
    scream:    { dur: 1500, shake: 11 }
  };

  var active = {}; // id -> {cue, start, sustain, specks}
  var gctx = canvas.getContext("2d");
  var W = 0, H = 0, DPR = 1;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    gctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  function startEffect(c, sustain) {
    var spec = FX[c.fx];
    active[c.id] = {
      cue: c,
      start: performance.now(),
      sustain: sustain || spec.dur === 0,
      specks: c.fx === "scuttle" ? makeSpecks(34) : (c.fx === "stalk" ? makeSpecks(14) : null)
    };
    if (c.fx === "lightning") { lightningFlash(); }
    if (c.fx === "scream") { screamFlash(); }
  }

  function endEffect(id) { delete active[id]; }

  function makeSpecks(n) {
    var a = [];
    for (var i = 0; i < n; i++) {
      a.push({
        x: Math.random(), y: Math.random(),
        vx: (Math.random() - 0.5) * 0.004,
        vy: (Math.random() - 0.5) * 0.004,
        r: 1.5 + Math.random() * 3,
        turn: Math.random() * 600 + 200,
        t: Math.random() * 600
      });
    }
    return a;
  }

  function soft() { return softenEl.checked ? 0.34 : 1; }

  // flash overlay — the only effect that paints the whole screen white
  var flashTimers = [];
  function clearFlash() { flashTimers.forEach(clearTimeout); flashTimers = []; }

  function runFlash(steps, transition) {
    clearFlash();
    flashEl.style.transition = transition || "none";
    steps.forEach(function (s) {
      flashTimers.push(setTimeout(function () { flashEl.style.opacity = String(s[1]); }, s[0]));
    });
  }

  function lightningFlash() {
    if (softenEl.checked) {
      runFlash([[0, 0.22], [700, 0]], "opacity 700ms ease-out");
      return;
    }
    runFlash([
      // the strike
      [0, 1], [45, 0.12], [75, 0.95], [120, 0.25], [150, 0.7], [240, 0.08], [300, 0.34], [430, 0.06], [480, 0.2], [640, 0],
      // after-flashes, under the roll
      [1050, 0.16], [1130, 0.04], [1190, 0.11], [1330, 0],
      [1760, 0.08], [1870, 0]
    ]);
  }

  function screamFlash() {
    if (softenEl.checked) {
      runFlash([[0, 0.14], [360, 0]], "opacity 360ms ease-out");
      return;
    }
    runFlash([[0, 0.85], [60, 0.2], [90, 0.5], [170, 0]]);
  }

  function rgba(hex, a) {
    var h = hex.replace("#", "");
    var n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }

  function vignette(color, strength, inner) {
    var g = gctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * inner, W / 2, H / 2, Math.max(W, H) * 0.78);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, color);
    gctx.globalAlpha = strength;
    gctx.fillStyle = g;
    gctx.fillRect(0, 0, W, H);
    gctx.globalAlpha = 1;
  }

  function band(color, fromY, toY, strength) {
    var g = gctx.createLinearGradient(0, fromY, 0, toY);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, color);
    gctx.globalAlpha = strength;
    gctx.fillStyle = g;
    gctx.fillRect(0, Math.min(fromY, toY), W, Math.abs(toY - fromY));
    gctx.globalAlpha = 1;
  }

  // envelope: 0 -> 1 -> 0
  function arc(p) { return Math.sin(Math.PI * Math.max(0, Math.min(1, p))); }

  function draw(now) {
    gctx.clearRect(0, 0, W, H);
    var k = soft();
    var shake = 0;

    Object.keys(active).forEach(function (id) {
      var a = active[id];
      var spec = FX[a.cue.fx];
      var age = now - a.start;
      var p = spec.dur ? age / spec.dur : 0;

      if (!a.sustain && p >= 1) { delete active[id]; return; }

      var env = a.sustain ? Math.min(1, age / 600) : arc(p);
      shake = Math.max(shake, spec.shake * env * (softenEl.checked ? 0 : 1));

      switch (a.cue.fx) {
        case "moonwash": {
          var g = gctx.createRadialGradient(W * 0.5, -H * 0.15, 0, W * 0.5, -H * 0.15, Math.max(W, H) * 0.9);
          g.addColorStop(0, rgba("#9fb0ee", 0.5 * env * k));
          g.addColorStop(0.5, rgba("#6c7fd8", 0.16 * env * k));
          g.addColorStop(1, "rgba(0,0,0,0)");
          gctx.fillStyle = g;
          gctx.fillRect(0, 0, W, H);
          // two blinks, late in the call
          var blink = (age > 900 && age < 1050) || (age > 1200 && age < 1320);
          if (blink && !softenEl.checked) {
            gctx.fillStyle = rgba("#f7d98a", 0.75);
            [-1, 1].forEach(function (s) {
              gctx.beginPath();
              gctx.ellipse(W / 2 + s * Math.min(W, H) * 0.055, H * 0.42, 9, 11, 0, 0, Math.PI * 2);
              gctx.fill();
            });
          }
          break;
        }
        case "horizon": {
          var lift = H * (0.55 - 0.18 * env);
          band(rgba("#e0902f", 0.42 * env * k), lift, H, 1);
          vignette(rgba("#1a0f04", 0.5 * env * k), 1, 0.2);
          break;
        }
        case "lightning": {
          vignette(rgba("#cfe0f5", 0.3 * env * k), 1, 0.35);
          break;
        }
        case "stalk": {
          // dark presence closing in from alternating sides, in step time
          var step = (age % 1400) / 1400;
          var side = Math.floor(age / 1400) % 2 === 0 ? 0 : 1;
          var push = arc(step) * env;
          var g2 = gctx.createLinearGradient(side ? W : 0, 0, side ? 0 : W, 0);
          g2.addColorStop(0, rgba("#0e1408", 0.68 * push * k));
          g2.addColorStop(0.45, rgba("#131a0b", 0.12 * push * k));
          g2.addColorStop(1, "rgba(0,0,0,0)");
          gctx.fillStyle = g2;
          gctx.fillRect(0, 0, W, H);
          drawSpecks(a, "#8aa355", 0.35 * env * k, 0.0012);
          break;
        }
        case "growl": {
          var throb = 0.55 + 0.45 * Math.sin(age / 90);
          vignette(rgba("#6d0f08", (0.55 * env + 0.18 * env * throb) * k), 1, 0.12);
          break;
        }
        case "scuttle": {
          gctx.fillStyle = rgba("#1d2206", 0.16 * env * k);
          gctx.fillRect(0, 0, W, H);
          drawSpecks(a, "#0b0d04", 0.85 * env * k, 0.006);
          drawSpecks(a, "#c3d03a", 0.22 * env * k, 0);
          break;
        }
        case "brook": {
          for (var i = 0; i < 7; i++) {
            var y = H - (i + 1) * (H * 0.05) - Math.sin(now / 900 + i) * 6;
            gctx.globalAlpha = (0.2 - i * 0.022) * env * k;
            gctx.strokeStyle = "#8ff0e6";
            gctx.lineWidth = 1.6;
            gctx.beginPath();
            for (var x = 0; x <= W; x += 14) {
              var yy = y + Math.sin((x / 90) + now / 420 + i * 1.7) * (5 + i);
              if (x === 0) { gctx.moveTo(x, yy); } else { gctx.lineTo(x, yy); }
            }
            gctx.stroke();
          }
          gctx.globalAlpha = 1;
          band(rgba("#0e3d3a", 0.4 * env * k), H * 0.55, H, 1);
          break;
        }
        case "wind": {
          gctx.lineWidth = 1.2;
          for (var s2 = 0; s2 < 16; s2++) {
            var off = ((now / 7 + s2 * 260) % (W + 420)) - 210;
            var ty = (s2 / 16) * H + Math.sin(now / 1100 + s2) * 18;
            gctx.globalAlpha = 0.2 * env * k;
            gctx.strokeStyle = "#cfe0f0";
            gctx.beginPath();
            gctx.moveTo(off, ty);
            gctx.quadraticCurveTo(off + 110, ty - 16, off + 230, ty + 6);
            gctx.stroke();
          }
          gctx.globalAlpha = 1;
          vignette(rgba("#0d1620", 0.4 * env * k), 1, 0.25);
          break;
        }
        case "wail": {
          for (var m = 0; m < 5; m++) {
            var cx = W * (0.14 + m * 0.18);
            var rise = ((now / 26 + m * 700) % (H + 300)) - 150;
            var g3 = gctx.createRadialGradient(cx, H - rise, 0, cx, H - rise, Math.min(W, H) * 0.3);
            g3.addColorStop(0, rgba("#cbb6f2", 0.3 * env * k));
            g3.addColorStop(1, "rgba(0,0,0,0)");
            gctx.fillStyle = g3;
            gctx.fillRect(0, 0, W, H);
          }
          vignette(rgba("#180f28", 0.46 * env * k), 1, 0.18);
          break;
        }
        case "scream": {
          var collapse = 0.42 - 0.3 * env;
          vignette(rgba("#8a0516", 0.9 * env * k), 1, Math.max(0.03, collapse));
          if (!softenEl.checked) {
            gctx.globalAlpha = 0.1 * env;
            gctx.fillStyle = "#ff2b45";
            gctx.fillRect(0, 0, W, H);
            gctx.globalAlpha = 1;
          }
          break;
        }
      }
    });

    if (shake > 0.2) {
      consoleEl.style.transform =
        "translate(" + ((Math.random() - 0.5) * shake).toFixed(2) + "px," +
        ((Math.random() - 0.5) * shake).toFixed(2) + "px)";
    } else if (consoleEl.style.transform) {
      consoleEl.style.transform = "";
    }

    requestAnimationFrame(draw);
  }

  function drawSpecks(a, color, alpha, speed) {
    if (!a.specks || alpha <= 0.01) { return; }
    gctx.fillStyle = color;
    gctx.globalAlpha = alpha;
    a.specks.forEach(function (s) {
      s.t += 16;
      if (s.t > s.turn) {
        s.t = 0;
        s.vx = (Math.random() - 0.5) * (speed || 0.002) * 2;
        s.vy = (Math.random() - 0.5) * (speed || 0.002) * 2;
      }
      s.x += s.vx; s.y += s.vy;
      if (s.x < -0.05) { s.x = 1.05; } if (s.x > 1.05) { s.x = -0.05; }
      if (s.y < -0.05) { s.y = 1.05; } if (s.y > 1.05) { s.y = -0.05; }
      gctx.beginPath();
      gctx.ellipse(s.x * W, s.y * H, s.r, s.r * 0.66, s.x * 6, 0, Math.PI * 2);
      gctx.fill();
    });
    gctx.globalAlpha = 1;
  }

  requestAnimationFrame(draw);

  // ---- clip storage (per browser) ----------------------------------------

  var DB_NAME = "night-woods-foley", STORE = "clips";

  function idb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error("no idb")); return; }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains(STORE)) { req.result.createObjectStore(STORE); }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function dbPut(id, blob) {
    return idb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(blob, id);
        tx.oncomplete = resolve;
        tx.onerror = function () { reject(tx.error); };
      });
    }).catch(function () { /* private window, blocked storage — clip still plays this session */ });
  }

  function dbAll() {
    return idb().then(function (db) {
      return Promise.all(CUES.map(function (c) {
        return new Promise(function (resolve) {
          var req = db.transaction(STORE, "readonly").objectStore(STORE).get(c.id);
          req.onsuccess = function () { resolve([c.id, req.result]); };
          req.onerror = function () { resolve([c.id, null]); };
        });
      }));
    }).catch(function () { return []; });
  }

  function dbClear() {
    return idb().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).clear();
        tx.oncomplete = resolve;
        tx.onerror = resolve;
      });
    }).catch(function () {});
  }

  // ---- loading clips ------------------------------------------------------

  function loadBlob(c, blob, label, persist) {
    return blob.arrayBuffer()
      .then(function (bytes) {
        armBytes(c, bytes, label);
        if (persist) { dbPut(c.id, blob); }
        // Only decode now if a context already exists; otherwise the first
        // press makes one and decodes then.
        if (ctx) { return decodeCue(c); }
      })
      .catch(function () {
        setMeta(c, "Could not read that file");
      });
  }

  function matchCue(filename) {
    var n = filename.toLowerCase();
    for (var i = 0; i < CUES.length; i++) {
      var c = CUES[i];
      for (var j = 0; j < c.match.length; j++) {
        if (n.indexOf(c.match[j]) !== -1) { return c; }
      }
    }
    return null;
  }

  var pendingFiles = [];

  function takeFiles(list) {
    var files = Array.prototype.slice.call(list).filter(function (f) {
      return f.type.indexOf("audio") === 0 || /\.(mp3|wav|ogg|m4a|aac|flac|webm|opus)$/i.test(f.name);
    });
    files.forEach(function (f) {
      var c = matchCue(f.name);
      if (c) { loadBlob(c, f, "Loaded", true); }
      else { pendingFiles.push(f); }
    });
    renderPending();
  }

  function renderPending() {
    unmatchedEl.innerHTML = "";
    unmatchedEl.hidden = pendingFiles.length === 0;
    pendingFiles.forEach(function (f, i) {
      var row = document.createElement("div");
      row.className = "unmatched-row";
      var nameSpan = document.createElement("span");
      nameSpan.textContent = f.name;
      var sel = document.createElement("select");
      sel.setAttribute("aria-label", "Assign " + f.name + " to a pad");
      var blank = document.createElement("option");
      blank.textContent = "Assign to…";
      blank.value = "";
      sel.appendChild(blank);
      CUES.forEach(function (c) {
        var o = document.createElement("option");
        o.value = c.id; o.textContent = c.name;
        sel.appendChild(o);
      });
      sel.addEventListener("change", function () {
        if (!sel.value) { return; }
        loadBlob(byId[sel.value], f, "Loaded", true);
        pendingFiles.splice(i, 1);
        renderPending();
      });
      row.appendChild(nameSpan);
      row.appendChild(sel);
      unmatchedEl.appendChild(row);
    });
  }

  function wirePadDrop(c) {
    var el = c.el;
    el.addEventListener("dragover", function (e) { e.preventDefault(); el.classList.add("drop"); });
    el.addEventListener("dragleave", function () { el.classList.remove("drop"); });
    el.addEventListener("drop", function (e) {
      e.preventDefault(); e.stopPropagation();
      el.classList.remove("drop");
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) { loadBlob(c, f, "Loaded", true); }
    });
  }

  rackEl.addEventListener("dragover", function (e) { e.preventDefault(); rackEl.classList.add("drop"); });
  rackEl.addEventListener("dragleave", function () { rackEl.classList.remove("drop"); });
  rackEl.addEventListener("drop", function (e) {
    e.preventDefault();
    rackEl.classList.remove("drop");
    if (e.dataTransfer && e.dataTransfer.files) { takeFiles(e.dataTransfer.files); }
  });
  document.addEventListener("dragover", function (e) { e.preventDefault(); });
  document.addEventListener("drop", function (e) { e.preventDefault(); });

  document.getElementById("pick").addEventListener("click", function () { filesEl.click(); });
  filesEl.addEventListener("change", function () {
    if (filesEl.files) { takeFiles(filesEl.files); }
    filesEl.value = "";
  });

  document.getElementById("clear").addEventListener("click", function () {
    stopAll();
    dbClear();
    CUES.forEach(function (c) {
      c.buffer = null;
      c.bytes = null;
      c.decoding = null;
      c.label = null;
      c.el.classList.add("empty");
      setMeta(c, "No clip");
    });
    // Put the shipped clips back — clearing the rack drops your own takes.
    CUES.forEach(loadShipped);
    pendingFiles = [];
    renderPending();
    refreshArmed();
  });

  // A clip published alongside the board, at audio/<cue>.mp3. Fetched only —
  // decoding waits for the first press. A failure is written onto the pad
  // rather than swallowed, so a clip that didn't deploy is visible.
  function loadShipped(c) {
    fetch("audio/" + c.id + ".mp3").then(function (r) {
      if (!r.ok) { throw new Error("HTTP " + r.status); }
      return r.arrayBuffer();
    }).then(function (bytes) {
      if (c.buffer || c.bytes) { return; }
      armBytes(c, bytes, "On the board");
    }).catch(function (e) {
      setMeta(c, "Clip missing · " + ((e && e.message) || "no response"));
    });
  }

  // A clip this browser holds wins over the shipped one; every other pad falls
  // back to whatever ships with the board.
  dbAll().then(function (rows) {
    var stored = {};
    rows.forEach(function (row) {
      if (!row[1]) { return; }
      stored[row[0]] = true;
      loadBlob(byId[row[0]], row[1], "From this browser", false);
    });
    CUES.forEach(function (c) { if (!stored[c.id]) { loadShipped(c); } });
  });

  // ---- rail + keys --------------------------------------------------------

  volumeEl.addEventListener("input", function () {
    if (master) { master.gain.value = Number(volumeEl.value) / 100; }
  });

  softenEl.addEventListener("change", function () {
    if (softenEl.checked) { clearFlash(); flashEl.style.opacity = "0"; consoleEl.style.transform = ""; }
  });

  document.getElementById("stopall").addEventListener("click", stopAll);

  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) { return; }
    var tag = (e.target && e.target.tagName) || "";
    var typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    if (e.key === " " && !typing) {
      e.preventDefault();
      stopAll();
      return;
    }
    if (typing) { return; }
    for (var i = 0; i < CUES.length; i++) {
      if (e.key === CUES[i].key) { e.preventDefault(); fire(CUES[i].id); return; }
    }
  });
})();
