---
last-reviewed: 2026-11-22
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
| Wissen, wo was liegt und warum (Koordinaten, Abstände, Wege) | `../../docs/design/BRACHLAND_Enklave_Lage_v2.md` → `python3 tools/enklave_karte.py` |
| Eine Zuflucht anlegen | `unterstand-mitte.json` als Muster → `../../src/data/schema.ts` (`Ort`) |
| Einen Bewohner anlegen | `hof-tremmel.json` → danach **mindestens einen Auftrag** in `../auftraege/`. Mit `figur` (D144; die Liste ist `public/figuren/register.json`: `bauer`, `baeuerin`, `arbeiter`, `werkfrau`, `wanderer`, `foerster`, `wirt`, `bursche`, `alte`, `magd`) und `blick` (Grad wie `?absetzen=`) steht ein Mensch statt der Kapsel — der Ort muss **vor** dem Haus liegen, nicht im Grundriss: `npx tsx .cache/bewohnerplatz.ts lat lon` (oder `welt x z`) prüft das und schlägt Stand, `blick` und Kamera vor (D145). Seit D146 `gang` (Meter entlang `blick`, der Bewohner geht hin und zurück) und `farben` (Slots `haut haar oberteil hose stiefel kopf riemen hemd`, sRGB-Hex im Kreaturband — `npm run validate` prüft) |
| Verstehen, was Rasten tut | `../../src/main.tsx` (`raste`) |
| Marke und Radius ändern | `../../src/scenes/RegionsSzene.tsx` (`Orte`, `ORT_AB`) |

## Register

| Datei | Art | Wozu |
|---|---|---|
| `terrasse-saal.json` | zuflucht | **Enklave** (D375): Saal auf der Hangterrasse, 54 m vom Wirt. Innerer Ring |
| `feldscheune-waldrand.json` · `schuppen-nordufer.json` · `stadel-hangweg.json` | zuflucht | Innerer Ring um die Enklave (D375): West 622 m, Nord 641 m (Weg zum Absetzbecken), Süd 778 m (Uferweg zum Wehr) |
| `kirche-nordhang.json` · `kapelle-kalkbruch.json` | zuflucht | Äusserer Ring (D375): Kirche im Norden (1.494 m, 578 m hoch) und Kapelle auf dem Kalkbruch-Rücken (1.724 m). **Die Kapelle steht auf einer Insel** — bei Flutlinie 499 m nur schwimmend erreichbar |
| `unterstand-mitte.json` | zuflucht | Geräteschuppen 88 m von der Regionsmitte. Die erste Rast, die man findet, ohne sie zu suchen |
| `heustadel-graben.json` | zuflucht | Heustadel zwischen Bruchweg (≈ 170 m) und Hofgraben (≈ 360 m), D183 — kurzer Rückweg nach einer Niederlage an den unteren Lagern |
| `almhuette.json` | zuflucht | Hütte 2 km draußen auf 1000 m. Die Rast für den zweiten Teil der Region — der Weg dorthin ist ihr Preis |
| `hof-tremmel.json` | bewohner | Hofbesitzerin. Gibt `streuner` und danach `eine-fuer-den-hof` |
| `torfhuette-stecherin.json` | bewohner | **Fahlmoos** (D248): Torfstecherin vor der Torfarbeiterhütte (OSM „Mittagshütte“), 3 m südlich der Wand. Gibt `die-karte-hinter-glas` → `ein-gelege-ohne-fahl` → `was-unter-dem-torf-bruetet` |
| `torfstadel.json` | zuflucht | **Fahlmoos** (D248): Torfstadel am Filzenrand (OSM „Torfstadel“), Aufwachpunkt 4,1 m vor der Wand |
| `steinbruch-wart.json` | bewohner | Wart eines stillgelegten Bruchs. Gibt `was-am-stollen-steht` |
| `werk-schichtbuch.json` | bewohner | Frau am Tor des Industriegeländes. Gibt `die-runde` — der einzige Hinweis im Spiel, dass es die K7 gibt und wo sie steht |
| `dorf-wirt.json` · `dorf-alte.json` · `dorf-foerster.json` · `dorf-bursche.json` · `dorf-magd.json` | bewohner | Fünf Bewohner der **Enklave auf der Hangterrasse** (D375; bis dahin im Dorf um 1350/450, das unter der Flutlinie liegt und geräumt ist — die IDs sind geblieben). Über die Terrasse verteilt, kein 80-m-Kreis mit mehr als einem: Wirt in der Mitte (696/−657), Alte am Kirchhof, Magd am Bach, Bursche als Wache am Abstieg zur Flut, Förster 334 m ausserhalb am Waldrand. Je ein Auftrag (`was-der-tresen-weiss`, `die-zahl-am-morgen`, `bis-zur-kante`, `schritte-auf-der-strasse`, `nach-vorher-schmecken`). `abends` nennt, wer abends zum Wirt geht (Alte, Magd) |
| `dorf-schmied.json` | bewohner | Die Schmiedin (D177; seit D375 am Nordende der Terrasse, 403 m vom Wirt): `schmied: true` — ihr Fenster tauscht Beute gegen Waffenstufen (`src/spiel/schmiede.ts`). Kein Auftrag; Figur `werkfrau` (neue Gestalt), Platz mit `.cache/bewohnerplatz.ts` |

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
- **Über der Flutlinie.** Kein Bewohner und keine Zuflucht liegt unter `flutlinie` der Region (D375) — `npm run validate` prüft gegen das Höhenraster.
- **Keine Nabe.** Nicht mehr als die Hälfte der Enklaven-Bewohner in einem 80-m-Kreis (Story-Struktur v1).
- **Abendweg höchstens 150 m** (`abends`): Der Weg ist eine Gerade.
- **Figuren, die weiterziehen, sind keine Orte** — sie liegen in `../wanderfiguren/`.
- **Kein Dialog.** Ein Satz, der beim Ansprechen oben steht. Wer mehr erzählen
  will, legt ein Fragment an.

## Definition of Done

- **Input:** neue `.json` in diesem Ordner
- **Output:** `npm run validate` grün, Position auf einem freistehenden Gebäude
- **Fehlerfall:** Bewohner ohne Auftrag → Auftrag nachlegen, nicht die Prüfung lockern
- **Rollback:** Datei löschen; verwaiste Auftrags-IDs im Spielstand werden ignoriert
