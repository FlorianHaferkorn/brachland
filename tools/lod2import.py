"""
LoD2-Import (D290): echte Trauf- und Firsthöhen, Dachform und Firstrichtung je Gebäude aus den amtlichen
3D-Gebäudemodellen der Bayerischen Vermessungsverwaltung (LoD2, CityGML 1.0, UTM 32N / DHHN2016).

  python3 tools/lod2import.py            # lädt fehlende Kacheln nach .cache/lod2/, schreibt public/world/oental-lod2.json
  python3 tools/lod2import.py --dachmasse 508 510 512 --kachelordner .cache/d331-massprobe
                                       # ergänzt die Dachkörperprobe ohne Abruf neuer Luftbilder
  python3 tools/lod2import.py --dachmasse 410 413 444 506 507 509 511 513 --koerper --kachelordner .cache/d331-massprobe
                                       # ergänzt Grundrisse und Dachpolygonringe der Milbinger Probe

D290 Dachfarbe: aus den Digitalen Orthophotos DOP20 (WMS `geoservices.bayern.de/od/wms/dop/v1/dop20`, Layer `by_dop20c`,
ebenfalls CC BY 4.0, kostenfrei) — je Gebäude der Median der Pixel unter den LoD2-Dachflächen (Feld "c", sRGB-Hex).
Luftbild-Kacheln 256 m mit 0,25 m/Pixel, zwischengespeichert in .cache/lod2/dop/.

Lizenz: CC BY 4.0 (Nutzungsbedingungen geodaten.bayern.de: „Die kostenfreien Datensätze … stehen unter CC BY 4.0“),
Namensnennung „Bayerische Vermessungsverwaltung – www.geodaten.bayern.de“, Änderungen angeben (assets/HERKUNFT.md).

Ausgabe: eine Liste in der Reihenfolge von `welt.gebaeude` (oental.json), je OSM-Gebäude `null` oder
{"t": Traufhöhe, "f": Firsthöhe über Grund in m, "d": Dachform (AdV-Schlüssel 1000 Flach, 2100 Pult, 3100 Sattel,
3200 Walm, 3300 Krüppelwalm, …), "w": Firstrichtung als Winkel in der Weltebene (atan2(dz, dx), Grad)}.
Feld "c": Dachfarbe aus DOP20 (siehe oben), sonnige Hälfte ohne Bewuchs und Module (D292). Zuordnung: der Grundriss-Schwerpunkt des LoD2-Gebäudes liegt im OSM-Grundriss; bei mehreren das grösste.
Die Dachkörperprobe ergänzt "p" (projizierter Firstwinkel) und bei mehreren Satteldachkörpern "teile" mit je
[Dachform, uMin, uMax, vMin, vMax, vFirst, Traufe, First]. u/v sind Meter ab
der OSM-Hülle auf der p-Achse. Traufe/First gelten über dem LoD2-Sockel des jeweiligen Teils.
Die Form des Hauses (Fassade, Material, Verfall) bleibt beim Generator; LoD2 liefert nur die echte Silhouette.
"""
import json
import math
import os
from argparse import ArgumentParser
import urllib.request
import xml.etree.ElementTree as ET

ROH = '.cache/lod2'
WELT = 'public/world/oental.json'
AUS = 'public/world/oental-lod2.json'
NS = {'bldg': 'http://www.opengis.net/citygml/building/1.0', 'gml': 'http://www.opengis.net/gml'}
A_WGS, F_WGS, K0, L0 = 6378137.0, 1 / 298.257223563, 0.9996, math.radians(9)
E2 = F_WGS * (2 - F_WGS)


