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
             'Speer_Stand', 'Speer_Stoss', 'Speer_Weit', 'Speer_Lauf', 'Speer_Block']
# Altes Skelett → neues (Umkehrung der Karte in ual2uebertrag.py).
ALT_KARTE = [
    ('Body', 'pelvis'),
    ('Abdomen', 'spine_01'), ('Torso', 'spine_02'), ('Chest', 'spine_03'),
    ('Neck', 'neck_01'), ('Head', 'Head'),
    ('Shoulder.L', 'clavicle_l'), ('UpperArm.L', 'upperarm_l'), ('LowerArm.L', 'lowerarm_l'), ('Wrist.L', 'hand_l'),
    ('Shoulder.R', 'clavicle_r'), ('UpperArm.R', 'upperarm_r'), ('LowerArm.R', 'lowerarm_r'), ('Wrist.R', 'hand_r'),
    ('UpperLeg.L', 'thigh_l'), ('LowerLeg.L', 'calf_l'), ('Foot.L', 'foot_l'),
    ('UpperLeg.R', 'thigh_r'), ('LowerLeg.R', 'calf_r'), ('Foot.R', 'foot_r'),
]
FINGER = [f'{f}_0{i}_{s}' for s in 'lr' for f in ('index', 'middle', 'pinky', 'ring', 'thumb') for i in (1, 2, 3)]


def importiere(pfad):
    vor = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=pfad)
    return [o for o in bpy.data.objects if o not in vor]


def welt3(arm, m3):
    return arm.matrix_world.to_3x3().normalized() @ m3


def setze(arm, pb, dreh_welt, kopf_welt=None):
    rot = arm.matrix_world.to_3x3().normalized()
    m = (rot.inverted() @ dreh_welt).to_4x4()
    m.translation = (arm.matrix_world.inverted() @ kopf_welt) if kopf_welt is not None else pb.matrix.translation
    pb.matrix = m
    bpy.context.view_layer.update()


# D187: Zweihändige Clips — die linke Hand gehört an den Stiel. Die Weltformel überträgt Drehungen;
# bei anderen Armlängen landet die linke Hand dann neben dem Schaft (gemessen bis ~9 cm). Also nach
# jedem Bild: linke Hand per Zwei-Knochen-IK auf den Punkt, den sie in der Quelle relativ zur rechten
# hatte (skaliert mit der Körpergrösse), Ellbogenebene und Handdrehung bleiben.
ZWEIHAND = ('Axt_', 'Speer_')
GREIF_FEHLER = []


def greife_links(quelle, ziel, s):
    bpy.context.view_layer.update()
    zw, qw = ziel.matrix_world, quelle.matrix_world
    zpb, qpb = ziel.pose.bones, quelle.pose.bones
    soll = zw @ zpb['hand_r'].head + (qw @ qpb['Wrist.L'].head - qw @ qpb['Wrist.R'].head) * s
    ua, la, ha = zpb['upperarm_l'], zpb['lowerarm_l'], zpb['hand_l']
    vorher = (zw @ ha.head - soll).length
    hand_rot = (zw @ ha.matrix).to_3x3().normalized()
    rot_w = zw.to_3x3().normalized()

    def drehe(pb, von, nach):
        q = von.rotation_difference(nach)
        r_a = rot_w.inverted() @ q.to_matrix() @ rot_w
        kopf = pb.matrix.to_translation()
        pb.matrix = Matrix.Translation(kopf) @ r_a.to_4x4() @ Matrix.Translation(-kopf) @ pb.matrix
        bpy.context.view_layer.update()

    S, E, H = zw @ ua.head, zw @ la.head, zw @ ha.head
    a, b = (E - S).length, (H - E).length
    ziel_d = soll - S
    d = min(ziel_d.length, a + b - 1e-4)
    rich = ziel_d.normalized()
    pol = (E - S) - rich * (E - S).dot(rich)
    pol = pol.normalized() if pol.length > 1e-6 else Vector((0, 0, -1))
    x = (a * a - b * b + d * d) / (2 * d)
    E2 = S + rich * x + pol * math.sqrt(max(0.0, a * a - x * x))
    drehe(ua, E - S, E2 - S)
    E, H = zw @ la.head, zw @ ha.head
    drehe(la, H - E, soll - E)
    # Die Hand behält ihre Weltdrehung — sie greift, wie sie in der Quelle griff.
    kopf = ha.matrix.to_translation()
    ha.matrix = Matrix.Translation(kopf) @ (rot_w.inverted() @ hand_rot).to_4x4()
    bpy.context.view_layer.update()
    GREIF_FEHLER.append((vorher, (zw @ ha.head - soll).length))


