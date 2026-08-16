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
| Einen Move anlegen | `../docs/design/BRACHLAND_Move-System_v1.md` |
| Eine Region anlegen | `regions/oental.json` als Muster |
| Verstehen, was geprüft wird | `../src/data/schema.ts`, `../tools/quality.ts` |

## Register

| Pfad | Inhalt |
|---|---|
| `creatures/grathorn.json` | Grathorn (Basis Steinbock, Element Stein, Chitinplatten-Gehörn). 3 Mutationsstufen, Spawn an `natural=cliff` ab 900 m, Budget 3.000 Tris |
| `creatures/trafomarder.json` | Trafomarder (Basis Baummarder, alt-tech + faeulnis, Trafostation-Verwachsung). Spawn an `power=substation`, Budget 4.000 Tris |
| `regenten/flussvater.json` | Der Flussvater — Regent von Œntal, Riesenwels mit Kläranlagen-Organik. **Drei Phasen** (wasser → faeulnis → alt-tech/stein), 480 KP. Der Grund, warum Wechseln Pflicht ist |
| `regions/oental.json` | Œntal = Inntal-Süd (Brannenburg/Wendelstein-Fuß). BBox, Regent, Traversal „Klettern", Zielspielzeit 6 Std |
| `moves/` | **Leer.** Die Regenten-Moves (`stauwelle`, `schlickgriff`, `klaerstrom`, `wehrschlag`) und alle Kreatur-Moves fehlen (Ledger B-9) |

## Offene Balance-Blocker (`npm run quality`)

Œntal hat erst **2 von 35** geplanten Kreaturen. Das Tor rechnet damit korrekt:

- nur 3 Elemente vertreten (Minimum 4) → Region wäre eintönig
- Regenten-Phase 2 (`faeulnis`) hat **keinen Konter** in der Region
- Regenten-Phase 3 (`alt-tech`, `stein`) hat **keinen Konter** in der Region
- Warnung: Phase 1 nur über `alt-tech` konterbar

Das sind keine Fehler im Tor, sondern die ehrliche Aussage, dass der Regent derzeit
unfair ist. Sie verschwinden mit den restlichen Kreaturen aus Kapitel 1. Ledger A-7.

## Definition of Done (neuer Inhalt)

- **Input:** JSON im passenden Unterordner
- **Output:** `npm run validate` grün, `npm run quality` ohne **neuen** Blocker
- **Fehlerfall:** Schemafehler → Datei korrigieren, **nicht** das Schema aufweichen
- **Rollback:** Datei löschen; nichts referenziert sie hart
