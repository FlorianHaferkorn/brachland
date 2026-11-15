"""
BRACHLAND — Flussvater in hoher Qualität (D284, Stufe „Ultra“, ADR-0016)

  npx tsx tools/flussvater/palette.ts > .cache/flussvater/palette.json
  blender -b -P tools/flussvater/bau.py

Dieselbe Anatomie wie `tools/welsbau.ts` (Querschnitt, Schwung, Barteln, Flossen, Rohre, Pilze — Story-Bibel §5:
Riesenwels × Kläranlagen-Organik), aber als Netz mit echten UV statt 1.440 flach schattierter Ecken:
Rumpf-Loft 180 × 96, Augen, Maulspalte, verjüngte Barteln, Flossen mit Strahlen. Die Haut entsteht als
prozedurales Material (Rücken dunkel marmoriert, helle Bauchseite, Seitenlinie, Poren, Querfalten, nasse
Rauheit) und wird je Teil in Karten gebacken (Farbe, Rauheit, Normale). Ausgabe `public/ultra/flussvater.glb`
(WebP-Texturen), Länge 1,6, Bauch auf y = 0, Nase nach −Z — wie die bisherige Datei, die Szene skaliert gleich.
Farben aus `src/world/palette.ts` (über `palette.json`), Saat fest.
"""
import bpy, bmesh, json, math, os, random
from mathutils import Vector

WURZEL = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PAL = json.load(open(os.path.join(WURZEL, '.cache/flussvater/palette.json')))
W, BEF = PAL['wels'], PAL['befall']
AUS = os.path.join(WURZEL, 'public/ultra/flussvater.glb')
KARTEN = os.path.join(WURZEL, '.cache/flussvater/karten')
os.makedirs(os.path.dirname(AUS), exist_ok=True); os.makedirs(KARTEN, exist_ok=True)
L = 1.6
rnd = random.Random(7341)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 4
sc.render.bake.margin = 8

def hexf(h, f=1.0):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) / 255 * f for i in (0, 2, 4)) + (1.0,)

def P(x, y, z):
    """three-Raum (y oben, Nase −z) → Blender (z oben); der glTF-Export dreht zurück."""
    return Vector((x, -z, y))

# ------------------------------------------------------------------ Anatomie (wie welsbau.ts)
def querschnitt(t):
    b = (0.32 * (0.55 + 0.45 * math.sin((t / 0.16) * math.pi / 2)) if t < 0.16
         else 0.32 - (t - 0.16) * 0.2 if t < 0.42
         else 0.268 * max(0, 1 - (t - 0.42) / 0.58) ** 1.25 + 0.025)
    h = (0.15 + (t / 0.35) * 0.13 if t < 0.35 else 0.28 * max(0, 1 - (t - 0.35) / 0.65) ** 0.9 + 0.05)
    return b, h

schwung = lambda t: math.sin(t * math.pi * 1.4) * 0.035 * t
zBei = lambda t: -L / 2 + t * L * 0.86

def netz(name, verts, faces, uvs):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    uvl = me.uv_layers.new(name='UV')
    for poly in me.polygons:
        for li, vi in zip(poly.loop_indices, poly.vertices): uvl.data[li].uv = uvs[vi]
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob)
    for p in me.polygons: p.use_smooth = True
    return ob

