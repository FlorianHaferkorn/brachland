"""
BRACHLAND — Hirschfänger, Langes Messer und Räucherkanne (D414), eigene Arbeit, aus Grundformen gebaut.

  blender --background --factory-startup --python tools/waffenmodelle.py -- .cache/d414/waffen-neu.glb
  node tools/waffenmodelle_pack.mjs .cache/d414/waffen-neu.glb public/figuren/kampf/waffen.glb

Achsen wie `tools/waffenbau.py` und `baueWaffen` in `RegionsSzene.tsx`: der Griff (die rechte Hand) im Ursprung,
Klinge nach −Z in Blender = −Y in three, die Schneide nach −X (= +Y des Handgelenks, die Finger: Sie führt, D171).
Massstab in Metern. Gestalt nach der Region (ADR-0004: keine fremden Motive): Jagd- und Hauswehr, wie sie im
Inntal in Forsthaus und Stube hängen.

**Gewicht (D398):** aus dem Modell gerechnet — Volumen je Teil × Dichte (Stahl 7,85, Messing 8,5, Hirschhorn 1,5 — kompakt 1,9, die Stange hat einen
schwammigen Kern —,
Buche 0,72, Esche 0,69, Leder 0,9 g/cm³); Blechteile als Fläche × Wandstärke. Die Zahl steht beim Bau im Protokoll
und wird gegen den Anker geprüft (`ANKER`): fällt sie heraus, bricht der Bau ab.

  * Hirschfänger: Klinge 50 cm (DHM W 70/71: 49,5 cm Klinge, 62,5 cm gesamt), Parierstange mit kleiner Muschel,
    Griff aus Hirschhorn mit Messingkappe. Anker 0,4–0,6 kg — Überschlag (das DHM nennt kein Gewicht).
  * Langes Messer: zweihändig, Klinge 82 cm, gesamt 1,17 m (Nachbau 15. Jh.: 82 / 111 cm), eine Schneide, die
    Spitze leicht aufgebogen, Rücken vorn abgesetzt; Kreuz mit Nagel (Wehrnagel) — Griffschalen aus Buche mit
    drei Nieten, gebogene Knaufkappe. Anker 1,2–1,6 kg — Überschlag (einhändige Stücke 0,9–1,1 kg bei 62 cm Klinge).
  * Räucherkanne: Blechzylinder 10 × 18 cm (4 × 7 Zoll, wie die gängigen Smoker), Deckel mit Tülle, Hitzeschutz,
    Blasebalg aus Buchenbrettchen und Leder, Feder innen. Anker 0,6–0,9 kg (Little Giant SM7, 4 × 7 Zoll,
    1,6 lb = 0,73 kg Herstellerangabe; mit einer Handvoll Zunder betriebsbereit um 0,8 kg).
"""
import bpy, bmesh, sys, math, random
from mathutils import Vector, Matrix

AUS = sys.argv[sys.argv.index('--') + 1:][0]
DICHTE = {'Steel': 7.85, 'Messing': 8.5, 'Hirschhorn': 1.5, 'DarkWood': 0.72, 'LightWood': 0.69, 'Leder': 0.9,
          'Blech': 7.9, 'DarkSteel': 7.85}
# Farben linear, im Ton der vorhandenen Waffen (matt, ohne Metallik — der Look kommt vom Schmiedestufen-Tönen).
FARBE = {'Steel': (0.301, 0.322, 0.352), 'DarkSteel': (0.213, 0.213, 0.179), 'DarkWood': (0.130, 0.058, 0.029),
         'LightWood': (0.191, 0.084, 0.041), 'Messing': (0.38, 0.27, 0.09), 'Hirschhorn': (0.32, 0.25, 0.17),
         'Leder': (0.12, 0.06, 0.03), 'Blech': (0.26, 0.26, 0.25)}
ANKER = {'Hirschfaenger': (0.4, 0.6), 'Messer': (1.2, 1.6), 'Raeucherkanne': (0.6, 0.9)}

bpy.ops.wm.read_factory_settings(use_empty=True)
MAT = {}
for n, c in FARBE.items():
    m = bpy.data.materials.new(n)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*c, 1)
    b.inputs['Roughness'].default_value = 0.69
    b.inputs['Metallic'].default_value = 0.0
    MAT[n] = m

