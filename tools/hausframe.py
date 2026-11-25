"""
BRACHLAND — Zielbild mit Haus (D373): verlassener Inntaler Einfirsthof, vom Wald zurückerobert (ADR-0018, ADR-0017).

    blender --background --factory-startup --python tools/hausframe.py -- bau <terrainordner> <präfix> [breite höhe samples] [haus,nah]
    blender --background --factory-startup --python tools/hausframe.py -- stil <ein.exr> <aus.png> [breite höhe]

`bau` lässt `tools/hofbaukasten.py` (D360, Verfallsstufe 2) laufen und nimmt dessen Hof als Rohbau: die einfachen
prozeduralen Materialien werden durch Scans mit echter Verschiebung ersetzt (Poly Haven, CC0, `tools/hausframe_scans.py`),
die Dachhaut neu gebaut (Durchhang, Loch mit ausgefranstem Rand, Moos), Putz bekommt eine gemalte Maske je Wand
(Abplatzung, Wasserläufe, Feuchte, Risse), Holz vergraut dort, wo der Regen hinkommt. Der Hof steht gespiegelt auf dem
Grundriss von Gebäude 708 (Œntal, D363) im Gelände aus `tools/terrainexport.ts` (Nahfeld 320 m / 1 m, Fernfeld
`fern_` 2400 m / 8 m), die Bergkulisse dahinter kommt aus `public/world/oental-fern.json`.
`stil` ist die gemalte Darstellung (tiefengewichteter Kuwahara, Bloom, kein Korn) — eine Kopie des Stils `aframe`
aus `tools/stilframes.py` (D371) mit eigenen Nebelgrenzen; bewusst kopiert, damit beide Zielbilder getrennt
weiterentwickelt werden können.

Koordinaten: alles am Haus in Baukasten-Achsen (First +x, Wohngiebel bei x = 0, Traufseite mit Tennentor y = −B/2);
`HAUS_M` bringt sie in die Welt (Blender X = Ost, Y = Nord). Gespiegelt, damit Tor und Dachloch zum Hang zeigen.
"""
import bpy, bmesh, sys, os, math, random, json, runpy, time, tempfile
import numpy as np
from mathutils import Vector, Matrix

ARGS = sys.argv[sys.argv.index('--') + 1:]
MODUS = ARGS[0]
HIER = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HIER)
SIGNAL = (0.62, 0.81, 0.89)                 # '#cfe9f2' linear
SAAT = int(os.environ.get('HAUS_SAAT', '708'))
LAENGE, BREITE = 30.0, 12.5                 # innerhalb der Spannen aus content/hofbaukasten.json
SCHNELL = os.environ.get('HAUS_SCHNELL') == '1'
SCHNEISE = tuple(float(x) for x in os.environ.get('HAUS_SCHNEISE', '-4,17,90').split(','))   # Grad von, bis; Tiefe in m (D439)
OHNE = set(os.environ.get('HAUS_OHNE', '').split(','))   # Prüfläufe: pflanzen, dunst
SONNE_EL, SONNE_AZ = 14.0, 195.0            # tief, von rechts leicht hinter der Kamera (≈ 100° zur Blickrichtung): Streiflicht auf dem Giebel, Traufseite im Schatten
# Lage: Mitte und Achse von Gebäude 708 (terrainexport um 238/231, Grundriss 36 × 14,7 m, Achse 30° gegen Ost)
HOF_MITTE, HOF_WINKEL = (0.375, -0.185), math.radians(29.96)


# ───────────────────────────── Scans, Knoten ─────────────────────────────
def cc0_ordner():
    if os.environ.get('BRACHLAND_CC0'): return os.environ['BRACHLAND_CC0']
    p = REPO
    while True:
        k = os.path.join(p, '.cache', 'cc0')
        if os.path.isdir(k): return k
        if os.path.dirname(p) == p: raise SystemExit('kein .cache/cc0 gefunden — tools/hausframe_scans.py laufen lassen')
        p = os.path.dirname(p)


def scan_ordner(name):
    for o in (os.path.join(cc0_ordner(), 'hausframe', name), os.path.join(cc0_ordner(), name)):
        if os.path.isdir(o): return o
    raise SystemExit('Scan fehlt: %s — tools/hausframe_scans.py laufen lassen' % name)


def scan(name, karte):
    o = scan_ordner(name)
    for f in sorted(os.listdir(o)):
        if f.startswith(name + '_' + karte) and f.endswith('.jpg'): return os.path.join(o, f)
    raise SystemExit('Karte fehlt: %s %s' % (name, karte))


def bild(pfad, farbe=True):
    im = bpy.data.images.load(pfad, check_existing=True)
    if not farbe: im.colorspace_settings.name = 'Non-Color'
    return im


class K:
    """Kleiner Knotenbauer: Werte sind Sockel oder Zahlen/Tupel, jede Methode gibt einen Ausgangssockel zurück."""
    def __init__(s, nt): s.nt = nt; s.x = -2000

    def n(s, typ, **kw):
        k = s.nt.nodes.new(typ); s.x += 40; k.location = (s.x, 0)
        for a, w in kw.items():
            if a in k.inputs: k.inputs[a].default_value = w
            else: setattr(k, a, w)
        return k

    def setze(s, sockel, w):
        if w is None: return
        if hasattr(w, 'is_output') or isinstance(w, bpy.types.NodeSocket): s.nt.links.new(w, sockel)
        elif isinstance(w, (tuple, list)) and len(w) == 3 and len(sockel.default_value) == 4: sockel.default_value = (*w, 1)
        else: sockel.default_value = w

    def math(s, op, a, b=None, c=None, clamp=False):
        k = s.n('ShaderNodeMath', operation=op); k.use_clamp = clamp
        for i, w in enumerate((a, b, c)): s.setze(k.inputs[i], w)
        return k.outputs[0]

    def mix(s, f, a, b, typ='MIX'):
        k = s.n('ShaderNodeMix', data_type='RGBA', blend_type=typ)
        s.setze(k.inputs[0], f); s.setze(k.inputs[6], a); s.setze(k.inputs[7], b)
        return k.outputs[2]

    def mixf(s, f, a, b):
        k = s.n('ShaderNodeMix', data_type='FLOAT')
        s.setze(k.inputs[0], f); s.setze(k.inputs[2], a); s.setze(k.inputs[3], b)
        return k.outputs[0]

    def bereich(s, x, a, b, c=0.0, d=1.0, weich=False):
        k = s.n('ShaderNodeMapRange'); k.clamp = True
        if weich: k.interpolation_type = 'SMOOTHSTEP'
        s.setze(k.inputs[0], x)
        for i, w in zip((1, 2, 3, 4), (a, b, c, d)): k.inputs[i].default_value = w
        return k.outputs[0]

    def rauschen(s, vec, skala, detail=3.0, rau=0.5):
        k = s.n('ShaderNodeTexNoise'); k.inputs['Scale'].default_value = skala
        k.inputs['Detail'].default_value = detail; k.inputs['Roughness'].default_value = rau
        if vec is not None: s.nt.links.new(vec, k.inputs['Vector'])
        return k.outputs['Fac']

    def abbild(s, vec, skala=(1, 1, 1), ort=(0, 0, 0), rot=(0, 0, 0)):
        k = s.n('ShaderNodeMapping'); k.inputs['Scale'].default_value = skala
        k.inputs['Location'].default_value = ort; k.inputs['Rotation'].default_value = rot
        s.nt.links.new(vec, k.inputs['Vector'])
        return k.outputs[0]

    def tex(s, vec, pfad, farbe=True, box=True, blend=0.25):
        k = s.n('ShaderNodeTexImage'); k.image = bild(pfad, farbe); k.interpolation = 'Cubic'
        if box: k.projection = 'BOX'; k.projection_blend = blend
        s.nt.links.new(vec, k.inputs['Vector'])
        return k.outputs['Color']

    def xyz(s, vec):
        k = s.n('ShaderNodeSeparateXYZ'); s.nt.links.new(vec, k.inputs[0])
        return k.outputs

    def attr(s, name, aus='Fac'):
        k = s.n('ShaderNodeAttribute'); k.attribute_name = name
        return k.outputs[aus]

    def farbton(s, farbe, wert=1.0, satt=1.0):
        k = s.n('ShaderNodeHueSaturation'); k.inputs['Value'].default_value = wert; k.inputs['Saturation'].default_value = satt
        s.setze(k.inputs['Color'], farbe)
        return k.outputs[0]

    def grau(s, farbe):
        k = s.n('ShaderNodeRGBToBW'); s.setze(k.inputs[0], farbe)
        return k.outputs[0]


def neues_material(name, versatz=True):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); out.location = (600, 0)
    b = nt.nodes.new('ShaderNodeBsdfPrincipled'); b.location = (300, 0)
    nt.links.new(b.outputs[0], out.inputs['Surface'])
    if versatz: m.displacement_method = 'BOTH'
    return m, K(nt), b, out


def abschluss(k, b, out, farbe, rau, hoehe, versatz, bump=0.4, mitte=0.5):
    """Farbe, Rauheit, Höhe als Bump (fein) und echte Verschiebung (grob) an Principled und Ausgang hängen."""
    k.setze(b.inputs['Base Color'], farbe); k.setze(b.inputs['Roughness'], rau)
    if hoehe is not None:
        bp = k.n('ShaderNodeBump'); bp.inputs['Strength'].default_value = bump; bp.inputs['Distance'].default_value = versatz
        k.setze(bp.inputs['Height'], hoehe); k.nt.links.new(bp.outputs[0], b.inputs['Normal'])
        d = k.n('ShaderNodeDisplacement'); d.inputs['Midlevel'].default_value = mitte; d.inputs['Scale'].default_value = versatz
        k.setze(d.inputs['Height'], hoehe); k.nt.links.new(d.outputs[0], out.inputs['Displacement'])


def adaptiv(o, pixel=1.0, glatt=False, fase=0.0):
    if fase:   # gebrochene Kanten (D438): Balken und Bretter sind gefast, nicht messerscharf
        bv = o.modifiers.new('Fase', 'BEVEL'); bv.width = fase; bv.segments = 1; bv.limit_method = 'ANGLE'; bv.angle_limit = math.radians(40)
    m = o.modifiers.new('Adaptiv', 'SUBSURF'); m.subdivision_type = 'SIMPLE'
    m.use_adaptive_subdivision = True; m.adaptive_pixel_size = pixel * (2.0 if SCHNELL else 1.0)
    m.levels = 0; m.render_levels = 1
    for p in o.data.polygons: p.use_smooth = glatt   # Quader bleiben kantig; verschoben wird entlang der Vertexnormalen
    return m


def gitter_rauschen(h, w, zy, zx, rng):
    """Wertrauschen (bilinear, weich) als Feld h × w; Zellgrösse in Pixeln je Achse."""
    g = rng.random((int(h / zy) + 3, int(w / zx) + 3))
    ys = np.arange(h) / zy; xs = np.arange(w) / zx
    y0 = ys.astype(int); x0 = xs.astype(int); fy = ys - y0; fx = xs - x0
    fy = fy * fy * (3 - 2 * fy); fx = fx * fx * (3 - 2 * fx)
    oben = g[y0][:, x0] * (1 - fx) + g[y0][:, x0 + 1] * fx
    unten = g[y0 + 1][:, x0] * (1 - fx) + g[y0 + 1][:, x0 + 1] * fx
    return oben * (1 - fy)[:, None] + unten * fy[:, None]


