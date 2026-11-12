---
paths: ["src/**"]
---
# three.js / React / TS — Stack-Regeln (src/, pfadgebunden — lädt nur hier)

### Trennung, die nicht aufgeweicht wird
`engine/` und `data/` kennen **kein three.js**. Genau deshalb sind die 16 Kampftests ohne
Renderer lauffähig. Wer three.js dorthin importiert, zerstört die Testbarkeit — der
Renderer gehört nach `scenes/`, `world/` oder `ui/`.

### Sprache und Imports
- Bezeichner und Kommentare **deutsch**: `baueTerrain`, `verteileProps`, `ZIELHOEHE`.
- ESM-Import mit `.js`-Endung auf TS-Quellen: `from './world/osm.js'`.
- Typ-Importe explizit: `import type { Weltdaten } from './osm.js'`.

### three.js-Invarianten
- **Instancing ist Pflicht** für alles ab ~100 Objekten. `InstancedMesh`, nicht Schleifen.
- Geometrien und Materialien in `useMemo` — pro Frame neu erzeugt killt das Handy.
- **Texturen sind erlaubt** (ADR-0006 Stufe 2, löst D112 „keine Texturen" ab; D264). Was das
  Qualitätstor (`tools/quality.ts`) prüft, gilt: Bilder als `.webp` unter `public/material`, jede
  Datei mit Herkunft in `assets/HERKUNFT.md`, Lizenz nach ADR-0013 (kostet nichts), Materialbudget
  12 MB, Gesamtpaket 60 MB Precache. Eine Textur einmal laden und teilen (Cache je Pfad), nicht je
  Material. Vertex-Farbe bleibt, wo sie reicht und das Tor sie verlangt (Prop-Primitive,
  Kreaturen ohne UV); Scan-Props und Blender-Set-Pieces tragen UV und Textur.
- Determinismus über Seed: Positionen werden erzeugt, nicht gespeichert. ~40.000 Props
  als JSON wären mehrere Megabyte und würden das Offline-Budget sprengen.

### Inhalte kommen aus content/, nie aus dem Code
Kreaturen, Moves, Regionen sind Daten und werden gegen `data/schema.ts` validiert.
Ein hartkodierter Wert, der ins Schema gehört, ist ein Fehler — auch wenn er funktioniert.

### Was Änderungen an Zahlen kostet
Nebelwerte, LOD-Schwellen, Prop-Dichten, Zielhöhen und Kampfkonstanten sind **erarbeitete**
Werte — die Kampfwerte sind über 1.200–4.000 simulierte Kämpfe je Zeile geprüft
(`docs/design/BRACHLAND_Kampfsystem_v2.md`). Wer sie ändert, ändert Balance oder Look:
begründen, Tests laufen lassen, im Ledger vermerken.

### Versionen sind gepinnt, nicht zufällig
React 19 + `@react-three/fiber` 9 + `drei` 10. Ein Rückschritt auf React 18/fiber 8
erzeugt 20 Typfehler in `RegionsSzene.tsx` (Ledger D10). `npm install` braucht
`--legacy-peer-deps`.

### Nach jeder Änderung
```bash
npm run typecheck && npm run test && npm run validate
npm run dev    # Netzwerk-Adresse aufs Handy — der Laptop ist kein Test
```