def rumpf():
    S, R = 180, 96
    verts, uvs, faces = [], [], []
    for s in range(S + 1):
        t = s / S; b, h = querschnitt(t); z = zBei(t); cy = h / 2 + 0.01
        for k in range(R + 1):
            a = (k / R) * 2 * math.pi; sx, sy = math.cos(a), math.sin(a)
            qx = math.copysign(abs(sx) ** 0.8, sx); qy = math.copysign(abs(sy) ** 0.9, sy) * (0.75 if sy < 0 else 1)
            x, y = qx * b / 2 + schwung(t), cy + qy * h / 2
            # Maulspalte: breite Kerbe vorn auf Höhe der Lippe (oben ~ 0,38), läuft bis t ≈ 0,07 aus.
            oben = (y - 0.01) / max(0.01, h)
            if t < 0.09:
                kerbe = math.exp(-((oben - 0.36) / 0.035) ** 2) * (1 - t / 0.09) * 0.016
                x -= math.copysign(kerbe * abs(sx), sx); y -= kerbe * 0.3
            verts.append(P(x, y, z)); uvs.append((k / R, t))
    for s in range(S):
        for k in range(R):
            a = s * (R + 1) + k; faces.append((a, a + 1, a + R + 2, a + R + 1))
    # Nase und Schwanzende als Fächer
    n0 = len(verts); verts.append(P(schwung(0), 0.085, -L / 2 - 0.03)); uvs.append((0.5, 0.0))
    for k in range(R): faces.append((n0, k + 1, k))
    e = S * (R + 1); n1 = len(verts)
    b, h = querschnitt(1); verts.append(P(schwung(1), h / 2 + 0.01, zBei(1))); uvs.append((0.5, 1.0))
    for k in range(R): faces.append((n1, e + k, e + k + 1))
    ob = netz('Rumpf', verts, faces, uvs)
    bm = bmesh.new(); bm.from_mesh(ob.data); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6); bm.to_mesh(ob.data); bm.free()
    return ob

def flaechenpunkt(t, winkel, aussen=0.0):
    b, h = querschnitt(t); cy = h / 2 + 0.01; sx, sy = math.cos(winkel), math.sin(winkel)
    qx = math.copysign(abs(sx) ** 0.8, sx); qy = math.copysign(abs(sy) ** 0.9, sy) * (0.75 if sy < 0 else 1)
    return (qx * (b / 2 + aussen) + schwung(t), cy + qy * (h / 2 + aussen), zBei(t))

def roehre(name, punkte, r0, r1, seiten=12, schritte=40):
    """Verjüngte Röhre entlang einer Catmull-Rom-Kurve (three-Raum), UV: u um die Röhre, v entlang."""
    pts = [Vector(p) for p in punkte]
    def kurve(t):
        n = len(pts) - 1; f = min(n - 1e-6, t * n); i = int(f); u = f - i
        p0, p1, p2, p3 = pts[max(0, i - 1)], pts[i], pts[i + 1], pts[min(n, i + 2)]
        return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3)
    verts, uvs, faces = [], [], []
    vorher = None
    for s in range(schritte + 1):
        t = s / schritte; c = kurve(t); tan = (kurve(min(1, t + 0.01)) - kurve(max(0, t - 0.01))).normalized()
        ref = Vector((0, 1, 0)) if abs(tan.y) < 0.9 else Vector((1, 0, 0))
        n1 = tan.cross(ref).normalized() if vorher is None else (vorher - tan * vorher.dot(tan)).normalized()
        vorher = n1; n2 = tan.cross(n1)
        r = r0 + (r1 - r0) * t
        for k in range(seiten + 1):
            a = k / seiten * 2 * math.pi; q = c + (n1 * math.cos(a) + n2 * math.sin(a)) * r
            verts.append(P(*q)); uvs.append((k / seiten, t))
    for s in range(schritte):
        for k in range(seiten):
            a = s * (seiten + 1) + k; faces.append((a, a + seiten + 1, a + seiten + 2, a + 1))
    return netz(name, verts, faces, uvs)

