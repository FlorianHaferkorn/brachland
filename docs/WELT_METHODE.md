---
last-reviewed: 2026-11-23
shelf-life-days: 90
---
# Welt-Methode — Backkette und Fallen (Ergänzung zu `VERFAHREN_ORT.md`)

> **Hauptdokument ist `VERFAHREN_ORT.md`** (D459, Cloud; Akte je Ort, zehn Schritte, Abnahme, Eskalation). Diese Datei
> ergänzt es um das, was die M1-Sitzung beim Backen gelernt hat: die Kette `../tools/ortkette.sh` für den Schritt
> „Szene exportieren“, die Messbefehle am M1 und acht Fallen, die alle schon passiert sind (D474–D478). Beide wurden
> am 23.11.2026 parallel geschrieben; bei Widerspruch gilt `VERFAHREN_ORT.md`, Abweichungen im Ledger melden.
> Offen/erledigt steht im Ledger (`_INDEX.md`), nicht hier.

## Grundsatz

Der Ort wird **nicht nachgebaut**. Die Blender-Szene des Zielbilds wird gebacken und selbst ins Spiel gesetzt: Mauern
und Felsen mit Relief, Boden, Pflanzen, Schattenhülle. Alles liegt hinter dem Schalter des Orts (Felsmulde:
`?lookfels=1`), bis Flo den Ort freigibt. Abnahme je Ort: Messbild Spiel │ Zielbild mit gleicher Kamera, 10 s Gang
als Video, 60 B/s am M1 (D474).

## Voraussetzungen (vor Schritt 1 prüfen)

| Was | Wo | Prüfen |
|---|---|---|
| Zielbild-Szene als `.blend` mit Objekt `terrain` | `.cache/blender/<ort>/…blend` (Felsmulde: `szene4.blend`) | Datei da; **nicht** im Scratchpad lassen (wird gelöscht) |
| Geländedaten des Orts | `.cache/blender/<ort>/terrain.json` (`cx`, `cz`, `h0`) | aus `tools/terrainexport.ts` |
| Freigegebenes Zielbild und seine Kamera | Ledger Tabelle B, `tools/stilframes.py` | Kameraort und Blickpunkt notieren |
| Entwicklungsserver | `http://127.0.0.1:5174` (`npm run dev -- --host 127.0.0.1 --port 5174 --strictPort`) | `curl` liefert 200 |
| Speicher | 8 GB: **nie zwei Blender gleichzeitig**, keine Messung während eines Renders | `pgrep -f Blender.app` |

Koordinaten Render → Spiel: `x = cx + X`, `z = cz − Y`, `y = Y_hoch + h0` (Felsmulde: `cx −800`, `cz 600`).

## Schritt 1 — Kette laufen lassen

```bash
tools/ortkette.sh .cache/blender/felsmulde/szene4.blend felsmulde .cache/blender/felsmulde/terrain.json
```

Dauer etwa 45 Minuten, im Hintergrund starten. Die Kette prüft die Bildpfade, backt Bauten, Boden und Pflanzen, baut
die Schattenhülle und hält das Register `public/bauten-ziel/register.json` zusammen. Einzelne Teile:
viertes Argument, z. B. `pflanzen,schatten`.

**Prüfpunkte danach** (alle müssen halten):
- Ausgabe endet mit `FERTIG`, kein `FEHLER`.
- `REGISTER <ort> ['bauten', 'wasser', 'boden', 'pflanzen', 'schatten'] boden ok`.
- Grössen ungefähr wie Felsmulde: bauten 30–40 MB, boden 2 MB, pflanzen 8–15 MB, schatten < 1 MB.
- `.cache/blender/bake/MauerA_farbe.png` ansehen: Steine und Moos, **kein Magenta, kein Schwarz**.

## Schritt 2 — im Spiel ansehen

Das Spiel lädt `public/bauten-ziel/` für jedes Bauwerk, das dort im Register steht, sobald der Schalter gesetzt ist
(`src/world/bauwerke.ts`, `ordner`). Für einen **neuen** Ort ist nichts weiter nötig, solange er im alten Register
`public/bauten/register.json` schon vorkommt (Terrasse und Freihaltung kommen von dort).

```bash
MESS_URL=http://127.0.0.1:5174 MESS_NUR_STAND=1 node tools/mess/messbild.mjs .cache/bilder/<Dxxx>/nachher \
  "<x,z,grad>" "&echt=1&lookfels=1&stimmung=zielbildfels&kamera=<x,y,z,tx,ty,tz>&fov=<grad>&zeit=0.26" 1920x1080
```

Felsmulde: Absetzen `-814,597.2,-101`, Kamera `-811,455.01,597.8,-795,455.56,601.0`, `fov=45.75`. Die Figur steht 3 m
hinter der Kamera, sonst ragt ihre Waffe ins Bild. Bild mit dem Read-Werkzeug ansehen.

## Schritt 3 — gegen das Zielbild messen

```bash
python3 tools/mess/messwerte.py <zielbild.png> <vorher.png> <nachher.png>
```

Zielwerte Felsmulde (Zielbild): Helligkeit 0,27 · unter 0,2: 41 % · über 0,7: 0,5 % · Sättigung 0,46. Abweichung je
Bildfeld messen, **bevor** etwas verstellt wird (Muster: Ledger D474/D475): erst Ursache einzeln abschalten
(`&aus=kronen`, `&aus=schatten`, `&ao=0`), dann genau einen Wert ändern, wieder messen.

