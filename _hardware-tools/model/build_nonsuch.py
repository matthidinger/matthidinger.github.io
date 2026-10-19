# Builds the stylised, not-to-scale Nonsuch 30 Ultra model behind /hardware/ (Blender 5.2).
# Proportions eyeballed from the station profile; original geometry, no traced artwork.
# Axes: +X forward (x=0 at aft end of DWL), +Y port, +Z up, waterline z=0. Metres.
#
#   blender -b --python build_nonsuch.py -- norender      # writes out/nonsuch30.glb (and out/nonsuch30.blend)
#   blender -b --python build_nonsuch.py -- hero          # also renders out/hero.png; with no view name it renders
#                                                         # all five (hero, hull, xray_side, xray_aft, xray_elec)
#
# Then compress it into the site with `npm run glb -- model/out/nonsuch30.glb` (see ../README.md).
# Object names and the part/system custom properties set here are what the site's data files key on.
import bpy, bmesh, math, os, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
os.makedirs(OUT, exist_ok=True)
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
RENDER = "norender" not in ARGS

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- helpers
def lin(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)

MATS = {}
def mat(name, hexc, rough=0.5, metal=0.0, emit=0.0):
    m = bpy.data.materials.new(name)
    try: m.use_nodes = True
    except Exception: pass
    b = m.node_tree.nodes.get("Principled BSDF")
    rgb = lin(hexc)
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*rgb, 1)
        b.inputs["Emission Strength"].default_value = emit
    m.diffuse_color = (*rgb, 1)
    MATS[name] = m
    return m

def set_alpha(m, a):
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Alpha"].default_value = a
    try: m.surface_render_method = 'BLENDED' if a < 1 else 'DITHERED'
    except Exception: pass
    try: m.blend_method = 'BLEND' if a < 1 else 'OPAQUE'
    except Exception: pass
    m.use_backface_culling = False

COLLS = {}
def coll(name):
    if name not in COLLS:
        c = bpy.data.collections.new(name)
        scene.collection.children.link(c)
        COLLS[name] = c
    return COLLS[name]

def place(ob, cname):
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    coll(cname).objects.link(ob)
    return ob

def mesh_obj(name, verts, faces, m, cname, mirror=False, smooth=True, mat_idx=None, extra_mats=()):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate()
    me.materials.append(m)
    for em in extra_mats:
        me.materials.append(em)
    if mat_idx:
        for p, i in zip(me.polygons, mat_idx):
            p.material_index = i
    for p in me.polygons:
        p.use_smooth = smooth
    ob = bpy.data.objects.new(name, me)
    coll(cname).objects.link(ob)
    if mirror:
        md = ob.modifiers.new("mirror", 'MIRROR')
        md.use_axis = (False, True, False)
        md.use_clip = True
        md.use_mirror_merge = True
        md.merge_threshold = 0.002
    return ob

def box(name, center, dims, m, cname, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center, rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.data.materials.append(m)
    if bevel:
        md = ob.modifiers.new("bevel", 'BEVEL')
        md.width = bevel
        md.segments = 3
    return place(ob, cname)

def cyl(name, a, b, r, m, cname, verts=24, r2=None):
    a, b = Vector(a), Vector(b)
    d = b - a
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d.length, vertices=verts, location=(a + b) / 2)
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=d.length, vertices=verts, location=(a + b) / 2)
    ob = bpy.context.active_object
    ob.name = name
    ob.rotation_mode = 'QUATERNION'
    ob.rotation_quaternion = d.normalized().to_track_quat('Z', 'Y')
    ob.data.materials.append(m)
    for p in ob.data.polygons:
        p.use_smooth = True
    return place(ob, cname)

def tube(name, pts, r, m, cname, smooth=True, cyclic=False, res=16):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = r
    cu.bevel_resolution = 4
    cu.use_fill_caps = True
    cu.resolution_u = res
    sp = cu.splines.new('BEZIER')
    sp.use_cyclic_u = cyclic
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = 'AUTO' if smooth else 'VECTOR'
    cu.materials.append(m)
    ob = bpy.data.objects.new(name, cu)
    coll(cname).objects.link(ob)
    return ob

def cr(vals, s):
    n = len(vals)
    i = max(0, min(int(math.floor(s)), n - 2))
    t = s - i
    p0, p1, p2, p3 = vals[max(i - 1, 0)], vals[i], vals[i + 1], vals[min(i + 2, n - 1)]
    return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                  + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)

# ---------------------------------------------------------------- palette
M_TOP = mat("Topsides", "#F3EFE7", 0.35)
M_BOOT = mat("Boot stripe", "#22375E", 0.4)
M_BOTTOM = mat("Bottom paint", "#1B2433", 0.7)
M_TRANSOM = mat("Transom", "#ECE7DD", 0.35)
M_DECK = mat("Deck", "#E4DDCF", 0.75)
M_CABIN = mat("Cabin", "#F1ECE3", 0.4)
M_DARK = mat("Glass", "#1A2230", 0.15)
M_WELL = mat("Cockpit", "#D9D1C2", 0.8)
M_KEEL = mat("Keel", "#1B2433", 0.7)
M_MAST = mat("Mast", "#E9EAEA", 0.35)
M_SAIL = mat("Sail", "#F6F1E6", 0.85)
M_BOOM = mat("Wishbone", "#C9CED3", 0.3, 0.8)
M_PROP = mat("Propulsion", "#E39B32", 0.45)
M_PROP2 = mat("Propulsion dark", "#9C6418", 0.5)
M_STEEL = mat("Steel", "#BFC6CE", 0.25, 0.9)
M_BRONZE = mat("Bronze", "#B88A4E", 0.3, 0.9)
M_STEER = mat("Steering", "#E2654A", 0.45)
M_ELEC = mat("Electrical", "#2FB0A8", 0.45)
M_LOAD = mat("Electrical loads", "#8FD8D1", 0.5)
M_CABLE = mat("Cable", "#C8232B", 0.5)
M_ACCABLE = mat("AC cable", "#1E2024", 0.45)
M_INT = mat("Interior", "#C9B48E", 0.7)
M_TACKLE = mat("Ground tackle", "#8F7BE8", 0.45)
M_HOSE = mat("Exhaust hose", "#3A3F47", 0.6)
M_BED = mat("Engine bed", "#8A8F96", 0.8)
M_TCABLE = mat("Windlass cable", "#5B4BB5", 0.5)
M_RISER = mat("Windlass riser", "#C8743A", 0.55)
M_PORT = mat("Deck port", "#F4F3EF", 0.5)
M_COLD = mat("Cold water", "#3D8BEB", 0.4)
M_HOT = mat("Hot water", "#E5484D", 0.4)
M_TANK = mat("Water tank", "#A9CCF2", 0.5)
M_PLUMB = mat("Plumbing", "#2F6FC2", 0.45)
M_HEATER = mat("Water heater", "#F07C80", 0.4)
M_COOLANT = mat("Coolant", "#A8323A", 0.5)
M_NAV = mat("Electronics", "#7DB544", 0.45)
M_N2K = mat("NMEA 2000 cable", "#3E6B1E", 0.5)
M_SIG = mat("Signal cable", "#2E3440", 0.55)
M_SWIM = mat("Swim platform", "#E2E5E8", 0.55)
M_SLOT = mat("Swim platform slots", "#8C939B", 0.6)
M_STRIPE = mat("Navy stripe", "#22375E", 0.4)
M_FRAME = mat("Port frame", "#D9DDE1", 0.35, 0.3)
M_TEAK = mat("Teak", "#9A6A3C", 0.6)

# ---------------------------------------------------------------- hull
# xtop, xbot, half-breadth at sheer, sheer z, canoe-body z at centreline, section exponent
ROWS = [
    (-0.20, -0.13, 1.30, 1.17, 0.05, 3.2),   # transom
    (0.000, 0.000, 1.36, 1.16, -0.05, 3.1),  # st 10
    (0.876, 0.876, 1.47, 1.16, -0.17, 3.0),  # st 9
    (1.752, 1.752, 1.61, 1.16, -0.29, 2.9),  # st 8
    (2.628, 2.628, 1.72, 1.17, -0.36, 2.8),  # st 7
    (3.504, 3.504, 1.79, 1.18, -0.39, 2.7),  # st 6
    (4.380, 4.380, 1.805, 1.20, -0.40, 2.6), # st 5
    (5.256, 5.256, 1.78, 1.22, -0.38, 2.4),  # st 4
    (6.132, 6.132, 1.70, 1.25, -0.34, 2.2),  # st 3
    (7.008, 7.008, 1.58, 1.31, -0.27, 2.0),  # st 2
    (7.884, 7.860, 1.29, 1.42, -0.16, 1.7),  # st 1
    (8.830, 8.700, 0.45, 1.60, -0.03, 1.5),  # st 0
    (9.020, 8.840, 0.012, 1.64, 0.14, 1.3),  # stem
]
cols = list(zip(*ROWS))
SEG, NV = 10, 36
NS = (len(ROWS) - 1) * SEG + 1

def row(s):
    xt, xb, hs, zs, zb, n = (cr(c, s) for c in cols)
    return xt, xb, max(hs, 0.006), zs, zb, max(n, 1.1)

def section_pts(s):
    xt, xb, hs, zs, zb, n = row(s)
    pts = []
    for j in range(NV + 1):
        th = j / NV * math.pi / 2
        c, sn = math.cos(th), math.sin(th)
        y = 0.0 if j == NV else hs * c ** (2 / n)
        dz = (zs - zb) * sn ** (2 / n)
        x = xt + (xb - xt) * dz / (zs - zb)
        pts.append((x, y, zs - dz))
    return pts

def hull_z_at(x):
    best = None
    for i in range(NS):
        s = i / SEG
        xt, xb, hs, zs, zb, n = row(s)
        if best is None or abs(xb - x) < abs(best[0] - x):
            best = (xb, zb)
    return best[1]

verts, faces = [], []
for i in range(NS):
    verts += section_pts(i / SEG)
for i in range(NS - 1):
    for j in range(NV):
        a = i * (NV + 1) + j
        b = a + NV + 1
        faces.append((a, a + 1, b + 1, b))
hull = mesh_obj("Hull", verts, faces, M_TOP, "Hull", mirror=True, extra_mats=(M_BOOT, M_BOTTOM))
# split exactly at the boot-stripe lines so paint edges are crisp
bm = bmesh.new()
bm.from_mesh(hull.data)
for zc in (0.03, 0.14):
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, zc), plane_no=(0, 0, 1))
for f in bm.faces:
    z = f.calc_center_median().z
    f.material_index = 2 if z < 0.03 else (1 if z < 0.14 else 0)
    f.smooth = True
