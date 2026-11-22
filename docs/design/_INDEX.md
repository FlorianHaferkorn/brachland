---
last-reviewed: 2026-11-22
shelf-life-days: 180
owns: *.md
---
# docs/design — Verbindliche Design-Dokumente (_INDEX)

> Diese Dateien sind die **Quelle für alles, was gebaut wird**. Sie sind
> simulationsgeprüft (1.200–4.000 Kämpfe je Zeile im Kampfsystem), nicht ausgedacht.
> Bei Widerspruch zwischen Code und Design-Dokument gewinnt das Dokument — oder das
> Dokument wird geändert. Stillschweigend auseinanderlaufen darf beides nicht.
>
> Versionsregel: Eine höhere Versionsnummer **ersetzt** die niedrigere. `Kampfsystem_v2`
> ersetzt `Kampfsystem_und_Roster_v1`; letzteres bleibt nur wegen des Rosterteils.

## „Lies-wenn"-Routing

| Deine Aufgabe ist … | Lies |
|---|---|
| Welt, Ton, Fraktionen, Erzählung verstehen | `BRACHLAND_Kernfunken_v1.md` | D188: Elementarangriffe im Echtzeitkampf — Direktivkerne der Regenten, Laden/Entladen, Wasserfunke umgesetzt, weitere als Entwurf |
| `BRACHLAND_Story-Bibel_v2.md` (v1 nur noch für Vorgeschichte, Regenten, Namensschema) |
| Kampflogik ändern oder Werte balancieren | `BRACHLAND_Kampfsystem_v2.md` |
| Reinigen statt Töten: Regeln, Werte, Messreihe, Belohnung, Dauer je Gegner | `BRACHLAND_Reinigen_v1.md` (§6 je Gegner) → `../../content/reinigen.json`, `../../content/gegner/` → `../../tools/reinigensim.ts` |
| Einen Move anlegen oder ändern | `BRACHLAND_Move-System_v1.md` |
| Eine Kreatur anlegen | `BRACHLAND_Roster-Struktur_v1.md` → `BRACHLAND_Roster_Kapitel1.md` |
| Wissen, was in Kapitel 1 vorkommt | `BRACHLAND_Roster_Kapitel1.md` |
| Modelle beschaffen und aufbereiten | `BRACHLAND_Asset-Workflow_v1.md` → `../WORKFLOW.md` |
| Gebäude, Siedlungen, Bauwerke bauen oder beurteilen | `BRACHLAND_Bauwelt_v1.md` (realer Bestand Inntal-Süd + Verfallsstufen nach dem Kollaps) |
| Entscheiden, wo Enklave und Zufluchten liegen (Erkundung, Flut, Story) | `BRACHLAND_Story-Bibel_v2.md` §4 (entschieden: Hangterrasse, D374) → `BRACHLAND_Enklave_Lage_v2.md` (gesetzte Ortsliste mit Koordinaten, D375) |
| Den Spielbeginn und die Lehrstrecke zur Enklave planen oder umbesetzen | `BRACHLAND_Weg-nach-Brannburg_v1.md` → `../../content/strecken/weg-nach-brannburg.json` → `../../tools/streckensim.ts` |
| Menü, HUD, Einstellungen, Speichern, Tastenbelegung planen oder bauen; wissen, was davon jetzt nötig ist | `BRACHLAND_Menue-und-Einstellungen_v1.md` (§0 Antwort, §9 Phasenplan) → `../../content/einstellungen.json` → `../../src/data/schema.ts` (`Einstellung`) |
| Ein Kreaturenmodell bauen oder beurteilen | `BRACHLAND_Creature-Bible_v1.1.md` → für Wildlinge zusätzlich `BRACHLAND_Stilreferenz_v1.md` |
| Wissen, was Zustände, Narben oder Herkünfte mechanisch tun | `BRACHLAND_Creature-Bible_v1.1.md` → `../../src/engine/battle.ts` |
| Bewegung, Klettern, Schwimmen, Reiten, Gleiten planen; zwei Wege je Ziel | `BRACHLAND_Traversal_v2.md` (v1 nur noch für Auswahl und Gleit-Nachtrag) → `../../tools/traversal_wege.py` |
| Aufträge, Fragmente oder Story-Aufbau planen | `BRACHLAND_Story-Struktur_v1.md` |

## Dokument-Register

