# BRACHLAND — Bodenpflanzen-Karten backen (D366): Waldboden in Schichten wie im verwilderten Wald.
#
#   blender --background --factory-startup --python tools/bodenkarten.py -- .cache/bodenkarten
#   python3 tools/efeukarten_pack.py .cache/bodenkarten 1024 bodenflach
#   python3 tools/efeukarten_pack.py .cache/bodenkarten 512 bodenbusch
#
# Zwei Atlanten zu je vier Kacheln, Pflanzen in echter Grösse (`content/massstab.json`, `messung: boden`):
#   bodenflach — Felder 1 × 1 m, von oben (wie `tools/streukarten.py`): 0 Sauerklee · 1 Moospolster ·
#                2 Waldmeister · 3 Kräuter und Keimlinge
#   bodenbusch — Büschel von der Seite, Kachel 0,8 × 0,8 m, Fuss am unteren Rand: 0 Waldmeister-/Kräuterbüschel ·
#                1 junge Brombeere · 2 Jungbuche · 3 Jungfichte
# Gebacken werden Grundfarbe (unbeleuchtet), Normale im Tangentenraum der Karte und Höhe (flach) bzw. Nähe zur
# Kamera (seitlich), wie bei Efeu und Streu. Dazu `public/material/boden-karten.json`: Kantenlänge und gemessene
# Pflanzenhöhe je Kachel — die Szene stellt die Karte damit in echter Grösse auf, das Maßstab-Tor prüft sie.
import bpy, bmesh, json, math, os, random, sys
from mathutils import Matrix, Vector

ziel = sys.argv[sys.argv.index('--') + 1]
os.makedirs(ziel, exist_ok=True)
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = {r['id']: r for r in json.load(open(os.path.join(REPO, 'content/massstab.json')))['referenzen']}
KANTE_FLACH, KANTE_BUSCH = 1.0, 0.8
AUFLOESUNG = {'bodenflach': 1024, 'bodenbusch': 768}
RADIUS = 0.44


def spanne(ref, t=None):
    r = REF[ref]; t = random.random() if t is None else t
    return r['min'] + (r['max'] - r['min']) * t


# ------------------------------------------------------------------ Geometrie in ein Netz mit Vertexfarbe
class Netz:
    def __init__(self):
        self.bm = bmesh.new()
        self.farbe = self.bm.loops.layers.float_color.new('farbe')
        self.zmax = 0.0
        self.seitlich = False

    def flaeche(self, punkte, farbe):
        vs = [self.bm.verts.new(p) for p in punkte]
        for p in punkte: self.zmax = max(self.zmax, p[2])
        f = self.bm.faces.new(vs)
        for l in f.loops: l[self.farbe] = (*farbe, 1)

    def blatt(self, fuss, richtung, oben, laenge, breite, umriss, farbe, woelb=0.12, haengen=0.0, n=10):
        """Spreite von `fuss` in `richtung`, Oberseite grob nach `oben`; `umriss(t)` = halbe Breite 0…0,5 bei t∈[0,1]."""
        y = Vector(richtung).normalized(); z = Vector(oben)
        if self.seitlich:   # Büschel von der Seite: Spreiten zur Kamera (−y) kippen, sonst liest jedes Blatt als Strich
            z = z + Vector((random.gauss(0, 0.4), -random.uniform(0.4, 1.1), 0))
        if abs(z.normalized().dot(y)) > 0.97: z = Vector((0, -1, 0)) if abs(y.y) < 0.9 else Vector((0, 0, 1))
        z = (z - y * z.dot(y)).normalized(); x = y.cross(z)
        def P(u, t):
            w = umriss(t) * breite * u
            h = woelb * breite * u * u - haengen * laenge * t * t
            return Vector(fuss) + y * (t * laenge) + x * w + z * h
        reihe = [(P(-1, i / n), P(0, i / n), P(1, i / n)) for i in range(n + 1)]
        for i in range(n):
            a, b = reihe[i], reihe[i + 1]
            for k in (0, 1):
                quad = [a[k], a[k + 1], b[k + 1], b[k]]
                if (quad[0] - quad[3]).length < 1e-6 and (quad[1] - quad[2]).length < 1e-6: continue
                self.flaeche(quad, farbe)

    def stiel(self, a, b, dicke, farbe, seiten=4):
        a, b = Vector(a), Vector(b); y = (b - a)
        if y.length < 1e-6: return
        y.normalize(); hilf = Vector((0, 0, 1)) if abs(y.z) < 0.9 else Vector((1, 0, 0))
        x = y.cross(hilf).normalized(); z = y.cross(x)
        ring = lambda p, r: [p + (x * math.cos(2 * math.pi * k / seiten) + z * math.sin(2 * math.pi * k / seiten)) * r for k in range(seiten)]
        r0, r1 = ring(a, dicke), ring(b, dicke * 0.7)
        for k in range(seiten):
            self.flaeche([r0[k], r0[(k + 1) % seiten], r1[(k + 1) % seiten], r1[k]], farbe)

    def kugel(self, mitte, r, farbe, flach=0.6, rauh=0.25):
        bm2 = bmesh.new(); bmesh.ops.create_icosphere(bm2, subdivisions=1, radius=1)
        for f in bm2.faces:
            pts = []
            for v in f.verts:
                k = 1 + (random.random() - 0.5) * rauh
                pts.append(Vector(mitte) + Vector((v.co.x * r * k, v.co.y * r * k, v.co.z * r * k * flach)))
            self.flaeche(pts, farbe)
        bm2.free()

    def mesh(self, name):
        me = bpy.data.meshes.new(name); self.bm.to_mesh(me); self.bm.free(); return me


