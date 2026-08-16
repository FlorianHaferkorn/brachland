#!/usr/bin/env python3
"""Smoke-Tests: lädt das Godot-Projekt überhaupt, und ist es konsistent?

Zero-Dependency (nur stdlib) und ohne GUI — läuft identisch lokal und in CI.
Standalone startbar (`python3 tests/test_project_loads.py`) und pytest-kompatibel.

Deckt die Fehlerklasse ab, die bei textbasierten Szenen am teuersten ist: eine
kaputte .tscn fällt sonst erst beim Öffnen des Editors auf — oft Tage später.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
GAME = REPO / "game"
TIMEOUT_S = 180


def _godot() -> str:
    exe = shutil.which("godot") or shutil.which("godot4")
    if not exe:
        raise RuntimeError("Godot nicht im PATH — 'brew install --cask godot'")
    return exe


def _run(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [_godot(), "--headless", "--path", str(GAME), *args],
        capture_output=True,
        text=True,
        timeout=TIMEOUT_S,
        check=False,
    )


def test_project_file_exists() -> None:
    assert (GAME / "project.godot").is_file(), "game/project.godot fehlt"


def test_main_scene_is_declared_and_present() -> None:
    cfg = (GAME / "project.godot").read_text(encoding="utf-8")
    line = next((ln for ln in cfg.splitlines() if ln.startswith("run/main_scene=")), None)
    assert line, "run/main_scene ist in project.godot nicht gesetzt"
    rel = line.split("=", 1)[1].strip().strip('"').removeprefix("res://")
    assert (GAME / rel).is_file(), f"Hauptszene {rel} existiert nicht"


def test_project_imports_without_errors() -> None:
    """--import baut den Ressourcen-Cache. Fängt kaputte .tscn/.tres/.glb ab."""
    proc = _run("--import")
    combined = proc.stdout + proc.stderr
    assert proc.returncode == 0, f"Import fehlgeschlagen (exit {proc.returncode}):\n{combined}"
    for marker in ("SCRIPT ERROR", "ERROR: Failed", "Parse Error", "Cannot open file"):
        assert marker not in combined, f"Import meldete '{marker}':\n{combined}"


def test_project_opens_headless() -> None:
    """--quit lädt das Projekt und beendet sofort. Der eigentliche Smoke-Test."""
    proc = _run("--quit")
    combined = proc.stdout + proc.stderr
    assert proc.returncode == 0, f"Projekt lädt nicht (exit {proc.returncode}):\n{combined}"
    assert "SCRIPT ERROR" not in combined, f"Skriptfehler beim Laden:\n{combined}"


def main() -> int:
    tests = [fn for name, fn in sorted(globals().items()) if name.startswith("test_")]
    failed = 0
    for fn in tests:
        try:
            fn()
        except Exception as exc:  # noqa: BLE001 — Testrunner soll alles fangen
            print(f"  \033[31mFAIL\033[0m {fn.__name__}\n       {exc}")
            failed += 1
        else:
            print(f"  \033[32mOK\033[0m   {fn.__name__}")
    print(f"\n{len(tests) - failed}/{len(tests)} Godot-Smoke-Tests grün")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
