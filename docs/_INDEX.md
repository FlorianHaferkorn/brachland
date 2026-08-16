---
last-reviewed: 2026-08-16
shelf-life-days: 90
---
# docs — Zentraler Anlaufpunkt (_INDEX)

> Einstieg in `docs/`. Zuerst diese Datei lesen, dann gezielt zum Doc — nicht den ganzen
> Ordner. **Dieses Repo hat kein zweites Statusregister:** offene Punkte in Tabelle A,
> Entscheidungen in Tabelle B, das durable Warum in `adr/`, das verbindliche Spieldesign
> in `design/`.

## „Lies-wenn"-Routing (Token-Disziplin)

| Deine Aufgabe ist … | Lies (in dieser Reihenfolge) | NICHT nötig |
|---|---|---|
| Wissen, was BRACHLAND ist | `GDD.md` | ADRs, design/ |
| Spielinhalt entwerfen oder ändern | `design/_INDEX.md` | ADRs, ROI |
| Code schreiben, Befehl suchen, Konvention klären | `TECH_STACK.md` | GDD, ROI |
| Wissen, was als Nächstes gebaut wird | `ROADMAP.md` | ADRs |
| Budgets, Blocker, Qualitätsbegriff | `QUALITY.md` | GDD, ROI |
| Modelle beschaffen und aufbereiten | `WORKFLOW.md` → `../tools/README.md` | GDD |
| Projekt starten / auf dem Handy testen | `START.md` → `TECH_STACK.md` | ADRs |
| Verstehen, warum etwas fehlt | `RECOVERY.md` | alles andere |
| Fragen „warum kein Unreal/Godot?" | `adr/0001-three-js-pwa-statt-engine.md` | alles andere |
| Scope erweitern wollen | `adr/0004-scope-episodisch-statt-100-stunden.md` | alles andere |
| Aufwand/Kosten auswerten | `ROI.md` → `adr/0003-roi-messung-otel-und-bucket.md` | GDD, design/ |
| Verstehen, warum so navigiert wird | `NAVIGATION_PHILOSOPHY.md` | alles andere |

## Dokument-Register (vollständig — Drift-Gate erzwingt das)

| Doc | Zweck |
|---|---|
| `GDD.md` | Was BRACHLAND ist: Welt, Kreaturen, Art Direction, Stand, nächste Schritte |
| `ROADMAP.md` | Entwicklungsplan, episodisch. Kein Meilenstein plant weiter als den nächsten |
| `QUALITY.md` | Qualitätsstandard und Tore. Warum „premium" als Ziel unbrauchbar ist, und was stattdessen gemessen wird |
| `WORKFLOW.md` | Asset-Kette von der KI-Generierung zur spielfertigen Kreatur. Laufende Kosten: 0 € |
| `START.md` | Projektstand 16.08.2026 aus dem Chat, Befehle, gemessene Kennzahlen |
| `TECH_STACK.md` | Stack, Befehle, Konventionen, Budget |
| `RECOVERY.md` | Was die verlorene Sandbox gekostet hat, was zurückkam, was noch fehlt |
| `ROI.md` | Wie Aufwand/Wert gemessen werden — und was die Messung nicht kann |
| `NAVIGATION_PHILOSOPHY.md` | Das Warum hinter der `_INDEX`-Logik (Kit-Doku) |
| `design/_INDEX.md` | Die verbindlichen Design-Dokumente (Story, Kampfsystem, Roster, Moves) |
| `bilder/` | Renderings und Vergleichsbilder aus den Spikes. Referenz, kein Spielinhalt |
| `adr/0001-three-js-pwa-statt-engine.md` | three.js/React-PWA statt Engine; Unreal und Godot verworfen |
| `adr/0002-assets-cc0-props-und-kreatur-kette.md` | CC0-Props, Stil-Referenz vor Stapelproduktion |
| `adr/0003-roi-messung-otel-und-bucket.md` | Messung über den bestehenden Analyzer, kein eigenes Tracking |
| `adr/0004-scope-episodisch-statt-100-stunden.md` | Episodisch bauen; Geparktes und Ausgeschlossenes |

## A — Offene Punkte (Ledger — hier abhaken, NICHT im Fließtext)

> Legende: 🔴 blockierend · 🟡 offen · 📄 wartet auf anderes · ✅ erledigt

