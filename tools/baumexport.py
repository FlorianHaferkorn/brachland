"""
BRACHLAND — Bäume des Zielbilds fürs Spiel (D471).

    blender --background <zielbild.blend> --python tools/baumexport.py -- public/bauten-ziel felsmulde

Die Zielbild-Felsmulde steht in 13 Bäumen aus zwei Poly-Haven-Scans (island_tree_01/02, CC0) mit 1,6 bzw. 1,1 Mio.
Flächen. Im Spiel standen dafür Kartenkronen (`Rahmenkronen.tsx`, D446), die flach und dunkel lasen. Hier gehen die
Scan-Bäume selbst ins Spiel, als GPU-Instanzen (je Vorlage ein Netz):
- Stamm und Äste mit Decimate auf `BAUM_HOLZ` Flächen je Vorlage (Silhouette bleibt, Rinde trägt die Scan-Textur).
- Laub: Die Blätter sind Karten mit Alphamaske. Es bleibt ein Anteil `BAUM_LAUB` der Karten stehen (Zufall mit fester
  Saat), jede vergrössert um 1/√Anteil um ihren Mittelpunkt — so bleibt die Kronenfläche und damit Schatten und
  Lichtdurchlass gleich, nur in gröberen Flecken.
Flache Blattkarten werden zu wenigen Flächen zusammengefasst (sonst ~24 je Karte).
Lagen kommen aus der Szene (Objekte `Baum*`); `bautenpack.ts --instanz` macht daraus die Instanzen.
"""
import bpy, bmesh, os, sys, json, math, random

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ZIEL = ARGS[0] if ARGS else 'public/bauten-ziel'
NAME = ARGS[1] if len(ARGS) > 1 else 'felsmulde'
HOLZ = int(os.environ.get('BAUM_HOLZ', '14000'))
LAUB = float(os.environ.get('BAUM_LAUB', '0.35'))
ZIEL_FL = int(os.environ.get('BAUM_ZIEL', '60000'))   # Flächen je Vorlage insgesamt
sc = bpy.context.scene
baeume = [o for o in sc.objects if o.type == 'MESH' and o.name.startswith('Baum')]
assert baeume, 'keine Objekte Baum* in der Szene'
for o in [o for o in sc.objects if o not in baeume]: bpy.data.objects.remove(o, do_unlink=True)
bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)

