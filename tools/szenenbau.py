"""
BRACHLAND — Szenenbau (D153): ein Œntal-Ausschnitt als Blender-Szene im Zielstil.

    blender --background --python tools/szenenbau.py -- <objdir> <out.blend> <out.png> [schnell|voll]

Was hier steht, ist die **Zielreferenz** fuer Stufe 2 (Engine): dieselbe Stelle, dieselben
Motive, dasselbe Licht — im Spiel gemessen gegen diesen Render (`tools/mess/stil.mjs`).

Motive sind eigene Gattungen, keine fremden Designs (ADR-0004): eine verfallene Mauer mit
Bogen auf einer Terrasse, ein gepflasterter Hof mit Wasserbecken, Moosbloecke mit Wurzeln,
hohe schlanke Staemme, Dunst im Tal, tiefe warme Sonne im Gegenlicht.

Terrain kommt aus dem Spiel (`tools/terrainexport.ts`, DGM1 + Biome als Vertexfarbe),
alles andere entsteht prozedural hier — kein Download, keine fremden Texturen.
"""
import bpy, bmesh, math, random, sys, json, os
from mathutils import Vector, Matrix, Euler, noise

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OBJDIR = ARGS[0] if ARGS else '.cache/blender'
OUT_BLEND = ARGS[1] if len(ARGS) > 1 else '.cache/blender/oental_probe.blend'
OUT_PNG = ARGS[2] if len(ARGS) > 2 else '.cache/bilder/oental_probe.png'
SCHNELL = (ARGS[3] if len(ARGS) > 3 else 'voll') == 'schnell'
SZENE = ARGS[4] if len(ARGS) > 4 else 'felsmulde'   # felsmulde | stauwehr (D155)
random.seed(7)

# Farben (linear RGB) — der Korridor aus D152: warmes Licht, warmer Schatten, olivgruen, kein Blau.
STEIN = (0.30, 0.27, 0.23); STEIN2 = (0.42, 0.38, 0.32); MOERTEL = (0.14, 0.12, 0.10)
MOOS = (0.16, 0.22, 0.07); MOOS2 = (0.30, 0.36, 0.12)
BODEN_WIESE = (0.24, 0.27, 0.10); BODEN_WALD = (0.16, 0.12, 0.07); BODEN_FELS = (0.36, 0.34, 0.30)
LAUB = (0.26, 0.31, 0.10); LAUB_HELL = (0.48, 0.50, 0.18); NADEL = (0.10, 0.16, 0.07)
RINDE = (0.14, 0.10, 0.07); RINDE2 = (0.28, 0.22, 0.16)

def saeubern():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'
    return sc

def importiere(name):
    pfad = os.path.join(OBJDIR, name + '.obj')
    if not os.path.exists(pfad) or os.path.getsize(pfad) == 0:
        return None
    vorher = set(bpy.data.objects)
    bpy.ops.wm.obj_import(filepath=pfad, forward_axis='Y', up_axis='Z')
    neu = [o for o in bpy.data.objects if o not in vorher]
    if not neu:
        return None
    o = neu[0]; o.name = name
    for p in o.data.polygons: p.use_smooth = True
    return o

