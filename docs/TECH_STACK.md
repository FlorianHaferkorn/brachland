---
last-reviewed: 2026-08-16
shelf-life-days: 180
---
# Tech-Stack & Qualitätshebel

Warum Godot: ADR-0001. Diese Datei ist die **operative** Seite — was installiert ist,
welche Befehle gelten, und wo bei 3D-Qualität der größte Hebel pro Stunde liegt.

## Installiert (Stand 16.08.2026)

| Werkzeug | Version | Lizenz | Bezug |
|---|---|---|---|
| Godot | 4.7.1 | MIT | `brew install --cask godot` → `/opt/homebrew/bin/godot` |
| Python | 3.12.2 | PSF | System (Gate + Skripte, zero-dependency) |
| Git | 2.50.1 | GPL | System |

**Noch nicht installiert, vor dem ersten Asset fällig:** Blender (`brew install --cask blender`),
Material Maker, Krita, Audacity. Begründung und Rollen: `ASSET_PIPELINE.md`.

## Befehle

```bash
make check        # Gate: Drift-Index (strict) + Godot-Projekt-Smoke-Test. MUSS grün sein vor Commit.
make roi-check    # Läuft die OTel-Messung? Vor jeder Arbeitssession (ADR-0003).
make run          # Spiel im Editor-Runtime starten
make editor       # Godot-Editor auf game/ öffnen
make import       # Assets headless re-importieren (nach Asset-Änderungen)
```

Godot direkt (alles headless-fähig — das ist der Grund für die Engine-Wahl):

```bash
godot --headless --path game --import          # Import-Cache neu bauen
godot --headless --path game --quit            # Smoke-Test: lädt das Projekt?
godot --headless --path game --script res://... # Skript ohne GUI ausführen
godot --headless --path game --export-release "Linux" build/game.x86_64
```

## Projektkonventionen

- **GDScript ist getypt.** `project.godot` setzt `untyped_declaration`,
  `unsafe_property_access` und `unsafe_method_access` auf Warnung. Untypisierter Code
  ist damit sichtbar, nicht verboten — bei `class_name`-Typen konsequent annotieren.
- **Tabs, keine Spaces** in `.gd` (Godot-Styleguide, erzwungen über `.editorconfig`).
  Spaces werden beim Re-Save der Engine zurückgesetzt und erzeugen Diff-Rauschen.
- **Szenen sind Text.** `.tscn`/`.tres` gehören in den Review wie Code. Ein Diff, der
  nur `uid://`-Zeilen ändert, ist Import-Rauschen und kann verworfen werden.
- **`game/.godot/` ist Cache** und gitignored. Nach einem frischen Clone einmal
  `make import`, sonst startet nichts.

## 3D-Qualitätshebel — Reihenfolge nach Wirkung pro Stunde

1. **Art-Direction festlegen (stilisiert statt photoreal).** Mit Abstand der größte
   Hebel — senkt den Asset-Aufwand um eine Größenordnung und ist der einzige Punkt,
   der Godots Renderer-Rückstand gegenüber Unreal irrelevant macht.
2. **Beleuchtung: LightmapGI für statische Szenen**, nicht SDFGI. Gebackene GI sieht
   besser aus *und* läuft schneller. SDFGI nur bei dynamischer oder offener Geometrie.
3. **Environment: HDRI-Sky + AgX-Tonemapper + Glow.** Macht aus flachen Szenen sofort
   stimmige Bilder. In `game/scenes/main.tscn` bereits vorkonfiguriert
   (`tonemap_mode = 4` = AgX).
4. **Volumetric Fog + SSIL/SSAO.** Tiefenstaffelung und Kontaktschatten — wenige
   Parameter, hohe Wirkung. Ebenfalls in `main.tscn` aktiviert.
5. **Godot-4.6/4.7-Neuerungen mitnehmen:** überarbeitete SSR und oktaedrische
   Reflection Probes (4.6), `AreaLight3D` und HDR-Output (4.7).

## Bewusst nicht im Stack

- **C#/.NET** — Godots Mono-Build ist möglich, verdoppelt aber die Toolchain ohne
  Gegenwert bei diesem Scope. GDScript reicht; für heiße Pfade steht GDExtension (C++)
  offen, wird aber erst bei *gemessenem* Bedarf gezogen.
- **Git-LFS** — noch nicht eingerichtet. Offener Punkt A-2 im Ledger.
- **Asset-Store-Plugins** — jede Abhängigkeit ist Wartungslast für eine Person.
  Erst bei konkretem Bedarf, dann als Ledger-Entscheidung.
