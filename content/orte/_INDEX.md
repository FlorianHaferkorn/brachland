---
last-reviewed: 2026-09-08
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
| Einen Bewohner anlegen | `hof-tremmel.json` → danach **mindestens einen Auftrag** in `../auftraege/`. Mit `figur` (D144; die Liste ist `public/figuren/register.json`: `bauer`, `baeuerin`, `arbeiter`, `werkfrau`, `wanderer`, `foerster`, `wirt`, `bursche`, `alte`, `magd`) und `blick` (Grad wie `?absetzen=`) steht ein Mensch statt der Kapsel — der Ort muss **vor** dem Haus liegen, nicht im Grundriss: `npx tsx .cache/bewohnerplatz.ts lat lon` (oder `welt x z`) prüft das und schlägt Stand, `blick` und Kamera vor (D145) |
| Verstehen, was Rasten tut | `../../src/main.tsx` (`raste`) |
| Marke und Radius ändern | `../../src/scenes/RegionsSzene.tsx` (`Orte`, `ORT_AB`) |

## Register

| Datei | Art | Wozu |
|---|---|---|
| `unterstand-mitte.json` | zuflucht | Geräteschuppen 88 m von der Regionsmitte. Die erste Rast, die man findet, ohne sie zu suchen |
| `almhuette.json` | zuflucht | Hütte 2 km draußen auf 1000 m. Die Rast für den zweiten Teil der Region — der Weg dorthin ist ihr Preis |
| `hof-tremmel.json` | bewohner | Hofbesitzerin. Gibt `streuner` und danach `eine-fuer-den-hof` |
| `steinbruch-wart.json` | bewohner | Wart eines stillgelegten Bruchs. Gibt `was-am-stollen-steht` |
| `werk-schichtbuch.json` | bewohner | Frau am Tor des Industriegeländes. Gibt `die-runde` — der einzige Hinweis im Spiel, dass es die K7 gibt und wo sie steht |
| `dorf-wirt.json` · `dorf-alte.json` · `dorf-foerster.json` · `dorf-bursche.json` · `dorf-magd.json` | bewohner | Fünf Bewohner im dichtesten Dorf der Region (D145, um 1350/450), je vor einem Haus an der Strasse, je ein Auftrag (`was-der-tresen-weiss`, `die-zahl-am-morgen`, `bis-zur-kante`, `schritte-auf-der-strasse`, `nach-vorher-schmecken`). Bewusst **nicht** freistehend: Ein Dorf mit Menschen ist der Grund für die Figuren; die Marke findet man an der Figur, nicht am Haus |

## Warum die Positionen stimmen

Die ersten fünf stehen auf **freistehenden** OSM-Gebäuden — gemessen über die 2.033
Grundrisse der Region: **höchstens ein** Nachbargebäude im 70-m-Umkreis, bei zwei
der fünf gar keines. In einem Dorf wäre eine Marke zwischen zwanzig Häusern nicht
auffindbar; so ist sie es.

Hier stand „0 Nachbarn". Das war beim Anlegen der ersten zwei Orte richtig und ist
danach stehengeblieben — `hof-tremmel` und `steinbruch-wart` haben je einen. Die
Zahl kommt jetzt aus `npm run validate` und nicht mehr aus diesem Absatz.

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
