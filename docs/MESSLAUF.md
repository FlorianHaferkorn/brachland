---
last-reviewed: 2026-09-15
shelf-life-days: 90
---
# Messlauf — Blender-Zielbild und Engine vergleichen

Arbeitsrezept ab D156, erweitert in D157. Fachlicher Ausgangsstand: Ledger in `_INDEX.md`;
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
ändert nur die Auswertung, nicht den Viewport. Seit D157 setzt `--format=16:9`
den Viewport auf 960×540; für neue Referenzvergleiche dieses Format verwenden.
Die historischen D155-Zahlen bleiben in ihrem ursprünglichen Format erhalten.

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

## LOD während Bewegung prüfen (D157)

```bash
node tools/mess/lodlauf.mjs neuer_waldlauf '0,0,310' 24
node --import tsx tools/baumvergleich.ts .cache/d157-baseline/props public/props .cache/neuer-baumvergleich.json 512
```

Der Lauf hält vorwärts + Rennen, protokolliert echte Instanzwechsel und erzeugt
Video/Bildfolge unter `.cache/mess/<name>`. Er scheitert bei Browserfehlern,
doppelten Bauminstanzen oder wenn kein LOD-Wechsel beobachtet wurde. Das ist
kein Beweis für unsichtbare Übergänge: Video/Bildfolge zusätzlich ansehen.
Der CPU-Vergleich misst sechs Silhouettenrichtungen in einem gemeinsamen Rahmen;
Shaderlöcher, Wind, Farbe und Bildrate bleiben ausdrücklich außerhalb dieser Messung.

`?wasser=physikalisch` aktiviert den zusätzlichen Transmission-Pass für A/B-Läufe.
Der Standard verwendet transparente Absorption. Gleiche Kamera, Bildgröße und
fertig geladenen Stand vergleichen; beide Pfade haben unterschiedliche Kosten.
Die Himmelsreflexion entsteht aus dem vorhandenen Spielhimmel bei Lichtwechsel;
sie enthält keine Bäume oder Bauwerke. Transmission ersetzt diese fehlende
Szenenreflexion nicht.

`?aoRadius=<Meter>` überschreibt die Reichweite der Tiefenverdeckung (Standard
seit D158: 8 m wie der AO-Bake der Bauwerke, zulässig bis 32 m). Ein größerer
Radius ersetzt keine gebackene Himmelsverdeckung; A/B-Bilder zusätzlich auf Halos
und ferne Streifen prüfen.

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

Für bereits gepacktes Grün seit D157 verlustfrei in eine neue Datei schreiben:

```bash
npx tsx tools/bautenpack.ts --verlustfrei --aus .cache/neues-stauwehr-gruen.glb public/bauten/stauwehr-gruen.glb
```

Meshopt komprimiert vorhandene Attribute ohne neue Quantisierung. `--aus` lehnt
bestehende Ziele ab. Die Dateiersparnis ist keine GPU-Ersparnis: Dreiecke und
dekodierter Speicher bleiben gleich. HTTP-gzip/Brotli separat messen, weil der
Codec deren Kompressionsverhältnis verändert. Der Roundtrip-Test in `make check`
prüft Werte und Dreiecke mit dem tatsächlichen Decoder der Engine.

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

## Was das Bake darf — und was die Engine macht (D159)

Die Bauwerke tragen ihr AO **in der Grundfarbe**. Die Reichweite entscheidet, was gebacken wird:

| Reichweite | misst | gehört | 
|---|---|---|
| ~0,35 m | Fuge, Kerbe, Kontaktschatten | ins Bake (ein Pixel breit, SSAO löst das nicht auf) |
| ~8 m | Mauer verschattet Hof | in den **SSAO-Pass** der Engine (`?aoRadius=`, Vorgabe 8) |

