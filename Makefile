# Single-Entry-Gate (claude-repo-kit). `make check` MUSS grün sein vor Commit/PR.
# Der pre-commit-Hook ruft dieses Target automatisch.
.PHONY: check check-index test typecheck validate quality roi-check install dev build preview help

PY := $(shell command -v python3 2>/dev/null || command -v python)

help:   ## Verfügbare Targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-12s\033[0m %s\n",$$1,$$2}'

# ── Gate ─────────────────────────────────────────────────────────────────
check: check-index typecheck test validate   ## Vollständiges Gate vor jedem Commit
	@echo "✓ make check grün"

check-index:   ## Doku-Drift-Gate strict (blockt {{…}}-Stubs, tote Pfade, fehlende Register)
	@"$(PY)" scripts/check_index.py --strict

typecheck:   ## TypeScript über alles
	@test -d node_modules || { echo "⏭  node_modules fehlt — 'make install' zuerst (übersprungen)"; exit 0; }
	@npm run --silent typecheck

test:   ## Alle Tests — Kampf, Peilung, Fortschritt, Ausdauer, Auftraege
	@test -d node_modules || { echo "⏭  node_modules fehlt — 'make install' zuerst (übersprungen)"; exit 0; }
	@npm run --silent test

validate:   ## Inhalte gegen Schema + Elementmatrix-Selbsttest
	@test -d node_modules || { echo "⏭  node_modules fehlt — 'make install' zuerst (übersprungen)"; exit 0; }
	@npm run --silent validate

quality:   ## Qualitätstor — Budgets und Blocker (NICHT Teil von `make check`: hat offene Blocker, Ledger A-6)
	@npm run --silent quality

# ── Messung ──────────────────────────────────────────────────────────────
roi-check:   ## Läuft die OTel-Messung? Vor jeder Arbeitssession (ADR-0003)
	@"$(PY)" scripts/roi/check_otel.py

# ── Entwicklung ──────────────────────────────────────────────────────────
install:   ## Abhängigkeiten (--legacy-peer-deps ist Pflicht, siehe docs/TECH_STACK.md)
	@npm install --legacy-peer-deps

dev:   ## Vite starten — die NETZWERK-Adresse aufs Handy, nicht localhost
	@npm run dev

build:   ## Produktionsbuild
	@npm run build

preview:   ## Produktionsbuild lokal prüfen
	@npm run preview
