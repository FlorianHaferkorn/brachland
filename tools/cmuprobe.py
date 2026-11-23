"""
BRACHLAND — Clips aus der CMU Graphics Lab Motion Capture Database probeweise auf die Hauptfigur übertragen (D452).
**Nur Probe**: nichts geht in `held-clips.glb`, an keine Waffe, kein Kampfwert (D423).

Quelle: http://mocap.cs.cmu.edu (ASF-Skelett + AMC-Bewegung, 120 Bilder/s). Lizenz auf der Startseite (abgerufen
23.11.2026): „free for all uses“; FAQ: „You may include this data in commercially-sold products, but you may not resell
this data directly, even in converted form.“ Die Daten liegen nur lokal unter `.cache/mocap-d451/` (nie im Repo).

  node tools/clipnachbau.mjs figur public/figuren/held/w-waldlaeufer.glb public/figuren/held/held-clips.glb <figur-roh.glb>
  blender --background --factory-startup --python tools/cmuprobe.py -- <figur-roh.glb> <aus.glb> <messung.json> \
      "Messer_CMU_A=02.asf:02_07.amc:3100-3300@messer,Axt_CMU_Hacken=79.asf:79_01.amc:100-400@axt"

Ohne Bildbereich (`02.asf:02_07.amc@messer`) wird nur die Spur der Hände gedruckt (Tempo der rechten Hand je
Sekunde), um einen Hieb zu finden. Die Bilder gelten in der AMC-Zählung (120/s); der Clip wird auf 24/s gelegt (jedes
fünfte Bild). Weg: ASF/AMC → BVH (eigene Umrechnung unten, Formel der CMU-Dokumentation: Welt = Eltern · C · R · C⁻¹)
→ Blender-BVH-Import → Weltformel (`weltformel.py`) wie bei UAL2 (D428). Beide Skelette stehen in der Ruhe im T.
Gemessen wird wie in `ual2probe.py` (Spitze aus der Lage der Waffe an `hand_r`), dazu der Abstand der Hände — die
CMU-Aufnahme trägt **keine** Waffe (ein unmarkierter Stab): Die Richtung der Klinge ist die der rechten Hand.
"""
import bpy, sys, os, json, math, tempfile
from mathutils import Matrix, Vector, Euler, Quaternion

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from weltformel import uebertrage

ARGS = sys.argv[sys.argv.index('--') + 1:]
FIGUR, AUS, MESSUNG, ANGABE = ARGS[:4]
DATEN = os.environ.get('CMU_DATEN', '.cache/mocap-d451/cmu-daten')
SPITZE = {'klinge': 0.765, 'axt': 0.919, 'messer': 0.899, 'speer': 1.81, 'hirschfaenger': 0.582}
AN_HAND = Quaternion((0.50394, -0.49601, 0.50396, -0.49602)).normalized().to_matrix()   # wie ual2probe.py
EINHEIT = 0.0254 / 0.45          # ASF „length 0.45“: Werte sind Zoll · 1/0,45 → Meter
SCHRITT = 5                      # 120/s → 24/s

# CMU (ASF) → Hauptfigur, Eltern zuerst.
KARTE = [
    ('root', 'pelvis'), ('lowerback', 'spine_01'), ('upperback', 'spine_02'), ('thorax', 'spine_03'),
    ('lowerneck', 'neck_01'), ('head', 'Head'),
    ('lclavicle', 'clavicle_l'), ('lhumerus', 'upperarm_l'), ('lradius', 'lowerarm_l'), ('lhand', 'hand_l'),
    ('rclavicle', 'clavicle_r'), ('rhumerus', 'upperarm_r'), ('rradius', 'lowerarm_r'), ('rhand', 'hand_r'),
    ('lfemur', 'thigh_l'), ('ltibia', 'calf_l'), ('lfoot', 'foot_l'),
    ('rfemur', 'thigh_r'), ('rtibia', 'calf_r'), ('rfoot', 'foot_r'),
]


