"""
BRACHLAND — Zielbild für die Waffen (Design-Runde 1, Flo 23.11.2026), Blender-Render, nichts davon im Spiel.

    blender --background --factory-startup --python tools/waffenframe.py -- bild <aus.png> <ansicht> [b h spp]
    python3 tools/waffenframe.py blatt <bilderordner> <referenzordner>

`ansicht`: `gesamt` oder eine Waffe (`hirschfaenger`, `klinge`, `messer`, `axt`, `speer`). `WAFFE_ROH=1` rendert die
Modelle, wie sie im Spiel sind (flach schattiert, eine Farbe je Teil) — das Vorher-Bild an derselben Kamera.

Was passiert:
- Die Modelle baut `tools/waffenmodelle.py` selbst (hier nur ausgeführt, **nicht geändert**): dieselben Netze, Maße,
  Massen und Griffpunkte wie in `public/figuren/kampf/waffen.glb`. Länge, Griff und Gewicht sind Spielwerte (D403,
  D421, D429) — dieses Werkzeug fasst die Form nicht an, es gibt ihr nur Oberfläche.
- Substanz (ADR-0018: real, Darstellung gemalt) als prozedurale Materialien in Objektkoordinaten, also ohne UV und
  ohne fremde Texturen: Stahl mit Schmiedehaut (Zunder) auf den Flächen, blankem Schliff an den Kanten, Schleifriefen
  längs und Flugrost in Kehlen; Holz mit Maserung längs der Waffenachse, Handglanz und Schmutz an den Griffstellen,
  Druckstellen; Leder als Wicklung mit Rillen; Messing mit Patina; Hirschhorn mit Längsrillen.
- Kanten: 0,4 mm Fase an allen Kanten über 46° (im Spiel flach schattiert), der Rest weich — Licht fängt sich an der
  Kante wie an einem echten Stück.
- Szene: Werkbank aus Bohlen, die Waffen liegen darauf (Auflage aus der unteren Hülle gerechnet: Kopf und Stielende
  tragen, D398), Himmel und Sonnenfarbe aus `hausframe.py` (nur importiert), Sonne als Streiflicht von links vorn.
- Ausgabe direkt als PNG mit AgX: Der Stil-Durchgang von `hausframe.stil` lässt die Nähe unberührt (Pinsel erst in
  der Ferne), eine Waffe auf der Werkbank ist nur Nähe.
"""
import sys, os, math

try:
    import bpy
except ImportError:
    bpy = None

HIER = os.path.dirname(os.path.abspath(__file__))
WAFFEN = ('hirschfaenger', 'klinge', 'messer', 'axt', 'speer')
OBJEKT = {'hirschfaenger': 'Hirschfaenger', 'klinge': 'Klinge', 'messer': 'Messer', 'axt': 'Axt', 'speer': 'Speer'}
NAMEN = {'hirschfaenger': 'Hirschfänger', 'klinge': 'Klinge (Seitschwert)', 'messer': 'Langes Messer', 'axt': 'Fällaxt', 'speer': 'Saufeder'}
# Blick fürs Nahbild: Punkt auf der Waffenachse (Modell-z, Meter; Klinge liegt bei −z) — Übergang Griff/Klinge bzw. Kopf
NAH = {'hirschfaenger': -0.07, 'klinge': -0.08, 'messer': -0.10, 'axt': -0.27, 'speer': -1.50}
# Griffstellen auf der Achse (Modell-z): rechte Hand im Ursprung; Axt linke Hand 0,62 m dahinter (D429), Saufeder vorn
GRIFFE = {'hirschfaenger': (0.0,), 'klinge': (0.0,), 'messer': (0.0, 0.14), 'axt': (0.0, 0.62), 'speer': (0.0, -0.55)}
TISCH = 0.90     # Höhe der Werkbank, Meter
ROH = os.environ.get('WAFFE_ROH') == '1'


# ───────────────────────────── Materialien ─────────────────────────────
def _nt(name):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    return m, nt, nt.nodes['Principled BSDF']


