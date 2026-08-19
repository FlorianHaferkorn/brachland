---
last-reviewed: 2026-08-19
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
| `props/*.glb` | 36 Vegetationsmodelle aus dem Kenney Nature Kit 2.1 (CC0), gebaut mit `npm run props:bau`: Busch, Grasbüschel, Findling, Totholz, Blume, Pilz je 6 Varianten. Zusammen **92 KB** — weniger als die 23 Modelle vorher, weil die acht Baum-GLB weg sind (Bäume sind prozedural, D40) und weil UV und Material aus den Dateien fliegen. Jedes Modell: **ein** Primitiv, Farbe als `COLOR_0` in der Projektpalette, Höhe in echten Metern. `npm run quality` blockt, wenn eines davon nicht stimmt (G-76) |

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
