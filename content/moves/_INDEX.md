---
last-reviewed: 2026-08-16
shelf-life-days: 90
---
# content/moves — Attacken als Daten (_INDEX)

> **Kein `owns:` in diesem Index — bewusst.** Der Ordner enthält 53 fast gleichförmige
> Dateien; ein Register mit 53 Zeilen wäre kein Wegweiser, sondern ein zweites
> Verzeichnis. Vollständigkeit sichert hier ein Tor statt einer Tabelle:
> `npm run validate` prüft jede Datei gegen das Schema **und** löst jeden Verweis aus
> Kreaturen und Regenten auf. Ein Move, den niemand referenziert, oder ein Verweis
> ohne Datei fällt dort auf — nicht beim Lesen einer Liste.

## „Lies-wenn"-Routing

| Deine Aufgabe ist … | Lies |
|---|---|
| Einen Move anlegen oder ändern | `../../docs/design/BRACHLAND_Move-System_v1.md` → eine bestehende `.json` als Muster |
| Verstehen, was Band und Element bewirken | `../../src/data/schema.ts` (`BAND`, `effektivitaet`) |
| Wissen, welche Linie welche Moves hat | die Tabelle „Wer benutzt was" weiter unten |
| Eine Abweichung vom Design-Dokument nachvollziehen | „Abweichungen" weiter unten → `../../docs/_INDEX.md` (G-24) |

## Aufbau

Jeder Move hat `id`, `name`, `element`, `band` und optionale `effekte`. Das **Band**
bestimmt Schaden und Fokuskosten zentral (`src/data/schema.ts`, `BAND`):

| Band | Power | Fokus |
|---|---|---|
| `leicht` | 0,7 | 1 |
| `normal` | 1,0 | 2 |
| `schwer` | 1,5 | 3 |
| `utility` | — | 2 |

Stimmt das Element des Moves mit einem Element der Kreatur überein, gibt es ×1,5.
Deshalb tragen fast alle Moves das Element ihrer Linie — Fremdelement-Moves kommen
über Exposition dazu und sind bewusst schwächer.

## Wer benutzt was

| Linie | Moves |
|---|---|
| Grathorn | `plattenstoss` normal · `kalkstaub` leicht · `gratsprung` schwer · `abschuetteln` utility |
| Nebelgams | `hufhieb` normal · `steilflucht` utility · `splitterhuf` schwer |
| Kiemenbiber | `schwanzschlag` normal · `dammbau` utility · `filterstrom` schwer · `klarwasser` utility |
| Sporenhahn | `faecherschlag` normal · `sporenwolke` leicht · `balzruf` utility · `sporenbrut` schwer |
| Myzelmolch | `aetzhaut` normal · `leuchtsignal` utility · `myzelfaden` schwer |
| Wurzelkeiler | `hauerstoss` normal · `wurzelgriff` leicht · `dickichtsturm` schwer · `eingraben` utility |
| Linsenuhu | `stossflug` normal · `blendlinse` utility · `impulsschrei` schwer |
| Spürfuchs | `schnappbiss` normal · `faehrte` utility · `sensorsprung` schwer · `stoerfeld` utility |
| Moderotter | `faeulnisbiss` normal · `moderhauch` leicht · `zersetzen` schwer |
| Firnhase | `frostbiss` normal · `klirren` utility · `firnsprung` schwer |
| Trafomarder | `lichtbogen` normal · `kriechstrom` leicht |
| K7 (Zuchtlinie) | `haltebiss` normal · `kuehlrippen` utility · `reifriss` normal · `sterilgang` utility |
| Flussvater (Regent) | `stauwelle` schwer · `schlickgriff` normal · `klaerstrom` schwer · `wehrschlag` normal |

## Abweichungen vom Move-System v1

Von drei Ersatzlösungen sind noch **zwei** übrig. Das ist eine Anpassung, keine
stille Änderung:

| Move | Gedacht | Umgesetzt |
|---|---|---|
| `steilflucht` | Wechsel ohne Zugverlust | INI +2 auf sich selbst |
| `faehrte` | erhöht die Fangchance | INI +1 auf sich selbst |
| ~~`blendlinse`~~ | senkt Genauigkeit | **erledigt** — echter Trefferwurf (D64), nicht mehr `ANG −2` |

Zugfreier Wechsel und eine Fangchance aus dem Kampf heraus existieren in der Engine
weiterhin nicht. Beides einzubauen ist eine Regeländerung mit Balance-Folgen — die
gehört ins Kampfsystem-Dokument, nicht in eine Move-Datei. Ledger G-24.

Alle sieben **Effektarten** des Schemas werden inzwischen angewendet, bis auf
`mehrfachtreffer` — der greift in `schlag()` ein statt daneben und wird von keinem
Move im Bestand benutzt. Ledger G-56 (geschlossen) und G-60.

## Definition of Done

- **Input:** neue `.json` in diesem Ordner
- **Output:** `npm run validate` grün — Schema **und** Querverweise
- **Fehlerfall:** Schemafehler → Datei korrigieren, nicht das Schema aufweichen
- **Rollback:** Datei löschen und die Verweise in `../creatures/` entfernen
