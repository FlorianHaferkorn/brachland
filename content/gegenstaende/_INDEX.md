---
last-reviewed: 2026-08-16
shelf-life-days: 90
owns: *.json
---
# content/gegenstaende — Gegenstände (_INDEX)

> Der Grund, warum es sie gibt: Ohne Heilung war das Spiel eine Einbahnstraße. Man
> zog los, das Team nahm Schaden, und der einzige Weg zurück auf volle KP war die
> **Niederlage** — die heilt vollständig. Ein System, in dem Verlieren die
> zuverlässigste Erholung ist, belohnt das Falsche.

## „Lies-wenn"-Routing

| Deine Aufgabe ist … | Lies |
|---|---|
| Einen Gegenstand anlegen | eine bestehende `.json` als Muster → `../../src/data/schema.ts` (`GegenstandWirkung`) |
| Verstehen, wie ein Gegenstand wirkt | `../../src/spiel/gegenstaende.ts` |
| Beute-Wahrscheinlichkeiten ändern | `beuteChance` hier, Verteilung in `../../src/spiel/gegenstaende.ts` |
| Wissen, was der Beutel zu Beginn enthält | `../../src/spiel/spielstand.ts` (`LEERER_STAND`) |

## Register

| Datei | Wirkung |
|---|---|
| `harzverband.json` | **Harzverband** — Heilung 70 %, 10 % Beutechance. Fichtenharz auf Leinen. Schließt auch, was ein Sud nicht mehr erreicht. |
| `herzfunke.json` | **Herzfunke** — Wiederbelebung mit 50 % KP, 5 % Beutechance. Ein Akkuherz, halb entladen. Bringt einen Ausgefallenen zurück auf die Beine. |
| `koeder.json` | **Köder** — Fangchance +15 Punkte, 22 % Beutechance. Riecht nach dem, was hier oben selten geworden ist. Macht zutraulich. |
| `kraeutersud.json` | **Kräutersud** — Heilung 35 %, 30 % Beutechance. Aufguss aus Bergkräutern. Wirkt schnell, aber nicht tief — für zwischendurch. |
| `netzschlinge.json` | **Netzschlinge** — Fangchance +35 Punkte, 6 % Beutechance. Aus Kabelresten geflochten. Wer darin hängt, wehrt sich kürzer. |
| `quellwasser.json` | **Quellwasser** — Heilung 100 %, 2 % Beutechance. Aus einer Quelle oberhalb des Befalls. Selten, und man merkt warum. |
| `reinkultur.json` | **Reinkultur** — Reinigung (löst Befall), 8 % Beutechance. Unbefallene Sporenkultur. Verdrängt, was sich eingenistet hat. |
| `zunder.json` | **Zunder** — Fokus +4, 12 % Beutechance. Trockener Baumschwamm, glimmt lange. Sammelt den Kopf für den nächsten Zug. |

## Regeln

- **Wenige Arten.** Fünf Wirkungen, nicht fünfzehn. Ein Beutel voller Varianten
  derselben Sache ist Verwaltung, keine Entscheidung.
- **Benutzen kostet den Zug.** Sonst ist Heilen in jeder Runde die dominante
  Handlung und der Kampf ein Abnutzungsrennen, das über Vorratshaltung entschieden
  wird statt über Elemente.
- **Höchstens ein Fund je Kampf.** Mehrere Funde auf einmal entwerten den einzelnen;
  ein Beutel, der schneller wächst, als man ihn leert, ist Ballast.
- **Der Wurf hängt an der Vorkommens-ID.** Neuladen und noch einmal kämpfen bringt
  nicht denselben Fund zweimal.

## Definition of Done

- **Input:** neue `.json` in diesem Ordner
- **Output:** `npm run validate` grün; mindestens ein Gegenstand mit `beuteChance > 0`
- **Fehlerfall:** Schemafehler → Datei korrigieren, nicht das Schema aufweichen
- **Rollback:** Datei löschen; der Beutel verträgt unbekannte IDs (sie werden ignoriert)
