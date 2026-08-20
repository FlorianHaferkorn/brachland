"""BRACHLAND — wie duenn darf ein Glied sein, damit der Voxel-Remesh es behaelt?

`voxelbau.py` (D81) baut die Oberflaeche aus einem Distanzfeld neu. Das
verschweisst 583 Fellschalen zu einem Koerper — und genau dieselbe Eigenschaft
frisst duenne Glieder: Was schmaler ist als das Gitter, hat im Distanzfeld
schlicht keine Zelle, in der es steht.

Am Fuchs war das kein Thema. Ein **Vogel** hat Schwingen, eine **Schlange** hat
einen langen duennen Koerper, und beide sind Archetypen des Spiels
(`assets/rigs/biped_bird.glb`, `serpent.glb`). Statt zu raten, ob es traegt,
misst dieses Skript die Grenze an einem Pruefkoerper mit **bekannten** Dicken:

    Torso 1,00 x 0,12 x 0,12 als Massstab und Anker
    sechs Platten  (Schwinge, Flosse, Kamm) — Dicke 0,005 … 0,060
    sechs Staebe   (Lauf, Rute, Schlangenleib) — Radius 0,005 … 0,060

Alle Angaben sind Anteile der laengsten Achse, weil `voxelbau.py` die
Voxelgroesse genauso bezieht. Nach dem Remesh wird je Merkmal geprueft, ob
ueberhaupt noch Geometrie ausserhalb des Torsos steht, wie weit sie reicht und
wie dick sie geworden ist.

    blender --background --python tools/voxelgrenze.py -- [voxel ...]

Ohne Argumente werden 0,027 (die Vorgabe aus D81 am Fuchs), 0,018 und 0,012
gemessen. Das Ergebnis ist eine Tabelle, keine Datei — es soll niemand etwas
bauen, sondern jemand eine Zahl bekommen.
"""
import bpy
import sys
from math import radians
from mathutils import Euler

# Der Pruefkoerper wird **schief** remeshed und danach zurueckgedreht.
#
# Achsparallel gemessen ueberlebt jede Dicke bis hinunter zu 0,005 bei Voxel
# 0,027 — also ein Fuenftel der Gitterweite, was unmoeglich ist. Der Grund ist
# der Pruefkoerper selbst: lauter achsparallele Quader, deren Flaechen exakt auf
# Gitterebenen liegen. Das ist der guenstigste denkbare Fall und sagt ueber eine
# gebogene Schwinge nichts. Diese Drehung nimmt ihm die Gunst; die Messung
# findet danach wieder im urspruenglichen Bezugssystem statt.
SCHIEF = Euler((radians(17), radians(9), radians(31)), 'XYZ').to_matrix().to_4x4()

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
# `--glb <ordner>` legt die remeshten Pruefkoerper zum Ansehen ab.
AUSGABE = None
if '--glb' in argv:
    i = argv.index('--glb')
    AUSGABE = argv[i + 1]
    argv = argv[:i] + argv[i + 2:]
GROESSEN = [float(a) for a in argv] or [0.027, 0.018, 0.012]

DICKEN = [0.005, 0.010, 0.020, 0.030, 0.045, 0.060]
TORSO = (1.00, 0.12, 0.12)      # X laengs, Y hoch, Z quer
AUSLADUNG = 0.22                # wie weit Platte und Stab herausstehen
BREITE = 0.09                   # Laenge der Platte in X


def sag(*t):
    print('[voxelgrenze]', *t)


def saeubern():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)


def nur(o):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o


def band(i):
    """X-Bereich, in dem Merkmal i sitzt — gleichmaessig ueber den Torso."""
    mitte = -TORSO[0] / 2 + TORSO[0] * (i + 1) / (len(DICKEN) + 1)
    return mitte - BREITE / 2, mitte + BREITE / 2


