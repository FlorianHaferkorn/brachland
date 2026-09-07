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
(heute `tools/palettecheck.ts`), liegt die Saettigung im Median bei **0,52**; die Welt ist
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
    ('boar',   'wurzelkeiler'),
]

# Netze, die eine Quelle mitbringt und die hier nicht hingehoeren. Der Hirsch
# traegt sein Geweih als eigenes Netz `Stag_Horns` — 1.616 Flaechen, und der
# Grathorn traegt laut `content/creatures/grathorn.json` kein Hirschgeweih,
# sondern ein Chitinplatten-Gehoern. Es faellt weg, der Anbau ersetzt es.
WEGLASSEN = {'hirsch': ('Stag_Horns',)}

# **Alle fuenf Quellen blicken nach glTF +Z, die Szene will -Z.** Spielerfigur
# und Silhouette schauen nach -Z (`baueKreaturGeometrie`), und die Modelle liefen
# dadurch rueckwaerts durch die Welt. Nachgesehen und nicht geraten: Bei Hirsch,
# Reh, Wolf und Fuchs liegen die Augen- und Nasenmaterialien am -y-Ende in
# Blender, und Blender -y ist glTF +z; beim Boar (ein Material) zeigt der
# Seitenriss dasselbe. Zwei naheliegende Automatiken habe ich gemessen und
# verworfen — der Ueberhang ueber die Fuesse faellt bei Wolf und Fuchs auf die
# lange Rute herein, die Randhoehe beim Boar auf den Ruecken. Deshalb eine
# Drehung um die Hochachse fuer alle, geprueft am Reihenbild.
DREHUNG_180 = True

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
# Aus `src/world/palette.ts` (D117) — die eine Farbquelle, auch fuer die Kette.
import re as _re
_pal = open('src/world/palette.ts').read()
_m = _re.search(r'kreaturBand:\s*\{\s*unten:\s*([0-9.]+),\s*oben:\s*([0-9.]+)', _pal)
if not _m:
    raise SystemExit('kreaturBand nicht in src/world/palette.ts gefunden')