def utm_nach_wgs(x, y):
    """UTM 32N → (lat, lon) in Grad (Snyder)."""
    ep2 = E2 / (1 - E2)
    x -= 500000
    m = y / K0
    mu = m / (A_WGS * (1 - E2 / 4 - 3 * E2 ** 2 / 64 - 5 * E2 ** 3 / 256))
    e1 = (1 - math.sqrt(1 - E2)) / (1 + math.sqrt(1 - E2))
    phi1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * math.sin(2 * mu) + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * math.sin(4 * mu) \
        + (151 * e1 ** 3 / 96) * math.sin(6 * mu)
    n1 = A_WGS / math.sqrt(1 - E2 * math.sin(phi1) ** 2)
    t1 = math.tan(phi1) ** 2
    c1 = ep2 * math.cos(phi1) ** 2
    r1 = A_WGS * (1 - E2) / (1 - E2 * math.sin(phi1) ** 2) ** 1.5
    d = x / (n1 * K0)
    lat = phi1 - (n1 * math.tan(phi1) / r1) * (d * d / 2 - (5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * ep2) * d ** 4 / 24
                                              + (61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * ep2 - 3 * c1 * c1) * d ** 6 / 720)
    lon = L0 + (d - (1 + 2 * t1 + c1) * d ** 3 / 6 + (5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * ep2 + 24 * t1 * t1) * d ** 5 / 120) / math.cos(phi1)
    return math.degrees(lat), math.degrees(lon)


def polygone(knoten):
    for pl in knoten.iter('{http://www.opengis.net/gml}posList'):
        w = [float(v) for v in pl.text.split()]
        yield [(w[i], w[i + 1], w[i + 2]) for i in range(0, len(w) - 2, 3)]


def wandring(grund):
    """Stützstellen der Dachkanten aus den geraden Wandfluchten entfernen."""
    ring = grund[:-1] if grund[0] == grund[-1] else grund[:]
    for _ in range(len(ring) - 3):
        for i, b in enumerate(ring):
            (ax, ay, _), (cx, cy, _) = ring[i - 1], ring[(i + 1) % len(ring)]
            bx, by, _ = b
            dx, dy = cx - ax, cy - ay
            laenge = math.hypot(dx, dy)
            if laenge and abs(dx * (by - ay) - dy * (bx - ax)) / laenge < .015 \
                    and 0 <= (bx - ax) * dx + (by - ay) * dy <= laenge ** 2:
                ring.pop(i)
                break
        else:
            break
    return ring + ring[:1]


def firstrichtung(firstkante, mittel_lat):
    """UTM-Firstpunkte mit derselben Meterabbildung wie im Spiel projizieren."""
    a, b = firstkante
    la, loa = utm_nach_wgs(*a[:2])
    lb, lob = utm_nach_wgs(*b[:2])
    dx = (lob - loa) * math.cos(math.radians(mittel_lat))
    dz = la - lb
    return round(math.degrees(math.atan2(dz, dx)), 2)


