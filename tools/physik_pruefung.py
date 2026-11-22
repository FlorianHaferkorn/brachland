#!/usr/bin/env python3
"""
BRACHLAND — Physik-Prüfung der Bewegungswerte: die Rechnungen (D408)

Rechnet nach, was `docs/design/BRACHLAND_Physik-Pruefung_v1.md` behauptet:

  1. Tauchweg gegen Uferweg zum Flussvater (D380): Tiefenprofil der Wasserlinie aus dem
     Höhenraster, Zeiten bei Realtempo und bei Spieltempo, Luftverbrauch und Etappen.
  2. Sprung: Höhe und Weite aus Absprung, Schwerkraft und Lauftempo.
  3. Gleiten: Gleitzahl, Sinkrate, Landung gegen den realen Schirm.
  4. Reittier: nötige Masse des Tiers für Reiter und Zeug nach der 20-%-Regel.
  5. Klettern, Schwimmen, Wege: Faktor Spiel gegen real.

Messung, kein Bauschritt: schreibt nichts, gibt nur Zahlen aus.

    python3 tools/physik_pruefung.py

Braucht numpy (nicht Teil des Gates), wie `tools/traversal_wege.py`. Spielwerte sind
**abgeschrieben**, nicht gesetzt — Quelle je Zeile. Realwerte tragen ihre Quelle im Dokument (§6).
"""
import base64, heapq, json, math

import numpy as np

# ---- Spielwerte (abgeschrieben) -------------------------------------------------
# Stand D408 (vor D412). Seit D412 gelten Rennen 8,5, Reiten 5 / 13, Klettern 1,0 m/s bei 13,75 m Reichweite,
# Tauchen 2,25 m/s (Entwurf) — content/bewegung.json. Die Werte hier bleiben, damit die Rechnung der Prüfung
# nachvollziehbar bleibt; §4.7 rechnet 8,5 und 7,0 ohnehin daneben.
GEHEN, RENNEN = 4.2, 11.0             # src/spieler/tempo.ts
SCHWERKRAFT, ABSPRUNG = 9.81, 5.4     # ebd.
AUSDAUER_MAX = 100                    # src/spieler/ausdauer.ts
KLETTERN_JE_SEK = 16                  # ebd.
ERHOLUNG_JE_SEK = 26                  # ebd.
KLETTERN_TEMPO = 2.2                  # src/scenes/RegionsSzene.tsx
WATEN_TEMPO = 1.9                     # ebd.
SCHWIMMEN_TEMPO, SCHWIMMEN_JE_SEK, TREIBEN = 1.6, 9, 0.45   # ebd.
GLEIT_VERHAELTNIS, GLEIT_SINKEN = 3, 4.0                    # src/spieler/gleiten.ts
REITEN_GEHEN, REITEN_RENNEN = 7.5, 17.0                     # src/spiel/reiten.ts
TAUCHEN_ENTWURF = 6.0                 # docs/design/BRACHLAND_Traversal_v2.md §4 (nur Entwurf)
UFERWEG = 1681                        # D375/D380, Fußweg Enklave → Wehr in Metern
KAMPF_JE_ENGSTELLE = (25, 47)         # s, Bot: ein Grathorn 24,5 s, Lehrstrecke 141 s / 3 (Weg nach Brannburg §4)

# ---- Realwerte (Quellen: Dokument §6) --------------------------------------------
GEHEN_REAL = 1.4                      # m/s, bevorzugtes Gehtempo [Q1]
TAUCHEN_REAL = (0.26, 0.5, 1.0)       # m/s: gemütlich 0,5 kn, zügig 1 kn, Obergrenze im Versuch 1,9 kn [Q9]
SCHWIMMEN_KLEIDUNG_KALT = 815 / (39 * 60)   # m/s, bekleidet in 12 °C: 815 m in 39 min [Q7]
ATEM_RUHE, ATEM_ARBEIT = 20, 40       # l/min an der Oberfläche; BSAC rechnet 25, Arbeit verdoppelt grob [Q10]
FLASCHE_L = 2 * 200                   # 2 l bei 200 bar (Gegenstände v1 §11)
RESERVE = 50 / 200                    # 50 bar bleiben drin
GLEITZAHL_REAL, TRIMM_REAL = 9.3, (32 / 3.6, 40 / 3.6)      # Freizeitschirm [Q11]
TRAGANTEIL = (0.20, 0.25, 0.30)       # Reiter + Zeug je Tiermasse [Q14]
REITER_KG = 75 + 15                   # Mensch und das Nötigste; volle Traglast 36 kg wären 111 kg