def lies_asf(pfad):
    knochen, kinder, teil, cur = {}, {}, None, None
    for zeile in open(pfad, encoding='latin1'):
        w = zeile.split()
        if not w or w[0].startswith('#'):
            continue
        if w[0].startswith(':'):
            teil = w[0]
            continue
        if teil == ':bonedata':
            if w[0] == 'begin':
                cur = {'dof': [], 'axis': (0, 0, 0)}
            elif w[0] == 'end':
                knochen[cur['name']] = cur
            elif w[0] == 'name':
                cur['name'] = w[1]
            elif w[0] == 'direction':
                cur['dir'] = Vector([float(x) for x in w[1:4]])
            elif w[0] == 'length':
                cur['len'] = float(w[1]) * EINHEIT
            elif w[0] == 'axis':
                cur['axis'] = tuple(float(x) for x in w[1:4])
            elif w[0] == 'dof':
                cur['dof'] = w[1:]
        elif teil == ':hierarchy' and w[0] not in ('begin', 'end'):
            kinder[w[0]] = w[1:]
    return knochen, kinder


def lies_amc(pfad):
    bilder, cur = [], None
    for zeile in open(pfad, encoding='latin1'):
        w = zeile.split()
        if not w or w[0].startswith(('#', ':')):
            continue
        if len(w) == 1 and w[0].isdigit():
            cur = {}
            bilder.append(cur)
        elif cur is not None:
            cur[w[0]] = [float(x) for x in w[1:]]
    return bilder


def drehung(werte, dofs):
    """AMC-Werte (Grad) in der Reihenfolge der dof → Matrix R = Rz · Ry · Rx (CMU: Euler XYZ)."""
    e = {'rx': 0.0, 'ry': 0.0, 'rz': 0.0}
    for d, v in zip(dofs, werte):
        e[d] = math.radians(v)
    return Euler((e['rx'], e['ry'], e['rz']), 'XYZ').to_matrix()


# Ruhelage der Hauptfigur je CMU-Knochen (Richtung Knochenanfang → nächstes Gelenk, gemessen an `w-waldlaeufer.glb`
# 23.11.2026), in CMU-Achsen: +X links, +Y oben, +Z vorn. Die ASF-Ruhe steht anders (Beine 20° gespreizt, Füsse
# flacher, Schlüsselbein gehoben) — die Weltformel setzt aber gleiche Ruhehaltung voraus. Darum wird die Ruhe des
# BVH auf diese Richtungen gedreht (A je Knochen, kleinste Drehung) und die Bewegung darauf bezogen: G(t) = W(t) · A⁻¹.
ZIEL_RICHT = {
    'lowerback': (0, 0.993, 0.116), 'upperback': (0, 1.0, 0.005), 'thorax': (0, 0.981, -0.196),
    'lowerneck': (0, 0.909, 0.417),
    'lclavicle': (0.864, -0.088, -0.496), 'lhumerus': (1, 0, -0.019), 'lradius': (1, 0, 0.029), 'lhand': (0.994, -0.022, 0.107),
    'lfemur': (0, -0.999, 0.048), 'ltibia': (0, -0.995, -0.095), 'lfoot': (0, -0.375, 0.927),
}
for _k, _v in list(ZIEL_RICHT.items()):
    if _k[0] == 'l':
        ZIEL_RICHT['r' + _k[1:]] = (-_v[0], _v[1], _v[2])


