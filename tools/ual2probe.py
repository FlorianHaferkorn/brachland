"""
BRACHLAND — UAL2-Clips probeweise auf die Hauptfigur übertragen und vermessen (D428). **Nur Probe**: Die Clips
gehen nicht in `held-clips.glb` und an keine Waffe (das wäre ein Kampfwert-Wechsel, D423).

  node tools/clipnachbau.mjs figur public/figuren/held/w-waldlaeufer.glb public/figuren/held/held-clips.glb <figur-roh.glb>
  blender --background --factory-startup --python tools/ual2probe.py -- <UAL2_Standard.glb> <figur-roh.glb> <aus.glb> <messung.json> \
      "Probe_Heavy=Sword_Heavy_Combo:0-40@klinge,Probe_Hacken=TreeChopping_Loop@axt"

Clip-Angabe: `Zielname=Quelle[:f0-f1][+Quelle[:f0-f1]…][@waffe]` — mehrere Quellstücke wie in `ual2uebertrag.CLIPS`,
`waffe` (klinge, axt, messer, speer, hirschfaenger) bestimmt die Länge bis zur Spitze für die Messung.
`BESTAND=Klinge_U_A@klinge,Axt_Quer@axt` vermisst zusätzlich ausgelieferte Clips der Figur (Abgleich, D428 Teil 3).

Weg wie `heldbau.py` Schritt 1: gleiches Skelett (UE-Mannequin), trotzdem über die Weltformel (`weltformel.py`), weil
die Knochenlängen abweichen; Finger kommen aus der Quelle. **Gegenprobe:** `Sword_Regular_A` + `_Rec` wird als
`Klinge_U_A` mitgebaut und gegen den ausgelieferten Clip gemessen (Hände, Füsse, Kopf je Bild) — so zeigt sich, ob
die geladene UAL2-Fassung und dieser Weg den Bestand treffen. Die Ruhelagen prüft danach `clipnachbau.mjs einfuegen`
— **nur in eine Kopie** von `held-clips.glb`.

Gemessen je Clip (Welt, Figur blickt nach `vorn`): Spitzengeschwindigkeit je Bild, Scheitel (schnellstes Bild) und
Durchzug (letztes Bild danach mit ≥ 50 % davon), Nachschwung (Weg der Spitze vom Durchzug bis < 20 %), Schneide gegen
Schlagrichtung im Scheitel (Axt und Messer: Schneide = −X des Modells, D421), linke Hand neben der Griffachse,
Gleiten der Füsse (waagrecht, solange der Fuss unten ist), Absenken des Beckens, Rumpfdrehung (Schulterlinie),
Gewicht (Becken auf der Linie hinterer → vorderer Fuss). Formprüfung, keine Look-Abnahme.
"""
import bpy, sys, os, json, math
from mathutils import Matrix, Vector, Quaternion

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from weltformel import uebertrage

ARGS = sys.argv[sys.argv.index('--') + 1:]
QUELLE, FIGUR, AUS, MESSUNG, ANGABE = ARGS[:5]
# Abstand Hand → Spitze (Meter), gemessen an `public/figuren/kampf/waffen.glb` (D421/D414).
SPITZE = {'klinge': 0.765, 'axt': 0.919, 'messer': 0.899, 'speer': 1.81, 'hirschfaenger': 0.582}
AN_HAND = Quaternion((0.50394, -0.49601, 0.50396, -0.49602)).normalized().to_matrix()   # wie clipnachbau.py
GEGENPROBE = ('Klinge_U_A', [('Sword_Regular_A', 0, 10), ('Sword_Regular_A_Rec', 1, 23)])
PUNKTE = ['hand_r', 'hand_l', 'foot_l', 'foot_r', 'Head']


def lies_angabe(text):
    clips, waffe = {}, {}
    for teil in filter(None, (t.strip() for t in text.split(','))):
        name, rest = teil.split('=', 1)
        rest, _, w = rest.partition('@')
        stuecke = []
        for st in rest.split('+'):
            q, _, b = st.partition(':')
            f0, f1 = (int(x) for x in b.split('-')) if b else (0, None)
            stuecke.append((q, f0, f1))
        clips[name] = stuecke
        waffe[name] = w or 'klinge'
    return clips, waffe


