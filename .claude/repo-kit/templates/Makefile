# claude-repo-kit — Single-Entry-Gate. `make check` MUSS grün sein vor Commit/PR.
# Für Make-Repos: diese Datei ins Repo-Root übernehmen (JS-Repos: stattdessen ein
# npm-"check"-Script). Eigene Prüfungen ans check-Target hängen, z. B.:
#   check: check-index test lint
.PHONY: check check-index

# Alle Gates dieses Repos (eigene Targets hier ergänzen):
check: check-index
	@echo "✓ make check grün"

# Drift-/Qualitäts-Gate (strict: blockt ungefüllte {{…}}, tote Pfade, fehlende Register):
check-index:
	@command -v python3 >/dev/null 2>&1 && PY=python3 || PY=python; "$$PY" scripts/check_index.py --strict
