# BRACHLAND — Einstieg für Codex

## Zuerst lesen

1. `GOI_DOKTRIN.md`, danach `CLAUDE.md`: gemeinsame Arbeitsregeln für dieses Repo.
2. `docs/_INDEX.md`: Tabelle A für offene Punkte, Tabelle B für Entscheidungen;
   Übergabe D156 und fachlicher Ausgangsstand D155 vom 15.09.2026.
3. Für Look-/Szenenarbeit `docs/adr/0006-zielbild-vor-zielgeraet.md`, danach
   `docs/MESSLAUF.md` für Kameras und die Bau-/Messkette.

## Vorrang des aktuellen Projektstands

**ADR-0006 ersetzt die älteren Handy-Latten und das Texturverbot** in `CLAUDE.md`,
`GOI_DOKTRIN.md`, `.claude/rules/src.md` und `docs/QUALITY.md`: Der Desktop-Browser
(M1 als Referenz) ist das Zielgerät, der Blender-Render legt den Look fest.
Gebackene prozedurale Texturen sind erlaubt. three.js, PWA, freie Werkzeuge,
Asset-Herkunft und die Scope-Grenzen aus ADR-0004 bleiben verbindlich.

`make check` enthält bereits `quality`; die gegenteilige Passage in `CLAUDE.md`
ist veraltet. Bestehende Gate-Befunde nicht durch angehobene Budgets verdecken.

## Regeln, die Codex nicht automatisch aus Claude übernimmt

- Die passenden Dateien unter `.claude/rules/` mitlesen: `src.md` für Quellcode,
  `docs.md` für Dokumentation, `scripts.md` für die Python-Gates.
- Über Bereichs-`_INDEX.md` navigieren. Neue Dateien im zuständigen Register
  eintragen; offene Punkte nur in Tabelle A, Entscheidungen in Tabelle B pflegen.
- Deutsch für Bezeichner und Kommentare; TypeScript strikt, ESM-Importe auf
  TS-Quellen mit `.js`. Spielinhalte bleiben Daten unter `content/`.
- `src/engine/` und `src/data/` bleiben ohne three.js. Instancing für Massenobjekte,
  Positionen aus Seed, Geometrie und Materialien nicht pro Frame neu erzeugen.
- Repo-Kit-Gates nicht lokal umbauen. Python unter `scripts/` bleibt stdlib-only.
- Arbeit direkt im Repo sichern. `.cache/` ist nicht versioniert: keine dortige
  Skriptkopie als dauerhaften Einstieg verwenden. Messwerkzeuge: `tools/mess/`;
  Terrainexport: `tools/terrainexport.ts`. Ergebnisse mit neuen Namen ablegen,
  historische Render und Baselines erhalten.

## Prüfen und übergeben

- Vor Commit: `make check`. Bei Build-/Renderer-Arbeit zusätzlich `npm run build`
  und passende Messläufe nach `docs/MESSLAUF.md`.
- Look-Aussagen brauchen Zahlen **und** Bildprüfung; Übergänge, Bewegung und
  Bildrate zusätzlich im Spiel prüfen. Standbilder belegen keine LOD-Qualität.
- Der aktuelle offene Arbeitsstand steht im Ledger, nicht in dieser Routing-Datei.
  D156 sichert die Übergabe; die visuellen Befunde aus D155 bleiben offen.
