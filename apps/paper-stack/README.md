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
| F | Files everything into folders, and back out again |
| Tab | Opens the print list — the keyboard path and the screen-reader path |
| Arrows, `,` `.` `-` `=` `[` `]` | Move, rotate, resize, restack. `Enter` inspects, `Home` brings to top |

## Two ways to browse

**The pile** is the default: twelve prints loose on the mat, in no order,
rearranged by hand.

**The flat files** are the predictable alternative. Press `F` or hit *File
away* and the prints shuffle into four folders down the left edge, one per
press — a flat file seen from the side, with a rectangular tab and its
bundle tucked in behind. Focusing a tab fans that folder open; from there
the prints lay out either as a paper stack or as a grid, and in the grid a
double-click brings one up to read and `Escape` puts it back.

It is navigable end to end from the keyboard, and the order is the same one
a pointer walks:

| Key | Where it goes |
| --- | --- |
| `F` | Into the folders, or back to the loose pile |
| `↑` `↓` | Between folders. The focused one fans open as you pass it |
| `→` | Into the layout buttons; `←` `→` move between them, `Enter` picks |
| `↑` `↓` `←` `→` | Between prints, once a folder is laid out as a grid |
| `Enter` | Brings the focused print up to read |
| `Escape` | One step back out: print, then layout, then folders, then pile |

Every move is announced to screen readers, and focus follows what you are
looking at in both directions — clicking a print in the grid moves keyboard
focus to it, and arrowing onto one selects it.

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
