---
last-reviewed: 2026-09-08
shelf-life-days: 90
---
# public — Was der Service Worker ausliefert (_INDEX)

> Alles hier landet im **Offline-Cache** der PWA (`vite.config.ts`, Workbox-Glob
> `**/*.{js,css,html,json,glb}`, max. 8 MB je Datei). Das ist kein Ablageort für
> Zwischenstände: Jede Datei hier kostet Platz auf dem Handy und zählt gegen das
> 60-MB-Budget aus `../docs/QUALITY.md`.

## Register

| Pfad | Inhalt |
|---|---|
| `world/oental.json` | Weltdaten für Œntal — 1,05 MB. Höhenraster, Biome, OSM-Geometrie, Spawn-Zonen. Erzeugt mit `npm run world oental 96` |
| `creatures/*.glb` + `creatures/register.json` | 14 Kreaturmodelle aus `tools/kreaturbau.py` (D104–D109, D124), das Register sagt der Szene, welche Art ein Modell hat; Herkunft je Datei in `../assets/HERKUNFT.md` |
| `herkunft.json` | Die Modelle-Tabelle aus `../assets/HERKUNFT.md` als JSON, geschrieben von `npm run herkunft` (D127) — ins Bündel importiert, damit die CC-BY-Nennung im Menü auch offline steht. `npm run quality` blockt, wenn JSON und Tabelle auseinanderliegen |
| `props/*.glb` | 36 **prozedurale** Attrappen, gebaut mit `npm run props:bau` (D120, vorher Kenney Nature Kit 2.1 CC0, D74): Busch, Grasbüschel, Findling, Totholz, Blume, Pilz je 6 Varianten, Median 219 Dreiecke (Korridor D111), zusammen **328 KB** quantisiert. Bis zum 07.09.2026 **92 KB** aus Kenney — weniger als die 23 Modelle davor, weil die acht Baum-GLB weg sind (Bäume sind prozedural, D40) und weil UV und Material aus den Dateien fliegen. Jedes Modell: **ein** Primitiv, Farbe als `COLOR_0` in der Projektpalette, Höhe in echten Metern. `npm run quality` blockt, wenn eines davon nicht stimmt (G-76) |

## Aktueller Precache

```
29 Einträge · 2.256 KiB   (npm run build)
```

Die 23 Prop-Modelle kosten zusammen ~130 KB — die Varianten sind billig. Der Löwenanteil
sind die Weltdaten. Bei weiteren Regionen wächst dieser Posten linear: 5 Regionen
bedeuten ~5 MB allein an Weltdaten, plus Kreaturmodelle. Ledger A-6 ist deshalb kein
Detail, sondern der Faktor, der über die Offline-Tauglichkeit entscheidet.

## Was hier NICHT hingehört

Kreatur-Quellmodelle liegen in `../assets/` und werden bewusst kopiert, nicht abgelegt.
Bilder aus den Spikes liegen in `../docs/bilder/` — sie sind Referenz, kein Spielinhalt,
und hätten im Cache nichts verloren.
