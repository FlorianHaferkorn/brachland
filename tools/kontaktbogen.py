"""
BRACHLAND — Prüfbilder für Clips und Waffenmodelle (D414): Einzelbilder je Pose, Cycles auf der CPU, klein.

  blender --background --factory-startup --python tools/kontaktbogen.py -- <figur-roh.glb> <waffen-roh.glb> <ausdir> <auftrag.json>

`auftrag.json`: {"posen": [{"clip", "waffe", "links"?, "bilder": [..], "blick"?, "breite"?, "oben"?, "spur"?}], "reihen": [{"name", "waffen": [..]}]}.
`spur` (D460): Bodenlinie und Fussspur (Knöchelbahn beider Füsse über den ganzen Clip) — für Gangzyklen von der Seite (`blick` 90, `erhoehung` 0).
Die Figur (Gestalt mit allen Clips, `tools/clipnachbau.mjs figur`) bekommt die Waffe an `hand_r` wie im Spiel
(`WAFFE_AN_HELD_HAND`, `src/kampf/waffenhand.ts`). Die Räucherkanne hängt an `hand_l`: Die Lage legt dieses Skript
im ersten Bild von `Geraet_Blasebalg` fest (Kanne aufrecht, Tülle nach vorn, Balg in der Handfläche) und hält sie
dann am Knochen — als Vorschlag für eine spätere `WAFFE_AN_HELD_HAND_LINKS`, gedruckt im Protokoll.

Das ist eine **Formprüfung**: Griff, Handlage, Richtung der Klinge, Füsse am Boden. Keine Look-Abnahme (kein
Spiel-Shader, kein Nebel, kein Licht der Szene), Bewegung nur am M1 (ADR-0005).
"""
import bpy, sys, os, json, math
from mathutils import Matrix, Vector, Quaternion

ARGS = sys.argv[sys.argv.index('--') + 1:]
FIGUR, WAFFEN, AUSDIR, AUFTRAG = ARGS[:4]
auftrag = json.load(open(AUFTRAG))
os.makedirs(AUSDIR, exist_ok=True)

# three.js (Y oben) → Blender (Z oben): p_b = C · p_three. Der Import (Knochenrichtung BLENDER) lässt die Knochen im
# Raum ihres glTF-Knotens; die Modelle dagegen kommen in Blender-Achsen an. Also: Hand · Lage · C⁻¹ · Modell —
# nachgemessen: so zeigt die Klinge in Klinge_Stand, Axt_Quer und Speer_Stand auf 3° genau dorthin, wohin
# `waffenclips.py` sie stellt (mit C · Lage · C⁻¹ lag sie 87° daneben).
C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
q = Quaternion((0.50394, -0.49601, 0.50396, -0.49602)).normalized()      # (w, x, y, z) aus waffenhand.ts
AN_HAND = Matrix.Translation((-0.02204, 0.11643, 0.00679)) @ q.to_matrix().to_4x4() @ Matrix.Scale(0.98399, 4) @ C.inverted()

bpy.ops.wm.read_factory_settings(use_empty=True)
vor = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=FIGUR)
figur = [o for o in bpy.data.objects if o not in vor]
held = next(o for o in figur if o.type == 'ARMATURE')
for o in figur:
    if o.type == 'MESH' and (o.name.startswith('Haar_') and o.name != 'Haar_Buns' or o.name.startswith('Icosphere')):
        o.hide_render = True
acts = {a.name: a for a in bpy.data.actions}
ad = held.animation_data or held.animation_data_create()
for tr in list(ad.nla_tracks):
    ad.nla_tracks.remove(tr)

vor = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=WAFFEN)
waffen = {o.name: o for o in bpy.data.objects if o not in vor and o.type == 'MESH'}
for o in waffen.values():
    o.hide_render = True
modell = {n: o.matrix_world.copy() for n, o in waffen.items()}


