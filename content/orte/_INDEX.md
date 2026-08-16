---
last-reviewed: 2026-08-16
shelf-life-days: 180
owns: *.json
---
# content/orte — Zufluchten und Bewohner (_INDEX)

> Zwei Arten, ein Schema, weil beide dasselbe brauchen: eine Position aus den
> OSM-Gebäuden, eine Marke, einen Radius, einen Knopf. Was beim Betreten passiert,
> entscheidet `src/main.tsx` — die Szene kennt weder Heilung noch Aufträge.

## „Lies-wenn"-Routing

| Deine Aufgabe ist … | Lies |
|---|---|
| Eine Zuflucht anlegen | `unterstand-mitte.json` als Muster → `../../src/data/schema.ts` (`Ort`) |
| Einen Bewohner anlegen | `hof-tremmel.json` → danach **mindestens einen Auftrag** in `../auftraege/` |
| Verstehen, was Rasten tut | `../../src/main.tsx` (`raste`) |
| Marke und Radius ändern | `../../src/scenes/RegionsSzene.tsx` (`Orte`, `ORT_AB`) |

## Register

| Datei | Art | Wozu |
|---|---|---|
| `unterstand-mitte.json` | zuflucht | Geräteschuppen 88 m von der Regionsmitte. Die erste Rast, die man findet, ohne sie zu suchen |
| `almhuette.json` | zuflucht | Hütte 2 km draußen auf 1000 m. Die Rast für den zweiten Teil der Region — der Weg dorthin ist ihr Preis |
| `hof-tremmel.json` | bewohner | Hofbesitzerin. Gibt `streuner` und danach `eine-fuer-den-hof` |
| `steinbruch-wart.json` | bewohner | Wart eines stillgelegten Bruchs. Gibt `was-am-stollen-steht` |

## Warum die Positionen stimmen

Alle vier stehen auf **freistehenden** OSM-Gebäuden — 0 Nachbarn im 70-m-Umkreis,
gemessen über die 2.033 Grundrisse der Region. In einem Dorf wäre eine Marke
zwischen zwanzig Häusern nicht auffindbar; freistehend ist sie es.

## Regeln

- **Ein Bewohner ohne Auftrag ist ein Knopf, der nichts tut.** `npm run validate`
  lehnt das ab.
- **Mindestens eine Zuflucht je Region.** Ohne sie ist die Niederlage wieder der
  zuverlässigste Weg zu vollen KP (Ledger G-35). Auch das prüft das Gate.
- **Kein Dialog.** Ein Satz, der beim Ansprechen oben steht. Wer mehr erzählen
  will, legt ein Fragment an.

## Definition of Done

- **Input:** neue `.json` in diesem Ordner
- **Output:** `npm run validate` grün, Position auf einem freistehenden Gebäude
- **Fehlerfall:** Bewohner ohne Auftrag → Auftrag nachlegen, nicht die Prüfung lockern
- **Rollback:** Datei löschen; verwaiste Auftrags-IDs im Spielstand werden ignoriert
