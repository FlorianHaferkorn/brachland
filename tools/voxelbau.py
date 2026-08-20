"""BRACHLAND — KI-Rohmodell zu spieltauglicher Geometrie, ueber Voxel-Remesh.

## Warum es diesen Schritt gibt

`reduce.mjs` **dezimiert**: Es kollabiert Kanten, bis die Zielzahl erreicht ist.
An KI-generiertem Fell geht das nicht weit genug. Gemessen hat das Fuchsmodell
**583 getrennte Teile und 30.216 offene Kanten** — jede Fellstraehne ist eine
eigene Schale, und deren Mindestflaechen summieren sich zu einer Untergrenze von
**3.194 Flaechen**, die keine Fehlertoleranz unterschreitet (G-88).

Ein **Voxel-Remesh** dezimiert nicht, sondern baut die Oberflaeche aus einem
Distanzfeld neu. Dabei verschmelzen die Schalen zu einem Koerper: 583 Teile → 2,
205.328 → **1.756 Dreiecke**, und die Silhouette wird dabei *sauberer* als die
dezimierte bei doppelter Dreieckszahl (G-94).

Quadriflow, der naheliegendere Kandidat, scheitert an derselben Geometrie
**stillschweigend**: 205.328 → 205.328 bei jedem Ziel, ohne Fehlermeldung, weil er
geschlossene Netze verlangt. Wer nur die Zielzahl liest, haelt das fuer Erfolg.

## Der Preis, und wie er bezahlt wird

Der Voxel-Remesh wirft die **UV-Karte** weg — er erzeugt eine voellig neue
Oberflaeche, die von der alten nichts weiss. Damit kann `entkleiden.mjs` die
Basisfarbe nicht mehr an der UV abtasten.

Dieses Skript loest das, bevor die UV verlorengeht: Fuer jeden Vertex des neuen
Netzes wird der **naechste Punkt auf dem Originalnetz** gesucht, dort die UV
baryzentrisch interpoliert und die Basisfarbtextur abgetastet — ueber dasselbe
5x5-Fenster wie in `entkleiden.mjs`, aus demselben Grund (ein einzelner Griff
traefe jedes JPEG-Artefakt mit voller Wucht). Das Ergebnis liegt als
Farbattribut am neuen Netz — dieselbe Materialsprache wie bei den Props (D74,
D80), nur ueber einen Umweg, den die Geometrie erzwingt.

## Aufruf

    blender --background --python tools/voxelbau.py -- <ein.glb> <aus.glb> [vorgabe]

`vorgabe` ist entweder eine **Zieldreieckszahl** (Vorgabe 2700) — dann sucht das
Skript die passende Voxelgroesse per Bisektion — oder `voxel:<zahl>` fuer eine
feste Kantenlaenge. Die Kantenlaenge ist auf die **laengste Achse des Modells**
bezogen, nicht auf Meter, damit dieselbe Zahl fuer Murmeltier und Steinbock
gilt.

Warum 2.700 und nicht weniger: Am Fuchs, jeweils am Ende der ganzen Kette
gemessen (geriggt, drei Animationen, entkleidet, nachbereitet):

    1.772 Dreiecke → 106 KB   die Schnauze wird ein stumpfer Keil
    2.728 Dreiecke → 121 KB   Schnauze und Ohren lesbar, Netz ruhig  ← Vorgabe
    3.608 Dreiecke → 135 KB   minimal feiner, dafuer unruhigerer Ruecken

Die Zahl steht nicht in der Datei, weil sie schoen aussieht, sondern weil bei
1.800 der Kopf kippt und bei 3.600 nur noch Bytes dazukommen. Wer daran dreht,
rendert die drei Koepfe nebeneinander, bevor er sich entscheidet — die
Dreieckszahlen allein haetten hier zu 1.800 gefuehrt.
"""
import bpy
import sys
import numpy as np
from collections import defaultdict
from mathutils import Vector
from mathutils.geometry import barycentric_transform, closest_point_on_tri

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(argv) < 2:
    print('[voxelbau] Aufruf: -- <ein.glb> <aus.glb> [zielDreiecke | voxel:0.035]')
    sys.exit(1)
QUELLE, ZIEL = argv[0], argv[1]
VORGABE = argv[2] if len(argv) > 2 else '2700'

FESTE_GROESSE = float(VORGABE.split(':', 1)[1]) if VORGABE.startswith('voxel:') else None
ZIEL_TRIS = None if FESTE_GROESSE else int(VORGABE)