class N:
    """Kleiner Knotenhelfer: Zahlen und Sockel mischen, ohne jede Verbindung von Hand zu ziehen."""
    def __init__(s, nt): s.nt = nt

    def k(s, typ, **kw):
        n = s.nt.nodes.new(typ)
        for a, w in kw.items(): setattr(n, a, w)
        return n

    def setze(s, sockel, w):
        if hasattr(w, 'default_value') or hasattr(w, 'links'): s.nt.links.new(w, sockel)
        elif isinstance(w, (tuple, list)) and len(w) == 3 and len(sockel.default_value) == 4: sockel.default_value = (*w, 1)
        else: sockel.default_value = w

    def math(s, op, a, b=None, clamp=False):
        n = s.k('ShaderNodeMath', operation=op, use_clamp=clamp); s.setze(n.inputs[0], a)
        if b is not None: s.setze(n.inputs[1], b)
        return n.outputs[0]

    def mix(s, f, a, b):
        n = s.k('ShaderNodeMix', data_type='RGBA'); s.setze(n.inputs['Factor'], f); s.setze(n.inputs['A'], a); s.setze(n.inputs['B'], b)
        return n.outputs['Result']

    def mixf(s, f, a, b):
        n = s.k('ShaderNodeMix', data_type='FLOAT'); s.setze(n.inputs['Factor'], f); s.setze(n.inputs['A'], a); s.setze(n.inputs['B'], b)
        return n.outputs['Result']

    def bereich(s, x, a, b, c=0.0, d=1.0):
        n = s.k('ShaderNodeMapRange', clamp=True, interpolation_type='SMOOTHSTEP'); s.setze(n.inputs['Value'], x)
        n.inputs['From Min'].default_value = a; n.inputs['From Max'].default_value = b; n.inputs['To Min'].default_value = c; n.inputs['To Max'].default_value = d
        return n.outputs['Result']

    def ort(s, skala=(1, 1, 1)):
        tc = s.k('ShaderNodeTexCoord'); mp = s.k('ShaderNodeMapping'); mp.inputs['Scale'].default_value = skala
        s.nt.links.new(tc.outputs['Object'], mp.inputs['Vector']); return mp.outputs['Vector']

    def rauschen(s, skala, groesse=1.0, detail=4.0, rau=0.55):
        n = s.k('ShaderNodeTexNoise'); s.nt.links.new(s.ort(skala), n.inputs['Vector'])
        n.inputs['Scale'].default_value = groesse; n.inputs['Detail'].default_value = detail; n.inputs['Roughness'].default_value = rau
        return n.outputs['Fac']

    def z(s):
        tc = s.k('ShaderNodeTexCoord'); x = s.k('ShaderNodeSeparateXYZ'); s.nt.links.new(tc.outputs['Object'], x.inputs[0]); return x.outputs['Z']

    def kante(s, a=0.52, b=0.62):
        """Konvexe Kante (Pointiness über 0,5) — dort ist ein Werkzeug blank gegriffen und geschliffen."""
        return s.bereich(s.k('ShaderNodeNewGeometry').outputs['Pointiness'], a, b)

    def kehle(s, a=0.40, b=0.49):
        return s.math('SUBTRACT', 1.0, s.bereich(s.k('ShaderNodeNewGeometry').outputs['Pointiness'], a, b))

    def relief(s, bsdf, hoehe, staerke, abstand=0.002):
        n = s.k('ShaderNodeBump'); n.inputs['Strength'].default_value = staerke; n.inputs['Distance'].default_value = abstand
        s.setze(n.inputs['Height'], hoehe); s.nt.links.new(n.outputs['Normal'], bsdf.inputs['Normal'])

    def griff(s, stellen, breite=0.085):
        """1 an den Griffstellen (Gauss um jede Stelle auf der Achse), 0 sonst."""
        z = s.z(); summe = None
        for g in stellen:
            d = s.math('DIVIDE', s.math('SUBTRACT', z, g), breite)
            e = s.math('EXPONENT', s.math('MULTIPLY', s.math('MULTIPLY', d, d), -1.0))
            summe = e if summe is None else s.math('MAXIMUM', summe, e)
        return summe


