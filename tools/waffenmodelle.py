"""
BRACHLAND — alle Waffenmodelle in `waffen.glb`, eigene Arbeit, aus Grundformen gebaut: Hirschfänger, Langes Messer
und Räucherkanne (D414); seit D421 auch Klinge, Axt und Saufeder samt Stufe 3 (Ersatz der Fantasy-Formen aus dem
Medieval Weapons Pack und der Kastenspeer aus `baueSpeer`).

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
  * D421 — **Länge und Griffpunkt gleich wie vorher** (die Reichweite hängt an der Modelllänge, D403 §1): Spitze und
    Ende auf der Waffenachse sind aus den alten Modellen gemessen (`ALT`, `tests/waffenmodelle.test.ts` prüft ±1 cm),
    der Griff bleibt im Ursprung. Stufe 3 hat dieselbe Form; die bessere Güte zeigt sich in blank geschliffenem
    Stahl, einer helleren gehärteten Schneide, gebläuten Beschlägen und gepflegtem Griff — kein Gold, keine Zacken.
  * Klinge: schlichtes Einhandschwert (Seitschwert, 16. Jh.) — zweischneidig, gerade Parierstange, Birnknauf,
    Lederwicklung. Anker 0,9–1,3 kg (Einhandschwert im Mittel 1,1 kg bei 90 cm, Wikipedia „Knightly sword“,
    thearma.org — wie `content/waffenfamilien.json`).
  * Axt: Forst- und Fällaxt mit **einer** Schneide, leicht gebartet, Hickorystiel mit Knauf. Anker 1,8–2,6 kg
    (Gränsfors American Felling Axe, 90 cm: 2,2 kg gesamt, Kopf um 1,4 kg — Händlerangaben). **D429: Zweihand-Fällaxt**
    nach *An Ax to Grind* (USDA Forest Service 1999): Kopf 1,40 kg (Anker 1,3–1,5), Höhe an der Schneide 9,5 cm statt
    11,5 (schlanker, damit der Kopf das Vorbild wiegt — vorher 1,71 kg), Stiel 0,70 kg (Anker 0,6–0,8: Hickory-Ersatzstiel
    36 Zoll 0,61–0,68 kg, Händlerangaben Link Handles/Garant; Hickory 0,81 g/cm³ = spezifisches Gewicht 0,72 × 1,12 bei
    12 % Feuchte — Überschlag, die 0,72 aus einer Holztabelle der LSU, nicht am Wood Handbook geprüft; Esche wöge in
    derselben Form rund 0,6 kg). **Zwei Griffpunkte:** Der Ursprung ist die rechte Hand an der **vorderen** Griffstelle
    (¾ den Stiel hinauf, 65 cm vom Stielende — dort hält sie beim Ausholen), die linke Hand sitzt am Stielende
    (`griff_links` 0,62 m hinter der rechten auf der Waffenachse, 3 cm vor dem Ende, der kleine Finger auf dem Knauf).
    Wie weit die rechte Hand im Clip zum Ende gleitet, rechnet die Szene aus der linken Hand (`gleiteAmStiel`,
    `src/kampf/waffenhand.ts`). Länge bleibt 1,00 m (Stufe 3: 1,05 m), nur der Ursprung wandert (vorher 8 cm vom Ende).
  * Saufeder: zweischneidiges Blatt mit Mittelgrat auf einer Tülle, Knebel aus Horn mit Lederriemen quer zum Blatt,
    Eschenschaft mit zwei Lederwicklungen. Vorbild Schloss Rheydt Inv. W 40+41 (1600–1800): 203 cm gesamt, Eisen
    35,3 cm, kein Gewicht genannt → Anker 1,3–2,2 kg, Überschlag.
  * Räucherkanne: Blechzylinder 10 × 18 cm (4 × 7 Zoll, wie die gängigen Smoker), Deckel mit Tülle, Hitzeschutz,
    Blasebalg aus Buchenbrettchen und Leder, Feder innen. Anker 0,6–0,9 kg (Little Giant SM7, 4 × 7 Zoll,
    1,6 lb = 0,73 kg Herstellerangabe; mit einer Handvoll Zunder betriebsbereit um 0,8 kg).
"""
import bpy, bmesh, sys, math, random
from mathutils import Vector, Matrix

