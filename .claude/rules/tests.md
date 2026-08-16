---
paths: ["tests/**"]
---
# Tests — Stack-Regeln (tests/, pfadgebunden — lädt nur hier)

### Headless und zero-dependency
Tests laufen über `godot --headless` und reine stdlib — identisch lokal und in CI,
ohne GUI, ohne venv. Ein Test, der einen Editor braucht, läuft in CI nie.

### Standalone **und** pytest-kompatibel
Funktionen heißen `test_*`, zusätzlich gibt es einen `main()`-Runner. So funktioniert
`python3 tests/test_project_loads.py` ohne Installation, und pytest greift trotzdem,
falls es später dazukommt.

### Was hier getestet wird
Die Fehlerklasse, die bei textbasierten Szenen am teuersten ist: eine kaputte `.tscn`
fällt sonst erst Tage später beim Öffnen des Editors auf. Smoke-Tests fangen das im
Commit. Spiellogik-Tests kommen dazu, sobald es Spiellogik gibt (Ledger G-2).

### Assertions mit Diagnose
`assert cond, f"..."` immer mit der tatsächlichen Godot-Ausgabe im Meldungstext —
ein nacktes `AssertionError` in CI kostet einen ganzen Debug-Zyklus.
