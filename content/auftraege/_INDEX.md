---
last-reviewed: 2026-08-26
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
| `die-runde.json` | werk-schichtbuch | 1 **K7 fangen**. Der Zeigefinger aufs Industriegelände: Die K7 hat nur 3 Vorkommen in der ganzen Region, weil ihre Zone 0,08 km² misst (D69) — ohne einen Auftrag, der den Weg dorthin nennt, findet sie niemand. Belohnung ist eine `reinkultur`, also genau das Mittel, mit dem sich eine gefangene K7 zurückführen lässt |
| `das-stehende-wasser.json` | werk-schichtbuch | Fundstück `stauwehr` lesen. **Der erste Schritt zum Regenten** — und der einzige, der ihn überhaupt auffindbar macht: Das Fundstück liegt auf **denselben Koordinaten** wie der Flussvater (47,72518 / 12,09582), also führt das Auftragsziel auf der Karte genau dorthin |
| `was-im-stau-liegt.json` | werk-schichtbuch | **Zielart `regent`**, erst nach `das-stehende-wasser`. Bis zum 26.08.2026 war diese Zielart im Schema implementiert und von **keiner** Auftragsdatei benutzt — der Regent lag 1.381 m vom Start, das Nebelende bei 420 m, die Peilung zeigt nur auf Kreaturen, und kein einziger Text nannte ihn (G-101). Ein Boss, den man nur durch Zufall findet, ist kein Höhepunkt |

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
