# Paper Stack

A kinetic gallery prototype. Every piece is printed on a virtual sheet of
paper lying on a cutting mat. Sheets lift, droop, land crooked, slide under
each other, and can be pinched to any size and angle.

Two builds, same twelve prints, so you can feel the difference:

- **`engine.html`** — the real one. WebGL2 with an XPBD solver, so each
  sheet is a deformable surface. Lift one by a corner and the far end
  actually hangs.
- **`index.html`** — the fallback. DOM elements and CSS 3D transforms.
  Runs anywhere, keeps every sheet a focusable element, fakes the bend.

The engine build hands off to the transform build when WebGL2 is missing.
[APPROACHES.md](./APPROACHES.md) has the comparison, the recommendation and
the bugs worth remembering.

## Try it

Static app, no build step, no dependencies. Open either file, or visit
`tech.kevinhyde.com/apps/paper-stack`.

## Controls

| Gesture | What happens |
| --- | --- |
| Drag | Lifts the sheet; the rest of it follows under gravity |
| Release | Lands and settles, then goes to the top of the pile |
| Pinch (two fingers) | Scales and rotates |
| Double-tap / double-click | Inspect, without disturbing the stack |
| Hold Alt while dropping | Slides the sheet *under* whatever is beneath the pointer |
| Tab | Opens the print list — the keyboard path and the screen-reader path |
| Arrows, `,` `.` `-` `=` `[` `]` | Move, rotate, resize, restack. `Enter` inspects, `Home` brings to top |

## The lab panel

Both builds are tunable while you use them, which is the point of a
prototype. The engine build exposes the solver directly: bending and
stretch compliance, gravity, air damping, substeps, iterations, lift
height, key-light angle and shadow strength. Bending compliance is the
paper-stock dial — around 1 is card, 30 is tissue.

The header reads `n live` — how many sheets the solver is actually
integrating. It should say `0 live` whenever you are not touching
anything.

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
