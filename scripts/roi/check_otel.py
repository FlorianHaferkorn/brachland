#!/usr/bin/env python3
"""Fail-Fast-Check: Wird diese Arbeitssession überhaupt gemessen?

Hintergrund: OTel exportiert nur ab Einschaltzeitpunkt — es gibt kein Replay
(ROI-Analyzer ADR-0019 §1). Eine Session bei totem Collector ist dauerhaft
ungemessen. Deshalb VOR der Arbeit prüfen, nicht danach.

Prüft drei Dinge:
  1. Collector lauscht auf 127.0.0.1:4318
  2. CLAUDE_CODE_ENABLE_TELEMETRY ist in ~/.claude/settings.json aktiv
  3. Das OTel-Archiv wurde kürzlich geschrieben

Exit 0 = alles gut · Exit 1 = Messung ist unterbrochen
Zero-Dependency (nur stdlib), damit es ohne venv im pre-commit/CI läuft.
"""

from __future__ import annotations

import json
import socket
import sys
import time
from pathlib import Path

OTEL_HOST = "127.0.0.1"
OTEL_PORT = 4318
SETTINGS = Path.home() / ".claude" / "settings.json"
ARCHIVE = Path.home() / "roi-archive" / "fh" / "otel" / "claude-code.jsonl"
STALE_AFTER_MIN = 120


def _ok(msg: str) -> None:
    print(f"  \033[32mOK\033[0m   {msg}")


def _fail(msg: str, hint: str) -> None:
    print(f"  \033[31mFAIL\033[0m {msg}\n       → {hint}")


def check_port() -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(2.0)
        if sock.connect_ex((OTEL_HOST, OTEL_PORT)) == 0:
            _ok(f"Collector lauscht auf {OTEL_HOST}:{OTEL_PORT}")
            return True
    _fail(
        f"Kein Listener auf {OTEL_HOST}:{OTEL_PORT}",
        "otelcol-contrib --config ~/roi/otel-collector.yaml starten",
    )
    return False


def check_env() -> bool:
    if not SETTINGS.is_file():
        _fail(f"{SETTINGS} fehlt", "Telemetrie-Env dort unter 'env' eintragen")
        return False
    try:
        env = json.loads(SETTINGS.read_text(encoding="utf-8")).get("env", {})
    except json.JSONDecodeError as exc:
        _fail(f"{SETTINGS} ist kein gültiges JSON ({exc})", "Datei reparieren")
        return False

    missing = [
        key
        for key, want in (
            ("CLAUDE_CODE_ENABLE_TELEMETRY", "1"),
            ("OTEL_METRICS_EXPORTER", "otlp"),
            ("OTEL_LOGS_EXPORTER", "otlp"),
        )
        if env.get(key) != want
    ]
    if missing:
        _fail(f"Telemetrie-Env unvollständig: {', '.join(missing)}", f"in {SETTINGS} setzen")
        return False
    _ok("Telemetrie-Env aktiv (CLAUDE_CODE_ENABLE_TELEMETRY=1)")
    return True


def check_archive() -> bool:
    if not ARCHIVE.is_file():
        _fail(f"{ARCHIVE} fehlt", "Collector schreibt nicht — Config/Exporter-Pfad prüfen")
        return False
    age_min = (time.time() - ARCHIVE.stat().st_mtime) / 60
    size_mb = ARCHIVE.stat().st_size / 1_048_576
    if age_min > STALE_AFTER_MIN:
        _fail(
            f"Archiv seit {age_min:.0f} min unverändert ({size_mb:.1f} MB)",
            "Collector läuft evtl. ins Leere — Log prüfen: ~/roi/otel-collector.log",
        )
        return False
    _ok(f"Archiv frisch (vor {age_min:.0f} min geschrieben, {size_mb:.1f} MB)")
    return True


def main() -> int:
    print("ROI-Messung — Fail-Fast-Check (ADR-0003)")
    results = [check_port(), check_env(), check_archive()]
    if all(results):
        print("\n\033[32m✓ Diese Session wird gemessen.\033[0m")
        return 0
    print(
        "\n\033[31m✗ Die Messung ist unterbrochen. Was jetzt ungemessen läuft,\n"
        "  ist dauerhaft verloren (kein Replay, ADR-0019 §1).\033[0m"
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