AUS = sys.argv[sys.argv.index('--') + 1:][0]
DICHTE = {'Hickory': 0.81, 'HickoryGeoelt': 0.81, 'Steel': 7.85, 'Messing': 8.5, 'Hirschhorn': 1.5, 'DarkWood': 0.72, 'LightWood': 0.69, 'Leder': 0.9,
          'Blech': 7.9, 'DarkSteel': 7.85, 'Blank': 7.85, 'Schneide': 7.85, 'Geblaeut': 7.85, 'LederNeu': 0.9,
          'Esche': 0.69, 'EscheGeoelt': 0.69, 'Horn': 1.3}
# Farben linear, im Ton der vorhandenen Waffen (matt, ohne Metallik — der Look kommt vom Schmiedestufen-Tönen).
FARBE = {'Steel': (0.301, 0.322, 0.352), 'DarkSteel': (0.213, 0.213, 0.179), 'DarkWood': (0.130, 0.058, 0.029),
         'LightWood': (0.191, 0.084, 0.041), 'Messing': (0.38, 0.27, 0.09), 'Hirschhorn': (0.32, 0.25, 0.17),
         'Leder': (0.12, 0.06, 0.03), 'Blech': (0.26, 0.26, 0.25),
         # D421, Stufe 3: blank geschliffen, gehärtete Schneide heller, Beschläge gebläut, Griff gepflegt.
         'Blank': (0.42, 0.44, 0.47), 'Schneide': (0.60, 0.61, 0.62), 'Geblaeut': (0.05, 0.06, 0.09),
         'LederNeu': (0.21, 0.10, 0.045), 'Esche': (0.30, 0.20, 0.11), 'EscheGeoelt': (0.24, 0.12, 0.05),
         'Horn': (0.09, 0.075, 0.06),
         # D429: Hickory für den Axtstiel, im Ton der Esche (die Farbe zeigt das Holz, nicht die Art).
         'Hickory': (0.30, 0.20, 0.11), 'HickoryGeoelt': (0.24, 0.12, 0.05)}
RAUH = {'Blank': 0.35, 'Schneide': 0.3, 'Geblaeut': 0.4}
ANKER = {'Hirschfaenger': (0.4, 0.6), 'Messer': (1.2, 1.6), 'Raeucherkanne': (0.6, 0.9),
         'Klinge': (0.9, 1.3), 'Klinge3': (0.9, 1.35), 'Axt': (1.8, 2.6), 'Axt3': (1.8, 2.7),
         'Speer': (1.3, 2.2), 'Speer3': (1.5, 2.6)}
# D421: Lage der alten Modelle auf der Waffenachse (three y = Blender z), Meter — Spitze und Ende. Gemessen aus
# `waffen.glb` vor D421 (Klinge, Axt, Stufe 3) und aus `baueSpeer` (`src/kampf/waffenhand.ts`) für den Speer.
ALT = {'Klinge': (-0.765, 0.135), 'Klinge3': (-0.851, 0.099), 'Axt': (-0.350, 0.650), 'Axt3': (-0.400, 0.650),
       'Speer': (-1.81, 0.45), 'Speer3': (-2.10, 0.55)}
# D429: Die Axt hat zwei Griffpunkte. Länge wie vor D429 (1,000 / 1,050 m, vorher −0,920…0,080 / −0,938…0,112), der
# Ursprung liegt jetzt an der vorderen Griffstelle der rechten Hand; die linke sitzt `GRIFF_LINKS` dahinter (+Y three).
GRIFF_LINKS = {'Axt': 0.62, 'Axt3': 0.62}
# D429: Kopf und Stiel je für sich im Anker (Kopf: Vorbild Fällaxt 1,4 kg; Stiel: Hickory-Ersatzstiel 0,61–0,68 kg).
TEILANKER = {'Axt': {'Kopf': (1.3, 1.5), 'Stiel': (0.6, 0.8)}, 'Axt3': {'Kopf': (1.3, 1.55), 'Stiel': (0.6, 0.85)}}