def weich(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


# ───────────────────────────── Rohbau aus dem Hof-Baukasten ─────────────────────────────
def rohbau():
    """`hofbaukasten.py` als Skript ausführen (ohne Render und Backen) und seine Namen (Maße, Öffnungen, Dachloch)
    zurückgeben. Die Szene enthält danach je Material ein Netz aus Quadern."""
    os.environ['HOF_RENDER'] = '0'; os.environ['HOF_BACKEN'] = '0'
    alt = sys.argv
    tmp = tempfile.mkdtemp(prefix='hausframe-')
    sys.argv = [alt[0], '--', tmp, str(SAAT), '2', str(LAENGE), str(BREITE)]
    try: g = runpy.run_path(os.path.join(HIER, 'hofbaukasten.py'))
    finally: sys.argv = alt
    return g


def wuerfel_dazu(o, liste):
    """Quader (Matrix, Grösse, Ton) an ein Baukasten-Netz anhängen."""
    bm = bmesh.new(); bm.from_mesh(o.data)
    lage = bm.faces.layers.float.get('ton') or bm.faces.layers.float.new('ton')
    for M, g, ton in liste:
        erg = bmesh.ops.create_cube(bm, size=1.0, matrix=M @ Matrix.Diagonal((*[max(1e-3, x) for x in g], 1)))
        for f in {f for v in erg['verts'] for f in v.link_faces}: f[lage] = ton
    bm.to_mesh(o.data); bm.free()


def laden_aus_brettern(o, rnd, G):
    """Jeden Ladenflügel (ein Quader aus dem Baukasten) durch stehende Bretter mit Fugen und zwei Querleisten ersetzen
    (D437): Bretter ungleich dick und lang, einzelne unten abgefault oder ganz herausgefallen."""
    bm = bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table()
    lage = bm.faces.layers.float.get('ton')
    gesehen, liste = set(), []
    for v0 in bm.verts:
        if v0.index in gesehen: continue
        teil = [v0]; gesehen.add(v0.index); i = 0
        while i < len(teil):
            for e in teil[i].link_edges:
                w = e.other_vert(teil[i])
                if w.index not in gesehen: gesehen.add(w.index); teil.append(w)
            i += 1
        k = sorted(((e.other_vert(v0).co - v0.co) for e in v0.link_edges), key=lambda d: -d.length)
        if len(k) < 3: continue
        H, W, T = (x.normalized() for x in k[:3]); hl, wl, tl = (x.length for x in k[:3])
        if H.z < 0: H = -H
        mitte = sum((v.co for v in teil), Vector()) / len(teil)
        if T.dot(mitte - Vector((G['L'] / 2, 0, mitte.z))) < 0: T = -T   # T zeigt vom Haus weg: Querleisten liegen sichtbar aussen
        ton = v0.link_faces[0][lage] if lage else 0.5
        R = Matrix((W, T, H)).transposed().to_4x4(); R.translation = mitte
        n = max(2, round(wl / 0.115)); bb = wl / n
        for j in range(n):
            if rnd.random() < 0.05: continue                      # Brett fehlt
            kurz = rnd.uniform(0.08, 0.3) * hl if rnd.random() < 0.18 else rnd.uniform(0.0, 0.015)   # unten abgefault
            M = R @ Matrix.Translation(((j + 0.5) * bb - wl / 2, rnd.uniform(-0.004, 0.004), kurz / 2)) @ Matrix.Rotation(math.radians(rnd.uniform(-0.7, 0.7)), 4, 'Y')
            liste.append((M, (bb - rnd.uniform(0.003, 0.007), tl * rnd.uniform(0.6, 0.72), hl - kurz), min(1.0, max(0.0, ton + rnd.uniform(-0.25, 0.25)))))
        for zq in (-0.31, 0.31):                                  # Querleisten (Einschubleisten), Faser quer
            M = R @ Matrix.Translation((0, tl * 0.42, zq * hl)) @ Matrix.Rotation(math.radians(rnd.uniform(-1.2, 1.2)), 4, 'Y')
            liste.append((M, (wl - 0.012, 0.02, 0.085), rnd.random()))
    bmesh.ops.delete(bm, geom=list(bm.verts), context='VERTS'); bm.to_mesh(o.data); bm.free()
    wuerfel_dazu(o, liste)


def holz_uv(o, skala, rnd, schief=0.0, haengen=0.0):
    """Je Quader eine UV entlang der längsten Kante (Faser = V), zufällig versetzt — kein Brett gleicht dem Nachbarn.
    `schief`: kleine Verdrehung je Brett (Grad), `haengen`: Anteil langer senkrechter Bretter, die an einem Nagel hängen."""
    bm = bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table()
    uvl = bm.loops.layers.uv.new('UVMap')
    hirn = bm.faces.layers.float.new('hirn')
    gesehen = set()
    for v0 in bm.verts:
        if v0.index in gesehen: continue
        # Zusammenhangskomponente (ein Quader = 8 Ecken)
        teil = [v0]; gesehen.add(v0.index); i = 0
        while i < len(teil):
            for e in teil[i].link_edges:
                w = e.other_vert(teil[i])
                if w.index not in gesehen: gesehen.add(w.index); teil.append(w)
            i += 1
        kanten = sorted(((e.other_vert(v0).co - v0.co) for e in v0.link_edges), key=lambda d: -d.length)
        if not kanten: continue
        U = kanten[0].normalized(); lang = kanten[0].length
        mitte = sum((v.co for v in teil), Vector()) / len(teil)
        if schief and lang > 0.4:
            R = Matrix.Rotation(math.radians(rnd.uniform(-schief, schief)), 4, kanten[-1].normalized())
            if haengen and abs(U.z) > 0.9 and lang > 1.2 and rnd.random() < haengen:   # hängt am oberen Nagel
                oben = mitte + Vector((0, 0, lang / 2 - 0.1))
                # D439: ein Brett an einem Nagel hängt lotrecht — es ist abgerutscht und pendelt kaum aus, nicht schräg im Raum
                R = Matrix.Translation((0, 0, -rnd.uniform(0.04, 0.22))) @ Matrix.Translation(oben) @ Matrix.Rotation(math.radians(rnd.choice((-1, 1)) * rnd.uniform(0.5, 2.5)), 4, kanten[-1].normalized()) @ Matrix.Translation(-oben)
            else:
                R = Matrix.Translation(mitte) @ R @ Matrix.Translation(-mitte)
            for v in teil: v.co = R @ v.co
            U = (R.to_3x3() @ U).normalized()
        ou, ov = rnd.random() * 7.0, rnd.random() * 7.0
        stumpf = lang < 0.6 and len(kanten) > 1 and lang < 1.8 * kanten[1].length
        for f in {f for v in teil for f in v.link_faces}:
            nrm = f.normal
            if stumpf: f[hirn] = 0.8   # Balkenkopf: kurzer Klotz, ringsum nachgedunkelt
            if abs(nrm.dot(U)) > 0.9:   # Hirnholz: quer abgebildet
                f[hirn] = 1.0
                a = kanten[1].normalized() if len(kanten) > 1 else Vector((0, 0, 1)); b_ = nrm.cross(a)
                for lp in f.loops: lp[uvl].uv = (lp.vert.co.dot(a) / skala + ou, lp.vert.co.dot(b_) / skala + ov)
            else:
                T = nrm.cross(U)
                for lp in f.loops: lp[uvl].uv = (lp.vert.co.dot(T) / skala + ou, lp.vert.co.dot(U) / skala + ov)
    bm.normal_update(); bm.to_mesh(o.data); bm.free()


def putzmaske(G, rng):
    """Gemalte Maske je EG-Wand als Atlas (vier Zeilen): R Abplatzung, G Wasserläufe, B Feuchte/Algen, A Risse.
    Abplatzung sitzt am Spritzwassersockel, an Ecken und unter Fensterbänken; Läufe unter Bankenden und
    Laubenkonsolen; Feuchte steigt vom Boden auf. Rückgabe: Bild, Breite in m, Zeilenhöhe in m."""
    L_, B_, HEG, LW = G['L'], G['B'], G['H_EG'], G['LW']
    ppm = 48 if SCHNELL else 110
    wm, hr = L_ + 2.0, HEG + 0.7
    W, HZ = int(wm * ppm), int(hr * ppm)
    atlas = np.zeros((4 * HZ, W, 4), np.float32)
    for zeile, wname in enumerate(('sued', 'nord', 'giebel', 'rueck')):
        quer = wname in ('giebel', 'rueck')
        umax = B_ if quer else L_
        oeff = [(o[0] + (B_ / 2 if quer else 0), o[1] + (B_ / 2 if quer else 0), o[2], o[3], o[4]) for o in G['OEFF'][wname]['eg']]
        u = (np.arange(W) / ppm - 1.0)[None, :]; z = (np.arange(HZ) / ppm - 0.2)[:, None]
        n1 = gitter_rauschen(HZ, W, 2.2 * ppm, 2.2 * ppm, rng); n2 = gitter_rauschen(HZ, W, 0.6 * ppm, 0.6 * ppm, rng)
        n3 = gitter_rauschen(HZ, W, 0.18 * ppm, 0.18 * ppm, rng)
        ecke = np.minimum(np.abs(u), np.abs(u - umax))
        r = 0.45 * n1 + 0.30 * n2 + 0.15 * n3 + 0.30 * np.exp(-np.maximum(z, 0) / 0.45) + 0.18 * np.exp(-ecke / 0.5)
        stall = (u > LW) if not quer else (np.ones_like(u, bool) if wname == 'rueck' else np.zeros_like(u, bool))
        r = r + 0.12 * stall - 0.20 * weich(HEG - 0.8, HEG, z) * (~stall)
        if wname == 'giebel': r = r + 0.05   # Wetterseite
        g = np.zeros((HZ, W), np.float32)
        # Tropfbahnen: senkrecht gestrecktes Rauschen, oben stark (Traufe/Laubenboden), nach unten auslaufend
        bahn = gitter_rauschen(HZ, W, 1.4 * ppm, 0.07 * ppm, rng)
        g += weich(0.62, 0.8, bahn) * (0.25 + 0.5 * weich(0.3, HEG, z)) * (0.5 + 0.5 * stall)
        if not quer or wname == 'giebel':   # unter den Laubenkonsolen (alle 1,8 m)
            for uk in np.arange(0.0, (LW if not quer else umax) + 0.1, 1.8):
                g += 0.5 * np.exp(-((u - uk) / 0.05) ** 2) * np.exp(-np.maximum(HEG - z, 0) / 0.8)
        a = np.zeros((HZ, W), np.float32)
        for ua, ub, za, zb, art in oeff:
            unter = (z < za)
            # Abplatzung und nasser Fleck unter der Bank
            r += 0.24 * weich(ua - 0.35, ua - 0.05, u) * (1 - weich(ub + 0.05, ub + 0.35, u)) * np.exp(-np.maximum(za - z, 0) / 0.6) * unter
            rand = np.maximum(np.maximum(ua - u, u - ub), np.maximum(za - z, z - zb))
            r += 0.14 * np.exp(-np.maximum(rand, 0) / 0.08) * (rand > 0)
            if art in ('fenster', 'stall'):
                for uk in (ua + 0.02, ub - 0.02):   # Läufe an den Bankenden
                    g += 0.9 * np.exp(-((u - uk) / 0.045) ** 2) * np.exp(-np.maximum(za - z, 0) / 0.9) * unter
                g += 0.35 * (u > ua) * (u < ub) * np.exp(-np.maximum(za - z, 0) / 0.35) * unter
            # Risse von den Ecken der Öffnung
            for (cu, cz_, du, dz) in ((ua, zb, -1, 1), (ub, zb, 1, 1), (ua, za, -1, -1), (ub, za, 1, -1)):
                if rng.random() < 0.55: continue
                p = np.array([cu, cz_]); d = np.array([du * rng.uniform(0.3, 1.0), dz * rng.uniform(0.5, 1.0)])
                for _ in range(int(rng.uniform(0.4, 1.5) / 0.004)):
                    d = d / np.linalg.norm(d) + rng.normal(0, 0.22, 2); d /= np.linalg.norm(d); p = p + d * 0.004
                    j, i = int((p[0] + 1.0) * ppm), int((p[1] + 0.2) * ppm)
                    if 0 <= i < HZ - 1 and 0 <= j < W - 1: a[i:i + 2, j:j + 2] = 1.0
        for _ in range(int(umax / 3.5)):   # Setzrisse vom Boden hoch
            p = np.array([rng.uniform(0.3, umax - 0.3), -0.1]); d = np.array([rng.uniform(-0.4, 0.4), 1.0])
            for _ in range(int(rng.uniform(1.0, HEG) / 0.004)):
                d = d / np.linalg.norm(d) + rng.normal(0, 0.25, 2); d[1] = abs(d[1]) * 0.6 + 0.4; d /= np.linalg.norm(d); p = p + d * 0.004
                j, i = int((p[0] + 1.0) * ppm), int((p[1] + 0.2) * ppm)
                if 0 <= i < HZ - 1 and 0 <= j < W - 1: a[i:i + 2, j:j + 2] = 1.0
        hf = 0.20 + 0.55 * gitter_rauschen(1, W, 1, 2.5 * ppm, rng) + 0.22 * gitter_rauschen(1, W, 1, 0.5 * ppm, rng) + 0.5 * np.exp(-ecke / 0.6)
        b = np.clip(1 - (z - hf) / 0.45, 0, 1)
        atlas[zeile * HZ:(zeile + 1) * HZ, :, 0] = np.clip(r, 0, 1); atlas[zeile * HZ:(zeile + 1) * HZ, :, 1] = np.clip(g, 0, 1)
        atlas[zeile * HZ:(zeile + 1) * HZ, :, 2] = b; atlas[zeile * HZ:(zeile + 1) * HZ, :, 3] = a
    im = bpy.data.images.new('Putzmaske', W, 4 * HZ, alpha=True, float_buffer=False)
    im.colorspace_settings.name = 'Non-Color'; im.alpha_mode = 'CHANNEL_PACKED'
    im.pixels.foreach_set(atlas.ravel()); im.pack()
    return im, wm, hr


def putz_uv(o, G, wm, hr):
    L_, B_, T = G['L'], G['B'], G['T_EG']
    bm = bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table()
    uvl = bm.loops.layers.uv.new('UVMap')
    for i in range(0, len(bm.verts), 8):
        teil = bm.verts[i:i + 8]
        c = sum((v.co for v in teil), Vector()) / 8
        if c.y < -B_ / 2 + T + 0.05: zeile, quer = 0, False
        elif c.y > B_ / 2 - T - 0.05: zeile, quer = 1, False
        elif c.x < T + 0.05: zeile, quer = 2, True
        else: zeile, quer = 3, True
        for f in {f for v in teil for f in v.link_faces}:
            for lp in f.loops:
                p = lp.vert.co; u = (p.y + B_ / 2) if quer else p.x
                lp[uvl].uv = ((u + 1.0) / wm, (zeile * hr + p.z + 0.2) / (4 * hr))
    bm.to_mesh(o.data); bm.free()


# ───────────────────────────── Materialien des Hauses ─────────────────────────────
def mat_putz(maske):
    """Kalkputz: weisser, blätternder Scan; am Sockel und in den Läufen veralgt; wo die Maske (plus Scanhöhe) die
    Schwelle übersteigt, liegt 2 cm tiefer das Bruchsteinmauerwerk frei. Rissen folgt eine Kerbe."""
    m, k, b, out = neues_material('Putz')
    tc = k.n('ShaderNodeTexCoord'); obj = tc.outputs['Object']
    v1 = k.abbild(obj, (1 / 1.0,) * 3); v2 = k.abbild(obj, (1 / 1.8,) * 3, (3.1, 1.7, 0.4)); v3 = k.abbild(obj, (1 / 2.12,) * 3, (0.3, 0.9, 0.0))
    pd = k.tex(v1, scan('white_rough_plaster', 'diff')); ph = k.tex(v1, scan('white_rough_plaster', 'disp'), False); pr = k.tex(v1, scan('white_rough_plaster', 'rough'), False)
    ad = k.tex(v2, scan('worn_mossy_plasterwall', 'diff')); ah = k.tex(v2, scan('worn_mossy_plasterwall', 'disp'), False)
    sd = k.tex(v3, scan('plaster_stone_wall_02', 'diff')); sh = k.tex(v3, scan('plaster_stone_wall_02', 'disp'), False); sr = k.tex(v3, scan('plaster_stone_wall_02', 'rough'), False)
    uv = k.n('ShaderNodeUVMap').outputs['UV']
    mt = k.n('ShaderNodeTexImage'); mt.image = maske; mt.interpolation = 'Cubic'; mt.extension = 'EXTEND'; k.nt.links.new(uv, mt.inputs['Vector'])
    sep = k.n('ShaderNodeSeparateColor'); k.nt.links.new(mt.outputs['Color'], sep.inputs[0])
    R, Gk, Bk, A = sep.outputs[0], sep.outputs[1], sep.outputs[2], mt.outputs['Alpha']
    # Kalkweiss mit Wolken, Feuchte und Algen von unten
    weiss = k.mix(1.0, k.farbton(pd, 1.12, 0.6), (0.93, 0.90, 0.84), 'MULTIPLY')
    wolke = k.bereich(k.rauschen(obj, 0.7, 4, 0.6), 0.35, 0.75)
    weiss = k.mix(k.math('MULTIPLY', wolke, 0.35), weiss, k.farbton(ad, 1.0, 0.8))
    feucht = k.math('MULTIPLY', Bk, k.bereich(k.rauschen(obj, 3.0, 4, 0.6), 0.2, 0.7), clamp=True)
    f = k.mix(feucht, weiss, k.mix(1.0, k.farbton(ad, 0.62, 1.1), (0.78, 0.86, 0.62), 'MULTIPLY'))
    lauf = k.math('MULTIPLY', Gk, k.bereich(k.rauschen(k.abbild(obj, (9, 9, 0.6)), 2.0, 3), 0.25, 0.7), clamp=True)
    f = k.mix(k.math('MULTIPLY', lauf, 0.8), f, (0.20, 0.19, 0.15), 'MULTIPLY')
    # Abplatzung: Maske + Scanhöhe + Rauschen → Bruchstein
    ab_in = k.math('ADD', k.math('ADD', R, k.math('MULTIPLY', k.math('SUBTRACT', ph, 0.5), -0.30)), k.math('MULTIPLY', k.math('SUBTRACT', k.rauschen(obj, 5.0, 5, 0.65), 0.5), 0.22))
    ab = k.bereich(ab_in, 0.615, 0.635)
    randzone = k.math('MULTIPLY', k.bereich(ab_in, 0.585, 0.615), k.math('SUBTRACT', 1.0, ab))   # Putzkante hell angebrochen
    stein = k.mix(k.math('MULTIPLY', feucht, 0.7), k.farbton(sd, 0.78, 0.85), (0.16, 0.20, 0.10), 'MULTIPLY')
    f = k.mix(k.math('MULTIPLY', randzone, 0.5), f, (0.80, 0.76, 0.68))
    f = k.mix(ab, f, stein)
    f = k.mix(k.math('MULTIPLY', A, k.math('SUBTRACT', 1.0, ab)), f, (0.05, 0.045, 0.04))
    rau = k.mixf(ab, k.math('MAXIMUM', pr, 0.75), sr)
    # Höhe in Metern um 0: Putzrelief ±4 mm, Riss −6 mm, Stein 22 mm tiefer mit eigenem Relief ±12 mm
    hp = k.math('ADD', k.math('MULTIPLY', k.math('SUBTRACT', ph, 0.5), 0.008), k.math('MULTIPLY', A, -0.006))
    hp = k.math('ADD', hp, k.math('MULTIPLY', k.math('SUBTRACT', ah, 0.5), 0.004))
    hs = k.math('ADD', -0.022, k.math('MULTIPLY', k.math('SUBTRACT', sh, 0.5), 0.024))
    h = k.mixf(ab, hp, hs)
    abschluss(k, b, out, f, rau, h, 1.0, bump=0.6, mitte=0.0)
    return m


def mat_sockel():
    m, k, b, out = neues_material('Sockel')
    obj = k.n('ShaderNodeTexCoord').outputs['Object']
    v = k.abbild(obj, (1 / 1.6,) * 3, (0.7, 0.2, 0.0))
    d = k.tex(v, scan('old_stone_wall', 'diff')); h = k.tex(v, scan('old_stone_wall', 'disp'), False); r = k.tex(v, scan('old_stone_wall', 'rough'), False)
    z = k.xyz(obj)[2]
    alge = k.math('MULTIPLY', k.bereich(z, 0.5, 0.0), k.bereich(k.rauschen(obj, 2.5, 4, 0.6), 0.3, 0.65))
    f = k.mix(alge, k.farbton(d, 0.7, 0.8), (0.07, 0.10, 0.03))
    abschluss(k, b, out, f, r, h, 0.035, bump=0.6)
    return m


def bewitterung(k, obj, G):
    """Wie weit der Regen hinkommt (0 = trocken unter dem Dach, 1 = frei bewittert): Abstand unter der Dachfläche
    gegen Abstand hinter der Dachkante, Schlagregen ~27° gegen das Lot. Gibt (Maske, Normale-z) zurück."""
    X0, X1, YA, ZT, PQ, B_, TAN = G['X0'], G['X1'], G['YA'], G['Z_T'], G['PQ'], G['B'], G['TAN']
    x, y, z = k.xyz(obj)
    ay = k.math('ABSOLUTE', y)
    innen = k.math('MINIMUM', k.math('MINIMUM', k.math('SUBTRACT', x, X0), k.math('SUBTRACT', X1, x)), k.math('SUBTRACT', YA, ay))
    dach = k.math('ADD', ZT + PQ + 0.2, k.math('MULTIPLY', k.math('SUBTRACT', B_ / 2, ay), TAN))
    unter = k.math('SUBTRACT', dach, z)
    e = k.math('SUBTRACT', k.math('MULTIPLY', unter, 0.5), innen)
    n = k.rauschen(obj, 1.3, 4, 0.6)
    w = k.bereich(k.math('ADD', e, k.math('MULTIPLY', k.math('SUBTRACT', n, 0.5), 1.0)), 0.7, 2.0, weich=True)
    nz = k.xyz(k.n('ShaderNodeNewGeometry').outputs['Normal'])[2]
    w = k.math('MAXIMUM', w, k.math('MULTIPLY', k.bereich(nz, 0.5, 0.95), k.bereich(e, -1.2, 0.0)))
    return w, nz, z


def mat_holz(name, G, dunkel=(0.105, 0.052, 0.028), anstrich=None, moos=1.0, versatz=0.010, halt=0.72, bleich=None):
    """Holz aus dem Scan `rough_wood` (Faser entlang V der Quader-UV, zwei Abgriffe gegen Wiederholung): unter dem
    Dach schwarzbraun, bewittert silbergrau (Befund Fotos), Oberseiten und Spritzzone vermoost/veralgt.
    `anstrich`: Farbe, die nur noch in Resten sitzt (Läden, Fensterstöcke)."""
    m, k, b, out = neues_material(name)
    tc = k.n('ShaderNodeTexCoord'); obj = tc.outputs['Object']
    uv = k.n('ShaderNodeUVMap').outputs['UV']
    uv2 = k.abbild(uv, (1, 1, 1), (0.37, 0.61, 0))
    wahl = k.bereich(k.rauschen(obj, 1.7, 2), 0.42, 0.58)
    d = k.mix(wahl, k.tex(uv, scan('rough_wood', 'diff'), True, False), k.tex(uv2, scan('rough_wood', 'diff'), True, False))
    h = k.mixf(wahl, k.tex(uv, scan('rough_wood', 'disp'), False, False), k.tex(uv2, scan('rough_wood', 'disp'), False, False))
    r = k.tex(uv, scan('rough_wood', 'rough'), False, False)
    w, nz, z = bewitterung(k, obj, G)
    ton = k.attr('ton')
    # Holz verwittert schneller als Stein und Putz (D437): auch unter dem Dach ist es angegriffen, frei bewittert ganz
    w = k.bereich(w, 0.0, 0.7, 0.22, 1.0)
    # Substanz aus der Faser: Jahrringrippen (weiches Frühholz ausgewaschen), Schwundrisse längs, Wurmgänge
    rippe = k.rauschen(k.abbild(uv, (95.0, 1.1, 1)), 1.0, 3, 0.55)
    riss = k.bereich(k.rauschen(k.abbild(uv, (21.0, 0.55, 1), (3.1, 1.7, 0)), 1.0, 2, 0.6), 0.615, 0.66)
    riss = k.math('MULTIPLY', riss, k.bereich(w, 0.0, 1.0, 0.45, 1.0))
    wurm = k.bereich(k.rauschen(obj, 85.0, 1, 0.3), 0.74, 0.78)
    wurm = k.math('MULTIPLY', wurm, k.bereich(k.rauschen(obj, 3.5, 2), 0.5, 0.62))
    rippe_w = k.math('MULTIPLY', k.math('SUBTRACT', rippe, 0.5), k.bereich(w, 0.0, 1.0, 0.35, 0.9))
    h = k.math('ADD', k.math('MULTIPLY', h, 0.55), k.math('ADD', 0.22, k.math('MULTIPLY', rippe_w, 0.55)))
    h = k.math('SUBTRACT', h, k.math('ADD', k.math('MULTIPLY', riss, 0.42), k.math('MULTIPLY', wurm, 0.3)), None, True)
    lum = k.grau(d)
    braun = k.mix(1.0, k.math('MULTIPLY', lum, 1.25), dunkel, 'MULTIPLY')
    braun = k.mix(1.0, braun, k.mix(ton, (0.55, 0.52, 0.50), (1.25, 1.2, 1.15)), 'MULTIPLY')   # jeder Balken ein eigener Ton
    grau = k.farbton(d, 1.0, 0.35)
    grau = k.mix(1.0, grau, k.mix(ton, (0.30, 0.285, 0.275), (0.48, 0.45, 0.42)), 'MULTIPLY')
    f = k.mix(w, braun, grau)
    if anstrich is not None:
        # Farbe blättert in Faserrichtung ab und hält sich nur in den Tälern und im Regenschatten
        schuppe = k.math('ADD', k.rauschen(k.abbild(uv, (7.0, 0.9, 1)), 1.0, 4, 0.7), k.math('MULTIPLY', k.math('SUBTRACT', rippe, 0.5), 0.35))
        rest = k.bereich(schuppe, 0.45, 0.51)
        rest = k.math('MULTIPLY', rest, k.math('SUBTRACT', 1.0, k.math('MULTIPLY', w, halt)))
        rest = k.math('MULTIPLY', rest, k.math('SUBTRACT', 1.0, riss))
        farbe = k.mix(1.0, k.farbton(anstrich, 1.0, 0.7), k.math('ADD', 0.55, lum), 'MULTIPLY')   # ausgekreidet
        f = k.mix(rest, f, farbe)
        h = k.math('ADD', h, k.math('MULTIPLY', rest, 0.06))      # Farbschicht steht leicht auf
    # Faser sichtbar machen: Rippen hell/dunkel, Risse und Wurmlöcher dunkel, Hirnholz saugt und dunkelt nach
    f = k.mix(1.0, f, k.mix(k.bereich(rippe_w, -0.3, 0.3), (0.72, 0.70, 0.68), (1.22, 1.20, 1.16)), 'MULTIPLY')
    f = k.mix(k.math('MAXIMUM', riss, wurm), f, (0.012, 0.009, 0.007))
    f = k.mix(k.math('MULTIPLY', k.attr('hirn'), 0.88), f, (0.03, 0.022, 0.016))
    # Fäule: Spritzzone und Wasserfahnen unter Oberkanten dunkeln schwarzbraun
    faul = k.math('MULTIPLY', k.bereich(z, 1.1, 0.1), k.bereich(k.rauschen(obj, 2.6, 4, 0.65), 0.38, 0.62))
    fahne = k.math('MULTIPLY', w, k.bereich(k.rauschen(k.abbild(uv, (5.0, 0.35, 1), (1.3, 0.4, 0)), 1.0, 3), 0.58, 0.72))
    f = k.mix(k.math('MULTIPLY', k.math('MAXIMUM', faul, fahne), 0.6), f, (0.035, 0.026, 0.02))
    if bleich is not None:   # D440: wo der Befall arbeitet, ist das Holz ausgelaugt — bleich, mürbe, ohne Moos
        bx, by, bz = k.xyz(obj)
        dx = k.math('SUBTRACT', bx, bleich[0]); dy = k.math('SUBTRACT', by, bleich[1])
        dist = k.math('SQRT', k.math('ADD', k.math('ADD', k.math('MULTIPLY', dx, dx), k.math('MULTIPLY', dy, dy)), k.math('MULTIPLY', bz, bz)))
        dist = k.math('ADD', dist, k.math('MULTIPLY', k.math('SUBTRACT', k.rauschen(obj, 2.4, 4, 0.65), 0.5), 1.1))
        aus = k.bereich(dist, bleich[2], bleich[2] * 0.3, weich=True)
        f = k.mix(k.math('MULTIPLY', aus, 0.55), f, k.mix(1.0, (0.50, 0.49, 0.44), k.math('ADD', 0.55, lum), 'MULTIPLY'))
        moos_aus = k.math('SUBTRACT', 1.0, aus)
    else: moos_aus = 1.0
    md = k.tex(k.abbild(obj, (1.0,) * 3), scan('moss_wood', 'diff'))
    gruen = k.math('MULTIPLY', k.math('MULTIPLY', w, moos), k.bereich(k.math('ADD', k.rauschen(obj, 2.2, 4, 0.65), k.math('MULTIPLY', k.bereich(nz, 0.3, 0.9), 0.35)), 0.55, 0.75))
    gruen = k.math('MAXIMUM', gruen, k.math('MULTIPLY', k.math('MULTIPLY', k.bereich(z, 0.7, 0.0), w), k.bereich(k.rauschen(obj, 3.0, 3), 0.45, 0.7)))
    f = k.mix(k.math('MULTIPLY', k.math('MULTIPLY', gruen, moos_aus), 0.85), f, k.farbton(md, 0.55, 0.85))
    abschluss(k, b, out, f, k.math('MAXIMUM', r, 0.6), h, versatz, bump=1.0)
    return m


def mat_dach():
    """Dachhaut: Scan `roof_09` (alte Falzziegel, 4 m Kachel) mit echter Verschiebung; Moos nach Vertexattribut
    `moos` (Schattenseite, Traufe, Lochrand) sitzt zuerst in den Rinnen zwischen den Ziegeln und wölbt sich als Polster auf."""
    m, k, b, out = neues_material('Dach')
    obj = k.n('ShaderNodeTexCoord').outputs['Object']
    uv = k.n('ShaderNodeUVMap').outputs['UV']
    d = k.tex(uv, scan('roof_09', 'diff'), True, False); h = k.tex(uv, scan('roof_09', 'disp'), False, False); r = k.tex(uv, scan('roof_09', 'rough'), False, False)
    ma = k.attr('moos')
    rinne = k.bereich(h, 0.62, 0.30)
    mm = k.math('ADD', k.math('MULTIPLY', ma, 1.25), k.math('ADD', k.math('MULTIPLY', rinne, 0.30), k.math('MULTIPLY', k.math('SUBTRACT', k.rauschen(obj, 0.9, 5, 0.7), 0.5), 1.5)))
    moos = k.bereich(mm, 0.72, 0.86)
    flechte = k.math('MULTIPLY', k.bereich(k.rauschen(obj, 11.0, 3, 0.6), 0.62, 0.70), k.math('SUBTRACT', 1.0, moos))
    mf = k.mix(k.bereich(k.rauschen(obj, 14.0, 3), 0.3, 0.75), (0.022, 0.040, 0.010), (0.10, 0.13, 0.030))
    mf = k.mix(k.bereich(k.rauschen(obj, 0.9, 3), 0.40, 0.65), mf, (0.085, 0.070, 0.035))   # trockene, braune Polster
    f = k.mix(k.math('MULTIPLY', flechte, 0.6), k.farbton(d, 0.72, 0.8), (0.42, 0.44, 0.36))
    f = k.mix(moos, f, mf)
    hh = k.math('ADD', k.math('MULTIPLY', k.math('SUBTRACT', h, 0.5), 0.06), k.math('MULTIPLY', moos, k.math('ADD', 0.022, k.math('MULTIPLY', k.rauschen(obj, 16.0, 3), 0.035))))
    abschluss(k, b, out, f, k.mixf(moos, r, 0.95), hh, 1.0, bump=0.7, mitte=0.0)
    return m


def mat_glas():
    """Fensterglas, blind und teils zerbrochen: Voronoi-Scherben fehlen dort, wo ein grobes Rauschen es will —
    manche Fenster sind fast ganz, andere halten nur noch Zacken im Rahmen."""
    m, k, b, out = neues_material('Glas', False)
    obj = k.n('ShaderNodeTexCoord').outputs['Object']
    vor = k.n('ShaderNodeTexVoronoi'); vor.inputs['Scale'].default_value = 7.0; k.nt.links.new(obj, vor.inputs['Vector'])
    zelle = k.grau(vor.outputs['Color'])
    wieviel = k.bereich(k.rauschen(obj, 0.45, 2), 0.3, 0.7, 0.15, 0.95)
    weg = k.math('LESS_THAN', zelle, wieviel)
    schmutz = k.bereich(k.rauschen(obj, 6.0, 4, 0.6), 0.3, 0.8)
    b.inputs['Base Color'].default_value = (0.03, 0.035, 0.035, 1)
    k.setze(b.inputs['Roughness'], k.mixf(schmutz, 0.06, 0.55)); b.inputs['Specular IOR Level'].default_value = 0.9
    tr = k.n('ShaderNodeBsdfTransparent')
    mx = k.n('ShaderNodeMixShader'); k.setze(mx.inputs[0], weg)
    k.nt.links.new(b.outputs[0], mx.inputs[1]); k.nt.links.new(tr.outputs[0], mx.inputs[2]); k.nt.links.new(mx.outputs[0], out.inputs['Surface'])
    return m


def mat_einfach(name, farbe, rau=0.9, licht=None, staerke=0.0):
    m, k, b, out = neues_material(name, False)
    b.inputs['Base Color'].default_value = (*farbe, 1); b.inputs['Roughness'].default_value = rau
    if licht: b.inputs['Emission Color'].default_value = (*licht, 1); b.inputs['Emission Strength'].default_value = staerke
    return m


# ───────────────────────────── Dachhaut, Schalung, Verformung ─────────────────────────────
def durchhang(G):
    """Funktion (x, y, z als Felder) → dz: First hängt zwischen den Auflagern durch, Laube am Giebel ist eingesackt."""
    L_, LW, ZT, ZOG, d, BR = G['L'], G['LW'], G['Z_T'], G['Z_OG'], G['LAUBE_T'], G['BRUEST']
    xs1, xs2 = LW + (L_ - LW) * 0.45, LW * 0.5
    ys = G['B'] * 0.18

    def f(x, y, z):
        oben = weich(ZT - 0.1, ZT + 0.7, z)
        dz = -oben * (0.36 * np.exp(-((x - xs1) / 5.0) ** 2) + 0.09 * np.exp(-((x - xs2) / 3.5) ** 2) + 0.05 * np.sin(x * 0.9) * np.exp(-((x - xs1) / 8.0) ** 2))
        # Hauptlaube am Giebel: ein Abschnitt hängt aussen bis 35 cm tiefer
        laube = (x < -0.05) * (z > ZOG - 0.45) * (z < ZOG + BR + 0.25)
        dz = dz - laube * 0.50 * np.exp(-((y - ys) / 1.9) ** 2) * (0.35 + 0.65 * np.clip(-x / d, 0, 1.3))
        # Laube an der Traufseite (Tennenseite): gegen das Ende abgesackt
        seite = (y < -G['B'] / 2 - 0.05) * (z > ZOG - 0.45) * (z < ZOG + BR + 0.25)
        dz = dz - seite * 0.55 * weich(LW * 0.35, LW - 0.3, x) * np.clip((-y - G['B'] / 2) / d, 0, 1.3)
        return dz
    return f


def dachhaut(G, sack, rng):
    """Dachhaut als Gitter je Seite (25 cm) mit UV für den Ziegel-Scan; Loch der Stufe 2 mit ausgefranstem Rand und
    kleinen Fehlstellen, Rand sackt ab. Attribut `moos` je Vertex. Dazu die Schalung unter den Ziegeln (Bretter
    quer zu den Sparren) — von unten sieht man am Giebelüberstand Holz, nicht Ziegelrücken."""
    X0, X1, VLEN, DACHD, LOCH, SH = G['X0'], G['X1'], G['VLEN'], G['DACHD'], G['LOCH'], G['SH']
    if LOCH is not None: LOCH = (LOCH[0], LOCH[1], LOCH[2] * 0.72, LOCH[3] * 0.92)   # D438: 0,5/0,8 las sich aus der Hauptkamera nicht als Loch   # der Baukasten reisst ein Sechstel der Fläche auf — für „Haus steht“ zu viel
    schritt = 0.25
    nx, nv = int((X1 - X0) / schritt), int((VLEN + 0.12) / schritt)
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap'); ml = bm.verts.layers.float.new('moos')
    ph = [rng.uniform(0, 6.28) for _ in range(6)]
    bretter = []
    for s in (-1, 1):
        O, v, w, R = G['dachrahmen'](s)

        def lochwert(x, vv):   # < 1 im Loch; Rand mit Zacken
            if LOCH is None or s > 0: return 9.0
            a = math.atan2((vv - LOCH[1]) / LOCH[3], (x - LOCH[0]) / LOCH[2])
            zack = 1 + 0.22 * math.sin(3 * a + ph[0]) + 0.14 * math.sin(7 * a + ph[1]) + 0.08 * math.sin(13 * a + ph[2])
            return math.hypot((x - LOCH[0]) / LOCH[2], (vv - LOCH[1]) / LOCH[3]) / zack
        vs = {}
        for i in range(nx + 1):
            for j in range(nv + 1):
                x = X0 + i * (X1 - X0) / nx; vv = j * (VLEN + 0.12) / nv
                lw = lochwert(x, vv)
                senke = 0.0 if lw > 2.4 else (1 - (lw - 1) / 1.4) ** 2 * 0.38 if lw > 1 else 0.38
                p = O + Vector((x, 0, 0)) + v * vv + w * (DACHD * 0.6 - senke)
                p.z += 0.05 * math.cos(vv / VLEN * 1.3)   # First leicht überdeckt
                q = bm.verts.new(p); vs[(i, j)] = q
                n = 0.5 + 0.5 * math.sin(x * 0.7 + ph[3]) * math.sin(vv * 0.9 + ph[4])
                q[ml] = (0.40 if s < 0 else 0.18) + 0.25 * (vv / VLEN) ** 2 + 0.18 * (n - 0.5) + (0.35 * max(0.0, 1 - (lw - 1) / 1.2) if lw < 2.2 else 0.0) \
                    + 0.3 * math.exp(-((x - G['LW']) / 1.2) ** 2)
        for i in range(nx):
            for j in range(nv):
                x = X0 + (i + 0.5) * (X1 - X0) / nx; vv = (j + 0.5) * (VLEN + 0.12) / nv
                lw = lochwert(x, vv)
                if lw < 1.0: continue
                if lw < 2.0 and rng.random() < 0.10 * (2.0 - lw): continue       # einzelne Platten am Lochrand fehlen
                if s < 0 and rng.random() < 0.004: continue                       # verstreute Fehlstellen
                ecken = (vs[(i, j)], vs[(i + 1, j)], vs[(i + 1, j + 1)], vs[(i, j + 1)])
                f = bm.faces.new(ecken if s > 0 else ecken[::-1])
                for lp in f.loops:
                    i2, j2 = next(key for key in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)) if vs[key] is lp.vert)
                    lp[uvl].uv = ((X0 + i2 * (X1 - X0) / nx) / 4.0 + (0.31 if s > 0 else 0.0), -(j2 * (VLEN + 0.12) / nv) / 4.0)
        # Schalung: Bretter längs x, 18 cm breit, in Stücken von 3–5 m
        nb = int(VLEN / 0.19)
        for j in range(nb):
            vv = (j + 0.5) * VLEN / nb; x = X0
            while x < X1 - 0.3:
                lang = min(rng.uniform(3.0, 5.0), X1 - x)
                xm = x + lang / 2
                if lochwert(xm, vv) > 1.25 and lochwert(x + 0.2, vv) > 1.1 and lochwert(x + lang - 0.2, vv) > 1.1 and rng.random() > 0.02:
                    M = Matrix.Translation(O + Vector((xm, 0, 0)) + v * vv + w * 0.012) @ R
                    bretter.append((M, (lang - 0.01, VLEN / nb - 0.008, 0.024), rng.random()))
                x += lang
    # Randziegel (D438): Traufe und Ortgang zeigen einzelne Ziegel statt einer Schnittkante — an der Traufe die
    # unterste Reihe mit verrutschten und fehlenden Platten, am Ortgang überlappende Ortgangziegel.
    def klotz(M, g, u_, v_):
        erg = bmesh.ops.create_cube(bm, size=1.0, matrix=M @ Matrix.Diagonal((*g, 1)))
        for f in {f for q in erg['verts'] for f in q.link_faces}:
            for lp in f.loops: lp[uvl].uv = (u_ + rng.uniform(-0.004, 0.004), v_ + rng.uniform(-0.004, 0.004))
        for q in erg['verts']: q[ml] = 0.45 + rng.uniform(-0.15, 0.25)
    zier = []
    for s in (-1, 1):
        O, v, w, R = G['dachrahmen'](s)
        x = X0
        while x < X1 - 0.05:
            bz = 0.215
            if rng.random() > 0.05:
                rutsch = rng.uniform(0.0, 0.05) if rng.random() < 0.3 else 0.0
                M = Matrix.Translation(O + Vector((x + bz / 2, 0, 0)) + v * (VLEN + 0.10 + rutsch) + w * (DACHD * 0.6 + 0.012)) @ R @ Matrix.Rotation(rng.uniform(-0.05, 0.09), 4, 'X')
                klotz(M, (bz - 0.012, 0.16, 0.034), x / 4.0, -(VLEN / 4.0) + rng.uniform(0, 0.02))
            x += bz
        for xr in (X0 + 0.04, X1 - 0.04):
            vv = 0.1
            while vv < VLEN:
                if rng.random() > 0.04:
                    M = Matrix.Translation(O + Vector((xr, 0, 0)) + v * (vv + 0.17) + w * (DACHD * 0.6 + 0.02)) @ R @ Matrix.Rotation(-0.07, 4, 'X')
                    klotz(M, (0.11, 0.36, 0.03), xr / 4.0, -vv / 4.0)
                vv += 0.33
        # Zierkante unter dem Ortgangbrett am Wohngiebel: Reihe auf die Spitze gestellter Brettchen
        vv = 0.25
        while vv < VLEN - 0.1:
            if rng.random() > 0.08:
                M = Matrix.Translation(O + Vector((X0 - 0.02, 0, 0)) + v * vv - w * (SH + 0.04)) @ R @ Matrix.Rotation(math.radians(45 + rng.uniform(-4, 4)), 4, 'X')
                zier.append((M, (0.022, 0.095, 0.095), rng.random()))
            vv += 0.15
    bretter += zier
    for q in [q for q in bm.verts if not q.link_faces]: bm.verts.remove(q)
    bm.normal_update()
    me = bpy.data.meshes.new('dach'); bm.to_mesh(me); bm.free()
    co = np.zeros(len(me.vertices) * 3); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    co[:, 2] += sack(co[:, 0], co[:, 1], co[:, 2] + 2.0)   # +2: die Haut liegt überall über der Wandkrone
    me.vertices.foreach_set('co', co.ravel()); me.update()
    o = bpy.data.objects.new('dach', me); bpy.context.scene.collection.objects.link(o)
    return o, bretter