# Umrisse (halbe Breite über die Länge)
LANZETT = lambda t: 0.5 * math.sin(math.pi * t) ** 0.8
OVAL = lambda t: 0.5 * math.sin(math.pi * min(1, t ** 0.85))
VERKEHRT = lambda t: 0.5 * math.sin(math.pi * min(1, t ** 1.7)) * (0.92 if t > 0.9 else 1)      # Sauerklee: breit vorn
GESAEGT = lambda t: OVAL(t) * (1 + 0.07 * math.sin(38 * t))


def gruen(basis, streu=0.18):
    k = 1 + (random.random() - 0.5) * streu
    return tuple(min(1, c * k * (1 + (random.random() - 0.5) * 0.08)) for c in basis)


SAUERKLEE = (0.20, 0.40, 0.09)
WALDMEISTER = (0.13, 0.30, 0.07)
MOOS = [(0.16, 0.30, 0.06), (0.22, 0.36, 0.08), (0.12, 0.22, 0.05), (0.26, 0.34, 0.09)]
BROMBEERE = (0.10, 0.22, 0.06)
BUCHE_JUNG = (0.21, 0.38, 0.09)
FICHTE = (0.06, 0.16, 0.06)
STIEL = (0.20, 0.25, 0.10)
HOLZ = (0.22, 0.15, 0.10)
RANKE = (0.28, 0.12, 0.09)
WEISS = (0.80, 0.80, 0.74)
LAUB = [(0.33, 0.17, 0.07), (0.42, 0.24, 0.10), (0.26, 0.14, 0.07)]


def rand_flach():
    """Lappiger, weicher Rand wie die Streufelder (D363): kein Quadrat, kein Kreis mit hartem Kern."""
    lappen = [(random.uniform(0, 6.283), a, k) for a, k in ((0.16, 2), (0.10, 3), (0.06, 5))]
    rand = lambda w: 1 - sum(a for _, a, _ in lappen) + sum(a * (1 + math.cos(k * w + ph)) for ph, a, k in lappen) * 0.5

    def frei():
        while True:
            x, y = random.uniform(-RADIUS, RADIUS), random.uniform(-RADIUS, RADIUS)
            r = math.hypot(x, y) / RADIUS / rand(math.atan2(y, x))
            if r < 1 and random.random() > max(0, (r - 0.35) / 0.65) ** 1.6: return x, y
    return frei


def richtung(winkel, steil):
    return Vector((math.cos(winkel) * math.cos(steil), math.sin(winkel) * math.cos(steil), math.sin(steil)))