def schreibe_bvh(asf, amc, f0, f1, pfad):
    knochen, kinder = lies_asf(asf)
    bilder = lies_amc(amc)[f0:f1 + 1:SCHRITT]
    C = {n: Euler([math.radians(a) for a in k['axis']], 'XYZ').to_matrix() for n, k in knochen.items()}
    eltern = {k: n for n, ks in kinder.items() for k in ks}
    A = {'root': Matrix.Identity(3)}

    def lege_ruhe(n):
        for k in kinder.get(n, []):
            if k in ZIEL_RICHT:
                A[k] = knochen[k]['dir'].rotation_difference(Vector(ZIEL_RICHT[k]).normalized()).to_matrix()
            else:
                A[k] = A[n]          # ohne Gegenstück (Hüftgelenk, Handgelenk, Finger, Zehen): folgt dem Eltern
            lege_ruhe(k)
    lege_ruhe('root')
    eigen = lambda n: A[n] @ knochen[n]['dir'] * knochen[n]['len'] if n != 'root' else Vector()
    zeilen = ['HIERARCHY']

    def gelenk(name, tiefe, versatz):
        ein = '  ' * tiefe
        kopf = 'ROOT' if name == 'root' else 'JOINT'
        zeilen.append(f'{ein}{kopf} {name}')
        zeilen.append(ein + '{')
        zeilen.append(f'{ein}  OFFSET {versatz.x:.6f} {versatz.y:.6f} {versatz.z:.6f}')
        kanal = 'CHANNELS 6 Xposition Yposition Zposition Zrotation Yrotation Xrotation' if name == 'root' \
            else 'CHANNELS 3 Zrotation Yrotation Xrotation'
        zeilen.append(f'{ein}  {kanal}')
        e = eigen(name)
        if kinder.get(name):
            for k in kinder[name]:
                gelenk(k, tiefe + 1, e)
        else:
            zeilen.append(f'{ein}  End Site')
            zeilen.append(ein + '  {')
            zeilen.append(f'{ein}    OFFSET {e.x:.6f} {e.y:.6f} {e.z:.6f}')
            zeilen.append(ein + '  }')
        zeilen.append(ein + '}')

    reihenfolge = []

    def sammle(n):
        reihenfolge.append(n)
        for k in kinder.get(n, []):
            sammle(k)

    # Ruhelage: Becken in Hüfthöhe über dem Boden (ASF legt es auf 0) — sonst teilt die Weltformel beim Skalieren
    # der Beckenspur durch null. Die Höhe ist der tiefste Punkt der Ruhe (Zehen) unter dem Becken.
    def tiefster(n, p):
        e = p + eigen(n)
        return min([e.y] + [tiefster(k, e) for k in kinder.get(n, [])])
    gelenk('root', 0, Vector((0, -tiefster('root', Vector()), 0)))
    sammle('root')
    zeilen += ['MOTION', f'Frames: {len(bilder)}', f'Frame Time: {SCHRITT / 120:.6f}']
    for b in bilder:
        werte, W, G = [], {}, {}
        for n in reihenfolge:
            if n == 'root':
                r = b['root']
                werte += [x * EINHEIT for x in r[:3]]
                W[n] = drehung(r[3:6], ['rx', 'ry', 'rz'])
            else:
                # CMU-Formel: Welt = Eltern · C · R · C⁻¹ (bildet die ASF-Ruherichtung auf die aktuelle ab).
                W[n] = W[eltern[n]] @ C[n] @ drehung(b.get(n, []), knochen[n]['dof']) @ C[n].inverted()
            G[n] = W[n] @ A[n].inverted()
            lokal = G[n] if n == 'root' else G[eltern[n]].inverted() @ G[n]
            e = lokal.to_euler('XYZ')        # M = Rz · Ry · Rx — BVH-Kanäle Z Y X
            werte += [math.degrees(e.z), math.degrees(e.y), math.degrees(e.x)]
        zeilen.append(' '.join(f'{v:.5f}' for v in werte))
    open(pfad, 'w').write('\n'.join(zeilen) + '\n')
    return len(bilder)


def lies_angabe(text):
    clips = {}
    for teil in filter(None, (t.strip() for t in text.split(','))):
        name, rest = teil.split('=', 1)
        rest, _, waffe = rest.partition('@')
        asf, amc, *b = rest.split(':')
        bereich = tuple(int(x) for x in b[0].split('-')) if b else None
        clips[name] = dict(asf=asf, amc=amc, bereich=bereich, waffe=waffe or 'messer')
    return clips


def importiere(pfad):
    vor = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=pfad)
    return [o for o in bpy.data.objects if o not in vor]


def setze_aktion(arm, akt):
    ad = arm.animation_data or arm.animation_data_create()
    ad.action = akt
    if hasattr(ad, 'action_slot') and akt is not None and akt.slots:
        ad.action_slot = akt.slots[0]


CLIPS = lies_angabe(ANGABE)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = 24

