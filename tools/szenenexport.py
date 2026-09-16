"""
BRACHLAND — Szenenexport (Stufe 2, ADR-0006): die Blender-Szene als GLB fuer die Engine.

    blender --background .cache/blender/oental_probe.blend --python tools/szenenexport.py -- public/bauten felsmulde [groesse]

Was passiert:
- **Bauten** (Mauern, Kern, Hof, Becken, Bloecke, Geroell, Wurzeln, Staemme): Smart-UV je Objekt,
  dann werden die prozeduralen Cycles-Materialien in Bilder **gebacken** (Grundfarbe, Rauheit,
  Normale im Tangentenraum) und als Principled-Material mit drei Texturen exportiert.
- **Gruen** (Kronen, Nadeln, Farn, Efeu): Grundfarbe in **Vertexfarben** gebacken (kein UV noetig);
  die Loecher im Laub rechnet die Engine mit demselben Rauschen im Shader nach.
- Wasserflaechen kommen als eigenes Objekt ohne Backen (Engine-Wasser).
Achsen: glTF ist Y-oben; der Exporter dreht Blender-Z nach Y und Blender-Y nach −Z — genau die
Abbildung von `tools/terrainexport.ts` (X = x, Y = −z, Z = y). Ursprung der Szene = Weltpunkt (cx, cz)
aus `.cache/blender/terrain.json`, Hoehe h0.
"""
import bpy, math, sys, os, json, time, re

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ZIEL = ARGS[0] if ARGS else 'public/bauten'
NAME = ARGS[1] if len(ARGS) > 1 else 'felsmulde'
GROESSE = int(ARGS[2]) if len(ARGS) > 2 else 512
MARGIN = 24        # Pixel Bleed je UV-Insel (D159); 6 war zu wenig, das Schwarz dazwischen blutete ein
os.makedirs(ZIEL, exist_ok=True)
sc = bpy.context.scene

def ist_bau(o):
    n = o.name
    return o.type in ('MESH', 'CURVE') and (n.startswith(('MauerA', 'MauerB', 'MauerC', 'Stuetzmauer', 'Hof', 'Becken', 'Moosblock', 'Geroell', 'Wurzel', 'Steg', 'Wehr', 'Wasserblock', 'Sturzstamm'))
            or (n.startswith(('Held', 'Weide')) and ('_Stamm' in n or '_Ast' in n or '_Anlauf' in n or '_Rute' in n))) and not n.endswith('_Wasser')

def ist_gruen(o):
    n = o.name
    return (o.type == 'MESH' and (n.startswith(('Farn', 'Efeu', 'Schilf')) or (n.startswith(('Held', 'Wald', 'Weide')) and (n.endswith('_Krone') or n.endswith('_Nadeln'))))) \
        or (o.type == 'CURVE' and n.startswith('Wald')) \
        or (o.type == 'MESH' and n.startswith('Wald') and n.endswith('_Stamm'))   # Fichtenstamm ist ein Kegelnetz, kein Kurvenobjekt — fehlte im ersten Export (Nadeln schwebten)

def ist_waldholz(o):
    """Waldstaemme: grob, Vertexfarbe, alle zu **einem** Netz — 180 Staemme backt niemand einzeln."""
    return (o.type == 'CURVE' and o.name.startswith('Wald')) or (o.type == 'MESH' and o.name.startswith('Wald') and o.name.endswith('_Stamm'))

def ist_wasser(o):
    return o.type == 'MESH' and o.name.endswith('_Wasser')

def zu_mesh(o):
    """Kurven (Staemme, Wurzeln) in Netze wandeln — Backen und Export brauchen Flaechen."""
    if o.type != 'CURVE': return o
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target='MESH')
    return bpy.context.view_layer.objects.active