# ------------------------------------------------------------------ Pflanzen
def sauerklee(n, x, y, skala=1.0):
    h = spanne('sauerklee', random.uniform(0, 0.8)) * skala   # Stiel; die Blättchen tragen noch 1–2 cm auf
    kopf = Vector((x + random.gauss(0, 0.01), y + random.gauss(0, 0.01), h))
    n.stiel((x, y, 0), kopf, 0.0012, gruen(STIEL))
    dreh = random.uniform(0, 6.283); f = gruen(SAUERKLEE)
    for k in range(3):
        w = dreh + k * 2.094
        # Blättchen 1–2 cm, fast waagerecht, an trüben Tagen halb gefaltet
        n.blatt(kopf, richtung(w, random.uniform(-0.35, 0.1)), (0, 0, 1), random.uniform(0.010, 0.017),
                random.uniform(0.013, 0.02), VERKEHRT, f, woelb=random.uniform(-0.3, 0.4), n=6)


def waldmeister(n, x, y, skala=1.0):
    h = spanne('waldmeister', random.uniform(0.08, 0.5)) * skala
    knick = Vector((random.gauss(0, 0.02), random.gauss(0, 0.02), 0))
    fuss = Vector((x, y, 0)); spitze = fuss + Vector((0, 0, h)) + knick
    n.stiel(fuss, spitze, 0.0015, gruen(STIEL))
    quirle = random.randint(3, 4); f = gruen(WALDMEISTER)
    for q in range(quirle):
        t = 0.35 + 0.65 * (q + 1) / quirle
        p = fuss.lerp(spitze, t); dreh = random.uniform(0, 1)
        zahl = random.randint(6, 8)
        for k in range(zahl):
            # Quirl aus 6–8 lanzettlichen Blättern 2–4 cm, oben kleiner
            n.blatt(p, richtung(dreh + k * 6.283 / zahl, random.uniform(-0.15, 0.25)), (0, 0, 1),
                    random.uniform(0.022, 0.04) * (1.1 - 0.35 * t), random.uniform(0.007, 0.011), LANZETT, f, haengen=0.15, n=5)
    if random.random() < 0.35:
        for _ in range(random.randint(4, 8)):
            n.kugel(spitze + Vector((random.gauss(0, 0.008), random.gauss(0, 0.008), 0.005 + random.random() * 0.01)), 0.0025, WEISS, 1, 0.1)


def moospolster(n, x, y):
    d = spanne('moospolster'); hoch = d * random.uniform(0.15, 0.3)
    farbe = random.choice(MOOS)
    for _ in range(int(900 * d * d / 0.04) + 20):
        a = random.uniform(0, 6.283); r = d / 2 * math.sqrt(random.random())
        z = hoch * math.sqrt(max(0, 1 - (2 * r / d) ** 2))
        n.kugel((x + math.cos(a) * r, y + math.sin(a) * r, z * random.uniform(0.75, 1)), random.uniform(0.004, 0.009),
                gruen(farbe, 0.3), flach=0.7, rauh=0.6)


def keimling(n, x, y):
    """Buchenkeimling: zwei breite Keimblätter, darüber die ersten zwei Laubblätter (5–12 cm hoch)."""
    h = random.uniform(0.05, 0.12); kopf = Vector((x, y, h))
    n.stiel((x, y, 0), kopf, 0.0015, gruen(STIEL))
    w = random.uniform(0, 6.283)
    for k in (0, math.pi):
        n.blatt(kopf - Vector((0, 0, h * 0.35)), richtung(w + k, 0.1), (0, 0, 1), 0.018, 0.024, OVAL, gruen((0.18, 0.34, 0.08)), n=5)
        n.blatt(kopf, richtung(w + k + 1.5, 0.15), (0, 0, 1), random.uniform(0.03, 0.05), 0.022, OVAL, gruen(BUCHE_JUNG), n=6)


def rosette(n, x, y):
    """Niedriges Kraut als Rosette (Platzhalter für Hain-Veilchen, Goldnessel, Sanikel)."""
    w0 = random.uniform(0, 6.283); f = gruen((0.12, 0.26, 0.07))
    for k in range(random.randint(4, 7)):
        n.blatt((x, y, 0.005), richtung(w0 + k * 1.1, random.uniform(0.2, 0.6)), (0, 0, 1), random.uniform(0.03, 0.06),
                random.uniform(0.02, 0.035), OVAL, f, haengen=0.25, n=6)


