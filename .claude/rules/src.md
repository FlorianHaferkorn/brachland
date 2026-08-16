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
- Kein Texture-Loading. Vertex-Farben und Geometrie (Art Direction, ADR-0002).
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