def uebertrage(quelle, ziel, clips, karte, becken, griff=None, seiten=None):
    """Weltformel wie in ual2uebertrag.py, allgemein: `clips` = {Name: [(Action, f0, f1)]},
    `karte` = [(Quellknochen, Zielknochen)] Eltern zuerst, `becken` = (Quelle, Ziel) für die
    Verschiebung. `griff` = {Fingerknochen: Quaternion} bleibt in jedem Bild stehen."""
    qad = quelle.animation_data
    zad = ziel.animation_data or ziel.animation_data_create()
    zpb, qpb = ziel.pose.bones, quelle.pose.bones
    for b in list(zpb) + list(qpb): b.matrix_basis = Matrix()
    qad.action = None
    bpy.context.view_layer.update()
    # Beide Skelette müssen in der Welt gleich stehen, sonst wird aus einem Schritt nach vorn ein
    # Grätschen (im Bild gefunden, D175: die alte Wanderin steht in ihrer .blend um 90° gedreht).
    # Ausgerichtet wird über die Schulterlinie links→rechts, nur um die Hochachse.
    ziel_vorher = ziel.matrix_world.copy()
    if seiten:
        ql, qr, zl, zr, qu0, qu1, zu0, zu1 = seiten
        def basis(arm, l, r, u0, u1):
            wp = lambda n: arm.matrix_world @ arm.data.bones[n].head_local
            x = (wp(l) - wp(r)).normalized()
            up = (wp(u1) - wp(u0)); up = (up - x * up.dot(x)).normalized()
            m = Matrix((x, up, x.cross(up))).transposed()
            return m
        bq, bz = basis(quelle, ql, qr, qu0, qu1), basis(ziel, zl, zr, zu0, zu1)
        rot = bq @ bz.inverted()
        # Auf volle Vierteldrehungen einrasten: Die Ruhehaltungen neigen den Rumpf ein paar Grad, die
        # Achsen der Dateien stehen aber rechtwinklig zueinander (alte .blend: Y oben, 84° gemessen).
        qq = rot.to_quaternion()
        viertel = round(qq.angle / (math.pi / 2)) * (math.pi / 2)
        if abs(qq.angle - viertel) < 0.2:
            ax = Vector([round(v) for v in qq.axis]) if max(abs(v) for v in qq.axis) > 0.95 else qq.axis
            rot = Matrix.Rotation(viertel, 3, ax.normalized()) if viertel else Matrix.Identity(3)
        print(f'  Ausrichtung: Ziel um {math.degrees(rot.to_quaternion().angle):.1f}° gedreht, Achse {tuple(round(v, 2) for v in rot.to_quaternion().axis)}')
        ziel.matrix_world = rot.to_4x4() @ ziel.matrix_world
        bpy.context.view_layer.update()
    ruhe = {z: (welt3(quelle, quelle.data.bones[q].matrix_local.to_3x3()).inverted()
                @ welt3(ziel, ziel.data.bones[z].matrix_local.to_3x3())) for q, z in karte}
    qb, zb = becken
    q0 = quelle.matrix_world @ quelle.data.bones[qb].head_local
    z0 = ziel.matrix_world @ ziel.data.bones[zb].head_local
    s = z0.z / max(1e-6, q0.z)
    acts = {a.name.split('|')[-1]: a for a in bpy.data.actions}
    gebaut = {}
    for name, stuecke in clips.items():
        # Vorsilbe, bis die Quellen weg sind: Die alte Wanderin bringt Actions gleichen Namens mit
        # (Idle, Walk …) — sonst hiesse der neue Clip `Idle.001` und würde beim Aufräumen gelöscht.
        akt = bpy.data.actions.new('ZIEL__' + name)
        zad.action = akt
        bild, vorige = 1, {}
        for qn, f0, f1 in stuecke:
            a = acts[qn]
            qad.action = a
            if hasattr(qad, 'action_slot') and a.slots: qad.action_slot = a.slots[0]
            if f1 is None: f1 = int(a.frame_range[1])
            for f in range(f0, f1 + 1):
                bpy.context.scene.frame_set(f)
                for b in zpb: b.matrix_basis = Matrix()
                bpy.context.view_layer.update()
                if os.environ.get('SPUR') and f in (f0, f0 + 5) and karte[0][0] == 'Body':
                    print('    SPUR', name, qn, f, [round(x, 3) for x in qpb['UpperLeg.L'].matrix.to_quaternion()], qad.action and qad.action.name)
                for q, z in karte:
                    kopf = None
                    if z == zb:
                        kopf = z0 + (quelle.matrix_world @ qpb[qb].head - q0) * s
                    setze(ziel, zpb[z], welt3(quelle, qpb[q].matrix.to_3x3()) @ ruhe[z], kopf)
                if os.environ.get('SPUR') and f in (f0, f0 + 5) and karte[0][0] == 'Body':
                    print('    ZIEL', [round(x, 3) for x in zpb['thigh_l'].rotation_quaternion], zpb['thigh_l'].rotation_mode, len(zad.nla_tracks))
                if griff:
                    for k, qq in griff.items():
                        zpb[k].rotation_mode = 'QUATERNION'; zpb[k].rotation_quaternion = qq
                if name.startswith(ZWEIHAND) and 'Wrist.L' in qpb:
                    greife_links(quelle, ziel, s)
                for kn in zpb:
                    if kn.rotation_mode != 'QUATERNION': kn.rotation_mode = 'QUATERNION'
                    qq = kn.rotation_quaternion.copy()
                    if kn.name in vorige and qq.dot(vorige[kn.name]) < 0:
                        qq.negate(); kn.rotation_quaternion = qq
                    vorige[kn.name] = qq
                    kn.keyframe_insert('rotation_quaternion', frame=bild)
                    if kn.name == zb: kn.keyframe_insert('location', frame=bild)
                bild += 1
        zad.action = None
        tr = zad.nla_tracks.new(); tr.name = name
        st = tr.strips.new(name, 1, akt)
        if hasattr(st, 'action_slot') and akt.slots: st.action_slot = akt.slots[0]
        gebaut[name] = akt
        if name.startswith(ZWEIHAND) and GREIF_FEHLER:
            v = max(e[0] for e in GREIF_FEHLER); n = max(e[1] for e in GREIF_FEHLER)
            print(f'    Griff links: vorher bis {v * 100:.1f} cm neben dem Stiel, nachher bis {n * 100:.1f} cm')
            GREIF_FEHLER.clear()
        print(f'  CLIP {name}: {bild - 1} Bilder')
    for b in zpb: b.matrix_basis = Matrix()
    ziel.matrix_world = ziel_vorher
    return gebaut


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
