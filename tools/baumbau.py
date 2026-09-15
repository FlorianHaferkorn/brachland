"""
BRACHLAND — Baumbau (ADR-0006, Stufe 3, D155): die Blender-Baeume des Szenenbaus als Prop-Dateien.

    blender --background --python tools/baumbau.py -- public/props [varianten]

Der Engine-Wald (72.000 Instanzen) kam bisher aus `src/world/baum.ts` (prozedural, D40). Seit dem
Durchstich von Stufe 2 stehen an der Felsmulde Blender-Baeume neben Engine-Baeumen, und der Bruch
am Rand der Freihaltung ist im Bild (D154). Hier entstehen dieselben Baeume wie im Szenenbau als
**ein Netz je Datei**: Stamm, Aeste, Wurzelanlauf und Blattmassen zusammengefuegt, Farbe als
Vertexfarbe gebacken, in `COLOR_0.a` die Laubmaske (1 = Blatt, 0 = Holz) fuer die Loecher im
Shader, in `_WIND` die Windgewichtung (Stamm 0, Krone 1).

Drei Stufen desselben Baums: nah unter 45 m, mittel bis 110 m, danach fern.
Alle entstehen aus einer gebackenen Quellgeometrie; nur deren Aufloesung nimmt ab.
Astpositionen, Kronenmassen, Farbe und Variante bleiben erhalten (D157).
Dreiecke werden gemessen und stehen im Register — nicht gedeckelt, aber gezaehlt (ADR-0006).
"""
import bpy, bmesh, math, random, sys, os, json, importlib.util

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ZIEL = ARGS[0] if ARGS else 'public/props'
VARIANTEN = int(ARGS[1]) if len(ARGS) > 1 else 4

# Den Szenenbau als Modul laden, ohne dass er baut: seine Baumbauer sind die Vorlage.
spec = importlib.util.spec_from_file_location('szenenbau', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'szenenbau.py'))
sb = importlib.util.module_from_spec(spec)
sys.argv = [sys.argv[0]]   # der Szenenbau liest seine Argumente hinter '--'; hier gibt es keine
spec.loader.exec_module(sb)
sb.bodenhoehe = lambda x, y: 0.0          # Props stehen im Ursprung, der Boden ist y=0
sb.SCHNELL = False
sb.STAMM_RES = 3; sb.STAMM_BEVEL_MAX = 2   # Props: grobe Staemme, die Krone traegt das Bild

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

def backe_und_maskiere(o, laub_material_namen, laub_faktor=1.0):
    """Farbe in Vertexfarben backen (Cycles, 16 spp), dann Alpha = Laubmaske, WIND = Hoehe der Krone.
    `laub_faktor` ist fuer alle Stufen gleich; ein stufenabhaengiger Farbwechsel waere selbst ein LOD-Sprung."""
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 16
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type = 'METAL'; prefs.get_devices()
        for d in prefs.devices: d.use = True
        sc.cycles.device = 'GPU'
    except Exception: pass
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
        a, f = (1.0, laub_faktor) if laub else (0.0, 1.0)
        for li in p.loop_indices:
            c = farbe.data[li].color; farbe.data[li].color = (c[0] * f, c[1] * f, c[2] * f, a)
    # Exportmaterial: Vertexfarbe inklusive Alpha, sonst schreibt der Exporter COLOR_0 als VEC3 (D146)
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

os.makedirs(ZIEL, exist_ok=True)
register = {'baeume': []}
for art in ('buche', 'fichte'):
    for v in range(VARIANTEN):
        leer()
        m_rinde = sb.mat_rinde()
        # Ausschliesslich die Blattfarbe backen. Transparente Loecher gehoeren in den
        # Runtime-Shader: im alten Bake wurden sie als schwarze Vertexfarben konserviert.
        m_laub = sb.mat_laub(durchlass=0.0, loecher=0.0)
        m_nadel = sb.mat_laub('Nadel', sb.NADEL, (0.22, 0.30, 0.10), 0.0, 0.0)
        rnd = random.Random(1000 + v * 17 + (0 if art == 'buche' else 500))
        hoehe = (20 + rnd.random() * 12) if art == 'buche' else (18 + rnd.random() * 10)
        if art == 'buche':
            sb.laubbaum2('Baum', 0.0, 0.0, hoehe, m_rinde, m_laub, 700 + v, True, 11, 3, 1.0)
        else:
            sb.fichte('Baum', 0.0, 0.0, hoehe, m_rinde, m_nadel, 800 + v, False, 10, 4, 1.0)
        quelle = sammeln('Baum')
        backe_und_maskiere(quelle, {'Laub', 'Nadel'}, 0.85)
        # Fichtennadeln sind bereits duenne 20-Dreieck-Koerper. Vierteln loeschte
        # bis zu 30 % ihrer Silhouette; Buchenmassen vertragen diese Reduktion.
        stufen = (('nah', 1.0), ('mittel', 0.8), ('fern', 0.6)) if art == 'fichte' else (('nah', 1.0), ('mittel', 0.55), ('fern', 0.25))
        for stufe, anteil in stufen:
            o = stufe_aus_quelle(quelle, anteil)
            name = f'baum-{art}-{v}-{stufe}'
            exportiere(o, os.path.abspath(os.path.join(ZIEL, name + '.glb')))
            tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
            register['baeume'].append({'art': art, 'variante': v, 'stufe': stufe, 'datei': name, 'hoehe': round(hoehe, 2), 'dreiecke': tris})
            print('gebaut', name, round(hoehe, 1), 'm', tris, 'Dreiecke', flush=True)
            bpy.data.objects.remove(o, do_unlink=True)
json.dump(register, open(os.path.join(ZIEL, 'baeume.json'), 'w'), indent=1)
print('fertig', len(register['baeume']), 'Dateien', flush=True)