TEILE = {}   # Modell → [(Teil, Material, Masse kg)]
TRAEG = {}   # Modell → [(Masse, Mitte z, Länge z)] für die Trägheit um die Hand


def netz(modell, name, mat, bm, blech=None):
    """bmesh → Objekt am Modell; Masse aus Volumen (oder Fläche × `blech` m Wandstärke)."""
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if blech:
        masse = sum(f.calc_area() for f in bm.faces) * blech * DICHTE[mat] * 1000
    else:
        masse = abs(bm.calc_volume()) * DICHTE[mat] * 1000
    me = bpy.data.meshes.new(f'{modell}_{name}')
    bm.to_mesh(me)
    bm.free()
    me.materials.append(MAT[mat])
    for p in me.polygons:
        p.use_smooth = False
    o = bpy.data.objects.new(f'{modell}_{name}', me)
    bpy.context.scene.collection.objects.link(o)
    o.parent = bpy.data.objects[modell]
    zs = [v[2] for v in (vv.co for vv in me.vertices)]
    TRAEG.setdefault(modell, []).append((masse, (min(zs) + max(zs)) / 2, max(zs) - min(zs)))
    TEILE.setdefault(modell, []).append((name, mat, masse))
    return o


def loft(schnitte, deckel=(True, True)):
    """`schnitte` = [(z, [(x, y), …])], gleiche Punktzahl je Schnitt; Spitzen (ein Punkt) erlaubt."""
    bm = bmesh.new()
    ringe = []
    for z, pkt in schnitte:
        ringe.append([bm.verts.new((x, y, z)) for x, y in pkt])
    for a, b in zip(ringe, ringe[1:]):
        if len(a) == 1 or len(b) == 1:
            spitze, ring = (a[0], b) if len(a) == 1 else (b[0], a)
            for i in range(len(ring)):
                bm.faces.new((ring[i], ring[(i + 1) % len(ring)], spitze))
            continue
        n = len(a)
        for i in range(n):
            bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    if deckel[0] and len(ringe[0]) > 2:
        bm.faces.new(list(reversed(ringe[0])))
    if deckel[1] and len(ringe[-1]) > 2:
        bm.faces.new(ringe[-1])
    return bm


def ring(r_x, r_y, n=8, dx=0.0, dy=0.0, phase=0.0):
    return [(dx + r_x * math.cos(phase + 2 * math.pi * i / n), dy + r_y * math.sin(phase + 2 * math.pi * i / n))
            for i in range(n)]


def kasten(x0, x1, y0, y1, z0, z1):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(x1 - x0, y1 - y0, z1 - z0), verts=bm.verts)
    bmesh.ops.translate(bm, vec=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), verts=bm.verts)
    return bm


def zylinder(r, z0, z1, n=10, achse='Z', mitte=(0, 0, 0), r2=None):
    bm = loft([(z0, ring(r, r, n)), (z1, ring(r2 or r, r2 or r, n))])
    if achse == 'X':
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))
    elif achse == 'Y':
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(-math.pi / 2, 3, 'X'))
    bmesh.ops.translate(bm, vec=mitte, verts=bm.verts)
    return bm


def klingenschnitt(breite, dicke, schliff=0.38, ruecken_schneide=0.0):
    """Einschneidig: Schneide bei −x, Rücken bei +x; Flachschliff ab `schliff` der Breite. `ruecken_schneide`
    (0–1) schleift den Rücken mit an (falsche Schneide vor der Spitze)."""
    w, t = breite / 2, dicke / 2
    xs = -w + schliff * breite
    tr = t * (1 - ruecken_schneide)
    return [(-w, 0.0), (xs, t), (w - 0.002, max(tr, 0.0003)), (w, 0.0), (w - 0.002, -max(tr, 0.0003)), (xs, -t)]


def modell(name):
    o = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(o)
    return o


# ---------------------------------------------------------------- Hirschfänger
modell('Hirschfaenger')
L = 0.50
schnitte = []
for i in range(13):
    u = i / 12                                    # 0 = Ansatz, 1 = Spitze
    z = -0.07 - u * L
    breite = 0.032 - 0.006 * u
    dicke = 0.0055 - 0.0025 * u
    rs = max(0.0, (u - 0.78) / 0.22)               # falsche Schneide auf den letzten 11 cm
    if u > 0.8:                                   # Spitze: Breite läuft auf die Mittellinie zu
        breite *= 1 - ((u - 0.8) / 0.2) ** 1.6 * 0.92
    schnitte.append((z, klingenschnitt(breite, dicke, ruecken_schneide=rs)))