def material(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial'); out.location = (600, 0)
    return m, nt, out

def prinzip(nt, farbe, rauheit=0.9):
    b = nt.nodes.new('ShaderNodeBsdfPrincipled'); b.location = (300, 0)
    b.inputs['Base Color'].default_value = (*farbe, 1)
    b.inputs['Roughness'].default_value = rauheit
    return b

def neu(nt, typ, ort=(0, 0), **props):
    n = nt.nodes.new(typ); n.location = ort
    for k, v in props.items(): setattr(n, k, v)
    return n

def link(nt, a, ao, b, bi):
    nt.links.new(a.outputs[ao], b.inputs[bi])

def rampe(nt, ort, stops):
    r = neu(nt, 'ShaderNodeValToRGB', ort)
    el = r.color_ramp.elements
    el[0].position, el[0].color = stops[0][0], (*stops[0][1], 1)
    el[1].position, el[1].color = stops[-1][0], (*stops[-1][1], 1)
    for p, c in stops[1:-1]:
        e = el.new(p); e.color = (*c, 1)
    return r

# ----------------------------------------------------------------- Materialien
def moosmischung(nt, bsdf, basis_out, basis_sock, ort, staerke=1.0, hoehe=None):
    """Moos auf allem, was nach oben zeigt, in Ritzen und nahe am Boden. Gibt den Farbausgang zurueck."""
    tex = neu(nt, 'ShaderNodeTexCoord', (ort[0] - 900, ort[1]))
    geo = neu(nt, 'ShaderNodeNewGeometry', (ort[0] - 900, ort[1] - 300))
    n1 = neu(nt, 'ShaderNodeTexNoise', (ort[0] - 700, ort[1] + 100)); n1.inputs['Scale'].default_value = 0.9; n1.inputs['Detail'].default_value = 9; n1.inputs['Roughness'].default_value = 0.7
    link(nt, tex, 'Object', n1, 'Vector')
    sepn = neu(nt, 'ShaderNodeSeparateXYZ', (ort[0] - 700, ort[1] - 300)); link(nt, geo, 'Normal', sepn, 'Vector')
    oben = neu(nt, 'ShaderNodeMapRange', (ort[0] - 500, ort[1] - 300)); oben.inputs['From Min'].default_value = -0.2; oben.inputs['From Max'].default_value = 0.9
    link(nt, sepn, 'Z', oben, 'Value')
    m1 = neu(nt, 'ShaderNodeMath', (ort[0] - 300, ort[1]), operation='MULTIPLY'); link(nt, n1, 'Fac', m1, 0); link(nt, oben, 'Result', m1, 1)
    if hoehe is not None:
        sepp = neu(nt, 'ShaderNodeSeparateXYZ', (ort[0] - 700, ort[1] - 500)); link(nt, tex, 'Object', sepp, 'Vector')
        tief = neu(nt, 'ShaderNodeMapRange', (ort[0] - 500, ort[1] - 500)); tief.inputs['From Min'].default_value = 0.0; tief.inputs['From Max'].default_value = hoehe
        tief.inputs['To Min'].default_value = 1.6; tief.inputs['To Max'].default_value = 0.4
        link(nt, sepp, 'Z', tief, 'Value')
        m2 = neu(nt, 'ShaderNodeMath', (ort[0] - 150, ort[1] - 200), operation='MULTIPLY'); link(nt, m1, 0, m2, 0); link(nt, tief, 'Result', m2, 1); m1 = m2
    kante = neu(nt, 'ShaderNodeMapRange', (ort[0], ort[1])); kante.inputs['From Min'].default_value = 0.38; kante.inputs['From Max'].default_value = 0.62 / max(0.2, staerke)
    link(nt, m1, 'Value', kante, 'Value')
    moos = rampe(nt, (ort[0] - 300, ort[1] + 350), [(0.3, MOOS), (0.8, MOOS2)])
    n2 = neu(nt, 'ShaderNodeTexNoise', (ort[0] - 500, ort[1] + 350)); n2.inputs['Scale'].default_value = 14; link(nt, tex, 'Object', n2, 'Vector'); link(nt, n2, 'Fac', moos, 'Fac')
    mix = neu(nt, 'ShaderNodeMix', (ort[0] + 150, ort[1] + 100), data_type='RGBA'); link(nt, kante, 'Result', mix, 'Factor')
    link(nt, basis_out, basis_sock, mix, 6); link(nt, moos, 'Color', mix, 7)
    link(nt, mix, 2, bsdf, 'Base Color')
    rmix = neu(nt, 'ShaderNodeMath', (ort[0] + 150, ort[1] - 150), operation='MAXIMUM'); rmix.inputs[1].default_value = 0.85
    link(nt, kante, 'Result', rmix, 0)
    return mix

def mat_stein(name='Stein', block=(1.0, 0.42), moos=1.0, hoehe=5.0, ebene='wand'):
    """Mauerwerk. `ebene` 'wand': Fugen in (x+y, z) — passt fuer achsparallele Mauern; 'boden': (x, y)."""
    m, nt, out = material(name); b = prinzip(nt, STEIN, 0.85); link(nt, b, 'BSDF', out, 'Surface')
    tex = neu(nt, 'ShaderNodeTexCoord', (-1700, 0))
    sep = neu(nt, 'ShaderNodeSeparateXYZ', (-1500, 100)); link(nt, tex, 'Object', sep, 'Vector')
    komb = neu(nt, 'ShaderNodeCombineXYZ', (-1200, 100))
    if ebene == 'wand':
        add = neu(nt, 'ShaderNodeMath', (-1350, 200), operation='ADD'); link(nt, sep, 'X', add, 0); link(nt, sep, 'Y', add, 1)
        link(nt, add, 'Value', komb, 'X'); link(nt, sep, 'Z', komb, 'Y')
    else:
        link(nt, sep, 'X', komb, 'X'); link(nt, sep, 'Y', komb, 'Y')
    br = neu(nt, 'ShaderNodeTexBrick', (-1000, 0)); br.offset = 0.5; br.squash = 1.0
    br.inputs['Scale'].default_value = 1.0; br.inputs['Mortar Size'].default_value = 0.025 if ebene == 'wand' else 0.07; br.inputs['Mortar Smooth'].default_value = 0.15
    br.inputs['Brick Width'].default_value = block[0]; br.inputs['Row Height'].default_value = block[1]; br.inputs['Bias'].default_value = 0.0
    br.inputs['Color1'].default_value = (*STEIN, 1); br.inputs['Color2'].default_value = (*STEIN2, 1); br.inputs['Mortar'].default_value = (*MOERTEL, 1)
    link(nt, komb, 'Vector', br, 'Vector')
    n = neu(nt, 'ShaderNodeTexNoise', (-1000, -350)); n.inputs['Scale'].default_value = 2.5; n.inputs['Detail'].default_value = 10; link(nt, tex, 'Object', n, 'Vector')
    grime = rampe(nt, (-750, -350), [(0.35, (0.55, 0.5, 0.45)), (0.7, (1.0, 1.0, 1.0))]); link(nt, n, 'Fac', grime, 'Fac')
    mul = neu(nt, 'ShaderNodeMix', (-500, 0), data_type='RGBA', blend_type='MULTIPLY'); mul.inputs[0].default_value = 1.0
    link(nt, br, 'Color', mul, 6); link(nt, grime, 'Color', mul, 7)
    bump = neu(nt, 'ShaderNodeBump', (0, -400)); bump.inputs['Strength'].default_value = 0.55; bump.inputs['Distance'].default_value = 0.08
    link(nt, br, 'Fac', bump, 'Height')
    n3 = neu(nt, 'ShaderNodeTexNoise', (-1000, -700)); n3.inputs['Scale'].default_value = 40; n3.inputs['Detail'].default_value = 6; link(nt, tex, 'Object', n3, 'Vector')
    bump2 = neu(nt, 'ShaderNodeBump', (-300, -700)); bump2.inputs['Strength'].default_value = 0.25; bump2.inputs['Distance'].default_value = 0.02
    link(nt, n3, 'Fac', bump2, 'Height'); link(nt, bump2, 'Normal', bump, 'Normal'); link(nt, bump, 'Normal', b, 'Normal')
    inv = neu(nt, 'ShaderNodeMath', (-700, 250), operation='SUBTRACT'); inv.inputs[0].default_value = 1.0; link(nt, br, 'Fac', inv, 1)
    moosmischung(nt, b, mul, 2, (-100, 300), staerke=moos, hoehe=hoehe)
    return m

def mat_pflaster(name='Pflaster', ebene='boden', skala=1.3, moos=0.9, hoehe=None):
    """Bruchstein: Voronoi-Zellen statt Ziegelverband — unregelmaessig, Moos in den Fugen.
    `ebene` 'boden': Zellen in (x, y); 'wand': in (x+y, z) fuer achsparallele Mauern."""
    m, nt, out = material(name); b = prinzip(nt, STEIN, 0.9); link(nt, b, 'BSDF', out, 'Surface')
    tex = neu(nt, 'ShaderNodeTexCoord', (-1600, 0))
    sep = neu(nt, 'ShaderNodeSeparateXYZ', (-1400, 100)); link(nt, tex, 'Object', sep, 'Vector')
    komb = neu(nt, 'ShaderNodeCombineXYZ', (-1200, 100))
    if ebene == 'wand':
        add = neu(nt, 'ShaderNodeMath', (-1300, 250), operation='ADD'); link(nt, sep, 'X', add, 0); link(nt, sep, 'Y', add, 1)
        link(nt, add, 'Value', komb, 'X'); link(nt, sep, 'Z', komb, 'Y')
    else:
        link(nt, sep, 'X', komb, 'X'); link(nt, sep, 'Y', komb, 'Y')
    # Zwei Zellgroessen: grosse Steine, dazwischen kleine Zwickel — eine Groesse allein liest sich als Muster
    verz = neu(nt, 'ShaderNodeTexNoise', (-1200, -150)); verz.inputs['Scale'].default_value = 0.8; verz.inputs['Detail'].default_value = 3; link(nt, komb, 'Vector', verz, 'Vector')
    vmix = neu(nt, 'ShaderNodeVectorMath', (-1100, 0), operation='ADD'); link(nt, komb, 'Vector', vmix, 0)
    vsk = neu(nt, 'ShaderNodeVectorMath', (-1150, -80), operation='SCALE'); vsk.inputs['Scale'].default_value = 0.35; link(nt, verz, 'Color', vsk, 0); link(nt, vsk, 'Vector', vmix, 1)
    vo = neu(nt, 'ShaderNodeTexVoronoi', (-1000, 0)); vo.feature = 'DISTANCE_TO_EDGE'; vo.inputs['Scale'].default_value = skala; vo.inputs['Randomness'].default_value = 1.0
    link(nt, vmix, 'Vector', vo, 'Vector')
    vo2 = neu(nt, 'ShaderNodeTexVoronoi', (-1000, 150)); vo2.feature = 'DISTANCE_TO_EDGE'; vo2.inputs['Scale'].default_value = skala * 2.7; vo2.inputs['Randomness'].default_value = 1.0
    link(nt, vmix, 'Vector', vo2, 'Vector')
    vc = neu(nt, 'ShaderNodeTexVoronoi', (-1000, -300)); vc.feature = 'F1'; vc.inputs['Scale'].default_value = skala; vc.inputs['Randomness'].default_value = 1.0
    link(nt, vmix, 'Vector', vc, 'Vector')
    # kleine Zellen nur dort, wo der grosse Stein „fehlt“ (Zellfarbe hell): Zwickel statt Muster
    klein = neu(nt, 'ShaderNodeMath', (-850, 150), operation='GREATER_THAN'); klein.inputs[1].default_value = 0.72
    scb = neu(nt, 'ShaderNodeSeparateColor', (-950, -420)); link(nt, vc, 'Color', scb, 'Color'); link(nt, scb, 'Green', klein, 0)
    dmin = neu(nt, 'ShaderNodeMath', (-750, 120), operation='MINIMUM'); link(nt, vo, 'Distance', dmin, 0)
    d2 = neu(nt, 'ShaderNodeMath', (-850, 60), operation='MULTIPLY_ADD'); link(nt, vo2, 'Distance', d2, 0); link(nt, klein, 'Value', d2, 1); d2.inputs[2].default_value = 0.0
    d2b = neu(nt, 'ShaderNodeMath', (-800, 30), operation='ADD'); link(nt, d2, 'Value', d2b, 0)
    d2c = neu(nt, 'ShaderNodeMath', (-800, -20), operation='MULTIPLY'); d2c.inputs[1].default_value = 1.0; link(nt, klein, 'Value', d2c, 0)
    inv = neu(nt, 'ShaderNodeMath', (-800, -60), operation='SUBTRACT'); inv.inputs[0].default_value = 1.0; link(nt, klein, 'Value', inv, 1)
    link(nt, inv, 'Value', d2b, 1)
    link(nt, d2b, 'Value', dmin, 1)
    fuge = neu(nt, 'ShaderNodeMapRange', (-650, 0)); fuge.inputs['From Min'].default_value = 0.012; fuge.inputs['From Max'].default_value = 0.04
    link(nt, dmin, 'Value', fuge, 'Value')
    stein = rampe(nt, (-750, -300), [(0.2, (0.30, 0.27, 0.23)), (0.5, STEIN), (0.8, STEIN2)])
    sc = neu(nt, 'ShaderNodeSeparateColor', (-850, -450)); link(nt, vc, 'Color', sc, 'Color'); link(nt, sc, 'Red', stein, 'Fac')
    n = neu(nt, 'ShaderNodeTexNoise', (-1000, -650)); n.inputs['Scale'].default_value = 4; n.inputs['Detail'].default_value = 8; link(nt, tex, 'Object', n, 'Vector')
    grime = rampe(nt, (-750, -650), [(0.35, (0.5, 0.47, 0.42)), (0.7, (1.0, 1.0, 1.0))]); link(nt, n, 'Fac', grime, 'Fac')
    mul = neu(nt, 'ShaderNodeMix', (-450, -300), data_type='RGBA', blend_type='MULTIPLY'); mul.inputs[0].default_value = 1.0
    link(nt, stein, 'Color', mul, 6); link(nt, grime, 'Color', mul, 7)
    moosf = rampe(nt, (-450, -600), [(0.3, MOOS), (0.8, MOOS2)]); link(nt, n, 'Fac', moosf, 'Fac')
    mix = neu(nt, 'ShaderNodeMix', (-200, 0), data_type='RGBA'); link(nt, fuge, 'Result', mix, 'Factor'); link(nt, moosf, 'Color', mix, 6); link(nt, mul, 2, mix, 7)
    bump = neu(nt, 'ShaderNodeBump', (0, -400)); bump.inputs['Strength'].default_value = 0.6; bump.inputs['Distance'].default_value = 0.06
    link(nt, fuge, 'Result', bump, 'Height')
    n3 = neu(nt, 'ShaderNodeTexNoise', (-450, -900)); n3.inputs['Scale'].default_value = 30; link(nt, tex, 'Object', n3, 'Vector')
    bump2 = neu(nt, 'ShaderNodeBump', (-250, -900)); bump2.inputs['Strength'].default_value = 0.25; bump2.inputs['Distance'].default_value = 0.02; link(nt, n3, 'Fac', bump2, 'Height')
    link(nt, bump2, 'Normal', bump, 'Normal'); link(nt, bump, 'Normal', b, 'Normal')
    moosmischung(nt, b, mix, 2, (-100, 350), staerke=moos, hoehe=hoehe)
    return m

def mat_boden(wiese=None):
    """Boden nach Biom (Vertexfarbe). `wiese` = (dunkel, mitte, hell) ersetzt die Wiesenrampe —
    die Auwiese am Stauwehr ist nass und dunkler als der trockene Hang der Felsmulde."""
    wiese = wiese or ((0.17, 0.19, 0.06), BODEN_WIESE, (0.45, 0.40, 0.16))
    m, nt, out = material('Boden'); b = prinzip(nt, wiese[1], 0.95); link(nt, b, 'BSDF', out, 'Surface')
    tex = neu(nt, 'ShaderNodeTexCoord', (-1600, 0))
    attr = neu(nt, 'ShaderNodeAttribute', (-1600, 300)); attr.attribute_name = 'Color'
    sep = neu(nt, 'ShaderNodeSeparateColor', (-1400, 300)); link(nt, attr, 'Color', sep, 'Color')
    # Biomfarbe: wiese (0.2,0.6,0.2) gruen, wald (0.05,0.3,0.1), fels (0.5,0.5,0.5) — Kanal R trennt Fels, G die Wiese vom Wald
    n = neu(nt, 'ShaderNodeTexNoise', (-1400, 0)); n.inputs['Scale'].default_value = 0.35; n.inputs['Detail'].default_value = 12; n.inputs['Roughness'].default_value = 0.75; link(nt, tex, 'Object', n, 'Vector')
    wiese = rampe(nt, (-1100, 100), [(0.3, wiese[0]), (0.55, wiese[1]), (0.8, wiese[2])]); link(nt, n, 'Fac', wiese, 'Fac')
    wald = rampe(nt, (-1100, -200), [(0.3, (0.09, 0.07, 0.04)), (0.6, BODEN_WALD), (0.85, (0.30, 0.25, 0.14))]); link(nt, n, 'Fac', wald, 'Fac')
    wf = neu(nt, 'ShaderNodeMapRange', (-1100, 400)); wf.inputs['From Min'].default_value = 0.35; wf.inputs['From Max'].default_value = 0.55; link(nt, sep, 'Green', wf, 'Value')
    mix1 = neu(nt, 'ShaderNodeMix', (-800, 0), data_type='RGBA'); link(nt, wf, 'Result', mix1, 'Factor'); link(nt, wald, 'Color', mix1, 6); link(nt, wiese, 'Color', mix1, 7)
    geo = neu(nt, 'ShaderNodeNewGeometry', (-1400, -500)); sepn = neu(nt, 'ShaderNodeSeparateXYZ', (-1200, -500)); link(nt, geo, 'Normal', sepn, 'Vector')
    steil = neu(nt, 'ShaderNodeMapRange', (-1000, -500)); steil.inputs['From Min'].default_value = 0.80; steil.inputs['From Max'].default_value = 0.55; link(nt, sepn, 'Z', steil, 'Value')
    # Fels an Blau erkennen (0,5): Siedlung (0,8/0,3/0,2) hat zwar viel Rot, ist aber Hofboden, kein Fels
    ff = neu(nt, 'ShaderNodeMapRange', (-1000, -700)); ff.inputs['From Min'].default_value = 0.38; ff.inputs['From Max'].default_value = 0.46; link(nt, sep, 'Blue', ff, 'Value')
    ffo = neu(nt, 'ShaderNodeMapRange', (-1000, -850)); ffo.inputs['From Min'].default_value = 0.62; ffo.inputs['From Max'].default_value = 0.56; link(nt, sep, 'Blue', ffo, 'Value')
    ffb = neu(nt, 'ShaderNodeMath', (-850, -750), operation='MULTIPLY'); link(nt, ff, 'Result', ffb, 0); link(nt, ffo, 'Result', ffb, 1)
    felsf = neu(nt, 'ShaderNodeMath', (-800, -600), operation='MAXIMUM'); link(nt, steil, 'Result', felsf, 0); link(nt, ffb, 'Value', felsf, 1)
    # Wasserzellen (Blau 0,8): Schlamm statt Wiese — das Bett unter dem Wasser ist dunkel
    schlammf = neu(nt, 'ShaderNodeMapRange', (-1000, -1000)); schlammf.inputs['From Min'].default_value = 0.62; schlammf.inputs['From Max'].default_value = 0.75; link(nt, sep, 'Blue', schlammf, 'Value')
    fels = rampe(nt, (-1100, -900), [(0.3, (0.22, 0.20, 0.17)), (0.7, BODEN_FELS)]); n2 = neu(nt, 'ShaderNodeTexNoise', (-1400, -900)); n2.inputs['Scale'].default_value = 3; link(nt, tex, 'Object', n2, 'Vector'); link(nt, n2, 'Fac', fels, 'Fac')
    mix2 = neu(nt, 'ShaderNodeMix', (-500, 0), data_type='RGBA'); link(nt, felsf, 'Value', mix2, 'Factor'); link(nt, mix1, 2, mix2, 6); link(nt, fels, 'Color', mix2, 7)
    mix3 = neu(nt, 'ShaderNodeMix', (-350, -150), data_type='RGBA'); link(nt, schlammf, 'Result', mix3, 'Factor'); link(nt, mix2, 2, mix3, 6); mix3.inputs[7].default_value = (0.10, 0.085, 0.06, 1)
    mix2 = mix3
    bump = neu(nt, 'ShaderNodeBump', (0, -400)); bump.inputs['Strength'].default_value = 0.3; bump.inputs['Distance'].default_value = 0.15
    n3 = neu(nt, 'ShaderNodeTexNoise', (-400, -600)); n3.inputs['Scale'].default_value = 6; n3.inputs['Detail'].default_value = 8; link(nt, tex, 'Object', n3, 'Vector'); link(nt, n3, 'Fac', bump, 'Height'); link(nt, bump, 'Normal', b, 'Normal')
    moosmischung(nt, b, mix2, 2, (-100, 350), staerke=0.6)
    return m

def mat_fels(name='Fels', moos=1.3, hoehe=None):
    m, nt, out = material(name); b = prinzip(nt, BODEN_FELS, 0.8); link(nt, b, 'BSDF', out, 'Surface')
    tex = neu(nt, 'ShaderNodeTexCoord', (-1400, 0))
    n = neu(nt, 'ShaderNodeTexNoise', (-1100, 0)); n.inputs['Scale'].default_value = 1.8; n.inputs['Detail'].default_value = 12; n.inputs['Roughness'].default_value = 0.65; link(nt, tex, 'Object', n, 'Vector')
    r = rampe(nt, (-800, 0), [(0.3, (0.20, 0.18, 0.15)), (0.55, (0.36, 0.33, 0.28)), (0.8, (0.52, 0.49, 0.43))]); link(nt, n, 'Fac', r, 'Fac')
    v = neu(nt, 'ShaderNodeTexVoronoi', (-1100, -400)); v.inputs['Scale'].default_value = 3.0; link(nt, tex, 'Object', v, 'Vector')
    bump = neu(nt, 'ShaderNodeBump', (0, -400)); bump.inputs['Strength'].default_value = 0.5; bump.inputs['Distance'].default_value = 0.1; link(nt, v, 'Distance', bump, 'Height')
    n2 = neu(nt, 'ShaderNodeTexNoise', (-1100, -700)); n2.inputs['Scale'].default_value = 30; n2.inputs['Detail'].default_value = 8; link(nt, tex, 'Object', n2, 'Vector')
    bump2 = neu(nt, 'ShaderNodeBump', (-300, -700)); bump2.inputs['Strength'].default_value = 0.3; bump2.inputs['Distance'].default_value = 0.02; link(nt, n2, 'Fac', bump2, 'Height')
    link(nt, bump2, 'Normal', bump, 'Normal'); link(nt, bump, 'Normal', b, 'Normal')
    moosmischung(nt, b, r, 'Color', (-100, 350), staerke=moos, hoehe=hoehe)
    return m

def mat_rinde():
    m, nt, out = material('Rinde'); b = prinzip(nt, RINDE, 0.9); link(nt, b, 'BSDF', out, 'Surface')
    tex = neu(nt, 'ShaderNodeTexCoord', (-1400, 0))
    mp = neu(nt, 'ShaderNodeMapping', (-1200, 0)); mp.inputs['Scale'].default_value = (1.0, 1.0, 0.12); link(nt, tex, 'Object', mp, 'Vector')
    n = neu(nt, 'ShaderNodeTexNoise', (-1000, 0)); n.inputs['Scale'].default_value = 6; n.inputs['Detail'].default_value = 10; link(nt, mp, 'Vector', n, 'Vector')
    r = rampe(nt, (-700, 0), [(0.35, RINDE), (0.65, RINDE2)]); link(nt, n, 'Fac', r, 'Fac')
    bump = neu(nt, 'ShaderNodeBump', (0, -400)); bump.inputs['Strength'].default_value = 0.6; bump.inputs['Distance'].default_value = 0.05; link(nt, n, 'Fac', bump, 'Height'); link(nt, bump, 'Normal', b, 'Normal')
    moosmischung(nt, b, r, 'Color', (-100, 350), staerke=0.9, hoehe=3.0)
    return m

def mat_laub(name='Laub', farbe=LAUB, hell=LAUB_HELL, durchlass=0.55, loecher=0.42):
    """Laub: diffus plus durchscheinend — im Gegenlicht leuchtet die Krone, das ist der halbe Look.
    Rauschen schneidet Loecher in die Klumpen, damit die Silhouette nach Blattwerk aussieht und nicht nach Kugel."""
    m, nt, out = material(name)
    tex = neu(nt, 'ShaderNodeTexCoord', (-1200, 0))
    n = neu(nt, 'ShaderNodeTexNoise', (-1000, 0)); n.inputs['Scale'].default_value = 2.5; n.inputs['Detail'].default_value = 6; link(nt, tex, 'Object', n, 'Vector')
    r = rampe(nt, (-700, 0), [(0.3, farbe), (0.75, hell)]); link(nt, n, 'Fac', r, 'Fac')
    d = neu(nt, 'ShaderNodeBsdfDiffuse', (-200, 100)); d.inputs['Roughness'].default_value = 0.8; link(nt, r, 'Color', d, 'Color')
    t = neu(nt, 'ShaderNodeBsdfTranslucent', (-200, -100)); link(nt, r, 'Color', t, 'Color')
    mix = neu(nt, 'ShaderNodeMixShader', (100, 0)); mix.inputs['Fac'].default_value = durchlass
    link(nt, d, 'BSDF', mix, 1); link(nt, t, 'BSDF', mix, 2)
    if loecher > 0:
        n2 = neu(nt, 'ShaderNodeTexNoise', (-1000, -400)); n2.inputs['Scale'].default_value = 9.0; n2.inputs['Detail'].default_value = 5; n2.inputs['Roughness'].default_value = 0.8; link(nt, tex, 'Object', n2, 'Vector')
        schwelle = neu(nt, 'ShaderNodeMath', (-700, -400), operation='GREATER_THAN'); schwelle.inputs[1].default_value = loecher; link(nt, n2, 'Fac', schwelle, 0)
        tr = neu(nt, 'ShaderNodeBsdfTransparent', (100, -300))
        mix2 = neu(nt, 'ShaderNodeMixShader', (350, 0)); link(nt, schwelle, 'Value', mix2, 'Fac'); link(nt, tr, 'BSDF', mix2, 1); link(nt, mix, 'Shader', mix2, 2)
        link(nt, mix2, 'Shader', out, 'Surface')
    else:
        link(nt, mix, 'Shader', out, 'Surface')
    return m

def mat_wasser():
    m, nt, out = material('Wasser'); b = prinzip(nt, (0.55, 0.62, 0.55), 0.03); link(nt, b, 'BSDF', out, 'Surface')
    b.inputs['Transmission Weight'].default_value = 1.0; b.inputs['IOR'].default_value = 1.333
    tex = neu(nt, 'ShaderNodeTexCoord', (-1000, 0))
    n = neu(nt, 'ShaderNodeTexNoise', (-700, -300)); n.inputs['Scale'].default_value = 5; n.inputs['Detail'].default_value = 4; link(nt, tex, 'Object', n, 'Vector')
    bump = neu(nt, 'ShaderNodeBump', (-300, -300)); bump.inputs['Strength'].default_value = 0.08; bump.inputs['Distance'].default_value = 0.05
    link(nt, n, 'Fac', bump, 'Height'); link(nt, bump, 'Normal', b, 'Normal')
    vol = neu(nt, 'ShaderNodeVolumeAbsorption', (300, -300)); vol.inputs['Color'].default_value = (0.35, 0.5, 0.4, 1); vol.inputs['Density'].default_value = 0.6
    link(nt, vol, 'Volume', out, 'Volume')
    return m

# ----------------------------------------------------------------- Gelaende
GELAENDE = {'obj': None}

def bodenhoehe(x, y):
    """Geländehöhe per Strahl von oben — misst das gebaute Netz, nicht die Absicht."""
    o = GELAENDE['obj']
    dg = bpy.context.evaluated_depsgraph_get()
    hit, loc, nrm, idx, obj, mat = bpy.context.scene.ray_cast(dg, Vector((x, y, 500.0)), Vector((0, 0, -1)))
    if hit and obj is not None and obj.name.startswith('terrain'):
        return loc.z
    # Rueckfall: naechster Vertex
    best, bz = 1e9, 0.0
    for v in o.data.vertices:
        d = (v.co.x - x) ** 2 + (v.co.y - y) ** 2
        if d < best: best, bz = d, v.co.z
    return bz

def terrasse(obj, mx, my, r_innen, r_aussen, z):
    """Ebnet eine Scheibe im Gelaende auf Hoehe z, weich auslaufend bis r_aussen."""
    for v in obj.data.vertices:
        d = math.hypot(v.co.x - mx, v.co.y - my)
        if d < r_aussen:
            t = 0.0 if d < r_innen else (d - r_innen) / (r_aussen - r_innen)
            t = t * t * (3 - 2 * t)
            v.co.z = z * (1 - t) + v.co.z * t
    obj.data.update()

def glaette_bett(ter, nass_praefix='wasser', rand=2.0, runden=3):
    """Das Bachbett kommt aus dem Spiel als Treppe (1-m-Zellen, D151 W4). Hier: Vertices im und am Wasser
    ueber die Nachbarn glaetten — der Renderer soll das Bett zeigen, das die Engine noch bekommt."""
    was = next((o for o in bpy.context.scene.objects if o.name == nass_praefix), None)
    if was is None: return
    nass = set((round(v.co.x), round(v.co.y)) for v in was.data.vertices)
    me = ter.data; n = int(round(math.sqrt(len(me.vertices))))
    if n * n != len(me.vertices): return
    x0 = me.vertices[0].co.x; y0 = me.vertices[0].co.y; schritt = me.vertices[1].co.x - x0
    betroffen = []
    for idx, v in enumerate(me.vertices):
        rx, ry = round(v.co.x), round(v.co.y)
        if any((rx + dx, ry + dy) in nass for dx in (-2, -1, 0, 1, 2) for dy in (-2, -1, 0, 1, 2)):
            betroffen.append(idx)
    # Der Wasserspiegel selbst kommt als Treppe (je Zelle ein Pegel): erst ihn glaetten, sonst reflektiert
    # eine gestufte Glasflaeche den Himmel wie Betonstufen (gemessen s3/s4).
    wme = was.data; wi = {(round(v.co.x), round(v.co.y)): v.index for v in wme.vertices}
    for _ in range(10):
        neu_w = {}
        for (wx, wy), idx in wi.items():
            s = 0.0; k = 0
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    j = wi.get((wx + dx, wy + dy))
                    if j is not None: s += wme.vertices[j].co.z; k += 1
            neu_w[idx] = s / k
        for idx, z in neu_w.items(): wme.vertices[idx].co.z = z
    wme.update()
    nassz = {(round(v.co.x), round(v.co.y)): v.co.z for v in was.data.vertices}
    for _ in range(runden):
        neuz = {}
        for idx in betroffen:
            i, j = divmod(idx, n); s = 0.0; k = 0
            for di in (-1, 0, 1):
                for dj in (-1, 0, 1):
                    ii, jj = i + di, j + dj
                    if 0 <= ii < n and 0 <= jj < n: s += me.vertices[ii * n + jj].co.z; k += 1
            neuz[idx] = s / k
        for idx, z in neuz.items(): me.vertices[idx].co.z = z
    # Das Bett bleibt unter dem Wasserspiegel: Glaetten mittelt mit dem Ufer und hob es sonst darueber
    # (gemessen: kein Wasser im Bild, nur trockene Stufen)
    for idx in betroffen:
        v = me.vertices[idx]; wz = nassz.get((round(v.co.x), round(v.co.y)))
        if wz is not None and v.co.z > wz - 0.15: v.co.z = wz - 0.4
    me.update()
    print('Bett geglaettet:', len(betroffen), 'Vertices')

def loch_im_fernen(fern, halb):
    bm = bmesh.new(); bm.from_mesh(fern.data)
    weg = [f for f in bm.faces if abs(f.calc_center_median().x) < halb and abs(f.calc_center_median().y) < halb]
    bmesh.ops.delete(bm, geom=weg, context='FACES')
    bm.to_mesh(fern.data); bm.free()

def setze(obj, mat):
    obj.data.materials.clear(); obj.data.materials.append(mat)

# ----------------------------------------------------------------- Bauten
def kasten(name, groesse, ort, seg=0.5):
    bm = bmesh.new()
    sx, sy, sz = groesse
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co = Vector((v.co.x * sx, v.co.y * sy, (v.co.z + 0.5) * sz))
    # Unterteilen fuer Bruchkante und Displace
    kanten = [e for e in bm.edges]
    bmesh.ops.subdivide_edges(bm, edges=kanten, cuts=max(1, int(max(sx, sy, sz) / seg)), use_grid_fill=True)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o); o.location = ort
    return o

