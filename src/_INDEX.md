---
last-reviewed: 2026-08-16
shelf-life-days: 90
owns: *.ts, *.tsx
---
# src — Quellcode (_INDEX)

> Konventionen und Befehle: `../docs/TECH_STACK.md`. Die 3D-Schicht und die Kampf-Engine
> sind **entkoppelt** — `engine/` kennt kein three.js und ist deshalb ohne Renderer testbar.
> Genau daran hängen die 16 Tests.

## „Lies-wenn"-Routing

| Deine Aufgabe ist … | Lies | NICHT nötig |
|---|---|---|
| Licht, Nebel, Stimmung, Kamera ändern | `scenes/RegionsSzene.tsx` | world/, engine/ |
| Vegetationsdichte, Varianten, Modellgrößen | `world/props.ts` | scenes/, engine/ |
| Bodendecker direkt um den Spieler | `world/streuung.ts` | props.ts |
| Oberfläche des Bodens, Rauschen, Farbvariation | `world/bodenmaterial.ts` | lod.ts |
| Terrain-Detail, LOD-Schwellen, Mikrorelief | `world/lod.ts` | scenes/, engine/ |
| Terrain-, Gewässer-, Gebäude-, Wege-Geometrie | `world/terrain.ts` | engine/, ui/ |
| OSM/DEM laden, Spawns, Weltdatentypen | `world/osm.ts` | scenes/, engine/ |
| Kampflogik, Schaden, Fokus, Wechsel | `engine/battle.ts` → `data/schema.ts` | world/, scenes/ |
| Kampf-UI, Buttons, Anzeige | `ui/BattleScreen.tsx` | world/ |
| Kreatur-, Move-, Regionsformat ändern | `data/schema.ts` | world/, scenes/ |
| Einstiegspunkt, Weltdaten laden | `main.tsx` | — |
| Steuerung anfassen (Tasten, Touch, Empfindlichkeit) | `spieler/steuerung.ts` | world/, engine/ |
| Aussehen der Spielerfigur | `spieler/figur.ts` | world/ |
| Wogegen man läuft | `spieler/kollision.ts` | scenes/ |

## Datei-Register (Drift-Gate erzwingt Vollständigkeit für `owns:`)

| Datei | Zweck |
|---|---|
| `main.tsx` | Einstiegspunkt. Lädt die Weltdaten, montiert `RegionsSzene`, schaltet Stimmungen |
| `data/schema.ts` | Zod-Schemas für Kreatur, Move, Region **plus Elementmatrix** — der Drift-Schutz. `npm run validate` prüft alle Inhalte dagegen |
| `engine/battle.ts` | Kampflogik ohne 3D: Schaden, Elementfaktor, Fokus-Ökonomie, Phasen, Zehrung, deterministischer RNG |
| `ui/BattleScreen.tsx` | Kampfoberfläche. Noch **nicht** mit der Szene verbunden (Ledger G-5) |
| `scenes/RegionsSzene.tsx` | Art Direction als Code: 3 Stimmungen mit Nebel-, Sonnen- und Umgebungswerten; Props als `InstancedMesh` |
| `world/osm.ts` | OSM- und EU-DEM-Abruf, Weltdatentypen (`Weltdaten`, `Biom`), Biom-Ableitung, Spawn-Zonen |
| `world/terrain.ts` | Terrain-Mesh mit Vertex-Farben, Gewässer, Gebäude mit Dächern, Wege; `MASSSTAB`, `GROESSE`, `BIOM_FARBE` |
| `world/props.ts` | Vegetation: deterministische Verteilung per Seed, Dichten je Biom, 4 Varianten je Art, Normierung auf reale Zielhöhen, Chunking |
| `world/lod.ts` | Terrain-Detail: 4 LOD-Stufen (2/4/8/16 m), hangabhängiges Mikrorelief in 4 Oktaven (<1,2 m), Schürzen gegen Kachelrisse |
| `world/bodenmaterial.ts` | Bodenmaterial mit prozeduraler Oberflächenvariation im Shader — zwei Oktaven Rauschen aus der Weltposition, null Bytes Textur |
| `world/streuung.ts` | Nahfeld-Streuschicht: deterministische Bodendecker im 28-m-Umkreis, beim Gehen nachgezogen. Antwort auf „0 Props im 10-m-Umkreis" |
| `spieler/steuerung.ts` | Eingabe für Bewegung und Blick. Touch (linke Bildhälfte gehen, rechte umsehen) **und** Tastatur/Maus. Zustand im Ref statt im State — 60 Re-Renders je Sekunde wären sinnlos |
| `spieler/figur.ts` | Spielerfigur als Platzhalter, 1,8 m. **Größenreferenz**, kein Charakterdesign — monochrom, unter 300 Dreiecke |
| `spieler/kollision.ts` | Kreis-Kollision gegen Stämme, Findlinge und Totholz über ein Raster. Büsche und Gras bleiben durchlässig |

## Was hier NICHT liegt

Werkzeuge (`buildworld`, `quality`, `validate`, Asset-Kette) liegen in `../tools/`,
Inhalte in `../content/`, Modelle in `../assets/`. Tests in `../tests/`.

## Definition of Done (Code-Änderung)

- **Input:** Änderung an `.ts`/`.tsx`
- **Output:** `npm run typecheck` sauber, `npm run test` 16/16, `make check` grün
- **Fehlerfall:** Typfehler oder roter Test → nicht committen; der pre-commit-Hook blockt
- **Rollback:** `git checkout -- src/`