## Schritt 4 — Bildrate

```bash
MESS_FORMAT=1440x900 MESS_DPR=2 MESS_URL=http://127.0.0.1:5174 node tools/mess/bildrate.mjs \
  "absetzen=<x,z,grad>&echt=1&stimmung=zielbildfels&kamera=…&fov=…&zeit=0.26&lookfels=1" "Lauf 1=" "Lauf 2=" "Lauf 3="
```

Ziel 60 B/s (die Messung ist bei 60 gedeckelt). Fehlt etwas: je Lauf **einen** Posten abschalten
(`&aus=pflanzen`, `&aus=baeume`, `&aus=schatten`, `&aus=kronen`, `&aus=bauwerke`, `&aus=teppich`, `&ao=0`) und den
teuersten angehen. Faustwerte am M1: rund 3 ms je Million Dreiecke; ein paralleler Blender-Render kostet 3–6 B/s.

## Schritt 5 — abschliessen

1. Bildpaar vorher │ nachher │ Zielbild, gleiche Kamera, beschriftet, nach `.cache/bilder/<Dxxx>/`; an Flo senden.
2. Ledgerzeile in `_INDEX.md` Tabelle B: `make ledger-ids` nennt die Nummer; vorher `git fetch` und prüfen, ob der
   Cloud-Chat sie schon vergeben hat (`git show origin/claude/epic-planck-86z6fy:docs/_INDEX.md`).
3. Neue Dateien im jeweiligen `_INDEX.md` eintragen, `make check` muss grün sein.
4. Commit nur auf Flos Wunsch. Die GLB unter `public/bauten-ziel/` sind nicht eingecheckt (A-46).

## Fallen (alle schon einmal passiert)

1. **Magenta-Texturen:** Die `.blend` lag an anderem Ort, relative Bildpfade zeigten ins Leere. Die Kette bricht in
   Schritt „prüfen“ ab; Pfade in der Datei absolut setzen und speichern.
2. **Exit 137 (Speicher):** zwei Blender gleichzeitig, oder geteilte Scan-Netze wachsen beim Zusammenfügen
   (`szenenexport.py` löst sie seit D445). Nie parallel rendern; die Kette hält die Sperre `.cache/blender.sperre`.
   Steht die Sperre und läuft kein Blender, Ordner löschen.
3. **Register verliert Einträge:** `szenenexport.py` schreibt den Eintrag neu, ohne `boden`, `pflanzen`, `schatten`.
   Die Kette hängt sie wieder an — deshalb nie `szenenexport.py` einzeln ohne Kette laufen lassen.
4. **Pflanzen als 10 000 Einzelaufrufe:** Blender exportiert keine GPU-Instanzen; `bautenpack.ts --instanz` macht sie.
5. **Efeu/Laub weiss oder leer:** Geometrie-Knoten müssen ausgerechnet werden, solange Mauer und Gelände noch in der
   Szene sind; Blattfarbe kommt als Eckenfarbe (`pflanzenexport.py`).
6. **Unsichtbare Kosten:** Der Grasteppich der Spielwelt rechnete 1,9 Mio. Dreiecke ohne einen Halm (D464). Vor dem
   Optimieren immer zerlegen, nie raten.
7. **Messung verfälscht:** läuft Blender, ist die Bildrate zu niedrig. Variantenname in `bildrate.mjs` darf kein `=`
   enthalten.
8. **Ledger-Nummern:** Der Cloud-Chat vergibt parallel. Die später gemergte Seite nummeriert um.

## Was je Ort anzupassen ist (noch nicht verallgemeinert)

Die Werkzeuge sind an der Felsmulde gebaut. Für einen anderen Ort vorher prüfen und, wenn nötig, als Parameter
herausziehen — **nicht** kopieren:
- `tools/bodenexport.py`: `MITTE = (-2, -1)` (Terrassenmitte) und Radius 30.
- `tools/szenenexport.py`: `ZIEL_BAU` (Namensanfänge der Objekte), Flächenbudget `BUDGET`, Terrasse nur für
  `felsmulde`, Namen der Körper mit Relief (`Mauer…`, `Fels…`, `Hof`, `Balken`).
- `tools/pflanzenexport.py`: `MUSTER` (Namen der Pflanzenobjekte).
- Spiel: Schalter `LOOK_FELS_AN`, Stimmung `zielbildfels`, `Rahmenkronen.tsx` (13 Bäume der Felsmulde) sind
  ortsgebunden. Ein zweiter Ort braucht einen eigenen Schalter oder einen allgemeinen (`?ziel=<ort>`).
- Es braucht je Ort ein **freigegebenes Zielbild als Szene**. Gibt es keins (Stauwehr, Hof, Siedlung: Ledger prüfen),
  ist das der erste Schritt und Flos Entscheidung.

## Was ein günstigeres Modell tun darf und was nicht

- **Darf:** die Schritte 1–5 für einen Ort ausführen, dessen Zielbild-Szene vorliegt; messen; einen Wert je Durchgang
  ändern; berichten.
- **Darf nicht ohne Rückfrage:** Zielbilder neu gestalten, erarbeitete Werte ausserhalb des Ort-Schalters ändern,
  committen, pushen, mergen, Nummern im Ledger verschieben, sich irgendwo einloggen.
- **Immer:** bei rotem Prüfpunkt anhalten und die Ausgabe wörtlich melden; nie „fertig“ ohne Bild und Messwert.
