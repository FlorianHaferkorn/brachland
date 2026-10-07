---
last-reviewed: 2026-09-26
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
| `bauten/*.glb` + `bauten/register.json` | Bauwerke aus der Blender-Szene (ADR-0006, Stufe 2), geschrieben von `tools/szenenexport.py`: je Bauwerk `-bauten.glb` (Stein/Holz mit gebackener Grundfarbe, Rauheit, Normale), `-gruen.glb` (Blattmassen mit Vertexfarbe, Loecher im Shader) und `-wasser.glb`. Das Register nennt Ursprung, `h0`, Terrasse und Freihaltung (`props`, `streu`, `haeuser`) — die Engine liest es ueber `src/world/bauwerke.ts`. **Nicht** unter dem Kreatur- oder Figurenbudget: Groesse und Dreiecke werden gemessen, nicht gedeckelt (ADR-0006). Zwei Bauwerke seit D155 (Felsmulde 8 + 19 MB, Stauwehr 4 + 30 MB) — **nicht im Precache**, sondern per Laufzeitregel `/bauten/` gecacht (`vite.config.ts`) **Neu gebaut in D162** nach der Geländekorrektur: h0 Felsmulde 452,9119 → 453,1171, Stauwehr 46,7470 → 46,4557; Dateigrössen und Dreieckszahlen gegenüber D157 unverändert (840.104 Dreiecke `stauwehr-gruen`). Rückweg unter `.cache/d162-neubau/public-vorher/`. |
| `bauten/staemme.json` | Stammkreise `[x, z, r]` je Blender-Szene für das Kollisionsfeld (G-136), erzeugt von `../tools/staemme.ts` — nicht von Hand |
| `figuren/*.glb` + `figuren/register.json` | Menschen aus `tools/menschbau.py` (D143): `wanderin.glb` (Spielfigur) und die Bewohner `bauer`, `baeuerin`, `arbeiter`, `werkfrau`, `wanderer` und seit D145 die Varianten aus Teilen `foerster`, `wirt`, `bursche`, `alte`, `magd` (11 Figuren, 1,15 MB; `register.json` ist die Liste, die das Schema liest) — SkinnedMesh mit Skin, Animationen, COLOR_0; Quaternius CC0, Herkunft in `../assets/HERKUNFT.md` |
| `figuren/kampf/wanderin-waffen.glb` | D171: das Moveset der Wanderin (9 Clips `Klinge_*`/`Axt_*`) ohne Netz — nur Knochen und Animation, Meshopt, 244 KB. Gebaut von `tools/waffenclips.py` über `menschbau.py`, abgetrennt von `tools/waffenteilen.ts`; geladen erst mit Kampfplatz (`useWaffenClips`). Budget 250 KB in `tools/quality.ts` |
| `creatures/kampf/*.glb` + `register.json` | D172: K7-Wolf und Grathorn mit Skin und sieben Clips der Quelle (Idle, Walk, Gallop, Angriff, zwei Treffer, Tod), aus `tools/kampftierbau.py` + `kampftierpack.ts`; Wolf 256 KB, Grathorn 205 KB, Budget 300 KB in `tools/quality.ts`. Nur mit Kampfplatz geladen |
| `bauten/<name>-himmel.bin` + `.json` | D171: Himmelsanteil des Geländes um das Set-Piece, 0,5-m-Raster, 8 Bit (156 KB je Set-Piece), aus `tools/himmelboden.ts`; der Bodenshader liest es als Datentextur |
| `herkunft.json` | Die Modelle-Tabelle aus `../assets/HERKUNFT.md` als JSON, geschrieben von `npm run herkunft` (D127) — ins Bündel importiert, damit die CC-BY-Nennung im Menü auch offline steht. `npm run quality` blockt, wenn JSON und Tabelle auseinanderliegen |
| `props/baum-*.glb` + `props/baeume.json` | **Blender-Baeume** (ADR-0006, D155) aus `tools/baumbau.py`: je Art (buche, fichte), Variante (4) und Stufe (nah, mittel, fern) ein Netz mit Vertexfarbe, Laubmaske in `COLOR_0.a` (Loecher im Shader) und Windgewicht `_WIND`; Laub je Stufe dunkler gebacken (0,85/0,78/0,62). Das Register nennt Hoehe und Dreiecke (Buche 4.784–4.968 / 2.816–3.000 / 340, Fichte 848/348/120); `src/world/props.ts` (`blenderBaum`) nimmt die Datei statt `baueBaum` und statt des Kegels, sobald ein Eintrag da ist. Eigene Klasse im Dreieckskorridor (`Baum (Blender)` 100–6.000) |
| `props/*.glb` | 36 **prozedurale** Attrappen, gebaut mit `npm run props:bau` (D120, vorher Kenney Nature Kit 2.1 CC0, D74): Busch, Grasbüschel, Findling, Totholz, Blume, Pilz je 6 Varianten, Median 219 Dreiecke (Korridor D111), zusammen **328 KB** quantisiert. Bis zum 07.09.2026 **92 KB** aus Kenney — weniger als die 23 Modelle davor, weil die acht Baum-GLB weg sind (Bäume sind prozedural, D40) und weil UV und Material aus den Dateien fliegen. Jedes Modell: **ein** Primitiv, Farbe als `COLOR_0` in der Projektpalette, Höhe in echten Metern. `npm run quality` blockt, wenn eines davon nicht stimmt (G-76) |

## Aktueller Precache

```
89 Einträge · 5.116 KiB   (npm run build, 15.09.2026, D155 — ohne bauten/)
```

Die 23 Prop-Modelle kosten zusammen ~130 KB — die Varianten sind billig. Der Löwenanteil
sind die Weltdaten. Bei weiteren Regionen wächst dieser Posten linear: 5 Regionen
bedeuten ~5 MB allein an Weltdaten, plus Kreaturmodelle. Ledger A-6 ist deshalb kein
Detail, sondern der Faktor, der über die Offline-Tauglichkeit entscheidet.

## Was hier NICHT hingehört

Kreatur-Quellmodelle liegen in `../assets/` und werden bewusst kopiert, nicht abgelegt.
Bilder aus den Spikes liegen in `../docs/bilder/` — sie sind Referenz, kein Spielinhalt,
und hätten im Cache nichts verloren.
