---
paths: ["src/**"]
---
# three.js / React / TS — Stack-Regeln (src/, pfadgebunden — lädt nur hier)

### Erst prüfen, was existiert
`world/osm.ts` und `world/terrain.ts` **fehlen** (Ledger B-1/B-2). Ein Import darauf
kompiliert nicht. Vor jeder Änderung `../docs/RECOVERY.md` und `_INDEX.md` lesen —
nichts als vorhanden annehmen, weil `docs/START.md` es beschreibt.

### Sprache und Imports
- Bezeichner und Kommentare **deutsch**: `baueTerrain`, `verteileProps`, `ZIELHOEHE`.
- ESM-Import mit `.js`-Endung auf TS-Quellen: `from './world/osm.js'`.
- Typ-Importe explizit: `import type { Weltdaten } from './world/osm.js'`.

### three.js-Invarianten
- **Instancing ist Pflicht** für alles ab ~100 Objekten. `InstancedMesh`, nicht Schleifen.
- Geometrien und Materialien in `useMemo` — pro Frame neu erzeugen killt das Handy.
- Kein Texture-Loading. Vertex-Farben und Geometrie (Art Direction, ADR-0002).
- Determinismus über Seed: Positionen werden erzeugt, nicht gespeichert. ~40.000 Props
  als JSON wären mehrere Megabyte und würden das Offline-Budget sprengen.

### Was Änderungen an Zahlen kostet
Nebelwerte, LOD-Schwellen, Prop-Dichten und Zielhöhen sind **erarbeitete** Werte, keine
Defaults. Wer sie ändert, ändert den Look — begründen und im Ledger vermerken.

### Nach jeder Änderung
```bash
npm run typecheck && npm run test
npm run dev    # Netzwerk-Adresse aufs Handy — der Laptop ist kein Test
```