def verformen(o, sack):
    me = o.data; co = np.zeros(len(me.vertices) * 3); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    co[:, 2] += sack(co[:, 0], co[:, 1], co[:, 2])
    me.vertices.foreach_set('co', co.ravel()); me.update()


# ───────────────────────────── Efeu aus Blattgeometrie ─────────────────────────────
def efeublatt():
    """Ein Hedera-Blatt (fünflappig, ~6 cm, längs der Mittelrippe leicht gefaltet) als Netz in der xy-Ebene, Spitze −y."""
    umriss = [(0.0, 0.2), (2.0, 0.9), (3.1, -0.4), (1.5, -1.6), (2.2, -3.6), (0.7, -3.3), (0.0, -5.6)]
    pts = umriss + [(-x, y) for x, y in reversed(umriss[1:-1])]
    bm = bmesh.new()
    c = bm.verts.new((0, -0.018, 0.004))
    vs = [bm.verts.new((x * 0.01, y * 0.01, abs(x) * 0.0028)) for x, y in pts]
    for i in range(len(vs)): bm.faces.new((c, vs[i], vs[(i + 1) % len(vs)]))
    bm.normal_update()
    me = bpy.data.meshes.new('Efeublatt'); bm.to_mesh(me); bm.free()
    m, k, b, out = neues_material('Efeu', False)
    zufall = k.n('ShaderNodeObjectInfo').outputs['Random']
    f = k.mix(k.bereich(zufall, 0.0, 0.8), (0.006, 0.018, 0.008), (0.022, 0.050, 0.014))
    f = k.mix(k.bereich(zufall, 0.90, 0.97), f, (0.06, 0.11, 0.025))   # junge, helle Blätter
    k.setze(b.inputs['Base Color'], f); b.inputs['Roughness'].default_value = 0.5; b.inputs['Specular IOR Level'].default_value = 0.3
    tr = k.n('ShaderNodeBsdfTranslucent'); k.setze(tr.inputs['Color'], k.mix(1.0, f, (1.6, 2.0, 0.9), 'MULTIPLY'))
    mx = k.n('ShaderNodeMixShader'); mx.inputs[0].default_value = 0.15
    k.nt.links.new(b.outputs[0], mx.inputs[1]); k.nt.links.new(tr.outputs[0], mx.inputs[2]); k.nt.links.new(mx.outputs[0], out.inputs['Surface'])
    me.materials.append(m)
    for p in me.polygons: p.use_smooth = True
    o = bpy.data.objects.new('Efeublatt', me)
    return o