bm.to_mesh(hull.data)
bm.free()
t0 = section_pts(0)
mesh_obj("Transom", t0 + [(t0[0][0], 0.0, t0[0][2])], [tuple(reversed(range(NV + 2)))], M_TRANSOM, "Hull",
         mirror=True, smooth=False)

# deck (cambered, cockpit cut with boolean)
NK = 8
dv, df = [], []
for i in range(NS):
    xt, xb, hs, zs, zb, n = row(i / SEG)
    cam = 0.07 * hs / 1.8
    for k in range(NK + 1):
        f = k / NK
        dv.append((xt, hs * f, zs + 0.012 + cam * (1 - f * f)))
for i in range(NS - 1):
    for k in range(NK):
        a = i * (NK + 1) + k
        df.append((a, a + NK + 1, a + NK + 2, a + 1))
deck = mesh_obj("Deck", dv, df, M_DECK, "Hull", mirror=True)

def deck_z(x, y=0.0):
    best = min(range(NS), key=lambda i: abs(row(i / SEG)[0] - x))
    xt, xb, hs, zs, zb, n = row(best / SEG)
    f = min(abs(y) / hs, 1)
    return zs + 0.012 + 0.07 * hs / 1.8 * (1 - f * f)

CK_X0, CK_X1, CK_W, CK_SOLE, CK_SEAT, CK_SEATW = 0.40, 2.64, 0.95, 0.62, 1.00, 0.52
cutter = box("cockpit_cutter", ((CK_X0 + CK_X1) / 2, 0, 1.3), (CK_X1 - CK_X0, 2 * CK_W, 1.0), M_DARK, "Cutters")
bm_ = deck.modifiers.new("cockpit", 'BOOLEAN')
bm_.operation = 'DIFFERENCE'
bm_.object = cutter
coll("Cutters").hide_render = True
coll("Cutters").hide_viewport = True

# cockpit: well, seats, coaming
cx = (CK_X0 + CK_X1) / 2
box("Cockpit sole", (cx, 0, CK_SOLE - 0.02), (CK_X1 - CK_X0, 2 * CK_SEATW, 0.04), M_WELL, "Hull")
for sgn in (1, -1):
    box("Cockpit seat", (cx, sgn * (CK_SEATW + CK_W) / 2, (CK_SOLE + CK_SEAT) / 2),
        (CK_X1 - CK_X0, CK_W - CK_SEATW, CK_SEAT - CK_SOLE), M_WELL, "Hull", bevel=0.02)
    box("Coaming", (cx, sgn * (CK_W + 0.02), (CK_SEAT + 1.42) / 2), (CK_X1 - CK_X0, 0.04, 1.42 - CK_SEAT),
        M_CABIN, "Hull", bevel=0.01)
box("Cockpit aft wall", (CK_X0 - 0.02, 0, (CK_SOLE + 1.2) / 2), (0.04, 2 * CK_W, 1.2 - CK_SOLE), M_WELL, "Hull")

# cabin trunk
CB_X0, CB_X1 = 2.64, 6.67
cv, cf = [], []
NC = 40
# side leans in slightly, then a tight rounded shoulder into the cambered roof
prof = [(1.0, 0.0), (0.955, 0.93), (0.935, 0.99), (0.91, 1.03), (0.66, 1.07), (0.33, 1.1), (0.0, 1.11)]
SIDE_K = 0.045 / 0.93

def cabin_at(x):
    w = 1.15 - 0.5 * max(0, (x - 5.7) / (CB_X1 - 5.7)) ** 2
    base = deck_z(x, w) - 0.02
    top = 1.66 - (x - CB_X0) * 0.045
    return w, base, top

for i in range(NC + 1):
    u = i / NC
    x = CB_X0 + (CB_X1 - CB_X0) * u
    w, base, top = cabin_at(x)
    for fy, fz in prof:
        z = base + (top - base) * min(fz, 1) + (0.06 * (fz - 1) / 0.11 if fz > 1 else 0)
        cv.append((x, w * fy, z))
P = len(prof)
for i in range(NC):
    for k in range(P - 1):
        a = i * P + k
        cf.append((a, a + P, a + P + 1, a + 1))
for end, rev in ((0, False), (NC, True)):
    ring = [end * P + k for k in range(P)]
    cv.append((cv[ring[0]][0], 0.0, cv[ring[0]][2]))
    poly = ring + [len(cv) - 1]
    cf.append(tuple(reversed(poly)) if rev else tuple(poly))
cabin = mesh_obj("Cabin", cv, cf, M_CABIN, "Hull", mirror=True)
side_y = lambda w, f: w * (1 - SIDE_K * f)
# rectangular opening ports in light frames (count and size stylised); kept below the eyebrow stripe
for i, x in enumerate((3.55, 4.59, 5.56)):
    w, base, top = cabin_at(x)
    h = top - base
    gh = min(0.11, 0.38 * h)
    f = 0.45
    z = base + h * f
    for sgn in (1, -1):
        rot = (sgn * math.atan2(SIDE_K * w, h), 0, 0)
        box(f"Port frame {i}", (x, sgn * (side_y(w, f) + 0.003), z), (0.42, 0.010, gh + 0.035), M_FRAME, "Hull",
            bevel=0.012, rot=rot)
        box(f"Portlight {i}", (x, sgn * (side_y(w, f) + 0.008), z), (0.36, 0.008, gh), M_DARK, "Hull",
            bevel=0.02, rot=rot)
for x in (3.72, 5.07):
    top = 1.66 - (x - CB_X0) * 0.045 + 0.06
    box("Hatch", (x, 0, top + 0.03), (0.55, 0.55, 0.07), M_CABIN, "Hull", bevel=0.02)
    box("Hatch lens", (x, 0, top + 0.068), (0.45, 0.45, 0.01), M_DARK, "Hull")

# eyebrow: the navy vinyl stripe that replaced the old wood eyebrow, just under the shoulder (width/ends stylised).
# Separate port and starboard objects, port first so the viewer pins the port side.
def eyebrow_side(sgn):
    ev, ef = [], []
    xs = [CB_X0 + (CB_X1 - CB_X0) * i / NC for i in range(NC + 1)]
    xs[0], xs[-1] = CB_X0 + 0.02, CB_X1 - 0.02
    for x in xs:
        w, base, top = cabin_at(x)
        h = top - base
        zt = top - 0.07 * h - 0.012
        for z in (zt - 0.045, zt):
            ev.append((x, sgn * (side_y(w, (z - base) / h) + 0.003), z))
    for i in range(len(xs) - 1):
        a = 2 * i
        q = (a, a + 1, a + 3, a + 2)
        ef.append(q if sgn > 0 else tuple(reversed(q)))
    return mesh_obj("Eyebrow stripe", ev, ef, M_STRIPE, "Hull")
eyebrow_side(1)
eyebrow_side(-1)

# teak handrails on the aft cabin top (position approximate)
for sgn in (1, -1):
    x0, x1 = 2.95, 3.95
    xm = (x0 + x1) / 2
    w, base, top = cabin_at(xm)
    y = sgn * 0.75 * w
    s = top + 0.03
    box("Handrail", (xm, y, s + 0.065), (x1 - x0, 0.035, 0.03), M_TEAK, "Hull", bevel=0.008,
        rot=(0, math.atan(0.045), 0))
    for k in range(4):
        px = x0 + 0.06 + (x1 - x0 - 0.12) * k / 3
        ps = 1.66 - (px - CB_X0) * 0.045 + 0.03
        box("Handrail", (px, y, ps + 0.03), (0.05, 0.03, 0.065), M_TEAK, "Hull", bevel=0.006)

# navy sheer stripe along the top of the topsides, wrapping the transom. Its top row is a small lip over the deck edge,
# which also closes the slit between the sheer and the deck that showed the gear inside.
SH_W = 0.11
NT = 4
NR = NT + 1
sv, sf = [], []
for i in range(NS):
    xt, xb, hs, zs, zb, n = row(i / SEG)
    thb = math.asin(min(1.0, SH_W / (zs - zb)) ** (n / 2))
    sv.append((xt, hs + 0.003, zs + 0.02))
    for r in range(NT):
        th = thb * r / (NT - 1)
        c, sn = math.cos(th), math.sin(th)
        dz = (zs - zb) * sn ** (2 / n)
        sv.append((xt + (xb - xt) * dz / (zs - zb), hs * c ** (2 / n) + 0.003, zs - dz))
for i in range(NS - 1):
    for r in range(NR - 1):
        a = i * NR + r
        sf.append((a, a + 1, a + NR + 1, a + NR))
mesh_obj("Sheer stripe", sv, sf, M_STRIPE, "Hull", mirror=True)
tv, tf = [], []
for r in range(NR):
    x, y, z = sv[r]
    tv += [(x - 0.004, y, z), (x - 0.004, 0.0, z)]
for r in range(NR - 1):
    a = 2 * r
    tf.append((a, a + 2, a + 3, a + 1))
mesh_obj("Sheer stripe", tv, tf, M_STRIPE, "Hull", mirror=True, smooth=False)

# keel and rudder (NACA 00xx sections)
def foil(name, root, tip, m, cname):
    def ring(xle, xte, z, t):
        c = xle - xte
        pts = []
        N = 24
        xs = [(1 - math.cos(math.pi * k / N)) / 2 for k in range(N + 1)]
        top = []
        for s in xs:
            yt = 5 * t * c * (0.2969 * math.sqrt(s) - 0.1260 * s - 0.3516 * s ** 2 + 0.2843 * s ** 3 - 0.1036 * s ** 4)
            top.append((xle - s * c, yt, z))
        bot = [(x, -y, z) for (x, y, z) in reversed(top[1:-1])]
        return top + bot
    r0, r1 = ring(*root), ring(*tip)
    n = len(r0)
    v = r0 + r1
    f = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    f.append(tuple(range(n)))
    f.append(tuple(reversed(range(n, 2 * n))))
    return mesh_obj(name, v, f, m, cname, smooth=True)

foil("Keel", (5.49, 2.92, -0.25, 0.13), (4.55, 2.92, -1.46, 0.12), M_KEEL, "Hull")
RUD_X = 0.25
foil("Rudder", (0.40, -0.20, 0.02, 0.12), (0.36, -0.14, -1.18, 0.11), M_KEEL, "Hull")

# ---------------------------------------------------------------- rig
MAST_X = 7.89
# stylised: the rig is drawn at half height above the deck (the real masthead is about 15.5 m / 51 ft)
RIG_Z0, RIG_K = 1.2, 0.5
def rig_z(z):
    return z if z <= RIG_Z0 else RIG_Z0 + (z - RIG_Z0) * RIG_K
