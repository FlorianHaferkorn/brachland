---
paths: ["scripts/**"]
---
# Python (Gate + ROI) — Stack-Regeln (scripts/, pfadgebunden — lädt nur hier)

### Zero-Dependency ist Pflicht
Alles hier läuft im pre-commit-Hook und in CI — **ohne venv, ohne pip install**.
Nur stdlib. Eine Fremdbibliothek würde das Gate an eine Installation koppeln, die
auf einem frischen Rechner fehlt; dann wird das Gate umgangen statt repariert.

### Konventionen
- Type-Hints überall, `from __future__ import annotations` im Kopf.
- Pfade über `pathlib`, nie String-Konkatenation.
- Reine Funktionen mit klaren I/O-Rändern; Seiteneffekte nur in `main()`.
- Exit-Code ist das Interface: `0` = grün, `1` = Befund. Kein Traceback als Ausgabe.
- Ausgaben sind für Menschen: was ist kaputt **und** was ist zu tun.

### Nicht anfassen
`scripts/check_index.py` und `scripts/repo_kit_init.py` sind Kit-Mechanik aus
`claude-repo-kit` und werden bei jedem Kit-Update überschrieben. Änderungen gehören
ins Kit-Repo, nicht hierher.
