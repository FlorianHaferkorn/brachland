---
last-reviewed: 2026-08-16
shelf-life-days: 180
owns: *.json
---
# content/auftraege — Der kritische Pfad (_INDEX)

> Die Story-Struktur legt fest: kritischer Pfad plus Fundstücke, **kein Quest-Hub**,
> keine Dialogbäume. Die Fundstücke stehen seit G-42. Hier steht der Pfad — etwas,
> dem man folgen kann, statt nur etwas, das man findet.

## Der Kern: Fortschritt wird abgeleitet

Kein Auftrag schreibt einen Zähler mit. Ob drei Sporenhähne besiegt sind, **steht
schon im Spielstand**: `besiegt` enthält die IDs verbrauchter Vorkommen, und eine
solche ID beginnt mit dem Kreaturnamen (`sporenhahn:12:47`). Gespeichert wird nur,
was nicht ableitbar ist — angenommen und abgeholt.

Ein eigener Zähler wäre eine zweite Wahrheit über denselben Sachverhalt. Die
driftet, sobald irgendwo ein `+1` fehlt, und der Spieler sieht davon nur, dass ein
Auftrag nicht fertig wird.

## „Lies-wenn"-Routing

| Deine Aufgabe ist … | Lies |
|---|---|
| Einen Auftrag anlegen | `streuner.json` als Muster → `../../src/data/schema.ts` (`Auftragsziel`) |
| Eine Kette bauen | `eine-fuer-den-hof.json` (`vorher`) → `../../src/spiel/auftraege.ts` (`lage`) |
| Verstehen, wann etwas „erfüllt" heißt | `../../src/spiel/auftraege.ts` → `../../tests/auftraege.test.ts` |
| Die Anzeige beim Bewohner ändern | `../../src/ui/Ortsfenster.tsx` |

## Register

| Datei | Geber | Ziel |
|---|---|---|
| `streuner.json` | hof-tremmel | 3 Sporenhähne besiegen. Der Einstieg — erfüllbar mit dem, was ohnehin im Weg steht |
| `eine-fuer-den-hof.json` | hof-tremmel | 1 Alpenmurmel **fangen**, erst nach `streuner`. Zwingt zum Fangen statt zum Besiegen |
| `was-am-stollen-steht.json` | steinbruch-wart | Fundstück `stollenmund` lesen. Verbindet den Pfad mit den Fragmenten, statt sie nebeneinander laufen zu lassen |

## Die vier Zielarten

`besiege` · `fange` · `finde` · `regent` — alle vier sind aus dem Spielstand allein
prüfbar. Eine fünfte Art aufzunehmen heißt: **erst** dafür sorgen, dass der
Sachverhalt im Spielstand steht, dann das Ziel bauen.

## Warum „erfüllt" und „abgeholt" getrennt sind

Ein Auftrag ist nicht mit dem letzten Schlag zu Ende, sondern beim Auftraggeber.
Ohne den Rückweg wäre der Geber ein Automat, der beim Ansprechen eine Aufgabe
ausgibt und danach nie wieder vorkommt.

## Definition of Done

- **Input:** neue `.json` in diesem Ordner
- **Output:** `npm run validate` grün — Geber, Zielobjekt, Belohnung und Vorgänger
  müssen alle existieren, und die `vorher`-Kette darf keinen Kreis bilden
- **Fehlerfall:** toter Verweis → korrigieren. Ein unerfüllbarer Auftrag fällt sonst
  erst auf, wenn jemand ihn angenommen hat und stundenlang nichts passiert
- **Rollback:** Datei löschen; der Eintrag im Spielstand wird beim Laden ignoriert
