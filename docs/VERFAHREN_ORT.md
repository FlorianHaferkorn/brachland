---
last-reviewed: 2026-11-23
shelf-life-days: 60
---
# Verfahren „Ort für Ort“ — vom freigegebenen Zielbild ins Spiel (D459)

> Flo, 23.11.2026: „Ort für Ort nach der selben Methode soll dann mit billigeren Modellen funktionieren.“
> Dieses Dokument ist die Methode, mit der die Felsmulde vom Zielbild ins Spiel kam (D445 → D446 → D448 → D450),
> als fester Ablauf für **einen** Ort. Es ist für ein günstigeres Modell (Sonnet, Haiku) geschrieben: Du führst
> Befehle aus, liest Messwerte ab und meldest. Du gestaltest nichts. Offen/erledigt steht im Ledger (`_INDEX.md`),
> nicht hier.

**Lies nur dieses Dokument und die Akte deines Ortes** (`../tools/ort/<ort>.json`). Du brauchst weder `CLAUDE.md`
auszulegen noch den Projektverlauf zu kennen; was davon gilt, steht in Abschnitt 2.

## 0. Was dieses Verfahren kann und was nicht (ehrlich)

- Es **überträgt** eine fertige, von Flo freigegebene Blender-Szene ins Spiel und **misst** den Abstand. Es baut
  kein Zielbild. Ein Zielbild ist Gestaltung über mehrere Runden mit Flo (Felsmulde: fünf Runden, D372–D442) und
  bleibt bei einem starken Modell.
- Es macht den Look nicht „fertig“. Die Felsmulde besteht die sieben Bildkennzahlen seit D480. A-46 bleibt für die Abnahme in Bewegung offen. Das Verfahren stellt das fest und gibt es zurück; es behebt es nicht.
- Die Abnahme des Looks ist und bleibt Flo am M1, in Bewegung (ADR-0005). Messwerte aus einem Standbild sind eine
  Vorprüfung, keine Look-Aussage.
- Die Engine-Seite ist heute **nur für die Felsmulde** verdrahtet: Schalter `?lookfels=1`, Kronen in
  `../src/scenes/Rahmenkronen.tsx`, Objektnamen in `../tools/szenenexport.py`. Für einen zweiten Ort muss ein
  starkes Modell das einmal verallgemeinern (Abschnitt 9, Lücken L1–L3; Ledger A-53). Bis dahin läuft das Verfahren an einem
  neuen Ort bis Schritt 5 durch und stoppt in Schritt 6 mit einer Rückmeldung.

## 1. Eingaben: die Akte des Ortes

Eine Datei je Ort: `../tools/ort/<ort>.json`, Schema `Akte` in `../tools/ortlogik.ts`, Muster
`../tools/ort/felsmulde.json`. Sie liegt unter `tools/` und nicht unter `content/`, weil sie Messaufbau ist und
keine Spielwerte enthält (gleiche Begründung wie bei den Rahmenkronen, D446).

| Feld | Bedeutung | Woher |
|---|---|---|
| `id`, `name`, `region` | Kennung (Dateiname), Anzeigename, Region | Ledger |
| `ursprung`, `h0` | Weltpunkt des Blender-Ursprungs und Geländehöhe dort | `terrain.json` des Terrain-Exports (`../tools/terrainexport.ts`) |
| `hoehenversatz` | Höhenzuschlag der Kamera zwischen Render und Spiel | Ledgerzeile des Messbilds (Felsmulde D445: 0,2 m) |
| `zielbild.freigabe` | Ledgerzeile, in der Flo das Zielbild freigegeben hat | Ledger. **Ohne Freigabe kein Lauf.** |
| `zielbild.werkzeug`, `modus`, `bild`, `blend`, `terrain` | Blender-Skript und Modus, fertiges Bild, gespeicherte Szene, Terrain-Ordner | Ledgerzeile des Zielbilds |
| `kameras[]` | Standort, Blickpunkt (Blender-Meter über der Terrasse), Brennweite, Sensorbreite | aus dem Skript ablesen, nicht schätzen |
| `sonne` | Azimut (von Nord im Uhrzeigersinn) und Höhe in Grad | aus dem Skript |
| `spiel.stimmung`, `schalterVorher`, `schalterNachher`, `ordner` | Messstimmung, Schalter ohne/mit übertragener Szene, Exportordner unter `public/` | Engine |
| `bauteile[]` | Wand, Fels, Boden, Wasser, Pflanzen, Kronen … mit `weg`: `szenenexport`, `bodenexport`, `pflanzenexport`, `engine` (wird nicht übertragen), `hand` (kein Werkzeug → Rückgabe) | Zielbild-Szene |
| `quellen[]` | Asset-Quellen mit Lizenz und `imSpiel` | Ledgerzeile des Zielbilds, ADR-0013/0021 |
| `abnahme.toleranz`, `bildrate`, `budget` | Schwellen für Schritt 6–8 | Vorgabe unten; nur Flo oder ein starkes Modell ändert sie |
| `protokoll[]` | bisher gemessene Werte je Ledgerzeile | wird in Schritt 10 fortgeschrieben |

