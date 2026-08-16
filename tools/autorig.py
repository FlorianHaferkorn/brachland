"""
BRACHLAND — Automatisches Rigging
Bindet ein generiertes Kreatur-Mesh an ein Archetyp-Rig und erbt dessen Animationen.

Aufruf (headless, ohne Blender-GUI):
    blender --background --python autorig.py -- <rig.glb> <mesh.glb> <out.glb> [--uniform]

Kernidee: Nicht das Mesh ans Skelett anpassen, sondern das **Skelett ans Mesh**.
Dadurch bleiben die Proportionen der Kreatur erhalten — der entscheidende
Qualitätsunterschied gegenüber naivem Einpassen.
"""
import bpy, sys, os
from mathutils import Vector

# ---------- Argumente ----------
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(argv) < 3:
    print("Aufruf: blender -b -P autorig.py -- <rig.glb> <mesh.glb> <out.glb> [--uniform]")
    sys.exit(1)
RIG, MESH, OUT = argv[0], argv[1], argv[2]
UNIFORM = "--uniform" in argv          # gleichmäßig skalieren statt pro Achse


def log(msg):
    print(f"[autorig] {msg}")


def world_bbox(objs):
    """Weltraum-Bounding-Box über mehrere Objekte."""
    pts = []
    for o in objs:
        if o.type == 'MESH':
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
        elif o.type == 'ARMATURE':
            for b in o.data.bones:
                pts.append(o.matrix_world @ b.head_local)
                pts.append(o.matrix_world @ b.tail_local)
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return mn, mx


# ---------- Szene leeren ----------
bpy.ops.wm.read_factory_settings(use_empty=True)

# ---------- Archetyp-Rig laden ----------
bpy.ops.import_scene.gltf(filepath=RIG)
armature = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
if armature is None:
    log("FEHLER: kein Armature im Rig gefunden"); sys.exit(1)

n_anims = len(bpy.data.actions)
log(f"Rig: {len(armature.data.bones)} Knochen, {n_anims} Animationen")

# Das Referenz-Mesh des Rigs (z. B. der Fuchs) wird nicht gebraucht
for o in list(bpy.data.objects):
    if o.type == 'MESH':
        bpy.data.objects.remove(o, do_unlink=True)

rig_min, rig_max = world_bbox([armature])
rig_size = rig_max - rig_min

# ---------- Kreatur-Mesh laden ----------
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=MESH)
meshes = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
if not meshes:
    log("FEHLER: kein Mesh in der Datei"); sys.exit(1)

# Mehrere Teile zu einem Objekt vereinen
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
mesh = bpy.context.view_layer.objects.active
log(f"Mesh: {len(mesh.data.polygons)} Flächen, {len(mesh.data.vertices)} Vertices")

# Transformationen einbacken (glTF trägt Skalierung oft im Node)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# ---------- Mesh-Hygiene (bessere automatische Gewichte) ----------
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=0.0001)   # doppelte Vertices verschweißen
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.mesh.delete_loose()
bpy.ops.object.mode_set(mode='OBJECT')
log(f"Nach Bereinigung: {len(mesh.data.polygons)} Flächen")

# ---------- Skelett an das Mesh anpassen (nicht umgekehrt!) ----------
m_min, m_max = world_bbox([mesh])
m_size = m_max - m_min

if UNIFORM:
    f = min(m_size[i] / rig_size[i] for i in range(3) if rig_size[i] > 1e-6)
    scale = Vector((f, f, f))
else:
    scale = Vector([(m_size[i] / rig_size[i]) if rig_size[i] > 1e-6 else 1.0 for i in range(3)])

armature.scale = scale
offset = (m_min + m_max) / 2 - Vector([((rig_min[i] + rig_max[i]) / 2) * scale[i] for i in range(3)])
armature.location = offset
bpy.context.view_layer.update()
log(f"Skelett skaliert auf {tuple(round(s, 2) for s in scale)}")

# ---------- Automatische Gewichte ----------
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True)
armature.select_set(True)
bpy.context.view_layer.objects.active = armature

try:
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')      # Heat-Map-Weights
    log("Automatische Gewichte: OK")
except RuntimeError as e:
    log(f"Heat-Map fehlgeschlagen ({e}) — Fallback auf Envelope")
    bpy.ops.object.parent_set(type='ARMATURE_ENVELOPE')

# Qualitätsprüfung: Vertices ohne Gewicht sind der typische Fehlerfall
unweighted = sum(1 for v in mesh.data.vertices if not v.groups)
pct = 100 * unweighted / max(1, len(mesh.data.vertices))
log(f"Vertices ohne Gewicht: {unweighted} ({pct:.1f} %)")
if pct > 5:
    log("WARNUNG: viele ungebundene Vertices — Mesh ist vermutlich nicht wasserdicht.")
    log("         Abhilfe: Remesh/Voxel-Remesh vor dem Rigging, oder Archetyp wechseln.")

# ---------- Export ----------
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True)
armature.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format='GLB',
    use_selection=True,
    export_animations=True,
    export_skins=True,
    export_apply=False,
)
size_mb = os.path.getsize(OUT) / 1048576
log(f"Export: {OUT} ({size_mb:.2f} MB, {n_anims} Animationen)")
