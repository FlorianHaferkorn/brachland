"""
BRACHLAND — Baumbau (ADR-0006, Stufe 3, D155, D364, D367): die Blender-Baeume als Prop-Dateien.

    blender --background --python tools/baumbau.py -- public/props [varianten] [public/material]

Je Art und Variante entsteht **ein Netz je Stufe**: Stamm, Wurzelanlauf, Aeste und Blattmassen
zusammengefuegt, Laubfarbe als Vertexfarbe gebacken, in `COLOR_0.a` die Laubmaske (1 = Blatt,
0 = Holz) fuer die Loecher im Shader, in `_WIND` die Windgewichtung (Stamm 0, Krone 1).

D364 (Flo 21.11.2026: „Baumwurzeln sehen super scheisse aus, Baeume wachsen viel ungerader, Rinde
sieht anders aus"): Der Stamm ist kein Kurvenrohr mit Kegeln am Fuss mehr, sondern **ein** Netz aus
waagrechten Ringen um eine Achse, die sich neigt (Licht, Hang), kruemmt und dreht; der Querschnitt ist
unregelmaessig, unten waechst er organisch in Brettwurzeln/Wuelste (Flare) aus, und aus jedem Wulst
laeuft eine flache Wurzel aus, die in den Boden taucht. Buche krummer, mit Zwiesel; Fichte gerader,
flacher Wurzelteller. Alles aus dem Seed der Variante. Das Holz traegt **keine** gebackene Farbe mehr:
`COLOR_0.rgb` ist dort ein Abdunkelungsfaktor (Stammfuss), die Farbe kommt zur Laufzeit aus dem
Rinden-Scan der Art (`rinde-buche-*`, `rinde-fichte-*`, `src/world/windmaterial.ts`).

D367: Statt einer dezimierten Fernstufe entsteht je Baum ein **Impostor** — acht orthografische
Ansichten (alle 45°) in einem Atlas, Farbe + Deckung (`baum-<art>-<v>-fern-farbe.webp`) und
Modell-Normale (`-normal.webp`). Die Groesse des Bildrahmens steht im Register (`impostor`).

Nah unter 45 m, mittel bis 110 m (Dezimierung derselben Quelle), danach Impostor.
Dreiecke werden gemessen und stehen im Register (ADR-0006).
"""
import bpy, bmesh, math, random, sys, os, json, importlib.util
from mathutils import Vector, Matrix, noise

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ZIEL = ARGS[0] if ARGS else 'public/props'
VARIANTEN = int(ARGS[1]) if len(ARGS) > 1 else 4
MATERIAL_ZIEL = ARGS[2] if len(ARGS) > 2 else 'public/material'
SCANS = os.environ.get('RINDE_SCANS', '.cache/cc0/rinde')   # Poly-Haven-Quellen, nur fuer den Impostor-Render

# Den Szenenbau als Modul laden, ohne dass er baut: seine Kronenbauer und Materialien sind die Vorlage.
spec = importlib.util.spec_from_file_location('szenenbau', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'szenenbau.py'))
sb = importlib.util.module_from_spec(spec)
sys.argv = [sys.argv[0]]
spec.loader.exec_module(sb)
sb.bodenhoehe = lambda x, y: 0.0          # Props stehen im Ursprung, der Boden ist z=0
sb.SCHNELL = False
sb.STAMM_RES = 3; sb.STAMM_BEVEL_MAX = 2   # Aeste: grob, die Krone traegt das Bild

# Wuchs je Art (D364). Laengen in Metern, Winkel in Grad. r0 = Stammradius am Fuss ohne Anlauf.
WUCHS = {
    'buche': dict(segmente=18, neigung=(1.5, 4.5), saebel=(0.08, 0.28), wackel=0.16, wackel_frequenz=(0.15, 0.35), knick=0.12,
                  drehung=0.035, unruhe=0.07, flare=0.55, flare_hoehe=0.6, wulst=(1.1, 1.8), wulst_breite=0.45, wulst_hoehe=0.6,
                  wurzeln=(4, 6), wurzel_laenge=(1.0, 1.8), wurzel_start=0.45, wurzel_breite=0.75, wurzel_flach=0.45, wurzel_tauchen=0.22, wellig=0.03, verjuengung=2.2, zwiesel=0.4),
    'fichte': dict(segmente=14, neigung=(0.5, 2.0), saebel=(0.04, 0.18), wackel=0.05, wackel_frequenz=(0.15, 0.30), knick=0.04,
                   drehung=0.02, unruhe=0.045, flare=0.35, flare_hoehe=0.35, wulst=(0.55, 0.95), wulst_breite=0.36, wulst_hoehe=0.30,
                   wurzeln=(5, 7), wurzel_laenge=(1.1, 2.2), wurzel_start=0.14, wurzel_breite=0.95, wurzel_flach=0.30, wurzel_tauchen=0.12, wellig=0.07, verjuengung=1.2, zwiesel=0.0),
}
# Rindenscans (Poly Haven, CC0): Kachelbreite in Metern laut Scan-Metadaten (`dimensions`), Hoehe nach Bildseiten.
RINDE_SCAN = {'buche': ('chinese_hackberry_bark', 1.8, 3.6), 'fichte': ('pine_bark', 2.0, 2.0)}


