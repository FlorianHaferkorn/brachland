---
last-reviewed: 2026-08-16
shelf-life-days: 30
---
# Rekonstruktionsstand — was gerettet ist und was fehlt

BRACHLAND entstand am 13.–16.08.2026 in einem claude.ai-Chat mit Code-Ausführung.
Diese Sandbox ist **ephemer** — der Arbeitsordner existiert nicht mehr. Auf dem Mac
gibt es keine Spur davon (Spotlight, 16.08.2026: keine Treffer für `brachland`,
`oental`, `autorig`, `QUALITY.md`).

Rekonstruierbar ist deshalb **nur**, was der Chat als Datei-Anhang ausgegeben hat.
Diese Datei hält fest, was das ist — damit niemand später glaubt, das Repo sei
vollständig.

Quelle: `https://claude.ai/chat/ff16fcaf-0241-41f6-97fd-8e12c06a59fc`
(Snapshot: `https://claude.ai/share/dea380d0-633c-479a-88b4-768a749c4444`)

## Gerettet (verbatim aus dem Chat)

| Datei im Repo | Zeilen | Inhalt |
|---|---|---|
| `src/scenes/RegionsSzene.tsx` | 231 | Art Direction, 3 Stimmungen (Dämmerung/Nebelmorgen/Nacht), Nebel- und Lichtwerte, Props als `InstancedMesh` |
| `src/world/props.ts` | 234 | Deterministische Prop-Verteilung per Seed, Dichten je Biom, Varianten, `ZIELHOEHE`-Normierung |
| `src/world/lod.ts` | 222 | 4 LOD-Stufen, hangabhängiges Mikrorelief (4 Oktaven, <1,2 m), Schürzen gegen Kachelrisse |
| `src/main.tsx` | 44 | Einstiegspunkt, lädt Weltdaten, montiert `RegionsSzene` |
| `vite.config.ts` | 25 | PWA-Setup, Workbox-Precache inkl. `world/*.json` und `*.glb`, `server.host` |
| `docs/START.md` | 84 | Projektstand vom 16.08.2026, Befehle, gemessene Build-Kennzahlen |

## Fehlt — nicht als Datei im Chat ausgegeben

Belegt durch Importe im geretteten Code bzw. durch `START.md`:

| Fehlend | Beleg | Wiederbeschaffung |
|---|---|---|
| `src/world/osm.ts` (Typ `Weltdaten`, `Biom`) | Import in `props.ts`, `main.tsx`, `RegionsSzene.tsx` | Neu bauen — Schnittstelle ist aus den Importen ableitbar |
| `src/world/terrain.ts` (`baueTerrain`, `baueGewaesser`, `baueGebaeude`, `baueWege`, `GROESSE`, `MASSSTAB`, `TerrainErgebnis`) | Import in `RegionsSzene.tsx`, `props.ts` | Neu bauen — Funktionssignaturen aus Aufrufstellen ableitbar |
| Kampf-Engine + 16 Tests | `START.md`: „16 Tests der Kampf-Engine" | Neu bauen |
| Kampf-UI | Chat: „Kampf-UI existiert, nicht mit der Szene verbunden" | Neu bauen |
| Inhalts-Schemas (Drift-Schutz) | `npm run validate` | Neu bauen |
| Qualitätstor `QUALITY.md` + `quality.mjs` (60-MB-Budget) | `START.md` | Neu bauen |
| Weltgenerator (`npm run world oental 96`) | `START.md` | Neu bauen — OSM + EU-DEM, ~2 min Laufzeit |
| `public/world/oental.json` (1,1 MB) | `START.md` | **Regenerierbar** über den Weltgenerator |
| Reduktionspipeline `reduce.mjs` | `START.md` | Neu bauen |
| Rigging `autorig.py` | `START.md` | Neu bauen |
| 23 Kenney-Prop-Modelle unter `public/props/` | `START.md` | **Neu herunterladen** — Kenney Nature Kit 2.1 (CC0) |
| `index.html`, `tsconfig.json` | Vite-Projekt | Trivial neu |

## Eingriffe in den geretteten Code

Genau **eine** Zeile wurde geändert, damit `tsc` durchläuft:
`RegionsSzene.tsx:207` — `Object.entries(VARIANTEN)` → `Object.values(VARIANTEN)`
(die Schlüsselvariable war ungenutzt). Sonst ist der Code verbatim.

**Versionen sind erschlossen, nicht überliefert.** `RegionsSzeneProps.spielerRef` ist als
`React.RefObject<THREE.Object3D | null>` typisiert — das ist React-19-Typisierung. Mit
React 18 + `@react-three/fiber` 8 schlägt `tsc` fehl, mit **React 19 +
`@react-three/fiber` 9 + `drei` 10** läuft es sauber durch. Die Versionen in
`package.json` sind so verifiziert, nicht geraten.

`tsconfig.json` steht bewusst nicht auf `noUncheckedIndexedAccess`/
`exactOptionalPropertyTypes` — der gerettete Code entstand gegen eine laxere
Konfiguration, und Fehler in nicht verifizierbarem Code helfen niemandem.
Nachziehen, sobald die fehlenden Module stehen.

## Konsequenz

Das Repo ist **nicht lauffähig**. `npm run dev` scheitert an den fehlenden
`world/osm.ts` und `world/terrain.ts`. Der gerettete Code ist wertvoll, weil er
die *Urteilsarbeit* enthält — Art-Direction-Werte, LOD-Schwellen, Prop-Dichten,
Maßstabsnormierung. Das sind die Zahlen, die durch Iteration entstanden sind und
sich nicht raten lassen. Die fehlenden Module sind dagegen Mechanik mit klarer
Schnittstelle: neu bauen ist realistischer als weiter aus dem Chat zu kratzen.

## Lektion (gilt ab sofort)

Arbeit an BRACHLAND läuft **in diesem Repo**, nicht in einer Chat-Sandbox.
Konkret: Claude Code im Repo-Ordner oder eine Cowork-Task „auf deinem Computer".
Eine Cloud-Sandbox verliert alles, was nicht als Datei herausgereicht wurde —
genau das ist hier passiert und hat mehrere Tage Arbeit gekostet.
