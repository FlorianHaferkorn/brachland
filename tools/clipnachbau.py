"""
BRACHLAND — neue Waffenclips der Hauptfigur ohne Quellpakete bauen (D414).

  node tools/clipnachbau.mjs figur public/figuren/held/w-waldlaeufer.glb public/figuren/held/held-clips.glb .cache/d414/figur-roh.glb
  blender --background --factory-startup --python tools/clipnachbau.py -- .cache/d414/figur-roh.glb .cache/d414/neu-clips.glb
  node tools/clipnachbau.mjs einfuegen .cache/d414/neu-clips.glb public/figuren/held/held-clips.glb

Derselbe Weg wie `menschbau.py` + `heldbau.py`, nur aus den ausgelieferten Dateien: Die Clips entstehen aus
Schlüsselbildern (`waffenclips.py`) auf dem Rig der alten Wanderin (`public/figuren/wanderin.glb`, trägt Idle)
und gehen über die Weltformel (`weltformel.py`) auf das Skelett der Hauptfigur. Den Griff der Finger liest das
Skript aus den ausgelieferten Clips (`Klinge_Stand`: beide Hände wie `Sword_Block`, `Axt_Stand`: linke Hand am
Stiel wie `TreeChopping_Loop`) — dieselben Werte, die `heldbau.py` aus der UAL2 nimmt.

**Gegenprobe:** Die Clips in `PRUEFE` werden mitgebaut und mit den ausgelieferten verglichen (Weltlage von
Händen, Füssen und Kopf, je Bild). Idle (nur Übertragung) muss nach dem Höhenabgleich auf `GRENZE` stimmen, sonst
bricht das Skript ab. Die nachgebauten Bestands-Waffenclips stimmen **nicht** (D414, gemessen 13–36 cm): Sie stellen
die Füsse dorthin, wo die Schlüssel es sagen (ohne `fuss_*` bleiben sie stehen), die ausgelieferten setzen die Füsse
um 7–10 cm anders und tragen die Körperabsenkung (`koerper`) kaum. Geprüft und ausgeschlossen: Knochenrichtung des
Imports (BLENDER/TEMPERANCE/FORTUNE gleich), Grösse der Quellfigur (0,9–1,25), Bindepose. Ursache nicht gefunden —
vermutlich ein Unterschied in der alten .blend (Rig vor dem Normen in `menschbau.py`). Die neuen Clips folgen den
Schlüsseln wörtlich; der Bestand bleibt, wie er ist.
"""
import bpy, sys, os, math
from mathutils import Matrix, Vector, Quaternion

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from waffenclips import baue_waffenclips, NAMEN, CLIPS, GRIFF
from weltformel import ALT_KARTE, FINGER, GRIFF_ZWEI, uebertrage

ARGS = sys.argv[sys.argv.index('--') + 1:]
FIGUR, AUS = ARGS[0], ARGS[1]
NEU = [n for n in NAMEN if n.startswith(('Messer_', 'Geraet_', 'Axt_'))]
# D429: Seit D429 sind auch die Axtclips aus Schlüsselbildern gebaut (Zweihand-Fällaxt). `NUR=Axt_` gibt nur sie aus —
# so wird `held-clips.glb` in der Fassung aus git nur um diese Clips ergänzt, die übrigen bleiben bitgleich.
if os.environ.get('NUR'):
    NEU = [n for n in NEU if n.startswith(tuple(os.environ['NUR'].split(',')))]
# D420: `VORSCHLAG=1` baut stattdessen die Vorschläge aus `gewichtvorschlag.py` (nur für Prüfbilder) und gibt die
# nachgebauten Originale als `<Name>_Nachbau` mit aus — nie in `held-clips.glb` einfügen.
VORSCHLAG = bool(os.environ.get('VORSCHLAG'))
if VORSCHLAG:
    import waffenclips
    from gewichtvorschlag import VORSCHLAG as _V
    waffenclips.CLIPS.update(_V)
    waffenclips.NAMEN = tuple(waffenclips.CLIPS)
    NEU = list(_V)
# D430: `PROBE=<name.json>[:Clip,…]` baut stattdessen die Clips aus Videoposen (`tools/videoposen.py erkennen`, Feld
# `hiebe`) — nur Probe für Prüfbilder, **nie** in `held-clips.glb` einfügen, keiner Waffe zuweisen (Trefferfenster
# sind Kampfwerte). Die Posenfelder sind dieselben wie in `CLIPS`; JSON-Listen werden wieder Tupel.
PROBE = os.environ.get('PROBE')
if PROBE:
    import json
    import waffenclips
    _pfad, _, _nur = PROBE.partition(':')
    NEU = []
    for _c in json.load(open(_pfad))['hiebe']:
        if _nur and _c['name'] not in _nur.split(','):
            continue
        waffenclips.CLIPS[_c['name']] = (_c['grund'], _c['art'], [
            (b, {k: tuple(v) if isinstance(v, list) else v for k, v in p.items()}) for b, p in _c['schluessel']])
        waffenclips.ACHSE[_c['name']] = _c['achse']
        if _c['achse'] == 'axt':
            waffenclips.TREFFER[_c['name']] = tuple(_c['treffer'])
        NEU.append(_c['name'])
    waffenclips.NAMEN = tuple(waffenclips.CLIPS)
