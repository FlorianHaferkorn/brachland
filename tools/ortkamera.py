"""Blender-Zielbild mit der Kamera der Ortsakte rendern.

blender -b <ort.blend> --python-exit-code 1 -P tools/ortkamera.py -- <akte.json> <kamera> <neues.jpg>
"""
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def main():
    akte, name, ausgabe = sys.argv[sys.argv.index("--") + 1:]
    ziel = Path(ausgabe).resolve()
    if ziel.exists() or ziel.suffix.lower() != ".jpg":
        raise ValueError("Einen neuen JPG-Pfad angeben.")
    daten = json.loads(Path(akte).read_text())
    kamera = next(k for k in daten["kameras"] if k["name"] == name)
    szene = bpy.context.scene
    auge = szene.camera
    auge.location = kamera["ort"]
    auge.rotation_euler = (Vector(kamera["blick"]) - auge.location).to_track_quat("-Z", "Y").to_euler()
    auge.data.type = "PERSP"
    auge.data.sensor_fit = "HORIZONTAL"
    auge.data.sensor_width = kamera.get("sensor", 36)
    auge.data.lens = kamera["brennweite"]
    szene.render.resolution_x, szene.render.resolution_y = 1280, 720
    szene.render.resolution_percentage = 100
    szene.render.image_settings.file_format = "JPEG"
    szene.render.image_settings.quality = 95
    ziel.parent.mkdir(parents=True, exist_ok=True)
    szene.render.filepath = str(ziel)
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