def pruefkoerper():
    """Torso plus Platten (+Z) und Staebe (-Z) in bekannten Dicken."""
    saeubern()
    teile = []

    # `primitive_cube_add(size=1)` spannt -0,5…0,5 — die Skalierung ist damit
    # die **Ausdehnung**, nicht die halbe. Hier stand einmal `/2`, und der
    # Pruefkoerper war ueberall halb so dick wie beschriftet.
    bpy.ops.mesh.primitive_cube_add(size=1)
    t = bpy.context.object
    t.scale = TORSO
    teile.append(t)

    for i, d in enumerate(DICKEN):
        a, b = band(i)
        # Platte: duenn in Z, steht nach +Z ab. Die Schwinge.
        bpy.ops.mesh.primitive_cube_add(size=1)
        p = bpy.context.object
        p.scale = (BREITE, d, AUSLADUNG)
        p.location = ((a + b) / 2, 0, TORSO[2] / 2 + AUSLADUNG / 2)
        teile.append(p)

        # Stab: rund, steht nach -Z ab. Der Lauf oder der Schlangenleib.
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=d / 2,
                                            depth=AUSLADUNG)
        s = bpy.context.object
        s.rotation_euler = (0, 0, 0)
        s.location = ((a + b) / 2, 0, -(TORSO[2] / 2 + AUSLADUNG / 2))
        teile.append(s)

    bpy.ops.object.select_all(action='DESELECT')
    for o in teile:
        o.select_set(True)
    bpy.context.view_layer.objects.active = teile[0]
    bpy.ops.object.join()
    k = bpy.context.view_layer.objects.active
    nur(k)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return k


def dreiecke(o):
    o.data.calc_loop_triangles()
    return len(o.data.loop_triangles)


def merkmal(mesh, i, richtung):
    """Was ist von Merkmal i uebrig? (Reichweite, Dicke) in Anteilen.

    Gezaehlt werden nur Vertices **jenseits** der Torsooberflaeche — was im
    Torso steckt, ist kein Glied mehr, sondern eine Beule.
    """
    a, b = band(i)
    grenze = TORSO[2] / 2 + 0.01
    tief, dick = [], []
    for v in mesh.vertices:
        if not (a - 0.02 <= v.co.x <= b + 0.02):
            continue
        z = v.co.z * richtung
        if z <= grenze:
            continue
        tief.append(z)
        dick.append(v.co.y)
    if not tief:
        return 0.0, 0.0
    return max(tief) - TORSO[2] / 2, max(dick) - min(dick)


for groesse in GROESSEN:
    k = pruefkoerper()
    vorher = dreiecke(k)
    k.data.transform(SCHIEF)
    k.data.remesh_voxel_size = groesse * TORSO[0]
    k.data.remesh_voxel_adaptivity = 0.0
    nur(k)
    bpy.ops.object.voxel_remesh()
    k.data.transform(SCHIEF.inverted())
    nachher = dreiecke(k)

    # Ausgabe zum Ansehen. Eine Tabelle sagt, wie **dick** etwas noch ist —
    # nicht, ob es noch nach einer Schwinge aussieht oder nur noch nach einem
    # Klumpen mit der richtigen Ausdehnung. Diese Sitzung hat dieselbe Falle
    # schon dreimal gestellt (G-85, G-89, G-97).
    if AUSGABE:
        bpy.ops.export_scene.gltf(
            filepath=f'{AUSGABE}/grenze_{int(groesse * 1000):03d}.glb',
            export_format='GLB', use_selection=True, export_materials='EXPORT')

    sag(f'Voxel {groesse:.3f} der laengsten Achse — {vorher} → {nachher} Dreiecke')
    print(f"    {'Vorgabe':>8}  {'Platte: Dicke':>14} {'Reichweite':>11}   "
          f"{'Stab: Dicke':>12} {'Reichweite':>11}")
    for i, d in enumerate(DICKEN):
        pr, pd = merkmal(k.data, i, +1)
        sr, sd = merkmal(k.data, i, -1)
        def z(wert, soll):
            if wert <= 0:
                return '      —'
            return f'{wert:7.3f}'
        print(f"    {d:8.3f}  {z(pd, d):>14} {z(pr, AUSLADUNG):>11}   "
              f"{z(sd, d):>12} {z(sr, AUSLADUNG):>11}"
              + ('   ← weg' if pd <= 0 and sd <= 0 else
                 '   ← Platte weg' if pd <= 0 else
                 '   ← Stab weg' if sd <= 0 else ''))
    print()
