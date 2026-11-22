"""
BRACHLAND — Weltformel: Clips von einem Skelett auf ein anderes (D175, aus `tools/heldbau.py` gezogen, D414).

Die Drehung jedes Knochens gegenüber seiner Ruhe wird in der Welt übertragen, die Verschiebung nur am
Becken (mit der Körpergrösse skaliert). Gebraucht von `tools/heldbau.py` (alle Clips der Hauptfigur aus
den Quellpaketen) und `tools/clipnachbau.py` (neue Waffenclips ohne Quellpakete, aus den ausgelieferten
Dateien). Zweihändige Clips bekommen danach die linke Hand per IK an den Stiel (`greife_links`).
"""
import bpy, math, os
from mathutils import Matrix, Vector

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
# D414: Das Lange Messer ist zweihändig wie Axt und Speer. Die Räucherkanne hält die linke Hand allein —
# sie greift zu (Finger wie am Stiel), aber ohne IK an die rechte: Sie steht für sich.
ZWEIHAND = ('Axt_', 'Speer_', 'Messer_')
LINKS_GREIFT = ZWEIHAND + ('Geraet_',)
GRIFF_ZWEI = {}
GREIF_FEHLER = []


def greife_links(quelle, ziel, s, entlang=None):
    """`entlang` (D429, Fällaxt): Lage der linken Hand am Stiel von der rechten aus, Meter der Quelle (negativ = zum
    Stielende). Dann liegt das Ziel genau auf der Stielachse durch das rechte Handgelenk — die Achse ist die Klinge der
    Quelle (−X von `Wrist.R`, wie `waffenclips.py` sie legt) —, statt wo die Quelle die linke Hand zwischen zwei
    Schlüsseln gerade hinträgt (gemessen: bis 12 cm neben dem Stiel)."""
    bpy.context.view_layer.update()
    zw, qw = ziel.matrix_world, quelle.matrix_world
    zpb, qpb = ziel.pose.bones, quelle.pose.bones
    if entlang is None:
        soll = zw @ zpb['hand_r'].head + (qw @ qpb['Wrist.L'].head - qw @ qpb['Wrist.R'].head) * s
    else:
        achse = -((qw.to_3x3().normalized() @ qpb['Wrist.R'].matrix.to_3x3()).col[0]).normalized()
        soll = zw @ zpb['hand_r'].head + achse * (entlang * s)
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
    # D188: Reicht der Arm nicht, rutscht die Hand am Stiel entlang (Linie durch die rechte Hand in
    # Richtung der linken) bis in Reichweite — sie bleibt am Stiel statt daneben in der Luft.
    R = zw @ zpb['hand_r'].head
    u = soll - R; t0 = u.length; u = u.normalized() if t0 > 1e-6 else u
    L = a + b - 0.005
    if (soll - S).length > L and t0 > 1e-6:
        w = R - S
        pb_, pc = w.dot(u), w.dot(w) - L * L
        disk = pb_ * pb_ - pc
        if disk >= 0:
            wurzeln = [-pb_ - math.sqrt(disk), -pb_ + math.sqrt(disk)]
            t = min((x for x in wurzeln if x > 0.05), key=lambda x: abs(x - t0), default=None)
            if t is not None: soll = R + u * t
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
    # Gemessen wird der Abstand zum Stiel (Linie), nicht zum ursprünglichen Griffpunkt.
    p_ = zw @ ha.head - R
    GREIF_FEHLER.append((vorher, (p_ - u * p_.dot(u)).length if t0 > 1e-6 else (zw @ ha.head - soll).length))


def _verlauf(punkte, bild):
    """Linear zwischen Schlüsseln [(Bild, Wert)], ausserhalb der erste/letzte Wert."""
    if bild <= punkte[0][0]:
        return punkte[0][1]
    for (b0, w0), (b1, w1) in zip(punkte, punkte[1:]):
        if bild <= b1:
            return w0 + (w1 - w0) * (bild - b0) / (b1 - b0)
    return punkte[-1][1]


def uebertrage(quelle, ziel, clips, karte, becken, griff=None, seiten=None, versatz=None, stiel=None):
    """Weltformel wie in ual2uebertrag.py, allgemein: `clips` = {Name: [(Action, f0, f1)]},
    `karte` = [(Quellknochen, Zielknochen)] Eltern zuerst, `becken` = (Quelle, Ziel) für die
    Verschiebung. `griff` = {Fingerknochen: Quaternion} bleibt in jedem Bild stehen. `versatz` (Welt, Meter)
    wird dem Becken zugeschlagen — `clipnachbau.py` gleicht damit die Höhe am ausgelieferten Idle an (D414).
    `stiel` = {Clip: [(Bild, Meter)]} (D429): wo die linke Hand am Stiel sitzt, je Schlüssel — dazwischen linear."""
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
                        if versatz is not None:
                            kopf = kopf + versatz
                    setze(ziel, zpb[z], welt3(quelle, qpb[q].matrix.to_3x3()) @ ruhe[z], kopf)
                if os.environ.get('SPUR') and f in (f0, f0 + 5) and karte[0][0] == 'Body':
                    print('    ZIEL', [round(x, 3) for x in zpb['thigh_l'].rotation_quaternion], zpb['thigh_l'].rotation_mode, len(zad.nla_tracks))
                if griff:
                    for k, qq in griff.items():
                        zpb[k].rotation_mode = 'QUATERNION'; zpb[k].rotation_quaternion = qq
                if name.startswith(LINKS_GREIFT) and GRIFF_ZWEI:
                    for k, qq in GRIFF_ZWEI.items():
                        zpb[k].rotation_mode = 'QUATERNION'; zpb[k].rotation_quaternion = qq
                if name.startswith(ZWEIHAND) and 'Wrist.L' in qpb:
                    greife_links(quelle, ziel, s, _verlauf(stiel[name], f) if stiel and name in stiel else None)
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