Beides zu backen heißt, die grosse Verdeckung doppelt zu rechnen. Mit `light_settings.distance = 8.0`
sah ein Stein in einer Mauer fast nur Mauer: `ao ≈ 0` über die ganze Fläche, gebackene Farbe `#3a3a32`
statt `#8a7a68`, im Spiel eine schwarze Wand. **Das war an den Bildwerten nicht zu sehen** — Median und
Drittel lagen im Rahmen, weil heller Himmel und schwarze Wand sich im Mittel aufheben.

**Deshalb: nach jedem Export eine Textur ansehen, nicht nur messen.**

```bash
node -e "const fs=require('fs');const b=fs.readFileSync('public/bauten/felsmulde-bauten.glb');
const jl=b.readUInt32LE(12),j=JSON.parse(b.slice(20,20+jl).toString()),bin=20+jl+8;
const m=j.meshes.find(m=>/MauerA\$/.test(m.name)),mat=j.materials[m.primitives[0].material];
const t=j.textures[mat.pbrMetallicRoughness.baseColorTexture.index];
const img=j.images[t.source??t.extensions?.EXT_texture_webp?.source],bv=j.bufferViews[img.bufferView];
fs.writeFileSync('.cache/mauer.webp',b.slice(bin+(bv.byteOffset||0),bin+(bv.byteOffset||0)+bv.byteLength));"
sips -s format png .cache/mauer.webp --out .cache/mauer.png
```

Gut ist: helle Steinflächen, sichtbares Moos, **kein Schwarz zwischen den UV-Inseln**. Das Schwarz kommt
von zu kleiner `MARGIN` (jetzt 24 px mit `ADJACENT_FACES`, `island_margin` 0,012) und blutet beim
Mipmapping in die Steine — sichtbar erst ab etwa 30 m Kameraabstand.

**Fülllicht.** Eine sonnenabgewandte senkrechte Fläche lebt in der Engine allein vom
`hemisphereLight`, das sie mit dem Mittel aus Himmel- und Bodenfarbe beleuchtet; im Render füllt sie der
Himmelsverlauf **und** indirektes Licht. `?umgebung=4` ist der Regler dafür. Was die Engine prinzipiell
nicht hat, sind Bounces: Fuge und Hof bleiben deshalb dunkler als im Render, und das ist keine
Reglerfrage — dort hilft nur Geometrie (flacherer Mörtelkern) oder gebackenes indirektes Licht.

## Bauwerke packen — Reihenfolge zählt (D159)

Ein Szenenexport schreibt **alle** Dateien der Szene neu, auch das Grün, und zwar unkomprimiert.
Nach jedem Export deshalb beide Schritte, in dieser Reihenfolge:

```bash
npx tsx tools/bautenpack.ts public/bauten/<szene>-bauten.glb public/bauten/<szene>-gruen.glb
npx tsx tools/bautenpack.ts --verlustfrei public/bauten/<szene>-gruen.glb   # Kontrolle: darf nichts mehr ändern
```

`--verlustfrei` allein auf eine frisch exportierte Datei bringt nur die Hälfte (Stauwehr-Grün 59 → 31,7 MB
statt 12,9 MB): Meshopt komprimiert quantisierte Attribute deutlich besser, und quantisiert wird im ersten
Lauf. Prüfen mit `ls -la public/bauten/` — Grün gehört bei 8–13 MB, nicht bei 39–59 MB; die Dreieckszahl
muss dabei gleich bleiben (Felsmulde 542.676, Stauwehr 840.104).

## Bildtor grunden — mit Blick ins Bild (D160)

`npm run bildtor` laeuft seit D160 mit echter GPU (Metal); SwiftShader stirbt an den 6 M Dreiecken der
Felsmulde. Playwright kommt ueber `tools/mess/pw.mjs`, kein Symlink noetig. Preview muss laufen.