def brombeere(n, x, y):
    """Junge Brombeere: 3–5 bogige Triebe, Blätter dreizählig, Blättchen 4–7 cm."""
    hoehe = spanne('brombeere-jung')
    for _ in range(random.randint(3, 5)):
        w = random.uniform(0, 6.283); lang = hoehe * random.uniform(0.9, 1.3)
        p = Vector((x + random.gauss(0, 0.02), y + random.gauss(0, 0.02), 0)); steil = random.uniform(1.2, 1.45)
        schritte = 10
        for s in range(schritte):
            steil -= random.uniform(0.06, 0.1)
            q = p + richtung(w, steil) * (lang / schritte)
            if q.z > hoehe: q.z = hoehe - random.random() * 0.03
            q.x = max(-0.34, min(0.34, q.x)); q.y = max(-0.15, min(0.15, q.y))
            n.stiel(p, q, 0.003, RANKE)
            if s % 2 == 1:
                kopf = q + Vector((0, 0, 0.02)); f = gruen(BROMBEERE)
                n.stiel(q, kopf, 0.0012, RANKE)
                wb = w + random.uniform(-1.2, 1.2)
                for k, (dw, gr) in enumerate(((0, 1.0), (1.0, 0.8), (-1.0, 0.8))):
                    n.blatt(kopf, richtung(wb + dw, random.uniform(-0.3, 0.2)), (0, 0, 1), random.uniform(0.04, 0.07) * gr,
                            random.uniform(0.03, 0.045) * gr, GESAEGT, f, woelb=0.2, haengen=0.1, n=7)
            p = q


def jungbuche(n, x, y):
    hoehe = spanne('jungwuchs-buche'); p = Vector((x, y, 0)); w = random.uniform(0, 6.283)
    schritte = int(hoehe / 0.05) + 1
    for s in range(schritte):
        q = p + Vector((random.gauss(0, 0.008), random.gauss(0, 0.008), hoehe / schritte))
        n.stiel(p, q, 0.004 * (1 - 0.6 * s / schritte), HOLZ)
        if s > 0:
            w += 2.6   # wechselständig, zweizeilig
            gr = 1 - 0.3 * s / schritte
            # Buchenblätter liegen flach im Schatten (plagiotrop); junge Blätter 4–8 cm
            n.blatt(q, richtung(w, random.uniform(-0.1, 0.15)), (0, 0, 1), random.uniform(0.045, 0.075) * gr,
                    random.uniform(0.03, 0.045) * gr, OVAL, gruen(BUCHE_JUNG), woelb=0.15, n=7)
            if random.random() < 0.4 and s < schritte - 2:
                a = q.copy(); ws = w + random.uniform(-0.6, 0.6)
                for t in range(3):
                    b = a + richtung(ws, 0.25) * 0.05; n.stiel(a, b, 0.0015, HOLZ)
                    n.blatt(b, richtung(ws + (1.2 if t % 2 else -1.2), 0.05), (0, 0, 1), 0.045 * gr, 0.03 * gr, OVAL, gruen(BUCHE_JUNG), n=6)
                    a = b
        p = q


def jungfichte(n, x, y):
    hoehe = spanne('jungwuchs-fichte'); fuss = Vector((x, y, 0)); spitze = fuss + Vector((0, 0, hoehe))
    n.stiel(fuss, spitze, 0.005, HOLZ)
    quirle = max(2, int(hoehe / 0.09))
    for q in range(quirle):
        t = 0.2 + 0.75 * q / quirle; ort = fuss.lerp(spitze, t)
        lang = hoehe * 0.42 * (1 - t) + 0.02; dreh = random.uniform(0, 6.283)
        for k in range(random.randint(4, 5)):
            r = richtung(dreh + k * 6.283 / 5 + random.gauss(0, 0.2), random.uniform(0.05, 0.3))
            ende = ort + r * lang; n.stiel(ort, ende, 0.0015, HOLZ)
            for _ in range(int(lang / 0.0012)):
                a = ort.lerp(ende, random.random())
                n.stiel(a, a + (richtung(random.uniform(0, 6.283), random.uniform(-0.4, 0.9)) + r * 0.4).normalized()
                        * spanne("fichtennadel"), 0.0009, gruen(FICHTE, 0.25), seiten=3)
    for _ in range(260):   # Gipfeltrieb und Stamm benadelt
        a = fuss.lerp(spitze, random.uniform(0.15, 1) if random.random() < 0.5 else random.uniform(0.85, 1))
        n.stiel(a, a + richtung(random.uniform(0, 6.283), random.uniform(0.2, 1.2)) * spanne('fichtennadel'), 0.0007, gruen(FICHTE), seiten=3)