def speer():
    """Der Speer ist kein Modell, sondern Code (`baueSpeer`): Eschenschaft 2 m bei y −0,55, Spitze bei −1,68."""
    holz = bpy.data.materials.new('SpeerHolz'); holz.diffuse_color = (0.10, 0.06, 0.035, 1)
    metall = bpy.data.materials.new('SpeerSpitze'); metall.diffuse_color = (0.18, 0.17, 0.16, 1)
    for m, f in ((holz, (0.10, 0.06, 0.035)), (metall, (0.18, 0.17, 0.16))):
        m.use_nodes = True
        m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*f, 1)
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.022, radius2=0.018, depth=2.0, location=(0, 0, -0.55))
    schaft = bpy.context.object; schaft.data.materials.append(holz)
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.04, radius2=0.0, depth=0.26, location=(0, 0, -1.68),
                                    rotation=(math.pi, 0, 0))
    spitze = bpy.context.object; spitze.data.materials.append(metall)
    bpy.ops.object.select_all(action='DESELECT'); schaft.select_set(True); spitze.select_set(True)
    bpy.context.view_layer.objects.active = schaft; bpy.ops.object.join()
    schaft.name = 'Speer'; schaft.hide_render = True
    return schaft


def speer3():
    """Der meisterliche Speer aus `baueSpeer` (D186): dunkler Schaft 2,05 m, breites Blatt (Oktaeder 0,1 × 3,2),
    Knebel, Schuh — nur für das Vorher-Bild, solange `waffen.glb` keinen `Speer3` trägt (vor D421)."""
    holz = bpy.data.materials.new('Speer3Holz'); holz.use_nodes = True
    holz.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.045, 0.025, 0.014, 1)
    messing = bpy.data.materials.new('Speer3Messing'); messing.use_nodes = True
    messing.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.43, 0.26, 0.05, 1)
    stahl = bpy.data.materials.new('Speer3Stahl'); stahl.use_nodes = True
    stahl.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.58, 0.6, 0.63, 1)
    teile = []
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=0.023, radius2=0.019, depth=2.05, location=(0, 0, -0.57))
    teile.append((bpy.context.object, holz))
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.1, location=(0, 0, -1.78))
    o = bpy.context.object; o.scale = (0.75, 0.22, 3.2); teile.append((o, stahl))
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -1.5)); o = bpy.context.object; o.scale = (0.22, 0.03, 0.03)
    teile.append((o, messing))
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.026, radius2=0.0, depth=0.1, location=(0, 0, 0.5))
    teile.append((bpy.context.object, messing))
    for o, m in teile:
        o.data.materials.append(m)
    bpy.ops.object.select_all(action='DESELECT')
    for o, _ in teile:
        o.select_set(True)
    bpy.context.view_layer.objects.active = teile[0][0]
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.join()
    s3 = bpy.context.object; s3.name = 'Speer3'; s3.hide_render = True
    return s3


# Vor D421 war der Speer Code; seit D421 steht die Saufeder in `waffen.glb` — dann gilt die Datei.
if 'Speer' not in waffen:
    waffen['Speer'] = speer()
    modell['Speer'] = Matrix.Identity(4)
if 'Speer3' not in waffen:
    waffen['Speer3'] = speer3()
    modell['Speer3'] = Matrix.Identity(4)

s = bpy.context.scene
s.render.engine = 'CYCLES'
s.cycles.device = 'CPU'
s.cycles.samples = 24
s.cycles.use_denoising = False
s.render.film_transparent = False
s.view_settings.view_transform = 'Standard'
welt = bpy.data.worlds.new('Welt'); s.world = welt
welt.use_nodes = True
welt.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.56, 0.58, 1)
welt.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
sonne = bpy.data.objects.new('Sonne', bpy.data.lights.new('Sonne', 'SUN'))
sonne.data.energy = 3.0
s.collection.objects.link(sonne)
bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, 0))
boden = bpy.context.object
bm_ = bpy.data.materials.new('Boden'); bm_.use_nodes = True
bm_.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.35, 0.34, 0.31, 1)
boden.data.materials.append(bm_)
cam = bpy.data.objects.new('Kamera', bpy.data.cameras.new('Kamera'))
s.collection.objects.link(cam)
s.camera = cam
cam.data.type = 'ORTHO'