def cycles_gpu():
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'; prefs.get_devices()
        for d in prefs.devices: d.use = True
        sc.cycles.device = 'GPU'
    except Exception as e:
        print('CPU:', e)
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 16; sc.cycles.use_denoising = False
    # AO-Reichweite fuer den Bake: 0,35 m — **Mikroverdeckung**, nicht die grosse (D159).
    # Mit 8 m sah ein Stein in einer Mauer fast nur Mauer: ao ~ 0 ueber die ganze Flaeche, Faktor 0,35,
    # und die gebackene Farbe war #3a3a32 statt #8a7a68 — im Spiel eine schwarze Wand mit hellem Saum,
    # auch mit `?ao=0` (gemessen). Die **grosse** Verdeckung (Mauer verschattet Hof) macht seit D158 der
    # SSAO-Pass der Engine mit 8 m Radius; sie hier nochmals zu backen war doppelt.
    try: sc.world.light_settings.distance = 0.35
    except Exception as e: print('AO-Distanz', e)
    # Margin 6 -> 24 px mit ADJACENT_FACES: eine Mauer hat ~200 UV-Inseln auf 1024 px, und das Schwarz
    # zwischen ihnen blutete beim Mipmapping in die Steine (sichtbar ab ~30 m Kameraabstand).
    sc.render.bake.margin = MARGIN; sc.render.bake.use_clear = True
    try: sc.render.bake.margin_type = 'ADJACENT_FACES'
    except Exception as e: print('Margin-Art', e)

def uv(o):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.012)
    bpy.ops.object.mode_set(mode='OBJECT')

def backe_bild(o, mat, art, groesse, dateiname):
    nt = mat.node_tree
    img = bpy.data.images.new(dateiname, groesse, groesse, alpha=False)
    if art != 'DIFFUSE': img.colorspace_settings.name = 'Non-Color'
    node = nt.nodes.new('ShaderNodeTexImage'); node.image = img; nt.nodes.active = node
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    if art == 'DIFFUSE':
        bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, margin=MARGIN, use_clear=True)
    elif art == 'ROUGHNESS':
        bpy.ops.object.bake(type='ROUGHNESS', margin=MARGIN, use_clear=True)
    elif art == 'AO':
        bpy.ops.object.bake(type='AO', margin=MARGIN, use_clear=True)
    else:
        bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT', margin=MARGIN, use_clear=True)
    nt.nodes.remove(node)
    img.filepath_raw = os.path.abspath(os.path.join('.cache/blender/bake', dateiname + '.png')); img.file_format = 'PNG'; img.save()
    return img

def textur_material(name, farbe, rauheit, normale):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial'); b = nt.nodes.new('ShaderNodeBsdfPrincipled'); nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])
    tf = nt.nodes.new('ShaderNodeTexImage'); tf.image = farbe; nt.links.new(tf.outputs['Color'], b.inputs['Base Color'])
    tr = nt.nodes.new('ShaderNodeTexImage'); tr.image = rauheit; nt.links.new(tr.outputs['Color'], b.inputs['Roughness'])
    tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = normale; nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(tn.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    return m

def backe_vertexfarbe(o, mat):
    if not o.data.color_attributes:
        o.data.color_attributes.new(name='Color', type='BYTE_COLOR', domain='CORNER')
    o.data.color_attributes.active_color = o.data.color_attributes['Color']
    sc.render.bake.target = 'VERTEX_COLORS'
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, use_clear=True)
    sc.render.bake.target = 'IMAGE_TEXTURES'
    # danach **ein** schlichtes Material mit Vertexfarbe fuer alles Gruen: der Export traegt COLOR_0,
    # die Engine den Rest. Ein Material je Objekt (erster Export) machte aus den 105 vereinigten
    # Waldkronen ein Netz mit 105 Primitiven und einem Material-Array — die Engine las das Array
    # als leeres Material und zeichnete die Kronen weiss.
    m = bpy.data.materials.get('Gruen_vc')
    if m is None:
        m = bpy.data.materials.new('Gruen_vc'); m.use_nodes = True; nt = m.node_tree
        for n in list(nt.nodes): nt.nodes.remove(n)
        out = nt.nodes.new('ShaderNodeOutputMaterial'); b = nt.nodes.new('ShaderNodeBsdfPrincipled'); nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])
        a = nt.nodes.new('ShaderNodeVertexColor'); a.layer_name = 'Color'; nt.links.new(a.outputs['Color'], b.inputs['Base Color'])
        b.inputs['Roughness'].default_value = 0.9
    o.data.materials.clear(); o.data.materials.append(m)

def exportiere(objekte, pfad):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objekte: o.select_set(True)
    bpy.context.view_layer.objects.active = objekte[0]
    bpy.ops.export_scene.gltf(filepath=pfad, export_format='GLB', use_selection=True, export_apply=True,
                              export_image_format='AUTO', export_texcoords=True, export_normals=True, export_materials='EXPORT',
                              export_animations=False, export_yup=True)

