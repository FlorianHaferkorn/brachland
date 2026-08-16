# Single-Entry-Gate (claude-repo-kit). `make check` MUSS grün sein vor Commit/PR.
# Der pre-commit-Hook ruft dieses Target automatisch, sobald es existiert.
.PHONY: check check-index test roi-check import run editor export-linux clean help

PY := $(shell command -v python3 2>/dev/null || command -v python)
GODOT := $(shell command -v godot 2>/dev/null || command -v godot4)
GAME := game

help:   ## Verfügbare Targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n",$$1,$$2}'

# ── Gate ─────────────────────────────────────────────────────────────────
check: check-index test   ## Vollständiges Gate: Doku-Drift + Godot-Smoke-Tests
	@echo "✓ make check grün"

check-index:   ## Drift-Gate strict (blockt {{…}}-Stubs, tote Pfade, fehlende Register)
	@"$(PY)" scripts/check_index.py --strict

test:   ## Godot-Smoke-Tests headless (lädt das Projekt, prüft Import)
	@test -n "$(GODOT)" || { echo "✗ Godot fehlt im PATH — brew install --cask godot"; exit 1; }
	@"$(PY)" tests/test_project_loads.py

# ── Messung ──────────────────────────────────────────────────────────────
roi-check:   ## Läuft die OTel-Messung? Vor jeder Arbeitssession (ADR-0003)
	@"$(PY)" scripts/roi/check_otel.py

# ── Godot ────────────────────────────────────────────────────────────────
import:   ## Ressourcen-Cache bauen (nach frischem Clone / Asset-Änderungen Pflicht)
	@"$(GODOT)" --headless --path $(GAME) --import

run:   ## Spiel starten
	@"$(GODOT)" --path $(GAME)

editor:   ## Godot-Editor öffnen
	@"$(GODOT)" --editor --path $(GAME)

export-linux:   ## Release-Build (setzt ein konfiguriertes Export-Preset "Linux" voraus)
	@mkdir -p build
	@"$(GODOT)" --headless --path $(GAME) --export-release "Linux" ../build/game.x86_64

clean:   ## Import-Cache und Builds entfernen
	@rm -rf $(GAME)/.godot build
	@echo "✓ Cache und Builds entfernt — 'make import' baut neu"
