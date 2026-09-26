"""
BRACHLAND — Axthieb über Kopf als eigener Clip (D169, ADR-0008 §4).

Das Quaternius-Paket hat genau einen Waffenschlag (`Sword_Slash`), einen Seitwärtshieb. Eine Axt
kommt von oben. Fremde Clips scheitern an ADR-0002; also wird der Hieb hier **gebaut** — auf dem
Rig der Wanderin, aus Richtungen in der Welt statt aus Winkeln je Knochen:

    Schlüssel     Bild   Oberarme               Unterarme             Rumpf
    Stand            1   Idle                   Idle                  Idle
    Heben            5   vorn hoch              aufwärts              aufrecht
    Ausholen         9   hoch, leicht zurück    hinter den Kopf       zurückgelehnt
    Scheitel        12   weiter zurück          waagerecht nach hinten
    Hoch            14   senkrecht, leicht vor  vorn oben             aufrecht
    Durchzug        16   vorn, schräg abwärts   vorn abwärts          vorgebeugt
    Nachschwung     22   abwärts                senkrecht abwärts     tief vorgebeugt
    Stand           34   Idle                   Idle                  Idle

Richtungen statt Winkel, weil die Ruhelage der Paketknochen schief ist (jeder Knochen hat seine
eigene Rollachse) — „Oberarm zeigt nach oben" ist in der Welt eindeutig, als Euler-Winkel nicht.
Rechts wird aus den Schultern gelesen, vorn senkrecht dazu mit dem Vorzeichen der Fussspitzen —
nicht angenommen (die Füsse allein lagen 33° daneben).

Alle Knochen bekommen jeden Schlüssel, auch die, die sich nicht bewegen: three.js lässt Knochen, die
ein Clip nicht nennt, auf dem Stand des vorigen Clips stehen.

Die Phasen der Regel liegen im Spiel auf diesen Bildern: Ausholen bis Bild 12, Durchzug bis 16
(`HIEB_AXT` in `RegionsSzene.tsx`). Wer hier Bilder verschiebt, muss dort nachziehen.
"""
import bpy
from mathutils import Vector, Matrix

NAME = 'Axe_Overhead'
BILDER = {'stand': 1, 'heben': 5, 'ausholen': 9, 'scheitel': 12, 'hoch': 14, 'durchzug': 16, 'nachschwung': 22, 'ende': 34}


def _richtungen(vorn, oben, rechts):
    """Weltrichtungen je Knochen und Schlüssel. R/L spiegeln über `rechts`."""
    def n(v): return v.normalized()
    r = {}
    # Zwischenschlüssel (D169, im Spiel gefunden): Blender interpoliert Quaternionen je Komponente,
    # nicht auf der Kugel. Über 150° (Arm hängend → Arm hinter dem Kopf, Scheitel → Durchzug) nahm
    # der Arm den Umweg über die Seite — im Bild standen die Arme waagerecht ab. Jeder Abschnitt
    # bleibt jetzt unter 90°.
    r['heben'] = {
        'UpperArm.R': n(vorn * 0.8 + oben * 0.45 + rechts * 0.2), 'UpperArm.L': n(vorn * 0.8 + oben * 0.45 - rechts * 0.2),
        'LowerArm.R': n(vorn * 0.5 + oben * 0.85 - rechts * 0.1), 'LowerArm.L': n(vorn * 0.5 + oben * 0.85 + rechts * 0.1),
        'Torso': n(oben), 'Chest': n(oben - vorn * 0.05),
    }
    r['hoch'] = {
        'UpperArm.R': n(oben * 0.85 + vorn * 0.5 + rechts * 0.12), 'UpperArm.L': n(oben * 0.85 + vorn * 0.5 - rechts * 0.12),
        # Unterarm fast senkrecht: vom Scheitel (waagerecht zurück) sind das 90°, nicht 150°.
        'LowerArm.R': n(oben * 0.9 + vorn * 0.3 - rechts * 0.1), 'LowerArm.L': n(oben * 0.9 + vorn * 0.3 + rechts * 0.1),
        'Torso': n(oben + vorn * 0.05), 'Chest': n(oben + vorn * 0.1),
    }
    r['ausholen'] = {
        'UpperArm.R': n(oben - vorn * 0.25 + rechts * 0.25), 'UpperArm.L': n(oben - vorn * 0.25 - rechts * 0.25),
        'LowerArm.R': n(-vorn * 0.7 + oben * 0.35 - rechts * 0.2), 'LowerArm.L': n(-vorn * 0.7 + oben * 0.35 + rechts * 0.2),
        'Torso': n(oben - vorn * 0.08), 'Chest': n(oben - vorn * 0.16),
    }
    r['scheitel'] = {
        'UpperArm.R': n(oben - vorn * 0.45 + rechts * 0.18), 'UpperArm.L': n(oben - vorn * 0.45 - rechts * 0.18),
        'LowerArm.R': n(-vorn * 0.85 + oben * 0.05 - rechts * 0.2), 'LowerArm.L': n(-vorn * 0.85 + oben * 0.05 + rechts * 0.2),
        'Torso': n(oben - vorn * 0.12), 'Chest': n(oben - vorn * 0.24),
    }
    r['durchzug'] = {
        'UpperArm.R': n(vorn * 0.9 - oben * 0.3 + rechts * 0.1), 'UpperArm.L': n(vorn * 0.9 - oben * 0.3 - rechts * 0.1),
        'LowerArm.R': n(vorn * 0.75 - oben * 0.65 - rechts * 0.15), 'LowerArm.L': n(vorn * 0.75 - oben * 0.65 + rechts * 0.15),
        'Torso': n(oben + vorn * 0.18), 'Chest': n(oben + vorn * 0.38),
    }
    r['nachschwung'] = {
        'UpperArm.R': n(vorn * 0.55 - oben * 0.85 + rechts * 0.08), 'UpperArm.L': n(vorn * 0.55 - oben * 0.85 - rechts * 0.08),
        'LowerArm.R': n(vorn * 0.3 - oben * 0.95 - rechts * 0.1), 'LowerArm.L': n(vorn * 0.3 - oben * 0.95 + rechts * 0.1),
        'Torso': n(oben + vorn * 0.25), 'Chest': n(oben + vorn * 0.5),
    }
    return r


