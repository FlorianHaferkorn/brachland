# BRACHLAND

> **Stand 16.08.2026:** Das Projekt entstand in einer Chat-Sandbox, die es nicht mehr
> gibt, und wurde an diesem Tag vollständig rekonstruiert. Verifiziert: `tsc` sauber,
> 16 Engine-Tests grün, Schema-Validierung bestanden, Build läuft.
> Was fehlt und was offen ist: [`docs/RECOVERY.md`](docs/RECOVERY.md).
>
> **Arbeit läuft in diesem Repo, nie in einer Chat-Sandbox.** Was nicht auf der Platte
> liegt, existiert nicht.

3D-Creature-Collector-RPG auf realer bayerischer Geographie. Offline-PWA, regionsweise
erweiterbar. Erste Region: Œntal (Inntal-Süd).

## Struktur

```
src/
  data/schema.ts      Zod-Schemas + Elementmatrix  ← der Drift-Schutz
  engine/             Kampflogik, Fokus, Wechsel (ohne 3D, testbar)
  world/              OSM/DEM-Pipeline, Terrain, Spawns
  scenes/             R3F-Szenen
  ui/                 Kampf-UI, Menüs, Kreaturen-Ansicht
content/
  creatures/*.json    validiert gegen Kreatur-Schema
  moves/*.json        validiert gegen Move-Schema
  regions/*.json      Kartenausschnitt, Regent, Konzentrate
assets/
  rigs/               Archetyp-Rigs mit Animationen
  creatures/          fertige, reduzierte, geriggte GLB
tools/                reduce.mjs, autorig.py, batch.mjs, osm-fetch
```

## Befehle

```bash
npm run dev         # Vite-Dev-Server
npm run validate    # alle Inhalte gegen Schema prüfen + Matrix-Selbsttest
npm run assets      # Roh-GLB → reduziert → geriggt
npm run build       # PWA-Build
```

`npm run validate` läuft in CI und blockt den Merge — Inhalte, die dem Schema
widersprechen, kommen nicht ins Repo.

## Design-Dokumente

Verbindliche Quelle für alles, was gebaut wird:

- `docs/Story-Bibel.md`
- `docs/Kampfsystem_v2.4.md`
- `docs/Move-System_v1.1.md`
- `docs/Roster_Kapitel1.md`
- `docs/Roster-Struktur.md`
- `docs/Asset-Workflow.md`
- `ROADMAP.md` — Meilensteine und Abnahmekriterien

## Stand

Konzept abgeschlossen. Asset-Pipeline verifiziert (Reduktion an echten Modellen,
OSM/DEM an echten Daten). Rigging-Skript geschrieben, noch nicht ausgeführt.
Nächster Schritt: M0.

## Navigation

Dieses Repo wird über `_INDEX.md`-Dateien navigiert, nicht durch Volltext-Scan:

| Einstieg | Wofür |
|---|---|
| `CLAUDE.md` | Arbeitsregeln — Pflicht-Erstkontakt für Agenten |
| `docs/_INDEX.md` | L0-Navigation aller Docs **+ Ledger** (offene Punkte, Entscheidungen) |
| `docs/design/_INDEX.md` | Die verbindlichen Design-Dokumente |
| `src/_INDEX.md` · `tools/_INDEX.md` · `content/_INDEX.md` · `assets/_INDEX.md` · `public/_INDEX.md` | Bereichsnavigation |

## Vor jedem Commit / jeder Session

```bash
make check       # Doku-Drift-Gate + typecheck + Tests + Schema-Validierung
make roi-check   # Läuft die OTel-Messung? Ungemessene Zeit ist dauerhaft verloren
```
