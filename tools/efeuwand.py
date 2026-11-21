# BRACHLAND — Machbarkeitsprobe (D356): prozeduraler Efeu an einer Putzwand, Blender 5.3 headless, Cycles CPU.
# Aufruf: blender --background --python tools/efeuwand.py -- .cache/bilder/blender-probe/efeuwand.png
# Blätter in echter Grösse (4–12 cm, content/massstab.json), Triebe als verzweigte Zufallswanderung. Kein Spielasset.
import bpy, bmesh, math, random, sys
from mathutils import Vector, Euler

aus = sys.argv[sys.argv.index('--') + 1]
random.seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True)
sz = bpy.context.scene

# --- Wand 5 x 4 m (x/z), Fenster ausgespart, Putz prozedural
bm = bmesh.new()
bmesh.ops.create_grid(bm, x_segments=50, y_segments=40, size=1)
bmesh.ops.scale(bm, vec=(2.5, 2.0, 1), verts=bm.verts)
bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Euler((math.pi / 2, 0, 0)).to_matrix(), verts=bm.verts)
bmesh.ops.translate(bm, vec=(0, 0, 2.0), verts=bm.verts)
loch = [f for f in bm.faces if 2.2 < f.calc_center_median().z < 3.4 and 0.4 < f.calc_center_median().x < 1.5]
bmesh.ops.delete(bm, geom=loch, context='FACES')
wand = bpy.data.objects.new('Wand', bpy.data.meshes.new('Wand')); bm.to_mesh(wand.data); bm.free()
sz.collection.objects.link(wand)
m = bpy.data.materials.new('Putz'); m.use_nodes = True; nt = m.node_tree
bsdf = nt.nodes['Principled BSDF']
noise = nt.nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 3.0; noise.inputs['Detail'].default_value = 12
ramp = nt.nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].color = (0.38, 0.35, 0.30, 1); ramp.color_ramp.elements[1].color = (0.70, 0.66, 0.58, 1)
nt.links.new(noise.outputs['Fac'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.35
n2 = nt.nodes.new('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value = 60; n2.inputs['Detail'].default_value = 8
nt.links.new(n2.outputs['Fac'], bump.inputs['Height']); nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
bsdf.inputs['Roughness'].default_value = 0.9
wand.data.materials.append(m)
# Fensterlaibung dunkel
fen = bpy.data.objects.new('Fenster', bpy.data.meshes.new('F')); bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1); bmesh.ops.scale(bm, vec=(1.1, 0.3, 1.2), verts=bm.verts)
bmesh.ops.translate(bm, vec=(0.95, 0.2, 2.8), verts=bm.verts); bm.to_mesh(fen.data); bm.free()
mf = bpy.data.materials.new('Glas'); mf.use_nodes = True; mf.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.02, 0.02, 0.025, 1)
fen.data.materials.append(mf); sz.collection.objects.link(fen)
# Boden
bpy.ops.mesh.primitive_plane_add(size=20, location=(0, -5, 0))
mb = bpy.data.materials.new('Boden'); mb.use_nodes = True; mb.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.12, 0.14, 0.07, 1)
bpy.context.object.data.materials.append(mb)

# --- Efeublatt: fünflappig, leicht gewölbt, Länge 1 (skaliert auf 4–12 cm)
form = [(0, -.44), (-.32, -.38), (-.45, -.15), (-.56, .13), (-.24, .16), (0, .68), (.23, .18), (.55, .20), (.43, -.15), (.29, -.40)]
bm = bmesh.new()
mitte = bm.verts.new((0, 0.04, 0))
rand = [bm.verts.new((u, -0.06 * (u * u) * 4 + 0.03 * abs(v), v)) for u, v in form]
for i in range(len(rand)):
    bm.faces.new((mitte, rand[i], rand[(i + 1) % len(rand)]))
blatt = bpy.data.objects.new('Blatt', bpy.data.meshes.new('Blatt')); bm.to_mesh(blatt.data); bm.free()
sz.collection.objects.link(blatt); blatt.hide_render = True; blatt.hide_viewport = True
ml = bpy.data.materials.new('Laub'); ml.use_nodes = True; nt = ml.node_tree; b = nt.nodes['Principled BSDF']
attr = nt.nodes.new('ShaderNodeAttribute'); attr.attribute_name = 'ton'; attr.attribute_type = 'INSTANCER'
r2 = nt.nodes.new('ShaderNodeValToRGB')
r2.color_ramp.elements[0].color = (0.035, 0.06, 0.02, 1); r2.color_ramp.elements[1].color = (0.13, 0.19, 0.06, 1)
nt.links.new(attr.outputs['Fac'], r2.inputs['Fac']); nt.links.new(r2.outputs['Color'], b.inputs['Base Color'])
b.inputs['Roughness'].default_value = 0.35
b.inputs['Transmission Weight'].default_value = 0.0
b.inputs['Subsurface Weight'].default_value = 0.15
blatt.data.materials.append(ml)

