"""
Waffenmodelle der Wanderin (D173) aus dem Medieval Weapons Pack von Quaternius (CC0).

  blender --background --python tools/waffenbau.py -- .cache/waffenpack public/figuren/kampf/waffen.glb

Achsen wie `baueWaffen` in RegionsSzene: Griffmitte im Ursprung, Klinge/Stiel nach −Y (three),
Schneide der Axt nach −X. Das Paket steht in Blender entlang +Z, Schneide +X — also 180° um Y.
Masse in Metern: Schwert 0,9 m gesamt, Axt 1,0 m.
"""
import bpy, sys, math
from mathutils import Matrix, Vector

arg = sys.argv[sys.argv.index('--') + 1:]
PAKET, ZIEL = arg[0], arg[1]
# name im Spiel: (Datei, Griffmitte z im Paket, Länge in m)
# D178: meisterliche Stufe (Schmiede Stufe 3) — goldene Klinge, Doppelaxt. Der Stiel der Doppelaxt
# liegt im Paket bei x = 0,6, daher der vierte Wert (Griff x).
WAFFEN = {'Klinge': ('Sword', 0.0, 0.9, 0.0), 'Axt': ('Axe', -1.3, 1.0, 0.0),
          'Klinge3': ('Sword_Golden', 0.0, 0.95, 0.0), 'Axt3': ('Axe_Double', -2.5, 1.05, 0.6)}

bpy.ops.wm.read_factory_settings(use_empty=True)
for name, (datei, griff, laenge, griff_x) in WAFFEN.items():
    bpy.ops.wm.obj_import(filepath=f'{PAKET}/OBJ/{datei}.obj')
    teile = list(bpy.context.selected_objects)
    bpy.context.view_layer.objects.active = teile[0]
    if len(teile) > 1: bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = o.data.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    zs = [v.co.z for v in o.data.vertices]
    s = laenge / (max(zs) - min(zs))
    m = Matrix.Rotation(math.pi, 4, 'Y') @ Matrix.Scale(s, 4) @ Matrix.Translation((-griff_x, 0, -griff))
    o.data.transform(m)
    o.matrix_world = Matrix.Identity(4)
    for p in o.data.polygons: p.use_smooth = False
    print('WAFFE', name, len(o.data.vertices), 'Ecken', f'Massstab {s:.3f}')
# Gleiche Materialien beider OBJ zusammenlegen (Steel.001 → Steel).
for o in bpy.context.scene.objects:
    for i, m in enumerate(o.data.materials):
        basis = bpy.data.materials.get(m.name.split('.')[0])
        if basis: o.data.materials[i] = basis
bpy.ops.export_scene.gltf(filepath=ZIEL, export_format='GLB', export_yup=True,
                          export_materials='EXPORT', export_normals=True)
print('WAFFE geschrieben', ZIEL)