schnitte.append((-0.07 - L - 0.012, [(0.004, 0.0)]))
netz('Hirschfaenger', 'Klinge', 'Steel', loft(schnitte, (True, False)))
# Angel unter dem Griff ist verdeckt; die Masse zählt trotzdem (12 cm × 1,2 × 0,5 cm Stahl).
TEILE['Hirschfaenger'].append(('Angel', 'Steel', 0.12 * 0.012 * 0.005 * 7850))
# Parierstange quer zur Klinge in der Klingenebene (X), Enden leicht verdickt; kleine Muschel auf der Aussenseite.
bm = loft([(-0.045, ring(0.0055, 0.006, 6)), (0.0, ring(0.004, 0.005, 6)), (0.045, ring(0.0055, 0.006, 6))])
for v in bm.verts:   # entlang z gebaut, dann quer gelegt: Stange auf x, Schnitt in (z, y)
    v.co = Vector((v.co.z, v.co.y, -0.063 + v.co.x))
netz('Hirschfaenger', 'Parierstange', 'Messing', bm)
bm = loft([(-0.066, ring(0.022, 0.0025, 10, dx=0.004, dy=0.012)), (-0.060, ring(0.018, 0.002, 10, dx=0.004, dy=0.014))])
netz('Hirschfaenger', 'Muschel', 'Messing', bm)
# Griff aus Hirschhorn: oval, leicht gebogen, mit Perlung (wenige grobe Höcker, kein Mikrorauschen).
random.seed(414)
schnitte = []
for i in range(9):
    u = i / 8
    z = -0.058 + u * 0.118
    rx, ry = 0.0135 + 0.002 * math.sin(math.pi * u), 0.0115 + 0.0015 * math.sin(math.pi * u)
    pkt = []
    for k in range(10):
        a = 2 * math.pi * k / 10
        r = 1 + (0.09 * random.random() if 0.1 < u < 0.95 else 0)
        pkt.append((0.004 * math.sin(math.pi * u) + rx * r * math.cos(a), ry * r * math.sin(a)))
    schnitte.append((z, pkt))
netz('Hirschfaenger', 'Griff', 'Hirschhorn', loft(schnitte))
TEILE['Hirschfaenger'].append(('Bohrung (Angel)', 'Hirschhorn', -0.12 * 0.012 * 0.005 * 1500))
netz('Hirschfaenger', 'Kappe', 'Messing', zylinder(0.0125, 0.060, 0.072, 10, r2=0.007))

# ---------------------------------------------------------------- Langes Messer
modell('Messer')
L = 0.82
schnitte = []
N = 20
for i in range(N + 1):
    u = i / N
    z = -0.065 - u * L
    breite = 0.038 - 0.006 * u
    dicke = 0.0062 - 0.0030 * u
    rs = max(0.0, (u - 0.80) / 0.20)                # Rücken vorn abgesetzt und angeschliffen
    if u > 0.78:
        breite *= 1 - ((u - 0.78) / 0.22) ** 1.4 * 0.9
    pkt = klingenschnitt(breite, dicke, schliff=0.42, ruecken_schneide=rs)
    bogen = 0.012 * max(0.0, (u - 0.6) / 0.4) ** 2   # Spitze leicht zur Schneide hin aufgebogen (−x)
    schnitte.append((z, [(x - bogen + (0.0 if u < 0.8 else -0.004 * (u - 0.8) / 0.2), y) for x, y in pkt]))
