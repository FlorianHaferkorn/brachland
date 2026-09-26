"""
BRACHLAND — Clips der Universal Animation Library 2 auf die Wanderin übertragen (D173).

Die UAL2 (Quaternius, CC0, freie Fassung in `.cache/ual2/`) hat, was selbst gebaute Posen nicht
hergeben: Schwertschläge mit echtem Gewicht im Körper, einen Block, einen Rückstoss, ein Taumeln
nach gebrochener Deckung. Ihr Skelett ist ein anderes (UE-Mannequin, 65 Knochen) als das der
Wanderin (Quaternius Modular, 24 nach dem Fingerschnitt) — deshalb wird **übertragen**, nicht kopiert:

    Weltdrehung_Ziel(t) = Weltdrehung_Quelle(t) · Ruhe_Quelle⁻¹ · Ruhe_Ziel

Beide Skelette stehen in der Ruhe im T, blicken nach −Y, der rechte Arm zeigt nach −X
(nachgemessen, `.cache/ual2rest.py`) — die Drehung gegenüber der Ruhe bedeutet also bei beiden
dasselbe. Das Becken der Quelle (`pelvis`) führt `Body` der Wanderin, samt Verschiebung (skaliert
auf ihre Hüfthöhe). Die Füsse hängen bei der Wanderin an `Root`, nicht am Unterschenkel: Sie werden
nach der Beindrehung auf den Knöchel gesetzt, sonst schwebt der Fuss neben dem Bein.

Ein Zielclip darf aus mehreren Quellstücken bestehen: Schlag und Erholung liegen in der UAL2
getrennt (`Sword_Regular_A` + `Sword_Regular_A_Rec`); die Regel der Kette braucht einen Clip mit
Scheitel und Durchzug.
"""
import bpy
from mathutils import Matrix, Vector

QUELLE = '.cache/ual2/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb'

# Zielclip → Quellstücke (Action, erstes Bild, letztes Bild).
CLIPS = {
    'Klinge_U_A': [('Sword_Regular_A', 0, 10), ('Sword_Regular_A_Rec', 1, 23)],
    'Klinge_U_B': [('Sword_Regular_B', 0, 13), ('Sword_Regular_B_Rec', 1, 25)],
    'Klinge_U_C': [('Sword_Regular_C', 0, 48)],
    'Klinge_U_Lauf': [('Sword_Dash', 0, 38)],
    'Klinge_U_Block': [('Sword_Block', 0, 30)],
    'Kampf_Rueckstoss': [('Hit_Knockback', 0, 20)],
    'Kampf_Taumeln': [('Idle_Shield_Break', 0, 26)],
}
NAMEN = tuple(CLIPS)

# Quelle → Ziel, Eltern vor Kindern.
KARTE = [
    ('pelvis', 'Body'),
    ('spine_01', 'Abdomen'), ('spine_02', 'Torso'), ('spine_03', 'Chest'),
    ('neck_01', 'Neck'), ('Head', 'Head'),
    ('clavicle_l', 'Shoulder.L'), ('upperarm_l', 'UpperArm.L'), ('lowerarm_l', 'LowerArm.L'), ('hand_l', 'Wrist.L'),
    ('clavicle_r', 'Shoulder.R'), ('upperarm_r', 'UpperArm.R'), ('lowerarm_r', 'LowerArm.R'), ('hand_r', 'Wrist.R'),
    ('thigh_l', 'UpperLeg.L'), ('calf_l', 'LowerLeg.L'),
    ('thigh_r', 'UpperLeg.R'), ('calf_r', 'LowerLeg.R'),
]
FUESSE = [('foot_l', 'Foot.L', 'LowerLeg.L'), ('foot_r', 'Foot.R', 'LowerLeg.R')]


def _ruhe_welt(arm, name):
    """Weltdrehung (3×3, normiert) eines Knochens in der Ruhelage."""
    return arm.matrix_world.to_3x3().normalized() @ arm.data.bones[name].matrix_local.to_3x3()


def _welt(arm, pb):
    return arm.matrix_world.to_3x3().normalized() @ pb.matrix.to_3x3()


def _setze(arm, pb, dreh_welt, kopf_welt=None):
    rot = arm.matrix_world.to_3x3().normalized()
    m = (rot.inverted() @ dreh_welt).to_4x4()
    m.translation = (arm.matrix_world.inverted() @ kopf_welt) if kopf_welt is not None else pb.matrix.translation
    pb.matrix = m
    bpy.context.view_layer.update()


