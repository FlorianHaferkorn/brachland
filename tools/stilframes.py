"""
BRACHLAND — Stil-Frames (D369): dieselbe Einstellung der Felsmulde (Zielbild, ADR-0006) in drei Stilen.

    # 1) Szene bauen und einmal rendern, Pässe als Multilayer-EXR (Bild, Tiefe, Normale, Nebel, Objektindex):
    blender --background --python tools/stilframes.py -- render <objdir> <aus.exr> [breite hoehe samples]
    # 2) Stil im Compositor aus demselben EXR (schnell, keine Szene):
    blender --background --factory-startup --python tools/stilframes.py -- stil <ein.exr> <roh|gemalt|grafisch|reduziert|aframe|zielbild|zielbild3|zielbild4> <aus.png> [breite hoehe]

Ein Render, drei Stile: der Vergleich zeigt nur den Stil, nicht Unterschiede in Geometrie oder Licht. Grundlage ist
`tools/szenenbau.py` (Terrain aus `tools/terrainexport.ts`, Motive prozedural). Befall-Punkte in der Signalfarbe
(`palette.ts` befall.signal) liegen am Mauerfuss, weil die Art Direction genau eine Signalfarbe für Befall vorsieht.

A-Frame (D371, ADR-0018 „Substanz real, Darstellung gemalt“): dieselbe Felsmulde, aber mit realer Substanz —

    # 3) A-Frame: Szene mit Scans, Spielbäumen und gestaltetem Licht, je Kamera ein Multilayer-EXR:
    blender --background --python tools/stilframes.py -- aframe <objdir> <aus-praefix> [breite hoehe samples kameras]
    #    kameras = bogen,nah (bogen = Einstellung aus D369, nah = Becken und Platten in der Lichtbahn des Bogens)
    # 4) Darstellung: Pinselflächen nach Tiefe gewichtet (nah lesbar, fern Flächen), Tonkurve, Bloom:
    blender --background --factory-startup --python tools/stilframes.py -- stil <ein.exr> aframe <aus.png> [breite hoehe]

Zielbild Runde 2 (D372, Flo: „rau und verwittert“): Mauer als Scan-Mauerwerk mit starker Verschiebung, Bodenmischung,
Bewuchs in Polstern, Scan-Bäume im Nahbereich, Wolkenhimmel, Bergkulissen —

    # 5) einmalig: grosse Scan-Bäume aus glTF in .blend umwandeln (der glTF-Import braucht ~10 GB, das Anhängen nicht):
    blender --background --factory-startup --python tools/stilframes.py -- scanblend jacaranda_tree,fir_sapling
    # 6) Zielbild: kameras = ziel (Hauptbild), mauer, boden (Nahaufnahmen), bogen (Einstellung D369/D371), nah
    blender --background --python tools/stilframes.py -- zielbild <objdir> <aus-praefix> [breite hoehe samples kameras]
    blender --background --factory-startup --python tools/stilframes.py -- stil <ein.exr> zielbild <aus.png> [breite hoehe]
    #    Stellschrauben (Umgebung): ZIELBILD_AZ/EL (Sonne), ZIELBILD_SONNE/FUELL/HIMMEL (Stärken), ZIELBILD_HIMMELDREH,
    #    ZIELBILD_EV (Belichtung im Stil), ZIELBILD_TEXTUR (Texturgrenze), ZIELBILD_KRONE=0 (ohne Scan-Bäume, wenig Speicher)

Zielbild Runde 3 (D382, Flo: „noch eine Runde Felsmulde“ auf dem Niveau des Haus-Bildes D373): gleiche Mauer und
Kamera wie D372, aber Licht/Himmel/Stil nach `hausframe.py` (Sonne 14° hoch, ~100° zur Blickrichtung, HDRI füllt und
ist sichtbar, Luftschichten aus der Tiefe im Stil statt Talnebel-Volumen), vier gestaffelte Bergrücken, dunkler
Mischboden mit Streu aus Geometrie (Laub, Äste, Wurzeln, Rinde), Scan-Bäume `island_tree_01/02` und `tree_small_02`
auch in der Ferne, Efeu aus Blattgeometrie (`hausframe.efeublatt`/`streu_gn`), Masse rechts —

    # 7) wie 6), Modus und Stil heissen `zielbild3`:
    blender --background --python tools/stilframes.py -- zielbild3 <objdir> <aus-praefix> [breite hoehe samples kameras]
    blender --background --factory-startup --python tools/stilframes.py -- stil <ein.exr> zielbild3 <aus.png> [breite hoehe]
    #    zusätzlich: ZIELBILD_SICHT (Sichtweite der Luftschichten in m), ZIELBILD_DUNST (Dunstfarbe r,g,b)

Zielbild Runde 4 (D386): baut auf Runde 3 auf — Alpha-Karten der Pflanzen-Scans (behebt die „schwarzen Halme“: das
glTF von Poly Haven hat ein Farbbild ohne Alphakanal), Bergrücken mit Kronen-Silhouette und Wald/Wiese/Fels-Flecken in
vier festen Höhenbändern, Blick 3° tiefer und höhere Kronen (weniger Himmel), Mauer dunkler, Moos auf den Kronen als
Polster-Geometrie, Mauerrest rechts als Ruine mit Versturz, Trittspur über Erde statt Platten —

    # 8) einmalig die Alpha-Karten laden, dann wie 7) mit Modus und Stil `zielbild4`:
    blender --background --factory-startup --python tools/stilframes.py -- alphakarten
    blender --background --python tools/stilframes.py -- zielbild4 <objdir> <aus-praefix> [breite hoehe samples kameras]
    blender --background --factory-startup --python tools/stilframes.py -- stil <ein.exr> zielbild4 <aus.png> [breite hoehe]
    #    zusätzlich: ZIELBILD_BLICK (Blickpunkt Hauptkamera x,y,z), ZIELBILD_BODEN_ORT / ZIELBILD_BODEN_BLICK (Nahaufnahme)

Scans (Poly Haven, CC0) liegen nicht im Repo, sondern unter `.cache/cc0/<name>/` (Umgebung `BRACHLAND_CC0` oder
der nächste Elternordner mit `.cache/cc0`); welche, steht im Ledger D371, D372, D382 und D386. Die Bäume sind die Spielbäume
(`public/props/baum-*-nah|mittel.glb`, Rinde `public/material/rinde-*`), damit das Zielbild zeigt, was das Spiel zeigt.
"""
import bpy, bmesh, sys, os, math, random, json
from mathutils import Vector, Matrix, Euler, noise

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
MODUS = ARGS[0] if ARGS else ''
R5 = MODUS == 'zielbild5' or (MODUS == 'stil' and len(ARGS) > 2 and ARGS[2] == 'zielbild5')   # Runde 5 (D418): Tümpel mit natürlichem Ufer, baut auf Runde 4 auf
R4 = R5 or MODUS == 'zielbild4' or (MODUS == 'stil' and len(ARGS) > 2 and ARGS[2] == 'zielbild4')   # Runde 4 (D386), baut auf Runde 3 auf
R3 = R4 or MODUS == 'zielbild3' or (MODUS == 'stil' and len(ARGS) > 2 and ARGS[2] == 'zielbild3')   # Runde 3 (D382)
SIGNAL = (0.62, 0.81, 0.89)   # '#cfe9f2' linear grob
AFRAME_EV = float(os.environ.get('AFRAME_EV', '0.2'))   # Belichtung im Stil aframe (EV), die Anzeige-Belichtung ist im Compositor fest


def befall(zt):
    """Pilz-Biolicht-Punkte am Mauerfuss und auf Blöcken: Pass-Index 7 für die Maske."""
    m = bpy.data.materials.new('Befall'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*SIGNAL, 1); em.inputs['Strength'].default_value = 9.0
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    random.seed(369)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1)
    proto = bpy.context.object; proto.data.materials.append(m); proto.hide_render = True
    for cx, cy, cz, n in ((4.3, -2.6, zt - 0.1, 14), (4.3, 3.9, zt + 0.1, 10), (2.0, -4.5, zt - 0.2, 8), (4.4, 0.8, zt + 1.6, 6)):
        for _ in range(n):
            o = proto.copy(); o.hide_render = False; bpy.context.collection.objects.link(o)
            r = 0.02 + random.random() * 0.05
            o.scale = (r, r, r * 0.7)
            o.location = (cx + random.uniform(-0.25, 0.25), cy + random.uniform(-0.6, 0.6), cz + random.uniform(0, 0.5))
            o.pass_index = 7


def render():
    objdir, aus = ARGS[1], ARGS[2]
    breite, hoehe, samples = (int(ARGS[3]), int(ARGS[4]), int(ARGS[5])) if len(ARGS) > 5 else (1280, 720, 24)
    sys.argv = [sys.argv[0], '--', objdir, '/tmp/claude-0/stil.blend', '/tmp/claude-0/stil-roh.png', 'schnell', 'felsmulde']
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import szenenbau as sb

    def rendern(sc, _b, _h, _s, _p):
        befall(sb.bodenhoehe(-2.0, -1.0))
        sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'
        sc.cycles.samples = samples; sc.cycles.use_adaptive_sampling = True; sc.cycles.adaptive_threshold = 0.03
        sc.cycles.use_denoising = True
        sc.cycles.max_bounces = 4; sc.cycles.diffuse_bounces = 2; sc.cycles.glossy_bounces = 1
        sc.cycles.transmission_bounces = 4; sc.cycles.volume_bounces = 0; sc.cycles.transparent_max_bounces = 8
        sc.cycles.volume_step_rate = 4.0; sc.cycles.volume_max_steps = 64
        sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = breite, hoehe, 100
        sc.view_settings.view_transform = 'AgX'
        try: sc.view_settings.look = 'AgX - Medium High Contrast'
        except Exception: pass
        sc.view_settings.exposure = 1.3
        vl = sc.view_layers[0]
        vl.use_pass_z = vl.use_pass_normal = vl.use_pass_mist = vl.use_pass_object_index = True
        sc.world.mist_settings.start = 4.0; sc.world.mist_settings.depth = 600.0; sc.world.mist_settings.falloff = 'QUADRATIC'
        try: sc.render.image_settings.media_type = 'MULTI_LAYER_IMAGE'
        except Exception as e: print('media_type', e)
        sc.render.image_settings.file_format = 'OPEN_EXR_MULTILAYER'; sc.render.image_settings.color_depth = '16'
        sc.render.filepath = os.path.abspath(aus)
        bpy.ops.render.render(write_still=True)
    sb.rendern = rendern
    sb.bauen()


# =====================================================================================================================
# A-Frame (D371): reale Substanz
# =====================================================================================================================
HIER = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HIER)


def cc0_ordner():
    """Scans liegen ausserhalb des Repos (gross, nicht versioniert): `BRACHLAND_CC0` oder der nächste `.cache/cc0`
    aufwärts — so findet ein Worktree unter `.claude/worktrees/` den Cache des Haupt-Repos."""
    if os.environ.get('BRACHLAND_CC0'):
        return os.environ['BRACHLAND_CC0']
    p = REPO
    while True:
        k = os.path.join(p, '.cache', 'cc0')
        if os.path.isdir(k): return k
        if os.path.dirname(p) == p: raise SystemExit('kein .cache/cc0 gefunden — Scans laden (Ledger D371)')
        p = os.path.dirname(p)


def scan(name, karte):
    """Pfad einer Scan-Karte: `.cache/cc0/<name>/<name>_<karte>_2k.jpg` (Poly-Haven-Namensschema)."""
    o = os.path.join(cc0_ordner(), name)
    for f in sorted(os.listdir(o)):
        if f.startswith(name + '_' + karte) and f.endswith('.jpg'): return os.path.join(o, f)
    raise SystemExit('Karte fehlt: %s %s' % (name, karte))


def bild(pfad, farbe=True, packung=False):
    im = bpy.data.images.load(pfad, check_existing=True)
    if not farbe: im.colorspace_settings.name = 'Non-Color'
    if packung: im.alpha_mode = 'CHANNEL_PACKED'   # Alpha trägt Höhe/Rauheit, keine Deckkraft
    return im


def N(nt, typ, ort=(0, 0), **eing):
    n = nt.nodes.new(typ); n.location = ort
    for k, v in eing.items():
        if k in n.inputs: n.inputs[k].default_value = v
        else: setattr(n, k, v)
    return n


def L(nt, a, b):
    nt.links.new(a, b)


def kachel(nt, vec, pfad, farbe=True, ort=(0, 0), blend=0.3, packung=False):
    """Bildtextur mit Box-Projektion (keine UV nötig: Steine, Bäume und Boden haben keine)."""
    t = N(nt, 'ShaderNodeTexImage', ort); t.image = bild(pfad, farbe, packung)
    t.projection = 'BOX'; t.projection_blend = blend; t.interpolation = 'Cubic'
    L(nt, vec, t.inputs['Vector'])
    return t


def neues_material(name):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = N(nt, 'ShaderNodeOutputMaterial', (1400, 0))
    return m, nt, out


def mat_stein_scan(name, art='mossy_rock', skala=1.4, versatz=0.035, moos=1.0, hell=1.0, moos_oben=0.55):
    """Feldstein aus dem Scan: Farbe, Rauheit und Höhe (echte Verschiebung, adaptive Unterteilung) je Stein
    versetzt (Random per Island), damit kein Stein den Nachbarn wiederholt. Kanten abgenutzt (heller, aus Bevel
    gegen Normale), Moos oben und in den Höhlungen (AO lokal) — dort, wo Wasser steht und Erde liegt."""
    m, nt, out = neues_material(name)
    m.displacement_method = 'BOTH'
    tc = N(nt, 'ShaderNodeTexCoord', (-1800, 0)); geo = N(nt, 'ShaderNodeNewGeometry', (-1800, -300))
    komb = N(nt, 'ShaderNodeCombineXYZ', (-1700, -200)); L(nt, geo.outputs['Random Per Island'], komb.inputs['X'])
    m2 = N(nt, 'ShaderNodeMath', (-1800, -150), operation='MULTIPLY', ); m2.inputs[1].default_value = 7.3; L(nt, geo.outputs['Random Per Island'], m2.inputs[0]); L(nt, m2.outputs[0], komb.inputs['Y'])
    m3 = N(nt, 'ShaderNodeMath', (-1800, -100), operation='MULTIPLY', ); m3.inputs[1].default_value = 3.1; L(nt, geo.outputs['Random Per Island'], m3.inputs[0]); L(nt, m3.outputs[0], komb.inputs['Z'])
    sk = N(nt, 'ShaderNodeVectorMath', (-1550, -150), operation='SCALE'); sk.inputs['Scale'].default_value = 13.0; L(nt, komb.outputs[0], sk.inputs[0])
    mp = N(nt, 'ShaderNodeMapping', (-1400, 0)); mp.inputs['Scale'].default_value = (1 / skala,) * 3
    L(nt, tc.outputs['Object'], mp.inputs['Vector']); L(nt, sk.outputs[0], mp.inputs['Location'])
    dif = kachel(nt, mp.outputs[0], scan(art, 'diff'), True, (-1100, 300))
    rau = kachel(nt, mp.outputs[0], scan(art, 'rough'), False, (-1100, 0))
    hoe = kachel(nt, mp.outputs[0], scan(art, 'disp'), False, (-1100, -300))
    # Farbvarianz je Stein: Helligkeit ±15 %, Ton leicht wärmer/kühler
    hs = N(nt, 'ShaderNodeHueSaturation', (-800, 300)); L(nt, dif.outputs['Color'], hs.inputs['Color'])
    mr = N(nt, 'ShaderNodeMapRange', (-1000, 500)); mr.inputs['To Min'].default_value = 0.82 * hell; mr.inputs['To Max'].default_value = 1.12 * hell
    L(nt, geo.outputs['Random Per Island'], mr.inputs['Value']); L(nt, mr.outputs[0], hs.inputs['Value'])
    mh = N(nt, 'ShaderNodeMapRange', (-1000, 650)); mh.inputs['To Min'].default_value = 0.485; mh.inputs['To Max'].default_value = 0.515
    L(nt, m3.outputs[0], mh.inputs['Value']); mh.inputs['From Max'].default_value = 3.1; L(nt, mh.outputs[0], hs.inputs['Hue'])
    hs.inputs['Saturation'].default_value = 0.85
    # Kantenabnutzung: Bevel-Normale weicht an Kanten von der Flächennormale ab
    bev = N(nt, 'ShaderNodeBevel', (-1100, -600)); bev.inputs['Radius'].default_value = 0.035; bev.samples = 4
    dot = N(nt, 'ShaderNodeVectorMath', (-900, -600), operation='DOT_PRODUCT'); L(nt, bev.outputs[0], dot.inputs[0]); L(nt, geo.outputs['Normal'], dot.inputs[1])
    kante = N(nt, 'ShaderNodeMapRange', (-700, -600)); kante.inputs['From Min'].default_value = 0.985; kante.inputs['From Max'].default_value = 0.88
    L(nt, dot.outputs['Value'], kante.inputs['Value'])
    kn = N(nt, 'ShaderNodeTexNoise', (-900, -800)); kn.inputs['Scale'].default_value = 9.0; kn.inputs['Detail'].default_value = 4; L(nt, tc.outputs['Object'], kn.inputs['Vector'])
    km = N(nt, 'ShaderNodeMath', (-500, -650), operation='MULTIPLY'); L(nt, kante.outputs[0], km.inputs[0])
    kr = N(nt, 'ShaderNodeMapRange', (-700, -800)); kr.inputs['From Min'].default_value = 0.4; kr.inputs['From Max'].default_value = 0.6; L(nt, kn.outputs['Fac'], kr.inputs['Value']); L(nt, kr.outputs[0], km.inputs[1])
    hellk = N(nt, 'ShaderNodeMix', (-500, 300), data_type='RGBA', blend_type='SCREEN'); L(nt, km.outputs[0], hellk.inputs[0])
    hellk.inputs[0].default_value = 0.0; L(nt, hs.outputs[0], hellk.inputs[6]); hellk.inputs[7].default_value = (0.30, 0.28, 0.25, 1)
    # Höhlungen: lokale Umgebungsverdeckung — Fugen und Bruchkanten werden dunkel und moosig
    ao = N(nt, 'ShaderNodeAmbientOcclusion', (-1100, -1000)); ao.inputs['Distance'].default_value = 0.22; ao.only_local = True; ao.samples = 8
    hoehl = N(nt, 'ShaderNodeMapRange', (-900, -1000)); hoehl.inputs['From Min'].default_value = 0.85; hoehl.inputs['From Max'].default_value = 0.35
    L(nt, ao.outputs['AO'], hoehl.inputs['Value'])
    sep = N(nt, 'ShaderNodeSeparateXYZ', (-1100, -1200)); L(nt, geo.outputs['Normal'], sep.inputs[0])
    oben = N(nt, 'ShaderNodeMapRange', (-900, -1200)); oben.inputs['From Min'].default_value = moos_oben; oben.inputs['From Max'].default_value = 0.95
    L(nt, sep.outputs['Z'], oben.inputs['Value'])
    mn = N(nt, 'ShaderNodeTexNoise', (-1100, -1400)); mn.inputs['Scale'].default_value = 2.2; mn.inputs['Detail'].default_value = 6; mn.inputs['Roughness'].default_value = 0.65; L(nt, tc.outputs['Object'], mn.inputs['Vector'])
    mmax = N(nt, 'ShaderNodeMath', (-700, -1100), operation='MAXIMUM'); L(nt, hoehl.outputs[0], mmax.inputs[0]); L(nt, oben.outputs[0], mmax.inputs[1])
    mmul = N(nt, 'ShaderNodeMath', (-550, -1100), operation='MULTIPLY'); L(nt, mmax.outputs[0], mmul.inputs[0]); L(nt, mn.outputs['Fac'], mmul.inputs[1])
    mskal = N(nt, 'ShaderNodeMath', (-400, -1100), operation='MULTIPLY'); mskal.inputs[1].default_value = 1.7 * moos; L(nt, mmul.outputs[0], mskal.inputs[0])
    mkante = N(nt, 'ShaderNodeMapRange', (-250, -1100)); mkante.inputs['From Min'].default_value = 0.42; mkante.inputs['From Max'].default_value = 0.62
    L(nt, mskal.outputs[0], mkante.inputs['Value'])
    # Moosfarbe: zwei Grüntöne, Rauschen grob genug, dass es nicht flimmert (Kissen, keine Pixel)
    mf = N(nt, 'ShaderNodeTexNoise', (-700, -1400)); mf.inputs['Scale'].default_value = 18.0; mf.inputs['Detail'].default_value = 3; L(nt, tc.outputs['Object'], mf.inputs['Vector'])
    mr2 = N(nt, 'ShaderNodeValToRGB', (-500, -1400)); e = mr2.color_ramp.elements
    e[0].position = 0.3; e[0].color = (0.055, 0.085, 0.022, 1); e[1].position = 0.75; e[1].color = (0.085, 0.115, 0.028, 1) if R3 else (0.20, 0.25, 0.06, 1)   # Runde 3: im Sonnenlicht kein Neongrün
    L(nt, mf.outputs['Fac'], mr2.inputs['Fac'])
    dunkel = N(nt, 'ShaderNodeMix', (-250, 300), data_type='RGBA', blend_type='MULTIPLY'); L(nt, hoehl.outputs[0], dunkel.inputs[0])
    L(nt, hellk.outputs[2], dunkel.inputs[6]); dunkel.inputs[7].default_value = (0.45, 0.42, 0.38, 1)
    farbe = N(nt, 'ShaderNodeMix', (0, 300), data_type='RGBA'); L(nt, mkante.outputs[0], farbe.inputs[0]); L(nt, dunkel.outputs[2], farbe.inputs[6]); L(nt, mr2.outputs[0], farbe.inputs[7])
    b = N(nt, 'ShaderNodeBsdfPrincipled', (600, 0)); L(nt, farbe.outputs[2], b.inputs['Base Color'])
    rmix = N(nt, 'ShaderNodeMix', (300, 0)); rmix.data_type = 'FLOAT'; L(nt, mkante.outputs[0], rmix.inputs[0]); L(nt, rau.outputs['Color'], rmix.inputs[2]); rmix.inputs[3].default_value = 1.0
    L(nt, rmix.outputs[0], b.inputs['Roughness'])
    # Feinform als Bump (unter der Dicing-Rate), Grobform als echte Verschiebung
    bump = N(nt, 'ShaderNodeBump', (300, -300)); bump.inputs['Strength'].default_value = 0.5; bump.inputs['Distance'].default_value = 0.01
    L(nt, hoe.outputs['Color'], bump.inputs['Height']); L(nt, bump.outputs['Normal'], b.inputs['Normal'])
    hsum = N(nt, 'ShaderNodeMath', (600, -500), operation='MULTIPLY_ADD'); L(nt, mkante.outputs[0], hsum.inputs[0]); hsum.inputs[1].default_value = 0.18; L(nt, hoe.outputs['Color'], hsum.inputs[2])
    dsp = N(nt, 'ShaderNodeDisplacement', (900, -400)); dsp.inputs['Midlevel'].default_value = 0.5; dsp.inputs['Scale'].default_value = versatz
    L(nt, hsum.outputs[0], dsp.inputs['Height'])
    L(nt, b.outputs[0], out.inputs['Surface']); L(nt, dsp.outputs[0], out.inputs['Displacement'])
    return m


def mat_kern_scan():
    """Mauerkern hinter den Fugen: Erde und Mörtelreste, dunkel, mit Laubstreu-Form statt glattem Kasten."""
    m, nt, out = neues_material('Kern')
    tc = N(nt, 'ShaderNodeTexCoord', (-900, 0)); mp = N(nt, 'ShaderNodeMapping', (-700, 0)); mp.inputs['Scale'].default_value = (1 / 1.5,) * 3
    L(nt, tc.outputs['Object'], mp.inputs['Vector'])
    dif = kachel(nt, mp.outputs[0], scan('forest_leaves_04', 'diff'), True, (-400, 200))
    hoe = kachel(nt, mp.outputs[0], scan('forest_leaves_04', 'disp'), False, (-400, -200))
    mul = N(nt, 'ShaderNodeMix', (-100, 200), data_type='RGBA', blend_type='MULTIPLY'); mul.inputs[0].default_value = 1.0
    L(nt, dif.outputs['Color'], mul.inputs[6]); mul.inputs[7].default_value = (0.34, 0.31, 0.27, 1)   # D411: Kalkmörtelreste und Erde, nicht schwarz
    hs = N(nt, 'ShaderNodeHueSaturation', (100, 200)); hs.inputs['Saturation'].default_value = 0.45; L(nt, mul.outputs[2], hs.inputs['Color'])
    b = N(nt, 'ShaderNodeBsdfPrincipled', (300, 0)); L(nt, hs.outputs[0], b.inputs['Base Color']); b.inputs['Roughness'].default_value = 0.95
    bump = N(nt, 'ShaderNodeBump', (0, -200)); bump.inputs['Strength'].default_value = 0.8; L(nt, hoe.outputs['Color'], bump.inputs['Height']); L(nt, bump.outputs[0], b.inputs['Normal'])
    L(nt, b.outputs[0], out.inputs['Surface'])
    return m


def mat_boden_scan(alt):
    """Waldboden: Laubstreu-Scans (zwei, nach Rauschen gemischt) mit echter Verschiebung im Nahbereich;
    nach aussen läuft die Biomfarbe des Spiels (`alt`, Vertexfarbe) weiter — Ferne ist Fläche, nicht Scan."""
    m = alt; nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    alt_farbe = bsdf.inputs['Base Color'].links[0].from_socket if bsdf.inputs['Base Color'].links else None
    alt_norm = bsdf.inputs['Normal'].links[0].from_socket if bsdf.inputs['Normal'].links else None
    m.displacement_method = 'BOTH'
    x0 = -2600
    tc = N(nt, 'ShaderNodeTexCoord', (x0, -1400))
    mp = N(nt, 'ShaderNodeMapping', (x0 + 200, -1400)); mp.inputs['Scale'].default_value = (1 / 3.0,) * 3; L(nt, tc.outputs['Object'], mp.inputs['Vector'])
    mp2 = N(nt, 'ShaderNodeMapping', (x0 + 200, -1800)); mp2.inputs['Scale'].default_value = (1 / 1.5,) * 3; mp2.inputs['Rotation'].default_value = (0, 0, 0.7)
    L(nt, tc.outputs['Object'], mp2.inputs['Vector'])
    d1 = kachel(nt, mp.outputs[0], scan('forest_leaves_02', 'diffuse'), True, (x0 + 450, -1300), 0.2)
    h1 = kachel(nt, mp.outputs[0], scan('forest_leaves_02', 'disp'), False, (x0 + 450, -1550), 0.2)
    d2 = kachel(nt, mp2.outputs[0], scan('forest_leaves_04', 'diff'), True, (x0 + 450, -1800), 0.2)
    h2 = kachel(nt, mp2.outputs[0], scan('forest_leaves_04', 'disp'), False, (x0 + 450, -2050), 0.2)
    wn = N(nt, 'ShaderNodeTexNoise', (x0 + 450, -2300)); wn.inputs['Scale'].default_value = 0.18; wn.inputs['Detail'].default_value = 3; L(nt, tc.outputs['Object'], wn.inputs['Vector'])
    wm = N(nt, 'ShaderNodeMapRange', (x0 + 700, -2300)); wm.inputs['From Min'].default_value = 0.42; wm.inputs['From Max'].default_value = 0.6; L(nt, wn.outputs['Fac'], wm.inputs['Value'])
    fm = N(nt, 'ShaderNodeMix', (x0 + 900, -1500), data_type='RGBA'); L(nt, wm.outputs[0], fm.inputs[0]); L(nt, d1.outputs['Color'], fm.inputs[6]); L(nt, d2.outputs['Color'], fm.inputs[7])
    hm = N(nt, 'ShaderNodeMix', (x0 + 900, -1900)); hm.data_type = 'FLOAT'; L(nt, wm.outputs[0], hm.inputs[0]); L(nt, h1.outputs['Color'], hm.inputs[2]); L(nt, h2.outputs['Color'], hm.inputs[3])
    # Nahmaske: um den Hof (Kamera bei −10/0,5) voll Scan, ab 30 m Biomfarbe
    ab = N(nt, 'ShaderNodeVectorMath', (x0 + 450, -2550), operation='DISTANCE'); L(nt, tc.outputs['Object'], ab.inputs[0]); ab.inputs[1].default_value = (-3.0, 0.0, 0.0)
    sepz = N(nt, 'ShaderNodeSeparateXYZ', (x0 + 250, -2700)); L(nt, tc.outputs['Object'], sepz.inputs[0])
    flach = N(nt, 'ShaderNodeCombineXYZ', (x0 + 450, -2700)); L(nt, sepz.outputs['X'], flach.inputs['X']); L(nt, sepz.outputs['Y'], flach.inputs['Y'])
    ab2 = N(nt, 'ShaderNodeVectorMath', (x0 + 650, -2700), operation='DISTANCE'); L(nt, flach.outputs[0], ab2.inputs[0]); ab2.inputs[1].default_value = (-3.0, 0.0, 0.0)
    fern = N(nt, 'ShaderNodeMapRange', (x0 + 900, -2600)); fern.inputs['From Min'].default_value = 26.0; fern.inputs['From Max'].default_value = 55.0
    L(nt, ab2.outputs['Value'], fern.inputs['Value'])
    # Scanfarbe leicht an die Szene gebracht (warm, etwas dunkler), Biom aussen
    tn = N(nt, 'ShaderNodeHueSaturation', (x0 + 1100, -1500)); tn.inputs['Value'].default_value = 0.85; tn.inputs['Saturation'].default_value = 0.9; L(nt, fm.outputs[2], tn.inputs['Color'])
    mix = N(nt, 'ShaderNodeMix', (200, 300), data_type='RGBA'); L(nt, fern.outputs[0], mix.inputs[0]); L(nt, tn.outputs[0], mix.inputs[6])
    if alt_farbe is not None: L(nt, alt_farbe, mix.inputs[7])
    L(nt, mix.outputs[2], bsdf.inputs['Base Color'])
    bump = N(nt, 'ShaderNodeBump', (200, -400)); bump.inputs['Strength'].default_value = 0.55; bump.inputs['Distance'].default_value = 0.02
    L(nt, hm.outputs[0], bump.inputs['Height'])
    if alt_norm is not None: L(nt, alt_norm, bump.inputs['Normal'])
    L(nt, bump.outputs['Normal'], bsdf.inputs['Normal'])
    nah = N(nt, 'ShaderNodeMath', (x0 + 1100, -2600), operation='SUBTRACT'); nah.inputs[0].default_value = 1.0; L(nt, fern.outputs[0], nah.inputs[1])
    hh = N(nt, 'ShaderNodeMath', (x0 + 1300, -2200), operation='MULTIPLY'); L(nt, hm.outputs[0], hh.inputs[0]); L(nt, nah.outputs[0], hh.inputs[1])
    hmid = N(nt, 'ShaderNodeMath', (x0 + 1300, -2400), operation='MULTIPLY'); hmid.inputs[1].default_value = 0.5; L(nt, fern.outputs[0], hmid.inputs[0])
    hges = N(nt, 'ShaderNodeMath', (x0 + 1500, -2300), operation='ADD'); L(nt, hh.outputs[0], hges.inputs[0]); L(nt, hmid.outputs[0], hges.inputs[1])
    dsp = N(nt, 'ShaderNodeDisplacement', (900, -600)); dsp.inputs['Midlevel'].default_value = 0.5; dsp.inputs['Scale'].default_value = 0.06
    L(nt, hges.outputs[0], dsp.inputs['Height']); L(nt, dsp.outputs[0], out.inputs['Displacement'])
    bsdf.inputs['Roughness'].default_value = 0.92
    return m


