"""
BRACHLAND — Stil-Frames (D369): dieselbe Einstellung der Felsmulde (Zielbild, ADR-0006) in drei Stilen.

    # 1) Szene bauen und einmal rendern, Pässe als Multilayer-EXR (Bild, Tiefe, Normale, Nebel, Objektindex):
    blender --background --python tools/stilframes.py -- render <objdir> <aus.exr> [breite hoehe samples]
    # 2) Stil im Compositor aus demselben EXR (schnell, keine Szene):
    blender --background --factory-startup --python tools/stilframes.py -- stil <ein.exr> <roh|gemalt|grafisch|reduziert> <aus.png> [breite hoehe]

Ein Render, drei Stile: der Vergleich zeigt nur den Stil, nicht Unterschiede in Geometrie oder Licht. Grundlage ist
`tools/szenenbau.py` (Terrain aus `tools/terrainexport.ts`, Motive prozedural). Befall-Punkte in der Signalfarbe
(`palette.ts` befall.signal) liegen am Mauerfuss, weil die Art Direction genau eine Signalfarbe für Befall vorsieht.
"""
import bpy, sys, os, math, random

ARGS = sys.argv[sys.argv.index('--') + 1:]
MODUS = ARGS[0]
SIGNAL = (0.62, 0.81, 0.89)   # '#cfe9f2' linear grob


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


def knoten(g, typ, ort, **eing):
    n = g.nodes.new(typ); n.location = ort
    for k, v in eing.items():
        n.inputs[k].default_value = v
    return n


def stil():
    ein, art, aus = ARGS[1], ARGS[2], ARGS[3]
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
        a = kurve(bw1.outputs[0], 0.25, 0.9); b = kurve(bw2.outputs[0], 0.6, 1.6)
        mx = g.nodes.new('ShaderNodeMath'); mx.operation = 'MAXIMUM'; L(a, mx.inputs[0]); L(b, mx.inputs[1])
        # in der Ferne keine Linien: Nebel blendet sie aus
        nah = g.nodes.new('ShaderNodeMath'); nah.operation = 'MULTIPLY'; L(mx.outputs[0], nah.inputs[0])
        L(kurve(nebel, 0.35, 0.05), nah.inputs[1])
        return nah.outputs[0]

    def agx(src, ort):
        n = g.nodes.new('CompositorNodeConvertToDisplay'); n.location = ort
        L(src, n.inputs[0])
        try:
            n.display_settings.display_device = 'sRGB'
            n.view_settings.view_transform = 'AgX'; n.view_settings.look = 'AgX - Medium High Contrast'
            n.view_settings.exposure = 1.3   # wie szenenbau.rendern
        except Exception as e: print('Anzeige', e)
        return n.outputs[0]

    signal = maske_befall()
    if art == 'gemalt':
        # Soulframe-Linie: Formen vereinfacht zu Pinselflächen (anisotroper Kuwahara), warmes Licht, Luftschichten, Glühen.
        lin = farbe
        tief = mix(lin, (0.95, 0.78, 0.55), kurve(nebel, 0.08, 0.9, hoch=0.55), ort=(-400, 200))
        kw = knoten(g, 'CompositorNodeKuwahara', (-200, 200), Size=9, Uniformity=4, Sharpness=0.6, Eccentricity=1.2)
        kw.inputs['Type'].default_value = 'Anisotropic'
        L(tief, kw.inputs['Image'])
        gl = knoten(g, 'CompositorNodeGlare', (0, 200), Threshold=0.7, Strength=0.6, Size=0.8)
        gl.inputs['Type'].default_value = 'Bloom'
        L(kw.outputs[0], gl.inputs['Image'])
        disp = agx(gl.outputs[0], (200, 200))
        cb = g.nodes.new('CompositorNodeColorBalance'); cb.location = (400, 200)
        L(disp, cb.inputs['Image'])
        try:
            cb.inputs[4].default_value = (1.04, 1.0, 0.95, 1); cb.inputs[8].default_value = (1.04, 1.0, 0.92, 1)
        except Exception as e: print('Balance', e)
        hs = knoten(g, 'CompositorNodeHueSat', (600, 200), Saturation=0.92)
        L(cb.outputs[0], hs.inputs['Image']); ende = hs.outputs[0]
    elif art == 'grafisch':
        # Grafischer Realismus: klare Flächen, wenige Tonwerte, Silhouetten-Linien, Tiefe in drei Nebelebenen.
        stufen = g.nodes.new('ShaderNodeValToRGB'); stufen.location = (-400, -200)
        stufen.color_ramp.interpolation = 'CONSTANT'
        e = stufen.color_ramp.elements; e[0].position = 0.0; e[0].color = (0, 0, 0, 1); e[1].position = 0.12; e[1].color = (0.38, 0.38, 0.38, 1)
        n3 = e.new(0.35); n3.color = (0.72, 0.72, 0.72, 1); n4 = e.new(0.7); n4.color = (1, 1, 1, 1)
        L(nebel, stufen.inputs[0])
        bw = g.nodes.new('CompositorNodeRGBToBW'); L(stufen.outputs[0], bw.inputs[0])
        ebenen = mix(farbe, (0.88, 0.80, 0.66), bw.outputs[0], ort=(-200, 200))
        kw = knoten(g, 'CompositorNodeKuwahara', (0, 200), Size=4)
        kw.inputs['Type'].default_value = 'Classic'
        L(ebenen, kw.inputs['Image'])
        disp = agx(kw.outputs[0], (200, 200))
        po = knoten(g, 'CompositorNodePosterize', (400, 200), Steps=12)
        L(disp, po.inputs['Image'])
        weich = mix(disp, po.outputs[0], 0.55, ort=(500, 200))
        linie = mix(weich, (0.10, 0.08, 0.07), kanten(), ort=(700, 200))
        hs = knoten(g, 'CompositorNodeHueSat', (900, 200), Saturation=1.1)
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
        kw = knoten(g, 'CompositorNodeKuwahara', (500, 200), Size=3)
        kw.inputs['Type'].default_value = 'Classic'
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


render() if MODUS == 'render' else stil()