MAST_TOP = rig_z(15.5)
cyl("Mast", (MAST_X, 0, hull_z_at(MAST_X) + 0.06), (MAST_X, 0, MAST_TOP), 0.15, M_MAST, "Rig", r2=0.075, verts=32)
HEAD = Vector((MAST_X - 0.13, 0, 15.15))
TACK = Vector((MAST_X - 0.13, 0, 1.95))
CLEW = Vector((0.30, 0, 2.75))
THROAT_Z = 5.9
sv, sf = [], []
NU, NVs = 18, 30
for j in range(NVs + 1):
    v = j / NVs
    L = TACK.lerp(HEAD, v)
    ctrl = (CLEW + HEAD) / 2 + Vector((0.55, 0, 0.75)).normalized() * 1.1
    E = (1 - v) ** 2 * CLEW + 2 * (1 - v) * v * ctrl + v * v * HEAD
    for i in range(NU + 1):
        u = i / NU
        p = L.lerp(E, u)
        p.y += 0.45 * math.sin(math.pi * u) * (1 - v) ** 0.8 * (1 - 0.6 * u)
        sv.append((p.x, p.y, rig_z(p.z)))
for j in range(NVs):
    for i in range(NU):
        a = j * (NU + 1) + i
        sf.append((a, a + 1, a + NU + 2, a + NU + 1))
mesh_obj("Sail", sv, sf, M_SAIL, "Sail")
for sgn in (1, -1):
    tube("Wishbone", [(MAST_X - 0.12, sgn * 0.12, rig_z(THROAT_Z)), (5.2, sgn * 0.72, rig_z(4.9)), (2.4, sgn * 0.62, rig_z(3.75)),
                      (CLEW.x - 0.05, sgn * 0.06, rig_z(CLEW.z))], 0.035, M_BOOM, "Sail")

# ---------------------------------------------------------------- propulsion (V-drive)
box("Engine bed", (1.95, 0.24, -0.17), (1.45, 0.06, 0.16), M_BED, "Propulsion")
box("Engine bed", (1.95, -0.24, -0.17), (1.45, 0.06, 0.16), M_BED, "Propulsion")
# the belt end faces aft (the V-drive puts the engine backwards); EF is that front face
EF = 1.57
box("Engine block", (EF + 0.31, 0, 0.16), (0.62, 0.44, 0.48), M_PROP, "Propulsion", bevel=0.04)
box("Valve cover", (EF + 0.31, 0.04, 0.45), (0.50, 0.22, 0.10), M_PROP2, "Propulsion", bevel=0.03)
# heat exchanger lies athwartships just above the V-drive, against the forward face of the block (per the photos)
HX_X, HX_Z = EF + 0.70, 0.38
cyl("Heat exchanger", (HX_X, -0.22, HX_Z), (HX_X, 0.24, HX_Z), 0.055, M_PROP2, "Propulsion")
# belt end, laid out from a photo looking forward at it: crank low, a large pulley above it to port,
# the alternator high to starboard and the bronze raw-water pump inside the belt loop below it (stylised)
BX = EF - 0.04
PULLEYS = ((0.0, 0.02, 0.09), (0.05, 0.27, 0.08), (-0.19, 0.38, 0.035))  # (y, z, r): crank, large pulley, alternator
cyl("Crank pulley", (EF - 0.07, 0, 0.02), (EF - 0.01, 0, 0.02), 0.09, M_STEEL, "Propulsion")
cyl("Belt pulley", (EF - 0.07, 0.05, 0.27), (EF - 0.01, 0.05, 0.27), 0.08, M_SIG, "Propulsion")
cyl("Alternator (Balmar)", (EF - 0.06, -0.19, 0.38), (EF - 0.02, -0.19, 0.38), 0.035, M_ELEC, "Electrical")
cyl("Alternator (Balmar)", (EF - 0.03, -0.19, 0.38), (EF + 0.10, -0.19, 0.38), 0.075, M_ELEC, "Electrical")
hull_pts = []
for y, z, r in PULLEYS:
    for k in range(24):
        a = 2 * math.pi * k / 24
        hull_pts.append((y + (r + 0.006) * math.cos(a), z + (r + 0.006) * math.sin(a)))
hull_pts.sort()
def _half(ps):
    out = []
    for p in ps:
        while len(out) >= 2 and ((out[-1][0] - out[-2][0]) * (p[1] - out[-2][1]) - (out[-1][1] - out[-2][1]) * (p[0] - out[-2][0])) <= 0:
            out.pop()
        out.append(p)
    return out
belt = _half(hull_pts)[:-1] + _half(hull_pts[::-1])[:-1]
tube("Serpentine belt", [(BX, y, z) for y, z in belt], 0.007, M_SIG, "Propulsion", cyclic=True, res=3)
cyl("Raw water pump", (EF - 0.05, -0.08, 0.19), (EF + 0.03, -0.08, 0.19), 0.048, M_BRONZE, "Propulsion")
for dy in (-0.03, 0.03):
    cyl("Raw water pump", (EF - 0.02, -0.08 + dy, 0.21), (EF - 0.02, -0.08 + dy, 0.27), 0.017, M_BRONZE, "Propulsion")
tube("Raw water hose", [(EF - 0.02, -0.11, 0.27), (EF + 0.03, -0.20, 0.265), (EF + 0.09, -0.28, 0.28), (EF + 0.30, -0.29, 0.30),
                        (HX_X - 0.10, -0.29, 0.34), (HX_X - 0.02, -0.29, HX_Z), (HX_X, -0.22, HX_Z)],
     0.016, M_HOSE, "Propulsion")
# Hurth ZF15MIV: one V-shaped gearbox bolted to the forward end of the engine. It takes the drive in at the top and
# sends it back aft out of the bottom, under the engine (side profile in x, z; stylised)
VD = [(2.19, 0.30), (2.36, 0.28), (2.49, 0.12), (2.50, -0.16), (2.42, -0.27), (2.28, -0.27), (2.28, -0.11),
      (2.35, -0.06), (2.19, 0.02)]
n = len(VD)
vd = mesh_obj("V-drive", [(x, s * 0.13, z) for s in (-1, 1) for x, z in VD],
              [tuple(range(n))[::-1], tuple(range(n, 2 * n))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)],
              M_PROP2, "Propulsion", smooth=False)
bm = bmesh.new()
bm.from_mesh(vd.data)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(vd.data)
bm.free()
md = vd.modifiers.new("bevel", 'BEVEL')
md.width = 0.02
md.segments = 3
md.limit_method = 'ANGLE'
SH_A = Vector((2.27, 0, -0.19))
SH_B = Vector((0.70, 0, -0.51))
cyl("Shaft coupling", SH_A + Vector((0.03, 0, 0.006)), SH_A - (SH_A - SH_B).normalized() * 0.06, 0.065, M_STEEL, "Propulsion")
cyl("Prop shaft", SH_A, SH_B, 0.0127, M_STEEL, "Propulsion", verts=16)
sb = SH_A.lerp(SH_B, 0.30)
cyl("PSS dripless seal", sb - (SH_A - SH_B).normalized() * 0.09, sb + (SH_A - SH_B).normalized() * 0.09, 0.04, M_PROP2, "Propulsion")
st = SH_A.lerp(SH_B, 0.85)
box("Strut", (st.x, 0, (st.z + hull_z_at(st.x)) / 2 + 0.03), (0.16, 0.025, abs(hull_z_at(st.x) - st.z) + 0.1),
    M_BRONZE, "Propulsion", bevel=0.01)
cyl("Cutless bearing", st + Vector((0.08, 0, 0.016)), st - Vector((0.08, 0, 0.016)), 0.032, M_BRONZE, "Propulsion")
cyl("Prop hub", SH_B + Vector((0.07, 0, 0.014)), SH_B - Vector((0.07, 0, 0.014)), 0.045, M_BRONZE, "Propulsion", r2=0.03)
for k in range(3):
    a = k * 2 * math.pi / 3
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=24, ring_count=12,
                                         location=(SH_B.x, 0.11 * math.cos(a), SH_B.z + 0.11 * math.sin(a)))
    bl = bpy.context.active_object
    bl.name = "Prop blade"
    bl.scale = (0.02, 0.10, 0.06)
    bl.rotation_euler = (a - math.pi / 2, 0, 0)
    bl.rotation_euler.rotate_axis('Z', math.radians(28))
    bl.data.materials.append(M_BRONZE)
    for p in bl.data.polygons:
        p.use_smooth = True
    place(bl, "Propulsion")
# exhaust: elbow -> waterlift muffler (port side, between the engine and the V-drive) -> across under the cockpit sole
# -> high loop outboard of the starboard seat -> starboard transom outlet (above the linear drive)
cyl("Waterlift muffler", (2.20, 0.45, -0.08), (2.20, 0.45, 0.24), 0.12, M_HOSE, "Propulsion")
tube("Exhaust hose", [(1.88, 0.18, 0.47), (2.10, 0.20, 0.42), (2.17, 0.34, 0.33), (2.16, 0.42, 0.26)], 0.032, M_HOSE, "Propulsion")
tube("Exhaust hose", [(2.25, 0.50, 0.26), (2.28, 0.40, 0.48), (2.30, 0.0, 0.52), (2.27, -0.55, 0.52), (2.05, -0.98, 0.72),
                      (1.30, -1.05, 0.80), (0.60, -1.00, 0.88), (0.20, -0.86, 0.80), (-0.15, -0.78, 0.64)],
     0.032, M_HOSE, "Propulsion")

# ---------------------------------------------------------------- steering + autopilot
cyl("Rudder stock", (RUD_X, 0, -0.95), (RUD_X, 0, 0.62), 0.030, M_STEEL, "Steering")
# radial drive low on the stock; the autopilot's tiller arm clamps on above it (per the photo)
RD_Z = 0.32
cyl("Radial drive", (RUD_X, 0, RD_Z - 0.02), (RUD_X, 0, RD_Z + 0.02), 0.25, M_STEER, "Steering", verts=40)
for sgn in (1, -1):
    tube("Steering cable", [(RUD_X + 0.05, sgn * 0.25, RD_Z), (0.62, sgn * 0.26, RD_Z), (1.02, sgn * 0.08, 0.50),
                            (1.05, sgn * 0.03, 0.66)], 0.008, M_STEER, "Steering")
    cyl("Idler sheave", (0.62, sgn * 0.26, RD_Z - 0.03), (0.62, sgn * 0.26, RD_Z + 0.03), 0.05, M_STEER, "Steering")
