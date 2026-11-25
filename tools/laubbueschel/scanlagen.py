"""Lagen und Scan-Zuordnung der Bäume aus der geöffneten Blender-Zielbildszene, für scanbacken.mjs."""
import json
import sys
from pathlib import Path
import bpy

ziel = Path(sys.argv[sys.argv.index('--') + 1])
lagen = []
for o in bpy.context.scene.objects:
    if o.type != 'MESH' or not o.name.startswith('Baum'):
        continue
    art = next(m.name.split('_leaves')[0] for m in o.data.materials if m and '_leaves' in m.name)
    lagen.append(dict(name=o.name, art=art, matrix=[list(r) for r in o.matrix_world]))
if not lagen:
    raise ValueError('Die Szene enthält keine Baumobjekte.')
with ziel.open('x') as f:
    json.dump(lagen, f)
