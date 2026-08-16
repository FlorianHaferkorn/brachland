---
last-reviewed: 2026-08-16
shelf-life-days: 180
---
# ROI- und Kostenmessung

Entscheidung und Begründung: ADR-0003. Diese Datei ist die **Bedienungsanleitung** —
was gemessen wird, was nicht, und was zu tun ist, wenn die Messung ausfällt.

## Wo gemessen wird

Nicht hier. Die Messkette liegt in **`~/roi/claude-roi-analyzer`**; dieses Repo hängt
sich nur ein. Ein zweites Kosten-Register würde driften — dieselbe Fehlerklasse, die das
Ledger-Prinzip verhindern soll.

```
Claude-Code-Session in diesem Repo
   │
   ├─► ~/.claude/projects/<pfad-kodiert>/*.jsonl ──┐  Inhalt, Repo-Zuordnung
   │                                               ├─► parse_all ─► Dashboard
   └─► OTLP :4318 ─► otelcol ─► ~/roi-archive/fh/otel/claude-code.jsonl
                                                      Token, active_time, Edit-Decisions
```

**Repo-Zuordnung ist geschenkt:** Der Pfad `~/Documents/Claude/Projects/brachland` steckt
kodiert im JSONL-Verzeichnisnamen. `OTEL_RESOURCE_ATTRIBUTES` wird hier **bewusst nicht**
gesetzt (Analyzer-ADR-0019 §4 — das wäre eine zweite, schlechtere Quelle).

**Thematische Zuordnung** läuft über den Bucket `"Game Development"` in
`~/roi/claude-roi-analyzer/config/projects.json`. Neue Themen (neue Engine, neues
Werkzeug) → Keyword dort ergänzen, sonst landen die Sessions unter „Sonstiges".

## Vor jeder Arbeitssession

```bash
make roi-check
```

Prüft Collector-Port, Telemetrie-Env und Archiv-Frische. **Warum als Gate und nicht als
Nice-to-have:** OTel kennt kein Replay. Was bei totem Collector läuft, ist dauerhaft
ungemessen (Analyzer-ADR-0019 §1). Der Check kostet zwei Sekunden, der Ausfall kostet
eine Session.

Wenn er rot ist:

```bash
otelcol-contrib --config ~/roi/otel-collector.yaml   # Collector neu starten
tail -20 ~/roi/otel-collector.log                    # oder: was ist kaputt?
```

## Wertseite — erst beim Vertical Slice

Sobald der Slice spielbar ist, kommt **ein** Eintrag in
`~/roi/claude-roi-analyzer/config/deliverables.json`:

```json
{
  "id": "brachland-vertical-slice",
  "title": "BRACHLAND — spielbarer Vertical Slice",
  "sphere": "privat",
  "bucket": "Game Development",
  "value_type": "enablement",
  "market_price_eur": 0,
  "basis": "<X Godot-Entwicklertage à Y EUR — Marktpreis der Alternative 'beauftragen'>",
  "added_month": "YYYY-MM",
  "estimate": true,
  "first_touch": "2026-08-16"
}
```

Vorher nicht. Ein Marktpreis für ein unfertiges Konzept ist eine erfundene Zahl, und
erfundene Zahlen sind der Grund, warum die meisten ROI-Dashboards niemanden überzeugen.

## Was diese Messung NICHT kann

Ehrlichkeit hier ist der Punkt — nicht eine große Zahl:

- **Nicht-Claude-Zeit fehlt vollständig.** Blender, Krita, Level-Design von Hand,
  Playtesting: taucht in keiner Quelle auf. Bei einem 3D-Projekt ist das ein *erheblicher*
  Anteil. Jede Aussage „Wert pro Stunde" aus dem Dashboard ist deshalb **nach oben
  verzerrt** — der reale Aufwand ist höher als der gemessene.
- **`active_time` ist keine ROI-Antwort.** Es misst die Zeit *mit* Claude, nicht den
  kontrafaktischen Aufwand *ohne*. Kalibrierungsanker, mehr nicht.
- **Kosten sind Listenpreis-Schätzungen**, keine Abrechnung (Analyzer-ADR-0007).
- **Kein Replay.** Alles vor dem 02.08.2026 (OTel-Einschalttag) existiert nur als
  JSONL-Archiv, ohne Token- und Zeit-Metriken.

Wer eine einzelne ROI-Zahl will, bekommt hier keine. Das ist Absicht.
