"""
BRACHLAND — Menschen aus den Universal Base Characters (D175, Quaternius, CC0).

  blender --background --python tools/heldbau.py -- public/figuren/held            (alles)
  blender --background --python tools/heldbau.py -- public/figuren/held m-waldlaeufer  (eine Gestalt)

Die alten Figuren (Quaternius Modular, 2 900 Dreiecke, Vertexfarben) tragen kein Gesicht. Die
Universal Base Characters haben eins — Augen, Brauen, Hautstruktur — und dasselbe Skelett wie die
Universal Animation Library 2 (UE-Mannequin, 65 Knochen). Gebaut wird je **Gestalt** (Körper ×
Kleidung) eine Datei:

  * Kopf und Hals vom Grundkörper (`Superhero_Male/Female`, nur die Vertices mit Gewicht ≥ 0,5 auf
    Head/neck_01) — der Rest steckt unter der Kleidung und stach durch (im Bild gefunden: die
    Kleidung ist für den schmaleren „Regular"-Körper geschnitten).
  * Kleidung aus den Modular Character Outfits (Fantasy): Waldläufer oder Bauer, samt der Hautteile
    (Arme), an dieselbe Armatur gebunden, auf `KLEID_DREIECKE` ausgedünnt.
  * Alle Frisuren und der Bart als eigene, versteckbare Netze (`Haar_*`) am Kopfknochen — die Szene
    zeigt die gewählte (Charakter-Editor).

Clips kommen in **eine** eigene Datei ohne Netz (`held-clips.glb`), für jede Gestalt gleich:
  * aus der UAL2 direkt (gleiches Skelett, trotzdem über die Weltformel, weil Knochenlängen abweichen);
  * aus der alten Wanderin (Idle, Gang, Rolle, Tod, Waffenhaltungen …) über die Weltformel von ihrem
    Skelett auf das neue — Quelle ist `.cache/wanderin_alt.blend` (menschbau.py mit SICHERN=…).
Die Finger der alten Clips (das alte Skelett hat keine) bekommen den Griff aus `Sword_Block`.
"""
import bpy, bmesh, sys, os, math, json
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ual2uebertrag import QUELLE as UAL2, CLIPS as UAL2_CLIPS
# D414: Weltformel, Karte und Fingerliste liegen in `weltformel.py` (geteilt mit `clipnachbau.py`).
from weltformel import ALT_KARTE, FINGER, GRIFF_ZWEI, uebertrage

ARGS = sys.argv[sys.argv.index('--') + 1:]
ZIEL = ARGS[0]
NUR = set(ARGS[1].split(',')) if len(ARGS) > 1 else None
UBC = '.cache/ubc/Universal Base Characters[Standard]'
OUT = '.cache/outfits/Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)'
ALT = '.cache/wanderin_alt.blend'
KLEID_DREIECKE = 9000

GESTALTEN = {
    'm-waldlaeufer': ('Superhero_Male_FullBody', 'Male_Ranger'),
    'm-bauer': ('Superhero_Male_FullBody', 'Male_Peasant'),
    'w-waldlaeufer': ('Superhero_Female_FullBody', 'Female_Ranger'),
    'w-bauer': ('Superhero_Female_FullBody', 'Female_Peasant'),
}
HAARE = ['Hair_Buzzed', 'Hair_BuzzedFemale', 'Hair_SimpleParted', 'Hair_Long', 'Hair_Buns', 'Hair_Beard']

# Clips aus der alten Wanderin: Name bleibt.
ALT_CLIPS = ['Idle', 'Walk', 'Run', 'Roll', 'Death', 'HitRecieve', 'Sword_Slash', 'Axe_Overhead',
             'Klinge_Stand', 'Klinge_Stich', 'Axt_Stand', 'Axt_Block', 'Axt_Quer', 'Axt_Schwer', 'Axt_Lauf',
             'Speer_Stand', 'Speer_Stoss', 'Speer_Weit', 'Speer_Lauf', 'Speer_Block',
             # D414: Langes Messer und Räucherkanne (gebaut ohne Quellpakete mit `clipnachbau.py`).
             'Messer_Stand', 'Messer_Quer_A', 'Messer_Quer_B', 'Messer_Schwer', 'Messer_Lauf', 'Messer_Block', 'Geraet_Blasebalg']


def importiere(pfad):
    vor = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=pfad)
    return [o for o in bpy.data.objects if o not in vor]


def nur_kopf(koerper_objs, schwelle=0.5):
    for o in koerper_objs:
        if o.type != 'MESH' or not o.vertex_groups: continue
        if o.name.lower().startswith(('eye', 'face')) and len(o.data.polygons) < 2000:
            continue  # Augen, Brauen
        kopf = {g.index for g in o.vertex_groups if g.name in ('Head', 'neck_01')}
        bm = bmesh.new(); bm.from_mesh(o.data)
        dl = bm.verts.layers.deform.active
        weg = [v for v in bm.verts if sum(w for gi, w in v[dl].items() if gi in kopf) < schwelle]
        bmesh.ops.delete(bm, geom=weg, context='VERTS'); bm.to_mesh(o.data); bm.free()
        o.name = 'Kopf'