schnitte.append((-0.065 - L - 0.014, [(-0.012, 0.0)]))
netz('Messer', 'Klinge', 'Steel', loft(schnitte, (True, False)))
TEILE['Messer'].append(('Angel', 'Steel', 0.28 * 0.022 * 0.006 * 7850 * 0.8))   # Flachangel unter den Schalen
# Kreuz (Gehilz): gerade Stange in der Klingenebene; der Nagel steht auf der Aussenseite (+y) heraus.
netz('Messer', 'Kreuz', 'DarkSteel', kasten(-0.09, 0.09, -0.006, 0.006, -0.065, -0.056))
netz('Messer', 'Nagel', 'DarkSteel', zylinder(0.004, 0.0, 0.028, 6, achse='Y', mitte=(0.0, 0.006, -0.062), r2=0.0025))
# Griffschalen aus Buche, 29 cm, flach-achteckig; drei Nieten.
schnitte = [(z, ring(0.016, 0.012, 8, phase=math.pi / 8)) for z in (-0.056, 0.05, 0.15, 0.235)]
netz('Messer', 'Griff', 'DarkWood', loft(schnitte))
TEILE['Messer'].append(('Angel im Griff', 'DarkWood', -0.28 * 0.022 * 0.006 * 720))
for z in (-0.02, 0.09, 0.2):
    netz('Messer', f'Niet{z:+.2f}', 'Messing', zylinder(0.0035, -0.0128, 0.0128, 8, achse='Y', mitte=(0, 0, z)))
# Knaufkappe, zur Schneide (−x) gebogen — das Zeichen des Messers.
bm = loft([(0.235, ring(0.017, 0.013, 8, phase=math.pi / 8)), (0.255, ring(0.016, 0.012, 8, dx=-0.006, phase=math.pi / 8)),
           (0.268, ring(0.011, 0.010, 8, dx=-0.016, phase=math.pi / 8))])
netz('Messer', 'Knauf', 'DarkSteel', bm)

# ---------------------------------------------------------------- Räucherkanne
# Ursprung = Mitte des Blasebalgs (dort greift die Hand). Kanne aufrecht (+Z), Balg an ihrer Seite bei −x, die
# Tülle zeigt nach vorn (−y) und oben. Feuerraum hinter Hitzeschutz, Luft von unten aus dem Balg.
modell('Raeucherkanne')
KX = 0.075                                  # Achse der Kanne
WAND = 0.0006                               # Edelstahlblech 0,6 mm
netz('Raeucherkanne', 'Kanne', 'Blech', zylinder(0.05, -0.09, 0.09, 16, mitte=(KX, 0, 0)), blech=WAND)
# Hitzeschutz: Lochblech mit 6 mm Abstand, unten und oben offen; als Band in sechs Reihen Fenster.
bm = bmesh.new()
for k in range(20):
    a0, a1 = 2 * math.pi * k / 20, 2 * math.pi * (k + 1) / 20
    for j in range(6):
        if (k + j) % 2:
            continue
        z0, z1 = -0.075 + j * 0.026, -0.075 + j * 0.026 + 0.022
        pk = [Vector((KX + 0.057 * math.cos(a), 0.057 * math.sin(a), z)) for a, z in ((a0, z0), (a1, z0), (a1, z1), (a0, z1))]
        vs = [bm.verts.new(p) for p in pk]
        bm.faces.new(vs)
netz('Raeucherkanne', 'Hitzeschutz', 'Blech', bm, blech=WAND)
# Deckel: Kegelstumpf, darauf die Tülle schräg nach vorn.
bm = loft([(0.09, ring(0.051, 0.051, 16, dx=KX)), (0.115, ring(0.03, 0.03, 16, dx=KX)), (0.122, ring(0.018, 0.018, 16, dx=KX))])
netz('Raeucherkanne', 'Deckel', 'Blech', bm, blech=WAND)
bm = zylinder(0.012, 0.0, 0.045, 10, r2=0.008)
bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(55), 3, 'X'))
bmesh.ops.translate(bm, vec=(KX, -0.005, 0.118), verts=bm.verts)
netz('Raeucherkanne', 'Tuelle', 'Blech', bm, blech=WAND)
# Blasebalg: zwei Buchenbrettchen 9 × 17 cm, 6 mm, unten am Gelenk 1 cm, oben 5 cm offen; Leder dazwischen.
BX = -0.005                                 # innere Brettfläche (an der Kanne)
for name, x in (('Brett_innen', BX), ('Brett_aussen', BX - 0.045)):
    if name == 'Brett_innen':
        netz('Raeucherkanne', name, 'LightWood', kasten(x - 0.006, x, -0.045, 0.045, -0.085, 0.085))
    else:
        bm = kasten(-0.006, 0.0, -0.045, 0.045, -0.085, 0.085)
        # unten fast zu (Gelenk), oben offen: um die untere Kante kippen
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, -0.085), matrix=Matrix.Rotation(math.radians(13), 3, 'Y'))
        bmesh.ops.translate(bm, vec=(BX - 0.012, 0, 0), verts=bm.verts)
        netz('Raeucherkanne', name, 'LightWood', bm)
