---
last-reviewed: 2026-09-15
shelf-life-days: 90
---
# Messlauf — Blender-Zielbild und Engine vergleichen

Arbeitsrezept für D156. Fachlicher Ausgangsstand: Ledger D155 in `_INDEX.md`;
Qualitätsmaßstab: ADR-0006. Offene Befunde und Entscheidungen werden ausschließlich
im Ledger gepflegt. Alle Befehle laufen aus dem Repo-Root.

## Voraussetzungen

Node-Abhängigkeiten installiert, Blender im PATH; der Blender-Pfad benutzt
Cycles/Metal auf dem M1. Playwright bleibt wie bei den bisherigen Messwerkzeugen
außerhalb des Projekt-Manifests. `tools/mess/pw.mjs` lädt zuerst `playwright` über
Node, sonst die lokale Installation unter `.cache/mess/node_modules/playwright`.
Wenn sie fehlt:

```bash
mkdir -p .cache/mess .cache/bilder
(cd .cache/mess && npm init -y && npm install playwright && npx playwright install chromium)
```

Vor Spielmessungen `npm run build`, dann in einem zweiten Terminal:

```bash
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Ein bereits laufender Preview-Server kann verwendet werden. Port-Konflikte nicht
durch Beenden fremder Prozesse lösen. In einer Sandbox benötigt der lokale
Chromium-Start gegebenenfalls eine Freigabe; ein verweigerter Browserstart ist
kein Rendering-Befund.

## Kamera-Adressen aus D155

Quelle: ausgeführte Kette `.cache/kette155i.sh`, Parameterimplementierung in
`src/scenes/RegionsSzene.tsx`. Die Adressen konservieren den damaligen Messlauf;
nach Gelände-/Kameraänderungen aus der neuen Blender-Szene neu ableiten.

| Szene | Spieler: `absetzen=x,z,grad` | Kamera: `kamera=x,y,z,tx,ty,tz` |
|---|---|---|
| Felsmulde | `-810,599.5,263` | `-810,454.99,599.5,-795,455.89,601.2` |
| Stauwehr | `1045,885,304` | `1068,48.25,867,1105,44.19,842` |

Beide verwenden `stimmung=zielbild&fov=42.6&kontur=0`. `fov` ist das **senkrechte**
Sichtfeld; `kamera` fixiert Blickpunkt und Ziel, `absetzen` setzt weiterhin die
Figur und damit den Bereich für LOD/Streaming. `&ao=0` schaltet für einen A/B-Lauf
SSAO aus. Ohne `ao` gilt der aktuelle Standardwert.

```bash
node tools/mess/stil.mjs --gpu '-810,599.5,263' d156_felsmulde '&stimmung=zielbild&kamera=-810,454.99,599.5,-795,455.89,601.2&fov=42.6&kontur=0'
node tools/mess/stil.mjs --gpu '1045,885,304' d156_stauwehr '&stimmung=zielbild&kamera=1068,48.25,867,1105,44.19,842&fov=42.6&kontur=0'
node tools/mess/stil.mjs .cache/bilder/oental_zielbild.png .cache/bilder/stauwehr_zielbild.png
```

Ergebnisse: PNG unter `.cache/bilder/<name>.png`, Zahlen auf stdout. Pro neuer
Iteration einen neuen Namen verwenden; das Skript überschreibt vorhandene Namen.
Die Referenzdateien aus D153/D155 erhalten, nicht neu darüber rendern.

**Grenze der historischen Messung:** Das Werkzeug fotografiert mit 900×620,
Blender rendert voll mit 1920×1080. Trotz gleicher Kamera und vertikalem FOV sind
die horizontalen Bildausschnitte verschieden. Diese Zahlen reproduzieren D155,
sind aber kein pixelgenauer Vergleich. Für eine neue visuelle Abnahme zuerst das
Seitenverhältnis angleichen und dafür eine eigene Messreihe führen. `--voll`
ändert nur die Auswertung, nicht den Viewport.

## Was die Werkzeuge messen

| Werkzeug | Ergebnis / Einsatz |
|---|---|
| `tools/mess/stil.mjs` | Linear-sRGB-Leuchtdichte (Median, p10, p90), Anteil unter 0,02 / über 0,30, Sättigung, Drittel, Licht-/Schattenfarbe, lokaler Kontrast und Farbtonfamilien. Standard: Höhenbereich 14–78 % ohne HUD; `--voll`: gesamtes Bild. |
| `tools/mess/sonde.mjs` | InstancedMeshes aus `window.__szene`: Instanzzahl, Dreiecke je Geometrie, Materialtyp, Flat Shading, Attribute und Shader-Key. Ausgabe ist ein JSON-Array, kein automatisches Qualitätstor. |
| `tools/mess/konsole.mjs` | Gefilterte Konsolenmeldungen (`error`, `THREE`, `glut`, `shader`) und `pageerror`. Meldungen manuell bewerten; Exit 0 garantiert keine fehlerfreie Szene. |
| `tools/mess/pw.mjs` | Gemeinsamer Playwright-Loader; keine eigene Messung. |

```bash
node tools/mess/sonde.mjs '0,0,310' '&zeit=0.26&kontur=0'
node tools/mess/konsole.mjs '1045,885,304' '&stimmung=zielbild&kamera=1068,48.25,867,1105,44.19,842&fov=42.6'
```

`stil.mjs --gpu` und die Sonde benutzen Metal; die Konsole startet ohne diese
GPU-Optionen. Das Stilwerkzeug wartet auf Menü, Ladezeit und vier Sekunden stabile
HUD-Dreieckszahl (mit Zeitlimits). Sonde/Konsole warten nach dem Menü feste zwölf
Sekunden. Bei unvollständigem Laden ist deren Ergebnis nicht belastbar. Keine
Look-/Bewegungsabnahme allein aus einer Zahl oder einem Standbild ableiten.

## Blender ↔ Welt

`tools/terrainexport.ts` exportiert relativ zu Mittelpunkt `(cx,cz)` und Höhe `h0`:

```text
Blender (X,Y,Z) = (Welt.x − cx, cz − Welt.z, Welt.y − h0)
Welt (x,y,z)    = (cx + X, h0 + Z, cz − Y)
```

| Szene | cx / cz | h0 in Weltmetern (D155) | Nahfeld / Fernfeld |
|---|---|---|---|
| Felsmulde | −800 / 600 | 452,91191750150034 | 320 m / 1 m Raster; 2400 m / 8 m Raster |
| Stauwehr | 1110 / 871 | 46,74701445112107 | 320 m / 1 m Raster; 2400 m / 8 m Raster |

Verbindlich ist die beim Export erzeugte `terrain.json`, nicht die gerundete
Kameraadresse. Der glTF-Exporter dreht Blender-Z nach Y und Blender-Y nach −Z;
`public/bauten/register.json` liefert danach Ursprung und `h0` für die Engine.

## Kettenrezept

Die Übergabe sichert auch den zuvor nur in `.cache/` vorhandenen Terrainexport
unter `tools/terrainexport.ts`. Die folgenden Befehle sind das Rezept für einen
**neuen** Bau, keine bei jeder Dokumentationsänderung nötige Prüfung. Neu erzeugte
Dateien liegen zunächst unter `.cache/d156-neubau/`; für spätere Läufe einen
neuen Ordnernamen wählen. Bestehende `.blend` und Referenzbilder bleiben erhalten.

### 1. Terrain und Zielbilder

```bash
npx tsx tools/terrainexport.ts -800 600 320 1 .cache/d156-neubau/felsmulde
npx tsx tools/terrainexport.ts -800 600 2400 8 .cache/d156-neubau/felsmulde fern_
npx tsx tools/terrainexport.ts 1110 871 320 1 .cache/d156-neubau/stauwehr
npx tsx tools/terrainexport.ts 1110 871 2400 8 .cache/d156-neubau/stauwehr fern_
blender --background --python tools/szenenbau.py -- .cache/d156-neubau/felsmulde .cache/d156-neubau/felsmulde.blend .cache/d156-neubau/felsmulde.png voll felsmulde
blender --background --python tools/szenenbau.py -- .cache/d156-neubau/stauwehr .cache/d156-neubau/stauwehr.blend .cache/d156-neubau/stauwehr.png voll stauwehr
```

`schnell` statt `voll`: 960×540 / 24 Samples; `voll`: 1920×1080 / 48 Samples.
Keine historischen Referenzwerte auf einen frisch geänderten Bau übertragen.

### 2. Szenenexport und Packen

**Der Exporter liest derzeit fest `.cache/blender/terrain.json`.** Vor jedem Export
muss dort die Metadatei genau dieser Szene liegen. Falsche Metadaten versetzen das
Bauwerk trotz erfolgreichem Export. Exporte daher seriell ausführen und die
vorhandene Datei vorher sichern (falls vorhanden):

```bash
mkdir -p .cache/blender
if test -f .cache/blender/terrain.json; then
  cp -n .cache/blender/terrain.json .cache/d156-neubau/terrain.baseline.json
