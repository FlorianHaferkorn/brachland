# BRACHLAND — Streukarten backen (D361): vier Bodenstreu-Felder 1 × 1 m, Teile in echter Grösse (content/massstab.json),
# von oben orthografisch gerendert als Grundfarbe, Normale (Tangentenraum des Bodens) und Höhe über Grund.
#
#   blender --background --factory-startup --python tools/streukarten.py -- .cache/streukarten
#   python3 tools/efeukarten_pack.py .cache/streukarten 1024 streu
#
# Felder: 0 Laubstreu (Buche, Bucheckern, Zweige) · 1 Nadelstreu (Fichte, Zapfen) · 2 Kies und Moos · 3 Zweige und
# trockenes Laub. Boden = Ebene z = 0, Blick von +z; Tangentenraum = Welt (x rechts, y oben im Bild, z nach oben).
import bpy, bmesh, json, math, os, random, sys
from mathutils import Euler, Vector

ziel = sys.argv[sys.argv.index('--') + 1]
os.makedirs(ziel, exist_ok=True)
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = {r['id']: r for r in json.load(open(os.path.join(REPO, 'content/massstab.json')))['referenzen']}
AUFLOESUNG = 1024
RADIUS = 0.44   # Rand der Kachel frei, sonst schneidet der Bildrand Teile ab


def groesse(ref, t=None):
    r = REF[ref]; t = random.random() if t is None else t
    return r['min'] + (r['max'] - r['min']) * t


def leere_szene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sz = bpy.context.scene
    sz.render.engine = 'CYCLES'; sz.cycles.device = 'CPU'; sz.cycles.samples = 16
    sz.cycles.use_denoising = False; sz.render.film_transparent = True
    sz.render.resolution_x = sz.render.resolution_y = AUFLOESUNG
    sz.render.image_settings.file_format = 'PNG'; sz.render.image_settings.color_mode = 'RGBA'
    sz.render.image_settings.color_depth = '16'
    sz.world = bpy.data.worlds.new('schwarz')
    cam = bpy.data.objects.new('Kamera', bpy.data.cameras.new('Kamera')); sz.collection.objects.link(cam); sz.camera = cam
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = 1.0; cam.location = (0, 0, 2)
    return sz


# --- Grundformen (einmal je Szene erzeugt, Länge 1, danach skaliert)
def form_blatt():
    """Buchenblatt: eiförmig, kurz zugespitzt, welliger Rand, gewölbt (trocken eingerollt)."""
    bm = bmesh.new(); mitte = bm.verts.new((0, 0, 0.02)); rand = []
    for i in range(16):
        w = 2 * math.pi * i / 16
        r = 0.5 * (1 + 0.04 * math.sin(9 * w))
        x, y = 0.34 * math.sin(w) * r * 2, 0.5 * math.cos(w) * r * 2 * (1.12 if math.cos(w) > 0 else 1)
        rand.append(bm.verts.new((x, y, 0.06 * (x * x) * 12)))
    for i in range(16): bm.faces.new((mitte, rand[i], rand[(i + 1) % 16]))
    me = bpy.data.meshes.new('blatt'); bm.to_mesh(me); bm.free(); return me


def form_stab(dicke=0.02, seiten=5):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=seiten, radius1=dicke, radius2=dicke * 0.7, depth=1)
    bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Euler((math.pi / 2, 0, 0)).to_matrix(), verts=bm.verts)
    me = bpy.data.meshes.new('stab'); bm.to_mesh(me); bm.free(); return me


def form_kugel(unterteilung=2, rauh=0.15, saat=0):
    random.seed(saat)
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=unterteilung, radius=0.5)
    for v in bm.verts: v.co *= 1 + (random.random() - 0.5) * rauh
    me = bpy.data.meshes.new('kugel'); bm.to_mesh(me); bm.free(); return me


def form_zapfen():
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=14, radius=0.5)
    for v in bm.verts:
        v.co.x *= 0.28; v.co.z *= 0.28
        schuppe = 1 + 0.18 * max(0, math.sin(v.co.y * 60))
        v.co.x *= schuppe; v.co.z *= schuppe
    me = bpy.data.meshes.new('zapfen'); bm.to_mesh(me); bm.free(); return me


FARBEN = {
    'laub': [(0.33, 0.17, 0.07), (0.42, 0.24, 0.10), (0.26, 0.14, 0.07), (0.50, 0.33, 0.15), (0.20, 0.12, 0.06)],
    'nadel': [(0.30, 0.20, 0.10), (0.36, 0.25, 0.12), (0.22, 0.15, 0.08)],
    'zapfen': [(0.30, 0.18, 0.09), (0.36, 0.22, 0.11)],
    'zweig': [(0.22, 0.17, 0.12), (0.30, 0.24, 0.17), (0.17, 0.13, 0.09)],
    'stein': [(0.42, 0.40, 0.37), (0.55, 0.52, 0.47), (0.34, 0.32, 0.30), (0.48, 0.44, 0.38)],
    'moos': [(0.12, 0.20, 0.05), (0.18, 0.26, 0.07), (0.10, 0.15, 0.05)],
    'ecker': [(0.30, 0.18, 0.10)],
}