PED_X = 1.05
cyl("Pedestal", (PED_X, 0, CK_SOLE), (PED_X, 0, 1.52), 0.075, M_STEER, "Steering")
WH = Vector((PED_X - 0.14, 0, 1.46))
bpy.ops.mesh.primitive_torus_add(major_radius=0.355, minor_radius=0.016, major_segments=64, minor_segments=10,
                                 location=WH, rotation=(0, math.radians(90), 0))
wh = bpy.context.active_object
wh.name = "Wheel"
wh.data.materials.append(M_STEEL)
place(wh, "Steering")
for k in range(6):
    a = k * math.pi / 3
    cyl("Spoke", WH, WH + Vector((0, 0.35 * math.cos(a), 0.35 * math.sin(a))), 0.008, M_STEEL, "Steering", verts=8)
cyl("Wheel axle", WH, (PED_X, 0, 1.46), 0.025, M_STEEL, "Steering")
# Raymarine linear drive: tiller arm aft from the stock, drive athwartships to a block on the starboard transom
AP_Z, DRV_X, PIV_Y = 0.44, 0.03, -0.60
# bronze clamp arm (per the photo): a hub round the stock and a flat bar aft to the ram's pin
cyl("Tiller arm", (RUD_X, 0, AP_Z - 0.03), (RUD_X, 0, AP_Z + 0.03), 0.055, M_BRONZE, "Steering", verts=20)
box("Tiller arm", ((RUD_X + DRV_X) / 2 - 0.01, 0, AP_Z), (RUD_X - DRV_X + 0.04, 0.065, 0.04), M_BRONZE, "Steering", bevel=0.008)
cyl("Linear drive ram", (DRV_X, 0, AP_Z), (DRV_X, -0.35, AP_Z), 0.014, M_STEEL, "Steering", verts=12)
# Linear drive body and its block are placed after half_breadth() below
box("Rudder sensor", (RUD_X - 0.16, 0.22, 0.40), (0.08, 0.08, 0.05), M_STEER, "Steering", bevel=0.01)
# chartplotter on the pedestal guard
tube("Pedestal guard", [(PED_X + 0.05, 0.16, 1.15), (PED_X + 0.02, 0.17, 1.62), (PED_X + 0.02, -0.17, 1.62),
                        (PED_X + 0.05, -0.16, 1.15)], 0.012, M_STEEL, "Steering", smooth=False)
box("Chartplotter", (PED_X + 0.02, 0, 1.73), (0.05, 0.26, 0.18), M_NAV, "Electronics", bevel=0.01)
box("Chartplotter screen", (PED_X - 0.007, 0, 1.73), (0.01, 0.22, 0.14), M_DARK, "Electronics")
# p70s autopilot control and the Cortex handset either side of the Axiom (sides approximate)
box("Autopilot control (P70S)", (PED_X + 0.02, -0.225, 1.69), (0.035, 0.11, 0.115), M_NAV, "Electronics", bevel=0.008)
box("Autopilot control (P70S)", (PED_X - 0.0, -0.225, 1.69), (0.01, 0.075, 0.06), M_DARK, "Electronics")
box("Cortex handset", (PED_X + 0.02, 0.215, 1.68), (0.04, 0.065, 0.15), M_NAV, "Electronics", bevel=0.012)
box("Cortex handset", (PED_X - 0.002, 0.215, 1.70), (0.01, 0.048, 0.06), M_DARK, "Electronics")

# ---------------------------------------------------------------- electrical (under the cockpit)
for i, sgn in enumerate((1, -1)):
    box(f"House battery {i + 1} (330Ah LiFePO4)", (0.86, sgn * 0.155, 0.02), (0.52, 0.27, 0.24), M_ELEC, "Electrical", bevel=0.015)
    for tx in (0.66, 1.06):
        cyl("Terminal", (tx, sgn * 0.155, 0.14), (tx, sgn * 0.155, 0.17), 0.015, M_STEEL, "Electrical", verts=12)

# Placements from sketch-pad annotations; device sizes are generic, positions approximate.
def half_breadth(x, z):
    s = min(range(NS), key=lambda i: abs(row(i / SEG)[0] - x)) / SEG
    xt, xb, hs, zs, zb, n = row(s)
    if z >= zs:
        return hs
    return hs * max(0.0, 1 - ((zs - z) / (zs - zb)) ** n) ** (1 / n)

def gear(name, x, y, z, dx, dy, dz, m=M_ELEC, margin=0.03, c="Electrical"):
    lim = min(half_breadth(x, z - dz / 2), half_breadth(x, z + dz / 2)) - dy / 2 - margin
    if abs(y) > lim:
        print(f"CLAMP {name}: y {y:+.2f} -> {math.copysign(lim, y):+.2f}")
        y = math.copysign(lim, y)
    return box(name, (x, y, z), (dx, dy, dz), m, c, bevel=0.006)

# linear drive block: a plywood pyramid glassed to the inside face of the transom, starboard side (per the photos).
# The wide base follows the raked transom; the smaller flat top faces forward. An aluminium plate and the drive bracket
# bolt to the top at its outboard end, and the drive pivots on the bracket's pin and runs inboard across the block's face.
def transom_x(z):
    xt, xb, hs, zs, zb, n = row(0)
    return xt + (xb - xt) * (zs - z) / (zs - zb)

BLK_Y, BASE_DY, BASE_DZ, TOP_DY, TOP_DZ, TOP_X = -0.47, 0.18, 0.10, 0.15, 0.075, -0.05
CORNERS = ((-1, -1), (1, -1), (1, 1), (-1, 1))
verts = [(transom_x(AP_Z + sz * BASE_DZ) + 0.004, BLK_Y + sy * BASE_DY, AP_Z + sz * BASE_DZ) for sy, sz in CORNERS]
verts += [(TOP_X, BLK_Y + sy * TOP_DY, AP_Z + sz * TOP_DZ) for sy, sz in CORNERS]
print("BLOCK base x", [f"{v[0]:+.3f}" for v in verts[:4]], f"top {TOP_X:+.3f}")
blk = mesh_obj("Linear drive block", verts, [(3, 2, 1, 0), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)],
               M_STEER, "Steering", smooth=False)
bm = bmesh.new()
bm.from_mesh(blk.data)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(blk.data)
bm.free()
md = blk.modifiers.new("bevel", 'BEVEL')
md.width = 0.012
md.segments = 3
box("Drive bracket", (TOP_X + 0.006, PIV_Y + 0.01, AP_Z + 0.03), (0.012, 0.13, 0.17), M_STEEL, "Steering")
box("Drive bracket", (TOP_X + 0.022, PIV_Y, AP_Z - 0.005), (0.02, 0.09, 0.09), M_SIG, "Steering", bevel=0.006)
box("Drive bracket", ((TOP_X + 0.032 + DRV_X) / 2, PIV_Y, AP_Z), (DRV_X - TOP_X - 0.032, 0.045, 0.045), M_SIG, "Steering", bevel=0.006)
cyl("Drive bracket", (DRV_X, PIV_Y, AP_Z - 0.04), (DRV_X, PIV_Y, AP_Z + 0.04), 0.009, M_STEEL, "Steering", verts=12)
cyl("Linear drive", (DRV_X, -0.35, AP_Z), (DRV_X, PIV_Y + 0.02, AP_Z), 0.05, M_STEER, "Steering")
box("Linear drive", (DRV_X + 0.01, PIV_Y + 0.13, AP_Z + 0.035), (0.10, 0.15, 0.13), M_STEER, "Steering", bevel=0.02)

# start battery on starboard, right beside the house bank
gear("Start battery (Group 24 AGM)", 0.74, -0.395, 0.06, 0.27, 0.17, 0.22)

# starboard cluster on the engine-room forward bulkhead (aft face), seen from aft
BH = 2.62
for nm, y, z, w, h, d in (("MultiPlus inverter/charger", -1.50, 0.82, 0.45, 0.24, 0.13),
                          ("Cerbo GX", -1.43, 1.08, 0.15, 0.08, 0.04),
                          ("BatteryProtect", -1.03, 0.91, 0.10, 0.07, 0.05),
                          ("Battery BMS", -1.08, 0.45, 0.12, 0.10, 0.04),
                          ("Balmar regulator", -1.29, 0.45, 0.10, 0.13, 0.05)):
    gear(nm, BH - d / 2, y, z, d, w, h)

# Raymarine ACU (autopilot drive controller): port side of the same bulkhead, mirroring the MultiPlus
ay = gear("Autopilot ACU", BH - 0.035, 1.20, 0.82, 0.07, 0.28, 0.19, M_STEER, c="Steering").location.y
AX = BH - 0.075
# ACU -> Linear Drive: aft along the port side under the cockpit, across aft of the rudder stock to the drive motor
tube("Drive cable", [(AX, ay - 0.06, 0.73), (2.40, 0.92, 0.50), (1.60, 0.98, 0.46), (0.80, 0.90, 0.42),
                     (0.35, 0.55, 0.52), (0.12, 0.30, 0.57), (0.10, -0.30, 0.57), (DRV_X + 0.03, PIV_Y + 0.15, AP_Z + 0.10)],
     0.009, M_STEER, "Steering")
# ACU -> rudder reference sensor, running alongside the drive cable
tube("Rudder sensor cable", [(AX, ay + 0.06, 0.73), (2.40, 0.96, 0.53), (1.60, 1.02, 0.50), (0.80, 0.94, 0.48),
                             (0.35, 0.55, 0.50), (0.12, 0.31, 0.44), (0.09, 0.26, 0.42)],
     0.006, M_STEER, "Steering")
# ACU -> Axiom: under the cockpit sole to the pedestal, up inside it to the back of the plotter
tube("Autopilot network cable", [(AX, ay - 0.10, 0.91), (2.40, 0.85, 0.59), (1.60, 0.80, 0.59), (1.25, 0.35, 0.59),
                                 (1.08, 0.04, 0.60), (1.05, 0.0, 0.75), (1.05, 0.0, 1.45), (1.08, 0.03, 1.62),
                                 (1.10, 0.04, 1.70)],
     0.006, M_STEER, "Steering")

# shunt, battery switch, busbars and Class T on a support beam just forward of the batteries, under the helm
box("Support beam", (1.16, 0, 0.18), (0.04, 1.10, 0.06), M_BED, "Electrical")
gear("Shunt", 1.115, -0.30, 0.24, 0.05, 0.11, 0.07)
gear("Battery switch", 1.115, -0.12, 0.32, 0.05, 0.11, 0.11)
gear("Busbars / Lynx", 1.115, 0.08, 0.30, 0.05, 0.16, 0.25)
gear("Class T fuse", 1.115, 0.32, 0.26, 0.05, 0.10, 0.08)
gear("Orion DC-DC charger", 0.51, -0.70, 0.40, 0.19, 0.07, 0.13)

