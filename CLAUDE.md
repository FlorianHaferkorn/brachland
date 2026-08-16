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

### Das Repo ist unvollständig — das zuerst wissen
`src/world/osm.ts` und `src/world/terrain.ts` **fehlen**; das Projekt baut nicht.
BRACHLAND entstand in einer Chat-Sandbox, die es nicht mehr gibt — gerettet ist nur,
was als Datei herausgereicht wurde. **Vor jeder Code-Arbeit `docs/RECOVERY.md` lesen.**
Nichts als vorhanden annehmen, nur weil `docs/START.md` es beschreibt.

### Arbeit läuft im Repo, nie in einer Sandbox
Claude Code im Repo-Ordner oder Cowork „auf deinem Computer". Eine Cloud-Sandbox hat
dieses Projekt bereits einmal um mehrere Tage Arbeit gebracht. Was nicht als Datei auf
der Platte liegt, existiert nicht.

### Deutsch ist die Code-Sprache
`baueTerrain`, `verteileProps`, `STIMMUNG`, `ZIELHOEHE`, `Weltdaten`, `PropArt` —
durchgehend, auch Kommentare. Der Bestandscode ist so; eine Mischung wäre schlechter
als jede der beiden Varianten konsequent.

### Handy ist der Test, nicht der Laptop
`npm run dev` gibt eine Netzwerk-Adresse aus — die aufs Handy im selben WLAN. Look,
Nebel und Performance beurteilen sich nur auf dem Zielgerät. Keine Look-Aussage aus
Standbildern: genau das hat das Projekt mehrere Runden gekostet.

### Art Direction ist entschieden, nicht offen
Dämmerung, Nebel als Werkzeug, Silhouetten, **eine** Signalfarbe für Befall. Keine
Texturen — Vertex-Farben und Geometrie. Die Werte in `src/scenes/RegionsSzene.tsx`
sind erarbeitet; nicht ohne Grund daran drehen.

### Performance-Invarianten
Props **immer** als `InstancedMesh` (40.000 Einzelobjekte erledigen jedes Handy).
Positionen aus einem **Seed** erzeugen, nie speichern. Das Precache-Budget von 60 MB
(`npm run quality`) ist ein Gate, kein Richtwert.

### Scope-Guardrails sind bindend
ADR-0004 parkt Zelda/Soulslike, Party-Game und Photoreal als **eigene spätere
Projekte** und schließt Online-Multiplayer aus. Anfragen in diese Richtung werden nicht
still umgesetzt — erst ADR-0004 ablösen.

### Compliance-Check
```bash
make check     # Doku-Drift-Gate + typecheck + test. Muss grün sein vor jedem Commit.
```
