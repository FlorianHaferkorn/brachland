#!/usr/bin/env python3
"""
BRACHLAND — Zwei Wege je Ziel: Wasserquerungen und Gleitflüge im Œntal (D388)

Messung zu `docs/design/BRACHLAND_Traversal_v2.md`: rechnet aus dem Höhenraster
`public/world/oental.json` und der `flutlinie` der Regionsdaten,

  1. wie weit Kapelle, Kirchturm und Absetzbecken vom trockenen Festland liegen und wie lange
     die Querung mit den Schwimmwerten des Spiels dauert,
  2. ob die Dächer der versunkenen Stadt einen Weg mit kurzen Schwimmstrecken ergeben,
  3. von wo ein Gleitflug (3:1, D71) welche Ziele erreicht.

Messung, kein Bauschritt: schreibt nichts, gibt nur Zahlen aus.

    python3 tools/traversal_wege.py

Braucht numpy (nicht Teil des Gates). Die Spielwerte unten sind **abgeschrieben**, nicht gesetzt —
Quelle steht je Zeile; ändern sie sich dort, hier nachziehen.
"""
import base64, heapq, json, math

import numpy as np

REGION = 'oental'
SCHWIMMEN_TEMPO = 1.6      # src/scenes/RegionsSzene.tsx
SCHWIMMEN_JE_SEK = 9       # ebd.
TREIBEN = 0.45             # ebd.: Tempoanteil, wenn die Ausdauer leer ist
AUSDAUER_MAX = 100         # src/spieler/ausdauer.ts
RENNEN = 11.0              # src/spieler/tempo.ts
GLEIT_VERHAELTNIS = 3      # src/spieler/gleiten.ts
GLEIT_TEMPO = 12.0         # ebd.
METER_JE_EBENE = 3         # src/world/terrain.ts

W = json.load(open(f'public/world/{REGION}.json'))['welt']
R = json.load(open(f'content/regions/{REGION}.json', encoding='utf8'))
FLUT = R['flutlinie']
SUED, WEST, NORD, OST = W['bbox']
N = W['aufloesung']
BREITE = (OST - WEST) * 111_320 * math.cos((SUED + NORD) / 2 * math.pi / 180)
TIEFE = (NORD - SUED) * 111_320
H = np.frombuffer(base64.b64decode(W['hoehenB64']), dtype='<i2').reshape(N, N) / 10.0


def meter(ort):
    """Wie `nachMetern` in `src/data/inhalte.ts`: x nach Osten, z nach Süden, Mitte 0/0."""
    return ((ort[1] - WEST) / (OST - WEST) - 0.5) * BREITE, ((NORD - ort[0]) / (NORD - SUED) - 0.5) * TIEFE


def zelle(x, z):
    return (max(0, min(N - 1, round((z / TIEFE + 0.5) * (N - 1)))), max(0, min(N - 1, round((x / BREITE + 0.5) * (N - 1)))))


def punkt(i, j):
    return (j / (N - 1) - 0.5) * BREITE, (i / (N - 1) - 0.5) * TIEFE


def hoehe(p):
    return float(H[zelle(*p)])


def inhalt(ordner, kennung):
    return meter(json.load(open(f'content/{ordner}/{kennung}.json', encoding='utf8'))['ort'])


def trockene_teile():
    """Zusammenhängende Flächen über der Flutlinie (8er-Nachbarschaft), als Rasternummern."""
    teil = np.zeros((N, N), dtype=int)
    nr = 0
    for i0 in range(N):
        for j0 in range(N):
            if H[i0, j0] < FLUT or teil[i0, j0]:
                continue
            nr += 1
            stapel = [(i0, j0)]
            teil[i0, j0] = nr
            while stapel:
                i, j = stapel.pop()
                for a in (-1, 0, 1):
                    for b in (-1, 0, 1):
                        k, l = i + a, j + b
                        if 0 <= k < N and 0 <= l < N and not teil[k, l] and H[k, l] >= FLUT:
                            teil[k, l] = nr
                            stapel.append((k, l))
    return teil


def punkte(maske):
    idx = np.argwhere(maske)
    return np.array([punkt(i, j) for i, j in idx])


def naechster(p, menge):
    d = np.hypot(menge[:, 0] - p[0], menge[:, 1] - p[1])
    return float(d.min()), menge[d.argmin()]


def schwimmzeit(strecke):
    """Sekunden für eine Strecke im tiefen Wasser ohne Werkzeug: erst schwimmen, dann treiben."""
    voll = AUSDAUER_MAX / SCHWIMMEN_JE_SEK * SCHWIMMEN_TEMPO
    if strecke <= voll:
        return strecke / SCHWIMMEN_TEMPO
    return voll / SCHWIMMEN_TEMPO + (strecke - voll) / (SCHWIMMEN_TEMPO * TREIBEN)