def mat_stahl(name, hell, haut, rost, glanz=0.30, blau=None, schneide=0.0):
    """Stahl: `haut` = Anteil Schmiedehaut (Zunder) auf den Flächen, `rost` = Flugrost in Kehlen, `blau` = Anlassfarbe."""
    m, nt, b = _nt(name); k = N(nt)
    riefen = k.rauschen((700, 700, 9), 1.0, 3.0, 0.6)                 # Schleifriefen längs der Achse
    wolke = k.rauschen((9, 9, 9), 1.0, 6.0, 0.62)                   # grosse Flecken: wo die Haut stehen blieb
    korn = k.rauschen((900, 900, 900), 1.0, 2.0, 0.5)
    kante = k.kante(); kehle = k.kehle()
    hautmaske = k.math('MULTIPLY', k.bereich(wolke, 0.42, 0.62), k.math('SUBTRACT', 1.0, kante), clamp=True)
    hautmaske = k.math('MULTIPLY', hautmaske, haut)
    rostmaske = k.math('MULTIPLY', k.math('MULTIPLY', k.math('MAXIMUM', kehle, k.bereich(wolke, 0.60, 0.74)), k.bereich(korn, 0.35, 0.65)), rost, clamp=True)
    grund = hell if blau is None else blau
    farbe = k.mix(hautmaske, grund, (0.035, 0.034, 0.036))            # Zunder: blauschwarz, matt
    farbe = k.mix(k.math('MULTIPLY', kante, 0.85), farbe, (0.78, 0.79, 0.80))   # Schliff: blank
    schliff = 0.0
    if schneide:
        # Schneide: wo das Blatt dünn wird (|y| unter `schneide` m — die Klingen liegen symmetrisch um y = 0), ist es
        # geschliffen: blank, quer zur Schneide gerieft, mit einzelnen Scharten und Anlaufflecken
        tc = k.k('ShaderNodeTexCoord'); xyz = k.k('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Object'], xyz.inputs[0])
        duenn = k.math('SUBTRACT', 1.0, k.bereich(k.math('ABSOLUTE', xyz.outputs['Y']), 0.0004, schneide))
        scharte = k.bereich(k.rauschen((60, 60, 420), 1.0, 2.0, 0.5), 0.66, 0.74)
        schliff = k.math('MULTIPLY', duenn, k.math('SUBTRACT', 1.0, k.math('MULTIPLY', scharte, 0.8)))
        farbe = k.mix(schliff, farbe, (0.86, 0.87, 0.88)); hautmaske = k.math('MULTIPLY', hautmaske, k.math('SUBTRACT', 1.0, duenn))
    farbe = k.mix(rostmaske, farbe, (0.20, 0.075, 0.025))
    k.setze(b.inputs['Base Color'], farbe)
    k.setze(b.inputs['Metallic'], k.math('SUBTRACT', 1.0, k.math('MULTIPLY', rostmaske, 0.85)))
    rau = k.math('ADD', glanz, k.math('MULTIPLY', k.bereich(riefen, 0.3, 0.7), 0.30))
    rau = k.mixf(hautmaske, rau, 0.62); rau = k.mixf(k.math('MULTIPLY', kante, 0.8), rau, 0.16); rau = k.mixf(rostmaske, rau, 0.85)
    if schneide: rau = k.mixf(schliff, rau, 0.14)
    k.setze(b.inputs['Roughness'], rau)
    hoehe = k.math('ADD', k.math('MULTIPLY', riefen, 0.25), k.math('ADD', k.math('MULTIPLY', hautmaske, k.math('MULTIPLY', korn, 0.9)), k.math('MULTIPLY', rostmaske, korn)))
    k.relief(b, hoehe, 0.35, 0.0006)
    return m


def mat_messing(name):
    m, nt, b = _nt(name); k = N(nt)
    wolke = k.rauschen((60, 60, 60), 1.0, 4.0, 0.6); kante = k.kante(); kehle = k.kehle()
    patina = k.math('MULTIPLY', k.math('MAXIMUM', kehle, k.bereich(wolke, 0.55, 0.75)), 0.8, clamp=True)
    farbe = k.mix(patina, (0.72, 0.50, 0.17), (0.10, 0.075, 0.035)); farbe = k.mix(k.math('MULTIPLY', kante, 0.7), farbe, (0.90, 0.72, 0.36))
    k.setze(b.inputs['Base Color'], farbe); b.inputs['Metallic'].default_value = 1.0
    k.setze(b.inputs['Roughness'], k.mixf(patina, 0.26, 0.65)); k.relief(b, wolke, 0.12, 0.0004)
    return m


