# game-dev — Arbeitsregeln für Claude

> Projekt-Einstieg. Claude liest diese Datei automatisch beim Start. Sie ist
> **kurz und routet** — Detail-Wissen lebt in den `_INDEX.md`-Dateien (s. u.),
> nicht hier. Halte sie unter ~1 Bildschirm; alles Wachsende wandert in einen Index.

## Globale Doktrin (Pflichtlektüre)

**Vor jeder Aufgabe lesen und befolgen:** [GOI_DOKTRIN.md](GOI_DOKTRIN.md) — die
Global Operating Instructions (Stil, Workflow, Recherche, Sicherheit). Gilt
projektübergreifend. Bei Konflikt: **projektspezifische Regeln hier > GOI**.
Details zu Formatierung/Recherche/Interaktion, die nur situativ gebraucht werden
(nicht jede Session eager lesen): `GOI_REFERENCE.md` (liegt neben der GOI).
<!-- Claude Code lädt automatisch nur CLAUDE.md — NICHT jede Datei unter
     ~/.claude/. Liegt die Doktrin global unter ~/.claude/GOI_DOKTRIN.md,
     diesen Link hier nur entfernen, wenn dein GLOBALES ~/.claude/CLAUDE.md
     selbst einen gleichwertigen Lies-Pointer auf GOI_DOKTRIN.md enthält —
     sonst liest niemand sie. -->

## Navigations-Prinzip (Token-Disziplin — KRITISCH)

Dieses Repo wird über **`_INDEX.md`-Dateien** navigiert, nicht durch Volltext-Scan.

- **Jeder navigierbare Bereich** (`docs/`, `scripts/`, …) hat **ein
  `_INDEX.md`** als zentralen Erstkontakt. Es routet per „lies-wenn"-Tabelle gezielt
  zum nötigen Dokument.
- **Nicht den ganzen Ordner lesen.** Dem Index vertrauen, gezielt navigieren.
  Ein „L0 → ein Detail"-Pfad genügt für die meisten Aufgaben.
- Für **Docs--Aufgaben** ist `docs/_INDEX.md` der
  Pflicht-Erstkontakt.

## Ledger-Prinzip — `_INDEX.md` ist Single Source of Truth (Anti-Nacharbeit)

Pro Bereich/Entität (z. B. `docs/<Name>/_INDEX.md`) gibt es **ein** Ledger
als SoT für Notizen-Register, offene/entschiedene Punkte.

**Pflicht:**
- **Vor jeder neuen Analyse/Fragenliste zuerst das `_INDEX.md` lesen.** Nichts neu
  ableiten oder erneut fragen, was dort als entschieden steht.
- **Im selben Arbeitsschritt abhaken:** beantwortete Punkte → Antwort + Datum in
  Tabelle A; getroffene Entscheidungen → Tabelle B. Offene Punkte **nie** nur im
  Fließtext einer Themen-Notiz lassen.
- Themen-Notizen bleiben **Detail-Belege**; ihr offen/erledigt-Stand lebt
  ausschließlich im Ledger. Driftende Alt-Listen oben mit Pointer auf `_INDEX.md`
  markieren.
- Fakten **mit Quelle/Beleg** (Feldname, Datei, Datum) — keine ungeprüften Annahmen.

Ziel: kein Re-Derive, keine doppelten Fragen, kein veralteter Status.

**Ledger vs. Auto-Memory:** Entscheidungen/Fakten mit Dauerwert gehören in den Ledger
(git-tracked, team-/kundenfähig) — Auto-Memory ist maschinenlokal und hält nur Pointer
+ persönliche Arbeitspräferenzen, kein Ersatz (siehe GOI §8).

## Drift-Gate (hält die Indizes ehrlich)

`python3 scripts/check_index.py` prüft: (1) jede Datei im Bereich ist im `_INDEX.md`
gelistet (Vollständigkeit, hart), (2) jeder Pfad/Anker im Index zeigt auf echte
Ziele (hart), (3) `last-reviewed` nicht älter als `shelf-life-days` (Staleness,
advisory). In den CI-/Pre-Commit-Check (`make check` o. ä.) einhängen.

## Weitere Konventionen (übernehmen, wenn zutreffend)

Vorlagen liegen unter `.claude/repo-kit/templates/`.

