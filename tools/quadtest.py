"""Schlaegt Quad-Remeshing die Untergrenze des Simplifiers? (G-88)

Der Dezimierer kommt an den Fuchsmodellen nicht unter **3.194 Flaechen**, egal
welches Ziel und welche Fehlertoleranz man vorgibt. Grund ist die Topologie: Das
Fell ist als tausende separater Schalen modelliert, und deren Mindestflaechen
summieren sich. Ein Dezimierer kann Kanten nur kollabieren, nicht neu legen.

Ein **Quad-Remesher** legt die Topologie neu, statt sie abzutragen. Damit sollte
die Grenze fallen. Ob das an Fell wirklich funktioniert, ist die offene Frage aus
ADR-0002 (Nachtrag 20.08.2026) — dort steht SPAR3D als Werkzeug, weil es einen
Quad-Remesher mitbringt.

Dieses Skript testet nicht SPAR3D, sondern **den Mechanismus**, und zwar mit dem
Quadriflow, den Blender ohnehin mitbringt. Wenn Quadriflow an dieser Geometrie
scheitert, scheitert SPAR3Ds Remesher daran vermutlich auch, und dann sind 10 GB
Modellgewichte die falsche Investition. Wenn er es schafft, ist der Weg frei.

    blender --background --python tools/quadtest.py -- <ein.glb> <zielordner>
"""
import bpy
import sys
import os

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
QUELLE = argv[0]
ZIEL = argv[1] if len(argv) > 1 else '.cache/quadtest'
ZIELZAHLEN = [1500, 3000, 6000]

os.makedirs(ZIEL, exist_ok=True)


def saeubern():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for d in list(block):
            if d.users == 0:
                block.remove(d)


def lade():
    saeubern()
    bpy.ops.import_scene.gltf(filepath=QUELLE)
    netze = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if len(netze) > 1:
        bpy.context.view_layer.objects.active = netze[0]
        for o in netze:
            o.select_set(True)
        bpy.ops.object.join()
        netze = [bpy.context.view_layer.objects.active]
    o = netze[0]
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    return o


def zaehle(o):
    o.data.calc_loop_triangles()
    return len(o.data.polygons), len(o.data.loop_triangles), len(o.data.vertices)


def bestandsaufnahme(o):
    """Wie viele getrennte Teile hat das Netz, und ist es mannigfaltig?"""
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(o.data)
    offen = sum(1 for e in bm.edges if len(e.link_faces) < 2)
    nichtmannig = sum(1 for e in bm.edges if len(e.link_faces) > 2)
    # Zusammenhangskomponenten ueber eine einfache Flutung.
    gesehen, teile = set(), 0
    for v in bm.verts:
        if v.index in gesehen:
            continue
        teile += 1
        stapel = [v]
        gesehen.add(v.index)
        while stapel:
            w = stapel.pop()
            for e in w.link_edges:
                a = e.other_vert(w)
                if a.index not in gesehen:
                    gesehen.add(a.index)
                    stapel.append(a)
    bm.free()
    return teile, offen, nichtmannig


print('\n[quadtest] ' + '=' * 62)
o = lade()
f, t, v = zaehle(o)
teile, offen, nichtmannig = bestandsaufnahme(o)
print(f'[quadtest] Quelle: {os.path.basename(QUELLE)}')
print(f'[quadtest]   {f} Flaechen, {t} Dreiecke, {v} Vertices')
print(f'[quadtest]   {teile} getrennte Teile · {offen} offene Kanten · '
      f'{nichtmannig} nicht-mannigfaltige Kanten')
print('[quadtest] ' + '-' * 62)

# --- Quadriflow, das eigentliche Verfahren -------------------------------
for ziel in ZIELZAHLEN:
    o = lade()
    try:
        bpy.ops.object.quadriflow_remesh(
            mode='FACES', target_faces=ziel,
            use_mesh_symmetry=False, use_preserve_sharp=False,
            use_preserve_boundary=False, smooth_normals=False, seed=0)
        f, t, v = zaehle(o)
        teile, offen, nm = bestandsaufnahme(o)
        raus = os.path.join(ZIEL, f'quadriflow_{ziel}.glb')
        bpy.ops.export_scene.gltf(filepath=raus, export_format='GLB',
                                  use_selection=False)
        kb = os.path.getsize(raus) / 1024
        print(f'[quadtest] Quadriflow Ziel {ziel:>5}  ->  {f:>5} Flaechen, '
              f'{t:>5} Dreiecke, {teile} Teile, {kb:.0f} KB')
    except Exception as e:
        print(f'[quadtest] Quadriflow Ziel {ziel:>5}  ->  GESCHEITERT: {e}')

# --- Voxel-Remesh als Gegenprobe -----------------------------------------
#
# Quadriflow braucht halbwegs saubere Eingaben. Der Voxel-Remesher nicht: Er
# baut die Oberflaeche komplett neu aus einem Distanzfeld und liefert immer ein
# geschlossenes, mannigfaltiges Netz. Der Preis ist, dass duenne Teile
# verschwinden oder zusammenwachsen — bei Fell genau die Frage.
for groesse in [0.02, 0.035, 0.05]:
    o = lade()
    try:
        o.data.remesh_voxel_size = groesse
        o.data.remesh_voxel_adaptivity = 0.0
        bpy.ops.object.voxel_remesh()
        f, t, v = zaehle(o)
        teile, offen, nm = bestandsaufnahme(o)
        raus = os.path.join(ZIEL, f'voxel_{int(groesse*1000)}.glb')
        bpy.ops.export_scene.gltf(filepath=raus, export_format='GLB',
                                  use_selection=False)
        kb = os.path.getsize(raus) / 1024
        print(f'[quadtest] Voxel {groesse:.3f} m       ->  {f:>5} Flaechen, '
              f'{t:>5} Dreiecke, {teile} Teile, {kb:.0f} KB')
    except Exception as e:
        print(f'[quadtest] Voxel {groesse:.3f} m       ->  GESCHEITERT: {e}')

print('[quadtest] ' + '=' * 62 + '\n')
