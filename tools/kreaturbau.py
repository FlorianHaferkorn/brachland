"""BRACHLAND — CC0-Tiermodelle zu spielfertigen Kreaturen.

    blender --background --python tools/kreaturbau.py -- <quellordner>

## Warum das nicht `pipeline.sh` ist

`pipeline.sh` und `voxelbau.py` sind fuer **KI-Rohmodelle** gebaut: 205.328
Dreiecke, 583 getrennte Fellschalen, 30.216 offene Kanten, Farbe in einer
JPEG-Textur (G-88, G-94). Dafuer braucht es Voxel-Remesh und UV-Abtastung.

CC0-Modelle aus einem Handmodell-Pack haben nichts davon (G-123): 1.848 bis
3.667 Dreiecke, ein geschlossener Koerper, **keine Textur** — die Farbe steckt in
vier bis sieben flachen Materialien. Der ganze teure Teil entfaellt, und was
bleibt, sind drei Schritte: Farbe an den Vertex, Helligkeit in die Palette,
Dreiecke aufs Budget.

## Der Daempfer, und was an ihm gemessen ist

Fremdmodelle sind naturalistisch gefaerbt: leuchtendes Fuchsrot, tiefschwarzer
Stier, fast weisses Reh. Der erste Anlauf hat deshalb die **Saettigung** halbiert
— und das war falsch. Gemessen ueber die 21 Farben, die BRACHLAND heute traegt
(`.cache/palette.ts`), liegt die Saettigung im Median bei **0,52**; die Welt ist
nicht entsaettigt, sie ist erdig und **dunkel**. Eng ist sie in der Leuchtdichte:
p10 0,054, Median 0,132, p90 0,188.

Der Daempfer laesst Farbton und Saettigung deshalb in Ruhe und bildet nur die
Leuchtdichte ab — je Modell von dessen eigener Spanne in das Band der Welt. Der
Kontrast **innerhalb** eines Tieres (heller Bauch, dunkler Ruecken) bleibt damit
erhalten, aber alle Tiere teilen sich das Band der Haeuser und Baeume.
"""
import bpy, sys, json, os, math
from mathutils import Vector, Matrix

ARGS = sys.argv[sys.argv.index('--') + 1:]
QUELLE = ARGS[0] if ARGS else '.cache/cc0'
ZIEL = ARGS[1] if len(ARGS) > 1 else 'public/creatures'
# Dateiname → Kreatur laesst sich ueberschreiben: `datei=kreatur,datei=kreatur`.
# Dafuer gibt es einen Grund, der nichts mit Bequemlichkeit zu tun hat: Ein
# Kandidat mit anderer Lizenz muss sich aufbereiten und ansehen lassen, **ohne**
# dass er dabei in `public/` landet und damit ausgeliefert wird.
EIGEN = dict(p.split('=') for p in ARGS[2].split(',')) if len(ARGS) > 2 else None

# Quelldatei → Kreatur aus `content/creatures`. Die Zuordnung ist eine
# **Naeherung**: Ein Hirschgeweih ist kein Steinbockgehoern. Das Chitinplatten-
# Gehoern ist ohnehin der Anbau, der darueber kommt — der Grundkoerper muss die
# Bauform treffen, nicht die Art.
ZUORDNUNG = [
    ('wolf',   'k7-wolf'),
    ('fuchs',  'spuerfuchs'),
    ('hirsch', 'grathorn'),
    ('reh',    'nebelgams'),
    ('stier',  'wurzelkeiler'),
]