def leer():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def sammeln(praefix):
    """Alle Objekte mit Praefix: Kurven zu Netzen, dann zu einem Objekt."""
    objs = [o for o in bpy.context.scene.objects if o.name.startswith(praefix)]
    for o in objs:
        if o.type == 'CURVE':
            bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
            bpy.ops.object.convert(target='MESH')
    objs = [o for o in bpy.context.scene.objects if o.name.startswith(praefix)]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    return bpy.context.view_layer.objects.active


# ------------------------------------------------------------------ Stamm (D364)
def winkel_abstand(a, b):
    d = (a - b) % (2 * math.pi)
    return d - 2 * math.pi if d > math.pi else d


class Achse:
    """Mittellinie eines Stamms: Neigung (Licht), Saebelwuchs am Fuss (Hang), Wackeln und Knicke, aus dem Seed."""

    def __init__(self, rnd, w, hoehe, fuss=Vector((0, 0, 0)), basis_hoehe=0.0, richtung=None):
        self.hoehe = hoehe; self.fuss = fuss; self.basis_hoehe = basis_hoehe
        a = rnd.random() * 2 * math.pi
        self.licht = Vector((math.cos(a), math.sin(a), 0))
        self.neigung = math.tan(math.radians(rnd.uniform(*w['neigung'])))
        b = a + rnd.uniform(-1.6, 1.6)
        self.hang = Vector((math.cos(b), math.sin(b), 0)) * rnd.uniform(*w['saebel'])
        self.f1, self.f2 = rnd.uniform(*w['wackel_frequenz']), rnd.uniform(*w['wackel_frequenz'])
        self.p1, self.p2 = rnd.random() * 6.3, rnd.random() * 6.3
        self.wackel = w['wackel']; self.knick = w['knick']; self.saat = rnd.random() * 100
        self.richtung = richtung      # Zwiesel: zusaetzliche Schraeglage je Meter

    def punkt(self, h):
        """Achse auf Hoehe h (Meter ueber dem Fuss dieser Achse)."""
        hp = max(0.0, h)
        t = hp / max(1.0, self.hoehe)
        p = Vector((self.fuss.x, self.fuss.y, self.fuss.z + h))
        # Phototropismus: die Neigung waechst nach oben (Krone sucht das Licht)
        p += self.licht * self.neigung * hp * (0.35 + 0.65 * t)
        # Saebelwuchs: der Fuss rutscht hangab, der Stamm richtet sich wieder auf
        p += self.hang * (1.0 - math.exp(-hp / 1.6))
        ein = min(1.0, hp / 3.0)
        p += Vector((math.sin(hp * self.f1 + self.p1), math.cos(hp * self.f2 + self.p2), 0)) * self.wackel * ein * (0.4 + t)
        p += Vector((noise.noise(Vector((hp * 0.35, self.saat, 0.5))), noise.noise(Vector((hp * 0.35, self.saat, 7.5))), 0)) * self.knick * ein
        if self.richtung is not None:
            p += self.richtung * hp
        return p