# ------------------------------------------------------------------ Felder (von oben) und Büschel (von der Seite)
def flach(nummer):
    random.seed(9100 + nummer * 131); n = Netz(); frei = rand_flach()
    if nummer == 0:                                 # Sauerklee: Klone in Flecken, dazwischen etwas Laub
        for _ in range(26):
            cx, cy = frei()
            for _ in range(random.randint(10, 28)):
                x, y = cx + random.gauss(0, 0.05), cy + random.gauss(0, 0.05)
                if math.hypot(x, y) < RADIUS: sauerklee(n, x, y)
        for _ in range(40):
            x, y = frei(); n.blatt((x, y, 0.002), richtung(random.uniform(0, 6.283), 0), (0, 0, 1), spanne('buchenblatt'), 0.045, OVAL, random.choice(LAUB), n=5)
    elif nummer == 1:                               # Moospolster auf Erhebungen
        for _ in range(14):
            x, y = frei(); moospolster(n, x, y)
    elif nummer == 2:                               # Waldmeister-Teppich
        for _ in range(10):
            cx, cy = frei()
            for _ in range(random.randint(6, 14)):
                x, y = cx + random.gauss(0, 0.06), cy + random.gauss(0, 0.06)
                if math.hypot(x, y) < RADIUS: waldmeister(n, x, y, 0.8)
    else:                                           # Kräuter, Keimlinge, wenig Sauerklee
        for _ in range(22): x, y = frei(); keimling(n, x, y)
        for _ in range(14): x, y = frei(); rosette(n, x, y)
        for _ in range(40): x, y = frei(); sauerklee(n, x, y, 0.8)
    return n


def busch(nummer):
    random.seed(9700 + nummer * 173); n = Netz(); n.seitlich = True
    if nummer == 0:
        for _ in range(22): waldmeister(n, random.gauss(0, 0.09), random.gauss(0, 0.06))
        for _ in range(6): rosette(n, random.gauss(0, 0.1), random.gauss(0, 0.05))
    elif nummer == 1: brombeere(n, 0, 0)
    elif nummer == 2: jungbuche(n, 0, 0)
    else: jungfichte(n, 0, 0)
    return n


# ------------------------------------------------------------------ Backen
def leere_szene(aufloesung, kante, seitlich):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sz = bpy.context.scene
    sz.render.engine = 'CYCLES'; sz.cycles.device = 'CPU'; sz.cycles.samples = 16
    sz.cycles.use_denoising = False; sz.render.film_transparent = True
    sz.render.resolution_x = sz.render.resolution_y = aufloesung
    sz.render.image_settings.file_format = 'PNG'; sz.render.image_settings.color_mode = 'RGBA'
    sz.render.image_settings.color_depth = '16'
    sz.world = bpy.data.worlds.new('schwarz')
    cam = bpy.data.objects.new('Kamera', bpy.data.cameras.new('Kamera')); sz.collection.objects.link(cam); sz.camera = cam
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = kante
    if seitlich: cam.location = (0, -2, kante / 2); cam.rotation_euler = (math.pi / 2, 0, 0)
    else: cam.location = (0, 0, 2)
    return sz