def uebertrage(ziel, nur=None):
    """Lädt die UAL2 in die Szene, überträgt `CLIPS` auf `ziel` (Armatur der Wanderin) als Actions
    mit NLA-Spur und räumt die Quelle wieder weg. Gibt {Clipname: Action} zurück."""
    vorher = set(bpy.data.objects)
    alte_actions = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=QUELLE)
    neu = [o for o in bpy.data.objects if o not in vorher]
    quelle = next(o for o in neu if o.type == 'ARMATURE')
    qad = quelle.animation_data
    for tr in qad.nla_tracks: tr.mute = True
    zad = ziel.animation_data or ziel.animation_data_create()
    stumm = [(tr, tr.mute) for tr in zad.nla_tracks]
    for tr in zad.nla_tracks: tr.mute = True
    zad.action = None
    qa = {a.name.split('|')[-1]: a for a in bpy.data.actions if a not in alte_actions}

    zpb, qpb = ziel.pose.bones, quelle.pose.bones
    for b in zpb: b.matrix_basis = Matrix()
    bpy.context.view_layer.update()
    ruhe = {z: (_ruhe_welt(quelle, q).inverted() @ _ruhe_welt(ziel, z)) for q, z in KARTE}
    fuss_ruhe = {z: (_ruhe_welt(quelle, q).inverted() @ _ruhe_welt(ziel, z)) for q, z, _ in FUESSE}
    q_becken0 = quelle.matrix_world @ quelle.data.bones['pelvis'].head_local
    z_body0 = ziel.matrix_world @ ziel.data.bones['Body'].head_local
    z_huefte0 = ziel.matrix_world @ ziel.data.bones['Hips'].head_local
    s = z_huefte0.z / max(1e-6, q_becken0.z)
    # Knöchel im Raum des Unterschenkels (Ruhe) — dort sitzt der Fusskopf.
    knoechel = {}
    for _, z, unter in FUESSE:
        m = ziel.matrix_world @ ziel.data.bones[unter].matrix_local
        knoechel[z] = (m.inverted() @ (ziel.matrix_world @ ziel.data.bones[z].head_local))

    gebaut = {}
    fps = bpy.context.scene.render.fps
    for name, stuecke in CLIPS.items():
        if nur and name not in nur:
            continue
        akt = bpy.data.actions.new(name)
        zad.action = akt
        bild = 1
        vorige = {}
        for q_name, f0, f1 in stuecke:
            a = qa[q_name]
            qad.action = a
            if hasattr(qad, 'action_slot') and a.slots: qad.action_slot = a.slots[0]
            for f in range(f0, f1 + 1):
                bpy.context.scene.frame_set(f)
                for b in zpb: b.matrix_basis = Matrix()
                bpy.context.view_layer.update()
                for q, z in KARTE:
                    dreh = _welt(quelle, qpb[q]) @ ruhe[z]
                    kopf = None
                    if z == 'Body':
                        q_becken = quelle.matrix_world @ qpb['pelvis'].head
                        kopf = z_body0 + (q_becken - q_becken0) * s
                    _setze(ziel, zpb[z], dreh, kopf)
                for q, z, unter in FUESSE:
                    m = ziel.matrix_world @ zpb[unter].matrix
                    _setze(ziel, zpb[z], _welt(quelle, qpb[q]) @ fuss_ruhe[z], m @ knoechel[z])
                for kn in zpb:
                    if kn.rotation_mode != 'QUATERNION': kn.rotation_mode = 'QUATERNION'
                    qq = kn.rotation_quaternion.copy()
                    if kn.name in vorige and qq.dot(vorige[kn.name]) < 0:
                        qq.negate(); kn.rotation_quaternion = qq
                    vorige[kn.name] = qq
                    kn.keyframe_insert('rotation_quaternion', frame=bild)
                    kn.keyframe_insert('location', frame=bild)
                bild += 1
        zad.action = None
        tr = zad.nla_tracks.new(); tr.name = name
        st = tr.strips.new(name, 1, akt)
        if hasattr(st, 'action_slot') and akt.slots: st.action_slot = akt.slots[0]
        tr.mute = True
        gebaut[name] = akt
        print(f'  UAL2 {name}: {bild - 1} Bilder ({(bild - 1) / fps:.2f} s) aus {", ".join(q for q, _, _ in stuecke)}')

    # Quelle wegräumen: Objekte und ihre Actions.
    for o in neu:
        bpy.data.objects.remove(o, do_unlink=True)
    for a in list(bpy.data.actions):
        if a not in alte_actions and a not in gebaut.values():
            bpy.data.actions.remove(a)
    for tr, m in stumm: tr.mute = m
    for tr in zad.nla_tracks: tr.mute = False
    for b in zpb: b.matrix_basis = Matrix()
    bpy.context.scene.frame_set(1)
    return gebaut
