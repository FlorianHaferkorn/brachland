---
last-reviewed: 2026-11-22
shelf-life-days: 180
owns: *.json
---
# content/fragmente — Fundstücke (_INDEX)

> Die Story-Bibel legt „Fragmente statt Cutscenes" fest. Hier liegt die Umsetzung:
> Die Geschichte steht an Orten, nicht in Dialogen. Wer sucht, findet sie; wer nicht
> sucht, geht daran vorbei. Genau das ist gewollt.

## „Lies-wenn"-Routing

| Deine Aufgabe ist … | Lies |
|---|---|
| Ein Fundstück anlegen | eine bestehende `.json` → `../../src/data/schema.ts` (`Fragment`) |
| Den Ton treffen | `../../docs/design/BRACHLAND_Story-Bibel_v2.md` (Ton: v1 §8) |
| Verstehen, wie die Story aufgebaut ist | `../../docs/design/BRACHLAND_Story-Struktur_v1.md` |
| Sehen, wie ein Fund im Spiel wirkt | `../../src/scenes/RegionsSzene.tsx` (`Fundstellen`) |

## Wo sie liegen

Alle Orte kommen aus den OSM-Daten der Region — Ruinen, Bunker-Silos, Steinbrüche,
Felsgrate. Die Welt liefert die Orte umsonst; sie mussten nur belegt werden.

| Datei | Fundstelle | lat, lon | Titel |
|---|---|---|---|
| `altes-gehoeft.json` | hof | 47.72695, 12.10626 | **Altes Gehöft** |
| `bruchkante.json` | steinbruch | 47.72790, 12.10688 | **An der Bruchkante** |
| `bruchsohle.json` | steinbruch | 47.72960, 12.10727 | **Auf der Bruchsohle** |
| `felsband.json` | grat | 47.72874, 12.07103 | **Unter dem Felsband** |
| `grat-hoch.json` | grat | 47.73297, 12.06503 | **Über der Waldgrenze** |
| `grat-nord.json` | grat | 47.73377, 12.07900 | **Nordgrat** |
| `grat-ost.json` | grat | 47.73261, 12.10288 | **Ostwand** |
| `kalkbruch.json` | steinbruch | 47.72712, 12.10734 | **Im Kalkbruch** |
| `silo-drei.json` | bunker | 47.73816, 12.09540 | **Silo drei** |
| `silo-hof.json` | bunker | 47.73032, 12.08282 | **Am Hofsilo** |
| `stauwehr.json` | bach | 47.72518, 12.09582 | **Am Stauwehr** |
| `absetzbecken.json` | **weiher** | 47.74678, 12.08377 | **Auf dem Grund** — liegt auf der Sohle des größten Weihers (62 × 71 m, 2,40 m tief), rund 30 m vom Ufer. Der Auslöser misst waagerecht 9 m; erreichbar ist das nur schwimmend. Das erste Fundstück, das eine Fähigkeit voraussetzt |
| `diensthuette-hochrunst.json` | **hof** | 47.79671, 12.05471 | **Dienstvorschrift, dritte Fassung** — Fahlmoos (D248), an der realen Diensthütte Hochrunstfilze (1910). Die Brutanlage hinter der Brutmutter; Ziel von `die-karte-hinter-glas` |
| `stollenmund.json` | ruine | 47.73038, 12.07810 | **Am Stollenmund** |
| `oberstollen.json` | ruine | 47.73342, 12.06773 | **Am oberen Mundloch** — D375, Reinkultur West: 963 m hoch unter dem Grat, Ziel von `was-am-stollen-steht` |
| `saatkammer.json` | hof | 47.72308, 12.08712 | **In der Saatkammer** — D375, Reinkultur Süd: Hof am Südhang, Ziel von `nach-vorher-schmecken` |
| `kirchturm.json` | ruine | 47.73585, 12.10339 | **Im Glockenstuhl** — D375, **verborgener Ort**: Kirche der versunkenen Stadt, 15,6 m unter der Flutlinie |
| `jagdhuette.json` | hof | 47.73883, 12.07153 | **Hütte im Bannwald** — D375, **verborgener Ort** im Westwald |
| `quelltopf.json` | bach | 47.72716, 12.05902 | **Am Quelltopf** — D375, **verborgener Ort**: Bachquelle auf 971 m |
| `alter-tresen.json` | hof | 47.72839, 12.09938 | **Am alten Tresen** — D375: das geräumte Dorf, 493 m, unter der Flutlinie |
| `hoftor-fahrweg.json` | hof | 47.73280, 12.08381 | **Am Hoftor** — D390, Lehrstrecke Station 2: Hofpaar am Fahrweg, 222 Wegmeter vom Start |
| `halle-gabelung.json` | ruine | 47.73462, 12.08791 | **Am Rolltor** — D390, Lehrstrecke Station 6: Halle an der Gabelung von Fahrweg und Fussweg; die Kreide nennt den Weg |
| `steg-an-der-furt.json` | bach | 47.73641, 12.08902 | **Am Steg** — D390, Lehrstrecke Station 7: Bachquerung des Fussweges, 313 m vor der Enklave |
| `erstes-haus.json` | hof | 47.73713, 12.08845 | **Am ersten Haus** — D390, Lehrstrecke Station 8: das erste Haus der Terrasse am Fussweg |

## Regeln

- **Höchstens 400 Zeichen.** Ein Fundstück, das man im Stehen nicht zu Ende liest,
  ist keins.
- **Kein Sprecher.** Wer das geschrieben hat, steht nie dabei. Das ist der Ton.
- **Keine Erklärung.** Ein Fragment stellt fest, es deutet nicht.
- **Auf ein Fundstück an einem verborgenen Ort zeigt kein Auftrag** (D375, `verborgeneOrte` in der Region) —
  `npm run validate` lehnt das ab.
- **Zeiten folgen der lokalen Linie** (D375): Kollaps vor 40–60 Jahren, Befall im Tal seit achtzehn Jahren,
  Flut seit dem Frühjahr. Beleg: `../../docs/design/BRACHLAND_Enklave_Lage_v2.md` §6.
- **Nicht zwei am selben Ort** — `npm run validate` prüft das, weil der zweite
  Auslöser sonst nie feuern würde.

## Definition of Done

- **Input:** neue `.json` in diesem Ordner
- **Output:** `npm run validate` grün, Ort mindestens 20 m von jedem anderen entfernt
- **Fehlerfall:** Schemafehler → Datei korrigieren; zu lang → kürzen, nicht das Limit heben
- **Rollback:** Datei löschen; gelesene IDs im Spielstand werden ignoriert
