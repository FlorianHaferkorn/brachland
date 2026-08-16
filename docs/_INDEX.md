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
| A-6 | **Alle 6 Grathorn-GLB 163–167 KB gegen 120 KB Budget.** v2 ist nicht kleiner als v1 — die zweite Runde hat das Budget nicht angefasst | `npm run quality` | 🔴 | offen — Ansatz ist `tools/reduce.mjs`, nicht das Budget |
| A-7 | **Œntal ist unfair:** nur 3 Elemente, Regenten-Phasen 2 und 3 ohne Konter in der Region | `npm run quality` | ✅ | behoben mit den 10 Wildling-Linien: 7 Elemente, jede Regenten-Phase konterbar. Es bleiben zwei Warnungen (Phase 2 nur über `frost`, Phase 3 nur über `holz`) — das ist die Absicht des Rosters, nicht ein Mangel |
| A-8 | Grathorn v1 **und** v2 liegen parallel; welche gilt, ist nicht entschieden | `assets/_INDEX.md` | 🟡 | vor der nächsten Kreatur klären, unterlegene löschen |
| B-3 | Weltdaten fehlen | — | ✅ | `public/world/oental.json` (1,05 MB) aus dem ZIP, 16.08.2026 |
| B-7 | 23 Kenney-Prop-Modelle fehlen | — | ✅ | unter public/props/, Precache 29 Einträge / 2.256 KiB, 16.08.2026 |
| B-8 | Mess-Werkzeuge in tools/ fehlen | — | ✅ | sechs zurück (lodcheck, masstab, scenecheck, terraincheck, propcheck, lodpreview), 16.08.2026 |
| B-9 | `content/moves/` leer; 2 von 35 Kreaturen aus Kapitel 1 angelegt (Region und Regent sind da) | `content/_INDEX.md` | ✅ | 41 Moves und 11 Kreaturen aus dem Roster-Dokument, 16.08.2026. Offen bleiben Zuchtlinien und Verhärtete |
| B-10 | `assets/rigs/` leer — `autorig.py` braucht die Archetyp-Rigs | `assets/_INDEX.md` | 🟡 | offen |
| G-1 | Szene erstmals live gesehen (Browser, 16.08.2026) | — | ✅ | rendert: Terrain, Horizont, Nebel, Props. Auf dem **Handy** noch offen |
| G-6 | `lod.ts` nicht in der Szene verdrahtet | — | ✅ | eingebaut 16.08.2026: 226 Kacheln, 84.096 Dreiecke, **4 Draw Calls**, Nahfeld-Relief 0,73 m bei 2 m Radius statt konstant 7,05 m |
| G-8 | Sichtbare Kachelgrenzen | — | ✅ | **Ursache: die Schürzen.** Feste 3 m erzeugen am Kachelrand eine senkrechte Wand, die mit Flat Shading kein Licht abbekommt. Tiefe jetzt an die LOD-Stufe gekoppelt |
| G-9 | Detailgewinn am Startpunkt kaum sichtbar | — | ✅ | mit Bewegung und Streuschicht adressiert, 16.08.2026 |
| G-12 | Streuschicht zu zurückhaltend | — | ✅ | nachgezogen: 0,80/m², 0,18–0,48 m, hellere Farben, breiter |
| G-13 | **Aufgesetzte Geometrien standen auf der falschen Höhenquelle** — Wege, Gewässer und Gebäude aus dem groben Raster, sichtbarer Boden aus dem Mikrorelief-Feld. Gemessen 2,35 m Mittel, 24 m Maximum | Messung 16.08.2026 | ✅ | behoben: Wege 24 → 2,7 m, Gewässer 15 → 1,8 m |
| G-14 | Restdrift der Wege bis ±3 m | — | ✅ | Segmente in 4-m-Stücke zerlegt, Höhe je Stück neu abgefragt |
| G-7 | `daemmerung` praktisch schwarz | — | ✅ | Tone Mapping mit Belichtung je Stimmung (1,65 / 1,15 / 1,40). Werte gegen ein MacBook gesetzt — **am Handy gegenprüfen** |
| G-2 | Stil-Referenz für Kreaturen festzurren; Prompt des Steinbocks sichern | ADR-0002 | 🟡 | offen |
| G-4 | Bewegung und Kamerasteuerung | — | ✅ | 16.08.2026: Gehen 1,4 / Rennen 5,0 m/s, Blick frei drehbar. Touch **und** Tastatur. Verifiziert im Browser |
| G-10 | Keine Spielerfigur | — | ✅ | Platzhalter 1,8 m, `src/spieler/figur.ts`, dreht sich in Laufrichtung. Ersetzen, sobald die Stil-Referenz steht |
| G-11 | Keine Kollision | — | ✅ | Stämme, Findlinge, Totholz blocken (`src/spieler/kollision.ts`). Büsche und Gras bewusst durchlässig. Gebäude als Rechtecke (2.033 Grundrisse) |
| G-15 | Fernattrappen für Props | — | ✅ | ab 75 m Primitive statt GLB. **Behebt zugleich eine Budget-Überschreitung, die ich mit der Dichteanhebung eingebaut hatte** |
| G-17 | Wald bleibt bei 95 Nadelbäumen/ha; real sind 400–1000 | Messung 16.08.2026 | 📄 | **wartet auf G-18** — wenn das Budget höher liegt, ist mehr Dichte sofort drin |
| G-18 | **Das Dreiecksbudget misst die falsche Groesse.** Gemessen auf dem Zielgeraet: 23-45 B/s bei nur 209.852 Dreiecken und 114 Draw Calls. Ein Handy von 2026 zeichnet das muehelos, der Engpass ist also nicht die Geometrie | Messung 16.08.2026 | 🟡 | **Ursache gefunden (G-20).** `tools/scenecheck.ts` misst weiter Dreiecke; die zweite Groesse liefert jetzt `tools/lastcheck.ts` |
| G-20 | **Objektzahl war NICHT der Engpass.** 16.684 einzeln montierte Prop-Chunks auf 334-548 gesenkt (Faktor 30) — gemessen auf dem Zielgeraet danach **38 B/s**, also unveraendert im alten Band 23-45. Die Aufraeumung bleibt richtig, erklaert das Ruckeln aber nicht | Messung Zielgeraet 16.08.2026 | 🔴 | Engpass weiter unbekannt. Naechste Kandidaten: Fuellrate trotz dpr-Schalter (Nebel + Gras ueberzeichnen), Shader-Kompilierung, `setSichtbar` beim Gehen. Erst nach dem Spielbaren |
| G-21 | Wind wirkt nur auf die Streuschicht (aus G-19) und die Walddichte (G-17) bleiben geparkt, bis die Spielschleife steht | Entscheidung Flo 16.08.2026 | 📄 | ausdruecklich zurueckgestellt: erst spielbar, dann Feinschliff |
| G-19 | Wind wirkt nur auf die Streuschicht, nicht auf Büsche und Baumkronen | `src/world/streuung.ts` | 🟡 | dieselbe Shader-Technik ließe sich auf Prop-Instanzen übertragen |
| G-16 | Figur **gleitet**, statt zu gehen — keine Animation, kein Rig | `src/spieler/figur.ts` | 🟡 | braucht ein echtes Modell, siehe ADR-0002 |
| G-5 | Kampf-UI ist nicht mit der Szene verbunden | `src/_INDEX.md` | ✅ | Spielschleife steht 16.08.2026: Kreatur ansteuern → Kampf → besiegen oder fangen → Team → Spielstand. Im Browser durchgespielt und **auf dem Zielgerät bestätigt** — erster Fang (Sporenhahn) am 16.08.2026 auf dem Handy |
| G-22 | **Wasser-Kreaturen kommen faktisch nicht vor.** `kiemenbiber` 1 Vorkommen, `moderotter` 0 — das 96×96-Raster über 4 km löst Bäche und Gräben nicht auf, es bleiben 2 Wasserzellen | `npm run vorkommen` 16.08.2026 | 🔴 | nicht der Inhalt ist falsch, sondern die Auflösung. Entweder feineres Raster (`npm run world oental 192`) oder Bäche aus `welt.linien` statt aus dem Biomraster ableiten |
| G-23 | Kreaturen stehen als **Silhouetten** in der Welt, nicht als Modelle | `src/world/kreaturgestalt.ts` | 🟡 | Absicht, solange ADR-0002 gilt (G-2). Vier Bauformen nach `basisRig`, Farbe nach Element |
| G-24 | Drei Move-Wirkungen haben in der Engine keine Entsprechung: zugfreier Wechsel (`steilflucht`), Genauigkeit (`blendlinse`), Fangchance (`faehrte`) | `content/moves/_INDEX.md` | 🟡 | ersatzweise über Statuswerte umgesetzt. Echte Umsetzung ist eine Regeländerung mit Balance-Folgen — gehört ins Kampfsystem-Dokument |
| G-25 | Regenten-Kampf ist nicht erreichbar — der Flussvater steht nirgends in der Welt | `content/regenten/flussvater.json` | 🟡 | braucht einen festen Ort und einen Auslöser. `baueRegent()` in `src/data/inhalte.ts` liefert ihn bereits als Kämpfer |
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
| D10 | React 19 + fiber 9 + drei 10 statt React 18 + fiber 8 + JSX-Shim | Das Original löste den Konflikt mit `react-three.d.ts`, das die fiber-Elemente in `React.JSX` nachtrug. fiber 9 kann das nativ — ein Shim weniger. **Korrektur:** das Original war nicht widersprüchlich, mir fehlte nur diese Datei | 2026-08-16 | — |
| D11 | Inhalte als validierte Daten, nie hartkodiert | Der einzige Weg, 200 Kreaturen beherrschbar zu halten | 2026-08-16 | ADR-0004 |
| D12 | `tools/` für Spiel-Werkzeuge, `scripts/` für Repo-Kit und ROI | Zwei Herkünfte, zwei Lebenszyklen — Vermischung würde beide unklar machen | 2026-08-16 | — |
| D13 | Startposition = Regionsmitte auf der Geländeoberfläche, ein Terrain-Build für Geometrie, Props und Spawn | Ohne sie stand die Kamera 199 m unter Grund und die Szene wirkte leer — kein Renderfehler, eine fehlende Zahl | 2026-08-16 | — |
| D14 | Sichtbarer Boden = LOD-Kacheln; das grobe Terrain bleibt für Wege, Gewässer, Gebäude und die XZ-Verteilung der Props | Zwei Höhenquellen wären Drift; die Props holen ihr Y jetzt aus demselben Höhenfeld wie der Boden | 2026-08-16 | — |
| D15 | Sonne folgt dem Spieler statt ortsfest bei y=55 zu stehen | Das Œntal reicht bis 775 m — eine ortsfeste Schattenkamera liegt unter dem Gelände. Änderte das Bild nicht sichtbar, ist aber unabhängig davon richtig | 2026-08-16 | — |
| D16 | Touch ist gleichwertig, kein Nachtrag: linke Bildhälfte gehen, rechte umsehen | Das Handy ist das Zielgerät. Eine nur mit Tastatur bedienbare Szene lässt sich dort nicht beurteilen | 2026-08-16 | — |
| D18 | Tempo überhöht: gehen 3,0 / rennen 7,0 m/s bei 1:1-Maßstab | 1,4 m/s ist echtes Gehtempo und fühlt sich bei 4 km Region zäh an. Maßstab echt, Tempo überhöht — der übliche Weg, Querung rennend ~9,5 min | 2026-08-16 | — |
| D34 | Fangchance linear (20 % bei voller KP bis 80 % bei leerer), Fangversuch kostet den Zug | Der Spieler soll abschätzen können, ob sich noch ein Schlag lohnt. Eine versteckte Kurve macht daraus Glücksspiel; ein kostenloser Wurf macht Fangen zur dominanten Handlung | 2026-08-16 | — |
| D33 | Kreaturstufe folgt der Entfernung zur Regionsmitte, im Startbereich (150 m) nur Stufe 1 | Schwierigkeit soll aus dem Weg folgen, nicht aus dem Würfel. Gemessen stand ohne diese Regel eine Hallenbrut S3 in 96 m vom Start — das ist keine Kurve, das ist eine Wand | 2026-08-16 | — |
| D32 | Der Spielstand speichert Taten, nicht Welt: Team, gefangene und besiegte Vorkommen, Position | Kreaturpositionen folgen deterministisch aus Weltdaten und Seed. 1.003 Positionen zu speichern wäre Ballast, sie neu zu würfeln wäre nicht wiedererkennbar — dieselbe Rechnung wie bei den 155.000 Props | 2026-08-16 | — |
| D31 | Kreaturen als Silhouetten mit Elementfarbe statt als Modelle | ADR-0002 sperrt echte Modelle bis zur Stil-Referenz. Das Spiel braucht trotzdem etwas Begehbares. Vier Bauformen nach `basisRig` reichen, um im Nebel Art und Element zu erkennen — mehr leistet die Art Direction auf Entfernung ohnehin nicht | 2026-08-16 | ADR-0002 |
| D30 | Sichtbarkeit zentral in einer Verwaltung, nicht je Chunk-Komponente | 16.684 `useFrame`-Callbacks je Bild kosten mehr als alles, was sie sparen. Die Aufräumung war richtig, hat die Bildrate aber **nicht** verbessert (G-20) | 2026-08-16 | — |
| D29 | Qualitaetsschalter im Spiel statt Vermutungen im Code | 23-45 B/s bei 210.000 Dreiecken schliesst Geometrie als Ursache aus. Fuellrate, Ueberzeichnung und Schattendurchgang lassen sich nur auf dem Geraet trennen | 2026-08-16 | — |
| D28 | Wind im Vertex-Shader, nicht auf der CPU | 5.000 Instanzen je Bild neu zu berechnen wäre der teuerste Teil der Szene. Phase aus der Weltposition der Instanz, sonst schwingt die ganze Wiese im Gleichtakt | 2026-08-16 | — |
| D27 | Gebäude-Kollision als achsenparallele Rechtecke, nicht als Polygone | OSM-Grundrisse sind fast immer rechteckig; der Fehler ist ein halber Meter an einer Ecke. Dass man *durch* ein Haus läuft, merkt man sofort — den halben Meter nie | 2026-08-16 | — |
| D26 | Props ab 75 m als Primitiv statt GLB | Gemessen: ohne Attrappen 1,4 Mio Dreiecke am dichtesten Standort, mit 75 m 249.548. Auf Entfernung und im Nebel ist der Unterschied Silhouette gegen Silhouette | 2026-08-16 | ADR-0002 |
| D25 | Schürzentiefe = 0,45 × LOD-Schritt statt fest 3 m | Gemessene Risse: 0,20 m bei LOD0/1 bis 6,97 m bei LOD3/4. Fest 3 m war nah 15-fach zu viel (sichtbare dunkle Wand) und fern zu wenig (offene Risse) | 2026-08-16 | — |
| D23 | Figur steht auf der **gezeichneten** Fläche, nicht auf der stetigen Höhenfunktion | Zwischen Vertices im 2-m-Abstand liegt die Dreiecksfläche unter der Funktion — die Figur schwebte sichtbar auf Kuppen (`hoeheAufFlaeche`) | 2026-08-16 | — |
| D24 | Kollision nur gegen Stämme, Findlinge und Totholz | Durch Unterholz geht man. Alles blockieren macht den Wald unbegehbar, statt ihn dicht wirken zu lassen | 2026-08-16 | — |
| D22 | Belichtung getrennt von den Lichtwerten | Die Lichtwerte sind Art Direction und bleiben. Ob die Szene auf einem Bildschirm ankommt, ist eine andere Frage — dafür gibt es jetzt `belichtung` je Stimmung | 2026-08-16 | — |
| D21 | Oberflächenvariation als **Rauschen im Shader**, nicht als Textur | ADR-0002 verbietet Textur-*Assets* (60-MB-Budget, Stilrisiko). Prozedurales Rauschen kostet null Bytes, ist über Kachelgrenzen und LOD-Stufen stabil und lässt den Biom-Farbton führen | 2026-08-16 | ADR-0002 |
| D20 | **Eine Höhenquelle für alles, was aufsitzt**: `feld.hoehe` aus `baueHoehenfeld` | Zwei Quellen driften — hier um bis zu 24 m. Boden, Props, Streuschicht, Wege, Gewässer, Gebäude und Spawn nutzen dieselbe Funktion | 2026-08-16 | — |
| D19 | Vegetation ist die Ausnahme von Flat Shading und FrontSide-Pflicht | `flatShading` ignoriert Normalen; `DoubleSide` dreht sie bei Rückseiten um und lässt Halme schwarz rendern. Beides live erlebt und einzeln nachgewiesen | 2026-08-16 | — |
| D17 | LOD0 bleibt bei 2 m Vertexabstand | Gemessen: bei 2 m Abtastung kommen bereits **100 %** der Mikrorelief-Amplitude an. 1 m kostet 32.256 → 121.856 Dreiecke für null zusätzliches Relief | 2026-08-16 | — |
