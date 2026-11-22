---
last-reviewed: 2026-11-22
shelf-life-days: 90
owns: *.json
---
# content/wanderfiguren — Fraktionsfiguren mit Stationen (_INDEX)

> Story-Bibel v2 §5 (D374): Jede Fraktion hat je Region **eine** Figur mit eigenem Weg. Sie zieht weiter, und wer zu
> spät kommt, trifft sie an der alten Station nicht mehr. Kein Dialogbaum: ein Satz je Station, der Spieler handelt.
> Angelegt mit D375.

## „Lies-wenn"-Routing

| Deine Aufgabe ist … | Lies |
|---|---|
| Eine Figur oder Station anlegen | eine Datei hier als Muster → `../../src/data/schema.ts` (`Wanderfigur`, `Stationsbedingung`) |
| Verstehen, wann sie wo steht | `../../src/spiel/wanderfiguren.ts` (`stationVon`) → `../../tests/wanderfiguren.test.ts` |
| Sehen, wie sie im Spiel erscheint | `../../src/main.tsx` (`figurOrte`) — gezeigt und angesprochen wie ein Bewohner |
| Wissen, wo die Stationen liegen und warum | `../../docs/design/BRACHLAND_Enklave_Lage_v2.md` → `python3 tools/enklave_karte.py` |

## Register

| Datei | Fraktion | Weg |
|---|---|---|
| `pegelwartin.json` | Enklave | Die Pegelwartin — will den Flussvater tot. Pegel unter der Terrasse → Bahnhof am Wehr → altes Dorf (trockengefallen) → Terrasse |
| `zaehler.json` | Grüne Mönche | Der Zähler — „Er reinigt nur.“ Hof am Stau → Ufer am Absetzbecken → Hof am Stau → Wehrkrone (nur wenn die Region geheilt wurde, und nur bis 40 Eingriffe) → Kirche am Nordhang, Stufe (D392: wer zu oft eingegriffen hat, findet ihn abgewandt; Schwelle ist Annahme, `docs/design/BRACHLAND_Quests_v1.md` §2.6) **D416:** Die Krone hält er nur, solange er *vertraut* (`bis: misstraut` — gewichtet ≤ 40 **und** mindestens die Hälfte der Reviere unberührt, D406); wer wenig, aber überall eingreift, findet ihn an der Kirche. |
| `bote-erbe.json` | Das Erbe | Der Bote — erscheint erst nach dem Wandel, mit einem Handel. Bahnhof → Silo drei (trockengefallen) → Hof über dem Nordufer, am Weg ins Fahlmoos |

## Was eine Station ist

`wo` (zwei, drei Worte für Notiz und Prüfausgabe), `ort` (lat, lon), `text` (höchstens 240 Zeichen), `blick`, dazu:

- **`bis`** — tritt das ein, zieht die Figur weiter. Jede Station ausser der letzten braucht es.
- **`ab`** — erst dann steht sie an dieser Station; vorher ist sie nirgends.
- **`eingriffe`** (D392) — Bedingung neben `finde`/`regent`/`heile`/`auftrag`: wahr ab so vielen getöteten **oder** gereinigten Vorkommen (D385, der Zähler der Mönche). Der Regent zählt nicht mit.

Bedingungen sind eine geschlossene Liste gegen den Spielstand, wie bei den Aufträgen: `finde` (Fundstück gelesen),
`regent` (besiegt), `heile` (Region geheilt), `auftrag` (Belohnung abgeholt).

## Regeln

- **Keine `Ort`e.** Sie verschieben den Bewohnt-Radius der Häuser (D289) nicht, brauchen keinen Auftrag und stehen
  nicht auf der Karte.
- **Genau eine je Fraktion in einer Region mit Enklave** — `npm run validate` prüft das.
- **Nicht im Grundriss, nicht unter der Flutlinie**, solange der Regent staut; Stationen nach dem Wandel dürfen im
  trockengefallenen Talboden liegen.
- **Jede Station muss erreichbar sein** — der Test spielt alle Kombinationen der Bedingungen einer Figur durch.

## Was das Spiel damit tut — und was nicht

Es zeigt die Figur an ihrer Station und ihren Satz beim Ansprechen; wer sie anspricht, steht als `wanderfigur-<id>`
in `stand.orte`, seit D392 zusätzlich mit der Station (`wanderfigur-<id>:<n>`) — daraus liest das Heft
(`src/spiel/notizbuch.ts`) ihren Satz, auch wenn sie weitergezogen ist. **Nicht gebaut:** ob sie einem traut,
scheitert, stirbt oder ein Ende öffnet (Entwurf `docs/design/BRACHLAND_Quests_v1.md` §5–§6, Ledger A-27).

## Definition of Done

- **Input:** neue `.json` in diesem Ordner
- **Output:** `npm run validate` und `npm test` grün
- **Fehlerfall:** Station unerreichbar → Bedingungen ordnen, nicht den Test lockern
- **Rollback:** Datei löschen; `wanderfigur-<id>` in `stand.orte` wird ignoriert