def mat_rinde_scan(art='buche', name=None, vcol=True, skala=1.0):
    """Rinde wie im Spiel (D364): `rinde-<art>-farbe.webp` = Albedo + Höhe (A), Vertexfarbe ist nur Faktor.
    `skala` < 1 für Wurzeln: dünne Stränge brauchen feinere Borke als der Stamm."""
    m, nt, out = neues_material(name or 'Rinde_' + art)
    tc = N(nt, 'ShaderNodeTexCoord', (-1200, 0))
    mp = N(nt, 'ShaderNodeMapping', (-1000, 0))
    g = (1.8, 1.8, 3.6) if art == 'buche' else (2.0, 2.0, 2.0)
    mp.inputs['Scale'].default_value = tuple(1 / (k * skala) for k in g)
    L(nt, tc.outputs['Object'], mp.inputs['Vector'])
    t = kachel(nt, mp.outputs[0], os.path.join(REPO, 'public', 'material', 'rinde-%s-farbe.webp' % art), True, (-700, 0), 0.4, True)
    b = N(nt, 'ShaderNodeBsdfPrincipled', (300, 0)); b.inputs['Roughness'].default_value = 0.85
    if vcol:
        va = N(nt, 'ShaderNodeVertexColor', (-700, 300)); va.layer_name = 'Color'
        mul = N(nt, 'ShaderNodeMix', (-300, 200), data_type='RGBA', blend_type='MULTIPLY'); mul.inputs[0].default_value = 1.0
        L(nt, t.outputs['Color'], mul.inputs[6]); L(nt, va.outputs['Color'], mul.inputs[7]); farbe = mul.outputs[2]
    else:
        farbe = t.outputs['Color']
    L(nt, farbe, b.inputs['Base Color'])
    bump = N(nt, 'ShaderNodeBump', (0, -300)); bump.inputs['Strength'].default_value = 0.9; bump.inputs['Distance'].default_value = 0.03
    L(nt, t.outputs['Alpha'], bump.inputs['Height']); L(nt, bump.outputs[0], b.inputs['Normal'])
    L(nt, b.outputs[0], out.inputs['Surface'])
    return m, nt, b, out, farbe


def mat_baum(art, loecher=True):
    """Ein Material für den Spielbaum: Holz (COLOR_0.a < 0,5) Rinde, Laub (≥ 0,5) Vertexfarbe mit Durchlass und
    Löchern — dasselbe Rezept wie `windmaterial.ts`, damit Spiel und Zielbild dieselbe Krone zeigen."""
    m, nt, b, out, _ = mat_rinde_scan(art, 'Baum_%s_%s' % (art, 'nah' if loecher else 'mittel'))
    va = N(nt, 'ShaderNodeVertexColor', (-700, 600)); va.layer_name = 'Color'
    tc = nt.nodes['Texture Coordinate']
    ln = N(nt, 'ShaderNodeTexNoise', (-700, 900)); ln.inputs['Scale'].default_value = 1.6; ln.inputs['Detail'].default_value = 3; L(nt, tc.outputs['Object'], ln.inputs['Vector'])
    lf = N(nt, 'ShaderNodeMapRange', (-500, 900)); lf.inputs['To Min'].default_value = 0.75; lf.inputs['To Max'].default_value = 1.25; L(nt, ln.outputs['Fac'], lf.inputs['Value'])
    lfarbe = N(nt, 'ShaderNodeMix', (-300, 700), data_type='RGBA', blend_type='MULTIPLY'); lfarbe.inputs[0].default_value = 1.0
    L(nt, va.outputs['Color'], lfarbe.inputs[6]); L(nt, lf.outputs[0], lfarbe.inputs[7])
    dif = N(nt, 'ShaderNodeBsdfDiffuse', (0, 700)); L(nt, lfarbe.outputs[2], dif.inputs['Color'])
    tr = N(nt, 'ShaderNodeBsdfTranslucent', (0, 550)); L(nt, lfarbe.outputs[2], tr.inputs['Color'])
    lmix = N(nt, 'ShaderNodeMixShader', (250, 650)); lmix.inputs['Fac'].default_value = 0.45 if art == 'buche' else 0.3
    L(nt, dif.outputs[0], lmix.inputs[1]); L(nt, tr.outputs[0], lmix.inputs[2])
    # Löcher im Laub (wie uLoecher): Rauschen > Schwelle → durchsichtig
    hn = N(nt, 'ShaderNodeTexNoise', (-300, 1000)); hn.inputs['Scale'].default_value = 7.0; hn.inputs['Detail'].default_value = 4; L(nt, tc.outputs['Object'], hn.inputs['Vector'])
    hsw = N(nt, 'ShaderNodeMath', (0, 1000), operation='GREATER_THAN'); hsw.inputs[1].default_value = 0.6 if loecher else 2.0; L(nt, hn.outputs['Fac'], hsw.inputs[0])
    trans = N(nt, 'ShaderNodeBsdfTransparent', (250, 900))
    loch = N(nt, 'ShaderNodeMixShader', (500, 750)); L(nt, hsw.outputs[0], loch.inputs['Fac']); L(nt, lmix.outputs[0], loch.inputs[1]); L(nt, trans.outputs[0], loch.inputs[2])
    maske = N(nt, 'ShaderNodeMath', (500, 300), operation='GREATER_THAN'); maske.inputs[1].default_value = 0.5; L(nt, va.outputs['Alpha'], maske.inputs[0])
    holz = b.outputs[0]
    alle = N(nt, 'ShaderNodeMixShader', (900, 200)); L(nt, maske.outputs[0], alle.inputs['Fac']); L(nt, holz, alle.inputs[1]); L(nt, loch.outputs[0], alle.inputs[2])
    L(nt, alle.outputs[0], out.inputs['Surface'])
    return m


def mat_karte(art):
    """Laubbüschel-Karte (Atlas 4 × 4 aus `public/material/<laub|nadel>-bueschel.webp`, echte Blattgeometrie)."""
    m, nt, out = neues_material('Karte_' + art)
    uv = N(nt, 'ShaderNodeUVMap', (-900, 0))
    t = N(nt, 'ShaderNodeTexImage', (-700, 0)); t.image = bild(os.path.join(REPO, 'public', 'material', ('laub' if art == 'buche' else 'nadel') + '-bueschel.webp'))
    t.interpolation = 'Cubic'; L(nt, uv.outputs['UV'], t.inputs['Vector'])
    geo = N(nt, 'ShaderNodeObjectInfo', (-900, 300))
    tint = N(nt, 'ShaderNodeMix', (-400, 100), data_type='RGBA', blend_type='MULTIPLY'); tint.inputs[0].default_value = 1.0
    L(nt, t.outputs['Color'], tint.inputs[6]); tint.inputs[7].default_value = (0.62, 0.62, 0.42, 1) if art == 'buche' else (0.45, 0.55, 0.40, 1)
    dif = N(nt, 'ShaderNodeBsdfDiffuse', (-100, 200)); L(nt, tint.outputs[2], dif.inputs['Color'])
    tr = N(nt, 'ShaderNodeBsdfTranslucent', (-100, 50)); L(nt, tint.outputs[2], tr.inputs['Color'])
    mx = N(nt, 'ShaderNodeMixShader', (150, 100)); mx.inputs['Fac'].default_value = 0.4; L(nt, dif.outputs[0], mx.inputs[1]); L(nt, tr.outputs[0], mx.inputs[2])
    trans = N(nt, 'ShaderNodeBsdfTransparent', (150, -100))
    a = N(nt, 'ShaderNodeMath', (0, -200), operation='GREATER_THAN'); a.inputs[1].default_value = 0.5; L(nt, t.outputs['Alpha'], a.inputs[0])
    end = N(nt, 'ShaderNodeMixShader', (400, 0)); L(nt, a.outputs[0], end.inputs['Fac']); L(nt, trans.outputs[0], end.inputs[1]); L(nt, mx.outputs[0], end.inputs[2])
    L(nt, end.outputs[0], out.inputs['Surface'])
    return m


BAEUME = {}


def baumvorlage(art, variante, stufe):
    """Spielbaum als Mesh-Datenblock (einmal importiert, danach geteilt)."""
    schluessel = (art, variante, stufe)
    if schluessel in BAEUME: return BAEUME[schluessel]
    pfad = os.path.join(REPO, 'public', 'props', 'baum-%s-%d-%s.glb' % (art, variante, stufe))
    vorher = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=pfad)
    neu = [o for o in bpy.data.objects if o not in vorher]
    me = next(o.data for o in neu if o.type == 'MESH')
    for o in neu: bpy.data.objects.remove(o)
    # Fernbäume ohne Löcher: im Spiel übernimmt dort der Impostor, im Frame lasen sie sich sonst als Stecken
    if (art, stufe) not in BAUMMAT: BAUMMAT[(art, stufe)] = mat_baum(art, stufe == 'nah')
    me.materials.clear(); me.materials.append(BAUMMAT[(art, stufe)])
    reg = json.load(open(os.path.join(REPO, 'public', 'props', 'baeume.json')))['baeume']
    h = next(r['hoehe'] for r in reg if r['art'] == art and r['variante'] == variante and r['stufe'] == stufe)
    BAEUME[schluessel] = (me, h)
    return BAEUME[schluessel]


BAUMMAT = {}
KRONEN = []


def spielbaum(sb, art, name, x, y, hoehe, saat, fein):
    rnd = random.Random(saat)
    me, h = baumvorlage(art, saat % 4, 'nah' if fein else 'mittel')
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    s = hoehe / h
    o.scale = (s, s, s); o.rotation_euler = (0, 0, rnd.random() * 6.283)
    o.location = (x, y, sb.bodenhoehe(x, y) - 0.25)
    if fein: KRONEN.append((o, art))
    return o


def kartenvorlagen(art):
    """16 Karten (je eine Atlaskachel, 1 × 1 m) in einer nicht gerenderten Sammlung — Instanzquelle für die Kronen."""
    col = bpy.data.collections.new('Karten_' + art); bpy.context.scene.collection.children.link(col)
    mat = mat_karte(art)
    for i in range(16):
        bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap')
        vs = [bm.verts.new(p) for p in ((-0.5, -0.5, 0), (0.5, -0.5, 0), (0.5, 0.5, 0), (-0.5, 0.5, 0))]
        f = bm.faces.new(vs)
        u0, v0 = (i % 4) / 4, 1 - (i // 4 + 1) / 4
        for lp, (du, dv) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
            lp[uvl].uv = (u0 + du * 0.25, v0 + dv * 0.25)
        me = bpy.data.meshes.new('Karte_%s_%d' % (art, i)); bm.to_mesh(me); bm.free(); me.materials.append(mat)
        o = bpy.data.objects.new(me.name, me); col.objects.link(o)
    bpy.context.view_layer.layer_collection.children[col.name].exclude = True
    return col


def kronendichte(art, dichte):
    """Geometry Nodes: Laubkarten auf die Blattflächen des Spielbaums (COLOR_0.a > 0,5), entlang der Normale,
    zufällig gedreht und skaliert. Befund D364: die Spielkronen sind zu licht — im Frame wird hier verdichtet."""
    col = kartenvorlagen(art)
    ng = bpy.data.node_groups.new('Krone_' + art, 'GeometryNodeTree')
    ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    n = ng.nodes; l = ng.links.new
    ein = n.new('NodeGroupInput'); aus = n.new('NodeGroupOutput')
    attr = n.new('GeometryNodeInputNamedAttribute'); attr.data_type = 'FLOAT_COLOR'; attr.inputs['Name'].default_value = 'Color'
    sep = n.new('FunctionNodeSeparateColor'); l(attr.outputs['Attribute'], sep.inputs['Color'])
    gt = n.new('FunctionNodeCompare'); gt.data_type = 'FLOAT'; gt.operation = 'GREATER_THAN'; gt.inputs['B'].default_value = 0.5
    l(sep.outputs['Alpha'], gt.inputs['A'])
    dist = n.new('GeometryNodeDistributePointsOnFaces'); dist.distribute_method = 'RANDOM'
    dist.inputs['Density'].default_value = dichte
    l(ein.outputs['Geometry'], dist.inputs['Mesh']); l(gt.outputs['Result'], dist.inputs['Selection'])
    ci = n.new('GeometryNodeCollectionInfo'); ci.inputs['Collection'].default_value = col
    ci.inputs['Separate Children'].default_value = True; ci.inputs['Reset Children'].default_value = True
    inst = n.new('GeometryNodeInstanceOnPoints'); inst.inputs['Pick Instance'].default_value = True
    zi = n.new('FunctionNodeRandomValue'); zi.data_type = 'INT'
    for s in zi.inputs:
        if s.type == 'INT' and s.name == 'Min': s.default_value = 0
        if s.type == 'INT' and s.name == 'Max': s.default_value = 15
    zs = n.new('FunctionNodeRandomValue'); zs.data_type = 'FLOAT'
    for s in zs.inputs:
        if s.type == 'VALUE' and s.name == 'Min': s.default_value = 0.85 if art == 'buche' else 0.9
        if s.type == 'VALUE' and s.name == 'Max': s.default_value = 1.5 if art == 'buche' else 1.4
    l(dist.outputs['Points'], inst.inputs['Points']); l(dist.outputs['Rotation'], inst.inputs['Rotation'])
    l(ci.outputs[0], inst.inputs['Instance'])
    l(next(s for s in zi.outputs if s.type == 'INT'), inst.inputs['Instance Index'])
    l(next(s for s in zs.outputs if s.type == 'VALUE'), inst.inputs['Scale'])
    join = n.new('GeometryNodeJoinGeometry')
    l(ein.outputs['Geometry'], join.inputs['Geometry']); l(inst.outputs['Instances'], join.inputs['Geometry'])
    l(join.outputs['Geometry'], aus.inputs['Geometry'])
    return ng


# ------------------------------------------------------------------- Steine mit Brüchen
def stein_bruch(ziel, groesse, matrix, saat, rauheit=0.06, rund=0.35):
    """Wie `szenenbau.stein_bm`, aber mit 0–3 Bruchflächen: Ebenen schneiden Ecken und Kanten ab (Abplatzungen,
    gespaltene Feldsteine), die Form streut stärker. Die Oberfläche bekommt danach der Scan (Verschiebung)."""
    rnd = random.Random(saat)
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=2, use_grid_fill=True)
    for _ in range(rnd.choice((0, 1, 1, 2, 2, 3))):
        # Bruchebene schräg zur Ansichtsfläche (y = Mauertiefe klein): der Umriss wird vieleckig, nicht nur die Ecke stumpf
        nrm = Vector((rnd.choice((-1, 1)) * rnd.uniform(0.3, 1), rnd.choice((-1, 1)) * rnd.uniform(0.0, 0.5), rnd.choice((-1, 1)) * rnd.uniform(0.3, 1))).normalized()
        ecke = 0.5 * (abs(nrm.x) + abs(nrm.y) + abs(nrm.z))
        d = ecke * rnd.uniform(0.74, 0.95)   # D411: nur Ecken und Kanten ab, die Ansichtsfläche bleibt gross
        res = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=nrm * d, plane_no=nrm, clear_outer=True)
        rand = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge) and e.is_boundary]
        if rand: bmesh.ops.holes_fill(bm, edges=rand, sides=0)
    off = Vector((rnd.random() * 60, rnd.random() * 60, rnd.random() * 60))
    # Form-Varianz: nicht jeder Stein füllt seinen Platz — schmaler, niedriger, verkantet, vor- oder zurückgesetzt.
    # Das öffnet Fugen mit Tiefe (dahinter der dunkle Kern) und bricht die Reihen.
    # D411 (Flo 22.11.2026: „Verhältnis Steine zu Füllmaterial passt nicht“): vorher 0,82–1,0 × 0,68–1,0 plus tiefe
    # Bruchebenen — der Stein füllte nur gut die Hälfte seines Platzes. Bruchsteinmauerwerk zeigt 1–4 cm Fuge.
    gx, gz = groesse[0] * rnd.uniform(0.95, 1.04), groesse[2] * rnd.uniform(0.92, 1.05)
    for v in bm.verts:
        p = v.co.copy()
        ecke = (abs(p.x) + abs(p.y) + abs(p.z)) / 1.5
        f = 1.0 - rund * 0.4 * max(0.0, ecke - 0.6)
        n = noise.noise(p * 1.8 + off) * rauheit * 2.2 + noise.noise(p * 5.0 + off) * rauheit * 0.7
        v.co = Vector((p.x * gx, p.y * groesse[1], p.z * gz)) * (f + n)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    lage = Matrix.Translation(Vector((0, rnd.uniform(-0.045, 0.045), rnd.uniform(-0.03, 0.0)))) @ Matrix.Rotation(rnd.uniform(-0.11, 0.11), 4, 'Y')
    bmesh.ops.transform(bm, matrix=matrix @ lage, verts=bm.verts[:])
    me = bpy.data.meshes.new('stein'); bm.to_mesh(me); bm.free()
    ziel.from_mesh(me); bpy.data.meshes.remove(me)


def adaptiv(o, pixel=1.0):
    """Echte Verschiebung: adaptive Unterteilung (Cycles), fein nur wo die Kamera nah ist."""
    m = o.modifiers.new('Adaptiv', 'SUBSURF'); m.subdivision_type = 'SIMPLE'
    m.use_adaptive_subdivision = True; m.adaptive_pixel_size = pixel
    m.levels = 0; m.render_levels = 1
    return m


# ------------------------------------------------------------------- Holz, Scans
def balken(name, ort, laenge, quer, rot, mat, saat):
    """Entrindeter Balken: Kasten mit gebrochenen Enden (schräge Bruchflächen), UV entlang der Faser."""
    rnd = random.Random(saat)
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(laenge, quer[0], quer[1]), verts=bm.verts[:])
    bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges if abs(e.verts[0].co.x - e.verts[1].co.x) > 0.5], cuts=12)
    for s in (-1, 1):
        for _ in range(2):
            nrm = Vector((s, rnd.uniform(-0.8, 0.8), rnd.uniform(-0.6, 0.6))).normalized()
            res = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=Vector((s * laenge * rnd.uniform(0.40, 0.47), 0, 0)), plane_no=nrm, clear_outer=True)
            rand = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge) and e.is_boundary]
            if rand: bmesh.ops.holes_fill(bm, edges=rand, sides=0)
    for v in bm.verts:   # leicht verzogen, nicht sägefrisch
        v.co.y += 0.012 * noise.noise(Vector((v.co.x * 0.7, 3.1, saat)))
        v.co.z += 0.015 * noise.noise(Vector((v.co.x * 0.5, 7.7, saat)))
    uvl = bm.loops.layers.uv.new('UVMap'); bm.normal_update()
    for f in bm.faces:
        n = f.normal
        for lp in f.loops:
            p = lp.vert.co
            quer_k = p.y if abs(n.z) > abs(n.y) else p.z
            lp[uvl].uv = (quer_k / 0.5 + (0.37 if abs(n.z) > abs(n.y) else 0.0), p.x / 0.5) if abs(n.x) < 0.7 else (p.y / 0.5, p.z / 0.5)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    o.location = ort; o.rotation_euler = rot; me.materials.append(mat)
    return o


def mat_holz_scan():
    """Rohes, verwittertes Holz (Scan `rough_wood`, 0,5 m): Maserung, Risse und Faser als echte Verschiebung."""
    m, nt, out = neues_material('Holz_Scan'); m.displacement_method = 'BOTH'
    uv = N(nt, 'ShaderNodeUVMap', (-900, 0))
    dif = N(nt, 'ShaderNodeTexImage', (-600, 200)); dif.image = bild(scan('rough_wood', 'diff')); L(nt, uv.outputs[0], dif.inputs['Vector'])
    rau = N(nt, 'ShaderNodeTexImage', (-600, -50)); rau.image = bild(scan('rough_wood', 'rough'), False); L(nt, uv.outputs[0], rau.inputs['Vector'])
    hoe = N(nt, 'ShaderNodeTexImage', (-600, -300)); hoe.image = bild(scan('rough_wood', 'disp'), False); L(nt, uv.outputs[0], hoe.inputs['Vector'])
    hs = N(nt, 'ShaderNodeHueSaturation', (-300, 200)); hs.inputs['Value'].default_value = 0.9; hs.inputs['Saturation'].default_value = 0.8; L(nt, dif.outputs['Color'], hs.inputs['Color'])
    b = N(nt, 'ShaderNodeBsdfPrincipled', (200, 0)); L(nt, hs.outputs[0], b.inputs['Base Color']); L(nt, rau.outputs['Color'], b.inputs['Roughness'])
    bump = N(nt, 'ShaderNodeBump', (-100, -300)); bump.inputs['Strength'].default_value = 0.6; bump.inputs['Distance'].default_value = 0.006
    L(nt, hoe.outputs['Color'], bump.inputs['Height']); L(nt, bump.outputs[0], b.inputs['Normal'])
    dsp = N(nt, 'ShaderNodeDisplacement', (500, -300)); dsp.inputs['Scale'].default_value = 0.018; L(nt, hoe.outputs['Color'], dsp.inputs['Height'])
    L(nt, b.outputs[0], out.inputs['Surface']); L(nt, dsp.outputs[0], out.inputs['Displacement'])
    return m


def scan_modelle(name):
    """glTF-Scan importieren (mit eigenen Texturen), Objekte verstecken, Meshes zurückgeben."""
    o = os.path.join(cc0_ordner(), name)
    pfad = os.path.join(o, next(f for f in os.listdir(o) if f.endswith('.gltf')))
    vorher = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=pfad)
    neu = [x for x in bpy.data.objects if x not in vorher]
    meshes = []
    for x in neu:
        if x.type == 'MESH':
            x.data.transform(x.matrix_world); meshes.append(x.data)
    for x in neu: bpy.data.objects.remove(x)
    for me in meshes:   # Ursprung in die Grundfläche, Mitte in xy
        import numpy as np   # Scan-Bäume haben Millionen Punkte: nicht als Python-Liste (D372)
        k = np.empty(len(me.vertices) * 3, dtype=np.float32); me.vertices.foreach_get('co', k); k = k.reshape(-1, 3)
        lo, hi = k.min(axis=0), k.max(axis=0)
        me.transform(Matrix.Translation(Vector((-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]))))
        me['ausd'] = float(max(hi[0] - lo[0], hi[1] - lo[1]))
    return meshes


def setze_scan(sb, me, name, x, y, groesse, saat, sinken=0.3, rot_z=None):
    """Scan-Stein/-Stamm setzen: auf `groesse` (grösste Ausdehnung) skaliert, um `sinken` × Höhe eingesunken."""
    rnd = random.Random(saat)
    xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
    s = groesse / max(max(xs) - min(xs), max(ys) - min(ys))
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    o.scale = (s, s, s); o.rotation_euler = (0, 0, rot_z if rot_z is not None else rnd.random() * 6.283)
    o.location = (x, y, sb.bodenhoehe(x, y) - sinken * max(zs) * s)
    return o


# ------------------------------------------------------------------- Licht, Himmel
def himmel_gemalt(el_grad, az_grad):
    """Himmel gestaltet, nicht simuliert (ADR-0018 Punkt 2): warmer Horizont zur Sonne, gedecktes blau-violettes
    Zenit, Wolkenbänke als grosse Massen (flache Schicht, nach Sonne beleuchtet). Was die Kamera sieht und was die
    Szene beleuchtet, ist getrennt: als Licht wirkt nur ein kühles, leicht violettes Füllen — kühle Schatten."""
    w = bpy.data.worlds.new('Zielbild'); bpy.context.scene.world = w; w.use_nodes = True; nt = w.node_tree; nt.nodes.clear()
    out = N(nt, 'ShaderNodeOutputWorld', (1600, 0))
    tc = N(nt, 'ShaderNodeTexCoord', (-1600, 0))
    dirn = N(nt, 'ShaderNodeVectorMath', (-1400, 0), operation='NORMALIZE'); L(nt, tc.outputs['Generated'], dirn.inputs[0])
    sep = N(nt, 'ShaderNodeSeparateXYZ', (-1200, 0)); L(nt, dirn.outputs[0], sep.inputs[0])
    el, az = math.radians(el_grad), math.radians(az_grad)
    sd = (math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el))
    dot = N(nt, 'ShaderNodeVectorMath', (-1200, -300), operation='DOT_PRODUCT'); dot.inputs[1].default_value = sd; L(nt, dirn.outputs[0], dot.inputs[0])
    zur = N(nt, 'ShaderNodeMapRange', (-1000, -300)); zur.inputs['From Min'].default_value = -0.2; L(nt, dot.outputs['Value'], zur.inputs['Value'])
    hoehe = N(nt, 'ShaderNodeMapRange', (-1000, 0)); hoehe.inputs['From Min'].default_value = -0.02; hoehe.inputs['From Max'].default_value = 0.55; L(nt, sep.outputs['Z'], hoehe.inputs['Value'])
    # Grundverlauf: Horizont golden (zur Sonne) bzw. rosa-grau (abgewandt), Zenit blau-violett gedeckt
    hor = N(nt, 'ShaderNodeMix', (-800, -300), data_type='RGBA'); L(nt, zur.outputs[0], hor.inputs[0])
    hor.inputs[6].default_value = (0.42, 0.36, 0.38, 1); hor.inputs[7].default_value = (1.0, 0.66, 0.34, 1)
    ver = N(nt, 'ShaderNodeMix', (-600, 0), data_type='RGBA'); L(nt, hoehe.outputs[0], ver.inputs[0])
    hk = N(nt, 'ShaderNodeMath', (-800, 100), operation='POWER'); hk.inputs[1].default_value = 0.7; L(nt, hoehe.outputs[0], hk.inputs[0]); L(nt, hk.outputs[0], ver.inputs[0])
    L(nt, hor.outputs[2], ver.inputs[6]); ver.inputs[7].default_value = (0.19, 0.22, 0.40, 1)
    # Wolkenschicht: Richtung auf eine Ebene projiziert (xy / z), grosse Formen, weiche Ränder
    zz = N(nt, 'ShaderNodeMath', (-1000, 300), operation='ADD'); zz.inputs[1].default_value = 0.08; L(nt, sep.outputs['Z'], zz.inputs[0])
    px = N(nt, 'ShaderNodeMath', (-800, 400), operation='DIVIDE'); L(nt, sep.outputs['X'], px.inputs[0]); L(nt, zz.outputs[0], px.inputs[1])
    py = N(nt, 'ShaderNodeMath', (-800, 300), operation='DIVIDE'); L(nt, sep.outputs['Y'], py.inputs[0]); L(nt, zz.outputs[0], py.inputs[1])
    ebene = N(nt, 'ShaderNodeCombineXYZ', (-600, 350)); L(nt, px.outputs[0], ebene.inputs['X']); L(nt, py.outputs[0], ebene.inputs['Y']); ebene.inputs['Z'].default_value = 3.7
    mpw = N(nt, 'ShaderNodeMapping', (-450, 350)); mpw.inputs['Scale'].default_value = (0.55, 1.3, 1.0); L(nt, ebene.outputs[0], mpw.inputs['Vector'])
    wn = N(nt, 'ShaderNodeTexNoise', (-300, 350)); wn.inputs['Scale'].default_value = 0.45; wn.inputs['Detail'].default_value = 3; wn.inputs['Roughness'].default_value = 0.5; wn.inputs['Distortion'].default_value = 0.6
    L(nt, mpw.outputs[0], wn.inputs['Vector'])
    dichte = N(nt, 'ShaderNodeMapRange', (-100, 350)); dichte.inputs['From Min'].default_value = 0.44; dichte.inputs['From Max'].default_value = 0.58; L(nt, wn.outputs['Fac'], dichte.inputs['Value'])
    # Binnenform der Wolke: ein zweites, gröberes Rauschen schattiert die Masse (Unterseite dunkler, Ränder licht)
    wi = N(nt, 'ShaderNodeTexNoise', (-300, 600)); wi.inputs['Scale'].default_value = 1.1; wi.inputs['Detail'].default_value = 2; L(nt, mpw.outputs[0], wi.inputs['Vector'])
    wis = N(nt, 'ShaderNodeMapRange', (-100, 600)); wis.inputs['From Min'].default_value = 0.35; wis.inputs['From Max'].default_value = 0.65; L(nt, wi.outputs['Fac'], wis.inputs['Value'])
    horiz = N(nt, 'ShaderNodeMapRange', (-100, 150)); horiz.inputs['From Min'].default_value = 0.0; horiz.inputs['From Max'].default_value = 0.05; L(nt, sep.outputs['Z'], horiz.inputs['Value'])
    wolke = N(nt, 'ShaderNodeMath', (100, 300), operation='MULTIPLY'); L(nt, dichte.outputs[0], wolke.inputs[0]); L(nt, horiz.outputs[0], wolke.inputs[1])
    # Wolkenfarbe: zur Sonne hin goldene Ränder, abgewandt violett-grau
    licht_w = N(nt, 'ShaderNodeMath', (0, 500), operation='MULTIPLY'); L(nt, zur.outputs[0], licht_w.inputs[0]); L(nt, wis.outputs[0], licht_w.inputs[1])
    wf = N(nt, 'ShaderNodeMix', (100, 0), data_type='RGBA'); L(nt, licht_w.outputs[0], wf.inputs[0])
    wf.inputs[6].default_value = (0.24, 0.21, 0.29, 1); wf.inputs[7].default_value = (1.25, 0.80, 0.46, 1)
    himmel = N(nt, 'ShaderNodeMix', (350, 100), data_type='RGBA'); L(nt, wolke.outputs[0], himmel.inputs[0]); L(nt, ver.outputs[2], himmel.inputs[6]); L(nt, wf.outputs[2], himmel.inputs[7])
    # Sonnenhof
    pos = N(nt, 'ShaderNodeMath', (-1000, -550), operation='MAXIMUM'); pos.inputs[1].default_value = 0.0; L(nt, dot.outputs['Value'], pos.inputs[0])
    hof = N(nt, 'ShaderNodeMath', (-800, -550), operation='POWER'); hof.inputs[1].default_value = 24.0; L(nt, pos.outputs[0], hof.inputs[0])
    hofw = N(nt, 'ShaderNodeMix', (550, -200), data_type='RGBA', blend_type='ADD'); L(nt, hof.outputs[0], hofw.inputs[0])
    L(nt, himmel.outputs[2], hofw.inputs[6]); hofw.inputs[7].default_value = (1.6, 1.0, 0.5, 1)
    sicht = N(nt, 'ShaderNodeBackground', (900, 100)); sicht.inputs['Strength'].default_value = 0.95; L(nt, hofw.outputs[2], sicht.inputs['Color'])
    licht = N(nt, 'ShaderNodeBackground', (900, -150)); licht.inputs['Color'].default_value = (0.20, 0.22, 0.34, 1); licht.inputs['Strength'].default_value = 1.0
    lp = N(nt, 'ShaderNodeLightPath', (900, 400))
    mx = N(nt, 'ShaderNodeMixShader', (1300, 0)); L(nt, lp.outputs['Is Camera Ray'], mx.inputs['Fac']); L(nt, licht.outputs[0], mx.inputs[1]); L(nt, sicht.outputs[0], mx.inputs[2])
    L(nt, mx.outputs[0], out.inputs['Surface'])
    return w


def dunst_farbe(name, farbe, dichte_faktor=1.0, aniso=None):
    """Dunst des Szenenbaus umfärben und ausdünnen. Weniger Vorwärtsstreuung: Der Blick geht fast in die Sonne,
    mit 0,55 lief der ganze Himmel cremeweiss zu — das Glühen soll im Bogen sitzen, nicht überall."""
    m = bpy.data.materials.get(name)
    if not m: return
    for n in m.node_tree.nodes:
        if n.type == 'PRINCIPLED_VOLUME':
            n.inputs['Color'].default_value = (*farbe, 1)
            if aniso is not None: n.inputs['Anisotropy'].default_value = aniso
        if n.type == 'MATH' and n.operation == 'MULTIPLY' and n.inputs[1].default_value > 0 and n.inputs[1].default_value < 1:
            n.inputs[1].default_value *= dichte_faktor


FARNE = []


def farn_scan(sb, name, x, y, saat, groesse):
    """Wurmfarn-Horst aus dem Scan (`fern_02`, Poly Haven) statt Blattklumpen."""
    if not FARNE: FARNE.extend(pflanzen('fern_02', 0.45) if R4 else scan_modelle('fern_02'))
    rnd = random.Random(saat)
    me = FARNE[saat % len(FARNE)]
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    s = 1.35 * groesse * rnd.uniform(0.85, 1.15)
    o.scale = (s, s, s); o.rotation_euler = (0, 0, rnd.random() * 6.283)
    o.location = (x, y, sb.bodenhoehe(x, y) - 0.03)
    return o


def mat_efeu():
    """Efeukarten wie im Spiel (D358): Atlas 2 × 2, je Kachel 1 × 1 m Efeufeld in echter Blattgrösse."""
    m, nt, out = neues_material('Efeu_Karte')
    uv = N(nt, 'ShaderNodeUVMap', (-900, 0))
    t = N(nt, 'ShaderNodeTexImage', (-700, 0)); t.image = bild(os.path.join(REPO, 'public', 'material', 'efeu-karten-farbe.webp'))
    t.interpolation = 'Cubic'; L(nt, uv.outputs['UV'], t.inputs['Vector'])
    dif = N(nt, 'ShaderNodeBsdfPrincipled', (-100, 200)); L(nt, t.outputs['Color'], dif.inputs['Base Color']); dif.inputs['Roughness'].default_value = 0.55
    tr = N(nt, 'ShaderNodeBsdfTranslucent', (-100, 0)); L(nt, t.outputs['Color'], tr.inputs['Color'])
    mx = N(nt, 'ShaderNodeMixShader', (150, 100)); mx.inputs['Fac'].default_value = 0.25; L(nt, dif.outputs[0], mx.inputs[1]); L(nt, tr.outputs[0], mx.inputs[2])
    trans = N(nt, 'ShaderNodeBsdfTransparent', (150, -100))
    a = N(nt, 'ShaderNodeMath', (0, -200), operation='GREATER_THAN'); a.inputs[1].default_value = 0.5; L(nt, t.outputs['Alpha'], a.inputs[0])
    end = N(nt, 'ShaderNodeMixShader', (400, 0)); L(nt, a.outputs[0], end.inputs['Fac']); L(nt, trans.outputs[0], end.inputs[1]); L(nt, mx.outputs[0], end.inputs[2])
    L(nt, end.outputs[0], out.inputs['Surface'])
    return m