**Toleranzen (Vorschlag D459, von Flo nicht bestätigt — A-52):** mittlere Helligkeit ±0,05 · Fläche unter 0,2
±10 Punkte · Fläche über 0,7 ±5 Punkte · R−B Lichter ±0,08 · R−B Schatten ±0,05 · Sättigung ±0,08 · Himmel
±5 Punkte. **Bildrate:** Der technische Standtest D450 hat eine Untergrenze von 30 B/s bei 1600 × 900, Pixeldichte 1. Für die Freigabe der Felsmulde gilt seit D474 der Gang mit 60 B/s am M1. Den Gang bei 1440 × 900 (Pixeldichte 1 wie D464) ohne Videoaufnahme messen. `MESS_GANG=1 MESS_FORMAT=1440x900 node tools/mess/bildrate.mjs "absetzen=-814,597.2,-101&echt=1&lookfels=1&stimmung=zielbildfels" "voll="` meldet die zurückgelegten Meter und die Bildzeiten. **Budget:**
Dateien ≤ 60 MB, Bauwerke ≤ 1,3 Mio. Dreiecke, ≤ 2 000 Aufrufe (Richtwerte aus dem Stand D450: 55 MB,
1,18 Mio.; ob die Dateien ins Repo gehören, ist offen, A-46 Punkt 4).

## 2. Pflichten in Kurzform (gelten immer)

1. **Bildpaar** vorher/nachher bei jeder sichtbaren Änderung: gleiche Kamera, gleiche Ladezeit, beschriftet, unter
   `.cache/bilder/<Dxxx>/` (Schritte 4, 7, 9).
2. **Bildpfade nur relativ** (`.cache/bilder/Dxxx/…`), nie mit `/home/…` oder `/Users/…`.
3. **Ledgerzeile** in `_INDEX.md` Tabelle B im selben Arbeitsschritt; Nummer aus `make ledger-ids`. Nichts neu
   fragen oder ableiten, was dort entschieden steht.
4. **`make check` muss grün sein** vor dem Commit; Commit ohne `--no-verify`, `git add` mit genauen Pfaden.
5. **Physik muss stimmen** (D398): Sonne, Wasserstand, Massstab, Wuchs werden übernommen, wie sie im Render
   sind. Eine Abweichung zugunsten des Spiels wird in der Ledgerzeile benannt und begründet, nie still.
6. **Lizenzen** (ADR-0013, ADR-0021): ins Spiel nur kostenlos und frei, bevorzugt CC0 (Poly Haven, ambientCG).
   **Megascans nur im Zielbild**, nie nach `public/`. Jede neue Datei unter `public/` braucht einen Eintrag in
   `../assets/HERKUNFT.md` und im passenden `_INDEX.md`. Steht in der Akte eine Quelle mit `imSpiel: false` an
   einem Bauteil, das exportiert würde: stoppen und melden.
7. **Code und Kommentare deutsch.** Spielwerte gehören nach `content/`, nicht in den Code.
8. **Keine Look-Aussage aus einem Standbild.** In jede Ledgerzeile: „Standbild, keine Look-Abnahme“.
9. **Fremde Dateien nicht anfassen**; `../src/scenes/RegionsSzene.tsx` und Kampfwerte überhaupt nicht.