# cabin, port side just forward of the bulkhead: GX Touch on the bulkhead, AC/DC panels outboard facing inboard
gear("GX Touch", 2.66, 0.98, 1.00, 0.02, 0.13, 0.09)
# AC and DC panels sit side by side on the nav-panel backing, facing athwartships (inboard, to starboard)
gear("AC panel", 2.86, 1.175, 1.00, 0.14, 0.02, 0.25)
dcp = gear("DC panel", 3.065, 1.175, 1.00, 0.24, 0.02, 0.30).location
# Blue Sea 7748 SafetyHub 150 (6.50 x 5.08 x 1.88 in) mounted directly behind the DC panel
gear("SafetyHub 150 fuse block", 3.065, 1.24, 0.98, 0.165, 0.048, 0.129)

# loads
gear("Fridge (IsoTherm top-loader)", 5.57, 0.91, 0.575, 0.50, 0.45, 0.55, M_LOAD)
# microwave set into the forward galley bulkhead, facing aft, directly above the galley sink
gear("Microwave", 6.45, 0.48, 1.16, 0.28, 0.44, 0.22, M_LOAD)
# on the outboard face of the port cockpit coaming, roughly in line with the cabin portlights (x approximate)
SX, SY, SZ = 1.48, CK_W + 0.04, 1.33
cyl("Shore power inlet", (SX, SY - 0.005, SZ), (SX, SY + 0.03, SZ), 0.06, M_ELEC, "Electrical", verts=32)

# 120 V outlets from an outlets sketch (approximate): four on the inverter, one shore-only in the galley.
# Bulkhead outlets face forward; hull-side ones sit against the hull facing inboard. Runs to them aren't drawn.
OD = (0.03, 0.07, 0.11)
def hull_outlet(name, x, side, z):
    y = side * (min(half_breadth(x, z - OD[2] / 2), half_breadth(x, z + OD[2] / 2)) - OD[0] / 2 - 0.03)
    return box(name, (x, y, z), (OD[1], OD[0], OD[2]), M_ELEC, "Electrical", bevel=0.006)
gear("Inverter outlet", BH + 0.035, 0.98, 0.88, *OD)          # cabin bulkhead, port, just below the GX Touch
gear("Inverter outlet", BH + 0.035, -0.88, 1.02, *OD)         # cabin bulkhead, starboard
hull_outlet("Inverter outlet", 5.15, -1, 0.35)                # head, low on the hull side
hull_outlet("Inverter outlet", 6.20, 1, 1.04)                 # galley, above the counter
hull_outlet("Galley outlet (shore only)", 6.11, 1, 0.96)      # galley, beside it (winter heater)

# cable runs (stylised): DC in teal, AC (120 V) in amber
CR = 0.009
for name, m, pts in (
    ("DC cable", M_CABLE, [(1.12, 0.155, 0.12), (1.115, 0.25, 0.20), (1.10, 0.32, 0.24)]),                       # house + -> Class T
    ("DC cable", M_CABLE, [(1.09, 0.27, 0.26), (1.08, 0.18, 0.30), (1.09, 0.00, 0.30)]),                         # Class T -> busbars
    ("DC cable", M_CABLE, [(1.12, -0.155, 0.12), (1.11, -0.25, 0.20), (1.10, -0.30, 0.22)]),                     # house - -> shunt
    ("DC cable", M_CABLE, [(1.09, 0.08, 0.43), (1.30, -0.65, 0.58), (2.20, -1.15, 0.62), (2.55, -1.40, 0.72)]),  # busbars -> MultiPlus
    ("DC cable", M_CABLE, [(1.60, -0.25, 0.42), (1.95, -0.75, 0.50), (2.57, -1.25, 0.45)]),                      # alternator -> regulator
    ("DC cable", M_CABLE, [(1.09, 0.02, 0.36), (0.88, -0.30, 0.44), (0.62, -0.66, 0.42)]),                       # house busbars -> Orion in
    ("DC cable", M_CABLE, [(0.51, -0.66, 0.36), (0.58, -0.55, 0.28), (0.70, -0.42, 0.20)]),                      # Orion out -> start battery
    ("AC cable", M_ACCABLE, [(SX, SY - 0.02, SZ), (SX, SY - 0.02, 1.17), (1.54, 1.12, 1.02), (1.60, 1.28, 0.95), (2.30, 1.20, 0.92), (2.62, 1.17, 0.80), (2.82, 1.175, 0.885)]),  # shore -> AC panel
    ("AC cable", M_ACCABLE, [(2.85, 1.175, 0.885), (2.72, 1.05, 0.70), (2.58, 0.95, 0.62), (2.58, -0.90, 0.62), (2.55, -1.35, 0.78)]),   # AC panel -> MultiPlus AC in
    ("AC cable", M_ACCABLE, [(2.55, -1.65, 0.80), (2.58, -1.60, 0.50), (2.58, 0.90, 0.50), (2.80, 1.12, 0.72), (2.87, 1.175, 0.885)]),  # MultiPlus AC out -> AC panel
    ("AC cable", M_ACCABLE, [(2.84, 1.175, 0.885), (2.70, 1.05, 0.62), (2.10, 0.88, 0.50), (1.85, 0.80, 0.43)]),     # AC panel -> water heater (shore only)
    ("AC cable", M_ACCABLE, [(2.89, 1.175, 0.885), (3.40, 1.22, 0.70), (5.00, 1.28, 0.62), (6.15, 1.22, 0.95),
                             (6.55, 0.85, 1.14), (6.58, 0.62, 1.16)]),                                             # AC panel -> microwave (inverter)
    ("DC cable", M_CABLE, [(1.09, 0.08, 0.43), (1.80, 1.00, 0.56), (2.70, 1.05, 0.56), (3.00, 1.22, 0.80), (3.02, 1.24, 0.92)]),  # busbars -> SafetyHub
    ("DC cable", M_CABLE, [(3.10, 1.24, 0.92), (3.11, 1.21, 0.86), (3.10, 1.18, 0.87)]),                        # SafetyHub -> DC panel
):
    tube(name, pts, CR, m, "Electrical")

# ---------------------------------------------------------------- ground tackle
WX = 8.45
wz = deck_z(WX)
# Maxwell vertical windlass on the custom composite riser (windlass outline + 1"; height approximate).
# Below deck the gearbox hangs under the gypsy and the motor lies horizontal off its starboard side (locker photo).
WR = 0.045
cyl("Windlass riser", (WX, 0, wz - 0.02), (WX, 0, wz + WR), 0.145, M_RISER, "Tackle", verts=40)
cyl("Windlass riser", (WX - 0.07, 0, wz - 0.02), (WX - 0.07, 0, wz + WR), 0.115, M_RISER, "Tackle", verts=40)
cyl("Windlass base", (WX, 0, wz + WR - 0.005), (WX, 0, wz + WR + 0.05), 0.12, M_TACKLE, "Tackle", verts=32)
cyl("Windlass gypsy", (WX, 0, wz + WR + 0.05), (WX, 0, wz + WR + 0.17), 0.085, M_TACKLE, "Tackle", verts=32)
cyl("Windlass cap", (WX, 0, wz + WR + 0.17), (WX, 0, wz + WR + 0.22), 0.06, M_STEEL, "Tackle", verts=32)
cyl("Windlass motor", (WX, 0, wz - 0.04), (WX, 0, wz - 0.19), 0.055, M_TACKLE, "Tackle")          # gearbox
cyl("Windlass motor", (WX, -0.04, wz - 0.12), (WX, -0.28, wz - 0.12), 0.065, M_TACKLE, "Tackle")  # motor
rz0 = deck_z(9.0)
box("Bow roller", (9.06, 0, rz0 + 0.012), (0.36, 0.11, 0.014), M_STEEL, "Tackle", bevel=0.004)   # base plate
for sy in (-1, 1):
    box("Bow roller", (9.08, sy * 0.05, rz0 + 0.052), (0.40, 0.012, 0.064), M_STEEL, "Tackle", bevel=0.004)  # cheeks
cyl("Bow roller", (9.24, -0.044, rz0 + 0.055), (9.24, 0.044, rz0 + 0.055), 0.03, M_TACKLE, "Tackle", verts=24)

def solid_ob(name, verts, faces, m, cname, smooth=True):
    ob = mesh_obj(name, verts, faces, m, cname, smooth=smooth)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    return ob

def bar(name, pts, w, h, m, cname):
    """Flat bar of w (athwartships) x h swept along points in the y=0 plane."""
    P = [Vector(p) for p in pts]
    vs, fs = [], []
    for k, p in enumerate(P):
        t = (P[min(k + 1, len(P) - 1)] - P[max(k - 1, 0)]).normalized()
        nz = Vector((-t.z, 0, t.x))
        for sy, sn in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            vs.append(tuple(p + Vector((0, sy * w / 2, 0)) + nz * (sn * h / 2)))
    for k in range(len(P) - 1):
        for q in range(4):
            a, b = 4 * k + q, 4 * k + (q + 1) % 4
            fs.append((a, b, b + 4, a + 4))
    fs += [(0, 1, 2, 3), tuple(4 * (len(P) - 1) + q for q in (3, 2, 1, 0))]
    return solid_ob(name, vs, fs, m, cname, smooth=False)

# Ultra-style stainless anchor stowed on the roller: shank along the roller, curving down to a dished,
# pointed fluke that hangs in front of the stem with its toe toward the hull
rz = deck_z(9.0)
ST = rz + 0.108
bar("Anchor", [(8.90, 0, ST), (9.15, 0, ST), (9.29, 0, rz + 0.09), (9.37, 0, rz + 0.03), (9.40, 0, rz - 0.06),
               (9.38, 0, rz - 0.15)], 0.035, 0.045, M_STEEL, "Tackle")
cyl("Anchor", (8.84, 0, ST), (8.91, 0, ST), 0.014, M_STEEL, "Tackle", verts=16)   # swivel
AH, AT = Vector((9.44, 0, rz - 0.05)), Vector((9.22, 0, rz - 0.50))
an = Vector((-0.90, 0, 0.44)).normalized()     # concave side faces aft, toward the shank
NSG, NTG, TH = 14, 12, 0.012
top, bot = [], []
for i in range(NSG + 1):
    s = i / NSG
    w = 0.19 * (1 - s) ** 0.7 * (0.82 + 0.18 * min(1.0, s / 0.15)) + 0.004
    for j in range(NTG + 1):
        t = -1 + 2 * j / NTG
        p = AH + (AT - AH) * s + Vector((0, w * t, 0)) + an * (0.05 * t * t * w / 0.19)
        top.append(tuple(p))
        bot.append(tuple(p - an * TH))
