# BRACHLAND — Efeukarten backen (D358): vier Efeufelder 1 × 1 m, Blätter in echter Grösse (content/massstab.json),
# orthografisch gerendert als Grundfarbe (unbeleuchtet), Normale (Tangentenraum der Wand) und Abstand zur Wand.
#
#   blender --background --factory-startup --python tools/efeukarten.py -- .cache/efeukarten
#   python3 tools/efeukarten_pack.py .cache/efeukarten
#
# Wand = Ebene y = 0, Blick von −y. Tangentenraum der Karte: x rechts, y oben, z aus der Wand (zur Kamera).
# Die Wuchsregel ist die aus tools/efeuwand.py: verzweigte Zufallswanderung, Blätter in Büscheln an den Knoten,
# zum Rand des Feldes lichter, damit die Karte ausfranst statt als Quadrat zu lesen.
import bpy, bmesh, json, math, os, random, sys
from mathutils import Euler, Vector

ziel = sys.argv[sys.argv.index('--') + 1]
os.makedirs(ziel, exist_ok=True)
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
efeu = next(r for r in json.load(open(os.path.join(REPO, 'content/massstab.json')))['referenzen'] if r['id'] == 'efeublatt')
AUFLOESUNG = 1024

FORM = [(0, -.44), (-.32, -.38), (-.45, -.15), (-.56, .13), (-.24, .16), (0, .68), (.23, .18), (.55, .20), (.43, -.15), (.29, -.40)]
SPANNE = max(math.dist(a, b) for a in FORM for b in FORM)


def leere_szene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sz = bpy.context.scene
    sz.render.engine = 'CYCLES'; sz.cycles.device = 'CPU'; sz.cycles.samples = 24
    sz.cycles.use_denoising = False; sz.render.film_transparent = True
    sz.render.resolution_x = sz.render.resolution_y = AUFLOESUNG
    sz.view_settings.view_transform = 'Standard'
    sz.render.image_settings.file_format = 'PNG'; sz.render.image_settings.color_mode = 'RGBA'
    sz.render.image_settings.color_depth = '16'
    welt = bpy.data.worlds.new('schwarz'); sz.world = welt
    cam = bpy.data.objects.new('Kamera', bpy.data.cameras.new('Kamera')); sz.collection.objects.link(cam); sz.camera = cam
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = 1.0
    cam.location = (0, -2, 0); cam.rotation_euler = Euler((math.pi / 2, 0, 0))
    return sz


def blattmesh():
    bm = bmesh.new()
    mitte = bm.verts.new((0, 0, 0))
    # Spreite gewölbt: Rand hinter die Mittelrippe (zur Wand), Spitze leicht nach vorn.
    rand = [bm.verts.new((u, 0.05 * u * u * 4 - 0.02 * v, v)) for u, v in FORM]
    for i in range(len(rand)):
        bm.faces.new((mitte, rand[i], rand[(i + 1) % len(rand)]))
    me = bpy.data.meshes.new('Blatt'); bm.to_mesh(me); bm.free()
    return me


def feld(saat):
    """Blattpunkte eines 1 × 1 m Feldes: Liste (ort, rot, laenge, ton)."""
    random.seed(saat)
    blaetter = []

    def trieb(x, z, laenge, richtung):
        rx = richtung
        for _ in range(int(laenge / 0.03)):
            rx += random.uniform(-0.5, 0.5); rx *= 0.9
            x += math.sin(rx) * 0.03; z += math.cos(rx) * 0.03
            if math.hypot(x, z) > 0.42:  # Rand der Kachel frei, sonst schneidet der Bildrand Blätter ab
                return
            if random.random() < 0.06:
                trieb(x, z, laenge * 0.55, rx + random.choice((-1.2, 1.2)))
            # Rund statt quadratisch und zum Rand ausfransend, sonst liest die Karte als Rechteck.
            rand = min(1.0, math.hypot(x, z) / 0.42)
            dichte = max(0.0, 1 - rand ** 1.6) * (0.55 + 0.45 * random.random())
            for _ in range(int(2 + 4 * dichte * random.random() + 0.5)):
                jung = 0.55 + 0.45 * dichte
                t = random.random() ** 1.6 * jung
                lang = efeu['min'] + (efeu['max'] - efeu['min']) * t
                vor = 0.01 + 0.16 * dichte * random.random() ** 0.7   # Polster: Mitte weiter vorn
                ort = Vector((x + random.gauss(0, 0.05), -vor, z + random.gauss(0, 0.045)))
                # Spreite zur Kamera (Blattebene x/z), um die Wandnormale frei gedreht, Spitze bis ~45° vorgeneigt.
                rot = Euler((math.radians(random.uniform(-20, 45)), random.uniform(-math.pi, math.pi), math.radians(random.uniform(-25, 25))), 'YXZ')
                blaetter.append((ort, rot, lang / SPANNE, vor))

    for _ in range(6):
        trieb(random.uniform(-0.25, 0.25), -0.38, random.uniform(0.8, 1.6), random.uniform(-0.5, 0.5))
    for _ in range(3):
        trieb(random.uniform(-0.3, 0.3), random.uniform(-0.3, 0.3), random.uniform(0.4, 0.9), random.uniform(-3, 3))
    return blaetter


