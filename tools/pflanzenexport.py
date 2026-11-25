"""
BRACHLAND — Pflanzen des Zielbilds fürs Spiel (D448).

    blender --background <zielbild.blend> --python tools/pflanzenexport.py -- public/bauten-ziel felsmulde

Gras, Kraut, Farn, Nessel, Ampfer, Sauerklee, Löwenzahn, Immergrün, Jungfichten und die Pflanzen der Mauerkrone stehen im
Zielbild als Poly-Haven-Scans (CC0) mit geteilten Netzen — jede Art hat eine Handvoll Vorlagen, gestreut nach
Dichtefunktionen (`stilframes.py` `streue`). Hier werden **die Vorlagen einmal** und **die Lagen als GPU-Instanzen**
exportiert (glTF `EXT_mesh_gpu_instancing`; `GLTFLoader` macht daraus `InstancedMesh`). Die Lagen stehen damit im
Binärteil der Datei wie die Steine der Mauer in `-bauten.glb` — sie sind Teil des Zielbilds, nicht Spielwerte, und aus
dem Python-Zufall des Renders nicht in TypeScript nachzuziehen (benannte Abweichung von „Positionen aus dem Seed“).
Materialien bleiben die der Scans (Farbe mit Alpha, Normale, Rauheit); das Durchscheinen der Blätter macht das Spiel.
"""
import bpy, os, sys, re, json, collections

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ZIEL = ARGS[0] if ARGS else 'public/bauten-ziel'
NAME = ARGS[1] if len(ARGS) > 1 else 'felsmulde'
MUSTER = re.compile(r'^(Gras|Gras2|Kantengras|GrasW|Kantenkraut|Kraut|Nessel|Sauerklee|Ampfer|FarnW|FarnZ|Loewenzahn|Immergruen|Jungfichte|Blattpflanze|Krongras|Kronkraut|Kronfarn|Farn|Efeu|Efeublatt|Laubstreu)\d*$')
sc = bpy.context.scene
pflanzen = [o for o in sc.objects if o.type == 'MESH' and MUSTER.match(o.name)]
# Efeu und Laubstreu sind Geometrie-Knoten (Instanzen auf Mauer und Boden): ausrechnen, solange Mauer und Gelände noch da sind
# (danach gelöscht: erster Lauf ergab 0 Flächen), sonst exportiert glTF nichts
# D464: Fallaub-Vorlage kürzen, bevor sie 4 161-mal ausgerechnet wird — 72 Flächen je Blatt am Boden sind 0,3 Mio. Dreiecke
# für Blätter von 5 cm; 12 tragen die Wölbung. Efeublatt 12 → 6: 57 651 Blätter waren 0,69 Mio. Dreiecke, der Umriss bleibt.
for nm, ziel_fl in (('Fallaub', 12), ('Efeublatt', int(os.environ.get('EFEU_FLAECHEN', '6')))):
    vo = bpy.data.objects.get(nm)
    if vo and len(vo.data.polygons) > ziel_fl:
        # Die Vorlage hängt in keiner Ansichtsebene: auf einem Hilfsobjekt mit Kopie kürzen, dann das Netz tauschen
        tmp = bpy.data.objects.new('_vorlage', vo.data.copy()); sc.collection.objects.link(tmp)
        bpy.ops.object.select_all(action='DESELECT'); tmp.select_set(True); bpy.context.view_layer.objects.active = tmp
        dz = tmp.modifiers.new('Dez', 'DECIMATE'); dz.ratio = ziel_fl / len(tmp.data.polygons)
        bpy.ops.object.modifier_apply(modifier=dz.name)
        vo.data = tmp.data; bpy.data.objects.remove(tmp, do_unlink=True)
        print('VORLAGE', nm, len(vo.data.polygons), 'Flächen', flush=True)