# Idle prüft die Übertragung allein (hart, `GRENZE`), die drei Waffenclips den ganzen Weg (nur gemeldet, s. o.).
# D429: `Axt_Quer` ist seit D429 selbst neu gebaut — die Gegenprobe läuft nur noch an Speer und Klinge.
PRUEFE = ['Idle', 'Speer_Stoss', 'Klinge_Stich']
GRENZE = 0.01   # Meter
MESSPUNKTE = ['hand_r', 'hand_l', 'foot_l', 'foot_r', 'Head']


def importiere(pfad, **opt):
    vor = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=pfad, **opt)
    return [o for o in bpy.data.objects if o not in vor]


def setze_aktion(arm, akt):
    ad = arm.animation_data or arm.animation_data_create()
    ad.action = akt
    if hasattr(ad, 'action_slot') and akt is not None and akt.slots:
        ad.action_slot = akt.slots[0]


bpy.ops.wm.read_factory_settings(use_empty=True)
# 1. Die Hauptfigur mit allen ausgelieferten Clips. Ihre Actions bekommen eine Vorsilbe, damit die gleichnamigen
#    der Wanderin (Idle, Klinge_Stand …) sie nicht verdrängen.
held_objs = importiere(FIGUR)
held = next(o for o in held_objs if o.type == 'ARMATURE')
for a in list(bpy.data.actions):
    a.name = 'HELD__' + a.name
held.animation_data_create()
for tr in list(held.animation_data.nla_tracks):
    held.animation_data.nla_tracks.remove(tr)
acts = {a.name: a for a in bpy.data.actions}


def fingergriff(clip, nur_links=False):
    setze_aktion(held, acts['HELD__' + clip])
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    g = {f: held.pose.bones[f].matrix_basis.to_quaternion() for f in FINGER
         if f in held.pose.bones and (not nur_links or f.endswith('_l'))}
    setze_aktion(held, None)
    return g


griff = fingergriff('Klinge_Stand')
GRIFF_ZWEI.update(fingergriff('Axt_Stand', nur_links=True))
for b in held.pose.bones:
    b.matrix_basis = Matrix()

# 2. Die alte Wanderin: Clips aus Schlüsselbildern.
alt_objs = importiere('public/figuren/wanderin.glb')
alt = next(o for o in alt_objs if o.type == 'ARMATURE')
baue_waffenclips(alt, nur=set(NEU + PRUEFE))
for tr in list(alt.animation_data.nla_tracks):
    alt.animation_data.nla_tracks.remove(tr)
alt.animation_data.action = None

SEITEN = ('UpperArm.L', 'UpperArm.R', 'upperarm_l', 'upperarm_r', 'Body', 'Head', 'pelvis', 'Head')


def spur(akt):
    setze_aktion(held, akt)
    f0, f1 = (int(x) for x in akt.frame_range)
    pkt = []
    for f in range(f0, f1 + 1):
        bpy.context.scene.frame_set(f)
        bpy.context.view_layer.update()
        pkt.append({k: held.matrix_world @ held.pose.bones[k].head for k in MESSPUNKTE})
    setze_aktion(held, None)
    return pkt


# 3. Weltformel wie `heldbau.py` (dieselbe Ausrichtung über die Schulterlinie). Erst Idle allein: Es steht ohne
#    Abzug um einen festen Versatz tiefer als das ausgelieferte (gemessen 3,4 cm, an allen Punkten gleich — das
#    Becken der alten .blend stand anders als das der ausgelieferten Wanderin). Der Versatz wird gemessen und
#    allen Clips zugeschlagen, damit die neuen auf derselben Höhe stehen wie Idle, Gang und die alten Waffen.
probe = uebertrage(alt, held, {'Idle': [('Idle', 1, None)]}, ALT_KARTE, ('Body', 'pelvis'), griff, seiten=SEITEN)
a_, b_ = spur(probe['Idle']), spur(acts['HELD__Idle'])
versatz = sum(((b_[i]['Head'] - a_[i]['Head']) for i in range(len(a_))), Vector()) / len(a_)
print(f'  VERSATZ am Idle: {tuple(round(x * 100, 1) for x in versatz)} cm')
bpy.data.actions.remove(probe['Idle'])
for tr in list(held.animation_data.nla_tracks):
    held.animation_data.nla_tracks.remove(tr)
# D429: Fällaxt — die linke Hand sitzt je Schlüssel an der Stelle `griff` des Stiels (dazwischen linear), genau auf
# der Stielachse; 'stand' ist der erste Schlüssel der Grundhaltung.
def _stielgriff(n):
    grund, _, schluessel = CLIPS[n]
    aus = []
    for bild, pose in schluessel:
        if pose == 'stand':
            pose = CLIPS[grund][2][0][1] if grund in CLIPS else {}
        aus.append((bild, pose.get('griff', GRIFF['axt'])))
    return aus