| ID | Punkt | Beleg | Status | Antwort + Datum |
|---|---|---|---|---|
| B-1 | `src/world/osm.ts` fehlt | — | ✅ | rekonstruiert, 16.08.2026 |
| B-2 | `src/world/terrain.ts` fehlt | — | ✅ | rekonstruiert, 16.08.2026 |
| B-4 | Kampf-Engine + 16 Tests fehlen | — | ✅ | zurück, 16/16 grün, 16.08.2026 |
| B-5 | Kampf-UI fehlt | — | ✅ | `src/ui/BattleScreen.tsx` zurück, 16.08.2026 |
| B-6 | Schemas, Qualitätstor, Asset-Kette fehlen | — | ✅ | zurück, 16.08.2026 |
| A-6 | **Grathorn-GLB 163–164 KB gegen 120 KB Budget** — bei 200×3 Modellen entscheidet das über die Offline-Tauglichkeit | `npm run quality` | 🔴 | offen — Ansatz ist `tools/reduce.mjs`, nicht das Budget |
| B-3 | Weltdaten fehlen; ohne sie startet die Szene nicht | `tools/buildworld.ts` | 🟡 | **regenerierbar**: `npm run world oental 96` |
| B-7 | 23 Kenney-Prop-Modelle unter public/props/ fehlen | `propPfad()` in `src/world/props.ts` | 🟡 | neu herunterladen (CC0) |
| B-8 | Drei Mess-Werkzeuge in tools/ fehlen (lodcheck, masstab, scenecheck) — die Skripte `lod`, `masstab` und `szene` zeigen ins Leere | `package.json` | 🟡 | Mess-Werkzeuge, kein Bauschritt |
| B-9 | `content/moves/` und `content/regions/` leer; 1 von 35 Kreaturen aus Kapitel 1 angelegt | `content/_INDEX.md` | 🟡 | Inhalte stehen in `design/` |
| B-10 | `assets/rigs/` leer — `autorig.py` braucht die Archetyp-Rigs | `assets/_INDEX.md` | 🟡 | offen |
| G-1 | **Szene einmal live auf dem Handy sehen** — alle Look-Urteile beruhen auf Software-Renderer-Standbildern | `GDD.md` | 📄 | wartet auf B-3 und B-7 |
| G-2 | Stil-Referenz für Kreaturen festzurren; Prompt des Steinbocks sichern | ADR-0002 | 🟡 | offen |
| G-4 | Spielerfigur und Bewegung — Kamera steht am Ursprung | `GDD.md` | 🟡 | offen |
| G-5 | Kampf-UI ist nicht mit der Szene verbunden | `src/_INDEX.md` | 🟡 | offen |
| A-4 | Artist für die 5 Regenten + 5–8 Startkreaturen? Einzige Stelle, an der Geld fließen dürfte | ADR-0002 | 🟡 | offen |
| A-5 | Git-LFS-Schwelle: 9 MB Bilder + 0,5 MB GLB liegen als Blobs in der History | `docs/bilder/`, `assets/` | 🟡 | offen |
| R-1 | Deliverable-Eintrag im ROI-Analyzer — erst wenn der Slice läuft | `ROI.md` | 📄 | wartet auf G-1 |

## B — Entscheidungen (getroffen, mit Begründung + Datum)

| ID | Entscheidung | Begründung | Datum | ADR |
|---|---|---|---|---|
| D1 | Stack = three.js + React + Vite 5 + TS, offline-PWA | Offline-Handy-Auslieferung **und** vollständig textbasiert/agentenschreibbar | 2026-08-16 | ADR-0001 |
| D2 | Unreal verworfen (zweimal geprüft) | Tötet die PWA und macht Claude vom Mitbauer zum Berater | 2026-08-16 | ADR-0001 |
| D3 | Godot verworfen | Editor-gebunden, und die Offline-PWA-Zustellung entfällt | 2026-08-16 | ADR-0001 |
| D4 | Props aus CC0-Packs, Kreaturen erst nach fixierter Stil-Referenz | Stil-Drift über 200 KI-Modelle ist sonst unvermeidbar | 2026-08-16 | ADR-0002 |
| D5 | Episodisch bauen; 40–50 Std sind Decke, nicht Plan | Als geplanter Umfang stirbt das Projekt | 2026-08-16 | ADR-0004 |
| D6 | Kein repo-eigenes Kosten-Ledger — Messung über `~/roi/claude-roi-analyzer` | Zweites Register würde driften | 2026-08-16 | ADR-0003 |
| D7 | Code-Sprache ist Deutsch, durchgehend | Bestandscode ist so; Mischung wäre schlimmer als jede der beiden Varianten | 2026-08-16 | — |
| D8 | Arbeit läuft **im Repo**, nie in einer Chat-Sandbox | Die Sandbox hat einen vollen Arbeitstag vernichtet | 2026-08-16 | — |
| D10 | React 19 + fiber 9 + drei 10 statt React 18 + fiber 8 | Der Code ist in React-19-Notation geschrieben; die alte Kombination erzeugt 20 Typfehler | 2026-08-16 | — |
| D11 | Inhalte als validierte Daten, nie hartkodiert | Der einzige Weg, 200 Kreaturen beherrschbar zu halten | 2026-08-16 | ADR-0004 |
| D12 | `tools/` für Spiel-Werkzeuge, `scripts/` für Repo-Kit und ROI | Zwei Herkünfte, zwei Lebenszyklen — Vermischung würde beide unklar machen | 2026-08-16 | — |
