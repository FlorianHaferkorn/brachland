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

<!-- Stack = three.js + React + Vite 5 + TypeScript, offline-PWA.
     Doc-Bereich = docs · Code-Bereiche = src, scripts. -->

### Herkunft: rekonstruiert, nicht neu gebaut
Das Projekt entstand in einer Chat-Sandbox, die es nicht mehr gibt, und wurde am
16.08.2026 daraus rekonstruiert. Der Code ist **erarbeitet** — Kampfwerte über tausende
simulierte Kämpfe geprüft, Art-Direction-Werte über acht Iterationen. Nicht daran drehen,
ohne `docs/design/` gelesen zu haben. Was noch fehlt: `docs/RECOVERY.md`.

### Arbeit läuft im Repo, nie in einer Sandbox
Claude Code im Repo-Ordner oder Cowork „auf deinem Computer". Eine Cloud-Sandbox hat
dieses Projekt bereits einmal um mehrere Tage Arbeit gebracht. Was nicht als Datei auf
der Platte liegt, existiert nicht.

### Inhalte sind Daten, nie Code
Kreaturen, Moves, Regionen und Waffen liegen in `content/` und werden gegen `src/data/schema.ts`
validiert. `npm run validate` blockt den Merge. Ein hartkodierter Spielwert ist ein
Fehler, auch wenn er funktioniert — das ist der Mechanismus, der 200 Kreaturen
beherrschbar macht (ADR-0004).

### Kampf-Engine bleibt renderfrei
`src/engine/`, `src/data/` und die Kampfregeln `src/kampf/echtzeit.ts` (Echtzeitkampf,
ADR-0007) importieren kein three.js, ebenso `src/kampf/sichtlinie.ts`. Daran hängen die Tests
unter `tests/`. Treffer werden als Bogen gegen eine Kapsel geprüft, nicht per Raycast am Modell.

### Deutsch ist die Code-Sprache
`baueTerrain`, `verteileProps`, `STIMMUNG`, `ZIELHOEHE`, `Weltdaten`, `PropArt` —
durchgehend, auch Kommentare. Der Bestandscode ist so; eine Mischung wäre schlechter
als jede der beiden Varianten konsequent.

### Das Zielgerät ist der Test, nicht das Standbild
Zielgerät ist seit ADR-0006 der **Desktop-Browser** (M1 als Referenzmaschine); das Handy ist
nachrangig und eine spätere eigene Qualitätsstufe. Look, Nebel und Performance beurteilen sich
nur dort, in Bewegung (ADR-0005). Keine Look-Aussage aus Standbildern: genau das hat das
Projekt mehrere Runden gekostet.

### Art Direction ist entschieden, nicht offen
Dämmerung, Nebel als Werkzeug, Silhouetten, **eine** Signalfarbe für Befall. Den Look legt
das Blender-Referenzbild fest (ADR-0006): Die Engine folgt dem Render, Texturen sind seit
ADR-0006 erlaubt, die Tagesstimmung ist `zielbild` (warm, Goldnebel). Ein Gegenentwurf mit kühler
Palette liegt als ADR-0011 **Proposed** vor (Ledger A-9). Die Werte in
`src/scenes/RegionsSzene.tsx` sind erarbeitet; nicht ohne Grund daran drehen.

### Performance-Invarianten
Props **immer** als `InstancedMesh` (40.000 Einzelobjekte erledigen jedes Handy).
Positionen aus einem **Seed** erzeugen, nie speichern. Das Precache-Budget von 60 MB
(`npm run quality`) ist ein Gate, kein Richtwert.

### Scope-Guardrails sind bindend
ADR-0004 parkt Party-Game und ein Spiel, das primär von Grafik lebt (Photoreal), als
**eigene spätere Projekte** und schließt Online-Multiplayer aus. Echtzeit-Nahkampf mit dem
Regelwerk der Gattung (Ausdauer, Rolle, Parade, Lock-On, Haltung) ist seit ADR-0007
entschieden und löst den Soulslike-Park-Punkt aus ADR-0004 für das Regelwerk ab (Nachtrag
D196); die Gestalt fremder Vorbilder bleibt tabu. Anfragen in die geparkten Richtungen werden
nicht still umgesetzt, erst ADR-0004 ablösen.

### Compliance-Check
```bash
make check     # Drift-Gate + typecheck + Tests + Schema-Validierung + quality + geometrie
make quality   # Budgets, seit 17.08.2026 Teil von `make check` (A-6 erledigt, siehe Makefile)
```
