"""D384: Zielbild für die Tiere — Grathorn (Alpensteinbock), Wurzelkeiler (Wildschwein), Spürfuchs (Rotfuchs),
je rein und befallen, im Licht des Haus-Zielbildes (D373/D378). Nur Bild, nichts davon geht ins Spiel.

    B=/opt/blender/blender-5.3.0-linux-x64/blender
    $B --background --factory-startup --python tools/tierframe.py -- paar <tier> <aus.exr> [breite höhe samples]
    $B --background --factory-startup --python tools/tierframe.py -- nah <tier> <aus.exr> [breite höhe samples]
    $B --background --factory-startup --python tools/tierframe.py -- vorher <tier> <aus.exr> [breite höhe samples]
    $B --background --factory-startup --python tools/tierframe.py -- riss <tier> <aus.png> [breite höhe]
    $B --background --factory-startup --python tools/tierframe.py -- stil <ein.exr> <aus.png> <breite> <höhe>
    python3 tools/tierframe.py blatt <bilderordner> <referenzordner>        (Montage, ohne Blender)

<tier>: grathorn | wurzelkeiler | spuerfuchs. `TIER_OHNE=fell,szene` für schnelle Formprüfung.

Substanz real (ADR-0018): Der Körper ist ein Loft aus Querschnitten entlang von Wirbelsäule und Läufen
(Masse aus Bestimmungsliteratur, abgeglichen an `docs/referenz/REFERENZ_TIERE.md`), per Voxel-Remesh vereinigt.
Das Fell sind Haarkurven (je Tier 300.000–400.000 Strähnen, Strich aus dem Körperbau, in Locken gebündelt),
keine Textur. Der Befall ist Geometrie und folgt Wuchsregeln: Konsolen stehen waagrecht (Schwerkraft) und
sitzen an kahlen, alten Stellen; Moos nur oben, wo Wasser steht; Flechte auf Horn; Rinde als Platten mit Rissen.
Darstellung gemalt: Licht, Himmel und Stil kommen unverändert aus `hausframe.py` (nur importiert).
Lizenz: Tiere und Befall eigene Arbeit (CC0); Boden, Gras, Sträucher, Bäume, Rinde, Himmel Poly Haven CC0."""
import sys, os, math, json

try:
    import bpy
except ImportError:
    bpy = None

HIER = os.path.dirname(os.path.abspath(__file__))
TIERE = ('grathorn', 'wurzelkeiler', 'spuerfuchs')
NAMEN = {'grathorn': 'Grathorn', 'wurzelkeiler': 'Wurzelkeiler', 'spuerfuchs': 'Spürfuchs'}

if bpy:
    import numpy as np, bmesh, random
    from mathutils import Vector, Matrix, Quaternion
    from mathutils.bvhtree import BVHTree
    from mathutils.kdtree import KDTree
    sys.path.insert(0, HIER)
    import hausframe as H
    K = H.K
    ARGS = sys.argv[sys.argv.index('--') + 1:]
    OHNE = set(os.environ.get('TIER_OHNE', '').split(','))
    SIGNAL = H.SIGNAL
    KURS = math.radians(120.0)      # Kopf nach links vorn: die linke Flanke steht im Streiflicht der Sonne


# ───────────────────────────── Geometrie ─────────────────────────────
def catmull(P, unter):
    P = np.asarray(P, float); Q = np.vstack([2 * P[0] - P[1], P, 2 * P[-1] - P[-2]]); aus = []
    for i in range(len(P) - 1):
        p0, p1, p2, p3 = Q[i:i + 4]
        for s in np.linspace(0, 1, unter, endpoint=False):
            aus.append(0.5 * (2 * p1 + (p2 - p0) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s * s + (3 * p1 - p0 - 3 * p2 + p3) * s ** 3))
    aus.append(P[-1])
    return np.array(aus)


def bahn(punkte, unter=6, ref=(0, 1, 0)):
    """Punkte (x, y, z, ra, rb) → Mitten, Tangenten, Normale (ra), Binormale (rb), Radien."""
    C = catmull(punkte, unter); M = C[:, :3]; R = np.maximum(C[:, 3:5], 1e-4)
    T = np.gradient(M, axis=0); T /= np.linalg.norm(T, axis=1)[:, None]
    ref = np.asarray(ref, float)
    Bn = ref[None, :] - (T @ ref)[:, None] * T; Bn /= np.linalg.norm(Bn, axis=1)[:, None]
    N = np.cross(T, Bn)
    return M, T, N, Bn, R


def ringe_von(punkte, ringe=20, unter=6, ref=(0, 1, 0), kappe=(0.9, 0.9)):
    """Loft als Ringstapel (S, ringe, 3) mit runden Kappen (Faktor = Tiefe der Kappe in Radien; 0 = flach)."""
    M, T, N, Bn, R = bahn(punkte, unter, ref)
    a = np.linspace(0, 2 * math.pi, ringe, endpoint=False)
    def ring(m, n, b, ra, rb): return m[None, :] + np.outer(np.cos(a), n) * ra + np.outer(np.sin(a), b) * rb
    st = []
    for s in (0.95, 0.75, 0.45):
        f = math.sqrt(1 - s * s); st.append(ring(M[0] - T[0] * min(R[0]) * kappe[0] * s, N[0], Bn[0], R[0, 0] * f, R[0, 1] * f))
    for i in range(len(M)): st.append(ring(M[i], N[i], Bn[i], R[i, 0], R[i, 1]))
    for s in (0.45, 0.75, 0.95):
        f = math.sqrt(1 - s * s); st.append(ring(M[-1] + T[-1] * min(R[-1]) * kappe[1] * s, N[-1], Bn[-1], R[-1, 0] * f, R[-1, 1] * f))
    return np.array(st)


def haut_von(st):
    """Ringstapel → Punkte und Flächen (geschlossen, Deckel als Fächer)."""
    S, Rn, _ = st.shape; V = st.reshape(-1, 3); F = []
    for i in range(S - 1):
        for j in range(Rn):
            k = (j + 1) % Rn; F.append((i * Rn + j, i * Rn + k, (i + 1) * Rn + k, (i + 1) * Rn + j))
    V = np.vstack([V, st[0].mean(0), st[-1].mean(0)]); a, e = S * Rn, S * Rn + 1
    for j in range(Rn):
        k = (j + 1) % Rn; F.append((a, k, j)); F.append((e, (S - 1) * Rn + j, (S - 1) * Rn + k))
    return V, F


def rohr(punkte, **kw): return haut_von(ringe_von(punkte, **kw))


def kugel(mitte, radien, u=14, v=10):
    V = [(0, 0, 1)]; F = []
    for i in range(1, v):
        t = math.pi * i / v
        for j in range(u): V.append((math.sin(t) * math.cos(2 * math.pi * j / u), math.sin(t) * math.sin(2 * math.pi * j / u), math.cos(t)))
    V.append((0, 0, -1)); n = len(V) - 1
    for j in range(u):
        k = (j + 1) % u; F.append((0, 1 + j, 1 + k)); F.append((n, 1 + (v - 2) * u + k, 1 + (v - 2) * u + j))
        for i in range(v - 2): F.append((1 + i * u + j, 1 + (i + 1) * u + j, 1 + (i + 1) * u + k, 1 + i * u + k))
    return np.array(V) * np.asarray(radien, float) + np.asarray(mitte, float), F


def netz(name, V, F, glatt=True, eltern=None):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in V], [], [tuple(f) for f in F]); me.update()
    if glatt:
        for p in me.polygons: p.use_smooth = True
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    if eltern: o.parent = eltern
    return o


def sammle(teile):
    V = []; F = []; n = 0
    for v, f in teile:
        V.append(np.asarray(v)); F += [tuple(i + n for i in fl) for fl in f]; n += len(v)
    return np.vstack(V), F


def spiegel(p): return [(x, -y, z, a, b) for x, y, z, a, b in p]


def rausch(P, skala, saat=0, okt=3):
    """Wertrauschen 0..1, vektorisiert (Gitter-Hash, trilinear)."""
    aus = 0.0; amp = 1.0; ges = 0.0
    for o in range(okt):
        Q = P * (skala * 2 ** o) + saat * 17.13 + o * 5.7
        i = np.floor(Q).astype(np.int64); f = Q - i; f = f * f * (3 - 2 * f)
        def h(dx, dy, dz):
            n = (i[:, 0] + dx) * 374761393 + (i[:, 1] + dy) * 668265263 + (i[:, 2] + dz) * 1442695041
            n = (n ^ (n >> 13)) * 1274126177; n = n ^ (n >> 16)
            return (n & 0xffff) / 65535.0
        x0 = h(0, 0, 0) * (1 - f[:, 0]) + h(1, 0, 0) * f[:, 0]; x1 = h(0, 1, 0) * (1 - f[:, 0]) + h(1, 1, 0) * f[:, 0]
        x2 = h(0, 0, 1) * (1 - f[:, 0]) + h(1, 0, 1) * f[:, 0]; x3 = h(0, 1, 1) * (1 - f[:, 0]) + h(1, 1, 1) * f[:, 0]
        w = (x0 * (1 - f[:, 1]) + x1 * f[:, 1]) * (1 - f[:, 2]) + (x2 * (1 - f[:, 1]) + x3 * f[:, 1]) * f[:, 2]
        aus += amp * w; ges += amp; amp *= 0.5
    return aus / ges


