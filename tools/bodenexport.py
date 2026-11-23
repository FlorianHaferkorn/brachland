"""
BRACHLAND — Zielboden (D448): das Gelände des Zielbilds als eigenes Stück fürs Spiel.

    SZENE_TERRAIN=.cache/blender/felsmulde/terrain.json \\
    blender --background <zielbild.blend> --python tools/bodenexport.py -- public/bauten-ziel felsmulde [radius] [groesse]

Anlass: Flo 22.11.2026, „die Wand, der Teich, der Boden … das muss 1:1 dem Zielbild entsprechen“. Der Spielboden
ist ein Shader auf dem 1-m-Raster, der Boden im Zielbild ein Scan-Mischmaterial (Poly Haven, CC0: forest_leaves,
forest_ground, brown_mud_leaves, mud_forest) mit echter Verschiebung. Statt das Material nachzubauen, wird es hier
gebacken — dieselben Texel wie im Render:

- Ein 25-cm-Raster im Kreis `radius` um die Terrassenmitte (−2, −1) folgt dem Grundnetz des Zielbild-Geländes
  (1-m-Raster, bilinear) und trägt dessen Vertexfarbe `Color` (die Mischmasken des Materials).
- Das Material `Boden` des Renders bleibt unverändert am Raster; es nutzt Objektkoordinaten, und das Raster steht wie
  das Gelände im Ursprung — also liegen alle Rauschen und Scans an derselben Stelle wie im Render.
- Gebacken: Grundfarbe (DIFFUSE, nur Farbe, mit dem Mikro-AO des Materials), Normale im Tangentenraum (die
  Verschiebung als Relief, Methode BUMP), Rauheit. UV ist die Draufsicht, also ein Bild ohne Nähte.
- Export als GLB mit WebP; `register.json` im Zielordner bekommt `boden` (Radius, Mitte, Terrassenhöhe `zt` im
  Render), damit das Spiel das Stück auf seine Terrasse setzen kann.
"""
import bpy, bmesh, math, os, sys, json

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ZIEL = ARGS[0] if ARGS else 'public/bauten-ziel'
NAME = ARGS[1] if len(ARGS) > 1 else 'felsmulde'
RADIUS = float(ARGS[2]) if len(ARGS) > 2 else 30.0
GROESSE = int(ARGS[3]) if len(ARGS) > 3 else 4096
MITTE = (-2.0, -1.0)          # Terrassenmitte im Render (`szenenbau.py`: zt = bodenhoehe(-2, -1))
SCHRITT = 0.25
os.makedirs(ZIEL, exist_ok=True)
sc = bpy.context.scene
ter = bpy.data.objects['terrain']
# Alles andere weg: das Backen liest nur das Material, und der Grafikspeicher ist knapp (8 GB, D448 Export 137)
for o in [o for o in sc.objects if o is not ter and o.type in ('MESH', 'CURVE', 'CURVES', 'POINTCLOUD', 'VOLUME')]:
    bpy.data.objects.remove(o, do_unlink=True)
for m in list(bpy.data.meshes):
    if m.users == 0: bpy.data.meshes.remove(m)

# ---- Grundnetz als Raster lesen (321 × 321 Ecken, 1 m, Zeilen in y)
me = ter.data
n = len(me.vertices); seite = int(round(math.sqrt(n)))
assert seite * seite == n, 'Gelände ist kein Quadratraster'
co = [0.0] * (n * 3); me.vertices.foreach_get('co', co)
x0, y0 = min(co[0::3]), min(co[1::3]); dx = (max(co[0::3]) - x0) / (seite - 1)
# Reihenfolge der Ecken nicht annehmen: jede Ecke über ihre Lage in das Raster sortieren
ordnung = [0] * n
for v in range(n):
    i = int(round((co[v * 3] - x0) / dx)); j = int(round((co[v * 3 + 1] - y0) / dx))
    ordnung[j * seite + i] = v