def efeu_karten(name, flecken, saat):
    """Efeu an der Mauer als Karten (statt Blattklumpen): je Fleck eine grosse Karte und zwei kleinere darunter
    (der Efeu wächst von unten), 14 cm vor der Steinfläche, damit die Verschiebung der Steine sie nicht durchsticht."""
    rnd = random.Random(saat); bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap')
    for mitte, normale, r in flecken:
        n = normale.normalized(); u = n.cross(Vector((0, 0, 1))).normalized(); w = Vector((0, 0, 1))
        teile = [(mitte, r * 2.3, 0.12)] + [(mitte + u * rnd.uniform(-r, r) - w * r * rnd.uniform(1.0, 1.9), r * rnd.uniform(1.1, 1.6), 0.15 + 0.02 * j) for j in range(2)]
        for p, g, ab in teile:
            k = rnd.randrange(4); a = rnd.uniform(-0.5, 0.5)
            ca, sa = math.cos(a), math.sin(a)
            vs = []
            for dx, dy in ((-0.5, -0.5), (0.5, -0.5), (0.5, 0.5), (-0.5, 0.5)):
                vs.append(bm.verts.new(p + n * ab + (u * ca + w * sa) * dx * g + (-u * sa + w * ca) * dy * g))
            f = bm.faces.new(vs)
            u0, v0 = (k % 2) / 2, 1 - (k // 2 + 1) / 2
            for lp, (du, dv) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
                lp[uvl].uv = (u0 + du * 0.5, v0 + dv * 0.5)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat_efeu())
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    return o


def aframe():
    """Felsmulde als A-Frame (D371): `szenenbau.bauen()` mit ausgetauschten Bausteinen, danach Substanz und Licht."""
    objdir, praefix = ARGS[1], ARGS[2]
    breite, hoehe, samples = (int(ARGS[3]), int(ARGS[4]), int(ARGS[5])) if len(ARGS) > 5 else (1280, 720, 32)
    kameras = (ARGS[6] if len(ARGS) > 6 else 'bogen').split(',')
    sys.argv = [sys.argv[0], '--', objdir, '/tmp/claude-0/aframe.blend', '/tmp/claude-0/aframe-roh.png', 'voll', 'felsmulde']
    sys.path.insert(0, HIER)
    import szenenbau as sb

    # Materialfabriken des Szenenbaus durch Scans ersetzen (bauen() ruft sie auf)
    alt_boden = sb.mat_boden
    sb.mat_boden = lambda wiese=None: mat_boden_scan(alt_boden(wiese))
    def fels(name='Fels', moos=1.3, hoehe=None):
        if name == 'Stein': return mat_stein_scan('Stein', 'mossy_rock', 1.4, 0.035, 0.8, 1.0, 0.7)
        if name == 'Platte': return mat_stein_scan('Platte', 'mossy_rock', 1.8, 0.03, 0.6, 0.9, 0.8)
        return mat_stein_scan(name, 'lichen_rock', 1.6, 0.04, moos, 1.1)
    sb.mat_fels = fels
    sb.mat_rinde = lambda: mat_rinde_scan('fichte', 'Rinde', False, 0.35)[0]   # nur noch Wurzeln
    sb.farn = lambda name, x, y, mat, saat, groesse=1.0: farn_scan(sb, name, x, y, saat, groesse)
    sb.efeu = lambda name, flecken, mat, saat: efeu_karten(name, flecken, saat)
    sb.stein_bm = stein_bruch
    sb.laubbaum2 = lambda name, x, y, h, mr, ml, saat, fein=True, **k: spielbaum(sb, 'buche', name, x, y, h, saat, fein)
    sb.fichte = lambda name, x, y, h, mr, mn, saat, fein=True, **k: spielbaum(sb, 'fichte', name, x, y, h, saat, fein)
    sb.gras = lambda *a, **k: None   # keine Grasbüschel (Blattkarten): Boden trägt der Scan
    sb.wurzel = lambda *a, **k: None   # Schlauchwurzeln entfallen: die Spielbäume haben eigene Wurzelanläufe (D364)

    def rendern(sc, _b, _h, _s, _p):
        zt = sb.bodenhoehe(-2.0, -1.0)
        befall(zt)
        ter = bpy.data.objects['terrain']
        # Substanz: echte Verschiebung auf Steinbau und Boden
        for o in list(bpy.data.objects):
            if o.type != 'MESH' or not o.data.materials: continue
            mn = o.data.materials[0].name if o.data.materials[0] else ''
            if mn in ('Stein', 'Platte') or o.name.startswith(('Mauer', 'Stuetzmauer', 'Hof', 'Becken')):
                if not o.name.endswith('_Kern') and not o.name.endswith('_Wasser'): adaptiv(o, 1.0)
        adaptiv(ter, 1.5)
        kern = mat_kern_scan()
        for o in bpy.data.objects:
            if o.name.endswith('_Kern'): o.data.materials.clear(); o.data.materials.append(kern)
        # Moosblöcke und Geröll → Scan-Felsen (rock_moss_set), halb eingesunken
        gross = scan_modelle('rock_moss_set_01'); klein = scan_modelle('rock_moss_set_02')
        for i, o in enumerate([o for o in bpy.data.objects if o.name.startswith('Moosblock')]):
            x, y = o.location.x, o.location.y; g = max(o.dimensions.x, o.dimensions.y)
            bpy.data.objects.remove(o)
            setze_scan(sb, gross[i % len(gross)], 'Fels%d' % i, x, y, g * 1.05, 600 + i, 0.3)
        for i, o in enumerate([o for o in bpy.data.objects if o.name.startswith('Geroell')]):
            x, y = o.location.x, o.location.y; g = max(o.dimensions.x, o.dimensions.y)
            bpy.data.objects.remove(o)
            setze_scan(sb, klein[i % len(klein)], 'Stein%d' % i, x, y, g * 1.1, 700 + i, 0.4)
        # Zusätzliche halb versunkene Steine auf dem Hof und am Mauerfuss
        rnd = random.Random(371)
        for i in range(14):
            x, y = rnd.uniform(-8.5, 3.8), rnd.uniform(-7.0, 6.5)
            if -4.6 < x < -0.4 and -5.9 < y < -0.1: continue   # Becken
            setze_scan(sb, klein[(i + 3) % len(klein)], 'Kiesel%d' % i, x, y, rnd.uniform(0.18, 0.5), 800 + i, 0.45)
        # Holz: umgestürzter, teils entrindeter Stamm (Scan) und ein Balken mit Maserung und Rissen
        stamm = scan_modelle('dead_tree_trunk_02')
        setze_scan(sb, stamm[0], 'Totholz', -5.6, 3.6, 3.6, 371, 0.18, math.radians(-25))
        holz = mat_holz_scan()
        b1 = balken('Balken', (-5.0, 0.2, zt + 0.12), 2.9, (0.24, 0.2), (0.0, 0.03, math.radians(25)), holz, 1)
        b2 = balken('Torpfosten', (4.55, -2.75, zt + 0.85), 2.3, (0.26, 0.24), (0.0, math.radians(-84), 0.08), holz, 2)
        for b in (b1, b2): adaptiv(b, 1.0)
        # Kronen verdichten (nur Nahbäume): Laubkarten aus dem Spielatlas
        gruppen = {art: kronendichte(art, 2.4 if art == 'buche' else 3.0) for art in ('buche', 'fichte')}
        print('AFRAME Nahbäume mit Kartenkrone', len(KRONEN))
        for o, art in KRONEN:
            mod = o.modifiers.new('Krone', 'NODES'); mod.node_group = gruppen[art]
        # Licht: Sonne tief und warm fast in Blickrichtung hinter Mauer A — Gegenlicht im Bogen, durch den Bogen
        # fällt eine Lichtbahn über Hof und Becken (Streiflicht zeigt Verschiebung), der Rest liegt im kühlen Schatten
        for o in [o for o in bpy.data.objects if o.type == 'LIGHT']: bpy.data.objects.remove(o)
        EL, AZ = 13.0, 100.0
        sonne, _ = sb.sonne(EL, AZ, (1.0, 0.70, 0.45), 5.0)
        sonne.data.angle = math.radians(1.2)
        himmel_gemalt(EL, AZ)
        dunst_farbe('Dunst', (0.95, 0.80, 0.62), 0.2, 0.3)
        dunst_farbe('Bodennebel', (0.95, 0.84, 0.70), 0.3, 0.3)
        sb.dunst('Hofdunst', 160.0, zt - 6.0, zt + 40.0, 0.0012, 22.0, (1.0, 0.86, 0.68), 0.5)
        # Kameras
        kams = {'bogen': sc.camera}
        kn = sb.kamera((-5.6, 2.3, zt + 1.45), (-1.4, -1.0, zt + 0.25), 28); kn.name = 'KameraNah'
        kams['nah'] = kn
        sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'
        sc.cycles.samples = samples; sc.cycles.use_adaptive_sampling = True; sc.cycles.adaptive_threshold = 0.025
        sc.cycles.use_denoising = True; sc.cycles.denoiser = 'OPENIMAGEDENOISE'
        sc.cycles.max_bounces = 5; sc.cycles.diffuse_bounces = 2; sc.cycles.glossy_bounces = 1
        sc.cycles.transmission_bounces = 4; sc.cycles.volume_bounces = 0; sc.cycles.transparent_max_bounces = 16
        sc.cycles.sample_clamp_indirect = 4.0; sc.cycles.caustics_reflective = sc.cycles.caustics_refractive = False
        sc.cycles.volume_step_rate = 4.0; sc.cycles.volume_max_steps = 64
        sc.cycles.dicing_rate = 1.0; sc.cycles.offscreen_dicing_scale = 6.0; sc.cycles.max_subdivisions = 10
        sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = breite, hoehe, 100
        sc.view_settings.view_transform = 'AgX'
        try: sc.view_settings.look = 'AgX - Medium High Contrast'
        except Exception: pass
        sc.view_settings.exposure = 1.0
        vl = sc.view_layers[0]
        vl.use_pass_z = vl.use_pass_normal = vl.use_pass_mist = vl.use_pass_object_index = True
        sc.world.mist_settings.start = 3.0; sc.world.mist_settings.depth = 150.0; sc.world.mist_settings.falloff = 'LINEAR'
        try: sc.render.image_settings.media_type = 'MULTI_LAYER_IMAGE'
        except Exception as e: print('media_type', e)
        sc.render.image_settings.file_format = 'OPEN_EXR_MULTILAYER'; sc.render.image_settings.color_depth = '16'
        if os.environ.get('AFRAME_BLEND'): bpy.ops.wm.save_as_mainfile(filepath=os.environ['AFRAME_BLEND'])
        import time
        for k in kameras:
            sc.camera = kams[k]
            sc.render.filepath = os.path.abspath('%s-%s.exr' % (praefix, k))
            t0 = time.time()
            bpy.ops.render.render(write_still=True)
            print('AFRAME', k, 'Renderzeit %.0f s' % (time.time() - t0), sc.render.filepath)
    sb.rendern = rendern
    sb.bauen()


# ==============================================================================================================# Zielbild Runde 2 (D372): verwittert und überwachsen
# =====================================================================================================================
# Zielbild Runde 2 (D372): verwittert und überwachsen
# =====================================================================================================================
# Flo zu D371: „natürlichere Optik der Steine und Boden sowie Umgebung … rau und verwittert“. Was sich ändert:
#   Mauer   — nicht mehr Stein für Stein gesetzt, sondern Mauerkörper mit Bruchsteinmauer-Scan und starker echter
#             Verschiebung (Fugen sind Mörtel und Erde, kein Loch), ausgebrochene Schale, Schmutzfahnen, Flechten,
#             Moos an Krone und Fuss; echte Scan-Steine auf der Krone und als Schutt am Fuss; Bogen aus rundgewitterten
#             Keilsteinen.
#   Boden   — fünf Scans nach Höhe gemischt (Laub, Erde mit Steinchen, Moos, nasse Erde), Trampelpfad zum Bogen,
#             Feuchte und Moos dort, wo etwas aufliegt (Umgebungsverdeckung), Platten eingesunken und gebrochen.
#   Bewuchs — Polster aus Scan-Pflanzen (Gras, Scharbockskraut, Brennnessel, Farn …), an Mauerfuss, Plattenfugen und
#             Krone dichter, auf dem Pfad dünn; Büsche und junge Bäume hinter der Mauer, Rahmenpflanzen vorn.
#   Himmel  — fotografierter Wolkenhimmel (nur für die Kamera, gestaltet eingefärbt), Dunst nach oben gedeckelt,
#             Bergkulissen gestaffelt im Tal.
MAUERKRONE = []    # (Weltpunkt auf der Krone, Querrichtung, Dicke, Mauername) — für Kronensteine und Bewuchs
MAUERLINIEN = []   # ((x0, y0), (x1, y1), Öffnung von/bis entlang der Linie oder None) — Mauerfüsse für Schutt und Bewuchs
PLATTEN = []       # (x, y, halbx, halby) gesetzte Hofplatten — dort wächst wenig, in den Fugen viel
VORLAGEN = {}
MAUERMAT = {}


def vorlagen(name):
    """Scan-Modelle einmal laden (Mesh-Liste, Ursprung in der Grundfläche)."""
    if name not in VORLAGEN:
        # Zwischenspeicher `<name>/<name>.blend`: der glTF-Import eines Scan-Baums (Millionen Dreiecke) braucht ein
        # Vielfaches des Arbeitsspeichers der fertigen Meshes — einmal umwandeln (`-- scanblend <name>`), dann nur anhängen.
        pfad = os.path.join(cc0_ordner(), name, name + '.blend')
        if os.path.exists(pfad):
            with bpy.data.libraries.load(pfad) as (von, nach): nach.meshes = list(von.meshes)
            VORLAGEN[name] = sorted(nach.meshes, key=lambda me: me.name)
        else:
            VORLAGEN[name] = scan_modelle(name)
    return VORLAGEN[name]


def scanblend():
    """`-- scanblend <name>[,<name>…]`: Scan-Modelle einmal aus glTF lesen und als .blend neben den Scan legen."""
    for name in ARGS[1].split(','):
        ms = scan_modelle(name)
        for me in ms: me.use_fake_user = True
        pfad = os.path.join(cc0_ordner(), name, name + '.blend')
        bpy.data.libraries.write(pfad, set(ms), fake_user=True)
        print('SCANBLEND', name, len(ms), 'Meshes', sum(len(me.polygons) for me in ms), 'Flächen', pfad)
        for me in ms: bpy.data.meshes.remove(me)


def ausdehnung(me):
    """Grösste waagrechte Ausdehnung eines Meshes (einmal gemessen, am Mesh gemerkt)."""
    if 'ausd' not in me:
        xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]
        me['ausd'] = max(max(xs) - min(xs), max(ys) - min(ys))
    return me['ausd']


def R_(nt, quelle, x0, x1, y0=0.0, y1=1.0):
    """Bereich abbilden und begrenzen: der Standardbaustein aller Masken."""
    n = N(nt, 'ShaderNodeMapRange'); n.clamp = True
    n.inputs['From Min'].default_value = x0; n.inputs['From Max'].default_value = x1
    n.inputs['To Min'].default_value = y0; n.inputs['To Max'].default_value = y1
    L(nt, quelle, n.inputs['Value'])
    return n.outputs[0]


def M_(nt, op, a, b=None, c=None):
    n = N(nt, 'ShaderNodeMath', operation=op)
    for i, v in enumerate((a, b, c)):
        if v is None: continue
        if isinstance(v, (int, float)): n.inputs[i].default_value = v
        else: L(nt, v, n.inputs[i])
    return n.outputs[0]


def X_(nt, f, a, b, typ='MIX'):
    """Farbmischung; f, a, b sind Sockel oder Werte."""
    n = N(nt, 'ShaderNodeMix', data_type='RGBA', blend_type=typ)
    if isinstance(f, (int, float)): n.inputs[0].default_value = f
    else: L(nt, f, n.inputs[0])
    for s, v in ((n.inputs[6], a), (n.inputs[7], b)):
        if isinstance(v, tuple): s.default_value = (*v, 1)
        else: L(nt, v, s)
    return n.outputs[2]


def F_(nt, f, a, b):
    """Zahlenmischung."""
    n = N(nt, 'ShaderNodeMix', data_type='FLOAT')
    for s, v in ((n.inputs[0], f), (n.inputs[2], a), (n.inputs[3], b)):
        if isinstance(v, (int, float)): s.default_value = v
        else: L(nt, v, s)
    return n.outputs[0]


def RAU(nt, vec, skala, w=0.0, detail=3.0, rauheit=0.5, strecke=None):
    """Rauschen in 4D (w trennt die Masken voneinander); `strecke` verzerrt den Raum (Schmutzfahnen laufen senkrecht)."""
    n = N(nt, 'ShaderNodeTexNoise', noise_dimensions='4D')
    n.inputs['Scale'].default_value = skala; n.inputs['Detail'].default_value = detail
    n.inputs['Roughness'].default_value = rauheit; n.inputs['W'].default_value = w
    if strecke is not None:
        mp = N(nt, 'ShaderNodeMapping'); mp.inputs['Scale'].default_value = strecke; L(nt, vec, mp.inputs['Vector']); vec = mp.outputs[0]
    L(nt, vec, n.inputs['Vector'])
    return n.outputs['Fac']


def hmisch(nt, maske, a, b, weich=0.12, gewicht=0.35):
    """Zwei Schichten (Farbe, Höhe) nach Maske **und** Höhe mischen: die höhere Schicht gewinnt am Übergang —
    Laub liegt in den Senken der Erde, Moos kriecht von den Buckeln, keine weiche Überblendung."""
    dh = M_(nt, 'SUBTRACT', b[1], a[1])
    f = R_(nt, M_(nt, 'MULTIPLY_ADD', dh, gewicht, maske), 0.5 - weich, 0.5 + weich)
    return X_(nt, f, a[0], b[0]), F_(nt, f, a[1], b[1])


def moosfarbe(nt, vec, skala=20.0):
    """Zwei Grüntöne in Kissen (grobes Rauschen, flimmert nicht)."""
    r = N(nt, 'ShaderNodeValToRGB'); e = r.color_ramp.elements
    e[0].position = 0.3; e[0].color = (0.035, 0.060, 0.014, 1); e[1].position = 0.75; e[1].color = (0.075, 0.105, 0.026, 1) if R3 else (0.15, 0.20, 0.045, 1)
    L(nt, RAU(nt, vec, skala, 11.0, 3.0), r.inputs['Fac'])
    return r.outputs[0]