# Lederbalg: Keil zwischen den Brettern.
bm = bmesh.new()
oben_aussen = BX - 0.012 - 0.17 * math.sin(math.radians(13))
pk = [(BX - 0.006, -0.043, -0.083), (BX - 0.006, 0.043, -0.083), (BX - 0.006, 0.043, 0.083), (BX - 0.006, -0.043, 0.083),
      (BX - 0.012, -0.043, -0.083), (BX - 0.012, 0.043, -0.083), (oben_aussen, 0.043, 0.083), (oben_aussen, -0.043, 0.083)]
v = [bm.verts.new(p) for p in pk]
for f in ((0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
    bm.faces.new([v[i] for i in f])
netz('Raeucherkanne', 'Balg', 'Leder', bm, blech=0.0015)
# Düse vom Balg in den Feuerraum, Feder (als Masse), Aufhängehaken aus Draht hinten am äusseren Brett.
netz('Raeucherkanne', 'Duese', 'Blech', zylinder(0.006, BX, KX - 0.05, 8, achse='X', mitte=(0, 0, -0.075)), blech=WAND)
TEILE['Raeucherkanne'].append(('Feder', 'Steel', 0.012))
TEILE['Raeucherkanne'].append(('Rost und Nieten', 'Blech', 0.04))
bm = zylinder(0.0018, 0.0, 0.05, 6, achse='X', mitte=(BX - 0.07, 0, 0.07))
netz('Raeucherkanne', 'Haken', 'DarkSteel', bm)

# ---------------------------------------------------------------- Protokoll, Anker, Export
schlecht = []
for m, teile in TEILE.items():
    summe = sum(t[2] for t in teile)
    obj = bpy.data.objects[m]
    dreiecke = sum(sum(len(p.vertices) - 2 for p in c.data.polygons) for c in obj.children)
    lo = [min((c.matrix_world @ Vector(b))[i] for c in obj.children for b in c.bound_box) for i in range(3)]
    hi = [max((c.matrix_world @ Vector(b))[i] for c in obj.children for b in c.bound_box) for i in range(3)]
    # Trägheit um die Hand (Ursprung), quer zur Klinge: je Teil m·(d² + l²/12) — Überschlag als Stab.
    traeg = sum(kg * (d * d + l * l / 12) for kg, d, l in TRAEG.get(m, []))
    print(f'MODELL {m}: {summe:.3f} kg, {dreiecke} Dreiecke, Mass {hi[0]-lo[0]:.3f} × {hi[1]-lo[1]:.3f} × {hi[2]-lo[2]:.3f} m, '
          f'Trägheit um die Hand {traeg:.3f} kg·m²')
    for name, mat, kg in teile:
        print(f'    {name:16} {mat:10} {kg * 1000:7.1f} g')
    a, b = ANKER[m]
    if not a <= summe <= b:
        schlecht.append(f'{m} {summe:.2f} kg ausserhalb {a}–{b}')
if schlecht:
    raise SystemExit('Gewicht ausserhalb des Ankers: ' + '; '.join(schlecht))
# Teile je Modell zu einem Netz (eine Primitive je Material) — wie die Paketwaffen. Ohne Normalen: GLTFLoader
# schattiert dann flach (wie die Paketwaffen, die flach gebaut sind), und gleiche Ecken lassen sich verschweissen —
# die Datei bleibt halb so gross (D107: auch die Menschen tragen keine Normalen).
for m in TEILE:
    obj = bpy.data.objects[m]
    kinder = list(obj.children)
    bpy.ops.object.select_all(action='DESELECT')
    for c in kinder:
        c.select_set(True)
    bpy.context.view_layer.objects.active = kinder[0]
    bpy.ops.object.join()
    j = bpy.context.view_layer.objects.active
    mw = j.matrix_world.copy()
    j.parent = None
    j.matrix_world = mw
    bpy.data.objects.remove(obj, do_unlink=True)
    j.name = j.data.name = m
bpy.ops.export_scene.gltf(filepath=AUS, export_format='GLB', export_yup=True, export_materials='EXPORT',
                          export_normals=False, export_texcoords=False)
print('MODELLE geschrieben', AUS)
