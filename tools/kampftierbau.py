"""
BRACHLAND — Kampftiere mit Rig (D172): die Kreatur aus `public/creatures`, gebunden an das Skelett
ihrer Quelle, mit den Clips der Quelle.

    blender --background --python tools/kampftierbau.py -- .cache/cc0 public/creatures/kampf

## Warum

Die Kreaturen der Welt atmen und gehen im Shader (D136/D138) — ohne Rig, weil 14 Arten auf fünf
Bauplänen liegen und ein Rig je Art sich nicht lohnte. Im Echtzeitkampf reicht das nicht: Ein Wolf,
der beisst, braucht einen Kiefer und einen Hals, keinen verschobenen Körper. Die Quellen von Wolf
und Hirsch (Quaternius, Animated Animal Pack, CC0) **haben** ein Rig und je gut zwölf Clips —
Angriff, Treffer, Tod, Galopp. Sie wurden in `kreaturbau.py` nur nicht mitgenommen.

## Wie

Nicht die Quelle neu aufbereiten (Farbe, Merkmal, AO, Dezimierung stecken in `kreaturbau.py`),
sondern das fertige Modell nehmen und das Skelett hinlegen:

1. Das fertige Modell (`public/creatures/<art>.glb`) und die Quelle laden.
2. Die Lage finden, die die Quelle auf das Modell legt: Drehung um die Hochachse in 90°-Schritten,
   Skalierung aus der Höhe, Verschiebung aus der Hüllbox — gewählt wird die Drehung mit dem
   kleinsten mittleren Abstand Ecke zu nächster Ecke (KD-Baum). Nicht nachgerechnet aus
   `kreaturbau.py`: Dort normt ein Perzentil der Rückenlinie, das hier nicht wiederholt werden soll.
3. Die Gewichte per Datenübertragung (nächste Fläche, interpoliert) vom Quellnetz aufs Modell.
4. Nur die Clips behalten, die der Kampf spielt; exportieren mit Skin und Animation.
"""
import bpy, sys, os, json, math
from mathutils import Vector, Matrix
from mathutils.kdtree import KDTree

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
QUELLE = ARGS[0] if ARGS else '.cache/cc0'
ZIEL = ARGS[1] if len(ARGS) > 1 else 'public/creatures/kampf'
# Art → Quelldatei und die Clips, die der Kampf spielt.
TIERE = {
    'k7-wolf': ('wolf', ('Idle', 'Walk', 'Gallop', 'Attack', 'Idle_HitReact_Left', 'Idle_HitReact_Right', 'Death')),
    'grathorn': ('hirsch', ('Idle', 'Walk', 'Gallop', 'Attack_Headbutt', 'Idle_HitReact_Left', 'Idle_HitReact_Right', 'Death')),
}
NUR = set(ARGS[2].split(',')) if len(ARGS) > 2 else None


def weltecken(objekte):
    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for o in objekte:
        ev = o.evaluated_get(dg)
        m = bpy.data.meshes.new_from_object(ev)
        m.transform(o.matrix_world)
        pts += [v.co.copy() for v in m.vertices]
        bpy.data.meshes.remove(m)
    return pts