def kacheln(bbox):
    """2-km-Kacheln (UTM-km der SW-Ecke, gerade), die die bbox überdecken."""
    s, w, n, o = bbox
    def utm(lat, lon):
        phi, lam = math.radians(lat), math.radians(lon)
        ep2 = E2 / (1 - E2)
        nn = A_WGS / math.sqrt(1 - E2 * math.sin(phi) ** 2); t = math.tan(phi) ** 2; c = ep2 * math.cos(phi) ** 2; a = math.cos(phi) * (lam - L0)
        m = A_WGS * ((1 - E2 / 4 - 3 * E2 ** 2 / 64 - 5 * E2 ** 3 / 256) * phi - (3 * E2 / 8 + 3 * E2 ** 2 / 32 + 45 * E2 ** 3 / 1024) * math.sin(2 * phi)
                     + (15 * E2 ** 2 / 256 + 45 * E2 ** 3 / 1024) * math.sin(4 * phi) - (35 * E2 ** 3 / 3072) * math.sin(6 * phi))
        x = K0 * nn * (a + (1 - t + c) * a ** 3 / 6 + (5 - 18 * t + t * t + 72 * c - 58 * ep2) * a ** 5 / 120) + 500000
        y = K0 * (m + nn * math.tan(phi) * (a * a / 2 + (5 - t + 9 * c + 4 * c * c) * a ** 4 / 24 + (61 - 58 * t + t * t + 600 * c - 330 * ep2) * a ** 6 / 720))
        return x, y
    ecken = [utm(la, lo) for la in (s, n) for lo in (w, o)]
    xs = range(int(min(e[0] for e in ecken) // 2000 * 2), int(max(e[0] for e in ecken) // 2000 * 2) + 1, 2)
    ys = range(int(min(e[1] for e in ecken) // 2000 * 2), int(max(e[1] for e in ecken) // 2000 * 2) + 1, 2)
    return [f'{x}_{y}' for x in xs for y in ys]


def im_polygon(lat, lon, poly):
    drin = False
    for i in range(len(poly)):
        (ya, xa), (yb, xb) = poly[i], poly[i - 1]
        if (ya > lat) != (yb > lat) and lon < (xb - xa) * (lat - ya) / (yb - ya) + xa:
            drin = not drin
    return drin


def umgrenzung(poly):
    la, lo = zip(*poly)
    return min(la), min(lo), max(la), max(lo)


parser = ArgumentParser(description='Amtliche LoD2-Daten den OSM-Grundrissen zuordnen')
parser.add_argument('--dachmasse', type=int, nargs='+', metavar='INDEX',
                    help='Nur die Dachmaße ausgewählter Gebäude ergänzen.')
parser.add_argument('--koerper', action='store_true',
                    help='Mit --dachmasse auch amtliche Dachflächen, Wandabschlüsse und Wandgrundrisse übernehmen.')
parser.add_argument('--kachelordner', default=ROH, help='Ordner für die CityGML- und DOP20-Kacheln.')
argumente = parser.parse_args()
ROH = argumente.kachelordner
welt = json.load(open(WELT))['welt']
bbox = welt['bbox']
mittel_lat = (bbox[0] + bbox[2]) / 2
indexe = argumente.dachmasse
if indexe and any(not 0 <= i < len(welt['gebaeude']) for i in indexe):
    parser.error('Gebäudeindex außerhalb der Weltdaten.')
if argumente.koerper and not indexe:
    parser.error('--koerper braucht die Gebäudeauswahl aus --dachmasse.')
if not indexe:
    import numpy as np
    from PIL import Image, ImageDraw
kachelauswahl = sorted({
    k for i in indexe for k in kacheln(umgrenzung(welt['gebaeude'][i]['punkte']))
}) if indexe else kacheln(bbox)
os.makedirs(ROH, exist_ok=True)
gebaeude = []
for k in kachelauswahl:
    pfad = f'{ROH}/{k}.gml'
    if not os.path.exists(pfad):
        req = urllib.request.Request(f'https://download1.bayernwolke.de/a/lod2/citygml/{k}.gml', headers={'User-Agent': 'brachland-werkzeug/1.0'})
        with urllib.request.urlopen(req) as r, open(pfad, 'wb') as f:
            f.write(r.read())
    for _, el in ET.iterparse(pfad):
        if el.tag != '{http://www.opengis.net/citygml/building/1.0}Building':
            continue
        dach = el.findtext('bldg:roofType', default='0', namespaces=NS)
        boden_pkt, dach_pkt, dach_poly, boden_poly, wand_poly = [], [], [], [], []
        for flaeche in el.iter():
            if flaeche.tag.endswith('}GroundSurface'):
                for p in polygone(flaeche): boden_pkt += p; boden_poly.append(p)
            elif flaeche.tag.endswith('}RoofSurface'):
                for p in polygone(flaeche): dach_pkt += p; dach_poly.append(p)
            elif argumente.koerper and flaeche.tag.endswith('}WallSurface'):
                wand_poly.extend(polygone(flaeche))
        el.clear()
        if not boden_pkt or not dach_pkt:
            continue
        z0 = min(p[2] for p in boden_pkt)
        zmax = max(p[2] for p in dach_pkt)
        # Traufe: der tiefste Punkt der Dachhaut (bei Flachdach = First).
        traufe = min(p[2] for p in dach_pkt) - z0
        first = zmax - z0
        # Firstrichtung: längste waagerechte Dachkante in Firsthöhe (UTM: x Ost, y Nord).
        best, firstkante = 0.0, None
        for poly in dach_poly:
            for a, b in zip(poly, poly[1:]):
                if abs(a[2] - b[2]) < 0.15 and a[2] > zmax - 0.25:
                    l = math.hypot(b[0] - a[0], b[1] - a[1])
                    if l > best:
                        best, firstkante = l, (a, b)
        cx = sum(p[0] for p in boden_pkt) / len(boden_pkt)
        cy = sum(p[1] for p in boden_pkt) / len(boden_pkt)
        lat, lon = utm_nach_wgs(cx, cy)
        flaeche = (max(p[0] for p in boden_pkt) - min(p[0] for p in boden_pkt)) * (max(p[1] for p in boden_pkt) - min(p[1] for p in boden_pkt))
        w = firstrichtung(firstkante, mittel_lat) if firstkante else None
        koerper = None
        if argumente.koerper and len(boden_poly) == 1 and wand_poly:
            def horizontal(p):
                lat, lon = utm_nach_wgs(*p[:2])
                return [round(lat, 8), round(lon, 8)]
            def flaechen(polys):
                return [[[*horizontal(p), round(p[2] - z0, 3)] for p in ring] for ring in polys]
            koerper = {'grundriss': [horizontal(p) for p in wandring(boden_poly[0])],
                       'dachflaechen': flaechen(dach_poly), 'wandabschluesse': flaechen([
                           ring for ring in wand_poly if any(p[2] > z0 + max(2.2, round(traufe, 2)) + .001 for p in ring)
                       ]),
                       't': round(traufe, 2), 'f': round(first, 2), 'd': int(dach), 'w': w}
        gebaeude.append({'lat': lat, 'lon': lon, 't': round(traufe, 2), 'f': round(first, 2), 'd': int(dach), 'w': w, 'a': flaeche,
                         'cx': cx, 'cy': cy, 'firstkante': firstkante,
                         'koerper': koerper,
                         'dach': [[(p[0], p[1]) for p in poly] for poly in dach_poly]})


def zuordnung(poly):
    la0, lo0, la1, lo1 = umgrenzung(poly)
    return [b for b in gebaeude if la0 <= b['lat'] <= la1 and lo0 <= b['lon'] <= lo1 and im_polygon(b['lat'], b['lon'], poly)]


def dachkoerper(poly, winkel, kand):
    """Amtliche Dachkörper in lokalem U/V passend zum OSM-Grundriss beschreiben."""
    c, s = math.cos(math.radians(winkel)), math.sin(math.radians(winkel))
    cos_lat = math.cos(math.radians(mittel_lat))
    mitte_lon = (bbox[1] + bbox[3]) / 2

    def uv(lat, lon):
        x = (lon - mitte_lon) * cos_lat * 111320
        z = (mittel_lat - lat) * 111320
        return x * c + z * s, -x * s + z * c

    u, v = zip(*(uv(*p) for p in poly))
    u0, v0 = min(u), min(v)
    teile = []
    for b in kand:
        if b['d'] not in (2100, 3100) or b['firstkante'] is None:
            continue
        u, v = zip(*(uv(*utm_nach_wgs(*p)) for flaeche in b['dach'] for p in flaeche))
        vfirst = sum(uv(*utm_nach_wgs(*p[:2]))[1] for p in b['firstkante']) / 2
        werte = (min(u) - u0, max(u) - u0, min(v) - v0, max(v) - v0, vfirst - v0, b['t'], b['f'])
        teile.append([b['d'], *(round(wert, 2) for wert in werte)])
    return sorted(teile, key=lambda teil: teil[1])


if indexe:
    with open(AUS) as datei:
        ergebnis = json.load(datei)
    if len(ergebnis) != len(welt['gebaeude']):
        parser.error('Bestehende LoD2- und OSM-Gebäudeanzahl stimmen nicht überein.')
    for i in indexe:
        poly = welt['gebaeude'][i]['punkte']
        kand = zuordnung(poly)
        if not kand or not ergebnis[i]:
            parser.error(f'Kein bestehender und amtlicher Dachdatensatz für Gebäude {i}.')
        b = max(kand, key=lambda b: b['a'])
        if b['w'] is None:
            parser.error(f'Keine amtliche Firstkante für Gebäude {i}.')
        ergebnis[i]['p'] = b['w']
        if sum(teil['d'] == 3100 for teil in kand) > 1:
            ergebnis[i]['teile'] = dachkoerper(poly, b['w'], kand)
        else:
            ergebnis[i].pop('teile', None)
        if argumente.koerper:
            koerper = [b['koerper'] for b in sorted(kand, key=lambda b: -b['a'])]
            if any(k is None for k in koerper):
                parser.error(f'Kein geschlossener amtlicher Grundriss und Dachkörper für Gebäude {i}.')
            ergebnis[i]['koerper'] = koerper
    with open(AUS, 'w') as datei:
        json.dump(ergebnis, datei, separators=(',', ':'))
    print(f'LoD2: Dachmaße für {len(indexe)} Gebäude ergänzt → {AUS}')
    raise SystemExit(0)

# Dachfarbe aus DOP20: Kacheln zu 256 m, 1024 Pixel (0,25 m/Pixel).
KANTE, PX = 256, 1024
os.makedirs(f'{ROH}/dop', exist_ok=True)
kachel_bilder = {}
def dop_kachel(kx, ky):
    if (kx, ky) not in kachel_bilder:
        pfad = f'{ROH}/dop/{kx}_{ky}.png'
        if not os.path.exists(pfad):
            url = ('https://geoservices.bayern.de/od/wms/dop/v1/dop20?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=by_dop20c&STYLES='
                   f'&CRS=EPSG:25832&BBOX={kx},{ky},{kx + KANTE},{ky + KANTE}&WIDTH={PX}&HEIGHT={PX}&FORMAT=image/png')
            req = urllib.request.Request(url, headers={'User-Agent': 'brachland-werkzeug/1.0'})
            with urllib.request.urlopen(req) as r, open(pfad, 'wb') as f:
                f.write(r.read())
        kachel_bilder[(kx, ky)] = Image.open(pfad).convert('RGB')
    return kachel_bilder[(kx, ky)]

def dachfarbe(b):
    kx, ky = int(b['cx'] // KANTE * KANTE), int(b['cy'] // KANTE * KANTE)
    bild = dop_kachel(kx, ky)
    maske = Image.new('L', (PX, PX), 0)
    zeichne = ImageDraw.Draw(maske)
    for poly in b['dach']:
        pts = [((x - kx) / KANTE * PX, (ky + KANTE - y) / KANTE * PX) for x, y in poly]
        if len(pts) >= 3: zeichne.polygon(pts, fill=255)
    m = np.asarray(maske) > 0
    if m.sum() < 8:
        return None
    rgb = np.asarray(bild)[m].astype(float)
    # D292: Robuste Dachfarbe. Der Median über alle Pixel nahm Schattenseite, überhängende Kronen und Solarmodule mit —
    # zwei Dächer im Dorf wurden blauschwarz. Jetzt ohne Grün (Bewuchs), ohne Bläuliches (Module, Himmelsreflex) und
    # nur die sonnige Hälfte (Luminanz ab dem Median des Rests). Eine Moduleerkennung über Farbe allein griff
    # vor allem Schatten (Kontaktbogen 15.11.2026), deshalb kein eigenes Modulfeld.
    r, g, b = rgb[:, 0], rgb[:, 1], rgb[:, 2]
    rest = rgb[~(((g > r + 4) & (g > b + 4)) | (b > r + 4))]
    if len(rest) < max(8, 0.2 * len(rgb)):
        rest = rgb
    lum = rest @ np.array([0.2126, 0.7152, 0.0722])
    rest = rest[lum >= np.median(lum)]
    med = np.median(rest, axis=0)
    return '#%02x%02x%02x' % tuple(int(v) for v in med)

ergebnis, treffer = [], 0
for g in welt['gebaeude']:
    kand = zuordnung(g['punkte'])
    if not kand:
        ergebnis.append(None)
        continue
    b = max(kand, key=lambda b: b['a'])
    treffer += 1
    ergebnis.append({'t': b['t'], 'f': b['f'], 'd': b['d'], 'w': b['w'], 'c': dachfarbe(b)})
json.dump(ergebnis, open(AUS, 'w'), separators=(',', ':'))
print(f'LoD2: {len(gebaeude)} Gebäude in {len(kachelauswahl)} Kacheln, {treffer} von {len(welt["gebaeude"])} OSM-Gebäuden zugeordnet → {AUS} ({os.path.getsize(AUS) // 1024} KB)')