def importiere(pfad):
    vor = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=pfad)
    return [o for o in bpy.data.objects if o not in vor]


def setze_aktion(arm, akt):
    ad = arm.animation_data or arm.animation_data_create()
    ad.action = akt
    if hasattr(ad, 'action_slot') and akt is not None and akt.slots:
        ad.action_slot = akt.slots[0]


CLIPS, WAFFE = lies_angabe(ANGABE)
BESTAND, BWAFFE = {}, {}
for t in filter(None, os.environ.get('BESTAND', '').split(',')):
    n, _, w = t.partition('@')
    BESTAND[n], BWAFFE[n] = True, w or 'klinge'

bpy.ops.wm.read_factory_settings(use_empty=True)
held = next(o for o in importiere(FIGUR) if o.type == 'ARMATURE')
for a in list(bpy.data.actions):
    a.name = 'HELD__' + a.name
held.animation_data_create()
for tr in list(held.animation_data.nla_tracks):
    held.animation_data.nla_tracks.remove(tr)
q_objs = importiere(QUELLE)
quelle = next(o for o in q_objs if o.type == 'ARMATURE')
quelle.animation_data.action = None
for tr in quelle.animation_data.nla_tracks:
    tr.mute = True
gemeinsam = [(b.name, b.name) for b in held.data.bones if b.name in quelle.data.bones and b.name != 'root']
alle = {**CLIPS, GEGENPROBE[0]: GEGENPROBE[1]}
gebaut = uebertrage(quelle, held, alle, gemeinsam, ('pelvis', 'pelvis'),
                    seiten=('upperarm_l', 'upperarm_r', 'upperarm_l', 'upperarm_r', 'pelvis', 'Head', 'pelvis', 'Head'))
for o in q_objs:
    bpy.data.objects.remove(o, do_unlink=True)
acts = {a.name: a for a in bpy.data.actions}
fps = bpy.context.scene.render.fps

# Blickrichtung aus dem ausgelieferten Idle (wie clipnachbau.py / kontaktbogen.py).
setze_aktion(held, acts['HELD__Idle'])
bpy.context.scene.frame_set(1)
bpy.context.view_layer.update()
P = lambda n: held.matrix_world @ held.pose.bones[n].head
rechts = P('upperarm_r') - P('upperarm_l'); rechts.z = 0; rechts.normalize()
vorn = Vector((0, 0, 1)).cross(rechts).normalized()
boden = min(P('foot_l').z, P('foot_r').z)


def spur(akt):
    setze_aktion(held, akt)
    f0, f1 = (int(round(x)) for x in akt.frame_range)
    pkt = []
    for f in range(f0, f1 + 1):
        bpy.context.scene.frame_set(f)
        bpy.context.view_layer.update()
        hand = (held.matrix_world @ held.pose.bones['hand_r'].matrix).to_3x3().normalized()
        p = {k: P(k).copy() for k in PUNKTE + ['pelvis', 'upperarm_l', 'upperarm_r']}
        p['klinge'] = (hand @ AN_HAND @ Vector((0, -1, 0))).normalized()
        p['schneide'] = (hand @ AN_HAND @ Vector((-1, 0, 0))).normalized()
        pkt.append(p)
    setze_aktion(held, None)
    return pkt


