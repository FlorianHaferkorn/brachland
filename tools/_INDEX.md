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
| Herausfinden, warum es ruckelt, obwohl die Geometrie passt | `lastcheck.ts` |
| Größenverhältnisse prüfen | `masstab.ts` |

## Bauschritte

| Datei | Zweck |
|---|---|
| `buildworld.ts` | `npm run world <region> <raster>` — OSM + EU-DEM abrufen, Welt und Spawns bauen, nach public/world schreiben (~2 min) |
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
| `propcheck.ts` | `npm run props` — Dreiecke und Größe der Prop-Modelle |
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