## 3. Wo was läuft

| Nur am M1 | Auch in der Cloud |
|---|---|
| Blender-Render und Backen (Scans liegen lokal unter `.cache/cc0/`, Felsmulde braucht CPU-Render mit `BRACHLAND_CPU=1`, D436) | Akte prüfen (Schritt 1) |
| Szenenexport, Boden-, Pflanzenexport (Schritt 6) | Zielbild messen (Schritt 2) |
| Messbild im Spiel mit echter GPU (Schritte 4, 7) | Kamera, Sonne, Adresse rechnen (Schritt 3) |
| Bildrate (Schritt 8) — nie, während ein Blender-Render läuft (D445: Messung war so nicht belastbar) | Abnahme rechnen, wenn die Bilder vorliegen (`abnahme`), Bildpaar (Schritt 9) |
| Abnahme in Bewegung durch Flo | Ledger, Protokoll, `make check` (Schritt 10) |

In der Cloud gibt es keine GPU: Ein Spielbild von dort (SwiftShader) ist ein Grössen- und Formvergleich und darf
**nicht** in die Abnahme. `$BLENDER` ist am M1 der Blender-Pfad der Sitzung, in der Cloud
`/opt/blender/blender-5.3.0-linux-x64/blender`.

## 4. Die Schritte

`make ort ORT=<ort> D=<Dxxx>` druckt alle zehn Schritte mit den ausgefüllten Befehlen deines Ortes,
`make ort ORT=<ort> SCHRITT=<n> D=<Dxxx>` einen. Die Befehle unten sind dieselben mit Platzhaltern; **kopiere die
ausgefüllten aus der Ausgabe**, nicht die Platzhalter. `<adresse>` und `<absetzen>` liefert Schritt 3.

Für jeden Schritt gilt die **Abbruchregel: höchstens die zwei genannten Nachstellschritte, dann stoppen und nach
Abschnitt 6 melden.** Kein dritter Versuch, kein eigener Einfall.

