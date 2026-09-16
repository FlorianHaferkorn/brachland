---
last-reviewed: 2026-09-16
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
| `moves/` | 53 Moves mit eigenem Index — Aufbau, Bänder und Zuordnung zu den Linien stehen in `moves/_INDEX.md` |
| `gegenstaende/` | 8 Gegenstände mit eigenem Index — Heilung, Wiederbelebung, Reinigung, Fanghilfen, Fokus. Siehe `gegenstaende/_INDEX.md` |
| `fragmente/` | 12 Fundstücke an OSM-Orten mit eigenem Index — die Geschichte der Region, ohne Sprecher. Siehe `fragmente/_INDEX.md` |
| `orte/` | 2 Zufluchten und 3 Bewohner auf freistehenden OSM-Gebäuden. Siehe `orte/_INDEX.md` |
| `auftraege/` | 4 Aufträge — der kritische Pfad. Fortschritt wird aus dem Spielstand abgeleitet, nicht mitgeschrieben. Siehe `auftraege/_INDEX.md` |
| `creatures/alpenmurmel.json` | Alpenmurmel (Alpenmurmeltier, Stein, Erdpilz-Rückenpolster). 3 Stufen, `landuse=meadow` ab 700 m |
| `creatures/schneehuhn.json` | Alpenschneehuhn (Frost, Frostfeder-Fächer). 3 Stufen, `natural=scree` ab 950 m — zweite Frost-Linie neben dem Firnhasen |
| `creatures/k7-wolf.json` | **K7** (Wolf, alt-tech + frost, Klemmrippen-Rückenmodul) — die **erste Zuchtlinie**. 3 Baustände a/b/c statt Mutationen, `landuse=industrial`. Flache Werte ohne Ausreißer, angreifbar über das Element (Stein ×2), nicht über die Zahlen. Bringt die vier neuen Moves `haltebiss`, `kuehlrippen`, `reifriss`, `sterilgang` mit |

## Stand Œntal

**12 von 35** geplanten Kreaturen: die 10 Wildling-Linien aus Kapitel 1, der
Trafomarder als einziger Verwachsener und die K7 als erste Zuchtlinie. Es fehlen
weitere Zuchtlinien und die Verhärteten. Damit sind **7 Elemente** vertreten, und
jede Phase des Flussvaters hat einen Konter.

**`brand` fehlt mit Absicht.** `../docs/design/BRACHLAND_Roster_Kapitel1.md`: „Brand
existiert in Kapitel 1 nicht" — das Element gehört ins Aschefeld, und eine
Brand-Linie hier würde jener Region ihr Alleinstellungsmerkmal nehmen. Der Preis
steht ebenfalls dort: Flussvater-Phase 2 ist dadurch **nur über Frost** konterbar.
`npm run quality` sagt beides an und blockt eine Brand-Linie im Œntal (G-62).

### Was `npm run vorkommen` dazu sagt

Die K7 steht mit **3 Vorkommen** in der Region. Das ist kein Fehler, sondern der
Zuschnitt ihrer Zone: `landuse=industrial` deckt 0,08 km² von 15,9 km² ab. Eine
Wachlinie steht am Werk, nicht im Wald (D69). Damit man sie überhaupt findet, zeigt
seit `die-runde.json` ein Auftrag dorthin — der Geber sitzt am Werkstor.

Zwei Linien standen zwar in den Daten, kamen aber im gebauten Weltraster praktisch
nicht vor: `kiemenbiber` und `moderotter`. Ursache war die Rasterung von Bächen,
nicht die Auflösung; behoben, heute 33 und 17 Vorkommen. Ledger G-22.

## Definition of Done (neuer Inhalt)

- **Input:** JSON im passenden Unterordner
- **Output:** `npm run validate` grün, `npm run quality` ohne **neuen** Blocker
- **Fehlerfall:** Schemafehler → Datei korrigieren, **nicht** das Schema aufweichen
- **Rollback:** Datei löschen; nichts referenziert sie hart