def flosse(name, wurzel, spitzen, unterteilung=10):
    """Fächer: Wurzelpunkte und Spitzen (three-Raum) zu einem Gitter; dünn verdickt, UV u längs der Wurzel."""
    zeilen = []
    n = len(spitzen)
    rand = [Vector(spitzen[0])]
    for i in range(n): rand.append(Vector(spitzen[i]))
    rand.append(Vector(spitzen[-1]))
    wz = [Vector(p) for p in wurzel]
    m = len(wz)
    # Rand auf m Punkte nachrechnen (gleichmässig)
    rand_m = [rand[min(len(rand) - 1, round(i / (m - 1) * (len(rand) - 1)))] for i in range(m)]
    verts, uvs, faces = [], [], []
    for j in range(unterteilung + 1):
        v = j / unterteilung
        for i in range(m):
            q = wz[i].lerp(rand_m[i], v); verts.append(P(*q)); uvs.append((i / (m - 1), v))
    for j in range(unterteilung):
        for i in range(m - 1):
            a = j * m + i; faces.append((a, a + 1, a + m + 1, a + m))
    ob = netz(name, verts, faces, uvs)
    mod = ob.modifiers.new('Dicke', 'SOLIDIFY'); mod.thickness = 0.003; mod.offset = 0
    return ob

# ------------------------------------------------------------------ Material-Bausteine
def knoten(mat):
    mat.use_nodes = True; nt = mat.node_tree; nt.nodes.clear(); return nt, nt.nodes, nt.links

def bsdf_mit(nt, ns, ln, farbe, rau, metall=0.0, hoehe=None, staerke=0.3):
    out = ns.new('ShaderNodeOutputMaterial'); b = ns.new('ShaderNodeBsdfPrincipled')
    ln.new(farbe, b.inputs['Base Color'])
    if isinstance(rau, float): b.inputs['Roughness'].default_value = rau
    else: ln.new(rau, b.inputs['Roughness'])
    b.inputs['Metallic'].default_value = metall
    if hoehe is not None:
        bump = ns.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = staerke; bump.inputs['Distance'].default_value = 0.002
        ln.new(hoehe, bump.inputs['Height']); ln.new(bump.outputs['Normal'], b.inputs['Normal'])
    ln.new(b.outputs['BSDF'], out.inputs['Surface'])
    return b

def rampe(ns, ln, eingang, stops):
    r = ns.new('ShaderNodeValToRGB'); el = r.color_ramp.elements
    el[0].position, el[0].color = stops[0]; el[1].position, el[1].color = stops[-1]
    for pos, col in stops[1:-1]:
        e = el.new(pos); e.color = col
    ln.new(eingang, r.inputs['Fac']); return r.outputs['Color']

def rauschen(ns, ln, koord, skala, detail=4.0, verzerr=0.0, w=None):
    n = ns.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = skala; n.inputs['Detail'].default_value = detail
    n.inputs['Distortion'].default_value = verzerr; ln.new(koord, n.inputs['Vector']); return n.outputs['Fac']

def mathe(ns, ln, op, a, b=None, wert=None):
    m = ns.new('ShaderNodeMath'); m.operation = op
    (ln.new(a, m.inputs[0]) if not isinstance(a, float) else m.inputs[0].__setattr__('default_value', a))
    if b is not None: (ln.new(b, m.inputs[1]) if not isinstance(b, float) else m.inputs[1].__setattr__('default_value', b))
    return m.outputs[0]