fi
cp .cache/d156-neubau/felsmulde/terrain.json .cache/blender/terrain.json
blender --background .cache/d156-neubau/felsmulde.blend --python tools/szenenexport.py -- .cache/d156-neubau/bauten felsmulde 512
cp .cache/d156-neubau/stauwehr/terrain.json .cache/blender/terrain.json
blender --background .cache/d156-neubau/stauwehr.blend --python tools/szenenexport.py -- .cache/d156-neubau/bauten stauwehr 512
if test -f .cache/d156-neubau/terrain.baseline.json; then
  cp .cache/d156-neubau/terrain.baseline.json .cache/blender/terrain.json
fi
npx tsx tools/bautenpack.ts .cache/d156-neubau/bauten/felsmulde-bauten.glb .cache/d156-neubau/bauten/felsmulde-gruen.glb .cache/d156-neubau/bauten/stauwehr-bauten.glb .cache/d156-neubau/bauten/stauwehr-gruen.glb
```

`bautenpack.ts` überschreibt seine Eingaben, daher nur frisch exportierte GLB
packen. D155 packte Bauten und Grün; Wasser bleibt eigener Export. Der Exporter
kann nach dem Schreiben beim Beenden hängen: frische GLB, aktualisierten
Registereintrag **und** die Log-Zeile `fertig <name>` prüfen. Nur den eigenen
Exportprozess beenden, keine pauschalen `pkill`-Befehle. Auch nach einem Abbruch
die gesicherte Metadatei wiederherstellen. Eine Zeitüberschreitung allein gilt
nicht als erfolgreicher Export.

### 3. Bäume, Übernahme und Build

```bash
blender --background --python tools/baumbau.py -- .cache/d156-neubau/props 4
```

Das baut zwei Arten × vier Varianten × drei Stufen = 24 GLB plus `baeume.json`.
Nach Prüfung die erzeugten Dateien gezielt nach `public/bauten/` bzw.
`public/props/` übernehmen und die **betroffenen** Einträge des bestehenden
Bauwerkregisters aktualisieren; andere Bauwerke erhalten. Dieser Schritt ist eine
bewusste Asset-Änderung, kein Bestandteil einer reinen Messung.

```bash
make check
npm run build
```

Danach Preview und Messungen wie oben, zusätzlich freie Bewegung durch die
LOD-Übergänge. `/bauten/` wird laut D155 erst zur Laufzeit gecacht: Ein bisher
unbesuchtes Bauwerk ist offline nicht automatisch vorhanden.

## Prüfung und Rückweg

- **Input:** benannte Szene, Kamera, Parameter und unveränderte Referenz.
- **Output:** neues Bild plus Messwerte; bei Code-/Asset-Änderungen grünes
  `make check` und erfolgreicher Build. Die Ergebnisse im Ledger belegen.
- **Fehlerfall:** fehlende Datei, falsche Metadaten, Browserfehler oder halber
  Ladezustand → Lauf nicht als Vergleich werten, Ursache beheben.
- **Rollback:** neue Zwischenprodukte separat belassen; ausschließlich die eigenen
  Code-/Asset-Änderungen rückgängig machen, Referenzen und fremde Änderungen erhalten.