def bruchkante(obj, hoehe_min, hoehe_max, saat=1, schutz=None):
    """Oberkante unregelmaessig abtragen: jede Spalte der Mauer bekommt ihre eigene Hoehe.
    `schutz` = (achse, mitte, halbbreite, mindesthoehe): ueber einem Bogen bleibt die Mauer stehen."""
    rnd = random.Random(saat); off = Vector((saat * 13.1, saat * 7.7, 0))
    for v in obj.data.vertices:
        if v.co.z > 0.05:
            p = Vector((v.co.x, v.co.y, 0))
            f = 0.5 + 0.5 * noise.noise(p * 0.18 + off)          # lange Welle: wo die Mauer noch steht
            f += 0.07 * noise.noise(p * 0.9 + off)                # Bruchsteine an der Kante
            f = max(0.0, min(1.0, f))
            h = hoehe_min + (hoehe_max - hoehe_min) * f
            if schutz is not None:
                achse, mitte, halb, minh = schutz
                d = abs((v.co.x if achse == 'x' else v.co.y) - mitte)
                if d < halb + 1.5: h = max(h, minh - max(0.0, d - halb) / 1.5 * (minh - hoehe_min))
            v.co.z = min(v.co.z, h) + (rnd.random() - 0.5) * 0.10 * (v.co.z / max(0.1, h))
    obj.data.update()

def bogen(name, breite, hoehe, tiefe, ort, rot_z=0.0):
    """Tueroeffnung als zwei geschlossene Koerper (Kasten + liegender Zylinder) — der exakte Boolean
    will Volumen ohne offene Kanten; ein handgebautes Profil hat ihn zweimal die ganze Mauer gekostet."""
    r = breite / 2
    werkzeuge = []
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0)); k = bpy.context.active_object; k.name = name + '_Kasten'
    k.scale = (breite, tiefe, hoehe - r + 0.3); k.location = Vector(ort) + Vector((0, 0, (hoehe - r - 0.3) / 2))
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=r, depth=tiefe, location=(0, 0, 0), rotation=(math.pi / 2, 0, 0)); z = bpy.context.active_object; z.name = name + '_Rund'
    z.location = Vector(ort) + Vector((0, 0, hoehe - r))
    for o in (k, z):
        o.rotation_euler = (o.rotation_euler[0], o.rotation_euler[1], o.rotation_euler[2] + rot_z)
        # um den Oeffnungsmittelpunkt drehen, nicht um die Objektachse
        d = o.location - Vector(ort); c, sn = math.cos(rot_z), math.sin(rot_z)
        o.location = Vector(ort) + Vector((d.x * c - d.y * sn, d.x * sn + d.y * c, d.z))
        werkzeuge.append(o)
    return werkzeuge

def abziehen(obj, werkzeuge):
    if not isinstance(werkzeuge, (list, tuple)): werkzeuge = [werkzeuge]
    for w in werkzeuge:
        vorher = len(obj.data.polygons); sicher = obj.data.copy()
        m = obj.modifiers.new('Bogen', 'BOOLEAN'); m.operation = 'DIFFERENCE'; m.object = w; m.solver = 'EXACT'
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=m.name)
        if len(obj.data.polygons) == 0:
            print('WARNUNG: Boolean hat', obj.name, 'geleert — Oeffnung weggelassen'); obj.data = sicher
        else:
            print(obj.name, 'Boolean', vorher, '->', len(obj.data.polygons), 'Flaechen')
        bpy.data.objects.remove(w)

def verwittern(obj, staerke=0.04, skala=0.6):
    tex = bpy.data.textures.new(obj.name + '_vw', 'CLOUDS'); tex.noise_scale = skala; tex.noise_depth = 4
    d = obj.modifiers.new('Verwitterung', 'DISPLACE'); d.texture = tex; d.strength = staerke; d.mid_level = 0.5; d.texture_coords = 'GLOBAL'
    b = obj.modifiers.new('Kante', 'BEVEL'); b.width = 0.03; b.segments = 2; b.limit_method = 'ANGLE'
    for p in obj.data.polygons: p.use_smooth = False

def block(name, ort, groesse, saat, rauheit=0.22, unterteilung=3):
    """Felsblock: Kugel, verzerrt, mit Rauschen entlang der Normalen — jeder anders."""
    rnd = random.Random(saat)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=unterteilung, radius=1.0)
    off = Vector((rnd.random() * 50, rnd.random() * 50, rnd.random() * 50))
    for v in bm.verts:
        n = noise.noise(v.co * 1.6 + off) * rauheit + noise.noise(v.co * 5.0 + off) * rauheit * 0.35
        v.co = v.co * (1.0 + n)
        v.co = Vector((v.co.x * groesse[0], v.co.y * groesse[1], v.co.z * groesse[2]))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    o.location = ort; o.rotation_euler = (rnd.random() * 0.4, rnd.random() * 0.4, rnd.random() * 6.28)
    return o

def geroell(mx, my, r, n, mat, saat=3):
    rnd = random.Random(saat)
    for i in range(n):
        a = rnd.random() * 6.283; d = r * (0.3 + 0.7 * rnd.random())
        x, y = mx + math.cos(a) * d, my + math.sin(a) * d
        s = 0.15 + rnd.random() * 0.45
        o = block('Geroell%d' % i, (x, y, bodenhoehe(x, y) + s * 0.35), (s, s * (0.7 + rnd.random() * 0.5), s * (0.5 + rnd.random() * 0.4)), saat * 100 + i, 0.3, 2)
        setze(o, mat)

def pflaster(name, ort, groesse, mat):
    o = kasten(name, (groesse[0], groesse[1], 0.25), (ort[0], ort[1], ort[2] - 0.2), 0.5)
    setze(o, mat); verwittern(o, 0.12, 0.7)
    return o

def becken(ort, aussen, innen, tiefe, mat_stein, mat_wasser):
    """Rechteckiges Becken: Rand aus Stein, innen Wasser."""
    rand = kasten('BeckenRand', (aussen[0], aussen[1], 0.5), (ort[0], ort[1], ort[2] - 0.05), 0.5)
    loch = kasten('BeckenLoch', (innen[0], innen[1], 3.0), (ort[0], ort[1], ort[2] - tiefe), 3.0)
    abziehen(rand, loch)
    setze(rand, mat_stein); verwittern(rand, 0.03, 0.5)
    boden = kasten('BeckenBoden', (innen[0] + 0.2, innen[1] + 0.2, 0.2), (ort[0], ort[1], ort[2] - tiefe - 0.2), 1.0); setze(boden, mat_stein)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(ort[0], ort[1], ort[2] + 0.5 - 0.18))
    w = bpy.context.active_object; w.name = 'BeckenWasser'; w.scale = (innen[0] - 0.05, innen[1] - 0.05, 1); setze(w, mat_wasser)
    return rand