def mat_mauer_ziel(name, art='broken_wall', kachel_m=3.0, tiefe=0.13, moos=1.0):
    """Bruchsteinmauer als Fläche: Mauer-Scan (Farbe, Rauheit, Höhe) mit starker echter Verschiebung — jeder Stein
    hat seine gerundete, ausgebrochene Kante aus dem Scan, die Fuge ist Mörtel/Erde. Darüber Verwitterung, die der
    Scan allein nicht hat und die das Kachelmuster bricht: ausgebrochene Schale (rauer Kern, zurückgesetzt),
    Schmutzfahnen von der Krone, Feuchte am Fuss, Flechten auf den Steinköpfen, Moos an Krone, Fuss und in den Fugen.
    Die Masken kommen aus dem Vertexattribut `Wetter` (R Krone, G Fuss, B Rand), das `mauer_scan` schreibt."""
    m, nt, out = neues_material(name); m.displacement_method = 'BOTH'
    tc = N(nt, 'ShaderNodeTexCoord'); P = tc.outputs['Object']; geo = N(nt, 'ShaderNodeNewGeometry')
    wa = N(nt, 'ShaderNodeAttribute'); wa.attribute_name = 'Wetter'
    ws = N(nt, 'ShaderNodeSeparateColor'); L(nt, wa.outputs['Color'], ws.inputs[0])
    krone, fuss, rand = ws.outputs[0], ws.outputs[1], ws.outputs[2]
    mp = N(nt, 'ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1 / kachel_m,) * 3; L(nt, P, mp.inputs['Vector'])
    dif = kachel(nt, mp.outputs[0], scan(art, 'diff'), True, blend=0.15).outputs['Color']
    rau = kachel(nt, mp.outputs[0], scan(art, 'rough'), False, blend=0.15).outputs['Color']
    hoe = kachel(nt, mp.outputs[0], scan(art, 'disp'), False, blend=0.15).outputs['Color']
    # Ausgebrochene Schale: grobe Flecken, häufiger an Krone und Rand; die Höhe der Steine entscheidet den Rand
    mp2 = N(nt, 'ShaderNodeMapping'); mp2.inputs['Scale'].default_value = (1 / 1.8,) * 3; mp2.inputs['Location'].default_value = (3.3, 1.7, 0.4); L(nt, P, mp2.inputs['Vector'])
    dif2 = kachel(nt, mp2.outputs[0], scan('rock_wall_10', 'diff'), True, blend=0.2).outputs['Color']
    hoe2 = kachel(nt, mp2.outputs[0], scan('rock_wall_10', 'disp'), False, blend=0.2).outputs['Color']
    an = M_(nt, 'ADD', RAU(nt, P, 0.5, 1.0, 3.0), M_(nt, 'MULTIPLY_ADD', krone, 0.10, M_(nt, 'MULTIPLY', rand, 0.16)))
    aus = R_(nt, M_(nt, 'MULTIPLY_ADD', hoe, -0.22, an), 0.50, 0.56)
    kern_f = X_(nt, 1.0, dif2, (0.62, 0.56, 0.50), 'MULTIPLY')
    farbe = X_(nt, aus, dif, kern_f)
    hoehe = F_(nt, aus, hoe, M_(nt, 'MULTIPLY_ADD', hoe2, 0.75, -0.62))
    # Grosse Farbwolken: kein Quadratmeter gleich hell
    farbe = X_(nt, 1.0, farbe, X_(nt, RAU(nt, P, 0.28, 2.0, 2.0), (0.70, 0.68, 0.66), (1.12, 1.08, 1.02)), 'MULTIPLY')
    fuge = R_(nt, hoehe, 0.42, 0.18)
    # Schmutzfahnen: senkrecht gestrecktes Rauschen, von der Krone abwärts schwächer; nasser (glatter) und dunkler
    fahne = M_(nt, 'MULTIPLY', R_(nt, RAU(nt, P, 1.0, 3.0, 4.0, 0.6, (5.5, 5.5, 0.22)), 0.50, 0.68), M_(nt, 'MULTIPLY_ADD', krone, 0.55, 0.45))
    farbe = X_(nt, M_(nt, 'MULTIPLY', fahne, 0.62), farbe, X_(nt, 1.0, farbe, (0.36, 0.32, 0.27), 'MULTIPLY'))
    # Feuchte am Fuss: Spritzwasser und Erde — dunkler, grünstichig
    farbe = X_(nt, M_(nt, 'MULTIPLY', fuss, 0.7), farbe, X_(nt, 1.0, farbe, (0.50, 0.54, 0.42), 'MULTIPLY'))
    # Flechten: helle graugrüne und ockerfarbene Flecken auf den Steinköpfen (nicht in der Fuge, nicht in der Nässe)
    kopf = M_(nt, 'MULTIPLY', R_(nt, hoehe, 0.45, 0.6), M_(nt, 'SUBTRACT', 1.0, M_(nt, 'MAXIMUM', aus, M_(nt, 'MULTIPLY', fuss, 0.8))))
    fl1 = M_(nt, 'MULTIPLY', R_(nt, RAU(nt, P, 2.6, 4.0, 5.0, 0.62), 0.60, 0.66), kopf)
    fl2 = M_(nt, 'MULTIPLY', R_(nt, RAU(nt, P, 3.8, 5.0, 5.0, 0.62), 0.64, 0.69), kopf)
    farbe = X_(nt, M_(nt, 'MULTIPLY', fl1, 0.62), farbe, (0.50, 0.52, 0.42))
    farbe = X_(nt, M_(nt, 'MULTIPLY', fl2, 0.55), farbe, (0.46, 0.36, 0.13))
    # Moos: Krone, Fuss, Fugen und alles, was nach oben schaut (Simse der vorstehenden Steine)
    sep = N(nt, 'ShaderNodeSeparateXYZ'); L(nt, geo.outputs['Normal'], sep.inputs[0])
    oben = R_(nt, sep.outputs['Z'], 0.45, 0.9)
    # Runde 4: das Kronenmoos ist Geometrie (`moospolster`), der Anstrich darunter nur noch dünn
    wo = M_(nt, 'MAXIMUM', M_(nt, 'MAXIMUM', M_(nt, 'MULTIPLY', krone, 0.55 if R4 else 1.15), M_(nt, 'MULTIPLY', fuss, 0.85)), M_(nt, 'MAXIMUM', M_(nt, 'MULTIPLY', fuge, 0.62), oben))
    wo = M_(nt, 'ADD', wo, M_(nt, 'MULTIPLY', aus, 0.25))
    mm = R_(nt, M_(nt, 'MULTIPLY', M_(nt, 'MULTIPLY', wo, R_(nt, RAU(nt, P, 1.3, 6.0, 5.0, 0.6), 0.30, 0.70)), 1.5 * moos), 0.42, 0.62)
    if R3: farbe = X_(nt, 1.0, farbe, (0.58, 0.51, 0.43) if R4 else (0.74, 0.67, 0.58), 'MULTIPLY')   # Runde 3: im vollen Seitenlicht ist der Scan kalkweiss — auf verwitterten Stein gedeckt
    farbe = X_(nt, mm, farbe, moosfarbe(nt, P))
    b = N(nt, 'ShaderNodeBsdfPrincipled'); L(nt, farbe, b.inputs['Base Color'])
    rg = F_(nt, M_(nt, 'MULTIPLY', fahne, 0.5), rau, M_(nt, 'MULTIPLY', rau, 0.55))
    L(nt, F_(nt, mm, rg, 1.0), b.inputs['Roughness'])
    bump = N(nt, 'ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.45; bump.inputs['Distance'].default_value = 0.012
    L(nt, hoehe, bump.inputs['Height']); L(nt, bump.outputs['Normal'], b.inputs['Normal'])
    dsp = N(nt, 'ShaderNodeDisplacement'); dsp.inputs['Midlevel'].default_value = 0.55; dsp.inputs['Scale'].default_value = tiefe
    L(nt, M_(nt, 'MULTIPLY_ADD', mm, 0.14, hoehe), dsp.inputs['Height'])
    L(nt, b.outputs[0], out.inputs['Surface']); L(nt, dsp.outputs[0], out.inputs['Displacement'])
    return m


def stein_verwittert(ziel, groesse, matrix, saat, rauheit=0.06, rund=0.35, flach=False, schnitt=None):
    """Stein mit gerundeten, ausgebrochenen Kanten: wie `stein_bruch`, aber weniger scharf geschnitten und danach
    geglättet — Jahrhunderte Frost und Regen runden jede Kante. `flach`: Platte (dünn in z), Brüche laufen im Grundriss.
    `schnitt` = (Winkel, Abstand, Seite): Platte entlang einer Linie gebrochen, nur eine Hälfte bleibt."""
    rnd = random.Random(saat)
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=3, use_grid_fill=True)
    ebenen = []
    for _ in range(rnd.choice((1, 2, 2, 3))):
        if flach: nrm = Vector((rnd.choice((-1, 1)) * rnd.uniform(0.3, 1), rnd.choice((-1, 1)) * rnd.uniform(0.3, 1), rnd.choice((-1, 1)) * rnd.uniform(0.0, 0.3))).normalized()
        else: nrm = Vector((rnd.choice((-1, 1)) * rnd.uniform(0.3, 1), rnd.choice((-1, 1)) * rnd.uniform(0.0, 0.5), rnd.choice((-1, 1)) * rnd.uniform(0.3, 1))).normalized()
        ebenen.append((nrm, 0.5 * (abs(nrm.x) + abs(nrm.y) + abs(nrm.z)) * rnd.uniform(0.62, 0.88)))
    if schnitt is not None:
        w, d, seite = schnitt
        ebenen.append((Vector((math.cos(w), math.sin(w), 0.0)) * seite, d * seite - 0.012))
    for nrm, d in ebenen:
        res = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=nrm * d, plane_no=nrm, clear_outer=True)
        kanten = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge) and e.is_boundary]
        if kanten: bmesh.ops.holes_fill(bm, edges=kanten, sides=0)
    for _ in range(2): bmesh.ops.smooth_vert(bm, verts=bm.verts[:], factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    off = Vector((rnd.random() * 60, rnd.random() * 60, rnd.random() * 60))
    gx = groesse[0] * rnd.uniform(0.86, 1.0)
    gy = groesse[1] * (rnd.uniform(0.86, 1.0) if flach else 1.0)
    gz = groesse[2] * (1.0 if flach else rnd.uniform(0.74, 1.0))
    for v in bm.verts:
        p = v.co.copy()
        n = noise.noise(p * 1.8 + off) * rauheit * 2.0 + noise.noise(p * 4.5 + off) * rauheit * 0.8
        v.co = Vector((p.x * gx, p.y * gy, p.z * gz)) * (1.12 + n)   # 1,12: die Glättung zieht den Würfel ein
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if flach: lage = Matrix.Identity(4)
    else: lage = Matrix.Translation(Vector((0, rnd.uniform(-0.03, 0.05), rnd.uniform(-0.02, 0.0)))) @ Matrix.Rotation(rnd.uniform(-0.08, 0.08), 4, 'Y')
    bmesh.ops.transform(bm, matrix=matrix @ lage, verts=bm.verts[:])
    me = bpy.data.meshes.new('stein'); bm.to_mesh(me); bm.free()
    ziel.from_mesh(me); bpy.data.meshes.remove(me)


def setze_frei(me, name, ort, skala, rot=(0.0, 0.0, 0.0)):
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    o.location = ort; o.scale = (skala,) * 3; o.rotation_euler = rot
    return o


def mauer_scan(name, ort, laenge, hoehe, dicke, achse, saat, mat, mat_kern, hmin, oeffnung=None, schutz=None, lehne=0.0):
    """Ersatz für `szenenbau.mauer` (gleiche Signatur): ein Mauerkörper mit Scan-Mauerwerk statt einzelner Klötze.
    Die Oberkante ist gestuft (Steine fehlen lagenweise), die Enden laufen als Zahnung aus, die Flucht ist leicht
    verbeult. Auf der Krone und am Fuss liegen echte Scan-Steine; der Bogen bekommt rundgewitterte Keilsteine."""
    import szenenbau as sb
    rnd = random.Random(saat * 31 + 5)
    dreh = Matrix.Rotation(math.pi / 2, 4, 'Z') if achse == 'y' else Matrix.Identity(4)
    welt = lambda u, q, z: Vector(ort) + dreh @ Vector((u, q, z))
    quer = dreh @ Vector((0, 1, 0))
    # Kronenprofil: Abschnitte in Steinbreite, jeder mit eigener Höhe
    absch = []; u = -laenge / 2
    while u < laenge / 2:
        b = min(rnd.uniform(0.32, 0.95), laenge / 2 - u + 0.01); um = u + b / 2
        h = sb.hoehenprofil(um, hmin, hoehe, saat, schutz) + rnd.uniform(-0.38, 0.08)
        ende = max(0.0, laenge / 2 - abs(um))
        if ende < 2.4: h = min(h, hmin * 0.3 + (h - hmin * 0.3) * (ende / 2.4) ** 0.75 + rnd.uniform(-0.22, 0.18))
        if schutz is not None and abs(um - schutz[0]) < schutz[1] + 0.5: h = max(h, schutz[2] - 0.25)
        absch.append((u, u + b, max(0.3, h))); u += b

    def hoch(uu):
        for a, e, h in absch:
            if a <= uu < e: return h
        return 0.0
    z_ = 0.14; nu = int(round(laenge / z_)); nz = int(hoehe / z_) + 2; t = dicke * 0.9
    halten = lambda i, j: 0 <= i < nu and 0 <= j < nz and (j + 0.5) * z_ < hoch(-laenge / 2 + (i + 0.5) * z_) and not sb.im_bogen(-laenge / 2 + (i + 0.5) * z_, (j + 0.5) * z_, oeffnung, 0.08)
    bm = bmesh.new(); ecken = {}; wetter = []
    off = Vector((saat * 3.7, saat * 1.3, 0))

    def ecke(i, j, s):
        k = (i, j, s)
        if k not in ecken:
            uu, zz = -laenge / 2 + i * z_, j * z_
            beule = 0.05 * noise.noise(Vector((uu * 0.35, zz * 0.35, 0)) + off) + 0.02 * noise.noise(Vector((uu * 1.3, zz * 1.3, 5)) + off)
            ecken[k] = bm.verts.new(dreh @ Vector((uu, s * t / 2 + beule, zz)))
            randn = max(0.0, 1.0 - (laenge / 2 - abs(uu)) / 1.5)
            if oeffnung is not None and sb.im_bogen(uu, zz, oeffnung, 0.9): randn = max(randn, 0.8)
            wetter.append((max(0.0, min(1.0, 1.0 - (hoch(min(uu, laenge / 2 - 0.01)) - zz) / 1.5)), max(0.0, min(1.0, 1.0 - zz / 0.9)), randn))
        return ecken[k]
    for i in range(nu):
        for j in range(nz):
            if not halten(i, j): continue
            bm.faces.new((ecke(i, j, -1), ecke(i + 1, j, -1), ecke(i + 1, j + 1, -1), ecke(i, j + 1, -1)))
            bm.faces.new((ecke(i, j, 1), ecke(i, j + 1, 1), ecke(i + 1, j + 1, 1), ecke(i + 1, j, 1)))
            for (di, dj), (a, b2) in (((-1, 0), ((i, j), (i, j + 1))), ((1, 0), ((i + 1, j), (i + 1, j + 1))), ((0, 1), ((i, j + 1), (i + 1, j + 1))), ((0, -1), ((i, j), (i + 1, j)))):
                if dj == -1 and j == 0: continue   # Sohle steckt im Boden
                if not halten(i + di, j + dj):
                    bm.faces.new((ecke(*a, -1), ecke(*b2, -1), ecke(*b2, 1), ecke(*a, 1)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    art = 'castle_wall_slates' if name in (('Stuetzmauer',) if R4 else ('MauerC', 'Stuetzmauer')) else 'broken_wall'   # Runde 4: Mauerrest aus demselben Bruchstein
    if art not in MAUERMAT:
        MAUERMAT[art] = mat_mauer_ziel('Mauerwerk_' + art, art, 3.0 if art == 'broken_wall' else 2.5, 0.13 if art == 'broken_wall' else 0.10, 0.6 if R3 and art != 'broken_wall' else 1.0)
    rot = (lehne if achse == 'x' else 0.0, lehne if achse == 'y' else 0.0, 0.0)
    o = sb.fertig(name, bm, ort, MAUERMAT[art], False, rot)
    ca = o.data.color_attributes.new('Wetter', 'FLOAT_COLOR', 'POINT')
    for i, w in enumerate(wetter): ca.data[i].color = (*w, 1.0)
    print(name, 'Mauerkörper', len(o.data.polygons), 'Flächen,', len(absch), 'Kronenabschnitte')
    # Bogen und Gewände: rundgewitterte Keilsteine (einzelne Steine, weil ihre Fugen radial laufen)
    if oeffnung is not None:
        bb = bmesh.new(); u0, b, h = oeffnung; R = b / 2 + 0.16; zs = h - b / 2
        n = max(9, int(math.pi * R / 0.34))
        for i in range(n + 1):
            a = math.pi * i / n
            mm = dreh @ Matrix.Translation(Vector((u0 + R * math.cos(a), 0, zs + R * math.sin(a)))) @ Matrix.Rotation(a - math.pi / 2, 4, 'Y')
            stein_verwittert(bb, (rnd.uniform(0.30, 0.36), dicke * 1.03, rnd.uniform(0.38, 0.50)), mm, saat * 7 + i, 0.05, 0.25)
        zz = 0.14
        while zz < zs - 0.12:
            sh = rnd.uniform(0.26, 0.40)
            for s in (-1, 1):
                mm = dreh @ Matrix.Translation(Vector((u0 + s * (R + rnd.uniform(-0.02, 0.05)), 0, zz + sh / 2 - 0.14)))
                stein_verwittert(bb, (rnd.uniform(0.34, 0.52), dicke * 1.03, sh), mm, saat * 11 + int(zz * 10) + s, 0.05, 0.25)
            zz += sh + 0.02
        ob = sb.fertig(name + '_Bogen', bb, ort, mat, False, rot)
    # Krone: Scan-Steine halb eingebettet, an Stufen einer mehr; Punkte für den Bewuchs merken
    steine = vorlagen('rock_moss_set_02')
    for k, (a, e, h) in enumerate(absch):
        um = (a + e) / 2
        if h < 0.5: continue
        MAUERKRONE.append((welt(um, 0, h), quer.copy(), t, name))
        if rnd.random() < 0.72:
            me = steine[rnd.randrange(len(steine))]
            g = rnd.uniform(0.38, 0.78) * min(1.0, (e - a) / 0.5 + 0.35)
            p = welt(um + rnd.uniform(-0.1, 0.1), rnd.uniform(-0.22, 0.22) * t, h - g * rnd.uniform(0.10, 0.22))
            setze_frei(me, '%s_Kronstein%d' % (name, k), p, g / ausdehnung(me), (rnd.uniform(-0.25, 0.25), rnd.uniform(-0.25, 0.25), rnd.random() * 6.283))
    # Schutt am Fuss: herausgefallene Steine, dichter unter den niedrigen (eingestürzten) Abschnitten
    if name != 'Stuetzmauer':
        for k in range(int(laenge * 2.2)):
            uu = rnd.uniform(-laenge / 2 - 0.8, laenge / 2 + 0.8)
            if oeffnung is not None and abs(uu - oeffnung[0]) < oeffnung[1] / 2 + 0.25: continue
            einsturz = 1.0 - min(1.0, hoch(max(-laenge / 2, min(laenge / 2 - 0.01, uu))) / hoehe)
            if rnd.random() > 0.25 + 0.75 * einsturz: continue
            ab = (t / 2 + 0.05 + rnd.expovariate(1.0 / (0.35 + 0.9 * einsturz))) * rnd.choice((-1, 1))
            if abs(ab) > 3.2: continue
            p = welt(uu, ab, 0)
            setze_scan(sb, steine[rnd.randrange(len(steine))], '%s_Schutt%d' % (name, k), p.x, p.y, rnd.uniform(0.16, 0.34) + 0.3 * rnd.random() ** 2, saat * 977 + k, rnd.uniform(0.3, 0.55))
    a0, a1 = welt(-laenge / 2, 0, 0), welt(laenge / 2, 0, 0)
    luecke = None if oeffnung is None else (oeffnung[0] - oeffnung[1] / 2 + laenge / 2, oeffnung[0] + oeffnung[1] / 2 + laenge / 2)
    MAUERLINIEN.append(((a0.x, a0.y), (a1.x, a1.y), luecke, hoch, laenge))
    return o


def plattenhof_ziel(name, ort, groesse, mat, saat, loch=None):
    """Ersatz für `szenenbau.plattenhof` (gleiche Signatur): Platten tiefer eingesunken (der Boden wächst über die
    Ränder), ganze Flecken fehlen (dort steht Bewuchs), ein Drittel ist gebrochen — zwei Hälften mit Spalt, eine gekippt."""
    rnd = random.Random(saat); bm = bmesh.new(); n = 0
    y = -groesse[1] / 2
    while y < groesse[1] / 2:
        sy = 0.6 + rnd.random() * 0.55
        x = -groesse[0] / 2 + rnd.random() * 0.4
        while x < groesse[0] / 2:
            sx = 0.6 + rnd.random() * 0.7
            xc, yc = x + sx / 2, y + sy / 2
            rand = min(groesse[0] / 2 - abs(xc), groesse[1] / 2 - abs(yc))
            p = 0.08 + 0.75 * max(0.0, 1.0 - rand / 2.0)
            p += 0.7 * max(0.0, noise.noise(Vector((xc * 0.22, yc * 0.22, saat * 1.7))) * 2.2)   # überwachsene Inseln
            if loch is not None and abs(xc - loch[0]) < loch[2] and abs(yc - loch[1]) < loch[3]: p = 1.0
            if R4 and abs(ort[1] + yc - pfadmitte(ort[0] + xc)) < 0.55 + sy * 0.35: p = 1.0   # Runde 4: der Trampelpfad läuft über Erde, die Platten sind dort längst herausgetreten
            if rnd.random() > p:
                tief = -0.085 + rnd.uniform(-0.045, 0.02)
                if rnd.random() < 0.33:
                    w = rnd.uniform(0, math.pi); d = rnd.uniform(-0.12, 0.12)
                    for seite in (-1, 1):
                        kipp = Euler((rnd.uniform(-0.07, 0.07), rnd.uniform(-0.07, 0.07), rnd.uniform(-0.08, 0.08))).to_matrix().to_4x4()
                        m = Matrix.Translation(Vector((xc, yc, tief + rnd.uniform(-0.03, 0.01)))) @ kipp
                        stein_verwittert(bm, (sx * 0.95, sy * 0.95, 0.16), m, saat * 1000 + n, 0.04, 0.3, True, (w, d, seite))
                else:
                    kipp = Euler((rnd.uniform(-0.045, 0.045), rnd.uniform(-0.045, 0.045), rnd.uniform(-0.08, 0.08))).to_matrix().to_4x4()
                    stein_verwittert(bm, (sx * 0.95, sy * 0.95, 0.16), Matrix.Translation(Vector((xc, yc, tief))) @ kipp, saat * 1000 + n, 0.04, 0.3, True)
                PLATTEN.append((ort[0] + xc, ort[1] + yc, sx / 2, sy / 2)); n += 1
            x += sx + 0.05
        y += sy + 0.05
    print(name, n, 'Platten (eingesunken, gebrochen)')
    import szenenbau as sb
    return sb.fertig(name, bm, ort, mat)


# ───────────────────────────── Runde 5 (D418): Tümpel statt Becken ─────────────────────────────
# Flo 22.11.2026 zur Freigabe von D386: „das Wasser davor müsste noch etwas natürlich wirken gerade die übergänge am
# Rand“. Das Becken war ein Rechteck mit Steinkranz, die Wasserfläche eine Platte 11 cm ÜBER dem Boden. Jetzt ist es
# eine Senke im Gelände: das Wasser steht dort, wo der Boden unter dem Spiegel liegt (D398, Physik) — die Uferlinie
# entsteht aus dem Gelände und ist deshalb unregelmässig. Umriss: Ellipse mit drei Wellen, überall dieselbe Formel
# (Gelände, Wasser, Bodenmaterial, Bewuchs).
TUEMPEL = {'x': -2.5, 'y': -3.0, 'ax': 3.8, 'ay': 5.4, 'tief': 0.42, 'spiegel': 0.045, 'aussen': 1.3,
           'wellen': ((2, 0.16, 1.3), (3, 0.10, 4.1), (5, 0.06, 0.7))}


def tuempel_n(x, y):
    """Normierter Abstand von der Tümpelmitte: 1 = Umriss (≈ Uferlinie), 0 = Mitte."""
    dx, dy = (x - TUEMPEL['x']) / (TUEMPEL['ax'] / 2), (y - TUEMPEL['y']) / (TUEMPEL['ay'] / 2)
    th = math.atan2(dy, dx)
    return math.hypot(dx, dy) / (1.0 + sum(a * math.sin(k * th + ph) for k, a, ph in TUEMPEL['wellen']))


def tuempel_tiefe(x, y):
    """Wie weit das Gelände an (x, y) abgesenkt ist (m); der Wasserspiegel liegt `spiegel` unter dem alten Boden."""
    t = min(1.0, tuempel_n(x, y) / TUEMPEL['aussen'])
    return TUEMPEL['tief'] * (1.0 - t * t * (3 - 2 * t)) ** 1.3


def tuempel_n_knoten(nt, x, y):
    """`tuempel_n` als Knoten (x, y: Sockel in Weltkoordinaten) — für Boden und Wasser dieselbe Formel."""
    T = TUEMPEL
    ux = M_(nt, 'DIVIDE', M_(nt, 'SUBTRACT', x, T['x']), T['ax'] / 2); uy = M_(nt, 'DIVIDE', M_(nt, 'SUBTRACT', y, T['y']), T['ay'] / 2)
    th = M_(nt, 'ARCTAN2', uy, ux); form = None
    for k_, a_, ph_ in T['wellen']:
        w_ = M_(nt, 'MULTIPLY', M_(nt, 'SINE', M_(nt, 'MULTIPLY_ADD', th, float(k_), ph_)), a_)
        form = w_ if form is None else M_(nt, 'ADD', form, w_)
    return M_(nt, 'DIVIDE', M_(nt, 'SQRT', M_(nt, 'ADD', M_(nt, 'MULTIPLY', ux, ux), M_(nt, 'MULTIPLY', uy, uy))), M_(nt, 'ADD', form, 1.0))


def mat_wasser5():
    """Stehendes, klares Wasser: Spiegelung nach Fresnel (flach gesehen spiegelt es Himmel und Mauer, steil gesehen
    sieht man den Grund), kaum Wellen, leicht grünbraun getönt. Schattenstrahlen gehen durch — der Grund liegt in der
    Sonne, wo das Ufer sie durchlässt."""
    m, nt, out = neues_material('Wasser5')
    b = N(nt, 'ShaderNodeBsdfPrincipled'); b.inputs['Base Color'].default_value = (0.62, 0.66, 0.52, 1); b.inputs['Roughness'].default_value = 0.015
    b.inputs['Transmission Weight'].default_value = 1.0; b.inputs['IOR'].default_value = 1.333
    tc = N(nt, 'ShaderNodeTexCoord')
    bump = N(nt, 'ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.035; bump.inputs['Distance'].default_value = 0.02
    L(nt, RAU(nt, tc.outputs['Object'], 3.2, 0.0, 2.0), bump.inputs['Height']); L(nt, bump.outputs['Normal'], b.inputs['Normal'])
    tp = N(nt, 'ShaderNodeBsdfTransparent'); tp.inputs['Color'].default_value = (0.82, 0.86, 0.74, 1)
    lp = N(nt, 'ShaderNodeLightPath'); mx = N(nt, 'ShaderNodeMixShader')
    L(nt, lp.outputs['Is Shadow Ray'], mx.inputs['Fac']); L(nt, b.outputs[0], mx.inputs[1]); L(nt, tp.outputs[0], mx.inputs[2])
    # Nur innerhalb der Uferlinie (n ≈ 0,96): draussen sackt der verschobene Boden in Mulden unter den Spiegel und das
    # Wasser stand dort als heller Film über dem Sand (Uferkamera, linker Rand, D418)
    sep = N(nt, 'ShaderNodeSeparateXYZ'); L(nt, tc.outputs['Object'], sep.inputs[0])
    un = tuempel_n_knoten(nt, sep.outputs['X'], sep.outputs['Y'])
    drin = R_(nt, un, 1.0, 0.96)
    # Flacher Rand trüb und matt (D419): wenige Zentimeter tiefes Wasser über hellem Grund spiegelte als glatter heller Film
    # (Strahl durch die Flecken: Wasser 3 cm über dem Boden, innerhalb der Uferlinie — physikalisch richtig, aber zu sauber).
    # In der Natur ist der Rand von Schwebstoff, Pollen und Staub belegt: rauer, bräunlicher, die Spiegelung wird weich.
    rand = R_(nt, M_(nt, 'ADD', un, M_(nt, 'MULTIPLY', M_(nt, 'SUBTRACT', RAU(nt, tc.outputs['Object'], 2.5, 0.0, 3.0), 0.5), 0.12)), 0.62, 0.90)
    L(nt, F_(nt, rand, 0.015, 0.22), b.inputs['Roughness'])
    L(nt, X_(nt, rand, (0.62, 0.66, 0.52), (0.40, 0.36, 0.26)), b.inputs['Base Color'])
    leer = N(nt, 'ShaderNodeBsdfTransparent'); mx2 = N(nt, 'ShaderNodeMixShader')
    L(nt, drin, mx2.inputs['Fac']); L(nt, leer.outputs[0], mx2.inputs[1]); L(nt, mx.outputs[0], mx2.inputs[2]); L(nt, mx2.outputs[0], out.inputs['Surface'])
    return m


def tuempel(name, ort, mat, saat):
    import szenenbau as sb
    rnd = random.Random(saat * 17 + 5); T = TUEMPEL
    ter = sb.GELAENDE['obj'] or next(o for o in bpy.data.objects if o.name.startswith('terrain'))
    mi = ter.matrix_world.inverted(); n_ab = 0
    # Das Gelände ist ein 1-m-Raster: abgesenkt würde die Uferlinie ein Vieleck. Um den Tümpel lokal auf 25 cm verfeinern.
    bm = bmesh.new(); bm.from_mesh(ter.data); Mw = ter.matrix_world
    im_feld = lambda v: abs((Mw @ v.co).x - T['x']) < T['ax'] * 0.95 and abs((Mw @ v.co).y - T['y']) < T['ay'] * 0.95
    kanten = list({e for f in bm.faces if all(im_feld(v) for v in f.verts) for e in f.edges})
    bmesh.ops.subdivide_edges(bm, edges=kanten, cuts=3, use_grid_fill=True)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    bm.to_mesh(ter.data); bm.free()
    for v in ter.data.vertices:   # Senke ins Gelände (Raster 1 m): Mitte 42 cm, am Umriss ~3 cm, bei 1,3 × Umriss null
        w = ter.matrix_world @ v.co
        if abs(w.x - T['x']) > T['ax'] or abs(w.y - T['y']) > T['ay']: continue
        d = tuempel_tiefe(w.x, w.y)
        if d > 1e-4: w.z -= d; v.co = mi @ w; n_ab += 1
    ter.data.update(); bpy.context.view_layer.update()
    # Wasserspiegel: etwas grösser als die Uferlinie (n ≈ 0,96), der Rand verschwindet im Gelände; weiter draussen
    # würde er in Mulden der Bodenverschiebung als Film über dem Sand stehen — die Uferlinie ist der Schnitt mit dem Boden
    bm = bmesh.new(); z = ort[2] - T['spiegel']; rand = []
    for i in range(72):
        th = i / 72 * 6.283; f = 1.08 * (1.0 + sum(a * math.sin(k * th + ph) for k, a, ph in T['wellen']))
        rand.append(bm.verts.new((T['x'] + math.cos(th) * f * T['ax'] / 2, T['y'] + math.sin(th) * f * T['ay'] / 2, z)))
    bm.faces.new(rand); me = bpy.data.meshes.new(name + '_Wasser'); bm.to_mesh(me); bm.free()
    w = bpy.data.objects.new(name + '_Wasser', me); bpy.context.collection.objects.link(w); sb.setze(w, mat_wasser5())
    # Steine: keine Einfassung, sondern drei lockere Gruppen am Ufer und ein paar im flachen Wasser
    steine = vorlagen('rock_moss_set_02'); k = 0
    def punkt(th, n):
        f = n * (1.0 + sum(a * math.sin(kk * th + ph) for kk, a, ph in T['wellen']))
        return T['x'] + math.cos(th) * f * T['ax'] / 2, T['y'] + math.sin(th) * f * T['ay'] / 2
    for th0, anz in ((0.4, 5), (2.5, 4), (4.3, 6)):
        for _ in range(anz):
            x, y = punkt(th0 + rnd.gauss(0, 0.28), rnd.uniform(0.86, 1.14)); g = rnd.uniform(0.35, 0.95)
            setze_scan(sb, steine[rnd.randrange(len(steine))], '%s_Rand%d' % (name, k), x, y, g, saat * 131 + k, rnd.uniform(0.25, 0.45)); k += 1
    for _ in range(4):
        x, y = punkt(rnd.uniform(0, 6.283), rnd.uniform(0.35, 0.75)); g = rnd.uniform(0.3, 0.6)
        setze_scan(sb, steine[rnd.randrange(len(steine))], '%s_Rand%d' % (name, k), x, y, g, saat * 131 + k, rnd.uniform(0.3, 0.5)); k += 1
    # Uferbewuchs: Grasbüschel dicht an der Wasserlinie, dahinter Farn — nicht ringsum, das Ufer bleibt stellenweise offen
    gras = pflanzen('grass_medium_02', 0.4); farn = pflanzen('fern_02', 0.45); kb = 0
    for _ in range(46):
        th = rnd.uniform(0, 6.283)
        if math.sin(th * 2 + 0.6) < -0.35: continue          # offene Uferstellen (Schlamm, Feinkies)
        x, y = punkt(th, rnd.uniform(0.98, 1.22))
        setze_scan(sb, gras[rnd.randrange(len(gras))], '%s_Ufergras%d' % (name, kb), x, y, rnd.uniform(0.45, 0.85), saat * 977 + kb, 0.03); kb += 1
    for _ in range(9):
        th = rnd.uniform(0, 6.283); x, y = punkt(th, rnd.uniform(1.12, 1.45))
        setze_scan(sb, farn[rnd.randrange(len(farn))], '%s_Uferfarn%d' % (name, kb), x, y, rnd.uniform(0.6, 1.0), saat * 977 + kb, 0.03); kb += 1
    print('ZIELBILD Tümpel: %d Geländepunkte abgesenkt, %d Steine, %d Uferpflanzen' % (n_ab, k, kb))
    return w


def steinbecken_ziel(name, ort, aussen, tiefe, mat, mat_wasser, saat):
    """Ersatz für `szenenbau.steinbecken` (gleiche Signatur): der Rand ist kein gemauerter Klotzkranz mehr, sondern
    ein Kranz aus Feldsteinen (Scan-Steine, dicht an dicht, halb eingesunken, hier und da ein zweiter obenauf)."""
    import szenenbau as sb
    if R5: return tuempel(name, ort, mat, saat)
    rnd = random.Random(saat * 13 + 1); steine = vorlagen('rock_moss_set_02'); ax, ay = aussen; k = 0
    umfang = [(-ax / 2, -ay / 2, ax, 0), (ax / 2, -ay / 2, 0, ay), (ax / 2, ay / 2, -ax, 0), (-ax / 2, ay / 2, 0, -ay)]
    for (x0, y0, dx, dy) in umfang:
        lang = abs(dx) + abs(dy); u = 0.0
        while u < lang:
            g = rnd.uniform(0.62, 1.0); t = (u + g * 0.4) / lang
            x, y = ort[0] + x0 + dx * t + rnd.uniform(-0.12, 0.12), ort[1] + y0 + dy * t + rnd.uniform(-0.12, 0.12)
            me = steine[rnd.randrange(len(steine))]
            o = setze_scan(sb, me, '%s_Rand%d' % (name, k), x, y, g, saat * 131 + k, rnd.uniform(0.22, 0.36)); k += 1
            o.location.z = ort[2] - rnd.uniform(0.10, 0.18) * g
            if rnd.random() < 0.22:
                o2 = setze_scan(sb, steine[rnd.randrange(len(steine))], '%s_Rand%d' % (name, k), x + rnd.uniform(-0.1, 0.1), y + rnd.uniform(-0.1, 0.1), g * 0.6, saat * 131 + k, 0.0); k += 1
                o2.location.z = ort[2] + 0.22 * g
            u += g * rnd.uniform(0.62, 0.8)
    sohle = sb.kasten(name + '_Sohle', (ax - 0.5, ay - 0.5, 0.2), (ort[0], ort[1], ort[2] - tiefe - 0.2), 1.0); sb.setze(sohle, mat)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(ort[0], ort[1], ort[2] + 0.11))
    w = bpy.context.active_object; w.name = name + '_Wasser'; w.scale = (ax - 0.3, ay - 0.3, 1); sb.setze(w, mat_wasser)
    return sohle


def pfadmitte(x):
    """Trampelpfad vom Hofrand zum Bogen (y als Funktion von x) — dieselbe Formel steht im Bodenmaterial."""
    return -1.5 - 0.136 * (x - 4.4) + 0.35 * math.sin(0.55 * x)


def mat_boden_ziel(alt, r3=False):
    """Waldboden als Mischung statt als ein Laubteppich: Laubstreu (zwei Scans), Erde mit Steinchen (Pfad und
    Flecken), bemooste Erde (Polster, und überall, wo etwas aufliegt), nasse dunkle Erde. Gemischt wird nach Maske
    **und** Höhe (`hmisch`). Kontakt aus Umgebungsverdeckung: an Mauerfuss, Platten- und Steinrändern wird der Boden
    dunkler, feuchter, moosig — der Übergang Stein↔Boden ist keine Linie mehr. Aussen läuft die Biomfarbe des Spiels."""
    m = alt; nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    alt_farbe = bsdf.inputs['Base Color'].links[0].from_socket if bsdf.inputs['Base Color'].links else None
    m.displacement_method = 'BOTH'
    tc = N(nt, 'ShaderNodeTexCoord'); P = tc.outputs['Object']

    def schicht(name, karte, skala, dreh):
        mp = N(nt, 'ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1 / skala,) * 3; mp.inputs['Rotation'].default_value = (0, 0, dreh)
        L(nt, P, mp.inputs['Vector'])
        d = N(nt, 'ShaderNodeTexImage'); d.image = bild(scan(name, karte)); d.interpolation = 'Cubic'; L(nt, mp.outputs[0], d.inputs['Vector'])
        h = N(nt, 'ShaderNodeTexImage'); h.image = bild(scan(name, 'disp'), False); h.interpolation = 'Cubic'; L(nt, mp.outputs[0], h.inputs['Vector'])
        return d.outputs['Color'], h.outputs['Color']
    laub1 = schicht('forest_leaves_02', 'diffuse', 3.0, 0.0); laub2 = schicht('forest_leaves_04', 'diff', 1.5, 0.7)
    erde = schicht('forest_ground_04', 'diff', 3.1, 1.9); moos = schicht('brown_mud_leaves_01', 'diff', 2.1, 2.6); nass = schicht('mud_forest', 'diff', 2.35, 4.1)
    laub = hmisch(nt, R_(nt, RAU(nt, P, 0.18, 1.0), 0.42, 0.60), laub1, laub2)
    lt = N(nt, 'ShaderNodeHueSaturation'); lt.inputs['Value'].default_value = 0.50 if r3 else 0.68; lt.inputs['Saturation'].default_value = 0.85 if r3 else 0.75; L(nt, laub[0], lt.inputs['Color'])
    laub = (lt.outputs[0], laub[1])
    ao = N(nt, 'ShaderNodeAmbientOcclusion'); ao.inputs['Distance'].default_value = 0.55; ao.samples = 6
    kontakt = R_(nt, ao.outputs['AO'], 0.90, 0.50)
    sep = N(nt, 'ShaderNodeSeparateXYZ'); L(nt, P, sep.inputs[0])
    yc = M_(nt, 'ADD', M_(nt, 'MULTIPLY_ADD', M_(nt, 'SUBTRACT', sep.outputs['X'], 4.4), -0.136, -1.5), M_(nt, 'MULTIPLY', M_(nt, 'SINE', M_(nt, 'MULTIPLY', sep.outputs['X'], 0.55)), 0.35))
    pfad = M_(nt, 'MULTIPLY', R_(nt, M_(nt, 'ABSOLUTE', M_(nt, 'SUBTRACT', sep.outputs['Y'], yc)), (0.80 if R5 else 0.66 if R4 else 0.50) if r3 else 1.0, (0.30 if R4 else 0.14) if r3 else 0.25),   # Runde 3: Trampelpfad schmal (~0,6 m)
                  M_(nt, 'MULTIPLY', R_(nt, sep.outputs['X'], -19.0, -16.0), R_(nt, sep.outputs['X'], 10.5, 8.5)))
    pfad = M_(nt, 'MULTIPLY', pfad, R_(nt, RAU(nt, P, 0.5, 7.0), 0.25, 0.55, 0.85 if R4 else 0.55, 1.0))
    m_moos = R_(nt, M_(nt, 'ADD', M_(nt, 'MULTIPLY_ADD', kontakt, 0.5, RAU(nt, P, 0.22, 2.0, 4.0)), M_(nt, 'MULTIPLY', pfad, -0.45)), 0.44 if r3 else 0.50, 0.58 if r3 else 0.64)
    s = hmisch(nt, m_moos, laub, (X_(nt, 1.0, moos[0], (0.58, 0.80, 0.42) if r3 else (0.80, 0.86, 0.72), 'MULTIPLY'), moos[1]))
    m_nass = R_(nt, M_(nt, 'ADD', RAU(nt, P, 0.13, 3.0), M_(nt, 'MULTIPLY', kontakt, 0.12)), 0.58, 0.70)
    s = hmisch(nt, m_nass, s, (X_(nt, 1.0, nass[0], (0.85, 0.80, 0.74), 'MULTIPLY'), nass[1]))
    m_erde = R_(nt, M_(nt, 'MULTIPLY_ADD', RAU(nt, P, 0.30, 4.0), 0.5, M_(nt, 'MULTIPLY', pfad, 0.6)), 0.42, 0.62)
    s = hmisch(nt, m_erde, s, (X_(nt, 1.0, erde[0], (0.30, 0.25, 0.20) if r3 else (0.50, 0.46, 0.40), 'MULTIPLY'), erde[1]))   # Runde 3: dunkle Erde, kein Sand
    farbe = X_(nt, 1.0, s[0], X_(nt, RAU(nt, P, 0.07, 5.0, 2.0), (0.72, 0.72, 0.70), (1.12, 1.10, 1.05)), 'MULTIPLY')
    farbe = X_(nt, M_(nt, 'MULTIPLY', kontakt, 0.75), farbe, X_(nt, 1.0, farbe, (0.50, 0.55, 0.42), 'MULTIPLY'))
    if R4:   # Trittspur: festgetretene, hellere Erde mit Steinchen — liest sich als Weg, weil sie glatter und heller ist als die Streu daneben
        hell = ((0.66, 0.54, 0.40), (0.95, 0.78, 0.58)) if R5 else ((0.50, 0.40, 0.30), (0.74, 0.60, 0.44))   # Runde 5: Pfad war schwach lesbar
        farbe = X_(nt, M_(nt, 'MULTIPLY', pfad, 1.0 if R5 else 0.9), farbe, X_(nt, 1.0, erde[0], X_(nt, RAU(nt, P, 1.6, 9.0, 3.0), hell[0], hell[1]), 'MULTIPLY'))
    ufer = None
    if R5:   # Ufer des Tümpels: dieselbe Formel wie `tuempel_tiefe`, im Material gerechnet
        T = TUEMPEL
        un = tuempel_n_knoten(nt, sep.outputs['X'], sep.outputs['Y'])
        ut = R_(nt, un, 0.0, T['aussen']); ss = M_(nt, 'MULTIPLY', M_(nt, 'MULTIPLY', ut, ut), M_(nt, 'SUBTRACT', 3.0, M_(nt, 'MULTIPLY', ut, 2.0)))
        tiefe_ = M_(nt, 'MULTIPLY', M_(nt, 'POWER', M_(nt, 'SUBTRACT', 1.0, ss), 1.3), T['tief'])
        hw_ = M_(nt, 'ADD', M_(nt, 'SUBTRACT', tiefe_, T['spiegel']), M_(nt, 'MULTIPLY', M_(nt, 'SUBTRACT', RAU(nt, P, 1.7, 11.0, 3.0), 0.5), 0.022))   # > 0: unter Wasser
        unter = R_(nt, hw_, -0.004, 0.02)                                  # Grund
        saum = M_(nt, 'MULTIPLY', R_(nt, hw_, -0.040, -0.006), R_(nt, un, T['aussen'] * 1.02, T['aussen'] * 0.9))   # nasser Saum über der Wasserlinie, ~0,5 m breit, läuft aus
        kies = M_(nt, 'MULTIPLY', R_(nt, M_(nt, 'ABSOLUTE', M_(nt, 'ADD', hw_, 0.004)), 0.022, 0.004), R_(nt, RAU(nt, P, 0.9, 5.0), 0.40, 0.62))   # Feinkiesband genau an der Linie, in Flecken
        vo = N(nt, 'ShaderNodeTexVoronoi'); vo.inputs['Scale'].default_value = 85.0; L(nt, P, vo.inputs['Vector'])
        steinchen = X_(nt, R_(nt, vo.outputs['Distance'], 0.25, 0.05), (0.10, 0.09, 0.075), X_(nt, vo.outputs['Color'], (0.20, 0.18, 0.15), (0.42, 0.39, 0.33)))
        schlamm = X_(nt, 1.0, nass[0], (0.42, 0.36, 0.29), 'MULTIPLY')                 # nass = dunkler und satter, nicht grau
        farbe = X_(nt, M_(nt, 'MULTIPLY', saum, 0.92), farbe, schlamm)
        grund = X_(nt, R_(nt, hw_, 0.02, 0.30), X_(nt, 1.0, erde[0], (0.36, 0.33, 0.24), 'MULTIPLY'), (0.050, 0.055, 0.035))   # flach: Schlick mit Steinchen sichtbar, tief: dunkelgrün
        farbe = X_(nt, unter, farbe, grund)
        farbe = X_(nt, kies, farbe, steinchen)
        ufer = M_(nt, 'MAXIMUM', saum, unter)
    # Nahmaske wie D371: um den Hof voll Scan, ab ~30 m Biomfarbe
    flach = N(nt, 'ShaderNodeCombineXYZ'); L(nt, sep.outputs['X'], flach.inputs['X']); L(nt, sep.outputs['Y'], flach.inputs['Y'])
    ab = N(nt, 'ShaderNodeVectorMath', operation='DISTANCE'); L(nt, flach.outputs[0], ab.inputs[0]); ab.inputs[1].default_value = (-3.0, 0.0, 0.0)
    fern = R_(nt, ab.outputs['Value'], 30.0, 60.0)
    mix = X_(nt, fern, farbe, alt_farbe if alt_farbe is not None else (0.16, 0.12, 0.07))
    L(nt, mix, bsdf.inputs['Base Color'])
    feucht = M_(nt, 'MAXIMUM', M_(nt, 'MULTIPLY', m_nass, M_(nt, 'SUBTRACT', 1.0, m_erde)), M_(nt, 'MULTIPLY', kontakt, 0.6))
    rau_ = F_(nt, feucht, 0.93, 0.50)
    if ufer is not None: rau_ = F_(nt, ufer, rau_, 0.16)   # nasser Schlamm glänzt
    L(nt, rau_, bsdf.inputs['Roughness'])
    bump = N(nt, 'ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.5; bump.inputs['Distance'].default_value = 0.02
    L(nt, s[1], bump.inputs['Height']); L(nt, bump.outputs['Normal'], bsdf.inputs['Normal'])
    nah = M_(nt, 'SUBTRACT', 1.0, fern)
    hges = M_(nt, 'ADD', M_(nt, 'MULTIPLY', s[1], nah), M_(nt, 'MULTIPLY', fern, 0.5))
    hges = M_(nt, 'ADD', hges, M_(nt, 'MULTIPLY', pfad, -0.5 if R4 else -0.25))   # der Pfad ist ausgetreten: knapp 2 cm tiefer
    if ufer is not None: hges = F_(nt, M_(nt, 'MULTIPLY', ufer, 0.7), hges, 0.5)   # Schlamm und Grund sind glatt gespült
    dsp = N(nt, 'ShaderNodeDisplacement'); dsp.inputs['Midlevel'].default_value = 0.5; dsp.inputs['Scale'].default_value = 0.09
    L(nt, hges, dsp.inputs['Height']); L(nt, dsp.outputs[0], out.inputs['Displacement'])
    return m


def durchscheinend(mat, anteil=0.4):
    """Blattmaterial eines Scans (glTF: Principled) gegenlichttauglich machen: ein Teil des Lichts geht durch das
    Blatt. Ohne das stehen Blätter vor der tiefen Sonne schwarz. Alpha hart geschnitten (kein Rauschen an Blatträndern)."""
    if mat is None or mat.get('durchscheinend'): return
    nt = mat.node_tree
    b = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None)
    if b is None or out is None or not b.inputs['Base Color'].links: return
    farbe = b.inputs['Base Color'].links[0].from_socket
    alpha = b.inputs['Alpha'].links[0].from_socket if b.inputs['Alpha'].links else None
    if alpha is not None: nt.links.remove(b.inputs['Alpha'].links[0]); b.inputs['Alpha'].default_value = 1.0
    if R4:
        # D386: der Alphakanal des glTF-Farbbilds ist leer (JPG) — die echte Maske liegt als eigene Karte daneben.
        # Ohne sie zeigen Blattkarten neben dem Blatt den schwarzen Atlasgrund: die „schwarzen Halme“ aus D372/D382.
        echte = alpha_karte(mat)
        if echte is not None: alpha = echte
    tr = N(nt, 'ShaderNodeBsdfTranslucent'); L(nt, farbe, tr.inputs['Color'])
    if b.inputs['Normal'].links: L(nt, b.inputs['Normal'].links[0].from_socket, tr.inputs['Normal'])
    mx = N(nt, 'ShaderNodeMixShader'); mx.inputs['Fac'].default_value = anteil; L(nt, b.outputs[0], mx.inputs[1]); L(nt, tr.outputs[0], mx.inputs[2])
    ende = mx.outputs[0]
    if alpha is not None:
        tp = N(nt, 'ShaderNodeBsdfTransparent')
        e2 = N(nt, 'ShaderNodeMixShader'); L(nt, M_(nt, 'GREATER_THAN', alpha, 0.4), e2.inputs['Fac']); L(nt, tp.outputs[0], e2.inputs[1]); L(nt, mx.outputs[0], e2.inputs[2])
        ende = e2.outputs[0]
    L(nt, ende, out.inputs['Surface'])
    mat['durchscheinend'] = 1


def pflanzen(name, anteil=0.4, nur=None):
    """Scan-Pflanze laden und ihre Blätter durchscheinend machen. `nur`: Teil des Materialnamens (Bäume: nur das Laub)."""
    ms = vorlagen(name)
    for me in ms:
        for mat in me.materials:
            if mat is not None and (nur is None or nur in mat.name): durchscheinend(mat, anteil)
    return ms


BODENBAUM = {}


def bodenz(ter, x, y):
    """Geländehöhe am Terrain-Netz selbst (eigener Suchbaum: schnell, auch unter Steinen und Bäumen)."""
    if ter.name not in BODENBAUM:
        from mathutils.bvhtree import BVHTree
        mw = ter.matrix_world
        BODENBAUM[ter.name] = BVHTree.FromPolygons([mw @ v.co for v in ter.data.vertices], [tuple(p.vertices) for p in ter.data.polygons])
    ort = BODENBAUM[ter.name].ray_cast(Vector((x, y, 4000.0)), Vector((0, 0, -1)))[0]
    return ort.z if ort is not None else None


def streue(ter, meshes, anzahl, dichte, groesse, saat, name, kipp=0.12, sinken=0.02, gebiet=(-14.0, 12.5, -14.0, 14.0)):
    """Pflanzen nach einer Dichtefunktion verteilen (Verwerfungsverfahren): `dichte(x, y)` in 0…1. Geteilte Meshes."""
    rnd = random.Random(saat); n = 0; versuche = 0
    while n < anzahl and versuche < anzahl * 60:
        versuche += 1
        x, y = rnd.uniform(gebiet[0], gebiet[1]), rnd.uniform(gebiet[2], gebiet[3])
        if rnd.random() > dichte(x, y): continue
        z = bodenz(ter, x, y)
        if z is None: continue
        s = rnd.uniform(*groesse)
        setze_frei(meshes[rnd.randrange(len(meshes))], '%s%d' % (name, n), (x, y, z - sinken * s), s, (rnd.uniform(-kipp, kipp), rnd.uniform(-kipp, kipp), rnd.random() * 6.283))
        n += 1
    print('ZIELBILD', name, n, 'gesetzt')
    return n


def mauerabstand(x, y):
    """Abstand zur nächsten Mauerlinie (Öffnungen zählen nicht als Mauer) und ob der Punkt in der Öffnung liegt."""
    best, tor = 1e9, False
    for (a, b, luecke, _h, laenge) in MAUERLINIEN:
        dx, dy = b[0] - a[0], b[1] - a[1]
        tt = max(0.0, min(1.0, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)))
        d = math.hypot(x - a[0] - tt * dx, y - a[1] - tt * dy)
        if luecke is not None and luecke[0] - 0.3 < tt * laenge < luecke[1] + 0.3:
            if d < 1.0: tor = True
            d = max(d, min(tt * laenge - luecke[0] + 0.3, luecke[1] + 0.3 - tt * laenge) + 0.6)
        best = min(best, d)
    return best, tor


def bergkulissen(zt, saat=372):
    """Gestaffelte Höhenzüge im Tal (Osten, 0,7–8 km): reine Silhouetten, die der Dunst in Tonstufen trennt —
    nah dunkel und kantig, fern hell und weich. Kulisse, kein Gelände (wie `szenenbau.fernkulisse`)."""
    m, nt, out = neues_material('Bergkulisse')
    b = N(nt, 'ShaderNodeBsdfPrincipled'); b.inputs['Base Color'].default_value = (0.040, 0.055, 0.045, 1); b.inputs['Roughness'].default_value = 1.0
    L(nt, b.outputs[0], out.inputs['Surface'])
    for k, (dist, lo, hi) in enumerate(((800.0, -150.0, -15.0), (1300.0, -120.0, 25.0), (2000.0, -90.0, 80.0), (3000.0, -60.0, 150.0), (4500.0, 0.0, 270.0), (6500.0, 80.0, 430.0), (9000.0, 220.0, 640.0))):
        bm = bmesh.new(); unten = []; oben = []; n = 160
        for i in range(n + 1):
            t = i / n; y = (t - 0.5) * dist * 3.0
            f = 0.55 * noise.noise(Vector((t * 5.0 + k * 3.1, k * 1.7, saat))) + 0.30 * noise.noise(Vector((t * 13.0 + k, 2.0, saat))) + 0.15 * noise.noise(Vector((t * 34.0, k, saat)))
            grat = 1.0 - abs(noise.noise(Vector((t * 8.0 + k * 7.0, 5.0, saat))))
            h = lo + (hi - lo) * max(0.0, min(1.0, 0.5 + 0.9 * f)) * (0.55 + 0.45 * grat)
            x = dist * (1.0 + 0.10 * noise.noise(Vector((t * 3.0 + k * 5.0, 1.0, saat))))
            unten.append(bm.verts.new((x, y, zt - 900.0))); oben.append(bm.verts.new((x, y, zt + h)))
        for i in range(n): bm.faces.new((unten[i], unten[i + 1], oben[i + 1], oben[i]))
        me = bpy.data.meshes.new('Berg%d' % k); bm.to_mesh(me); bm.free(); me.materials.append(m)
        o = bpy.data.objects.new('Berg%d' % k, me); bpy.context.collection.objects.link(o)


def himmel_foto(name, el_grad, az_grad, u_sonne, staerke=1.0, gamma=1.35, dreh_grad=0.0):
    """Wolkenhimmel aus einem Himmelsfoto (CC0-HDRI ohne Boden), so gedreht, dass seine Sonne auf der Szenensonne
    liegt. Gestaltet, nicht übernommen (ADR-0018): Kontrast angehoben (Wolkenmassen lesbar), zur Sonne hin warm,
    abgewandt gedeckt blau-violett. Wie in D371 sieht ihn nur die Kamera; die Szene beleuchtet ein kühles Füllen."""
    w = bpy.data.worlds.new('Zielbild2'); bpy.context.scene.world = w; w.use_nodes = True; nt = w.node_tree; nt.nodes.clear()
    out = N(nt, 'ShaderNodeOutputWorld')
    tc = N(nt, 'ShaderNodeTexCoord')
    o = os.path.join(cc0_ordner(), name)
    env = N(nt, 'ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(os.path.join(o, next(f for f in sorted(os.listdir(o)) if f.endswith('.hdr'))), check_existing=True)
    phi = 2 * math.pi * (u_sonne - 0.5)                      # Blender: u = atan2(y, −x) / 2π + 0,5
    w_foto = math.atan2(math.sin(phi), -math.cos(phi))       # Azimut der Fotosonne (von +x gegen den Uhrzeigersinn)
    az = math.radians(az_grad); w_ziel = math.atan2(math.cos(az), math.sin(az))
    # `dreh_grad`: Foto gegen die Szenensonne verdreht — die Kamera soll in Wolkenmassen schauen, nicht in den hellsten Fleck
    mp = N(nt, 'ShaderNodeMapping'); mp.inputs['Rotation'].default_value = (0, 0, -(w_ziel - w_foto) + math.radians(dreh_grad))
    L(nt, tc.outputs['Generated'], mp.inputs['Vector']); L(nt, mp.outputs[0], env.inputs['Vector'])
    el = math.radians(el_grad)
    sd = (math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el))
    dirn = N(nt, 'ShaderNodeVectorMath', operation='NORMALIZE'); L(nt, tc.outputs['Generated'], dirn.inputs[0])
    dot = N(nt, 'ShaderNodeVectorMath', operation='DOT_PRODUCT'); dot.inputs[1].default_value = sd; L(nt, dirn.outputs[0], dot.inputs[0])
    zur = R_(nt, dot.outputs['Value'], -0.1, 1.0)
    g = N(nt, 'ShaderNodeGamma'); g.inputs['Gamma'].default_value = gamma; L(nt, env.outputs['Color'], g.inputs['Color'])
    ton = X_(nt, 1.0, g.outputs[0], X_(nt, M_(nt, 'POWER', zur, 1.6), (0.74, 0.72, 0.82), (1.22, 0.95, 0.68)), 'MULTIPLY')
    sicht = N(nt, 'ShaderNodeBackground'); sicht.inputs['Strength'].default_value = staerke; L(nt, ton, sicht.inputs['Color'])
    licht = N(nt, 'ShaderNodeBackground'); licht.inputs['Color'].default_value = (0.24, 0.235, 0.235, 1); licht.inputs['Strength'].default_value = float(os.environ.get('ZIELBILD_FUELL', '1.3'))   # Schatten nicht blau (Regel 3 der Spielereferenz)
    lp = N(nt, 'ShaderNodeLightPath')
    mx = N(nt, 'ShaderNodeMixShader'); L(nt, lp.outputs['Is Camera Ray'], mx.inputs['Fac']); L(nt, licht.outputs[0], mx.inputs[1]); L(nt, sicht.outputs[0], mx.inputs[2])
    L(nt, mx.outputs[0], out.inputs['Surface'])
    return w


# ------------------------------------------------------------------- Zielbild Runde 3 (D382)
def meshhoehe(me):
    """Höhe eines Scan-Meshes (einmal gemessen, am Mesh gemerkt) — Bäume werden auf Zielhöhe skaliert."""
    if 'hoehe' not in me:
        import numpy as np
        k = np.empty(len(me.vertices) * 3, dtype=np.float32); me.vertices.foreach_get('co', k)
        me['hoehe'] = float(k[2::3].max() - k[2::3].min())
    return me['hoehe']


def himmel_haus(el_grad, az_grad, u_sonne=0.6035):
    """Himmel und Füllen wie im Haus-Bild (`hausframe.himmel`, D373/D378 freigegeben): das Abendhimmel-HDRI ist für
    die Kamera sichtbar (Wolken plastischer, warm), und es beleuchtet die Szene halb entsättigt — Schatten
    neutral-warm, nicht blau und nicht schwarz. Gedreht, bis die Fotosonne auf dem Azimut der Sonnenlampe steht."""
    w = bpy.data.worlds.new('Zielbild3'); bpy.context.scene.world = w; w.use_nodes = True; nt = w.node_tree; nt.nodes.clear()
    out = N(nt, 'ShaderNodeOutputWorld'); tc = N(nt, 'ShaderNodeTexCoord')
    o = os.path.join(cc0_ordner(), 'evening_road_01_puresky')
    env = N(nt, 'ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(os.path.join(o, next(f for f in sorted(os.listdir(o)) if f.endswith('.hdr'))), check_existing=True)
    phi = 2 * math.pi * (u_sonne - 0.5)
    w_foto = math.atan2(math.sin(phi), -math.cos(phi)); az = math.radians(az_grad); w_ziel = math.atan2(math.cos(az), math.sin(az))
    mp = N(nt, 'ShaderNodeMapping'); mp.inputs['Rotation'].default_value = (0, 0, w_foto - w_ziel + math.radians(float(os.environ.get('ZIELBILD_HIMMELDREH', '0'))))
    L(nt, tc.outputs['Generated'], mp.inputs['Vector']); L(nt, mp.outputs[0], env.inputs['Vector'])
    g = N(nt, 'ShaderNodeGamma'); g.inputs['Gamma'].default_value = 1.7; L(nt, env.outputs['Color'], g.inputs['Color'])
    sicht = N(nt, 'ShaderNodeBackground'); sicht.inputs['Strength'].default_value = float(os.environ.get('ZIELBILD_HIMMEL', '0.115'))
    L(nt, X_(nt, 1.0, g.outputs[0], (1.24, 0.96, 0.70) if R4 else (1.17, 0.96, 0.76), 'MULTIPLY'), sicht.inputs['Color'])   # Haus: 1,10/0,96/0,82 — hier steht mehr Blau im Bild, etwas wärmer
    licht = N(nt, 'ShaderNodeBackground'); licht.inputs['Strength'].default_value = float(os.environ.get('ZIELBILD_FUELL', '0.42'))
    L(nt, X_(nt, 0.40, env.outputs['Color'], (0.27, 0.27, 0.28)), licht.inputs['Color'])
    lp = N(nt, 'ShaderNodeLightPath')
    mx = N(nt, 'ShaderNodeMixShader'); L(nt, lp.outputs['Is Camera Ray'], mx.inputs['Fac']); L(nt, licht.outputs[0], mx.inputs[1]); L(nt, sicht.outputs[0], mx.inputs[2])
    L(nt, mx.outputs[0], out.inputs['Surface'])
    return w


def bergruecken(zt, saat=382):
    """Vier klar gestaffelte Bergrücken im Osten (0,7 / 1,8 / 4 / 8 km): der nächste bewaldet und niedrig, der fernste
    hoch. Reine Silhouetten in Waldgrün; die Tonstufen (jeder Rücken heller und blasser) legt der Stil aus der Tiefe."""
    m, nt, out = neues_material('Bergruecken')
    b = N(nt, 'ShaderNodeBsdfPrincipled'); b.inputs['Roughness'].default_value = 1.0
    tc = N(nt, 'ShaderNodeTexCoord')
    L(nt, X_(nt, RAU(nt, tc.outputs['Object'], 0.012, 3.0, 4.0), (0.006, 0.012, 0.005), (0.018, 0.026, 0.011)), b.inputs['Base Color'])
    L(nt, b.outputs[0], out.inputs['Surface'])
    for k, (dist, lo, hi, zacke) in enumerate(((700.0, -40.0, 42.0, 5.0), (1800.0, 30.0, 190.0, 9.0), (4000.0, 190.0, 520.0, 14.0), (8000.0, 560.0, 1250.0, 0.0))):
        bm = bmesh.new(); unten = []; oben = []; n = 420
        for i in range(n + 1):
            t = i / n; y = (t - 0.5) * dist * 3.2
            f = 0.55 * noise.noise(Vector((t * 4.0 + k * 3.1, k * 1.7, saat))) + 0.30 * noise.noise(Vector((t * 11.0 + k, 2.0, saat))) + 0.15 * noise.noise(Vector((t * 31.0, k, saat)))
            grat = 1.0 - abs(noise.noise(Vector((t * 7.0 + k * 7.0, 5.0, saat))))
            h = lo + (hi - lo) * max(0.0, min(1.0, 0.5 + 1.0 * f)) * (0.50 + 0.50 * grat) + zacke * noise.noise(Vector((t * 260.0, k, saat)))   # Baumkante
            x = dist * (1.0 + 0.10 * noise.noise(Vector((t * 3.0 + k * 5.0, 1.0, saat))))
            unten.append(bm.verts.new((x, y, zt - 900.0))); oben.append(bm.verts.new((x, y, zt + h)))
        for i in range(n): bm.faces.new((unten[i], unten[i + 1], oben[i + 1], oben[i]))
        me = bpy.data.meshes.new('Ruecken%d' % k); bm.to_mesh(me); bm.free(); me.materials.append(m)
        bpy.context.collection.objects.link(bpy.data.objects.new('Ruecken%d' % k, me))


def efeu_geometrie(zt, saat=382):
    """Efeu aus Blattgeometrie wie am Haus (D373): Träger ist ein welliges Netz 10–35 cm vor der Mauerfläche, darauf
    ~2.000 Hedera-Blätter je m² (Blatt und Streu-Knoten aus `hausframe.py`). Fächer wachsen vom Mauerfuss (unten
    schmal und licht, oben breit, Oberkante ausgefranst), Vorhänge hängen von der Krone."""
    import hausframe as hf
    rnd = random.Random(saat); ph = [rnd.uniform(0, 6.28) for _ in range(8)]
    bm = bmesh.new(); dl = bm.verts.layers.float.new('d')

    def flaeche(P, u0, u1, z0, z1, form, schritt=0.14):
        nu, nz = max(2, int((u1 - u0) / schritt)), max(2, int((z1 - z0) / schritt)); vs = {}
        for i in range(nu + 1):
            for j in range(nz + 1):
                u, z = u0 + (u1 - u0) * i / nu, z0 + (z1 - z0) * j / nz
                f = form(u, z)
                if f <= 0.02: continue
                dick = 0.04 + 0.22 * f * (0.6 + 0.4 * math.sin(u * 3.1 + ph[0]) * math.sin(z * 2.7 + ph[1])) + rnd.uniform(-0.03, 0.03)
                q = bm.verts.new(P(u + rnd.uniform(-0.03, 0.03), z + rnd.uniform(-0.03, 0.03), dick)); q[dl] = min(1.0, f * 1.6)
                vs[(i, j)] = q
        for i in range(nu):
            for j in range(nz):
                e = [vs.get(key) for key in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))]
                if all(e): bm.faces.new(e)

    def faecher(u, z, b0, b1, hoehe, kahl=0.6):
        t = z / hoehe
        if t > 1.25 or z < 0.03: return 0.0
        halb = (b0 + (b1 - b0) * min(1, t) ** 0.8) / 2 * (1 + 0.18 * math.sin(z * 4.0 + ph[2]))
        rand = 1 - abs(u + 0.25 * math.sin(z * 1.3 + ph[6])) / max(0.05, halb)
        franse = hoehe * (1 + 0.16 * math.sin(u * 2.3 + ph[3]) + 0.10 * math.sin(u * 6.1 + ph[4]))
        return max(0.0, min(1.0, rand * 2.2, (franse - z) / 0.5)) * (0.3 if z < kahl else 1.0)
    # (Mauerlinie, Stelle entlang der Linie in m, Seite, Breite unten, Breite oben, Höhe, Vorneigung der Mauer je m Höhe)
    # an der Bogenmauer bewusst schmal: das Mauerwerk aus D372 trägt das Bild und bleibt sichtbar
    for li, uu, seite, b0, b1, h, lehne in ((0, 11.9, 1, 0.7, 2.7, 4.2, 0.026), (0, 2.0, 1, 0.5, 1.7, 3.6, 0.026), (0, 8.6, 1, 0.4, 1.2, 2.2, 0.026),
                                            (1, 2.2, -1, 0.8, 4.2, 3.4, 0.0), (1, 8.2, -1, 0.6, 2.6, 2.8, 0.0), (2, 4.4, 1, 0.9, 5.0, 3.3, 0.0), (2, 1.2, 1, 0.5, 2.0, 2.0, 0.0)):
        if li >= len(MAUERLINIEN): continue
        a, b, luecke, hoch, laenge = MAUERLINIEN[li]
        ri = Vector((b[0] - a[0], b[1] - a[1], 0)).normalized(); q = Vector((-ri.y, ri.x, 0)) * seite; A = Vector((a[0], a[1], zt - 0.05))
        torhoehe = (5.5, 3.2, 0.0, 0.0)[li]
        def P(u, z, ab, A=A, ri=ri, q=q, lehne=lehne): return A + ri * u + q * (0.60 + ab + lehne * z) + Vector((0, 0, z))
        def form(u, z, uu=uu, b0=b0, b1=b1, h=h, luecke=luecke, hoch=hoch, laenge=laenge, torhoehe=torhoehe):
            if not 0.1 < u < laenge - 0.1: return 0.0
            if luecke is not None and luecke[0] - 0.25 < u < luecke[1] + 0.25 and z < torhoehe: return 0.0
            if z + 0.30 > hoch(u - laenge / 2) + 0.20: return 0.0
            return faecher(u - uu, z, b0, b1, h)
        flaeche(P, uu - b1 / 2 - 0.6, uu + b1 / 2 + 0.6, 0.0, h * 1.25, form)
    n_vorhang = 0
    for (p, qv, t, mname) in MAUERKRONE:
        if mname == 'Stuetzmauer': continue
        for seite in (-1, 1):
            if rnd.random() > 0.20: continue
            br, lg = rnd.uniform(0.6, 1.5), rnd.uniform(0.5, 1.9); tang = Vector((-qv.y, qv.x, 0)); nrm = qv * seite; phase = rnd.uniform(0, 6.28)
            vor = t / 2 + 0.14 + (0.16 if mname == 'MauerA' and nrm.x < 0 else 0.0)
            def P(u, z, ab, p=p, tang=tang, nrm=nrm, vor=vor): return p + tang * u + nrm * (vor + ab * 0.7) + Vector((0, 0, z))
            def form(u, z, br=br, lg=lg, phase=phase): return max(0.0, min(1.0, (1 - abs(u) / (br / 2)) * 2.0, (z + lg * (0.7 + 0.3 * math.sin(u * 5.0 + phase))) / 0.3))
            flaeche(P, -br / 2, br / 2, -lg * 1.05, 0.12, form); n_vorhang += 1
    bm.normal_update()
    flaeche_m2 = sum(f.calc_area() for f in bm.faces)
    me = bpy.data.meshes.new('Efeutraeger'); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('Efeu3', me); bpy.context.collection.objects.link(o)
    dichte = float(os.environ.get('ZIELBILD_EFEU', '2000'))
    mod = o.modifiers.new('Blaetter', 'NODES')
    mod.node_group = hf.streu_gn('Efeublaetter', hf.efeublatt(), 'd', dichte, 0.7, 1.4, 5, 0.9, True, True)
    print('ZIELBILD Efeu: Träger %.0f m², %d Vorhänge, Dichte %.0f Blätter/m²' % (flaeche_m2, n_vorhang, dichte))
    return o


def laubstreu(ter, dichte, gebiet=(-14.0, 7.0, -11.0, 10.0), saat=382):
    """Fallaub als Geometrie: gewölbte Blätter (6–9 cm) liegen auf dem Boden, Dichte nach `dichte(x, y)` (0…1,
    × 17 Büschel zu neun Blättern je m²), jedes mit eigenem Braun/Ocker. Der Scan-Boden trägt die Fläche, das hier die lesbaren Einzelblätter."""
    import hausframe as hf
    bm = bmesh.new()
    umriss = [(0.0, 0.0), (1.6, -1.2), (2.2, -3.4), (1.3, -5.6), (0.0, -7.2)]
    pts = umriss + [(-x, y) for x, y in reversed(umriss[1:-1])]
    # ein Büschel aus neun Blättern mit eigener Richtung, Lage und Grösse: Blätter liegen in Häufchen, nicht einzeln.
    # (D386 nachgeprüft: die Streu-Knoten drehen Instanzen sehr wohl um die Hochachse; dass in D382 alle Blätter in
    # eine Richtung zu zeigen schienen, war die perspektivische Verkürzung flach liegender Ovale.)
    rb = random.Random(saat + 7)
    for _ in range(9):
        M = Matrix.Translation((rb.uniform(-0.24, 0.24), rb.uniform(-0.24, 0.24), rb.uniform(0.0, 0.012))) @ Euler((rb.uniform(-0.35, 0.35), rb.uniform(-0.35, 0.35), rb.uniform(0, 6.283))).to_matrix().to_4x4() @ Matrix.Scale(rb.uniform(0.75, 1.35), 4)
        c = bm.verts.new(M @ Vector((0, -0.035, 0.010))); vs = [bm.verts.new(M @ Vector((x * 0.01, y * 0.01, abs(x) * 0.004))) for x, y in pts]
        for i in range(len(vs)): bm.faces.new((c, vs[i], vs[(i + 1) % len(vs)]))
    bm.normal_update(); blatt_me = bpy.data.meshes.new('Fallaub'); bm.to_mesh(blatt_me); bm.free()
    m, nt, out = neues_material('Fallaub')
    b = N(nt, 'ShaderNodeBsdfPrincipled'); b.inputs['Roughness'].default_value = 0.7
    zuf = N(nt, 'ShaderNodeObjectInfo').outputs['Random']
    r = N(nt, 'ShaderNodeValToRGB'); e = r.color_ramp.elements
    e[0].position = 0.0; e[0].color = (0.030, 0.016, 0.008, 1); e[1].position = 1.0; e[1].color = (0.19, 0.105, 0.034, 1)
    for pos, col in ((0.45, (0.065, 0.034, 0.014, 1)), (0.80, (0.12, 0.058, 0.020, 1))): e.new(pos).color = col
    insel = N(nt, 'ShaderNodeNewGeometry').outputs['Random Per Island']   # je Blatt im Büschel ein eigener Ton
    L(nt, M_(nt, 'FRACT', M_(nt, 'ADD', zuf, insel)), r.inputs['Fac']); L(nt, r.outputs[0], b.inputs['Base Color']); L(nt, b.outputs[0], out.inputs['Surface'])
    blatt_me.materials.append(m)
    blatt = bpy.data.objects.new('Fallaub', blatt_me)
    bm = bmesh.new(); dl = bm.verts.layers.float.new('d'); schritt = 0.4; vs = {}
    nx, ny = int((gebiet[1] - gebiet[0]) / schritt), int((gebiet[3] - gebiet[2]) / schritt)
    for i in range(nx + 1):
        for j in range(ny + 1):
            x, y = gebiet[0] + i * schritt, gebiet[2] + j * schritt
            f = dichte(x, y); z = bodenz(ter, x, y)
            if f <= 0.01 or z is None: continue
            q = bm.verts.new((x, y, z + 0.04)); q[dl] = f; vs[(i, j)] = q
    for i in range(nx):
        for j in range(ny):
            e4 = [vs.get(k) for k in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))]
            if all(e4): bm.faces.new(e4)
    bm.normal_update(); me = bpy.data.meshes.new('Laubstreutraeger'); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('Laubstreu', me); bpy.context.collection.objects.link(o)
    mod = o.modifiers.new('Laub', 'NODES'); mod.node_group = hf.streu_gn('Laubstreu', blatt, 'd', 17.0, 0.8, 1.3, saat, 0.12, True, True)
    print('ZIELBILD Laubstreu: Träger', len(me.polygons), 'Flächen')
    return o


