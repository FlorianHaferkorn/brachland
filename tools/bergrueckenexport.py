"""Backt die vier gestalteten Fernrücken der Zielbild-Szene in ein gemeinsames, unbeleuchtetes GLB.

blender -b szene4.blend --python-exit-code 1 -P tools/bergrueckenexport.py -- felsmulde-bergruecken.glb
Die Positionen sind die lokalen Blender-Meter des Orts. Farbe und Luftperspektive sind wie im
Compositor des Zielbilds an die einzelnen Rücken gebunden. Die Spielkamera blendet sie am Ortsrand aus.
"""
import sys
from pathlib import Path

import bpy
from mathutils import Vector, noise

ziel = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
quellen = sorted(o.name for o in bpy.context.scene.objects if o.name.startswith('Ruecken4_') and o.type == 'MESH')
if len(quellen) != 4:
    raise ValueError(f'Vier Fernrücken erwartet, gefunden {quellen}')

# sRGB-Töne der entfernten Hänge im Zielbild Runde 4, vom nahen Wald bis zum fernen Grat.
palette = ((90, 82, 62), (105, 97, 79), (118, 111, 96), (131, 124, 111))
def linear(kanal):
    return ((kanal / 255 + 0.055) / 1.055) ** 2.4

punkte, farben, flaechen = [], [], []
for stufe, name in enumerate(quellen):
    quelle = bpy.data.objects[name]
    netz = quelle.data
    hoehe = netz.attributes['h'].data
    start = len(punkte)
    # Zwischen Kamm und Fuß vier Zwischenreihen für die ins Zielbild gebackenen Wald- und Wiesenflecken.
    spalten = {}
    for v in netz.vertices:
        p = quelle.matrix_world @ v.co
        spalten.setdefault(p.y, {})[round(hoehe[v.index].value)] = p
    # Das Zielbild glättet im Compositor ferne Silhouetten und Flecken über mehrere Pixel.
    # Kamm mit demselben begrenzten Fußabdruck abtasten, am Fuß die Quellhöhe behalten.
    sortiert = sorted(spalten.values(), key=lambda reihe: reihe[1].y)
    spaltenwahl = list(range(0, len(sortiert) - 1, 3)) + [len(sortiert) - 1]
    reihen = (-1.0, -.5, 0.0, .2, .4, .6, .8, 1.0)
    for i in spaltenwahl:
        reihe = sortiert[i]
        kamm = reihe[1].copy()
        umfeld = sortiert[max(0, i-4):i+5]
        kamm.z = sum(q[1].z for q in umfeld) / len(umfeld)
        for t in reihen:
            p = reihe[-1].lerp(reihe[0], t + 1) if t < 0 else reihe[0].lerp(kamm, t)
            punkte.append(tuple(p))
            skala = max(p.x, 1) / 90
            fleck = noise.fractal(Vector((p.y / skala * .55, p.z / skala, 6.2 + stufe)), 1, 2, 3)
            ton = 1.0 + fleck * (.105 - stufe * .022)
            farben.append(tuple(linear(kanal * ton) for kanal in palette[stufe]) + (1,))
    anzahl = len(reihen)
    for i in range(len(spaltenwahl) - 1):
        for j in range(anzahl - 1):
            a = start + i * anzahl + j
            flaechen.append((a, a + 1, a + anzahl + 1, a + anzahl))

netz = bpy.data.meshes.new('Fernrücken')
netz.from_pydata(punkte, [], flaechen)
farbe = netz.color_attributes.new(name='Luftperspektive', type='BYTE_COLOR', domain='POINT')
for eintrag, wert in zip(farbe.data, farben):
    eintrag.color = wert
objekt = bpy.data.objects.new('Fernrücken', netz)
bpy.context.collection.objects.link(objekt)
bpy.ops.object.select_all(action='DESELECT')
objekt.select_set(True)
bpy.context.view_layer.objects.active = objekt
bpy.ops.export_scene.gltf(filepath=str(ziel), use_selection=True, export_normals=False, export_texcoords=False,
                          export_materials='NONE', export_vertex_color='ACTIVE', export_all_vertex_colors=False,
                          export_animations=False)
print('FERNRÜCKEN', len(punkte), 'Punkte', len(flaechen), 'Vierecke', ziel)