| Nr. | Zweck | Befehl | Erwartete Ausgabe | Abnahme (Messwert, Schwelle) | Bei Verfehlen (höchstens diese zwei) |
|---|---|---|---|---|---|
| 1 | **Akte prüfen:** alle Eingaben da, Zielbild freigegeben | `npx tsx tools/ortverfahren.ts <ort> pruefe` | Liste der Bauteile und Quellen | letzte Zeile `AKTE GÜLTIG`; kein Bauteil mit Weg `hand` | (1) fehlendes Feld aus der genannten Ledgerzeile nachtragen · (2) fehlt die Freigabe oder Weg `hand`: stoppen, melden |
| 2 | **Zielbild messen:** die Messlatte festhalten | `npx tsx tools/ortverfahren.ts <ort> zielwerte` | Tabelle der Grössen mit Regelbereich | Tabelle da. Regelbereich (`referenz/REFERENZ_SPIELE.md` Regeln 1 und 3): Helligkeit 0,25–0,35 · unter 0,2: 30–50 % · über 0,7: ≤ 5 % · R−B Lichter +0,10 bis +0,20 · R−B Schatten 0 bis +0,05. Ausserhalb = melden, **nicht ändern** | (1) Bild fehlt: Pfad in der Akte prüfen · (2) stoppen, melden |
| 3 | **Kamera und Sonne ins Spiel rechnen** | `npx tsx tools/ortverfahren.ts <ort> adresse [kamera]` | `kamera=…`, `fov=…`, `absetzen=…`, Sonnenstand | Zeile `STIMMUNG PASST` (Sonnenstand der Messstimmung je Achse ≤ 0,5 neben dem gerechneten) | (1) `STIMMUNG FEHLT`: den ausgegebenen Vier-Zeilen-Block **unverändert** in `../src/world/stimmung.ts` hinter `STIMMUNG.zielbild` einfügen, `make check` · (2) `STIMMUNG WEICHT AB`: nichts überschreiben, stoppen, melden |
| 4 | **Messbild vorher** (M1): Ausgangslage und Vorher-Bild | `npx vite build && npx vite preview --port 4173 --strictPort &` · `node tools/mess/messbild.mjs .cache/bilder/<Dxxx>/vorher "<absetzen>" "<adresse vorher>" 1920x1080` · `npx tsx tools/ortverfahren.ts <ort> abnahme .cache/bilder/<Dxxx>/vorher/spiel-standbild.png` | `spiel-standbild.png`, `spiel-bewegung.webm`, `bericht.json`, Abnahmetabelle | Dateien da; `bericht.json` nennt Ladezeit und Dreiecke; keine Zeile „Bild fast schwarz“ oder „Magenta“. Die Tabelle darf hier **nicht bestanden** zeigen | (1) prüfen: kein Blender parallel, Server antwortet auf 4173; einmal wiederholen · (2) stoppen, melden |
| 5 | **Look-Durchgang** (Licht, Luft, Kronen) — **nicht dein Schritt** | Tabelle aus Schritt 4 mit der Spalte „Hebel“ in die Rückmeldung kopieren | Rückmeldung nach Abschnitt 6 | kein Messwert, den du einstellst: Sonnenfarbe, Fülllicht, Belichtung, Nebel, Kronen sind Art-Direction-Werte (D446) | nicht nachstellen; melden und mit Schritt 6 weitermachen |
| 6 | **Szene exportieren** (M1): Wand, Fels, Boden, Wasser, Pflanzen aus der Blender-Szene selbst | `SZENE_ZIEL=1 SZENE_TERRAIN=<terrain>/terrain.json $BLENDER --background <blend> --python tools/szenenexport.py -- public/<ordner> <ort> 1024` · `SZENE_TERRAIN=… $BLENDER --background <blend> --python tools/bodenexport.py -- public/<ordner> <ort>` · `$BLENDER --background <blend> --python tools/pflanzenexport.py -- public/<ordner> <ort>` · `npx tsx tools/bautenpack.ts --kante 2048 …-bauten.glb` · `… --kante 2048 …-boden.glb` · `… --kante 1024 --instanz …-pflanzen.glb` · `npx tsx tools/ortverfahren.ts <ort> budget` | `public/<ordner>/<ort>-*.glb`, Eintrag in `register.json` | `BUDGET BESTANDEN`: alle Dateien der Akte da, Summe ≤ Budget (60 MB) | (1) Exit 137 oder Abbruch: kein zweiter Blender, denselben Befehl einmal wiederholen · (2) zu gross: mit `SZENE_NIEDRIG=0.12` und `PFLANZE_MAX=600` neu exportieren und packen; danach stoppen, melden |
| 7 | **Messbild nachher und Abnahme** (M1) | `npx vite build` (Server neu starten) · `node tools/mess/messbild.mjs .cache/bilder/<Dxxx>/nachher "<absetzen>" "<adresse nachher>" 1920x1080` · `npx tsx tools/ortverfahren.ts <ort> abnahme .cache/bilder/<Dxxx>/nachher/spiel-standbild.png` | Bild, Video, Abnahmetabelle | `ABNAHME: BESTANDEN` — alle sieben Grössen innerhalb der Toleranz, kein Magenta, Bild nicht schwarz | (1) Magenta oder Dreieckszahl wie in Schritt 4: Szene nicht geladen — Dateien, Register, Schalter prüfen, einmal wiederholen · (2) Grössen ausserhalb: **nicht** an Licht, Material, Belichtung drehen; Tabelle melden, weiter mit Schritt 8 |
| 8 | **Bildrate** (M1) | `MESS_FORMAT=1600x900 MESS_DPR=1 node tools/mess/bildrate.mjs "absetzen=<absetzen><adresse nachher>" "voll=" "ohnebauwerke=&aus=bauwerke" "ohnepflanzen=&aus=pflanzen" "ohneschatten=&aus=schatten" "ohnekronen=&aus=kronen" \| tee .cache/bilder/<Dxxx>/bildrate.txt` · dasselbe mit `MESS_FORMAT=800x450` und nur `"halb="`, `tee -a` · `npx tsx tools/ortverfahren.ts <ort> bildrate .cache/bilder/<Dxxx>/bildrate.txt` | `bildrate.txt`, Urteil mit Engpass | `BILDRATE BESTANDEN`: `voll` ≥ 30 B/s | (1) nennt das Urteil Nachstellschritt A (Pflanzen mit `--instanz` packen) oder B (`SZENE_NIEDRIG=0.12`): ausführen, einmal neu messen · (2) Engpass `welt` oder `pixel` oder weiter unter 30: stoppen, melden |
| 9 | **Bildpaar** | `python3 tools/mess/bildpaar.py .cache/bilder/<Dxxx>/paar-<ort>.jpg "Zielbild <Freigabe>=<bild>" "Spiel vorher=…/vorher/spiel-standbild.png" "Spiel nachher <Dxxx>=…/nachher/spiel-standbild.png"` | `paar-<ort>.jpg` | Datei da, drei beschriftete Felder gleicher Höhe | (1) fehlendes Bild: Schritt 4 oder 7 nachholen · (2) stoppen, melden |
| 10 | **Ledger, Protokoll, Gate, Commit** | `make ledger-ids` · Werte in `tools/ort/<ort>.json` unter `protokoll` · Ledgerzeile nach Abschnitt 7 · `make check` · `git add <genaue Pfade> && git commit` | Ledgerzeile, Commit | `make check` ohne Fehler | (1) rot wegen eigener Änderung: gemeldete Zeile beheben, einmal wiederholen · (2) rot aus fremdem Grund oder zweimal rot: nicht committen, stoppen, melden |