def stufe(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def mische(a, b, f): return a * (1 - f[:, None]) + np.asarray(b, float)[None, :] * f[:, None] if np.ndim(b) == 1 else a * (1 - f[:, None]) + b * f[:, None]


# ───────────────────────────── Körperbau ─────────────────────────────
# Achsen im Tier: +X Kopf, +Y links, +Z oben, Boden z = 0, Meter. Punkte (x, y, z, ra, rb):
# ra = Radius in der Bahnebene (Rumpf: Höhe; Läufe: längs), rb = Radius quer.
def bein(p, schritt):
    """Laufpunkte links; rechts gespiegelt und um `schritt` versetzt (unten voll, oben nichts) — kein Stand wie aufgestellt."""
    n = len(p)
    re = [(x + schritt * (i / (n - 1)) ** 0.7, -y, z, a, b) for i, (x, y, z, a, b) in enumerate(p)]
    return p, re


def bau_grathorn():
    """Alpensteinbock, Bock — Runde 2 (D443): am Foto `grathorn-03.jpg` (rechtwinklige Seitenansicht) nachgebaut.
    Jeder Punkt ist dort abgenommen: X = (1120 − px) / 750, Z = (Boden(px) − py) / 750, Boden(px) = 1270 + 0,116·(px − 820)
    (der Bock steht am Hang; die Scherung stellt ihn gerade), Massstab 750 px/m aus Widerrist 0,95 m.
    Rumpf : Widerrist ≈ 1,2 : 1, Brust 58 % der Höhe tief, Rücken fällt zur Kruppe, Hals steil, Kopf schräg nach unten.
    Runde 1 war 35 % zu lang, der Rücken flach und zu hoch, der Kopf waagrecht (Messblatt `.cache/bilder/D443/mb-r1-grathorn.jpg`).
    Runde 4 (Flo: „zu grosser abgesackter Hintern“): Hinterkontur im Foto per Helligkeit abgenommen (Z 0,42–0,62 m) — das
    Modell lag dort 3–12 cm dahinter, die Keule hing als Kugel bis zum Knie. Keule kleiner und höher, Rumpfende flacher,
    Becken schmaler (Spur 24 statt 28 cm), Bauch in der Mitte tiefer und zur Kniefalte steigend; jetzt ±1–3 cm."""
    T = dict(name='grathorn', voxel=0.0075, glatt=int(os.environ.get('TIER_GLATT', '10')), teile=[], klumpen=[], fluss={}, widerrist=0.95)
    T['teile'].append(('rumpf', [(-0.468, 0, 0.688, 0.064, 0.05), (-0.400, 0, 0.685, 0.120, 0.085), (-0.307, 0, 0.668, 0.205, 0.145), (-0.107, 0, 0.628, 0.298, 0.215),
                                 (0.160, 0, 0.628, 0.310, 0.228), (0.360, 0, 0.660, 0.284, 0.22), (0.480, 0, 0.640, 0.262, 0.20), (0.565, 0, 0.590, 0.19, 0.16), (0.630, 0, 0.560, 0.125, 0.10)], (0, 1, 0), -1))   # Runde 4: Brust vorn voller, ohne Kugel unter dem Hals
    T['teile'].append(('hals', [(0.50, 0, 0.76, 0.19, 0.14), (0.60, 0, 0.72, 0.175, 0.13), (0.662, 0, 0.822, 0.150, 0.118), (0.742, 0, 0.935, 0.135, 0.100), (0.805, 0, 1.005, 0.100, 0.082)], (0, 1, 0), -1))
    # Kopf kastig und tief, Schnauze stumpf mit grossem Nasenende (grathorn-05, D444) — Runde 2a lief spitz zu wie ein Schnabel
    T['teile'].append(('kopf', [(0.79, 0, 1.025, 0.088, 0.078), (0.840, 0, 0.990, 0.095, 0.074), (0.900, 0, 0.905, 0.080, 0.062), (0.955, 0, 0.840, 0.066, 0.054), (0.990, 0, 0.805, 0.058, 0.050), (1.012, 0, 0.785, 0.048, 0.044)], (0, 1, 0), -1, (0.9, 0.45)))
    vl, vr = bein([(0.48, 0.13, 0.50, 0.12, 0.08), (0.44, 0.14, 0.342, 0.075, 0.055), (0.415, 0.137, 0.22, 0.05, 0.042), (0.405, 0.136, 0.15, 0.040, 0.036), (0.400, 0.136, 0.09, 0.034, 0.030), (0.395, 0.136, 0.045, 0.035, 0.034)], 0.06)
    hl, hr = bein([(-0.27, 0.105, 0.63, 0.125, 0.066), (-0.205, 0.115, 0.44, 0.098, 0.054), (-0.32, 0.120, 0.32, 0.062, 0.042), (-0.400, 0.12, 0.23, 0.044, 0.034), (-0.375, 0.12, 0.13, 0.032, 0.027), (-0.355, 0.12, 0.075, 0.035, 0.030), (-0.34, 0.12, 0.04, 0.035, 0.032)], 0.02)   # Runde 4: Becken schmal, Spur eng (grathorn-09)
    for n, p in (('vl', vl), ('vr', vr), ('hl', hl), ('hr', hr)): T['teile'].append((n, p, (0, 1, 0), 1))
    T['teile'].append(('schwanz', [(-0.46, 0, 0.735, 0.030, 0.035), (-0.53, 0, 0.71, 0.026, 0.030), (-0.59, 0, 0.66, 0.016, 0.02)], (0, 1, 0), 1))
    for s in (1, -1):
        T['teile'].append(('ohr', [(0.775, s * 0.060, 1.045, 0.012, 0.022), (0.765, s * 0.085, 1.10, 0.008, 0.028), (0.745, s * 0.098, 1.155, 0.004, 0.010)], (1, 0, 0.3), 1))
        T['klumpen'] += [((0.42, s * 0.15, 0.60), (0.14, 0.075, 0.18)), ((-0.29, s * 0.100, 0.650), (0.140, 0.060, 0.160)), ((0.885, s * 0.048, 0.86), (0.065, 0.026, 0.050)),
                         ((0.85, s * 0.055, 0.985), (0.035, 0.022, 0.026))]
    T['klumpen'] += [((0.40, 0, 0.88), (0.17, 0.09, 0.07)), ((0.815, 0, 1.03), (0.05, 0.055, 0.035)), ((0.935, 0, 0.79), (0.065, 0.042, 0.035))]   # Unterkiefer
    T['augen'] = dict(ort=(0.858, 0.066, 0.980), r=0.017, blick=(0.35, 1, -0.05), art='quer', iris=(0.40, 0.20, 0.04), lider=(0.38, -0.55))   # Iris bernstein-orange (grathorn-07)
    T['horn'] = dict(basis=(0.867, 1.066), scheitel=(0.427, 1.630), spitze=(0.013, 1.491))    # am Foto: Basis (470|430), Scheitel (800|45), Spitze (1110|185)
    T['orte'] = dict(spiegel=(-0.47, 0, 0.72), muffel=(1.005, 0, 0.795), bart=(0.955, 0, 0.75), nase=(1.012, 0, 0.785), vorn=0.42, hinten=-0.40, brust=(0.40, 0.60))
    T['kamera'] = dict(abstand=16.8, hoehe=0.95, paar=1.08, staffel=0.50, fokus=0.74)
    T['fell'] = dict(anzahl=300000, breite=0.0010, klump=45, staerke=0.30)   # D443: kurz und anliegend, kaum Locken — Runde 1 war „wollig wie ein Schaf“
    # Runde 4 (Knete): grob und gesprenkelt wie grathorn-03 — Büschel mit eigener Richtung und eigenem Ton, hell gespitzte Grannen,
    # Furchen dunkel, graue Unterwolle in den Scheiteln. Weiter kurz (kein Schaf), aber nicht mehr gekämmt.
    T['fell'].update(anzahl=420000, breite=0.0009, klump=14, staerke=0.40, streu=0.10, wirbel=0.20, buesche=0.06, hebklump=0.03, tonklump=0.10,
                     grannen=0.30, laengestreu=0.20, zufallrau=0.45, furche=(0.0008, 0.004, 0.45), wolle=(0.20, 0.30, 0.9, 0.002))
    T['orte']['auge'] = T['augen']['ort']
    if os.environ.get('TIER_ANATOMIE', '1') == '1':
        anatomie(T, dict(yv=0.135, yh=0.12, widerrist=(0.40, 0.95), schulter=(0.55, 0.60), ellbogen=(0.44, 0.40), karpus=(0.415, 0.24), fessel_v=(0.398, 0.07),
                         huefte=(-0.16, 0.86), sitzbein=(-0.44, 0.70), knie=(-0.17, 0.44), sprung=(-0.40, 0.25), fessel_h=(-0.36, 0.07), nacken=(0.78, 1.02),
                         schinken=(0.018, -0.05), leiste=-0.026, halsfalten=(0.35, 0.55, 0.75)))   # Runde 4 (grathorn-03/-09): Keule schmal, setzt hoch an, keine Wulst vor der Kniefalte
    return T


def bau_wurzelkeiler():
    """Wildschwein, Keiler: Widerrist 0,93 m, Keilkopf ein Drittel der Länge, hohe Schulter, abfallende Kruppe.
    Runde 2 (D443): Messblatt gegen `wurzelkeiler-03.jpg` (gespiegelt) zeigte Runde 1 hinten rund 0,24 m zu lang mit
    hängendem Schwanz. Rumpf gekürzt (Rumpf : Widerrist ≈ 1,15 : 1), Bauch 5 cm tiefer, Läufe frei nur noch ≈ 28 %
    (`wurzelkeiler-08`, ausgewachsen im Winterfell: 20–25 % inkl. Borsten), Buckel über der Schulter aus den langen
    Dornfortsätzen (Skelett `wurzelkeiler-10/-11`). Kopf vorn unverändert, damit Hauer und Nüstern sitzen bleiben."""
    T = dict(name='wurzelkeiler', voxel=0.0075, glatt=10, teile=[], klumpen=[], widerrist=0.93)
    T['teile'].append(('rumpf', [(-0.52, 0, 0.63, 0.075, 0.07), (-0.43, 0, 0.60, 0.20, 0.17), (-0.25, 0, 0.58, 0.27, 0.215), (-0.04, 0, 0.58, 0.31, 0.24), (0.22, 0, 0.60, 0.33, 0.23),
                                 (0.44, 0, 0.59, 0.28, 0.19), (0.62, 0, 0.56, 0.20, 0.150), (0.79, 0, 0.51, 0.140, 0.108), (0.93, 0, 0.45, 0.088, 0.070), (1.06, 0, 0.395, 0.058, 0.056)], (0, 1, 0), -1, (0.9, 0.12)))
    vl, vr = bein([(0.30, 0.145, 0.50, 0.105, 0.070), (0.27, 0.15, 0.36, 0.066, 0.050), (0.29, 0.148, 0.21, 0.040, 0.034), (0.29, 0.148, 0.10, 0.031, 0.029), (0.31, 0.148, 0.045, 0.033, 0.031)], 0.08)
    hl, hr = bein([(-0.36, 0.14, 0.50, 0.15, 0.082), (-0.28, 0.155, 0.37, 0.090, 0.058), (-0.45, 0.148, 0.25, 0.040, 0.033), (-0.43, 0.148, 0.10, 0.030, 0.028), (-0.41, 0.148, 0.045, 0.033, 0.030)], -0.08)
    for n, p in (('vl', vl), ('vr', vr), ('hl', hl), ('hr', hr)): T['teile'].append((n, p, (0, 1, 0), 1))
    T['teile'].append(('schwanz', [(-0.51, 0, 0.71, 0.022, 0.022), (-0.57, 0, 0.64, 0.014, 0.014), (-0.59, 0, 0.53, 0.009, 0.009), (-0.58, 0, 0.45, 0.007, 0.007)], (0, 1, 0), 1))
    for s in (1, -1):
        T['teile'].append(('ohr', [(0.70, s * 0.100, 0.73, 0.012, 0.048), (0.685, s * 0.130, 0.80, 0.008, 0.055), (0.67, s * 0.145, 0.87, 0.004, 0.018)], (1, 0, 0), 1))   # Runde 3: breit und flach (Teller), nicht Büschel
        T['klumpen'] += [((0.28, s * 0.16, 0.60), (0.15, 0.08, 0.20)), ((-0.35, s * 0.14, 0.54), (0.18, 0.085, 0.19)), ((0.70, s * 0.10, 0.50), (0.09, 0.035, 0.085)),
                         ((0.74, s * 0.088, 0.615), (0.035, 0.022, 0.024)), ((0.90, s * 0.058, 0.43), (0.05, 0.025, 0.03))]
    T['klumpen'] += [((0.30, 0, 0.88), (0.20, 0.075, 0.08))]
    T['augen'] = dict(ort=(0.775, 0.092, 0.585), r=0.012, blick=(0.45, 1, 0.15), art='rund', iris=(0.10, 0.045, 0.02))
    # Runde 2b (D443): Foto eines ausgewachsenen Keilers (iNaturalist 26, Kalabrien, CC BY-SA, Seitenansicht im Schritt)
    # zeigt den Rumpf hinter dem Widerrist um gut ein Fünftel kürzer: hintere Hälfte (x < 0,22) mit 0,78 gestaucht,
    # höchster Punkt über der Schulter statt in der Rückenmitte.
    def kurz(x): return 0.22 + (x - 0.22) * 0.78 if x < 0.22 else x
    for i, e in enumerate(T['teile']):
        if e[0] in ('rumpf', 'hl', 'hr', 'schwanz'):
            T['teile'][i] = (e[0], [(kurz(x), y, z, a, b) for x, y, z, a, b in e[1]]) + tuple(e[2:])
    T['klumpen'] = [((kurz(m[0]), m[1], m[2]), r) for m, r in T['klumpen']]
    # Kopf tiefer getragen (iNat 26 und 55: Rüssel auf gut einem Viertel der Widerristhöhe): um 28° um das Genick neigen.
    # `T['kopf']` bildet jeden Kopfpunkt ab — Hauer, Nüstern und Fellzonen nutzen dieselbe Abbildung.
    w_ = math.radians(float(os.environ.get('TIER_KOPF_NEIG', '28'))); gx, gz = 0.55, 0.60
    def kopf(x, z):
        if x <= gx: return x, z
        dx, dz = x - gx, z - gz
        return gx + dx * math.cos(w_) + dz * math.sin(w_), gz - dx * math.sin(w_) + dz * math.cos(w_)
    T['kopf'] = kopf
    T['anatomie'] = dict(yv=0.148, yh=0.148, schinken=(0.020, -0.07), leiste=-0.016, widerrist=(0.30, 0.93), schulter=(0.47, 0.56), ellbogen=(0.30, 0.34), karpus=(0.29, 0.17), fessel_v=(0.29, 0.06),
                         huefte=(-0.10, 0.80), sitzbein=(-0.30, 0.70), knie=(-0.15, 0.37), sprung=(-0.30, 0.23), fessel_h=(-0.29, 0.07), nacken=kopf(0.62, 0.78))
    for i, e in enumerate(T['teile']):
        if e[0] in ('rumpf', 'ohr'):
            T['teile'][i] = (e[0], [(*kopf(x, z)[:1], y, kopf(x, z)[1], a, b) for x, y, z, a, b in e[1]]) + tuple(e[2:])
    T['klumpen'] = [(((kopf(m[0], m[2])[0], m[1], kopf(m[0], m[2])[1])), r) for m, r in T['klumpen']]
    a_ = T['augen']; ax_, az_ = kopf(a_['ort'][0], a_['ort'][2]); a_['ort'] = (ax_, a_['ort'][1], az_); a_['blick'] = (a_['blick'][0], a_['blick'][1], a_['blick'][2] - 0.2)
    T['kamera'] = dict(abstand=16.8, hoehe=0.80, paar=1.10, staffel=0.50, fokus=0.58)
    if os.environ.get('TIER_ANATOMIE', '1') == '1': anatomie(T, T['anatomie'])
    T['fell'] = dict(anzahl=200000, breite=0.0015, klump=16, staerke=0.75)
    # Runde 4 (Knete): Borsten struppig mit grau-hellen Spitzen (iNat i26), Büschel stehen verschieden, braune Unterwolle in den Scheiteln
    T['fell'].update(anzahl=230000, streu=0.22, wirbel=0.25, buesche=0.12, hebklump=0.08, tonklump=0.14, grannen=0.35, laengestreu=0.30,
                     zufallrau=0.5, furche=(0.0008, 0.004, 0.40), wolle=(0.30, 0.40, 0.9, 0.006))
    return T


def bau_spuerfuchs():
    """Rotfuchs: Schulter 0,38 m, Rumpf 0,68 m, Lunte 0,40 m, schlanke Läufe, spitzer Fang, grosse Gehöre."""
    T = dict(name='spuerfuchs', voxel=0.003, glatt=8, teile=[], klumpen=[], widerrist=0.38)
    # Runde 2 (D443), Messblatt gegen `spuerfuchs-07.jpg` (gespiegelt, am Vorderlauf ausgerichtet — der Kopf ist dort zur
    # Kamera gedreht): Rücken lag 4–5 cm zu hoch, Rumpf hinten ~8 cm zu lang, Läufe zu weit gespreizt, Gehöre doppelt
    # so lang wie im Foto. Rumpf : Schulter ≈ 1,0 : 1, Brust 44 % tief, Lunte hängt im Stand fast bis zum Boden.
    T['teile'].append(('rumpf', [(-0.20, 0, 0.318, 0.036, 0.036), (-0.14, 0, 0.318, 0.060, 0.055), (-0.04, 0, 0.325, 0.056, 0.056), (0.05, 0, 0.310, 0.068, 0.064), (0.16, 0, 0.292, 0.080, 0.066),
                                 (0.235, 0, 0.312, 0.072, 0.056), (0.278, 0, 0.345, 0.060, 0.050), (0.305, 0, 0.375, 0.052, 0.045)], (0, 1, 0), -1))
    # Kopf am Profilfoto (Commons „'Frodo' Profile“, CC BY-SA, Messblatt an Auge und Nasenspitze): Schädeldach 3 cm höher,
    # Unterkiefer 2–3 cm tiefer als Runde 2a
    T['teile'].append(('kopf', [(0.310, 0, 0.420, 0.058, 0.052), (0.360, 0, 0.410, 0.058, 0.060), (0.415, 0, 0.378, 0.042, 0.036), (0.455, 0, 0.358, 0.033, 0.025), (0.488, 0, 0.352, 0.018, 0.016)], (0, 1, 0), -1))
    vl, vr = bein([(0.17, 0.050, 0.255, 0.045, 0.030), (0.150, 0.055, 0.190, 0.028, 0.021), (0.162, 0.055, 0.075, 0.015, 0.014), (0.170, 0.055, 0.028, 0.016, 0.017), (0.192, 0.055, 0.014, 0.012, 0.017)], 0.03)
    hl, hr = bein([(-0.12, 0.052, 0.290, 0.050, 0.031), (-0.090, 0.060, 0.220, 0.034, 0.023), (-0.150, 0.059, 0.165, 0.021, 0.017), (-0.175, 0.058, 0.125, 0.015, 0.014), (-0.170, 0.058, 0.035, 0.015, 0.015), (-0.142, 0.058, 0.014, 0.012, 0.017)], 0.02)
    for n, p in (('vl', vl), ('vr', vr), ('hl', hl), ('hr', hr)): T['teile'].append((n, p, (0, 1, 0), 1))
    T['teile'].append(('schwanz', [(-0.19, 0, 0.315, 0.024, 0.024), (-0.245, 0, 0.240, 0.028, 0.028), (-0.285, 0, 0.160, 0.030, 0.030), (-0.325, 0, 0.090, 0.022, 0.022), (-0.350, 0, 0.060, 0.010, 0.010)], (0, 1, 0), 1))
    for s in (1, -1):
        T['teile'].append(('ohr', [(0.345, s * 0.040, 0.452, 0.007, 0.030), (0.370, s * 0.050, 0.518, 0.005, 0.025), (0.398, s * 0.058, 0.572, 0.003, 0.006)], (1, 0, 0), 1))   # 9 cm, leicht nach vorn (Profilfoto)
        T['klumpen'] += [((0.358, s * 0.046, 0.382), (0.034, 0.020, 0.026)), ((0.20, s * 0.058, 0.30), (0.05, 0.028, 0.07)), ((-0.165, s * 0.052, 0.31), (0.048, 0.022, 0.052))]
    T['augen'] = dict(ort=(0.400, 0.037, 0.412), r=0.008, blick=(0.75, 1, 0.2), art='hoch', iris=(0.22, 0.11, 0.02))
    dreh = math.radians(float(os.environ.get('TIER_KOPF_DREH', '0')))   # D443: Kopf zur Kamera (+Y) drehen wie in den Fotos — nur fürs Messblatt
    if dreh:
        px, py = 0.305, 0.0
        def d(x, y): return px + (x - px) * math.cos(dreh) - (y - py) * math.sin(dreh), py + (x - px) * math.sin(dreh) + (y - py) * math.cos(dreh)
        for i, e in enumerate(T['teile']):
            if e[0] in ('kopf', 'ohr'):
                T['teile'][i] = (e[0], [(*d(x, y), z, a, b) for x, y, z, a, b in e[1]]) + tuple(e[2:])
        T['klumpen'] = [((*d(m[0], m[1]), m[2]), r) if m[0] > 0.32 else (m, r) for m, r in T['klumpen']]
        a = T['augen']; ax, ay = d(a['ort'][0], a['ort'][1]); a['ort'] = (ax, abs(ay), a['ort'][2])
    T['kamera'] = dict(abstand=8.0, hoehe=0.36, paar=0.50, staffel=0.28, fokus=0.34)
    if os.environ.get('TIER_ANATOMIE', '1') == '1':
        anatomie(T, dict(yv=0.055, yh=0.058, widerrist=(0.20, 0.37), schulter=(0.27, 0.29), ellbogen=(0.165, 0.21), karpus=(0.162, 0.075), fessel_v=(0.17, 0.028),
                         huefte=(-0.06, 0.33), sitzbein=(-0.16, 0.30), knie=(-0.09, 0.22), sprung=(-0.175, 0.125), fessel_h=(-0.168, 0.035), nacken=(0.30, 0.40),
                         schinken=(0.020, -0.06), leiste=-0.018))   # Runde 4: Keule las sich als Kugel mit Falte davor
    T['fell'] = dict(anzahl=205000, breite=0.00054, klump=24, staerke=0.5)
    # Runde 4 (Knete): Grannen über der Unterwolle (spuerfuchs-07), Büschel mit eigenem Ton, Furchen dunkel — weich, aber nicht Samt
    T['fell'].update(anzahl=240000, streu=0.14, wirbel=0.25, buesche=0.10, hebklump=0.05, tonklump=0.16, grannen=0.25, laengestreu=0.25, schwarzspitzen=0.14,
                     zufallrau=0.4, furche=(0.0004, 0.002, 0.40), wolle=(0.35, 0.45, 0.8, 0.010))
    return T


def anatomie(T, A):
    """D444: Muskeln und Gelenke über dem Skelett, als Wölbung der Haut. `A` sind Skelettpunkte (x, z) und die seitliche
    Lage der Läufe; daraus entstehen die grossen Muskelzüge (Schulterblatt mit Grätenmuskeln, Trizeps, Armkopfmuskel,
    Unterarm, Kruppe, hintere Oberschenkelmuskeln, Quadrizeps, Wadenmuskel) und Gelenkhöcker. Sie werden nicht als eigene
    Körper angesetzt — das ergab aufgesteckte Würste (Probe D444) —, sondern drücken nach dem Glätten die Haut entlang der
    Normalen nach aussen: Höhe a, Breite r, gaussförmig um die Muskelachse. Massstab ist die Widerristhöhe S, Lage nach den
    Skelettbildern (grathorn-10, wurzelkeiler-10/-11, spuerfuchs-09). Ohne sie war der Körper ein glatter Schlauch (D443)."""
    S = T['widerrist']; yv, yh = A['yv'], A['yh']; feld = []
    def m(pkt, a, r, y): return [(x, y, z) for x, z in pkt], a * S, r * S
    def mitte(a, b, t=0.5, dx=0.0, dz=0.0): return (a[0] + (b[0] - a[0]) * t + dx * S, a[1] + (b[1] - a[1]) * t + dz * S)
    for s in (1, -1):
        y1, y2 = s * yv * 1.15, s * yh * 1.15
        wo = (A['widerrist'][0] - 0.02 * S, A['widerrist'][1] - 0.12 * S)
        feld += [
            m([wo, mitte(wo, A['schulter'], 0.5), A['schulter']], 0.022, 0.07, y1),                                               # Schulterblatt, Grätenmuskeln
            m([mitte(wo, A['schulter'], 0.5, dx=-0.09), mitte(A['schulter'], A['ellbogen'], 0.5, dx=-0.08), A['ellbogen']], 0.030, 0.07, y1),   # Trizeps
            m([A['nacken'], mitte(A['nacken'], A['schulter'], 0.5), A['schulter']], 0.016, 0.05, y1 * 0.8),                     # Armkopfmuskel
            m([A['ellbogen'], mitte(A['ellbogen'], A['karpus'], 0.35, dx=0.01)], 0.016, 0.035, y1 * 0.9),                       # Unterarm
            m([(A['huefte'][0], A['huefte'][1] - 0.05 * S), mitte(A['huefte'], A['sitzbein'], 0.5, dz=-0.05)], 0.022, 0.08, y2),   # Kruppe
            m([A['sitzbein'], mitte(A['sitzbein'], A['knie'], 0.5, dx=A.get('schinken', (0.030, -0.10))[1]), mitte(A['knie'], A['sprung'], 0.3, dx=-0.03)], A.get('schinken', (0.030, -0.10))[0], 0.07, y2),   # hintere Oberschenkelmuskeln (Runde 4: beim Steinbock flacher und weiter vorn — die Hinterbacke hing durch)
            m([A['huefte'], mitte(A['huefte'], A['knie'], 0.55, dx=0.03), A['knie']], 0.024, 0.07, y2),                      # Quadrizeps
            m([mitte(A['knie'], A['sprung'], 0.15, dx=-0.05), mitte(A['knie'], A['sprung'], 0.45, dx=-0.04)], 0.018, 0.04, y2 * 0.9),   # Wadenmuskel
            m([(A['ellbogen'][0] - 0.035 * S, A['ellbogen'][1])], 0.012, 0.025, s * yv),                                         # Ellbogenhöcker
            m([A['karpus']], 0.008, 0.025, s * yv), m([A['fessel_v']], 0.006, 0.02, s * yv),
            m([(A['sprung'][0] - 0.035 * S, A['sprung'][1] + 0.01 * S)], 0.014, 0.025, s * yh),                                  # Fersenhöcker
            m([A['fessel_h']], 0.006, 0.02, s * yh), m([(A['knie'][0] + 0.02 * S, A['knie'][1])], 0.010, 0.03, s * yh),         # Kniescheibe
        ]
    # Runde 3: Rumpf gegliedert statt Tonne — Rippenkorb gewölbt, Rippenbogen als flache Kerbe, Hungergrube vor der
    # Hüfte, Bauch zur Leiste hochgezogen (grathorn-03, iNat i26, spuerfuchs-07); Läufe mit Beugesehne und schmalerem
    # Röhrbein. Negative Höhe zieht die Haut ein.
    E, Hf, K = A['ellbogen'], A['huefte'], A['knie']
    for s in (1, -1):
        feld += [
            m([(E[0] - 0.10 * S, E[1] + 0.16 * S), mitte(E, Hf, 0.45, dz=0.10)], 0.014, 0.11, s * yv * 1.35),                 # Rippenkorb
            m([(E[0] - 0.32 * S, E[1] + 0.02 * S), (Hf[0] + 0.22 * S, Hf[1] - 0.24 * S)], -0.004, 0.05, s * yv * 1.4),        # Rippenbogen (Runde 4: schmal und tief gab Fingerabdrücke im Ton)
            m([(Hf[0] + 0.12 * S, Hf[1] - 0.16 * S)], -0.012, 0.08, s * yh * 1.3),                                            # Hungergrube (Runde 4: war ein dunkles Loch in der Flanke)
            m([(K[0] + 0.06 * S, K[1] - 0.02 * S), (K[0] + 0.22 * S, K[1] - 0.08 * S)], A.get('leiste', -0.032), 0.08, s * 0.05 * S),           # Leiste: Bauch zur Kniefalte hochgezogen (an der Bauchlinie, nicht im Körper)
            m([(A['karpus'][0] - 0.025 * S, A['karpus'][1] - 0.03 * S), (A['fessel_v'][0] - 0.02 * S, A['fessel_v'][1] + 0.03 * S)], 0.005, 0.012, s * yv),   # Beugesehne vorn
            m([mitte(A['karpus'], A['fessel_v'], 0.5, dx=0.02)], -0.004, 0.016, s * yv),                                      # Röhrbein vorn flach
            m([(A['sprung'][0] - 0.02 * S, A['sprung'][1] - 0.03 * S), (A['fessel_h'][0] - 0.02 * S, A['fessel_h'][1] + 0.03 * S)], 0.005, 0.012, s * yh),   # Beugesehne hinten
            m([mitte(A['sprung'], A['fessel_h'], 0.5, dx=0.02)], -0.004, 0.016, s * yh),
        ]
    # Runde 4 (Knete): Knochenpunkte unter der Haut und Hautfalten — harte Stellen zwischen den weichen Muskeln
    # (grathorn-03/-09, iNat i26, spuerfuchs-07): Schulterblattgräte, Hüft- und Sitzbeinhöcker, Kniefalte als Wulst vor der
    # Kniescheibe, Furche hinter dem Trizeps (Ellbogenfalte).
    W_ = A['widerrist']; Sp = A['schulter']; Sb = A['sitzbein']
    for s in (1, -1):
        feld += [
            m([(W_[0] - 0.03 * S, W_[1] - 0.10 * S), mitte((W_[0], W_[1] - 0.10 * S), Sp, 0.55, dx=0.01)], 0.007, 0.022, s * yv * 1.25),   # Schulterblattgräte
            m([(Hf[0] + 0.05 * S, Hf[1] - 0.01 * S)], 0.012, 0.035, s * yh * 1.30),                                           # Hüfthöcker
            m([(Sb[0] + 0.01 * S, Sb[1] + 0.01 * S)], 0.008, 0.030, s * yh * 0.75),                                           # Sitzbeinhöcker
            m([(K[0] + 0.05 * S, K[1] + 0.00 * S), (K[0] + 0.13 * S, K[1] + 0.16 * S)], 0.007, 0.022, s * yh * 1.20),          # Kniefalte
            m([(E[0] - 0.05 * S, E[1] + 0.05 * S), (E[0] - 0.11 * S, E[1] + 0.17 * S)], -0.006, 0.022, s * yv * 1.30),         # Ellbogenfalte
        ]
        for t_ in A.get('halsfalten', ()):   # Halsfalten des Bocks (grathorn-09): quer zum Hals, flach
            Nk, Sh = A['nacken'], (Sp[0] + 0.02 * S, Sp[1] + 0.12 * S); mx_, mz_ = Nk[0] + (Sh[0] - Nk[0]) * t_, Nk[1] + (Sh[1] - Nk[1]) * t_
            ax_, az_ = Sh[0] - Nk[0], Sh[1] - Nk[1]; l_ = math.hypot(ax_, az_); qx, qz = -az_ / l_, ax_ / l_
            feld.append(m([(mx_ - qx * 0.06 * S, mz_ - qz * 0.06 * S), (mx_ + qx * 0.06 * S, mz_ + qz * 0.06 * S)], -0.005, 0.020, s * yv * 0.85))
    T['muskelfeld'] = feld; T['glatt'] = A.get('glatt', T['glatt']); T['A'] = A; T['kante'] = A.get('kante', 2.6)
    if os.environ.get('TIER_POSE', '1') == '1': pose(T, A)


def pose(T, A):
    """Runde 3: Stand mit Gewichtsverlagerung statt vier Säulen — linker Vorderlauf entlastet vorgestellt, rechter trägt
    senkrecht, rechter Hinterlauf zurückgesetzt, linker leicht vor (wie grathorn-09, spuerfuchs-07). Scherung der Läufe
    vom Schulter- bzw. Hüftgelenk abwärts; Lauf-Lofts, Gelenkhöcker und Muskelfeld gehen mit, die Hufe sitzen am
    Laufende. `TIER_POSE=0` (Messblatt `umriss`) lässt die Läufe gerade."""
    S = T['widerrist']; mitte_x = (A['schulter'][0] + A['huefte'][0]) / 2
    zv, zh = A['schulter'][1], A['huefte'][1] * 0.8
    # Der Grundbau versetzt die rechten Läufe schon (`bein`, schritt); hier kommt die Gewichtsverlagerung dazu: linker Vorderlauf
    # deutlich vor (entlastet), rechter Hinterlauf zurück — vorher hob 0,08·S die Versetzung beim Steinbock gerade auf.
    schritt = {'vl': 0.17 * S, 'vr': -0.02 * S, 'hl': 0.05 * S, 'hr': -0.09 * S}
    def welches(x, y, z):
        if z > (zv if x > mitte_x else zh): return None
        return ('v' if x > mitte_x else 'h') + ('l' if y > 0 else 'r')
    def scher(x, z, bein):
        z0 = zv if bein[0] == 'v' else zh; t = min(1.0, max(0.0, (z0 - z) / z0))
        return x + schritt[bein] * t ** 1.2
    for i, e in enumerate(T['teile']):
        if e[0] in schritt:
            T['teile'][i] = (e[0], [(scher(x, z, e[0]), y, z, a, b) for x, y, z, a, b in e[1]]) + tuple(e[2:])
    neu = []
    for mt, r in T['klumpen']:
        b = welches(*mt); neu.append(((scher(mt[0], mt[2], b), mt[1], mt[2]), r) if b else (mt, r))
    T['klumpen'] = neu
    feld = []
    for pkt, a, r in T['muskelfeld']:
        q = []
        for x, y, z in pkt:
            b = welches(x, y, z); q.append((scher(x, z, b), y, z) if b else (x, y, z))
        feld.append((q, a, r))
    T['muskelfeld'] = feld


def muskeln_anlegen(T, me):
    """Hautwölbung aus `T['muskelfeld']`: jeder Punkt wandert um Σ a·g(d/r)·h(t) entlang seiner Normalen (d = Abstand zur
    Muskelachse, t = Lage längs der Achse 0…1). Danach Normalen neu.
    Runde 4 (Knete): g war gaussförmig und h = 1 — jeder Muskel ein Ballon mit kugeligen Enden. Jetzt flacher Rücken mit
    deutlicherem Rand (g = exp(−(d/r)^`KANTE`)) und Spindel längs (Muskelbauch, an den Enden in die Sehne auslaufend) —
    so liegen Muskelplatten nebeneinander wie im Foto statt Beulen."""
    n = len(me.vertices); P = np.zeros(n * 3); me.vertices.foreach_get('co', P); P = P.reshape(-1, 3)
    N = np.zeros(n * 3); me.vertices.foreach_get('normal', N); N = N.reshape(-1, 3)
    off = np.zeros(n); kante = float(os.environ.get('TIER_KANTE', T.get('kante', 2.6)))
    for pkt, a, r in T['muskelfeld']:
        Q = np.array(pkt, float)
        if len(Q) > 1:   # genauer Abstand zu den Strecken (Stützpunkte gaben bei hartem Rand Riefen)
            lg = np.linalg.norm(np.diff(Q, axis=0), axis=1); kum = np.concatenate([[0], np.cumsum(lg)]) / max(lg.sum(), 1e-9)
            d = np.full(n, 1e9); tl = np.zeros(n)
            for i in range(len(Q) - 1):
                ab = Q[i + 1] - Q[i]; t_ = np.clip(((P - Q[i]) @ ab) / max(ab @ ab, 1e-12), 0, 1)
                di = np.linalg.norm(P - (Q[i] + t_[:, None] * ab), axis=1); w_ = di < d
                d = np.where(w_, di, d); tl = np.where(w_, kum[i] + (kum[i + 1] - kum[i]) * t_, tl)
        else: d = np.linalg.norm(P - Q[0], axis=1); tl = None
        g = np.exp(-(d / r) ** kante)
        if tl is not None and kante > 2.0 and a > 0: g = g * np.sin(math.pi * (0.08 + 0.84 * tl)) ** 0.6   # Spindel
        off += a * g
    P = P + N * off[:, None]; me.vertices.foreach_set('co', P.ravel()); me.update()
    print('TIERFRAME Muskelfeld', len(T['muskelfeld']), 'Wölbung max %.3f m' % off.max(), 'Kante', kante)


BAU = {'grathorn': bau_grathorn, 'wurzelkeiler': bau_wurzelkeiler, 'spuerfuchs': bau_spuerfuchs} if bpy else {}


def koerper(T, eltern):
    """Lofts und Muskelklumpen zu einem Netz vereinigen (Voxel-Remesh), glätten; dazu die Stützbahnen für Strich und Zonen."""
    teile = []; stuetz = []
    for i, eintrag in enumerate(T['teile']):
        name, p, ref, richtung = eintrag[:4]; kappe = eintrag[4] if len(eintrag) > 4 else (0.9, 0.9)
        teile.append(rohr(p, ringe=22, ref=ref, kappe=kappe))
        M, Tn, _, _, R = bahn(p, 6, ref)
        t = np.linspace(0, 1, len(M))
        stuetz.append(np.column_stack([M, Tn * richtung, R.max(1), np.full(len(M), i), t]))
    for m, r in T['klumpen']: teile.append(kugel(m, r))
    V, F = sammle(teile)
    roh = netz('roh', V, F)
    md = roh.modifiers.new('Voxel', 'REMESH'); md.mode = 'VOXEL'; md.voxel_size = T['voxel']; md.use_smooth_shade = True
    ms = roh.modifiers.new('Glatt', 'SMOOTH'); ms.factor = 0.5; ms.iterations = T['glatt']
    me = bpy.data.meshes.new_from_object(roh.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(roh)
    if T.get('muskelfeld'): muskeln_anlegen(T, me)
    for p in me.polygons: p.use_smooth = True
    o = bpy.data.objects.new(T['name'] + '_koerper', me); bpy.context.scene.collection.objects.link(o); o.parent = eltern
    T['stuetz'] = np.vstack(stuetz); T['teilnamen'] = [e[0] for e in T['teile']]
    return o


class Feld:
    """Je Körperpunkt: Lage, Normale, nächster Teil und Lauf-Parameter, Strichrichtung."""
    def __init__(s, T, me):
        n = len(me.vertices)
        P = np.zeros(n * 3); me.vertices.foreach_get('co', P); s.P = P.reshape(-1, 3)
        N = np.zeros(n * 3); me.vertices.foreach_get('normal', N); s.N = N.reshape(-1, 3)
        St = T['stuetz']; s.teil = np.zeros(n, int); s.t = np.zeros(n); s.fluss = np.zeros((n, 3)); s.namen = T['teilnamen']
        for a in range(0, n, 4000):
            p = s.P[a:a + 4000]
            d = np.linalg.norm(p[:, None, :] - St[None, :, :3], axis=2) / St[None, :, 6]
            k = d.argmin(1); s.teil[a:a + 4000] = St[k, 7].astype(int); s.t[a:a + 4000] = St[k, 8]
            w = np.exp(-((d - d.min(1)[:, None]) / 0.30) ** 2)
            s.fluss[a:a + 4000] = (w[:, :, None] * St[None, :, 3:6]).sum(1) / w.sum(1)[:, None]
        s.x, s.y, s.z = s.P[:, 0], s.P[:, 1], s.P[:, 2]

    def ist(s, *namen):
        idx = [i for i, n in enumerate(s.namen) if n in namen]
        return np.isin(s.teil, idx)

    def nah(s, ort, r):
        """Weiche Kugelmaske um einen Ort."""
        return 1 - stufe(np.linalg.norm(s.P - np.asarray(ort, float), axis=1), r * 0.55, r)


# ───────────────────────────── Fell je Tier ─────────────────────────────
# Rückgabe je Punkt: Länge (m), Dichte 0..1, Aufstellen 0..1, Farbe am Ansatz und an der Spitze, Haut, Nässe, Moos 0..1.
def lin(r, g, b): return np.array([r, g, b], float)


def fell_grathorn(F, befall):
    n = len(F.P); r1 = rausch(F.P, 7, 1); r2 = rausch(F.P, 26, 2); O = BAU['grathorn']()['orte']
    lauf = F.ist('vl', 'vr', 'hl', 'hr'); kopf = F.ist('kopf'); unten = stufe(-F.N[:, 2], 0.25, 0.75)
    farbe = np.tile(lin(0.060, 0.045, 0.035), (n, 1)) * (0.75 + 0.5 * r1)[:, None]
    farbe = mische(farbe, lin(0.135, 0.112, 0.090), stufe(F.z, 0.50, 0.80) * stufe(-F.x, -0.55, 0.30) * 0.75)      # Flanke und Keule heller, graubraun (grathorn-03/-05)
    fleck = rausch(F.P, 2.2, 41); farbe = farbe * (0.80 + 0.40 * fleck)[:, None]                                    # gesprenkelt in Flecken handgross
    farbe = mische(farbe, lin(0.024, 0.017, 0.013), stufe(F.x, *O['brust']) * (1 - stufe(F.z, 0.85, 1.0)) * (~kopf) * 0.8)       # Brust und Halsunterseite dunkel
    farbe = mische(farbe, lin(0.028, 0.020, 0.015), (1 - stufe(np.abs(F.y), 0.012, 0.05)) * stufe(F.N[:, 2], 0.6, 0.9) * (~kopf) * 0.8)   # Aalstrich
    farbe = mische(farbe, lin(0.33, 0.28, 0.20), unten * (~lauf) * stufe(-F.x, -0.42, -0.2))                            # Bauch hell
    farbe = mische(farbe, lin(0.018, 0.013, 0.010), lauf * stufe(F.t, 0.16, 0.42))
    farbe = mische(farbe, lin(0.022, 0.016, 0.012), stufe(-F.N[:, 2], -0.15, 0.25) * (1 - unten) * (~lauf) * stufe(-F.z, -0.62, -0.50) * (F.x < 0.35) * 0.75)   # dunkler Flankenstreif über dem hellen Bauch                                       # Läufe dunkel …
    farbe = mische(farbe, lin(0.26, 0.21, 0.15), lauf * stufe(F.t, 0.4, 0.6) * stufe(-F.fluss[:, 0] * 0 - (F.P[:, 0] - np.where(F.x > 0, O['vorn'], O['hinten'])), 0.0, 0.03) * 0.8)   # … hinten hell
    farbe = mische(farbe, lin(0.36, 0.31, 0.23), F.nah(O['spiegel'], 0.16) * stufe(-F.N[:, 0], 0.2, 0.7))            # Spiegel
    farbe = mische(farbe, lin(0.070, 0.052, 0.040), kopf.astype(float))
    farbe = mische(farbe, lin(0.22, 0.18, 0.13), F.nah(O['muffel'], 0.07) * 0.8)                                     # Muffel heller
    bart = kopf * F.nah(O['bart'], 0.06) * stufe(-F.N[:, 2], 0.3, 0.8)
    farbe = mische(farbe, lin(0.025, 0.018, 0.014), bart)
    laenge = np.full(n, 0.024) * (0.75 + 0.5 * r2)   # D444 (Runde 4: 2,4 cm; die Körnung kommt aus Büscheln und Grannen, nicht aus Länge): 1,8 cm las sich als Samt; Herbstfell 2–3 cm, ungleich
    laenge = np.where(lauf, 0.015 - 0.009 * stufe(F.t, 0.22, 0.55), laenge)   # Läufe schlank und anliegend (grathorn-03); Runde 4: Unterarm und Unterschenkel noch behaart wie der Rumpf, erst das Röhrbein kurz
    laenge = np.where(kopf, 0.012, laenge); laenge = np.where(F.ist('ohr'), 0.007, laenge)
    laenge = laenge * (1 - 0.35 * stufe(F.x, *O['brust']) * (~kopf))                # Hals und Brust kürzer: Bock, kein Schaf
    laenge += unten * (~lauf) * (~kopf) * 0.003 + bart * 0.045   # Sommerbart kurz (grathorn-03/-05)
    nase = F.nah(O['nase'], 0.034)
    # Gesicht (grathorn-05/-07): heller Augenring, dunkle Tränenrinne nach vorn unten, dunkle Nüstern, heller Lippensaum
    ax, ay, az = O['auge']; seite = np.sign(F.y) + (F.y == 0)
    d_auge = np.linalg.norm(F.P - np.column_stack([np.full(n, ax), seite * ay, np.full(n, az)]), axis=1)
    ring = kopf * stufe(d_auge, 0.016, 0.022) * (1 - stufe(d_auge, 0.030, 0.040))
    farbe = mische(farbe, lin(0.24, 0.21, 0.17), ring * 0.85)
    traene = kopf * (1 - stufe(np.abs((F.z - az) + 0.9 * (F.x - ax)), 0.006, 0.014)) * stufe(F.x, ax + 0.005, ax + 0.015) * (1 - stufe(F.x, ax + 0.05, ax + 0.07))
    farbe = mische(farbe, lin(0.020, 0.015, 0.012), traene * 0.8)
    nuester = kopf * F.nah((O['nase'][0] - 0.004, 0.020, O['nase'][2] + 0.004), 0.016) + kopf * F.nah((O['nase'][0] - 0.004, -0.020, O['nase'][2] + 0.004), 0.016)
    lippe = kopf * F.nah((O['nase'][0] - 0.02, 0, O['nase'][2] - 0.035), 0.035) * (1 - stufe(F.N[:, 2], -0.2, 0.3))
    farbe = mische(farbe, lin(0.30, 0.27, 0.22), lippe * 0.7)
    dichte = np.clip(1 - nase * 1.5 - ring * 0.3, 0, 1); heben = np.full(n, 0.05) + 0.25 * F.ist('schwanz') + 0.75 * bart
    spitze = farbe * 1.9 + 0.022                                                                                       # helle Haarspitzen: das Grau im Foto
    moos = np.zeros(n)
    if befall:
        moos = stufe(F.N[:, 2], 0.70, 0.9) * stufe(rausch(F.P, 6.5, 9) * 0.7 + rausch(F.P, 30, 10) * 0.3, 0.50, 0.58) * stufe(-F.x, -0.50, -0.30) * (~kopf) * (~lauf)
    haut = farbe * 0.55; haut = mische(haut, lin(0.012, 0.010, 0.010), nase); haut = mische(haut, lin(0.003, 0.002, 0.002), np.clip(nuester, 0, 1))
    return dict(laenge=laenge, dichte=dichte, heben=heben, farbe=farbe, spitze=spitze, haut=haut, nass=nase, moos=moos)


def fell_wurzelkeiler(F, befall):
    n = len(F.P); r1 = rausch(F.P, 6, 3); r2 = rausch(F.P, 30, 4); k_ = BAU['wurzelkeiler']().get('kopf', lambda x, z: (x, z))
    # Kopfzonen in ungeneigten Koordinaten messen: Punkte zurückdrehen (Neigung um das Genick ist eine Drehung)
    w_ = math.radians(float(os.environ.get('TIER_KOPF_NEIG', '28'))); gx, gz = 0.55, 0.60
    dx, dz = F.x - gx, F.z - gz; ux = np.where(F.x > gx, gx + dx * math.cos(w_) - dz * math.sin(w_), F.x); uz = np.where(F.x > gx, gz + dx * math.sin(w_) + dz * math.cos(w_), F.z)
    lauf = F.ist('vl', 'vr', 'hl', 'hr'); kopf = ux > 0.60; unten = stufe(-F.N[:, 2], 0.25, 0.75)
    farbe = np.tile(lin(0.030, 0.022, 0.017), (n, 1)) * (0.7 + 0.6 * r1)[:, None]
    farbe = mische(farbe, lin(0.060, 0.046, 0.034), stufe(F.z, 0.45, 0.75) * stufe(-F.x, -0.5, 0.1) * 0.6)
    farbe = mische(farbe, lin(0.012, 0.010, 0.009), lauf * stufe(F.t, 0.15, 0.4))
    farbe = mische(farbe, lin(0.014, 0.011, 0.010), stufe(ux, 0.80, 0.98))
    farbe = mische(farbe, lin(0.085, 0.070, 0.055), (F.nah((k_(0.72, 0.47)[0], 0.13, k_(0.72, 0.47)[1]), 0.13) + F.nah((k_(0.72, 0.47)[0], -0.13, k_(0.72, 0.47)[1]), 0.13)) * 0.7)       # Backen grau
    farbe = mische(farbe, lin(0.016, 0.012, 0.010), F.ist('ohr').astype(float))
    kamm = stufe(F.N[:, 2], 0.55, 0.9) * stufe(F.x, -0.25, 0.05) * (1 - stufe(F.x, 0.55, 0.72)) * (1 - stufe(np.abs(F.y), 0.05, 0.14))
    laenge = np.full(n, 0.046) * (0.75 + 0.5 * r2) + kamm * 0.040   # Kamm im Foto (iNat 26) gut 5 cm über dem Fell, nicht 12
    laenge = np.where(lauf, 0.04 - 0.030 * stufe(F.t, 0.08, 0.38), laenge)
    laenge = np.where(kopf, 0.05 - 0.038 * stufe(ux, 0.62, 0.82), laenge); laenge = np.where(F.ist('ohr'), 0.016, laenge)      # Teller mit kurzen schwarzen Borsten (Runde 3: 4,5 cm lasen sich als Büschel)
    quaste = F.ist('schwanz') * stufe(F.t, 0.6, 0.85)
    laenge = np.where(F.ist('schwanz'), 0.012 + 0.07 * quaste, laenge)
    scheibe = stufe(ux, 1.035, 1.055)
    dichte = np.clip(1 - scheibe * 2, 0, 1) * (0.75 + 0.25 * r1)
    heben = np.full(n, 0.20) + kamm * 0.50
    spitze = farbe * 1.6 + 0.008 + kamm[:, None] * lin(0.05, 0.04, 0.028)[None, :]                                          # helle Borstenspitzen: gesprenkelt
    haut = farbe * 0.7; haut = mische(haut, lin(0.060, 0.038, 0.034), scheibe)
    moos = np.zeros(n)
    if befall: moos = stufe(F.N[:, 2], 0.78, 0.92) * stufe(rausch(F.P, 7, 11), 0.50, 0.60) * stufe(-F.x, -0.1, 0.1) * 0.8
    return dict(laenge=laenge, dichte=dichte, heben=heben, farbe=farbe, spitze=spitze, haut=haut, nass=scheibe * 0.8, moos=moos)


def fell_spuerfuchs(F, befall):
    n = len(F.P); r1 = rausch(F.P, 14, 5); r2 = rausch(F.P, 60, 6)
    lauf = F.ist('vl', 'vr', 'hl', 'hr'); kopf = F.ist('kopf'); ohr = F.ist('ohr'); lunte = F.ist('schwanz') & (F.x < -0.20); unten = stufe(-F.N[:, 2], 0.1, 0.6)
    farbe = np.tile(lin(0.150, 0.034, 0.008), (n, 1)) * (0.7 + 0.6 * r1)[:, None]
    farbe = mische(farbe, lin(0.075, 0.020, 0.007), stufe(F.N[:, 2], 0.5, 0.9) * (~kopf) * 0.7)                              # Rücken satter, dunkler
    farbe = mische(farbe, lin(0.085, 0.060, 0.045), stufe(-F.x, -0.12, 0.12) * (~lunte) * (0.25 + 0.35 * stufe(rausch(F.P, 30, 7), 0.4, 0.6)) * (0.35 + 0.65 * stufe(-F.N[:, 0], -0.3, 0.5)))   # Runde 4: vor allem hinten an der Keule — die ganze Keule grau las sich als eigener Körper   # Keule und Kruppe dunkel überflogen       # Keule grau überflogen
    weiss = lin(0.46, 0.42, 0.36)
    farbe = mische(farbe, weiss, unten * (~lauf) * (~lunte) * stufe(F.x, -0.17, -0.05))                                       # Bauch
    farbe = mische(farbe, weiss, F.nah((0.275, 0, 0.30), 0.11) * stufe(F.N[:, 0] - F.N[:, 2], 0.0, 0.7))                        # Brustlatz
    farbe = mische(farbe, weiss, kopf * stufe(-F.N[:, 2], -0.05, 0.5) * stufe(F.x, 0.34, 0.40))                               # Kehle, Lefzen
    farbe = mische(farbe, lin(0.012, 0.010, 0.009), lauf * stufe(F.t, 0.18, 0.42))                                              # Strümpfe
    farbe = mische(farbe, lin(0.42, 0.37, 0.30), ohr * stufe(F.N[:, 0], 0.0, 0.5))                                                # Gehör innen hell
    farbe = mische(farbe, lin(0.014, 0.011, 0.010), ohr * np.maximum(stufe(-F.N[:, 0], -0.1, 0.3), stufe(F.z, 0.540, 0.565)))            # hinten und an der Spitze schwarz               # Gehör hinten schwarz
    farbe = mische(farbe, lin(0.10, 0.045, 0.02), lunte * 0.6)
    farbe = mische(farbe, lin(0.025, 0.018, 0.015), lunte * stufe(rausch(F.P, 40, 8), 0.42, 0.62) * 0.7)                           # schwarze Grannen in der Lunte
    farbe = mische(farbe, weiss, lunte * stufe(-F.x, 0.325, 0.350))                                                           # Blume
    laenge = np.full(n, 0.031) * (0.8 + 0.4 * r2) + F.nah((0.30, 0, 0.36), 0.10) * 0.012
    laenge = np.where(lauf, 0.013 - 0.004 * stufe(F.t, 0.03, 0.25), laenge)   # D444: Läufe dicht kurz behaart, nicht kahl
    laenge = np.where(kopf, 0.022 - 0.013 * stufe(F.x, 0.365, 0.440), laenge)   # Schnauze 9 mm statt 4: sonst scheint die Haut durch; laenge = np.where(ohr, 0.006, laenge)
    laenge = np.where(lunte, 0.060 * (1 - 0.45 * stufe(-F.x, 0.31, 0.355)), laenge)
    # Backenbart und Halskrause (spuerfuchs-05/-06): der Kopf ist breit durchs Fell, nicht durch den Schädel — fehlte in Runde 1
    backe = kopf * (F.nah((0.365, 0.050, 0.375), 0.040) + F.nah((0.365, -0.050, 0.375), 0.040)) * stufe(np.abs(F.N[:, 1]), 0.3, 0.8)
    krause = F.nah((0.29, 0, 0.36), 0.11) * (~kopf) * stufe(F.N[:, 2] + 0.3, 0.0, 0.6)   # Nacken und Halsseiten, nicht die Kehle
    laenge = laenge + backe * 0.028 + krause * 0.035
    keule = np.clip(F.nah((-0.12, 0.058, 0.26), 0.08) + F.nah((-0.12, -0.058, 0.26), 0.08), 0, 1) * (~lunte)
    laenge = laenge * (1 - 0.40 * keule)   # Runde 3: Keule las sich bauschig — dort anliegend (spuerfuchs-07)   # Profilfoto: Krause 4–6 cm über der Haut
    farbe = mische(farbe, weiss, backe * stufe(-F.N[:, 2], -0.3, 0.2) * 0.7)
    nase = F.nah((0.493, 0, 0.358), 0.013)
    dichte = np.clip(1 - nase * 2, 0, 1); heben = np.full(n, 0.26) + 0.32 * lunte + 0.12 * F.nah((0.30, 0, 0.36), 0.09) + 0.35 * backe
    spitze = farbe * 1.3 + 0.006
    haut = farbe * 0.6; haut = mische(haut, lin(0.010, 0.009, 0.009), nase)
    moos = np.zeros(n)
    if befall: moos = stufe(F.N[:, 2], 0.8, 0.93) * stufe(rausch(F.P, 16, 13), 0.56, 0.64) * stufe(-F.x, 0.05, 0.15) * (~lunte) * 0.7
    return dict(laenge=laenge, dichte=dichte, heben=heben, farbe=farbe, spitze=spitze, haut=haut, nass=nase, moos=moos)


FELL = {'grathorn': fell_grathorn, 'wurzelkeiler': fell_wurzelkeiler, 'spuerfuchs': fell_spuerfuchs}


def straehnen(name, me, F, W, anzahl, breite, klump, staerke, rng, eltern, schwer=0.22, punkte=5, streu=0.16, wirbel=0.0, buesche=0.0, grannen=0.0,
              laengestreu=0.0, tonklump=0.0, hebklump=0.0, schwarzspitzen=0.0):
    """Haarkurven aus Feldern: Wurzeln flächen- und dichtegewichtet, Richtung = Strich in der Tangentialebene, angehoben,
    zur Spitze wieder angelegt; Strähnen laufen zu Locken zusammen (jede folgt der nächsten Leitsträhne).
    Runde 4 (Knete-Eindruck, Vergleich grathorn-03 auf gleichem Massstab): das Fell lag parallel gekämmt wie Plüsch.
    `wirbel` dreht den Strich grossräumig (rad, Rauschfeld: Wirbel und Scheitel an Schulter und Flanke), `buesche` dreht
    jedes Büschel als Ganzes, `hebklump` stellt einzelne Büschel auf, `tonklump` gibt Büscheln eigenen Ton (Licht und
    Schatten je Büschel statt glatter Haut), `grannen` = Anteil hell gespitzter Grannen (das Gesprenkelte im Foto),
    `laengestreu` = Streuung der Länge (log) — einzelne lange Haare brechen die Kontur."""
    me.calc_loop_triangles(); nt = len(me.loop_triangles)
    tri = np.zeros(nt * 3, np.int64); me.loop_triangles.foreach_get('vertices', tri); tri = tri.reshape(-1, 3)
    A, B, C = F.P[tri[:, 0]], F.P[tri[:, 1]], F.P[tri[:, 2]]
    gew = np.linalg.norm(np.cross(B - A, C - A), axis=1) * W['dichte'][tri].mean(1) * (W['laenge'][tri].mean(1) > 1e-4)
    if gew.sum() <= 0: return None
    wahl = rng.choice(nt, anzahl, p=gew / gew.sum())
    u = rng.random(anzahl); v = rng.random(anzahl); kipp = u + v > 1; u[kipp] = 1 - u[kipp]; v[kipp] = 1 - v[kipp]
    bz = np.column_stack([1 - u - v, u, v]); t3 = tri[wahl]
    def inter(x): return (x[t3] * (bz[:, :, None] if x.ndim == 2 else bz)).sum(1)
    wurzel = inter(F.P); nrm = inter(F.N); nrm /= np.linalg.norm(nrm, axis=1)[:, None]
    # Büschel: jede Strähne gehört zur nächsten Leitsträhne (vorher erst beim Zusammenziehen bestimmt)
    zu = np.arange(anzahl); nl = 1
    if klump > 1:
        leit = rng.choice(anzahl, max(8, anzahl // klump), replace=False); nl = len(leit)
        kd = KDTree(nl)
        for i, j in enumerate(leit): kd.insert(wurzel[j], i)
        kd.balance()
        gruppe = np.fromiter((kd.find(w)[1] for w in wurzel), np.int64, anzahl); zu = leit[gruppe]
    else: gruppe = np.zeros(anzahl, np.int64)
    fl = inter(W['fluss']); fl -= (fl * nrm).sum(1)[:, None] * nrm
    fl /= np.linalg.norm(fl, axis=1)[:, None] + 1e-9
    winkel = np.zeros(anzahl)
    if wirbel: winkel += wirbel * ((rausch(wurzel, 3.5, 61) - 0.5) * 2.0 + 0.6 * (rausch(wurzel, 11.0, 62) - 0.5) * 2.0)
    if buesche: winkel += rng.normal(0, buesche, nl)[gruppe]
    if wirbel or buesche:   # Drehung um die Normale (Rodrigues, fl ⟂ nrm)
        c, sn = np.cos(winkel)[:, None], np.sin(winkel)[:, None]; fl = fl * c + np.cross(nrm, fl) * sn
    fl += rng.normal(0, streu, fl.shape); fl -= (fl * nrm).sum(1)[:, None] * nrm; fl /= np.linalg.norm(fl, axis=1)[:, None] + 1e-9
    L = inter(W['laenge']) * rng.uniform(0.7, 1.25, anzahl)
    if laengestreu: L = L * np.exp(rng.normal(0, laengestreu, anzahl) - 0.5 * laengestreu ** 2)
    hb = inter(W['heben']) + rng.normal(0, 0.08, anzahl)
    if hebklump: hb = hb + np.abs(rng.normal(0, hebklump, nl))[gruppe]
    hb = np.clip(hb, 0.05, 1.0) * (math.pi / 2)
    d0 = fl * np.cos(hb)[:, None] + nrm * np.sin(hb)[:, None]
    s = np.linspace(0, 1, punkte)
    pos = wurzel[:, None, :] - nrm[:, None, :] * 0.0015 + L[:, None, None] * (s[None, :, None] * d0[:, None, :] - (s ** 2)[None, :, None] * nrm[:, None, :] * (np.sin(hb) * 0.55)[:, None, None]
                                                                             + (s ** 2)[None, :, None] * np.array([0, 0, -schwer])[None, None, :])
    if klump > 1:
        zug = (staerke * rng.uniform(0.5, 1.0, anzahl))[:, None, None] * (s ** 1.4)[None, :, None]
        pos = pos + (pos[zu] - pos) * zug
    cu = bpy.data.hair_curves.new(name); cu.add_curves([punkte] * anzahl)
    cu.attributes['position'].data.foreach_set('vector', pos.astype(np.float32).ravel())
    rad = (breite * 0.5) * rng.uniform(0.7, 1.3, anzahl)[:, None] * (1 - 0.85 * s ** 1.5)[None, :]
    cu.attributes.new('radius', 'FLOAT', 'POINT').data.foreach_set('value', rad.astype(np.float32).ravel())
    ton = rng.uniform(0.82, 1.18, anzahl)
    if tonklump: ton = ton * np.exp(rng.normal(0, tonklump, nl))[gruppe]
    ton = ton[:, None]; farbe = inter(W['farbe']) * ton; spitze = inter(W['spitze']) * ton
    if grannen:   # hell gespitzte Grannen zwischen dunklen: Spitzenhelle umverteilen, Mittel bleibt
        hell = rng.random(anzahl) < grannen; f_ = np.where(hell, 1.6, (1 - 1.6 * grannen) / (1 - grannen))[:, None]
        spitze = farbe + (spitze - farbe) * f_
    if schwarzspitzen:   # Fuchs: schwarz gespitzte Grannen, die das Rot strähnig überfliegen (spuerfuchs-07)
        sw = rng.random(anzahl) < schwarzspitzen; spitze = np.where(sw[:, None], spitze * 0.18, spitze)
    for attr, w in (('farbe', farbe), ('spitze', spitze)):
        cu.attributes.new(attr, 'FLOAT_COLOR', 'CURVE').data.foreach_set('color', np.column_stack([np.clip(w, 0, 1), np.ones(anzahl)]).astype(np.float32).ravel())
    o = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(o); o.parent = eltern
    return o


def furchen(me, P, N, schritte=24):
    """Runde 4: Höhlung je Körperpunkt (m) — wie tief der Punkt unter der geglätteten Haut liegt (Laplace-Glättung der
    Lage über die Kanten). In Furchen zwischen Muskeln, hinter Ellbogen und Knie, am Hals liegt das Fell im Schatten
    und gescheitelt: dort dunkler (Verdeckung), auf den Wölbungen heller. Vorher war jede Stelle gleich hell — Knete."""
    ne = len(me.edges); E = np.zeros(ne * 2, np.int64); me.edges.foreach_get('vertices', E); E = E.reshape(-1, 2)
    n = len(P); grad = np.bincount(E.ravel(), minlength=n).astype(float) + 1e-9; Q = P.copy()
    for _ in range(schritte):
        S = np.zeros_like(Q); np.add.at(S, E[:, 0], Q[E[:, 1]]); np.add.at(S, E[:, 1], Q[E[:, 0]])
        Q = 0.5 * Q + 0.5 * S / grad[:, None]
    return ((Q - P) * N).sum(1)


# ───────────────────────────── Materialien ─────────────────────────────
def mat_fell(name='Fell', rau=0.42, glanz=1.0, zufall=0.2):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear(); k = K(nt)
    out = nt.nodes.new('ShaderNodeOutputMaterial'); h = k.n('ShaderNodeBsdfHairPrincipled')
    info = k.n('ShaderNodeHairInfo')
    f = k.mix(k.math('POWER', info.outputs['Intercept'], 1.6), k.attr('farbe', 'Color'), k.attr('spitze', 'Color'))
    k.setze(h.inputs['Color'], f); h.inputs['Roughness'].default_value = rau; h.inputs['Radial Roughness'].default_value = 0.75
    for n_, w in (('Random Roughness', zufall), ('Coat', 0.0)):   # Runde 4: Glanz je Strähne streuen (zufall)
        if n_ in h.inputs: h.inputs[n_].default_value = w
    nt.links.new(info.outputs['Random'], h.inputs['Random']); nt.links.new(h.outputs[0], out.inputs['Surface'])
    return m


def mat_haut():
    m, k, b, out = H.neues_material('Haut', versatz=False)
    k.setze(b.inputs['Base Color'], k.attr('farbe', 'Color'))
    k.setze(b.inputs['Roughness'], k.mixf(k.attr('nass', 'Fac'), 0.85, 0.22))
    obj = k.n('ShaderNodeTexCoord').outputs['Object']
    bp = k.n('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.25; bp.inputs['Distance'].default_value = 0.002
    k.setze(bp.inputs['Height'], k.math('ADD', k.rauschen(obj, 380.0, 2.0), k.math('MULTIPLY', k.rauschen(obj, 70.0, 3.0), 3.0))); k.nt.links.new(bp.outputs[0], b.inputs['Normal'])
    return m


def mat_horn(flechte=0.0, name='Horn'):
    """Horn: dunkles Graubraun, in den Rillen dunkler, Längsfaser als Relief. Mit `flechte` wächst eine Kruste auf den
    Wetterseiten (oben, aussen) — graugrün mit ockergelben Lagern, echte Verschiebung."""
    m, k, b, out = H.neues_material(name, versatz=flechte > 0)
    obj = k.n('ShaderNodeTexCoord').outputs['Object']
    rille = k.attr('rille', 'Fac')
    grund = k.mix(k.rauschen(obj, 40.0, 3.0), (0.085, 0.062, 0.045), (0.20, 0.155, 0.105))
    grund = k.mix(k.bereich(rille, 0.0, 1.0), (0.030, 0.022, 0.018), grund)
    faser = k.rauschen(k.abbild(obj, (300, 300, 12)), 1.0, 2.0)
    hoehe = k.math('ADD', k.math('MULTIPLY', faser, 0.3), 0.0); rau = 0.55; farbe = grund
    if flechte > 0:
        nz = k.xyz(k.n('ShaderNodeNewGeometry').outputs['Normal'])[2]
        fleck = k.math('ADD', k.rauschen(obj, 16.0, 4.0, 0.65), k.math('MULTIPLY', nz, 0.10))
        maske = k.bereich(fleck, 0.60 - 0.16 * flechte, 0.66 - 0.16 * flechte, weich=True)
        vo = k.n('ShaderNodeTexVoronoi'); vo.inputs['Scale'].default_value = 260.0; k.nt.links.new(obj, vo.inputs['Vector'])
        kruste = k.mix(k.rauschen(obj, 90.0, 2.0), (0.30, 0.34, 0.25), (0.52, 0.55, 0.43))
        gelb = k.bereich(k.rauschen(obj, 34.0, 2.0), 0.60, 0.68, weich=True)
        kruste = k.mix(k.math('MULTIPLY', gelb, 0.8), kruste, (0.50, 0.38, 0.10))
        farbe = k.mix(maske, grund, kruste)
        hoehe = k.math('ADD', hoehe, k.math('MULTIPLY', maske, k.math('ADD', 1.2, k.math('MULTIPLY', vo.outputs['Distance'], 2.5))))
        rau = k.mixf(maske, 0.5, 0.95)
    H.abschluss(k, b, out, farbe, rau, hoehe, 0.0022 if flechte > 0 else 0.001, bump=0.5, mitte=0.0)
    if flechte <= 0: nt = m.node_tree; [nt.links.remove(l) for l in list(out.inputs['Displacement'].links)]
    return m


def mat_fest(name, farbe, rau, relief=0.0, skala=60.0, coat=0.0):
    m, k, b, out = H.neues_material(name, versatz=False)
    obj = k.n('ShaderNodeTexCoord').outputs['Object']
    r = k.rauschen(k.abbild(obj, (1, 1, 6)), skala, 3.0)
    k.setze(b.inputs['Base Color'], k.mix(r, tuple(x * 0.6 for x in farbe), tuple(min(1, x * 1.35) for x in farbe)))
    b.inputs['Roughness'].default_value = rau; b.inputs['Coat Weight'].default_value = coat
    if relief:
        bp = k.n('ShaderNodeBump'); bp.inputs['Strength'].default_value = relief; bp.inputs['Distance'].default_value = 0.002
        k.setze(bp.inputs['Height'], r); k.nt.links.new(bp.outputs[0], b.inputs['Normal'])
    return m


def mat_auge(art, iris, glimmen):
    """Auge mit Tiefe: Hornhaut als Klarlack über Iris und Pupille; Pupille je Art (quer: Steinbock, hoch: Fuchs).
    Befallen glimmt die Iris schwach in der Signalfarbe (Stilreferenz §4)."""
    m, k, b, out = H.neues_material('Auge_' + art, versatz=False)
    x, y, z = k.xyz(k.n('ShaderNodeTexCoord').outputs['Object'])
    quer = k.math('SQRT', k.math('ADD', k.math('MULTIPLY', y, y), k.math('MULTIPLY', z, z)))
    bx, bz = {'quer': (0.46, 0.17), 'hoch': (0.13, 0.42), 'rund': (0.30, 0.30)}[art]
    pup = k.math('MAXIMUM', k.math('DIVIDE', k.math('ABSOLUTE', y), bx), k.math('DIVIDE', k.math('ABSOLUTE', z), bz))
    in_pup = k.math('MULTIPLY', k.bereich(pup, 0.85, 1.0, 1.0, 0.0), k.math('GREATER_THAN', x, 0.0))
    in_iris = k.math('MULTIPLY', k.bereich(quer, 0.66, 0.74, 1.0, 0.0), k.math('GREATER_THAN', x, 0.0))
    strahl = k.rauschen(k.abbild(k.n('ShaderNodeTexCoord').outputs['Object'], (1, 30, 30)), 1.0, 2.0)
    f = k.mix(strahl, tuple(c * 0.55 for c in iris), tuple(min(1, c * 1.5) for c in iris))
    f = k.mix(in_iris, (0.012, 0.008, 0.006), f); f = k.mix(in_pup, f, (0.002, 0.002, 0.002))
    k.setze(b.inputs['Base Color'], f); b.inputs['Roughness'].default_value = 0.35
    b.inputs['Coat Weight'].default_value = 1.0; b.inputs['Coat Roughness'].default_value = 0.03
    if glimmen:
        k.setze(b.inputs['Emission Color'], SIGNAL); k.setze(b.inputs['Emission Strength'], k.math('MULTIPLY', k.math('SUBTRACT', in_iris, in_pup), 0.07))
    return m


def mat_pilz(art):
    """Hutoberseite: konzentrische Zonen aus dem Radius (UV.x), heller Zuwachsrand, samtig. Tramete ocker/umbra, Zunderschwamm grau."""
    m, k, b, out = H.neues_material('Pilz_' + art, versatz=False)
    uv = k.n('ShaderNodeTexCoord').outputs['UV']; r = k.xyz(uv)[0]
    obj = k.n('ShaderNodeTexCoord').outputs['Object']
    zufall = k.n('ShaderNodeObjectInfo').outputs['Random']
    rr = k.math('ADD', r, k.math('MULTIPLY', k.rauschen(obj, 22.0, 2.0), 0.10))
    zone = k.math('FRACT', k.math('ADD', k.math('MULTIPLY', rr, 7.0), zufall))
    ramp = k.n('ShaderNodeValToRGB'); k.setze(ramp.inputs[0], zone); el = ramp.color_ramp.elements
    if art == 'tramete': stops = [(0.0, (0.20, 0.085, 0.03)), (0.25, (0.42, 0.20, 0.07)), (0.5, (0.10, 0.07, 0.05)), (0.7, (0.30, 0.24, 0.18)), (0.85, (0.45, 0.25, 0.09)), (1.0, (0.20, 0.085, 0.03))]
    else: stops = [(0.0, (0.16, 0.15, 0.135)), (0.4, (0.30, 0.285, 0.26)), (0.7, (0.12, 0.105, 0.09)), (1.0, (0.16, 0.15, 0.135))]
    el[0].position, el[0].color = stops[0][0], (*stops[0][1], 1); el[1].position, el[1].color = stops[-1][0], (*stops[-1][1], 1)
    for p, c in stops[1:-1]: e = el.new(p); e.color = (*c, 1)
    rand = k.bereich(r, 0.90, 0.97, weich=True)
    farbe = k.mix(rand, ramp.outputs[0], (0.78, 0.70, 0.52) if art == 'tramete' else (0.50, 0.46, 0.38))     # cremeweisser Zuwachsrand (Fotobefund)
    farbe = k.mix(k.math('MULTIPLY', k.bereich(r, 0.0, 0.45, 1.0, 0.0), 0.55), farbe, (0.10, 0.12, 0.07))     # am Ansatz Algen/Moos: alt und feucht
    farbe = k.mix(1.0, farbe, k.mix(zufall, (0.78, 0.78, 0.78), (1.15, 1.12, 1.05)), 'MULTIPLY')
    bp = k.n('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.35; bp.inputs['Distance'].default_value = 0.004
    k.setze(bp.inputs['Height'], k.math('ADD', k.math('SINE', k.math('MULTIPLY', rr, 70.0)), k.math('MULTIPLY', k.rauschen(obj, 150.0, 2.0), 0.8)))
    k.nt.links.new(bp.outputs[0], b.inputs['Normal'])
    k.setze(b.inputs['Base Color'], farbe); b.inputs['Roughness'].default_value = 0.85
    b.inputs['Sheen Weight'].default_value = 0.4; b.inputs['Subsurface Weight'].default_value = 0.0
    return m


def mat_pilz_unten():
    """Unterseite: cremefarbene Fruchtschicht, Lamellen strahlig (UV.y = Winkel) mit Gabelungen aus Rauschen."""
    m, k, b, out = H.neues_material('Pilz_unten', versatz=False)
    uv = k.n('ShaderNodeTexCoord').outputs['UV']; r, w, _ = k.xyz(uv)
    obj = k.n('ShaderNodeTexCoord').outputs['Object']
    lam = k.math('SINE', k.math('ADD', k.math('MULTIPLY', w, 420.0), k.math('MULTIPLY', k.rauschen(obj, 60.0, 2.0), 5.0)))
    farbe = k.mix(k.bereich(lam, -1.0, 1.0), (0.30, 0.24, 0.15), (0.66, 0.58, 0.42))
    bp = k.n('ShaderNodeBump'); bp.inputs['Strength'].default_value = 1.0; bp.inputs['Distance'].default_value = 0.003
    k.setze(bp.inputs['Height'], lam); k.nt.links.new(bp.outputs[0], b.inputs['Normal'])
    k.setze(b.inputs['Base Color'], farbe); b.inputs['Roughness'].default_value = 0.8
    return m


def mat_rinde(name, skala, ton=(1.0, 1.0, 1.0), versatz=0.012, moos=0.6):
    """Rinde aus dem Kiefernrinden-Scan (Poly Haven, CC0), in den Rissen (Attribut `riss`) dunkel und feucht, oben vermoost."""
    m, k, b, out = H.neues_material(name)
    obj = k.abbild(k.n('ShaderNodeTexCoord').outputs['Object'], (skala, skala, skala))
    o_ = os.path.join(H.cc0_ordner(), 'rinde')
    diff = k.tex(obj, os.path.join(o_, 'pine_bark_diff_2k.jpg')); disp = k.tex(obj, os.path.join(o_, 'pine_bark_disp_2k.jpg'), farbe=False)
    rau = k.tex(obj, os.path.join(o_, 'pine_bark_rough_2k.jpg'), farbe=False)
    farbe = k.mix(1.0, k.farbton(diff, wert=0.75, satt=0.8), ton, 'MULTIPLY')
    riss = k.attr('riss', 'Fac')
    farbe = k.mix(k.bereich(riss, 0.35, 0.9), farbe, (0.018, 0.012, 0.009))
    if moos:
        nz = k.xyz(k.n('ShaderNodeNewGeometry').outputs['Normal'])[2]
        mm = k.math('MULTIPLY', k.bereich(k.math('ADD', nz, k.math('MULTIPLY', k.rauschen(obj, 3.0, 3.0), 0.7)), 1.05, 1.35, weich=True), moos)
        farbe = k.mix(mm, farbe, (0.085, 0.105, 0.035))
    H.abschluss(k, b, out, farbe, rau, k.grau(disp), versatz, bump=0.6, mitte=0.5)
    return m


def mat_flechte():
    """Krustenflechte als eigene Lage: fahl graugrün, Lager mit hellem Rand, trocken."""
    m, k, b, out = H.neues_material('Flechte')
    obj = k.n('ShaderNodeTexCoord').outputs['Object']
    riss = k.attr('riss', 'Fac')
    farbe = k.mix(k.rauschen(obj, 120.0, 3.0), (0.15, 0.18, 0.12), (0.32, 0.35, 0.27))
    farbe = k.mix(k.bereich(k.rauschen(obj, 45.0, 2.0), 0.62, 0.70, weich=True), farbe, (0.34, 0.26, 0.08))
    farbe = k.mix(k.bereich(riss, 0.3, 0.9), farbe, (0.05, 0.045, 0.035))
    vo = k.n('ShaderNodeTexVoronoi'); vo.inputs['Scale'].default_value = 520.0; k.nt.links.new(obj, vo.inputs['Vector'])
    H.abschluss(k, b, out, farbe, 0.95, vo.outputs['Distance'], 0.0012, bump=0.8, mitte=0.3)
    return m


def mat_signal():
    m = bpy.data.materials.new('Signal'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); e = nt.nodes.new('ShaderNodeEmission')
    e.inputs['Color'].default_value = (*SIGNAL, 1); e.inputs['Strength'].default_value = 14.0; nt.links.new(e.outputs[0], out.inputs['Surface'])
    return m


MAT = {}
def mat(schluessel, bauer):
    if schluessel not in MAT: MAT[schluessel] = bauer()
    return MAT[schluessel]


# ───────────────────────────── Hartteile ─────────────────────────────
def klaue(eltern, ort, laenge, breite, hoehe, material, spreiz=0.12):
    """Paarhuf: zwei Schalen, vorn spitz, hinten rund, Tragrand am Boden."""
    for s in (1, -1):
        x, y, z = ort
        p = [(x - laenge * 0.45, y + s * breite * 0.27, hoehe * 0.55, hoehe * 0.55, breite * 0.26), (x, y + s * breite * 0.29, hoehe * 0.50, hoehe * 0.52, breite * 0.27),
             (x + laenge * 0.40, y + s * breite * (0.27 + spreiz), hoehe * 0.33, hoehe * 0.34, breite * 0.20), (x + laenge * 0.62, y + s * breite * (0.24 + spreiz * 1.5), hoehe * 0.16, hoehe * 0.15, breite * 0.09)]
        o = netz('Klaue', *rohr(p, ringe=12, unter=4), eltern=eltern); o.data.materials.append(material)


def hart_grathorn(T, eltern, befall):
    """Hörner: 0,88 m, säbelförmig nach hinten, Querschnitt vorn breit; Schmuckknoten auf der Vorderkante, Jahresringe.
    Befallen trägt das Horn Flechte (hartes, altes Material — Wuchsregel)."""
    huf = mat('huf', lambda: mat_fest('Huf', (0.035, 0.030, 0.027), 0.45, 0.4, 90.0))
    horn = mat('horn_b' if befall else 'horn', lambda: mat_horn(1.0 if befall else 0.0, 'Horn_befallen' if befall else 'Horn'))
    for name, e in zip(T['teilnamen'], T['teile']):
        if name in ('vl', 'vr', 'hl', 'hr'):
            x, y, z = e[1][-1][:3]; klaue(eltern, (x + 0.005, y, 0), 0.075, 0.062, 0.05, huf)
    # Runde 2 (D443): Bogen durch Basis, Scheitel und Spitze, am Foto abgenommen (T['horn'])
    (bx, bz), (ax, az), (tx, tz) = T['horn']['basis'], T['horn']['scheitel'], T['horn']['spitze']
    d_ = 2 * (bx * (az - tz) + ax * (tz - bz) + tx * (bz - az))
    mx = ((bx * bx + bz * bz) * (az - tz) + (ax * ax + az * az) * (tz - bz) + (tx * tx + tz * tz) * (bz - az)) / d_
    mz = ((bx * bx + bz * bz) * (tx - ax) + (ax * ax + az * az) * (bx - tx) + (tx * tx + tz * tz) * (ax - bx)) / d_
    rk = math.hypot(bx - mx, bz - mz); w0 = math.atan2(bz - mz, bx - mx); w2 = math.atan2(tz - mz, tx - mx)
    if w2 < w0: w2 += 2 * math.pi
    mitte = np.array([mx, 0, mz])
    for s in (1, -1):
        pts = []
        for i in range(13):
            u = i / 12; ph = w0 + (w2 - w0) * u
            pts.append((mx + rk * math.cos(ph), s * (0.045 + 0.20 * u ** 1.4), mz + rk * math.sin(ph), 0.050 * (1 - u) ** 0.75 + 0.007, 0.033 * (1 - u) ** 0.8 + 0.006))
        st = ringe_von(pts, ringe=28, unter=14, kappe=(0.2, 1.5))
        S, Rn, _ = st.shape; mit = st.mean(1); rille = np.zeros((S, Rn))
        lauf = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(mit, axis=0), axis=1))]); lauf /= lauf[-1]
        for i in range(S):
            aussen = mit[i] - mitte; aussen[1] = 0; aussen /= np.linalg.norm(aussen)
            rad = st[i] - mit[i]; rl = np.linalg.norm(rad, axis=1)[:, None]; e_ = rad / np.maximum(rl, 1e-6)
            vorn = np.clip(e_ @ aussen, 0, 1) ** 1.5
            knoten = max(0.0, math.sin(2 * math.pi * lauf[i] * 15)) ** 2.5 * (1 - lauf[i]) ** 0.6 * (lauf[i] > 0.03) * (lauf[i] < 0.80)   # 12 Knoten, letztes Fünftel glatt (Foto grathorn-08)
            ringel = 0.5 + 0.5 * math.sin(2 * math.pi * lauf[i] * 85)
            st[i] += e_ * rl * (0.42 * knoten * vorn[:, None] + 0.035 * ringel)
            rille[i] = 1 - np.clip(knoten * vorn * 1.6 + ringel * 0.35, 0, 1)
        V, F = haut_von(st)
        o = netz('Horn', V, F, eltern=eltern); o.data.materials.append(horn)
        a = o.data.attributes.new('rille', 'FLOAT', 'POINT'); a.data.foreach_set('value', np.concatenate([rille.ravel(), [0, 0]]).astype(np.float32))
        if befall: H.adaptiv(o, 1.5, glatt=True)
    return


def hart_wurzelkeiler(T, eltern, befall):
    huf = mat('huf', lambda: mat_fest('Huf', (0.035, 0.030, 0.027), 0.45, 0.4, 90.0))
    zahn = mat('zahn', lambda: mat_fest('Hauer', (0.62, 0.52, 0.33), 0.35, 0.3, 40.0, coat=0.3))
    for name, e in zip(T['teilnamen'], T['teile']):
        if name in ('vl', 'vr', 'hl', 'hr'):
            x, y, z = e[1][-1][:3]; klaue(eltern, (x + 0.005, y, 0), 0.07, 0.066, 0.045, huf)
    for s in (1, -1):
        gewehr = [(0.895, s * 0.060, 0.385, 0.012, 0.010), (0.915, s * 0.078, 0.415, 0.012, 0.010), (0.910, s * 0.096, 0.460, 0.009, 0.008), (0.885, s * 0.108, 0.495, 0.003, 0.003)]
        haderer = [(0.905, s * 0.064, 0.445, 0.011, 0.010), (0.925, s * 0.086, 0.452, 0.010, 0.009), (0.915, s * 0.100, 0.478, 0.004, 0.004)]
        k_ = T.get('kopf', lambda x, z: (x, z))
        gewehr = [(k_(x, z)[0], y, k_(x, z)[1], a, b) for x, y, z, a, b in gewehr]; haderer = [(k_(x, z)[0], y, k_(x, z)[1], a, b) for x, y, z, a, b in haderer]
        for p in (gewehr, haderer):
            o = netz('Hauer', *rohr(p, ringe=10, unter=6, ref=(1, 0, 0), kappe=(0.5, 1.5)), eltern=eltern); o.data.materials.append(zahn)
        # Nüstern: zwei dunkle Mulden in der Rüsselscheibe
        nx_, nz_ = k_(1.068, 0.398); o = netz('Nuester', *kugel((nx_, s * 0.021, nz_), (0.006, 0.011, 0.014)), eltern=eltern)
        o.data.materials.append(mat('dunkel', lambda: mat_fest('Dunkel', (0.008, 0.006, 0.006), 0.4)))


def hart_spuerfuchs(T, eltern, befall):
    return


HART = {'grathorn': hart_grathorn, 'wurzelkeiler': hart_wurzelkeiler, 'spuerfuchs': hart_spuerfuchs}


def augen(T, eltern, bvh, befall):
    a = T['augen']; m = mat('auge_%s_%d' % (a['art'], befall), lambda: mat_auge(a['art'], a['iris'], befall))
    for s in (1, -1):
        ort = Vector((a['ort'][0], s * a['ort'][1], a['ort'][2])); blick = Vector((a['blick'][0], s * a['blick'][1], a['blick'][2])).normalized()
        tr = bvh.ray_cast(ort + blick * 0.3, -blick)
        if tr[0] is not None: ort = tr[0] - blick * a['r'] * 0.45
        V, F = kugel((0, 0, 0), (1, 1, 1), 20, 14)
        o = netz('Auge', V, F, eltern=eltern); o.scale = (a['r'],) * 3; o.location = ort
        o.rotation_euler = blick.to_track_quat('X', 'Z').to_euler(); o.data.materials.append(m)
        if a.get('lider'):   # D443: Ober- und Unterlid als Schale über dem Augapfel — ohne sie starrt jedes Auge (Befund Runde 1)
            V2, F2 = kugel((0, 0, 0), (1.10, 1.10, 1.10), 20, 14); V2 = np.asarray(V2)
            oben, unten = a['lider']
            F2 = [f for f in F2 if V2[list(f), 2].mean() > oben or V2[list(f), 2].mean() < unten]
            ol = netz('Lid', V2, F2, eltern=eltern); ol.scale = (a['r'],) * 3; ol.location = ort; ol.rotation_euler = o.rotation_euler
            ol.data.materials.append(mat('lid', lambda: mat_fest('Lid', (0.010, 0.008, 0.007), 0.45, 0.2, 200.0)))


# ───────────────────────────── Befall ─────────────────────────────
def konsole_netz(rng, radius, dicke, art):
    """Ein Fruchtkörper: Halbscheibe mit gewelltem, gelapptem Rand; oben Zuwachswülste, unten gewölbte Fruchtschicht.
    Lokal: +X wächst vom Wirt weg, +Z oben. UV = (Radius 0..1, Winkel 0..1); Material 0 oben, 1 unten."""
    nr, nw = 14, 40; spann = math.radians(rng.uniform(95, 115))
    w = np.linspace(-spann, spann, nw); r = np.linspace(0, 1, nr) ** 0.8
    lapp = 1 + 0.10 * np.sin(w * rng.uniform(2.5, 4.5) + rng.uniform(0, 6)) + 0.05 * np.sin(w * rng.uniform(7, 11) + rng.uniform(0, 6))
    welle = 0.05 * np.sin(w * rng.uniform(5, 9) + rng.uniform(0, 6))
    R, W = np.meshgrid(r, w, indexing='ij'); ausl = radius * lapp[None, :] * R
    x = ausl * np.cos(W) * (1.15 if art == 'zunder' else 1.0); y = ausl * np.sin(W)
    wulst = 0.018 * radius * np.sin(R * math.pi * 2 * rng.uniform(3.5, 5.5)) * R
    if art == 'zunder':
        zo = dicke * (1 - R ** 1.6) * 0.95 + wulst; zu = -dicke * 0.10 * (1 - R ** 2) + 0.0 * R
    else:
        zo = dicke * 0.45 * (1 - R) ** 0.8 + wulst + radius * welle[None, :] * R ** 2 + 0.06 * radius * R ** 2 * rng.uniform(-1, 1)
        zu = zo - dicke * (0.18 + 0.82 * (1 - R) ** 1.2)
    zu = np.minimum(zu, zo - 0.0015)
    V = np.concatenate([np.stack([x, y, zo], -1).reshape(-1, 3), np.stack([x, y, zu], -1).reshape(-1, 3)]); n = nr * nw
    F = []; mi = []
    for i in range(nr - 1):
        for j in range(nw - 1):
            a = i * nw + j; F.append((a, a + nw, a + nw + 1, a + 1)); mi.append(0)
            F.append((n + a, n + a + 1, n + a + nw + 1, n + a + nw)); mi.append(1)
    for j in range(nw - 1):
        a = (nr - 1) * nw + j; F.append((a, n + a, n + a + 1, a + 1)); mi.append(0)
    for i in range(nr - 1):
        for j in (0, nw - 1):
            a = i * nw + j; F.append((a, a + nw, n + a + nw, n + a) if j else (a, n + a, n + a + nw, a + nw)); mi.append(1)
    me = bpy.data.meshes.new('Konsole'); me.from_pydata([tuple(v) for v in V], [], F); me.update()
    uv = np.concatenate([np.stack([R, (W / spann + 1) / 2], -1).reshape(-1, 2)] * 2)
    lage = me.uv_layers.new(name='UVMap'); li = np.zeros(len(me.loops), np.int64); me.loops.foreach_get('vertex_index', li)
    lage.data.foreach_set('uv', uv[li].astype(np.float32).ravel())
    me.polygons.foreach_set('material_index', mi); me.polygons.foreach_set('use_smooth', [True] * len(F))
    me.materials.append(mat('pilz_' + art, lambda: mat_pilz(art))); me.materials.append(mat('pilz_unten', mat_pilz_unten))
    return me


def setze_konsole(eltern, rng, ort, normale, radius, art='tramete', dicke=None, punkte=None, aus=None, heb=0.0):
    """Konsole waagrecht an den Wirt: wächst in Richtung der waagrechten Normalen, Ansatz ein Fünftel im Körper."""
    aus = Vector(aus) if aus is not None else Vector((normale[0], normale[1], 0))
    if aus.length < 0.25: aus = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0))
    aus.normalize()
    me = konsole_netz(rng, radius, dicke or radius * (0.55 if art == 'zunder' else 0.20), art)
    o = bpy.data.objects.new('Konsole', me); bpy.context.scene.collection.objects.link(o); o.parent = eltern
    q = aus.to_track_quat('X', 'Z') @ Quaternion((0, 1, 0), rng.uniform(-0.05, 0.22) - heb) @ Quaternion((1, 0, 0), rng.uniform(-0.18, 0.18))
    o.rotation_euler = q.to_euler(); o.location = Vector(ort) - aus * radius * 0.22
    if punkte is not None and rng.random() < 0.75:
        for _ in range(rng.integers(1, 3)):
            rr = rng.uniform(0.35, 0.85) * radius; ww = rng.uniform(-1.2, 1.2)
            punkte.append(o.matrix_basis @ Vector((rr * math.cos(ww), rr * math.sin(ww), radius * 0.06)))
    return o