def baeume3(sb, ter, ferne):
    """Bäume der Runde 3: die Laubbaum-Scans des Haus-Bildes (`island_tree_01`, `island_tree_02`) statt Jacaranda
    mit Fiederblatt — rundes, einfaches Blatt, krumme Stämme, liest sich heimisch (Obstbaum/Hainbuche). Wenige
    Charaktere von Hand gesetzt (Rahmen links, Masse rechts hinter der Mauer, Schattenbäume ausserhalb des Bildes);
    der Wald dahinter sind dieselben Scans als Instanzen — kein Spielbaum mehr im Bild. Zwei Meshes (2,7 Mio.
    Dreiecke); `ZIELBILD_BAUM3=1` nimmt `tree_small_02` als dritte Form dazu (+2,1 Mio., Speicherspitze dann 8,3 GB)."""
    isl1 = pflanzen('island_tree_01', 0.4, 'leaves')[0]; isl2 = pflanzen('island_tree_02', 0.4, 'leaves')[0]
    klein = pflanzen('tree_small_02', 0.4, 'leaves')[0] if os.environ.get('ZIELBILD_BAUM3') == '1' else isl2
    art = {'a': isl1, 'b': isl2, 'k': klein}

    def setz(me, name, x, y, hoehe, rot):
        z = bodenz(ter, x, y)
        if z is None: return
        setze_frei(me, name, (x, y, z - 0.025 * hoehe), hoehe / meshhoehe(me), (0, 0, rot))
    # (Art, x, y, Höhe, Drehung) — Sonne steht bei Azimut 200°, Schatten laufen nach Nordnordost (+0,34 / +0,94)
    for i, (a, x, y, h, rot) in enumerate((
            ('a', -6.5, 7.4, 15.0, 0.6),      # Kronendach links: Rahmen, von der Sonne angestrahlt
            ('b', -1.0, 11.6, 12.0, 2.0),     # hinter der Nordmauer
            ('a', 8.5, 10.5, 17.0, 3.1),      # hinter der Mauerecke links
            ('a', 15.0, 5.0, 15.0, 4.4),      # jenseits der Mauer links vom Bogen: Krone über der Mauerkrone
            ('b', 10.5, -7.8, 10.0, 1.2),     # rechts vom Bogen hinter der Mauer
            ('a', 9.5, -11.8, 14.0, 5.0),     # Masse rechts hinter dem Mauerrest
            ('k', 6.6, -10.2, 7.0, 0.4),
            ('b', -14.5, -12.0, 11.0, 2.7),   # Rückenbaum: legt den Vordergrund in Schatten (Rahmen), der Hof bleibt im Licht
            ('a', -9.6, -9.4, 9.5, 5.1),      # Schattenbaum ausserhalb des Bildes: sein Kronenschatten fällt über den Vordergrund (dunkler Rahmen, Lichtflecken)
            ('k', 7.2, 2.8, 5.5, 1.0), ('k', -9.8, 9.8, 5.0, 2.2), ('k', 2.8, 9.9, 4.5, 3.9), ('k', 12.5, 0.5, 6.0, 0.2))):
        if R4: h = {0: 16.0, 2: 19.0, 3: 18.0, 4: 13.5, 5: 17.5}.get(i, h)   # Runde 4: Kronen schliessen den Himmel links und rechts, über dem Bogen bleibt ein Fenster
        setz(art[a], 'Baum3_%d' % i, x, y, h, rot)
    # Sträucher: am Mauerrest rechts, am Felsblock vorn rechts, an den Hofecken
    straeucher = []
    for n in ('shrub_01', 'shrub_02', 'shrub_03', 'shrub_04'): straeucher += pflanzen(n, 0.4)
    for i, (x, y, g) in enumerate(((-1.9, -8.9, 2.2), (5.6, -8.7, 1.9), (0.6, -6.9, 1.3), (-6.9, -3.9, 1.5), (-5.0, -5.4, 1.1), (4.0, 6.4, 1.7), (-4.2, 8.2, 1.6),
                                   (-9.5, -4.4, 1.4), (-8.7, 6.2, 1.3), (6.2, -5.2, 1.6), (3.9, -5.9, 1.0), (-11.6, 4.2, 1.2), (8.0, -2.0, 1.8), (-2.6, 6.6, 1.0))):
        me = straeucher[i % len(straeucher)]; z = bodenz(ter, x, y)
        if z is not None: setze_frei(me, 'Strauch%d' % i, (x, y, z - 0.03), g / max(0.05, ausdehnung(me)), (0, 0, i * 2.3))
    for i, (name, x, y, h, saat) in enumerate(ferne):
        zr = random.Random(saat); me, f = ((isl1, 0.62), (isl2, 0.45), (klein, 0.5))[saat % 3]
        setz(me, 'Wald3_%d' % i, x, y, h * f * zr.uniform(0.85, 1.15), zr.random() * 6.283)
    print('ZIELBILD Runde 3: Waldbäume aus Scans', len(ferne), '| Sträucher', len(straeucher), 'Vorlagen')