def stammnetz(bm, achse, hoehen, radius, querschnitt, segmente, deckel=True):
    """Ringe um die Achse; `radius(h)`, `querschnitt(h, theta)` (Faktor + Meter). Gibt nichts zurueck, fuellt bm."""
    ringe = []
    for h in hoehen:
        m = achse.punkt(h); r = radius(h); ring = []
        for k in range(segmente):
            th = 2 * math.pi * k / segmente
            f, plus = querschnitt(h, th)
            rr = r * f + plus
            ring.append(bm.verts.new((m.x + math.cos(th) * rr, m.y + math.sin(th) * rr, m.z)))
        ringe.append(ring)
    for a, b in zip(ringe, ringe[1:]):
        for k in range(segmente):
            k2 = (k + 1) % segmente
            bm.faces.new((a[k], a[k2], b[k2], b[k]))
    if deckel:
        spitze = bm.verts.new(achse.punkt(hoehen[-1] + radius(hoehen[-1]) * 2))
        for k in range(segmente):
            bm.faces.new((ringe[-1][k], ringe[-1][(k + 1) % segmente], spitze))


def stammhoehen(oben, schritt):
    """Dicht am Fuss (Anlauf), darueber gleichmaessig."""
    hs = [-0.45, -0.1, 0.08, 0.22, 0.4, 0.65, 1.0, 1.5, 2.2, 3.1]
    h = hs[-1]
    while h + schritt < oben:
        h += schritt; hs.append(h)
    hs.append(oben)
    return hs


def wurzel(bm, start, richtung, laenge, breite, kamm, flach, tauchen, rnd, segmente=8, ringe=10, wellig=0.0, verjuengung=2.2):
    """Wurzel als Fortsetzung des Wulstes: am Stamm ein hoher Kamm (`kamm` m ueber dem Boden), der schnell
    abfaellt; danach flach, elliptisch, sinkt und taucht ins Erdreich. Der Anfang liegt im Wulst, ohne Ansatzkante."""
    vorher = None
    rich = richtung
    for i in range(ringe):
        s = (i / (ringe - 1)) ** 1.35
        rich = rich + rnd.uniform(-0.2, 0.2) * (1 if i else 0)
        d = Vector((math.cos(rich), math.sin(rich), 0))
        p = start + d * (s * laenge)
        z = -tauchen * s ** 2.0 + wellig * math.sin(s * 9.0 + rich * 3) * s
        a = breite * (0.2 + 0.8 * (1 - s) ** verjuengung) + 0.012
        b = kamm * (1 - s) ** 3 + a * flach
        quer = Vector((-d.y, d.x, 0))
        ring = []
        for k in range(segmente):
            ph = 2 * math.pi * k / segmente
            # oben gewoelbt, unten flach im Boden (die Wurzel liegt auf, sie haengt nicht)
            sz = math.sin(ph); sz = sz if sz > 0 else sz * 0.25
            cz = math.cos(ph) * (1.0 - 0.35 * max(0.0, math.sin(ph)) * (1 - s))   # Kamm oben schmaler
            q = Vector((p.x, p.y, 0)) + quer * (cz * a) + Vector((0, 0, z + b * sz))
            ring.append(bm.verts.new(q))
        if vorher:
            for k in range(segmente):
                k2 = (k + 1) % segmente
                bm.faces.new((vorher[k], vorher[k2], ring[k2], ring[k]))
        vorher = ring