def faecher(eltern, bvh, rng, von, nach, anzahl, gross, streu, art='tramete', punkte=None, wund=None, aus=None, heb=0.0):
    """Fächer aus Konsolen in Etagen um einen Ankerstrahl; die grösste in der Mitte, kleinere dachziegelartig darum."""
    von = Vector(von); richt = (Vector(nach) - von).normalized()
    quer = richt.cross(Vector((0, 0, 1))).normalized(); gesetzt = 0
    for i in range(anzahl * 3):
        if gesetzt >= anzahl: break
        f = gesetzt / max(1, anzahl - 1)
        a = von + quer * rng.normal(0, streu * (0.25 + 0.75 * f)) + Vector((0, 0, 1)) * rng.normal(0, streu * (0.3 + 0.6 * f))
        tr = bvh.ray_cast(a, richt)
        if tr[0] is None: continue
        r = gross * (1.0 - 0.62 * f) * rng.uniform(0.8, 1.15)
        setze_konsole(eltern, rng, tr[0], tr[1], r, art, punkte=punkte, aus=None if aus is None else (aus[0] + rng.normal(0, 0.25), aus[1] + rng.normal(0, 0.25), 0), heb=heb * rng.uniform(0.6, 1.2))
        if wund is not None: wund.append((np.array(tr[0]), r * 0.8))
        gesetzt += 1