bpy.ops.wm.read_factory_settings(use_empty=True)
MAT = {}
for n, c in FARBE.items():
    m = bpy.data.materials.new(n)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*c, 1)
    b.inputs['Roughness'].default_value = RAUH.get(n, 0.69)
    b.inputs['Metallic'].default_value = 0.0
    MAT[n] = m

TEILE = {}   # Modell → [(Teil, Material, Masse kg)]
TRAEG = {}   # Modell → [(Masse, Mitte z, Länge z)] für die Trägheit um die Hand


def netz(modell, name, mat, bm, blech=None, zweit=None):
    """bmesh → Objekt am Modell; Masse aus Volumen (oder Fläche × `blech` m Wandstärke). `zweit`: Material für die
    Flächen mit `material_index` 1 (aus `loft(kanten=…)`), gleiche Dichte wie `mat`."""
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if blech:
        masse = sum(f.calc_area() for f in bm.faces) * blech * DICHTE[mat] * 1000
    else:
        masse = abs(bm.calc_volume()) * DICHTE[mat] * 1000
    me = bpy.data.meshes.new(f'{modell}_{name}')
    bm.to_mesh(me)
    bm.free()
    me.materials.append(MAT[mat])
    if zweit:
        me.materials.append(MAT[zweit])
    for p in me.polygons:
        p.use_smooth = False
    o = bpy.data.objects.new(f'{modell}_{name}', me)
    bpy.context.scene.collection.objects.link(o)
    o.parent = bpy.data.objects[modell]
    zs = [v[2] for v in (vv.co for vv in me.vertices)]
    TRAEG.setdefault(modell, []).append((masse, (min(zs) + max(zs)) / 2, max(zs) - min(zs)))
    TEILE.setdefault(modell, []).append((name, mat, masse))
    return o


def loft(schnitte, deckel=(True, True), kanten=(), abschnitte=()):
    """`schnitte` = [(z, [(x, y), …])], gleiche Punktzahl je Schnitt; Spitzen (ein Punkt) erlaubt. Flächen an den
    Schnittkanten `kanten` (Index i: Punkt i → i+1) und in den Abschnitten `abschnitte` (k: Schnitt k → k+1) bekommen
    `material_index` 1 — so liegt die Schneide als eigener Streifen auf der Klinge (D421)."""
    bm = bmesh.new()
    ringe = []
    for z, pkt in schnitte:
        ringe.append([bm.verts.new((x, y, z)) for x, y in pkt])
    for k, (a, b) in enumerate(zip(ringe, ringe[1:])):
        if len(a) == 1 or len(b) == 1:
            spitze, ring = (a[0], b) if len(a) == 1 else (b[0], a)
            for i in range(len(ring)):
                f = bm.faces.new((ring[i], ring[(i + 1) % len(ring)], spitze))
                f.material_index = 1 if (i in kanten or k in abschnitte) else 0
            continue
        n = len(a)
        for i in range(n):
            f = bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
            f.material_index = 1 if (i in kanten or k in abschnitte) else 0
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


# ---------------------------------------------------------------- D421: Klinge, Axt, Saufeder (je Stufe 1 und 3)
GUETE = {1: dict(stahl='Steel', schneide=None, beschlag='DarkSteel', griff='Leder', holz='Esche', stiel='Hickory'),
         3: dict(stahl='Blank', schneide='Schneide', beschlag='Geblaeut', griff='LederNeu', holz='EscheGeoelt',
                 stiel='HickoryGeoelt')}


