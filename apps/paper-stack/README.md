# Paper Stack

A kinetic gallery prototype. Every piece is printed on a virtual sheet of
paper lying on a cutting mat. Sheets lift, lean into the direction you drag
them, land crooked, slide under each other, and can be pinched to any size
and angle.

Built to answer one question: what is the right technology for a portfolio
that behaves like a messy pile of prints? See [APPROACHES.md](./APPROACHES.md)
for the comparison and the recommendation.

## Try it

Static app, no build step. Open `index.html`, or visit
`tech.kevinhyde.com/apps/paper-stack`.

## Controls

| Gesture | What happens |
| --- | --- |
| Drag | Lifts the sheet, which leans into the motion and bends slightly |
| Release | Lands with momentum and a little random rotation, then goes to the top |
| Pinch (two fingers) | Scales and rotates about the point between your fingers |
| Corner handle | Drag to resize; hold Shift to rotate |
| Double-tap / double-click | Inspect: centres and enlarges, without disturbing the stack |
| Hold Alt while dropping | Slides the sheet *under* whatever is beneath the pointer |
| Tab, arrows, `,` `.` `-` `=` `[` `]` | Full keyboard operation; `Home` brings to top, `Enter` inspects |

## The Lab panel

The point of the prototype is that the feel is tunable while you use it.
Lift height, tilt, bend, spring stiffness, damping, release carry and
landing mess are all live sliders. The paper model (shared perspective,
directional sheen, corner curl, grain) toggles piece by piece so each
effect can be judged on its own. The stack-order inspector shows the
z-order array as it actually is, top first.

Settings and the pile's layout persist in `localStorage`.

## How it works

Three ideas carry the whole thing:

1. **One ordered array owns the stacking.** `order` holds sheet ids
   bottom-to-top and `reflow()` is the only code that writes `z-index`.
   Lifted and inspected sheets ride out-of-band z values instead of being
   spliced in and out mid-gesture, so the stack never drifts and z-indices
   never climb.
2. **Position is 1:1 with the pointer; weight lives in the springs.**
   Lagging the position behind the finger feels broken. Lagging the *tilt*,
   *lift*, and *bend* behind it feels like paper. Those run on a
   spring integrator at fixed 1/120 s substeps so the feel is identical at
   any frame rate.
3. **Only moving sheets are simulated.** Sheets are added to an active set
   on interaction and removed once their springs settle, so the rAF loop
   stops entirely when the table is still.

## Known limits

- Caption text is a fixed 34 px, so it is proportionally large when the
  stage scales down on small phones.
- The bend is a single `rotateX` on a nested element, not real geometry.
  Convincing while a sheet is held; it would not survive a page-turn.
- Twelve sheets is comfortable. See APPROACHES.md for where the DOM
  approach stops scaling.
