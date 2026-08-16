---
last-reviewed: 2026-08-16
shelf-life-days: 90
owns: *.ts, *.mjs, *.py, *.sh
---
# tools — Bau-, Mess- und Asset-Werkzeuge (_INDEX)

> Läuft über `tsx`, nicht über den Vite-Build. Nicht zu verwechseln mit `../scripts/`:
> dort liegen Repo-Kit-Gate und ROI-Prüfung (Python, projektunabhängig).
>
> **Zwei Sorten:** *Bauschritte* verändern das Repo (Weltdaten, Assets), *Messungen*
> geben nur Zahlen aus. Messungen gehören nicht ins Gate — sie beantworten Fragen,
> sie stellen keine Bedingungen.

## „Lies-wenn"-Routing

| Deine Aufgabe ist … | Lies |
|---|---|
| Weltdaten für eine Region erzeugen | `buildworld.ts` → `../src/world/osm.ts` |
| Inhalte gegen das Schema prüfen | `validate.ts` → `../src/data/schema.ts` |
| Budgets und Blocker verstehen | `quality.ts` → `../docs/QUALITY.md` |
| KI-Modell spieltauglich machen | `README.md` → `reduce.mjs` → `autorig.py` |
| Ganze Ordner durch die Kette schicken | `batch.mjs`, `pipeline.sh` |
| Prüfen, ob das Dreiecksbudget hält | `lodcheck.ts`, `scenecheck.ts` |
| Gelände- oder Baumqualität beurteilen | `hoehenvergleich.ts`, `baumcheck.ts` |
| Herausfinden, warum es ruckelt, obwohl die Geometrie passt | `lastcheck.ts` |
| Prüfen, ob man beim Spielen überhaupt Kreaturen findet | `vorkommencheck.ts` |
| Größenverhältnisse prüfen | `masstab.ts` |
| Beurteilen, ob der Wald zu dunkel ist — **bevor** man an Lichtwerten dreht | `lichtcheck.ts` |
| Prüfen, ob eine Bewegungsregel die Welt unbegehbar macht | `steigungcheck.ts` |

## Bauschritte

| Datei | Zweck |
|---|---|
| `buildworld.ts` | `npm run world <region> <raster> [dgm1\|eudem]` — OSM und Höhen abrufen, Welt bauen, gepackt nach public/world schreiben |
| `dgm1.ts` | Höhen aus dem 1-Meter-Geländemodell der Bayerischen Vermessungsverwaltung. Lädt Kilometerkacheln, interpoliert bilinear |
| `reduce.mjs` | Flächenreduktion roher KI-Modelle auf die Zielzahl (gltf-transform + meshoptimizer) |
| `batch.mjs` | Stapelverarbeitung ganzer Ordner durch die Reduktion |
| `autorig.py` | Automatisches Rigging über Blender anhand der Archetyp-Rigs |
| `pipeline.sh` | `npm run assets` — Roh-GLB → reduziert → geriggt, in einem Durchlauf |

## Tore (blocken den Merge)

| Datei | Zweck |
|---|---|
| `validate.ts` | `npm run validate` — alle Inhalte gegen die Zod-Schemas plus Elementmatrix-Selbsttest. Teil von `make check` |
| `quality.ts` | `npm run quality` — Kreatur-, Regions-, Balance- und Asset-Budgets. **Nicht** in `make check`: hat offene Blocker (Ledger A-6, A-7) |

## Messungen (geben Zahlen, keine Bedingungen)

| Datei | Zweck |
|---|---|
| `lodcheck.ts` | `npm run lod` — Dreiecke je LOD-Stufe, Detail vor dem Spieler, Wirkung des Mikroreliefs |
| `masstab.ts` | `npm run masstab` — Kamera, Spielerhöhe, Bildanteil, Querungszeiten der Region |
| `scenecheck.ts` | `npm run szene` — tatsächlich gezeichnete Dreiecke mit Culling gegen das 400k-Handybudget. Braucht einen Szenen-Cache unter .cache/ aus einem vorherigen Lauf |
| `terraincheck.ts` | `npm run terrain` — Terrain-Auflösung. Braucht einen Vorschau-Cache unter .cache/ |
| `lastcheck.ts` | `npm run last` — Objekte im Szenengraph je Standort. Die Größe, die zählt, wenn kein Grafikschalter wirkt |
| `vorkommencheck.ts` | `npm run vorkommen` — Kreaturen je Linie und je km², Weg bis zur nächsten Begegnung, Stufenverteilung |
| `hoehenvergleich.ts` | `npm run hoehen` — Geländeauflösung im Vergleich: mittlere Stufe zwischen Nachbarpunkten je Raster |
| `baumcheck.ts` | `npm run baum` — Dreiecke, Höhe und Bauzeit der prozeduralen Bäume |
| `klippencheck.ts` | `npm run klippen` — Zahl, Höhe und Dreiecke der Felswände, und wie viele je Standort in Reichweite stehen |
| `propcheck.ts` | `npm run props` — Dreiecke und Größe der Prop-Modelle |
| `lichtcheck.ts` | `npm run licht` — Bildschirmhelligkeit je Material und Stimmung, den ganzen Weg über Lambert, ACES, sRGB und Nebel. Beantwortet „ist der Wald zu dunkel" mit einer Zahl statt mit einem Gefühl |
| `steigungcheck.ts` | `npm run steigung` — was die 40°-Grenze an begehbarer Welt kostet: 108.568 Prüfpunkte, Anteil offener Standorte, Kessel ohne Ausweg, Gewinn durchs Klettern |
| `lodpreview.ts` | `npm run lodpreview` — Vorschau der LOD-Kachelung |

## Sonstiges

| Datei | Zweck |
|---|---|
| `README.md` | Die Reduktionspipeline im Detail: warum 1,9 Mio Flächen auf 2.000–6.000 müssen, und wie |

## Definition of Done

- **Input:** Änderung an einem Werkzeug
- **Output:** `npm run validate` grün, `npm run quality` ohne **neuen** Blocker
- **Fehlerfall:** neuer Blocker → Ursache beheben, nicht das Budget anheben
- **Rollback:** `git checkout -- tools/`
