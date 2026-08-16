---
paths: ["game/**"]
---
# Godot 4.7 / GDScript — Stack-Regeln (game/, pfadgebunden — lädt nur hier)

### Projektwurzel
Godot-Root ist `game/`, nicht das Repo-Root. Jeder CLI-Aufruf braucht `--path game`.
`game/.godot/` ist Cache und gitignored — nach frischem Clone einmal `make import`.

### GDScript
- Statisch typisieren: `var speed: float = 5.0`, `func hit(dmg: int) -> void:`.
  `project.godot` meldet untypisierte Deklarationen als Warnung.
- **Tabs**, keine Spaces (Godot-Styleguide, erzwungen via `.editorconfig`).
- Node-Zugriff über `@onready var x: Node3D = %UniqueName` — keine Pfad-Strings
  wie `$"../../Foo"`, die bei jeder Umbenennung brechen.
- `class_name` für alles, was mehr als einmal instanziiert wird.

### Szenen sind Reviewgegenstand
`.tscn`/`.tres` sind Text und werden gelesen wie Code — das ist der Grund für die
Engine-Wahl (ADR-0001). Diffs, die nur `uid://` ändern, sind Import-Rauschen.

### Assets
Nur über den Pfad in `docs/ASSET_PIPELINE.md`: Blender → glTF 2.0 (`.glb`) →
`game/assets/models/`. Fremdassets nur CC0 **und** mit Zeile im Lizenz-Register.

### Nach jeder Änderung
```bash
make check     # Smoke-Test lädt das Projekt headless — fängt kaputte .tscn sofort
```
