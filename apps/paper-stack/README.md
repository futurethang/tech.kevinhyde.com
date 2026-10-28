# Paper Stack

A kinetic gallery prototype. Every piece is printed on a virtual sheet of
paper lying on a cutting mat. Sheets lift, droop, land crooked, slide under
each other, and can be pinched to any size and angle.

Two builds, same twelve prints:

- **`index.html`** — the one to use. DOM elements and CSS 3D transforms.
  Nods at the material physics without claiming to simulate it, and feels
  web-native: double-tap to inspect, visible resize and rotate handles,
  real focus, real text.
- **`engine.html`** — WebGL2 with an XPBD solver, kept as recorded
  research. Sheets genuinely droop, and they also genuinely crumple under
  sustained use, which is why it is not the one to use.

[APPROACHES.md](./APPROACHES.md) has the comparison, the verdict and the
bugs worth remembering.

## Try it

Static app, no build step, no dependencies. Open either file, or visit
`tech.kevinhyde.com/apps/paper-stack`.

## Controls

| Gesture | What happens |
| --- | --- |
| Drag | Lifts the sheet, which leans into the motion and bends slightly |
| Release | Lands with momentum and a little crooked, then goes to the top |
| Pinch (two fingers) | Scales and rotates at once |
| Corner handle, bottom right | Drag to resize |
| Corner handle, top right | Drag to rotate; hold Shift to snap to 15° |
| Double-tap / double-click | Inspect, without disturbing the stack |
| Hold Alt while dropping | Slides the sheet *under* whatever is beneath the pointer |
| Tab | Opens the print list — the keyboard path and the screen-reader path |
| Arrows, `,` `.` `-` `=` `[` `]` | Move, rotate, resize, restack. `Enter` inspects, `Home` brings to top |

## The lab panel

Both builds are tunable while you use them, which is the point of a
prototype. The transform build exposes the hand feel: lift height, tilt
into motion, bend while held, spring stiffness and damping, release carry
and landing mess, plus toggles for each part of the paper model so every
effect can be judged on its own. The engine build exposes the solver
instead.

## How it works

**One ordered array owns the stacking.** `order` holds the pieces
bottom-to-top and `reflow()` is the only writer. In the transform build it
emits `z-index`; in the engine build it emits a resting height, 1.4 mm per
layer, and the depth buffer sorts. Nothing else anywhere writes either.

**Only moving sheets are simulated.** A sheet that is not held, has
settled, and lies within 0.4 mm of flat is snapped flat, zeroed and
skipped. Eleven of twelve are in that state at any moment; an untouched
table runs no solver and no render loop.

**The browser is told to stay out of it.** Text selection, image drag, the
long-press menu, Safari's pinch-zoom and double-tap-zoom, and overscroll
are all suppressed. Only one sheet may be held at a time; a second finger
on the same sheet is a pinch, on a different sheet it is ignored.

## Known limits

- Sheets have no self-collision, so lifting one through the middle of the
  pile passes through the others.
- Pinch-to-resize rescales the paper itself, which is an authoring action
  rather than a physical one.
- The engine build's accessible list mirrors the collection rather than
  being the collection. For a real portfolio the DOM should carry the
  content and the canvas should sit over it.