Die sieben Grössen misst `../tools/mess/messwerte.py` (960 × 540, Rec.-709-Helligkeit der angezeigten Werte,
Sättigung nach HSV, Himmel per Flutfüllung vom oberen Rand). Zielbild und Spielbild werden mit derselben Regel
gemessen; die Himmelszahl ist deshalb nicht die aus dem Tiefenpass der Zielbild-Runden (D386: 7,0 %).

## 5. Was du NICHT entscheidest

Zurück an ein stärkeres Modell oder an Flo geht alles, wofür es keinen Messwert mit Schwelle gibt:

1. **Look-Urteil** jeder Art („sieht besser aus“, „passt“, „zu dunkel“). Du nennst Zahlen.
2. **Licht- und Farbwerte**: Sonnenfarbe und -stärke, Fülllicht, Belichtung, Nebel, Himmel, Wolken — auch dann
   nicht, wenn die Tabelle genau diesen Hebel nennt. Erlaubt ist nur der Vier-Zeilen-Block aus Schritt 3
   (Sonnen**richtung**, gerechnet).
3. **Art-Direction-Werte in `../src/scenes/RegionsSzene.tsx`** und überhaupt jede Änderung an dieser Datei.
4. **Neue Werkzeuge, Shader, Schalter, Exportregeln** (z. B. neue Objektnamen in `szenenexport.py`, ein
   `?look<ort>=1`, Kronen für einen neuen Ort).
5. **Kampfwerte, Spielwerte, Inhalte** unter `content/`.
6. **Toleranzen, Bildraten-Ziel, Budgets** der Akte.
7. **Das Zielbild selbst**: Kamera, Sonne, Motive, Materialien, Stil. Auch nicht „nur leicht“.
8. **Lizenzfragen** jenseits der Liste in der Akte (neue Quelle, Megascans im Spiel).
9. **Benannte Abweichungen von der Physik** (D398) und von „Positionen aus dem Seed“ (D448).
10. Alles, wobei du zwischen zwei Möglichkeiten **wählen** müsstest, die dieses Dokument nicht vorgibt.

## 6. Rückmeldung (Vorlage)

```
RÜCKGABE Verfahren Ort — <ort>, Runde <Dxxx>, <Datum>
Gestoppt in Schritt: <n> (<Titel>)        Rechner: <M1 | Cloud>
Erledigt und bestanden: <Schritte>
Nicht bestanden: <Schritt>: <Zeile der Ausgabe, wörtlich>
Versuche: 1. <was, Ergebnis>   2. <was, Ergebnis>
Abnahmetabelle (wörtlich aus `ortverfahren.ts abnahme`):
<Tabelle>
Bildrate (wörtlich aus `bildrate.txt` und Urteil):
<Zeilen>
Dateien: .cache/bilder/<Dxxx>/…
Was ich NICHT getan habe und warum: <z. B. Belichtung nicht verändert — Abschnitt 5 Punkt 2>
Frage an das stärkere Modell / Flo: <höchstens eine, mit Ja/Nein beantwortbar>
```