def material(art, seitlich, hmax):
    m = bpy.data.materials.new(art); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    aus = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(em.outputs[0], aus.inputs['Surface'])
    if art == 'farbe':
        at = nt.nodes.new('ShaderNodeAttribute'); at.attribute_name = 'farbe'
        nt.links.new(at.outputs['Color'], em.inputs['Color']); em.inputs['Strength'].default_value = 0.55
        return m
    geo = nt.nodes.new('ShaderNodeNewGeometry'); sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    if art == 'normal':
        nt.links.new(geo.outputs['Normal'], sep.inputs[0]); comb = nt.nodes.new('ShaderNodeCombineXYZ')
        if seitlich:   # Welt → Tangentenraum der Karte: x = x, y = z, z = −y (wie die Efeukarten)
            neg = nt.nodes.new('ShaderNodeMath'); neg.operation = 'MULTIPLY'; neg.inputs[1].default_value = -1
            nt.links.new(sep.outputs['Y'], neg.inputs[0])
            nt.links.new(sep.outputs['X'], comb.inputs['X']); nt.links.new(sep.outputs['Z'], comb.inputs['Y']); nt.links.new(neg.outputs[0], comb.inputs['Z'])
        else:
            for k in 'XYZ': nt.links.new(sep.outputs[k], comb.inputs[k])
        skal = nt.nodes.new('ShaderNodeVectorMath'); skal.operation = 'MULTIPLY_ADD'
        skal.inputs[1].default_value = (0.5, 0.5, 0.5); skal.inputs[2].default_value = (0.5, 0.5, 0.5)
        nt.links.new(comb.outputs[0], skal.inputs[0]); nt.links.new(skal.outputs[0], em.inputs['Color'])
        return m
    # Abstand: von oben die Höhe über Grund, von der Seite die Nähe zur Kamera (vorn hell, hinten dunkel)
    nt.links.new(geo.outputs['Position'], sep.inputs[0]); rng = nt.nodes.new('ShaderNodeMapRange')
    if seitlich:
        rng.inputs['From Min'].default_value = 0.2; rng.inputs['From Max'].default_value = -0.2
        nt.links.new(sep.outputs['Y'], rng.inputs['Value'])
    else:
        rng.inputs['From Max'].default_value = max(0.02, hmax)
        nt.links.new(sep.outputs['Z'], rng.inputs['Value'])
    comb = nt.nodes.new('ShaderNodeCombineColor')
    for k in ('Red', 'Green', 'Blue'): nt.links.new(rng.outputs['Result'], comb.inputs[k])
    nt.links.new(comb.outputs[0], em.inputs['Color'])
    return m


register = {'bodenflach': [], 'bodenbusch': []}
NAMEN = {'bodenflach': ['sauerklee', 'moospolster', 'waldmeister', 'kraeuter'],
         'bodenbusch': ['waldmeister', 'brombeere-jung', 'jungwuchs-buche', 'jungwuchs-fichte']}
for satz, seitlich, kante, bauer in (('bodenflach', False, KANTE_FLACH, flach), ('bodenbusch', True, KANTE_BUSCH, busch)):
    for nummer in range(4):
        hmax = None
        for art in ('farbe', 'normal', 'abstand'):
            netz = bauer(nummer)     # gleiche Saat: dieselbe Pflanze in allen drei Durchgängen
            hmax = netz.zmax
            sz = leere_szene(AUFLOESUNG[satz], kante, seitlich)
            sz.view_settings.view_transform = 'Standard' if art == 'farbe' else 'Raw'
            me = netz.mesh(f'{satz}{nummer}'); me.materials.append(material(art, seitlich, hmax))
            ob = bpy.data.objects.new('pflanze', me); sz.collection.objects.link(ob)
            sz.render.filepath = os.path.join(ziel, f'{satz}{nummer}-{art}.png')
            bpy.ops.render.render(write_still=True)
        register[satz].append({'kachel': nummer, 'name': NAMEN[satz][nummer], 'kante': kante, 'hoehe': round(hmax, 3)})
        print('KACHEL', satz, nummer, NAMEN[satz][nummer], 'HOEHE', round(hmax, 3))

with open(os.path.join(REPO, 'public/material/boden-karten.json'), 'w') as f:
    json.dump({'quelle': 'tools/bodenkarten.py (D366)', **register}, f, indent=1, ensure_ascii=False); f.write('\n')
