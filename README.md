# BRACHLAND

3D-Creature-Collector mit Story, als installierbare **offline-PWA** — spielbar auf dem
Handy im Flugmodus. Die Welt ist eine **reale Alpenregion (Œntal)**, erzeugt aus
OpenStreetMap + EU-DEM, im 1:1-Maßstab. Kreaturen: Alpen-Fauna mit Biotech-Anbauten.

**Stack:** three.js · React · Vite 5 · TypeScript — Begründung: `docs/adr/0001-three-js-pwa-statt-engine.md`

> ## ⚠️ Das Repo baut derzeit nicht
> BRACHLAND entstand vom 13.–16.08.2026 in einer Chat-Sandbox, die es nicht mehr gibt.
> Gerettet ist nur, was als Datei herausgereicht wurde — **`src/world/osm.ts` und
> `src/world/terrain.ts` fehlen.** Vollständige Bilanz: **[`docs/RECOVERY.md`](docs/RECOVERY.md)**.

## Was gerettet ist

| Datei | Inhalt |
|---|---|
| `src/scenes/RegionsSzene.tsx` | Art Direction: 3 Stimmungen, Nebel- und Lichtwerte, Props als `InstancedMesh` |
| `src/world/props.ts` | Deterministische Vegetation per Seed, Dichten je Biom, Maßstabsnormierung |
| `src/world/lod.ts` | 4 LOD-Stufen, hangabhängiges Mikrorelief, Schürzen gegen Kachelrisse |
| `src/main.tsx`, `vite.config.ts` | Einstiegspunkt und PWA-/Offline-Setup |
| `docs/START.md` | Projektstand und gemessene Kennzahlen aus dem Chat |

Das ist der wertvolle Teil: die **erarbeiteten Zahlen** — Nebeldistanzen, LOD-Schwellen,
Prop-Dichten, Zielhöhen. Die fehlenden Module sind Mechanik mit klarer Schnittstelle.

## Loslegen

```bash
make install     # npm install --legacy-peer-deps (Flag ist Pflicht, siehe docs/TECH_STACK.md)
make dev         # Vite — die NETZWERK-Adresse aufs Handy, nicht localhost
```

## Vor jedem Commit / vor jeder Session

```bash
make check       # Doku-Drift-Gate + typecheck + test
make roi-check   # Läuft die OTel-Messung? Ungemessene Zeit ist dauerhaft verloren
```

## Navigation

Dieses Repo wird über `_INDEX.md`-Dateien navigiert, nicht durch Volltext-Scan:

| Einstieg | Wofür |
|---|---|
| `CLAUDE.md` | Arbeitsregeln — Pflicht-Erstkontakt für Agenten |
| `docs/RECOVERY.md` | **Zuerst:** was fehlt und warum |
| `docs/_INDEX.md` | L0-Navigation aller Docs **+ Ledger** (offene Punkte, Entscheidungen) |
| `docs/GDD.md` | Was BRACHLAND ist: Welt, Kreaturen, Art Direction, Stand |
| `docs/TECH_STACK.md` | Stack, Befehle, Konventionen, Budget |
| `src/_INDEX.md` | Quellcode-Struktur und die fehlenden Module |

## Struktur

```
src/
  main.tsx          Einstiegspunkt
  scenes/           Szenen — Art Direction lebt hier
  world/            Terrain, Props, LOD  (osm.ts + terrain.ts FEHLEN)
  engine/           Kampf-Engine (fehlt)
public/world/       Weltdaten als JSON  (oental.json fehlt, regenerierbar)
docs/               Doku, ADRs, Ledger
scripts/            Gate + ROI-Checks (zero-dependency Python)
```
