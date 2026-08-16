---
last-reviewed: 2026-08-16
shelf-life-days: 180
---
# Tech-Stack & Befehle

Warum kein Engine-Weg: ADR-0001. Diese Datei ist die operative Seite.

## Stack

| Baustein | Wahl | Anmerkung |
|---|---|---|
| Rendering | **three.js** über `@react-three/fiber` + `@react-three/drei` | deklarativ, alles Text |
| UI | React 18 | |
| Build | **Vite 5** + TypeScript | **nicht** auf Vite 8 heben, solange `@vitejs/plugin-react` gepinnt ist |
| Offline | `vite-plugin-pwa` (Workbox) | Precache inkl. `world/*.json` und `*.glb`, max. 8 MB je Datei |
| Tests | Vitest | Kampf-Engine, 16 Tests (fehlen im Repo — `RECOVERY.md`) |
| Hosting | Vercel | kein Backend, kein App-Store |

## Installation

```bash
npm install --legacy-peer-deps
```

`--legacy-peer-deps` ist **Pflicht**, nicht Kosmetik: `@vitejs/plugin-react` v6
verlangt Vite 8, das Projekt bleibt bei Vite 5. Ohne das Flag bricht die Installation ab.

## Befehle

```bash
npm run dev         # Vite mit host:true — die NETZWERK-Adresse aufs Handy, nicht localhost
npm run build       # tsc -b && vite build
npm run preview     # Produktionsbuild lokal prüfen

npm run typecheck   # tsc --noEmit
npm run test        # Vitest — Kampf-Engine
npm run validate    # Inhalte gegen Schema + Matrix-Selbsttest
npm run quality     # Qualitätstor (Blocker verhindern den Merge)
npm run lod         # LOD-Budget je Standort
npm run masstab     # Größenverhältnisse Spieler/Kreatur/Umgebung
npm run world oental 96   # Weltdaten neu erzeugen (~2 min, Höhendaten-API)

make check          # Doku-Drift-Gate + typecheck + test
make roi-check      # Läuft die OTel-Messung? Vor jeder Session (ADR-0003)
```

> **Wichtig:** Bis auf `dev`, `build`, `preview` und `typecheck` zeigen diese Skripte
> derzeit auf **fehlende Dateien** — siehe `RECOVERY.md`. Sie stehen bewusst schon in
> `package.json`, damit die Zielschnittstelle festliegt.

## Der Test ist das Handy

`npm run dev` gibt eine Netzwerk-Adresse aus (`server.host = true`). **Die auf dem
Handy im selben WLAN öffnen.** Der Laptop ist kein Test: Das Projekt ist eine
Handy-PWA, und Beleuchtung, Nebel und Performance beurteilen sich nur auf dem
Zielgerät. Standbilder aus einem Software-Renderer taugen dafür nachweislich nicht —
diese Lektion hat das Projekt mehrere Runden gekostet.

## Konventionen

- **Deutsch als Code-Sprache.** `baueTerrain`, `verteileProps`, `STIMMUNG`, `ZIELHOEHE`,
  `Weltdaten`, `PropArt`. Durchgehend, auch in Kommentaren. Nicht mischen.
- **ESM-Imports mit `.js`-Endung** auf TS-Quellen (`from './world/osm.js'`) — Vorgabe
  von `moduleResolution: bundler` bei `type: module`.
- **Keine Texturen.** Vertex-Farben und Geometrie. Das ist Art Direction, keine Sparmaßnahme.
- **Instancing ist Pflicht.** 40.000 Bäume als Einzelobjekte erledigen jedes Handy;
  als `InstancedMesh` sind es eine Handvoll Draw Calls.
- **Determinismus über Seed.** Prop-Positionen werden nicht gespeichert, sondern aus
  einem Seed erzeugt — ~40.000 Props als JSON wären mehrere Megabyte, der Seed ist eine Zahl.

## Budget (gemessen, nicht geschätzt — Stand 16.08.2026)

```
dist/assets/index.js   968 kB  (269 kB gzip)
Service-Worker-Cache   2,18 MB inkl. Weltdaten und Props
Obergrenze             60 MB   (QUALITY.md)
```

Auch mit 200 Kreaturen (~16 MB) bleibt Luft. Das Budget ist ein Gate, kein Richtwert.