REGION = 'oental'
W = json.load(open(f'public/world/{REGION}.json'))['welt']
R = json.load(open(f'content/regions/{REGION}.json', encoding='utf8'))
FLUT = R['flutlinie']
SUED, WEST, NORD, OST = W['bbox']
N = W['aufloesung']
BREITE = (OST - WEST) * 111_320 * math.cos((SUED + NORD) / 2 * math.pi / 180)
TIEFE = (NORD - SUED) * 111_320
H = np.frombuffer(base64.b64decode(W['hoehenB64']), dtype='<i2').reshape(N, N) / 10.0


def meter(ort):
    return ((ort[1] - WEST) / (OST - WEST) - 0.5) * BREITE, ((NORD - ort[0]) / (NORD - SUED) - 0.5) * TIEFE


def hoehe(p):
    i = max(0, min(N - 1, round((p[1] / TIEFE + 0.5) * (N - 1))))
    j = max(0, min(N - 1, round((p[0] / BREITE + 0.5) * (N - 1))))
    return float(H[i, j])


def inhalt(ordner, kennung):
    return meter(json.load(open(f'content/{ordner}/{kennung}.json', encoding='utf8'))['ort'])


def profil(punkte):
    """Wassertiefe entlang eines Linienzugs, alle 5 m: (Länge, Anteil nass, mittlere und grösste Tiefe)."""
    tiefen, laenge = [], 0.0
    for p, q in zip(punkte, punkte[1:]):
        d = math.dist(p, q)
        laenge += d
        for s in range(int(d / 5) + 1):
            f = s * 5 / d
            tiefen.append(FLUT - hoehe((p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f)))
    t = np.array(tiefen)
    nass = t[t > 0]
    return laenge, len(nass) / len(t), float(nass.mean()), float(nass.max())


def minuten(s):
    return f'{s / 60:.1f} min'


def wasserweg(start, ziel):
    """Kürzester Weg nur über Zellen unter der Flutlinie, vom nassen Punkt nächst `start` durch dasselbe Gewässer:
    (Zugang zu Fuss, Wasserstrecke, Ausstieg zu Fuss, mittlere und grösste Tiefe)."""
    nass = np.argwhere(H < FLUT)
    zb, zt = BREITE / (N - 1), TIEFE / (N - 1)
    ort = lambda i, j: ((j / (N - 1) - 0.5) * BREITE, (i / (N - 1) - 0.5) * TIEFE)
    def naechste(p):
        d = [math.dist(p, ort(i, j)) for i, j in nass]
        k = int(np.argmin(d))
        return tuple(nass[k]), d[k]
    a, zu = naechste(start)
    weit, vor = {a: 0.0}, {}
    offen = [(0.0, a)]
    while offen:
        d, u = heapq.heappop(offen)
        if d > weit[u]:
            continue
        for x in (-1, 0, 1):
            for y in (-1, 0, 1):
                v = (u[0] + x, u[1] + y)
                if (x or y) and 0 <= v[0] < N and 0 <= v[1] < N and H[v] < FLUT:
                    nd = d + math.hypot(x * zt, y * zb)
                    if nd < weit.get(v, math.inf):
                        weit[v], vor[v] = nd, u
                        heapq.heappush(offen, (nd, v))
    # Ziel ist die Zelle desselben Gewässers, die dem Zielort am nächsten liegt — der Ort selbst kann am Ufer stehen.
    b = min(weit, key=lambda v: math.dist(ziel, ort(*v)))
    ab = math.dist(ziel, ort(*b))
    tiefen, u = [], b
    while u != a:
        tiefen.append(FLUT - float(H[u]))
        u = vor[u]
    return zu, weit[b], ab, float(np.mean(tiefen)), float(np.max(tiefen))


ABSTIEG = inhalt('orte', 'dorf-bursche')
TURM = inhalt('fragmente', 'kirchturm')
WEHR = meter(json.load(open(f'content/regenten/{R["regent"]}.json', encoding='utf8'))['ort'])