# ------------------------------------------------------------------- Zielbild Runde 4 (D386)
ALPHA_PFLANZEN = ('grass_medium_01', 'grass_medium_02', 'celandine_01', 'periwinkle_plant', 'nettle_plant', 'weed_plant_02', 'dandelion_01', 'fern_02',
                  'shrub_sorrel_01', 'moss_01', 'fir_sapling', 'shrub_01', 'shrub_02', 'shrub_03', 'shrub_04', 'island_tree_01', 'island_tree_02')


def alphakarten():
    """`-- alphakarten [name,…]`: lädt zu den Pflanzen-Scans die Alpha-Karten von Poly Haven nach (`<scan>/textures/
    *_alpha_*.png`). Grund (D386, „schwarze Halme“): das glTF von Poly Haven nennt sein Farbbild zwar
    `<name>_diff-<name>_alpha`, liefert aber ein JPG ohne Alphakanal — jede Blattkarte ist damit deckend, und wo ihre UV
    neben dem Blatt liegen, zeigt sie den schwarzen Atlasgrund. Die Alpha-Karte gibt es nur als eigene Datei."""
    import urllib.request
    namen = ARGS[1].split(',') if len(ARGS) > 1 else ALPHA_PFLANZEN
    for name in namen:
        rq = urllib.request.Request('https://api.polyhaven.com/files/' + name, headers={'User-Agent': 'asset-fetch'})
        dateien = json.load(urllib.request.urlopen(rq, timeout=120)); o = os.path.join(cc0_ordner(), name, 'textures')
        stufe = next((f.split('_')[-1].split('.')[0] for f in sorted(os.listdir(o)) if '_diff_' in f), '1k')
        for k, v in dateien.items():
            if not k.lower().endswith('alpha') or stufe not in v or 'png' not in v[stufe]: continue
            url = v[stufe]['png']['url']; pfad = os.path.join(o, os.path.basename(url))
            if not (os.path.exists(pfad) and os.path.getsize(pfad) > 0):
                daten = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'asset-fetch'}), timeout=120).read()
                with open(pfad + '.teil', 'wb') as f: f.write(daten)
                os.replace(pfad + '.teil', pfad)
            print('ALPHA', name, os.path.basename(pfad), os.path.getsize(pfad) // 1024, 'kB')


def alpha_karte(mat):
    """Alpha-Karte zum Farbbild eines Scan-Materials suchen (`…_diff_…` → `…_alpha_….png` im selben Ordner) und als
    Bildknoten mit denselben Koordinaten anlegen. Gibt den Ausgang zurück oder None, wenn es keine Karte gibt."""
    nt = mat.node_tree
    b = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if b is None or not b.inputs['Base Color'].links: return None
    dif = b.inputs['Base Color'].links[0].from_node
    if dif.type != 'TEX_IMAGE' or dif.image is None: return None
    pfad = bpy.path.abspath(dif.image.filepath, library=dif.image.library)
    if '_diff_' not in os.path.basename(pfad): return None
    ap = os.path.join(os.path.dirname(pfad), os.path.splitext(os.path.basename(pfad).replace('_diff_', '_alpha_'))[0] + '.png')
    if not os.path.exists(ap): return None
    t = N(nt, 'ShaderNodeTexImage'); t.image = bild(ap, False); t.interpolation = dif.interpolation; t.extension = dif.extension
    if dif.inputs['Vector'].links: L(nt, dif.inputs['Vector'].links[0].from_socket, t.inputs['Vector'])
    return t.outputs['Color']


def bergruecken4(zt, saat=386):
    """Runde 4: vier Rücken mit Substanz statt khaki Flächen. Jeder Rücken hält ein eigenes Höhenband (vom Hof aus
    −0,5…1,5° / 2,0…3,2° / 3,6…5,0° / 5,4…7,0°), damit überall — auch im Bogen — vier Stufen übereinander stehen.
    Kamm: Kronen-Silhouette (nah einzelne Buckel, fern nur Zahnung, ganz hinten Felsgrat). Fläche: Wald dunkel,
    Wiesen hell in Flecken, Fels an den hohen Graten, dazu Runsen als Hell-Dunkel — gemalt, nicht simuliert."""
    m, nt, out = neues_material('Bergruecken4')
    b = N(nt, 'ShaderNodeBsdfPrincipled'); b.inputs['Roughness'].default_value = 1.0
    uv = N(nt, 'ShaderNodeUVMap').outputs['UV']                      # u entlang des Rückens, v Höhe, beide in Zehnteln der Entfernung
    ho = N(nt, 'ShaderNodeAttribute'); ho.attribute_name = 'h'       # 1 am Kamm, 0 am Hangfuss
    wald = X_(nt, RAU(nt, uv, 26.0, 1.0, 4.0, 0.6), (0.004, 0.009, 0.003), (0.014, 0.024, 0.008))
    wiese = X_(nt, RAU(nt, uv, 9.0, 2.0, 3.0), (0.065, 0.078, 0.022), (0.115, 0.108, 0.032))
    m_wiese = M_(nt, 'MULTIPLY', R_(nt, RAU(nt, uv, 3.2, 3.0, 4.0, 0.55, (1.0, 2.2, 1.0)), 0.50, 0.55), R_(nt, ho.outputs['Fac'], 0.95, 0.55))
    farbe = X_(nt, m_wiese, wald, wiese)
    fels = X_(nt, RAU(nt, uv, 14.0, 4.0, 5.0, 0.7), (0.06, 0.055, 0.05), (0.19, 0.175, 0.155))
    m_fels = M_(nt, 'MULTIPLY', M_(nt, 'MULTIPLY', R_(nt, RAU(nt, uv, 5.0, 5.0, 5.0, 0.65, (1.0, 0.45, 1.0)), 0.46, 0.56), R_(nt, ho.outputs['Fac'], 0.25, 0.85)), N(nt, 'ShaderNodeAttribute', attribute_name='fels').outputs['Fac'])
    farbe = X_(nt, m_fels, farbe, fels)
    runse = R_(nt, RAU(nt, uv, 2.4, 6.0, 4.0, 0.6, (3.0, 0.35, 1.0)), 0.30, 0.72, 0.25, 1.6)   # Runsen und Rippen: senkrecht gestreckt
    L(nt, X_(nt, 1.0, farbe, X_(nt, runse, (0, 0, 0), (1, 1, 1)), 'MULTIPLY'), b.inputs['Base Color'])
    L(nt, b.outputs[0], out.inputs['Surface'])
    tan = lambda grad: math.tan(math.radians(grad))
    # (Entfernung, Kammhöhe von/bis in Grad über dem Hof, Kronenbuckel Höhe/Breite in m, Schrittweite, Felsanteil)
    for k, (dist, e0, e1, buckel, breite, schritt, felsig) in enumerate(((700.0, -0.5, 1.5, 11.0, 14.0, 2.0, 0.0), (1800.0, 2.0, 3.2, 15.0, 32.0, 4.0, 0.0),
                                                                        (4000.0, 3.6, 5.0, 22.0, 80.0, 12.0, 0.6), (8000.0, 5.4, 7.0, 60.0, 260.0, 40.0, 1.0))):
        bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap'); hl = bm.verts.layers.float.new('h'); fl = bm.verts.layers.float.new('fels')
        n = int(dist * 3.2 / schritt); reihen = []
        for i in range(n + 1):
            y = (i / n - 0.5) * dist * 3.2; t = i / n
            f = 0.6 * noise.noise(Vector((t * 5.0 + k * 3.1, k * 1.7, saat))) + 0.4 * noise.noise(Vector((t * 17.0 + k, 2.0, saat)))
            x = dist * (1.0 + 0.06 * noise.noise(Vector((t * 3.0 + k * 5.0, 1.0, saat))))
            kamm = 1.9 + x * (tan(e0) + (tan(e1) - tan(e0)) * max(0.0, min(1.0, 0.5 + 1.1 * f)))
            kamm += buckel * (abs(noise.noise(Vector((y / breite, k * 9.0, saat)))) * 1.7 - 0.35) + 0.4 * buckel * noise.noise(Vector((y / (breite * 4.0), 3.0, saat)))
            fuss = kamm - 0.09 * dist
            reihe = []
            for z, hw in ((zt - 900.0, -1.0), (zt + fuss, 0.0), (zt + kamm, 1.0)):
                v = bm.verts.new((x, y, z)); v[hl] = hw; v[fl] = felsig; reihe.append((v, (y / dist * 10.0, (z - zt) / dist * 10.0)))
            reihen.append(reihe)
        for r0, r1 in zip(reihen[:-1], reihen[1:]):
            for j in range(2):
                fa = bm.faces.new((r0[j][0], r1[j][0], r1[j + 1][0], r0[j + 1][0]))
                for lp, q in zip(fa.loops, (r0[j], r1[j], r1[j + 1], r0[j + 1])): lp[uvl].uv = q[1]
        me = bpy.data.meshes.new('Ruecken4_%d' % k); bm.to_mesh(me); bm.free(); me.materials.append(m)
        bpy.context.collection.objects.link(bpy.data.objects.new('Ruecken4_%d' % k, me))


def moospolster(saat=386):
    """Moos auf den Mauerkronen als Polster mit Dicke: flache, buckelige Körper (drei Vorlagen), die über die
    Kronensteine greifen und an den Kanten überhängen — unregelmässiger Rand, Schlagschatten, kein Anstrich."""
    rnd = random.Random(saat)
    m, nt, out = neues_material('Moospolster')
    b = N(nt, 'ShaderNodeBsdfPrincipled'); b.inputs['Roughness'].default_value = 1.0
    try: b.inputs['Sheen Weight'].default_value = 0.6; b.inputs['Sheen Roughness'].default_value = 0.6; b.inputs['Sheen Tint'].default_value = (0.55, 0.75, 0.25, 1)
    except Exception as e: print('Sheen', e)
    P = N(nt, 'ShaderNodeTexCoord').outputs['Object']; zuf = N(nt, 'ShaderNodeObjectInfo').outputs['Random']
    r = N(nt, 'ShaderNodeValToRGB'); e = r.color_ramp.elements
    e[0].position = 0.25; e[0].color = (0.012, 0.026, 0.006, 1); e[1].position = 0.8; e[1].color = (0.045, 0.072, 0.016, 1)
    L(nt, M_(nt, 'ADD', RAU(nt, P, 9.0, 1.0, 4.0, 0.6), M_(nt, 'MULTIPLY_ADD', zuf, 0.3, -0.15)), r.inputs['Fac'])
    L(nt, X_(nt, R_(nt, RAU(nt, P, 3.0, 5.0, 2.0), 0.62, 0.74), r.outputs[0], (0.085, 0.075, 0.030)), b.inputs['Base Color'])   # vertrocknete Stellen
    bump = N(nt, 'ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.8; bump.inputs['Distance'].default_value = 0.012
    L(nt, RAU(nt, P, 140.0, 2.0, 3.0, 0.7), bump.inputs['Height']); L(nt, bump.outputs['Normal'], b.inputs['Normal']); L(nt, b.outputs[0], out.inputs['Surface'])
    vorl = []
    for v in range(3):
        bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=3, radius=0.5)
        off = Vector((v * 7.3, saat, v * 1.9))
        for q in bm.verts:
            d = q.co.normalized()
            lappen = 0.75 + 0.30 * noise.noise(d * 1.6 + off) + 0.16 * noise.noise(d * 4.5 + off)      # gelappter Umriss
            kissen = 0.07 * noise.noise(Vector((q.co.x * 9.0, q.co.y * 9.0, v)) + off)                 # Buckel
            q.co = Vector((q.co.x * lappen, q.co.y * lappen, (max(q.co.z, 0.0) * 0.32 + min(q.co.z, 0.0) * 0.10) * (0.8 + 0.5 * lappen) + (kissen if q.co.z > 0 else 0.0)))
        for f in bm.faces: f.smooth = True
        me = bpy.data.meshes.new('Moospolster%d' % v); bm.to_mesh(me); bm.free(); me.materials.append(m); vorl.append(me)
    n = 0
    for (p, q, t, mname) in MAUERKRONE:
        for _ in range((4 if mname == 'Stuetzmauer' else 12) if R5 else (1 if mname == 'Stuetzmauer' else 3)):
            if rnd.random() > 0.72: continue
            tang = Vector((-q.y, q.x, 0)); g = (rnd.uniform(0.20, 0.55) if R5 else rnd.uniform(0.40, 1.05)) * min(1.0, t / 0.9 + 0.2)
            # Runde 5: die Polster wirkten als aufgelegte Scheiben — jetzt viele kleine, in die Kronensteine eingesunken:
            # Moos sitzt in den Fugen und Mulden, die Steinköpfe ragen dazwischen heraus
            ort = p + q * rnd.uniform(-0.45, 0.45) * t + tang * rnd.uniform(-0.3, 0.3) + Vector((0, 0, rnd.uniform(-0.03, 0.02) if R5 else rnd.uniform(-0.03, 0.05)))
            o = setze_frei(vorl[rnd.randrange(3)], 'Kronmoos%d' % n, ort, g, (rnd.uniform(-0.12, 0.12), rnd.uniform(-0.12, 0.12), rnd.random() * 6.283))
            o.scale = (g * rnd.uniform(0.8, 1.3), g * rnd.uniform(0.8, 1.3), g * rnd.uniform(0.6, 1.5)); n += 1
    print('ZIELBILD Moospolster auf den Kronen:', n)


def versturz(sb, ter, mitte, radius, anzahl, hoch, saat):
    """Versturzhaufen: herausgebrochene Steine (Scan) als Kegel am Mauerende — innen gestapelt und gross, aussen
    einzeln und klein, halb im Boden."""
    rnd = random.Random(saat); steine = vorlagen('rock_moss_set_02')
    for i in range(anzahl):
        r = abs(rnd.gauss(0.0, radius * 0.5)); a = rnd.random() * 6.283
        x, y = mitte[0] + math.cos(a) * r, mitte[1] + math.sin(a) * r * 0.75
        z = bodenz(ter, x, y)
        if z is None or r > radius * 1.6: continue
        me = steine[rnd.randrange(len(steine))]; g = rnd.uniform(0.22, 0.6) * (1.25 - 0.5 * min(1.0, r / radius))
        h = hoch * math.exp(-(r / (radius * 0.55)) ** 2) * rnd.uniform(0.35, 1.0)
        setze_frei(me, 'Versturz%d_%d' % (saat, i), (x, y, z + h - 0.12 * g), g / ausdehnung(me), (rnd.uniform(-0.6, 0.6), rnd.uniform(-0.6, 0.6), rnd.random() * 6.283))


def zielbild():
    """Felsmulde als Zielbild Runde 2 (D372): Aufbau wie `aframe`, aber Mauer, Boden, Bewuchs und Himmel neu."""
    objdir, praefix = ARGS[1], ARGS[2]
    breite, hoehe, samples = (int(ARGS[3]), int(ARGS[4]), int(ARGS[5])) if len(ARGS) > 5 else (1280, 720, 48)
    kameras = (ARGS[6] if len(ARGS) > 6 else 'ziel').split(',')
    tmp = os.environ.get('ZIELBILD_TMP', '/tmp/claude-0')
    sys.argv = [sys.argv[0], '--', objdir, os.path.join(tmp, 'zielbild.blend'), os.path.join(tmp, 'zielbild-roh.png'), 'voll', 'felsmulde']
    sys.path.insert(0, HIER)
    import szenenbau as sb
    import time
    t_start = time.time()

    alt_boden = sb.mat_boden
    sb.mat_boden = lambda wiese=None: mat_boden_ziel(alt_boden(wiese), R3)
    def fels(name='Fels', moos=1.3, hoehe=None):
        if name == 'Stein': return mat_stein_scan('Stein', 'mossy_rock', 1.4, 0.03, 1.0, 0.95, 0.6)
        if name == 'Platte': return mat_stein_scan('Platte', 'mossy_rock', 1.8, 0.025, 0.5, 0.8, 0.9)
        return mat_stein_scan(name, 'lichen_rock', 1.6, 0.04, moos, 1.1)
    sb.mat_fels = fels
    sb.mat_rinde = lambda: mat_rinde_scan('fichte', 'Rinde', False, 0.35)[0]
    sb.farn = lambda name, x, y, mat, saat, groesse=1.0: farn_scan(sb, name, x, y, saat, groesse)
    sb.efeu = lambda name, flecken, mat, saat: None          # Efeu kommt unten aus den Kronenpunkten
    sb.stein_bm = stein_verwittert
    def mauer3(name, ort, laenge, hoehe, dicke, achse, saat, mat, mat_kern, hmin, **k):
        # Runde 3: der Mauerrest rechts (MauerC) wird Masse als Gegengewicht zum Bogen — länger, höher, weniger eingestürzt
        if R3 and name == 'MauerC': ort, laenge, hoehe, hmin = (ort[0] - 0.6, ort[1], ort[2]), 6.6, 3.5, 1.3
        if R4 and name == 'MauerC': hoehe, hmin = 3.6, 0.35   # Ruine: die Krone bricht bis fast auf den Boden ein, der Versturz liegt davor
        return mauer_scan(name, ort, laenge, hoehe, dicke, achse, saat, mat, mat_kern, hmin, **k)
    sb.mauer = mauer3
    sb.plattenhof = plattenhof_ziel
    sb.steinbecken = steinbecken_ziel
    # Bäume im Nahbereich: Scan-Bäume statt Spielbäume (Befund D371: Spielkronen zu licht, Stämme wie Stangen).
    # Ein Scan-Laubbaum und eine Scan-Jungtanne, jeweils instanziert und skaliert; die Ferne bleibt bei den Spielbäumen.
    # Runde 3 (D382): Sonne nach dem Prinzip des Haus-Bildes — von rechts, quer zur Blickrichtung (Blick ~101°, Sonne
    # 194° → 93°): Streiflicht längs der Mauerfläche, das Laubdach links wird angestrahlt statt abzusaufen. Der Hang im
    # Südwesten steht von der Terrasse aus bei Azimut 194° 23° hoch (`fern_terrain`, bei 200° schon 26,5°): 14° wie am
    # Haus liegen hier im Bergschatten, deshalb 24,5° — die tiefste Sonne, die den Hof von dieser Seite erreicht.
    AZ = float(os.environ.get('ZIELBILD_AZ', '194' if R3 else '112'))
    scanbaum = os.environ.get('ZIELBILD_KRONE', '1') == '1'
    helden = []; tannen = []; ferne = []
    def zur_sonne(x, y):
        """Schneise zur Sonne: was vom Hof aus im Sonnenazimut steht, würde die Lichtbahnen schlucken."""
        w = math.degrees(math.atan2(x + 2.0, y + 1.0)) % 360.0
        ab = abs((w - AZ + 180.0) % 360.0 - 180.0); r = math.hypot(x + 2.0, y + 1.0)
        if R3: return (ab < 15.0 and r < 190.0) or (ab < 38.0 and r < 34.0)   # Waldbäume auf dem Hang zur Sonne nähmen dem Hof das Licht
        return (ab < 16.0 and r < 70.0) or (ab < 42.0 and r < 30.0)
    def laubbaum(name, x, y, h, mr, ml, saat, fein=True, **k):
        if R3:
            # kein Spielbaum mehr im Bild: Heldenbäume sind unten von Hand gesetzt, der Wald wird aus Scan-Bäumen instanziert
            if not name.startswith('Held') and not zur_sonne(x, y): ferne.append((name, x, y, h, saat))
            return None
        if scanbaum and fein:
            if not zur_sonne(x, y): helden.append((name, x, y, h, saat))
            return None
        return spielbaum(sb, 'buche', name, x, y, h, saat, fein)
    def nadelbaum(name, x, y, h, mr, mn, saat, fein=True, **k):
        # Nadelbäume fallen im Zielbild weg: die Spielfichte liest sich vor dem Himmel als Stange mit Quirlen, eine
        # hochskalierte Scan-Jungtanne als Riesenfarn — beides schlechter als kein Baum (Engine-Folge im Ledger D372)
        if R3 and not name.startswith('Held') and not zur_sonne(x, y): ferne.append((name, x, y, h * 0.8, saat))   # Runde 3: Waldplatz bleibt besetzt (Laubbaum-Scan)
        return None
    sb.laubbaum2 = laubbaum
    sb.fichte = nadelbaum
    sb.gras = lambda *a, **k: None
    sb.wurzel = lambda *a, **k: None

    def rendern(sc, _b, _h, _s, _p):
        zt = sb.bodenhoehe(-2.0, -1.0)
        print('ZIELBILD Terrassenhöhe %.1f, Aufbau Grundszene %.0f s' % (zt, time.time() - t_start))
        befall(zt)
        for o in bpy.data.objects:   # Signalfarbe sparsam: kleiner und schwächer als in D371
            if o.pass_index == 7: o.scale = o.scale * 0.6
        for n in bpy.data.materials['Befall'].node_tree.nodes:
            if n.type == 'EMISSION': n.inputs['Strength'].default_value = 5.0
        ter = bpy.data.objects['terrain']
        rnd = random.Random(372)
        # ---- Steine: Moosblöcke und Geröll → Scan-Felsen (wie D371), Platten und Beckenrand mit Bodenkontakt-Moos
        for mn in ('Stein',):   # Platten nicht: flach am Boden wären sie überall „in Kontakt“ und ganz grün
            mm = bpy.data.materials.get(mn)
            if mm:
                for n in mm.node_tree.nodes:
                    if n.type == 'AMBIENT_OCCLUSION': n.only_local = False; n.inputs['Distance'].default_value = 0.28
        gross = vorlagen('rock_moss_set_01'); klein = vorlagen('rock_moss_set_02')
        for i, o in enumerate([o for o in bpy.data.objects if o.name.startswith('Moosblock')]):
            x, y = o.location.x, o.location.y; g = max(o.dimensions.x, o.dimensions.y)
            bpy.data.objects.remove(o)
            # aus der Nähe trägt die Scan-Textur der grossen Blöcke nicht (2k auf 3 m): Form vom Scan, Oberfläche Flechtenfels
            fo = setze_scan(sb, gross[i % len(gross)].copy(), 'Fels%d' % i, x, y, g * 1.05, 600 + i, 0.3)
            fo.data.materials.clear(); fo.data.materials.append(bpy.data.materials['Fels']); adaptiv(fo, 1.5)
        for i, o in enumerate([o for o in bpy.data.objects if o.name.startswith('Geroell')]):
            x, y = o.location.x, o.location.y; g = max(o.dimensions.x, o.dimensions.y)
            bpy.data.objects.remove(o)
            setze_scan(sb, klein[i % len(klein)], 'Stein%d' % i, x, y, g * 1.1, 700 + i, 0.45)
        im_becken = (lambda x, y: tuempel_n(x, y) < 0.9) if R5 else (lambda x, y: -4.85 < x < -0.15 and -6.15 < y < 0.15)   # Runde 5: Bewuchs und Laub bis an die Wasserlinie
        felsen = [(o.location.x, o.location.y, max(o.dimensions.x, o.dimensions.y) / 2) for o in bpy.data.objects if o.name.startswith('Fels')]
        if R3:
            # Masse rechts (Gegengewicht zum Laubdach links): Felsblöcke am rechten Bildrand vorn, halb eingesunken
            for i, (x, y, g, mi) in enumerate(((-6.4, -3.1, 2.1, 1), (-5.3, -4.4, 1.2, 2), (-8.3, -3.6, 1.0, 0))):
                fo = setze_scan(sb, gross[mi % len(gross)].copy(), 'FelsR%d' % i, x, y, g, 640 + i, 0.32)
                fo.data.materials.clear(); fo.data.materials.append(bpy.data.materials['Fels']); adaptiv(fo, 1.5)
                felsen.append((x, y, g / 2))
        for i in range(26):
            x, y = rnd.uniform(-12.0, 4.0), rnd.uniform(-8.0, 7.0)
            if im_becken(x, y): continue
            setze_scan(sb, klein[(i + 3) % len(klein)], 'Kiesel%d' % i, x, y, rnd.uniform(0.14, 0.42), 800 + i, 0.5)
        # ---- Holz: Totholz (Scan), Balken am Rand halb eingewachsen, Torpfosten, Äste, Stubben
        stamm = vorlagen('dead_tree_trunk_02')
        setze_scan(sb, stamm[0], 'Totholz', -6.2, 4.6, 3.6, 371, 0.22, math.radians(-25))
        holz = mat_holz_scan()
        b1 = balken('Balken', (-3.2, 1.9, zt + 0.06), 2.9, (0.24, 0.2), (0.05, 0.04, math.radians(-12)), holz, 1)
        b2 = balken('Torpfosten', (4.5, -3.35, zt + 0.85), 2.3, (0.26, 0.24), (0.0, math.radians(-82), 0.08), holz, 2)
        for b in (b1, b2): adaptiv(b, 1.0)
        aeste = vorlagen('dry_branches_medium_01')
        for i in range(22):
            x, y = rnd.uniform(-12.0, 4.0), rnd.uniform(-9.0, 8.0)
            if im_becken(x, y): continue
            z = bodenz(ter, x, y)
            setze_frei(aeste[i % len(aeste)], 'Ast%d' % i, (x, y, z + 0.01), rnd.uniform(0.8, 1.5), (0, 0, rnd.random() * 6.283))
        if R3:
            # Streu als Geometrie (Scans): Zweige, Rindenstücke, Wurzeln — der Boden ist keine bemalte Fläche
            r3 = random.Random(3820)
            rinde_s = vorlagen('bark_debris_01'); wurzel_s = vorlagen('single_root') + vorlagen('pine_roots'); stock = vorlagen('root_cluster_01')
            for i in range(110):
                x, y = r3.uniform(-13.5, 4.2), r3.uniform(-9.5, 9.0)
                if im_becken(x, y) or mauerabstand(x, y)[0] < 0.6: continue
                if abs(y - pfadmitte(x)) < 0.45 and r3.random() < 0.8: continue   # der Pfad ist freigetreten
                z = bodenz(ter, x, y)
                if i % 3: setze_frei(aeste[r3.randrange(len(aeste))], 'Zweig%d' % i, (x, y, z + 0.012), r3.uniform(0.35, 1.1), (r3.uniform(-0.05, 0.05), r3.uniform(-0.05, 0.05), r3.random() * 6.283))
                else: setze_frei(rinde_s[r3.randrange(len(rinde_s))], 'Rindenstreu%d' % i, (x, y, z + 0.005), r3.uniform(0.5, 1.0), (0, 0, r3.random() * 6.283))
            # Wurzeln: vom Baum links über den Hof (ersetzt die prozeduralen Wurzeln aus D369), dazu einzelne im Boden
            for i, (x, y, g, dreh_) in enumerate(((-6.9, 6.2, 1.0, 0.4), (-5.2, 5.9, 0.7, 2.6))):
                setze_frei(stock[i % len(stock)], 'Wurzelstock%d' % i, (x, y, bodenz(ter, x, y) - 0.10 * g), g, (0, 0, dreh_))
            for i, (x, y, g) in enumerate(((-7.6, 4.4, 1.5), (-5.6, 3.9, 1.3), (-8.9, 5.4, 1.2), (-4.4, 5.2, 1.1), (-9.3, -3.2, 1.2), (3.4, 4.6, 1.0), (2.9, -6.4, 1.2), (-10.4, 0.7, 1.3))):
                me_w = wurzel_s[i % len(wurzel_s)]
                setze_frei(me_w, 'Wurzel3_%d' % i, (x, y, bodenz(ter, x, y) - 0.04 * g), g, (0, 0, math.atan2(y - 7.4, x + 6.5) + r3.uniform(-0.4, 0.4)))
        stubben = vorlagen('tree_stump_01')
        for i, (x, y, g) in enumerate(((-9.6, -4.6, 1.0), (7.6, 4.2, 0.9))):
            setze_frei(stubben[0], 'Stubben%d' % i, (x, y, bodenz(ter, x, y) - 0.05), g, (0, 0, i * 2.1))
        # ---- Bewuchs: Polster nach Dichtefunktionen
        polster = lambda x, y, f, w: 0.5 + 0.5 * noise.noise(Vector((x * f, y * f, w)))
        def auf_platte(x, y):
            return any(abs(x - px) < hx - 0.05 and abs(y - py) < hy - 0.05 for px, py, hx, hy in PLATTEN)
        def grund(x, y):
            """Wo überhaupt etwas wächst: nicht im Becken, nicht in der Mauer, kaum auf Platten und Pfad."""
            if im_becken(x, y): return 0.0, 9.0
            d, tor = mauerabstand(x, y)
            if d < 0.5: return 0.0, d
            f = 1.0
            if -17.0 < x < 9.5: f *= 1.0 - 0.93 * max(0.0, min(1.0, ((0.80 if R3 else 1.45) - abs(y - pfadmitte(x))) / (0.5 if R3 else 0.9)))
            if tor: f *= 0.1
            if auf_platte(x, y): f *= 0.06
            return f, d
        def d_gras(x, y):
            f, d = grund(x, y)
            return f * min(1.0, 0.10 + 1.3 * max(0.0, polster(x, y, 0.33, 1.0) - 0.42) * 2.0 + 0.8 * math.exp(-max(0.0, d - 0.5) / 0.7))
        def d_kraut(x, y):
            f, d = grund(x, y)
            return f * min(1.0, 2.6 * max(0.0, polster(x, y, 0.27, 5.0) - 0.50) + 0.5 * math.exp(-max(0.0, d - 0.5) / 0.9))
        def d_fuss(x, y):
            f, d = grund(x, y)
            return f * math.exp(-max(0.0, d - 0.5) / 0.8) * (0.35 + 0.65 * polster(x, y, 0.5, 9.0))
        def d_rand(x, y):
            f, d = grund(x, y)
            hof = max(abs(x + 2.0) / 7.0, abs(y) / 7.5)
            return f * max(0.0, min(1.0, (hof - 0.75) * 2.5)) * (0.3 + 0.7 * polster(x, y, 0.3, 13.0))
        gras = pflanzen('grass_medium_01', 0.45)
        gras_gross = [me for me in gras if ausdehnung(me) > 0.17]
        streue(ter, gras, 1500 if R3 else 2600, d_gras, (1.5, 2.6), 3721, 'Gras')   # Runde 3: Boden bleibt sichtbar (Regel 7)
        streue(ter, pflanzen('celandine_01', 0.4), 350 if R3 else 1700, d_kraut, (1.6, 2.8), 3722, 'Kraut', 0.08)   # Runde 3: wenig Gelb — die Signalfarbe bleibt der einzige Akzent
        streue(ter, pflanzen('periwinkle_plant', 0.4), 60 if R3 else 320, lambda x, y: 0.6 * d_kraut(x, y) + 0.4 * d_fuss(x, y), (0.9, 1.6), 3723, 'Immergruen')
        streue(ter, pflanzen('nettle_plant', 0.45), 300, lambda x, y: max(d_fuss(x, y), 0.6 * d_rand(x, y)), (3.2, 5.4), 3724, 'Nessel', 0.1)
        streue(ter, pflanzen('weed_plant_02', 0.4), 240, lambda x, y: max(0.7 * d_fuss(x, y), 0.5 * d_kraut(x, y)), (1.6, 3.2), 3725, 'Ampfer', 0.06)
        streue(ter, pflanzen('dandelion_01', 0.4), 130, lambda x, y: 0.5 * d_gras(x, y), (1.2, 2.0), 3726, 'Loewenzahn', 0.05)
        farne = pflanzen('fern_02', 0.45)
        streue(ter, farne, 170, lambda x, y: max(d_fuss(x, y), d_rand(x, y)), (0.9, 1.9), 3727, 'FarnZ', 0.1, 0.03)
        streue(ter, pflanzen('fir_sapling', 0.2), 18, d_rand, (0.9, 1.7), 3728, 'Jungfichte', 0.04, 0.02)
        if R3:
            # Krautpolster an allen Kanten: Plattenränder und -fugen, Beckenrand, Felsfüsse — kein Übergang ist eine Linie
            def d_kante(x, y):
                if im_becken(x, y) or mauerabstand(x, y)[0] < 0.5: return 0.0
                k = 0.0
                for px, py, hx, hy in PLATTEN:
                    a = max(abs(x - px) - hx, abs(y - py) - hy)
                    if abs(a) < 0.16: k = max(k, 1.0 - abs(a) / 0.16)
                a = max(abs(x + 2.5) - 2.35, abs(y + 3.0) - 3.15)
                if 0.0 < a < 0.9: k = max(k, 1.0 - a / 0.9)
                for fx, fy, fr in felsen:
                    a = math.hypot(x - fx, y - fy) - fr * 0.8
                    if -0.15 < a < 0.8: k = max(k, 1.0 - max(0.0, a) / 0.8)
                if R4 and -17.0 < x < 9.5: k = max(k, 0.85 * max(0.0, 1.0 - abs(abs(y - pfadmitte(x)) - 0.85) / 0.35))   # Krautsaum beidseits der Trittspur
                k *= 1.0 - 0.85 * max(0.0, min(1.0, (0.55 - abs(y - pfadmitte(x))) / 0.3))
                return k * (0.35 + 0.65 * polster(x, y, 0.7, 31.0))
            gras2 = pflanzen('grass_medium_02', 0.45)
            streue(ter, gras + gras2, 1500, d_kante, (1.0, 2.0), 3821, 'Kantengras')
            streue(ter, pflanzen('weed_plant_02', 0.4) + pflanzen('nettle_plant', 0.45), 500, d_kante, (1.4, 2.6), 3822, 'Kantenkraut', 0.08)   # kein Immergrün: seine rosa Blüten wären ein zweiter Akzent
            streue(ter, pflanzen('shrub_sorrel_01', 0.4), 260, lambda x, y: max(d_kante(x, y), 0.5 * d_fuss(x, y)), (1.4, 2.6), 3823, 'Sauerklee', 0.06)
            moos_s = pflanzen('moss_01', 0.3) if R4 else vorlagen('moss_01'); gm = 0.32 / max(0.01, max(ausdehnung(me) for me in moos_s))
            streue(ter, moos_s, 900, lambda x, y: max(d_kante(x, y), 0.7 * d_fuss(x, y)), (gm * 0.7, gm * 1.8), 3824, 'Moospolster', 0.05, 0.25)
            streue(ter, gras2, 500, d_gras, (1.6, 2.8), 3825, 'Gras2')
            # Fallaub als Einzelblätter: überall ausser Becken, Pfadmitte und Mauer; dichter in Senken und am Mauerfuss
            def d_laub(x, y):
                if im_becken(x, y) or mauerabstand(x, y)[0] < 0.45: return 0.0
                f = 0.25 + 0.75 * polster(x, y, 0.4, 41.0)
                f *= 1.0 - 0.8 * max(0.0, min(1.0, (0.5 - abs(y - pfadmitte(x))) / 0.3))
                return min(1.0, f + 0.5 * math.exp(-max(0.0, mauerabstand(x, y)[0] - 0.5) / 0.6))
            laubstreu(ter, d_laub)
        if R4:
            moospolster()
            versturz(sb, ter, (-2.3, -7.6), 1.5, 46, 0.95, 3861); versturz(sb, ter, (1.6, -7.1), 1.0, 20, 0.6, 3862)   # vor dem Mauerrest rechts
        # Wald um den Hof: Farn und Jungwuchs zwischen den Stämmen (bis 34 m), nur grob — das ist Mittelgrund
        def d_wald(x, y):
            r = math.hypot(x + 2.0, y + 1.0)
            return 0.0 if r < 13.0 or mauerabstand(x, y)[0] < 0.8 else (0.25 + 0.75 * polster(x, y, 0.12, 21.0)) * max(0.0, 1.0 - (r - 13.0) / 24.0)
        streue(ter, farne, 420, d_wald, (1.2, 2.4), 3729, 'FarnW', 0.1, 0.03, (-30.0, 34.0, -34.0, 34.0))
        streue(ter, gras_gross, 700, d_wald, (2.2, 3.6), 3730, 'GrasW', 0.1, 0.02, (-30.0, 34.0, -34.0, 34.0))
        # Rahmenpflanzen im Vordergrund (grosse Blätter) und am Mauerfuss — gesetzt, nicht gestreut
        # Runde 3: heimisch — Farn und Ampfer statt der tropischen Blattpflanze
        blatt = (farne[:2] + pflanzen('weed_plant_02', 0.4)[:1]) if R3 else pflanzen('anthurium_botany_01', 0.45)
        for i, (x, y, g) in enumerate(((-11.4, 3.6, 1.5), (-11.0, -0.9, 1.3), (-10.2, 4.6, 1.2), (-11.9, -2.2, 1.1), (-8.9, -2.4, 0.9), (3.9, 2.4, 1.1), (3.8, 5.6, 1.2), (4.0, -4.6, 1.0), (-0.9, 6.5, 1.0), (-6.9, 5.6, 1.0), (6.3, -0.2, 0.9))):
            setze_frei(blatt[i % 3], 'Blattpflanze%d' % i, (x, y, bodenz(ter, x, y) - 0.03), g * (1.3 if R3 else 1.0), (0, 0, i * 1.9))
        # ---- Mauerkrone: Gras, Kraut und Farn in den Lücken, Efeu hängt über die Kante und steigt vom Fuss
        kraut = pflanzen('celandine_01'); efeu_a = {}
        for k, (p, q, t, mname) in enumerate(MAUERKRONE):
            r = rnd.random()
            if r < 0.50: setze_frei(gras[rnd.randrange(len(gras))], 'Krongras%d' % k, p + q * rnd.uniform(-0.3, 0.3) * t - Vector((0, 0, 0.03)), rnd.uniform(1.6, 3.0), (0, 0, rnd.random() * 6.283))
            if 0.35 < r < 0.62: setze_frei(kraut[rnd.randrange(len(kraut))], 'Kronkraut%d' % k, p + q * rnd.uniform(-0.3, 0.3) * t - Vector((0, 0, 0.02)), rnd.uniform(1.8, 3.0), (0, 0, rnd.random() * 6.283))
            if r > 0.86: setze_frei(farne[rnd.randrange(len(farne))], 'Kronfarn%d' % k, p + q * rnd.uniform(-0.2, 0.2) * t - Vector((0, 0, 0.05)), rnd.uniform(0.7, 1.3), (0, 0, rnd.random() * 6.283))
            if mname == 'Stuetzmauer': continue
            for seite in (-1, 1):
                if rnd.random() < 0.30:
                    rr = rnd.uniform(0.28, 0.62)
                    efeu_a.setdefault(mname, []).append((p + q * seite * (t / 2) - Vector((0, 0, rr * rnd.uniform(0.5, 1.1))), q * seite, rr))
        for (a, b, luecke, hoch, laenge) in MAUERLINIEN[:3]:   # vom Fuss aufsteigend: grosse Flecken, nicht an jedem Meter
            ri = Vector((b[0] - a[0], b[1] - a[1], 0)).normalized(); q = Vector((-ri.y, ri.x, 0))
            for _ in range(int(laenge / 2.2)):
                uu = rnd.uniform(0.6, laenge - 0.6)
                if luecke is not None and luecke[0] - 0.5 < uu < luecke[1] + 0.5: continue
                h = hoch(uu - laenge / 2); rr = rnd.uniform(0.6, 1.2); zz = rnd.uniform(0.8, max(1.0, h * 0.6))
                for seite in (-1, 1):
                    if rnd.random() < 0.6:
                        efeu_a.setdefault('Fuss', []).append((Vector((a[0], a[1], zt - 0.35 + zz)) + ri * uu + q * seite * 0.47, q * seite, rr))
        if R3: efeu_geometrie(zt)   # Blattgeometrie wie am Haus statt Karten
        else:
            for i, (mname, flecken) in enumerate(efeu_a.items()): efeu_karten('Efeu_' + mname, flecken, 372 + i)
        print('ZIELBILD Efeuflecken', sum(len(v) for v in efeu_a.values()))
        # ---- Büsche und junge Bäume: hinter der Mauer, an den Hofecken; ein Scan-Laubbaum als dichte Krone
        # Speicher: ein Scan-Laubbaum (3,9 Mio. Dreiecke) für alles — als Heldenbaum gross, als Jungwuchs und Busch klein
        # instanziert. Mehr verschiedene Scan-Bäume sprengen den Arbeitsspeicher der Cloud-Maschine (geteilt, 14 GB).
        if R3: baeume3(sb, ter, ferne)
        elif os.environ.get('ZIELBILD_KRONE', '1') == '1':
            krone = pflanzen('jacaranda_tree', 0.4, 'leaves')
            for i, (name, x, y, h, saat) in enumerate(helden):
                zr = random.Random(saat)
                gross = name in ('Held0', 'Held1', 'Held5', 'Held3')   # am Hof: Kronendach und Rahmen; alle anderen kleiner
                if name == 'Held0': x, y = -6.5, 7.4
                if name == 'Held3': x, y = -2.0, -10.5
                g = h / 19.5 * (0.8 if gross else zr.uniform(0.36, 0.6))
                setze_frei(krone[0], name, (x, y, bodenz(ter, x, y) - 0.3 * g), g, (0, 0, zr.random() * 6.283))
            print('ZIELBILD Scan-Laubbäume', len(helden), 'Scan-Tannen', len(tannen))
            # Büsche und Jungwuchs: derselbe Baum klein (kostet keinen Speicher) — hinter der Mauer links, an den Hofecken
            for i, (x, y, g) in enumerate(((8.6, 4.4, 0.36), (-3.4, 11.0, 0.34), (10.5, 8.5, 0.30), (7.2, 2.6, 0.17), (2.6, 9.6, 0.18), (-10.6, 9.6, 0.20), (6.6, 6.4, 0.20), (-6.6, 9.6, 0.16), (9.8, 3.4, 0.22), (7.4, -9.6, 0.14))):
                setze_frei(krone[0], 'Jungbaum%d' % i, (x, y, bodenz(ter, x, y) - 0.1), g, (0, 0, 0.7 + i * 1.7))
        gruppen = {art: kronendichte(art, 2.4 if art == 'buche' else 3.0) for art in ('buche', 'fichte')}
        for o, art in KRONEN:
            mod = o.modifiers.new('Krone', 'NODES'); mod.node_group = gruppen[art]
        # ---- Echte Verschiebung: Mauern, Bogen, Platten, Becken, Boden
        for o in list(bpy.data.objects):
            if o.type != 'MESH' or not o.data.materials: continue
            if o.name in ('MauerA', 'MauerB', 'MauerC', 'Stuetzmauer', 'MauerA_Bogen', 'MauerB_Bogen', 'Hof', 'Becken'): adaptiv(o, 1.0)
        adaptiv(ter, 3.0 if R3 else 2.0)   # Runde 3: Speicher (drei Baum-Scans statt einem)
        # ---- Tal: gestaffelte Kulissen; Dunst gedeckelt (Talnebel unten, dünne Luft bis 90 m über der Terrasse)
        for n in ('Dunst', 'Bodennebel'):
            if n in bpy.data.objects: bpy.data.objects.remove(bpy.data.objects[n])
        if R3:
            # Runde 3: kein Talnebel-Volumen (das war das helle Band unter dem Himmel) — vier Rücken, die der Stil aus der
            # Tiefe staffelt; nur der Hof hat Dunst als Volumen (Lichtbahnen), Werte wie im Haus-Bild
            for o in [o for o in bpy.data.objects if o.name.startswith('Fernkulisse')]: bpy.data.objects.remove(o)
            (bergruecken4 if R4 else bergruecken)(zt)
            # dünner und kleiner als am Haus (dort 0,0026 auf 150 m): hier schaut die Kamera durch den Dunst in die Ferne — der
            # vom Himmel beleuchtete Schleier (~0,045) läge sonst über den dunklen Rücken und machte sie zu einem Band
            sb.dunst('Hofdunst', 100.0, zt - 8.0, zt + 26.0, float(os.environ.get('ZIELBILD_HOFDUNST', '0.0009')), 12.0, (1.0, 0.88, 0.70), 0.5)
        else: bergkulissen(zt)
        if not R3: sb.dunst('Talnebel', 20000.0, zt - 470.0, zt - 30.0, 0.0013, 105.0, (0.96, 0.84, 0.70), 0.2)
        if not R3: sb.dunst('Luft', 20000.0, zt - 470.0, zt + 90.0, 0.00006, 2000.0, (0.95, 0.82, 0.66), 0.2)
        if not R3: sb.dunst('Hofdunst', 160.0, zt - 6.0, zt + 40.0, 0.0003, 22.0, (1.0, 0.88, 0.72), 0.35)
        # ---- Licht: Sonne tief hinter der Mauer rechts vom Bogen (Gegenlicht), Himmel aus dem Foto
        for o in [o for o in bpy.data.objects if o.type == 'LIGHT']: bpy.data.objects.remove(o)
        EL = float(os.environ.get('ZIELBILD_EL', '24.5' if R3 else '18'))
        # Sonne deutlich über dem Füllen (D371 war flau: Boden bekam vom Himmel fast so viel wie von der tiefen Sonne)
        if R3:   # Werte des Haus-Bildes: Sonne 3,8 gegen HDRI-Füllen 0,42 — golden, Schatten bleiben lesbar
            sonne, _ = sb.sonne(EL, AZ, (1.0, 0.66, 0.38), float(os.environ.get('ZIELBILD_SONNE', '3.8'))); sonne.data.angle = math.radians(1.6)
        else:
            sonne, _ = sb.sonne(EL, AZ, (1.0, 0.74, 0.48), float(os.environ.get('ZIELBILD_SONNE', '11')))
            sonne.data.angle = math.radians(2.0)
        # Sonnenprobe (Regel 6 der Spielereferenz: 10–20 % des Bodens besonnt): Strahlen vom Hof zur Sonne, wer steht im Weg?
        el, az = math.radians(EL), math.radians(AZ)
        zs = Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))
        dg = bpy.context.evaluated_depsgraph_get(); frei = 0; ges = 0; wer = {}; karte = {}
        for ix in range(-9, 5):
            for iy in range(-7, 7):
                ges += 1
                p0 = Vector((ix + 0.5, iy + 0.5, zt + 0.4))
                for _ in range(12):   # Dunstkästen und Efeukarten (Alpha) zählen nicht: dahinter weiter
                    hit, ort_h, _n, _i, obj, _m = sc.ray_cast(dg, p0, zs)
                    if not hit or not obj.name.startswith(('Hofdunst', 'Luft', 'Talnebel', 'Efeu', 'Laubstreu')): break
                    p0 = ort_h + zs * 0.02
                if not hit: frei += 1
                else: wer[obj.name.rstrip('0123456789')] = wer.get(obj.name.rstrip('0123456789'), 0) + 1
                karte[(ix, iy)] = '#' if not hit else '.'
        for iy in range(6, -8, -1): print('ZIELBILD Sonnenkarte y=%+.1f  x=-8.5…+4.5  %s' % (iy + 0.5, ''.join(karte[(ix, iy)] for ix in range(-9, 5))))
        print('ZIELBILD Sonnenprobe: %d %% des Hofs besonnt (Geometrie ohne Blattlücken); im Weg:' % (100 * frei / ges), sorted(wer.items(), key=lambda t: -t[1])[:6])
        if R3: himmel_haus(EL, AZ)
        else: himmel_foto('evening_road_01_puresky', EL, AZ, 0.6035, float(os.environ.get('ZIELBILD_HIMMEL', '0.08')), 1.5, float(os.environ.get('ZIELBILD_HIMMELDREH', '35')))
        # ---- Kameras
        kams = {'bogen': sc.camera}
        einst = [('ziel', (-11.0, 2.2, 1.9), (5.0, -1.0, 3.3), 24), ('mauer', (-1.5, 4.8, 1.8), (4.6, 2.6, 2.6), 28),
                 ('boden', (-7.2, 2.2, 1.15), (-3.4, -0.4, 0.1), 30), ('nah', (-5.6, 2.3, 1.45), (-1.4, -1.0, 0.25), 28)]
        if R4:
            # Runde 4: Standort wie D372/D382, Blick 3° tiefer (weniger Himmel, mehr Vordergrund und Pfad); die Nahaufnahme
            # Boden liegt an der Schattengrenze auf der Trittspur (Lichtfleck und Kronenschatten im selben Bild)
            ko = lambda t, n: tuple(float(x) for x in os.environ.get(n, t).split(','))
            einst[0] = ('ziel', (-11.0, 2.2, 1.9), ko('5.0,-1.0,2.45', 'ZIELBILD_BLICK'), 24)
            einst[2] = ('boden', ko('-5.4,2.6,1.05', 'ZIELBILD_BODEN_ORT'), ko('-1.2,-0.6,0.1', 'ZIELBILD_BODEN_BLICK'), 30)
        if R5:   # Runde 5: Blick 1,2° höher als R4 (Himmel 7 % war knapp), dazu eine Kamera aufs Ufer des Tümpels
            einst[0] = ('ziel', (-11.0, 2.2, 1.9), ko('5.0,-1.0,2.8', 'ZIELBILD_BLICK'), 24)
            einst.append(('ufer', ko('-6.2,0.6,1.35', 'ZIELBILD_UFER_ORT'), ko('-2.2,-3.4,-0.05', 'ZIELBILD_UFER_BLICK'), 30))
        for kname, ort, ziel, brenn in einst:
            k = sb.kamera((ort[0], ort[1], zt + ort[2]), (ziel[0], ziel[1], zt + ziel[2]), brenn); k.name = 'Kamera_' + kname; kams[kname] = k
            if R3: k.data.clip_end = 20000.0   # der fernste Rücken steht bei 8 km
        sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'
        if os.environ.get('BRACHLAND_CPU') != '1':   # D413: am M1 Metal-GPU (Übergabe D377), in der Cloud `BRACHLAND_CPU=1`
            try:
                prefs = bpy.context.preferences.addons['cycles'].preferences
                prefs.compute_device_type = 'METAL'; prefs.get_devices()
                for d in prefs.devices: d.use = True
                if any(d.type == 'METAL' for d in prefs.devices): sc.cycles.device = 'GPU'
            except Exception as e: print('GPU', e)
        print('GERAET', sc.cycles.device)
        sc.cycles.samples = samples; sc.cycles.use_adaptive_sampling = True; sc.cycles.adaptive_threshold = 0.025
        sc.cycles.use_denoising = True; sc.cycles.denoiser = 'OPENIMAGEDENOISE'
        sc.cycles.max_bounces = 5; sc.cycles.diffuse_bounces = 2; sc.cycles.glossy_bounces = 1
        sc.cycles.transmission_bounces = 4; sc.cycles.volume_bounces = 0; sc.cycles.transparent_max_bounces = 32
        sc.cycles.sample_clamp_indirect = 4.0; sc.cycles.caustics_reflective = sc.cycles.caustics_refractive = False
        sc.cycles.volume_step_rate = 4.0; sc.cycles.volume_max_steps = 64
        sc.cycles.dicing_rate = float(os.environ.get('ZIELBILD_DICING', '1.0')); sc.cycles.offscreen_dicing_scale = 16.0 if R3 else 8.0   # ZIELBILD_DICING > 1 spart Speicher (Nahaufnahmen); sc.cycles.max_subdivisions = 9
        sc.render.use_simplify = True; sc.cycles.texture_limit_render = os.environ.get('ZIELBILD_TEXTUR', '1024' if R3 else '2048')   # Speicher
        sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = breite, hoehe, 100
        sc.view_settings.view_transform = 'AgX'
        try: sc.view_settings.look = 'AgX - Medium High Contrast'
        except Exception: pass
        sc.view_settings.exposure = 1.0
        vl = sc.view_layers[0]
        vl.use_pass_z = vl.use_pass_normal = vl.use_pass_mist = vl.use_pass_object_index = True
        # Nebelpass steuert die Pinselgrösse im Stil: bis zur Mauer (~19 m von der Hauptkamera) bleibt alles unberührt
        sc.world.mist_settings.start = 9.0; sc.world.mist_settings.depth = 220.0; sc.world.mist_settings.falloff = 'LINEAR'
        try: sc.render.image_settings.media_type = 'MULTI_LAYER_IMAGE'
        except Exception as e: print('media_type', e)
        sc.render.image_settings.file_format = 'OPEN_EXR_MULTILAYER'; sc.render.image_settings.color_depth = '16'
        if os.environ.get('AFRAME_BLEND'): bpy.ops.wm.save_as_mainfile(filepath=os.environ['AFRAME_BLEND'])
        import resource
        print('ZIELBILD Aufbau gesamt %.0f s, Objekte %d, Speicher %.1f GB' % (time.time() - t_start, len(bpy.data.objects), resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1048576.0))
        for k in kameras:
            sc.camera = kams[k]
            sc.render.filepath = os.path.abspath('%s-%s.exr' % (praefix, k))
            t0 = time.time()
            bpy.ops.render.render(write_still=True)
            import resource
            print('ZIELBILD', k, 'Renderzeit %.0f s' % (time.time() - t0), 'Speicherspitze %.1f GB' % (resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1048576.0), sc.render.filepath)
    sb.rendern = rendern
    sb.bauen()