def hutpilz(eltern, rng, ort, normale, hoehe, punkte=None):
    """Kleiner Hutpilz: Stiel wächst erst aus der Fläche, dann nach oben (Phototropie), Hut gewölbt."""
    n = Vector(normale); o_ = Vector(ort); oben = (n * 0.5 + Vector((0, 0, 1))).normalized()
    p = [(*(o_ - n * hoehe * 0.2), hoehe * 0.07, hoehe * 0.07), (*(o_ + n * hoehe * 0.3), hoehe * 0.06, hoehe * 0.06), (*(o_ + n * hoehe * 0.3 + oben * hoehe * 0.7), hoehe * 0.05, hoehe * 0.05)]
    stiel = netz('Stiel', *rohr(p, ringe=8, unter=4, ref=(0.3, 1, 0.2)), eltern=eltern); stiel.data.materials.append(mat('stiel', lambda: mat_fest('Stiel', (0.55, 0.47, 0.33), 0.8)))
    kopf = o_ + n * hoehe * 0.3 + oben * hoehe * 0.72; r = hoehe * rng.uniform(0.32, 0.5)
    V, F = kugel((0, 0, 0), (r, r, r * 0.55), 14, 8); V = V[:]; V[:, 2] = np.where(V[:, 2] < 0, V[:, 2] * 0.15, V[:, 2])
    hut = netz('Hut', V, F, eltern=eltern); hut.location = kopf; hut.rotation_euler = oben.to_track_quat('Z', 'Y').to_euler()
    hut.data.materials.append(mat('hut', lambda: mat_fest('Hut', (0.42, 0.25, 0.10), 0.6, 0.2, 200.0)))
    if punkte is not None and rng.random() < 0.5: punkte.append(kopf + oben * r * 0.5)


