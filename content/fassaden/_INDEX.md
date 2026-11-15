---
last-reviewed: 2026-11-15
shelf-life-days: 90
owns: *.json
---
# content/fassaden — Fassaden-Steckbriefe realer Gebäude (_INDEX)

> D291: je Gebäude eine Datei `<id>.json` nach dem Schema `Fassade` (`../../src/data/schema.ts`), geprüft von
> `npm run validate`. Grundlage ist ein **eigenes Foto** (Pfad in `quelle.foto`), keine fremde Bildquelle.
> `ort` muss im OSM-Grundriss liegen; `RegionsSzene.tsx` ordnet den Steckbrief darüber dem Gebäude zu,
> `baueGebaeude` (`../../src/world/terrain.ts`) übernimmt Farben, Fensterachsen, Laube und Verfallsstufe.
> Noch leer: wartet auf Fotos (Ledger A-20).

## „Lies-wenn"-Routing

| Deine Aufgabe ist … | Lies |
|---|---|
| Welche Gebäude, wie fotografieren, Beispiel | `../../docs/design/BRACHLAND_Fassaden_Fotoliste_v1.md` |
| Welche Felder wie wirken | `../../src/data/schema.ts` (`Fassade`) → `../../src/world/terrain.ts` (D291-Stellen) |

## Register

| Pfad | Inhalt |
|---|---|