def baue_stamm(name, art, hoehe, rnd, mat):
    """Hauptstamm mit Anlauf und Wurzeln, bei der Buche ggf. Zwiesel. Gibt die Achsen zurueck (Aeste haengen daran)."""
    w = WUCHS[art]
    bm = bmesh.new()
    achse = Achse(rnd, w, hoehe)
    r0 = (0.08 + hoehe * 0.0065) if art == 'buche' else (0.05 + hoehe * 0.0075)
    spitze = hoehe * (0.80 if art == 'buche' else 0.97)
    radius = lambda h: r0 * (1.0 - 0.82 * max(0.0, h) / hoehe) + 0.03
    # Wuelste: je Wurzel ein Lappen im Querschnitt, nach oben abklingend; Drehwuchs dreht sie mit
    n_wurzeln = rnd.randint(*w['wurzeln'])
    lappen = []
    for i in range(n_wurzeln):
        th = 2 * math.pi * (i + rnd.uniform(-0.3, 0.3)) / n_wurzeln
        lappen.append((th, rnd.uniform(*w['wulst']), w['wulst_breite'] * rnd.uniform(0.8, 1.25)))
    saat = rnd.random() * 50
    def querschnitt(h, th):
        hp = max(0.0, h)
        thd = th - w['drehung'] * hp
        unruhe = 1.0 + w['unruhe'] * noise.noise(Vector((math.cos(thd) * 1.3, math.sin(thd) * 1.3, hp * 0.25 + saat)))
        flare = 1.0 + w['flare'] * math.exp(-hp / w['flare_hoehe'])
        plus = 0.0
        for lt, staerke, breite in lappen:
            g = math.exp(-(winkel_abstand(thd, lt) / breite) ** 2)
            plus += r0 * staerke * g * math.exp(-hp / w['wulst_hoehe'])
        return unruhe * flare, plus
    stammnetz(bm, achse, stammhoehen(spitze, 1.7 if art == 'buche' else 2.6), radius, querschnitt, w['segmente'])
    # Wurzeln: aus jedem Wulst, Start im Wulst (kein sichtbarer Ansatz), flach auslaufend
    m0 = achse.punkt(0.0)
    for lt, staerke, breite in lappen:
        rr = radius(0.0) * 0.85
        start = Vector((m0.x + math.cos(lt) * rr, m0.y + math.sin(lt) * rr, 0.0))
        laenge = rnd.uniform(*w['wurzel_laenge']) * (0.7 + 0.3 * staerke)
        kamm = w['wurzel_start'] * staerke * rnd.uniform(0.8, 1.2)
        wurzel(bm, start, lt, laenge, r0 * w['wurzel_breite'] * (0.75 + 0.25 * staerke), kamm, w['wurzel_flach'], w['wurzel_tauchen'], rnd,
               wellig=w['wellig'], verjuengung=w['verjuengung'])
    achsen = [(achse, 0.0, spitze, radius)]
    # Zwiesel (Buche): ein zweiter Leittrieb zweigt im mittleren Stamm ab und laeuft schraeg weg
    if rnd.random() < w['zwiesel']:
        hz = hoehe * rnd.uniform(0.38, 0.55)
        weg = -achse.licht + Vector((rnd.uniform(-0.6, 0.6), rnd.uniform(-0.6, 0.6), 0))
        weg.normalize()
        z2 = Achse(rnd, w, hoehe - hz, fuss=achse.punkt(hz - 0.6), richtung=weg * math.tan(math.radians(rnd.uniform(14, 24))))
        z2.hang = Vector((0, 0, 0))
        rz = radius(hz) * 0.78
        r2 = lambda h, rz=rz, L=hoehe - hz: rz * (1.0 - 0.85 * max(0.0, h) / L) + 0.03
        s2 = (hoehe - hz) * 0.85
        hs2 = [0.0] + [s2 * i / 7 for i in range(1, 8)]
        stammnetz(bm, z2, hs2, r2, lambda h, th: (1.0 + 0.05 * math.sin(th * 3 + h), 0.0), 10)
        achsen.append((z2, hz - 0.6, s2, r2))
    sb.fertig(name, bm, (0, 0, 0), mat, True)
    return achsen


def auf_achse(achsen, h_welt):
    """Punkt und Radius auf einer der Achsen (zufaellig gewaehlt vom Aufrufer)."""
    achse, basis, oben, radius = achsen
    h = min(oben, max(0.0, h_welt - basis))
    return achse.punkt(h), radius(h)


def buche(name, hoehe, m_rinde, m_laub, saat):
    """Buche nach `szenenbau.laubbaum2` (Krone unveraendert), aber Stamm/Anlauf/Zwiesel aus D364."""
    rnd = random.Random(saat)
    achsen = baue_stamm(name + '_Stamm', 'buche', hoehe, rnd, m_rinde)
    krone = bmesh.new(); enden = []
    for k in range(11):   # wie bisher (`aeste=11`, D155)
        a_ = achsen[k % len(achsen)] if len(achsen) > 1 and rnd.random() < 0.55 else achsen[0]
        achse, basis, oben, radius = a_
        t = 0.48 + rnd.random() * 0.48
        hw = max(basis + 0.5, t * hoehe)
        p, r = auf_achse(a_, hw)
        a = rnd.random() * 6.283; l = (1.5 + rnd.random() * 3.5) * (1.3 - t) + 0.8
        mitte = p + Vector((math.cos(a) * l * 0.5, math.sin(a) * l * 0.5, l * 0.15))
        ende = p + Vector((math.cos(a) * l, math.sin(a) * l, l * (0.25 + rnd.random() * 0.45)))
        sb.stamm(name + '_Ast%d' % k, [p, mitte, ende], [r * 0.55, r * 0.3, 0.02], m_rinde, 3)
        enden.append((ende, l))
    for a_ in achsen:
        enden.append((a_[0].punkt(a_[2]), 2.0))
    for k, (e, l) in enumerate(enden):
        for j in range(3):   # `je=3` wie bisher
            s = (0.45 + rnd.random() * 0.65) * (0.7 + hoehe / 50)
            sb.klumpen_bm(krone, (e.x + (rnd.random() - 0.5) * (1.2 + l * 0.5), e.y + (rnd.random() - 0.5) * (1.2 + l * 0.5), e.z - 0.4 + rnd.random() * 1.4),
                          (s * 1.4, s, s * 0.5), saat * 31 + k * 9 + j, 0.7, 2)
    sb.fertig(name + '_Krone', krone, (0, 0, 0), m_laub, True)