def wurzel(name, start, richtung, laenge, mat, saat=1, radius=0.28):
    """Wurzel als Kurve: kriecht ueber den Boden, wird duenner, teilt sich einmal."""
    rnd = random.Random(saat)
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 1.0; cu.bevel_resolution = 5; cu.fill_mode = 'FULL'; cu.use_fill_caps = True
    def strang(p, d, l, r0, n=9):
        sp = cu.splines.new('NURBS'); sp.points.add(n - 1); sp.use_endpoint_u = True; sp.order_u = 3
        x, y = p
        for i in range(n):
            t = i / (n - 1)
            z = bodenhoehe(x, y) + r0 * (1 - t) * 0.9 + 0.06 + 0.25 * math.sin(t * 6.0 + rnd.random()) * (1 - t)
            sp.points[i].co = (x, y, z, 1.0)
            sp.points[i].radius = r0 * (1.0 - 0.85 * t) + 0.02
            d = (d + (rnd.random() - 0.5) * 0.9) % 6.283
            x += math.cos(d) * l / n; y += math.sin(d) * l / n
    strang(start, richtung, laenge, radius)
    strang(start, richtung + 0.9 + rnd.random() * 0.6, laenge * 0.6, radius * 0.7, 7)
    o = bpy.data.objects.new(name, cu); bpy.context.collection.objects.link(o); o.data.materials.append(mat)
    return o

def laubbaum(name, x, y, hoehe, mat_rinde, mat_laub, saat, detail=2, kronen=6):
    """Hoher schlanker Stamm, Krone erst im oberen Drittel — die Silhouette der Referenzbilder."""
    rnd = random.Random(saat)
    z0 = bodenhoehe(x, y)
    cu = bpy.data.curves.new(name + '_Stamm', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 1.0; cu.bevel_resolution = 6; cu.fill_mode = 'FULL'
    n = 8; sp = cu.splines.new('NURBS'); sp.points.add(n - 1); sp.use_endpoint_u = True; sp.order_u = 3
    lean = Vector((rnd.random() - 0.5, rnd.random() - 0.5, 0)) * 0.08
    r0 = 0.10 + hoehe * 0.006
    spitze = None
    for i in range(n):
        t = i / (n - 1)
        p = Vector((x, y, z0 - 0.3)) + lean * (t * hoehe) + Vector((math.sin(t * 5 + saat) * 0.35 * t, math.cos(t * 4 + saat) * 0.35 * t, t * hoehe))
        sp.points[i].co = (p.x, p.y, p.z, 1.0); sp.points[i].radius = r0 * (1.0 - 0.8 * t) + 0.04
        spitze = p
    o = bpy.data.objects.new(name + '_Stamm', cu); bpy.context.collection.objects.link(o); o.data.materials.append(mat_rinde)
    aeste = []
    for k in range(7 + rnd.randrange(6)):
        t = 0.5 + rnd.random() * 0.45
        basis = Vector((x, y, z0)) + lean * (t * hoehe) + Vector((math.sin(t * 5 + saat) * 0.35 * t, math.cos(t * 4 + saat) * 0.35 * t, t * hoehe))
        a = rnd.random() * 6.283; l = 2.0 + rnd.random() * 3.5 * (1.2 - t)
        ende = basis + Vector((math.cos(a) * l, math.sin(a) * l, l * (0.35 + rnd.random() * 0.5)))
        ac = bpy.data.curves.new(name + '_Ast%d' % k, 'CURVE'); ac.dimensions = '3D'; ac.bevel_depth = 1.0; ac.bevel_resolution = 3; ac.fill_mode = 'FULL'
        s2 = ac.splines.new('NURBS'); s2.points.add(2); s2.use_endpoint_u = True; s2.order_u = 3
        mitte = (basis + ende) / 2 + Vector((0, 0, -0.4))
        for i, p in enumerate((basis, mitte, ende)):
            s2.points[i].co = (p.x, p.y, p.z, 1.0); s2.points[i].radius = (0.09, 0.05, 0.02)[i] * (0.5 + hoehe / 30)
        ao = bpy.data.objects.new(ac.name, ac); bpy.context.collection.objects.link(ao); ao.data.materials.append(mat_rinde)
        aeste.append(ende)
    aeste.append(spitze)
    je = 5 if kronen > 4 else 2
    for k, e in enumerate(aeste):
        for j in range(je):
            s = (0.45 + rnd.random() * 0.7) * (0.7 + hoehe / 45)
            c = block(name + '_Krone%d_%d' % (k, j), (e.x + (rnd.random() - 0.5) * 2.6, e.y + (rnd.random() - 0.5) * 2.6, e.z - 0.3 + rnd.random() * 1.6), (s * 1.3, s, s * 0.45), saat * 31 + k * 7 + j, 0.7, detail)
            setze(c, mat_laub)

def nadelbaum(name, x, y, hoehe, mat_rinde, mat_nadel, saat):
    rnd = random.Random(saat)
    z0 = bodenhoehe(x, y)
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.12 + hoehe * 0.012, radius2=0.03, depth=hoehe, location=(x, y, z0 + hoehe / 2 - 0.3))
    st = bpy.context.active_object; st.name = name + '_Stamm'; setze(st, mat_rinde)
    stufen = 9 + int(hoehe / 4)
    for i in range(stufen):
        t = 0.3 + 0.7 * i / stufen
        r = ((1.0 - t) * (1.2 + hoehe * 0.07) + 0.35) * (0.8 + rnd.random() * 0.4)
        h = hoehe * 0.7 / stufen * 1.6
        bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=r, radius2=r * 0.25, depth=h, location=(x + (rnd.random() - 0.5) * 0.3, y + (rnd.random() - 0.5) * 0.3, z0 + hoehe * t))
        k = bpy.context.active_object; k.name = name + '_Kranz%d' % i; k.rotation_euler = (0, 0, rnd.random() * 6.28)
        setze(k, mat_nadel); verwittern(k, 0.6, 0.45)

def wald(ter, mat_rinde, mat_laub, mat_nadel, min_r, max_r, abstand, saat=11, ausschluss=()):
    """Baeume auf Waldzellen (Vertexfarbe G < 0.45, R < 0.3): zufaellig, Mindestabstand, hier ohne Terrasse."""
    rnd = random.Random(saat)
    farbe = ter.data.color_attributes.get('Color') if ter.data.color_attributes else None
    kand = []
    for v in ter.data.vertices:
        d = math.hypot(v.co.x, v.co.y)
        if d < min_r or d > max_r: continue
        if farbe is not None:
            c = farbe.data[v.index].color
            if c[1] > 0.45 or c[0] > 0.3: continue   # Wiese (G hoch) oder Fels (R hoch)
        if any(math.hypot(v.co.x - ax, v.co.y - ay) < ar for ax, ay, ar in ausschluss): continue
        kand.append((v.co.x, v.co.y))
    rnd.shuffle(kand)
    gesetzt = []
    for (x, y) in kand:
        if any((x - gx) ** 2 + (y - gy) ** 2 < abstand ** 2 for gx, gy in gesetzt): continue
        gesetzt.append((x, y))
        d = math.hypot(x, y)
        fein = d < 45
        if rnd.random() < 0.55:
            laubbaum2('Wald%d' % len(gesetzt), x, y, 18 + rnd.random() * 14, mat_rinde, mat_laub, saat * 7 + len(gesetzt), fein)
        else:
            fichte('Wald%d' % len(gesetzt), x, y, 16 + rnd.random() * 14, mat_rinde, mat_nadel, saat * 7 + len(gesetzt), fein)
        if len(gesetzt) > (180 if not SCHNELL else 60): break
    return gesetzt


# ----------------------------------------------------------------- Steinbau (D154)
# Ein Kasten hat gerade Kanten, egal welche Textur er traegt. Deshalb werden Mauer, Hof und
# Becken aus **einzelnen Steinen** gesetzt: jeder Stein ein verzerrter Wuerfel, Reihen versetzt,
# Laengen zufaellig, oben und an den Enden fehlen Steine — die Kante ist dann keine Linie mehr.
# Alle Steine eines Bauwerks landen in einem Mesh (bmesh), nicht in tausend Objekten.

def stein_bm(ziel, groesse, matrix, saat, rauheit=0.06, rund=0.35):
    """Haengt einen Stein (verzerrter Wuerfel, Ecken eingezogen) mit Transformation an `ziel`."""
    rnd = random.Random(saat)
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=2, use_grid_fill=True)
    off = Vector((rnd.random() * 60, rnd.random() * 60, rnd.random() * 60))
    for v in bm.verts:
        p = v.co.copy()
        # Ecken einziehen: je weiter von der Achse, desto staerker — macht aus dem Wuerfel einen Kiesel
        ecke = (abs(p.x) + abs(p.y) + abs(p.z)) / 1.5
        f = 1.0 - rund * max(0.0, ecke - 0.6)
        n = noise.noise(p * 2.7 + off) * rauheit + noise.noise(p * 7.0 + off) * rauheit * 0.4
        v.co = Vector((p.x * groesse[0], p.y * groesse[1], p.z * groesse[2])) * (f + n)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.transform(bm, matrix=matrix, verts=bm.verts[:])
    me = bpy.data.meshes.new('stein'); bm.to_mesh(me); bm.free()
    ziel.from_mesh(me); bpy.data.meshes.remove(me)

def fertig(name, bm, ort, mat, glatt=False, rot=(0.0, 0.0, 0.0)):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = glatt
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o); o.location = ort; o.rotation_euler = rot
    setze(o, mat)
    return o

def hoehenprofil(u, hmin, hmax, saat, schutz=None):
    """Wie hoch die Mauer an Stelle u noch steht: lange Welle plus Bruchsteine, ueber dem Bogen geschuetzt."""
    off = Vector((saat * 13.1, saat * 7.7, 0))
    f = 0.5 + 0.5 * noise.noise(Vector((u, 0, 0)) * 0.18 + off) + 0.07 * noise.noise(Vector((u, 0, 0)) * 0.9 + off)
    h = hmin + (hmax - hmin) * max(0.0, min(1.0, f))
    if schutz is not None:
        mitte, halb, minh = schutz
        d = abs(u - mitte)
        if d < halb + 1.5: h = max(h, minh - max(0.0, d - halb) / 1.5 * (minh - hmin))
    return h

def im_bogen(u, z, oeffnung, rand=0.0):
    """Liegt (u, z) in der Oeffnung? oeffnung = (u0, breite, hoehe)."""
    if oeffnung is None: return False
    u0, b, h = oeffnung; r = b / 2 + rand
    if abs(u - u0) > r: return False
    zs = h - b / 2
    return z < zs + rand or (u - u0) ** 2 + (z - zs) ** 2 < r * r

def mauer(name, ort, laenge, hoehe, dicke, achse, saat, mat, mat_kern, hmin, oeffnung=None, schutz=None, lehne=0.0):
    """Trockenmauer aus Steinen. `achse` 'x' oder 'y' (Laufrichtung). Oeffnung (u0, breite, hoehe) mit Keilsteinbogen.
    Dahinter ein dunkler Kern, damit Luecken nicht durchsichtig sind."""
    rnd = random.Random(saat)
    bm = bmesh.new()
    dreh = Matrix.Rotation(math.pi / 2, 4, 'Z') if achse == 'y' else Matrix.Identity(4)
    z = 0.0; reihe = 0; anzahl = 0
    while z < hoehe:
        rh = 0.24 + rnd.random() * 0.16
        u = -laenge / 2 + (rnd.random() * 0.35 if reihe % 2 else rnd.random() * 0.1)
        while u < laenge / 2 - 0.15:
            sl = min(0.35 + rnd.random() * 0.55, laenge / 2 - u)
            uc, zc = u + sl / 2, z + rh / 2
            hmax = hoehenprofil(uc, hmin, hoehe, saat, schutz)
            halten = zc < hmax
            if halten and hmax - zc < 0.7 and rnd.random() < 0.4: halten = False       # ausgefranste Oberkante
            ende = laenge / 2 - abs(uc)
            if halten and ende < 0.7 and rnd.random() < 0.25 + 0.5 * zc / hoehe: halten = False   # ausgefranste Enden
            if halten and oeffnung is not None:
                for du, dz in ((-sl / 2, -rh / 2), (sl / 2, -rh / 2), (-sl / 2, rh / 2), (sl / 2, rh / 2)):
                    if im_bogen(uc + du, zc + dz, oeffnung, 0.34): halten = False
            if halten:
                tiefe = dicke * (1.0 + rnd.random() * 0.22)   # nie duenner als der Kern, sonst verschwindet der Stein darin
                kipp = Euler((rnd.uniform(-0.04, 0.04), rnd.uniform(-0.04, 0.04), rnd.uniform(-0.03, 0.03))).to_matrix().to_4x4()
                m = dreh @ Matrix.Translation(Vector((uc, (rnd.random() - 0.5) * 0.08, zc))) @ kipp
                stein_bm(bm, (sl * 0.95, tiefe, rh * 0.93), m, saat * 100000 + reihe * 1000 + int((uc + 50) * 10), 0.06)
                anzahl += 1
            u += sl + 0.02 + rnd.random() * 0.03
        z += rh + 0.025; reihe += 1
    # Keilsteinbogen und Gewaende
    if oeffnung is not None:
        u0, b, h = oeffnung; R = b / 2 + 0.18; zs = h - b / 2
        n = max(9, int(math.pi * R / 0.32))
        for i in range(n + 1):
            a = math.pi * i / n
            m = dreh @ Matrix.Translation(Vector((u0 + R * math.cos(a), 0, zs + R * math.sin(a)))) @ Matrix.Rotation(a - math.pi / 2, 4, 'Y')
            stein_bm(bm, (0.30, dicke * 1.02, 0.36), m, saat * 7 + i, 0.05, 0.25)
        zz = 0.15
        while zz < zs - 0.1:
            for s in (-1, 1):
                m = dreh @ Matrix.Translation(Vector((u0 + s * R, 0, zz)))
                stein_bm(bm, (0.36, dicke * 1.02, 0.30), m, saat * 11 + int(zz * 10) + s, 0.05, 0.25)
            zz += 0.32
    print(name, anzahl, 'Steine')
    o = fertig(name, bm, ort, mat, False, (lehne if achse == 'x' else 0.0, lehne if achse == 'y' else 0.0, 0.0))
    # Kern: dunkel, etwas schmaler, mit derselben Bruchkante — fuellt die Luecken zwischen den Steinen
    kern = kasten(name + '_Kern', (dicke - 0.28, laenge - 0.3, hoehe) if achse == 'y' else (laenge - 0.3, dicke - 0.28, hoehe), (ort[0], ort[1], ort[2] + 0.02), 0.5)
    if oeffnung is not None:
        u0, b, h = oeffnung
        wo = Vector(ort) + (Vector((0, u0, 0)) if achse == 'y' else Vector((u0, 0, 0)))
        abziehen(kern, bogen(name + '_Tor', b + 0.36, h + 0.18, dicke + 1.0, wo, math.radians(90) if achse == 'y' else 0.0))
    # Der Kern folgt demselben Hoehenprofil wie die Steine, nur 0,35 m tiefer — sonst schaut er oben heraus
    # (erster Lauf: die Bruchkante des Kastens nahm das Rauschen auf der anderen Achse, der Kern stand als Buckel ueber den Steinen).
    for v in kern.data.vertices:
        if v.co.z > 0.05:
            u = v.co.y if achse == 'y' else v.co.x
            v.co.z = min(v.co.z, hoehenprofil(u, hmin, hoehe, saat, schutz) - 0.35)
    kern.data.update()
    setze(kern, mat_kern); kern.rotation_euler = o.rotation_euler
    return o