neu = {}
rnd = random.Random(471)
for o in baeume:
    if o.data.name in neu: continue
    me = o.data.copy(); me.name = o.data.name + '_spiel'
    laub_idx = {i for i, m in enumerate(me.materials) if m and 'leaves' in m.name.lower()}
    bm = bmesh.new(); bm.from_mesh(me)
    vor = len(bm.faces)
    # --- Laub: Karten (zusammenhängende Inseln) ausdünnen und vergrössern
    laub = [f for f in bm.faces if f.material_index in laub_idx]
    besucht = set(); inseln = []
    for f in laub:
        if f.index in besucht: continue
        stapel = [f]; insel = []
        besucht.add(f.index)
        while stapel:
            g = stapel.pop(); insel.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in besucht and h.material_index in laub_idx: besucht.add(h.index); stapel.append(h)
        inseln.append(insel)
    # Jede behaltene Karte wird ein einziges Viereck: Ecken = die Inselpunkte, deren UV den Ecken des UV-Rechtecks der
    # Karte am nächsten liegen, UV = das Rechteck selbst. Die Karten sind gewölbte Streifen mit ~24 Flächen; als Viereck
    # sind es 2 Dreiecke, und es bleiben genug Karten, dass die Blätter in Originalgrösse stehen (D471, zweiter Lauf:
    # vergrösserte Karten lasen als Riesenblätter).
    uvl = bm.loops.layers.uv.active
    weg = []; vierecke = []; skala = LAUB ** -0.25   # halb ausgeglichen: Fläche fehlt etwas, Blätter bleiben nahe Originalgrösse
    for insel in inseln:
        if rnd.random() > LAUB: weg += insel; continue
        punkte = {}
        for g in insel:
            for l in g.loops: punkte[l.vert.index] = (l.vert.co.copy(), l[uvl].uv.copy())
        us = [uv.x for _, uv in punkte.values()]; vs = [uv.y for _, uv in punkte.values()]
        ecken_uv = [(min(us), min(vs)), (max(us), min(vs)), (max(us), max(vs)), (min(us), max(vs))]
        ecken = [min(punkte.values(), key=lambda q: (q[1].x - eu) ** 2 + (q[1].y - ev) ** 2)[0] for eu, ev in ecken_uv]
        mitte = sum(ecken, ecken[0] * 0) / 4
        ecken = [mitte + (c - mitte) * skala for c in ecken]
        vierecke.append((ecken, ecken_uv, insel[0].material_index)); weg += insel
    bmesh.ops.delete(bm, geom=list(set(weg)), context='FACES')
    for ecken, ecken_uv, mi in vierecke:
        vs_ = [bm.verts.new(c) for c in ecken]
        try: f = bm.faces.new(vs_)
        except ValueError: continue
        f.material_index = mi; f.smooth = True
        for l, uv in zip(f.loops, ecken_uv): l[uvl].uv = uv
    nach_laub = len([f for f in bm.faces if f.material_index in laub_idx])
    bm.to_mesh(me); bm.free()
    # --- Holz: Decimate nur auf Nicht-Laub (über Vertexgruppe)
    tmp = bpy.data.objects.new('_baum', me); sc.collection.objects.link(tmp)
    gruppe = tmp.vertex_groups.new(name='holz')
    holz_ecken = {v for p in me.polygons if p.material_index not in laub_idx for v in p.vertices}
    gruppe.add(list(holz_ecken), 1.0, 'REPLACE')
    holz_fl = sum(1 for p in me.polygons if p.material_index not in laub_idx)
    if holz_fl > HOLZ:
        d = tmp.modifiers.new('Dez', 'DECIMATE'); d.ratio = HOLZ / holz_fl; d.vertex_group = 'holz'
        bpy.ops.object.select_all(action='DESELECT'); tmp.select_set(True); bpy.context.view_layer.objects.active = tmp
        bpy.ops.object.modifier_apply(modifier=d.name)
    tmp.vertex_groups.clear()
    # Gesamtbudget je Vorlage (D471): die Blattkarten sind gewölbt und lassen sich nicht flach zusammenfassen
    if len(me.polygons) > ZIEL_FL:
        d = tmp.modifiers.new('Ziel', 'DECIMATE'); d.ratio = ZIEL_FL / len(me.polygons)
        bpy.ops.object.select_all(action='DESELECT'); tmp.select_set(True); bpy.context.view_layer.objects.active = tmp
        bpy.ops.object.modifier_apply(modifier=d.name)
    print('VORLAGE', o.data.name, vor, '→', len(me.polygons), 'Flächen; Laubkarten', len(inseln), '→', len(inseln) - len(set(weg)) and sum(1 for i in inseln if not set(i) & set(weg)), 'Laubflächen', nach_laub, flush=True)
    bpy.data.objects.remove(tmp, do_unlink=True)
    neu[o.data.name] = me
for o in baeume: o.data = neu[o.data.name]
bpy.ops.object.select_all(action='DESELECT')
for o in baeume: o.select_set(True)
bpy.context.view_layer.objects.active = baeume[0]
datei = os.path.abspath(os.path.join(ZIEL, NAME + '-baeume.glb'))
bpy.ops.export_scene.gltf(filepath=datei, export_format='GLB', use_selection=True, export_apply=False,
                          export_image_format='WEBP', export_image_quality=85, export_texcoords=True, export_normals=True,
                          export_materials='EXPORT', export_yup=True, export_animations=False)
print('GESCHRIEBEN', datei, os.path.getsize(datei) // 1024, 'KB', sum(len(o.data.polygons) for o in baeume), 'Flächen über alle Bäume', flush=True)
regpfad = os.path.join(ZIEL, 'register.json'); reg = json.load(open(regpfad))
for b in reg['bauwerke']:
    if b['name'] == NAME and 'baeume' not in b['dateien']: b['dateien'].append('baeume')
json.dump(reg, open(regpfad, 'w'), indent=1, ensure_ascii=False)