# ---- 1. Tauchweg gegen Uferweg ---------------------------------------------------
print('## 1. Flussvater: Uferweg gegen Tauchweg (D380)\n')
print('| Weg | Länge m | nass | mittlere Tiefe m | grösste Tiefe m |\n|---|---|---|---|---|')
WEGE = {'Tauchweg direkt': [ABSTIEG, WEHR], 'Tauchweg über den Kirchturm': [ABSTIEG, TURM, WEHR]}
PROFILE = {}
for name, weg in WEGE.items():
    PROFILE[name] = profil(weg)
    l, nass, mittel, tief = PROFILE[name]
    print(f'| {name} | {l:.0f} | {nass * 100:.0f} % | {mittel:.1f} | {tief:.1f} |')

print('\nDie Gerade Abstieg → Wehr liegt fast ganz auf dem Trockenen: Das Wehr steht am Westufer, die Linie läuft den Hang entlang.')
NASS = {'Abstieg → Wehr': wasserweg(ABSTIEG, WEHR), 'Abstieg → Kirchturm': wasserweg(ABSTIEG, TURM), 'Kirchturm → Wehr': wasserweg(TURM, WEHR)}
print('\nKürzester Weg nur durch Wasser (Raster, Zellen unter der Flutlinie):')
print('| Von → nach | zu Fuss ans Wasser m | im Wasser m | Ausstieg bis zum Ziel m | mittlere Tiefe m | grösste Tiefe m |\n|---|---|---|---|---|---|')
for name, w in NASS.items():
    print(f'| {name} | {w[0]:.0f} | {w[1]:.0f} | {w[2]:.0f} | {w[3]:.1f} | {w[4]:.1f} |')
WASSER_DIREKT = NASS['Abstieg → Wehr'][1]
WASSER_TURM = NASS['Abstieg → Kirchturm'][1] + NASS['Kirchturm → Wehr'][1]
TIEFE_DIREKT, TIEFE_TURM = NASS['Abstieg → Wehr'][3], (NASS['Abstieg → Kirchturm'][3] + NASS['Kirchturm → Wehr'][3]) / 2
LAENGEN = {'Wasserweg direkt': WASSER_DIREKT, 'Wasserweg über den Kirchturm': WASSER_TURM}

faktor = GEHEN / GEHEN_REAL
print(f'\nSpielfaktor Gehen: {GEHEN} / {GEHEN_REAL} = {faktor:.1f}; Rennen {RENNEN / GEHEN_REAL:.1f}')
print('\n| Weg | Tempo m/s | Zeit | Anmerkung |\n|---|---|---|---|')
print(f'| Uferweg {UFERWEG} m, real gehen | {GEHEN_REAL} | {minuten(UFERWEG / GEHEN_REAL)} | ohne Kämpfe |')
print(f'| Uferweg, Spiel gehen | {GEHEN} | {minuten(UFERWEG / GEHEN)} | ohne Kämpfe |')
print(f'| Uferweg, Spiel rennen | {RENNEN} | {minuten(UFERWEG / RENNEN)} | ohne Kämpfe |')
for a, b in ((KAMPF_JE_ENGSTELLE[0], RENNEN), (KAMPF_JE_ENGSTELLE[1], GEHEN)):
    print(f'| Uferweg + 3 Engstellen je {a} s | {b} | {minuten(UFERWEG / b + 3 * a)} | Kampfzeit nach Bot |')
schlamm = 400
print(f'| Uferweg gehen, davon {schlamm} m Schlamm im Wattempo + 3 × {KAMPF_JE_ENGSTELLE[1]} s | {GEHEN} / {WATEN_TEMPO} | '
      f'{minuten((UFERWEG - schlamm) / GEHEN + schlamm / WATEN_TEMPO + 3 * KAMPF_JE_ENGSTELLE[1])} | Schlammlänge angenommen |')
for name, l in LAENGEN.items():
    for v in TAUCHEN_REAL:
        print(f'| {name}, real | {v} | {minuten(l / v)} | Flossen |')
    for v in (TAUCHEN_REAL[1] * faktor, 0.75 * faktor):
        print(f'| {name}, Spielfaktor {faktor:.0f} | {v:.2f} | {minuten(l / v)} | Vorschlag |')
    print(f'| {name}, Entwurf Traversal v2 | {TAUCHEN_ENTWURF} | {minuten(l / TAUCHEN_ENTWURF)} | Faktor {TAUCHEN_ENTWURF / TAUCHEN_REAL[1]:.0f} über zügig real |')

