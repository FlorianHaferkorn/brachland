---
last-reviewed: 2026-08-16
shelf-life-days: 90
owns: *.json
---
# content — Spielinhalte als validierte Daten (_INDEX)

> **Nichts hier wird hartkodiert.** Kreaturen, Regenten, Moves und Regionen sind Daten,
> die gegen die Zod-Schemas in `../src/data/schema.ts` geprüft werden. `npm run validate`
> ist Teil von `make check` — Inhalte, die dem Schema widersprechen, kommen nicht ins
> Repo. Das ist der Mechanismus, der 200 Kreaturen beherrschbar macht (ADR-0004).

## „Lies-wenn"-Routing

| Deine Aufgabe ist … | Lies |
|---|---|
| Eine Kreatur anlegen | `../docs/design/BRACHLAND_Roster_Kapitel1.md` → `creatures/grathorn.json` als Muster |
| Einen Regenten anlegen | `../docs/design/BRACHLAND_Kampfsystem_v2.md` (Phasen) → `regenten/flussvater.json` |
| Einen Move anlegen | `../docs/design/BRACHLAND_Move-System_v1.md` → `moves/_INDEX.md` |
| Einen Gegenstand anlegen | `gegenstaende/kraeutersud.json` als Muster → `../src/data/schema.ts` (`GegenstandWirkung`) |
| Eine Region anlegen | `regions/oental.json` als Muster |
| Verstehen, was geprüft wird | `../src/data/schema.ts`, `../tools/quality.ts` |

## Register

| Pfad | Inhalt |
|---|---|
| `creatures/grathorn.json` | Grathorn (Basis Steinbock, Element Stein, Chitinplatten-Gehörn). 3 Mutationsstufen, Spawn an `natural=cliff` ab 900 m, Budget 3.000 Tris |
| `creatures/trafomarder.json` | Trafomarder (Basis Baummarder, alt-tech + faeulnis, Trafostation-Verwachsung). Spawn an `power=substation`, Budget 4.000 Tris |
| `regenten/flussvater.json` | Der Flussvater — Regent von Œntal, Riesenwels mit Kläranlagen-Organik. **Drei Phasen** (wasser → faeulnis → alt-tech/stein), 480 KP. Der Grund, warum Wechseln Pflicht ist |
| `regions/oental.json` | Œntal = Inntal-Süd (Brannenburg/Wendelstein-Fuß). BBox, Regent, Traversal „Klettern", Zielspielzeit 6 Std |
| `creatures/nebelgams.json` | Nebelgams (Gams, Stein, Silikat-Hufe). 2 Stufen, `natural=scrub`, schnellster Steinträger |
| `creatures/kiemenbiber.json` | Kiemenbiber (Biber, Wasser, Filterkiemen-Kragen). 3 Stufen, `waterway=stream` — im 96er-Raster praktisch nicht vorhanden, siehe Ledger G-22 |
| `creatures/sporenhahn.json` | Sporenhahn (Auerhahn, Sporen, Sporenfächer). 3 Stufen, `landuse=forest`. Konter gegen Flussvater-Phase 1 |
| `creatures/myzelmolch.json` | Myzelmolch (Feuersalamander, Sporen, Leuchtmyzel-Adern). 2 Stufen, `natural=wood`, Glaskanone |
| `creatures/wurzelkeiler.json` | Wurzelkeiler (Wildschwein, Holz, Wurzelpanzer). 3 Stufen, `landuse=meadow` — die häufigste Kreatur der Region |
| `creatures/linsenuhu.json` | Linsenuhu (Uhu, Alt-Tech, Facetten-Linsenaugen). 2 Stufen, `natural=cliff`, **nur nachts** |
| `creatures/spuerfuchs.json` | Spürfuchs (Fuchs, Alt-Tech, Sensor-Fell). 3 Stufen, `landuse=farmyard`, schnellste Kreatur des Kapitels |
| `creatures/moderotter.json` | Moderotter (Kreuzotter, Fäulnis, Fäulnisdrüse). 2 Stufen, `waterway=ditch` — kommt im aktuellen Raster **nicht** vor, Ledger G-22 |
| `creatures/firnhase.json` | Firnhase (Schneehase, Frost, Frostkristall-Fell). 2 Stufen, `natural=scree` ab 1000 m. Einziger Frost-Konter gegen Flussvater-Phase 2 |
| `moves/` | 41 Moves mit eigenem Index — Aufbau, Bänder und Zuordnung zu den Linien stehen in `moves/_INDEX.md` |
| `gegenstaende/` | 8 Gegenstände mit eigenem Index — Heilung, Wiederbelebung, Reinigung, Fanghilfen, Fokus. Siehe `gegenstaende/_INDEX.md` |

## Stand Œntal

**11 von 35** geplanten Kreaturen: die 10 Wildling-Linien aus Kapitel 1 plus der
Trafomarder. Es fehlen die Zuchtlinien und die Verhärteten. Damit sind **7 Elemente**
vertreten (alle außer `brand`, das laut Roster erst im Aschefeld auftaucht), und jede
Phase des Flussvaters hat einen Konter in der Region.

Zwei Linien stehen zwar in den Daten, kommen aber im gebauten Weltraster praktisch
nicht vor: `kiemenbiber` (1 Vorkommen) und `moderotter` (0). Ursache ist nicht der
Inhalt, sondern die Auflösung — 96 × 96 Zellen über 4 km lösen Bäche und Gräben nicht
auf, es bleiben 2 Wasserzellen. Ledger G-22, prüfbar mit `npm run vorkommen`.

## Definition of Done (neuer Inhalt)

- **Input:** JSON im passenden Unterordner
- **Output:** `npm run validate` grün, `npm run quality` ohne **neuen** Blocker
- **Fehlerfall:** Schemafehler → Datei korrigieren, **nicht** das Schema aufweichen
- **Rollback:** Datei löschen; nichts referenziert sie hart