# Suchgrenzen der Bisektion, als Anteil der laengsten Achse. Unten 0,010, weil
# ein feineres Gitter (100^3 Zellen und mehr) Minuten kostet und ohnehin
# jenseits jeder Budgetgrenze liegt; oben 0,120, weil ab etwa 0,060 der Kopf
# zerfaellt und alles darueber nur noch die Suche beendet.
GROB, FEIN = 0.120, 0.010
SCHRITTE = 9
FENSTER = 2          # Radius des Abtastfensters in Texeln, wie entkleiden.mjs


def sag(*t):
    print('[voxelbau]', *t)


def saeubern():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for d in list(block):
            if d.users == 0:
                block.remove(d)


def nur(objekt):
    """Ein Objekt aktiv und allein selektiert — was `bpy.ops` durchweg erwartet."""
    bpy.ops.object.select_all(action='DESELECT')
    objekt.select_set(True)
    bpy.context.view_layer.objects.active = objekt


def eines(objekte):
    """Alle Meshes zu einem verbinden — Voxel-Remesh arbeitet auf einem Objekt."""
    for o in objekte:
        if o.parent:
            # Elternschaft loesen, Weltlage behalten. Sonst wandert das Mesh
            # beim `transform_apply` an eine andere Stelle als das Original,
            # und die Naechster-Punkt-Suche greift ins Leere.
            nur(o)
            bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.select_all(action='DESELECT')
    for o in objekte:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objekte[0]
    if len(objekte) > 1:
        bpy.ops.object.join()
    ziel = bpy.context.view_layer.objects.active
    nur(ziel)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return ziel


def dreiecke(objekt):
    objekt.data.calc_loop_triangles()
    return len(objekt.data.loop_triangles)


def kopie(objekt):
    neu = objekt.copy()
    neu.data = objekt.data.copy()
    bpy.context.collection.objects.link(neu)
    return neu


def remesh(objekt, groesse):
    objekt.data.remesh_voxel_size = groesse
    objekt.data.remesh_voxel_adaptivity = 0.0
    nur(objekt)
    bpy.ops.object.voxel_remesh()
    return objekt


def suche_groesse(quelle, ziel_tris, spanne):
    """Voxelgroesse zur Zieldreieckszahl per Bisektion.

    Die Dreieckszahl faellt streng monoton mit der Voxelgroesse — das reicht
    fuer eine Bisektion und macht jede Formel ueberfluessig. Neun Schritte
    engen [0,120 … 0,010] auf rund 0,0002 ein, also weit unter das, was man
    sieht. Abbruch schon vorher, sobald die Zahl auf 8 % herankommt: Genauer
    ist sinnlos, weil der Remesh selbst in Spruengen von Dutzenden Dreiecken
    antwortet.
    """
    lo, hi = FEIN, GROB          # lo = feines Gitter = viele Dreiecke
    bester, beste_zahl, beste_groesse = None, None, None
    for i in range(SCHRITTE):
        mitte = (lo + hi) / 2
        k = remesh(kopie(quelle), mitte * spanne)
        n = dreiecke(k)
        if beste_zahl is None or abs(n - ziel_tris) < abs(beste_zahl - ziel_tris):
            if bester is not None:
                bpy.data.objects.remove(bester, do_unlink=True)
            bester, beste_zahl, beste_groesse = k, n, mitte
        else:
            bpy.data.objects.remove(k, do_unlink=True)
        sag(f'  Suche {i + 1}/{SCHRITTE}: Voxel {mitte:.4f} → {n} Dreiecke')
        if abs(n - ziel_tris) <= ziel_tris * 0.08:
            break
        if n > ziel_tris:
            lo = mitte           # zu fein → groeber werden
        else:
            hi = mitte
    return bester, beste_groesse, beste_zahl


def entgamma(a):
    """sRGB zu linear — wortgleich zu `linear()` in entkleiden.mjs.

    Blender liefert `image.pixels` bei 8-Bit-Bildern als Byte/255 **ohne**
    Farbmanagement. Die Werte sind also noch sRGB-kodiert und muessen von Hand
    linearisiert werden; three.js rechnet Vertexfarben linear. Bei Bildern, die
    schon linear vorliegen (`Non-Color`, 32-Bit-Float), unterbleibt das.
    """
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def hole_bild(bild):
    w, h = bild.size
    if w == 0 or h == 0:
        return None
    roh = np.empty(w * h * 4, dtype=np.float32)
    bild.pixels.foreach_get(roh)
    a = roh.reshape(h, w, 4)
    if bild.colorspace_settings.name == 'sRGB':
        a = a.copy()
        a[..., :3] = entgamma(a[..., :3])
    return a