def vermesse(name, akt, waffe):
    s = spur(akt)
    L = SPITZE[waffe]
    n = len(s)
    spitze = [p['hand_r'] + p['klinge'] * L for p in s]
    v = [0.0] + [(spitze[i] - spitze[i - 1]).length * fps for i in range(1, n)]
    sch = max(range(n), key=lambda i: v[i])
    dz = sch
    while dz + 1 < n and v[dz + 1] >= 0.5 * v[sch]:
        dz += 1
    ende = dz
    while ende + 1 < n and v[ende + 1] >= 0.2 * v[sch]:
        ende += 1
    nach = sum((spitze[i] - spitze[i - 1]).length for i in range(dz + 1, ende + 1))
    weg = spitze[min(sch + 1, n - 1)] - spitze[max(sch - 1, 0)]
    schneide_grad = math.degrees(s[sch]['schneide'].angle(weg)) if weg.length > 1e-4 else None
    quer = []
    for p in s:
        d = p['hand_l'] - p['hand_r']
        quer.append((d - p['klinge'] * d.dot(p['klinge'])).length)
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
    gew = []
    for p in s:
        fl, fr = p['foot_l'], p['foot_r']
        fv, fh = (fl, fr) if fl.dot(vorn) > fr.dot(vorn) else (fr, fl)
        sp = (fv - fh).dot(vorn)
        gew.append((p['pelvis'] - fh).dot(vorn) / sp if abs(sp) > 0.1 else None)
    gg = [g for g in gew if g is not None]
    tief = s[0]['pelvis'].z - min(p['pelvis'].z for p in s)
    hochsprung = max(min(p['foot_l'].z, p['foot_r'].z) for p in s) - boden
    erg = dict(bilder=n, dauer=round((n - 1) / fps, 3), waffe=waffe,
               scheitel=sch + 1, durchzug=dz + 1, v_scheitel=round(v[sch], 1),
               nachschwung_m=round(nach, 2), nachschwung_bis=ende + 1,
               schneide_zu_schlag_grad=None if schneide_grad is None else round(schneide_grad),
               linke_hand_quer_cm=[round(min(quer) * 100), round(sorted(quer)[n // 2] * 100), round(max(quer) * 100)],
               fuss_gleiten_m_s=round(gleiten, 2), becken_tiefer_cm=round(tief * 100), beide_fuesse_hoch_cm=round(hochsprung * 100),
               rumpf_dreh_grad=[round(min(yaw)), round(max(yaw))],
               gewicht=[round(min(gg), 2), round(max(gg), 2)] if gg else None,
               v_spitze=[round(x, 1) for x in v])
    print(f'  MESSUNG {name}: {n} Bilder {erg["dauer"]} s, Scheitel {sch + 1} ({v[sch]:.1f} m/s), Durchzug {dz + 1}, '
          f'Nachschwung {nach:.2f} m bis {ende + 1}, Schneide {erg["schneide_zu_schlag_grad"]}° zur Schlagrichtung, '
          f'links quer {erg["linke_hand_quer_cm"]} cm, Fuss gleitet bis {gleiten:.2f} m/s, Becken −{tief * 100:.0f} cm, '
          f'Rumpf {erg["rumpf_dreh_grad"]}°, Gewicht {erg["gewicht"]}')
    return erg, s


messung = {'quelle': os.path.basename(QUELLE), 'clips': {}, 'bestand': {}}
for name in CLIPS:
    messung['clips'][name], _ = vermesse(name, gebaut[name], WAFFE[name])
    messung['clips'][name]['stuecke'] = [list(x) for x in CLIPS[name]]
for name in BESTAND:
    if 'HELD__' + name in acts:
        messung['bestand'][name], _ = vermesse(name, acts['HELD__' + name], BWAFFE[name])
    else:
        print(f'  BESTAND {name}: nicht in der Figur')

# Gegenprobe gegen den ausgelieferten Klinge_U_A.
neu, alt = spur(gebaut[GEGENPROBE[0]]), spur(acts['HELD__' + GEGENPROBE[0]])
m = min(len(neu), len(alt))
fehler = {k: round(max((neu[i][k] - alt[i][k]).length for i in range(m)) * 100, 1) for k in PUNKTE}
messung['gegenprobe'] = dict(clip=GEGENPROBE[0], bilder=[len(neu), len(alt)], groesster_abstand_cm=fehler)
print(f'  GEGENPROBE {GEGENPROBE[0]}: {len(neu)} gegen {len(alt)} Bilder; grösster Abstand {fehler} cm')
json.dump(messung, open(MESSUNG, 'w'), indent=1, ensure_ascii=False)

# Nur die Probeclips ausgeben: Armatur ohne Netz, je Clip eine NLA-Spur (wie clipnachbau.py).
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