def haut_material():
    mat = bpy.data.materials.new('Haut'); nt, ns, ln = knoten(mat)
    tc = ns.new('ShaderNodeTexCoord'); obj = tc.outputs['Object']; uv = tc.outputs['UV']
    sep = ns.new('ShaderNodeSeparateXYZ'); ln.new(obj, sep.inputs[0]); hz = sep.outputs['Z']
    usep = ns.new('ShaderNodeSeparateXYZ'); ln.new(uv, usep.inputs[0])
    # Höhe am Körper: Bauch unten hell, Rücken dunkel. Weicher Übergang mit Rauschen (keine Linie).
    hrausch = rauschen(ns, ln, obj, 14.0, 3.0)
    oben = mathe(ns, ln, 'ADD', hz, mathe(ns, ln, 'MULTIPLY', mathe(ns, ln, 'SUBTRACT', hrausch, 0.5), 0.05))
    grund = rampe(ns, ln, mathe(ns, ln, 'MULTIPLY', mathe(ns, ln, 'SUBTRACT', oben, 0.03), 5.0), [
        (0.0, hexf(W['bauch'], 1.0)), (0.32, hexf(W['bauch'], 0.85)), (0.5, hexf(W['ruecken'], 0.85)),
        (1.0, hexf(W['ruecken'], 0.55))])
    # Marmorierung des Rückens: Flecken in Flecken-Farbe, dunkler, nur oben.
    marm = rauschen(ns, ln, obj, 7.0, 6.0, 1.5)
    fleck = rampe(ns, ln, marm, [(0.0, (0, 0, 0, 1)), (0.52, (0, 0, 0, 1)), (0.6, (1, 1, 1, 1)), (1.0, (1, 1, 1, 1))])
    maske = mathe(ns, ln, 'MULTIPLY', ns.new('ShaderNodeRGBToBW').outputs[0] if False else fleck, 1.0)
    obenmaske = mathe(ns, ln, 'MINIMUM', mathe(ns, ln, 'MULTIPLY', mathe(ns, ln, 'SUBTRACT', oben, 0.11), 8.0), 1.0)
    mix1 = ns.new('ShaderNodeMix'); mix1.data_type = 'RGBA'; mix1.blend_type = 'MIX'
    ln.new(mathe(ns, ln, 'MULTIPLY', maske, obenmaske), mix1.inputs['Factor']); ln.new(grund, mix1.inputs[6])
    mix1.inputs[7].default_value = hexf(W['flecken'], 0.5)
    # Seitenlinie: helle, feine Linie knapp über der Flankenmitte (u ≈ 0,024 und 0,476), mit Poren.
    ux = usep.outputs['X']
    d1 = mathe(ns, ln, 'ABSOLUTE', mathe(ns, ln, 'SUBTRACT', ux, 0.024)); d2 = mathe(ns, ln, 'ABSOLUTE', mathe(ns, ln, 'SUBTRACT', ux, 0.476))
    dl = mathe(ns, ln, 'MINIMUM', d1, d2)
    linie = mathe(ns, ln, 'SUBTRACT', 1.0, mathe(ns, ln, 'MINIMUM', mathe(ns, ln, 'MULTIPLY', dl, 260.0), 1.0))
    vor = mathe(ns, ln, 'MULTIPLY', mathe(ns, ln, 'GREATER_THAN', usep.outputs['Y'], 0.14), mathe(ns, ln, 'LESS_THAN', usep.outputs['Y'], 0.92))
    linie = mathe(ns, ln, 'MULTIPLY', linie, vor)
    mix2 = ns.new('ShaderNodeMix'); mix2.data_type = 'RGBA'
    ln.new(mathe(ns, ln, 'MULTIPLY', linie, 0.55), mix2.inputs['Factor']); ln.new(mix1.outputs[2], mix2.inputs[6])
    mix2.inputs[7].default_value = hexf(W['bauch'], 1.1)
    # Maul innen dunkel.
    maul = mathe(ns, ln, 'MULTIPLY', mathe(ns, ln, 'LESS_THAN', usep.outputs['Y'], 0.075),
                 mathe(ns, ln, 'LESS_THAN', hz, 0.075))
    mix3 = ns.new('ShaderNodeMix'); mix3.data_type = 'RGBA'
    ln.new(maul, mix3.inputs['Factor']); ln.new(mix2.outputs[2], mix3.inputs[6]); mix3.inputs[7].default_value = hexf(W['maul'], 0.45)
    # Relief: Poren (Voronoi fein), Querfalten (gestrecktes Rauschen), grobe Hautbeulen.
    vor_t = ns.new('ShaderNodeTexVoronoi'); vor_t.feature = 'DISTANCE_TO_EDGE'; vor_t.inputs['Scale'].default_value = 260.0
    ln.new(obj, vor_t.inputs['Vector'])
    mp = ns.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (3.0, 34.0, 3.0); ln.new(obj, mp.inputs['Vector'])
    falten = rauschen(ns, ln, mp.outputs['Vector'], 4.0, 5.0)
    beulen = rauschen(ns, ln, obj, 22.0, 3.0)
    h1 = mathe(ns, ln, 'ADD', mathe(ns, ln, 'MULTIPLY', mathe(ns, ln, 'MINIMUM', vor_t.outputs['Distance'], 0.08), 4.0),
               mathe(ns, ln, 'MULTIPLY', falten, 0.8))
    hoehe = mathe(ns, ln, 'ADD', h1, mathe(ns, ln, 'MULTIPLY', beulen, 0.6))
    hoehe = mathe(ns, ln, 'ADD', hoehe, mathe(ns, ln, 'MULTIPLY', linie, -0.4))
    # Rauheit: nass und glatt (Schleim), stellenweise matter, Bauch matter.
    rr = rauschen(ns, ln, obj, 11.0, 3.0)
    rau = mathe(ns, ln, 'ADD', 0.22, mathe(ns, ln, 'MULTIPLY', rr, 0.25))
    rau = mathe(ns, ln, 'ADD', rau, mathe(ns, ln, 'MULTIPLY', mathe(ns, ln, 'SUBTRACT', 1.0, mathe(ns, ln, 'MINIMUM', mathe(ns, ln, 'MULTIPLY', oben, 8.0), 1.0)), 0.2))
    bsdf_mit(nt, ns, ln, mix3.outputs[2], rau, hoehe=hoehe, staerke=0.55)
    return mat