def streu_gn(name, quelle, attr, dichte, smin, smax, saat, neigung=0.15, nur_instanzen=True, normal=False, fest=False):
    """Geometry Nodes: Instanzen aus einer Sammlung (oder einem Objekt) auf den Flächen verteilen, Dichte je m² aus
    einem Vertexattribut. `normal`: an der Flächennormale ausrichten (Blätter), sonst aufrecht mit kleiner Neigung."""
    ng = bpy.data.node_groups.new(name, 'GeometryNodeTree')
    ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    n = ng.nodes; l = ng.links.new
    ein = n.new('NodeGroupInput'); aus = n.new('NodeGroupOutput')
    na = n.new('GeometryNodeInputNamedAttribute'); na.data_type = 'FLOAT'; na.inputs['Name'].default_value = attr
    dm = n.new('ShaderNodeMath'); dm.operation = 'MULTIPLY'; dm.inputs[1].default_value = dichte; l(na.outputs['Attribute'], dm.inputs[0])
    dist = n.new('GeometryNodeDistributePointsOnFaces'); dist.distribute_method = 'RANDOM'; dist.inputs['Seed'].default_value = saat
    l(ein.outputs['Geometry'], dist.inputs['Mesh']); l(dm.outputs[0], dist.inputs['Density'])
    inst = n.new('GeometryNodeInstanceOnPoints')
    if isinstance(quelle, bpy.types.Collection):
        ci = n.new('GeometryNodeCollectionInfo'); ci.inputs['Collection'].default_value = quelle
        ci.inputs['Separate Children'].default_value = True; ci.inputs['Reset Children'].default_value = True
        inst.inputs['Pick Instance'].default_value = True
        zi = n.new('FunctionNodeRandomValue'); zi.data_type = 'INT'
        for s in zi.inputs:
            if s.type == 'INT' and s.name == 'Min': s.default_value = 0
            if s.type == 'INT' and s.name == 'Max': s.default_value = max(0, len(quelle.objects) - 1)
            if s.name == 'Seed': s.default_value = saat + 1
        l(ci.outputs[0], inst.inputs['Instance']); l(next(s for s in zi.outputs if s.type == 'INT'), inst.inputs['Instance Index'])
    else:
        oi = n.new('GeometryNodeObjectInfo'); oi.inputs['Object'].default_value = quelle; oi.inputs['As Instance'].default_value = True
        l(oi.outputs['Geometry'], inst.inputs['Instance'])
    zs = n.new('FunctionNodeRandomValue'); zs.data_type = 'FLOAT'
    for s in zs.inputs:
        if s.type == 'VALUE' and s.name == 'Min': s.default_value = smin
        if s.type == 'VALUE' and s.name == 'Max': s.default_value = smax
        if s.name == 'Seed': s.default_value = saat + 2
    zr_ = n.new('FunctionNodeRandomValue'); zr_.data_type = 'FLOAT_VECTOR'
    for s in zr_.inputs:
        if s.type == 'VECTOR' and s.name == 'Min': s.default_value = (-neigung, -neigung, 0.0)
        if s.type == 'VECTOR' and s.name == 'Max': s.default_value = (neigung, neigung, 6.283)
        if s.name == 'Seed': s.default_value = saat + 3
    l(dist.outputs['Points'], inst.inputs['Points']); l(next(s for s in zs.outputs if s.type == 'VALUE'), inst.inputs['Scale'])
    if normal:
        try:
            rr = n.new('FunctionNodeRotateRotation'); rr.rotation_space = 'LOCAL'
            l(dist.outputs['Rotation'], rr.inputs[0]); l(next(s for s in zr_.outputs if s.type == 'VECTOR'), rr.inputs[1])
            l(rr.outputs[0], inst.inputs['Rotation'])
        except Exception as e:
            print('RotateRotation', e); l(dist.outputs['Rotation'], inst.inputs['Rotation'])
    else:
        l(next(s for s in zr_.outputs if s.type == 'VECTOR'), inst.inputs['Rotation'])
    if nur_instanzen: l(inst.outputs['Instances'], aus.inputs['Geometry'])
    else:
        j = n.new('GeometryNodeJoinGeometry'); l(ein.outputs['Geometry'], j.inputs['Geometry']); l(inst.outputs['Instances'], j.inputs['Geometry'])
        if fest:   # zu einem Netz: Cycles kennt keine Instanzen von Instanzen, ein Wald aus Kartenbäumen würde sonst Millionen Objekte
            r = n.new('GeometryNodeRealizeInstances'); l(j.outputs[0], r.inputs[0]); l(r.outputs[0], aus.inputs['Geometry'])
        else: l(j.outputs[0], aus.inputs['Geometry'])
    return ng