# Ohne Bildbereich: nur die Spur der rechten Hand (Tempo), um Hiebe zu finden.
for name, c in CLIPS.items():
    if c['bereich']:
        continue
    knochen, kinder = lies_asf(os.path.join(DATEN, c['asf']))
    n = len(lies_amc(os.path.join(DATEN, c['amc'])))
    tmp = os.path.join(tempfile.mkdtemp(), name + '.bvh')
    schreibe_bvh(os.path.join(DATEN, c['asf']), os.path.join(DATEN, c['amc']), 0, n - 1, tmp)
    bpy.ops.import_anim.bvh(filepath=tmp, frame_start=1, use_fps_scale=False, rotate_mode='NATIVE')
    arm = bpy.context.object
    f1 = int(arm.animation_data.action.frame_range[1])
    vorig, zeile = None, []
    for f in range(1, f1 + 1):
        bpy.context.scene.frame_set(f)
        p = arm.matrix_world @ arm.pose.bones['rhand'].head
        q = arm.matrix_world @ arm.pose.bones['lhand'].head
        if vorig is not None:
            zeile.append(((p - vorig).length * 24, (p - q).length, p.z))
        vorig = p
    print(f'  SPUR {name}: {n} AMC-Bilder, {f1} bei 24/s')
    for s0 in range(0, len(zeile), 24):
        st = zeile[s0:s0 + 24]
        print(f'    s {s0 / 24:5.1f}  AMC {s0 * SCHRITT:5d}  Hand r max {max(x[0] for x in st):4.1f} m/s  '
              f'Hände {min(x[1] for x in st) * 100:3.0f}–{max(x[1] for x in st) * 100:3.0f} cm  Hand hoch {max(x[2] for x in st):.2f} m')
    bpy.data.objects.remove(arm, do_unlink=True)
CLIPS = {n: c for n, c in CLIPS.items() if c['bereich']}
if not CLIPS:
    sys.exit(0)

held = next(o for o in importiere(FIGUR) if o.type == 'ARMATURE')
for a in list(bpy.data.actions):
    a.name = 'HELD__' + a.name
held.animation_data_create()
for tr in list(held.animation_data.nla_tracks):
    held.animation_data.nla_tracks.remove(tr)

messung = {'quelle': 'CMU Graphics Lab Motion Capture Database', 'clips': {}}
gebaut = {}
for name, c in CLIPS.items():
    tmp = os.path.join(tempfile.mkdtemp(), 'CMU_' + name + '.bvh')
    n = schreibe_bvh(os.path.join(DATEN, c['asf']), os.path.join(DATEN, c['amc']), c['bereich'][0], c['bereich'][1], tmp)
    vor = set(bpy.data.actions)
    bpy.ops.import_anim.bvh(filepath=tmp, frame_start=1, use_fps_scale=False, rotate_mode='NATIVE')
    quelle = bpy.context.object
    akt = next(a for a in bpy.data.actions if a not in vor)
    akt.name = 'CMU_' + name
    gebaut.update(uebertrage(quelle, held, {name: [(akt.name, 1, n)]}, KARTE, ('root', 'pelvis'),
                             seiten=('lhumerus', 'rhumerus', 'upperarm_l', 'upperarm_r', 'root', 'head', 'pelvis', 'Head')))
    bpy.data.objects.remove(quelle, do_unlink=True)

fps = 24
acts = {a.name: a for a in bpy.data.actions}
setze_aktion(held, acts['HELD__Idle'])
bpy.context.scene.frame_set(1)
bpy.context.view_layer.update()
P = lambda k: held.matrix_world @ held.pose.bones[k].head
rechts = P('upperarm_r') - P('upperarm_l'); rechts.z = 0; rechts.normalize()
vorn = Vector((0, 0, 1)).cross(rechts).normalized()
boden = min(P('foot_l').z, P('foot_r').z)