def fichte(name, hoehe, m_rinde, m_nadel, saat):
    """Fichte nach `szenenbau.fichte` (Astquirle unveraendert), Stamm und Wurzelteller aus D364, Quirle folgen der Achse."""
    rnd = random.Random(saat)
    achsen = baue_stamm(name + '_Stamm', 'fichte', hoehe, rnd, m_rinde)
    achse = achsen[0][0]
    nadeln = bmesh.new(); k = 0
    quirle = 10           # wie bisher (`quirle=10, je=4`, grob), D155
    for i in range(quirle):
        t = 0.22 + 0.76 * i / (quirle - 1)
        m = achse.punkt(hoehe * t)
        L = ((1.0 - t) * (1.1 + hoehe * 0.055) + 0.35) * (0.85 + rnd.random() * 0.3)
        for j in range(4):
            a = rnd.random() * 6.283
            haeng = -0.08 - rnd.random() * 0.28
            Lj = L * (0.7 + rnd.random() * 0.6)
            for s in (0.7,):
                d = Lj * s
                pos = Vector((m.x + math.cos(a) * d, m.y + math.sin(a) * d, m.z + haeng * d))
                rot = (Matrix.Rotation(a, 4, 'Z') @ Matrix.Rotation(-haeng, 4, 'Y'))
                sb.klumpen_bm(nadeln, pos, (Lj * (0.30 if s < 0.9 else 0.24), 0.30 + Lj * 0.10, 0.10 + Lj * 0.05), saat * 53 + k, 0.55, 1, rot); k += 1
        if i == quirle - 1:
            sb.klumpen_bm(nadeln, achse.punkt(hoehe * 0.985), (0.3, 0.3, 0.6), saat * 53 + k + 1, 0.4, 1, Matrix.Identity(4))
    sb.fertig(name + '_Nadeln', nadeln, (0, 0, 0), m_nadel, True)


# ------------------------------------------------------------------ Backen
def backe_und_maskiere(o, laub_material_namen, laub_faktor=1.0):
    """Laubfarbe in Vertexfarben backen (Cycles, 16 spp), dann Alpha = Laubmaske, WIND = Hoehe der Krone.
    Holz (D364): RGB ist ein Faktor auf den Rinden-Scan — 1 am Stamm, dunkler im Erdkontakt."""
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 16
    me = o.data
    if not me.color_attributes: me.color_attributes.new(name='Color', type='BYTE_COLOR', domain='CORNER')
    me.color_attributes.active_color = me.color_attributes['Color']
    sc.render.bake.target = 'VERTEX_COLORS'
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, use_clear=True)
    laubslots = {i for i, m in enumerate(me.materials) if m is not None and m.name.split('.')[0] in laub_material_namen}
    farbe = me.color_attributes['Color']
    zmax = max(v.co.z for v in me.vertices); zmin = min(v.co.z for v in me.vertices)
    wind = me.attributes.get('WIND') or me.attributes.new(name='WIND', type='FLOAT', domain='POINT')
    for v in me.vertices:
        t = (v.co.z - zmin) / max(1e-3, zmax - zmin)
        wind.data[v.index].value = max(0.0, t - 0.35) / 0.65 * 0.85 + (0.15 if t > 0.35 else 0.0)
    for p in me.polygons:
        laub = p.material_index in laubslots
        for li in p.loop_indices:
            if laub:
                c = farbe.data[li].color; farbe.data[li].color = (c[0] * laub_faktor, c[1] * laub_faktor, c[2] * laub_faktor, 1.0)
            else:
                z = me.vertices[me.loops[li].vertex_index].co.z
                f = 0.55 + 0.45 * min(1.0, max(0.0, (z + 0.05) / 0.35))   # Erdkontakt: Feuchte und Schmutz
                farbe.data[li].color = (f, f, f, 0.0)
    m = bpy.data.materials.new('Baum'); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial'); b = nt.nodes.new('ShaderNodeBsdfPrincipled'); nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])
    vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Color'; nt.links.new(vc.outputs['Color'], b.inputs['Base Color']); nt.links.new(vc.outputs['Alpha'], b.inputs['Alpha'])
    me.materials.clear(); me.materials.append(m)