# =====================================================================================================================
# Orts-Frame (D412, Ledger A-25): A-Frame an einem echten Ort aus den massstäblichen Spielnetzen
# =====================================================================================================================
def ortframe():
    """A-Frame an einem vermessenen Ort (zuerst Milbinger Straße): Häuser (OSM-Grundriss, amtliche LoD2-Dächer,
    Fassadenbauteile), vermessener Strassenquerschnitt und DGM1-Gelände kommen unverändert aus dem Spiel
    (Export-JSON: `punkte`, `flaechen`, `rollen` je Netz, Blender-Achsen). Hier kommt nur dazu, was ADR-0018 verlangt:
    Scan-Oberflächen, Verwitterung nach Story v2 (Brache in der Flutzone, D374) und gestaltetes Licht.
    Verwitterung ist Material, nicht Geometrie: Flutmarke und Schlick am Wandfuss, Algenläufe, Moos auf Dach und in
    Rissen, Laubstreu auf dem Asphalt, hohes Gras und Aufwuchs. Einsturz kommt aus den Verfallsstufen des Spiels."""
    from mathutils.bvhtree import BVHTree
    quelle, scans, praefix = ARGS[1], ARGS[2], ARGS[3]
    breite, hoehe, samples = (int(ARGS[4]), int(ARGS[5]), int(ARGS[6])) if len(ARGS) > 6 else (1280, 720, 48)
    kameras = ARGS[7].split(',') if len(ARGS) > 7 else ['strasse', 'haus']
    FLUT = float(os.environ.get('ORT_FLUT', '1.1'))   # Flutmarke in m über dem Wandfuss — gestaltet, kein Messwert
    sys.argv = [sys.argv[0], '--', os.path.dirname(quelle), '/tmp/claude-0/ort.blend', '/tmp/claude-0/ort.png', 'schnell', 'felsmulde']
    sys.path.insert(0, HIER)
    import szenenbau as sb
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    daten = json.load(open(quelle))
    rnd = random.Random(377)

    def hofscan(name, karte): return os.path.join(scans, '%s-%s.jpg' % (name, karte))

    def mat_ort(name, scanname, ton, meter, flut=0.0, algen=0.0, moos=0.0, glanz=None):
        """Scan (Farbe, Normale, Rauheit) im Metermass, darüber die Verwitterung."""
        m, nt, out = neues_material(name)
        b = N(nt, 'ShaderNodeBsdfPrincipled', (900, 0)); L(nt, b.outputs[0], out.inputs['Surface'])
        uv = N(nt, 'ShaderNodeUVMap', (-1400, 0)); uv.uv_map = 'Meter'
        mp = N(nt, 'ShaderNodeMapping', (-1200, 0)); mp.inputs['Scale'].default_value = (1 / meter,) * 3; L(nt, uv.outputs[0], mp.inputs['Vector'])
        dif = N(nt, 'ShaderNodeTexImage', (-900, 300)); dif.image = bild(hofscan(scanname, 'Diffuse')); L(nt, mp.outputs[0], dif.inputs['Vector'])
        rau = N(nt, 'ShaderNodeTexImage', (-900, 0)); rau.image = bild(hofscan(scanname, 'Rough'), False); L(nt, mp.outputs[0], rau.inputs['Vector'])
        nor = N(nt, 'ShaderNodeTexImage', (-900, -300)); nor.image = bild(hofscan(scanname, 'nor_gl'), False); L(nt, mp.outputs[0], nor.inputs['Vector'])
        nm = N(nt, 'ShaderNodeNormalMap', (-600, -300)); nm.inputs['Strength'].default_value = 1.2; L(nt, nor.outputs['Color'], nm.inputs['Color'])
        L(nt, nm.outputs[0], b.inputs['Normal'])
        farbe = N(nt, 'ShaderNodeMix', (-600, 300), data_type='RGBA', blend_type='MULTIPLY'); farbe.inputs[0].default_value = 0.7
        L(nt, dif.outputs['Color'], farbe.inputs[6]); farbe.inputs[7].default_value = (*ton, 1)
        aus_f, aus_r = farbe.outputs[2], rau.outputs['Color']
        tc = N(nt, 'ShaderNodeTexCoord', (-1400, -600))
        geo = N(nt, 'ShaderNodeNewGeometry', (-1400, -900)); sepn = N(nt, 'ShaderNodeSeparateXYZ', (-1200, -900)); L(nt, geo.outputs['Normal'], sepn.inputs[0])

        def ueber(fac, ziel, x):
            nonlocal aus_f
            mx = N(nt, 'ShaderNodeMix', (x, 300), data_type='RGBA'); L(nt, fac, mx.inputs[0]); L(nt, aus_f, mx.inputs[6]); mx.inputs[7].default_value = (*ziel, 1)
            aus_f = mx.outputs[2]
        if algen > 0:
            # Algen- und Schmutzläufe: Rauschen in der Senkrechten gestreckt, unter Traufen und Bänken dichter
            ma = N(nt, 'ShaderNodeMapping', (-1200, -600)); ma.inputs['Scale'].default_value = (3.5, 3.5, 0.22); L(nt, tc.outputs['Object'], ma.inputs['Vector'])
            na = N(nt, 'ShaderNodeTexNoise', (-1000, -600)); na.inputs['Scale'].default_value = 1.0; na.inputs['Detail'].default_value = 5; L(nt, ma.outputs[0], na.inputs['Vector'])
            ra = N(nt, 'ShaderNodeMapRange', (-800, -600)); ra.inputs['From Min'].default_value = 0.42; ra.inputs['From Max'].default_value = 0.66; ra.inputs['To Max'].default_value = algen; L(nt, na.outputs['Fac'], ra.inputs['Value'])
            ueber(ra.outputs[0], (0.085, 0.10, 0.055), -300)
        if flut > 0:
            # Flutmarke: unter der Linie Schlick und abgeplatzte Farbe, darüber ein heller Salz-/Kalkrand
            att = N(nt, 'ShaderNodeAttribute', (-1400, -1200)); att.attribute_name = 'grund'
            nf = N(nt, 'ShaderNodeTexNoise', (-1200, -1200)); nf.inputs['Scale'].default_value = 0.9; nf.inputs['Detail'].default_value = 4; L(nt, tc.outputs['Object'], nf.inputs['Vector'])
            hh = N(nt, 'ShaderNodeMath', (-1000, -1200), operation='MULTIPLY_ADD'); hh.inputs[1].default_value = 0.5; L(nt, nf.outputs['Fac'], hh.inputs[0]); L(nt, att.outputs['Fac'], hh.inputs[2])
            unter = N(nt, 'ShaderNodeMapRange', (-800, -1200)); unter.inputs['From Min'].default_value = FLUT + 0.33; unter.inputs['From Max'].default_value = FLUT + 0.17
            unter.inputs['To Max'].default_value = flut; L(nt, hh.outputs[0], unter.inputs['Value'])
            rand = N(nt, 'ShaderNodeMapRange', (-800, -1450)); rand.inputs['From Min'].default_value = FLUT + 0.55; rand.inputs['From Max'].default_value = FLUT + 0.33
            rand.inputs['To Max'].default_value = 0.35 * flut; L(nt, hh.outputs[0], rand.inputs['Value'])
            ueber(rand.outputs[0], (0.62, 0.58, 0.50), -150)
            ueber(unter.outputs[0], (0.115, 0.095, 0.065), 0)
        if moos > 0:
            # Moos, wo Wasser steht: Flächen nach oben, in Flecken
            nmo = N(nt, 'ShaderNodeTexNoise', (-1000, -1700)); nmo.inputs['Scale'].default_value = 1.3; nmo.inputs['Detail'].default_value = 6; L(nt, tc.outputs['Object'], nmo.inputs['Vector'])
            rm = N(nt, 'ShaderNodeMapRange', (-800, -1700)); rm.inputs['From Min'].default_value = 0.47; rm.inputs['From Max'].default_value = 0.62; L(nt, nmo.outputs['Fac'], rm.inputs['Value'])
            ob = N(nt, 'ShaderNodeMapRange', (-800, -1950)); ob.inputs['From Min'].default_value = 0.15; ob.inputs['From Max'].default_value = 0.55; L(nt, sepn.outputs['Z'], ob.inputs['Value'])
            mm = N(nt, 'ShaderNodeMath', (-600, -1700), operation='MULTIPLY'); L(nt, rm.outputs[0], mm.inputs[0]); L(nt, ob.outputs[0], mm.inputs[1])
            ms = N(nt, 'ShaderNodeMath', (-400, -1700), operation='MULTIPLY'); ms.inputs[1].default_value = moos; L(nt, mm.outputs[0], ms.inputs[0])
            ueber(ms.outputs[0], (0.10, 0.15, 0.04), 150)
        L(nt, aus_f, b.inputs['Base Color'])
        if glanz is None: L(nt, aus_r, b.inputs['Roughness'])
        else: b.inputs['Roughness'].default_value = glanz
        return m

    def mat_farbe(name, rauheit, dunkel=1.0):
        m, nt, out = neues_material(name)
        b = N(nt, 'ShaderNodeBsdfPrincipled', (300, 0)); L(nt, b.outputs[0], out.inputs['Surface'])
        v = N(nt, 'ShaderNodeVertexColor', (-300, 0)); v.layer_name = 'Spielpalette'
        mx = N(nt, 'ShaderNodeMix', (0, 0), data_type='RGBA', blend_type='MULTIPLY'); mx.inputs[0].default_value = 1.0
        L(nt, v.outputs['Color'], mx.inputs[6]); mx.inputs[7].default_value = (dunkel, dunkel, dunkel, 1)
        L(nt, mx.outputs[2], b.inputs['Base Color']); b.inputs['Roughness'].default_value = rauheit
        return m

    LAND = []
    def netz(name, dat, mats, meter):
        me = bpy.data.meshes.new(name); me.from_pydata(dat['punkte'], [], dat['flaechen']); me.update()
        o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
        for m in mats: me.materials.append(m)
        if dat.get('farben'):
            ca = me.color_attributes.new(name='Spielpalette', type='FLOAT_COLOR', domain='POINT')
            ca.data.foreach_set('color', [w for rgb in dat['farben'] for w in (*rgb, 1.0)])
        # Höhe über dem Gelände (nicht über dem tiefsten Punkt: die Hausnetze reichen als Schürze in den Boden)
        gr = me.attributes.new(name='grund', type='FLOAT', domain='POINT')
        def ueber_grund(q):
            t = LAND[0].ray_cast((q[0], q[1], 60), (0, 0, -1), 120)[0] if LAND else None
            return q[2] - t.z if t is not None else 0.0
        gr.data.foreach_set('value', [ueber_grund(q) for q in dat['punkte']])
        uv = me.uv_layers.new(name='Meter')
        rollen = dat.get('rollen') or [0] * len(me.polygons)
        for pl, r in zip(me.polygons, rollen):
            pl.material_index = min(r, len(mats) - 1)
            u = Vector((0, 0, 1)).cross(pl.normal).normalized() if abs(pl.normal.z) < 0.98 else Vector((1, 0, 0))
            v = pl.normal.cross(u)
            for i in pl.loop_indices:
                q = me.vertices[me.loops[i].vertex_index].co
                uv.data[i].uv = (u.dot(q), v.dot(q))
        return o

    # Gelände: Laubstreu-Scan, grün überwachsen in Flecken
    mb, ntb, outb = neues_material('Boden')
    bb = N(ntb, 'ShaderNodeBsdfPrincipled', (600, 0)); L(ntb, bb.outputs[0], outb.inputs['Surface']); bb.inputs['Roughness'].default_value = 0.95
    tcb = N(ntb, 'ShaderNodeTexCoord', (-900, 0)); mpb = N(ntb, 'ShaderNodeMapping', (-700, 0)); mpb.inputs['Scale'].default_value = (1 / 1.8,) * 3; L(ntb, tcb.outputs['Object'], mpb.inputs['Vector'])
    lb = kachel(ntb, mpb.outputs[0], scan('forest_leaves_02', 'diffuse'), True, (-400, 200))
    hb = kachel(ntb, mpb.outputs[0], scan('forest_leaves_02', 'disp'), False, (-400, -200))
    nb = N(ntb, 'ShaderNodeTexNoise', (-700, 400)); nb.inputs['Scale'].default_value = 0.25; nb.inputs['Detail'].default_value = 4; L(ntb, tcb.outputs['Object'], nb.inputs['Vector'])
    rb = N(ntb, 'ShaderNodeMapRange', (-400, 450)); rb.inputs['From Min'].default_value = 0.38; rb.inputs['From Max'].default_value = 0.62; L(ntb, nb.outputs['Fac'], rb.inputs['Value'])
    gb = N(ntb, 'ShaderNodeMix', (0, 200), data_type='RGBA'); L(ntb, rb.outputs[0], gb.inputs[0]); L(ntb, lb.outputs['Color'], gb.inputs[6]); gb.inputs[7].default_value = (0.07, 0.11, 0.03, 1)
    L(ntb, gb.outputs[2], bb.inputs['Base Color'])
    bu = N(ntb, 'ShaderNodeBump', (300, -200)); bu.inputs['Strength'].default_value = 0.9; bu.inputs['Distance'].default_value = 0.05; L(ntb, hb.outputs['Color'], bu.inputs['Height']); L(ntb, bu.outputs[0], bb.inputs['Normal'])
    terrain = netz('terrain', daten['terrain'], [mb], None)

    LAND.append(BVHTree.FromPolygons([v.co for v in terrain.data.vertices], [pl.vertices[:] for pl in terrain.data.polygons]))
    # Häuser: Rollen 0 Putz, 1 Holz, 2 Dach, 3 Sockel, 4 Rahmen, 5 Glas, 6/7 Bauteile (wie `terrain.ts`)
    putz = mat_ort('Kalkputz', 'plastered_wall_03', (0.86, 0.82, 0.70), 0.9, flut=0.95, algen=0.8)
    holz = mat_ort('Schalung', 'weathered_planks', (0.50, 0.46, 0.40), 2.1, flut=0.85, algen=0.6)
    dach = mat_ort('Dachziegel', 'grey_roof_tiles', (0.62, 0.42, 0.30), 2.8, moos=0.85)
    sockel = mat_ort('Sockel', 'old_stone_wall', (0.62, 0.58, 0.50), 1.7, flut=0.9, moos=0.5)
    rahmen = mat_farbe('Rahmenholz', 0.8, 0.8); glas = mat_farbe('Glas', 0.12, 0.35)
    for h in daten['haeuser']:
        netz('Haus_%d' % h['id'], h, [putz, holz, dach, sockel, rahmen, glas, rahmen, rahmen], None)
    # Strasse: Rollen 0 Fahrbahn, 1 Bord, 2 Gehweg, 3 Zufahrt — Laubstreu und Moos liegen in Flecken und am Rand
    asphalt = mat_ort('Asphalt', 'gravel_road', (0.20, 0.20, 0.19), 2.2, moos=0.9)
    beton = mat_ort('Bord', 'plastered_wall_03', (0.55, 0.56, 0.52), 1.3, moos=0.7)
    kies = mat_ort('Zufahrt', 'gravel_floor_02', (0.60, 0.52, 0.40), 2.0, moos=0.8)
    weg = netz('Strasse', daten['strasse'], [asphalt, beton, beton, kies], None)
    # Laubstreu auf dem Asphalt (Scan `forest_leaves_04`, D371): nach 50 Jahren liegt die Fahrbahn halb unter Streu
    nt = asphalt.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'); vor = b.inputs['Base Color'].links[0].from_socket
    tc = N(nt, 'ShaderNodeTexCoord', (0, 900)); mp = N(nt, 'ShaderNodeMapping', (200, 900)); mp.inputs['Scale'].default_value = (1 / 1.5,) * 3; L(nt, tc.outputs['Object'], mp.inputs['Vector'])
    laub = kachel(nt, mp.outputs[0], scan('forest_leaves_04', 'diff'), True, (400, 900))
    nl = N(nt, 'ShaderNodeTexNoise', (200, 1200)); nl.inputs['Scale'].default_value = 0.35; nl.inputs['Detail'].default_value = 5; L(nt, tc.outputs['Object'], nl.inputs['Vector'])
    rl = N(nt, 'ShaderNodeMapRange', (400, 1200)); rl.inputs['From Min'].default_value = 0.46; rl.inputs['From Max'].default_value = 0.60; rl.inputs['To Max'].default_value = 0.92; L(nt, nl.outputs['Fac'], rl.inputs['Value'])
    ml = N(nt, 'ShaderNodeMix', (700, 600), data_type='RGBA'); L(nt, rl.outputs[0], ml.inputs[0]); L(nt, vor, ml.inputs[6]); L(nt, laub.outputs['Color'], ml.inputs[7])
    L(nt, ml.outputs[2], b.inputs['Base Color'])
    def bvh(o): return BVHTree.FromPolygons([v.co for v in o.data.vertices], [pl.vertices[:] for pl in o.data.polygons])
    land, strasse = LAND[0], bvh(weg)
    def probe(baum, x, y):
        t = baum.ray_cast((x, y, 60), (0, 0, -1), 120)[0]
        return t
    kasten = daten['ausschluss']
    def im_haus(x, y, rand=0.1): return any(a - rand < x < c + rand and b - rand < y < d + rand for a, b, c, d in kasten)
    # Strassenachse (Mittel der Fahrbahnpunkte je 4-m-Band entlang y) für Kamera und Aufwuchs
    fahr = {}
    for fl, r in zip(daten['strasse']['flaechen'], daten['strasse']['rollen']):
        if r == 0:
            for i in fl:
                q = daten['strasse']['punkte'][i]; fahr.setdefault(round(q[1] / 4), []).append(q)
    achse = {k: (sum(q[0] for q in v) / len(v), k * 4.0, sum(q[2] for q in v) / len(v)) for k, v in fahr.items() if len(v) > 6}
    def mitte(y): return achse[min(achse, key=lambda k: abs(k * 4.0 - y))]

    # Hohes Gras und Samenstände: überall ausser Fahrbahnkern und Haus, am Strassenrand in die Fahrbahn hinein
    gras = []
    for ton in ((0.13, 0.20, 0.05), (0.34, 0.28, 0.11), (0.44, 0.36, 0.17)):
        gm, gnt, gout = neues_material('Gras'); gbs = N(gnt, 'ShaderNodeBsdfPrincipled', (0, 0)); gbs.inputs['Base Color'].default_value = (*ton, 1); gbs.inputs['Roughness'].default_value = 0.8
        L(gnt, gbs.outputs[0], gout.inputs['Surface']); gras.append(gm)
    pk, fl, ro = [], [], []
    for _ in range(420000):
        x, y = rnd.uniform(-45, 55), rnd.uniform(-75, 40)
        fleck = noise.noise(Vector((x * 0.3, y * 0.3, 4.1)))
        auf_str = probe(strasse, x, y) is not None
        if auf_str and (fleck < 0.18 or rnd.random() < 0.6): continue
        if not auf_str and fleck < -0.35: continue
        if im_haus(x, y): continue
        pt = probe(land, x, y)
        if pt is None: continue
        for _ in range(rnd.randint(3, 6)):
            a = rnd.random() * math.tau; w = rnd.uniform(0.004, 0.009); bx, by = math.cos(a) * w, math.sin(a) * w
            hh = rnd.uniform(0.25, 0.95) * (0.75 + fleck) * (0.5 if auf_str else 1.0)
            i = len(pk); z = pt.z + (0.02 if auf_str else -0.01)
            # Halm: schmale Basis, Mitte halb so breit und geneigt, Spitze — Breite bleibt Halmbreite, nicht Neigung
            nx, ny = by / w * hh * rnd.uniform(0.05, 0.3), -bx / w * hh * rnd.uniform(0.05, 0.3)
            pk.extend([(x - bx, y - by, z), (x + bx, y + by, z),
                       (x - bx * 0.6 + nx * 0.4, y - by * 0.6 + ny * 0.4, z + hh * 0.55), (x + bx * 0.6 + nx * 0.4, y + by * 0.6 + ny * 0.4, z + hh * 0.55),
                       (x + nx, y + ny, z + hh)])
            fl.extend([(i, i + 1, i + 2), (i + 1, i + 3, i + 2), (i + 2, i + 3, i + 4)])
            k = 0 if fleck > 0.2 or rnd.random() < 0.5 else 1 if rnd.random() < 0.85 else 2
            ro.extend([k, k, k])
    netz('Gras', {'punkte': pk, 'flaechen': fl, 'rollen': ro}, gras, None)
    print('ORT Halme', len(fl) // 3)

    # Aufwuchs: Spielbäume (ADR-0018: das Zielbild zeigt, was das Spiel zeigt). Jungwuchs im Strassenraum und in den
    # Gärten (50 Jahre ohne Pflege), dahinter hohe Bäume als Kulisse.
    class Grund:
        @staticmethod
        def bodenhoehe(x, y):
            t = probe(land, x, y); return t.z if t is not None else 0.0
    n = 0
    for _ in range(4000):
        if n >= 70: break
        x, y = rnd.uniform(-45, 55), rnd.uniform(-75, 40)
        mx = mitte(y)[0]
        if im_haus(x, y, 2.5) or abs(x - mx) < 1.6: continue
        nah = abs(x - mx) < 9
        if nah and rnd.random() < 0.35: continue
        hoch = rnd.uniform(6, 13) if nah else rnd.uniform(16, 27)
        spielbaum(Grund, rnd.choice(('buche', 'buche', 'fichte')), 'Baum_%d' % n, x, y, hoch, rnd.randrange(1000), y > -45)
        n += 1
    gruppen = {art: kronendichte(art, 2.4 if art == 'buche' else 3.0) for art in ('buche', 'fichte')}
    for o, art in KRONEN:
        mod = o.modifiers.new('Krone', 'NODES'); mod.node_group = gruppen[art]
    print('ORT Bäume', n, 'mit Kartenkrone', len(KRONEN))

    # Licht wie im A-Frame der Felsmulde: tiefe warme Sonne schräg von vorn, kühles Füllen, warmer Dunst
    a0, a1 = mitte(18.0), mitte(-26.0)
    blick = math.degrees(math.atan2(a1[0] - a0[0], a1[1] - a0[1]))
    EL, AZ = 15.0, blick + 28.0
    sonne, _ = sb.sonne(EL, AZ, (1.0, 0.72, 0.48), 5.0); sonne.data.angle = math.radians(1.2)
    himmel_gemalt(EL, AZ)
    zs = a0[2]
    sb.dunst('Ortsdunst', 400.0, zs - 6.0, zs + 60.0, 0.0016, 24.0, (1.0, 0.86, 0.68), 0.4)
    kams = {}
    kams['strasse'] = sb.kamera((a0[0] + 0.6, a0[1], a0[2] + 1.6), (a1[0], a1[1], a1[2] + 2.6), 26); kams['strasse'].name = 'KameraStrasse'
    hk = next(k for k in reversed(daten['kameras']) if k['name'] == 'hausverfall-strasse')
    kams['haus'] = sb.kamera(hk['ort'], hk['ziel'], 24); kams['haus'].name = 'KameraHaus'
    sc.render.engine = 'CYCLES'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'; prefs.get_devices()
        for d in prefs.devices: d.use = True
        sc.cycles.device = 'GPU'
    except Exception as e: print('GPU', e); sc.cycles.device = 'CPU'
    sc.cycles.samples = samples; sc.cycles.use_adaptive_sampling = True; sc.cycles.adaptive_threshold = 0.025
    sc.cycles.use_denoising = True; sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    sc.cycles.max_bounces = 5; sc.cycles.diffuse_bounces = 2; sc.cycles.glossy_bounces = 1
    sc.cycles.transmission_bounces = 4; sc.cycles.volume_bounces = 0; sc.cycles.transparent_max_bounces = 16
    sc.cycles.sample_clamp_indirect = 4.0; sc.cycles.caustics_reflective = sc.cycles.caustics_refractive = False
    sc.cycles.volume_step_rate = 4.0; sc.cycles.volume_max_steps = 64
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = breite, hoehe, 100
    sc.view_settings.view_transform = 'AgX'
    try: sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception: pass
    sc.view_settings.exposure = 1.0
    vl = sc.view_layers[0]
    vl.use_pass_z = vl.use_pass_normal = vl.use_pass_mist = vl.use_pass_object_index = True
    sc.world.mist_settings.start = 3.0; sc.world.mist_settings.depth = 150.0; sc.world.mist_settings.falloff = 'LINEAR'
    try: sc.render.image_settings.media_type = 'MULTI_LAYER_IMAGE'
    except Exception as e: print('media_type', e)
    sc.render.image_settings.file_format = 'OPEN_EXR_MULTILAYER'; sc.render.image_settings.color_depth = '16'
    if os.environ.get('AFRAME_BLEND'): bpy.ops.wm.save_as_mainfile(filepath=os.environ['AFRAME_BLEND'])
    import time
    for k in kameras:
        sc.camera = kams[k]; sc.render.filepath = os.path.abspath('%s-%s.exr' % (praefix, k))
        t0 = time.time(); bpy.ops.render.render(write_still=True)
        print('ORT', k, 'Renderzeit %.0f s' % (time.time() - t0), sc.render.filepath)


def knoten(g, typ, ort, **eing):
    n = g.nodes.new(typ); n.location = ort
    for k, v in eing.items():
        n.inputs[k].default_value = v
    return n


def stil():
    ein, art, aus = ARGS[1], ARGS[2], ARGS[3]
    if art in ('zielbild4', 'zielbild5'): art = 'zielbild3'   # Runde 4: derselbe Stil, andere Vorgaben (R4)
    sc = bpy.context.scene
    for o in list(bpy.data.objects):
        if o.type != 'CAMERA': bpy.data.objects.remove(o)
    try: sc.render.compositor_device = 'CPU'
    except Exception as e: print('Gerät', e)
    bild = bpy.data.images.load(os.path.abspath(ein))
    breite, hoehe = (int(ARGS[4]), int(ARGS[5])) if len(ARGS) > 5 else (1280, 720)
    sc.render.resolution_x, sc.render.resolution_y = breite, hoehe
    sc.render.resolution_percentage = 100
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 1
    sc.view_settings.view_transform = 'Standard'   # das EXR ist schon szenenbezogen linear; AgX kommt unten selbst
    g = bpy.data.node_groups.new('Stil', 'CompositorNodeTree'); sc.compositing_node_group = g
    g.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    ausg = g.nodes.new('NodeGroupOutput'); ausg.location = (1800, 0)
    im = g.nodes.new('CompositorNodeImage'); im.image = bild; im.location = (-800, 0)
    so = {o.name: o for o in im.outputs}
    farbe, tiefe, normale, nebel, index = so['Combined'], so['Depth'], so['Normal'], so['Mist'], so['Object Index']
    L = g.links.new

    def mix(a, b, f, typ='MIX', ort=(0, 0)):
        n = g.nodes.new('ShaderNodeMix'); n.data_type = 'RGBA'; n.blend_type = typ; n.location = ort
        if isinstance(f, float): n.inputs[0].default_value = f
        else: L(f, n.inputs[0])
        for sock, v in ((n.inputs[6], a), (n.inputs[7], b)):
            if isinstance(v, tuple): sock.default_value = (*v, 1)
            else: L(v, sock)
        return n.outputs[2]

    def kurve(src, x0, x1, ort=(0, 0), hoch=1.0):
        n = g.nodes.new('ShaderNodeMapRange'); n.location = ort
        L(src, n.inputs[0]); n.inputs[1].default_value = x0; n.inputs[2].default_value = x1
        n.inputs[4].default_value = hoch; n.clamp = True
        return n.outputs[0]

    def maske_befall():
        m = g.nodes.new('CompositorNodeIDMask'); m.location = (-500, -500)
        L(index, m.inputs[0]); m.inputs['Index'].default_value = 7
        return m.outputs[0]

    def kanten():
        """Silhouetten aus Tiefe und Normale (Sobel), nicht Freestyle: billig, und das Gras zeichnet keine Linien."""
        lg = g.nodes.new('ShaderNodeMath'); lg.operation = 'LOGARITHM'; lg.inputs[1].default_value = 2.718; L(tiefe, lg.inputs[0])
        s1 = g.nodes.new('CompositorNodeFilter'); s1.inputs['Type'].default_value = 'Sobel'; L(lg.outputs[0], s1.inputs['Image'])
        s2 = g.nodes.new('CompositorNodeFilter'); s2.inputs['Type'].default_value = 'Sobel'; L(normale, s2.inputs['Image'])
        bw1 = g.nodes.new('CompositorNodeRGBToBW'); L(s1.outputs[0], bw1.inputs[0])
        bw2 = g.nodes.new('CompositorNodeRGBToBW'); L(s2.outputs[0], bw2.inputs[0])
        a = kurve(bw1.outputs[0], 0.12, 0.45); b = kurve(bw2.outputs[0], 2.5, 4.0, hoch=0.5)
        mx = g.nodes.new('ShaderNodeMath'); mx.operation = 'MAXIMUM'; L(a, mx.inputs[0]); L(b, mx.inputs[1])
        # in der Ferne keine Linien: Nebel blendet sie aus
        nah = g.nodes.new('ShaderNodeMath'); nah.operation = 'MULTIPLY'; L(mx.outputs[0], nah.inputs[0])
        L(kurve(nebel, 0.35, 0.05), nah.inputs[1])
        return nah.outputs[0]

    def agx(src, ort, belichtung=1.3):
        n = g.nodes.new('CompositorNodeConvertToDisplay'); n.location = ort
        L(src, n.inputs[0])
        try:
            n.display_settings.display_device = 'sRGB'
            n.view_settings.view_transform = 'AgX'; n.view_settings.look = 'AgX - Medium High Contrast'
            n.view_settings.exposure = belichtung   # 1,3 wie szenenbau.rendern
        except Exception as e: print('Anzeige', e)
        return n.outputs[0]

    signal = maske_befall()
    if art in ('aframe', 'zielbild', 'zielbild3'):
        # D371 / ADR-0018: Pinselflächen nur im Grossen. Die Kuwahara-Grösse folgt dem Nebelpass (linear, 0 bei 3 m,
        # 1 bei 150 m): nah bleibt die Substanz der Scans unberührt, Kronen, Ferne und Himmel laufen zu Flächen.
        # Kein Korn, kein Schärfen — das Bild ist entrauscht (OIDN), der Filter glättet nur, er erfindet nichts.
        skala = breite / 1280.0
        if art == 'zielbild':
            # Himmel gedeckelt (Tonwert-Budget: höchstens 5 % über 0,7): nur der Hintergrund (Tiefe unendlich) wird
            # abgedunkelt und im Kontrast angehoben — die Wolkenmassen bleiben im Gegenlicht lesbar
            hk = float(os.environ.get('ZIELBILD_HIMMELSTIL', '0.72'))
            hg = g.nodes.new('ShaderNodeGamma'); hg.inputs['Gamma'].default_value = 1.3; L(farbe, hg.inputs['Color'])
            farbe = mix(farbe, mix(hg.outputs[0], (hk, hk, hk * 1.06), 1.0, 'MULTIPLY'), kurve(tiefe, 30000.0, 90000.0), ort=(-650, 200))
        if art == 'zielbild3':
            # Runde 3 (D382): Luftschichten aus der Tiefe wie im Haus-Bild — Menge = 1 − exp(−Weg / Sichtweite). Jeder
            # Bergrücken steht eine Tonstufe heller und blasser als der davor; der Himmel bleibt unberührt und damit
            # heller als das Tal (kein Nebelband). Dunstfarbe = Himmelsfarbe zur Sonne, gedeckt.
            def rechne(op, a, b=None):
                n_ = g.nodes.new('ShaderNodeMath'); n_.operation = op
                for i_, w_ in enumerate((a, b)):
                    if w_ is None: continue
                    if isinstance(w_, float): n_.inputs[i_].default_value = w_
                    else: L(w_, n_.inputs[i_])
                return n_.outputs[0]
            sichtweite = float(os.environ.get('ZIELBILD_SICHT', '5200' if R4 else '5000'))
            weg = rechne('MULTIPLY', rechne('MAXIMUM', rechne('SUBTRACT', tiefe, 45.0), 0.0), -1.0 / sichtweite)
            menge = rechne('MULTIPLY', rechne('SUBTRACT', 1.0, rechne('EXPONENT', weg)), rechne('LESS_THAN', tiefe, 1.0e6))
            wm = knoten(g, 'CompositorNodeBlur', (-600, 0)); L(menge, wm.inputs['Image'])   # Tiefe ist je Pixel ein Treffer: Laub flimmert sonst
            try: wm.inputs['Size'].default_value = (2.5 * skala, 2.5 * skala)
            except Exception as e: print('Blur', e)
            # knapp unter dem Himmel am Horizont (szenenlinear ~0,06/0,08/0,08 quer zur Sonne), warm verschoben: Regel 4
            # Runde 4: Dunst in Himmelsfarbe — der Horizonthimmel quer zur Sonne misst szenenlinear ~0,073 / 0,076 / 0,063
            dunstfarbe = tuple(float(x) for x in os.environ.get('ZIELBILD_DUNST', '0.070,0.074,0.066' if R4 else '0.058,0.062,0.064').split(','))
            luft = mix(farbe, dunstfarbe, rechne('MULTIPLY', wm.outputs[0], 0.94), ort=(-500, 200))
        else: luft = mix(farbe, (0.88, 0.74, 0.58), kurve(nebel, 0.35, 1.0, hoch=0.10 if art == 'zielbild' else 0.22), ort=(-500, 200))
        gr = g.nodes.new('ShaderNodeMapRange'); gr.location = (-500, 0); L(nebel, gr.inputs[0])
        gr.inputs[1].default_value = 0.10; gr.inputs[2].default_value = 0.65; gr.inputs[3].default_value = 0.0
        gr.inputs[4].default_value = 9.0 * skala; gr.clamp = True
        kw = knoten(g, 'CompositorNodeKuwahara', (-250, 200), Uniformity=4, Sharpness=0.6, Eccentricity=0.9)
        kw.inputs['Type'].default_value = 'Anisotropic'
        L(luft, kw.inputs['Image']); L(gr.outputs[0], kw.inputs['Size'])
        # Übergang weich: unter 0,06 Nebel exakt das Original (keine Pinselspuren auf Mauer und Boden)
        pinsel = mix(luft, kw.outputs[0], kurve(nebel, 0.06, 0.16), ort=(0, 200))
        bel = g.nodes.new('CompositorNodeExposure'); bel.location = (100, 200); bel.inputs['Exposure'].default_value = float(os.environ.get('ZIELBILD_EV', '-0.15' if art == 'zielbild3' else '-0.12')) if art != 'aframe' else AFRAME_EV
        L(pinsel, bel.inputs['Image'])
        gl = knoten(g, 'CompositorNodeGlare', (250, 200), Threshold=2.5, Strength=0.25, Size=0.8)
        gl.inputs['Type'].default_value = 'Bloom'
        L(bel.outputs[0], gl.inputs['Image'])
        disp = agx(gl.outputs[0], (350, 200))
        cb = g.nodes.new('CompositorNodeColorBalance'); cb.location = (550, 200)
        L(disp, cb.inputs['Image'])
        try:   # Lift kühl-violett (Schatten), Gain warm (Licht) — die gestaltete Temperaturtrennung
            if art == 'zielbild3': cb.inputs[4].default_value = (1.0, 0.998, 1.003, 1); cb.inputs[8].default_value = (1.08, 1.0, 0.88, 1)   # wie Haus-Bild: Lichter warm, Schatten neutral-warm
            elif art == 'zielbild': cb.inputs[4].default_value = (1.0, 0.999, 0.994, 1); cb.inputs[8].default_value = (1.05, 1.0, 0.93, 1)   # Schatten nicht blau
            else: cb.inputs[4].default_value = (0.97, 0.975, 1.05, 1); cb.inputs[8].default_value = (1.04, 1.0, 0.94, 1)
        except Exception as e: print('Balance', e)
        hs = knoten(g, 'CompositorNodeHueSat', (750, 200), Saturation=float(os.environ.get('ZIELBILD_SATT', '1.0' if art == 'zielbild3' else '0.86')) if art != 'aframe' else 1.08)
        L(cb.outputs[0], hs.inputs['Image']); ende = hs.outputs[0]
    elif art == 'gemalt':
        # Soulframe-Linie: Formen vereinfacht zu Pinselflächen (anisotroper Kuwahara), warmes Licht, Luftschichten, Glühen.
        lin = farbe
        tief = mix(lin, (0.80, 0.70, 0.56), kurve(nebel, 0.25, 0.95, hoch=0.45), ort=(-400, 200))
        kw = knoten(g, 'CompositorNodeKuwahara', (-200, 200), Size=6, Uniformity=4, Sharpness=0.85, Eccentricity=1.0)
        kw.inputs['Type'].default_value = 'Anisotropic'
        L(tief, kw.inputs['Image'])
        gl = knoten(g, 'CompositorNodeGlare', (0, 200), Threshold=0.7, Strength=0.6, Size=0.8)
        gl.inputs['Type'].default_value = 'Bloom'
        L(kw.outputs[0], gl.inputs['Image'])
        disp = agx(gl.outputs[0], (200, 200))
        cb = g.nodes.new('CompositorNodeColorBalance'); cb.location = (400, 200)
        L(disp, cb.inputs['Image'])
        try:
            cb.inputs[4].default_value = (0.97, 0.98, 1.04, 1); cb.inputs[8].default_value = (1.03, 1.0, 0.95, 1)
        except Exception as e: print('Balance', e)
        hs = knoten(g, 'CompositorNodeHueSat', (600, 200), Saturation=1.15)
        L(cb.outputs[0], hs.inputs['Image']); ende = hs.outputs[0]
    elif art == 'grafisch':
        # Grafischer Realismus: klare Flächen, wenige Tonwerte, Silhouetten-Linien, Tiefe in drei Nebelebenen.
        stufen = g.nodes.new('ShaderNodeValToRGB'); stufen.location = (-400, -200)
        stufen.color_ramp.interpolation = 'CONSTANT'
        e = stufen.color_ramp.elements; e[0].position = 0.0; e[0].color = (0, 0, 0, 1); e[1].position = 0.12; e[1].color = (0.38, 0.38, 0.38, 1)
        n3 = e.new(0.35); n3.color = (0.72, 0.72, 0.72, 1); n4 = e.new(0.7); n4.color = (1, 1, 1, 1)
        L(nebel, stufen.inputs[0])
        bw = g.nodes.new('CompositorNodeRGBToBW'); L(stufen.outputs[0], bw.inputs[0])
        ebenen = mix(farbe, (0.88, 0.80, 0.66), kurve(bw.outputs[0], 0.0, 1.0, hoch=0.75), ort=(-200, 200))
        kw = knoten(g, 'CompositorNodeKuwahara', (0, 200), Size=7, Uniformity=6, Sharpness=1.0, Eccentricity=0.6)
        kw.inputs['Type'].default_value = 'Anisotropic'
        L(ebenen, kw.inputs['Image'])
        disp = agx(kw.outputs[0], (200, 200))
        linie = mix(disp, (0.12, 0.10, 0.09), kanten(), ort=(700, 200))
        hs = knoten(g, 'CompositorNodeHueSat', (900, 200), Saturation=0.85)
        L(linie, hs.inputs['Image']); ende = hs.outputs[0]
    elif art == 'roh':
        # Vergleich: der unveränderte Render (heutige Zielbild-Linie, ADR-0006)
        ende = agx(farbe, (0, 200))
    else:
        # Atmosphärisch reduziert: fast einfarbig warmgrau, dichter Nebel, Silhouetten, nur der Befall leuchtet.
        dicht = mix(farbe, (0.70, 0.62, 0.50), kurve(nebel, 0.02, 0.55, hoch=0.85), ort=(-400, 200))
        disp = agx(dicht, (-200, 200))
        bw = g.nodes.new('CompositorNodeRGBToBW'); bw.location = (0, 200); L(disp, bw.inputs[0])
        duo = g.nodes.new('ShaderNodeValToRGB'); duo.location = (200, 200)
        e = duo.color_ramp.elements; e[0].color = (0.035, 0.028, 0.024, 1); e[1].color = (0.93, 0.85, 0.70, 1)
        mitte = e.new(0.45); mitte.color = (0.42, 0.36, 0.29, 1)
        L(bw.outputs[0], duo.inputs[0])
        etwas = mix(duo.outputs[0], disp, 0.18, ort=(400, 200))
        kw = knoten(g, 'CompositorNodeKuwahara', (500, 200), Size=7, Uniformity=6, Sharpness=0.9, Eccentricity=1.0)
        kw.inputs['Type'].default_value = 'Anisotropic'
        L(etwas, kw.inputs['Image'])
        glim = knoten(g, 'CompositorNodeGlare', (500, -200), Threshold=0.0, Strength=1.4, Size=0.9)
        glim.inputs['Type'].default_value = 'Bloom'
        sig = mix((0, 0, 0), (0.81, 0.91, 0.95), signal, ort=(300, -200))
        L(sig, glim.inputs['Image'])
        ende = mix(kw.outputs[0], glim.outputs[0], 1.0, 'SCREEN', ort=(700, 200))
    vg = g.nodes.new('CompositorNodeEllipseMask'); vg.location = (1000, -200)
    try: vg.inputs['Size'].default_value = (1.25, 1.35)
    except Exception: pass
    bl = knoten(g, 'CompositorNodeBlur', (1150, -200), Size=(140, 140)) if False else None
    vign = g.nodes.new('ShaderNodeMix'); vign.data_type = 'RGBA'; vign.blend_type = 'MULTIPLY'; vign.location = (1300, 0)
    L(ende, vign.inputs[6]); vign.inputs[7].default_value = (0.78, 0.74, 0.70, 1)
    inv = g.nodes.new('CompositorNodeInvert'); inv.location = (1150, -200); L(vg.outputs[0], inv.inputs['Color'])
    bw = g.nodes.new('CompositorNodeRGBToBW'); L(inv.outputs[0], bw.inputs[0])
    weichv = knoten(g, 'CompositorNodeBlur', (1200, -300)); L(bw.outputs[0], weichv.inputs['Image'])
    try: weichv.inputs['Size'].default_value = (220, 220)
    except Exception as e: print('Blur', e)
    bw2 = g.nodes.new('CompositorNodeRGBToBW'); L(weichv.outputs[0], bw2.inputs[0])
    L(bw2.outputs[0], vign.inputs[0])
    L(vign.outputs[2], ausg.inputs[0])
    sc.render.image_settings.file_format = 'PNG'; sc.render.filepath = os.path.abspath(aus)
    bpy.ops.render.render(write_still=True)
    print('STIL', art, aus)


if __name__ == '__main__':
    {'render': render, 'aframe': aframe, 'zielbild': zielbild, 'zielbild3': zielbild, 'zielbild4': zielbild, 'zielbild5': zielbild, 'scanblend': scanblend, 'alphakarten': alphakarten, 'ortframe': ortframe}.get(MODUS, stil)()