def binde(objs, arm):
    """Netze aus einer anderen Datei an `arm` hängen (gleiche Knochennamen), fremde Armaturen weg."""
    for o in objs:
        if o.type == 'MESH':
            for m in o.modifiers:
                if m.type == 'ARMATURE': m.object = arm
            mw = o.matrix_world.copy(); o.parent = arm; o.matrix_world = mw
    for o in objs:
        if o.type == 'ARMATURE' and o != arm:
            bpy.data.objects.remove(o, do_unlink=True)
    for o in objs:
        try:
            if o.name in bpy.data.objects and o.type == 'EMPTY' and not o.children:
                bpy.data.objects.remove(o, do_unlink=True)
        except ReferenceError:
            pass


def aufraeumen():
    for o in list(bpy.data.objects):
        if o.type == 'MESH' and o.name.startswith('Icosphere'):
            bpy.data.objects.remove(o, do_unlink=True)


def duenne(objs, ziel_dreiecke):
    netze = [o for o in objs if o.type == 'MESH']
    summe = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in netze)
    r = min(1.0, ziel_dreiecke / max(1, summe))
    if r < 0.99:
        for o in netze:
            d = o.modifiers.new('duenn', 'DECIMATE'); d.ratio = r
            bpy.context.view_layer.objects.active = o
            # Vor den Armature-Modifikator schieben und anwenden.
            while o.modifiers[0] != d:
                bpy.ops.object.modifier_move_up(modifier='duenn')
            bpy.ops.object.modifier_apply(modifier='duenn')
    nach = sum(len(p.vertices) - 2 for o in netze for p in o.data.polygons)
    print(f'  Kleidung {summe} → {nach} Dreiecke (Anteil {r:.2f})')


def arm_von(objs):
    return next(o for o in objs if o.type == 'ARMATURE')


def blick_minus_z(arm):
    """Blender −Y (Gesicht der Pakete) → +Y, damit glTF nach −Z schaut wie die alten Figuren."""
    arm.matrix_world = Matrix.Rotation(math.pi, 4, 'Z') @ arm.matrix_world


def exportiere(pfad, animationen):
    bpy.ops.object.select_all(action='SELECT')
    opts = dict(filepath=pfad, export_format='GLB', use_selection=False, export_apply=False,
                export_materials='EXPORT', export_yup=True, export_skins=True,
                export_animations=animationen, export_force_sampling=True)
    if animationen:
        opts.update(export_nla_strips=True, export_optimize_animation_size=True)
    bpy.ops.export_scene.gltf(**opts)
    print(f'  → {pfad}: {os.path.getsize(pfad) / 1024:.0f} KB')


os.makedirs(ZIEL, exist_ok=True)
register = {}

# ---- Gestalten
# D176: je Gestalt auch eine leichte Fassung für Bewohner (`<gestalt>-leicht.glb`): Kleidung 3 500,
# Kopf 1 800, Haare halbiert; `heldpack.ts` legt ihre Texturen auf 512.
LEICHT = {'kleid': 3500, 'kopf': 1800, 'haar': 0.5}
FASSUNGEN = [(g, k, c, False) for g, (k, c) in GESTALTEN.items()] + [(g + '-leicht', k, c, True) for g, (k, c) in GESTALTEN.items()]
for gname, koerper, kleid, leicht in FASSUNGEN:
    if NUR and gname not in NUR: continue
    print('GESTALT', gname)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    k = importiere(f'{UBC}/Base Characters/Godot - UE/{koerper}.gltf')
    arm = arm_von(k)
    arm.name = 'Held'
    nur_kopf(k)
    if leicht:
        duenne([o for o in k if o.type == 'MESH' and o.name == 'Kopf'], LEICHT['kopf'])
    c = importiere(f'{OUT}/Outfits/{kleid}.gltf')
    kleidnetze = [o for o in c if o.type == 'MESH']
    binde(c, arm)
    duenne(kleidnetze, LEICHT['kleid'] if leicht else KLEID_DREIECKE)
    for h in HAARE:
        n = importiere(f'{UBC}/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/{h}.gltf')
        for o in n:
            if o.type == 'MESH': o.name = 'Haar_' + h.replace('Hair_', '')
        binde(n, arm)
        if leicht:
            netz = [o for o in bpy.data.objects if o.type == 'MESH' and o.name == 'Haar_' + h.replace('Hair_', '')]
            duenne(netz, int(sum(len(p.polygons) for p in [o.data for o in netz]) * LEICHT['haar']))
    aufraeumen()
    blick_minus_z(arm)
    dreiecke = sum(len(p.vertices) - 2 for o in bpy.data.objects if o.type == 'MESH' and not o.name.startswith('Haar_')
                   for p in o.data.polygons)
    pfad = f'{ZIEL}/{gname}.glb'
    exportiere(pfad, False)
    register[gname] = {'kb': round(os.path.getsize(pfad) / 1024, 1), 'dreiecke': dreiecke, 'koerper': koerper, 'kleid': kleid,
                       'haare': ['Haar_' + h.replace('Hair_', '') for h in HAARE]}
    print(f'  {gname}: {dreiecke} Dreiecke ohne Haar')