STIEL = {n: _stielgriff(n) for n in NEU if n.startswith('Axt_')}
gebaut = uebertrage(alt, held, {n: [(n, 1, None)] for n in NEU + PRUEFE}, ALT_KARTE, ('Body', 'pelvis'), griff,
                    seiten=SEITEN, versatz=versatz, stiel=STIEL)

# 4. Gegenprobe gegen die ausgelieferten Clips.
schlecht = []
for n in PRUEFE:
    neu_, alt_ = spur(gebaut[n]), spur(acts['HELD__' + n])
    m = min(len(neu_), len(alt_))
    fehler = {k: max((neu_[i][k] - alt_[i][k]).length for i in range(m)) for k in MESSPUNKTE}
    if os.environ.get('SPUR'):
        for i in (0, m // 3, m - 1):
            print('    SPUR', n, i + 1, {k: (tuple(round(x, 3) for x in neu_[i][k]), tuple(round(x, 3) for x in alt_[i][k]))
                                       for k in ('hand_r', 'foot_l', 'Head')})
    print(f'  GEGENPROBE {n}: {len(neu_)} gegen {len(alt_)} Bilder; grösster Abstand ' +
          ', '.join(f'{k} {v * 100:.1f} cm' for k, v in fehler.items()))
    if n == 'Idle' and (len(neu_) != len(alt_) or max(fehler.values()) > GRENZE):
        schlecht.append(n)
if schlecht:
    raise SystemExit(f'Gegenprobe fällt: {schlecht} — die Übertragung ist nicht dieselbe wie in heldbau.py')

# 4b. Formprüfung der neuen Clips am Ziel: Zeigt die Klinge in jedem Schlüssel dorthin, wohin `richt` sie stellt?
#     Lage der Waffe an der Hand wie im Spiel (`WAFFE_AN_HELD_HAND`, `src/kampf/waffenhand.ts`): Die Knochen
#     stehen nach dem Import im Raum ihres glTF-Knotens, die Klinge liegt dort auf −Y des Modells.
AN_HAND = Quaternion((0.50394, -0.49601, 0.50396, -0.49602)).normalized().to_matrix()
setze_aktion(held, acts['HELD__Idle'])
bpy.context.scene.frame_set(1)
bpy.context.view_layer.update()
_p = lambda n: held.matrix_world @ held.pose.bones[n].head
rechts = _p('upperarm_r') - _p('upperarm_l'); rechts.z = 0; rechts.normalize()
vorn = Vector((0, 0, 1)).cross(rechts).normalized()
for n in NEU:
    schlimm = (0.0, 0)
    links = 0.0
    for bild, pose in CLIPS[n][2]:
        if pose == 'stand' or 'richt' not in pose:
            continue
        setze_aktion(held, gebaut[n])
        bpy.context.scene.frame_set(bild)
        bpy.context.view_layer.update()
        hand = (held.matrix_world @ held.pose.bones['hand_r'].matrix).to_3x3().normalized()
        klinge = (hand @ AN_HAND @ Vector((0, -1, 0))).normalized()
        r, v, h = pose['richt']
        soll = (rechts * r + vorn * v + Vector((0, 0, h))).normalized()
        w = math.degrees(klinge.angle(soll))
        if w > schlimm[0]:
            schlimm = (w, bild)
        if pose.get('zwei'):
            # linke Hand (Handgelenk) zur Griffachse durch die rechte — wie `greife_links` misst
            g = _p('hand_r'); d = _p('hand_l') - g
            links = max(links, (d - klinge * d.dot(klinge)).length)
            if pose.get('zwei') == 'axt':
                # D429: wo die linke Hand am Stiel sitzt (Soll `griff`, negativ = zum Ende) — die Szene legt das Ende hinein
                print(f'    GRIFF {n} Bild {bild}: links {d.dot(klinge):+.3f} m (Soll {pose.get("griff", GRIFF["axt"]):+.2f}), '
                      f'{(d - klinge * d.dot(klinge)).length * 100:.1f} cm neben der Achse')
            if VORSCHLAG:
                print(f'    FORM {n} Bild {bild}: linkes Handgelenk {(d - klinge * d.dot(klinge)).length * 100:.1f} cm neben der Griffachse')
    print(f'  FORM {n}: Klinge höchstens {schlimm[0]:.1f}° neben `richt` (Bild {schlimm[1]})' +
          (f', linkes Handgelenk bis {links * 100:.1f} cm neben der Griffachse' if links else ''))
setze_aktion(held, None)

# 5. Nur die neuen Clips ausgeben: Armatur ohne Netz, je Clip eine NLA-Spur.
for o in list(bpy.data.objects):
    if o != held:
        bpy.data.objects.remove(o, do_unlink=True)
for tr in list(held.animation_data.nla_tracks):
    held.animation_data.nla_tracks.remove(tr)
for a in list(bpy.data.actions):
    if a.name.startswith('ZIEL__') and a.name[len('ZIEL__'):] in NEU:
        continue
    if VORSCHLAG and a.name.startswith('ZIEL__') and a.name[len('ZIEL__'):] in PRUEFE[1:]:
        a.name = a.name + '_Nachbau'
        continue
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
