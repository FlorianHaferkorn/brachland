---
last-reviewed: 2026-08-16
shelf-life-days: 90
owns: *.ts, *.tsx
---
# src — Quellcode (_INDEX)

> **Achtung: unvollständig.** Zwei importierte Module fehlen (`world/osm.ts`,
> `world/terrain.ts`) — das Projekt baut derzeit nicht. Warum: `../docs/RECOVERY.md`.
> Konventionen und Befehle: `../docs/TECH_STACK.md`.

## „Lies-wenn"-Routing

| Deine Aufgabe ist … | Lies | NICHT nötig |
|---|---|---|
| Licht, Nebel, Stimmung, Kamera ändern | `scenes/RegionsSzene.tsx` | world/ |
| Vegetationsdichte, Varianten, Modellgrößen ändern | `world/props.ts` | scenes/ |
| Terrain-Detail, LOD-Schwellen, Mikrorelief ändern | `world/lod.ts` | scenes/ |
| Weltdaten laden, Einstiegspunkt ändern | `main.tsx` | world/ |
| Die fehlenden Module nachbauen | `../docs/RECOVERY.md` → Importe in `props.ts` und `RegionsSzene.tsx` | — |

## Datei-Register (Drift-Gate erzwingt Vollständigkeit für `owns:`)

| Datei | Zweck |
|---|---|
| `main.tsx` | Einstiegspunkt. Lädt die Weltdaten, montiert `RegionsSzene`, schaltet Stimmungen |
| `scenes/RegionsSzene.tsx` | Art Direction als Code: 3 Stimmungen mit Nebel-, Sonnen- und Umgebungswerten; Props als `InstancedMesh`; Terrain-, Gewässer-, Gebäude- und Wege-Meshes |
| `world/props.ts` | Vegetation: deterministische Verteilung per Seed, Dichten je Biom, 4 Varianten je Art, Normierung auf reale Zielhöhen, Chunking |
| `world/lod.ts` | Terrain-Detail: 4 LOD-Stufen (2/4/8/16 m Vertexabstand), hangabhängiges Mikrorelief in 4 Oktaven (<1,2 m), Schürzen gegen Kachelrisse |
| `world/osm.ts` | **Stub.** Typen `Weltdaten`, `Biom`, `Linienzug` — Schnittstelle aus den Zugriffsstellen belegt, Ladefunktion wirft (Ledger B-1) |
| `world/terrain.ts` | **Stub.** `baueTerrain/-Gewaesser/-Gebaeude/-Wege`, `MASSSTAB`, `GROESSE`, `BIOM_FARBE`, `TerrainErgebnis` — alle Funktionen werfen (Ledger B-2) |

## Stubs — was daran echt ist

`world/osm.ts` und `world/terrain.ts` sind **Schnittstellen-Stubs**, keine Implementierung.
Echt daran ist die **Signatur**: jede ist aus einer konkreten Zugriffsstelle im geretteten
Code abgeleitet und im Dateikopf mit Zeilennummer belegt. Alle Funktionen werfen mit
Verweis auf `docs/RECOVERY.md` — nichts liefert stillschweigend Unsinn.

Nicht belegt und beim Nachbau festzulegen: die Zahlenwerte in `MASSSTAB`, `GROESSE` und
`BIOM_FARBE` sowie die Form der OSM-Geometriefelder (`wege`, `gewaesser`, `gebaeude`).
Sie sind als Platzhalter gesetzt, damit TypeScript durchläuft — **nicht** weil sie stimmen.

## Definition of Done (Code-Änderung)

- **Input:** Änderung an `.ts`/`.tsx`
- **Output:** `npm run typecheck` grün, `npm run test` grün, `make check` grün
- **Fehlerfall:** Typfehler oder roter Test → nicht committen; der pre-commit-Hook blockt
- **Rollback:** `git checkout -- src/`