# Aus `.cache/palette.ts`, gemessen ueber die 21 Farben von Haeusern, Baeumen und
# Props: Leuchtdichte p10 0,054 · Median 0,132 · p90 0,188 (linear).
#
# **Kreaturen liegen bewusst im oberen Teil davon.** Der erste Anlauf nahm das
# ganze Band 0,05–0,19 — und der Grathorn stand danach im Bild **dunkler als das
# Gras hinter ihm**. Er verschwand nicht, weil ihm ein Rand fehlte, sondern weil
# er dunkler war als sein Hintergrund; ein breiterer Silhouettensaum brachte
# gemessen nur 21,4 % → 19,9 % schwarze Pixel im Tierausschnitt.
#
# Eine Kreatur ist das, wonach der Spieler sucht (D91, G-23). Sie gehoert ueber
# den Median der Welt, nicht ueber deren ganze Spanne — Dachziegel und
# Fensterhoehlen sind der Grund fuer das untere Ende des Bandes, und in dieser
# Gesellschaft hat ein Tier nichts zu suchen.
BAND_UNTEN, BAND_OBEN = 0.115, 0.245

# Muss `RIG_HOEHE` in `src/world/kreaturgestalt.ts` entsprechen. Die Zielhoehe
# wird **beim Export** eingerechnet, nicht in der Szene: Dort steht dann fuer
# Modell und Silhouette derselbe Ausdruck (`1 + mutation * 0.2`), und niemand muss
# sich merken, dass fuer die eine Sorte noch ein Faktor fehlt.
WIDERRIST = {'quadruped': 1.0, 'quadruped_small': 0.4,
             'biped_bird': 0.85, 'serpent': 0.22}


def leuchtdichte(c):
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


NEUTRAL = (0.8, 0.8, 0.8)


def farbe_hinter(socket, tiefe=0):
    """Die Farbe hinter einem Eingang — auch wenn Knoten dazwischenhaengen.

    Vier der fuenf Modelle schreiben die Basisfarbe direkt in den Principled-Knoten.
    Das Reh nicht: Dort haengt an `Base Color` ein **MIX**-Knoten, und der
    Principled-Eingang traegt nur noch Blenders Standardgrau (0,8). Wer nur den
    Eingang liest, bekommt siebenmal dasselbe Grau — und das Tier steht als weisse
    Flaeche im Bild.

    Deshalb wird der Knotenbaum nach oben abgelaufen und der erste **unverlinkte**
    Farbwert genommen, der nicht das Standardgrau ist.
    """
    if not socket.is_linked:
        v = socket.default_value
        return (v[0], v[1], v[2])
    if tiefe > 6:
        return None
    knoten = socket.links[0].from_node
    if knoten.type in ('VERTEX_COLOR', 'ATTRIBUTE'):
        return None                      # Farbe steckt im Attribut, nicht hier
    ersatz = None
    for eingang in knoten.inputs:
        if eingang.type != 'RGBA':
            continue
        c = farbe_hinter(eingang, tiefe + 1)
        if c is None:
            continue
        if max(abs(c[i] - NEUTRAL[i]) for i in range(3)) > 0.01:
            return c                     # eine echte Farbe schlaegt das Grau
        ersatz = ersatz or c
    return ersatz


def basisfarben(mesh):
    """Basisfarbe je Materialslot, linear."""
    raus = []
    for mat in mesh.materials:
        c = None
        if mat and mat.use_nodes:
            for n in mat.node_tree.nodes:
                if n.type == 'BSDF_PRINCIPLED':
                    c = farbe_hinter(n.inputs['Base Color'])
                    break
        if c is None and mat:
            d = mat.diffuse_color
            c = (d[0], d[1], d[2])
        raus.append(c or (0.5, 0.5, 0.5))
    return raus or [(0.5, 0.5, 0.5)]


os.makedirs(ZIEL, exist_ok=True)
register = {}

