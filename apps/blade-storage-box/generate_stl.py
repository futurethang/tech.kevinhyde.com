"""Generate STL files for a Stanley L-series snap-off blade storage box.

Stanley Quick Point 1.8mm L blades are ~100mm x 18mm x 0.5mm.
This produces two parts: a box body (open at one end) and a friction-fit cap.
"""

from pathlib import Path

# ---- Dimensions (mm) ----
BLADE_LEN = 100.0
BLADE_WIDTH = 18.0
BLADE_THICK = 0.5
BLADE_COUNT = 10

WALL = 2.0
END_WALL = 2.5
CLEAR_LEN = 4.0   # extra room so blades slide freely
CLEAR_W = 1.5
CLEAR_H = 2.0     # extra stack height tolerance

INNER_L = BLADE_LEN + CLEAR_LEN          # 104
INNER_W = BLADE_WIDTH + CLEAR_W          # 19.5
INNER_H = BLADE_COUNT * BLADE_THICK + CLEAR_H  # 7

BODY_L = INNER_L + END_WALL              # 106.5 (one closed end, one open)
BODY_W = INNER_W + 2 * WALL              # 23.5
BODY_H = INNER_H + 2 * WALL              # 11

# Cap fits over the outside of the open end
CAP_CLEAR = 0.4                          # total slip-fit clearance per axis
CAP_DEPTH = 12.0
CAP_INNER_W = BODY_W + CAP_CLEAR
CAP_INNER_H = BODY_H + CAP_CLEAR
CAP_OUTER_W = CAP_INNER_W + 2 * WALL
CAP_OUTER_H = CAP_INNER_H + 2 * WALL
CAP_END_WALL = 2.5
CAP_OUTER_L = CAP_DEPTH + CAP_END_WALL


# ---- STL helpers ----

def tri(a, b, c):
    """Single triangle. Normal auto-computed (cross product)."""
    ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
    vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
    nx = uy * vz - uz * vy
    ny = uz * vx - ux * vz
    nz = ux * vy - uy * vx
    m = (nx * nx + ny * ny + nz * nz) ** 0.5 or 1.0
    nx, ny, nz = nx / m, ny / m, nz / m
    return (
        f"  facet normal {nx:.6f} {ny:.6f} {nz:.6f}\n"
        f"    outer loop\n"
        f"      vertex {a[0]:.6f} {a[1]:.6f} {a[2]:.6f}\n"
        f"      vertex {b[0]:.6f} {b[1]:.6f} {b[2]:.6f}\n"
        f"      vertex {c[0]:.6f} {c[1]:.6f} {c[2]:.6f}\n"
        f"    endloop\n"
        f"  endfacet\n"
    )


def quad(a, b, c, d):
    """Quad as two triangles, wound a->b->c, a->c->d (outward if CCW from outside)."""
    return tri(a, b, c) + tri(a, c, d)


def stl_wrap(name, body):
    return f"solid {name}\n{body}endsolid {name}\n"


