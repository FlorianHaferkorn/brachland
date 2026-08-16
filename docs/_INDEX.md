---
last-reviewed: 2026-08-16
shelf-life-days: 90
---
# docs — Zentraler Anlaufpunkt (_INDEX)

> Einstieg in `docs/`. Zuerst diese Datei lesen, dann gezielt zum Doc — nicht den
> ganzen Ordner. **Dieses Repo hat kein zweites Statusregister:** offene Punkte in
> Tabelle A, Entscheidungen in Tabelle B, das durable Warum in `adr/`.

## „Lies-wenn"-Routing (Token-Disziplin)

| Deine Aufgabe ist … | Lies (in dieser Reihenfolge) | NICHT nötig |
|---|---|---|
| Verstehen, warum das Repo unvollständig ist | `RECOVERY.md` | alles andere |
| Wissen, was BRACHLAND überhaupt ist | `GDD.md` | ADRs |
| Code schreiben, Befehl suchen, Konvention klären | `TECH_STACK.md` | GDD, ROI |
| Szene, Terrain oder Props anfassen | `../src/_INDEX.md` → `TECH_STACK.md` | ADRs |
| Projekt starten / auf dem Handy testen | `START.md` → `TECH_STACK.md` | ADRs |
| Fragen „warum kein Unreal/Godot?" | `adr/0001-three-js-pwa-statt-engine.md` | alles andere |
| Modelle, Texturen, Kreaturen beschaffen | `adr/0002-assets-cc0-props-und-kreatur-kette.md` | GDD |
| Scope erweitern wollen | `adr/0004-scope-episodisch-statt-100-stunden.md` | alles andere |
| Aufwand/Kosten auswerten, Messung reparieren | `ROI.md` → `adr/0003-roi-messung-otel-und-bucket.md` | GDD, Assets |
| Verstehen, warum so navigiert wird | `NAVIGATION_PHILOSOPHY.md` | alles andere |

## Dokument-Register (vollständig — Drift-Gate erzwingt das)

| Doc | Zweck | Lies-wenn |
|---|---|---|
| `RECOVERY.md` | **Zuerst lesen.** Was aus der verlorenen Sandbox gerettet ist und was fehlt | Repo-Zustand einschätzen |
| `GDD.md` | Was BRACHLAND ist: Welt, Kreaturen, Art Direction, Stand, nächste Schritte | Konzeptfragen |
| `START.md` | Projektstand 16.08.2026 aus dem Chat, Befehle, gemessene Kennzahlen (gerettet) | starten, Kennzahlen prüfen |
| `TECH_STACK.md` | Stack, Befehle, Konventionen, Budget | operative Arbeit |
| `ROI.md` | Wie Aufwand/Wert gemessen werden — und was die Messung nicht kann | Messung, Auswertung |
| `NAVIGATION_PHILOSOPHY.md` | Das Warum hinter der `_INDEX`-Logik (Kit-Doku) | Repo-Struktur hinterfragen |
| `adr/0001-three-js-pwa-statt-engine.md` | three.js/React-PWA statt Engine; Unreal und Godot verworfen | Stack-Frage |
| `adr/0002-assets-cc0-props-und-kreatur-kette.md` | CC0-Props, Stil-Referenz vor Stapelproduktion | Assets |
| `adr/0003-roi-messung-otel-und-bucket.md` | Messung über den bestehenden Analyzer, kein eigenes Tracking | Messkonzept |
| `adr/0004-scope-episodisch-statt-100-stunden.md` | Episodisch bauen; Geparktes und Ausgeschlossenes | Scope-Entscheidung |

## A — Offene Punkte (Ledger — hier abhaken, NICHT im Fließtext)

> Legende: 🔴 blockierend · 🟡 offen · 📄 wartet auf anderes · ✅ erledigt

| ID | Punkt | Beleg | Status | Antwort + Datum |
|---|---|---|---|---|
| B-1 | `src/world/osm.ts` ist nur ein **Stub** — Typen stehen, Ladefunktion wirft | Dateikopf, `docs/RECOVERY.md` | 🔴 | offen |
| B-2 | `src/world/terrain.ts` ist nur ein **Stub** — Signaturen belegt, Implementierung und Zahlenwerte fehlen | Dateikopf, `docs/RECOVERY.md` | 🔴 | offen |
| B-3 | Weltgenerator (`npm run world`) fehlt, dadurch auch die Weltdaten-JSON unter public/world/ | `START.md` | 🔴 | offen |
| B-4 | Kampf-Engine + 16 Tests fehlen | `START.md` | 🟡 | offen |
| B-5 | Kampf-UI fehlt; war ohnehin nicht mit der Szene verbunden | Chat 16.08.2026 | 🟡 | offen |
| B-6 | Schemas, Qualitätstor, `reduce.mjs`, `autorig.py` fehlen | `RECOVERY.md` | 🟡 | offen |
| B-7 | 23 Kenney-Prop-Modelle unter `public/props/` fehlen | `START.md` | 🟡 | neu herunterladen (CC0) |
| G-1 | **Szene einmal live auf dem Handy sehen** — alle Look-Urteile beruhen bisher auf Software-Renderer-Standbildern | `GDD.md` | 📄 | wartet auf B-1..B-3 |
| G-2 | Stil-Referenz für Kreaturen festzurren; Prompt des Steinbocks sichern | ADR-0002 | 🟡 | offen |
| G-3 | Eine Kreatur komplett durch die Kette inkl. Rigging | ADR-0002 | 📄 | wartet auf G-2 |
| G-4 | Spielerfigur und Bewegung — Kamera steht am Ursprung | `GDD.md` | 🟡 | offen |
| A-4 | Artist für die 5 Regenten + 5–8 Startkreaturen? Einzige Stelle, an der Geld fließen dürfte | ADR-0002 | 🟡 | offen |
| A-5 | Git-LFS-Schwelle für `.glb`, bevor die History aufgeht | — | 🟡 | offen |
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
| D8 | Arbeit läuft **im Repo**, nie in einer Chat-Sandbox | Die Sandbox hat bereits mehrere Tage Arbeit vernichtet | 2026-08-16 | — |
| D9 | Godot-ADRs vom 16.08.2026 gelöscht statt abgelöst | Sie beruhten auf einer falschen Prämisse und waren nie gültige Entscheidungen | 2026-08-16 | — |