def mat_holz(name, hell, dunkel, stellen, oel=0.0, alt=0.0, lang=1.0):
    """Holz mit Maserung längs der Achse (z). `stellen`: Griffstellen — dort dunkel vom Handschweiss und glänzend."""
    m, nt, b = _nt(name); k = N(nt)
    faser = k.rauschen((48, 48, 1.3 * lang), 1.0, 7.0, 0.66)          # Fasern: quer fein, längs lang gezogen
    ringe = k.rauschen((16, 16, 0.5 * lang), 1.0, 2.0, 0.5)                  # Jahrringe als breite Bänder
    band = k.math('FRACT', k.math('MULTIPLY', ringe, 9.0))
    poren = k.rauschen((600, 600, 14), 1.0, 2.0, 0.5)                 # ringporig (Esche, Hickory): dunkle Porenstriche
    f = k.math('ADD', k.math('MULTIPLY', k.bereich(band, 0.05, 0.75), 0.55), k.math('MULTIPLY', faser, 0.45))
    farbe = k.mix(k.bereich(f, 0.32, 0.68), dunkel, hell)
    farbe = k.mix(k.math('MULTIPLY', k.bereich(poren, 0.60, 0.72), 0.45), farbe, tuple(c * 0.45 for c in dunkel))
    hand = k.griff(stellen)
    farbe = k.mix(k.math('MULTIPLY', hand, 0.55), farbe, tuple(c * 0.55 for c in dunkel))     # Griffstelle: dunkel gegriffen
    dellen = k.k('ShaderNodeTexVoronoi', feature='F1'); nt.links.new(k.ort((38, 38, 38)), dellen.inputs['Vector'])
    delle = k.math('SUBTRACT', 1.0, k.bereich(dellen.outputs['Distance'], 0.0, 0.10))        # vereinzelte Druckstellen
    delle = k.math('MULTIPLY', delle, k.bereich(k.rauschen((9, 9, 9)), 0.55, 0.70))
    farbe = k.mix(k.math('MULTIPLY', delle, 0.5), farbe, tuple(c * 0.4 for c in dunkel))
    if alt: farbe = k.mix(alt * 0.35, farbe, (0.10, 0.095, 0.085))                             # vergraut (Werkbank)
    k.setze(b.inputs['Base Color'], farbe)
    rau = k.mixf(hand, 0.62 - 0.22 * oel, 0.30); k.setze(b.inputs['Roughness'], k.math('ADD', rau, k.math('MULTIPLY', faser, 0.10)))
    hoehe = k.math('SUBTRACT', k.math('ADD', k.math('MULTIPLY', faser, 0.5), k.math('MULTIPLY', k.bereich(poren, 0.60, 0.72), -0.6)), k.math('MULTIPLY', delle, 1.5))
    k.relief(b, hoehe, 0.30 + 0.5 * alt, 0.0008 + 0.002 * alt)
    return m


def mat_leder(name, farbe, neu=False):
    """Lederwicklung: Rillen quer zur Achse (ein Riemen, Windung an Windung), Poren, an den Graten abgegriffen."""
    m, nt, b = _nt(name); k = N(nt)
    z = k.z(); windung = k.math('FRACT', k.math('MULTIPLY', z, 1.0 / 0.006))                 # 6 mm je Windung
    rille = k.math('SUBTRACT', 1.0, k.bereich(k.math('ABSOLUTE', k.math('SUBTRACT', windung, 0.5)), 0.30, 0.50))
    poren = k.rauschen((1400, 1400, 1400), 1.0, 2.0, 0.5); fleck = k.rauschen((40, 40, 40), 1.0, 4.0, 0.6)
    grat = k.math('MULTIPLY', rille, k.bereich(fleck, 0.35, 0.65))
    c = k.mix(k.math('MULTIPLY', grat, 0.0 if neu else 0.55), farbe, tuple(min(1.0, x * 2.6) for x in farbe))   # abgegriffen: heller
    c = k.mix(k.math('MULTIPLY', k.math('SUBTRACT', 1.0, rille), 0.7), c, tuple(x * 0.35 for x in farbe))       # Rille: Schmutz
    k.setze(b.inputs['Base Color'], c)
    k.setze(b.inputs['Roughness'], k.mixf(grat, 0.62, 0.36 if not neu else 0.5))
    k.relief(b, k.math('ADD', k.math('MULTIPLY', rille, 1.0), k.math('MULTIPLY', poren, 0.12)), 0.6, 0.0012)
    return m