kampf_gleich = lambda l, v, b: (l / v - UFERWEG / b) / 3
print('\nGleichstand: so lange muss jede der drei Engstellen aufhalten, damit der Tauchweg zeitlich gewinnt')
for v in (TAUCHEN_REAL[1] * faktor, 0.75 * faktor, 3.0):
    l = WASSER_DIREKT
    print(f'  Tauchtempo {v:.2f} m/s: {kampf_gleich(l, v, GEHEN):.0f} s je Engstelle gegen Gehen, {kampf_gleich(l, v, RENNEN):.0f} s gegen Rennen')

print('\nLuft: Flasche 2 l × 200 bar = 400 l, 50 bar Reserve → nutzbar '
      f'{FLASCHE_L * (1 - RESERVE):.0f} l')
print('| Tiefe m | Druck bar | Ruhe 20 l/min | Arbeit 40 l/min | Strecke bei 0,5 m/s und Arbeit |\n|---|---|---|---|---|')
for tiefe in (3, 5, TIEFE_DIREKT, 10, FLUT - hoehe(TURM)):
    bar = 1 + tiefe / 10
    nutz = FLASCHE_L * (1 - RESERVE)
    print(f'| {tiefe:.1f} | {bar:.2f} | {nutz / (ATEM_RUHE * bar):.1f} min | {nutz / (ATEM_ARBEIT * bar):.1f} min | '
          f'{nutz / (ATEM_ARBEIT * bar) * 60 * 0.5:.0f} m |')
for name, l, mittel in (('Wasserweg direkt', WASSER_DIREKT, TIEFE_DIREKT), ('Wasserweg über den Kirchturm', WASSER_TURM, TIEFE_TURM)):
    bar = 1 + mittel / 10
    bedarf = l / 0.5 / 60 * ATEM_ARBEIT * bar
    print(f'{name}: {l:.0f} m ganz am Grund getaucht (0,5 m/s, im Mittel {mittel:.1f} m tief) braucht {bedarf:.0f} l = {bedarf / (FLASCHE_L * (1 - RESERVE)):.1f} Flaschenfüllungen')

# ---- 2. Sprung -------------------------------------------------------------------
print('\n## 2. Sprung\n')
hoch = ABSPRUNG ** 2 / (2 * SCHWERKRAFT)
flugzeit = 2 * ABSPRUNG / SCHWERKRAFT
print(f'Scheitel {hoch:.2f} m (Schwerpunkt), Flugzeit {flugzeit:.2f} s')
print(f'Weite aus dem Gehen {GEHEN * flugzeit:.1f} m, aus dem Rennen {RENNEN * flugzeit:.1f} m (Weltrekord Weitsprung 8,95 m)')
for real in (0.35, 0.50):
    print(f'  real {real:.2f} m Standhochsprung → Faktor {hoch / real:.1f}, Absprung {math.sqrt(2 * SCHWERKRAFT * real):.1f} m/s')

# ---- 3. Gleiten ------------------------------------------------------------------
print('\n## 3. Gleiten\n')
vor = GLEIT_VERHAELTNIS * GLEIT_SINKEN
print(f'Spiel: {GLEIT_VERHAELTNIS}:1, vorwärts {vor:.1f} m/s = {vor * 3.6:.0f} km/h, Sinken {GLEIT_SINKEN} m/s')
for v in TRIMM_REAL:
    print(f'Real Freizeitschirm: {GLEITZAHL_REAL}:1 bei {v:.1f} m/s = {v * 3.6:.0f} km/h → Sinken {v / GLEITZAHL_REAL:.2f} m/s')
print(f'Landung mit {GLEIT_SINKEN} m/s Sinken entspricht einem Sprung aus {GLEIT_SINKEN ** 2 / (2 * SCHWERKRAFT):.2f} m')
print(f'Absprung Südwest → Saatkammer: 1.330 m auf {975 - 601} m Höhe verlangt {1330 / (975 - 601):.1f}:1; '
      f'bei {GLEIT_VERHAELTNIS}:1 trägt die Höhe {(975 - 601) * GLEIT_VERHAELTNIS} m, bei {GLEITZAHL_REAL}:1 {(975 - 601) * GLEITZAHL_REAL:.0f} m')

# ---- 4. Reittier -----------------------------------------------------------------
print('\n## 4. Reittier\n')
print(f'Reiter mit Zeug {REITER_KG} kg (mit voller Traglast 36 kg: {75 + 36} kg)')
print('| Traganteil | Tier muss wiegen | mit voller Traglast |\n|---|---|---|')
for a in TRAGANTEIL:
    print(f'| {a * 100:.0f} % | {REITER_KG / a:.0f} kg | {(75 + 36) / a:.0f} kg |')