def vermesse(name, akt, waffe):
    setze_aktion(held, akt)
    f0, f1 = (int(round(x)) for x in akt.frame_range)
    s = []
    for f in range(f0, f1 + 1):
        bpy.context.scene.frame_set(f)
        bpy.context.view_layer.update()
        hand = (held.matrix_world @ held.pose.bones['hand_r'].matrix).to_3x3().normalized()
        p = {k: P(k).copy() for k in ('hand_r', 'hand_l', 'foot_l', 'foot_r', 'pelvis', 'upperarm_l', 'upperarm_r')}
        p['klinge'] = (hand @ AN_HAND @ Vector((0, -1, 0))).normalized()
        s.append(p)
    setze_aktion(held, None)
    n, L = len(s), SPITZE[waffe]
    spitze = [p['hand_r'] + p['klinge'] * L for p in s]
    hand_v = [0.0] + [(s[i]['hand_r'] - s[i - 1]['hand_r']).length * fps for i in range(1, n)]
    v = [0.0] + [(spitze[i] - spitze[i - 1]).length * fps for i in range(1, n)]
    sch = max(range(n), key=lambda i: hand_v[i])
    dz = sch
    while dz + 1 < n and hand_v[dz + 1] >= 0.5 * hand_v[sch]:
        dz += 1
    abstand = sorted((p['hand_l'] - p['hand_r']).length for p in s)
    gleiten = 0.0
    for fuss in ('foot_l', 'foot_r'):
        unten = [i for i in range(n) if s[i][fuss].z < boden + 0.05]
        for a_, b_ in zip(unten, unten[1:]):
            if b_ == a_ + 1:
                d = s[b_][fuss] - s[a_][fuss]; d.z = 0
                gleiten = max(gleiten, d.length * fps)
    yaw = []
    for p in s:
        d = p['upperarm_r'] - p['upperarm_l']
        yaw.append(math.degrees(math.atan2(d.dot(-vorn), d.dot(rechts))))
    tief = s[0]['pelvis'].z - min(p['pelvis'].z for p in s)
    erg = dict(bilder=n, dauer=round((n - 1) / fps, 3), waffe=waffe, schnellstes_bild_hand=sch + 1, durchzug=dz + 1,
               hand_r_max_m_s=round(hand_v[sch], 1), spitze_max_m_s=round(max(v), 1),
               haende_abstand_cm=[round(abstand[0] * 100), round(abstand[n // 2] * 100), round(abstand[-1] * 100)],
               fuss_gleiten_m_s=round(gleiten, 2), becken_tiefer_cm=round(tief * 100),
               rumpf_dreh_grad=[round(min(yaw)), round(max(yaw))], v_hand=[round(x, 1) for x in hand_v])
    print(f'  MESSUNG {name}: {n} Bilder {erg["dauer"]} s, schnellstes Bild {sch + 1} (Hand {hand_v[sch]:.1f} m/s, '
          f'Spitze bis {max(v):.1f} m/s), Durchzug {dz + 1}, Hände {erg["haende_abstand_cm"]} cm, '
          f'Fuss gleitet bis {gleiten:.2f} m/s, Becken −{tief * 100:.0f} cm, Rumpf {erg["rumpf_dreh_grad"]}°')
    return erg


for name, c in CLIPS.items():
    messung['clips'][name] = vermesse(name, gebaut[name], c['waffe'])
    messung['clips'][name]['quelle'] = f"{c['amc']} Bild {c['bereich'][0]}–{c['bereich'][1]} (120/s)"
json.dump(messung, open(MESSUNG, 'w'), indent=1, ensure_ascii=False)

# Nur die Probeclips ausgeben (wie ual2probe.py): Armatur ohne Netz, je Clip eine NLA-Spur.
for o in list(bpy.data.objects):
    if o != held:
        bpy.data.objects.remove(o, do_unlink=True)
for tr in list(held.animation_data.nla_tracks):
    held.animation_data.nla_tracks.remove(tr)
for a in list(bpy.data.actions):
    if not (a.name.startswith('ZIEL__') and a.name[len('ZIEL__'):] in CLIPS):
        bpy.data.actions.remove(a)
for a in list(bpy.data.actions):
    a.name = a.name[len('ZIEL__'):]
    tr = held.animation_data.nla_tracks.new()
    tr.name = a.name
    st = tr.strips.new(a.name, 1, a)
    if hasattr(st, 'action_slot') and a.slots:
        st.action_slot = a.slots[0]
held.animation_data.action = None
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=AUS, export_format='GLB', use_selection=False, export_apply=False,
                          export_materials='NONE', export_yup=True, export_skins=True, export_animations=True,
                          export_force_sampling=True, export_nla_strips=True, export_optimize_animation_size=True)
print(f'  → {AUS}: {", ".join(a.name for a in bpy.data.actions)} ({os.path.getsize(AUS) / 1024:.0f} KB)')