# ---- Clips (eine Datei für alle Gestalten)
if not NUR or 'clips' in NUR:
    print('CLIPS')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    k = importiere(f'{UBC}/Base Characters/Godot - UE/Superhero_Female_FullBody.gltf')
    ziel = arm_von(k)
    ziel.name = 'Held'
    for o in list(bpy.data.objects):
        if o != ziel: bpy.data.objects.remove(o, do_unlink=True)
    for a in list(bpy.data.actions): bpy.data.actions.remove(a)
    # 1. UAL2 (gleiches Skelett): alle gemeinsamen Knochen, Eltern zuerst.
    q = arm_von(importiere(UAL2))
    q.animation_data.action = None
    for tr in q.animation_data.nla_tracks: tr.mute = True
    gemeinsam = [(b.name, b.name) for b in ziel.data.bones if b.name in q.data.bones and b.name != 'root']
    # D176: Gruss (Nicken) und ruhiges Stehen (Arme verschränkt) für die Bewohner.
    extra = {'Gruss': [('Yes', 0, None)], 'Idle_Ruhig': [('Idle_FoldArms_Loop', 0, None)]}
    uebertrage(q, ziel, {**UAL2_CLIPS, **extra}, gemeinsam, ('pelvis', 'pelvis'), seiten=('upperarm_l', 'upperarm_r', 'upperarm_l', 'upperarm_r', 'pelvis', 'Head', 'pelvis', 'Head'))
    # Griff: Finger der rechten und linken Hand aus Sword_Block, Bild 10.
    acts = {a.name.split('|')[-1]: a for a in bpy.data.actions}
    q.animation_data.action = acts['Sword_Block']
    if hasattr(q.animation_data, 'action_slot') and acts['Sword_Block'].slots: q.animation_data.action_slot = acts['Sword_Block'].slots[0]
    bpy.context.scene.frame_set(10)
    griff = {f: q.pose.bones[f].matrix_basis.to_quaternion() for f in FINGER if f in q.pose.bones and f in ziel.pose.bones}
    # D188: Die linke Hand greift bei zweihändigen Waffen zu — Finger aus TreeChopping_Loop (Axt mit
    # beiden Händen), sonst stand sie bei Axt und Speer offen am Stiel.
    q.animation_data.action = acts['TreeChopping_Loop']
    if hasattr(q.animation_data, 'action_slot') and acts['TreeChopping_Loop'].slots: q.animation_data.action_slot = acts['TreeChopping_Loop'].slots[0]
    bpy.context.scene.frame_set(8)
    griff_zwei = {f: q.pose.bones[f].matrix_basis.to_quaternion() for f in FINGER if f.endswith('_l') and f in q.pose.bones and f in ziel.pose.bones}
    q.animation_data.action = None
    for o in [q] + list(q.children_recursive):
        bpy.data.objects.remove(o, do_unlink=True)
    # 2. Alte Wanderin. Sie schaut schon nach +Y (menschbau dreht sie); die Weltformel braucht beide
    #    Skelette gleich ausgerichtet — also das Ziel jetzt drehen, nicht erst am Ende.
    blick_minus_z(ziel)
    with bpy.data.libraries.load(os.path.abspath(ALT), link=False) as (von, nach):
        nach.objects = [n for n in von.objects]
        nach.actions = [n for n in von.actions]
    alt = next(o for o in nach.objects if o and o.type == 'ARMATURE')
    bpy.context.scene.collection.objects.link(alt)
    alt.animation_data_create()
    for tr in list(alt.animation_data.nla_tracks): alt.animation_data.nla_tracks.remove(tr)
    # Die alte Armatur hing unter einem Wurzelknoten mit Massstab — die Weltmatrix zählt, nicht die Eltern.
    alt.matrix_world = alt.matrix_world  # ohne Eltern verlinkt: Weltmatrix = eigene
    GRIFF_ZWEI.update(griff_zwei)
    uebertrage(alt, ziel, {n: [(n, 1, None)] for n in ALT_CLIPS}, ALT_KARTE, ('Body', 'pelvis'), griff,
               seiten=('UpperArm.L', 'UpperArm.R', 'upperarm_l', 'upperarm_r', 'Body', 'Head', 'pelvis', 'Head'))
    bpy.data.objects.remove(alt, do_unlink=True)
    for a in list(bpy.data.actions):
        if not a.name.startswith('ZIEL__'): bpy.data.actions.remove(a)
    for a in list(bpy.data.actions): a.name = a.name[len('ZIEL__'):]
    exportiere(f'{ZIEL}/held-clips.glb', True)

reg = f'{ZIEL}/register.json'
alt_reg = json.load(open(reg)) if os.path.exists(reg) else {}
alt_reg.update(register)
json.dump(alt_reg, open(reg, 'w'), indent=1, ensure_ascii=False)
