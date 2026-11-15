"""
LoD2-Import (D290): echte Trauf- und Firsthöhen, Dachform und Firstrichtung je Gebäude aus den amtlichen
3D-Gebäudemodellen der Bayerischen Vermessungsverwaltung (LoD2, CityGML 1.0, UTM 32N / DHHN2016).

  python3 tools/lod2import.py            # lädt fehlende Kacheln nach .cache/lod2/, schreibt public/world/oental-lod2.json

Lizenz: CC BY 4.0 (Nutzungsbedingungen geodaten.bayern.de: „Die kostenfreien Datensätze … stehen unter CC BY 4.0“),
Namensnennung „Bayerische Vermessungsverwaltung – www.geodaten.bayern.de“, Änderungen angeben (assets/HERKUNFT.md).

Ausgabe: eine Liste in der Reihenfolge von `welt.gebaeude` (oental.json), je OSM-Gebäude `null` oder
{"t": Traufhöhe, "f": Firsthöhe über Grund in m, "d": Dachform (AdV-Schlüssel 1000 Flach, 2100 Pult, 3100 Sattel,
3200 Walm, 3300 Krüppelwalm, …), "w": Firstrichtung als Winkel in der Weltebene (atan2(dz, dx), Grad)}.
Zuordnung: der Grundriss-Schwerpunkt des LoD2-Gebäudes liegt im OSM-Grundriss; bei mehreren das grösste.
Die Form des Hauses (Fassade, Material, Verfall) bleibt beim Generator; LoD2 liefert nur die echte Silhouette.
"""
import json
import math
import os
import re
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


welt = json.load(open(WELT))['welt']
bbox = welt['bbox']
os.makedirs(ROH, exist_ok=True)
gebaeude = []
for k in kacheln(bbox):
    pfad = f'{ROH}/{k}.gml'
    if not os.path.exists(pfad):
        req = urllib.request.Request(f'https://download1.bayernwolke.de/a/lod2/citygml/{k}.gml', headers={'User-Agent': 'brachland-werkzeug/1.0'})
        with urllib.request.urlopen(req) as r, open(pfad, 'wb') as f:
            f.write(r.read())
    for _, el in ET.iterparse(pfad):
        if el.tag != '{http://www.opengis.net/citygml/building/1.0}Building':
            continue
        dach = el.findtext('bldg:roofType', default='0', namespaces=NS)
        boden_pkt, dach_pkt, dach_poly = [], [], []
        for flaeche in el.iter():
            if flaeche.tag.endswith('}GroundSurface'):
                for p in polygone(flaeche): boden_pkt += p
            elif flaeche.tag.endswith('}RoofSurface'):
                for p in polygone(flaeche): dach_pkt += p; dach_poly.append(p)
        el.clear()
        if not boden_pkt or not dach_pkt:
            continue
        z0 = min(p[2] for p in boden_pkt)
        zmax = max(p[2] for p in dach_pkt)
        # Traufe: der tiefste Punkt der Dachhaut (bei Flachdach = First).
        traufe = min(p[2] for p in dach_pkt) - z0
        first = zmax - z0
        # Firstrichtung: längste waagerechte Dachkante in Firsthöhe (UTM: x Ost, y Nord).
        best, winkel = 0.0, None
        for poly in dach_poly:
            for a, b in zip(poly, poly[1:]):
                if abs(a[2] - b[2]) < 0.15 and a[2] > zmax - 0.25:
                    l = math.hypot(b[0] - a[0], b[1] - a[1])
                    if l > best:
                        best, winkel = l, (b[0] - a[0], b[1] - a[1])
        cx = sum(p[0] for p in boden_pkt) / len(boden_pkt)
        cy = sum(p[1] for p in boden_pkt) / len(boden_pkt)
        lat, lon = utm_nach_wgs(cx, cy)
        flaeche = (max(p[0] for p in boden_pkt) - min(p[0] for p in boden_pkt)) * (max(p[1] for p in boden_pkt) - min(p[1] for p in boden_pkt))
        w = None
        if winkel:
            # Meridiankonvergenz: Gitternord liegt um γ ≈ (λ − 9°)·sin φ östlich von Geographisch-Nord.
            gamma = math.radians((lon - 9) * math.sin(math.radians(lat)))
            ox, oy = winkel
            ex = ox * math.cos(gamma) - oy * math.sin(gamma)
            ny = ox * math.sin(gamma) + oy * math.cos(gamma)
            # Welt: x nach Osten, z nach Süden.
            w = round(math.degrees(math.atan2(-ny, ex)), 1)
        gebaeude.append({'lat': lat, 'lon': lon, 't': round(traufe, 2), 'f': round(first, 2), 'd': int(dach), 'w': w, 'a': flaeche})

ergebnis, treffer = [], 0
for g in welt['gebaeude']:
    poly = g['punkte']
    la0 = min(p[0] for p in poly); la1 = max(p[0] for p in poly); lo0 = min(p[1] for p in poly); lo1 = max(p[1] for p in poly)
    kand = [b for b in gebaeude if la0 <= b['lat'] <= la1 and lo0 <= b['lon'] <= lo1 and im_polygon(b['lat'], b['lon'], poly)]
    if not kand:
        ergebnis.append(None)
        continue
    b = max(kand, key=lambda b: b['a'])
    treffer += 1
    ergebnis.append({'t': b['t'], 'f': b['f'], 'd': b['d'], 'w': b['w']})
json.dump(ergebnis, open(AUS, 'w'), separators=(',', ':'))
print(f'LoD2: {len(gebaeude)} Gebäude in {len(kacheln(bbox))} Kacheln, {treffer} von {len(welt["gebaeude"])} OSM-Gebäuden zugeordnet → {AUS} ({os.path.getsize(AUS) // 1024} KB)')
