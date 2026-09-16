---
last-reviewed: 2026-09-16
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
| Den Ton treffen | `../../docs/design/BRACHLAND_Story-Bibel_v1.md` |
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
| `stollenmund.json` | ruine | 47.73038, 12.07810 | **Am Stollenmund** |

## Regeln

- **Höchstens 400 Zeichen.** Ein Fundstück, das man im Stehen nicht zu Ende liest,
  ist keins.
- **Kein Sprecher.** Wer das geschrieben hat, steht nie dabei. Das ist der Ton.
- **Keine Erklärung.** Ein Fragment stellt fest, es deutet nicht.
- **Nicht zwei am selben Ort** — `npm run validate` prüft das, weil der zweite
  Auslöser sonst nie feuern würde.

## Definition of Done

- **Input:** neue `.json` in diesem Ordner
- **Output:** `npm run validate` grün, Ort mindestens 20 m von jedem anderen entfernt
- **Fehlerfall:** Schemafehler → Datei korrigieren; zu lang → kürzen, nicht das Limit heben
- **Rollback:** Datei löschen; gelesene IDs im Spielstand werden ignoriert