def mat_horn(name, hell, dunkel, rillen=1.0, glanz=0.45):
    """Hirschhorn (Griff) und Horn (Knebel): Längsrillen mit dunklem Grund, die Rücken hell und glatt gegriffen."""
    m, nt, b = _nt(name); k = N(nt)
    rille = k.rauschen((170, 170, 7), 1.0, 4.0, 0.65); perlen = k.rauschen((260, 260, 260), 1.0, 2.0, 0.5)
    tief = k.math('SUBTRACT', 1.0, k.bereich(rille, 0.38, 0.62))
    c = k.mix(k.math('MULTIPLY', tief, rillen), hell, dunkel); c = k.mix(k.math('MULTIPLY', k.kante(), 0.5), c, tuple(min(1.0, x * 1.25) for x in hell))
    k.setze(b.inputs['Base Color'], c); k.setze(b.inputs['Roughness'], k.mixf(tief, glanz - 0.1, 0.7))
    try: b.inputs['Subsurface Weight'].default_value = 0.08; b.inputs['Subsurface Radius'].default_value = (0.004, 0.002, 0.001)
    except Exception as e: print('Streuung', e)
    k.relief(b, k.math('ADD', k.math('MULTIPLY', tief, -1.0 * rillen), k.math('MULTIPLY', perlen, 0.2)), 0.5, 0.0015)
    return m


def material(waffe, alt):
    """Zielmaterial für ein Material aus `waffenmodelle.py` (nach Name), mit den Griffstellen der Waffe."""
    n = alt.name; g = GRIFFE[waffe]; name = '%s_%s' % (waffe, n)
    if n == 'Steel': return mat_stahl(name, (0.56, 0.57, 0.59), 0.8 if waffe in ('axt', 'speer') else 0.25, 0.5, schneide={'axt': 0.0065, 'speer': 0.0028}.get(waffe, 0.0019))
    if n == 'DarkSteel': return mat_stahl(name, (0.30, 0.30, 0.31), 0.85, 0.75, glanz=0.42)
    if n in ('Blank', 'Schneide'): return mat_stahl(name, (0.62, 0.63, 0.65), 0.05, 0.1, glanz=0.20, schneide=0.0019)
    if n == 'Geblaeut': return mat_stahl(name, (0.30, 0.30, 0.31), 0.2, 0.2, blau=(0.05, 0.07, 0.16))
    if n == 'Blech': return mat_stahl(name, (0.50, 0.50, 0.50), 0.2, 0.6)
    if n == 'Messing': return mat_messing(name)
    if n in ('Hickory', 'HickoryGeoelt'): return mat_holz(name, (0.44, 0.31, 0.18), (0.17, 0.10, 0.05), g, oel=float(n.endswith('Geoelt')))
    if n in ('Esche', 'EscheGeoelt', 'LightWood'): return mat_holz(name, (0.47, 0.38, 0.25), (0.19, 0.135, 0.075), g, oel=float(n.endswith('Geoelt')))
    if n == 'DarkWood': return mat_holz(name, (0.24, 0.12, 0.055), (0.085, 0.04, 0.02), g, oel=0.6)      # Buche, geölt und gegriffen
    if n in ('Leder', 'LederNeu'): return mat_leder(name, (0.085, 0.042, 0.02), neu=n == 'LederNeu')
    if n == 'Hirschhorn': return mat_horn(name, (0.62, 0.52, 0.36), (0.10, 0.06, 0.03))
    if n == 'Horn': return mat_horn(name, (0.20, 0.15, 0.10), (0.03, 0.022, 0.016), rillen=0.6, glanz=0.32)
    print('WAFFENFRAME unbekanntes Material', n); return alt


# ───────────────────────────── Szene ─────────────────────────────
def baue_modelle():
    """`waffenmodelle.py` ausführen (baut alle Modelle in eine leere Szene und schreibt eine Kopie in den Cache)."""
    ziel = os.path.join(os.path.dirname(HIER), '.cache', 'bilder', 'waffen-r1', 'waffen-bau.glb')
    os.makedirs(os.path.dirname(ziel), exist_ok=True)
    argv = sys.argv[:]; sys.argv = [argv[0], '--', ziel]
    quelle = open(os.path.join(HIER, 'waffenmodelle.py'), encoding='utf-8').read()
    exec(compile(quelle, 'waffenmodelle.py', 'exec'), {'__name__': 'waffenmodelle'})
    sys.argv = argv