## 7. Ledgerzeile (Vorlage, Tabelle B, direkt nach der höchsten D-Zeile)

```
| Dxxx | **<Ort>: Verfahren Ort für Ort, Runde <n>** (`VERFAHREN_ORT.md`, `../tools/ort/<ort>.json`, Zielbild <Freigabe>) | Schritte 1–<n> ausgeführt am <Rechner>. **Messwerte** Zielbild │ vorher │ nachher: Helligkeit … │ … │ …; unter 0,2: …; über 0,7: …; R−B Lichter …; R−B Schatten …; Sättigung …; Himmel …. **Abnahme:** <bestanden | nicht bestanden: Grössen, Hebel>. **Bildrate** <B/s> bei 1600 × 900, Pixeldichte 1, Engpass <…>. **Dateien** <MB>. **Zurückgegeben:** <was, an wen>. Bildpaar `.cache/bilder/Dxxx/paar-<ort>.jpg`. Standbild, keine Look-Abnahme; nicht von Flo in Bewegung gesehen | <Datum> | — |
```

## 8. Beispiel-Akte Felsmulde — wie es tatsächlich lief

Akte: `../tools/ort/felsmulde.json`. Ledger: D425 (Auftrag), D445, D446, D448, D450; offen A-46.

**Vorlauf (nicht Teil des Verfahrens):** Zielbild in fünf Runden mit `../tools/stilframes.py` (D372, D382, D386,
D441, D442), Freigabe durch Flo D397 mit Auflage Wasser/Ufer. Am M1 bricht die GPU bei der Felsmulde ab
(„Insufficient Memory“), gerendert wird auf der CPU: `BRACHLAND_CPU=1`, 787–1 339 s je Kamera (D436, D441).

| Schritt | Tatsächlicher Befehl / Wert | Ergebnis |
|---|---|---|
| 3 Kamera | Runde 4, Kamera `ziel`: Ort −11/2,2/1,9, Blick 5/−1/2,45, 24 mm auf 36 mm; x = −800 + X, z = 600 − Y, y = h0 + 0,2 + Z | `?kamera=-811,455.01,597.8,-795,455.56,601.0&fov=45.75`, Figur `?absetzen=-814,597.2,-101` (D445). `ortverfahren.ts felsmulde adresse` rechnet dieselben Zahlen (Test) |
| 3 Sonne | Render: Azimut 194°, Höhe 24,5°; Messstimmung `zielbild` hatte 42°/13° | neue Messstimmung `zielbildfels`, `sonnenstand [-22.0, 41.5, 88.3]` (D445) |
| 4 Messbild vorher | `node tools/mess/messbild.mjs .cache/bilder/D445 "-814,597.2,-101" "&stimmung=zielbildfels&echt=1&kamera=-811,455.01,597.8,-795,455.56,601.0&fov=45.75" 1920x1080` — der wörtliche Aufruf steht nicht im Ledger, er ist aus D445 und dem Kopf von `messbild.mjs` zusammengesetzt | Ladezeit 9,7–11,3 s, 6,46 Mio. Dreiecke, 21–23 B/s (nicht belastbar, Blender lief parallel) |
| 4 Messwerte | Zielbild │ Spiel: Helligkeit 0,27 │ 0,36 · unter 0,2: 41 │ 36 % · über 0,7: 0,5 │ 2,7 % · R−B Lichter +0,13 │ +0,06 · R−B Schatten +0,01 │ +0,01 · Sättigung 0,46 │ 0,28 · Himmel 4,9 │ 28,9 % | nicht bestanden: Helligkeit, Sättigung, Himmel |
| 5 Look-Durchgang (starkes Modell, D446) | Sonne `#ffbf7a` 3,8, Fülllicht 1,7, Belichtung 2,5 → 1,95, Nebel 60–2 400 m, 13 Rahmenkronen | Helligkeit 0,24 · unter 0,2: 55 % · über 0,7: 6,5 % · R−B Lichter −0,07 · Sättigung 0,43 · Himmel 1,5 % |
| 6 Export (D448) | `SZENE_ZIEL=1 … szenenexport.py`, `bodenexport.py`, `pflanzenexport.py`, `bautenpack.ts --kante 2048` | 86 + 16 + 2 MB, 23 Mio. Dreiecke im Bild, 12–13 B/s |
| 7 Messwerte nachher (D448) | Helligkeit 0,21 · unter 0,2: 68 % · über 0,7: 7,5 % · Sättigung 0,45 · Himmel 1,6 % | **nicht bestanden:** Helligkeit (−0,06), unter 0,2 (+27 Punkte), über 0,7 (+7 Punkte) → Hebel Fülllicht in den Schatten (A-46 Punkt 1) |
| 8 Bildrate (D450) | `bildrate.mjs`, je Variante 10 s: voll 13 B/s, 23 Mio. Dreiecke, 10 794 Aufrufe; halbe Auflösung 17 → Geometrie | Nachstellschritt B (12 % der Flächen, Relief gebacken): 6,46 → 1,18 Mio. Dreiecke, 86 → 37 MB · Nachstellschritt A (`--instanz`): 6 676 → 69 Knoten · dann pixelgebunden (starkes Modell: kein MSAA, Pixeldichte 1) → **30 B/s** bei 1600 × 900, 26 bei 1920 × 1080; Welt allein 25–27 |
| 7 nach D450 | Helligkeit 0,23 · unter 0,2: 64 % (übrige Werte in D450 nicht einzeln genannt) | weiter nicht bestanden (Schatten) |

