---
last-reviewed: 2026-10-18
shelf-life-days: 365
---
# ADR-0014 — Regionen als eigene Karten mit Übergang an der Kante

**Status:** Proposed (umgesetzt) · 2026-10-18 · ADR-0004 (episodisch), ADR-0005 (Qualitätsanspruch) und ADR-0006 (Zielgerät) gelten unverändert · offene Bestätigung durch Flo: Ledger A-14

## Kontext

Mit der Brutmutter (D246) steht der zweite Regent als Daten, aber das Spiel kannte nur eine Welt:
`main.tsx` lud fest `/world/oental.json`, `REGENT_ID` war `flussvater`, und alle Inhalte mit
Koordinaten wurden in Œntal-Meter umgerechnet, ganz gleich, in welcher Region sie lagen. Die
Blender-Szenen (Stauwehr, Felsmulde) stehen in `public/bauten/register.json` in Œntal-Metern.

Die vorgeschlagene Lage des Fahlmooses, die Kollerfilze bei Raubling (OSM-Relation 3564339), liegt
etwa 2 km nördlich der Œntal-Bbox. Es gab zwei Wege:

- **(a) Eigene Karte je Region.** Jede Region hat ihre Bbox, ihre Weltdatei und ihren
  Koordinatenursprung. An einer Kante führt ein Übergang hinüber; die Nachbarkarte wird geladen.
- **(b) Zusammenhängende Welt.** Das Fahlmoos schliesst nördlich ans Œntal an, der Weg dazwischen
  ist echtes Gelände. Das verlangt Streaming: Weltdaten, Terrain, Props, Grasteppich, Kollision und
  Bauwerke müssten in Kacheln nachladen und einen gemeinsamen Ursprung teilen.

## Entscheidung

**(a): eine Karte je Region.**

1. **Die Region kommt aus der Adresse:** `?region=<id>`, ohne Angabe das Œntal
   (`src/spiel/region.ts`). Alles ohne Adresszeile (Tests, Werkzeuge) sieht das Œntal. Dadurch
   bleibt der Bestand bitgleich.
2. **Jede Region hat eigene Weltdaten** aus derselben Pipeline: `npm run world <id> 384` und
   `npm run fernland <id>`. Kein gemeinsamer Ursprung, keine Kacheln.
3. **Inhalte tragen ihre Region selbst** (`region` an Fragment, Ort, Auftrag und Regent). Das Spiel
   zeigt nur, was in der geladenen Region liegt. Kreaturen kommen aus `kreaturen` der Region.
   Bauwerke haben ein Feld `region` (Vorgabe `oental`) und werden ebenso gefiltert.
4. **Übergang an der Kante:** `nachbarn` in `content/regions/<id>.json` nennt Region und Seite.
   Wer an diese Kante läuft, bekommt im Randhinweis einen Knopf „Hinüber ins …“. Das Spiel lädt
   dann die Seite mit `?region=` neu. Ankunft ist die Mitte der Gegenkante, 25 m innen.
5. **Der Spielstand merkt sich die Region** seiner Position (`Spielstand.region`). Alte Stände
   bekommen über `LEERER_STAND` das Œntal, ohne dass die Version springt.
6. **`validate` prüft die Verbindungen hart:** Schema der Region, Weltdatei vorhanden,
   Nachbarin existiert und kennt den Rückweg, jede Koordinate liegt in der Bbox ihrer Region,
   Geber und Fundstück eines Auftrags stehen in seiner Region, und jede Region hat eine Zuflucht.
   Der Wandabstand der Aufwachpunkte wird gegen die Welt der eigenen Region gemessen.

## Begründung

- **ROADMAP M2 sagt „Fahlmoos als reines Content-Paket, kein Engine-Umbau“.** (a) erfüllt das: Der
  Umbau beschränkt sich auf das Laden und Filtern, Terrain und Szene bleiben unverändert. (b) wäre
  der grösste Umbau seit dem Projektstart, und zwar in genau den Teilen, deren Werte erarbeitet sind
  (Sichtweiten D247, Grasteppich, LOD).
- **Budget:** Jede Region kostet rund 0,9–1,4 MB Weltdaten. Bei (a) wird nur die aktive geladen.
- **Episodisch (ADR-0004):** Eine Region ist ein Kapitel. Der harte Schnitt beim Übergang passt
  dazu und kostet weniger als eine Welt, die überall gleichzeitig halten muss (ADR-0005).

## Folgen

- Der Übergang ist ein Neuladen. Bei vorhandenem Cache dauert er Sekunden, ist aber kein nahtloser
  Gang. Wer (b) später will, baut auf (a) auf: Die Daten sind schon je Region getrennt.
- Die 2 km zwischen den Bboxen gibt es im Spiel nicht. Die Fernkulisse jeder Region zeigt das
  Gelände drumherum (`*-fern.json`), also sieht man das andere Gebiet höchstens als Relief.
- Was global in Œntal-Metern liegt, muss eine Region bekommen. Bisher betraf das die Bauwerke.
  Neue globale Register müssen das Feld von Anfang an tragen.

## Nicht entschieden

- **Ob Flo (a) bestätigt.** Die Frage a/b war gestellt. Die Antwort „1-3“ enthielt keine Wahl,
  also wurde nach der Empfehlung umgesetzt. Solange A-14 offen ist, steht der Status auf Proposed.
- Ob der Übergang später eine Wegmarke in der Welt bekommt (Steg, Bahndamm) statt der ganzen Kante.
