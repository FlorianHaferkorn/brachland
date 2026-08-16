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
| Tests | `tsx tests/battle.test.ts` | Kampf-Engine, 16 Tests, renderfrei — kein Vitest nötig |
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
npm run test        # Kampf-Engine, 16 Tests
npm run validate    # Inhalte gegen Schema + Elementmatrix-Selbsttest
npm run quality     # Qualitätstor — Budgets, Blocker verhindern den Merge
npm run world oental 96   # Weltdaten erzeugen (~2 min, OSM + Höhendaten-API)
npm run assets      # Roh-GLB → reduziert → geriggt

make check          # Drift-Gate + typecheck + Tests + Validierung
make quality        # Budgets separat — hat offene Blocker (Ledger A-6)
make roi-check      # Läuft die OTel-Messung? Vor jeder Session (ADR-0003)
```

> **Ausnahme:** `npm run lod`, `masstab` und `szene` zeigen auf fehlende Mess-Werkzeuge
> (Ledger B-8). Alles andere läuft.

## Einmalig: Firewall-Freigabe für node

Homebrew-node ist nur **adhoc-signiert**. Die macOS-Firewall lässt automatisch nur
ordentlich signierte Software durch — ohne Freigabe blockt sie eingehende Verbindungen
auf Port 5173, und das Handy erreicht den Dev-Server nicht (der Mac erreicht dann nicht
einmal seine eigene Netzwerkadresse; `localhost` funktioniert weiter, was die Diagnose
verschleiert).

```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add \
  "$(readlink -f "$(which node)")"
```

**Der Cellar-Pfad muss es sein**, nicht der Symlink `/opt/homebrew/bin/node` — die
Firewall trägt sonst den falschen Eintrag ein. Prüfen mit:

```bash
/usr/libexec/ApplicationFirewall/socketfilterfw --listapps | grep -A1 node
curl -s -o /dev/null -w "%{http_code}\n" http://<deine-IP>:5173/
```

> **Achtung bei node-Updates:** Die Freigabe hängt an der exakten Version im Pfad
> (`.../node@22/22.22.3/bin/node`). Nach einem Homebrew-Upgrade zeigt sie ins Leere und
> muss neu gesetzt werden. Symptom ist identisch: localhost geht, das Handy nicht.

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
Service-Worker-Cache   1.096 KiB (4 Einträge, ohne Weltdaten und Props)
Kreatur-Modell         120 KB je Stufe — derzeit gerissen (163 KB, Ledger A-6)
Obergrenze gesamt      60 MB   (docs/QUALITY.md)
```

Auch mit 200 Kreaturen (~16 MB) bleibt Luft. Das Budget ist ein Gate, kein Richtwert.