def efeu(G, rng, blatt):
    """Hedera an der Hausecke Giebel/Traufseite: beginnt an zwei Punkten am Boden, unten schmal und mit kahlen Stämmen,
    wird nach oben zum Fächer, hängt mit Trieben über das erste Fenster und über die Laubenbrüstung (Befunde Efeu
    1–6: ungepflegt = nicht freigeschnitten). Träger ist ein welliges Netz 6–30 cm vor der Wand, darauf Blätter."""
    B_, HEG, d, ZOG, BR = G['B'], G['H_EG'], G['LAUBE_T'], G['Z_OG'], G['BRUEST']
    bm = bmesh.new(); dl = bm.verts.layers.float.new('d')
    ph = [rng.uniform(0, 6.28) for _ in range(8)]

    def flaeche(P, u0, u1, z0, z1, form, staerke=1.0, schritt=0.14):
        """P(u, z, a) → Punkt a Meter vor der Fläche; form(u, z) → 0..1 Deckung."""
        nu, nz = max(2, int((u1 - u0) / schritt)), max(2, int((z1 - z0) / schritt))
        vs = {}
        for i in range(nu + 1):
            for j in range(nz + 1):
                u, z = u0 + (u1 - u0) * i / nu, z0 + (z1 - z0) * j / nz
                f = form(u, z)
                if f <= 0.02: continue
                dick = 0.05 + 0.20 * f * (0.6 + 0.4 * math.sin(u * 3.1 + ph[0]) * math.sin(z * 2.7 + ph[1])) + rng.uniform(-0.035, 0.035)
                q = bm.verts.new(P(u + rng.uniform(-0.03, 0.03), z + rng.uniform(-0.03, 0.03), dick)); q[dl] = min(1.0, f * 1.6) * staerke
                vs[(i, j)] = q
        for i in range(nu):
            for j in range(nz):
                e = [vs.get(key) for key in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))]
                if all(e): bm.faces.new(e)

    def faecher(u, z, breite0, breite1, hoehe, mitte=0.0, kahl=0.9):
        """Fächer: unten breite0, oben breite1; unter `kahl` nur Stämme (dünn belaubt); Oberkante ausgefranst."""
        t = z / hoehe
        if t > 1.25 or z < 0.05: return 0.0
        halb = (breite0 + (breite1 - breite0) * min(1, t) ** 0.8) / 2 * (1 + 0.18 * math.sin(z * 4.0 + ph[2]))
        rand = 1 - abs(u - mitte) / max(0.05, halb)
        franse = hoehe * (1 + 0.16 * math.sin(u * 2.3 + ph[3]) + 0.10 * math.sin(u * 6.1 + ph[4]))
        oben = (franse - z) / 0.5
        return max(0.0, min(1.0, rand * 2.2, oben)) * (0.25 if z < kahl else 1.0)
    PG = lambda u, z, a: Vector((-a, u, z))                # Giebelwand, u = y
    PS = lambda u, z, a: Vector((u, -B_ / 2 - a, z))       # Traufseite, u = x
    PB = lambda u, z, a: Vector((-d - 0.02 - a, u, z))     # Laubenbrüstung am Giebel (aussen)
    PBS = lambda u, z, a: Vector((u, -B_ / 2 - d - 0.02 - a, z))
    oben_eg = HEG - 0.12
    flaeche(PG, -B_ / 2, -B_ / 2 + 5.0, 0.0, oben_eg, lambda u, z: faecher(u + B_ / 2, min(z, 9), 1.0, 7.5, oben_eg * 1.05, 0.4))
    flaeche(PS, 0.0, 5.5, 0.0, oben_eg, lambda u, z: faecher(u, z, 1.2, 9.0, oben_eg * 0.98, 0.5))
    # über die Laube: Vorhang an der Brüstung um die Ecke, ausgefranst nach unten (hängende Triebe)
    haengt = lambda u, z, lang: max(0.0, min(1.0, (1 - u / lang) * 2.0, (z - (ZOG - 0.55 - 0.45 * (0.5 + 0.5 * math.sin(u * 5.0 + ph[5])))) / 0.3))
    flaeche(PB, -B_ / 2 - d, -B_ / 2 + 3.2, ZOG - 1.1, ZOG + BR + 0.1, lambda u, z: haengt(u + B_ / 2 + d, z, 4.2))
    flaeche(PBS, -d, 3.6, ZOG - 1.1, ZOG + BR + 0.1, lambda u, z: haengt(u + d, z, 4.4))
    # Eckpfosten hoch bis unter das Dach: schmale Säule
    flaeche(PB, -B_ / 2 - d - 0.1, -B_ / 2 - d + 0.9, ZOG + BR, G['Z_T'] + 0.2, lambda u, z: max(0.0, 1 - abs(u + B_ / 2 + d - 0.3) / 0.5) * max(0.0, min(1.0, (G['Z_T'] + 0.1 - z) / 0.8)), 0.8)
    bm.normal_update()
    me = bpy.data.meshes.new('Efeutraeger'); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('Efeu', me); bpy.context.scene.collection.objects.link(o)
    mod = o.modifiers.new('Blaetter', 'NODES')
    mod.node_group = streu_gn('Efeublaetter', blatt, 'd', 700.0 if SCHNELL else 2000.0, 0.7, 1.4, 5, 0.9, True, True)
    # Triebe: hängende Stränge über dem ersten Giebelfenster und an der Brüstung, dazu kahle Stämme am Fuss
    bm = bmesh.new(); dl = bm.verts.layers.float.new('d')

    def strang(P, u, z_oben, lang, a=0.06):
        vs = []
        for i in range(int(lang / 0.08) + 1):
            z = z_oben - i * 0.08
            p = P(u + 0.04 * math.sin(i * 0.5 + u * 9), z, a + 0.02 * math.sin(i * 0.9))
            q0 = bm.verts.new(p); q1 = bm.verts.new(P(u + 0.05 + 0.04 * math.sin(i * 0.5 + u * 9), z, a + 0.03))
            q0[dl] = q1[dl] = 1.0; vs.append((q0, q1))
        for i in range(len(vs) - 1): bm.faces.new((vs[i][0], vs[i][1], vs[i + 1][1], vs[i + 1][0]))
    fen = [o_ for o_ in G['OEFF']['giebel']['eg'] if o_[4] == 'fenster']
    if fen:
        f0 = min(fen, key=lambda o_: o_[0])
        for u in np.arange(f0[0] - 0.1, f0[1] + 0.1, 0.11):
            if rng.random() < 0.6: strang(PG, u, oben_eg, rng.uniform(0.35, f0[3] - f0[2] + 0.5))
    for u in np.arange(-B_ / 2 - d, -B_ / 2 + 2.5, 0.16):
        if rng.random() < 0.55: strang(PB, u, ZOG - 0.5, rng.uniform(0.3, 1.3), 0.03)
    for u in np.arange(-d, 3.0, 0.16):
        if rng.random() < 0.55: strang(PBS, u, ZOG - 0.5, rng.uniform(0.3, 1.2), 0.03)
    me2 = bpy.data.meshes.new('Efeutriebe'); bm.to_mesh(me2); bm.free()
    o2 = bpy.data.objects.new('Efeutriebe', me2); bpy.context.scene.collection.objects.link(o2)
    mod = o2.modifiers.new('Blaetter', 'NODES')
    mod.node_group = streu_gn('Efeutrieb', blatt, 'd', 600.0 if SCHNELL else 1800.0, 0.6, 1.2, 9, 0.9, True, True)
    # Stämme: verdrehte Stränge vom Boden, 3–7 cm dick, grau
    cu = bpy.data.curves.new('Efeustamm', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 1.0; cu.bevel_resolution = 2
    for P, u0 in ((PG, -B_ / 2 + 0.4), (PG, -B_ / 2 + 0.55), (PS, 0.5), (PS, 0.65), (PS, 0.38)):
        sp = cu.splines.new('POLY'); n_ = 14; sp.points.add(n_ - 1)
        dr = rng.uniform(-0.5, 0.5)
        for i in range(n_):
            z = i / (n_ - 1) * 2.4
            p = P(u0 + dr * (z / 2.4) ** 1.5 + 0.05 * math.sin(z * 5 + u0 * 7), z - 0.1, 0.03 + 0.02 * math.sin(z * 4))
            sp.points[i].co = (*p, 1); sp.points[i].radius = 0.035 * (1 - 0.6 * i / n_) * rng.uniform(0.8, 1.2)
    o3 = bpy.data.objects.new('Efeustamm', cu); bpy.context.scene.collection.objects.link(o3)
    cu.materials.append(mat_einfach('Efeuholz', (0.10, 0.085, 0.07), 0.9))
    return [o, o2, o3]


# ───────────────────────────── Gelände ─────────────────────────────
def obj_laden(pfad, name):
    vorher = set(bpy.data.objects)
    bpy.ops.wm.obj_import(filepath=pfad, forward_axis='Y', up_axis='Z')
    o = next(x for x in bpy.data.objects if x not in vorher); o.name = name
    for p in o.data.polygons: p.use_smooth = True
    return o


def koord(o):
    co = np.zeros(len(o.data.vertices) * 3); o.data.vertices.foreach_get('co', co)
    return co.reshape(-1, 3)


def attribut(o, name, werte):
    a = o.data.attributes.get(name) or o.data.attributes.new(name, 'FLOAT', 'POINT')
    a.data.foreach_set('value', np.asarray(werte, np.float32))


def loch(o, halb):
    bm = bmesh.new(); bm.from_mesh(o.data)
    weg = [f for f in bm.faces if all(abs(v.co.x) < halb and abs(v.co.y) < halb for v in f.verts)]
    bmesh.ops.delete(bm, geom=weg, context='FACES'); bm.to_mesh(o.data); bm.free()


def weitblick(h0):
    """Bergkulisse jenseits des Fernfelds aus dem groben Umlandraster (`oental-fern.json`, EU-DEM, 125 m).
    Lage: das Raster ist um die Regionsmitte zentriert (Welt 0/0), Zeile 0 = Norden."""
    d = json.load(open(os.path.join(REPO, 'public', 'world', 'oental-fern.json')))
    H = np.array(d['hoehen'], float); n = H.shape[0]
    sued, west, nord, ost = d['bbox']
    breite = (ost - west) * 111320 * math.cos(math.radians((sued + nord) / 2)); tiefe = (nord - sued) * 111320
    basis = float(np.percentile(H, 2))    # Talboden ≈ Welthöhe 0
    bm = bmesh.new(); vs = {}
    for i in range(n):
        for j in range(n):
            wx = (j / (n - 1) - 0.5) * breite; wz = (i / (n - 1) - 0.5) * tiefe
            X, Y = wx - 238.0, 231.0 - wz
            vs[(i, j)] = bm.verts.new((X, Y, (H[i, j] - basis) - h0 - 20.0))
    for i in range(n - 1):
        for j in range(n - 1):
            e = [vs[(i, j)], vs[(i + 1, j)], vs[(i + 1, j + 1)], vs[(i, j + 1)]]
            if all(abs(q.co.x) < 1150 and abs(q.co.y) < 1150 for q in e): continue
            bm.faces.new(e)
    me = bpy.data.meshes.new('weit'); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('weit', me); bpy.context.scene.collection.objects.link(o)
    for p in me.polygons: p.use_smooth = True
    return o


class Gelaende:
    """Nahfeld als Höhenraster (1 m): Hofterrasse einebnen, Höhen abfragen, Dichte-Attribute für die Streuung."""
    def __init__(s, o, M, G):
        s.o = o; s.co = koord(o); s.n = int(round(math.sqrt(len(s.co)))); s.M = M; s.Mi = M.inverted()
        s.halb = (s.n - 1) / 2
        # Punkte in Hauskoordinaten
        mi = np.array(s.Mi); xy1 = np.c_[s.co[:, 0], s.co[:, 1], np.zeros(len(s.co)), np.ones(len(s.co))]
        hk = xy1 @ mi.T; s.hx, s.hy = hk[:, 0], hk[:, 1]
        L_, B_ = G['L'], G['B']
        dx = np.maximum(np.maximum(-s.hx, s.hx - L_), 0); dy = np.maximum(np.abs(s.hy) - B_ / 2, 0)
        s.d_haus = np.hypot(dx, dy)                       # Abstand zum Grundriss (0 innen)

    def hoehe(s, x, y):
        j = min(max(x + s.halb, 0), s.n - 1.001); i = min(max(s.halb - y, 0), s.n - 1.001)
        i0, j0 = int(i), int(j); fi, fj = i - i0, j - j0
        Z = s.co[:, 2].reshape(s.n, s.n)
        return (Z[i0, j0] * (1 - fj) + Z[i0, j0 + 1] * fj) * (1 - fi) + (Z[i0 + 1, j0] * (1 - fj) + Z[i0 + 1, j0 + 1] * fj) * fi

    def schreiben(s):
        s.o.data.vertices.foreach_set('co', s.co.ravel()); s.o.data.update()


def mat_gelaende():
    """Boden: nah Scans mit Verschiebung (Laubstreu unter Bäumen, Waldboden/Krautschicht im Hof, Erde auf dem
    Trittweg), dazu grobes Farbrauschen; ab ~70 m nur noch Biomfarbe (Wiese olivgrün, Wald dunkel) — Ferne ist Fläche."""
    m, k, b, out = neues_material('Gelaende')
    obj = k.n('ShaderNodeTexCoord').outputs['Object']
    v1 = k.abbild(obj, (1 / 2.0,) * 3); v2 = k.abbild(obj, (1 / 1.3,) * 3, (0.3, 0.7, 0), (0, 0, 0.6)); v3 = k.abbild(obj, (1 / 3.0,) * 3, (1.3, 0.2, 0), (0, 0, 1.9))
    gd = k.tex(v1, scan('forest_ground_04', 'diff')); gh = k.tex(v1, scan('forest_ground_04', 'disp'), False)
    wd = k.tex(v2, scan('brown_mud_leaves_01', 'diff')); wh = k.tex(v2, scan('brown_mud_leaves_01', 'disp'), False)
    ld = k.tex(v3, scan('forest_leaves_02', 'diffuse')); lh = k.tex(v3, scan('forest_leaves_02', 'disp'), False)
    weg = k.attr('weg'); nah = k.attr('nah'); wald = k.attr('wald'); streu = k.attr('streu')
    wm = k.bereich(k.math('ADD', weg, k.math('MULTIPLY', k.math('SUBTRACT', wh, 0.5), 0.5)), 0.42, 0.58)
    sm = k.bereich(k.math('ADD', streu, k.math('MULTIPLY', k.math('SUBTRACT', k.rauschen(obj, 0.5, 4, 0.6), 0.5), 0.7)), 0.40, 0.62)
    f = k.mix(sm, k.mix(1.0, k.farbton(gd, 0.36, 0.9), (0.72, 0.95, 0.55), 'MULTIPLY'), k.farbton(ld, 0.42, 0.85))
    f = k.mix(wm, f, k.farbton(wd, 0.62, 0.85))
    h = k.mixf(wm, k.mixf(sm, gh, lh), k.math('MULTIPLY', wh, 0.8))
    gross = k.rauschen(obj, 0.05, 4, 0.6)
    wiese = k.mix(k.bereich(gross, 0.35, 0.7), (0.060, 0.075, 0.022), (0.115, 0.125, 0.040))
    wiese = k.mix(k.bereich(k.rauschen(obj, 0.012, 3), 0.4, 0.65), wiese, (0.14, 0.13, 0.055))
    fern = k.mix(wald, wiese, (0.018, 0.030, 0.014))
    f = k.mix(nah, fern, k.mix(k.math('MULTIPLY', k.bereich(gross, 0.3, 0.7), 0.35), f, k.mix(1.0, f, (0.7, 0.8, 0.5), 'MULTIPLY')))
    hh = k.math('MULTIPLY', k.math('SUBTRACT', h, 0.5), k.math('MULTIPLY', nah, 0.07))
    abschluss(k, b, out, f, 0.93, hh, 1.0, bump=0.6, mitte=0.0)
    return m


def mat_fern():
    m, k, b, out = neues_material('Fern', False)
    obj = k.n('ShaderNodeTexCoord').outputs['Object']
    farbe = k.n('ShaderNodeVertexColor'); farbe.layer_name = 'Color'
    sep = k.n('ShaderNodeSeparateColor'); k.nt.links.new(farbe.outputs['Color'], sep.inputs[0])
    wald = k.bereich(sep.outputs[1], 0.45, 0.35)
    wasser = k.bereich(sep.outputs[2], 0.5, 0.7)
    gross = k.rauschen(obj, 0.02, 4, 0.6)
    wiese = k.mix(k.bereich(gross, 0.35, 0.7), (0.065, 0.080, 0.025), (0.12, 0.125, 0.045))
    f = k.mix(wald, wiese, k.mix(k.bereich(k.rauschen(obj, 0.06, 4, 0.7), 0.3, 0.7), (0.014, 0.024, 0.011), (0.030, 0.045, 0.018)))
    f = k.mix(wasser, f, (0.10, 0.12, 0.12))
    k.setze(b.inputs['Base Color'], f); b.inputs['Roughness'].default_value = 0.95
    return m


# ───────────────────────────── Pflanzen, Bäume ─────────────────────────────
def scan_alpha(me, ordner):
    """Alpha-Karte der Scan-Materialien einhängen (D440, Befund D386 aus `stilframes.py`): das glTF-Farbbild von Poly Haven
    ist ein JPG ohne Alphakanal, die Maske liegt als `…_alpha_….png` daneben (`tools/hausframe_scans.py` lädt sie).
    Ohne sie sind Blatt- und Graskarten deckend — schwarze Halme, zu dichte Kronen."""
    for mat in me.materials:
        if mat is None or mat.get('alpha_drin') or not mat.use_nodes: continue
        nt = mat.node_tree
        b = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None); out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None)
        if b is None or out is None or not b.inputs['Base Color'].links: continue
        dif = b.inputs['Base Color'].links[0].from_node
        if dif.type != 'TEX_IMAGE' or dif.image is None: continue
        datei = os.path.basename(dif.image.filepath.replace('\\', '/'))   # der Bildpfad ist im Renderlauf relativ (`//textures/…`): Ordner kommt vom Aufrufer
        if '_diff_' not in datei: continue
        ap = os.path.join(ordner, 'textures', os.path.splitext(datei.replace('_diff_', '_alpha_'))[0] + '.png')
        if not os.path.exists(ap): continue
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = bild(ap, False); t.interpolation = dif.interpolation; t.extension = dif.extension
        if dif.inputs['Vector'].links: nt.links.new(dif.inputs['Vector'].links[0].from_socket, t.inputs['Vector'])
        for l_ in list(b.inputs['Alpha'].links): nt.links.remove(l_)
        b.inputs['Alpha'].default_value = 1.0
        gt = nt.nodes.new('ShaderNodeMath'); gt.operation = 'GREATER_THAN'; gt.inputs[1].default_value = 0.4; nt.links.new(t.outputs['Color'], gt.inputs[0])
        tp = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
        quelle = out.inputs['Surface'].links[0].from_socket
        nt.links.new(gt.outputs[0], mx.inputs[0]); nt.links.new(tp.outputs[0], mx.inputs[1]); nt.links.new(quelle, mx.inputs[2]); nt.links.new(mx.outputs[0], out.inputs['Surface'])
        mat['alpha_drin'] = 1; ALPHA_GEZAEHLT.add(mat.name)


ALPHA_GEZAEHLT = set()


def scan_modelle(name):
    """glTF-Scan importieren, Objekte entfernen, Netze (Ursprung in der Grundfläche, mittig) zurückgeben."""
    o = scan_ordner(name)
    pfad = os.path.join(o, next(f for f in os.listdir(o) if f.endswith('.gltf')))
    vorher = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=pfad)
    neu = [x for x in bpy.data.objects if x not in vorher]
    meshes = []
    for x in neu:
        if x.type == 'MESH':
            x.data.transform(x.matrix_world); meshes.append(x.data)
    for x in neu: bpy.data.objects.remove(x)
    for me in meshes:
        co = np.zeros(len(me.vertices) * 3); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
        me.transform(Matrix.Translation((-(co[:, 0].min() + co[:, 0].max()) / 2, -(co[:, 1].min() + co[:, 1].max()) / 2, -co[:, 2].min())))
        me['hoehe'] = float(co[:, 2].max() - co[:, 2].min()); scan_alpha(me, o)
    return meshes


def scan_baum(name):
    """Baum-Scan, dessen glTF aus mehreren Netzen besteht (Stamm, Laub), zu einem Netz verbinden (D438)."""
    o = scan_ordner(name)
    pfad = os.path.join(o, next(f for f in os.listdir(o) if f.endswith('.gltf')))
    vorher = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=pfad)
    neu = [x for x in bpy.data.objects if x not in vorher]; netze = [x for x in neu if x.type == 'MESH']
    with bpy.context.temp_override(active_object=netze[0], selected_objects=netze, selected_editable_objects=netze, object=netze[0]):
        if len(netze) > 1: bpy.ops.object.join()
    dz = netze[0].modifiers.new('Duenn', 'DECIMATE'); dz.ratio = float(os.environ.get('HAUS_BAUM2_ANTEIL', '0.3'))   # 3,9 Mio. Dreiecke sprengen den Grafikspeicher des M1
    with bpy.context.temp_override(active_object=netze[0], object=netze[0], selected_objects=[netze[0]]):
        bpy.ops.object.modifier_apply(modifier=dz.name)
    me = netze[0].data; me.transform(netze[0].matrix_world)
    for x in list(bpy.data.objects):
        if x not in vorher: bpy.data.objects.remove(x)
    co = np.zeros(len(me.vertices) * 3); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    me.transform(Matrix.Translation((-(co[:, 0].min() + co[:, 0].max()) / 2, -(co[:, 1].min() + co[:, 1].max()) / 2, -co[:, 2].min())))
    me['hoehe'] = float(co[:, 2].max() - co[:, 2].min())
    scan_alpha(me, o)
    print('HAUSFRAME Baum %s: %d Dreiecke, %.1f m' % (name, len(me.polygons), me['hoehe']))
    return me


def sammlung(name, meshes):
    col = bpy.data.collections.new(name); bpy.context.scene.collection.children.link(col)
    for i, me in enumerate(meshes):
        col.objects.link(bpy.data.objects.new('%s_%d' % (name, i), me))
    bpy.context.view_layer.layer_collection.children[col.name].exclude = True
    return col


def setze(me, name, ort, hoehe=None, skala=1.0, rot=None, rnd=random, kipp=0.0):
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    s = (hoehe / me['hoehe']) if hoehe else skala
    o.scale = (s, s, s); o.rotation_euler = (rnd.uniform(-kipp, kipp), rnd.uniform(-kipp, kipp), rot if rot is not None else rnd.random() * 6.283)
    o.location = ort
    return o


# ───────────────────────────── Licht, Himmel, Dunst ─────────────────────────────
def sonnenrichtung():
    el, az = math.radians(SONNE_EL), math.radians(SONNE_AZ)
    return Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))


def himmel():
    """Himmel aus einem Abendhimmel-HDRI (Poly Haven `evening_road_01_puresky`, CC0): echte Wolkenformen statt
    Rauschen. Gestaltet wird trotzdem: gedreht, bis die Sonne des HDRI auf dem Azimut der Sonnenlampe steht; was die
    Kamera sieht, ist wärmer und heller als das, was die Szene beleuchtet (Schatten warm-neutral, nicht blau)."""
    pfad = os.path.join(scan_ordner('evening_road_01_puresky'), 'evening_road_01_puresky_4k.hdr')
    im = bpy.data.images.load(pfad)
    w_, h_ = im.size
    px = np.zeros(w_ * h_ * 4, np.float32); im.pixels.foreach_get(px); px = px.reshape(h_, w_, 4)
    lum = px[::8, ::8, :3].sum(axis=2); iy, ix = np.unravel_index(np.argmax(lum), lum.shape)
    a = (ix * 8 / w_ - 0.5) * 2 * math.pi           # u = atan2(y, −x) / 2π + 0,5
    hdr = math.atan2(math.sin(a), -math.cos(a)); ziel = math.atan2(math.cos(math.radians(SONNE_AZ)), math.sin(math.radians(SONNE_AZ)))
    print('HAUSFRAME HDRI-Sonne bei u=%.3f, Höhe %.1f°' % (ix * 8 / w_, (iy * 8 / h_ - 0.5) * 180))
    w = bpy.data.worlds.new('Himmel'); bpy.context.scene.world = w; w.use_nodes = True; nt = w.node_tree; nt.nodes.clear()
    k = K(nt)
    out = nt.nodes.new('ShaderNodeOutputWorld')
    tc = k.n('ShaderNodeTexCoord')
    mp = k.abbild(tc.outputs['Generated'], (1, 1, 1), (0, 0, 0), (0, 0, hdr - ziel))
    env = k.n('ShaderNodeTexEnvironment'); env.image = im; nt.links.new(mp, env.inputs['Vector'])
    gm = k.n('ShaderNodeGamma'); gm.inputs['Gamma'].default_value = 1.7; nt.links.new(env.outputs['Color'], gm.inputs['Color'])   # Wolken plastischer
    warm = k.mix(1.0, gm.outputs[0], (1.10, 0.96, 0.82), 'MULTIPLY')
    sicht = k.n('ShaderNodeBackground'); k.setze(sicht.inputs['Color'], warm); sicht.inputs['Strength'].default_value = 0.115
    fuell = k.mix(0.40, env.outputs['Color'], (0.27, 0.27, 0.28))     # Füllen halb entsättigt: Schatten neutral, weder blau noch braun
    licht = k.n('ShaderNodeBackground'); k.setze(licht.inputs['Color'], fuell); licht.inputs['Strength'].default_value = 0.42
    lp = k.n('ShaderNodeLightPath')
    mx = k.n('ShaderNodeMixShader'); nt.links.new(lp.outputs['Is Camera Ray'], mx.inputs[0])
    nt.links.new(licht.outputs[0], mx.inputs[1]); nt.links.new(sicht.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], out.inputs['Surface'])
    lampe = bpy.data.lights.new('Sonne', 'SUN'); lampe.color = (1.0, 0.66, 0.38); lampe.energy = 3.8; lampe.angle = math.radians(1.6)
    o = bpy.data.objects.new('Sonne', lampe); bpy.context.scene.collection.objects.link(o)
    o.rotation_euler = (-sonnenrichtung()).to_track_quat('-Z', 'Y').to_euler(); o.location = (0, 0, 80)