os.makedirs('.cache/blender/bake', exist_ok=True)
cycles_gpu()
t0 = time.time()
# Modifikatoren (Verwitterung, Kante) beim Backen anwenden, damit UV und Normale zur Endform passen
def gruppe_von(name):
    """Kleinteile zu einem Objekt je Gruppe: ein Baum ist Stamm + Aeste + Anlauf, Geroell ist Geroell.
    Sonst backt der Export 130 Aeste einzeln (gemessen: 12 s je Objekt, 26 Minuten fuer nichts)."""
    # Held0_…, HeldN1_…, Weide5_… — als Muster, nicht als Liste: die feste Liste bis Weide4_ liess die
    # Rahmenweide der zweiten Szene (Weide5) mit 30 einzeln gebackenen Ruten durch (D155)
    m = re.match(r'^(HeldN?\d+_|Weide\d+_)', name)
    if m and ('_Stamm' in name or '_Ast' in name or '_Anlauf' in name or '_Rute' in name): return m.group(1) + 'Holz'
    if name.startswith('Wasserblock'): return 'Wasserbloecke'
    if name.startswith('Geroell'): return 'Geroell'
    if name.startswith('Wurzel'): return 'Wurzeln'
    if name.startswith('Moosblock'): return 'Moosbloecke'
    if name.startswith('Becken') and not name.endswith('_Wasser'): return 'Becken'
    return name

roh = [o for o in list(sc.objects) if ist_bau(o)]
gruppen = {}
for o in roh:
    o = zu_mesh(o)
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers):
        try: bpy.ops.object.modifier_apply(modifier=m.name)
        except Exception as e: print('Modifikator', o.name, m.name, e)
    if len(o.data.polygons) == 0 or not o.data.materials: continue
    gruppen.setdefault(gruppe_von(o.name), []).append(o)
zusammen = []
for gname, objs in gruppen.items():
    if len(objs) > 1:
        # Materialien vorher vereinheitlichen: gleiche Gattung, ein Material — sonst hat das Ergebnis n Slots
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs: o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()
        o = bpy.context.view_layer.objects.active; o.name = gname
        while len(o.data.materials) > 1: o.data.materials.pop(index=len(o.data.materials) - 1)
        for pidx in range(len(o.data.polygons)): o.data.polygons[pidx].material_index = 0
    else:
        o = objs[0]; o.name = gname
    zusammen.append(o)