| Doc | Inhalt |
|---|---|
| `BRACHLAND_Story-Bibel_v2.md` | **Gültige Fassung seit 22.11.2026 (D374).** Echtzeit-Action-RPG statt Creature-Collector; Messlatte Erlebnis Elden Ring. Marke heilt statt tötet; offene Welt mit zwei Wegen zu jedem Ziel (Werkzeugweg oder beschwerlicher Weg); Œntal: Flut vom Stauwehr (Flutlinie 499 m), Enklave auf der Hangterrasse, versunkene Stadt; drei Enden nach Fraktion über Figuren mit eigenem Weg; Bogen Kapitel 1 |
| `BRACHLAND_Reinigen_v1.md` | **D376, Entwurf mit Regelkern.** Reinigen als Kampfhandlung zur Story-Bibel v2 §2: drei Varianten (Gnadengriff, Greifen in Fenstern, Binden ab dem ersten Bruch), Empfehlung B mit Werten, Messreihe über 1.000 Kämpfe je Zeile (töten / immer reinigen / gemischt, einzeln und zu zweit/dritt), Belohnungsökonomie über ein Kapitel und Wirkung auf die drei Enden. Regelkern in `src/kampf/echtzeit.ts` hinter `Kampfwelt.marke`; Szene, Eingabe und Belohnung nicht gebaut. **D389 (§6 „Dauer je Gegner“):** Kanaldauer und Griffdauer je Tier als Daten in `content/gegner/`, Messreihe je Gegner und Spielerprofil gegen den Zielkorridor, Ausreisser Gams und Wolf |
| `BRACHLAND_Story-Bibel_v1.md` | **Vorgänger, überholt durch v2** in Genre, Marke, Weltstruktur, Kapitelbogen. Weiter gültig: Vorgeschichte VERIDIA/Faulbrand (§2), Regenten (§5), Namensschema (§8), Kapitel-Template (§10) |
| `BRACHLAND_Kampfsystem_v2.md` | **Gültige Fassung (v2.4).** 1v1 nach Pokémon-Schema, Team von 6, Wechsel kostet den Zug; Doppel-Elemente, Fundstücke, Konzentrate — alles simulationsgeprüft |
| `BRACHLAND_Kampfsystem_und_Roster_v1.md` | Vorgänger. Kampfteil **überholt** durch v2; Rosterteil weiter gültig |
| `BRACHLAND_Move-System_v1.md` | Move-System v1.1: planbarer Kern, dynamischer Rand |
| `BRACHLAND_Roster-Struktur_v1.md` | ~200 Kreaturen über 5 Regionen, Entwicklungssystem, Art-Budget |
| `BRACHLAND_Roster_Kapitel1.md` | Œntal: 16 Linien, 35 Kreaturen, 7 der 8 Elemente (Brand erst im Aschefeld) |
| `BRACHLAND_Asset-Workflow_v1.md` | Ergebnis des Kreatur-Spikes: Kette und Kostenmessung |
| `BRACHLAND_Creature-Bible_v1.1.md` | **Oberste Kreatur-Referenz seit 17.08.2026.** Textfassung des Blattes: drei Herkünfte, drei Stufen, vier Zustände, drei Narben — mit den Stellen, an denen Blatt und Code auseinanderlagen, und wer jeweils gewonnen hat |
| `BRACHLAND_Fassaden_Fotoliste_v1.md` | Fotoliste (D291): 44 Gebäude, deren Fassade nach eigenem Foto als Steckbrief in `content/fassaden/` kommt (Story-Orte, Umfeld, Kirchen) — mit Koordinate, LoD2-Silhouette, Aufnahme-Anleitung und Datenformat |
| `BRACHLAND_Bauwelt_v1.md` | **Verbindlich für Gebäude seit 15.11.2026 (D287).** Vorbild ist der reale Bestand (Einfirsthof mit Blockbau-OG, Laube, Flachsatteldach; Kirchen mit Spitzhelm bzw. Zwiebelhaube je Ort), angepasst an 40–60 Jahre nach dem Kollaps: Verfallsstufen 0 bewohnt bis 3 Ruine, Befall nur an Infrastruktur. Typzuweisung aus Grundfläche/Seitenverhältnis/Lage, nicht aus `ebenen`. Recherche mit Quellen |
| `BRACHLAND_Enklave_Lage_v2.md` | **Gültige Fassung seit 22.11.2026 (D375).** Die gesetzte Ortsliste des Œntals nach Story-Bibel v2: Enklave auf der Hangterrasse (sechs Bewohner verteilt), Flutlinie 499 m, Zufluchten in drei Ringen, drei Reinkulturen in drei Richtungen mit Werkzeugweg und beschwerlichem Weg, drei verborgene Orte, drei Fraktionsfiguren mit Stationen — je mit x/z, Höhe und Abstand. Dazu: was davon im Spiel wirkt und was nur Daten sind, wo das Gelände der Bibel widerspricht (Wehr liegt am Ufer, nicht hinter der Flut), drei Namensvorschläge, Kosten eines Spielstarts an der Enklave, Tabelle alt → neu der geänderten Texte. |
| `BRACHLAND_Weg-nach-Brannburg_v1.md` | **D390, Entwurf mit Daten.** Die Lehrstrecke zu Story-Bibel v2 §6 Schritt 0 (D381): Start an der Regionsmitte (0/0, 629 m), 1.182 Wegmeter über Fahrweg, Steig und Furt hinunter zur Magd am Westrand von Brannburg; acht Stationen mit Koordinaten, Lektion, Gegner (Fuchs → Keiler → Keiler → zwei Füchse → Wolf → Grathorn), Bild oder Fundstück; Bot-Messung je Station; wo Werkzeugweg und beschwerlicher Weg liegen; was in `content/` angelegt ist und was davon wirkt; Umsetzungsliste für den fehlenden Code. Das Spiel liest die Strecke nicht, der Spielbeginn ist nicht umgestellt |
| `BRACHLAND_Menue-und-Einstellungen_v1.md` | **D394, Entwurf 22.11.2026, keine Oberfläche gebaut.** Bestandsaufnahme mit Datei:Zeile (Menü, HUD, Eingabe, Speicherstand, 82 URL-Schalter), 14 Regeln mit Quelle, 15 Bildschirme vom ersten Start bis zum Abspann, HUD-Raster, 82 Einstellungen in sieben Gruppen (24 M / 47 S / 11 K), Speichermodell mit Version und Migration, Technik-Notizen (Store, Eingabeschicht, Lokalisierung, Spielphasen) und der Phasenplan „jetzt / vor Fremdtest / vor Veröffentlichung“. Rahmen für Notizbuch (D392) und Ausrüstung (D393), ohne deren Inhalt. Entscheidungen offen in A-29 |
| `BRACHLAND_Enklave_Lage_v1.md` | **Abgelöst durch v2 (D375).** Bestandsaufnahme der Orte mit Koordinaten und Höhen, warum die heutige Lage Erkundung nicht trägt (Regent vor der Haustür, zwei Reinkulturen am Start, Nabe, keine Tore), drei Optionen (Schwelle am Dorf, Hangterrasse, Hochenklave), fünf Fragen an Flo. |
| `BRACHLAND_Stilreferenz_v1.md` | **Verbindlich für Wildlinge seit 16.08.2026.** Ein erkennbares Alpentier, auf dem etwas wächst — Pilzfächer als Leitmerkmal, Signalfarbe nur als Punkt. Schließt ADR-0002. Der Bible untergeordnet |
| `BRACHLAND_Traversal_v2.md` | **Entwurf 22.11.2026 (D388), ersetzt v1 in Fortschrittslogik und Freischaltung.** „Werkzeugweg statt Verbot“ nach D374: Grundbewegung ab Start mit den Werten aus dem Code (Klettern und Schwimmen sind nicht gesperrt, nur Gleiten und Reiten), je Werkzeug (Tauchzeug, Kletterzeug, Gleiter, Reittier) was es abkürzt, wie der Weg ohne aussieht und wo es liegen könnte; die drei Geländepunkte aus D375 (Absetzbecken, kein Gleiten von der Terrasse, Kapelle und Kirchturm im Wasser) je mit Empfehlung und einer Alternative; Übersicht zwei Wege je Ziel im Œntal; Umsetzungsliste. **Seit D391 entschieden (A-25):** alle fünf Empfehlungen gelten; §5 „Wie man die Werkzeuge bekommt“ — Tauchzeug hinter einem Rätsel (Schuppen am Nordufer, Zahl auf der Tafel im Absetzbecken), Kletterzeug über eine Nebenaufgabe des Warts (Stollenmund, Lager am Bruchweg), Gleiter bei einem optionalen Boss (verhärtetes Grathorn am Quelltopf), Reittier über eine Nebenaufgabe des Försters (drei Keiler reinigen, Halfter), mit Beleg, dass keines ein anderes voraussetzt. Nichts gebaut |
| `BRACHLAND_Traversal_v1.md` | **Abgelöst durch v2 (D388).** Auswahl gegen Enshrouded (Ausdauer, Springen, Klettern, Schwimmen, Reiten, Gleiten), Reihenfolge und Freischaltung (überholt), Nachtrag Gleitverhältnis 3:1 (gilt weiter) |
| `BRACHLAND_Story-Struktur_v1.md` | Vier übliche Bauweisen, Auswahl für BRACHLAND (kritischer Pfad + Fragmente + Weltzustand, keine Nabe), Auftrags- und Fragmentschema |
| `BRACHLAND_Luecken_v1.md` | **Befund 20.08.2026, keine Entscheidung.** Systeminventar gegen Pokémon Legends: Menü, Karte, Beutel, Team, Index fehlen vollständig; der Kern (Kampf, Fangen, Fortschritt, Traversal) steht. Rechnet nach, warum der Regent unauffindbar ist (1381 m gegen 420 m Sicht, keine Peilung, kein Auftrag), was am Kartenrand passiert (unsichtbare Wand 8 m vor einer freischwebenden 0,9-m-Kante) und woraus ein Haus besteht (Median 94 Dreiecke, eine Dachform). Widerspricht zwei Vorgaben mit Zahlen: „alle Assets auf Fuchsniveau" sprengt das Gerätebudget um das Zehnfache, und von fünf Kategorien für generierte Assets tragen nur **Felsen und Haus-Module**. Schlägt drei Züge in fester Reihenfolge vor |

## Umsetzungsstand

Von 35 Kreaturen aus Kapitel 1 ist **eine** als Inhalt angelegt (`content/creatures/grathorn.json`,
3 Mutationsstufen als GLB). Das Move-System ist im Schema abgebildet, aber
`content/moves/` ist leer. Ledger B-9.