def platten(name, eltern, me, F, maske, dicke, zellen, rng, material, unterteilen=1):
    """Kruste als Schale über dem Körper: Fläche, wo die Maske trägt; in Platten zerlegt (Zellgrenzen = Risse), an den
    Rändern auf null auslaufend — wächst aus der Haut, liegt nicht auf. Gibt Objekt und Risspunkte zurück."""
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    weg = [v for v in bm.verts if maske[v.index] < 0.03]
    bmesh.ops.delete(bm, geom=weg, context='VERTS')
    if len(bm.faces) < 20: bm.free(); return None, []
    if unterteilen: bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=unterteilen, use_grid_fill=True)
    neu = bpy.data.meshes.new(name); bm.to_mesh(neu); bm.free(); neu.update()
    n = len(neu.vertices); P = np.zeros(n * 3); neu.vertices.foreach_get('co', P); P = P.reshape(-1, 3)
    N = np.zeros(n * 3); neu.vertices.foreach_get('normal', N); N = N.reshape(-1, 3)
    kd0 = KDTree(len(F.P))
    for i, p in enumerate(F.P): kd0.insert(p, i)
    kd0.balance(); mk = np.array([maske[kd0.find(p)[1]] for p in P])
    saat = P[rng.choice(n, max(4, int(zellen)), replace=False)]
    kd = KDTree(len(saat))
    for i, p in enumerate(saat): kd.insert(p, i)
    kd.balance(); f1 = np.zeros(n); f2 = np.zeros(n); zelle = np.zeros(n, int)
    for i, p in enumerate(P):
        (c1, i1, d1), (c2, i2, d2) = kd.find_n(p, 2); f1[i] = d1; f2[i] = d2; zelle[i] = i1
    weite = np.median(f2) * 0.5
    kante = np.clip((f2 - f1) / (weite * 0.45), 0, 1)                   # 0 im Riss, 1 auf der Platte
    hoch = np.random.default_rng(7).uniform(0.55, 1.0, len(saat))[zelle]
    prof = stufe(kante, 0.05, 0.6) * hoch * stufe(mk, 0.05, 0.5)
    P2 = P + N * (0.0012 + dicke * prof)[:, None]
    neu.vertices.foreach_set('co', P2.ravel()); neu.update()
    neu.attributes.new('riss', 'FLOAT', 'POINT').data.foreach_set('value', (1 - stufe(kante, 0.0, 0.35)).astype(np.float32))
    for p in neu.polygons: p.use_smooth = True
    o = bpy.data.objects.new(name, neu); bpy.context.scene.collection.objects.link(o); o.parent = eltern; neu.materials.append(material)
    risse = [(P[i], N[i]) for i in np.where((kante < 0.12) & (mk > 0.5))[0]]
    return o, risse


