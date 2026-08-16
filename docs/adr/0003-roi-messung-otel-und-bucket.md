---
last-reviewed: 2026-08-16
shelf-life-days: 365
---
# ADR-0003 — ROI-Messung: Bucket im Analyzer + OTel-Fail-Fast, kein eigenes Tracking

**Status:** Accepted · 2026-08-16 · —

## Kontext

Aufwand und Wert dieses Projekts sollen messbar sein. Der Reflex wäre ein
repo-eigenes Kosten-Tracking. Es existiert aber bereits eine vollständige Messkette
in `~/roi/claude-roi-analyzer`, und ein zweites Register würde unweigerlich driften —
dieselbe Fehlerklasse, die das Ledger-Prinzip im Repo-Kit verhindern soll.

Zwei Randbedingungen aus dem bestehenden System:

- **ADR-0019 §4 (Analyzer):** Repo-Zuordnung läuft über die Ordnerstruktur
  `~/.claude/projects/<kodierter-Pfad>/`, **nicht** über `OTEL_RESOURCE_ATTRIBUTES` je Repo.
  Ein repo-lokales Attribut wäre eine zweite, schlechtere Quelle.
- **ADR-0019 §1 (Analyzer):** OTel exportiert nur ab Einschaltzeitpunkt, **es gibt kein
  Replay**. Eine Session, die bei totem Collector läuft, ist dauerhaft ungemessen.

Verifizierter Ist-Stand am 16.08.2026: `otelcol-contrib` läuft auf `127.0.0.1:4318`,
`CLAUDE_CODE_ENABLE_TELEMETRY=1` global gesetzt, Archiv `~/roi-archive/fh/otel/claude-code.jsonl`
wächst aktiv.

## Entscheidung

**Kein repo-eigenes Kosten-Ledger.** Die Messung läuft über drei Bausteine:

1. **Bucket im Analyzer.** `~/roi/claude-roi-analyzer/config/projects.json` bekommt den
   Bucket `"Game Development"` mit Keywords (`godot`, `game-dev`, `gdscript`, `blender`,
   `spielmechanik`, …). Damit werden Sessions aus Claude Code, Cowork und claude.ai
   thematisch zugeordnet — der bestehende Pfad, keine Sonderbehandlung.
2. **Pfad-Zuordnung geschenkt.** Das Repo liegt unter
   `~/Documents/Claude/Projects/brachland`; Claude-Code-Sessions landen dadurch in einem
   pfadkodierten Verzeichnis unter `~/.claude/projects/`. Der Analyzer liest das bereits —
   **hier ist nichts zu konfigurieren.** Deshalb wird `OTEL_RESOURCE_ATTRIBUTES` in diesem
   Repo bewusst **nicht** gesetzt (ADR-0019 §4).
3. **Fail-Fast statt Konfiguration.** `make roi-check` (→ `scripts/roi/check_otel.py`)
   prüft vor einer Arbeitssession, dass Collector-Port, Telemetrie-Env und Archiv-Wachstum
   stimmen. Das ist die einzige repo-lokale Ergänzung — gerechtfertigt, weil der
   Datenverlust bei totem Collector **irreversibel** ist.

**Wertseite:** Sobald ein spielbarer Vertical Slice existiert, kommt **ein** Eintrag in
`~/roi/claude-roi-analyzer/config/deliverables.json` (`value_type: enablement`,
Marktpreis = Kosten der Alternative „Entwickler beauftragen", mit `basis`-Begründung,
zunächst `estimate: true`). Nicht vorher — ein Marktpreis für ein unfertiges Konzept
wäre eine erfundene Zahl.

## Konsequenzen

**Leichter:** Eine Messkette, ein Dashboard, keine Doppelpflege. Das Projekt erscheint
automatisch neben den übrigen Buckets und ist damit vergleichbar.

**Schwerer:** Externe Nicht-Claude-Kosten (Asset-Käufe, Store-Gebühren, Hardware) hat der
Analyzer nicht im Modell. Bei diesem Projekt ist das derzeit **gegenstandslos** — ADR-0002
lässt nur CC0-Assets zu, alle Werkzeuge sind frei. Ändert sich das, braucht es ein neues
ADR, keinen Workaround.

**Bewusst nicht gemessen:** Die Zeit, die *ohne* Claude nötig gewesen wäre. Das ist eine
kontrafaktische Größe. `active_time` misst die Zeit *mit* Claude und ist ein
Kalibrierungsanker, keine ROI-Antwort (ADR-0019, Leitplanken).

## Grenze (bekannte Limitation)

Deckt **nicht** ab: Blender-, Krita- und sonstige Nicht-Claude-Arbeitszeit. Die fällt in
keiner Quelle an und macht bei einem 3D-Projekt einen erheblichen Anteil aus — jede
Produktivitätsaussage aus dem Dashboard ist daher **unvollständig nach unten**: der
Gesamtaufwand ist höher als gemessen, der ausgewiesene Wert pro Stunde entsprechend zu
optimistisch. Wer das nicht mitsagt, verkauft eine Zahl, die keiner Nachfrage standhält.