def huelle(pts):
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def lage_finden(quelle_pts, ziel_pts):
    """Die Abbildung Quelle → Modell: Drehung in 90°-Schritten, Skalierung, Verschiebung."""
    lq, hq = huelle(quelle_pts)
    lz, hz = huelle(ziel_pts)
    s = (hz.z - lz.z) / max(1e-9, hq.z - lq.z)
    cq = Vector(((lq.x + hq.x) / 2, (lq.y + hq.y) / 2, lq.z))
    cz = Vector(((lz.x + hz.x) / 2, (lz.y + hz.y) / 2, lz.z))
    probe = ziel_pts[::max(1, len(ziel_pts) // 600)]
    beste = None
    for k in range(4):
        r = Matrix.Rotation(k * math.pi / 2, 4, 'Z')
        t = Matrix.Translation(cz) @ Matrix.Scale(s, 4) @ r @ Matrix.Translation(-cq)
        kd = KDTree(len(quelle_pts))
        for i, p in enumerate(quelle_pts):
            kd.insert(t @ p, i)
        kd.balance()
        fehler = sum(kd.find(p)[2] for p in probe) / len(probe)
        print(f'    Drehung {k * 90:3d}°: mittlerer Abstand {fehler * 100:.1f} cm')
        if beste is None or fehler < beste[0]:
            beste = (fehler, t, k * 90)
    return beste


register = {}
os.makedirs(ZIEL, exist_ok=True)
for art, (datei, clips) in TIERE.items():
    if NUR and art not in NUR:
        continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=f'public/creatures/{art}.glb')
    modell = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
    modell.data.transform(modell.matrix_world)
    modell.matrix_world = Matrix()
    vorher = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(QUELLE, datei + '.glb'))
    neu = [o for o in bpy.context.scene.objects if o not in vorher]
    arm = next(o for o in neu if o.type == 'ARMATURE')
    netze = [o for o in neu if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers)]
    for o in neu:
        if o.type == 'MESH' and o not in netze:
            bpy.data.objects.remove(o, do_unlink=True)
    # Ruhelage: keine Action, keine Spur, alle Knochen auf Null.
    ad = arm.animation_data
    for tr in ad.nla_tracks: tr.mute = True
    ad.action = None
    for b in arm.pose.bones: b.matrix_basis = Matrix()
    bpy.context.view_layer.update()

    print(f'{art}: Lage der Quelle {datei} suchen')
    fehler, t, grad = lage_finden(weltecken(netze), weltecken([modell]))
    wurzeln = [o for o in bpy.context.scene.objects if o.parent is None and o is not modell]
    for o in wurzeln:
        o.matrix_world = t @ o.matrix_world
    bpy.context.view_layer.update()
    print(f'  gewählt {grad}°, mittlerer Abstand {fehler * 100:.1f} cm')

    # Quellnetze vereinen, dann Gewichte aufs Modell übertragen.
    bpy.ops.object.select_all(action='DESELECT')
    for o in netze: o.select_set(True)
    bpy.context.view_layer.objects.active = netze[0]
    if len(netze) > 1:
        bpy.ops.object.join()
    quelle = bpy.context.view_layer.objects.active
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = modell
    modell.select_set(True)
    dt = modell.modifiers.new('gewichte', 'DATA_TRANSFER')
    dt.object = quelle
    dt.use_object_transform = True
    dt.use_vert_data = True
    dt.data_types_verts = {'VGROUP_WEIGHTS'}
    dt.vert_mapping = 'POLYINTERP_NEAREST'
    dt.layers_vgroup_select_src = 'ALL'
    dt.layers_vgroup_select_dst = 'NAME'
    bpy.ops.object.datalayout_transfer(modifier=dt.name)
    bpy.ops.object.modifier_apply(modifier=dt.name)
    gruppen = len(modell.vertex_groups)
    bpy.data.objects.remove(quelle, do_unlink=True)

    # Ans Skelett hängen.
    am = modell.modifiers.new('skelett', 'ARMATURE')
    am.object = arm
    welt = modell.matrix_world.copy()
    modell.parent = arm
    modell.matrix_parent_inverse = arm.matrix_world.inverted()
    modell.matrix_world = welt

    # Material neu: Vertexfarbe als Grundfarbe, damit COLOR_0 mitgeht.
    m = modell.data
    farbname = m.color_attributes[0].name if m.color_attributes else 'Color'
    m.materials.clear()
    mat = bpy.data.materials.new(f'kampftier_{art}')
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 1.0
    kn = mat.node_tree.nodes.new('ShaderNodeVertexColor'); kn.layer_name = farbname
    mat.node_tree.links.new(kn.outputs['Color'], bsdf.inputs['Base Color'])
    m.materials.append(mat)

    # Nur die Clips, die der Kampf spielt.
    def kurz(n): return n.split('|')[-1]
    for tr in list(ad.nla_tracks):
        if not any(st.action and kurz(st.action.name) in clips for st in tr.strips):
            ad.nla_tracks.remove(tr)
        else:
            tr.mute = False
    # Die Quelle bringt jeden Clip zweimal mit (einmal je Netz der Paketdatei) — nur einer bleibt,
    # sonst exportiert Blender `Attack` und `Attack.001`, und das JSON verdoppelt sich.
    behalten = {}
    for a in bpy.data.actions:
        k = kurz(a.name)
        if k in clips and (k not in behalten or len(list(a.fcurves if hasattr(a, 'fcurves') else [])) > 0 and k not in behalten):
            behalten.setdefault(k, a)
    for tr in list(ad.nla_tracks):
        if any(st.action and behalten.get(kurz(st.action.name)) is not st.action for st in tr.strips):
            ad.nla_tracks.remove(tr)
    for a in list(bpy.data.actions):
        if behalten.get(kurz(a.name)) is not a:
            bpy.data.actions.remove(a)
    for k, a in behalten.items():
        a.name = k
    for k, a in behalten.items():
        if not any(st.action is a for tr in ad.nla_tracks for st in tr.strips):
            tr = ad.nla_tracks.new(); tr.name = k
            st = tr.strips.new(k, int(a.frame_range[0]), a)
            if hasattr(st, 'action_slot') and a.slots:
                st.action_slot = a.slots[0]
    fehlend = [c for c in clips if c not in {a.name for a in bpy.data.actions}]
    if fehlend:
        raise SystemExit(f'{art}: Clips fehlen in der Quelle: {fehlend}')

    bpy.ops.object.select_all(action='SELECT')
    aus = f'{ZIEL}/{art}.glb'
    opts = dict(filepath=aus, export_format='GLB', use_selection=True, export_apply=False,
                export_normals=False, export_texcoords=False, export_materials='EXPORT', export_yup=True,
                export_skins=True, export_animations=True, export_optimize_animation_size=True)
    try:
        bpy.ops.export_scene.gltf(**opts)
    except TypeError:
        opts.pop('export_optimize_animation_size', None)
        bpy.ops.export_scene.gltf(**opts)
    kb = os.path.getsize(aus) / 1024
    register[art] = {'kb': round(kb, 1), 'clips': sorted(clips), 'quelle': datei, 'abstand_cm': round(fehler * 100, 2)}
    print(f'{art}: {gruppen} Gewichtsgruppen, {len(arm.data.bones)} Knochen, {len(clips)} Clips, {kb:.0f} KB → {aus}')

json.dump(register, open(f'{ZIEL}/register.json', 'w'), indent=1, ensure_ascii=False)