def plattenhof(name, ort, groesse, mat, saat, loch=None):
    """Hof aus einzelnen Platten: verkippt, versunken, am Rand fehlen sie. `loch` = (x, y, halbx, halby) freilassen."""
    rnd = random.Random(saat); bm = bmesh.new(); n = 0
    y = -groesse[1] / 2
    while y < groesse[1] / 2:
        sy = 0.6 + rnd.random() * 0.5
        x = -groesse[0] / 2 + rnd.random() * 0.4
        while x < groesse[0] / 2:
            sx = 0.6 + rnd.random() * 0.6
            xc, yc = x + sx / 2, y + sy / 2
            rand = min(groesse[0] / 2 - abs(xc), groesse[1] / 2 - abs(yc))
            p = 0.06 + (0.75 * max(0.0, 1.0 - rand / 1.6))
            if loch is not None and abs(xc - loch[0]) < loch[2] and abs(yc - loch[1]) < loch[3]: p = 1.0
            if rnd.random() > p:
                kipp = Euler((rnd.uniform(-0.05, 0.05), rnd.uniform(-0.05, 0.05), rnd.uniform(-0.08, 0.08))).to_matrix().to_4x4()
                m = Matrix.Translation(Vector((xc, yc, -0.06 + rnd.uniform(-0.05, 0.02)))) @ kipp
                stein_bm(bm, (sx * 0.93, sy * 0.93, 0.14), m, saat * 1000 + n, 0.05, 0.3); n += 1
            x += sx + 0.04
        y += sy + 0.04
    print(name, n, 'Platten')
    return fertig(name, bm, ort, mat)

def steinbecken(name, ort, aussen, tiefe, mat, mat_wasser, saat):
    """Becken: Rand aus zwei Reihen Steinen, Sohle, Wasser."""
    rnd = random.Random(saat); bm = bmesh.new(); k = 0
    ax, ay = aussen
    for reihe, z in enumerate((0.15, 0.42)):
        for seite in range(4):
            L = ax if seite % 2 == 0 else ay
            u = -L / 2 + (0.2 if reihe else 0.0)
            while u < L / 2 - 0.1:
                sl = min(0.35 + rnd.random() * 0.3, L / 2 - u)
                if seite == 0: pos, rot = Vector((u + sl / 2, -ay / 2 + 0.17, z)), 0.0
                elif seite == 2: pos, rot = Vector((u + sl / 2, ay / 2 - 0.17, z)), 0.0
                elif seite == 1: pos, rot = Vector((ax / 2 - 0.17, u + sl / 2, z)), math.pi / 2
                else: pos, rot = Vector((-ax / 2 + 0.17, u + sl / 2, z)), math.pi / 2
                if not (reihe == 1 and rnd.random() < 0.18):   # oben fehlt hier und da ein Stein
                    m = Matrix.Translation(pos) @ Matrix.Rotation(rot, 4, 'Z') @ Euler((rnd.uniform(-0.03, 0.03), rnd.uniform(-0.03, 0.03), rnd.uniform(-0.04, 0.04))).to_matrix().to_4x4()
                    stein_bm(bm, (sl * 0.94, 0.34, 0.27), m, saat * 100 + k, 0.05); k += 1
                u += sl + 0.03
    rand = fertig(name, bm, ort, mat)
    sohle = kasten(name + '_Sohle', (ax - 0.5, ay - 0.5, 0.2), (ort[0], ort[1], ort[2] - tiefe - 0.2), 1.0); setze(sohle, mat)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(ort[0], ort[1], ort[2] + 0.30))
    w = bpy.context.active_object; w.name = name + '_Wasser'; w.scale = (ax - 0.6, ay - 0.6, 1); setze(w, mat_wasser)
    return rand

def erdwulst(ter, linien, breite=1.6, hoehe=0.35):
    """Boden schmiegt sich an den Mauerfuss: Vertices nahe der Mauerlinie anheben."""
    for v in ter.data.vertices:
        p = Vector((v.co.x, v.co.y))
        best = 1e9
        for a, b in linien:
            a, b = Vector(a), Vector(b); ab = b - a; t = max(0.0, min(1.0, (p - a).dot(ab) / max(1e-6, ab.length_squared)))
            best = min(best, (p - (a + ab * t)).length)
        if best < breite:
            t = 1.0 - best / breite
            v.co.z += hoehe * t * t + 0.04 * noise.noise(Vector((v.co.x * 2.1, v.co.y * 2.1, 0)))
    ter.data.update()

def bodenrauschen(ter, mx, my, r, staerke=0.08):
    for v in ter.data.vertices:
        d = math.hypot(v.co.x - mx, v.co.y - my)
        if d < r:
            v.co.z += staerke * noise.noise(Vector((v.co.x * 0.7, v.co.y * 0.7, 3.3))) * (1.0 - d / r)
    ter.data.update()

# ----------------------------------------------------------------- Vegetation (D154)
def klumpen_bm(ziel, ort, groesse, saat, rauheit=0.5, unterteilung=1, rot=None):
    """Blattmasse: verzerrte Ikosphaere, transformiert, an `ziel` gehaengt."""
    rnd = random.Random(saat)
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=unterteilung, radius=1.0)
    off = Vector((rnd.random() * 50, rnd.random() * 50, rnd.random() * 50))
    for v in bm.verts:
        n = noise.noise(v.co * 1.8 + off) * rauheit + noise.noise(v.co * 5.0 + off) * rauheit * 0.4
        v.co = Vector((v.co.x * groesse[0], v.co.y * groesse[1], v.co.z * groesse[2])) * (1.0 + n)
    m = Matrix.Translation(Vector(ort)) @ (rot if rot is not None else Euler((rnd.random() * 0.5, rnd.random() * 0.5, rnd.random() * 6.28)).to_matrix().to_4x4())
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts[:])
    me = bpy.data.meshes.new('klumpen'); bm.to_mesh(me); bm.free(); ziel.from_mesh(me); bpy.data.meshes.remove(me)

STAMM_RES = 12          # Kurvenaufloesung je Abschnitt; der Baumbau setzt 3 (Props)
STAMM_BEVEL_MAX = 6     # Bevel-Aufloesung (Umfangssegmente = 4 + 2·n); der Baumbau setzt 2

def stamm(name, punkte, radien, mat, aufloesung=6):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 1.0; cu.bevel_resolution = min(aufloesung, STAMM_BEVEL_MAX); cu.fill_mode = 'FULL'; cu.use_fill_caps = True
    cu.resolution_u = STAMM_RES
    sp = cu.splines.new('NURBS'); sp.points.add(len(punkte) - 1); sp.use_endpoint_u = True; sp.order_u = 3
    for i, (p, r) in enumerate(zip(punkte, radien)):
        sp.points[i].co = (p.x, p.y, p.z, 1.0); sp.points[i].radius = r
    o = bpy.data.objects.new(name, cu); bpy.context.collection.objects.link(o); o.data.materials.append(mat)
    return o

def laubbaum2(name, x, y, hoehe, mat_rinde, mat_laub, saat, fein=True, aeste=None, je=None, groesse=1.0):
    """Hoher schlanker Laubbaum: gebogener Stamm mit Wurzelanlauf, Aeste erst oben, Krone aus vielen kleinen Blattmassen."""
    rnd = random.Random(saat)
    z0 = bodenhoehe(x, y)
    lean = Vector((rnd.random() - 0.5, rnd.random() - 0.5, 0)) * 0.10
    r0 = 0.11 + hoehe * 0.007
    n = 12; pts = []; rad = []
    for i in range(n):
        t = i / (n - 1)
        wob = Vector((math.sin(t * 6.0 + saat) * 0.5, math.cos(t * 5.0 + saat * 0.7) * 0.5, 0)) * t
        pts.append(Vector((x, y, z0 - 0.4)) + lean * (t * hoehe) + wob + Vector((0, 0, t * hoehe)))
        rad.append(r0 * (1.0 - 0.82 * t) + 0.035)
    stamm(name + '_Stamm', pts, rad, mat_rinde)
    # Wurzelanlauf: kurze Strahlen am Fuss
    for k in range(4 + rnd.randrange(3)):
        a = rnd.random() * 6.283; l = 0.8 + rnd.random() * 1.2
        p0 = Vector((x, y, z0 + 0.35)); p1 = p0 + Vector((math.cos(a) * l * 0.5, math.sin(a) * l * 0.5, -0.25)); p2 = p0 + Vector((math.cos(a) * l, math.sin(a) * l, -0.45))
        stamm(name + '_Anlauf%d' % k, [p0, p1, p2], [r0 * 0.9, r0 * 0.5, 0.05], mat_rinde, 3)
    krone = bmesh.new(); enden = []
    for k in range(aeste if aeste is not None else 9 + rnd.randrange(7)):
        t = 0.48 + rnd.random() * 0.48
        i = t * (n - 1); i0 = int(i); basis = pts[min(n - 1, i0)].lerp(pts[min(n - 1, i0 + 1)], i - i0)
        a = rnd.random() * 6.283; l = (1.5 + rnd.random() * 3.5) * (1.3 - t) + 0.8
        mitte = basis + Vector((math.cos(a) * l * 0.5, math.sin(a) * l * 0.5, l * 0.15))
        ende = basis + Vector((math.cos(a) * l, math.sin(a) * l, l * (0.25 + rnd.random() * 0.45)))
        stamm(name + '_Ast%d' % k, [basis, mitte, ende], [rad[i0] * 0.55, rad[i0] * 0.3, 0.02], mat_rinde, 3)
        enden.append((ende, l))
    enden.append((pts[-1], 2.0))
    # Krone: je Astende mehrere Blattmassen. Mit 6 flachen Scheiben je Ast (s6) las sich der Wald als
    # Lutscher mit Loechern — dichter und etwas hoeher wird daraus eine geschlossene, dunkle Kronenmasse.
    for k, (e, l) in enumerate(enden):
        for j in range(je if je is not None else (9 if fein else 4)):
            s = (0.45 + rnd.random() * 0.65) * (0.7 + hoehe / 50) * groesse
            klumpen_bm(krone, (e.x + (rnd.random() - 0.5) * (1.2 + l * 0.5), e.y + (rnd.random() - 0.5) * (1.2 + l * 0.5), e.z - 0.4 + rnd.random() * 1.4), (s * 1.4, s, s * 0.5), saat * 31 + k * 9 + j, 0.7, 2 if fein else 1)
    fertig(name + '_Krone', krone, (0, 0, 0), mat_laub, True)

def fichte(name, x, y, hoehe, mat_rinde, mat_nadel, saat, fein=True, quirle=None, je=None, groesse=1.0):
    """Fichte aus Astquirlen: je Quirl 5–7 Aeste, jeder Ast eine haengende Nadelmasse — keine Kegel."""
    rnd = random.Random(saat)
    z0 = bodenhoehe(x, y)
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.10 + hoehe * 0.011, radius2=0.02, depth=hoehe, location=(x, y, z0 + hoehe / 2 - 0.3))
    st = bpy.context.active_object; st.name = name + '_Stamm'; setze(st, mat_rinde)
    nadeln = bmesh.new(); k = 0
    quirle = quirle if quirle is not None else 9 + int(hoehe / 3.5)
    for i in range(quirle):
        t = 0.22 + 0.76 * i / (quirle - 1)
        L = ((1.0 - t) * (1.1 + hoehe * 0.055) + 0.35) * (0.85 + rnd.random() * 0.3)
        for j in range(je if je is not None else 5 + rnd.randrange(3)):
            a = rnd.random() * 6.283
            haeng = -0.08 - rnd.random() * 0.28
            Lj = L * (0.7 + rnd.random() * 0.6) * groesse
            for s in ((0.5, 0.95) if fein and Lj > 1.2 else (0.7,)):
                d = Lj * s
                pos = Vector((x + math.cos(a) * d, y + math.sin(a) * d, z0 + hoehe * t + haeng * d))
                rot = (Matrix.Rotation(a, 4, 'Z') @ Matrix.Rotation(-haeng, 4, 'Y'))
                klumpen_bm(nadeln, pos, (Lj * (0.30 if s < 0.9 else 0.24), 0.30 + Lj * 0.10, 0.10 + Lj * 0.05), saat * 53 + k, 0.55, 1, rot); k += 1
        if i == quirle - 1:
            klumpen_bm(nadeln, Vector((x, y, z0 + hoehe * 0.985)), (0.3, 0.3, 0.6), saat * 53 + k + 1, 0.4, 1, Matrix.Identity(4))
    fertig(name + '_Nadeln', nadeln, (0, 0, 0), mat_nadel, True)