def wurzel(eltern, bvh, rng, start, richtung, schritte, r0, material, frei=6):
    """Wurzel kriecht über den Körper: Schritt in der Tangentialebene, Schwerkraft zieht, am Ende hängt sie frei."""
    p = Vector(start); d = Vector(richtung).normalized(); pts = []; nrm_m = Vector((0, 0, 0))
    for i in range(schritte):
        u = i / (schritte - 1); r = r0 * (1 - u) ** 0.8 + 0.0025
        if i < schritte - frei:
            ort, nrm, _, _ = bvh.find_nearest(p)
            if ort is None: break
            d = (d + Vector(rng.normal(0, 0.25, 3)) + Vector((0, 0, -0.10))); d -= nrm * d.dot(nrm); d.normalize()
            p = ort + nrm * r * (0.35 + 0.5 * abs(math.sin(i * 0.9))); nrm_m += nrm
        else:
            d = (d + Vector((0, 0, -0.45)) + Vector(rng.normal(0, 0.15, 3))).normalized()
        pts.append((p.x, p.y, p.z, r, r * rng.uniform(0.8, 1.1))); p = p + d * max(0.012, r0 * 0.9)
    if len(pts) < 4: return
    ref = nrm_m.normalized().cross(Vector((0.2, 0.3, 1))).normalized()
    o = netz('Wurzel', *rohr(pts, ringe=9, unter=4, ref=tuple(ref), kappe=(0.3, 1.5)), eltern=eltern); o.data.materials.append(material)
    o.data.attributes.new('riss', 'FLOAT', 'POINT')


def signalpunkte(eltern, punkte, rng, anzahl, radius):
    """Signalfarbe nur als Punkt (Stilreferenz §4): Dutzende, nie eine Fläche. Pass-Index 7 → Glimmen im Stil."""
    if not punkte: return 0
    wahl = rng.choice(len(punkte), min(anzahl, len(punkte)), replace=False)
    V, F = kugel((0, 0, 0), (1, 1, 1), 8, 6); me = bpy.data.meshes.new('Signal'); me.from_pydata([tuple(v) for v in V], [], F)
    me.materials.append(mat('signal', mat_signal))
    for i in wahl:
        o = bpy.data.objects.new('Signal', me); bpy.context.scene.collection.objects.link(o); o.parent = eltern
        r = radius * rng.uniform(0.6, 1.2); o.scale = (r, r, r); o.location = punkte[i]; o.pass_index = 7
        o.visible_shadow = False
    return len(wahl)


def befall_grathorn(T, eltern, me, F, W, bvh, rng):
    """Pilzfächer an Flanke und Hinterhand (Leitmerkmal), Moos im Rückenfell, Flechte auf dem Horn (Material)."""
    punkte = []; wund = []
    faecher(eltern, bvh, rng, (-0.36, 1.0, 0.84), (-0.36, 0, 0.78), 11, 0.165, 0.125, 'tramete', punkte, wund)
    faecher(eltern, bvh, rng, (-0.02, 1.0, 0.84), (-0.02, 0, 0.80), 5, 0.080, 0.070, 'tramete', punkte, wund)
    faecher(eltern, bvh, rng, (-0.50, 0.3, 1.6), (-0.46, 0.06, 0.8), 4, 0.075, 0.06, 'zunder', punkte, wund)
    # Kamm über Kruppe und Rücken, schräg nach hinten oben, und ein Büschel hinter dem Spiegel: das ändert den Schattenriss
    faecher(eltern, bvh, rng, (-0.34, 0.07, 1.7), (-0.34, 0.06, 0.8), 6, 0.125, 0.11, 'tramete', punkte, wund, aus=(-0.7, 0.35), heb=0.75)
    faecher(eltern, bvh, rng, (-1.7, 0.04, 0.90), (-0.5, 0.03, 0.84), 4, 0.105, 0.05, 'tramete', punkte, wund)
    faecher(eltern, bvh, rng, (-0.30, -1.0, 0.88), (-0.30, 0, 0.82), 4, 0.085, 0.07, 'tramete', punkte, wund)
    mo = np.where(W['moos'] > 0.8)[0]
    for i in rng.choice(mo, min(9, len(mo)), replace=False): punkte.append(Vector(F.P[i] + F.N[i] * 0.02))
    T['zahl_signal'] = signalpunkte(eltern, punkte, rng, 22, 0.005)
    return wund


def befall_wurzelkeiler(T, eltern, me, F, W, bvh, rng):
    """Rindenpanzer über dem Schild (Schulter, Nacken, Rücken — dort ist die Schwarte real am dicksten), Wurzeln, die
    daraus über die Flanke laufen, Pilze in den Rissen, ein Fächer an der Keule."""
    punkte = []; wund = []
    schild = stufe(F.N[:, 2] + 0.9 * rausch(F.P, 4.5, 21) - 0.25 * np.abs(F.x - 0.18), 0.42, 0.80) * stufe(F.x, -0.62, -0.40) * (1 - stufe(F.x, 0.58, 0.70)) * stufe(F.z, 0.52, 0.66)
    schild = np.maximum(schild, F.nah((0.30, 0.20, 0.72), 0.22) * 0.9)          # linke Schulter: der alte Schlag
    schild *= ~F.ist('ohr', 'schwanz')
    rinde = mat('rinde', lambda: mat_rinde('Rinde', 3.2, (0.80, 0.74, 0.66), versatz=0.016))
    o, risse = platten('Panzer', eltern, me, F, schild, 0.045, 110, rng, rinde)
    if o: H.adaptiv(o, 1.5, glatt=True)
    T['panzer'] = schild
    wm = mat('wurzelholz', lambda: mat_rinde('Wurzelholz', 9.0, (0.95, 0.74, 0.52), versatz=0.003, moos=0.0))
    for st, ri, n_, r0 in (((0.36, 0.215, 0.80), (-0.3, 0.4, -1), 26, 0.019), ((0.12, 0.225, 0.82), (-0.6, 0.3, -1), 30, 0.017), ((-0.18, 0.21, 0.80), (-0.5, 0.3, -1), 24, 0.014),
                           ((0.50, 0.16, 0.80), (0.5, 0.5, -1), 20, 0.015), ((-0.40, 0.17, 0.78), (-0.8, 0.3, -0.8), 22, 0.012), ((0.20, -0.22, 0.82), (-0.4, -0.4, -1), 24, 0.016),
                           ((0.30, 0.10, 0.93), (-1, 0.25, 0.0), 30, 0.020), ((0.0, 0.05, 0.88), (-1, -0.2, 0), 26, 0.016)):
        tr = bvh.find_nearest(Vector(st))
        wurzel(eltern, bvh, rng, tr[0], ri, n_, r0, wm)
    # Wurzelstümpfe entlang des Kamms: wachsen nach hinten oben aus dem Panzer — das ändert den Schattenriss
    for x, y, lg, r0 in ((0.40, 0.03, 0.30, 0.026), (0.26, -0.04, 0.36, 0.030), (0.12, 0.05, 0.27, 0.024), (-0.04, -0.02, 0.22, 0.020), (-0.22, 0.03, 0.17, 0.017), (0.33, 0.10, 0.20, 0.018)):
        tr = bvh.ray_cast(Vector((x, y, 2.0)), Vector((0, 0, -1)))
        if tr[0] is None: continue
        p = tr[0] - Vector((0, 0, 0.03)); d = Vector((-0.55 + rng.normal(0, 0.15), rng.normal(0, 0.25), 1.0)).normalized(); pts = []; nst = 9
        for i in range(nst):
            u = i / (nst - 1); pts.append((p.x, p.y, p.z, r0 * (1 - u) ** 0.7 + 0.004, r0 * (1 - u) ** 0.7 + 0.004))
            d = (d + Vector((-0.22, rng.normal(0, 0.12), -0.10 + rng.normal(0, 0.10)))).normalized(); p = p + d * lg / nst
        o2 = netz('Stumpf', *rohr(pts, ringe=10, unter=5, ref=(0, 1, 0.1), kappe=(0.3, 0.6)), eltern=eltern); o2.data.materials.append(wm); o2.data.attributes.new('riss', 'FLOAT', 'POINT')
        H.adaptiv(o2, 2.0, glatt=True)
    if risse:
        for i in rng.choice(len(risse), min(22, len(risse)), replace=False):
            p, n = risse[i]
            if p[1] < -0.05 and rng.random() < 0.6: continue
            if rng.random() < 0.6: setze_konsole(eltern, rng, p + n * 0.004, n, rng.uniform(0.022, 0.050), 'tramete', punkte=punkte)
            else: hutpilz(eltern, rng, p, n, rng.uniform(0.03, 0.055), punkte)
    faecher(eltern, bvh, rng, (-0.22, 1.0, 0.66), (-0.22, 0, 0.62), 7, 0.105, 0.085, 'tramete', punkte, wund)
    faecher(eltern, bvh, rng, (0.05, 1.0, 0.74), (0.05, 0, 0.70), 3, 0.06, 0.05, 'zunder', punkte, wund)
    T['zahl_signal'] = signalpunkte(eltern, punkte, rng, 22, 0.0055)
    return wund


def befall_spuerfuchs(T, eltern, me, F, W, bvh, rng):
    """Sparsam: Flechtenkruste auf Schulter und Kruppe, wenige kleine Konsolen, Signal als einzelne Punkte."""
    punkte = []; wund = []
    kruste = np.maximum(F.nah((0.12, 0.05, 0.42), 0.085), F.nah((-0.15, 0.045, 0.42), 0.075)) * stufe(rausch(F.P, 26, 31), 0.36, 0.52) * ~F.ist('ohr')
    o, risse = platten('Flechte', eltern, me, F, kruste, 0.0028, 220, rng, mat('flechte', mat_flechte), unterteilen=1)
    if o: H.adaptiv(o, 1.5, glatt=True)
    T['panzer'] = kruste
    faecher(eltern, bvh, rng, (-0.14, 0.5, 0.375), (-0.14, 0, 0.36), 6, 0.050, 0.036, 'tramete', punkte, wund)
    faecher(eltern, bvh, rng, (0.14, 0.5, 0.385), (0.14, 0, 0.37), 3, 0.030, 0.022, 'tramete', punkte, wund)
    faecher(eltern, bvh, rng, (-0.22, 0.05, 0.8), (-0.225, 0.01, 0.3), 2, 0.028, 0.014, 'zunder', punkte, wund)
    faecher(eltern, bvh, rng, (-0.05, 0.02, 0.9), (-0.05, 0.015, 0.3), 3, 0.042, 0.030, 'tramete', punkte, wund, aus=(-0.7, 0.4), heb=0.7)
    T['zahl_signal'] = signalpunkte(eltern, punkte, rng, 9, 0.0032)
    return wund


BEFALL = {'grathorn': befall_grathorn, 'wurzelkeiler': befall_wurzelkeiler, 'spuerfuchs': befall_spuerfuchs}