**Was gut ging:** Messen vor dem Bauen (D445 ordnete die Ursachen nach Bildfläche); die Szene selbst übertragen
statt nachbauen (D448); die Bildrate zerlegen statt raten (D450).

**Was Runden gekostet hat** (alles in den Nachstellschritten oben abgefangen, soweit es sich abfangen lässt):
Zielbild-Datei im Scratchpad, relative Bildpfade ins Leere → Mauern magenta (jetzt: Magenta-Messwert) · geteilte
Scan-Netze, fünfmal Exit 137 bei 8 GB · Blender parallel zur Bildratenmessung · Mausklick im Messlauf kippte die
Kamera · Kartenkronen erst fast schwarz · Belichtung als falscher Hebel für die Schatten (hebt nur den Himmel) ·
Meshopt-Vereinfachung allein reichte nicht (Relief steckt in jeder Ecke) · 10 000 Aufrufe durch Einzelknoten.

## 9. Einschätzung: was ein günstiges Modell trägt

| Schritt | Sonnet | Haiku | Grund |
|---|---|---|---|
| 1 Akte prüfen, 2 Zielbild messen, 3 Adresse | ja | ja | ein Befehl, ein Schlüsselwort in der Ausgabe |
| Akte für einen **neuen** Ort ausfüllen | mit Vorsicht | nein | Kamera und Sonne müssen aus 2 700 Zeilen Blender-Skript gelesen werden; Fehler fallen erst im Messbild auf |
| 4, 7 Messbild | ja (am M1) | wahrscheinlich | langer Lauf mit Server im Hintergrund; Fehlerbilder sind als Messwert abgefangen |
| 5 Look-Durchgang | **nein** | **nein** | reines Urteil; in D446 half ein Reel und Abwägen (warm machte die Berge beige, kühl den Himmel blau) |
| 6 Export an der Felsmulde | ja | unsicher | drei lange Blender-Läufe, Speichergrenzen; Abbruchregel greift |
| 6 Export an einem **neuen** Ort | **nein** | **nein** | `szenenexport.py` kennt nur die Objektnamen der Felsmulde, die Engine nur `?lookfels=1` (Lücken L1–L3) |
| 8 Bildrate messen und Engpass benennen | ja | ja | Urteil kommt aus `ortverfahren.ts bildrate` |
| 8 Bildrate **beheben** jenseits A/B | **nein** | **nein** | MSAA, AO, Pixeldichte, Schattenwerfer sind Engine-Entscheidungen (D450) |
| 9 Bildpaar, 10 Ledger und Gate | ja | ja, Ledgerzeile prüfen lassen | Vorlagen vorhanden |

