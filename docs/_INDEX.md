---
last-reviewed: 2026-08-16
shelf-life-days: 90
---
# docs — Zentraler Anlaufpunkt (_INDEX)

> Einstieg in `docs/`. Zuerst diese Datei lesen, dann gezielt zum Doc —
> nicht den ganzen Ordner. Offene Punkte unten im Ledger, nicht im Fließtext.
>
> **Dieses Repo ist gleichzeitig das Ledger des Projekts.** Es gibt keine zweite
> Statusliste: offene Punkte stehen in Tabelle A, Entscheidungen in Tabelle B,
> das *durable Warum* in `adr/`.

## „Lies-wenn"-Routing (Token-Disziplin)

| Deine Aufgabe ist … | Lies (in dieser Reihenfolge) | NICHT nötig |
|---|---|---|
| Spielkonzept / Genre entscheiden | `GDD.md` → `adr/0004-scope-guardrails-solo-3d.md` | Asset- und ROI-Docs |
| Code schreiben, Szene bauen, Befehl suchen | `TECH_STACK.md` | ADRs, ROI |
| Modell/Textur/Audio hinzufügen | `ASSET_PIPELINE.md` → `adr/0002-asset-pipeline-gltf-cc0.md` | GDD, ROI |
| Fragen „warum Godot und nicht Unity/Unreal?" | `adr/0001-engine-godot-4.md` | alles andere |
| Aufwand/Kosten auswerten, Messung reparieren | `ROI.md` → `adr/0003-roi-messung-otel-und-bucket.md` | GDD, Assets |
| Scope erweitern wollen (Multiplayer, Open World …) | `adr/0004-scope-guardrails-solo-3d.md` | alles andere |
| Verstehen, warum das Repo so navigiert wird | `NAVIGATION_PHILOSOPHY.md` | alles andere |

Faustregel: **ein L0 → ein Detail** genügt für die meisten Aufgaben.

## Dokument-Register (vollständig — Drift-Gate erzwingt das)

| Doc | Zweck | Lies-wenn |
|---|---|---|
| `GDD.md` | Game Design Document. Rahmen steht, **Konzept offen** | Genre, Core Loop, Vertical Slice |
| `TECH_STACK.md` | Installierte Werkzeuge, Befehle, Konventionen, 3D-Qualitätshebel | operative Arbeit am Code |
| `ASSET_PIPELINE.md` | Blender→glTF→Godot-Workflow **+ Lizenz-Register** der Fremdassets | Assets anfassen |
| `ROI.md` | Wie Aufwand/Wert gemessen werden — und was die Messung nicht kann | Messung, Auswertung, Kosten |
| `NAVIGATION_PHILOSOPHY.md` | Das Warum hinter der `_INDEX`-Logik (Kit-Doku) | Repo-Struktur hinterfragen |
| `adr/0001-engine-godot-4.md` | Engine-Wahl Godot 4.7 + verworfene Alternativen | Engine-Frage, Portierung |
| `adr/0002-asset-pipeline-gltf-cc0.md` | Format glTF 2.0, Fremdassets nur CC0 | Asset-Quelle oder Format ändern |
| `adr/0003-roi-messung-otel-und-bucket.md` | Messung über den bestehenden Analyzer, kein eigenes Tracking | Messkonzept ändern |
| `adr/0004-scope-guardrails-solo-3d.md` | Zugelassene und ausgeschlossene Genres | Scope-Entscheidung |

## A — Offene Punkte (Ledger — hier abhaken, NICHT im Fließtext)

> Legende: 🟡 offen · 📄 wartet auf Input · ✅ erledigt · ❌ out of scope

| ID | Punkt | Beleg | Status | Owner | Antwort + Datum |
|---|---|---|---|---|---|
| G-1 | **Genre wählen** aus dem Korridor in ADR-0004 — blockiert G-2 bis G-5 | `adr/0004-scope-guardrails-solo-3d.md` | 📄 | Flo | offen |
| G-2 | Core Loop in **einem** Satz formulieren | `GDD.md` §3 | 🟡 | Flo | offen (blockiert von G-1) |
| G-3 | Vertical Slice definieren: welches eine Level beweist die Tragfähigkeit? | `GDD.md` §4 | 🟡 | Flo | offen (blockiert von G-2) |
| G-4 | Art-Direction-Referenz: 5–10 Bilder + Farbpalette vor dem ersten Modell | `adr/0004`, Regel 2 | 🟡 | Flo | offen |
| G-5 | Fertig-Kriterium festlegen (was ist explizit *nicht* drin?) | `GDD.md` §6 | 🟡 | Flo | offen |
| A-1 | Blender installieren + Roundtrip Würfel→`.glb`→Godot einmal durchspielen | `ASSET_PIPELINE.md` | 🟡 | Flo | offen |
| A-2 | Git-LFS-Schwelle für `.glb`/Texturen entscheiden, **bevor** die History aufgeht | `adr/0002`, Konsequenzen | 🟡 | Flo | offen |
| A-3 | Export-Preset anlegen (`export_presets.cfg` ist gitignored — Vorlage committen?) | `Makefile` Target `export-linux` | 🟡 | Flo | offen |
| R-1 | Deliverable-Eintrag im Analyzer — **erst wenn der Vertical Slice läuft** | `ROI.md`, `adr/0003` | 📄 | Flo | wartet auf G-3 |

## B — Entscheidungen (getroffen, mit Begründung + Datum)

| ID | Entscheidung | Begründung | Datum | ADR |
|---|---|---|---|---|
| D1 | Engine = Godot 4.7, Forward+, Jolt, GDScript | Einzige Option, die MIT-OSS **und** vollständig textbasiert/agentensteuerbar ist | 2026-08-16 | ADR-0001 |
| D2 | Godot-Projekt liegt in `game/`, nicht im Repo-Root | Trennt Engine-Scan von Doku/Gate/CI; `src-assets/` bleibt außerhalb des Imports | 2026-08-16 | — |
| D3 | Assets: glTF 2.0 (`.glb`), Fremdmaterial nur CC0 | Ein Exportpfad; CC0 macht die Verwertungsfrage später zum Nicht-Thema | 2026-08-16 | ADR-0002 |
| D4 | Kein repo-eigenes Kosten-Ledger — Messung über `~/roi/claude-roi-analyzer` | Zweites Register würde driften; Repo-Zuordnung ist über den Pfad geschenkt | 2026-08-16 | ADR-0003 |
| D5 | `OTEL_RESOURCE_ATTRIBUTES` wird hier **nicht** gesetzt | Analyzer-ADR-0019 §4: wäre eine zweite, schlechtere Quelle neben dem JSONL-Pfad | 2026-08-16 | ADR-0003 |
| D6 | Genre-Korridor verbindlich; Open World / Story-RPG / Online-MP ausgeschlossen | Content-Menge skaliert dort mit Spielzeit — der KI-Multiplikator greift nicht | 2026-08-16 | ADR-0004 |
| D7 | Kein C#/Mono; GDExtension erst bei **gemessenem** Bedarf | Verdoppelt die Toolchain ohne Gegenwert bei diesem Scope | 2026-08-16 | — |