def flug(p, q):
    """Gehen oder gleiten auf der Geraden p→q: (Luftlinie, Luftanteil, längster Flug am Stück)."""
    weite = math.dist(p, q)
    schritte = max(2, int(weite / 5))
    y, luft, lauf, laengster = hoehe(p), 0.0, 0.0, 0.0
    for s in range(1, schritte + 1):
        f = s / schritte
        boden = hoehe((p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f))
        sinkt = y - weite / schritte / GLEIT_VERHAELTNIS
        if boden >= sinkt:
            y, lauf = boden, 0.0
        else:
            y = sinkt
            luft += weite / schritte
            lauf += weite / schritte
            laengster = max(laengster, lauf)
    return weite, luft / weite, laengster


ENKLAVE = meter(R['enklave']['ort'])
ZIELE = {
    'Enklave (Wirt)': ENKLAVE,
    'Start': (0.0, 0.0),
    'Absetzbecken': inhalt('fragmente', 'absetzbecken'),
    'Saatkammer': inhalt('fragmente', 'saatkammer'),
    'Oberstollen': inhalt('fragmente', 'oberstollen'),
    'Kirchturm': inhalt('fragmente', 'kirchturm'),
    'Kapelle': inhalt('orte', 'kapelle-kalkbruch'),
    'Almhütte': inhalt('orte', 'almhuette'),
    'Quelltopf': inhalt('fragmente', 'quelltopf'),
    'Abstieg (Bursche)': inhalt('orte', 'dorf-bursche'),
    'Wehr (Flussvater)': meter(json.load(open(f'content/regenten/{R["regent"]}.json', encoding='utf8'))['ort']),
}

print(f'Flutlinie {FLUT} m · Raster {N}×{N}, {BREITE / (N - 1):.1f} m je Zelle\n')
print('| Ort | x | z | Höhe |\n|---|---|---|---|')
for name, p in ZIELE.items():
    print(f'| {name} | {p[0]:.0f} | {p[1]:.0f} | {hoehe(p):.0f} |')

# ---- 1. Wasser ---------------------------------------------------------------
teil = trockene_teile()
festland = punkte(teil == teil[zelle(*ENKLAVE)])
insel_nr = teil[zelle(*ZIELE['Kapelle'])]
insel = punkte(teil == insel_nr)
print(f'\nKapelle: eigene trockene Fläche (Nr. {insel_nr}, Festland {teil[zelle(*ENKLAVE)]}), {len(insel) * BREITE * TIEFE / (N - 1) ** 2 / 1e4:.1f} ha')
quer = min(((naechster(p, festland)[0], tuple(p)) for p in insel[::3]), key=lambda t: t[0])
print(f'  kürzeste Querung Festland→Insel im Raster: {quer[0]:.0f} m, ohne Werkzeug {schwimmzeit(quer[0]) / 60:.1f} min')
for name in ('Kirchturm',):
    p = ZIELE[name]
    d, wo = naechster(p, festland)
    print(f'{name}: {FLUT - hoehe(p):.1f} m unter der Flutlinie, nächstes Festland {d:.0f} m bei {wo[0]:.0f}/{wo[1]:.0f}, '
          f'ohne Werkzeug {schwimmzeit(d) / 60:.1f} min')
d, wo = naechster(ZIELE['Kirchturm'], insel)
print(f'Kirchturm: nächster Punkt der Kapelleninsel {d:.0f} m bei {wo[0]:.0f}/{wo[1]:.0f}')
nass = punkte(H < FLUT)
d, wo = naechster(ZIELE['Absetzbecken'], nass)
print(f'Absetzbecken: {hoehe(ZIELE["Absetzbecken"]) - FLUT:.1f} m über der Flutlinie (eigener Weiher); Flutfläche beginnt {d:.0f} m entfernt bei {wo[0]:.0f}/{wo[1]:.0f}')
ab = ZIELE['Abstieg (Bursche)']
print(f'Wasserlinien ab Abstieg (Bursche): zum Flutrand am Absetzbecken {math.dist(ab, wo):.0f} m, zum Wehr {math.dist(ab, ZIELE["Wehr (Flussvater)"]):.0f} m, '
      f'über den Kirchturm zum Wehr {math.dist(ab, ZIELE["Kirchturm"]) + math.dist(ZIELE["Kirchturm"], ZIELE["Wehr (Flussvater)"]):.0f} m')