def zweischneidig(breite, dicke, fase=0.006, fasendicke=0.0012):
    """Zweischneidiger Schnitt mit Mittelgrat: Schneide links (0), Fase, Grat oben (2), Fase, Schneide rechts (4) …
    Die Kanten 0, 3, 4, 7 sind die Fasen — dort liegt bei Stufe 3 die hellere, gehärtete Schneide."""
    w, t = breite / 2, dicke / 2
    f = min(fase, w * 0.45)
    return [(-w, 0.0), (-w + f, fasendicke), (0.0, t), (w - f, fasendicke), (w, 0.0), (w - f, -fasendicke), (0.0, -t),
            (-w + f, -fasendicke)]


FASEN = (0, 3, 4, 7)


def schwert(name, guete):
    """Einhandschwert: Spitze und Knaufende aus `ALT`, Griffmitte im Ursprung."""
    spitze, ende = ALT[name]
    g = GUETE[guete]
    modell(name)
    unter = -0.085                                   # Unterkante Parierstange = Klingenansatz
    L = unter - spitze
    schnitte = []
    for i in range(15):
        u = i / 14
        breite = 0.046 - 0.016 * u
        dicke = 0.0065 - 0.0035 * u
        if u > 0.86:
            breite *= 1 - ((u - 0.86) / 0.14) ** 1.2 * 0.85
        schnitte.append((unter - u * (L - 0.012), zweischneidig(breite, dicke)))
    schnitte.append((spitze, [(0.0, 0.0)]))
    netz(name, 'Klinge', g['stahl'], loft(schnitte, (True, False), kanten=FASEN if g['schneide'] else ()),
         zweit=g['schneide'])
    TEILE[name].append(('Angel', g['stahl'], 0.17 * 0.014 * 0.005 * 7850))
    # Parierstange gerade, in der Klingenebene (x), Enden leicht verdickt.
    bm = loft([(-0.095, ring(0.0065, 0.0055, 8)), (-0.06, ring(0.005, 0.0048, 8)), (0.0, ring(0.0055, 0.006, 8)),
               (0.06, ring(0.005, 0.0048, 8)), (0.095, ring(0.0065, 0.0055, 8))])
    for v in bm.verts:
        v.co = Vector((v.co.z, v.co.y, unter + 0.0065 + v.co.x))
    netz(name, 'Parierstange', g['beschlag'], bm)
    # Griff: Holz unter Lederwicklung, oval, zur Mitte etwas dicker; Knauf birnenförmig bis zum Ende.
    knauf = min(0.06, max(0.04, ende - 0.07))
    gr_oben = ende - knauf
    schnitte = [(z, ring(rx, ry, 10)) for z, rx, ry in ((unter + 0.013, 0.0135, 0.011), (0.0, 0.0155, 0.0125),
                                                         (gr_oben, 0.0135, 0.011))]
    netz(name, 'Griff', g['griff'], loft(schnitte))
    k = knauf
    bm = loft([(gr_oben, ring(0.010, 0.010, 10)), (gr_oben + 0.25 * k, ring(0.019, 0.017, 10)),
               (gr_oben + 0.6 * k, ring(0.022, 0.019, 10)), (gr_oben + 0.88 * k, ring(0.014, 0.012, 10)),
               (ende, ring(0.006, 0.006, 10))])
    netz(name, 'Knauf', g['beschlag'], bm)
    if guete == 3:                                    # gepflegter Griff: Drahtwicklung an beiden Enden
        for z in (unter + 0.018, gr_oben - 0.006):
            netz(name, f'Draht{z:+.3f}', 'Geblaeut', zylinder(0.0142, z - 0.004, z + 0.004, 10))


