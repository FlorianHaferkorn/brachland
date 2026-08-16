---
paths: ["docs/**"]
---
# Doku — Stack-Regeln (docs/, pfadgebunden — lädt nur hier)

### Ein Register, kein zweites
Jede neue `*.md` in `docs/` muss in `docs/_INDEX.md` registriert werden — das
Drift-Gate erzwingt es hart. Keine parallele Doc-Liste in README oder CLAUDE.md.

### Status gehört ins Ledger, nicht in den Fließtext
Offene Punkte → `docs/_INDEX.md` Tabelle A. Entscheidungen → Tabelle B.
Ein „TODO" mitten in einem Dokument driftet garantiert; die Tabelle nicht.
Beim Beantworten im **selben** Arbeitsschritt abhaken, nicht später.

### ADR nur wenn fällig
Ein ADR schreiben, wenn mindestens eines gilt: (a) teuer umkehrbar, (b) wirkt über
≥2 Bereiche, (c) löst ein bestehendes ADR ab, (d) ein Dritter (späteres Ich) braucht
das *Warum*. Sonst genügt eine Zeile in Tabelle B. Jedes ADR verwässert die Sammlung.
Supersession **immer** explizit in der Status-Zeile, nie still ersetzen.

### Ehrlichkeit über Vollständigkeit
Wo Daten für eine Aussage nicht reichen, steht das da — „nicht belegt" schlägt eine
Zahl, die keiner Nachfrage standhält. Gilt besonders für `ROI.md`.
Datumsangaben absolut (`16.08.2026`), nie relativ.