def farn(name, x, y, mat, saat, groesse=1.0):
    """Farnhorst: 6–9 Wedel als flache, nach oben gekippte Blattmassen."""
    rnd = random.Random(saat); z0 = bodenhoehe(x, y); bm = bmesh.new()
    for j in range(6 + rnd.randrange(4)):
        a = rnd.random() * 6.283; l = (0.45 + rnd.random() * 0.35) * groesse; kipp = 0.45 + rnd.random() * 0.45
        pos = Vector((x + math.cos(a) * l * 0.55, y + math.sin(a) * l * 0.55, z0 + 0.05 + math.sin(kipp) * l * 0.5))
        rot = Matrix.Rotation(a, 4, 'Z') @ Matrix.Rotation(-kipp, 4, 'Y')
        klumpen_bm(bm, pos, (l * 0.55, l * 0.16, 0.025), saat * 17 + j, 0.35, 1, rot)
    fertig(name, bm, (0, 0, 0), mat, True)

def efeu(name, flecken, mat, saat):
    """Efeu an einer Mauerflaeche: `flecken` = Liste (Mitte Vector, Normale Vector, Radius). Kleine Blattmassen, dicht am Stein."""
    rnd = random.Random(saat); bm = bmesh.new(); k = 0
    for mitte, normale, r in flecken:
        n = normale.normalized(); u = n.cross(Vector((0, 0, 1))).normalized(); w = Vector((0, 0, 1))
        for j in range(int(r * r * 26)):
            a = rnd.random() * 6.283; d = r * math.sqrt(rnd.random())
            p = mitte + u * (math.cos(a) * d * 1.2) + w * (math.sin(a) * d) + n * (0.06 + rnd.random() * 0.08)
            rot = n.to_track_quat('Z', 'Y').to_matrix().to_4x4() @ Matrix.Rotation(rnd.random() * 6.28, 4, 'Z')
            s = 0.10 + rnd.random() * 0.12
            klumpen_bm(bm, p, (s * 1.5, s, s * 0.35), saat * 19 + k, 0.5, 1, rot); k += 1
        # Ranken nach unten
        for j in range(3):
            a = (rnd.random() - 0.5) * 1.2
            for t in range(6):
                p = mitte + u * (a * r + t * 0.05) + w * (-r * 0.6 - t * 0.28) + n * 0.07
                if p.z < mitte.z - r * 2.2: break
                klumpen_bm(bm, p, (0.12, 0.09, 0.03), saat * 23 + k, 0.4, 1, n.to_track_quat('Z', 'Y').to_matrix().to_4x4()); k += 1
    fertig(name, bm, (0, 0, 0), mat, True)

# ----------------------------------------------------------------- Gras, Dunst, Licht, Kamera
def grashalm(mat):
    bm = bmesh.new()
    for k, (dx, dy) in enumerate(((1, 0), (0.3, 0.95))):
        vs = []
        for i in range(5):
            t = i / 4; w = 0.02 * (1 - t * 0.85); bend = 0.12 * t * t
            vs.append((bm.verts.new((-w * dx - bend * dy * 0.3, -w * dy + bend * dx * 0.3, t * 0.45)), bm.verts.new((w * dx - bend * dy * 0.3, w * dy + bend * dx * 0.3, t * 0.45))))
        for i in range(4):
            bm.faces.new((vs[i][0], vs[i][1], vs[i + 1][1], vs[i + 1][0]))
    me = bpy.data.meshes.new('Halm'); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('Halm', me); bpy.context.collection.objects.link(o); o.location = (0, 0, -50); setze(o, mat)
    return o

def gras(ter, halm, ausschluss, dichte):
    """Grasbueschel per Geometry Nodes: Dichte aus der Vertexgruppe (Biom, Abstand, Hof ausgespart)."""
    vg = ter.vertex_groups.new(name='gras')
    farbe = ter.data.color_attributes.get('Color') if ter.data.color_attributes else None
    for v in ter.data.vertices:
        d = math.hypot(v.co.x + 4, v.co.y)
        w = max(0.0, 1.0 - max(0.0, d - 30) / 40)
        if farbe is not None:
            c = farbe.data[v.index].color
            if c[0] > 0.3 or c[2] > 0.6: w = 0.0   # Fels, Wasser
            elif c[1] < 0.45: w *= 0.6        # Waldboden: lichter
        for ax, ay, ar in ausschluss:
            if math.hypot(v.co.x - ax, v.co.y - ay) < ar: w = 0.0
        if w > 0: vg.add([v.index], w, 'REPLACE')
    ng = bpy.data.node_groups.new('GrasGN', 'GeometryNodeTree')
    ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    ein = ng.nodes.new('NodeGroupInput'); aus = ng.nodes.new('NodeGroupOutput')
    dist = ng.nodes.new('GeometryNodeDistributePointsOnFaces'); dist.distribute_method = 'RANDOM'
    attr = ng.nodes.new('GeometryNodeInputNamedAttribute'); attr.data_type = 'FLOAT'; attr.inputs['Name'].default_value = 'gras'
    mal = ng.nodes.new('ShaderNodeMath'); mal.operation = 'MULTIPLY'; mal.inputs[1].default_value = dichte
    info = ng.nodes.new('GeometryNodeObjectInfo'); info.inputs['Object'].default_value = halm; info.transform_space = 'ORIGINAL'
    inst = ng.nodes.new('GeometryNodeInstanceOnPoints')
    zuf = ng.nodes.new('FunctionNodeRandomValue'); zuf.data_type = 'FLOAT_VECTOR'
    zuf.inputs['Min'].default_value = (0.5, 0.5, 0.5); zuf.inputs['Max'].default_value = (1.3, 1.3, 1.4)
    join = ng.nodes.new('GeometryNodeJoinGeometry')
    L = ng.links.new
    L(ein.outputs['Geometry'], dist.inputs['Mesh']); L(attr.outputs['Attribute'], mal.inputs[0]); L(mal.outputs['Value'], dist.inputs['Density'])
    L(dist.outputs['Points'], inst.inputs['Points']); L(dist.outputs['Rotation'], inst.inputs['Rotation'])
    L(info.outputs['Geometry'], inst.inputs['Instance']); L(zuf.outputs['Value'], inst.inputs['Scale'])
    L(ein.outputs['Geometry'], join.inputs['Geometry']); L(inst.outputs['Instances'], join.inputs['Geometry'])
    L(join.outputs['Geometry'], aus.inputs['Geometry'])
    m = ter.modifiers.new('Gras', 'NODES'); m.node_group = ng
    halm.hide_render = True; halm.hide_viewport = True