BAND_UNTEN, BAND_OBEN = float(_m.group(1)), float(_m.group(2))

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
    # **Netze ohne Material fliegen raus.** Alle vier Quaternius-Modelle bringen
    # eine `Icosphere` mit 80 Flaechen mit, die zu nichts gehoert und im Koerper
    # steckt — unsichtbar, aber sie zaehlt gegen `zielTris` und verschweisst sich
    # nirgends.
    netze = [o for o in netze if o.data.materials]
    # **Und je Quelle das, was durch einen Anbau ersetzt wird.** Das Geweih des
    # Hirschs ist ein eigenes Netz mit 1.616 der 3.667 Flaechen — 44 % des Budgets
    # fuer ein Hirschgeweih, waehrend der Grathorn laut `content/creatures` ein
    # **Chitinplatten-Gehoern** traegt. Es faellt weg, und der Anbau kommt an
    # seiner Stelle aus `src/world/kreaturgestalt.ts`.
    for name in WEGLASSEN.get(datei, ()):
        weg = [o for o in netze if o.name == name]
        if not weg:
            print(f'  ! {datei}: Netz {name!r} nicht gefunden — Quelle geaendert?')
        netze = [o for o in netze if o.name != name]
    # Jede Weltmatrix in die eigenen Daten backen, **bevor** verbunden wird —
    # sonst verdreht der Join die Achsen (der glTF-Import haelt Y-oben in der
    # Objektmatrix).
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
    # **BYTE_COLOR, nicht FLOAT_COLOR.** Bei 3.000 Flaechen sind das 9.000 Loops;
    # als 32-Bit-Float kostet die Farbe allein 144 KB, als Byte 36 KB. Das
    # Qualitaetstor hat den Unterschied sofort gemeldet: 334 KB gegen ein Budget
    # von 190 KB. Acht Bit reichen fuer flache Materialfarben ohne Verlauf.
    attr = m.color_attributes.new(name='Color', type='BYTE_COLOR', domain='CORNER')
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

    # --- Umgebungsverdeckung in die Vertexfarbe backen (Phase 1, AO) ---------
    #
    # Der billigste Kontaktschatten, den es gibt: einmal in Cycles gerechnet,
    # als Faktor auf die Farbe multipliziert, zur Laufzeit null Kosten. Zwischen
    # den Beinen, unter dem Bauch, in der Halsfalte wird das Tier dunkler — das
    # ist die Kantenabdunklung, die der Stilreferenz ihre Plastizitaet gibt
    # (G-126) und die Flat Shading allein nie liefert.
    ao_staerke = 0.7
    try:
        bpy.context.scene.render.engine = 'CYCLES'
        bpy.context.scene.cycles.device = 'CPU'
        bpy.context.scene.cycles.samples = 24
        bpy.context.scene.render.bake.target = 'VERTEX_COLORS'
        welt = bpy.context.scene.world or bpy.data.worlds.new('Welt')
        bpy.context.scene.world = welt
        # AO-Reichweite in Quelleinheiten: gut die halbe Tierhoehe, damit die
        # Beine sich gegenseitig verschatten, der Ruecken aber frei bleibt.
        hoehe_roh = max(v.co.z for v in m.vertices) - min(v.co.z for v in m.vertices)
        welt.light_settings.distance = hoehe_roh * 0.55
        ao_attr = m.color_attributes.new(name='AO', type='BYTE_COLOR', domain='CORNER')
        m.color_attributes.active_color = ao_attr
        bpy.ops.object.select_all(action='DESELECT')
        koerper.select_set(True)
        bpy.context.view_layer.objects.active = koerper
        bpy.ops.object.bake(type='AO')
        farbe = m.color_attributes['Color']
        ao_mittel = 0.0
        for li in range(len(m.loops)):
            a = ao_attr.data[li].color[0]
            ao_mittel += a
            k = (1 - ao_staerke) + ao_staerke * a
            c = farbe.data[li].color
            farbe.data[li].color = (c[0] * k, c[1] * k, c[2] * k, 1.0)
        m.color_attributes.remove(ao_attr)
        m.color_attributes.active_color = m.color_attributes['Color']
        print(f'  AO gebacken: Mittel {ao_mittel / max(1, len(m.loops)):.2f}')
    except Exception as fehler:  # noqa: BLE001 — ein fehlgeschlagener Bake darf den Export nicht anhalten
        print(f'  ! AO nicht gebacken: {fehler}')

    # --- Auf 1 m Widerristhoehe, Nase nach -Z, Fuesse auf y = 0 -------------
    #
    # Die Szene dreht Kreaturen ueber `rotation-y` und skaliert sie ueber die
    # Mutationsstufe. Damit beides stimmt, muss das Modell genormt ankommen:
    # Blickrichtung -Z wie die Spielerfigur, Ursprung zwischen den Fuessen.
    lo3 = Vector((1e9,) * 3); hi3 = Vector((-1e9,) * 3)
    for v in m.vertices:
        for i in range(3):
            lo3[i] = min(lo3[i], v.co[i]); hi3[i] = max(hi3[i], v.co[i])
    laengs_y = (hi3.y - lo3.y) > (hi3.x - lo3.x)
    lang = 1 if laengs_y else 0
    # **Auf den Widerrist normen, nicht auf die Gesamthoehe.** `WIDERRIST` heisst
    # so und der Kommentar sagte es auch — gerechnet wurde trotzdem mit
    # `hi3.z - lo3.z`, also mit der Kruecke ueber alles. Bei einem Tier mit
    # erhobenem Kopf ist das der Kopf, beim Hirsch war es das Geweih: Der Hirsch
    # kam mit 0,84 m Rumpflaenge neben einem 2,07 m langen Wolf an und las sich
    # als Kitz. Gemessen wird jetzt die **Rueckenlinie ueber dem Rumpf**: der
    # Abschnitt zwischen den Vorder- und den Hinterhufen, Scheibe fuer Scheibe der
    # hoechste Punkt. Ein Ruecken ist waagerecht; was aus dieser Linie deutlich
    # herausragt, ist Hals oder Kopf und faellt heraus. Der Widerrist ist das
    # hoechste, was bleibt.
    #
    # Drei einfachere Regeln habe ich vorher gemessen und verworfen, alle drei am
    # selben Tier: Das Reh dieser Sammlung traegt den Hals **senkrecht ueber den
    # Vorderbeinen**. Ein festes Fenster (25–75 % der Laenge) nimmt den
    # Halsansatz mit — 1,03 m Laenge bei 1,00 m Widerrist, ein Reh so lang wie
    # hoch. „Hoechster Punkt ueber den Vorderbeinen" trifft dort den Kopf. Und
    # „nur breite Scheiben" trifft ihn auch, weil eine Scheibe am Kopfende dann
    # die Vorderbeine mit enthaelt und damit breit ist — und die Breite der
    # obersten Handbreit scheitert an den Ohren.
    l0, l1 = lo3[lang], hi3[lang]
    L, H = l1 - l0, hi3.z - lo3.z
    hufe = [c[lang] for c in (v.co for v in m.vertices) if c[2] < lo3.z + H * 0.08]
    t0, t1 = (min(hufe), max(hufe)) if hufe else (l0 + L * 0.2, l1 - L * 0.2)
    SCHEIBEN = 24
    linie = []
    for i in range(SCHEIBEN):
        a = t0 + (t1 - t0) * i / SCHEIBEN
        b = t0 + (t1 - t0) * (i + 1) / SCHEIBEN
        hoch = [v.co.z for v in m.vertices if a <= v.co[lang] < b]
        if hoch:
            linie.append(max(hoch))
    linie.sort()
    # **85. Perzentil, nicht das Maximum und nicht der Median plus Zuschlag.**
    # Das Maximum trifft den Hals, wo er ueber dem Rumpf steht. „Median plus ein
    # Achtel der Hoehe" hat dafuer den **Keiler** verloren: Sein Ruecken ist ein
    # Buckel, der Buckel lag ueber der Schranke und fiel heraus — das Tier kam
    # mit 2,59 m Laenge an, ein Drittel zu gross. Ein Perzentil zaehlt dagegen
    # Scheiben: Ein Buckel belegt viele, ein Hals zwei bis drei.
    ruecken = linie[min(len(linie) - 1, int(len(linie) * 0.85))] if linie else hi3.z
    s = hoehe / max(1e-6, ruecken - lo3.z)
    mi = (lo3 + hi3) / 2
    # **Um 180 Grad gedreht** (`DREHUNG_180`): beide waagerechten Achsen negiert,
    # nicht nur eine. Eine einzelne Negierung waere eine Spiegelung — sie kehrt
    # den Umlaufsinn der Dreiecke um, und das Modell waere von aussen weggeschnitten.
    d = -1.0 if DREHUNG_180 else 1.0
    for v in m.vertices:
        px, py = (v.co.y, v.co.x) if laengs_y else (v.co.x, v.co.y)
        mx, my = (mi.y, mi.x) if laengs_y else (mi.x, mi.y)
        # glTF-Export dreht Z-oben zurueck nach Y-oben; hier bleibt Blender-Konvention.
        v.co = Vector((d * (py - my) * s, d * (px - mx) * s, (v.co.z - lo3.z) * s))

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
    # **Ohne Normalen.** Die Szene setzt fuer Kreaturen `flatShading: true`
    # (`baueWindMaterial`), und three.js rechnet dann die Normale im Fragment aus
    # den Bildschirmableitungen — das exportierte NORMAL-Attribut wird nie
    # gelesen. Es kostete trotzdem ein Drittel der Datei: bei 8.968 Ecken sind
    # das 105 KB je Modell.
    bpy.ops.export_scene.gltf(filepath=aus, export_format='GLB',
                              use_selection=True, export_apply=True,
                              export_normals=False,
                              export_materials='EXPORT', export_yup=True)
    kb = os.path.getsize(aus) / 1024
    register[kid] = round(kb, 1)
    lo4 = Vector((1e9,) * 3); hi4 = Vector((-1e9,) * 3)
    for v in m.vertices:
        for i in range(3):
            lo4[i] = min(lo4[i], v.co[i]); hi4[i] = max(hi4[i], v.co[i])
    print(f'{kid:14} {datei:7} {vorher:5} → {len(m.polygons):5} Dreiecke · '
          f'Farbe aus {quelle} · Widerrist {hoehe} m, Scheitel {hi4.z:.2f} m · '
          f'{hi4.y - lo4.y:.2f} m lang · {kb:.0f} KB')

json.dump({'modelle': sorted(register)}, open(f'{ZIEL}/register.json', 'w'),
          ensure_ascii=False, indent=1)
print(f'\n{len(register)} Modelle · Register nach {ZIEL}/register.json')