def abtasten(bild, u, v):
    """Farbe an einer UV-Koordinate, gemittelt ueber ein 5x5-Texelfenster.

    **Nicht** der naechste Texel, und aus demselben Grund wie in
    `entkleiden.mjs`: Nach dem Remesh tragen wenige hundert Vertices eine
    1024er-Textur, jeder steht also fuer tausende Texel. Ein einzelner Griff
    traefe mit voller Wucht jedes JPEG-Artefakt — bei fotografischem
    Quellmaterial genau die Sprenkel, die man hinterher als Rauschen sieht.

    Blenders Pixelpuffer beginnt unten links, glTF-UV ebenso — kein Umdrehen.
    """
    h, w = bild.shape[0], bild.shape[1]
    x = int(round((u - np.floor(u)) * (w - 1)))
    y = int(round((v - np.floor(v)) * (h - 1)))
    fenster = bild[max(0, y - FENSTER):min(h, y + FENSTER + 1),
                   max(0, x - FENSTER):min(w, x + FENSTER + 1), :3]
    return fenster.reshape(-1, 3).mean(axis=0)


GRAU = np.array([0.8, 0.8, 0.8], dtype=np.float32)
_bildcache = {}


def quellfarben(objekt):
    """Je Materialslot: ein linearisiertes Bild, sonst die Ersatz-Grundfarbe.

    Die Ersatzfarbe ist kein Luxus. Ein fehlendes COLOR_0 liefert in WebGL bei
    `vertexColors: true` schwarz — daran waren schon einmal 22.638 Buesche
    unsichtbar (G-76). Lieber die Grundfarbe des Materials als nichts.
    """
    tabelle = []
    for mat in objekt.data.materials:
        bild, grund = None, GRAU
        if mat and mat.use_nodes:
            knoten = list(mat.node_tree.nodes)
            for n in knoten:
                if n.type != 'BSDF_PRINCIPLED':
                    continue
                ein = n.inputs['Base Color']
                grund = np.array(ein.default_value[:3], dtype=np.float32)
                if ein.links and ein.links[0].from_node.type == 'TEX_IMAGE':
                    bild = ein.links[0].from_node.image
                break
            if bild is None:
                # Kein direkter Draht zur Basisfarbe — etwa weil ein Mix- oder
                # Gamma-Knoten dazwischenhaengt. Gibt es genau ein Bild im
                # Material, ist die Sache trotzdem eindeutig.
                bilder = [n.image for n in knoten
                          if n.type == 'TEX_IMAGE' and n.image]
                if len(bilder) == 1:
                    bild = bilder[0]
        daten = None
        if bild is not None:
            if bild.name not in _bildcache:
                _bildcache[bild.name] = hole_bild(bild)
            daten = _bildcache[bild.name]
        tabelle.append((daten, grund))
    return tabelle or [(None, GRAU)]


def uebertrage(neu, alt, tabelle):
    """Farbe vom Original auf das neue Netz — ueber den naechsten Punkt.

    Der Voxel-Remesh kennt das Original nicht. Die Bruecke ist rein
    geometrisch: naechster Punkt auf der alten Oberflaeche, dort das Dreieck,
    dort die UV baryzentrisch, dort die Textur.
    """
    mesh = alt.data
    mesh.calc_loop_triangles()
    uv = mesh.uv_layers.active.data if mesh.uv_layers.active else None
    nach_poly = defaultdict(list)
    for lt in mesh.loop_triangles:
        nach_poly[lt.polygon_index].append(lt)
    ecken = mesh.vertices

    farben = np.zeros((len(neu.data.vertices), 4), dtype=np.float32)
    farben[:, 3] = 1.0
    ersatz = 0
    for i, v in enumerate(neu.data.vertices):
        treffer, ort, _, fi = alt.closest_point_on_mesh(v.co)
        slot = mesh.polygons[fi].material_index if treffer else 0
        bild, grund = tabelle[slot] if slot < len(tabelle) else tabelle[0]
        bestes, bester_ort, beste_d = None, None, float('inf')
        if treffer and bild is not None and uv is not None:
            for lt in nach_poly.get(fi, ()):
                p = [ecken[k].co for k in lt.vertices]
                q = closest_point_on_tri(ort, p[0], p[1], p[2])
                d = (q - ort).length_squared
                if d < beste_d:
                    beste_d, bester_ort, bestes = d, q, lt
        if bestes is None:
            farben[i, :3] = grund
            ersatz += 1
            continue
        p = [ecken[k].co for k in bestes.vertices]
        t = [uv[l].uv for l in bestes.loops]
        try:
            k = barycentric_transform(bester_ort, p[0], p[1], p[2],
                                      Vector((t[0][0], t[0][1], 0.0)),
                                      Vector((t[1][0], t[1][1], 0.0)),
                                      Vector((t[2][0], t[2][1], 0.0)))
            u_, v_ = k.x, k.y
        except ValueError:
            # Entartetes Dreieck ohne Flaeche — dort ist jede UV so gut wie jede.
            u_, v_ = t[0][0], t[0][1]
        farben[i, :3] = abtasten(bild, u_, v_)
    return farben, ersatz


