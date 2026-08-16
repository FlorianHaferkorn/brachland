---
last-reviewed: 2026-08-16
shelf-life-days: 90
owns: *.tscn, *.tres, *.gd, *.godot
---
# game — Godot-Projekt (_INDEX)

> Einstieg in das Godot-Projekt. **Die Godot-Projektwurzel ist dieser Ordner**, nicht
> das Repo-Root — jeder CLI-Aufruf braucht `--path game`. Warum diese Engine:
> `../docs/adr/0001-engine-godot-4.md`. Befehle: `../docs/TECH_STACK.md`.

| Feld | Wert |
|---|---|
| Engine | Godot 4.7.1 · Forward+ · Jolt |
| Sprache | GDScript (statisch typisiert) |
| Stand | 2026-08-16 — Gerüst, noch keine Spiellogik (Ledger G-1 offen) |

## „Lies-wenn"-Routing

| Deine Aufgabe ist … | Lies | NICHT nötig |
|---|---|---|
| Rendering, Physik, Warnstufen ändern | `project.godot` | Szenen |
| Beleuchtung, Environment, Kamera anfassen | `scenes/main.tscn` | `project.godot` |
| Neues Modell/Material/Audio einbinden | `../docs/ASSET_PIPELINE.md` | Szenen-Setup |
| Verstehen, warum hier noch keine Spiellogik steht | `../docs/GDD.md` | alles andere |

## Datei-Register (Drift-Gate erzwingt Vollständigkeit für `owns:`)

| Datei | Zweck |
|---|---|
| `project.godot` | Projekteinstellungen: Renderer Forward+, Jolt-Physik, GDScript-Warnstufen, Anti-Aliasing |
| `scenes/main.tscn` | Hauptszene und Qualitäts-Setup: AgX-Tonemapping, SSAO + SSIL, Volumetric Fog, Sonne mit Schatten, Boden-Plane, Kamera |

## Ordnerkonventionen

Noch leer. Namensschemata und Begründung: `../docs/ASSET_PIPELINE.md`.

- `scenes/` — Szenen, `snake_case.tscn`
- `scripts/` — GDScript, `snake_case.gd`, `class_name` in PascalCase
- `assets/models/` — importierte glTF, `snake_case.glb`
- `assets/materials/` — Materialien, `mat_<name>.tres`
- `assets/audio/` — `sfx_<name>.wav` (kurz), `mus_<name>.ogg` (Musik/Loops)
- `addons/` — Godot-Plugins. Bewusst leer: jede Abhängigkeit ist Wartungslast für
  eine Person und braucht eine Ledger-Entscheidung, bevor sie hereinkommt.

## Definition of Done (Szenen- oder Skriptänderung)

- **Input:** eine Änderung an `.tscn` / `.tres` / `.gd` / `project.godot`
- **Output:** `make check` grün — Projekt lädt headless, Import ohne Fehler
- **Fehlerfall:** `SCRIPT ERROR` oder `Parse Error` im Smoke-Test → Szene ist kaputt,
  nicht committen
- **Rollback:** `git checkout -- game/`, danach `make import` (Cache neu bauen)