def einfach_material(name, farbe, rau, metall=0.0, skala=60.0, staerke=0.25, streifen=None, ringe=None):
    """Kleine Teile: Grundfarbe mit Rauschvariation, Relief, optional Strahlen (Flossen) oder Ringe (Rohre)."""
    mat = bpy.data.materials.new(name); nt, ns, ln = knoten(mat)
    tc = ns.new('ShaderNodeTexCoord'); obj = tc.outputs['Object']; uv = tc.outputs['UV']
    usep = ns.new('ShaderNodeSeparateXYZ'); ln.new(uv, usep.inputs[0])
    n = rauschen(ns, ln, obj, skala, 5.0, 0.8)
    f = rampe(ns, ln, n, [(0.0, hexf(farbe, 0.55)), (0.5, hexf(farbe, 0.9)), (1.0, hexf(farbe, 1.15))])
    hoehe = n
    if streifen:
        wv = ns.new('ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.bands_direction = 'X'; wv.inputs['Scale'].default_value = streifen
        ln.new(uv, wv.inputs['Vector']); hoehe = mathe(ns, ln, 'ADD', n, mathe(ns, ln, 'MULTIPLY', wv.outputs['Fac'], 1.5))
        mx = ns.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'
        ln.new(mathe(ns, ln, 'MULTIPLY', wv.outputs['Fac'], 0.35), mx.inputs['Factor']); ln.new(f, mx.inputs[6]); mx.inputs[7].default_value = (0.5, 0.48, 0.42, 1)
        f = mx.outputs[2]
    if ringe:
        wv = ns.new('ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.bands_direction = 'Y'; wv.inputs['Scale'].default_value = ringe
        wv.inputs['Distortion'].default_value = 2.0; ln.new(uv, wv.inputs['Vector'])
        ring = rampe(ns, ln, wv.outputs['Fac'], [(0.0, (0, 0, 0, 1)), (0.85, (0, 0, 0, 1)), (0.9, (1, 1, 1, 1)), (1.0, (1, 1, 1, 1))])
        rost = rauschen(ns, ln, obj, 30.0, 6.0, 2.0)
        rostmaske = mathe(ns, ln, 'MAXIMUM', ns.new('ShaderNodeRGBToBW').outputs[0] if False else mathe(ns, ln, 'GREATER_THAN', rost, 0.55), mathe(ns, ln, 'MULTIPLY', ring, 1.0) if False else 0.0)
        mx = ns.new('ShaderNodeMix'); mx.data_type = 'RGBA'
        bw = ns.new('ShaderNodeRGBToBW'); ln.new(ring, bw.inputs[0])
        ln.new(mathe(ns, ln, 'MAXIMUM', bw.outputs[0], rostmaske), mx.inputs['Factor']); ln.new(f, mx.inputs[6]); mx.inputs[7].default_value = hexf(W['rohrRing'], 0.75)
        f = mx.outputs[2]
    bsdf_mit(nt, ns, ln, f, rau, metall, hoehe, staerke)
    return mat

# ------------------------------------------------------------------ Bau
teile = []
haut = haut_material()
r = rumpf(); r.data.materials.append(haut); teile.append(('Rumpf', r, 2048))

# Augen: klein, oben-seitlich am Kopf, leicht versenkt, nass-dunkel mit hellem Ring.
auge = bpy.data.materials.new('Auge'); nt, ns, ln = knoten(auge)
out = ns.new('ShaderNodeOutputMaterial'); b = ns.new('ShaderNodeBsdfPrincipled')
b.inputs['Base Color'].default_value = (0.012, 0.014, 0.012, 1); b.inputs['Roughness'].default_value = 0.04
b.inputs['Coat Weight'].default_value = 1.0; ln.new(b.outputs['BSDF'], out.inputs['Surface'])
for s in (-1, 1):
    x, y, z = flaechenpunkt(0.075, math.atan2(0.62, s * 0.78) if s > 0 else math.pi - math.atan2(0.62, 0.78), -0.004)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.0115, location=P(x, y, z))
    a = bpy.context.active_object; a.name = 'Auge'; a.data.materials.append(auge)
    for p in a.data.polygons: p.use_smooth = True
    teile.append(('Auge', a, 0))

bartel_m = einfach_material('Bartel', W['maul'], 0.3, skala=120.0, staerke=0.2)
for s in (-1, 1):
    a = (s * 0.13, 0.07, zBei(0.02))
    teile.append(('Bartel', roehre('Bartel', [a, (s * 0.24, 0.06, zBei(0.03)), (s * 0.32, 0.025, zBei(0.12)), (s * 0.37, -0.004, zBei(0.26))], 0.011, 0.0015, 10, 48), 0))
    for dx in (0.04, 0.08):
        b0 = (s * dx, 0.03, zBei(0.04))
        teile.append(('Bartel', roehre('Bartel', [b0, (s * (dx + 0.02), 0.0, zBei(0.02)), (s * (dx + 0.045), -0.022, zBei(-0.005))], 0.006, 0.0012, 8, 24), 0))
for _, o, _ in teile:
    if o.name.startswith('Bartel') and not o.data.materials: o.data.materials.append(bartel_m)

flossen_m = einfach_material('Flosse', W['flosse'], 0.4, skala=90.0, staerke=0.3, streifen=18.0)
fl = []
for s in (-1, 1):
    fl.append(flosse('Flosse', [(s * 0.14, 0.04, zBei(0.2)), (s * 0.15, 0.04, zBei(0.25)), (s * 0.14, 0.04, zBei(0.3))],
                     [(s * 0.3, 0.0, zBei(0.31)), (s * 0.26, 0.01, zBei(0.38))]))
rt = 0.36; rh = querschnitt(rt)[1] + 0.01
fl.append(flosse('Flosse', [(schwung(rt), rh, zBei(rt)), (schwung(rt + 0.03), rh - 0.005, zBei(rt + 0.04)), (schwung(rt + 0.06), rh - 0.015, zBei(rt + 0.08))],
                 [(schwung(rt), rh + 0.11, zBei(rt + 0.03)), (schwung(rt), rh + 0.06, zBei(rt + 0.09))]))
wz, sp = [], []
for i in range(9):
    t = 0.52 + i * 0.055; wz.append((schwung(t), 0.015 + i * 0.002, zBei(t)))
    if i < 8: sp.append((schwung(t + 0.03), -0.035 + i * 0.002, zBei(t + 0.04)))
fl.append(flosse('Flosse', wz, sp))
ze, xe, ye = zBei(1), schwung(1), querschnitt(1)[1] / 2 + 0.01
fw = [(xe, ye + (i / 6 - 0.5) * 0.06, ze) for i in range(7)]
fs = [(xe + 0.01, ye + math.sin(((i + 0.5) / 6 - 0.5) * math.pi * 0.9) * 0.13, ze + math.cos(((i + 0.5) / 6 - 0.5) * math.pi * 0.9) * 0.19) for i in range(6)]
fl.append(flosse('Flosse', fw, fs))
for o in fl: o.data.materials.append(flossen_m); teile.append(('Flosse', o, 0))

# Rohre (Kläranlagen-Organik): halb in der Flanke versenkt, mit Rostringen — Lage wie welsbau.ts.
rohr_m = einfach_material('Rohr', W['rohr'], 0.75, metall=0.35, skala=40.0, staerke=0.4, ringe=7.0)
for s in (-1, 1):
    for t0, t1, r0 in ((0.3, 0.48, 0.022), (0.45, 0.66, 0.018), (0.62, 0.8, 0.013)):
        a = Vector(flaechenpunkt(t0, math.pi / 2 - s * 1.05, -0.006)); e = Vector(flaechenpunkt(t1, math.pi / 2 - s * 1.2, -0.01))
        m = a.lerp(e, 0.5) + Vector((s * 0.012, 0.01, 0))
        o = roehre('Rohr', [tuple(a), tuple(m), tuple(e)], r0, r0 * 0.85, 14, 30); o.data.materials.append(rohr_m); teile.append(('Rohr', o, 0))

# Baumpilz-Fächer auf dem Rücken, Signalfarbe nur als Punkt.
pilz_m = einfach_material('Pilz', BEF['pilzHell'], 0.85, skala=70.0, staerke=0.5, ringe=14.0)
for i, t in enumerate((0.4, 0.47, 0.55)):
    x, y, z = flaechenpunkt(t, math.pi / 2 + (0.35 if i % 2 else -0.35), -0.003)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=10, radius=0.05 - i * 0.008, location=P(x, y + 0.004, z))
    o = bpy.context.active_object; o.name = 'Pilz'; o.scale = (1.0, 0.75, 0.22); o.rotation_euler = (0.35 * (1 if i % 2 else -1), 0, rnd.random())
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.02); bpy.ops.object.mode_set(mode='OBJECT')
    for p in o.data.polygons: p.use_smooth = True
    o.data.materials.append(pilz_m); teile.append(('Pilz', o, 0))