def stufe_aus_quelle(quelle, anteil):
    """Denselben Baum vereinfachen, statt seine Krone fuer jede Entfernung neu zu wuerfeln."""
    o = quelle.copy(); o.data = quelle.data.copy(); bpy.context.collection.objects.link(o)
    if anteil < 1.0:
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
        mod = o.modifiers.new('LOD', 'DECIMATE'); mod.ratio = anteil
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return o


def exportiere(o, pfad):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.export_scene.gltf(filepath=pfad, export_format='GLB', use_selection=True, export_apply=True, export_attributes=True,
                              export_texcoords=False, export_normals=True, export_materials='EXPORT', export_animations=False, export_yup=True)


# ------------------------------------------------------------------ Impostor (D367)
IMP_ANSICHTEN = 8
IMP_ZELLE = (256, 512)   # Pixel je Ansicht (Breite, Hoehe)


def impostor_material(o, art):
    """Renderzweig fuer den Impostor: Holz = Rinden-Scan (Box-Projektion, Weltmass) × Vertexfaktor, Laub = Vertexfarbe
    mit denselben Loechern wie zur Laufzeit (Rauschen, Schwelle 0,42), aber groeber, damit sie auf 8 cm/px lesbar bleiben.
    `modus` am Wertknoten: 0 = Farbe, 1 = Normale (Objektraum, 0,5 + 0,5·n)."""
    m = bpy.data.materials.new('Impostor'); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    N = lambda t, **kw: nt.nodes.new(t)
    L = lambda a, b: nt.links.new(a, b)
    out = N('ShaderNodeOutputMaterial')
    vc = N('ShaderNodeVertexColor'); vc.layer_name = 'Color'
    tc = N('ShaderNodeTexCoord')
    datei, breite, hoehe = RINDE_SCAN[art]
    mp = N('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1 / breite, 1 / breite, 1 / hoehe)
    L(tc.outputs['Object'], mp.inputs['Vector'])
    bild = N('ShaderNodeTexImage'); bild.projection = 'BOX'; bild.projection_blend = 0.3
    pfad = os.path.abspath(os.path.join(SCANS, f'{datei}_diff_2k.jpg'))
    bild.image = bpy.data.images.load(pfad, check_existing=True)
    L(mp.outputs['Vector'], bild.inputs['Vector'])
    holz = N('ShaderNodeMix'); holz.data_type = 'RGBA'; holz.blend_type = 'MULTIPLY'; holz.inputs['Factor'].default_value = 1.0
    L(bild.outputs['Color'], holz.inputs[6]); L(vc.outputs['Color'], holz.inputs[7])
    farbe = N('ShaderNodeMix'); farbe.data_type = 'RGBA'
    L(vc.outputs['Alpha'], farbe.inputs['Factor']); L(holz.outputs[2], farbe.inputs[6]); L(vc.outputs['Color'], farbe.inputs[7])
    geo = N('ShaderNodeNewGeometry')
    nrm = N('ShaderNodeVectorMath'); nrm.operation = 'MULTIPLY_ADD'
    nrm.inputs[1].default_value = (0.5, 0.5, 0.5); nrm.inputs[2].default_value = (0.5, 0.5, 0.5)
    L(geo.outputs['Normal'], nrm.inputs[0])
    modus = N('ShaderNodeValue'); modus.name = 'modus'; modus.outputs[0].default_value = 0.0
    wahl = N('ShaderNodeMix'); wahl.data_type = 'RGBA'
    L(modus.outputs[0], wahl.inputs['Factor']); L(farbe.outputs[2], wahl.inputs[6]); L(nrm.outputs['Vector'], wahl.inputs[7])
    em = N('ShaderNodeEmission'); L(wahl.outputs[2], em.inputs['Color'])
    # Loecher nur im Laub
    rausch = N('ShaderNodeTexNoise'); rausch.inputs['Scale'].default_value = 3.0; rausch.inputs['Detail'].default_value = 4
    L(tc.outputs['Object'], rausch.inputs['Vector'])
    loch = N('ShaderNodeMath'); loch.operation = 'LESS_THAN'; loch.inputs[1].default_value = 0.40
    L(rausch.outputs['Fac'], loch.inputs[0])
    loch_laub = N('ShaderNodeMath'); loch_laub.operation = 'MULTIPLY'
    L(loch.outputs[0], loch_laub.inputs[0]); L(vc.outputs['Alpha'], loch_laub.inputs[1])
    tr = N('ShaderNodeBsdfTransparent')
    mix = N('ShaderNodeMixShader'); L(loch_laub.outputs[0], mix.inputs['Fac']); L(em.outputs[0], mix.inputs[1]); L(tr.outputs[0], mix.inputs[2])
    L(mix.outputs[0], out.inputs['Surface'])
    o.data.materials.clear(); o.data.materials.append(m)
    return modus


def backe_impostor(quelle, art, name):
    """Acht orthografische Ansichten (Kamera auf Azimut i·45° um die Hochachse, Blick zur Achse), Farbe und Normale."""
    import numpy as np
    o = quelle.copy(); o.data = quelle.data.copy(); bpy.context.collection.objects.link(o)
    quelle.hide_render = True
    modus = impostor_material(o, art)
    vs = [o.matrix_world @ v.co for v in o.data.vertices]
    zmin = min(v.z for v in vs); zmax = max(v.z for v in vs)
    rmax = max(math.hypot(v.x, v.y) for v in vs)
    breite = 2 * rmax * 1.02; hoehe = (zmax - zmin) * 1.02
    # Rahmen im Verhaeltnis der Zelle (1:2): das Groessere bestimmt
    zw, zh = IMP_ZELLE
    if hoehe / breite < zh / zw: hoehe = breite * zh / zw
    else: breite = hoehe * zw / zh
    unten = zmin - 0.01 * (zmax - zmin)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 24; sc.cycles.use_denoising = False
    sc.render.film_transparent = True
    sc.render.resolution_x, sc.render.resolution_y = zw, zh; sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
    sc.render.image_settings.color_depth = '8'
    sc.cycles.max_bounces = 0
    cam_d = bpy.data.cameras.new('ImpKam'); cam_d.type = 'ORTHO'; cam_d.ortho_scale = hoehe; cam_d.clip_end = 400
    sc.render.pixel_aspect_x = 1; sc.render.pixel_aspect_y = 1
    cam = bpy.data.objects.new('ImpKam', cam_d); bpy.context.collection.objects.link(cam); sc.camera = cam
    atlas = {k: np.zeros((zh, zw * IMP_ANSICHTEN, 4), dtype=np.float32) for k in ('farbe', 'normal')}
    tmp = os.path.join(bpy.app.tempdir, 'imp.png')
    for i in range(IMP_ANSICHTEN):
        a = 2 * math.pi * i / IMP_ANSICHTEN
        richtung = Vector((math.cos(a), math.sin(a), 0))
        mitte_z = unten + hoehe / 2
        cam.location = richtung * 150 + Vector((0, 0, mitte_z))
        cam.rotation_euler = (-richtung).to_track_quat('-Z', 'Y').to_euler()
        for art_bild, wert, ansicht in (('farbe', 0.0, 'Standard'), ('normal', 1.0, 'Raw')):
            modus.outputs[0].default_value = wert
            sc.view_settings.view_transform = ansicht; sc.view_settings.look = 'None'
            sc.render.filepath = tmp
            bpy.ops.render.render(write_still=True)
            img = bpy.data.images.load(tmp); px = np.array(img.pixels[:], dtype=np.float32).reshape(zh, zw, 4)
            bpy.data.images.remove(img)
            atlas[art_bild][:, i * zw:(i + 1) * zw, :] = px
    bpy.data.objects.remove(cam, do_unlink=True); bpy.data.objects.remove(o, do_unlink=True)
    quelle.hide_render = False
    # Farbe unter transparenten Pixeln ausbluten lassen (Mip-Saum), Alpha behalten
    for k in ('farbe', 'normal'):
        px = atlas[k]; al = px[..., 3:4]
        rgb = np.where(al > 0.01, px[..., :3], 0)   # PNG: Alpha ist nicht vormultipliziert
        for _ in range(6):
            fuell = al[..., 0] <= 0.01
            if not fuell.any(): break
            summe = np.zeros_like(rgb); zahl = np.zeros(al.shape[:2] + (1,), dtype=np.float32)
            besetzt = (~fuell)[..., None].astype(np.float32)
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                summe += np.roll(np.roll(rgb * besetzt, dy, 0), dx, 1); zahl += np.roll(np.roll(besetzt, dy, 0), dx, 1)
            neu = summe / np.maximum(zahl, 1)
            rgb = np.where(fuell[..., None] & (zahl > 0), neu, rgb)
            al = np.where(fuell[..., None] & (zahl > 0), np.float32(0.004), al)
        alpha = px[..., 3:4] if k == 'farbe' else np.ones_like(px[..., 3:4])
        bild = np.concatenate([rgb, alpha], -1)
        img = bpy.data.images.new(f'{name}-{k}', zw * IMP_ANSICHTEN, zh, alpha=True, float_buffer=False)
        img.colorspace_settings.name = 'Non-Color'
        img.pixels[:] = bild.ravel()
        pfad = os.path.abspath(os.path.join(MATERIAL_ZIEL, f'{name}-{k}.png'))
        img.filepath_raw = pfad; img.file_format = 'PNG'; img.save()
        bpy.data.images.remove(img)
    return {'breite': round(breite, 3), 'hoehe': round(hoehe, 3), 'unten': round(unten, 3), 'ansichten': IMP_ANSICHTEN,
            'zelle': list(IMP_ZELLE)}


# ------------------------------------------------------------------ Lauf
os.makedirs(ZIEL, exist_ok=True); os.makedirs(MATERIAL_ZIEL, exist_ok=True)
register = {'baeume': []}
for art in ('buche', 'fichte'):
    for v in range(VARIANTEN):
        leer()
        m_rinde = sb.mat_rinde()
        m_laub = sb.mat_laub(durchlass=0.0, loecher=0.0)
        m_nadel = sb.mat_laub('Nadel', sb.NADEL, (0.22, 0.30, 0.10), 0.0, 0.0)
        rnd = random.Random(1000 + v * 17 + (0 if art == 'buche' else 500))
        hoehe = (20 + rnd.random() * 12) if art == 'buche' else (18 + rnd.random() * 10)
        if art == 'buche':
            buche('Baum', hoehe, m_rinde, m_laub, 700 + v)
        else:
            fichte('Baum', hoehe, m_rinde, m_nadel, 800 + v)
        quelle = sammeln('Baum')
        backe_und_maskiere(quelle, {'Laub', 'Nadel'}, 0.85)
        # Brusthoehendurchmesser (1,3 m) am gebauten Netz, fuer das Massstab-Tor
        ring = [v_.co for v_ in quelle.data.vertices if abs(v_.co.z - 1.3) < 0.31 and math.hypot(v_.co.x, v_.co.y) < 1.5]
        bhd = 2 * (sum(math.hypot(p.x, p.y) for p in ring) / max(1, len(ring))) if ring else 0.0
        stufen = (('nah', 1.0), ('mittel', 0.8)) if art == 'fichte' else (('nah', 1.0), ('mittel', 0.55))
        for stufe, anteil in stufen:
            o = stufe_aus_quelle(quelle, anteil)
            name = f'baum-{art}-{v}-{stufe}'
            exportiere(o, os.path.abspath(os.path.join(ZIEL, name + '.glb')))
            tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
            register['baeume'].append({'art': art, 'variante': v, 'stufe': stufe, 'datei': name, 'hoehe': round(hoehe, 2), 'dreiecke': tris,
                                       'bhd': round(bhd, 3)})
            print('gebaut', name, round(hoehe, 1), 'm', tris, 'Dreiecke', 'BHD', round(bhd, 2), flush=True)
            bpy.data.objects.remove(o, do_unlink=True)
        name = f'baum-{art}-{v}-fern'
        imp = backe_impostor(quelle, art, name)
        register['baeume'].append({'art': art, 'variante': v, 'stufe': 'fern', 'datei': name, 'hoehe': round(hoehe, 2), 'dreiecke': 2,
                                   'bhd': round(bhd, 3), 'impostor': imp})
        print('impostor', name, imp, flush=True)
json.dump(register, open(os.path.join(ZIEL, 'baeume.json'), 'w'), indent=1)
print('fertig', len(register['baeume']), 'Eintraege', flush=True)