O = len(top)
af = []
for i in range(NSG):
    for j in range(NTG):
        a = i * (NTG + 1) + j
        b = a + NTG + 1
        af.append((a, a + 1, b + 1, b))
        af.append((O + a, O + b, O + b + 1, O + a + 1))
rim = ([i * (NTG + 1) for i in range(NSG + 1)] + [NSG * (NTG + 1) + j for j in range(1, NTG + 1)]
       + [i * (NTG + 1) + NTG for i in range(NSG - 1, -1, -1)] + [j for j in range(NTG - 1, 0, -1)])
for u, v in zip(rim, rim[1:] + rim[:1]):
    af.append((u, v, v + O, u + O))
solid_ob("Anchor", top + bot, af, M_STEEL, "Tackle")
# raised spine down the back (convex side) of the fluke
bar("Anchor", [tuple(AH + (AT - AH) * s - an * (TH + 0.012 * (1 - s))) for s in (0.0, 0.3, 0.6, 0.86)],
    0.028, 0.03, M_STEEL, "Tackle")
cyl("Anchor", tuple(AT + (AH - AT) * 0.14), tuple(AT + (AH - AT) * 0.02), 0.022, M_STEEL, "Tackle", verts=16, r2=0.008)  # weighted toe
tube("Chain", [(8.85, 0, ST), (8.70, 0, wz + WR + 0.22), (WX + 0.08, 0, wz + WR + 0.22)], 0.012, M_STEEL, "Tackle")
tube("Chain", [(WX - 0.08, 0, wz + WR + 0.1), (WX - 0.12, 0, 0.9), (WX - 0.18, 0, 0.45)], 0.012, M_STEEL, "Tackle")

# The original chain hole beside the windlass is reused as a twist-off access port; the Maxwell up/down
# switch is mounted on the locker bulkhead just under its rim (photos from above and below).
DSX, DSY = 8.50, -0.38
dsz = deck_z(DSX, DSY)
cyl("Deck switch", (DSX, DSY, dsz - 0.004), (DSX, DSY, dsz + 0.012), 0.085, M_PORT, "Tackle", verts=32)   # port ring
cyl("Deck switch", (DSX, DSY, dsz + 0.004), (DSX, DSY, dsz + 0.016), 0.066, M_DARK, "Tackle", verts=32)    # lid
SWX, SWZ = DSX + 0.075, dsz - 0.11
box("Deck switch", (SWX, DSY, SWZ), (0.012, 0.05, 0.075), M_TACKLE, "Tackle", bevel=0.004)               # switch plate
cyl("Deck switch", (SWX - 0.006, DSY, SWZ), (SWX - 0.03, DSY, SWZ + 0.008), 0.006, M_DARK, "Tackle", verts=12)  # toggle

# 135 A Maxwell breaker in the port forward cabin; reversing contactor (control unit) in the cabinet just forward of it
gear("Maxwell breaker", 7.10, 1.25, 0.82, 0.12, 0.04, 0.10, M_TACKLE, c="Tackle")
cty = gear("Windlass contactor", 7.48, 1.15, 0.88, 0.09, 0.08, 0.08, M_TACKLE, c="Tackle").location.y
# heavy 1/0 AWG feed: SafetyHub behind the DC panel -> breaker -> contactor -> windlass motor
tube("Windlass cable", [(WX, -0.22, wz - 0.18), (WX - 0.06, 0.05, wz - 0.24), (8.10, 0.60, 0.95), (7.62, cty - 0.06, 0.92), (7.525, cty, 0.89)],
     0.014, M_TCABLE, "Tackle")
tube("Windlass cable", [(7.435, cty, 0.87), (7.30, (cty + 1.22) / 2, 0.85), (7.16, 1.22, 0.82)], 0.014, M_TCABLE, "Tackle")
tube("Windlass cable", [(7.04, 1.22, 0.78), (6.60, 1.25, 0.35), (5.00, 1.32, 0.25), (3.60, 1.30, 0.22), (3.25, 1.27, 0.70),
                        (3.14, 1.245, 0.92)],
     0.014, M_TCABLE, "Tackle")
tube("Windlass control wire", [(SWX + 0.008, DSY, SWZ - 0.03), (SWX, DSY + 0.12, SWZ - 0.06), (8.30, -0.10, 1.05), (7.90, 0.70, 0.98), (7.55, cty - 0.03, 0.91)],
     0.005, M_TCABLE, "Tackle")

# ---------------------------------------------------------------- plumbing (fresh water, hot water)
# IsoTemp water heater in the engine space: AC element plus an engine-coolant loop
box("IsoTemp water heater", (1.80, 0.80, 0.30), (0.45, 0.20, 0.24), M_HEATER, "Plumbing", bevel=0.025)
tube("Engine coolant loop", [(2.10, 0.22, 0.32), (2.08, 0.45, 0.54), (1.95, 0.76, 0.42)], 0.012, M_COOLANT, "Plumbing")
tube("Engine coolant loop", [(1.68, 0.22, 0.28), (1.68, 0.45, 0.52), (1.65, 0.76, 0.42)], 0.012, M_COOLANT, "Plumbing")
# two tanks, both on port: under the settee and under the forward berth
st_t = gear("Water tank (settee)", 3.65, 0.95, 0.06, 1.10, 0.42, 0.30, M_TANK, c="Plumbing").location
fw_t = gear("Water tank (forward berth)", 7.10, 0.45, 0.12, 0.70, 0.50, 0.28, M_TANK, c="Plumbing").location
# inspection ports cut into each tank top so they could be cleaned; level sensors beside them (N2K, see electronics)
TANK_TOPS = ((3.40, 3.88, st_t.y, 0.06 + 0.15), (7.24, 6.94, fw_t.y, 0.12 + 0.14))
for px, sx, ty, tz in TANK_TOPS:
    cyl("Inspection port", (px, ty, tz - 0.002), (px, ty, tz + 0.014), 0.085, M_PLUMB, "Plumbing", verts=32)
    cyl("Inspection port", (px, ty, tz + 0.014), (px, ty, tz + 0.024), 0.05, M_PLUMB, "Plumbing", verts=24)
# shut-off valves under the sole by the head door; filter housing and pressure pump in a cabinet behind the toilet
box("Shut-off valves", (4.75, -0.30, -0.24), (0.10, 0.14, 0.06), M_PLUMB, "Plumbing", bevel=0.01)
ym = -(half_breadth(5.15, 0.30) - 0.09)
cyl("Water filter", (5.06, ym, 0.26), (5.06, ym, 0.50), 0.055, M_PLUMB, "Plumbing")
box("Pressure pump", (5.24, ym, 0.40), (0.20, 0.10, 0.11), M_PLUMB, "Plumbing", bevel=0.015)
# fixtures: galley sink sits under the microwave at the forward, inboard corner of the galley
GFX, GFY = 6.30, 0.62
for nm, x, y, dx, dy in (("Galley faucet", GFX, GFY, -0.11, 0.0), ("Head faucet", 4.85, -1.02, 0.0, 0.11)):
    cyl(nm, (x, y, 0.87), (x, y, 0.98), 0.016, M_STEEL, "Plumbing", verts=16)
    cyl(nm, (x, y, 0.97), (x + dx, y + dy, 0.95), 0.009, M_STEEL, "Plumbing", verts=12)
MPX, MPY = 6.00, 0.62
box("Manual pump", (MPX, MPY, -0.08), (0.10, 0.10, 0.08), M_PLUMB, "Plumbing", bevel=0.01)
# Acuva Arrow UV filter in the cabinet under the galley sink, on the cold feed to the galley faucet
AQX, AQY = 6.05, 0.82
box("Acuva UV filter", (AQX, AQY, 0.53), (0.08, 0.07, 0.26), M_PLUMB, "Plumbing", bevel=0.012)
box("Acuva UV filter", (AQX - 0.041, AQY, 0.60), (0.004, 0.04, 0.05), M_DARK, "Plumbing")
# head shower (hot + cold) on the starboard side of the head, forward of the toilet
SHX, SHY = 5.85, -1.10
box("Shower", (SHX, SHY, 1.00), (0.07, 0.05, 0.10), M_STEEL, "Plumbing", bevel=0.01)
cyl("Shower", (SHX, SHY, 1.05), (SHX, SHY, 1.40), 0.010, M_STEEL, "Plumbing", verts=12)
cyl("Shower", (SHX, SHY, 1.40), (SHX, SHY + 0.12, 1.36), 0.012, M_STEEL, "Plumbing", verts=16, r2=0.035)
# transom shower: cold-only deck fitting, centre-port, just forward of the transom
TSX, TSY = -0.06, 0.35
TSZ = deck_z(TSX, TSY)
cyl("Transom shower", (TSX, TSY, TSZ - 0.005), (TSX, TSY, TSZ + 0.025), 0.055, M_STEEL, "Plumbing", verts=24)
cyl("Transom shower", (TSX, TSY, TSZ + 0.025), (TSX, TSY, TSZ + 0.09), 0.018, M_STEEL, "Plumbing", verts=16)