# Die Knoten geben Instanzen aus (Efeu3: 57 651 Blätter); `convert` verwirft sie, also vorher einen Realize-Knoten anhängen
for o in [o for o in pflanzen if o.modifiers]:
    for m in o.modifiers:
        if m.type != 'NODES' or not m.node_group: continue
        ng = m.node_group.copy(); m.node_group = ng
        aus_ = next(n for n in ng.nodes if n.type == 'GROUP_OUTPUT')
        quelle = aus_.inputs[0].links[0].from_socket
        r = ng.nodes.new('GeometryNodeRealizeInstances'); ng.links.new(quelle, r.inputs[0]); ng.links.new(r.outputs[0], aus_.inputs[0])
    # Blattfarbe: im Render prozedural je Instanz (Objekt-Info Zufall → Farbverlauf/Mischung); glTF kennt das nicht
    # (Probe 2: weisser Efeu). Also die Farben des Materials lesen und nach dem Ausrechnen je Blatt als Eckenfarbe setzen.
    farben = []
    for m in [m for m in bpy.data.materials if m.name.startswith(('Efeu', 'Fallaub')) and (('Efeu' in o.name) == m.name.startswith('Efeu'))]:
        for n in m.node_tree.nodes:
            if n.type == 'VALTORGB': farben += [tuple(e.color) for e in n.color_ramp.elements]
            if n.type == 'MIX' and getattr(n, 'data_type', '') == 'RGBA':
                farben += [tuple(n.inputs[k].default_value) for k in (6, 7) if not n.inputs[k].is_linked]
    farben = [f for f in farben if max(f[:3]) <= 1.0]   # Durchscheinfarbe (1,6/2,0/0,9) ist keine Blattfarbe
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target='MESH')
    je_blatt = len(bpy.data.objects['Efeublatt' if 'Efeu' in o.name else 'Fallaub'].data.polygons)   # Flächen der Vorlage
    if farben:
        import random
        rnd = random.Random(441); me = o.data; n_ = len(me.polygons) // je_blatt
        ton = [farben[rnd.randrange(len(farben))] for _ in range(n_ + 1)]
        ton = [tuple(min(1.0, max(0.0, c * rnd.uniform(0.8, 1.15))) for c in t[:3]) + (1.0,) for t in ton]
        ca = me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER'); werte = []
        for poly in me.polygons:
            t = ton[poly.index // je_blatt]
            for _ in poly.loop_indices: werte += t
        ca.data.foreach_set('color', werte)
        mat = bpy.data.materials.new(o.name + '_vc'); mat.use_nodes = True; nt = mat.node_tree; b = nt.nodes['Principled BSDF']
        a = nt.nodes.new('ShaderNodeVertexColor'); a.layer_name = 'Col'; nt.links.new(a.outputs['Color'], b.inputs['Base Color'])
        b.inputs['Roughness'].default_value = 0.7
        me.materials.clear(); me.materials.append(mat)
    print('AUSGERECHNET', o.name, len(o.data.polygons), 'Flächen,', len(farben), 'Farben', [tuple(round(c, 2) for c in f[:3]) for f in farben[:4]], flush=True)
weg = [o for o in sc.objects if o not in pflanzen]
for o in weg: bpy.data.objects.remove(o, do_unlink=True)
# Vorlagen kürzen: die Scans haben im Mittel 9 000 Dreiecke, bei 6 700 Lagen waren das 37 Mio. Dreiecke im Bild
# (12 B/s am M1, Probe 1). Höchstens `PFLANZE_MAX` je Vorlage; Blätter sind Alphakarten, der Umriss bleibt in der Textur.
PFLANZE_MAX = int(os.environ.get('PFLANZE_MAX', '600'))
gekuerzt = {}
for o in pflanzen:
    if len(o.data.polygons) <= PFLANZE_MAX or o.name.startswith(('Efeu', 'Laubstreu')): continue
    if o.data.name not in gekuerzt:
        kopie = o.data.copy(); tmp = bpy.data.objects.new('_dez', kopie); sc.collection.objects.link(tmp)
        d = tmp.modifiers.new('Dez', 'DECIMATE'); d.ratio = PFLANZE_MAX / len(kopie.polygons)
        bpy.ops.object.select_all(action='DESELECT'); tmp.select_set(True); bpy.context.view_layer.objects.active = tmp
        bpy.ops.object.modifier_apply(modifier='Dez'); gekuerzt[o.data.name] = tmp.data; bpy.data.objects.remove(tmp, do_unlink=True)
    o.data = gekuerzt[o.data.name]
print('GEKUERZT', len(gekuerzt), 'Vorlagen auf', PFLANZE_MAX, flush=True)
je_netz = collections.Counter(o.data.name for o in pflanzen)
art = collections.Counter(MUSTER.match(o.name).group(1) for o in pflanzen)
print('PFLANZEN', len(pflanzen), 'Objekte,', len(je_netz), 'Netze,', sum(len(bpy.data.meshes[n].polygons) for n in je_netz), 'Dreiecke in Vorlagen')
print('ARTEN', dict(art))
print('IM BILD', sum(len(o.data.polygons) for o in pflanzen), 'Flächen über alle Lagen', flush=True)
bpy.ops.object.select_all(action='DESELECT')
for o in pflanzen: o.select_set(True)
bpy.context.view_layer.objects.active = pflanzen[0]
datei = os.path.abspath(os.path.join(ZIEL, NAME + '-pflanzen.glb'))
bpy.ops.export_scene.gltf(filepath=datei, export_format='GLB', use_selection=True, export_apply=False,
                          export_gpu_instances=True, export_image_format='WEBP', export_image_quality=85,
                          export_texcoords=True, export_normals=True, export_materials='EXPORT', export_yup=True,
                          export_animations=False)
print('GESCHRIEBEN', datei, os.path.getsize(datei) // 1024, 'KB')
regpfad = os.path.join(ZIEL, 'register.json')
reg = json.load(open(regpfad))
for b in reg['bauwerke']:
    if b['name'] == NAME and 'pflanzen' not in b['dateien']: b['dateien'].append('pflanzen')
json.dump(reg, open(regpfad, 'w'), indent=1, ensure_ascii=False)