print('| Tier | Masse kg | trägt bei 20 % | bei 30 % |\n|---|---|---|---|')
for name, kg in (('Keiler, Mitteleuropa üblich', 90), ('Keiler aus dem Entwurf', 140), ('Keiler, grösste in Mitteleuropa', 200),
                 ('Keiler, Ussuri-Form (125 cm Schulter)', 325), ('Alpensteinbock, Bock', 100)):
    print(f'| {name} | {kg} | {kg * 0.2:.0f} kg | {kg * 0.3:.0f} kg |')
print(f'Massstab im Code (`reiten.ts`): Widerrist × 1,2 → Masse × {1.2 ** 3:.2f}; von 0,8 m und 90 kg auf 1,25 m: {90 * (1.25 / 0.8) ** 3:.0f} kg')
print(f'Reittempo {REITEN_RENNEN} m/s = {REITEN_RENNEN * 3.6:.0f} km/h, im Schritt {REITEN_GEHEN} m/s = {REITEN_GEHEN * 3.6:.0f} km/h')

# ---- 5. Klettern, Schwimmen, Wege ------------------------------------------------
print('\n## 5. Klettern, Schwimmen, Wege\n')
dauer = AUSDAUER_MAX / KLETTERN_JE_SEK
print(f'Klettern: {KLETTERN_TEMPO} m/s = {KLETTERN_TEMPO * 3600:.0f} m/h, {dauer:.2f} s je Leiste = {dauer * KLETTERN_TEMPO:.1f} m; '
      f'Weltrekord Speedklettern 15 m in 4,64 s = {15 / 4.64:.2f} m/s; Seilschaft 35 m in 20–30 min = {35 / 1800:.3f}–{35 / 1200:.3f} m/s')
print(f'  gleiche Reichweite bei 1,0 m/s: Grundwert 6,9 m → {AUSDAUER_MAX / 6.9:.1f}/s, mit Kletterzeug 13,8 m → {AUSDAUER_MAX / 13.8:.1f}/s')
voll = AUSDAUER_MAX / SCHWIMMEN_JE_SEK
print(f'Schwimmen: {SCHWIMMEN_TEMPO} m/s für {voll:.1f} s = {voll * SCHWIMMEN_TEMPO:.1f} m, dann {SCHWIMMEN_TEMPO * TREIBEN:.2f} m/s ohne Ende; '
      f'real bekleidet in 12 °C {SCHWIMMEN_KLEIDUNG_KALT:.2f} m/s über 815 m')
for name, strecke in (('Absetzbecken', 21), ('Kapelle', 380), ('Kirchturm', 447)):
    spiel = min(strecke, voll * SCHWIMMEN_TEMPO) / SCHWIMMEN_TEMPO + max(0, strecke - voll * SCHWIMMEN_TEMPO) / (SCHWIMMEN_TEMPO * TREIBEN)
    print(f'  {name} {strecke} m: Spiel {minuten(spiel)}, real {minuten(strecke / SCHWIMMEN_KLEIDUNG_KALT)} (Faktor {strecke / SCHWIMMEN_KLEIDUNG_KALT / spiel:.1f})')
print(f'Erholung: voll in {AUSDAUER_MAX / ERHOLUNG_JE_SEK:.1f} s')
print('\n| Weg | m / Hm | real (DIN 33466) | Spiel gehen | Spiel rennen | Rennen 7,0 | Rennen 8,5 |\n|---|---|---|---|---|---|---|')
for name, m, hm in (('Start → Magd', 1182, 11), ('Brannburg → Wehr', 1681, 10), ('Brannburg → Saatkammer', 1856, 99),
                    ('Brannburg → Oberstollen', 2097, 451), ('Start → Quelltopf', 1959, 343), ('Region quer', 4000, 0)):
    eben, steig = m / 4000 * 60, hm / 300 * 60
    real = max(eben, steig) + min(eben, steig) / 2
    print(f'| {name} | {m} / {hm} | {real:.0f} min | {minuten(m / GEHEN)} | {minuten(m / RENNEN)} | {minuten(m / 7.0)} | {minuten(m / 8.5)} |')
print(f'Anstieg Oberstollen im Spiel: 451 Hm in {2097 / GEHEN / 60:.1f} min = {451 / (2097 / GEHEN) * 3600:.0f} Hm/h gegen 300 Hm/h real')