def emissionsmaterial(name, baue):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    aus = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(em.outputs[0], aus.inputs['Surface'])
    baue(nt, em)
    return m


def farbe(nt, em):
    zufall = nt.nodes.new('ShaderNodeObjectInfo')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    e = ramp.color_ramp.elements
    e[0].color = (0.030, 0.052, 0.018, 1); e[1].color = (0.115, 0.165, 0.055, 1)
    ramp.color_ramp.elements.new(0.6).color = (0.075, 0.115, 0.035, 1)
    nt.links.new(zufall.outputs['Random'], ramp.inputs['Fac'])
    # Mittelrippe heller: Abstand zur lokalen x = 0 der Spreite.
    tex = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tex.outputs['Object'], sep.inputs[0])
    mat = nt.nodes.new('ShaderNodeMath'); mat.operation = 'ABSOLUTE'; nt.links.new(sep.outputs['X'], mat.inputs[0])
    rippe = nt.nodes.new('ShaderNodeMapRange'); rippe.inputs['From Max'].default_value = 0.04
    rippe.inputs['To Min'].default_value = 1.6; rippe.inputs['To Max'].default_value = 1.0
    nt.links.new(mat.outputs[0], rippe.inputs['Value'])
    mul = nt.nodes.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs['Factor'].default_value = 1
    nt.links.new(ramp.outputs['Color'], mul.inputs['A'])
    comb = nt.nodes.new('ShaderNodeCombineColor')
    for k in ('Red', 'Green', 'Blue'):
        nt.links.new(rippe.outputs['Result'], comb.inputs[k])
    nt.links.new(comb.outputs[0], mul.inputs['B'])
    nt.links.new(mul.outputs['Result'], em.inputs['Color'])


def normale(nt, em):
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    # Cycles richtet die Shading-Normale bereits zur Kamera aus (auch auf Rückseiten).
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Normal'], sep.inputs[0])
    # Welt → Tangentenraum der Wand: x = x, y = z, z = −y; dann 0…1.
    neg = nt.nodes.new('ShaderNodeMath'); neg.operation = 'MULTIPLY'; neg.inputs[1].default_value = -1
    nt.links.new(sep.outputs['Y'], neg.inputs[0])
    comb = nt.nodes.new('ShaderNodeCombineXYZ')
    nt.links.new(sep.outputs['X'], comb.inputs['X']); nt.links.new(sep.outputs['Z'], comb.inputs['Y'])
    nt.links.new(neg.outputs[0], comb.inputs['Z'])
    skal = nt.nodes.new('ShaderNodeVectorMath'); skal.operation = 'MULTIPLY_ADD'
    skal.inputs[1].default_value = (0.5, 0.5, 0.5); skal.inputs[2].default_value = (0.5, 0.5, 0.5)
    nt.links.new(comb.outputs[0], skal.inputs[0]); nt.links.new(skal.outputs[0], em.inputs['Color'])


def abstand(nt, em):
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Position'], sep.inputs[0])
    rng = nt.nodes.new('ShaderNodeMapRange')
    rng.inputs['From Min'].default_value = 0.0; rng.inputs['From Max'].default_value = -0.25
    nt.links.new(sep.outputs['Y'], rng.inputs['Value'])
    comb = nt.nodes.new('ShaderNodeCombineColor')
    for k in ('Red', 'Green', 'Blue'):
        nt.links.new(rng.outputs['Result'], comb.inputs[k])
    nt.links.new(comb.outputs[0], em.inputs['Color'])


for nummer, saat in enumerate((3581, 7019, 9241, 12007)):
    blaetter = feld(saat)
    for art, baue in (('farbe', farbe), ('normal', normale), ('abstand', abstand)):
        sz = leere_szene()
        me = blattmesh(); me.materials.append(emissionsmaterial(art, baue))
        for i, (ort, rot, s, _) in enumerate(blaetter):
            ob = bpy.data.objects.new(f'b{i}', me)
            ob.location = ort; ob.rotation_euler = rot; ob.scale = (s, s, s)
            sz.collection.objects.link(ob)
        if art != 'farbe':
            sz.view_settings.view_transform = 'Raw'  # Daten, keine Farbe: ohne Gamma speichern
        sz.render.filepath = os.path.join(ziel, f'efeu{nummer}-{art}.png')
        bpy.ops.render.render(write_still=True)
    print('FELD', nummer, 'BLAETTER', len(blaetter))