hoehe = [co[ordnung[k] * 3 + 2] for k in range(n)]
attr = me.color_attributes.get('Color')
farbe = [1.0] * (n * 4)
if attr is not None:
    if attr.domain == 'POINT':
        attr.data.foreach_get('color', farbe)
    else:   # je Ecke: auf Punkte mitteln
        ecke = [0.0] * (len(attr.data) * 4); attr.data.foreach_get('color', ecke)
        vi = [0] * len(me.loops); me.loops.foreach_get('vertex_index', vi)
        summe = [0.0] * (n * 4); zahl = [0] * n
        for l, v in enumerate(vi):
            for k in range(4): summe[v * 4 + k] += ecke[l * 4 + k]
            zahl[v] += 1
        farbe = [summe[i] / max(1, zahl[i // 4]) for i in range(n * 4)]
farbe = [farbe[ordnung[k] * 4 + c] for k in range(n) for c in range(4)]

def bilinear(werte, x, y, k=1, kk=0):
    fx = (x - x0) / dx; fy = (y - y0) / dx
    i = min(max(int(math.floor(fx)), 0), seite - 2); j = min(max(int(math.floor(fy)), 0), seite - 2)
    u = fx - i; v = fy - j
    a = werte[(j * seite + i) * k + kk]; b = werte[(j * seite + i + 1) * k + kk]
    c = werte[((j + 1) * seite + i) * k + kk]; d = werte[((j + 1) * seite + i + 1) * k + kk]
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v

# ---- Raster im Kreis
bm = bmesh.new(); N = int(round(2 * RADIUS / SCHRITT)); idx = {}
for j in range(N + 1):
    for i in range(N + 1):
        x = MITTE[0] - RADIUS + i * SCHRITT; y = MITTE[1] - RADIUS + j * SCHRITT
        if math.hypot(x - MITTE[0], y - MITTE[1]) > RADIUS + SCHRITT: continue
        idx[(i, j)] = bm.verts.new((x, y, bilinear(hoehe, x, y)))
for j in range(N):
    for i in range(N):
        q = [idx.get(k) for k in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))]
        if all(q): bm.faces.new(q)
uvl = bm.loops.layers.uv.new('UVMap')
for f in bm.faces:
    f.smooth = True
    for l in f.loops:
        l[uvl].uv = ((l.vert.co.x - MITTE[0] + RADIUS) / (2 * RADIUS), (l.vert.co.y - MITTE[1] + RADIUS) / (2 * RADIUS))
netz = bpy.data.meshes.new('Zielboden'); bm.to_mesh(netz); bm.free()
fa = netz.color_attributes.new('Color', 'FLOAT_COLOR', 'POINT')
werte = []
for v in netz.vertices:
    werte += [bilinear(farbe, v.co.x, v.co.y, 4, k) for k in range(4)]
fa.data.foreach_set('color', werte)
boden = bpy.data.objects.new('Zielboden', netz); sc.collection.objects.link(boden)
mat = ter.data.materials[0]; netz.materials.append(mat)
zt = bilinear(hoehe, *MITTE)
print('ZIELBODEN', len(netz.vertices), 'Ecken', len(netz.polygons), 'Flächen, zt', round(zt, 3))

# ---- Backen
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'; prefs.get_devices()
    for d in prefs.devices: d.use = True
    sc.cycles.device = 'GPU'
except Exception as e:
    print('CPU:', e)
sc.render.engine = 'CYCLES'; sc.cycles.samples = 16; sc.cycles.use_denoising = False
sc.render.bake.margin = 16; sc.render.bake.use_clear = True
mat.displacement_method = 'BUMP'          # Verschiebung als Relief in die Normale, nicht in die Geometrie
nt = mat.node_tree
bpy.ops.object.select_all(action='DESELECT'); boden.select_set(True); bpy.context.view_layer.objects.active = boden
tmp = os.path.abspath(os.path.join(ZIEL, '.zielboden'))
os.makedirs(tmp, exist_ok=True)

def backe(art, groesse, farbraum, **kw):
    img = bpy.data.images.new('Zielboden_' + art, groesse, groesse, float_buffer=False)
    img.colorspace_settings.name = farbraum
    knoten = nt.nodes.new('ShaderNodeTexImage'); knoten.image = img
    for k in nt.nodes: k.select = False
    knoten.select = True; nt.nodes.active = knoten
    t = __import__('time').time()
    bpy.ops.object.bake(type=art, **kw)
    print('GEBACKEN', art, groesse, '%.0f s' % (__import__('time').time() - t))
    nt.nodes.remove(knoten)
    img.filepath_raw = os.path.join(tmp, art.lower() + '.png'); img.file_format = 'PNG'; img.save()
    return img

grund = backe('DIFFUSE', GROESSE, 'sRGB', pass_filter={'COLOR'})
normale = backe('NORMAL', GROESSE // 2, 'Non-Color', normal_space='TANGENT')
rau = backe('ROUGHNESS', GROESSE // 4, 'Non-Color')

# ---- Exportmaterial: drei Bilder, sonst nichts
aus = bpy.data.materials.new('Zielboden'); aus.use_nodes = True
an = aus.node_tree; p = an.nodes['Principled BSDF']
def bild(img, ziel, nicht_farbe=False):
    k = an.nodes.new('ShaderNodeTexImage'); k.image = img
    if nicht_farbe: img.colorspace_settings.name = 'Non-Color'
    return k
an.links.new(bild(grund, None).outputs['Color'], p.inputs['Base Color'])
nm = an.nodes.new('ShaderNodeNormalMap'); an.links.new(bild(normale, None, True).outputs['Color'], nm.inputs['Color'])
an.links.new(nm.outputs['Normal'], p.inputs['Normal'])
an.links.new(bild(rau, None, True).outputs['Color'], p.inputs['Roughness'])
p.inputs['Metallic'].default_value = 0.0
netz.materials.clear(); netz.materials.append(aus)
for a in [a for a in netz.color_attributes]: netz.color_attributes.remove(a)   # Farben sind gebacken
bpy.ops.object.select_all(action='DESELECT'); boden.select_set(True); bpy.context.view_layer.objects.active = boden
datei = os.path.abspath(os.path.join(ZIEL, NAME + '-boden.glb'))
bpy.ops.export_scene.gltf(filepath=datei, export_format='GLB', use_selection=True, export_apply=False,
                          export_image_format='WEBP', export_image_quality=88, export_texcoords=True, export_normals=True,
                          export_materials='EXPORT', export_yup=True)
print('GESCHRIEBEN', datei, os.path.getsize(datei) // 1024, 'KB')
regpfad = os.path.join(ZIEL, 'register.json')
reg = json.load(open(regpfad)) if os.path.exists(regpfad) else {'bauwerke': []}
for b in reg['bauwerke']:
    if b['name'] == NAME:
        b['boden'] = {'mitte': {'x': MITTE[0], 'y': MITTE[1]}, 'radius': RADIUS, 'zt': zt}
        if 'boden' not in b['dateien']: b['dateien'].append('boden')
json.dump(reg, open(regpfad, 'w'), indent=1)
print('REGISTER', regpfad)