- **`_MANIFEST.md` (Repo-Root):** existiert eins, **zuerst lesen** — Zweck + Datenfluss
  + Invarianten. Für Pipeline-/Tool-Repos anlegen (Vorlage `_MANIFEST.md`).
- **Architektur-Entscheidungen** als `docs/adr/NNNN-*.md` mit Supersession-Kette in der
  Status-Zeile (Vorlage `_ADR.md`); im Ledger Tabelle B per Spalte `ADR` darauf zeigen.
  **ADR fällig, wenn mind. eines gilt:** (a) teuer umkehrbar, (b) wirkt über ≥2 Bereiche/
  Repos, (c) ersetzt/erweitert ein bestehendes ADR, (d) ein Dritter (Kunde, späteres Ich)
  wird das *Warum* brauchen. Sonst genügt eine Ledger-Zeile Tabelle B ohne ADR-Verweis.
- **PII-/Geheimnis-Configs:** nur `*.example.<ext>` committen, echtes File gitignored;
  für PII-Repos `scripts/check_redaction.py` als pre-commit wiren (GOI §9).
- **`.gitattributes` (LF-Policy):** bei Cross-Machine/Cloud-Sync übernehmen (gegen
  CRLF-Drift unter Windows/iCloud/OneDrive); danach `git add --renormalize .`.
- **`make check` (Single-Entry-Gate):** `Makefile`-Vorlage ins Root übernehmen (Make-Repos)
  bzw. ein npm-`"check"`-Script (JS); bündelt `check_index --strict` + eigene Checks
  (test/lint/typecheck). Der pre-commit-Hook ruft automatisch `make check`, wenn vorhanden.
- **Eine Doc-Registry:** das Doc-Register lebt **nur** im `_INDEX.md`. Eine bestehende
  „Useful docs"-Tabelle hier auf `_INDEX.md` umbiegen (Pointer), nicht parallel führen — sonst driften zwei Register.
- **Code-Navigation:** für dateireiche Code-Bereiche (`app/`, `lib/`) einen Bereichs-`_INDEX.md`
  mit `owns:`-Glob anlegen — dann hält das Gate auch den Code-Index ehrlich, nicht nur die Docs.

---

## Projekt-spezifische Regeln

<!-- Stack = Godot 4.7 / GDScript (3D). Python nur für Gate + ROI-Skripte (zero-dependency).
     Doc-Bereich = docs · Code-Bereiche = game, scripts, tests. -->

### Konzept ist offen — nicht darüber hinwegarbeiten
**Welches** Spiel gebaut wird, ist nicht entschieden (`docs/GDD.md`, Ledger-Punkt G-1).
Keine Spielmechanik, kein Level, kein Asset entsteht, bevor Genre und Core Loop im
Ledger abgehakt sind. Wer trotzdem baut, produziert Wegwerfarbeit.

### Godot: Szenen sind Code
- `.tscn`/`.tres` sind Textdateien und gehören in den Review wie `.gd`. Genau dafür wurde
  Godot gewählt (ADR-0001) — der Vorteil verfällt, wenn Szenen blind committet werden.
- Godot-Projektwurzel ist **`game/`**, nicht das Repo-Root. Jeder Aufruf braucht `--path game`.
- **Tabs, keine Spaces** in `.gd` — Godot setzt Spaces beim Re-Save zurück (Diff-Rauschen).
- GDScript statisch typisieren; `project.godot` warnt bei untypisierten Deklarationen.
- Diffs, die nur `uid://`-Zeilen ändern, sind Import-Rauschen → verwerfen.

### Scope-Guardrails sind bindend
ADR-0004 schließt Open World, Story-RPG und Online-Multiplayer aus. Eine Anfrage in diese
Richtung wird **nicht** still umgesetzt — erst ADR-0004 per neuem ADR ablösen, dann bauen.

### Assets nur CC0, mit Registereintrag
Fremdassets ohne Zeile im Lizenz-Register (`docs/ASSET_PIPELINE.md`) gelten als unklar
lizenziert und kommen nicht ins Repo. CC-BY-NC ist verboten (ADR-0002).

### Messung vor Arbeit
`make roi-check` vor jeder längeren Session. OTel kennt kein Replay — was bei totem
Collector läuft, ist dauerhaft ungemessen (ADR-0003).

### Compliance-Check
```bash
make check     # Drift-Gate (strict) + Godot-Smoke-Tests. Muss grün sein vor jedem Commit.
```