def untere_huelle(punkte):
    """Untere konvexe Hülle einer Punktmenge (x, z) — darauf liegt ein Körper auf einer Platte."""
    p = sorted(set(punkte)); h = []
    for q in p:
        while len(h) >= 2 and (h[-1][0] - h[-2][0]) * (q[1] - h[-2][1]) - (h[-1][1] - h[-2][1]) * (q[0] - h[-2][0]) <= 0: h.pop()
        h.append(q)
    return h


def lege(o, y):
    """Waffe auf die Werkbank legen: Achse nach x (Klinge nach links), Blatt flach; gekippt, bis die zwei tragenden
    Punkte der unteren Hülle unter dem Schwerpunkt beide aufliegen (Axt: Wange und Stielende)."""
    from mathutils import Matrix, Vector
    M = Matrix(((0, 0, 1, 0), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))            # z→x, x→y, y→z
    pts = [M @ v.co for v in o.data.vertices]
    # Schwerpunkt auf der Achse: aus den Flächen (Fläche × Lage) — für die Auflage genügt das
    fl = sum(p.area for p in o.data.polygons) or 1.0
    sx = sum((M @ p.center).x * p.area for p in o.data.polygons) / fl
    h = untere_huelle([(round(p.x, 4), round(p.z, 4)) for p in pts])
    a, b = h[0], h[-1]
    for i in range(len(h) - 1):
        if h[i][0] <= sx <= h[i + 1][0]: a, b = h[i], h[i + 1]; break
    kipp = math.atan2(b[1] - a[1], b[0] - a[0])
    R = Matrix.Rotation(kipp, 4, 'Y')                                              # dreht die Auflagekante waagrecht
    pts2 = [R @ p for p in pts]
    mitte = (min(p.x for p in pts2) + max(p.x for p in pts2)) / 2
    T = Matrix.Translation(Vector((-mitte, y, TISCH - min(p.z for p in pts2))))
    o.matrix_world = T @ R @ M
    print('WAFFENFRAME liegt', o.name, 'Kipp %.2f°' % math.degrees(kipp), 'Länge %.3f m' % (max(p.x for p in pts2) - min(p.x for p in pts2)))


def kanten(o):
    """Fase an harten Kanten, alles andere weich — die Spielmodelle sind flach schattiert und haben keine Normalen."""
    for p in o.data.polygons: p.use_smooth = True
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    try: bpy.ops.object.shade_smooth()
    except Exception as e: print('weich', e)
    f = o.modifiers.new('Fase', 'BEVEL'); f.width = 0.0004; f.segments = 2; f.limit_method = 'ANGLE'; f.angle_limit = math.radians(46)
    f.harden_normals = True
    w = o.modifiers.new('Normalen', 'WEIGHTED_NORMAL'); w.keep_sharp = False
    o.select_set(False)


