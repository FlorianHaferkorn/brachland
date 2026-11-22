---
last-reviewed: 2026-11-22
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
| `eine-fuer-den-hof.json` | hof-tremmel | 1 Alpenmurmel **reinigen** (D375, vorher fangen), erst nach `streuner`. Zwingt zum Reinigen statt zum Besiegen |
| `was-am-stollen-steht.json` | steinbruch-wart | Fundstück `oberstollen` lesen (D375, vorher `stollenmund` 387 m vom Start): die **Reinkultur West**, 963 m hoch unter dem Grat. Der Text nennt beide Wege — die Wand oder den Almweg aussen herum |
| `die-runde.json` | werk-schichtbuch | 1 **K7 reinigen** (D375, vorher fangen). Der Zeigefinger aufs Industriegelände: Die K7 hat nur 3 Vorkommen in der ganzen Region, weil ihre Zone 0,08 km² misst (D69) — ohne einen Auftrag, der den Weg dorthin nennt, findet sie niemand. Belohnung ist eine `reinkultur`, also genau das Mittel, mit dem sich eine K7 zurückführen lässt |
| `das-stehende-wasser.json` | werk-schichtbuch | Fundstück `stauwehr` lesen. **Der erste Schritt zum Regenten** — und der einzige, der ihn überhaupt auffindbar macht: Das Fundstück liegt auf **denselben Koordinaten** wie der Flussvater (47,72518 / 12,09582), also führt das Auftragsziel auf der Karte genau dorthin |
| `was-der-tresen-weiss.json` · `bis-zur-kante.json` · `nach-vorher-schmecken.json` | dorf-wirt · dorf-foerster · dorf-magd | Fundstücke `absetzbecken`, `felsband`, `saatkammer` lesen (D145; seit D375 `saatkammer` statt `silo-hof`). Drei Zeigefinger von der Terrasse nach Norden, Westen und Süden — Wirt und Magd geben die **Reinkulturen Nord und Süd** |
| `die-zahl-am-morgen.json` · `schritte-auf-der-strasse.json` | dorf-alte · dorf-bursche | 2 Firnhasen **reinigen** (D375; sie leben auf Geröll über 1.000 m, der Text schickt dorthin) / 4 Spürfüchse besiegen (D145) |
| `was-im-stau-liegt.json` | werk-schichtbuch | **Zielart `regent`**, erst nach `das-stehende-wasser`. Bis zum 26.08.2026 war diese Zielart im Schema implementiert und von **keiner** Auftragsdatei benutzt — der Regent lag 1.381 m vom Start, das Nebelende bei 420 m, die Peilung zeigt nur auf Kreaturen, und kein einziger Text nannte ihn (G-101). Ein Boss, den man nur durch Zufall findet, ist kein Höhepunkt |
| `der-kern-im-stau.json` | Die Schmiedin (D188): Flussvater besiegen, nach „Harz für die Esse“ → zwei Harzverbände für die Fassung des Wasserfunkens (`docs/design/BRACHLAND_Kernfunken_v1.md`) |
| `die-karte-hinter-glas.json` | **Fahlmoos** (D248), Torfstecherin: Fundstück `diensthuette-hochrunst` → Reinkultur `regelkarte-inkubator` |
| `ein-gelege-ohne-fahl.json` | Torfstecherin, nach der Karte: zwei Myzelmolche reinigen (D375) → `eiprobe-rein` |
| `was-unter-dem-torf-bruetet.json` | Torfstecherin, nach dem Gelege: Brutmutter besiegen → `torfkern`. Damit sind alle drei Reinkulturen der Brutmutter erreichbar |
| `was-danach-waechst.json` | werk-schichtbuch | **Zielart `heile`** (D240), nach `was-im-stau-liegt`: die drei Komponenten am Regentenort einsetzen. Schliesst den Heilungs-Loop (Story-Bibel §6: besiegen → umschreiben → Wandel) |
| `harz-fuer-die-esse.json` | Die Schmiedin (D177): zwei Trafomarder besiegen → zwei Harzverbände, genug für die erste Waffenstufe |
| `was-noch-drin-liegt.json` | steinbruch-wart | **Vorbereitet für das Kletterzeug (D391).** Fundstück `stollenmund` lesen (389 m Fußweg vom Start). Entwurf in `docs/design/BRACHLAND_Traversal_v2.md` §5: Die Stange für die Mauer hat die „Klinge am Bruchweg“ (`lager-bruchweg`). **Seit D393:** Belohnung `kletterzeug`. **Platzhalter bleibt das Ziel:** nur das Lesen — Lager als Ziel, Mauer und das Werkzeug als Gegenstand sind nicht gebaut |
| `ein-schwieriger-nachbar.json` | dorf-foerster | **Vorbereitet für das Reittier (D391).** 3 Wurzelkeiler **reinigen**, erst nach `bis-zur-kante`. Entwurf ebd.: Der Förster gibt danach das Halfter, mit dem sich **ein** gereinigter Vierbeiner binden lässt. **Seit D393:** Belohnung `halfter`; die Bindung ist nicht gebaut |

## Die fünf Zielarten

`besiege` · `reinige` · `finde` · `regent` · `heile` — alle aus dem Spielstand allein
prüfbar. `reinige` ersetzt seit D375 `fange` (Story-Bibel v2 §2: Die Marke heilt, Fangen und Team
gibt es nicht mehr). Gezählt wird `Taten.gereinigt`; **bis die Kampfhandlung „Reinigen“ gebaut ist,
reicht `src/main.tsx` dort `gefangen` durch** — die Aufträge bleiben so erfüllbar wie bisher. `heile` (D240) liest `geheilt`, das erst entstand, bevor das Ziel gebaut wurde:
**erst** dafür sorgen, dass der Sachverhalt im Spielstand steht, dann das Ziel bauen.

## Wohin die Aufträge schicken (D375)

Nach vorn, nicht zurück zum Start: Die Reinkulturen liegen mindestens 900 m von der Enklave und von der
Regionsmitte, in drei Richtungen (`npm run validate` misst es). Die **verborgenen Orte** der Region nennt
kein Auftrag — `validate` lehnt einen ab, der auf ihr Fundstück zeigt. Tabelle alt → neu der geänderten
Texte: `../../docs/design/BRACHLAND_Enklave_Lage_v2.md` §6.

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