WR = 0.010
JC = (5.05, 0.30, -0.22)
for name, m, pts in (
    ("Suction line", M_COLD, [(4.22, 0.76, -0.06), (4.45, 0.40, -0.24), (4.70, -0.24, -0.24)]),
    ("Suction line", M_COLD, [(6.74, 0.30, 0.00), (6.30, 0.10, -0.22), (5.20, -0.15, -0.26), (4.80, -0.24, -0.24)]),
    ("Suction line", M_COLD, [(4.78, -0.36, -0.24), (4.90, -0.70, -0.18), (5.00, -1.15, 0.05), (5.06, ym, 0.28)]),
    ("Suction line", M_COLD, [(5.06, ym, 0.50), (5.10, ym, 0.54), (5.14, ym, 0.43)]),
    ("Suction line", M_COLD, [(4.80, -0.36, -0.26), (5.30, 0.10, -0.27), (5.80, 0.55, -0.20), (MPX - 0.04, MPY, -0.08)]),  # valves -> manual pump
    ("Cold water line", M_COLD, [(MPX + 0.04, MPY, -0.06), (6.15, MPY - 0.02, 0.40), (GFX - 0.03, GFY, 0.87)]),             # manual pump -> galley
    ("Cold water line", M_COLD, [(5.35, ym, 0.42), (5.30, ym + 0.20, 0.70), (4.95, -1.15, 0.82), (4.83, -1.03, 0.87)]),
    ("Cold water line", M_COLD, [(5.35, ym + 0.02, 0.38), (5.40, -1.10, 0.05), (5.25, -0.45, -0.22), JC]),
    ("Cold water line", M_COLD, [JC, (5.70, 0.45, -0.22), (6.00, 0.74, 0.10), (AQX, AQY, 0.39)]),            # -> Acuva
    ("Cold water line", M_COLD, [(AQX, AQY, 0.67), (6.22, 0.66, 0.78), (GFX, GFY - 0.03, 0.87)]),           # Acuva -> galley
    ("Cold water line", M_COLD, [JC, (4.00, 0.45, -0.22), (2.70, 0.62, -0.10), (2.15, 0.72, 0.18), (2.03, 0.73, 0.24)]),
    ("Hot water line", M_HOT, [(2.03, 0.80, 0.38), (2.22, 0.86, 0.28), (2.70, 0.70, -0.04), (4.00, 0.53, -0.16),
                               (4.95, 0.42, -0.16), (5.75, 0.52, -0.16), (6.25, 0.68, 0.25), (GFX, GFY + 0.03, 0.87)]),
    ("Hot water line", M_HOT, [(4.95, 0.42, -0.16), (4.62, 0.00, -0.17), (4.62, -0.60, -0.10), (4.80, -0.98, 0.25),
                               (4.86, -1.10, 0.70), (4.87, -1.03, 0.87)]),
    # shower feeds: hot branches off the head-sink run, cold off the pump outlet
    ("Hot water line", M_HOT, [(4.80, -0.98, 0.25), (5.05, -1.28, 0.18), (5.55, -1.28, 0.40), (5.82, -1.14, 0.85),
                               (SHX + 0.02, SHY - 0.01, 0.96)]),
    ("Cold water line", M_COLD, [(5.36, ym + 0.03, 0.46), (5.60, -1.36, 0.72), (5.80, -1.16, 0.90), (SHX - 0.02, SHY - 0.01, 0.96)]),
    # transom shower: tee off the cold feed into the IsoTemp, aft under the port cockpit seat, up under the aft deck
    ("Cold water line", M_COLD, [(2.15, 0.72, 0.18), (1.85, 0.98, 0.06), (1.20, 1.08, 0.30), (0.55, 1.08, 0.50),
                                 (0.25, 0.95, 0.85), (0.06, 0.58, 1.02), (TSX, TSY, TSZ - 0.01)]),
):
    tube(name, pts, WR, m, "Plumbing")

# ---------------------------------------------------------------- electronics (Raymarine + NMEA 2000)
# Positions from notes and a network sketch; anything marked ~ is approximate. Cable routes are stylised.
# iTC-5 on the port engine-room bulkhead, below the autopilot ACU (location unconfirmed). The NMEA 2000 hubs and tees
# aren't drawn (an implementation detail); the drop cables just meet at the backbone.
gear("iTC-5 converter", BH - 0.025, 0.80, 0.82, 0.05, 0.15, 0.11, M_NAV, c="Electronics")
# three i70s stacked vertically on the starboard side of the cabin bulkhead, facing the cockpit (~)
I70_Y, I70_Z = -0.60, (1.55, 1.42, 1.29)
for z in I70_Z:
    box("i70s display", (CB_X0 - 0.012, I70_Y, z), (0.025, 0.11, 0.115), M_NAV, "Electronics", bevel=0.008)
    box("i70s display", (CB_X0 - 0.026, I70_Y, z + 0.005), (0.004, 0.085, 0.07), M_DARK, "Electronics")
# Fusion stereo beside the GX Touch; Cortex M1 hub and Pepwave router in the wet locker (~)
gear("Fusion stereo", 2.66, 0.80, 1.00, 0.03, 0.16, 0.075, M_NAV, c="Electronics")
gear("Cortex M1", 2.76, 0.62, 0.64, 0.14, 0.19, 0.05, M_NAV, c="Electronics")
gear("Pepwave router", 2.76, 0.62, 0.74, 0.11, 0.15, 0.035, M_NAV, c="Electronics")
# EV-1 heading sensor in the bilge under the floorboards (~)
EVX, EVY = 4.10, -0.15
cyl("EV-1 core pack", (EVX, EVY, -0.29), (EVX, EVY, -0.23), 0.075, M_NAV, "Electronics", verts=32)
# tank level sensors beside the inspection ports; round tank gauge in the DC panel
for px, sx, ty, tz in TANK_TOPS:
    cyl("Tank level sensor", (sx, ty, tz - 0.002), (sx, ty, tz + 0.032), 0.045, M_NAV, "Electronics", verts=24)
GX, GZ, GY = 3.13, 0.90, dcp.y - 0.01
cyl("Tank gauge", (GX, GY + 0.004, GZ), (GX, GY - 0.018, GZ), 0.042, M_NAV, "Electronics", verts=32)
cyl("Tank gauge", (GX, GY - 0.018, GZ), (GX, GY - 0.021, GZ), 0.033, M_DARK, "Electronics", verts=32)
# through-hull transducers just forward of the keel (owner's manual): depth on the centreline, speed slightly to port
for nm, x, y in (("Depth transducer", 5.75, 0.0), ("Speed transducer", 5.88, 0.09)):
    zb = hull_z_at(x)
    cyl(nm, (x, y, zb - 0.025), (x, y, zb + 0.12), 0.034, M_NAV, "Electronics", verts=24)
    cyl(nm, (x, y, zb + 0.12), (x, y, zb + 0.15), 0.05, M_NAV, "Electronics", verts=24)
# radar about halfway up the mast, on the forward face; wind transducer at the masthead
RZ = rig_z(8.3)
mr = 0.15 + (0.075 - 0.15) * (RZ - RIG_Z0) / (MAST_TOP - RIG_Z0)
box("Radar", (MAST_X + mr + 0.05, 0, RZ - 0.06), (0.12, 0.10, 0.03), M_NAV, "Electronics")
cyl("Radar", (MAST_X + mr + 0.27, 0, RZ - 0.05), (MAST_X + mr + 0.27, 0, RZ + 0.18), 0.26, M_NAV, "Electronics", verts=40)
WZ = MAST_TOP
cyl("Wind transducer", (MAST_X, 0, WZ - 0.02), (MAST_X, 0, WZ + 0.12), 0.02, M_NAV, "Electronics", verts=12)
cyl("Wind transducer", (MAST_X, 0, WZ + 0.10), (MAST_X + 0.55, 0, WZ + 0.10), 0.012, M_NAV, "Electronics", verts=12)
cyl("Wind transducer", (MAST_X + 0.55, 0, WZ + 0.06), (MAST_X + 0.55, 0, WZ + 0.20), 0.012, M_NAV, "Electronics", verts=12)
box("Wind transducer", (MAST_X + 0.50, 0, WZ + 0.20), (0.14, 0.008, 0.07), M_NAV, "Electronics")
for k in range(3):
    a = k * 2 * math.pi / 3
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.03, segments=12, ring_count=6,
                                         location=(MAST_X + 0.55 + 0.06 * math.cos(a), 0.06 * math.sin(a), WZ + 0.06))
    cup = bpy.context.active_object
    cup.name = "Wind transducer"
    cup.data.materials.append(M_NAV)
    place(cup, "Electronics")

HUB = (BH - 0.045, 1.05, 0.585)
MAST_FOOT = [(MAST_X + 0.0, 0.03, 0.10), (7.40, 0.16, -0.10), (6.0, 0.22, -0.24), (4.40, 0.22, -0.25), (3.20, 0.42, -0.18)]
N2 = 0.008
for name, m, pts in (
    # backbone: hubs -> under the cockpit sole -> up the pedestal to the Axiom
    ("NMEA 2000 cable", M_N2K, [HUB, (2.40, 0.78, 0.56), (1.60, 0.70, 0.56), (1.25, 0.28, 0.57), (1.08, 0.07, 0.60),
                               (1.065, 0.035, 0.80), (1.065, 0.035, 1.44), (1.095, 0.06, 1.62), (1.10, 0.06, 1.66)]),
    ("NMEA 2000 cable", M_N2K, [(1.10, -0.04, 1.68), (1.10, -0.14, 1.64), (1.06, -0.225, 1.66)]),         # -> p70s
    # across the bulkhead to the Cerbo GX (starboard), with a spur up to the i70s
    ("NMEA 2000 cable", M_N2K, [HUB, (2.585, 0.40, 0.60), (2.585, -0.80, 0.60), (2.585, -1.25, 0.92), (BH - 0.04, -1.40, 1.03)]),
    ("NMEA 2000 cable", M_N2K, [(2.585, -1.10, 0.76), (2.70, -0.90, 1.10), (2.665, I70_Y - 0.03, I70_Z[2]), (2.66, I70_Y, I70_Z[2])]),
    ("NMEA 2000 cable", M_N2K, [(2.66, I70_Y, I70_Z[2]), (2.66, I70_Y, I70_Z[0])]),                        # i70s daisy chain
    ("NMEA 2000 cable", M_N2K, [(BH - 0.04, 1.17, 0.61), (2.57, 1.17, 0.68), (BH - 0.07, 1.17, 0.73)]),   # -> ACU
    ("NMEA 2000 cable", M_N2K, [(BH - 0.045, 0.93, 0.61), (2.66, 0.86, 0.80), (2.665, 0.80, 0.96)]),      # -> Fusion
    ("NMEA 2000 cable", M_N2K, [(BH - 0.045, 0.90, 0.57), (2.70, 0.74, 0.60), (2.76, 0.62, 0.615)]),      # -> Cortex M1
    ("NMEA 2000 cable", M_N2K, [(BH - 0.045, 0.82, 0.77), (BH - 0.045, 0.82, 0.68), (BH - 0.045, 0.95, 0.61)]),  # -> iTC-5
    # forward along the port side to both tank sensors, with a spur up to the gauge in the DC panel
    ("NMEA 2000 cable", M_N2K, [(BH - 0.045, 1.20, 0.56), (2.78, 1.12, 0.30), (3.30, TANK_TOPS[0][2] + 0.10, 0.24),
                               (TANK_TOPS[0][1], TANK_TOPS[0][2], TANK_TOPS[0][3] + 0.03)]),
    ("NMEA 2000 cable", M_N2K, [(3.20, 1.07, 0.27), (3.15, dcp.y - 0.04, 0.60), (GX, GY + 0.004, GZ)]),
    ("NMEA 2000 cable", M_N2K, [(TANK_TOPS[0][1], TANK_TOPS[0][2], TANK_TOPS[0][3] + 0.03), (4.30, 1.22, 0.25), (5.00, 1.26, 0.22),
                               (6.55, 1.12, 0.26), (6.85, TANK_TOPS[1][2] + 0.10, 0.30),
                               (TANK_TOPS[1][1], TANK_TOPS[1][2], TANK_TOPS[1][3] + 0.03)]),
    # down the bulkhead and forward under the sole to the EV-1
    ("NMEA 2000 cable", M_N2K, [(BH - 0.045, 0.98, 0.56), (2.68, 0.36, -0.04), (3.40, 0.05, -0.21), (EVX, EVY, -0.23)]),
    # analog transducer cables to the iTC-5: wind down the mast, depth and speed from the through-hulls
    ("Transducer cable", M_SIG, [(MAST_X, 0.0, WZ - 0.02), (MAST_X, 0.0, 0.40)] + MAST_FOOT + [(2.75, 0.72, 0.40), (BH - 0.05, 0.80, 0.78)]),
    ("Transducer cable", M_SIG, [(5.75, 0.0, hull_z_at(5.75) + 0.15), (5.60, 0.12, -0.24), (4.40, 0.25, -0.26)]),
    ("Transducer cable", M_SIG, [(5.88, 0.09, hull_z_at(5.88) + 0.15), (5.65, 0.16, -0.24), (4.40, 0.26, -0.26)]),
    # radar: down the mast and aft to the Axiom (route stylised)
    ("Radar cable", M_SIG, [(MAST_X + mr + 0.05, 0.0, RZ - 0.08), (MAST_X + 0.02, 0.03, RZ - 0.20), (MAST_X + 0.02, 0.03, 0.40)]
     + [(x, y + 0.04, z) for x, y, z in MAST_FOOT] + [(2.75, 0.68, 0.42), (2.40, 0.74, 0.54), (1.60, 0.66, 0.54),
                                                      (1.25, 0.24, 0.55), (1.08, 0.04, 0.60), (1.05, 0.01, 0.80),
                                                      (1.05, 0.01, 1.44), (1.09, 0.03, 1.62), (1.10, 0.03, 1.66)]),
):
    tube(name, pts, N2, m, "Electronics")