def feld(nummer):
    """Liste (Form, Ort, Drehung, Skalierung, Farbe)."""
    random.seed(4711 + nummer * 97)
    teile = []

    def frei():
        while True:
            x, y = random.uniform(-RADIUS, RADIUS), random.uniform(-RADIUS, RADIUS)
            r = math.hypot(x, y) / RADIUS
            if r < 1 and random.random() > r ** 2.5: return x, y

    def lege(form, n, laenge, farbe, flach=True, hoehe=0.0):
        for _ in range(n):
            x, y = frei(); l = laenge()
            kipp = (random.uniform(-0.35, 0.35), random.uniform(-0.35, 0.35)) if flach else (random.uniform(-1, 1), random.uniform(-1, 1))
            teile.append((form, Vector((x, y, hoehe + random.uniform(0, 0.012))), Euler((kipp[0], kipp[1], random.uniform(0, 6.283))),
                          l, random.choice(FARBEN[farbe])))

    if nummer == 0:     # Laubstreu: Buche, dicht, mehrlagig
        lege('blatt', 380, lambda: groesse('buchenblatt'), 'laub')
        lege('kugel', 14, lambda: 0.015 + random.random() * 0.006, 'ecker', hoehe=0.006)
        lege('stab', 10, lambda: 0.08 + random.random() * 0.25, 'zweig')
    elif nummer == 1:   # Nadelstreu mit Zapfen
        lege('stab', 2600, lambda: groesse('fichtennadel'), 'nadel')
        lege('zapfen', 4, lambda: groesse('fichtenzapfen'), 'zapfen', hoehe=0.015)
        lege('stab', 8, lambda: 0.1 + random.random() * 0.3, 'zweig')
    elif nummer == 2:   # Kies und Moos
        lege('kugel', 420, lambda: 0.008 + random.random() ** 2 * 0.045, 'stein', flach=False)
        lege('moos', 260, lambda: 0.012 + random.random() * 0.02, 'moos', flach=False)
    else:               # Zweige und trockenes Laub, locker
        lege('stab', 40, lambda: 0.06 + random.random() * 0.24, 'zweig')
        lege('blatt', 90, lambda: groesse('buchenblatt'), 'laub')
        lege('kugel', 40, lambda: 0.01 + random.random() * 0.025, 'stein', flach=False)
    return teile


def emission(name, baue):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    aus = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(em.outputs[0], aus.inputs['Surface']); baue(nt, em); return m


def farbe(nt, em):
    attr = nt.nodes.new('ShaderNodeObjectInfo')
    nt.links.new(attr.outputs['Color'], em.inputs['Color'])
    em.inputs['Strength'].default_value = 0.55   # Grundfarbe: Streu ist dunkel, die Paletten sind als Licht zu hell


def normale(nt, em):
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    skal = nt.nodes.new('ShaderNodeVectorMath'); skal.operation = 'MULTIPLY_ADD'
    skal.inputs[1].default_value = (0.5, 0.5, 0.5); skal.inputs[2].default_value = (0.5, 0.5, 0.5)
    nt.links.new(geo.outputs['Normal'], skal.inputs[0]); nt.links.new(skal.outputs[0], em.inputs['Color'])


def hoehe(nt, em):
    geo = nt.nodes.new('ShaderNodeNewGeometry'); sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(geo.outputs['Position'], sep.inputs[0])
    rng = nt.nodes.new('ShaderNodeMapRange'); rng.inputs['From Max'].default_value = 0.06
    nt.links.new(sep.outputs['Z'], rng.inputs['Value'])
    comb = nt.nodes.new('ShaderNodeCombineColor')
    for k in ('Red', 'Green', 'Blue'): nt.links.new(rng.outputs['Result'], comb.inputs[k])
    nt.links.new(comb.outputs[0], em.inputs['Color'])


for nummer in range(4):
    teile = feld(nummer)
    for art, baue in (('farbe', farbe), ('normal', normale), ('abstand', hoehe)):
        sz = leere_szene()
        if art != 'farbe': sz.view_settings.view_transform = 'Raw'
        else: sz.view_settings.view_transform = 'Standard'
        mat = emission(art, baue)
        formen = {'blatt': form_blatt(), 'stab': form_stab(), 'kugel': form_kugel(2, 0.25, nummer),
                  'zapfen': form_zapfen(), 'moos': form_kugel(1, 0.6, 99)}
        for me in formen.values(): me.materials.append(mat)
        for i, (form, ort, rot, l, f) in enumerate(teile):
            ob = bpy.data.objects.new(f't{i}', formen[form]); ob.location = ort; ob.rotation_euler = rot
            if form == 'stab': ob.scale = (0.4, l, 0.4) if l > 0.05 else (0.06, l, 0.06)  # Zweig ~8 mm, Nadel ~1 mm
            else: ob.scale = (l, l, l * (0.5 if form in ('kugel', 'moos') else 1))
            ob.color = (*f, 1)
            sz.collection.objects.link(ob)
        sz.render.filepath = os.path.join(ziel, f'streu{nummer}-{art}.png')
        bpy.ops.render.render(write_still=True)
    print('FELD', nummer, 'TEILE', len(teile))