def hollow_box(length, width, height, wall, closed_neg_x=True, closed_pos_x=False):
    """Axis-aligned hollow box, origin at one corner of the outer.
    X is along length. Closed ends are filled with wall material.
    If closed_neg_x, the x=0 end is closed; if closed_pos_x, the x=length end is closed.
    The open end is a flat ring (frame).
    """
    L, W, H, t = length, width, height, wall
    out = []

    # Outer shell rectangles. Vertices use CCW from outside.
    # Outer corners
    o = [
        (0, 0, 0), (L, 0, 0), (L, W, 0), (0, W, 0),     # 0-3 bottom (z=0)
        (0, 0, H), (L, 0, H), (L, W, H), (0, W, H),     # 4-7 top (z=H)
    ]
    # Bottom (normal -z): wind CW when viewed from +z -> reversed
    out.append(quad(o[0], o[3], o[2], o[1]))
    # Top (normal +z)
    out.append(quad(o[4], o[5], o[6], o[7]))
    # Front (y=0, normal -y)
    out.append(quad(o[0], o[1], o[5], o[4]))
    # Back (y=W, normal +y)
    out.append(quad(o[3], o[7], o[6], o[2]))

    # Inner cavity corners. If neg-x end is closed, inner starts at x=t; same logic +x.
    x0 = t if closed_neg_x else 0.0
    x1 = L - t if closed_pos_x else L
    y0, y1 = t, W - t
    z0, z1 = t, H - t
    i = [
        (x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
        (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1),
    ]
    # Inner faces (normals point into the cavity, i.e., outward from the solid)
    # Inner bottom (normal +z, looking up from inside): CCW from +z
    out.append(quad(i[0], i[1], i[2], i[3]))
    # Inner top (normal -z)
    out.append(quad(i[4], i[7], i[6], i[5]))
    # Inner front (y=t, normal +y)
    out.append(quad(i[0], i[4], i[5], i[1]))
    # Inner back (y=W-t, normal -y)
    out.append(quad(i[3], i[2], i[6], i[7]))

    # -X end
    if closed_neg_x:
        # Solid outer face (normal -x)
        out.append(quad(o[0], o[4], o[7], o[3]))
        # Solid inner face at x=t (normal +x, faces into cavity)
        out.append(quad(i[0], i[3], i[7], i[4]))
    else:
        # Open end: rectangular frame at x=0 connecting outer ring to inner ring.
        # Outer ring at x=0: o[0],o[1]ish... actually we need the x=0 outer corners (o[0],o[3],o[7],o[4]).
        # Inner ring at x=0: (0,t,t),(0,W-t,t),(0,W-t,H-t),(0,t,H-t)
        # Frame normal is -x.
        Ofr = [o[0], o[3], o[7], o[4]]  # outer ring CCW viewed from -x (looking +x)
        Ifr = [(0, t, t), (0, W - t, t), (0, W - t, H - t), (0, t, H - t)]
        # Build 4 quads forming the ring (normal -x). Outer goes CCW viewed from -x:
        # o[0](0,0,0)->o[3](0,W,0)->o[7](0,W,H)->o[4](0,0,H)
        # bottom strip: o[0]->o[3]->Ifr[1]->Ifr[0]
        out.append(quad(Ofr[0], Ofr[1], Ifr[1], Ifr[0]))
        # back strip: o[3]->o[7]->Ifr[2]->Ifr[1]
        out.append(quad(Ofr[1], Ofr[2], Ifr[2], Ifr[1]))
        # top strip: o[7]->o[4]->Ifr[3]->Ifr[2]
        out.append(quad(Ofr[2], Ofr[3], Ifr[3], Ifr[2]))
        # front strip: o[4]->o[0]->Ifr[0]->Ifr[3]
        out.append(quad(Ofr[3], Ofr[0], Ifr[0], Ifr[3]))

    # +X end
    if closed_pos_x:
        out.append(quad(o[1], o[2], o[6], o[5]))
        out.append(quad(i[1], i[5], i[6], i[2]))
    else:
        # +x ring (normal +x). Viewed from +x looking toward -x: y is to the right, z up.
        # Outer CCW: o[1](L,0,0)->o[2](L,W,0)->o[6](L,W,H)->o[5](L,0,H)
        # Bottom strip (z: 0..t): outer (L,0,0)->(L,W,0), inner (L,W-t,t)->(L,t,t)
        out.append(quad(o[1], o[2], (L, W - t, t), (L, t, t)))
        # Right strip (y: W-t..W)
        out.append(quad(o[2], o[6], (L, W - t, H - t), (L, W - t, t)))
        # Top strip (z: H-t..H)
        out.append(quad(o[6], o[5], (L, t, H - t), (L, W - t, H - t)))
        # Left strip (y: 0..t)
        out.append(quad(o[5], o[1], (L, t, t), (L, t, H - t)))

    return "".join(out)


def main():
    here = Path(__file__).parent

    # Body: closed at x=0, open at x=BODY_L
    body = hollow_box(BODY_L, BODY_W, BODY_H, WALL, closed_neg_x=True, closed_pos_x=False)
    # Use a slightly thicker end wall by extending inner cavity offset—skip; 2mm is fine.

    # Cap: closed at x=0, open at x=CAP_OUTER_L
    cap = hollow_box(CAP_OUTER_L, CAP_OUTER_W, CAP_OUTER_H, WALL, closed_neg_x=True, closed_pos_x=False)

    (here / "blade-box-body.stl").write_text(stl_wrap("blade_box_body", body))
    (here / "blade-box-cap.stl").write_text(stl_wrap("blade_box_cap", cap))

    print(f"Body outer: {BODY_L} x {BODY_W} x {BODY_H} mm")
    print(f"Cavity:     {INNER_L} x {INNER_W} x {INNER_H} mm")
    print(f"Cap outer:  {CAP_OUTER_L} x {CAP_OUTER_W} x {CAP_OUTER_H} mm")
    print(f"Cap inner:  {CAP_DEPTH} deep x {CAP_INNER_W} x {CAP_INNER_H} mm")


if __name__ == "__main__":
    main()