bauten = []
for o in zusammen:
    gr = GROESSE * 4 if o.name == 'WaldHolz' else GROESSE * 2 if o.name.startswith(('MauerA', 'MauerB', 'Stuetzmauer', 'Hof', 'Geroell', 'Moosbloecke', 'Wurzeln')) or o.name.endswith('Holz') else GROESSE
    if not o.data.materials: continue
    mat = o.data.materials[0].copy(); o.data.materials[0] = mat
    uv(o)
    f = backe_bild(o, mat, 'DIFFUSE', gr, o.name + '_farbe')
    # AO in die Grundfarbe multiplizieren: die Mikroverdeckung in Fugen und Kerben, die der
    # SSAO-Pass bei einem Pixel Breite nicht mehr aufloest (Reichweite oben, D159)
    ao = backe_bild(o, mat, 'AO', gr, o.name + '_ao')
    try:
        import numpy as np
        pf = np.empty(len(f.pixels), dtype=np.float32); pa = np.empty(len(ao.pixels), dtype=np.float32)
        f.pixels.foreach_get(pf); ao.pixels.foreach_get(pa)
        # Weich und mit Boden: Exponent 1,2 ohne Boden machte die Schattenseite der Mauer im Spiel
        # zu Schwarz (#000000 gemessen, D155) — Verdeckung soll zeichnen, nicht loeschen.
        # Boden 0,35 -> 0,55 (D159): Das AO misst jetzt nur noch die Fuge (0,35 m statt 8 m), die grosse
        # Verdeckung kommt aus dem SSAO-Pass. Zwei schwache Faktoren uebereinander statt einem starken.
        for k in range(3): pf[k::4] *= 0.55 + 0.45 * np.clip(pa[k::4], 0.0, 1.0) ** 0.7
        f.pixels.foreach_set(pf); f.save()
    except Exception as e:
        print('AO-Multiplikation', o.name, e)
    r = backe_bild(o, mat, 'ROUGHNESS', gr // 2, o.name + '_rauheit')
    n = backe_bild(o, mat, 'NORMAL', gr, o.name + '_normale')
    o.data.materials.clear(); o.data.materials.append(textur_material(o.name + '_tex', f, r, n))
    bauten.append(o); print('gebacken', o.name, gr, '%.0f s' % (time.time() - t0))
gruen = []
roh_gruen = [o for o in list(sc.objects) if ist_gruen(o)]
# Waldstaemme: Kurven grob aufloesen, zu Netzen, zu einem Objekt (gemessen: 180 feine Staemme = 1,2 M Ecken, Smart-UV haengt)
staemme = []
holz = [o for o in roh_gruen if ist_waldholz(o)]
roh_gruen = [o for o in roh_gruen if not ist_waldholz(o)]   # vor dem Wandeln trennen: `convert` aendert das Objekt in place
for o in holz:
    if o.type == 'CURVE': o.data.resolution_u = 3; o.data.bevel_resolution = 2
    staemme.append(zu_mesh(o))
if staemme:
    bpy.ops.object.select_all(action='DESELECT')
    for o in staemme: o.select_set(True)
    bpy.context.view_layer.objects.active = staemme[0]; bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active; o.name = 'WaldHolz'
    while len(o.data.materials) > 1: o.data.materials.pop(index=len(o.data.materials) - 1)
    roh_gruen.append(o)
for o in roh_gruen:
    backe_vertexfarbe(o, o.data.materials[0]); gruen.append(o); print('vertexfarbe', o.name, len(o.data.vertices))
# Waldkronen zu einem Netz je Art (Laub / Nadeln): 180 Objekte waeren 180 Aufrufe je Bild
for art, endung in (('WaldLaub', '_Krone'), ('WaldNadeln', '_Nadeln')):
    teile = [o for o in gruen if o.name.startswith('Wald') and o.name.endswith(endung)]
    if len(teile) > 1:
        bpy.ops.object.select_all(action='DESELECT')
        for o in teile: o.select_set(True)
        bpy.context.view_layer.objects.active = teile[0]; bpy.ops.object.join()
        o = bpy.context.view_layer.objects.active; o.name = art
        gruen = [g for g in gruen if g not in teile] + [o]
wasser = [o for o in sc.objects if ist_wasser(o)]
for o in wasser: o.data.materials.clear()
meta = json.load(open('.cache/blender/terrain.json'))
if bauten: exportiere(bauten, os.path.abspath(os.path.join(ZIEL, NAME + '-bauten.glb')))
if gruen: exportiere(gruen, os.path.abspath(os.path.join(ZIEL, NAME + '-gruen.glb')))
if wasser: exportiere(wasser, os.path.abspath(os.path.join(ZIEL, NAME + '-wasser.glb')))
reg = {'name': NAME, 'ursprung': {'x': meta['cx'], 'z': meta['cz']}, 'h0': meta['h0'],
       # Freihaltung: die Engine setzt hier keine eigenen Baeume (Radius wie `wald(... ausschluss)` im Szenenbau)
       # und keine Streuschicht im Hof (Radius der Plattenflaeche) — sonst wachsen Fichten durch die Mauer.
       # `haeuser`: dasselbe Loch wie `loch_im_fernen(hs, 160)` im Szenenbau — sonst steht ein OSM-Hof der Engine vor dem Steg
       'frei': {'x': meta['cx'] - 1.0, 'z': meta['cz'] + 0.5, 'props': 150.0, 'streu': 9.0 if NAME == 'felsmulde' else 0.0, 'haeuser': 160.0},
       'dateien': [f for f, l in (('bauten', bauten), ('gruen', gruen), ('wasser', wasser)) if l],
       'objekte': {'bauten': [o.name for o in bauten], 'gruen': [o.name for o in gruen], 'wasser': [o.name for o in wasser]}}
if NAME == 'felsmulde':   # nur diese Szene ebnet eine Terrasse (szene_felsmulde); die Engine muss dieselbe kennen
    reg['terrasse'] = {'x': meta['cx'] - 2.0, 'z': meta['cz'] + 1.0, 'rInnen': 12.0, 'rAussen': 22.0}
# Register: eine Datei fuer alle Bauwerke (Engine und Tore lesen dieselbe Liste — D137: Listen kommen aus dem Werkzeug)
regpfad = os.path.join(ZIEL, 'register.json')
register = json.load(open(regpfad)) if os.path.exists(regpfad) else {'bauwerke': []}
register['bauwerke'] = [b for b in register['bauwerke'] if b['name'] != NAME] + [reg]
json.dump(register, open(regpfad, 'w'), indent=1, ensure_ascii=False)
print('fertig', NAME, len(bauten), 'Bauten', len(gruen), 'Gruen', len(wasser), 'Wasser', '%.0f s' % (time.time() - t0))