# Eltern vor Kindern — sonst verschiebt das Ausrichten des Oberarms den schon gerichteten Unterarm.
REIHENFOLGE = ['Torso', 'Chest', 'UpperArm.R', 'UpperArm.L', 'LowerArm.R', 'LowerArm.L']


def _richte(arm, pb, ziel_welt):
    """Knochen so drehen, dass seine Y-Achse (Kopf→Spitze) in der Welt nach `ziel_welt` zeigt."""
    welt = arm.matrix_world
    m = pb.matrix.copy()                          # Armaturraum
    jetzt = (welt.to_3x3() @ m.to_3x3().col[1]).normalized()
    dreh_welt = jetzt.rotation_difference(ziel_welt)
    a = welt.to_3x3().normalized()
    dreh = (a.inverted() @ dreh_welt.to_matrix() @ a).to_4x4()
    kopf = m.translation.copy()
    pb.matrix = Matrix.Translation(kopf) @ dreh @ Matrix.Translation(-kopf) @ m
    bpy.context.view_layer.update()


def baue_axthieb(arm):
    """Legt die Action `Axe_Overhead` an und hängt sie wie die importierten als NLA-Spur an."""
    ad = arm.animation_data or arm.animation_data_create()
    idle = next((a for a in bpy.data.actions if a.name.split('|')[-1] == 'Idle'), None)
    if idle is None:
        raise RuntimeError('Axthieb: keine Idle-Action — ohne Stand kein Hieb')
    for tr in ad.nla_tracks: tr.mute = True
    ad.action = idle
    if hasattr(ad, 'action_slot') and idle.slots:
        ad.action_slot = idle.slots[0]
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()

    welt = arm.matrix_world
    pb = arm.pose.bones
    # Rechts aus den Schultern (die Füsse stehen gespreizt und schief, gemessen 33° daneben), vorn
    # senkrecht dazu — das Vorzeichen liefern die Fussspitzen.
    oben = Vector((0, 0, 1))
    rechts = (welt @ pb['UpperArm.R'].head) - (welt @ pb['UpperArm.L'].head)
    rechts.z = 0
    rechts.normalize()
    spitzen = Vector((0, 0, 0))
    for s in 'LR':
        b = pb.get('Foot.' + s)
        if b:
            spitzen += (welt @ b.tail) - (welt @ b.head)
    vorn = oben.cross(rechts)
    if vorn.dot(spitzen) < 0:
        vorn = -vorn
    vorn.normalize()
    print(f'  Axthieb: vorn {tuple(round(x, 2) for x in vorn)} rechts {tuple(round(x, 2) for x in rechts)}')

    stand = {b.name: b.matrix_basis.copy() for b in pb}
    richt = _richtungen(vorn, oben, rechts)

    akt = bpy.data.actions.new(NAME)
    ad.action = akt
    for schluessel, bild in BILDER.items():
        for b in pb:
            b.matrix_basis = stand[b.name]
        bpy.context.view_layer.update()
        if schluessel in richt:
            for kn in REIHENFOLGE:
                if kn in pb and kn in richt[schluessel]:
                    _richte(arm, pb[kn], richt[schluessel][kn])
            # Handgelenke folgen dem Unterarm (gerade), sonst knickt die Hand am Stiel ab.
            for s in 'RL':
                if 'Wrist.' + s in pb and 'LowerArm.' + s in pb:
                    _richte(arm, pb['Wrist.' + s], (welt.to_3x3() @ pb['LowerArm.' + s].matrix.to_3x3().col[1]).normalized())
        for b in pb:
            if b.rotation_mode != 'QUATERNION':
                b.rotation_mode = 'QUATERNION'
            b.keyframe_insert('rotation_quaternion', frame=bild)
            b.keyframe_insert('location', frame=bild)
    ad.action = None
    tr = ad.nla_tracks.new()
    tr.name = NAME
    st = tr.strips.new(NAME, 1, akt)
    if hasattr(st, 'action_slot') and akt.slots:
        st.action_slot = akt.slots[0]
    for t in ad.nla_tracks: t.mute = False
    bpy.context.scene.frame_set(1)
    print(f'  Axthieb: {len(BILDER)} Schlüssel, Bild 1–{BILDER["ende"]}')
    return akt