def schreibe_farbattribut(objekt, farben):
    mesh = objekt.data
    for a in list(mesh.color_attributes):
        mesh.color_attributes.remove(a)
    attr = mesh.color_attributes.new(name='Col', type='FLOAT_COLOR', domain='POINT')
    attr.data.foreach_set('color', farben.reshape(-1))
    try:
        mesh.color_attributes.active_color_index = 0
        mesh.color_attributes.render_color_index = 0
    except (AttributeError, TypeError):
        pass


def farbmaterial(objekt):
    """Ein Material, das die Vertexfarbe liest.

    Der Exporteur schreibt COLOR_0 nur dann, wenn das Material das Attribut
    auch benutzt. Ohne diesen Knoten faellt die gerade uebertragene Farbe beim
    Export still wieder heraus — die Datei bliebe gueltig und waere sogar
    kleiner, also faellt es in keiner Groessenmessung auf.
    """
    mat = bpy.data.materials.new('brachland_vertexfarbe')
    mat.use_nodes = True
    baum = mat.node_tree
    bsdf = next(n for n in baum.nodes if n.type == 'BSDF_PRINCIPLED')
    quelle = baum.nodes.new('ShaderNodeVertexColor')
    quelle.layer_name = 'Col'
    baum.links.new(quelle.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 1.0
    bsdf.inputs['Metallic'].default_value = 0.0
    objekt.data.materials.clear()
    objekt.data.materials.append(mat)


def exportiere(pfad):
    grund = dict(filepath=pfad, export_format='GLB', use_selection=False,
                 export_apply=True, export_texcoords=False,
                 export_materials='EXPORT')
    # `export_vertex_color` heisst nicht in jeder Blender-Fassung gleich und gab
    # es frueher gar nicht. Erst der ausdrueckliche Weg, dann der ueber das
    # Material, dann die Vorgabe — statt eine Fassung vorauszusetzen.
    for zusatz in ({'export_vertex_color': 'ACTIVE'},
                   {'export_vertex_color': 'MATERIAL'},
                   {}):
        try:
            bpy.ops.export_scene.gltf(**grund, **zusatz)
            return zusatz.get('export_vertex_color', 'Vorgabe')
        except TypeError:
            continue
    raise RuntimeError('glTF-Export abgelehnt')


saeubern()
bpy.ops.import_scene.gltf(filepath=QUELLE)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if not meshes:
    sag('FEHLER: kein Mesh in', QUELLE)
    sys.exit(1)

alt = eines(meshes)
vorher = dreiecke(alt)
spanne = max(alt.dimensions)
tabelle = quellfarben(alt)
mit_bild = sum(1 for b, _ in tabelle if b is not None)
sag(f'{QUELLE.split("/")[-1]}: {vorher} Dreiecke, {len(tabelle)} Materialslots '
    f'({mit_bild} mit Basisfarbtextur), laengste Achse {spanne:.3f}')

if FESTE_GROESSE:
    neu = remesh(kopie(alt), FESTE_GROESSE * spanne)
    groesse, nachher = FESTE_GROESSE, dreiecke(neu)
else:
    neu, groesse, nachher = suche_groesse(alt, ZIEL_TRIS, spanne)
if neu is None or nachher == 0:
    sag('FEHLER: Remesh lieferte kein Netz')
    sys.exit(1)

farben, ersatz = uebertrage(neu, alt, tabelle)
schreibe_farbattribut(neu, farben)
farbmaterial(neu)

bpy.data.objects.remove(alt, do_unlink=True)
neu.name = 'kreatur'
neu.data.name = 'kreatur'
weg = exportiere(ZIEL)

mittel = farben[:, :3].mean(axis=0)
sag(f'Voxel {groesse:.4f} · {vorher} → {nachher} Dreiecke '
    f'({100 * nachher / vorher:.1f} %), {len(farben)} Vertices gefaerbt')
sag(f'Mittlere Farbe linear ({mittel[0]:.3f}, {mittel[1]:.3f}, {mittel[2]:.3f})'
    + (f'   ⚠️  {ersatz} Vertices ohne Texturtreffer — Grundfarbe genommen'
       if ersatz else ''))
sag(f'geschrieben: {ZIEL}  (Vertexfarbe ueber "{weg}")')