def dunst(name, mitte, groesse, z0, z1, dichte, abfall, farbe, aniso=0.45):
    """Höhenabhängiger Dunst im Kasten: dichte · exp(−(z − z0) / abfall) — Bodenschicht in der Farbe des Himmels zur Sonne."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(mitte[0], mitte[1], (z0 + z1) / 2))
    o = bpy.context.active_object; o.name = name; o.scale = (groesse, groesse, z1 - z0)
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear(); k = K(nt)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    z = k.xyz(k.n('ShaderNodeTexCoord').outputs['Object'])[2]
    e = k.math('EXPONENT', k.math('MULTIPLY', k.math('ADD', z, 0.5), -(z1 - z0) / abfall))
    vol = k.n('ShaderNodeVolumePrincipled'); vol.inputs['Color'].default_value = (*farbe, 1); vol.inputs['Anisotropy'].default_value = aniso
    k.setze(vol.inputs['Density'], k.math('MULTIPLY', e, dichte)); nt.links.new(vol.outputs[0], out.inputs['Volume'])
    o.data.materials.append(m)
    return o


def kamera(name, ort, ziel, brennweite):
    cam = bpy.data.cameras.new(name); cam.lens = brennweite; cam.sensor_width = 36; cam.clip_start = 0.05; cam.clip_end = 20000
    o = bpy.data.objects.new(name, cam); bpy.context.scene.collection.objects.link(o)
    o.location = ort; o.rotation_euler = (Vector(ziel) - Vector(ort)).to_track_quat('-Z', 'Y').to_euler()
    return o


# ───────────────────────────── Aufbau ─────────────────────────────
def speicher():
    try: return 'Speicherspitze %.1f GiB' % (int(next(l for l in open('/proc/self/status') if l.startswith('VmHWM')).split()[1]) / 2 ** 20)
    except Exception: return ''


def bau():
    objdir, praefix = ARGS[1], ARGS[2]
    breite, hoehe, samples = (int(ARGS[3]), int(ARGS[4]), int(ARGS[5])) if len(ARGS) > 5 else (1280, 720, 48)
    kameras = (ARGS[6] if len(ARGS) > 6 else 'haus').split(',')
    t0 = time.time()
    rng = np.random.default_rng(SAAT); rnd = random.Random(SAAT)
    G = rohbau()
    sc = bpy.context.scene; ob = {o.name: o for o in sc.objects}
    L_, B_, LW = G['L'], G['B'], G['LW']
    print('HAUSFRAME Rohbau %.1f × %.1f m, Deckung %s, Loch %s, Bundwerk %s' % (L_, B_, G['DECKUNG'], G['LOCH'], G['BUNDWERK']))
    for n_ in ('boden', 'rinde', 'laub', 'ziegel', 'schindel', 'blech', 'wellblech', 'licht'):
        if n_ in ob: bpy.data.objects.remove(ob.pop(n_))
    if 'stein' in ob:   # Schwersteine der Legschindeln liegen im selben Netz wie der Sockel
        bm = bmesh.new(); bm.from_mesh(ob['stein'].data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z > G['H_EG']], context='VERTS'); bm.to_mesh(ob['stein'].data); bm.free()
    sack = durchhang(G)
    dach, schalung = dachhaut(G, sack, rnd)
    # Zutaten in Holz: Schalung, angelehnte Haustür, Bretterstapel am Wandfuss
    extra = list(schalung)
    tb, th = G['TB'], G['TH']
    lehn = math.radians(11)   # D439: Türblatt lehnt an der Giebelwand — Unterkante ganz am Boden, Oberkante an der Wand
    for i in range(5):   # Türblatt aus den Angeln, lehnt links neben der Öffnung
        M = Matrix.Translation((-0.05 - th / 2 * math.sin(lehn), -tb / 2 - 0.75, th / 2 * math.cos(lehn) - 0.03)) @ Matrix.Rotation(lehn, 4, 'Y') @ Matrix.Translation((0, (i - 2) * tb / 5, 0))
        extra.append((M, (0.045, tb / 5 - 0.006, th), rnd.random()))
    for i in range(9):   # abgefallene Bretter vor der Traufseite
        M = Matrix.Translation((rnd.uniform(LW, L_ - 1), -B_ / 2 - rnd.uniform(0.3, 1.6), 0.05 + 0.03 * i * 0.3)) @ Matrix.Rotation(rnd.uniform(-0.5, 0.5), 4, 'Z') @ Matrix.Rotation(rnd.uniform(-0.12, 0.12), 4, 'Y')
        extra.append((M, (rnd.uniform(1.4, 3.2), 0.19, 0.025), rnd.random()))
    wuerfel_dazu(ob['holz_brett'], extra)
    # UV und Maske
    maske, wm, hr = putzmaske(G, rng)
    putz_uv(ob['putz'], G, wm, hr)
    holz_uv(ob['holz_block'], 0.8, rnd, 0.25)
    holz_uv(ob['holz_brett'], 0.7, rnd, 1.1, 0.07)
    if 'laeden' in ob: laden_aus_brettern(ob['laeden'], rnd, G)
    for n_ in ('rahmen', 'laeden'):
        if n_ in ob: holz_uv(ob[n_], 0.6, rnd, 0.6)
    for n_ in ('putz', 'stein', 'holz_block', 'holz_brett', 'rahmen', 'laeden', 'glas', 'dunkel'):
        if n_ in ob: verformen(ob[n_], sack)
    tor = next(o for o in G['OEFF']['sued']['eg'] if o[4] == 'tor')
    # Befall (D440): kommt über den Hof auf den Wohngiebel zu — dort sehen ihn Haupt- und Nahkamera. Am Tennentor (vorher)
    # verdeckten Hangkante und Bäume den Wandfuss.
    SPUR = (Vector((-8.5, -10.5, 0)), Vector((-0.45, -3.0, 0)))   # Weg des Befalls über den Hof zur Giebelwand
    herd = (0.0, SPUR[1].y, 2.3)   # Front am Wandfuss: Mitte und Wirkradius der Bleiche
    mats = {'putz': mat_putz(maske), 'stein': mat_sockel(), 'holz_block': mat_holz('HolzBlock', G, bleich=herd), 'holz_brett': mat_holz('HolzBrett', G, (0.13, 0.078, 0.048), None, 1.2, 0.008, bleich=herd),
            'rahmen': mat_holz('HolzRahmen', G, (0.16, 0.12, 0.09), (0.78, 0.76, 0.70), 0.5, 0.006, 0.42), 'laeden': mat_holz('HolzLaden', G, (0.12, 0.09, 0.06), (0.075, 0.20, 0.10), 0.5, 0.007),
            'glas': mat_glas(), 'dunkel': mat_einfach('Dunkel', (0.006, 0.005, 0.005), 1.0)}
    for n_, mt in mats.items():
        if n_ in ob: ob[n_].data.materials.clear(); ob[n_].data.materials.append(mt)
    dach.data.materials.append(mat_dach())
    sol = dach.modifiers.new('Dicke', 'SOLIDIFY'); sol.thickness = 0.03; sol.offset = -1.0
    for n_, px_, fs_ in (('putz', 1.5, 0), ('stein', 2.5, 0), ('holz_block', 3.0, 0.009), ('holz_brett', 4.0, 0.003), ('rahmen', 3.0, 0.004), ('laeden', 3.0, 0.003)):   # Pixel je Mikrodreieck: feiner sprengt den Speicher (15 GiB)
        if n_ in ob: adaptiv(ob[n_], px_, False, fs_)
    adaptiv(dach, 1.5)
    haus = [o for o in ob.values()] + [dach]
    blatt = efeublatt()
    haus += efeu(G, rnd, blatt)
    # D440: Der Befall ist Biotechnik, die arbeitet (Story-Bibel §1: Bodensanierung) — ein Geflecht, das aus dem Boden
    # kommt, über die Schwelle kriecht und am Wandfuss hochwächst. Der Körper ist bleich und leuchtet nicht; nur die
    # wachsenden Spitzen glimmen in der Signalfarbe (Pass-Index 7). Holz am Herd ist ausgebleicht (`mat_holz` `bleich`),
    # der Boden darum kahl (`d_*` weiter unten).
    # Die Fäden leben (Flo 22.11.2026: „lumineszierender und lebendiger“): hinten alt, grau und fast dunkel; zur Front
    # hin leuchten sie von innen, in unregelmässigen Abschnitten heller — als wandere etwas durch sie hindurch.
    mg, kg, bg, _ = neues_material('Geflecht', False)
    go_ = kg.n('ShaderNodeTexCoord').outputs['Object']; gx, gy, gz = kg.xyz(go_)
    ach_ = SPUR[1] - SPUR[0]
    t_s = kg.math('DIVIDE', kg.math('ADD', kg.math('MULTIPLY', kg.math('SUBTRACT', gx, SPUR[0].x), ach_.x), kg.math('MULTIPLY', kg.math('SUBTRACT', gy, SPUR[0].y), ach_.y)), ach_.length_squared)
    jung = kg.bereich(t_s, 0.25, 0.95, weich=True)
    puls = kg.bereich(kg.rauschen(go_, 6.5, 2, 0.5), 0.54, 0.70, weich=True)
    ader = kg.bereich(kg.rauschen(go_, 38.0, 1, 0.3), 0.35, 0.7)
    kraft = kg.math('MULTIPLY', jung, kg.math('ADD', 0.05, kg.math('MULTIPLY', kg.math('MULTIPLY', puls, ader), float(os.environ.get('HAUS_BEFALL_LICHT', '1.3')))))
    kg.setze(bg.inputs['Base Color'], kg.mix(jung, (0.17, 0.175, 0.15), (0.10, 0.17, 0.19)))
    bg.inputs['Roughness'].default_value = 0.45
    bg.inputs['Emission Color'].default_value = (*SIGNAL, 1); kg.setze(bg.inputs['Emission Strength'], kraft)
    mb = mat_einfach('Befall', (0.02, 0.05, 0.06), 0.3, SIGNAL, 2.6)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1); kugel = bpy.context.object.data; bpy.data.objects.remove(bpy.context.object); kugel.materials.append(mb)
    DICHT = int(os.environ.get('HAUS_BEFALL', '60'))   # Stränge im Band (Flo 22.11.2026: dichter; vorher 30)
    cu = bpy.data.curves.new('Geflecht', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 1.0; cu.bevel_resolution = 1; cu.use_fill_caps = True
    cu.materials.append(mg)
    # Gerechnet wird in Wandkoordinaten (u längs der Giebelwand, n Abstand davor ≤ 0, z); `haus_k` tauscht u/n zurück.
    ya = -0.075; oeff = (-G['TB'] / 2 - 0.1, G['TB'] / 2 + 0.1); spitzen = []   # Haustür: dort gibt es keine Wand
    haus_k = lambda v_: Vector((v_.y, v_.x, v_.z)); spur_w = (haus_k(SPUR[0]), haus_k(SPUR[1]))

    def strang(ort, richt, radius, wand, tiefe=0, frisch=True):
        pts = [(ort.copy(), radius)]; schritte = rnd.randint(14, 44) if tiefe == 0 else rnd.randint(6, 20)
        for i_ in range(schritte):
            richt = (richt + Vector((rnd.gauss(0, 0.33), rnd.gauss(0, 0.33) * (0 if wand else 1), rnd.gauss(0, 0.33) * (1 if wand else 0)))).normalized()
            ort = ort + richt * 0.045
            offen = oeff[0] < ort.x < oeff[1]   # in der Toröffnung gibt es keine Wand
            if wand:
                ort.y = ya - 0.002 * tiefe; ort.z = max(ort.z, 0.01)
                if offen: ort.x = oeff[0] if ort.x - oeff[0] < oeff[1] - ort.x else oeff[1]; richt.x = 0.0
            else:
                ort.z = 0.012 + 0.003 * tiefe
                if ort.y > ya - 0.05 and not offen:   # an der Wand angekommen: wächst dort hoch (durch das offene Tor kriecht es weiter)
                    wand = True; richt = Vector((richt.x * 0.5, 0, 1)).normalized()
            if wand and ort.z > 0.85: break   # bleibt unter den Fensterbänken
            r_ = radius * (1 - 0.8 * (i_ + 1) / schritte)
            pts.append((ort.copy(), r_))
            if tiefe < 3 and rnd.random() < 0.13:
                quer = Vector((-richt.z, 0, richt.x)) if wand else Vector((-richt.y, richt.x, 0))
                strang(ort.copy(), (richt + quer * rnd.choice((-1, 1)) * rnd.uniform(0.5, 1.2)).normalized(), r_ * 0.7, wand, tiefe + 1, frisch)
        sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
        for q, (o_, r_) in zip(sp.points, pts): q.co = (*haus_k(o_), 1); q.radius = r_
        if (frisch or wand) and rnd.random() < 0.09: spitzen.append((haus_k(pts[-1][0]), max(pts[-1][1] * 1.6, 0.004)))   # nur die Front glimmt, alte Stränge sind tot

    # Ausbreitung (Flo 22.11.2026: „es sollte schon was sein, was sich ausbreitet“): ein Band kommt von aussen über den
    # Hof auf das Tor zu. Hinten alt — dicke, tote Stränge ohne Glimmen; vorn an der Schwelle die Front — dünn, frisch.
    for i_ in range(DICHT):
        t_ = ((i_ + rnd.random()) / DICHT) ** 0.75   # zur Front hin dichter
        achse = spur_w[1] - spur_w[0]; quer_ = Vector((-achse.y, achse.x, 0)).normalized()
        start = spur_w[0] + achse * t_ + quer_ * rnd.gauss(0, 0.32 + 0.25 * t_); start.z = 0.012
        strang(start, (achse.normalized() + quer_ * rnd.gauss(0, 0.5)).normalized(), 0.017 - 0.010 * t_, False, 0, t_ > 0.6)
    for _ in range(DICHT // 3):   # am Wandfuss hoch, um die Stelle, an der das Band ankommt
        strang(Vector((spur_w[1].x + rnd.gauss(0, 0.8), ya, 0.02)), Vector((rnd.uniform(-0.4, 0.4), 0, 1)).normalized(), rnd.uniform(0.006, 0.011), True)
    go = bpy.data.objects.new('Geflecht', cu); sc.collection.objects.link(go); haus.append(go)
    glimmer = []
    for ort, r in spitzen:
        o = bpy.data.objects.new('Befall', kugel); sc.collection.objects.link(o); haus.append(o); o.pass_index = 7
        o.location = ort; o.scale = (r, r, r); glimmer.append(o)
    # Spur am Boden: wo das Geflecht durchgezogen ist, ist der Boden ausgelaugt — ein fahles, kühles Band, das auch aus
    # der Ferne lesbar bleibt, wenn die Stränge selbst unter die Pixelgrösse fallen. Fleckig über Rauschen, Ränder weich.
    bm = bmesh.new(); ach = SPUR[1] - SPUR[0]; qu = Vector((-ach.y, ach.x, 0)).normalized(); nl, nq = 40, 10
    gitter = [[bm.verts.new(SPUR[0] + ach * (i_ / nl * 1.04) + qu * ((j_ / nq - 0.5) * 2 * (1.0 + 0.9 * i_ / nl)) + Vector((0, 0, 0.02))) for j_ in range(nq + 1)] for i_ in range(nl + 1)]
    uvl = bm.loops.layers.uv.new('UVMap')
    for i_ in range(nl):
        for j_ in range(nq):
            f_ = bm.faces.new((gitter[i_][j_], gitter[i_ + 1][j_], gitter[i_ + 1][j_ + 1], gitter[i_][j_ + 1]))
            for lp, (a_, b_2) in zip(f_.loops, ((i_, j_), (i_ + 1, j_), (i_ + 1, j_ + 1), (i_, j_ + 1))): lp[uvl].uv = (a_ / nl, b_2 / nq)
    sme = bpy.data.meshes.new('Befallspur'); bm.to_mesh(sme); bm.free()
    msp = bpy.data.materials.new('Befallspur'); msp.use_nodes = True; nt = msp.node_tree; nt.nodes.clear(); ks = K(nt)
    aus_ = nt.nodes.new('ShaderNodeOutputMaterial'); pb = nt.nodes.new('ShaderNodeBsdfPrincipled'); tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
    pb.inputs['Base Color'].default_value = (0.30, 0.33, 0.32, 1); pb.inputs['Roughness'].default_value = 0.9
    pb.inputs['Emission Color'].default_value = (*SIGNAL, 1); pb.inputs['Emission Strength'].default_value = 0.03
    uvs = ks.xyz(ks.n('ShaderNodeUVMap').outputs['UV']); tco = ks.n('ShaderNodeTexCoord').outputs['Object']
    rand_ = ks.math('MULTIPLY', ks.bereich(ks.math('ABSOLUTE', ks.math('SUBTRACT', uvs[1], 0.5)), 0.5, 0.18, weich=True), ks.math('MULTIPLY', ks.bereich(uvs[0], 0.0, 0.2, weich=True), ks.bereich(uvs[0], 1.0, 0.93)))
    fleck = ks.bereich(ks.rauschen(tco, 3.0, 6, 0.75), 0.42, 0.66)
    ks.setze(mx.inputs[0], ks.math('MULTIPLY', ks.math('MULTIPLY', rand_, fleck), 0.38))
    nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(pb.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], aus_.inputs['Surface'])
    sme.materials.append(msp); spur_o = bpy.data.objects.new('Befallspur', sme); sc.collection.objects.link(spur_o); haus.append(spur_o)
    spur_o.visible_shadow = False
    print('HAUSFRAME Geflecht %d Stränge' % len(cu.splines))
    bl = bpy.data.lights.new('Befallschein', 'POINT'); bl.color = SIGNAL; bl.energy = 3.0; bl.shadow_soft_size = 0.3
    bo = bpy.data.objects.new('Befallschein', bl); sc.collection.objects.link(bo); bo.location = (SPUR[1].x - 0.1, SPUR[1].y, 0.3); haus.append(bo)

    # Lage in der Welt: gespiegelt (y → −y), gedreht, auf den Grundriss von 708 gesetzt
    dvek = Vector((math.cos(HOF_WINKEL), math.sin(HOF_WINKEL), 0))
    p0 = Vector((HOF_MITTE[0], HOF_MITTE[1], 0)) - dvek * (L_ / 2)
    ter = obj_laden(os.path.join(objdir, 'terrain.obj'), 'terrain')
    M0 = Matrix.Translation(p0) @ Matrix.Rotation(HOF_WINKEL, 4, 'Z') @ Matrix.Diagonal((1, -1, 1, 1))
    gel = Gelaende(ter, M0, G)
    zc = gel.hoehe(HOF_MITTE[0], HOF_MITTE[1]); zg = gel.hoehe(p0.x, p0.y)
    pad = zc + 0.35 * (zg - zc)
    print('HAUSFRAME Gelände Mitte %.2f, Giebel %.2f, Terrasse %.2f' % (zc, zg, pad))
    M = Matrix.Translation((0, 0, pad)) @ M0
    gel.M = M; gel.Mi = M.inverted()
    t = weich(0.8, 9.0, gel.d_haus)
    gel.co[:, 2] = pad - 0.04 + (gel.co[:, 2] - pad) * t
    leer = bpy.data.objects.new('Hof', None); sc.collection.objects.link(leer); leer.matrix_world = M
    for o in haus: o.parent = leer
    hw = lambda x, y, z=0.0: M @ Vector((x, y, z))
    boden = lambda x, y: Vector((*(hw(x, y).xy), gel.hoehe(*hw(x, y).xy)))   # Hauskoordinate → Weltpunkt auf dem Boden

    # Kamera: hangaufwärts vor der Ecke Giebel/Traufseite
    kp = boden(-16.0, -17.5); kp.z += 1.75
    kam = {'haus': kamera('KameraHaus', kp, hw(9.5, -1.0, 3.4), 30)}
    np_ = boden(-5.2, -B_ / 2 - 1.2); np_.z += 1.55
    kam['nah'] = kamera('KameraNah', np_, hw(0.0, -B_ / 2 + 2.6, 1.75), 35)
    tp_ = boden(-3.6, -6.6); tp_.z += 1.05
    kam['befall'] = kamera('KameraBefall', tp_, hw(-0.3, -3.2, 0.3), 35)   # D440: Befall aus der Nähe
    print('HAUSFRAME Kamera', tuple(round(x, 2) for x in kp), 'über Terrasse %.2f m' % (kp.z - pad))

    # Trittweg: von der Kamera zur Haustür und weiter zum Tennentor
    wegpunkte = [(-23, -22), (-16.5, -18), (-11.5, -11.5), (-5.5, -4.0), (-1.2, 0.0)]
    weg2 = [(-8.5, -7.5), (-4, -B_ / 2 - 3.5), (6, -B_ / 2 - 3.0), ((tor[0] + tor[1]) / 2, -B_ / 2 - 1.0)]
    dweg = np.full(len(gel.co), 99.0)
    for pts in (wegpunkte, weg2):
        for (ax, ay), (bx, by) in zip(pts[:-1], pts[1:]):
            abx, aby = bx - ax, by - ay; tt = np.clip(((gel.hx - ax) * abx + (gel.hy - ay) * aby) / (abx * abx + aby * aby), 0, 1)
            dweg = np.minimum(dweg, np.hypot(gel.hx - ax - tt * abx, gel.hy - ay - tt * aby))
    n2d = gitter_rauschen(gel.n, gel.n, 6, 6, rng).ravel(); n2e = gitter_rauschen(gel.n, gel.n, 17, 17, rng).ravel()
    weg = np.clip(1.15 - dweg / (1.0 + 0.6 * n2d), 0, 1)
    gel.co[:, 2] -= 0.07 * weich(0.2, 1.0, weg)
    gel.co[:, 2] += (n2d - 0.5) * 0.10 * weich(0.5, 4.0, gel.d_haus)       # Buckel im Hofraum
    gel.schreiben()
    # D440: Befall auf das Gelände setzen — der Hof ist nicht eben, das Geflecht wurde bei z ≈ 0 gebaut
    def auf_boden(x, y): return gel.hoehe(*hw(x, y).xy) - hw(x, y, 0.0).z
    for sp in go.data.splines:
        for q in sp.points:
            if q.co.z < 0.04: q.co.z += auf_boden(q.co.x, q.co.y)
    for o in glimmer:
        if o.location.z < 0.04: o.location.z += auf_boden(o.location.x, o.location.y)
    for v_ in spur_o.data.vertices: v_.co.z += auf_boden(v_.co.x, v_.co.y)
    dkam = np.hypot(gel.co[:, 0] - kp.x, gel.co[:, 1] - kp.y)
    dmit = np.hypot(gel.co[:, 0] - hw(L_ / 2, 0).x, gel.co[:, 1] - hw(L_ / 2, 0).y)
    nah = 1 - weich(55.0, 85.0, dmit)
    farbe = np.zeros(len(gel.co) * 4, np.float32); ter.data.attributes['Color'].data.foreach_get('color', farbe); farbe = farbe.reshape(-1, 4)
    wald = (farbe[:, 1] < 0.45).astype(np.float32)
    attribut(ter, 'weg', weg); attribut(ter, 'nah', nah); attribut(ter, 'wald', wald)
    # Sichtkeil: nur was die Hauptkamera sehen kann, bekommt Kleinpflanzen (Rest der 320 m bleibt leer)
    blick = (hw(9.5, -1.0) - kp).xy.normalized()
    rel = np.c_[gel.co[:, 0] - kp.x, gel.co[:, 1] - kp.y]; vor = rel @ np.array(blick); seitl = np.abs(rel @ np.array((-blick.y, blick.x)))
    keil = ((vor > -3.0) & (seitl < 0.75 * (vor + 6.0))).astype(np.float32)
    aussen = (gel.d_haus > 0.25).astype(np.float32)
    frei = (1 - weich(0.0, 0.45, weg)) * aussen * (np.hypot(gel.co[:, 0] - np_.x, gel.co[:, 1] - np_.y) > 2.2) * (dkam > 1.2)
    wandfuss = np.exp(-gel.d_haus / 1.3) * aussen
    klump = weich(0.45, 0.7, n2e)
    hoch = frei * (dweg > 2.2 + 1.5 * n2d)                    # hohes Kraut hält Abstand zum Weg: die Blickbahn bleibt offen
    # Sonnengasse: vom Giebel zur Sonne stehen keine Waldbäume, sonst liegt die Fassade im Schatten
    sh = (M.inverted().to_3x3() @ sonnenrichtung()).xy.normalized()
    entlang = gel.hx * sh.x + gel.hy * sh.y; quer = np.abs(gel.hx * sh.y - gel.hy * sh.x)
    gasse = (entlang > -5) & (quer < 18 + 0.2 * np.maximum(entlang, 0))
    reich = (1 - weich(40.0, 75.0, dkam)) * keil
    sa, sb = SPUR[0], SPUR[1] - SPUR[0]; st = np.clip(((gel.hx - sa.x) * sb.x + (gel.hy - sa.y) * sb.y) / sb.length_squared, 0, 1)
    kahl = weich(0.7, 2.0 + 0.8 * st, np.hypot(gel.hx - sa.x - st * sb.x, gel.hy - sa.y - st * sb.y))   # D440: entlang der Spur des Befalls wächst nichts, am Tor breiter
    frei = frei * kahl; hoch = hoch * kahl
    attribut(ter, 'd_gras', frei * reich * (0.35 + 0.65 * (1 - klump)) * (1 - 0.6 * wandfuss))
    attribut(ter, 'd_nessel', hoch * reich * np.clip(wandfuss * 1.4 + 1.0 * weich(0.62, 0.8, n2e) * weich(0.4, 0.7, n2d), 0, 1.5))
    attribut(ter, 'd_staude', hoch * reich * np.clip(0.9 * weich(0.58, 0.8, 1 - n2e) * weich(0.5, 0.75, n2d) + 0.4 * wandfuss, 0, 1.3))
    attribut(ter, 'd_strauch', hoch * reich * weich(0.6, 0.85, n2e) * weich(1.5, 4.0, gel.d_haus) * (dkam > 7.0))
    # Sichtschneise (D439): links am Wirtschaftsteil vorbei bleibt der Blick ins Tal frei — dort staffeln sich die
    # Waldränder des Talbodens und der Höhenzug dahinter im Dunst. Winkel um die Kamera in Hauskoordinaten.
    def schneise(hx, hy):
        w_ = np.degrees(np.arctan2(hy + 17.5, hx + 16.0)); d_ = np.hypot(hx + 16.0, hy + 17.5)
        return (w_ > SCHNEISE[0]) & (w_ < SCHNEISE[1]) & (d_ < SCHNEISE[2])
    attribut(ter, 'd_wald', wald * (gel.d_haus > 22) * (dkam > 14) * (~gasse) * (~schneise(gel.hx, gel.hy)))
    attribut(ter, 'streu', np.clip(0.25 + 0.6 * wandfuss + 0.5 * klump, 0, 1))
    ter.data.materials.clear(); ter.data.materials.append(mat_gelaende())
    adaptiv(ter, 3.0, True)

    fern = obj_laden(os.path.join(objdir, 'fern_terrain.obj'), 'fern_terrain'); loch(fern, 159.5)
    fern.data.materials.clear(); fern.data.materials.append(mat_fern())
    fco = koord(fern); fcol = np.zeros(len(fco) * 4, np.float32); fern.data.attributes['Color'].data.foreach_get('color', fcol); fcol = fcol.reshape(-1, 4)
    fh = np.c_[fco[:, 0], fco[:, 1], np.zeros(len(fco)), np.ones(len(fco))] @ np.array(M.inverted()).T
    attribut(fern, 'd_wald', (fcol[:, 1] < 0.45) * (np.hypot(fco[:, 0], fco[:, 1]) < 750) * (~schneise(fh[:, 0], fh[:, 1])))
    h0 = json.load(open(os.path.join(objdir, 'terrain.json')))['h0']
    weit = weitblick(h0); weit.data.materials.append(mat_fern())
    wco = koord(weit); wf = weit.data.attributes.new('Color', 'FLOAT_COLOR', 'POINT')
    wcol = np.tile(np.array([0.05, 0.3, 0.1, 1.0], np.float32), (len(wco), 1)); wcol[wco[:, 2] < -h0 + 40] = (0.2, 0.6, 0.2, 1.0)
    wf.data.foreach_set('color', wcol.ravel())

    # Kleinpflanzen (Poly Haven, echte Blattgeometrie statt Graskarten)
    def streue(name, modelle, attr, dichte, smin, smax, saat, traeger=ter, neigung=0.15):
        col = sammlung('S_' + name, modelle)
        o = bpy.data.objects.new('Streu_' + name, traeger.data); sc.collection.objects.link(o)
        mod = o.modifiers.new('Streu', 'NODES'); mod.node_group = streu_gn('GN_' + name, col, attr, dichte * (0.4 if SCHNELL else 1.0), smin, smax, saat, neigung)
        return o
    if 'pflanzen' not in OHNE:
        gm = [m_ for m_ in scan_modelle('grass_medium_01') if m_['hoehe'] > 0.12] + scan_modelle('grass_medium_02')
        streue('gras', gm, 'd_gras', 11.0, 0.9, 1.9, 11)                                                   # Gras 30–80 cm in Horsten
        streue('decker', scan_modelle('weed_plant_02') + scan_modelle('shrub_sorrel_01'), 'd_gras', 9.0, 2.0, 3.5, 15)   # Bodendecker
        streue('nessel', scan_modelle('nettle_plant'), 'd_nessel', 9.0, 2.5, 4.5, 12)                      # Brennnesselpolster, bis 1,3 m
        streue('staude', scan_modelle('shrub_03'), 'd_staude', 5.0, 1.0, 1.8, 13)                          # Blühkraut/Stauden in Inseln
        streue('strauch', scan_modelle('shrub_02'), 'd_strauch', 0.10, 0.7, 1.3, 14, neigung=0.25)         # Gebüsch (Holunder/Brombeere angenähert)
        # Bäume: Scans mit echter Ast- und Blattgeometrie. Die Spielbäume (`baum-*-nah/mittel.glb`) lasen sich im
        # Mittelgrund als Klumpen auf kahlen Stangen (Probelauf) — hier stehen deshalb skalierte Scan-Bäume. Ein Laubbaum-Scan
        # in vielen Grössen statt mehrerer Arten: jeder weitere Scan kostet ~1 GiB, die Maschine hat 16 für alle.
        isl1 = scan_modelle('island_tree_01'); isl2 = scan_modelle('island_tree_02'); jung = isl1; tanne = scan_modelle('fir_sapling_medium')[1:]   # zwei der drei Tannen genügen (Speicher)
        zweit = scan_baum('jacaranda_tree') if 'zweitbaum' not in OHNE else isl1[0]   # zweiter Laubbaum-Scan (D378/D438)
        if zweit is not isl1[0]:   # auf die Höhe des ersten Scans bringen: die Streuung skaliert beide mit denselben Faktoren
            fz = isl1[0]['hoehe'] / zweit['hoehe']; zweit.transform(Matrix.Diagonal((fz, fz, fz, 1))); zweit['hoehe'] = isl1[0]['hoehe']
        col_l = sammlung('S_laubwald', isl1 + [zweit]); col_n = sammlung('S_nadelwald', tanne)
        for traeger, dichte, saat in ((ter, 0.010, 21), (fern, 0.008, 22)):
            for col, anteil, smin, smax in ((col_l, 0.45, 2.6, 4.4), (col_n, 0.55, 2.0, 3.4)):
                o = bpy.data.objects.new('Wald_%s_%s' % (traeger.name, col.name), traeger.data); sc.collection.objects.link(o)
                mod = o.modifiers.new('Wald', 'NODES'); mod.node_group = streu_gn('GN_%s_%s' % (col.name, traeger.name), col, 'd_wald', dichte * anteil, smin, smax, saat + len(col.name), 0.04)
        b_ = lambda x, y, tief=0.15: boden(x, y) - Vector((0, 0, tief))
        # Baumcharaktere: wenige, mit Masse
        setze(zweit, 'Linde', b_(4.0, 16.5, 0.5), hoehe=17.0, rot=0.6, rnd=rnd)                      # alte Hoflinde hinter dem Giebel, neben der Sonnenbahn
        setze(jung[0], 'Schattenbaum', b_(-11.0, 13.0, 0.2), hoehe=12.5, rot=1.1, rnd=rnd)             # in der Sonnengasse: Lichtflecken statt Flächenlicht auf dem Giebel
        setze(isl1[0], 'Rueckenbaum', b_(-25.0, 0.0, 0.4), hoehe=14.0, rot=3.3, rnd=rnd)              # hinter der Kamera zur Sonne: legt den Vordergrund in Schatten (Rahmen)
        setze(zweit, 'Hofbaum', b_(L_ + 7.0, 9.0, 0.3), hoehe=19.0, rot=2.2, rnd=rnd)      # hinter dem Wirtschaftsteil
        setze(isl1[0], 'Obstbaum', b_(17.0, -B_ / 2 - 8.5), hoehe=5.6, rot=2.1, rnd=rnd)               # Obstbaum im Hofraum
        setze(isl2[0], 'Rahmenbaum', b_(-8.4, -19.0, 0.75), hoehe=float(os.environ.get('HAUS_RAHMEN_H', '7.5')), rot=float(os.environ.get('HAUS_RAHMEN_ROT', '4.2')), rnd=rnd)   # rahmt, Äste über dem Bild
        for i, (x, y, h_) in enumerate(((2.5, -B_ / 2 - 1.3, 3.2), (9.0, -B_ / 2 - 2.2, 4.6), (LW + 1.0, -B_ / 2 - 1.0, 2.2), (-2.2, -B_ / 2 - 2.6, 2.6), (L_ - 4, -B_ / 2 - 3, 6.5),
                                        (-2.8, 3.2, 2.0), (L_ + 3, -3, 7.5), (14, -B_ / 2 - 6.5, 5.5), (-13.5, -3.0, 3.4), (20, -B_ / 2 - 2.0, 3.0))):
            setze(jung[i % len(jung)], 'Jungbaum%d' % i, b_(x, y, 0.05), hoehe=h_, rnd=rnd)
        for i, (x, y, h_) in enumerate(((-0.9, -B_ / 2 - 0.9, 1.9), (LW + 4, -B_ / 2 - 1.6, 1.5), (-6, -4.5, 1.2), (5.5, -B_ / 2 - 4.5, 2.3))):
            setze(tanne[i % len(tanne)], 'Jungfichte%d' % i, b_(x, y, 0.03), hoehe=h_, rnd=rnd)
        # Totholz und Reisig
        for i, me in enumerate(scan_modelle('dry_branches_medium_01')[:4]):
            setze(me, 'Reisig%d' % i, b_(rnd.uniform(-12, 4), -B_ / 2 - rnd.uniform(2, 9), 0.0), rnd=rnd)
    # Schutt am Wandfuss: Wulst aus dem Rubble-Scan unter den abgeplatzten Wänden, unregelmässige Kante
    bm = bmesh.new()
    for (ax, ay, bx, by, nx_, ny_) in ((0, -B_ / 2, L_, -B_ / 2, 0, -1), (0, B_ / 2, 0, -B_ / 2, -1, 0)):
        n_ = int(math.hypot(bx - ax, by - ay) / 0.3); reihen = []
        for i in range(n_ + 1):
            tt = i / n_; x, y = ax + (bx - ax) * tt, ay + (by - ay) * tt
            br = 0.25 + 0.75 * (0.5 + 0.5 * math.sin(tt * 37 + 1.3) * math.sin(tt * 11)) * rnd.uniform(0.6, 1.2); ho = 0.06 + 0.22 * (br - 0.25)
            reihe = [bm.verts.new(hw(x + nx_ * br * q, y + ny_ * br * q, 0) + Vector((0, 0, ho * (1 - q) ** 1.5 * (0 if q < 0 else 1) - 0.03))) for q in (-0.15, 0.0, 0.25, 0.5, 0.75, 1.0)]
            reihen.append(reihe)
        for r0, r1 in zip(reihen[:-1], reihen[1:]):
            for j in range(5): bm.faces.new((r0[j], r0[j + 1], r1[j + 1], r1[j]))
    bm.normal_update(); me = bpy.data.meshes.new('Schutt'); bm.to_mesh(me); bm.free()
    schutt = bpy.data.objects.new('Schutt', me); sc.collection.objects.link(schutt)
    msch, k, b, out = neues_material('Schutt'); obj = k.n('ShaderNodeTexCoord').outputs['Object']; v = k.abbild(obj, (1 / 1.4,) * 3)
    abschluss(k, b, out, k.farbton(k.tex(v, scan('rubble', 'diff')), 0.7, 0.8), k.tex(v, scan('rubble', 'rough'), False), k.tex(v, scan('rubble', 'disp'), False), 0.06, bump=0.7)
    me.materials.append(msch); adaptiv(schutt, 3.0, True)
    # Zaunreste entlang des Trittwegs: schiefe Pfosten, zwei hängende Stangen
    zaun_me = bpy.data.meshes.new('Zaun'); zaun = bpy.data.objects.new('Zaun', zaun_me); sc.collection.objects.link(zaun)
    zl = []
    pf = [(-17.5, -13.0), (-15.0, -10.6), (-12.6, -8.0), (-10.2, -5.6), (-8.0, -3.0), (-6.0, -0.4)]
    for i, (x, y) in enumerate(pf):
        if i == 3: continue   # ein Pfosten fehlt
        p = boden(x, y); hh = rnd.uniform(0.9, 1.25)
        Mp = Matrix.Translation(p + Vector((0, 0, hh / 2 - 0.15))) @ Matrix.Rotation(rnd.uniform(-0.28, 0.28), 4, 'X') @ Matrix.Rotation(rnd.uniform(-0.28, 0.28), 4, 'Y')
        zl.append((Mp, (0.11, 0.10, hh), rnd.random()))
    for (i0, i1, z0, z1) in ((0, 1, 0.85, 0.8), (1, 2, 0.8, 0.15), (4, 5, 0.75, 0.7), (0, 1, 0.45, 0.42)):
        a = boden(*pf[i0]) + Vector((0, 0, z0)); e = boden(*pf[i1]) + Vector((0, 0, z1)); dd = e - a
        Mr = Matrix.Translation((a + e) / 2) @ dd.to_track_quat('X', 'Z').to_matrix().to_4x4()
        zl.append((Mr, (dd.length + 0.2, 0.035, 0.11), rnd.random()))
    wuerfel_dazu(zaun, zl); holz_uv(zaun, 0.7, rnd)
    Gz = dict(G); Gz['X0'] = 1e4; Gz['X1'] = -1e4   # im Freien: immer bewittert
    zaun_me.materials.append(mat_holz('HolzZaun', Gz, moos=1.5)); adaptiv(zaun, 3.0)

    print('HAUSFRAME Alpha-Karten eingehängt:', len(ALPHA_GEZAEHLT), sorted(ALPHA_GEZAEHLT)[:6])
    himmel()
    mitte = hw(L_ / 2, 0)
    if 'dunst' not in OHNE:
        # Nur der Hofraum ist ein Volumen (Lichtbahnen zwischen Bäumen und Haus). Ein Volumen über das ganze Tal (5 km)
        # sprengte den Speicher (> 15 GiB); die Luftschichten zur Ferne rechnet `stil` aus Tiefe und Höhe (Pass Position).
        dunst('Hofdunst', (mitte.x, mitte.y), 150.0, pad - 8.0, pad + 26.0, 0.0026, 12.0, (1.0, 0.88, 0.70), 0.5)

    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'
    if os.environ.get('BRACHLAND_CPU') != '1':   # D436: am M1 Metal-GPU (Übergabe D377), in der Cloud `BRACHLAND_CPU=1`
        try:
            prefs = bpy.context.preferences.addons['cycles'].preferences
            prefs.compute_device_type = 'METAL'; prefs.get_devices()
            for d in prefs.devices: d.use = True
            if any(d.type == 'METAL' for d in prefs.devices): sc.cycles.device = 'GPU'
        except Exception as e: print('GPU', e)
    print('GERAET', sc.cycles.device)
    sc.cycles.samples = samples; sc.cycles.use_adaptive_sampling = True; sc.cycles.adaptive_threshold = 0.025
    sc.cycles.use_denoising = True; sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    sc.cycles.max_bounces = 5; sc.cycles.diffuse_bounces = 2; sc.cycles.glossy_bounces = 1
    sc.cycles.transmission_bounces = 4; sc.cycles.volume_bounces = 0; sc.cycles.transparent_max_bounces = 24
    sc.cycles.sample_clamp_indirect = 4.0; sc.cycles.caustics_reflective = sc.cycles.caustics_refractive = False
    sc.cycles.volume_step_rate = 4.0; sc.cycles.volume_max_steps = 96
    sc.cycles.dicing_rate = 1.0; sc.cycles.offscreen_dicing_scale = 24.0; sc.cycles.max_subdivisions = 9
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = breite, hoehe, 100
    sc.view_settings.view_transform = 'AgX'
    try: sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception: pass
    vl = sc.view_layers[0]
    vl.use_pass_z = vl.use_pass_normal = vl.use_pass_mist = vl.use_pass_object_index = vl.use_pass_position = True
    sc['haus_bodenhoehe'] = pad
    print('HAUSFRAME Bodenhöhe %.2f' % pad)
    sc.world.mist_settings.start = 35.0; sc.world.mist_settings.depth = 700.0; sc.world.mist_settings.falloff = 'LINEAR'
    try: sc.render.image_settings.media_type = 'MULTI_LAYER_IMAGE'
    except Exception as e: print('media_type', e)
    sc.render.image_settings.file_format = 'OPEN_EXR_MULTILAYER'; sc.render.image_settings.color_depth = '16'
    if os.environ.get('HAUS_BLEND'): bpy.ops.wm.save_as_mainfile(filepath=os.environ['HAUS_BLEND'])
    print('HAUSFRAME Aufbau %.0f s, %s' % (time.time() - t0, speicher()))
    for name in kameras:
        sc.camera = kam[name]
        sc.cycles.dicing_camera = kam[name]
        sc.render.filepath = os.path.abspath('%s-%s.exr' % (praefix, name))
        t1 = time.time(); bpy.ops.render.render(write_still=True)
        print('HAUSFRAME %s Renderzeit %.0f s, %s → %s' % (name, time.time() - t1, speicher(), sc.render.filepath))


# ───────────────────────────── Darstellung (gemalt) ─────────────────────────────
def stil():
    """Kopie des Stils `aframe` (stilframes.py, D371): Kuwahara-Grösse folgt dem Nebelpass — nah bleibt die Substanz
    unberührt, Ferne und Himmel laufen zu Pinselflächen; Bloom nur an Lichtern, Befall glimmt in der Signalfarbe;
    kein Korn. `HAUS_EV` verschiebt die Belichtung."""
    ein, aus = ARGS[1], ARGS[2]
    breite, hoehe = (int(ARGS[3]), int(ARGS[4])) if len(ARGS) > 4 else (1280, 720)
    ev = float(os.environ.get('HAUS_EV', '-0.15'))   # D373-Bilder: −0,15
    sc = bpy.context.scene
    for o in list(bpy.data.objects):
        if o.type != 'CAMERA': bpy.data.objects.remove(o)
    try: sc.render.compositor_device = 'CPU'
    except Exception as e: print('Gerät', e)
    im_ = bpy.data.images.load(os.path.abspath(ein))
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = breite, hoehe, 100
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 1
    sc.view_settings.view_transform = 'Standard'
    g = bpy.data.node_groups.new('Stil', 'CompositorNodeTree'); sc.compositing_node_group = g
    g.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    ausg = g.nodes.new('NodeGroupOutput')
    im = g.nodes.new('CompositorNodeImage'); im.image = im_
    so = {o.name: o for o in im.outputs}
    farbe, nebel, index = so['Combined'], so['Mist'], so['Object Index']
    V = g.links.new

    def mix(a, b, f, typ='MIX'):
        n = g.nodes.new('ShaderNodeMix'); n.data_type = 'RGBA'; n.blend_type = typ
        if isinstance(f, float): n.inputs[0].default_value = f
        else: V(f, n.inputs[0])
        for sock, v in ((n.inputs[6], a), (n.inputs[7], b)):
            if isinstance(v, tuple): sock.default_value = (*v, 1)
            else: V(v, sock)
        return n.outputs[2]

    def knoten(typ, **eing):
        n = g.nodes.new(typ)
        for k_, v in eing.items(): n.inputs[k_].default_value = v
        return n

    def kurve(src, x0, x1, hoch=1.0):
        n = g.nodes.new('ShaderNodeMapRange'); V(src, n.inputs[0]); n.inputs[1].default_value = x0; n.inputs[2].default_value = x1
        n.inputs[4].default_value = hoch; n.clamp = True
        return n.outputs[0]

    skala = breite / 1280.0
    roh = os.environ.get('HAUS_ROH') == '1'
    # Luftschichten: Dunst als Bodenschicht in der Farbe des Himmels zur Sonne. Menge = 1 − exp(−Weg/Reichweite · Höhenfaktor),
    # Höhenfaktor fällt mit der Höhe des getroffenen Punkts über dem Hof (Pass Position) — das Tal säuft ab, Grate bleiben stehen.
    z0 = float(os.environ.get('HAUS_BODEN', '0.42')); reichweite = float(os.environ.get('HAUS_SICHT', '450'))
    tiefe = so['Depth']; pz = g.nodes.new('ShaderNodeSeparateXYZ'); V(so['Position'], pz.inputs[0])
    def rechne(op, a, b=None):
        n_ = g.nodes.new('ShaderNodeMath'); n_.operation = op
        for i_, w_ in enumerate((a, b)):
            if w_ is None: continue
            if isinstance(w_, float): n_.inputs[i_].default_value = w_
            else: V(w_, n_.inputs[i_])
        return n_.outputs[0]
    hf = rechne('MAXIMUM', rechne('MINIMUM', rechne('EXPONENT', rechne('MULTIPLY', rechne('SUBTRACT', pz.outputs[2], z0), -1.0 / 220.0)), 2.2), 0.12)
    weg_ = rechne('MULTIPLY', rechne('MAXIMUM', rechne('SUBTRACT', tiefe, 45.0), 0.0), -1.0 / reichweite)
    menge = rechne('SUBTRACT', 1.0, rechne('EXPONENT', rechne('MULTIPLY', weg_, hf)))
    menge = rechne('MULTIPLY', menge, rechne('LESS_THAN', tiefe, 1.0e6))      # Himmel bleibt Himmel
    wm_ = knoten('CompositorNodeBlur'); V(menge, wm_.inputs['Image'])              # Tiefe ist je Pixel ein einzelner Treffer: Laub flimmert sonst
    try: wm_.inputs['Size'].default_value = (2.5 * breite / 1280.0, 2.5 * breite / 1280.0)
    except Exception as e: print('Blur', e)
    menge = wm_.outputs[0]
    dunstfarbe = tuple(float(x) for x in os.environ.get('HAUS_DUNST', '0.58,0.47,0.35').split(','))
    luft = mix(farbe, dunstfarbe, rechne('MULTIPLY', menge, float(os.environ.get('HAUS_DUNSTMAX', '0.85'))))
    gr = g.nodes.new('ShaderNodeMapRange'); V(nebel, gr.inputs[0])
    gr.inputs[1].default_value = 0.08; gr.inputs[2].default_value = 0.60; gr.inputs[3].default_value = 0.0; gr.inputs[4].default_value = 9.0 * skala; gr.clamp = True
    kw = knoten('CompositorNodeKuwahara', Uniformity=4, Sharpness=0.6, Eccentricity=0.9); kw.inputs['Type'].default_value = 'Anisotropic'
    V(luft, kw.inputs['Image']); V(gr.outputs[0], kw.inputs['Size'])
    pinsel = luft if roh else mix(luft, kw.outputs[0], kurve(nebel, 0.05, 0.14))
    # Befall: Maske (Pass-Index 7) weich aufgeblasen, in der Signalfarbe addiert
    idm = g.nodes.new('CompositorNodeIDMask'); V(index, idm.inputs[0]); idm.inputs['Index'].default_value = 7
    bl = knoten('CompositorNodeBlur'); V(idm.outputs[0], bl.inputs['Image'])
    try: bl.inputs['Size'].default_value = (6 * skala, 6 * skala)   # D440: enger Schein, kein Fleck
    except Exception as e: print('Blur', e)
    schein = mix((0, 0, 0), tuple(x * 1.0 for x in SIGNAL), bl.outputs[0])
    pinsel = mix(pinsel, schein, 1.0, 'ADD')
    bel = g.nodes.new('CompositorNodeExposure'); bel.inputs['Exposure'].default_value = ev; V(pinsel, bel.inputs['Image'])
    gl = knoten('CompositorNodeGlare', Threshold=2.5, Strength=0.25, Size=0.8); gl.inputs['Type'].default_value = 'Bloom'
    V(bel.outputs[0], gl.inputs['Image'])
    n = g.nodes.new('CompositorNodeConvertToDisplay'); V(gl.outputs[0], n.inputs[0])
    try:
        n.display_settings.display_device = 'sRGB'; n.view_settings.view_transform = 'AgX'
        n.view_settings.look = 'AgX - Medium High Contrast'; n.view_settings.exposure = 1.0
    except Exception as e: print('Anzeige', e)
    cb = g.nodes.new('CompositorNodeColorBalance'); V(n.outputs[0], cb.inputs['Image'])
    try: cb.inputs[4].default_value = (1.0, 0.998, 1.003, 1); cb.inputs[8].default_value = (1.08, 1.0, 0.88, 1)   # Lichter warm, Schatten neutral-warm (Regel 3)
    except Exception as e: print('Balance', e)
    hs = knoten('CompositorNodeHueSat', Saturation=1.06); V(cb.outputs[0], hs.inputs['Image'])
    # Vignette
    vg = g.nodes.new('CompositorNodeEllipseMask')
    try: vg.inputs['Size'].default_value = (1.25, 1.35)
    except Exception: pass
    inv = g.nodes.new('CompositorNodeInvert'); V(vg.outputs[0], inv.inputs['Color'])
    wv = knoten('CompositorNodeBlur'); V(inv.outputs[0], wv.inputs['Image'])
    try: wv.inputs['Size'].default_value = (220 * skala, 220 * skala)
    except Exception as e: print('Blur', e)
    bw = g.nodes.new('CompositorNodeRGBToBW'); V(wv.outputs[0], bw.inputs[0])
    vign = g.nodes.new('ShaderNodeMix'); vign.data_type = 'RGBA'; vign.blend_type = 'MULTIPLY'
    V(bw.outputs[0], vign.inputs[0]); V(hs.outputs[0], vign.inputs[6]); vign.inputs[7].default_value = (0.74, 0.71, 0.68, 1)
    V(vign.outputs[2], ausg.inputs[0])
    sc.render.image_settings.file_format = 'PNG'; sc.render.filepath = os.path.abspath(aus)
    bpy.ops.render.render(write_still=True)
    print('HAUSFRAME Stil', aus)


if __name__ == '__main__':
    {'bau': bau, 'stil': stil}[MODUS]()