# ---------------------------------------------------------------- swim platform (full transom width, from the photos)
# two slotted panels side by side with a stainless seam, a stainless rail around the aft edge and ends,
# arms down from the transom at each end and struts underneath (mount details stylised)
SPZ, SPX0, SPX1, SPH = 0.30, -0.14, -0.60, 1.00
spd = SPX0 - SPX1
for sgn in (1, -1):
    box("Swim platform", ((SPX0 + SPX1) / 2, sgn * (SPH / 2), SPZ - 0.018), (spd, SPH - 0.02, 0.036), M_SWIM, "Hull", bevel=0.008)
    for k in range(1, 5):
        gx = SPX0 - spd * k / 5
        for y0, y1 in ((0.42, 0.90), (0.10, 0.30)):
            box("Swim platform", (gx, sgn * (y0 + y1) / 2, SPZ + 0.0005), (0.016, y1 - y0, 0.003), M_SLOT, "Hull")
    box("Swim platform", (-0.165, sgn * 0.90, SPZ + 0.20), (0.02, 0.07, 0.14), M_STEEL, "Hull")
    cyl("Swim platform", (-0.175, sgn * 0.90, SPZ + 0.16), (-0.30, sgn * 0.97, SPZ + 0.005), 0.010, M_STEEL, "Hull", verts=12)
    cyl("Swim platform", (-0.135, sgn * 0.50, 0.14), (-0.46, sgn * 0.50, SPZ - 0.04), 0.012, M_STEEL, "Hull", verts=12)
    box("Swim platform", (-0.14, sgn * 0.50, 0.14), (0.02, 0.06, 0.08), M_STEEL, "Hull")
box("Swim platform", ((SPX0 + SPX1) / 2, 0, SPZ - 0.016), (spd, 0.024, 0.04), M_STEEL, "Hull")
RR = 0.07
arc = lambda cx, cy, a0: [(cx + RR * math.cos(math.radians(a0 + t)), cy + RR * math.sin(math.radians(a0 + t)), SPZ - 0.012)
                          for t in (0, 30, 60, 90)]
tube("Swim platform", [(SPX0, SPH, SPZ - 0.012)] + arc(SPX1 + RR, SPH - RR, 90) + arc(SPX1 + RR, -SPH + RR, 180)
     + [(SPX0, -SPH, SPZ - 0.012)], 0.014, M_STEEL, "Hull", smooth=False)

# ---------------------------------------------------------------- interior context (generic, for orientation only)
s7 = section_pts(4)
mesh_obj("Engine-room bulkhead", s7 + [(s7[0][0], 0.0, s7[0][2])], [tuple(range(NV + 2))], M_INT, "Interior",
         mirror=True, smooth=False)
box("Cabin sole", (4.55, 0, -0.14), (3.80, 1.00, 0.03), M_INT, "Interior")
box("Galley counter", (5.41, 0.83, 0.875), (1.90, 0.70, 0.04), M_INT, "Interior")
box("Galley range", (4.80, 0.88, 0.90), (0.42, 0.36, 0.03), M_STEEL, "Interior")
box("Galley sink", (6.17, GFY, 0.86), (0.26, 0.26, 0.05), M_STEEL, "Interior")
box("Port settee", (3.55, 0.92, 0.28), (1.75, 0.55, 0.06), M_INT, "Interior")
box("Forward berth", (7.10, 0.42, 0.32), (0.90, 0.84, 0.06), M_INT, "Interior")
box("Head vanity", (4.85, -0.82, 0.85), (0.45, 0.50, 0.04), M_INT, "Interior")
box("Toilet", (5.25, -0.95, 0.12), (0.40, 0.34, 0.36), M_INT, "Interior", bevel=0.05)
box("Microwave shelf", (6.45, 0.48, 1.04), (0.32, 0.50, 0.02), M_INT, "Interior")
box("Nav panel backing", (2.98, 1.20, 1.00), (0.42, 0.02, 0.40), M_INT, "Interior")

# ---------------------------------------------------------------- finalize: curves -> meshes, apply nothing destructive
dg = bpy.context.evaluated_depsgraph_get()
for ob in [o for o in bpy.data.objects if o.type == 'CURVE']:
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    nob = bpy.data.objects.new(ob.name, me)
    for c in ob.users_collection:
        c.objects.link(nob)
    bpy.data.objects.remove(ob)
    for p in me.polygons:
        p.use_smooth = True

# tag every object with stable ids so the web viewer can toggle/x-ray by system and look parts up in
# _data/hardware/parts.yml; "Name.001" copies share their base name's part id
def slug(s):
    return "-".join("".join(ch if ch.isalnum() else " " for ch in s.lower()).split())

for c in bpy.data.collections:
    for ob in c.objects:
        base = ob.name.split(".")[0] if ob.name[-4:-3] == "." and ob.name[-3:].isdigit() else ob.name
        ob["system"] = slug(c.name)
        ob["part"] = slug(base)
# ---------------------------------------------------------------- world, lights, cameras
world = bpy.data.worlds.new("World")
scene.world = world
try: world.use_nodes = True
except Exception: pass
bg = world.node_tree.nodes.get("Background")
bg.inputs[0].default_value = (*lin("#AEB8C6"), 1)
bg.inputs[1].default_value = 0.9

def light(name, kind, loc, rot, energy, size=None):
    ld = bpy.data.lights.new(name, kind)
    ld.energy = energy
    if size and kind == 'AREA':
        ld.size = size
    if kind == 'SUN':
        ld.angle = math.radians(4)
    lo = bpy.data.objects.new(name, ld)
    lo.location = loc
    lo.rotation_euler = [math.radians(a) for a in rot]
    scene.collection.objects.link(lo)
    return lo

light("Sun", 'SUN', (0, 0, 20), (48, 0, 125), 3.2)
light("Fill", 'AREA', (6, -10, 6), (60, 0, -20), 1500, size=8)

def camera(name, loc, target, lens=35, ortho=None):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.clip_end = 500
    if ortho:
        cd.type = 'ORTHO'
        cd.ortho_scale = ortho
    co = bpy.data.objects.new(name, cd)
    co.location = loc
    scene.collection.objects.link(co)
    d = Vector(target) - Vector(loc)
    co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return co

for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
    try:
        scene.render.engine = eng
        break
    except Exception:
        pass
try: scene.eevee.taa_render_samples = 64
except Exception: pass
scene.render.resolution_x, scene.render.resolution_y = 1600, 1000
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'

XRAY = [M_TOP, M_BOOT, M_BOTTOM, M_TRANSOM, M_DECK, M_CABIN, M_WELL, M_KEEL, M_DARK, M_STRIPE, M_FRAME, M_TEAK]

def shot(name, cam, xray=False, rig=True, sail=True):
    scene.camera = cam
    for m in XRAY:
        set_alpha(m, 0.13 if xray else 1.0)
    set_alpha(M_INT, 0.30 if xray else 1.0)
    coll("Rig").hide_render = not rig
    coll("Sail").hide_render = not sail
    scene.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", scene.render.filepath)

cams = {
    "hero": camera("cam_hero", (16.0, -13.2, 4.2), (4.6, 0, 3.4), lens=30),
    "hull": camera("cam_hull", (12.5, -9.5, 4.2), (4.2, 0, 0.4), lens=35),
    "xray_side": camera("cam_side", (4.4, -30, 0.25), (4.4, 0, 0.25), ortho=10.6),
    "xray_aft": camera("cam_aft", (5.6, -5.4, 3.0), (1.45, 0, 0.15), lens=32),
    "xray_elec": camera("cam_elec", (-1.6, -3.2, 2.6), (1.9, -0.35, 0.5), lens=30),
}

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "nonsuch30.blend"))
if RENDER:
    SHOTS = ("hero", "hull", "xray_side", "xray_aft", "xray_elec")
    which = [a for a in ARGS if a in SHOTS] or list(SHOTS)
    for w in which:
        if w == "hero": shot("hero", cams["hero"])
        if w == "hull": shot("hull", cams["hull"], sail=False)
        if w == "xray_side": shot("xray_side", cams["xray_side"], xray=True, rig=False, sail=False)
        if w == "xray_aft": shot("xray_aft", cams["xray_aft"], xray=True, rig=False, sail=False)
        if w == "xray_elec": shot("xray_elec", cams["xray_elec"], xray=True, rig=False, sail=False)

for m in XRAY:
    set_alpha(m, 1.0)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "nonsuch30.glb"), export_format='GLB', export_apply=True,
                          use_visible=False, export_cameras=False, export_lights=False, export_extras=True)
print("DONE")