Ungeprüft: Ob Sonnet oder Haiku den Ablauf wirklich fehlerfrei fahren, hat noch niemand ausprobiert. Die
Schritte 4, 6, 7, 8 sind in dieser Form (ein Aufruf über die Akte) am M1 noch nicht gelaufen.

**Lücken, die ein starkes Modell einmal schliessen muss, bevor ein zweiter Ort durchläuft** (Stand im Ledger: A-53):

- **L1 Engine:** `?lookfels=1`, `ZIELBAU` (`../src/world/bauwerke.ts`), Boden-Loch und Pixeldichte hängen an der
  Felsmulde. Nötig: ein Schalter je Ort oder ein allgemeiner, der das Register `public/bauten-ziel/register.json`
  für jeden Eintrag nimmt. Ein neuer Ort braucht zusätzlich einen Eintrag im Szenenbau-Register (Terrasse,
  Freihaltung).
- **L2 Export:** `szenenexport.py` (`ZIEL_BAU`, Löschliste) und `pflanzenexport.py` (`MUSTER`) erkennen Objekte an
  den Namen der Felsmulden-Szene. Nötig: Namen aus der Akte oder eine Namensregel für alle Zielbild-Skripte.
- **L3 Kronen:** `Rahmenkronen.tsx` trägt 13 Bäume der Felsmulde fest im Code. Nötig: Baumliste aus Daten
  (ADR-0004), exportiert aus dem Zielbild.
- **L4 Szenendatei:** Wo die `.blend` eines Zielbilds liegt, ist nicht festgelegt (Felsmulde: Scratchpad). Nötig:
  fester Ort unter `.cache/blender/<ort>/` und der Erzeugungsbefehl in der Akte.

## 10. Nächste Orte — Vorschlag mit Begründung

| Rang | Ort | Zielbild | Warum hier | Was fehlt |
|---|---|---|---|---|
| 1 | **Felsmulde, zweite Kamera und Runde 5** (`boden`, `ufer`) | freigegeben (D397), Runde 5 gerendert (D441/D442) | einziger Ort, an dem Engine und Export schon passen: der erste echte Probelauf des Verfahrens mit Sonnet, ohne L1–L3 | Tümpel der Runde 5 ist noch nicht exportiert; A-46 bleibt offen |
| 2 | **Hof 708** (Einfirsthof) | freigegeben (D378, `../tools/hausframe.py`, D373/D436–D439) | einziges weiteres freigegebenes Zielbild; ein Haus prüft Wand, Dach, Holz, Glas — andere Bauteile als die Mulde; `public/bauten/hof-708.glb` und der Hof-Baukasten sind als Vorher da | L1–L4; Objektnamen von `hausframe.py`; Akte (Ursprung, Kamera `haus`, Sonne) aus dem Skript |
| 3 | **Milbinger Straße** | erster Frame D435, **nicht abgenommen** (A-44) | die Netze kommen schon aus dem Spiel (`ortframe`), Schritt 6 schrumpft auf Materialien | Freigabe; der Abstand liegt dort bei Material, Verfall und Mobiliar, nicht bei der Übertragung |
| 4 | **Stauwehr** (1110/871) | nur Szenenbau D155, kein Zielbild nach ADR-0018 | Wasser, Steg, Auwald — und Slice-Standpunkt | Zielbild von Grund auf, mit Flo |
| 5 | **Brannburg-Terrasse** (um 696/−657) | keines | Spielmitte nach Story v2 (D375) | Zielbild; rund 80 Häuser im Nahbereich — erst sinnvoll, wenn Hof 708 und Milbinger gezeigt haben, dass Häuser nach Verfahren tragen |

Reihenfolge nach dem Grundsatz: zuerst dort, wo ein freigegebenes Zielbild liegt und die wenigsten Lücken offen
sind. Orte ohne Zielbild sind kein Fall für dieses Verfahren.