# --- Triebe: Zufallswanderung auf der Wand, verzweigt; Blätter an den Knoten, Polster mit Tiefe
punkte, rot, skal, ton = [], [], [], []
def trieb(x, z, laenge, tiefe0):
    rx = 0.0
    for k in range(int(laenge / 0.04)):
        rx += random.uniform(-0.45, 0.45); rx *= 0.93
        x += math.sin(rx) * 0.04; z += math.cos(rx) * 0.04
        if not (-2.45 < x < 2.45 and 0 < z < 3.95): return
        if 2.15 < z < 3.45 and 0.35 < x < 1.55: return  # Fenster frei
        if random.random() < 0.05: trieb(x, z, laenge * 0.55, tiefe0)
        hoehe = z / 4.0
        for _ in range(random.randint(3, 6)):
            l = 0.04 + 0.08 * random.random() ** 1.6 * (1 - 0.4 * hoehe)
            dx, dz = random.gauss(0, 0.07), random.gauss(0, 0.06)
            vor = tiefe0 + abs(random.gauss(0, 0.07))
            punkte.append(Vector((x + dx, -vor, z + dz)))
            # Spreite zum Licht: Normale nach aussen, Spitze nach unten-aussen gekippt
            rot.append(Euler((math.radians(-90 + random.uniform(-35, 50)), random.uniform(-0.6, 0.6), random.uniform(-0.9, 0.9))))
            skal.append(l); ton.append(min(1, vor / 0.22 + random.uniform(-0.2, 0.2)))
for _ in range(14):
    trieb(random.uniform(-2.3, 2.3), 0.02, random.uniform(2.0, 7.0), 0.02)

me = bpy.data.meshes.new('Blattpunkte'); me.from_pydata([tuple(p) for p in punkte], [], [])
me.attributes.new('rot', 'FLOAT_VECTOR', 'POINT').data.foreach_set('vector', [c for e in rot for c in (e.x, e.y, e.z)])
me.attributes.new('s', 'FLOAT', 'POINT').data.foreach_set('value', skal)
me.attributes.new('ton', 'FLOAT', 'POINT').data.foreach_set('value', ton)
laub = bpy.data.objects.new('Efeu', me); sz.collection.objects.link(laub)
gn = laub.modifiers.new('Efeu', 'NODES'); g = bpy.data.node_groups.new('Efeu', 'GeometryNodeTree'); gn.node_group = g
g.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
g.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
N = g.nodes; L = g.links
ein, aus_ = N.new('NodeGroupInput'), N.new('NodeGroupOutput')
pts = N.new('GeometryNodeMeshToPoints')
inst = N.new('GeometryNodeInstanceOnPoints')
oi = N.new('GeometryNodeObjectInfo'); oi.inputs['Object'].default_value = blatt
nr = N.new('GeometryNodeInputNamedAttribute'); nr.data_type = 'FLOAT_VECTOR'; nr.inputs['Name'].default_value = 'rot'
ns = N.new('GeometryNodeInputNamedAttribute'); ns.data_type = 'FLOAT'; ns.inputs['Name'].default_value = 's'
L.new(ein.outputs[0], pts.inputs['Mesh']); L.new(pts.outputs[0], inst.inputs['Points'])
L.new(oi.outputs['Geometry'], inst.inputs['Instance']); L.new(nr.outputs['Attribute'], inst.inputs['Rotation'])
L.new(ns.outputs['Attribute'], inst.inputs['Scale']); L.new(inst.outputs[0], aus_.inputs[0])

# --- Licht, Kamera, Cycles CPU
welt = bpy.data.worlds.new('Himmel'); sz.world = welt; welt.use_nodes = True
himmel = welt.node_tree.nodes.new('ShaderNodeTexSky')
welt.node_tree.links.new(himmel.outputs[0], welt.node_tree.nodes['Background'].inputs[0])
welt.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.25
sonne = bpy.data.objects.new('Sonne', bpy.data.lights.new('Sonne', 'SUN')); sz.collection.objects.link(sonne)
sonne.data.energy = 2.2; sonne.data.angle = math.radians(3); sonne.rotation_euler = Euler((math.radians(55), 0, math.radians(-35)))
cam = bpy.data.objects.new('Kamera', bpy.data.cameras.new('Kamera')); sz.collection.objects.link(cam); sz.camera = cam
cam.location = (0.6, -5.2, 1.8); cam.rotation_euler = Euler((math.radians(86), 0, math.radians(4))); cam.data.lens = 32
sz.render.engine = 'CYCLES'; sz.cycles.device = 'CPU'; sz.cycles.samples = 48; sz.cycles.use_denoising = True
sz.render.resolution_x, sz.render.resolution_y = 1280, 720
sz.view_settings.view_transform = 'AgX'; sz.view_settings.exposure = -1.2
sz.render.filepath = aus
print('BLAETTER', len(punkte))
bpy.ops.wm.save_as_mainfile(filepath=aus.replace('.png', '.blend'))
bpy.ops.render.render(write_still=True)
