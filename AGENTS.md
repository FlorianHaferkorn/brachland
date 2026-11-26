# BRACHLAND — Einstieg für Codex

## Zuerst lesen

1. `GOI_DOKTRIN.md`, danach `CLAUDE.md`: gemeinsame Arbeitsregeln für dieses Repo.
2. `docs/_INDEX.md`: Tabelle A für offene Punkte, Tabelle B für Entscheidungen.
   **Aktueller Stand (25.11.2026):** Claude-Basis `claude/epic-planck-86z6fy` (PR #16), D479. Fortsetzung am 26.11.2026 auf `codex/d481-felsmulde` (D480–D481). **Erster Einstieg ist
   `docs/UEBERGABE_CODEX.md`** (Fokus Welt, Reihenfolge der nächsten Schritte). `docs/UEBERGABE.md` Abschnitt 0 sind
   ältere Aufträge an den M1; davon gilt noch Punkt 6 (Prüfliste Bewegung D456–D461, nur am M1 in Bewegung prüfbar).
   Offene Fragen an Flo: A-43 bis A-58. Bewegung: `docs/design/BRACHLAND_Waffenbewegungen_v1.md` §8–§10.
   Der ältere Ausgangsstand D155/D156 (15.09.2026) ist nur noch Geschichte.
   **Welt (M1-Sitzung bis 25.11.2026, D462–D478):** Flo hat Tiere und Menschen geparkt (Modelle, nicht ihre schon
   gebaute Bewegung) und will die Welt finalisieren — Einstieg `docs/UEBERGABE_CODEX.md` (Stand, was **nicht** im Repo liegt, nächste Schritte), Verfahren
   `docs/VERFAHREN_ORT.md` mit der Backkette aus `docs/WELT_METHODE.md` (`tools/ortkette.sh`).
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
- **Ledger-Nummern (D/G/H/A) parallel zu Claude:** vor dem Vergeben `main` holen;
  `make ledger-ids` nennt die nächste freie D-Nummer. Pro Arbeitsstand früh einen
  eigenen Branch pushen, nicht tagelang lokal sammeln. Kollidiert eine Nummer trotzdem,
  nummeriert die **später gemergte** Seite um; das Gate `scripts/check_ledger_ids.py`
  (in `make check` und CI) lässt doppelte IDs nicht durch.
- **Vorher/Nachher-Bilder** zu jeder sichtbaren Änderung an Flo (seit 21.11.2026): gleiche Kamera und
  Ladezeit, beschriftet, unter `.cache/bilder/<Dxxx>/`.
- **Physik muss stimmen** (D398): Abweichungen zugunsten des Spiels benennen und begründen, nie still. Getestete
  Kampfwerte (Fenster, Schaden, Tempo) ändern sich nur mit Bot-Messung (`tools/kampfbot.ts`) und ausdrücklich benannt;
  nie einen Test abschwächen, um grün zu werden.
- **Nichts kaufen** (D454) und nur freie Lizenzen im Spiel (ADR-0013); Megascans nur für Blender-Zielbilder (ADR-0021).
  Fremde Gestaltung nicht übernehmen (ADR-0007 §1, D431) ist etwas anderes als Materialrechte (ADR-0013 Punkt 5) —
  immer den richtigen Grund nennen.
- **Bildpfade in Ledger und Docs nur relativ** (`.cache/bilder/<Dxxx>/…`); `.cache/` gibt es in CI nicht. Die Bilder
  der Cloud-Sitzung liegen nicht im Repo.
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
