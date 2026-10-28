# Choosing a technology for a kinetic paper gallery

The brief: a gallery where every piece sits on a sheet of paper that can be
lifted, moved, dropped on top of others, resized, and laid down at new
angles — a big messy stack of prints. The hard parts are the interaction
model, the paper feel, and keeping the stacking order stable.

Two builds exist, printing the same twelve pieces from the same `art.js`,
so comparing them compares the rendering approach and nothing else.

| | `index.html` — transform build | `engine.html` — engine build |
| --- | --- | --- |
| Renders with | DOM elements, CSS 3D transforms | WebGL2, hand-rolled, no dependencies |
| Paper is | a rigid rectangle, faked bend | a deformable surface, solved |
| Bending | one nested `rotateX` | XPBD distance + bending constraints |
| Shadows | two layered `box-shadow`s | geometry projected along the key light |
| Stacking | `z-index` from an ordered array | resting height from the same array |
| Accessibility | native: every sheet is a focusable element | a DOM mirror beside the canvas |
| Runs on | anything | anything with WebGL2 |

## Recommendation

**Ship the engine build as the experience and keep the transform build as
the fallback.** That is the arrangement in the repo now: `engine.html`
detects WebGL2 and hands off to `index.html` when it is missing, and the
two are linked from each other's HUD.

This reverses the recommendation in the first draft of this document, which
argued for DOM-first on the grounds that a portfolio needs crisp,
selectable, accessible content. That argument was right about the
requirement and wrong about the remedy. The requirement is met by keeping
real DOM content beside the canvas — the accessible mirror — rather than by
giving up the simulation. And the simulation turns out to matter more than
expected: once a sheet genuinely droops when you lift it by a corner, the
faked version reads as a card with a drop shadow.

## What the transform build taught, and where it stopped

It was not thrown away. It settled four things that carried straight into
the engine build:

**Position must be 1:1 with the pointer.** Springing the position reads as
lag, not weight. Lag the orientation instead. In the engine build the
equivalent is that the grabbed particle tracks the pointer and the other
164 are left to the solver.

**One owner for the stacking order.** The classic failure is
`z-index = ++counter` on every interaction: the order becomes unauditable
and the counter climbs forever. A single array is the truth and one
`reflow()` is the only writer. That model survived the port unchanged —
only its output changed, from a `z-index` to a resting height in
millimetres.

**Inspecting must not reorder.** Looking closer at a print should not
change where it sits in the pile.

**A crooked landing sells the mess**, and it must only fire on a real drag,
never on a tap.

Where it stopped: a rectangle cannot droop, a `box-shadow` cannot be cast
by a shape that is bending, and — the thing that actually forced the
decision — the compositor and the stacking model were in direct conflict.

### The flickering was architectural

`transform-style: preserve-3d` on the stage creates a 3D rendering context,
and inside one the browser sorts children by their position in 3D space and
**ignores `z-index`**. Twelve sheets all sitting at `translateZ(0)` are
coplanar, so they z-fight: sheets flicker, and elements drop out entirely.
The stacking system was fighting the compositor on every frame.

The fix in the transform build is `transform-style: flat` on the stage. The
`perspective` still projects each sheet's own 3D transform, so nothing is
lost visually, and `z-index` governs paint order again. Two related repairs
went with it: `will-change: transform` is now set once and left alone
(toggling it per gesture makes the compositor tear down and rebuild the
layer, which flashes), and `backface-visibility: hidden` came off, since
inside a nested 3D context it is a known way to make an element vanish
mid-rotation.

In the engine build the whole class of bug is gone, because stacking is
depth-buffered rather than painted. The ordered array maps to a resting
height — 1.4 mm per layer, about eight sheets of 180 gsm — and the GPU
sorts. There is nothing to drift out of sync.

## Blocking the browser

A direct-manipulation surface is not a document, and every native reading
of a drag is wrong. Both builds suppress, deliberately:

- `preventDefault()` on `pointerdown`, with focus moved by hand afterwards.
  This is what stops text selection and native image drag. The double-tap
  is detected from the gesture's own travel and timing rather than from the
  native `dblclick`, so suppressing the default costs nothing.
- `touch-action: none`, `user-select: none`, `-webkit-touch-callout: none`.
- `dragstart`, `selectstart` and `contextmenu`, the last being the
  long-press menu that otherwise interrupts every touch drag.