# ---- 2. Dächer als Rastpunkte ------------------------------------------------
daecher = []
versunken = 0
for g in W['gebaeude']:
    p = [meter(q) for q in g['punkte']]
    mitte = (sum(a for a, _ in p) / len(p), sum(b for _, b in p) / len(p))
    if hoehe(mitte) < FLUT:
        versunken += 1
        if hoehe(mitte) + g['ebenen'] * METER_JE_EBENE > FLUT:
            daecher.append(mitte)
print(f'\nGebäude mit Grund unter der Flutlinie: {versunken}, davon Traufe (Grund + Ebenen × {METER_JE_EBENE} m) über Wasser: {len(daecher)}')


def groesste_luecke(ziel, mit_inseln):
    """Weg Festland → Ziel über Dächer (und Inseln), der die längste Einzelstrecke im Wasser klein hält."""
    knoten = list(daecher) + [tuple(ziel)]
    start = [naechster(k, festland)[0] for k in knoten]
    if mit_inseln:
        andere = punkte((teil > 0) & (teil != teil[zelle(*ENKLAVE)]))
        knoten += [tuple(p) for p in andere[::2]]
        start += [naechster(k, festland)[0] for k in knoten[len(start):]]
    beste = list(start)
    offen = [(b, i) for i, b in enumerate(beste)]
    heapq.heapify(offen)
    feld = np.array(knoten)
    while offen:
        c, u = heapq.heappop(offen)
        if c > beste[u]:
            continue
        if u == len(daecher):
            return c
        d = np.hypot(feld[:, 0] - feld[u][0], feld[:, 1] - feld[u][1])
        for v in np.nonzero(np.maximum(c, d) < np.array(beste))[0]:
            beste[v] = max(c, float(d[v]))
            heapq.heappush(offen, (beste[v], v))
    return beste[len(daecher)]


for name in ('Kirchturm', 'Kapelle'):
    print(f'  {name}: längste Einzelstrecke im Wasser auf dem besten Dächerweg {groesste_luecke(ZIELE[name], True):.0f} m '
          f'(eine Ausdauerleiste trägt {AUSDAUER_MAX / SCHWIMMEN_JE_SEK * SCHWIMMEN_TEMPO:.1f} m)')

# ---- 3. Gleiten --------------------------------------------------------------
print('\n| Von | Nach | Luftlinie m | in der Luft | längster Flug m | Flugzeit s | Rennen (Luftlinie) s |\n|---|---|---|---|---|---|---|')
for von, nach in (('Enklave (Wirt)', 'Saatkammer'), ('Abstieg (Bursche)', 'Wehr (Flussvater)'), ('Start', 'Saatkammer'),
                  ('Oberstollen', 'Start'), ('Oberstollen', 'Enklave (Wirt)'), ('Oberstollen', 'Saatkammer'),
                  ('Quelltopf', 'Saatkammer'), ('Almhütte', 'Absetzbecken'), ('Almhütte', 'Enklave (Wirt)')):
    weite, anteil, laengster = flug(ZIELE[von], ZIELE[nach])
    print(f'| {von} | {nach} | {weite:.0f} | {anteil * 100:.0f} % | {laengster:.0f} | {laengster / GLEIT_TEMPO:.0f} | {weite / RENNEN:.0f} |')

for name in ('Saatkammer', 'Enklave (Wirt)'):
    kanten = []
    for i in range(0, N, 3):
        for j in range(0, N, 3):
            p = punkt(i, j)
            if math.dist(p, ZIELE[name]) < 300:
                continue
            weite, anteil, _ = flug(p, ZIELE[name])
            if anteil >= 0.8:
                kanten.append((math.hypot(*p), p, float(H[i, j]), weite))
    kanten.sort()
    if kanten:
        _, p, h, weite = kanten[0]
        print(f'Absprung nach {name}: {len(kanten)} Rasterpunkte (jeder dritte) mit ≥ 80 % Flug; dem Start am nächsten '
              f'{p[0]:.0f}/{p[1]:.0f}, {h:.0f} m, {weite:.0f} m bis zum Ziel, {math.dist(p, ENKLAVE):.0f} m von der Enklave')
    else:
        print(f'Absprung nach {name}: keiner')
print(f'Terrasse: höchstens {525 - FLUT:.0f} m über der Flutlinie → höchstens {(525 - FLUT) * GLEIT_VERHAELTNIS:.0f} m Flug aufs Wasser '
      f'(Wirt {hoehe(ZIELE["Enklave (Wirt)"]):.0f} m, Abstieg {hoehe(ZIELE["Abstieg (Bursche)"]):.0f} m)')
