# Choosing a technology for a kinetic paper gallery

The brief: a gallery where every piece sits on a sheet of paper that can be
lifted, moved, dropped on top of others, resized, and laid down at new
angles — a big messy stack of prints. The hard parts are the interaction
model, the paper feel, and keeping the stacking order stable.

## Recommendation

**Build it with DOM elements and CSS 3D transforms, with a hand-rolled
spring integrator and an explicit ordered array for stacking.** That is what
this prototype does. Reach for WebGL only if the paper physics itself —
true bending, flopping, page-turning — becomes the subject of the portfolio
rather than its container.

The deciding argument is that this is a *portfolio*. The content has to be
crisp at any zoom, selectable, linkable, indexable, and operable without a
pointer. Every one of those is free in the DOM and expensive everywhere
else. The paper feel, meanwhile, turns out to be mostly interaction design
rather than physics: lift, lean, lag, shadow, and a crooked landing get you
almost all the way there, and all five are cheap in CSS.

## The options

### A. DOM + CSS 3D transforms — recommended

One `perspective` on the stage, each sheet an absolutely positioned element
carrying `translate3d / rotateZ / rotateX / rotateY / scale`.

- Text and vector art stay resolution-independent; real `<img>` tags get
  lazy loading and `srcset` for free.
- Hit testing is the browser's. `elementsFromPoint` answers "what is under
  this drop?" exactly, rotation included — that is what makes *slide
  underneath* a four-line feature.
- Stacking is `z-index`, which is an integer and trivially auditable.
- Every sheet is a focusable element, so the pile is keyboard-operable and
  a screen reader can read the collection.
- Transform and opacity animate on the compositor. Twelve sheets idle at
  0% CPU because the rAF loop stops when nothing is moving.

The costs: no real geometry, so bending is faked with a nested `rotateX`;
shadows are `box-shadow`, not cast light; and each sheet is a composited
layer, so memory becomes the ceiling somewhere around 40–60 large sheets.
Pile more than that and you virtualise — keep the top ~30 live and render
the rest as a single flattened image of the pile's edge.

### B. Canvas 2D

Draw every sheet each frame into one canvas.

Scales further than the DOM and gives exact control over compositing, but
you re-implement hit testing, focus, text layout, and accessibility, and you
lose selectable text and real links. Shadow blur is the expensive operation
in Canvas 2D, and soft lift shadows are the entire look. Worth it only if
the pile needs to be in the hundreds.

### C. WebGL / three.js

Each sheet a subdivided plane, vertex displacement for curl, real shadow
maps, raycast picking.

This is the only option that gets genuine paper: a sheet that bows under
its own weight, catches light across the bend, and flops when you let go.
It is also the only one where the portfolio's content becomes a texture —
so text gets blurry, nothing is selectable or linkable, accessibility is
zero, and you ship a few hundred KB before the first pixel. Choose it when
the simulation is the artwork.

### D. DOM + a physics engine (Matter.js, Rapier)

Tempting, and wrong here. Rigid-body engines give you collisions and
stacking you do not want — prints should rest wherever you put them, not
settle into a pile under gravity. The behaviour you actually want is a
per-sheet spring on tilt and lift, which is about fifteen lines. A physics
engine is a dependency that fights the design.

## What the prototype establishes

**Position must be 1:1 with the pointer.** Springing the position itself
reads as lag, not weight. Lag the tilt, the lift and the bend instead.
That split is the single most important finding here; try it with
*Spring stiffness* low and feel the difference.

**Tilt sells the paper.** `rotateX/rotateY` proportional to drag velocity —
the sheet leaning into its own motion — does more work than shadows,
texture and curl combined. Turn *Tilt into motion* to 0 in the Lab panel
and the sheets instantly read as cards, not paper.

**A crooked landing sells the mess.** A few degrees of random rotation on
each drop is what keeps the pile from looking like a layout engine. It must
only fire on a real drag, never on a tap.

**Shadows do the depth.** Two layered shadows per sheet: a tight dark
contact shadow that fades as the sheet rises, and a broad soft one that
grows. Both interpolate from one `--lift` custom property.

**Stacking needs one owner.** The classic failure is assigning
`z-index = ++counter` on every interaction: the order becomes unauditable
and the counter climbs forever. Here a single array is the truth, `reflow()`
is the only writer, and lifted or inspected sheets sit on out-of-band z
values so nothing is spliced mid-gesture. Inspect mode deliberately does
not reorder — looking closer at a print should not change where it sits.

## Open questions for the real build

- **Content.** Real images change the memory story. Thumbnails in the pile
  with a full-resolution swap on inspect is the obvious move.
- **Entry state.** The pile is a poor first impression on a phone: too few
  pieces visible. Opening as a contact sheet and collapsing into a pile on
  first interaction is worth testing.
- **Deep links.** Each piece needs a URL. Inspect mode is the natural
  anchor, which means the stack state needs to be serialisable — the array
  already is.
- **Momentum across the edge.** Right now sheets bounce off the stage
  bounds. An infinite table with the pile as a viewport is a different and
  possibly better model.
