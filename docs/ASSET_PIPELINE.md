---
last-reviewed: 2026-08-16
shelf-life-days: 180
---
# Asset-Pipeline & Lizenz-Register

Entscheidung und Begründung: ADR-0002. Diese Datei ist der **Arbeitsablauf** plus das
**Lizenz-Register** — die Datei, die im Zweifel beweist, dass jedes Fremdasset legal drin ist.

## Ablauf für eigene Modelle

```
src-assets/<name>.blend        ← Quelle, in Blender bearbeitet (nicht im Godot-Projekt)
        │  Export: glTF 2.0 Binary (.glb)
        ▼
game/assets/models/<name>.glb  ← was Godot importiert
        │  godot --headless --path game --import
        ▼
game/.godot/imported/…         ← Cache, gitignored
```

**Warum `src-assets/` außerhalb von `game/`:** Godot scannt sein Projektverzeichnis
vollständig. `.blend`-Dateien dort lösen bei jedem Import einen Blender-Aufruf aus und
verlangsamen den Zyklus, ohne dass die Quelle im Spiel gebraucht wird.

**Export-Einstellungen (Blender → glTF 2.0):**

- Format **glTF Binary (.glb)** — eine Datei, keine Textur-Pfadbrüche
- **+Y Up** (Godot-Konvention)
- Nur *Selected Objects*, Modifier angewandt
- Kameras und Lichter **aus** — die gehören in die Godot-Szene, nicht ins Modell

## Namenskonventionen

| Ordner | Inhalt | Namensschema |
|---|---|---|
| `game/assets/models/` | `.glb`-Modelle | `snake_case.glb` |
| `game/assets/materials/` | `.tres`-Materialien | `mat_<name>.tres` |
| `game/assets/audio/` | `.ogg` (Musik/Loops), `.wav` (kurze SFX) | `sfx_<name>` / `mus_<name>` |
| `game/scenes/` | `.tscn` | `snake_case.tscn` |

## Werkzeuge (alle frei/OSS)

| Werkzeug | Zweck | Lizenz |
|---|---|---|
| Blender | Modelle, Rigs, Animation | GPL |
| Material Maker 1.4 | prozedurale Texturen, 3D-Painting (selbst in Godot gebaut) | MIT |
| Krita | Texturen, 2D, UI | GPL |
| Audacity | Audioschnitt | GPL |
| LMMS | Musik | GPL |

## Zugelassene Fremdquellen

Nur **CC0** oder gleichwertig ohne Attributions- und ohne NC-Klausel (ADR-0002).

| Quelle | Inhalt | Lizenz | Achtung |
|---|---|---|---|
| Poly Haven | HDRIs, Texturen, Modelle | CC0 | — |
| ambientCG | PBR-Materialien | CC0 | — |
| Kenney | Low-Poly-Kits, UI, SFX | CC0 | — |
| Quaternius | stilisierte Modellpacks | CC0 | pro Download auf der Seite gegenprüfen |
| Freesound | Audio | **gemischt** | nur CC0-Filter. CC-BY-NC ist verboten, CC-BY unerwünscht |

## Lizenz-Register (Nachweispflicht)

**Regel: kein Eintrag = das Asset gilt als unklar lizenziert und fliegt raus.**
Jedes Fremdasset bekommt hier eine Zeile, bevor es committet wird.

| Datei | Quelle (URL) | Lizenz | Heruntergeladen |
|---|---|---|---|
| *(noch keine Fremdassets im Repo)* | — | — | — |

## Offene Punkte

Werden im Ledger geführt (`docs/_INDEX.md`, Tabelle A) — hier nur der Pointer:

- **A-2:** Git-LFS-Schwelle für `.glb`/Texturen entscheiden, bevor die History aufgeht.
- **A-3:** Blender installieren und einen Roundtrip (Würfel → `.glb` → Godot-Szene)
  einmal durchspielen, bevor echte Modelle entstehen.