def werkbank():
    """Bohlen 20 cm breit, 4,5 cm stark, mit Fugen; dahinter eine Bretterwand, darunter Lehmboden."""
    import random
    from mathutils import Vector
    rnd = random.Random(23)
    holz = mat_holz('Werkbank', (0.17, 0.115, 0.07), (0.055, 0.036, 0.022), (99.0,), alt=0.7, lang=5.0)
    wand = mat_holz('Wand', (0.12, 0.085, 0.055), (0.04, 0.028, 0.018), (99.0,), alt=0.8, lang=5.0)
    def brett(name, mitte, mass, mat, dreh=(0, 0, 0)):
        bpy.ops.mesh.primitive_cube_add(size=1, location=mitte); o = bpy.context.active_object; o.name = name
        o.scale = mass; o.rotation_euler = dreh; o.data.materials.append(mat)
        f = o.modifiers.new('Fase', 'BEVEL'); f.width = 0.004; f.segments = 2
        return o
    y = -0.72
    while y < 0.72:
        b = rnd.uniform(0.17, 0.23)
        # Maserung längs: die Bohle ist um 90° um y gedreht gebaut (Achse z des Materials = Länge)
        brett('Bohle', (rnd.uniform(-0.02, 0.02), y + b / 2, TISCH - 0.0225 - rnd.uniform(0, 0.002)), (0.045, b - 0.004, 2.9), holz, (0, math.pi / 2, 0))
        y += b
    for x in (-1.25, 1.25):
        for yy in (-0.6, 0.6): brett('Bein', (x, yy, (TISCH - 0.045) / 2), (0.09, 0.09, TISCH - 0.045), holz)
    x = -2.2
    while x < 2.2:
        b = rnd.uniform(0.16, 0.24)
        brett('Wandbrett', (x + b / 2, 1.05 + rnd.uniform(0, 0.006), 1.3), (b - 0.006, 0.03, 2.6), wand); x += b
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0)); bd = bpy.context.active_object; bd.name = 'Boden'
    m, nt, bs = _nt('Lehm'); k = N(nt); k.setze(bs.inputs['Base Color'], k.mix(k.rauschen((3, 3, 3)), (0.10, 0.075, 0.05), (0.17, 0.13, 0.09)))
    bs.inputs['Roughness'].default_value = 0.9; bd.data.materials.append(m)


def kamera(name, ort, ziel, brennweite):
    from mathutils import Vector
    cam = bpy.data.cameras.new(name); cam.lens = brennweite; cam.sensor_width = 36; cam.clip_start = 0.02
    o = bpy.data.objects.new(name, cam); bpy.context.scene.collection.objects.link(o)
    o.location = ort; o.rotation_euler = (Vector(ziel) - Vector(ort)).to_track_quat('-Z', 'Y').to_euler()
    cam.dof.use_dof = True; cam.dof.focus_distance = (Vector(ziel) - Vector(ort)).length; cam.dof.aperture_fstop = 5.6 if name != 'gesamt' else 11
    return o


def bild():
    from mathutils import Vector
    args = sys.argv[sys.argv.index('--') + 1:]
    aus, ansicht = args[1], args[2]
    breite, hoehe, spp = (int(args[3]), int(args[4]), int(args[5])) if len(args) > 5 else (1200, 860, 64)
    baue_modelle()                                   # leert die Szene (factory settings) und baut alle Waffen
    sys.path.insert(0, HIER)
    import hausframe as H                            # Himmel und Sonnenfarbe wie im Haus-Zielbild
    for o in list(bpy.data.objects):
        if o.name not in OBJEKT.values(): bpy.data.objects.remove(o, do_unlink=True)
    lage = {'speer': 0.50, 'axt': 0.22, 'messer': -0.04, 'klinge': -0.28, 'hirschfaenger': -0.50}
    for w in WAFFEN:
        o = bpy.data.objects[OBJEKT[w]]
        lege(o, lage[w])
        if not ROH:
            for i, slot in enumerate(o.material_slots): slot.material = material(w, slot.material)
            kanten(o)
    werkbank()
    H.himmel()
    sonne = bpy.data.objects['Sonne']                # Streiflicht von links vorn, 28° hoch: Kanten und Riefen zeichnen
    richt = Vector((-0.62, -0.50, 0.53)).normalized()
    sonne.rotation_euler = (-richt).to_track_quat('-Z', 'Y').to_euler(); sonne.data.angle = math.radians(2.5)
    if ansicht == 'gesamt':
        kam = kamera('gesamt', (0.0, -1.35, 2.75), (0.0, 0.0, TISCH), 40)
    else:
        o = bpy.data.objects[OBJEKT[ansicht]]
        ziel = o.matrix_world @ Vector((0, 0, NAH[ansicht]))
        kam = kamera(ansicht, (ziel.x + 0.04, ziel.y - 0.40, ziel.z + 0.58), ziel, 50)
    sc = bpy.context.scene; sc.camera = kam
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = spp
    sc.cycles.use_adaptive_sampling = True; sc.cycles.adaptive_threshold = 0.02
    sc.cycles.use_denoising = True; sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    sc.cycles.max_bounces = 6; sc.cycles.diffuse_bounces = 2; sc.cycles.glossy_bounces = 3; sc.cycles.sample_clamp_indirect = 4.0
    sc.render.threads_mode = 'FIXED'; sc.render.threads = int(os.environ.get('WAFFE_KERNE', '4'))
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = breite, hoehe, 100
    sc.view_settings.view_transform = 'AgX'
    try: sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception as e: print('Look', e)
    sc.view_settings.exposure = float(os.environ.get('WAFFE_EV', '0.1'))
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_depth = '8'
    sc.render.filepath = os.path.abspath(aus)
    bpy.ops.render.render(write_still=True)
    print('WAFFENFRAME Bild', aus, 'roh' if ROH else 'ziel')