# ───────────────────────────── Tier zusammensetzen ─────────────────────────────
def tier(name, befall, ort=(0, 0, 0), kurs=None, saat=384):
    """Baut ein Tier als Kindobjekte eines Leerobjekts. Gibt (Leerobjekt, Kennzahlen) zurück."""
    rng = np.random.default_rng(saat + (1 if befall else 0)); T = BAU[name]()
    wurz = bpy.data.objects.new('%s_%s' % (name, 'befallen' if befall else 'rein'), None); bpy.context.scene.collection.objects.link(wurz)
    ko = koerper(T, wurz); me = ko.data; F = Feld(T, me)
    W = FELL[name](F, befall)
    fe = T['fell']
    if fe.get('furche'):   # Runde 4: Verdeckung in Furchen, Licht auf Wölbungen (Mass `furchen`)
        a_, b_, k_ = fe['furche']; cav = furchen(me, F.P, F.N)
        cav = cav - np.median(cav)   # Glätten schrumpft den ganzen Körper: nur die Abweichung zählt
        tief = stufe(cav, a_, b_); hoch = stufe(-cav, a_, b_); f_ = (1 - k_ * tief + 0.25 * k_ * hoch)[:, None]
        for key in ('farbe', 'spitze', 'haut'): W[key] = W[key] * f_
        W['heben'] = W['heben'] * (1 - 0.5 * tief)
        print('TIERFRAME Furchen Perzentile (mm)', np.percentile(cav, [1, 5, 25, 50, 75, 95, 99]).round(4) * 1000)
        print('TIERFRAME Furchen: Anteil tief %.3f, hoch %.3f' % ((tief > 0.5).mean(), (hoch > 0.5).mean()))
    fl = F.fluss + np.array([0, 0, -0.38]); W['fluss'] = fl
    dg = bpy.context.evaluated_depsgraph_get(); bvh = BVHTree.FromObject(ko, dg)
    HART[name](T, wurz, befall); augen(T, wurz, bvh, befall)
    zahl = dict(tier=name, befall=bool(befall), koerper_dreiecke=sum(len(p.vertices) - 2 for p in me.polygons))
    if befall:
        wund = BEFALL[name](T, wurz, me, F, W, bvh, rng)
        kahl = np.zeros(len(F.P))
        for p, r in wund: kahl = np.maximum(kahl, 1 - stufe(np.linalg.norm(F.P - p, axis=1), r * 0.5, r))    # alte, kahle Stelle um den Ansatz
        if 'panzer' in T: kahl = np.maximum(kahl, stufe(T['panzer'], 0.08, 0.3))
        W['dichte'] = W['dichte'] * (1 - 0.92 * kahl) * (1 - W['moos'])
        W['haut'] = mische(W['haut'], lin(0.050, 0.040, 0.034), kahl * 0.8)
        W['haut'] = mische(W['haut'], lin(0.050, 0.065, 0.025), W['moos'])
        zahl['signalpunkte'] = T.get('zahl_signal', 0)
    me.attributes.new('farbe', 'FLOAT_COLOR', 'POINT').data.foreach_set('color', np.column_stack([np.clip(W['haut'], 0, 1), np.ones(len(F.P))]).astype(np.float32).ravel())
    me.attributes.new('nass', 'FLOAT', 'POINT').data.foreach_set('value', W['nass'].astype(np.float32))
    me.materials.append(mat('haut', mat_haut))
    nur = os.environ.get('TIER_NUR', '')
    if 'fell' not in OHNE and (not nur or nur == ('befallen' if befall else 'rein')):
        fe = T['fell']; teiler = int(os.environ.get('TIER_FELL_TEILER', '1'))
        extra = {k: fe[k] for k in ('wirbel', 'buesche', 'grannen', 'laengestreu', 'tonklump', 'hebklump', 'streu', 'schwarzspitzen') if k in fe}
        o = straehnen('Fell', me, F, W, fe['anzahl'] // teiler, fe['breite'] * math.sqrt(teiler), fe['klump'], fe['staerke'], rng, wurz, **extra)
        o.data.materials.append(mat('fell_' + name, lambda: mat_fell('Fell_' + name, 0.30 if name == 'wurzelkeiler' else 0.42, zufall=fe.get('zufallrau', 0.2))))
        zahl['straehnen'] = fe['anzahl'] // teiler
        if fe.get('wolle'):   # Runde 4: Unterwolle — kurz, kraus, heller; zeigt sich in Scheiteln und Furchen
            anteil, lf, farb_f, farb_plus = fe['wolle']; Ww = dict(W)
            Ww['laenge'] = W['laenge'] * lf; Ww['heben'] = np.full(len(F.P), 0.45)
            Ww['farbe'] = W['farbe'] * farb_f + farb_plus; Ww['spitze'] = Ww['farbe'] * 1.25
            nw = int(fe['anzahl'] * anteil) // teiler
            ow = straehnen('Unterwolle', me, F, Ww, nw, fe['breite'] * 0.7 * math.sqrt(teiler), 1, 0.0, rng, wurz, schwer=0.05, streu=0.9)
            if ow: ow.data.materials.append(mat('wolle_' + name, lambda: mat_fell('Wolle_' + name, 0.6, zufall=0.3))); zahl['wolle'] = nw
        if befall and W['moos'].max() > 0:
            Wm = dict(W); n = len(F.P); gr = rausch(F.P, 40, 3)
            Wm['dichte'] = W['moos']; Wm['laenge'] = np.full(n, 0.022 if name != 'spuerfuchs' else 0.009) * (0.6 + 0.8 * rausch(F.P, 18, 5))
            Wm['heben'] = np.full(n, 0.85); Wm['farbe'] = mische(np.tile(lin(0.020, 0.030, 0.011), (n, 1)), lin(0.045, 0.050, 0.018), gr)
            Wm['spitze'] = Wm['farbe'] * 2.2 + lin(0.02, 0.025, 0.0)[None, :]
            flaeche = float((W['moos'] > 0.5).mean())
            nm = int(min(60000, 20000 + fe['anzahl'] * flaeche * 4)) // teiler
            om = straehnen('Moos', me, F, Wm, nm, fe['breite'] * 1.3 * math.sqrt(teiler), 14, 0.7, rng, wurz, schwer=0.0, streu=0.5)
            if om: om.data.materials.append(mat('moos', lambda: mat_fell('Moos', 0.7))); zahl['moosstraehnen'] = nm
    zahl['befall_dreiecke'] = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in wurz.children if o.type == 'MESH' and o is not ko)
    wurz.location = ort; wurz.rotation_euler = (0, 0, KURS if kurs is None else kurs)
    print('TIERFRAME', wurz.name, H.speicher())
    return wurz, zahl, T


# ───────────────────────────── Szene ─────────────────────────────
def boden(rng, nah):
    """Waldrandboden aus dem Scan `forest_ground_04` (Poly Haven, CC0). Echte Verschiebung nur auf dem Fleck unter den
    Tieren (`nah` = halbe Kantenlänge) — eine verschobene Fläche bis zum Waldrand kostet Gigabytes."""
    m, k, b, out = H.neues_material('Waldboden')
    obj = k.abbild(k.n('ShaderNodeTexCoord').outputs['Object'], (0.55, 0.55, 0.55))
    diff = k.tex(obj, H.scan('forest_ground_04', 'diff'), box=False); disp = k.tex(obj, H.scan('forest_ground_04', 'disp'), farbe=False, box=False)
    rau = k.tex(obj, H.scan('forest_ground_04', 'rough'), farbe=False, box=False)
    gross = k.rauschen(k.n('ShaderNodeTexCoord').outputs['Object'], 0.35, 3.0)
    farbe = k.mix(k.bereich(gross, 0.35, 0.7), k.farbton(diff, wert=0.50, satt=0.9), k.mix(1.0, diff, (0.36, 0.42, 0.24), 'MULTIPLY'))
    # Relief überall als Bump, echte Verschiebung nur auf dem nahen Fleck und zu dessen Rand auf null (Attribut `kante`): keine Naht
    H.abschluss(k, b, out, farbe, rau, None, 0.0)
    hoehe = k.grau(disp)
    bp = k.n('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.5; bp.inputs['Distance'].default_value = 0.045
    k.setze(bp.inputs['Height'], hoehe); k.nt.links.new(bp.outputs[0], b.inputs['Normal'])
    dn = k.n('ShaderNodeDisplacement'); dn.inputs['Midlevel'].default_value = 0.5; dn.inputs['Scale'].default_value = 0.045
    k.setze(dn.inputs['Height'], k.mixf(k.attr('kante', 'Fac'), 0.5, hoehe)); k.nt.links.new(dn.outputs[0], out.inputs['Displacement'])
    def flaeche(name, halb, n, z, welle):
        g = np.linspace(-halb, halb, n); X, Y = np.meshgrid(g, g, indexing='ij'); P = np.stack([X + (halb - nah - 14.0 if welle else -0.4 * nah), Y, np.full_like(X, z)], -1).reshape(-1, 3)
        if welle: P[:, 2] += (rausch(P, 0.05, 3) - 0.5) * 2.2 * stufe(np.hypot(P[:, 0], P[:, 1]), 12.0, 50.0)
        F = [(i * n + j, (i + 1) * n + j, (i + 1) * n + j + 1, i * n + j + 1) for i in range(n - 1) for j in range(n - 1)]
        o = netz(name, P, F); o.data.materials.append(m)
        if not welle:
            rand = np.minimum(halb - np.abs(P[:, 0] + 0.4 * nah), halb - np.abs(P[:, 1]))
            o.data.attributes.new('kante', 'FLOAT', 'POINT').data.foreach_set('value', stufe(rand, 0.0, 0.9).astype(np.float32))
        return o
    H.adaptiv(flaeche('Boden_nah', nah * 1.25, 48, 0.0, False), 2.0, glatt=True)
    flaeche('Boden_fern', 130.0, 90, -0.004, True)


def bewuchs(rng, frei, nah):
    """Gras und Stauden um die Tiere, Sträucher dahinter, der Waldrand in 45–80 m (Poly-Haven-Scans, CC0, wie im Haus-Bild)."""
    py = random.Random(384)
    gras = H.scan_modelle('grass_medium_01') + H.scan_modelle('grass_medium_02')
    for i in range(int(2600 * float(os.environ.get('TIER_GRAS', '1')))):
        x = rng.uniform(-nah * 2.2, 30); y = rng.uniform(-10, 10) * (1 + max(0, x) / 25)
        if any(math.hypot(x - fx, y - fy) < fr for fx, fy, fr in frei) and rng.random() < 0.8: continue
        H.setze(py.choice(gras), 'Gras', (x, y, 0.0), skala=rng.uniform(0.45, 1.0) * (nah / 5.0) ** 0.5, rnd=py, kipp=0.1)
    for name, anzahl, x0, x1, sk in (('shrub_sorrel_01', 16, 2, 22, (0.6, 1.1)), ('weed_plant_02', 14, 3, 24, (0.7, 1.2)), ('shrub_01', 22, 12, 40, (1.2, 2.2))):
        try: ms = H.scan_modelle(name)
        except (SystemExit, StopIteration) as e: print('TIERFRAME ohne', name, e); continue
        for i in range(anzahl):
            x = rng.uniform(x0, x1); y = rng.uniform(-8, 8) * (1 + x / 25)
            if any(math.hypot(x - fx, y - fy) < fr * 1.8 for fx, fy, fr in frei): continue
            H.setze(py.choice(ms), name, (x, y, 0.0), skala=rng.uniform(*sk), rnd=py, kipp=0.05)
    if 'baum' in OHNE: return
    try:
        baum = H.scan_modelle(os.environ.get('TIER_BAUM', 'island_tree_02'))
        for i, me in enumerate(baum):          # Hintergrund, unscharf und im Dunst: ein Achtel der Dreiecke reicht und spart ein halbes Gigabyte
            tmp = bpy.data.objects.new('tmp', me); bpy.context.scene.collection.objects.link(tmp)
            md = tmp.modifiers.new('Weniger', 'DECIMATE'); md.ratio = 0.12
            neu = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get())); neu['hoehe'] = me['hoehe']
            print('TIERFRAME Baum Dreiecke', len(me.polygons), '→', len(neu.polygons)); bpy.data.objects.remove(tmp); bpy.data.meshes.remove(me); baum[i] = neu
        for i in range(30):
            x = rng.uniform(30, 75); y = rng.uniform(-14, 14) * (1 + x / 45)
            H.setze(py.choice(baum), 'Baum', (x, y, -0.3), hoehe=rng.uniform(8.0, 12.5), rnd=py)
    except (SystemExit, StopIteration) as e: print('TIERFRAME ohne Baum', e)
    for im in bpy.data.images:          # Hintergrund-Scans: 1k genügt hinter Dunst und Unschärfe
        if im.size[0] > 1024 and im.source == 'FILE' and not im.filepath.endswith('.hdr'): im.scale(1024, 1024)


def rendere(aus, breite, hoehe, samples, kam, fokus_ort, blende=4.0, dicing=1.0):
    """Render-Einstellungen wie `hausframe.bau` (gleiche Pässe für `hausframe.stil`)."""
    sc = bpy.context.scene; sc.camera = kam
    kam.data.dof.use_dof = True; kam.data.dof.focus_distance = (Vector(fokus_ort) - kam.location).length; kam.data.dof.aperture_fstop = blende
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'
    sc.cycles.samples = samples; sc.cycles.use_adaptive_sampling = True; sc.cycles.adaptive_threshold = 0.02
    sc.cycles.use_denoising = 'rauschen' not in OHNE; sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    try: sc.cycles.denoising_prefilter = 'FAST'
    except Exception as e: print('Vorfilter', e)
    sc.cycles.max_bounces = 6; sc.cycles.diffuse_bounces = 2; sc.cycles.glossy_bounces = 2
    sc.cycles.transmission_bounces = 4; sc.cycles.volume_bounces = 0; sc.cycles.transparent_max_bounces = 16
    sc.cycles.sample_clamp_indirect = 4.0; sc.cycles.caustics_reflective = sc.cycles.caustics_refractive = False
    sc.cycles.dicing_rate = dicing; sc.cycles.offscreen_dicing_scale = 16.0; sc.cycles.max_subdivisions = 8; sc.cycles.dicing_camera = kam
    try: sc.cycles_curves.shape = 'RIBBONS'; sc.cycles_curves.subdivisions = 1
    except Exception as e: print('Kurven', e)
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = breite, hoehe, 100
    sc.render.threads_mode = 'FIXED'; sc.render.threads = int(os.environ.get('TIER_KERNE', '4'))
    vl = sc.view_layers[0]
    vl.use_pass_z = vl.use_pass_normal = vl.use_pass_mist = vl.use_pass_object_index = vl.use_pass_position = True
    # Nebelpass steuert den Pinsel im Stil: die Tiere bleiben unberührt, ab 6 m dahinter laufen Flächen zusammen
    ab = (Vector(fokus_ort) - kam.location).length
    sc.world.mist_settings.start = ab + 5.0; sc.world.mist_settings.depth = 60.0; sc.world.mist_settings.falloff = 'LINEAR'
    sc.view_settings.view_transform = 'Standard'
    if os.environ.get('TIER_PNG') == '1':        # Formprüfung ohne Stil
        sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_depth = '8'; sc.view_settings.view_transform = 'AgX'
    else:
        try: sc.render.image_settings.media_type = 'MULTI_LAYER_IMAGE'
        except Exception as e: print('media_type', e)
        sc.render.image_settings.file_format = 'OPEN_EXR_MULTILAYER'; sc.render.image_settings.color_depth = '16'
    sc.render.filepath = os.path.abspath(aus)
    bpy.ops.render.render(write_still=True)
    print('TIERFRAME Bild', aus, H.speicher())


def leere_szene():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o)


def buehne(name, rng):
    """Boden, Bewuchs, Himmel und Sonne des Haus-Bildes, Kamera auf das Paar: blickt nach +X, Sonne von rechts hinten."""
    T = BAU[name](); c = T['kamera']
    H.himmel()
    for im in bpy.data.images:
        if im.size[0] >= 4096: im.scale(2048, 1024)          # Himmel steht unscharf hinter Dunst
    print('TIERFRAME Himmel', H.speicher())
    if 'szene' not in OHNE:
        nah = c['paar'] * 4.5
        boden(rng, nah); print('TIERFRAME Boden', H.speicher()); bewuchs(rng, [(-c['staffel'], c['paar'], c['paar'] * 0.9), (c['staffel'], -c['paar'], c['paar'] * 0.9)], nah)
        print('TIERFRAME Bewuchs', H.speicher())
        # Dunst erst hinter den Tieren: trennt den Waldrand ab, ohne das Fell zu verschleiern
        if 'dunst' not in OHNE: H.dunst('Dunst', (75, 0), 120.0, -1.0, 16.0, 0.0022, 7.0, (0.95, 0.80, 0.60))
    else:
        o = netz('Boden', [(-40, -40, 0), (40, -40, 0), (40, 40, 0), (-40, 40, 0)], [(0, 1, 2, 3)], glatt=False)
        o.data.materials.append(mat_fest('Grund', (0.16, 0.13, 0.09), 0.9))
    kam = H.kamera('Kamera', (-c['abstand'], 0.0, c['hoehe']), (0, 0, c['fokus']), 135.0)
    return T, kam


def masse(args, b=1600, h=900, s=96):
    return (int(args[0]), int(args[1]), int(args[2])) if len(args) > 2 else (b, h, s)


def modus_paar():
    name, aus = ARGS[1], ARGS[2]; b, h, s = masse(ARGS[3:])
    leere_szene(); rng = np.random.default_rng(384)
    T, kam = buehne(name, rng); c = T['kamera']; zahlen = []
    # gestaffelt: sonst fällt der Schatten des rechten Tiers (Sonne 14° hoch, von rechts) auf das linke
    for befall, y, x in ((False, c['paar'], -c['staffel']), (True, -c['paar'], c['staffel'])):
        w, z, _ = tier(name, befall, (x, y, 0)); zahlen.append(z)
    json.dump(zahlen, open(os.path.splitext(aus)[0] + '.json', 'w'), indent=1)
    print('TIERFRAME', zahlen)
    rendere(aus, b, h, s, kam, (0, 0, c['fokus']), blende=5.6)


def modus_nah():
    """Nahaufnahme des Befalls: nur das befallene Tier, Kamera auf den Fächer an der Hinterhand."""
    name, aus = ARGS[1], ARGS[2]; b, h, s = masse(ARGS[3:])
    leere_szene(); rng = np.random.default_rng(384)
    T, kam = buehne(name, rng); c = T['kamera']
    w, z, T2 = tier(name, True, (c['staffel'], -c['paar'], 0))
    ziel_lokal = {'grathorn': (-0.30, 0.20, 0.86), 'wurzelkeiler': (0.10, 0.20, 0.74), 'spuerfuchs': (-0.02, 0.07, 0.37)}[name]
    bpy.context.view_layer.update(); ziel = w.matrix_world @ Vector(ziel_lokal)
    weite = {'grathorn': 2.6, 'wurzelkeiler': 2.8, 'spuerfuchs': 1.25}[name]
    kam.location = ziel + Vector((-weite, -0.25 * weite, 0.12 * weite)); kam.rotation_euler = (ziel - kam.location).to_track_quat('-Z', 'Y').to_euler()
    rendere(aus, b, h, s, kam, ziel, blende=5.6, dicing=3.0)      # nah würfelt die Verschiebung sonst auf 4 GiB


def modus_vorher():
    """Das heutige Spielmodell (public/creatures/<tier>.glb) am Platz des reinen Tiers, gleiche Kamera, gleiches Licht."""
    name, aus = ARGS[1], ARGS[2]; b, h, s = masse(ARGS[3:])
    leere_szene(); rng = np.random.default_rng(384)
    T, kam = buehne(name, rng); c = T['kamera']
    vorher = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(H.REPO, 'public', 'creatures', name + '.glb'))
    neu = [o for o in bpy.data.objects if o not in vorher]
    wurz = bpy.data.objects.new('alt', None); bpy.context.scene.collection.objects.link(wurz)
    lo = np.array([1e9] * 3); hi = -lo
    for o in neu:
        if o.type == 'MESH':
            for v in o.data.vertices:
                p = np.array(o.matrix_world @ v.co); lo = np.minimum(lo, p); hi = np.maximum(hi, p)
            m = bpy.data.materials.new('Altfarbe'); m.use_nodes = True; bs = m.node_tree.nodes['Principled BSDF']
            a = m.node_tree.nodes.new('ShaderNodeVertexColor'); m.node_tree.links.new(a.outputs['Color'], bs.inputs['Base Color']); bs.inputs['Roughness'].default_value = 0.9
            if not o.data.materials or not any(mm and mm.node_tree and any(n.type == 'TEX_IMAGE' for n in mm.node_tree.nodes) for mm in o.data.materials):
                o.data.materials.clear(); o.data.materials.append(m)
        if o.parent is None: o.parent = wurz
    print('TIERFRAME alt', name, 'Kasten', lo.round(3), hi.round(3), 'Dreiecke', sum(len(p.vertices) - 2 for o in neu if o.type == 'MESH' for p in o.data.polygons))
    # Die GLB haben keine gemeinsame Grösse (Fuchs 2,5 m lang, das Spiel skaliert beim Laden): auf die Länge des Zielbild-Tiers bringen
    f = {'grathorn': 1.70, 'wurzelkeiler': 1.85, 'spuerfuchs': 1.20}[name] / max(hi[0] - lo[0], hi[1] - lo[1])
    print('TIERFRAME alt Faktor %.2f' % f); wurz.scale = (f, f, f)
    wurz.rotation_euler = (0, 0, KURS + float(os.environ.get('TIER_ALT_DREH', '-90')) * math.pi / 180); wurz.location = (-c['staffel'], c['paar'], -lo[2] * f)
    rendere(aus, b, h, s, kam, (0, 0, c['fokus']))


