---
last-reviewed: 2026-08-16
shelf-life-days: 90
owns: *.ts, *.mjs, *.py, *.sh
---
# tools — Bau- und Asset-Werkzeuge (_INDEX)

> Läuft über `tsx`, nicht über den Vite-Build. Nicht zu verwechseln mit `../scripts/`:
> dort liegen Repo-Kit-Gate und ROI-Prüfung (Python, projektunabhängig).
> Die Asset-Kette ist in `README.md` und `../docs/WORKFLOW.md` beschrieben.

## „Lies-wenn"-Routing

| Deine Aufgabe ist … | Lies |
|---|---|
| Weltdaten für eine Region erzeugen | `buildworld.ts` → `../src/world/osm.ts` |
| Inhalte gegen das Schema prüfen | `validate.ts` → `../src/data/schema.ts` |
| Budgets und Blocker verstehen | `quality.ts` → `../docs/QUALITY.md` |
| KI-Modell spieltauglich machen | `README.md` → `reduce.mjs` → `autorig.py` |
| Ganze Ordner durch die Kette schicken | `batch.mjs`, `pipeline.sh` |

## Datei-Register

| Datei | Zweck |
|---|---|
| `README.md` | Die Reduktionspipeline im Detail: warum 1,9 Mio Flächen auf 2.000–6.000 müssen, und wie |
| `buildworld.ts` | `npm run world <region> <raster>` — OSM + EU-DEM abrufen, Welt und Spawns bauen, nach public/world schreiben |
| `validate.ts` | `npm run validate` — alle Inhalte gegen die Zod-Schemas plus Elementmatrix-Selbsttest. Läuft in CI und blockt den Merge |
| `quality.ts` | `npm run quality` — Qualitätstor: Kreatur-, Regions- und Asset-Budgets. Blocker verhindern den Merge |
| `reduce.mjs` | Flächenreduktion roher KI-Modelle auf die Zielzahl |
| `batch.mjs` | Stapelverarbeitung ganzer Ordner durch die Reduktion |
| `autorig.py` | Automatisches Rigging über Blender anhand der Archetyp-Rigs |
| `pipeline.sh` | `npm run assets` — Roh-GLB → reduziert → geriggt, in einem Durchlauf |

## Fehlend (Ledger B-8)

`lodcheck.ts`, `masstab.ts`, `scenecheck.ts` — die Skripte `lod`, `masstab` und `szene`
in `package.json` zeigen ins Leere. Sie waren Mess-Werkzeuge, keine Bauschritte; der
Build funktioniert ohne sie.

## Definition of Done

- **Input:** Änderung an einem Werkzeug
- **Output:** `npm run validate` und `npm run quality` laufen ohne neuen Blocker
- **Fehlerfall:** neuer Blocker → Ursache beheben, nicht das Budget anheben
- **Rollback:** `git checkout -- tools/`