# ───────────────────────────── Montage (ohne Blender) ─────────────────────────────
def blatt():
    """Bildpaare: je Waffe Foto │ heutiges Modell │ Zielbild, dazu Übersicht vorher │ nachher."""
    import json
    from PIL import Image, ImageDraw, ImageFont
    ordner, ref = sys.argv[2], sys.argv[3]
    quellen = json.load(open(os.path.join(ref, 'quellen.json'), encoding='utf-8'))
    def schrift(g, fett=False):
        for p in ('/System/Library/Fonts/Supplemental/Arial%s.ttf' % (' Bold' if fett else ''), '/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf' % ('-Bold' if fett else '')):
            if os.path.exists(p): return ImageFont.truetype(p, g)
        return ImageFont.load_default()
    def reihe(aus, unten, teile, h=640):
        bilder = [(t, Image.open(p).convert('RGB')) for t, p in teile if os.path.exists(p)]
        bilder = [(t, b.resize((round(b.width * h / b.height), h), Image.LANCZOS)) for t, b in bilder]
        w = sum(b.width for _, b in bilder) + 8 * (len(bilder) - 1)
        blatt_ = Image.new('RGB', (w, h + 44 + 36), (18, 18, 18)); d = ImageDraw.Draw(blatt_); x = 0
        for t, b in bilder:
            blatt_.paste(b, (x, 44)); d.text((x + 10, 10), t, font=schrift(24, True), fill=(235, 235, 235)); x += b.width + 8
        d.text((10, h + 52), unten, font=schrift(18), fill=(200, 200, 200)); blatt_.save(aus, quality=90); print('WAFFENFRAME Blatt', aus, blatt_.size)
    ref_name = {'speer': 'saufeder'}
    for w in WAFFEN:
        q = [x for x in quellen if x['waffe'] == ref_name.get(w, w)]
        if not q:      # ohne Foto (Abruf gesperrt): nur heute │ Zielbild, die Lücke steht in der Fusszeile
            reihe(os.path.join(ordner, 'paar-%s.jpg' % w), 'Kein Foto geladen (Abruf der Vorlage gesperrt) · Blender/Cycles, Standbild, keine Look-Abnahme',
                  [('heute im Spiel: %s' % NAMEN[w], os.path.join(ordner, 'roh-%s.png' % w)), ('Zielbild (Runde 1)', os.path.join(ordner, 'ziel-%s.png' % w))]); continue
        f = q[0]
        reihe(os.path.join(ordner, 'paar-%s.jpg' % w),
              'Foto: %s — %s, %s · Blender/Cycles, Standbild, keine Look-Abnahme · Maße und Gewicht unverändert (Spielwerte)' % (f['titel'].replace('File:', '')[:60], f['urheber'][:30], f['lizenz']),
              [('Foto', os.path.join(ref, f['datei'])), ('heute im Spiel: %s' % NAMEN[w], os.path.join(ordner, 'roh-%s.png' % w)), ('Zielbild (Runde 1)', os.path.join(ordner, 'ziel-%s.png' % w))])
    reihe(os.path.join(ordner, 'paar-gesamt.jpg'), 'Von oben: Saufeder, Fällaxt, Langes Messer, Klinge, Hirschfänger · Blender/Cycles, Standbild, keine Look-Abnahme',
          [('heute im Spiel', os.path.join(ordner, 'roh-gesamt.png')), ('Zielbild (Runde 1): Stahl, Holz, Leder, Horn mit Substanz', os.path.join(ordner, 'ziel-gesamt.png'))], h=760)


if __name__ == '__main__':
    if bpy and '--' in sys.argv: bild()
    elif len(sys.argv) > 1 and sys.argv[1] == 'blatt': blatt()
    else: print(__doc__)