def welt_pkt(knochen):
    return held.matrix_world @ held.pose.bones[knochen].head


def setze(clip, bild):
    akt = acts[clip]
    ad.action = akt
    if hasattr(ad, 'action_slot') and akt.slots:
        ad.action_slot = akt.slots[0]
    s.frame_set(bild)
    bpy.context.view_layer.update()


# Blickrichtung der Figur aus der Ruhe: rechts = Schulterlinie, vorn = oben × rechts (wie `waffenclips.Rig`).
setze('Idle', 1)
rechts = welt_pkt('upperarm_r') - welt_pkt('upperarm_l'); rechts.z = 0; rechts.normalize()
vorn = Vector((0, 0, 1)).cross(rechts).normalized()
fuss = (welt_pkt('foot_l') + welt_pkt('foot_r')) / 2
mitte = Vector((fuss.x, fuss.y, 0))


def kamera(blick_grad, breite, hoehe_mitte, b, h, erhoehung=0.6, ziel=None, oben=False):
    """Blick von vorn-rechts (`blick_grad` um die Hochachse aus der Blickrichtung der Figur), orthografisch.
    `ziel` (Welt, D429): Bildmitte statt über dem Standpunkt — fürs Nahbild der Hände. `oben` (D456): senkrecht von
    oben, die Blickrichtung der Figur zeigt im Bild nach oben (Fussarbeit, Bogen der Waffe, Drehung der Schultern)."""
    r = math.radians(blick_grad)
    richtung = (vorn * math.cos(r) + rechts * math.sin(r)).normalized()
    ziel = ziel if ziel is not None else mitte + Vector((0, 0, hoehe_mitte))
    if oben:
        ziel = mitte + vorn * 0.35
        cam.location = ziel + Vector((0, 0, 6))
        # Bild-oben = vorn, Bild-rechts = rechts der Figur
        cam.rotation_euler = Matrix((rechts, vorn, Vector((0, 0, 1)))).transposed().to_euler()
        cam.data.ortho_scale = breite
        s.render.resolution_x, s.render.resolution_y = b, h
        sonne.rotation_euler = (vorn * 0.5 + rechts * -0.6 + Vector((0, 0, 1.4))).to_track_quat('Z', 'Y').to_euler()
        return
    cam.location = ziel + richtung * 6 + Vector((0, 0, erhoehung))
    cam.rotation_euler = (ziel - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.data.ortho_scale = breite
    s.render.resolution_x, s.render.resolution_y = b, h
    sonne.rotation_euler = (richtung + rechts * -0.8 + Vector((0, 0, 1.4))).to_track_quat('Z', 'Y').to_euler()


LINKS_LAGE = None


def lege_links(name):
    """Kanne an `hand_l`: im ersten Bild von Geraet_Blasebalg aufrecht, Tülle nach vorn, Balg in der Hand."""
    global LINKS_LAGE
    if LINKS_LAGE is None:
        setze('Geraet_Blasebalg', 1)
        hand = held.matrix_world @ held.pose.bones['hand_l'].matrix
        finger = (welt_pkt('middle_01_l') - welt_pkt('hand_l'))
        griff = welt_pkt('hand_l') + finger * 0.75
        # Modell: Kanne +Z, Tülle −Y, Balg bei −x am Ursprung. Ziel: +Z = oben, −Y = vorn.
        zb = Vector((0, 0, 1)); yb = -vorn; xb = yb.cross(zb)
        soll = Matrix((xb, yb, zb)).transposed().to_4x4()
        # Der Balg liegt in der Handfläche: Ursprung ein paar Zentimeter zur Daumenseite (innen) versetzt.
        soll.translation = griff + rechts * 0.035
        LINKS_LAGE = hand.inverted() @ soll
        l = LINKS_LAGE @ C          # im Knotenraum von hand_l, Modell in three-Achsen — so liest es three.js
        w, x, y, z = l.to_quaternion()
        print('  VORSCHLAG WAFFE_AN_HELD_HAND_LINKS (three, an hand_l): position',
              tuple(round(v, 5) for v in l.to_translation()), 'drehung (x, y, z, w)', tuple(round(v, 5) for v in (x, y, z, w)))
    return LINKS_LAGE


def gleite(o, lage, modell_lage):
    """D429: wie `gleiteAmStiel` (`src/kampf/waffenhand.ts`) — die Fällaxt so entlang ihrer Achse schieben, dass ihr
    Stielende (`griff_links` hinter der rechten Hand) in der linken liegt. Gemessen im Raum des Modells in Metern
    (`lage` = Hand · Lage, vor der Knotenlage des Modells, die die Quantisierung trägt); dort ist three +Y Blender +Z.
    Rückgabe: Verschiebung in Metern des Modells."""
    links = o.get('griff_links')
    if links is None:
        return 0.0
    inv = lage.inverted()
    r = inv @ (held.matrix_world @ held.pose.bones['hand_r'].head)
    l = inv @ (held.matrix_world @ held.pose.bones['hand_l'].head)
    entlang, quer = l.z - r.z, math.hypot(l.x - r.x, l.y - r.y)
    fest, los, faeuste = 0.04, 0.1, 0.08
    gefasst = min(1, max(0, (los - quer) / (los - fest))) * min(1, max(0, (entlang - faeuste / 2) / (faeuste / 2)))
    t = gefasst * max(faeuste - links, min(0.0, entlang - links))
    o.matrix_world = lage @ Matrix.Translation((0, 0, t)) @ modell_lage
    return t


def zeige(waffe, links):
    for o in waffen.values():
        o.hide_render = True
    if waffe:
        o = waffen[waffe]
        hand = held.matrix_world @ held.pose.bones['hand_r'].matrix
        o.matrix_world = hand @ AN_HAND @ modell[waffe]
        bpy.context.view_layer.update()
        t = gleite(o, hand @ AN_HAND, modell[waffe])
        if t:
            print(f'  GLEITEN {waffe}: rechte Hand {-t * 100:.0f} cm zum Stielende')
        o.hide_render = False
    if links:
        o = waffen[links]
        lage = lege_links(links)
        hand = held.matrix_world @ held.pose.bones['hand_l'].matrix
        o.matrix_world = hand @ lage @ modell[links]
        o.hide_render = False


SPUR = []


def fussspur(clip):
    """D460: Bodenlinie und Fussspur für Gangzyklen von der Seite — die Knöchelbahn beider Füsse über den ganzen Clip als
    Punktreihe (links warm, rechts kalt; wo der Fuss am Boden ist, liegen die Punkte auf einer Geraden) und ein dunkler
    Strich auf Höhe der Sohle (tiefster Ballen des Clips). Der Boden der Szene liegt bei Blick von der Seite auf Kante."""
    for o in SPUR:
        bpy.data.objects.remove(o, do_unlink=True)
    SPUR.clear()
    akt = acts[clip]
    f0, f1 = (int(round(x)) for x in akt.frame_range)
    farben = {'foot_l': (0.9, 0.35, 0.05), 'foot_r': (0.05, 0.3, 0.9)}
    mats = {}
    for k, f in farben.items():
        m = bpy.data.materials.new('Spur_' + k); m.use_nodes = True
        bsdf = m.node_tree.nodes['Principled BSDF']
        bsdf.inputs['Base Color'].default_value = (*f, 1)
        bsdf.inputs['Emission Color'].default_value = (*f, 1)
        bsdf.inputs['Emission Strength'].default_value = 1.5
        mats[k] = m
    tief = 1e9
    for i in range((f1 - f0) * 2 + 1):
        bild = f0 + i / 2
        s.frame_set(int(bild), subframe=bild - int(bild))
        bpy.context.view_layer.update()
        tief = min(tief, welt_pkt('ball_l').z, welt_pkt('ball_r').z)
        for k in farben:
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.012, location=welt_pkt(k) + rechts * 0.25)
            o = bpy.context.object; o.data.materials.append(mats[k]); SPUR.append(o)
    dunkel = bpy.data.materials.new('Bodenlinie'); dunkel.use_nodes = True
    dunkel.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.02, 0.02, 0.02, 1)
    bpy.ops.mesh.primitive_cube_add(size=1, location=mitte + rechts * 0.3 + Vector((0, 0, tief - 0.024 - 0.006)))
    o = bpy.context.object
    o.scale = (abs(vorn.x) * 4 + abs(rechts.x) * 0.9 + 0.001, abs(vorn.y) * 4 + abs(rechts.y) * 0.9 + 0.001, 0.012)
    o.data.materials.append(dunkel); SPUR.append(o)
    boden.hide_render = True