def modus_riss():
    """Schattenriss-Blatt: reine Seitenansicht (orthografisch), rein │ befallen, schwarz auf hell."""
    name, aus = ARGS[1], ARGS[2]; b, h = (int(ARGS[3]), int(ARGS[4])) if len(ARGS) > 4 else (1600, 600)
    leere_szene(); T = BAU[name](); c = T['kamera']; ab = c['paar'] * 1.45
    for befall, x in ((False, ab), (True, -ab)):
        tier(name, befall, (x, 0, 0), kurs=0.0)
    sc = bpy.context.scene
    cam = bpy.data.cameras.new('Riss'); cam.type = 'ORTHO'; cam.ortho_scale = ab * 4.1
    ko = bpy.data.objects.new('Riss', cam); sc.collection.objects.link(ko); ko.location = (0, 30, cam.ortho_scale * h / b * 0.5 - 0.06 * ab); ko.rotation_euler = (math.pi / 2, 0, math.pi)
    sc.camera = ko
    w = bpy.data.worlds.new('Hell'); w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.82, 0.78, 0.70, 1); sc.world = w
    m = bpy.data.materials.new('Schwarz'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); e = nt.nodes.new('ShaderNodeEmission'); e.inputs['Color'].default_value = (0.012, 0.011, 0.010, 1); nt.links.new(e.outputs[0], out.inputs[0])
    sc.view_layers[0].material_override = m
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 12; sc.cycles.use_denoising = False; sc.cycles.max_bounces = 0
    sc.render.resolution_x, sc.render.resolution_y = b, h; sc.view_settings.view_transform = 'Standard'
    sc.render.image_settings.file_format = 'PNG'; sc.render.filepath = os.path.abspath(aus)
    bpy.ops.render.render(write_still=True); print('TIERFRAME Riss', aus, H.speicher())


def modus_foto():
    """Bildpaar Foto │ Modell (D443): nur das reine Tier, Seitenansicht mit Kopf links wie die Messblatt-Fotos, Licht und
    Boden des Haus-Bildes. `<tier> <aus.exr> [breite höhe samples]`."""
    name, aus = ARGS[1], ARGS[2]; b, h, s = masse(ARGS[3:], 1200, 860, 64)
    leere_szene(); rng = np.random.default_rng(384)
    T, kam = buehne(name, rng); c = T['kamera']
    tier(name, False, (0, 0, 0), kurs=math.pi / 2)
    weite = {'grathorn': 10.5, 'wurzelkeiler': 10.0, 'spuerfuchs': 5.2}[name]; hoehe = T['widerrist'] * 0.8
    kam.location = (-weite, 0.25, hoehe); ziel = Vector((0, 0.10, T['widerrist'] * 0.78)); kam.rotation_euler = (ziel - kam.location).to_track_quat('-Z', 'Y').to_euler()
    if os.environ.get('TIER_TON') == '1':   # Formprüfung: graue Plastik, nur der Körper
        m = bpy.data.materials.new('Ton'); m.use_nodes = True; m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.32, 0.30, 0.28, 1)
        m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.7
        for o in bpy.data.objects:
            if o.type == 'MESH' and o.name.endswith('_koerper'): o.data.materials.clear(); o.data.materials.append(m)
    rendere(aus, b, h, s, kam, ziel, blende=8.0)


def modus_umriss():
    """Messblatt, Teil Blender (D442): Schattenriss des reinen Tiers ohne Fell, orthografisch von links, Kopf links —
    wie die Seitenansichten der Referenzfotos. Schreibt die Maske als PNG und die Abbildung Pixel ↔ Meter als JSON;
    `python3 tools/tierframe.py messblatt …` legt sie aufs Foto."""
    name, aus = ARGS[1], ARGS[2]; b, h = 1600, 1000
    leere_szene(); T = BAU[name]()
    os.environ['TIER_POSE'] = '0'   # Messblatt: Läufe gerade, wie bisher gemessen
    mit_fell = os.environ.get('TIER_UMRISS_FELL') == '1'   # D443: Kontur mit Fell — das Foto zeigt die Fellkante, nicht die Haut
    OHNE.update({'szene'} if mit_fell else {'fell', 'szene'})
    tier(name, False, (0, 0, 0), kurs=0.0)
    S = {'spuerfuchs': 1.6}.get(name, 3.2); cx, cz = 0.0, S * h / b * 0.5 - 0.05
    sc = bpy.context.scene
    cam = bpy.data.cameras.new('Umriss'); cam.type = 'ORTHO'; cam.ortho_scale = S
    ko = bpy.data.objects.new('Umriss', cam); sc.collection.objects.link(ko); ko.location = (cx, 30, cz); ko.rotation_euler = (math.pi / 2, 0, math.pi)
    sc.camera = ko
    w = bpy.data.worlds.new('Schwarz'); w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0, 0, 0, 1); sc.world = w
    m = bpy.data.materials.new('Weiss'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); e = nt.nodes.new('ShaderNodeEmission'); e.inputs['Color'].default_value = (1, 1, 1, 1); nt.links.new(e.outputs[0], out.inputs[0])
    sc.view_layers[0].material_override = m
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 4; sc.cycles.use_denoising = False; sc.cycles.max_bounces = 0
    sc.render.resolution_x, sc.render.resolution_y = b, h; sc.view_settings.view_transform = 'Standard'
    sc.render.image_settings.file_format = 'PNG'; sc.render.filepath = os.path.abspath(aus + '.png')
    bpy.ops.render.render(write_still=True)
    json.dump(dict(tier=name, b=b, h=h, px_pro_m=b / S, cx=cx, cz=cz, widerrist=T.get('widerrist')), open(aus + '.json', 'w'), indent=1)
    print('TIERFRAME Umriss', aus)


def modus_messblatt():
    """Messblatt, Teil Python (D442): `python3 tools/tierframe.py messblatt <umriss-präfix> <foto> <aus.png> <boden_y> <widerrist_y> <nase_x>`.
    Der Riss wird so skaliert, dass sein Widerrist (Bauwert `widerrist`) auf der Widerristhöhe des Fotos liegt, und an
    der Nasenspitze ausgerichtet. Rot = Umriss des Modells, darunter das Foto: wo die Linie vom Tier abweicht, weicht
    der Bau ab. Pixel des Fotos sind Augenmass (±1–2 % der Höhe)."""
    from PIL import Image, ImageFilter, ImageChops, ImageDraw
    vor, foto, aus = sys.argv[2], sys.argv[3], sys.argv[4]
    boden_y, wr_y, nase_x = (float(x) for x in sys.argv[5:8]); neig = float(sys.argv[8]) if len(sys.argv) > 8 else 0.0   # Hang im Foto: Boden fällt um `neig` px je px nach rechts; boden_y gilt an nase_x
    meta = json.load(open(vor + '.json')); mk = Image.open(vor + '.png').convert('L').point(lambda v: 255 if v > 100 else 0)
    k = meta['px_pro_m']; bb = mk.getbbox()
    # Riss-Pixel → Welt: X = cx − (px − b/2)/k, Z = cz − (py − h/2)/k. Nasenspitze = linkester Pixel
    x_nase = meta['cx'] - (bb[0] - meta['b'] / 2) / k; z_boden = meta['cz'] - (bb[3] - meta['h'] / 2) / k
    s = (boden_y - wr_y) / meta['widerrist']                       # Foto-Pixel je Meter
    f = s / k                                                       # Riss-Pixel → Foto-Pixel
    gross = mk.resize((max(1, int(meta['b'] * f)), max(1, int(meta['h'] * f))), Image.LANCZOS).point(lambda v: 255 if v > 127 else 0)
    # Lage: Nase des Risses auf nase_x, Boden (z = 0) auf boden_y
    ox = nase_x - bb[0] * f; oy = boden_y - (meta['h'] / 2 + (meta['cz'] - 0.0) * k) * f
    if os.environ.get('MB_PUNKTE'):   # Kopf-Messblatt: zwei Punktpaare „X,Z:px,py;X,Z:px,py“ (Modell in m ↔ Foto in px), Massstab aus dem Abstand
        (m1, f1), (m2, f2) = [[tuple(float(v) for v in t.split(',')) for t in paar.split(':')] for paar in os.environ['MB_PUNKTE'].split(';')]
        s = math.hypot(f2[0] - f1[0], f2[1] - f1[1]) / math.hypot(m2[0] - m1[0], m2[1] - m1[1]); f = s / k
        gross = mk.resize((max(1, int(meta['b'] * f)), max(1, int(meta['h'] * f))), Image.LANCZOS).point(lambda v: 255 if v > 127 else 0)
        rx = (meta['b'] / 2 - (m1[0] - meta['cx']) * k) * f; ry = (meta['h'] / 2 - (m1[1] - meta['cz']) * k) * f
        ox, oy = f1[0] - rx, f1[1] - ry
    elif os.environ.get('MB_REF'):   # Kopf im Foto gedreht: statt an der Nase an einem Punkt X (m) des Modells ausrichten, der im Foto bei px liegt
        X_, px_ = (float(v) for v in os.environ['MB_REF'].split(':')); ox = px_ - (meta['b'] / 2 - (X_ - meta['cx']) * k) * f
    bild = Image.open(foto).convert('RGB'); flaeche = Image.new('L', bild.size, 0); flaeche.paste(gross, (int(round(ox)), int(round(oy))))
    if neig: flaeche = flaeche.transform(bild.size, Image.AFFINE, (1, 0, 0, -neig, 1, neig * nase_x), resample=Image.NEAREST)   # Modell steht gerade, das Foto am Hang: scheren
    rand = ImageChops.subtract(flaeche.filter(ImageFilter.MaxFilter(5)), flaeche.filter(ImageFilter.MinFilter(3)))
    hell = Image.blend(bild, Image.new('RGB', bild.size, (255, 255, 255)), 0.18)
    tint = Image.composite(Image.blend(hell, Image.new('RGB', bild.size, (40, 170, 255)), 0.28), hell, flaeche)
    tint.paste((235, 30, 30), mask=rand)
    d = ImageDraw.Draw(tint)
    for y, farbe in ((boden_y, (255, 255, 0)), (wr_y, (255, 255, 0))): d.line([(0, y - neig * nase_x), (bild.size[0], y + neig * (bild.size[0] - nase_x))], fill=farbe, width=2)
    d.line([(nase_x, 0), (nase_x, bild.size[1])], fill=(255, 255, 0), width=2)
    tint.save(aus, quality=92); print('MESSBLATT', aus, 'Massstab %.0f px/m' % s, 'Nase Modell x=%.3f m, Boden %.3f m' % (x_nase, z_boden))


def modus_stil():
    """Stil unverändert aus `hausframe.stil` (Luft, Pinsel in der Ferne, Glimmen des Befalls, AgX, Vignette)."""
    os.environ.setdefault('HAUS_SICHT', '700'); os.environ.setdefault('HAUS_BODEN', '0.0'); os.environ.setdefault('HAUS_EV', '-1.6')        # offene Abendsonne statt Hofschatten: Belichtung tiefer als im Haus-Bild (−0,15)
    H.ARGS = ['stil'] + ARGS[1:]; H.stil()


# ───────────────────────────── Montage (ohne Blender) ─────────────────────────────
def schrift(groesse, fett=False):
    from PIL import ImageFont
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf' % ('-Bold' if fett else ''),):
        if os.path.exists(p): return ImageFont.truetype(p, groesse)
    return ImageFont.load_default()


def leiste(bild, text, hoehe=44, klein=None):
    from PIL import Image, ImageDraw
    aus = Image.new('RGB', (bild.width, bild.height + hoehe), (24, 22, 20)); aus.paste(bild, (0, 0))
    d = ImageDraw.Draw(aus); d.text((14, bild.height + 9), text, fill=(232, 224, 208), font=schrift(22, True))
    if klein: d.text((bild.width - 14 - d.textlength(klein, font=schrift(15)), bild.height + 15), klein, fill=(150, 142, 128), font=schrift(15))
    return aus


def marke(bild, text, ort):
    from PIL import ImageDraw
    d = ImageDraw.Draw(bild); f = schrift(max(16, bild.width // 62), True); w = d.textlength(text, font=f)
    x, y = ort; d.rectangle((x - 8, y - 5, x + w + 8, y + f.size + 7), fill=(20, 18, 16)); d.text((x, y), text, fill=(236, 228, 210), font=f)


def neben(bilder, luecke=6, hoehe=None):
    from PIL import Image
    hoehe = hoehe or min(b.height for b in bilder)
    bs = [b.resize((round(b.width * hoehe / b.height), hoehe), Image.LANCZOS) for b in bilder]
    aus = Image.new('RGB', (sum(b.width for b in bs) + luecke * (len(bs) - 1), hoehe), (24, 22, 20)); x = 0
    for b in bs: aus.paste(b, (x, 0)); x += b.width + luecke
    return aus


def unter(bilder, luecke=6, breite=None):
    from PIL import Image
    breite = breite or min(b.width for b in bilder)
    bs = [b.resize((breite, round(b.height * breite / b.width)), Image.LANCZOS) for b in bilder]
    aus = Image.new('RGB', (breite, sum(b.height for b in bs) + luecke * (len(bs) - 1)), (24, 22, 20)); y = 0
    for b in bs: aus.paste(b, (0, y)); y += b.height + luecke
    return aus


def modus_blatt(ordner, ref):
    """Setzt aus den Einzelbildern die Blätter: Paar je Tier, Übersicht, Vorher/Nachher, Schattenriss, Zielbild neben Foto."""
    from PIL import Image
    # Beim Keiler lag der Rand des verschobenen Bodenflecks noch im Bild (dunkle Linie unten); seither läuft die
    # Verschiebung zum Rand aus (`boden`). Die Keiler-Bilder sind davor gerendert und werden unten beschnitten.
    schnitt = {'wurzelkeiler': 46}
    def o(n):
        im = Image.open(os.path.join(ordner, n)).convert('RGB'); t_ = n.split('-')[1]
        return im.crop((0, 0, im.width, im.height - schnitt[t_])) if t_ in schnitt and ('paar' in n or 'vorher' in n) else im
    da = lambda n: os.path.exists(os.path.join(ordner, n))
    quellen = json.load(open(os.path.join(ref, 'quellen.json'))) if os.path.exists(os.path.join(ref, 'quellen.json')) else {}
    paare = []; nah = []; vn = []; risse = []; refs = []
    for t in TIERE:
        if not (da('roh-%s-paar-rein.png' % t) and da('roh-%s-paar-befallen.png' % t)): continue
        # Das Paar wird in zwei Durchgängen gerendert (Fell je nur auf einem Tier, sonst reicht der Speicher nicht):
        # gleiche Szene, gleiche Kamera; hier laufen die Hälften über 80 Pixel ineinander.
        li, re = o('roh-%s-paar-rein.png' % t), o('roh-%s-paar-befallen.png' % t)
        maske = Image.new('L', li.size, 0); mitte = li.width // 2
        for x in range(li.width): maske.paste(int(255 * min(1, max(0, (x - mitte + 40) / 80))), (x, 0, x + 1, li.height))
        p = Image.composite(re, li, maske); b = p.copy()
        marke(b, 'rein', (24, 20)); marke(b, 'befallen', (b.width // 2 + 24, 20))
        b = leiste(b, '%s — rein │ befallen' % NAMEN[t], klein='D384 · Zielbild Blender/Cycles · nicht im Spiel')
        b.save(os.path.join(ordner, 'd384-%s-paar.png' % t)); paare.append(b)
        if da('roh-%s-nah.png' % t):
            n_ = leiste(o('roh-%s-nah.png' % t), '%s — Befall aus der Nähe' % NAMEN[t], klein='D384 · Zielbild Blender/Cycles')
            n_.save(os.path.join(ordner, 'd384-%s-befall-nah.png' % t)); nah.append(n_)
        if da('roh-%s-vorher.png' % t):
            a = o('roh-%s-vorher.png' % t).crop((0, 0, p.width // 2, p.height)); z = p.crop((0, 0, p.width // 2, p.height))
            marke(a, 'Vorher: heutiges Spielmodell (%s.glb), auf gleiche Länge gebracht' % t, (20, 18)); marke(z, 'Nachher: Zielbild (rein)', (20, 18))
            vn.append(leiste(neben([a, z]), '%s — gleiche Kamera, gleiches Licht' % NAMEN[t], klein='D384 · beides Blender/Cycles, kein Spielbild'))
        if da('roh-%s-riss.png' % t):
            r = o('roh-%s-riss.png' % t); marke(r, '%s rein' % NAMEN[t], (20, 16)); marke(r, 'befallen', (r.width // 2 + 20, 16))
            # so gross, wie das Tier auf 40 m im Spiel steht (1080p, 50° Bildwinkel): Bildbreite ≙ ortho_scale
            klein = r.resize((max(8, r.width // 12), max(4, r.height // 12)), Image.LANCZOS)
            r.paste(klein, (r.width - klein.width - 16, r.height - klein.height - 12)); risse.append(r)
        fotos = [f for f in sorted(quellen) if f.startswith(t)]
        if fotos:
            z = p.crop((0, 0, p.width // 2, p.height)); marke(z, 'Zielbild (rein)', (20, 18)); f = o_ref(ref, fotos[0])
            q = quellen[fotos[0]]; marke(f, 'Foto: %s, %s' % (q['urheber'][:40], q['lizenz']), (20, 18))
            refs.append(leiste(neben([z, f]), '%s neben Referenzfoto' % NAMEN[t], klein='Wikimedia Commons · ' + q['titel'][:70]))
    if paare: leiste(unter(paare), 'BRACHLAND — Zielbild Tiere (D384): rein │ befallen', hoehe=56).save(os.path.join(ordner, 'd384-zielbild-tiere.png'))
    if nah: neben(nah).save(os.path.join(ordner, 'd384-befall-nah.png'))
    if vn: unter(vn).save(os.path.join(ordner, 'd384-vorher-nachher.png'))
    if risse: leiste(unter(risse), 'Schattenriss rein │ befallen — klein unten rechts: Grösse auf 40 m', klein='D384').save(os.path.join(ordner, 'd384-schattenriss.png'))
    if refs: unter(refs).save(os.path.join(ordner, 'd384-zielbild-neben-foto.png'))
    print('TIERFRAME Blätter in', ordner)


def o_ref(ref, datei):
    from PIL import Image
    return Image.open(os.path.join(ref, datei)).convert('RGB')


if __name__ == '__main__':
    if bpy: {'paar': modus_paar, 'nah': modus_nah, 'vorher': modus_vorher, 'riss': modus_riss, 'umriss': modus_umriss, 'foto': modus_foto, 'stil': modus_stil}[ARGS[0]]()
    elif sys.argv[1] == 'messblatt': modus_messblatt()
    else: modus_blatt(sys.argv[2], sys.argv[3])
