---
last-reviewed: 2026-08-16
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
| `props/*.glb` | 23 Vegetationsmodelle aus dem Kenney Nature Kit 2.1 (CC0): Nadelbaum, Laubbaum, Busch, Findling, Grasbüschel je 4 Varianten, Totholz 3. Zusammen 130 KB. `propPfad()` in `../src/world/props.ts` löst sie über `/props/<variante>.glb` auf |

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