for job in auftrag.get('posen', []):
    if job.get('links'):
        lege_links(job['links'])
    boden.hide_render = False
    for o in SPUR:
        bpy.data.objects.remove(o, do_unlink=True)
    SPUR.clear()
    if job.get('spur'):
        setze(job['clip'], 1)
        fussspur(job['clip'])
    kamera(job.get('blick', 35), job.get('breite', 2.6), 0.95, 300, 420, job.get('erhoehung', 0.6), oben=job.get('oben', False))
    for bild in job['bilder']:
        setze(job['clip'], bild)
        zeige(job.get('waffe'), job.get('links'))
        if job.get('nah'):
            # D429: Nahbild der Hände — Bildmitte zwischen beiden Händen
            haende = (welt_pkt('hand_r') + welt_pkt('hand_l')) / 2
            kamera(job.get('blick', 35), job.get('breite', 0.8), 0, 300, 420, job.get('erhoehung', 0.6), ziel=haende)
        held.hide_render = False
        for o in figur:
            if o.type == 'MESH' and not o.name.startswith(('Haar_', 'Icosphere')):
                o.hide_render = False
        s.render.filepath = os.path.join(AUSDIR, f"{job['name']}_{bild:02d}.png")
        bpy.ops.render.render(write_still=True)
        print('  BILD', s.render.filepath)

