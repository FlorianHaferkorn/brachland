"""Leinenvorhang am offenen EG-Fenster des Wohngiebels 708. Eigene Geometrie.
blender -b --factory-startup -P tools/hofvorhang.py -- public/bauten/hof-708-vorhang.glb
"""
import math
import sys
from pathlib import Path

import bpy
import numpy as np

ausgabe = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# In Hausmetern im glTF-Achsensystem. Der Stock liegt bei x=.142… .223,
# das lichte Maß reicht von z=.77 bis 1.48 und von y=.85 bis 1.81.
def punkt(u, v, boee, zipfel):
    # Unterschiedlicher Zug an den Aufhängungen. Die Falten laufen schräg in
    # den Riss und werden zur freien Unterkante hin flacher.
    zug = math.sin(5.6 * u - .7) * (1 - math.cos(math.pi * v)) * 1.05
    phase = 7.8 * math.pi * u + .83 * math.sin(6.5 * u) + zug + v * v
    falte = math.sin(phase) + .17 * math.sin(2 * phase + 1.)
    querfalte = .017 * math.sin(8.2 * v + 5.1 * u) * math.sin(math.pi * v)
    riss = max(0, 1 - abs(u - .36) / .12)
    laenge = .90 - .31 * riss - .095 * u + .019 * math.sin(59 * u) + .012 * math.sin(93 * u)
    # Gebogene Fadenlinie mit konstanter Bogenlänge; die obere Reihe bleibt befestigt.
    winkel = .12 + boee * (1.22 - .54 * u) + zipfel * max(0, 1 - u / .42) * 1.48
    tiefe = .249 + (.035 - .014 * v) * falte * (1 - .32 * boee * v) + querfalte
    x = tiefe - laenge * (1 - math.cos(winkel * v)) / winkel
    y = 1.84 - .042 * math.sin(2 * math.pi * u) ** 2 - laenge * math.sin(winkel * v) / winkel
    z = .771 + .666 * u + .044 * v * math.sin(5.2 * u - .65) - .037 * zipfel * v * v
    return (x, -z, y)  # Blender Z ist oben.

spalten, reihen = 32, 14
uv = [(i / spalten, j / reihen) for j in range(reihen + 1) for i in range(spalten + 1)]
flaechen = []
for j in range(reihen):
    for i in range(spalten):
        a = j * (spalten + 1) + i
        flaechen.append((a, a + spalten + 1, a + spalten + 2, a + 1))
netz = bpy.data.meshes.new('Leinwand')
netz.from_pydata([punkt(u, v, 0, 0) for u, v in uv], [], flaechen)
netz.update()
obj = bpy.data.objects.new('Vorhang', netz)
bpy.context.collection.objects.link(obj)
# In den Stoff eingezogene Schmutzwasserlinie mit ungleich hohem Saum.
# Die Webstruktur ist gebacken und erhält beim Verkleinern die üblichen Mipstufen.
bildmass = 256
v, u = (np.indices((bildmass, bildmass)) + .5) / bildmass
rand = .84 + .064 * np.sin(8.7 * u) + .028 * np.sin(28 * u - .6)
schmutz = np.clip((v - rand + .12 * np.exp(-((u - .29) / .13) ** 2)) / .13, 0., 1.)
schmutz *= .57 + .32 * np.sin(5.2 * u + .3) ** 2
garn = 1 + .033 * np.sin(2 * np.pi * (78 * u + .13 * np.sin(26 * v))) + .029 * np.sin(2 * np.pi * 91 * v)
flecken = 1 - .17 * np.exp(-((u - .70) / .17) ** 2 - ((v - .66) / .22) ** 2)
flecken += .026 * np.sin(25 * u + 3 * np.cos(13 * v)) * np.sin(21 * v)
streifen = np.exp(-((u - .889) / .009) ** 2) + .66 * np.exp(-((u - .935) / .006) ** 2)
leinen = np.array([.76, .70, .60])
saum = np.array([.39, .36, .31])
ton = leinen + schmutz[:, :, None] * (saum - leinen) - streifen[:, :, None] * np.array([.22, .16, .09])
rgba = np.ones((bildmass, bildmass, 4), dtype=np.float32)
rgba[:, :, :3] = ton * (garn * flecken)[:, :, None]
bild = bpy.data.images.new('Leinenwebung', bildmass, bildmass, alpha=False)
bild.pixels.foreach_set(rgba.ravel())
bild.file_format = 'JPEG'
bild.pack()
karte = netz.uv_layers.new(name='Gewebe')
for schleife in netz.loops:
    karte.data[schleife.index].uv = uv[schleife.vertex_index]
for flaeche in netz.polygons:
    flaeche.use_smooth = True
material = bpy.data.materials.new('Altes Leinen')
material.use_nodes = True
bsdf = material.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Roughness'].default_value = .96
webfarbe = material.node_tree.nodes.new('ShaderNodeTexImage')
webfarbe.image = bild
material.node_tree.links.new(webfarbe.outputs['Color'], bsdf.inputs['Base Color'])
obj.data.materials.append(material)

obj.shape_key_add(name='Ruhe')
for name, boee, zipfel in [('Boe', 1, 0), ('Zipfel', 0, 1)]:
    pose = obj.shape_key_add(name=name)
    for i, (u, v) in enumerate(uv):
        pose.data[i].co = punkt(u, v, boee, zipfel)
bpy.ops.export_scene.gltf(filepath=str(ausgabe), export_format='GLB', export_animations=False,
                          export_morph=True, export_morph_normal=True, export_yup=True,
                          export_image_format='JPEG', export_image_quality=86)