signal = bpy.data.materials.new('Signal'); nt, ns, ln = knoten(signal)
out = ns.new('ShaderNodeOutputMaterial'); b = ns.new('ShaderNodeBsdfPrincipled')
b.inputs['Base Color'].default_value = hexf(BEF['signal']); b.inputs['Emission Color'].default_value = hexf(BEF['signal'])
b.inputs['Emission Strength'].default_value = 1.5; b.inputs['Roughness'].default_value = 0.3; ln.new(b.outputs['BSDF'], out.inputs['Surface'])
x, y, z = flaechenpunkt(0.47, math.pi / 2 + 0.35, 0.012)
bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.006, location=P(x, y + 0.012, z))
o = bpy.context.active_object; o.name = 'Signal'; o.data.materials.append(signal); teile.append(('Signal', o, 0))

# ------------------------------------------------------------------ Backen
def backe(ob, mat, groesse, name):
    """Farbe, Rauheit, Normale aus dem prozeduralen Material in Karten; danach Material auf Bildkarten umstellen."""
    nt = mat.node_tree; ns, ln = nt.nodes, nt.links
    bsdf = next(n for n in ns if n.type == 'BSDF_PRINCIPLED'); out = next(n for n in ns if n.type == 'OUTPUT_MATERIAL')
    bilder = {}
    for art in ('farbe', 'rau', 'normal'):
        img = bpy.data.images.new(f'{name}_{art}', groesse, groesse, alpha=False, float_buffer=False)
        img.colorspace_settings.name = 'sRGB' if art == 'farbe' else 'Non-Color'
        tn = ns.new('ShaderNodeTexImage'); tn.image = img; ns.active = tn
        for o in bpy.context.selected_objects: o.select_set(False)
        ob.select_set(True); bpy.context.view_layer.objects.active = ob
        if art == 'normal':
            bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT')
        else:
            quelle = bsdf.inputs['Base Color' if art == 'farbe' else 'Roughness']
            em = ns.new('ShaderNodeEmission')
            if quelle.is_linked: ln.new(quelle.links[0].from_socket, em.inputs['Color'])
            else:
                v = quelle.default_value; em.inputs['Color'].default_value = (v, v, v, 1) if isinstance(v, float) else tuple(v)
            alt = out.inputs['Surface'].links[0].from_socket
            ln.new(em.outputs['Emission'], out.inputs['Surface'])
            bpy.ops.object.bake(type='EMIT')
            ln.new(alt, out.inputs['Surface']); ns.remove(em)
        img.filepath_raw = os.path.join(KARTEN, f'{name}_{art}.png'); img.file_format = 'PNG'; img.save()
        bilder[art] = (img, tn)
    # Material auf die Karten umstellen (glTF-Export versteht nur Bildkarten am Principled).
    for l in list(bsdf.inputs['Base Color'].links): ln.remove(l)
    for l in list(bsdf.inputs['Roughness'].links): ln.remove(l)
    for l in list(bsdf.inputs['Normal'].links): ln.remove(l)
    ln.new(bilder['farbe'][1].outputs['Color'], bsdf.inputs['Base Color'])
    ln.new(bilder['rau'][1].outputs['Color'], bsdf.inputs['Roughness'])
    nm = ns.new('ShaderNodeNormalMap'); ln.new(bilder['normal'][1].outputs['Color'], nm.inputs['Color']); ln.new(nm.outputs['Normal'], bsdf.inputs['Normal'])