for datei, kid in (list(EIGEN.items()) if EIGEN else ZUORDNUNG):
    pfad = f'{QUELLE}/{datei}.glb'
    if not os.path.exists(pfad):
        print(f'{kid}: {pfad} fehlt'); continue
    inhalt = json.load(open(f'content/creatures/{kid}.json'))
    ziel_tris = int(inhalt.get('zielTris') or 3000)
    hoehe = WIDERRIST.get(inhalt.get('basisRig', 'quadruped'), 1.0)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=pfad)
    netze = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    # Jede Weltmatrix in die eigenen Daten backen, **bevor** verbunden wird —
    # sonst verdreht der Join die Achsen (der glTF-Import haelt Y-oben in der
    # Objektmatrix). Und **alle** Netze behalten: Beim Hirsch ist eines davon das
    # Geweih, also genau das Teil, das ihn vom Reh unterscheidet.
    for o in netze:
        o.data.transform(o.matrix_world)
        o.matrix_world = Matrix()
    koerper = max(netze, key=lambda o: len(o.data.polygons))
    if len(netze) > 1:
        bpy.ops.object.select_all(action='DESELECT')
        for o in netze:
            o.select_set(True)
        bpy.context.view_layer.objects.active = koerper
        bpy.ops.object.join()
        koerper = bpy.context.view_layer.objects.active
    # Nach dem Join traegt das aktive Objekt noch seine eigene Matrix, und der Join
    # hat die Daten in dessen lokalen Raum zurueckgerechnet. Ohne diese Zeile wendet
    # der Export sie ein zweites Mal an — die Modelle kamen mit 1/100 der Groesse an.
    koerper.data.transform(koerper.matrix_world)
    # **Zuweisen, nicht `.identity()` aufrufen.** `matrix_world` gibt eine Kopie
    # zurueck; `.identity()` darauf aendert am Objekt nichts. Die Modelle trugen
    # dadurch im Export eine Knotenskalierung von 0,01 — die Geometrie war richtig,
    # der Knoten machte sie hundertmal zu klein.
    koerper.matrix_world = Matrix()
    for o in list(bpy.context.scene.objects):
        if o is not koerper:
            bpy.data.objects.remove(o, do_unlink=True)
    m = koerper.data

    # --- Farbe an den Vertex, Helligkeit in die Palette ---------------------
    #
    # **Zwei Quellen, und die falsche zu nehmen faellt erst im Bild auf.** Vier der
    # fuenf Modelle tragen die Farbe in den Materialien; das Reh bringt sie als
    # **Farbattribut** mit und hat nur Standardmaterialien. Wer stur die Materialien
    # liest, bekommt dort siebenmal dasselbe Grau (Leuchtdichte 0,800) — und das Tier
    # steht als weisse Flaeche im Bild.
    vorhanden = m.color_attributes[0] if m.color_attributes else None
    # Ein mitgeliefertes Attribut nur nehmen, wenn ueberhaupt Farbe drinsteht:
    # Das Reh bringt ein durchgehend weisses mit, das nichts traegt.
    if vorhanden is not None and vorhanden.domain == 'CORNER':
        probe = [tuple(vorhanden.data[i].color[:3]) for i in range(0, len(m.loops), 97)]
        if all(min(c) > 0.97 for c in probe) or all(max(c) < 0.03 for c in probe):
            vorhanden = None
    if vorhanden is not None:
        roh = [tuple(vorhanden.data[li].color[:3]) for li in range(len(m.loops))]
        quelle = 'Farbattribut'
    else:
        farben = basisfarben(m)
        roh = [farben[min(pol.material_index, len(farben) - 1)]
               for pol in m.polygons for _ in pol.loop_indices]
        quelle = 'Materialien'

    lums = [leuchtdichte(c) for c in roh]
    lo, hi = min(lums), max(lums)
    spanne = max(1e-4, hi - lo)

    while m.color_attributes:
        m.color_attributes.remove(m.color_attributes[0])
    attr = m.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
    k = 0
    for pol in m.polygons:
        pol.use_smooth = False
        for li in pol.loop_indices:
            c = roh[li] if quelle == 'Farbattribut' else roh[k]
            l = leuchtdichte(c)
            ziel_l = BAND_UNTEN + (l - lo) / spanne * (BAND_OBEN - BAND_UNTEN)
            f = ziel_l / max(1e-4, l)
            attr.data[li].color = tuple(min(1.0, x * f) for x in c) + (1.0,)
            k += 1

    vorher = len(m.polygons)
    # --- Dreiecke aufs Budget ----------------------------------------------
    if vorher > ziel_tris:
        mod = koerper.modifiers.new('reduzieren', 'DECIMATE')
        mod.ratio = ziel_tris / vorher
        bpy.context.view_layer.objects.active = koerper
        bpy.ops.object.modifier_apply(modifier=mod.name)
        m = koerper.data

    # --- Ein Material, Vertexfarbe ------------------------------------------
    m.materials.clear()
    mat = bpy.data.materials.new(f'kreatur_{kid}')
    mat.use_nodes = True
    b = mat.node_tree.nodes['Principled BSDF']
    b.inputs['Roughness'].default_value = 1.0
    b.inputs['Metallic'].default_value = 0.0
    kn = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    kn.layer_name = 'Color'
    mat.node_tree.links.new(kn.outputs['Color'], b.inputs['Base Color'])
    m.materials.append(mat)

    # --- Auf 1 m Widerristhoehe, Nase nach -Z, Fuesse auf y = 0 -------------
    #
    # Die Szene dreht Kreaturen ueber `rotation-y` und skaliert sie ueber die
    # Mutationsstufe. Damit beides stimmt, muss das Modell genormt ankommen:
    # Blickrichtung -Z wie die Spielerfigur, Ursprung zwischen den Fuessen.
    lo3 = Vector((1e9,) * 3); hi3 = Vector((-1e9,) * 3)
    for v in m.vertices:
        for i in range(3):
            lo3[i] = min(lo3[i], v.co[i]); hi3[i] = max(hi3[i], v.co[i])
    s = hoehe / (hi3.z - lo3.z)
    laengs_y = (hi3.y - lo3.y) > (hi3.x - lo3.x)
    mi = (lo3 + hi3) / 2
    for v in m.vertices:
        px, py = (v.co.y, v.co.x) if laengs_y else (v.co.x, v.co.y)
        mx, my = (mi.y, mi.x) if laengs_y else (mi.x, mi.y)
        # glTF-Export dreht Z-oben zurueck nach Y-oben; hier bleibt Blender-Konvention.
        v.co = Vector(((py - my) * s, (px - mx) * s, (v.co.z - lo3.z) * s))

    # Objekt-Transform restlos zuruecksetzen. `matrix_world = Matrix()` allein
    # reicht nicht, wenn ein **Delta**-Transform gesetzt ist: Der glTF-Import legt
    # die Einheitenumrechnung dort ab, und der Export schreibt sie als
    # Knotenskalierung 0,01 wieder heraus — die Geometrie stimmt, das Modell kommt
    # trotzdem hundertmal zu klein im Spiel an.
    koerper.location = (0, 0, 0)
    koerper.rotation_euler = (0, 0, 0)
    koerper.scale = (1, 1, 1)
    koerper.delta_location = (0, 0, 0)
    koerper.delta_rotation_euler = (0, 0, 0)
    koerper.delta_scale = (1, 1, 1)
    koerper.matrix_world = Matrix()
    bpy.ops.object.select_all(action='DESELECT')
    koerper.select_set(True)
    bpy.context.view_layer.objects.active = koerper
    aus = f'{ZIEL}/{kid}.glb'
    bpy.ops.export_scene.gltf(filepath=aus, export_format='GLB',
                              use_selection=True, export_apply=True,
                              export_materials='EXPORT', export_yup=True)
    kb = os.path.getsize(aus) / 1024
    register[kid] = round(kb, 1)
    print(f'{kid:14} {datei:7} {vorher:5} → {len(m.polygons):5} Dreiecke · '
          f'Farbe aus {quelle} · Widerrist {hoehe} m · {kb:.0f} KB')

json.dump({'modelle': sorted(register)}, open(f'{ZIEL}/register.json', 'w'),
          ensure_ascii=False, indent=1)
print(f'\n{len(register)} Modelle · Register nach {ZIEL}/register.json')