# Waffenreihe: alle Modelle aufrecht nebeneinander, Griff unten, gleiche Kamera für Vorher und Nachher.
for reihe in auftrag.get('reihen', []):
    for o in figur:
        o.hide_render = True
    for o in waffen.values():
        o.hide_render = True
    for i, name in enumerate(reihe['waffen']):
        if name not in waffen:
            continue
        o = waffen[name]
        dreh = Matrix.Rotation(math.pi, 4, 'X')        # Klinge (−Z) nach oben
        # Die Kamera schaut der Figur ins Gesicht: ihr rechts ist im Bild links — also von rechts nach links legen,
        # damit die Reihe im Bild von links nach rechts liest. Dann auf den Boden stellen (tiefster Punkt z = 0).
        o.matrix_world = Matrix.Translation(mitte - rechts * (reihe.get("start", -1.4) + 0.4 * i)) @ dreh @ modell[name]
        bpy.context.view_layer.update()
        unten = min((o.matrix_world @ Vector(b)).z for b in o.bound_box)
        o.matrix_world = Matrix.Translation((0, 0, -unten)) @ o.matrix_world
        o.hide_render = False
    kamera(0, reihe.get('breite', 3.8), reihe.get('mitte', 1.12), 960, 600)
    s.render.filepath = os.path.join(AUSDIR, f"{reihe['name']}.png")
    bpy.ops.render.render(write_still=True)
    print('  BILD', s.render.filepath)