# Gebacken werden der Rumpf (2048) und je ein Vertreter der Kleinteile (512 — Barteln, Flossen, Rohre, Pilze teilen das Material).
backe(r, haut, 2048, 'haut')
gebacken = {'Haut'}
for name, o, _ in teile:
    m = o.data.materials[0]
    if m.name in gebacken or m.name in ('Auge', 'Signal'): continue
    # Solidify vor dem Backen anwenden
    for mod in list(o.modifiers):
        bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier=mod.name)
    backe(o, m, 512, m.name.lower()); gebacken.add(m.name)
for _, o, _ in teile:
    for mod in list(o.modifiers):
        bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier=mod.name)

# ------------------------------------------------------------------ Ein Objekt, Export
for o in bpy.context.selected_objects: o.select_set(False)
for _, o, _ in teile: o.select_set(True)
bpy.context.view_layer.objects.active = r
bpy.ops.object.join()
r.name = 'flussvater'
dreiecke = sum(len(p.vertices) - 2 for p in r.data.polygons)
bpy.ops.export_scene.gltf(filepath=AUS, export_format='GLB', use_selection=True, export_image_format='WEBP',
                          export_image_quality=85, export_yup=True, export_apply=True, export_tangents=False)
print(f'[flussvater] {dreiecke} Dreiecke → {AUS} ({os.path.getsize(AUS) // 1024} KB)')
