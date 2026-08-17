# Single-Entry-Gate (claude-repo-kit). `make check` MUSS grün sein vor Commit/PR.
# Der pre-commit-Hook ruft dieses Target automatisch.
.PHONY: check check-index test typecheck validate quality roi-check install dev build preview help

PY := $(shell command -v python3 2>/dev/null || command -v python)

help:   ## Verfügbare Targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-12s\033[0m %s\n",$$1,$$2}'

# ── Gate ─────────────────────────────────────────────────────────────────
# `quality` ist seit 17.08.2026 Teil des Gates. Es stand jahrelang daneben, weil es
# offene Blocker hatte (A-6: sechs GLB über dem Budget) — ein Tor, das immer rot
# ist, prüft nichts, es gewöhnt einen nur an Rot. Mit A-6 erledigt steht es auf
# 0 Blockern, und ab da ist Danebenstehen keine Schonung mehr, sondern eine Lücke.
check: check-index typecheck test validate quality   ## Vollständiges Gate vor jedem Commit
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

quality:   ## Qualitätstor — Kreatur-, Regions-, Balance- und Asset-Budgets
	@test -d node_modules || { echo "⏭  node_modules fehlt — 'make install' zuerst (übersprungen)"; exit 0; }
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