def axt(name, guete):
    """Forst- und Fällaxt, eine Schneide nach −x, leicht gebartet; Kopf am Ende (−z), Stiel bis zum Knauf.
    D429: Ursprung = rechte Hand an der vorderen Griffstelle; Masse von Kopf und Stiel gegen `TEILANKER`."""
    oben, ende = ALT[name]
    g = GUETE[guete]
    modell(name)
    # Kopf als Loft entlang x (Nacken +x → Schneide −x); Schnitt in (y, z): halbe Dicke, Ober- und Unterkante.
    # Oberkante = Ende der Waffe (`oben`). D429: schlanker — Schneide 9,5 cm hoch (vorher 11,5), Wangen dünner, damit
    # der Kopf netto 1,40 kg wiegt wie das Vorbild (vorher 1,71 kg); der Bart reicht weniger weit zum Stiel hin.
    stufen = [(0.034, 0.0132, 0.007, 0.060), (0.02, 0.0146, 0.0055, 0.062), (-0.028, 0.0136, 0.0055, 0.062),
              (-0.06, 0.0080, 0.0035, 0.070), (-0.10, 0.0042, 0.0015, 0.084), (-0.145, 0.0016, 0.0, 0.095),
              (-0.158, 0.0004, 0.001, 0.094)]
    schnitte = []
    for x, dy, unten_oben, hoehe in stufen:
        z_top = oben + 0.0005 + unten_oben
        z_bot = z_top + hoehe
        schnitte.append((x, [(dy, z_top), (dy, z_bot), (-dy, z_bot), (-dy, z_top)]))
    bm = loft(schnitte, abschnitte=(5,) if g['schneide'] else ())
    for v in bm.verts:                               # gebaut entlang z: (y, z) → Achsen tauschen
        v.co = Vector((v.co.z, v.co.x, v.co.y))
    netz(name, 'Kopf', g['stahl'], bm, zweit=g['schneide'])
    # Auge: der Stiel steckt im Kopf — dessen Volumen ist kein Stahl.
    auge = 0.034 * 0.022 * math.pi / 4 * 0.062
    TEILE[name].append(('Auge (Abzug)', g['stahl'], -auge * 7850))
    # Stiel aus Hickory: Knauf am Ende, Griffzone, schlanke Mitte, Schwellung unter dem Kopf. D429: Punkte vom Ende und
    # vom Kopf aus gemessen (der Ursprung liegt jetzt mitten im Stiel); Querschnitt wie ein Ersatzstiel 36 Zoll
    # (Griff 41 × 29 mm, Hals 38 × 26 mm, Schulter 44 × 30 mm, Knauf 50 × 35 mm — Überschlag, so gewählt, dass der Stiel
    # den Ersatzstielen gleich wiegt; Masse aus dem Volumen).
    zs = [(ende, 0.0195, 0.014), (ende - 0.025, 0.0248, 0.0173), (ende - 0.06, 0.0205, 0.0146), (ende - 0.30, 0.0203, 0.0144),
          (oben + 0.36, 0.0189, 0.013), (oben + 0.16, 0.021, 0.0146), (oben + 0.075, 0.0221, 0.0151),
          (oben + 0.004, 0.017, 0.011)]
    netz(name, 'Stiel', g['stiel'], loft([(z, ring(rx, ry, 10)) for z, rx, ry in zs]))
    # Keil im Auge (Holz) und bei Stufe 3 ein Eisenkeil quer darüber.
    if guete == 3:
        netz(name, 'Keil', 'Geblaeut', kasten(-0.014, 0.014, -0.0015, 0.0015, oben + 0.0002, oben + 0.004))


