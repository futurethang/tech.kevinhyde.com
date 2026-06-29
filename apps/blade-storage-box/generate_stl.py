"""Generate STL files for a sliding-lid blade storage box (pencil-box style).

Stanley Quick Point 1.8mm L blades are ~100mm x 18mm x 0.5mm.
The lid slides along the long axis. The groove ceiling uses a 45 deg
slope so the entire body prints support-free in normal cavity-up
orientation.
"""

from pathlib import Path

# ---- Dimensions (mm) ----
BASE = 2.0
LWALL = 2.5     # long wall thickness (groove cuts into the inner face)
CWALL = 2.0     # closed-end short wall thickness
OWALL = 2.0     # open-end short wall thickness (only goes up to groove bottom)

CAVITY_L = 106.0
CAVITY_W = 19.5
CAVITY_H = 7.0

GROOVE_H = 2.4   # lid slot vertical opening (lid is 2.0 thick + 0.4 clearance)
GROOVE_D = 1.5   # how deep the groove cuts into each long wall

# Derived
W = CAVITY_W + 2 * LWALL                  # 24.5
L = CAVITY_L + CWALL + OWALL              # 110
OPEN_H = BASE + CAVITY_H                  # 9   (top of open-end short wall, bottom of groove)
SLOPE_RUN = GROOVE_D                      # 45 deg slope -> rise == run
BOX_H = OPEN_H + GROOVE_H + SLOPE_RUN     # 12.9

# Lid: leave 0.25 mm clearance per edge in y, 0.2 mm per face in z
LID_T = 2.0
LID_CLEAR_W = 0.5
LID_W = (W - 2 * LWALL) + 2 * GROOVE_D - LID_CLEAR_W   # 22.0
LID_L = L + 3.0                                         # 113  -> 5 mm grip tab when fully closed


# ---- STL helpers ----

def tri(a, b, c):
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
    return tri(a, b, c) + tri(a, c, d)


def box_solid(xmin, ymin, zmin, xmax, ymax, zmax):
    o = [
        (xmin, ymin, zmin), (xmax, ymin, zmin), (xmax, ymax, zmin), (xmin, ymax, zmin),
        (xmin, ymin, zmax), (xmax, ymin, zmax), (xmax, ymax, zmax), (xmin, ymax, zmax),
    ]
    out = []
    out.append(quad(o[0], o[3], o[2], o[1]))   # -z
    out.append(quad(o[4], o[5], o[6], o[7]))   # +z
    out.append(quad(o[0], o[1], o[5], o[4]))   # -y
    out.append(quad(o[3], o[7], o[6], o[2]))   # +y
    out.append(quad(o[0], o[4], o[7], o[3]))   # -x
    out.append(quad(o[1], o[2], o[6], o[5]))   # +x
    return "".join(out)


def extrude_polygon_x(polygon, x_min, x_max):
    """Extrude a CCW (viewed from +x) polygon in the y-z plane along x."""
    n = len(polygon)
    out = []
    # +x end cap (normal +x): CCW vertex order in y-z
    for i in range(1, n - 1):
        out.append(tri(
            (x_max, polygon[0][0], polygon[0][1]),
            (x_max, polygon[i][0], polygon[i][1]),
            (x_max, polygon[i + 1][0], polygon[i + 1][1]),
        ))
    # -x end cap (normal -x): reversed
    for i in range(1, n - 1):
        out.append(tri(
            (x_min, polygon[0][0], polygon[0][1]),
            (x_min, polygon[i + 1][0], polygon[i + 1][1]),
            (x_min, polygon[i][0], polygon[i][1]),
        ))
    # Side faces, one per polygon edge
    for i in range(n):
        y1, z1 = polygon[i]
        y2, z2 = polygon[(i + 1) % n]
        out.append(quad(
            (x_min, y1, z1),
            (x_min, y2, z2),
            (x_max, y2, z2),
            (x_max, y1, z1),
        ))
    return "".join(out)


# ---- Geometry assembly ----

def make_body():
    parts = []
    # Floor (full footprint)
    parts.append(box_solid(0, 0, 0, L, W, BASE))
    # Closed end wall (full height)
    parts.append(box_solid(0, 0, BASE, CWALL, W, BOX_H))
    # Open-end short wall: only up to groove bottom, between long walls
    parts.append(box_solid(L - OWALL, LWALL, BASE, L, W - LWALL, OPEN_H))

    # Long walls -- heptagonal cross-section (rectangle minus a groove notch)
    # Vertices CCW when viewed from +x, with y to the right and z up.
    # Left wall (outer face at y=0, inner face at y=LWALL):
    left_poly = [
        (0, BASE),                                       # bottom-outer
        (LWALL, BASE),                                   # bottom-inner
        (LWALL, OPEN_H),                                 # inner face, up to groove
        (LWALL - GROOVE_D, OPEN_H),                      # groove bottom (cut deeper)
        (LWALL - GROOVE_D, OPEN_H + GROOVE_H),           # groove top (rectangular part)
        (LWALL, BOX_H),                                  # slope up to top inner corner
        (0, BOX_H),                                      # top-outer
    ]
    # Right wall mirrored across y = W/2
    right_poly = [
        (W - LWALL, BASE),
        (W, BASE),
        (W, BOX_H),
        (W - LWALL, BOX_H),
        (W - LWALL + GROOVE_D, OPEN_H + GROOVE_H),
        (W - LWALL + GROOVE_D, OPEN_H),
        (W - LWALL, OPEN_H),
    ]
    parts.append(extrude_polygon_x(left_poly, CWALL, L))
    parts.append(extrude_polygon_x(right_poly, CWALL, L))
    return "".join(parts)


def make_lid():
    return box_solid(0, 0, 0, LID_L, LID_W, LID_T)


def stl_wrap(name, body):
    return f"solid {name}\n{body}endsolid {name}\n"


def main():
    here = Path(__file__).parent
    (here / "blade-box-body.stl").write_text(stl_wrap("blade_box_body", make_body()))
    (here / "blade-box-lid.stl").write_text(stl_wrap("blade_box_lid", make_lid()))
    print(f"Box outer: {L} x {W} x {BOX_H} mm")
    print(f"Cavity:    {CAVITY_L} x {CAVITY_W} x {CAVITY_H} mm")
    print(f"Lid:       {LID_L} x {LID_W} x {LID_T} mm  ({LID_L - (L - CWALL):.1f} mm tab when closed)")


if __name__ == "__main__":
    main()