def dunst(name, groesse, z0, z1, dichte, abfall, farbe=(0.9, 0.82, 0.72), aniso=0.55):
    """Hoehenabhaengiger Dunst: dichte * exp(-(z - z0) / abfall), im Kasten."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, (z0 + z1) / 2))
    o = bpy.context.active_object; o.name = name; o.scale = (groesse, groesse, z1 - z0); o.display_type = 'WIRE'
    m, nt, out = material(name)
    tex = neu(nt, 'ShaderNodeTexCoord', (-1200, 0)); sep = neu(nt, 'ShaderNodeSeparateXYZ', (-1000, 0)); link(nt, tex, 'Object', sep, 'Vector')
    # Objektkoordinaten sind 0..1 im skalierten Kasten: z_obj = (z - z0) / (z1 - z0) - 0.5
    m1 = neu(nt, 'ShaderNodeMath', (-800, 0), operation='ADD'); m1.inputs[1].default_value = 0.5; link(nt, sep, 'Z', m1, 0)
    m2 = neu(nt, 'ShaderNodeMath', (-600, 0), operation='MULTIPLY'); m2.inputs[1].default_value = -(z1 - z0) / abfall; link(nt, m1, 'Value', m2, 0)
    m3 = neu(nt, 'ShaderNodeMath', (-400, 0), operation='EXPONENT'); link(nt, m2, 'Value', m3, 0)
    m4 = neu(nt, 'ShaderNodeMath', (-200, 0), operation='MULTIPLY'); m4.inputs[1].default_value = dichte; link(nt, m3, 'Value', m4, 0)
    m5 = neu(nt, 'ShaderNodeMath', (0, 0), operation='MINIMUM'); m5.inputs[1].default_value = dichte * 6; link(nt, m4, 'Value', m5, 0)
    vol = neu(nt, 'ShaderNodeVolumePrincipled', (300, 0)); vol.inputs['Color'].default_value = (*farbe, 1); vol.inputs['Anisotropy'].default_value = aniso
    link(nt, m5, 'Value', vol, 'Density'); link(nt, vol, 'Volume', out, 'Volume')
    o.data.materials.append(m)
    return o

def sonne(elev_grad, azimut_grad, farbe=(1.0, 0.80, 0.60), staerke=4.0):
    el, az = math.radians(elev_grad), math.radians(azimut_grad)
    d = Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))   # Richtung zur Sonne
    lampe = bpy.data.lights.new('Sonne', 'SUN'); lampe.color = farbe; lampe.energy = staerke; lampe.angle = math.radians(0.7)
    o = bpy.data.objects.new('Sonne', lampe); bpy.context.collection.objects.link(o)
    o.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler(); o.location = (0, 0, 60)
    return o, d

def welt(elev_grad, azimut_grad, staerke=1.0):
    """Himmel als gerichteter Verlauf, nicht als physikalischer Himmel.

    Der Nishita-Himmel liefert ein blaues Zenit und blaue Schatten — die Referenz hat warme
    Schatten (D152: `#191410`), weil der Dunst selbst das Licht traegt. Ein physikalischer
    Dunst, der Flaechen aufhellt, braeuchte Volumen-Mehrfachstreuung (unbezahlbar). Also:
    warmer Horizont, gedecktes warmgraues Zenit, Sonnenhof als Kosinus-Potenz — die Zahlen
    so, dass Schatten etwa ein Sechstel des beleuchteten Bodens sind (Referenz)."""
    w = bpy.data.worlds.new('Oental'); bpy.context.scene.world = w; w.use_nodes = True
    nt = w.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = neu(nt, 'ShaderNodeOutputWorld', (900, 0)); bg = neu(nt, 'ShaderNodeBackground', (700, 0)); bg.inputs['Strength'].default_value = staerke
    link(nt, bg, 'Background', out, 'Surface')
    tex = neu(nt, 'ShaderNodeTexCoord', (-1200, 0))
    norm = neu(nt, 'ShaderNodeVectorMath', (-1000, 0), operation='NORMALIZE'); link(nt, tex, 'Generated', norm, 0)
    sep = neu(nt, 'ShaderNodeSeparateXYZ', (-800, 0)); link(nt, norm, 'Vector', sep, 'Vector')
    hoehe = neu(nt, 'ShaderNodeMapRange', (-600, 0)); hoehe.inputs['From Min'].default_value = -0.05; hoehe.inputs['From Max'].default_value = 0.6
    link(nt, sep, 'Z', hoehe, 'Value')
    verlauf = rampe(nt, (-350, 0), [(0.0, (0.130, 0.100, 0.076)), (0.35, (0.095, 0.085, 0.074)), (1.0, (0.060, 0.062, 0.062))])
    link(nt, hoehe, 'Result', verlauf, 'Fac')
    el, az = math.radians(elev_grad), math.radians(azimut_grad)
    d = (math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el))
    punkt = neu(nt, 'ShaderNodeVectorMath', (-600, -300), operation='DOT_PRODUCT'); punkt.inputs[1].default_value = d; link(nt, norm, 'Vector', punkt, 0)
    pos = neu(nt, 'ShaderNodeMath', (-400, -300), operation='MAXIMUM'); pos.inputs[1].default_value = 0.0; link(nt, punkt, 'Value', pos, 0)
    hof = neu(nt, 'ShaderNodeMath', (-200, -300), operation='POWER'); hof.inputs[1].default_value = 14.0; link(nt, pos, 'Value', hof, 0)
    hofw = neu(nt, 'ShaderNodeMath', (0, -300), operation='MULTIPLY'); hofw.inputs[1].default_value = 0.35; link(nt, hof, 'Value', hofw, 0)
    hoffarbe = neu(nt, 'ShaderNodeMix', (200, -300), data_type='RGBA', blend_type='MULTIPLY'); hoffarbe.inputs[0].default_value = 1.0
    hoffarbe.inputs[6].default_value = (1.0, 0.72, 0.42, 1); link(nt, hofw, 'Value', hoffarbe, 7)
    summe = neu(nt, 'ShaderNodeMix', (450, 0), data_type='RGBA', blend_type='ADD'); summe.inputs[0].default_value = 1.0
    link(nt, verlauf, 'Color', summe, 6); link(nt, hoffarbe, 2, summe, 7); link(nt, summe, 2, bg, 'Color')
    return w

def kamera(ort, ziel, brennweite=32):
    cam = bpy.data.cameras.new('Kamera'); cam.lens = brennweite; cam.sensor_width = 36; cam.clip_end = 6000
    o = bpy.data.objects.new('Kamera', cam); bpy.context.collection.objects.link(o)
    o.location = ort; o.rotation_euler = (Vector(ziel) - Vector(ort)).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = o
    return o

def rendern(sc, breite, hoehe, samples, pfad):
    sc.render.engine = 'CYCLES'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for d in prefs.devices: d.use = True
        sc.cycles.device = 'GPU'
        print('Cycles: Metal', [d.name for d in prefs.devices])
    except Exception as e:
        print('Cycles: CPU —', e)
    sc.cycles.samples = samples; sc.cycles.use_adaptive_sampling = True; sc.cycles.adaptive_threshold = 0.02
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 6; sc.cycles.diffuse_bounces = 3; sc.cycles.glossy_bounces = 3; sc.cycles.transmission_bounces = 6; sc.cycles.volume_bounces = 0; sc.cycles.transparent_max_bounces = 8
    sc.cycles.volume_step_rate = 3.0; sc.cycles.volume_max_steps = 128; sc.cycles.volume_preview_step_rate = 3.0
    sc.render.resolution_x = breite; sc.render.resolution_y = hoehe; sc.render.resolution_percentage = 100
    sc.render.film_transparent = False; sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGB'
    sc.view_settings.view_transform = 'AgX'
    try: sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception: pass
    # +1,3 EV gemessen: bei 0 lag das Bild auf Median 0,006 gegen 0,06–0,14 der Referenz (oberes Drittel 0,08 gegen 0,2)
    sc.view_settings.exposure = 1.3; sc.view_settings.gamma = 1.0
    sc.render.filepath = os.path.abspath(pfad)
    bpy.ops.render.render(write_still=True)


def fernkulisse(mat, saat=5):
    """Huegelzuege jenseits der Daten (Osten, 3–7 km): reine Silhouette im Dunst.
    Ausserhalb der Region liegen keine DGM1-Daten — das hier ist Kulisse, kein Gelaende,
    und heisst auch so."""
    rnd = random.Random(saat)
    for k, (dist, hmin, hmax) in enumerate(((3200.0, 60.0, 260.0), (5200.0, 260.0, 620.0), (7200.0, 500.0, 950.0))):
        bm = bmesh.new(); unten = []; oben = []
        n = 60
        for i in range(n + 1):
            t = i / n; y = (t - 0.5) * 9000.0
            h = hmin + (hmax - hmin) * (0.5 + 0.5 * noise.noise(Vector((t * 7.0 + k * 3.1, k, 0)))) + 40 * noise.noise(Vector((t * 30 + k, 0, 0)))
            x = dist + 300 * noise.noise(Vector((t * 4 + k * 5, 1, 0)))
            unten.append(bm.verts.new((x, y, -700.0))); oben.append(bm.verts.new((x, y, h - 350.0)))
        for i in range(n):
            bm.faces.new((unten[i], unten[i + 1], oben[i + 1], oben[i]))
        me = bpy.data.meshes.new('Fernkulisse%d' % k); bm.to_mesh(me); bm.free()
        o = bpy.data.objects.new('Fernkulisse%d' % k, me); bpy.context.collection.objects.link(o); setze(o, mat)

# ----------------------------------------------------------------- Aufbau
def szene_felsmulde(M, ter, was):
    """Szene 1 (D153/D154): Terrasse im Hang, Ruine mit Bogen, Hof, Becken — Blick durch den Bogen ins Tal."""
    # Terrasse: eine Bank im Hang. Mauer an der Ostkante, Hof dahinter, Kamera im Hof, Blick durch den Bogen ins Tal.
    zt = bodenhoehe(-2.0, -1.0)
    terrasse(ter, -2.0, -1.0, 12.0, 22.0, zt)
    bodenrauschen(ter, -2.0, -1.0, 16.0, 0.07)
    bpy.context.view_layer.update()

    # Mauern aus Steinen (D154): Kanten entstehen aus fehlenden Steinen, nicht aus Kastenkanten
    mauer('MauerA', (5.0, 0.0, zt - 0.35), 15.0, 7.5, 1.0, 'y', 1, M['stein'], M['kern'], 3.4, oeffnung=(-1.5, 3.2, 5.2), schutz=(-1.5, 2.2, 6.6), lehne=math.radians(-1.5))
    mauer('MauerB', (0.0, 7.5, zt - 0.35), 10.0, 5.0, 1.0, 'x', 2, M['stein'], M['kern'], 1.8, oeffnung=(-2.0, 0.8, 2.9), schutz=(-2.0, 0.9, 3.8))
    mauer('MauerC', (2.0, -8.0, zt - 0.35), 5.0, 3.0, 1.0, 'x', 6, M['stein'], M['kern'], 0.6)
    mauer('Stuetzmauer', (12.5, -1.0, zt - 2.7), 26.0, 2.6, 0.8, 'y', 3, M['stein'], M['kern'], 1.2)
    erdwulst(ter, [((5.0, -7.5), (5.0, 7.5)), ((-5.0, 7.5), (5.0, 7.5)), ((-0.5, -8.0), (4.5, -8.0))], 1.4, 0.28)
    bpy.context.view_layer.update()
    geroell(5.0, 5.0, 2.6, 12, M['fels'], 3); geroell(-3.0, 7.0, 2.2, 8, M['fels'], 4); geroell(2.0, -7.5, 2.0, 7, M['fels'], 5); geroell(5.0, -5.5, 1.8, 6, M['fels'], 6)
    geroell(4.6, -1.5, 1.2, 5, M['fels'], 8)

    plattenhof('Hof', (-1.0, -0.5, zt), (12.0, 15.0), M['platte'], 9, loch=(-1.5, -2.5, 2.1, 2.9))
    steinbecken('Becken', (-2.5, -3.0, zt), (3.8, 5.4), 0.8, M['stein'], M['wasser'], 4)

    bloecke = (((-7.5, 5.5), (2.2, 1.7, 1.3)), ((-6.5, -7.5), (1.7, 1.4, 1.0)), ((-13.5, 4.0), (2.8, 2.0, 1.5)), ((-3.0, 4.2), (1.1, 0.9, 0.7)))
    for i, ((x, y), g) in enumerate(bloecke):
        o = block('Moosblock%d' % i, (x, y, bodenhoehe(x, y) + g[2] * 0.5), g, 40 + i, 0.25, 4); setze(o, M['fels'])
    # Wurzeln vom Heldenbaum ueber die linke Hofhaelfte — die Natur holt sich das Pflaster
    for i, (st, ri, l) in enumerate((((-7.0, 6.5), -0.55, 9.0), ((-7.0, 6.5), -1.15, 7.5), ((-7.0, 6.5), 0.25, 5.0), ((-9.5, -6.0), 0.9, 5.5))):
        wurzel('Wurzel%d' % i, st, ri, l, M['rinde'], 50 + i, 0.32 if i < 3 else 0.2)

    for i, (x, y, h) in enumerate(((-7.0, 6.5, 32), (8.0, 10.0, 34), (7.0, -12.0, 30), (-7.0, -12.5, 27), (15.0, 4.0, 28), (-1.0, 11.0, 30))):
        laubbaum2('Held%d' % i, x, y, h, M['rinde'], M['laub'], 70 + i, True)
    fichte('HeldN0', -13.0, 11.0, 24, M['rinde'], M['nadel'], 80, True); fichte('HeldN1', 19.0, -24.0, 22, M['rinde'], M['nadel'], 81, True)
    wald(ter, M['rinde'], M['laub'], M['nadel'], 22.0, 150.0, 5.5, 11, ((-2.0, -1.0, 21.0),))

    # Farn an Mauerfuessen, Bloecken und am Terrassenrand; Efeu an den Mauern
    rnd = random.Random(77); k = 0
    for (mx, my, r, n) in ((5.0, 6.5, 2.5, 6), (5.2, -6.5, 2.2, 5), (-3.0, 8.5, 2.0, 5), (-8.0, 5.0, 2.5, 6), (-7.5, -8.0, 2.5, 5), (-12.0, 2.0, 3.0, 5), (3.0, -9.5, 2.0, 4)):
        for j in range(n if not SCHNELL else max(2, n // 2)):
            a = rnd.random() * 6.283; d = r * math.sqrt(rnd.random())
            x, y = mx + math.cos(a) * d, my + math.sin(a) * d
            if abs(x + 1.0) < 6.2 and abs(y + 0.5) < 7.7 and not (abs(y - 7.5) < 1.0): continue
            farn('Farn%d' % k, x, y, M['farn'], 300 + k, 0.8 + rnd.random() * 0.6); k += 1
    zb = zt - 0.35
    efeu('EfeuA', [(Vector((4.45, 3.5, zb + 2.2)), Vector((-1, 0, 0)), 1.1), (Vector((4.45, -5.2, zb + 1.5)), Vector((-1, 0, 0)), 0.9), (Vector((4.45, 5.8, zb + 3.2)), Vector((-1, 0, 0)), 0.7)], M['efeu'], 90)
    efeu('EfeuB', [(Vector((-3.5, 6.95, zb + 1.7)), Vector((0, -1, 0)), 1.0), (Vector((2.4, 6.95, zb + 2.4)), Vector((0, -1, 0)), 0.8)], M['efeu'], 91)

    return ((-10.0, 0.5, zt + 1.7), (5.0, -1.2, zt + 2.6), 26), ((-1.0, -0.5, 8.5),)

# ----------------------------------------------------------------- Ufer (D155, Szene 2)
def hoehe_von(x, y, praefix):
    """Hoehe eines Objekts mit Namenspraefix an (x, y) per Strahl von oben; None, wenn nichts da ist."""
    dg = bpy.context.evaluated_depsgraph_get()
    for o in bpy.context.scene.objects:
        if not o.name.startswith(praefix) or o.type != 'MESH': continue
        hit, loc, nrm, idx = o.ray_cast(o.matrix_world.inverted() @ Vector((x, y, 500.0)), Vector((0, 0, -1)), depsgraph=dg)
        if hit: return (o.matrix_world @ loc).z
    return None

def mat_holz():
    """Verwittertes Holz: graubraun, Maserung als gestrecktes Rauschen, wenig Moos."""
    m, nt, out = material('Holz'); b = prinzip(nt, (0.30, 0.23, 0.16), 0.85); link(nt, b, 'BSDF', out, 'Surface')
    tex = neu(nt, 'ShaderNodeTexCoord', (-1400, 0))
    mp = neu(nt, 'ShaderNodeMapping', (-1200, 0)); mp.inputs['Scale'].default_value = (0.15, 1.0, 1.0); link(nt, tex, 'Object', mp, 'Vector')
    n = neu(nt, 'ShaderNodeTexNoise', (-1000, 0)); n.inputs['Scale'].default_value = 8; n.inputs['Detail'].default_value = 8; link(nt, mp, 'Vector', n, 'Vector')
    r = rampe(nt, (-700, 0), [(0.3, (0.18, 0.14, 0.10)), (0.55, (0.32, 0.26, 0.19)), (0.8, (0.46, 0.40, 0.31))]); link(nt, n, 'Fac', r, 'Fac')
    bump = neu(nt, 'ShaderNodeBump', (0, -400)); bump.inputs['Strength'].default_value = 0.35; bump.inputs['Distance'].default_value = 0.02; link(nt, n, 'Fac', bump, 'Height'); link(nt, bump, 'Normal', b, 'Normal')
    moosmischung(nt, b, r, 'Color', (-100, 350), staerke=0.5)
    return m

def steg(name, x, y0, y1, mat_holz, saat=31, breite=1.4):
    """Holzsteg auf Pfaehlen quer ueber das Wasser: Balken, Planken mit Luecken, Gelaender auf einer Seite."""
    rnd = random.Random(saat); bm = bmesh.new(); k = 0
    wasser = hoehe_von(x, (y0 + y1) / 2, 'wasser'); deck = (wasser if wasser is not None else bodenhoehe(x, (y0 + y1) / 2)) + 0.75
    # Pfaehle alle 2,2 m, bis in den Grund
    y = y0
    while y <= y1 + 0.01:
        for s in (-1, 1):
            px, py = x + s * (breite / 2 - 0.12), y
            grund = bodenhoehe(px, py) - 0.6
            m = Matrix.Translation(Vector((px, py, (grund + deck + 0.2) / 2))) @ Euler((rnd.uniform(-0.02, 0.02), rnd.uniform(-0.02, 0.02), 0)).to_matrix().to_4x4()
            stein_bm(bm, (0.22, 0.22, deck + 0.2 - grund), m, saat * 50 + k, 0.03, 0.15); k += 1
        y += 2.2
    # Laengsbalken
    for s in (-1, 1):
        m = Matrix.Translation(Vector((x + s * (breite / 2 - 0.12), (y0 + y1) / 2, deck - 0.12)))
        stein_bm(bm, (0.18, y1 - y0 + 0.6, 0.16), m, saat * 50 + k, 0.02, 0.1); k += 1
    # Planken quer, mit Luecken, leicht verkippt, hin und wieder eine fehlend
    y = y0 - 0.2
    while y < y1 + 0.2:
        b = 0.20 + rnd.random() * 0.08
        if rnd.random() > 0.06:
            m = Matrix.Translation(Vector((x, y + b / 2, deck + rnd.uniform(-0.01, 0.02)))) @ Euler((rnd.uniform(-0.03, 0.03), rnd.uniform(-0.02, 0.02), rnd.uniform(-0.02, 0.02))).to_matrix().to_4x4()
            stein_bm(bm, (breite + 0.1, b * 0.95, 0.05), m, saat * 50 + k, 0.02, 0.1); k += 1
        y += b + 0.025
    # Gelaender links (Seite -x): Pfosten und zwei Holme
    y = y0
    while y <= y1 + 0.01:
        m = Matrix.Translation(Vector((x - breite / 2 - 0.02, y, deck + 0.55)))
        stein_bm(bm, (0.09, 0.09, 1.1), m, saat * 50 + k, 0.02, 0.1); k += 1
        y += 2.2
    for hz in (deck + 0.55, deck + 1.02):
        m = Matrix.Translation(Vector((x - breite / 2 - 0.02, (y0 + y1) / 2, hz)))
        stein_bm(bm, (0.07, y1 - y0 + 0.3, 0.09), m, saat * 50 + k, 0.02, 0.1); k += 1
    fertig(name, bm, (0, 0, 0), mat_holz)
    return deck

def weide(name, x, y, hoehe, mat_rinde, mat_laub, saat, richtung=None):
    """Weide am Ufer: kurzer dicker Stamm, zum Wasser geneigt, Krone aus haengenden Ruten mit schmalen Blaettern."""
    rnd = random.Random(saat); z0 = bodenhoehe(x, y)
    lean = Vector((math.cos(richtung), math.sin(richtung), 0)) * 0.35 if richtung is not None else Vector((rnd.random() - 0.5, rnd.random() - 0.5, 0)) * 0.4
    n = 7; pts = []; rad = []
    for i in range(n):
        t = i / (n - 1)
        pts.append(Vector((x, y, z0 - 0.3)) + lean * (t * t * hoehe) + Vector((math.sin(t * 4 + saat) * 0.2, 0, t * hoehe)))
        rad.append(0.32 * (1.0 - 0.7 * t) + 0.06)
    stamm(name + '_Stamm', pts, rad, mat_rinde)
    krone = bmesh.new(); k = 0
    spitze = pts[-1]
    for j in range(22 + rnd.randrange(10)):
        a = rnd.random() * 6.283; aus = 1.5 + rnd.random() * 3.0; fall = hoehe * (0.55 + rnd.random() * 0.4)
        p0 = spitze + Vector((math.cos(a) * 0.4, math.sin(a) * 0.4, -0.3 - rnd.random() * 1.5))
        p1 = p0 + Vector((math.cos(a) * aus * 0.8, math.sin(a) * aus * 0.8, 0.6))
        p2 = p0 + Vector((math.cos(a) * aus, math.sin(a) * aus, -fall * 0.5))
        p3 = p0 + Vector((math.cos(a) * aus * 1.05, math.sin(a) * aus * 1.05, -fall))
        stamm(name + '_Rute%d' % j, [p0, p1, p2, p3], [0.05, 0.035, 0.02, 0.01], mat_rinde, 2)
        # Blaetter entlang der Rute: kubische Bezier-Naeherung ueber die vier Punkte
        for s in range(4, 34):
            t = s / 33.0
            q = p0 * (1 - t) ** 3 + p1 * 3 * (1 - t) ** 2 * t + p2 * 3 * (1 - t) * t * t + p3 * t ** 3
            rot = Matrix.Rotation(rnd.random() * 6.28, 4, 'Z') @ Matrix.Rotation(rnd.uniform(-0.7, 0.7), 4, 'X')
            klumpen_bm(krone, q + Vector((rnd.uniform(-0.2, 0.2), rnd.uniform(-0.2, 0.2), 0)), (0.55, 0.22, 0.06), saat * 41 + k, 0.35, 1, rot); k += 1
    fertig(name + '_Krone', krone, (0, 0, 0), mat_laub, True)

def schilf_bm(bm, x, y, z0, saat, n=26, hoehe=1.9):
    rnd = random.Random(saat)
    for i in range(n):
        a = rnd.random() * 6.283; d = rnd.random() * 0.5
        bx, by = x + math.cos(a) * d, y + math.sin(a) * d
        h = hoehe * (0.7 + rnd.random() * 0.5); w = 0.018
        kipp = rnd.uniform(0.0, 0.25); ka = rnd.random() * 6.283
        vs = []
        for s in range(5):
            t = s / 4.0
            dx, dy = math.cos(ka) * math.sin(kipp) * t * t * h, math.sin(ka) * math.sin(kipp) * t * t * h
            ww = w * (1.0 - t * 0.7)
            vs.append((bm.verts.new((bx + dx - ww * math.sin(ka), by + dy + ww * math.cos(ka), z0 + t * h)),
                       bm.verts.new((bx + dx + ww * math.sin(ka), by + dy - ww * math.cos(ka), z0 + t * h))))
        for s in range(4):
            bm.faces.new((vs[s][0], vs[s][1], vs[s + 1][1], vs[s + 1][0]))

def uferpunkte(abstand=2.6, saat=5):
    """Landzellen mit Wasser in Reichweite — entlang aller Ufer, in Schritten von `abstand`."""
    rnd = random.Random(saat)
    was = next((o for o in bpy.context.scene.objects if o.name == 'wasser'), None)
    if was is None: return []
    nass = set()
    for v in was.data.vertices: nass.add((round(v.co.x), round(v.co.y)))
    punkte = []; belegt = set()
    for (wx, wy) in sorted(nass):
        for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2), (2, 2), (-2, -2), (2, -2), (-2, 2)):
            px, py = wx + dx, wy + dy
            if (px, py) in nass or (round(px + 1), round(py)) in nass and (round(px - 1), round(py)) in nass: continue
            zelle = (int(px // abstand), int(py // abstand))
            if zelle in belegt: continue
            belegt.add(zelle)
            if rnd.random() < 0.45: punkte.append((px + rnd.uniform(-0.6, 0.6), py + rnd.uniform(-0.6, 0.6)))
    return punkte

def szene_stauwehr(M, ter, was):
    """Szene 2 (D155): Ufer am Stauwehr — Holzsteg ueber den Bach, Weiden, Schilf, Bloecke im Wasser,
    gestuerzter Stamm, Wehrmauer. Kamera am Suedufer, Blick nach Nordost ueber das Wasser in die Sonne."""
    m_holz = mat_holz()
    m_weide = mat_laub('Weide', (0.24, 0.31, 0.13), (0.50, 0.55, 0.24), 0.6, 0.45)
    m_schilf = mat_laub('Schilf', (0.36, 0.38, 0.13), (0.62, 0.58, 0.24), 0.5, 0.0)
    glaette_bett(ter, runden=6)
    # Uferlinie runden: das Wasser kommt in 1-m-Zellen, Catmull-Clark macht aus der Zackenkante eine Kurve
    if was is not None: was.modifiers.new('Ufer', 'SUBSURF').levels = 2
    bodenrauschen(ter, 0.0, 28.0, 60.0, 0.06)
    bpy.context.view_layer.update()
    # Steg quer ueber den Stau bei x = -5, vom Suedufer (y 20) zum Nordufer (y 38)
    deck = steg('Steg', -5.0, 19.5, 38.5, m_holz, 31)
    # Weiden an beiden Ufern, zum Wasser geneigt
    for i, (x, y, h, r) in enumerate(((-18.0, 21.0, 8.5, math.radians(90)), (13.0, 20.5, 7.5, math.radians(80)), (26.0, 39.5, 8.0, math.radians(-95)), (-40.0, 38.0, 7.0, math.radians(-80)), (48.0, 21.0, 6.5, math.radians(100)))):
        weide('Weide%d' % i, x, y, h, M['rinde'], m_weide, 200 + i, r)
    # Bloecke im Wasser und am Ufer, gestuerzter Stamm
    for i, (x, y, g) in enumerate(((4.0, 24.0, (1.6, 1.2, 0.9)), (9.0, 27.5, (1.1, 0.9, 0.7)), (-12.0, 30.0, (2.0, 1.5, 1.0)), (35.0, 23.0, (1.4, 1.0, 0.8)), (-26.0, 36.0, (1.3, 1.1, 0.8)))):
        o = block('Wasserblock%d' % i, (x, y, bodenhoehe(x, y) + g[2] * 0.35), g, 60 + i, 0.25, 4); setze(o, M['fels'])
    zs = bodenhoehe(40.0, 22.0)
    stamm('Sturzstamm', [Vector((38.0, 19.0, zs + 0.6)), Vector((41.0, 25.0, zs + 0.1)), Vector((44.0, 31.0, zs - 0.4)), Vector((46.0, 36.0, zs - 0.5))], [0.38, 0.32, 0.24, 0.12], M['rinde'])
    # Wehr: niedrige Steinmauer quer ueber den Stau am Ostende
    wz = hoehe_von(75.0, 30.0, 'wasser'); wz = (wz if wz is not None else bodenhoehe(75.0, 30.0)) - 1.1
    mauer('Wehr', (75.0, 30.0, wz), 18.0, 1.7, 1.3, 'y', 21, M['stein'], M['kern'], 1.2)
    geroell(75.0, 22.0, 3.0, 8, M['fels'], 23); geroell(75.0, 38.0, 3.0, 8, M['fels'], 24)
    # Schilf entlang der Ufer
    bm = bmesh.new(); pts = uferpunkte(2.6 if not SCHNELL else 5.0)
    for i, (px, py) in enumerate(pts[:400 if not SCHNELL else 120]):
        schilf_bm(bm, px, py, bodenhoehe(px, py) - 0.05, 500 + i)
    fertig('Schilf', bm, (0, 0, 0), m_schilf, False)
    print('Schilf', len(pts), 'Horste')
    # Wald nach Biom, ohne die Uferzone und die Kamera
    wald(ter, M['rinde'], M['laub'], M['nadel'], 6.0, 150.0, 5.5, 13, ((-30.0, 8.0, 5.0), (-5.0, 29.0, 9.0)))
    # Farn am Waldrand des Suedufers
    rnd = random.Random(78)
    for k in range(40 if not SCHNELL else 14):
        x, y = rnd.uniform(-45, 25), rnd.uniform(8, 18)
        farn('Farn%d' % k, x, y, M['farn'], 400 + k, 0.8 + rnd.random() * 0.6)
    # Rahmen vor der Kamera (Messung s6: Drittel oben 0.35 statt 0.20, hell 24 % — der Himmel frisst das
    # obere Drittel): links eine Weide, deren Ruten als Vorhang vor dem Sonnenhof haengen, rechts eine
    # Fichte am Bildrand; die Kamera zielt auf den Steg statt ueber ihn hinweg.
    # s7/s8: die Weide 9–11 m vor der Kamera fuellte ein Drittel der Bildbreite mit hellgruenen Ruten
    # (Saettigung oben 0,50 statt 0,25, Median 0,035) — jetzt ganz am linken Rand, dazu ein hoher
    # Buchenstamm als dunkle Senkrechte am Rand, Krone ausserhalb des Bildes
    weide('Weide5', -41.3, 9.5, 8.5, M['rinde'], m_weide, 205, math.radians(90))
    laubbaum2('Wald199', -36.2, 10.9, 24.0, M['rinde'], M['laub'], 209, True)
    fichte('Wald0', -27.0, 4.5, 15.0, M['rinde'], M['nadel'], 207, True)
    # Auwald am Nordufer: hinter dem Steg schliessen hohe Kronen den Horizont, statt dass Himmel und
    # blasse Huegel das obere Drittel fuellen (s6: 0,35 statt 0,20)
    rnd = random.Random(81); k = 200
    for x in range(-72, 76, 7):
        px, py = x + rnd.uniform(-2.5, 2.5), 41.0 + rnd.uniform(0.0, 12.0)
        if rnd.random() < 0.7: laubbaum2('Wald%d' % k, px, py, 19 + rnd.random() * 9, M['rinde'], M['laub'], 900 + k, math.hypot(px, py) < 45)
        else: fichte('Wald%d' % k, px, py, 17 + rnd.random() * 8, M['rinde'], M['nadel'], 900 + k, math.hypot(px, py) < 45)
        k += 1
    zk = bodenhoehe(-42.0, 4.0)
    return ((-42.0, 4.0, zk + 4.5), (-5.0, 29.0, deck - 1.5), 26), ()

def bauen():
    sc = saeubern()
    ter = importiere('terrain'); fern = importiere('fern_terrain')
    was = importiere('wasser'); fw = importiere('fern_wasser'); hs = importiere('fern_haeuser')
    GELAENDE['obj'] = ter
    if fern: loch_im_fernen(fern, 159.5)
    if hs: loch_im_fernen(hs, 160.0)   # OSM-Haeuser im Nahbereich sind Kaesten — die Szene bringt ihre eigenen Bauten
    # Auwiese am Stauwehr: nass, dunkler, gruener als der trockene Hang (s6/s7 lasen als Stroh)
    AU = SZENE == 'stauwehr'
    m_boden = mat_boden(((0.09, 0.12, 0.035), (0.15, 0.19, 0.06), (0.28, 0.27, 0.11)) if AU else None)
    m_fels, m_stein, m_platte = mat_fels('Fels', 1.3), mat_fels('Stein', 0.9, 5.0), mat_fels('Platte', 1.2)
    m_kern, nt, out = material('Kern'); bk = prinzip(nt, MOERTEL, 0.95); link(nt, bk, 'BSDF', out, 'Surface')
    m_rinde, m_laub, m_wasser = mat_rinde(), mat_laub(), mat_wasser()
    m_nadel = mat_laub('Nadel', NADEL, (0.22, 0.30, 0.10), 0.35, 0.40)
    m_gras = mat_laub('Gras', (0.18, 0.24, 0.07), (0.34, 0.36, 0.12), 0.5, 0.0) if AU else mat_laub('Gras', (0.26, 0.30, 0.10), (0.46, 0.44, 0.17), 0.5, 0.0)
    m_farn = mat_laub('Farn', (0.16, 0.26, 0.07), (0.40, 0.50, 0.15), 0.6, 0.30)
    m_efeu = mat_laub('Efeu', (0.09, 0.17, 0.05), (0.28, 0.38, 0.11), 0.4, 0.28)
    setze(ter, m_boden)
    if fern: setze(fern, m_boden)
    if was: setze(was, m_wasser)
    if fw: setze(fw, m_wasser)
    if hs: setze(hs, m_stein)
    fernkulisse(m_boden)
    bpy.context.view_layer.update()

    M = dict(boden=m_boden, fels=m_fels, stein=m_stein, platte=m_platte, kern=m_kern, rinde=m_rinde, laub=m_laub, wasser=m_wasser,
             nadel=m_nadel, gras=m_gras, farn=m_farn, efeu=m_efeu)
    kam, gras_aus = (szene_felsmulde if SZENE == 'felsmulde' else szene_stauwehr)(M, ter, was)

    halm = grashalm(m_gras)
    gras(ter, halm, gras_aus, 3.0 if SCHNELL else 9.0)

    dunst('Dunst', 3400.0, -420.0, 1400.0, 0.0008, 230.0)
    # Bodennebel: am Stauwehr liegt die Kamera im Nebel (Talboden), nicht 450 m darueber wie in der Felsmulde —
    # Flussnebel dichter und hoeher, er traegt die Mitteltoene, die der Referenz ihren Dunst geben
    # (gemessen s9 voll: Median 0,026 und 41 % dunkel gegen 0,06–0,14 und 15–25 %)
    if AU: dunst('Bodennebel', 700.0, -90.0, 22.0, 0.011, 30.0, (0.92, 0.86, 0.78), 0.4)
    else: dunst('Bodennebel', 700.0, -90.0, 14.0, 0.008, 30.0, (0.92, 0.86, 0.78), 0.4)

    # Sonne tief im Nordosten (ein Tageslauf fuer alle Szenen): Gegenlicht am Dunst, Streiflicht an Mauer und Hof.
    EL, AZ = 13.0, 42.0
    sonne(EL, AZ, (1.0, 0.80, 0.60), 3.5)
    welt(EL, AZ, 1.5)
    kamera(*kam)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(OUT_BLEND))
    print('gespeichert', OUT_BLEND)
    if SCHNELL: rendern(sc, 960, 540, 24, OUT_PNG)
    else: rendern(sc, 1920, 1080, 48, OUT_PNG)
    print('gerendert', OUT_PNG)

if __name__ == '__main__':
    bauen()
