---
last-reviewed: 2026-08-16
shelf-life-days: 90
owns: *.json
---
# content — Spielinhalte als validierte Daten (_INDEX)

> **Nichts hier wird hartkodiert.** Kreaturen, Moves und Regionen sind Daten, die gegen
> die Zod-Schemas in `../src/data/schema.ts` geprüft werden. `npm run validate` läuft in
> CI und blockt den Merge — Inhalte, die dem Schema widersprechen, kommen nicht ins Repo.
> Das ist der Mechanismus, der 200 Kreaturen überhaupt beherrschbar macht (ADR-0004).

## „Lies-wenn"-Routing

| Deine Aufgabe ist … | Lies |
|---|---|
| Eine Kreatur anlegen | `../docs/design/BRACHLAND_Roster_Kapitel1.md` → `creatures/grathorn.json` als Muster |
| Einen Move anlegen | `../docs/design/BRACHLAND_Move-System_v1.md` → Schema `Move` |
| Eine Region anlegen | `../docs/design/BRACHLAND_Story-Bibel_v1.md` → Schema `Region` |
| Verstehen, was geprüft wird | `../src/data/schema.ts` |

## Register

| Pfad | Inhalt |
|---|---|
| `creatures/grathorn.json` | Grathorn-Linie (Basis Steinbock, Element Stein, Chitinplatten-Gehörn). 3 Mutationsstufen, Spawn an `natural=cliff` ab 900 m, Zielbudget 3.000 Tris |
| `moves/` | **Leer.** Move-Definitionen fehlen (Ledger B-9) |
| `regions/` | **Leer.** Kartenausschnitt, Regent, Konzentrate je Region fehlen (Ledger B-9) |

## Definition of Done (neuer Inhalt)

- **Input:** JSON im passenden Unterordner
- **Output:** `npm run validate` grün, `npm run quality` ohne neuen Blocker
- **Fehlerfall:** Schemafehler → Datei korrigieren, **nicht** das Schema aufweichen
- **Rollback:** Datei löschen; nichts referenziert sie hart