def saufeder(name, guete):
    """Saufeder: Blatt mit Mittelgrat auf der Tülle, Knebel quer zum Blatt, Eschenschaft; Stufe 3 mit Schuh."""
    spitze, ende = ALT[name]
    g = GUETE[guete]
    modell(name)
    blatt = 0.25
    basis = spitze + blatt
    schnitte = []
    for i in range(12):
        u = i / 11                                   # 0 = Ansatz an der Tülle, 1 = Spitze
        b = 0.050 * math.sin(math.pi * min(1.0, 0.18 + 0.82 * (1 - u)) ** 0.9) * (1 - 0.2 * u)
        b = max(b, 0.018) if u < 0.15 else b
        d = 0.0095 - 0.006 * u
        schnitte.append((basis - u * (blatt - 0.01), zweischneidig(max(b, 0.004), d, fase=0.007)))
    schnitte.append((spitze, [(0.0, 0.0)]))
    netz(name, 'Blatt', g['stahl'], loft(schnitte, (True, False), kanten=FASEN if g['schneide'] else ()),
         zweit=g['schneide'])
    # Tülle: kegeliges Rohr (als Vollkörper gerechnet, Abzug für den Schaft darin).
    tuelle = 0.11
    netz(name, 'Tuelle', g['beschlag'], zylinder(0.0115, basis, basis + tuelle, 10, r2=0.0175))
    TEILE[name].append(('Tülle hohl (Abzug)', g['beschlag'], -math.pi * 0.0135 ** 2 * (tuelle - 0.02) * 7850))
    # Knebel aus Horn, quer zum Blatt (y), mit Lederriemen um den Schaft.
    kz = basis + tuelle + 0.03
    bm = loft([(-0.09, ring(0.007, 0.007, 8)), (0.0, ring(0.011, 0.011, 8)), (0.09, ring(0.007, 0.007, 8))])
    for v in bm.verts:
        v.co = Vector((v.co.x, v.co.z, kz + v.co.y))
    netz(name, 'Knebel', 'Horn', bm)
    netz(name, 'Riemen', g['griff'], zylinder(0.0172, kz - 0.022, kz + 0.022, 10))
    # Schaft aus Esche, 3 cm, zum Ende etwas stärker; zwei Lederwicklungen, wo die Hände sitzen (0 und −0,5 m).
    schuh = 0.10 if guete == 3 else 0.0
    zs = [(basis + 0.02, 0.0135), (basis + tuelle, 0.0148), (-0.5, 0.015), (ende - schuh, 0.0158)]
    netz(name, 'Schaft', g['holz'], loft([(z, ring(r, r, 10)) for z, r in zs]))
    for z0, z1 in ((-0.08, 0.08), (-0.58, -0.42)):
        netz(name, f'Wicklung{z0:+.2f}', g['griff'], zylinder(0.0163, z0, z1, 10))
    if schuh:
        netz(name, 'Schuh', 'Geblaeut', zylinder(0.0165, ende - schuh, ende, 10, r2=0.009))


for n, gu in (('Klinge', 1), ('Klinge3', 3)):
    schwert(n, gu)
for n, gu in (('Axt', 1), ('Axt3', 3)):
    axt(n, gu)
for n, gu in (('Speer', 1), ('Speer3', 3)):
    saufeder(n, gu)

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
    for teil, (ta, tb) in TEILANKER.get(m, {}).items():
        kg = sum(t[2] for t in teile if t[0] == teil or (teil == 'Kopf' and t[0].startswith('Auge')))
        print(f'    TEIL {teil}: {kg:.3f} kg (Anker {ta}–{tb})')
        obj[f'masse_{teil.lower()}_kg'] = round(kg, 3)
        if not ta <= kg <= tb:
            schlecht.append(f'{m} {teil} {kg:.2f} kg ausserhalb {ta}–{tb}')
    if m in GRIFF_LINKS:
        obj['griff_rechts'] = 0.0
        obj['griff_links'] = GRIFF_LINKS[m]
        print(f'    GRIFF rechts 0 (Ursprung), links {GRIFF_LINKS[m]} m dahinter, Ende bei {ALT[m][1]} m')
    if m in ALT and (abs(lo[2] - ALT[m][0]) > 0.01 or abs(hi[2] - ALT[m][1]) > 0.01):
        schlecht.append(f'{m} Achse {lo[2]:.3f}…{hi[2]:.3f} statt {ALT[m][0]}…{ALT[m][1]} (Länge und Griff müssen bleiben)')
    obj['masse_kg'] = round(summe, 3)
if schlecht:
    raise SystemExit('Modell ausserhalb des Ankers: ' + '; '.join(schlecht))
obj_masse = {m: {k: v for k, v in bpy.data.objects[m].items() if k.startswith(('masse', 'griff'))} for m in TEILE}
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
    for k, v in obj_masse[m].items():
        j[k] = v
bpy.ops.export_scene.gltf(filepath=AUS, export_format='GLB', export_yup=True, export_materials='EXPORT',
                          export_normals=False, export_texcoords=False, export_extras=True)
print('MODELLE geschrieben', AUS)
