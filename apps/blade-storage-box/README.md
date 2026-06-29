# Blade Storage Box

Pencil-box style sliding-lid storage for Stanley Quick Point 1.8mm L-series
snap-off blades (~100 × 18 × 0.5 mm). Holds ~10. Prints support-free.

## Files

- `blade-box-body.stl` — open-top tray with captive lid groove
- `blade-box-lid.stl` — flat lid that slides in along the long axis
- `generate_stl.py` — regenerates both STLs (pure Python, no deps)

## Dimensions

| Part | Outer (L × W × H) |
|------|-------------------|
| Body | 110 × 24.5 × 12.9 mm |
| Lid  | 113 × 22.0 × 2.0 mm  |

Lid sits in 1.5 mm deep grooves cut into the inner face of each long wall.
The groove ceiling slopes back to full wall thickness at 45° so it prints
without supports in normal cavity-up orientation. When fully closed the
lid protrudes ~5 mm at the open end for a finger grip.

Tweak constants at the top of `generate_stl.py` (`CAVITY_*`, `GROOVE_*`,
`LID_*`) if you want a different capacity or fit.