- `gesturestart` / `gesturechange` / `gestureend`, which are how Safari
  takes a two-finger pinch for itself before the page sees it.
- `dblclick`, for double-tap zoom.
- `overscroll-behavior: none`, for pull-to-refresh and rubber-banding.

One more rule, which is not a browser default but an interaction one: **only
one sheet may be held at a time.** A second finger landing on a different
sheet is a slip, not a gesture, and without an explicit guard both sheets
drag at once. A second finger on the *same* sheet becomes a pinch. That
guard is what fixed "multiple items activating".

Finally, the keyboard focus ring must not appear because a mouse press moved
focus. A `pointing` class on `body`, set on `pointerdown` and cleared on
Tab, gates it.

## What the engine build cost to get right

Four bugs, each worth recording because none was obvious.

**XPBD compliance is not a 0–1 dial.** The solver compares
`alpha = compliance / h²` against the sum of inverse masses. At a 4 ms
substep, `h²` is about 1.7 × 10⁻⁵, so a "stiff" compliance of 0.08 produces
`alpha ≈ 4600` against an inverse-mass sum of 2 — every bending correction
divided by ~4600, which is bending switched off. Sheets crumpled on pick-up
and stayed crumpled. Useful compliances for millimetre-scale paper are on
the order of 10⁻⁵, and the sliders now read in those units.

**Gauss-Seidel propagates one grid cell per iteration.** Lifting a corner
of an 11 × 15 grid needs ~26 iterations before the far corner learns about
it; at 10 it does not, so the middle buckles. The fix is long-range
attachments: a max-distance constraint from the held particle to every
other, which reaches the whole sheet in one pass. Roughly 165 extra
distance checks per iteration, and the single most effective change in the
build.

**Pin the particle by zeroing its inverse mass**, rather than overwriting
its position after the solve. Overwriting re-violates every constraint
touching it on each iteration, which pumps energy in. And ease the pin
toward the pointer with a speed cap: teleporting it 120 mm on the first
frame of a grab is a shock no number of iterations absorbs. It reads better
too — paper gets picked up, it does not snap upward.

**A bare `&` is well-formed HTML but not well-formed XML.** The type
specimen rendered fine inline in the transform build and failed silently as
an SVG data URI in the engine build, giving one blank sheet.

## Performance

Measured in this container, so the GPU numbers are meaningless (software
rasteriser) but the solver numbers are not, since the solver is plain JS on
the CPU:

| | constraints solved | ms/frame | share of a 60 fps budget |
| --- | --- | --- | --- |
| All twelve sheets simulated | 404,000 | 22.9 | 137% |
| Only the held sheet | 34,480 | 2.2 | 13% |

The difference is per-sheet sleeping. A sheet that is not pinned, has
settled, and lies within 0.4 mm of flat is snapped the rest of the way,
zeroed, and skipped entirely. Eleven of twelve are in that state at any
moment, and an untouched table runs no solver at all — the render loop
stops too. This is the same active-set idea as the transform build, which
is not a coincidence: it is the thing that makes either approach viable.

Textures are baked once per print at 720 px on the short edge, mipmapped,
with anisotropic filtering where the extension exists. Captions are drawn
into the same canvas in the same two typefaces as the DOM build.

## Still open

- **Self-collision.** Sheets pass through each other. For a pile that is
  mostly flat it is rarely visible, but lifting one sheet through the
  middle of the pile shows it. Proper cloth self-collision is expensive;
  a cheaper fix is per-sheet ground planes that track the stack height
  beneath each sheet rather than a single table plane.
- **Real images.** The generated prints are convenient; photographs change
  the memory story. Thumbnails in the pile with a full-resolution swap on
  inspect is the obvious move.
- **Deep links.** Each piece needs a URL. Inspect mode is the natural
  anchor, and the stack array is already serialisable.
- **Resize is not physical.** Pinch rescales every constraint's rest
  length, so the sheet genuinely grows. That is a choice, not a
  simulation — paper does not do this. It is the one place the brief and
  the physics disagree.
- **The mirror is a mirror, not the content.** For a real portfolio the
  accessible DOM should carry the actual titles, links and descriptions and
  be crawlable, with the canvas as presentation over the top.
