# Blade Storage Box

A 3D-printable storage box for Stanley Quick Point 1.8mm L-series snap-off
utility blades (~100 × 18 × 0.5 mm). Holds about 10 blades; slides out the
open short end; friction-fit cap closes it.

## Files

- `blade-box-body.stl` — the body, open at one short end
- `blade-box-cap.stl` — slip-fit cap
- `generate_stl.py` — regenerates both STLs (pure Python, no deps)

## Dimensions

| Part | Outer (L × W × H) |
|------|-------------------|
| Body | 106.5 × 23.5 × 11.0 mm |
| Cap  | 14.5 × 27.9 × 15.4 mm |

Cavity is 104 × 19.5 × 7 mm; cap interior is 12 mm deep with 0.2 mm clearance
per side. Tweak `WALL`, `CLEAR_*`, or `CAP_CLEAR` in the script if your
printer runs tight or loose.