**Vor `--neu` jeden Fall ansehen, dessen Zahlen sich stark bewegt haben.** Das Tor misst „ist das Dunkle
leer?" — es merkt nicht, ob der **Gegenstand** des Falls noch im Bild ist. Zweimal ist genau das passiert:
G-134 (Dorf ohne Haeuser) und D160 (der Fall „Fenster" stand am Wehr, wo die 160-m-Freihaltung des
Bauwerks seit D155 die Haeuser ausblendet — er mass fuenf Ledger-Zeilen lang nichts).

```bash
node tools/mess/stil.mjs --gpu '1350,495,0' probe '&zeit=0'     # denselben Ort einzeln aufnehmen
```

Nachtfaelle sind im Rohbild kaum lesbar — zum Pruefen aufhellen (Faktor 6–7), dann sieht man sofort, ob
Haeuser, Wasser oder Wald da sind, wo sie sein sollen. Erst danach `npm run bildtor -- --neu`, und jede
Median-Warnung im Ledger begruenden.

## Tonwertkurve: der Render ist AgX, die Engine war ACES (D161)

`tools/szenenbau.py` setzt `view_transform = 'AgX'` und den Look `AgX - Medium High Contrast`;
die Engine rechnete mit `ACESFilmicToneMapping`. **Jeder Vergleich Spiel gegen Render hat bis D161
auch den Kurvenunterschied gemessen.** `?kurve=agxlook|agx|aces|neutral|linear` macht ihn sichtbar,
`src/scenes/tonwert.ts` bildet den Look nach.

Die Kurve ist **gemessen, nicht umgerechnet** — Blenders Look sitzt im AgX-Log-Raum, dessen
Normierung sich nicht verlaesslich auf three.js uebertragen laesst:

```bash
blender --background --python .cache/rampe.py      # Rampe durch Blender, mit und ohne Look
node .cache/rampe_lesen.mjs 1 2.462                # dieselbe Rampe durch die echte Engine
```

`dist/rampe/` (gitignored) haelt dafuer eine Seite mit `preserveDrawingBuffer` — ohne das liest
`readPixels` nach dem Compositing nur Nullen. Ergebnis der Messung: Engine-AgX und Blender-AgX
weichen bei Belichtung 2,462 (= 2^1,3, Blenders Exposure) nur um **0,067** voneinander ab; der
Look ist der eigentliche Unterschied.

**Eine Kurve fuer den Look muss 0 auf 0 halten.** Der naheliegende Kontrast um einen Pivot
(c = 1,19, p = 0,75) traf tagsueber am besten, riss aber im Bildtor alle vier Nachtfaelle auf
(53 bis 67 % leere Flaeche): Nachts liegt das ganze Bild unter dem Pivot und wird auf null
geclampt. Blender umgeht das, weil sein Look im Log-Raum sitzt. Genommen ist deshalb
`w = x^1,12` gefolgt von `w + 0,70·w·(1−w)·(2w−1)` — Fehler 0,029, streng monoton, haelt 0 und 1.

Vor dem Umstellen einer Kurve **immer** `npm run bildtor -- --extra '&kurve=…'` laufen lassen.
`--extra` haengt Parameter an alle Faelle an und ist mit `--neu` gesperrt: Grundwerte gehoeren
zum Auslieferungsstand, nicht zu einem Probelauf.

## Prüfung und Rückweg

- **Input:** benannte Szene, Kamera, Parameter und unveränderte Referenz.
- **Output:** neues Bild plus Messwerte; bei Code-/Asset-Änderungen grünes
  `make check` und erfolgreicher Build. Die Ergebnisse im Ledger belegen.
- **Fehlerfall:** fehlende Datei, falsche Metadaten, Browserfehler oder halber
  Ladezustand → Lauf nicht als Vergleich werten, Ursache beheben.
- **Rollback:** neue Zwischenprodukte separat belassen; ausschließlich die eigenen
  Code-/Asset-Änderungen rückgängig machen, Referenzen und fremde Änderungen erhalten.
