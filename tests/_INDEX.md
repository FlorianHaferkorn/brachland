---
last-reviewed: 2026-10-18
shelf-life-days: 90
owns: *.test.ts
---
# tests — Was festgehalten wird (_INDEX)

> Läuft über `tsx`, kein Testframework. Jede Datei ist ein Programm, das Zeilen
> ausgibt und mit Code 1 endet, wenn etwas nicht stimmt. `npm run test` hängt sie
> aneinander, `make check` ruft das auf.
>
> **Kein Test hier prüft, dass Code läuft.** Sie prüfen Aussagen, die man beim
> Ändern versehentlich umkippt — und fast jede davon steht hier, weil sie schon
> einmal falsch war.

## „Lies-wenn"-Routing

| Deine Aufgabe ist … | Lies |
|---|---|
| Hausfront-Räume, Fenster-UV oder Haus/Garten-Attribute ändern | `hausfront.test.ts` → `../src/world/terrain.ts`, `../src/world/baender.ts` |
| Referenzhaus oder lokale Bauteile ändern | `referenzhaus.test.ts` |
| Hofauswahl oder freie Eingänge ändern | `hofhaeuser.test.ts` |
| Geometriepuffer gruppieren und kopieren | `kachelgruppen.test.ts` | D311: Puffer bei Sortierwechsel behalten. D328: gestaffelte Kopien ergeben identische Indizes, Attribute und Hüllkugeln. |
| `hausindex.test.ts` |
| Materialarbeit im Hofshader sparen | `hausspar.test.ts` |
| Fensteröffnungen, Scheibentiefe und Laibungen ändern | `fenstertiefe.test.ts` → `../src/world/terrain.ts` |
| Lagerton oder Audio-Freigabe bei erster Eingabe ändern | `lagerton.test.ts` → `../src/ton/lagerton.ts` |
| EZ-Baum-LOD bei schnellen Richtungswechseln ändern | `ezlod.test.ts` → `../src/scenes/ezlod.ts` |
| Geometriekompression oder Bauwerk-Export ändern | `bautenpack.test.ts` → `../tools/bautenpack.ts` |
| Kampfregeln, Elemente, Fokus oder Phasen ändern | `battle.test.ts` → `../src/engine/battle.ts` |
| Echtzeitkampf: Fenster, Reichweiten, Kosten, KI ändern | `echtzeit.test.ts` → `../src/kampf/echtzeit.ts` |
| Waffenclips oder ihre Regelzeiten ändern | `waffenclips.test.ts` → `../tools/waffenclips.py`, `../src/kampf/echtzeit.ts` |
| Schwierigkeit prüfen (ganze Kämpfe mit Reaktionszeit) | `kampfbot.test.ts` → `../tools/kampfbot.ts` |
| Reinigen (Marke): Fenster, Griff, Kosten, Risiko, Dauer je Gegner ändern | `reinigen.test.ts` → `../content/reinigen.json`, `../content/gegner/*.json` (`reinigen`), `../src/kampf/echtzeit.ts`, `../tools/reinigensim.ts` |
| Die Witterungsanzeige oder eine Richtung anfassen | `peilung.test.ts` → `../src/spieler/peilung.ts` |
| Kamera bei Zielaufschaltung (Schulter, Gegneransicht) ändern | `sichtlinie.test.ts` → `../src/kampf/sichtlinie.ts` |
| Eine Blender-Szene neu exportieren oder an der Kollision drehen | `staemme.test.ts` → `../tools/staemme.ts`, `../src/spieler/kollision.ts` |
| An der Tonwertkurve (`LOOK_GAMMA`, `LOOK_S`, AgX) drehen | `tonwert.test.ts` → `../src/scenes/tonwert.ts` — Sollwerte neu **messen** |
| An Erfahrungskurve, Stufen oder Mutation drehen | `fortschritt.test.ts` → `../src/spiel/fortschritt.ts` |
| Klettern, Springen oder Zehrraten ändern | `ausdauer.test.ts` → `../src/spieler/ausdauer.ts` |
| Auftragsziele oder Vorbedingungen ändern | `auftraege.test.ts` → `../src/spiel/auftraege.ts` |
| Reiten oder Waten ändern | `reiten.test.ts` → `../src/spiel/reiten.ts`, `../src/world/wasserfeld.ts` |
| Zustände, Narben, Volltreffer, Genauigkeit oder Move-Wirkungen ändern | `zustaende.test.ts` → `../docs/design/BRACHLAND_Creature-Bible_v1.1.md` |
| Am Gleitverhältnis, an Tempo oder Schwerkraft drehen | `gleiten.test.ts` → `../src/spieler/gleiten.ts`, `../src/spieler/tempo.ts`, `npm run gleit` |
| Fallschaden, Endgeschwindigkeit, Kälteuhr, Renn-/Reit-/Klettertempo oder `?renntempo=` ändern (D412) | `bewegung.test.ts` → `../src/spieler/bewegung.ts`, `../content/bewegung.json` |
| Am Biomraster, an der Siedlungsregel oder der Prop-Verteilung drehen | `siedlung.test.ts` → `../src/world/osm.ts`, `../src/world/props.ts` |
| An der Teamreihenfolge oder am Beutel ausserhalb des Kampfes drehen | `menue.test.ts` → `../src/spiel/team.ts`, `../src/spiel/gegenstaende.ts` |
| Am Speicherformat, an der Migration, an Plätzen oder Export/Import drehen (D415) | `speicherformat.test.ts` → `../src/spiel/speicherformat.ts`, Beispielstände `staende/` |
| Reviere, ruhig/leer, Verhärtung, Nachwachsen, Zähler „vertraut“ oder die Revierökonomie ändern (D416) | `reviere.test.ts` → `../src/spiel/reviere.ts`, `../content/reviere/`, `../content/oekonomie.json` `reviere` |
| Eine Einstellung, die Rangfolge oder die Qualitätsautomatik ändern (D415) | `einstellungen.test.ts` → `../src/spiel/einstellungen.ts`, `../src/spiel/qualitaetsvorschlag.ts` |
| Eine Taste, eine Aktion oder das Gamepad ändern (D415) | `eingabe.test.ts` → `../content/belegung.json`, `../src/spieler/eingabe.ts`, `../src/spieler/gamepad.ts` |
| Pause, Tab-Wechsel oder Kontextverlust ändern (D415) | `spielphase.test.ts` → `../src/spiel/spielphase.ts` |
| `ezlod.test.ts` | Prüft stetige, lückenlose Dreistufenblenden auch bei schnellen Wechseln und Richtungsumkehr. |
| `propauswahl.test.ts` | Die zwei Prop-Listen dürfen keinen Chunk verlieren. Seit die Attrappen gebündelt werden (G-111), wird die Nahliste alle 8 m neu bestimmt und das Bündel alle 60 m. D157 prüft Baumvarianten über alle Stufen; D158 den Randfall, dass ein neuer Fernanker trotz gerade erfolgter Nahbewertung beide Listen erneuert. Geprüft wird zusätzlich ein **Lauf** über 76 Schritte: jeder Chunk in Reichweite steht genau einmal |

## Register

| Datei | Was festgehalten wird |
|---|---|
| `heldmaterial.test.ts` | D343: Kleiderprobe vor dem Skinning, ursprüngliche Farb- und Normalenkarten, getrennter Hautshader und Materialrückfall. |
| `lagerton.test.ts` | Vorbereitung ohne Klangquellen und synchrones Resume bei Eingabegeste; eine Kontextinstanz bei mehreren Gesten sowie Fallback nach verweigerter Vorbereitung. |
| `bautenpack.test.ts` | Tatsächlicher Runtime-Decoder: Attribute, Weltmatrizen, Materialwerte/-gruppen, Namen und orientierte Dreiecke bleiben beim verlustfreien Meshopt-Roundtrip erhalten; Quellschutz und Größenstabilität bei Wiederkompression. |
| `echtzeit.test.ts` | 188 Prüfungen (Stand D355; D355: Richtungskampf aus), das Kampftor (D166–D170): Reichweite ±5 cm, Winkel, ein Treffer je Schwung, Rollenfenster in 5-ms-Schritten (≥ 200 ms, nach Reaktionszeit erreichbar), Ausdauer 5 Schläge/4 Rollen, Haltung bricht beim 2. Treffer, Zielwahl, KI aus 12 Anlaufrichtungen, Angriffsrecht: zwei Gegner nie zugleich im Schlag, im Wechsel, der Wartende ausser Reichweite (D167), Waffenklassen als Werkzeuge statt Stufen und Zielwahl/Zielwechsel (D168), der Keiler als erster echter Gegner (D169), Zucken, Pille statt Kreis und der Grathorn (D170), Moveset/Puffer/Kette/Vorschritt/Rückstoss/Trefferstopp und der Wolf mit Doppelbiss (D171), das Rudel umzingelt (D172, 130 Prüfungen), gleiches Ergebnis bei 10/30/144 B/s. Druckt die Messtabelle |
| `waffenmodelle.test.ts` | D421: `waffen.glb` ohne Entpacken gelesen — Spitze, Ende und Länge jeder Kampfwaffe (Klinge, Axt, Speer, je Stufe 3) ±1 cm wie vor D421 (Reichweite hängt an der Länge), Ursprung (Hand) im Griff, Gewicht (`masse_kg`) im Anker, kein Gold, Axt mit einer Schneide nach −X, Stahl heisst `Steel` (Schmiedestufe) |
| `waffenclips.test.ts` | D171: Scheitel und Durchzug jedes Schlags (`hieb`, Clipsekunden) liegen auf Schlüsselbildern von `tools/waffenclips.py`, Haltungen sind Schleifen, `menschbau.ANIM_WAFFEN` = `waffenclips.CLIPS`, die Waffendatei trägt jeden gebrauchten Clip, die Wanderin keinen; seit D414 die Messerhiebe aus `TREFFER` (Scheitel/Durchzug auf Schlüsseln, Füsse stehen im Schlag, Gewicht nach vorn, Hüfte führt, Bogen ≥ 60°, Ausholen zwischen Klinge und Axt), neue Clips in `held-clips.glb`, Modelle in `waffen.glb`, Clips in `waffenfamilien.json`/`geraete.json` |
| `reinigen.test.ts` | D376/D389: 115 Prüfungen — der Schalter (ohne `Kampfwelt.marke` keine Handlung; eine unbenutzte Marke ändert über 12 s keinen Teilschritt), das Fenster (erst unter der Schwelle; betäubt, Erholung oder lauernd; Menschen nie, Verhärtete nur mit Reinkultur, nichts ohne Ladung), der Griff (hält `halten` s, Fortschritt bleibt und verfällt, mehrere Griffe, Ergebnis `gereinigt`), das Risiko (Treffer ×`verwundbar`, bricht und kostet Fortschritt; Lösen dauert) und ein kleines Band aus `../tools/reinigensim.ts` (40 Kämpfe je Zeile: einzeln langsamer, aber unter doppelt; zu zweit teurer, nie aussichtslos). **D389:** jedes Tier in `../content/gegner/` trägt `reinigen` (kein Mensch, kein Übungsgegner), die Regeln rechnen mit Dauer und Griffdauer des Gegners und fallen ohne sie auf die Grössenformel zurück, Griffzahl im Band `griffe` aus `../content/reinigen.json`, Schema lehnt `reinigen` bei Menschen ab ausser `freiwillig` (D385), die Gams liegt ihre eigene Griffdauer, Auswertung `bewerte` gegen den Zielkorridor, Keiler und Fuchs bleiben unter 1,5× der Tötungszeit |
| `kampfbot.test.ts` | D171/D172: Band statt Punkt — einzeln gewinnt ein aufmerksamer Bot ≥ 90 %, zu zweit ≥ 60 %, das Rudel (drei Wölfe) ≥ 40 % und schlägt einen müden meistens; kein Kampf läuft in die Zeitgrenze (28 Zeilen à 60 Kämpfe) |
| `schmiede.test.ts` | D177: Stufen enden bei 3, bezahlt wird nur, was im Beutel ist, eine geschmiedete Klinge trifft im Echtzeitkampf härter |
| `oekonomie.test.ts` | D393/D400/D405, 103 Tests (D405: Zähler gewichtet — Heiler und Umgeher unter 40, bei 30 nur der Umgeher; Befund „Heiler schlägt Umgeher bei 40“ festgehalten; Wirken kostet Reinigungen; Waffenfamilien 6–8, etwa fünf in Kapitel 1; D400: Dauersud braucht Bruchstücke und Bossteil, Mark trägt nur Leben, Einsicht nie aus Beute, Technik mit Kampfwert braucht Messung, keine der vier Spielweisen schlägt eine andere auf sechs Achsen; D398: jedes Stück hat ein Gewicht, ein volles Bündel wiegt höchstens 10 kg): jede Belohnungs-Kategorie löst sich auf; Mengenware je Sprosse, derselbe Schlüssel gibt dasselbe; **kein Unikat zweimal** (Wunsch geht vor, leerer Vorrat ist ein Fehler); Markenstufe, Fassung, ruhiges Revier; Schmiede in Material, Flasche gedeckelt; beim Tod bleibt nur loses Material liegen; Überschlag Œntal: keine kämpfende Spielweise schlägt eine andere auf beiden Achsen → `../src/spiel/belohnung.ts`, `../src/spiel/oekonomie.ts` **D416:** Zähler aus `misstraut` gelesen; `bilanz` (Annahme 12 Reviere) unverändert — die echten Reviere prüft `reviere.test.ts`. |
| `baukasten.test.ts` | D403, 37 Tests: **der Referenzbau jeder Familie ergibt die heutige Waffe bitgleich** (Datei und `WAFFEN`); Körper in echten Einheiten (Klinge 1,0–1,3 kg); Richtung jeder Ableitung (langer Hebel langsamer, weiter, härter, teurer; Stoss gegen Drehung beim Speer); Aktivfenster, Bogen, Clip, Linie, Schritt bleiben unberührt; Tempo aller 33 Formen in ±25 %, Reichweite in ±0,35 m; Materialgüte = Schmiedefaktor der Stufe; Preise nennen vorhandene Gegenstände → `../src/kampf/baukasten.ts` |
| `geraete.test.ts` | D410, 47 Tests: Geräte nutzen das **vorhandene** Elementsystem (gleiche Dämpfung wie `funkenFaktor`); Schwächen der fünf Tiere aus `content/gegner/` abgeleitet; gegen jedes Tier wirkt in Kapitel 1 ein Gerät stark, keines gegen alle; kein Aufsatz reicht weiter als der weiteste Hieb; die Räucherkanne kann nicht töten, das Abflammgerät immer; was nicht tötet, läuft auf nachwachsendem Stoff → `../src/kampf/geraete.ts` |
| `battle.test.ts` | 16 Tests: Elementmatrix ausgewogen, Fokus-Ökonomie, Elementvorteil entscheidet, Phasen erzwingen Wechseln, Zehrung, Determinismus, Kampfdauer im Korridor |
| `peilung.test.ts` | 11 Tests. Anlass war ein **Vorzeichenfehler**, der nur bei Blickrichtung 0 unauffällig war — der Pfeil zeigte beim Drehen in die falsche Richtung |
| `sichtlinie.test.ts` | D192: Stamm zwischen Schulterkamera und Ziel zieht den Arm ein; Stamm nur neben dem Ziel nicht; Versatz zählt mit; feste Probenweite (0,3 m) überspringt keinen Stamm — mit 12 Proben je Strecke passiert |
| `tonwert.test.ts` | D199: `agxMitLook` (CPU) trifft den Shader `CustomToneMapping` — 34 in Chromium gemessene Farbproben bei Belichtung 2,4 und 2,5, Toleranz 1/255. Hält `npm run licht` auf der Kurve, die das Spiel zeigt |
| `nebel.test.ts` | D204: `nebelAnteil` (CPU-Kopie des Nebel-Shaders) — Mittelbereich wie das alte `smoothstep`, Decke `NEBEL_MAX`, monoton, Höhendunst nur über der Kamera |
| `hofgruen.test.ts` | D299: lokale Baumwahl ohne Verlust/Duplikate oder Seedänderungen; Strauchvarianten bleiben in der Mittelstufe erhalten. |
| `hofstrauch.test.ts` | D299: deterministische Geometrie/UV, korrekte Meterhöhe und Bodenstand, gültige Attribute und Windgewichte. |
| `ezblattschatten.test.ts` | D300: gezeichnetes Tiefenmaterial behält trotz three.js-Überschreibung bei Alpha-to-Coverage die Nadel-/Laubschwelle der Farbkarte. |
| `hofbodenintegration.test.ts` | Reale Hofhäuser mit Sockelkontakt, Trittplatten, Verfallsstufen und gezeichneter Ranke. D322 und D323 prüfen weitere Straßen und die Giebelfuge zwischen 308 und 346. D329 prüft die drei Nutzungszustände, D330 die Öffnung bei 508 und Blatt- und Rahmenattribute. D331 und D335 prüfen Dachmaße, Fenstervertiefung und den Regenläufer am offenen Bruch. D340 prüft die amtliche Firstspanne und den lokalen Dachschalter. |
| `hofbodenkontakt.test.ts` | D307: Pixelzentren, Auswahl, Maskenverlauf und ausgesparte Grundrisse. D342 prüft gültige Milbinger Fassadenabstände, freie Türvorfelder und getrennte Atlasteile. |
| `hofboden.test.ts` | D307: Lokalität, Stetigkeit und freie Türvorfelder der CPU-/GLSL-Bodenmasken. |
| `hofsockel.test.ts` | D307: geschlossene Sockelkörper, stetige Endhöhen, Türspalten und Bodenanschluss am gewellten Hang. D336 prüft Frostabtrag bei durchgehender Sockelkappe. D342 prüft eingebettete Feldsteinfronten, Gehrungen und freie Wandstöße. |
| `strassenquerschnitt.test.ts` | D337: Übergänge zum Wegband, Bordhöhe an Zufahrten und Freihaltung im GPU-Grasraster. D338 prüft Abmessungen und Materialkoordinaten. D339 prüft den Beginn der Fahrspuren hinter dem Gehweg sowie Erdanschluss und Flankenbewuchs. D340 prüft die Höhen an Geländeknick, Bord und Einfahrt sowie den DGM1-Auslauf. D346 prüft Randabtrag, Schutzbereiche und Fahrbahnhöhe. |
| `fernring.test.ts` | D349–D351: Œntal voll und halbiert (D350 spart > 15 %), Fahlmoos halbiert. DGM1-Ring auf dem groben Fernraster (vier Feinlinien je Zelle), Treffer an den Stützpunkten < 1 cm, Ringrand ohne Stufe zum groben Raster, alle Dreiecke nach oben. |
| `efeuwuchs.test.ts` | D359: 40 Saaten × 3 Stärken — Wurzeln am Boden, nichts über Traufe und Wandrand, Fenster frei (ausser bei Verfall), Triebe überwiegend aufwärts, oben lichter als unten, schwacher Bewuchs nicht höher als starker. |
| `streukarten.test.ts` | D361/D366: unter der Krone geschlossene Decke (> 90 % der Punkte im dichten Kartenkern), Laub unter Buche, Nadeln unter Fichte, auf der Wiese jenseits Krone + 1 m nichts, Decke > 3 × dichter als die Inseln; D361: Bodenstreu deterministisch je Zelle, Wald dicht, Wiese < 1/5, Wasser frei, Karten 1,5 cm über dem Gelände und nach der Neigung gekippt, Streckung in Toleranz, gehäuft statt gleichmässig (Variationskoeffizient in 5-m-Feldern > 0,45). |
| `atmosphaere.test.ts` | D368: physikalischer Himmel (`?himmel=physik`) — klare Luft gibt blaues Zenit, die Luft von `zielbild` ein warmes nahe am Kunstwert; Kopplung hält Helligkeit von Nebel, Sonne und Fülllicht und alle Stärken, Fernland-Dunst = Nebel; tiefe Sonne wärmer; Tabellen unter 400 ms je Stimmung. |
| `bodenpflanzen.test.ts` | D366: Bodenpflanzen deterministisch, nur auf Waldböden (nicht Wiese, Wasser, Siedlung, Acker), Sauerklee im Schatten unter der Krone, Brombeere im Licht, Moos auf Kuppen statt in Mulden, Felder 3 cm über Grund, Büschel senkrecht und höchstens 25 % über der Massstab-Spanne. |
| `hofbau.test.ts` | D363: Hof-Baukasten-Lage aus dem Grundriss — gedrehtes Rechteck 36 × 14 m: Masse, Modellmitte auf der Grundrissmitte (< 0,1 m), Höhe an der tiefsten Ecke, Gebäude als ersetzt gemeldet. |
| `hoftrittplatten.test.ts` | D307: geschlossene Platten, Außennormalen, Schwellenabstand und Hangkontakt. |
| `hofplatz.test.ts` | D298: Grundrissauswahl, Hofmaske und Ausschluss des Hausinneren; Scan-Shader-Hook bleibt beim Klonen für Wind erhalten (33 Prüfungen, einschliesslich deterministischer Randgruppen und gesperrter Wege). |
| `referenzhaus.test.ts` | D303: lokale Auswahl, echte Fenster-/Türtiefe, Umlauf, UV und vollständige Geometrieattribute. |
| `hausindex.test.ts` | D305: exakte Rückexpansion, harte Kanten/UV/Seeds, Hashkollisionen, Vorzeichen von Null, 16-/32-Bit-Grenze sowie reales Haus-/Garten-Merge. |
| `hausspar.test.ts` | D305: Shader-Gegenläufe, Gradienten vor räumlichen Zweigen, vollständige Rauheits-/Glas-/Glutpfade und unveränderter Rückfall. |
| `laubenkasten.test.ts` | D306: geschlossene Pflanzkörper, Rand/Erde, Außenwinding, Fläche/Budget, Determinismus und örtliche Hausintegration. |
| `hofhaeuser.test.ts` | D304: begrenzte Hofauswahl, freie Eingänge trotz Garagen/Nachbarn, Gebäudemitte und Integration der Referenzbauteile. |
| `hausfront.test.ts` | D297: Raum-UV/Seed auf allen Scheibenecken und neutral auf anderen Bauteilen, vollständige Fenster-UV und deterministische Varianten bei 0°/37°; Raycasts auf obere Scheiben entdecken verbliebene opake Vorhänge; Gärten mit neutralen Raumdaten, Haus/Garten per mergeGeometries gemeinsam renderbar; Pflegezone: Kanten, Ecken und 1,6-m-Grenze, Wald ausgeschlossen (31 Prüfungen) |
| `hauspom.test.ts` | D365: POM-Gewicht nach Abstand/Winkel, Lagenzahl 8–24, Strahlschleife (ebene Fläche ohne Versatz, voller Versatz bei überall tief, Stufenkante getroffen), Shadertext (feste Schleifengrenze, Umleitung der Weltlage). |
| `wandlage.test.ts` | D387 („Putzkorn“): rechnet mit 32-Bit-Zahlen nach, wie weit die Wandkoordinate springt, wenn die Wandnormale aus Bildschirm-Ableitungen der Weltlage kommt (2 m: über 1 m, 10 m: Dezimeter, 40 m: mehr als ein Pixel), und sperrt den Rückfall in `hausmaterial.ts`/`hauspom.ts` (Normale aus dem Eckenattribut, Flächenart gerundet, Verfallsrauschen bandbegrenzt). |
| `fenstertiefe.test.ts` | D296: erzeugte Hausgeometrie bei 0°/37°, Fenster an allen vier Fassaden; Frontstrahlen passieren die Fassadenebene und treffen Scheiben 18 cm dahinter, schräge Strahlen die nach innen gerichtete Laibung; vollständige Attribute, endliche Normalen, keine entarteten Dreiecke, Glut nur auf Scheiben |
| `staemme.test.ts` | G-136: Jede Blender-Szene hat Stämme im Kollisionsfeld (≥ 100, alle im Freihalte-Radius, also richtige Achsenlage), der Stauwehr-Stamm aus dem Lock-On-Video ist bekannt und verdeckt die Sicht, `public/bauten/staemme.json` passt zu den GLB |
| `fortschritt.test.ts` | 20 Tests. Anlass: Die erste Kurve machte Kreaturen bei der Mutation **schwächer** (L13 = 184 KP, L14 = 162 KP). Hält jetzt Monotonie und die Zahl der Kämpfe je Mutation fest |
| `ausdauer.test.ts` | 22 Tests. Hält die Kletterhöhe als **Rechnung** fest (bis D412 16/s × 2,2 m/s, seither rund 7,3/s × 1,0 m/s = 13,75 m gegen 14 m Klippe; Tempo aus `tempo.ts`, nicht mehr abgeschrieben) und die Hysterese am Nullpunkt. D412: Hysterese- und Ruheprobe laufen jetzt bis zum Nullpunkt aus der Rate (vorher feste 7 s bzw. 4 s) |
| `bewegung.test.ts` | 62 Tests (D412, D413: +12 für Rollfenster und die Folge im Kampf). Fallschaden am Aufprall (Sprung und Gleiterlandung schadlos, 4,5 / 9,75 / 15 m, Rolle halbiert, tödlich hilft keine Rolle), Endgeschwindigkeit 53 m/s (500 m Fall in der Bildschleife nachgestellt), Kälteuhr (4 / 7 / 10 min, Ufer, Anzug, Kapelle knapp, Kirchturm ohne Anzug nicht), Tempi aus D411 (Rennen unter dem Weltrekord, Sprungweite 9,4 m), `?renntempo=` lässt nur Probewerte zu; Schema und Traglast des Tragtiers (Entwurf) |
| `strecken.test.ts` | 26 Prüfungen (D390). Schema `Strecke`: fünf bis acht Stationen, erste kampffrei, Bild oder Fundstück je Station, Werkzeugweg nennt sein Werkzeug, unbekannte Lektion/Feld abgelehnt; über die echten Dateien: jede Lektion kommt vor, Reihenfolge aus D381 (erster Kampf → Reinigen → Rast → Kampf am Tor), jeder Gegner hat eine Datei in `content/gegner` |
| `wanderfiguren.test.ts` | 24 Tests (D375, D392: Zähler der Mönche `eingriffe` — Töten und Reinigen zählen gleich, Regent nicht, Schwelle). Station einer Fraktionsfigur aus dem Weltstand: weiterziehen, verpassen, `ab` vor dem Erscheinen, fort nach der letzten; über die echten Dateien: jede Station ist in irgendeinem Verlauf erreichbar |
| `notizbuch.test.ts` | 18 Tests (D392). Das Heft als Sicht auf den Spielstand: Wortlaut und Reihenfolge, Auftrag erst nach dem Annehmen und nie mit Ziel, Satz einer Wanderfigur je gehörter Station, alter Stand ohne Stationsvermerk, unbekannte IDs; über die echten Dateien: die vier Aufträge aus D392 tragen `lohn` nach Vertrag, beide Hälften des Spind-Rätsels stehen in der Welt |
| `auftraege.test.ts` | 28 Tests. Der Fortschritt wird abgeleitet, nicht gezählt — geprüft wird unter anderem, dass `schneehuhn` nicht `schneehuhn-alt` mitzählt |
| `heilung.test.ts` | 15 Tests (D240, D241 `wildZustand`): unbesiegt oder unvollständig heilt nicht, je eine Komponente verbraucht, Eingabe unverändert, zweimal heilen geht nicht |
| `stube.test.ts` | 40 Tests (D242): jede Raumart ohne NaN, in ihren Wänden, Anker (Fenster, Glut, Figur, Kamera) am richtigen Ort, fest je Id |
| `region.test.ts` | 21 Tests (D248, ADR-0014): Region aus der Adresse, Kante aus der Position (Nord ist −z), Nachbarn aus `content/regions/`, Ankunft an der Gegenkante, andere Schalter bleiben beim Hinübergehen erhalten; ohne Adresse behält das Œntal seine Blender-Szenen |
| `weltbau.test.ts` | Multipolygon-Relationen mit Lichtungen, Moorbiom und Kompatibilität alter Weltdateien. D333 prüft den Rundlauf der OSM-Straßenattribute und den Umgang mit uneindeutigen Breiten und Beleuchtungswerten. |
| `impostor.test.ts` | D367: Impostor-Ansicht passt zur Bake-Richtung (`tools/baumbau.py`), Instanzdrehung und Mischung zwischen Nachbaransichten; Register trägt je Fernbaum Rahmen und Atlanten. |
| `zustaende.test.ts` | 38 Tests zur Creature Design Bible v1.1. Hält drei Befunde fest, die beim Zusammenführen von Blatt und Code herauskamen: **Resistenz und Verteidigung wären derselbe Effekt gewesen**, **Krit gab es nicht**, und **Move-Effekte wurden nie angewendet** — `moveDef()` warf sie weg |
| `menue.test.ts` | 25 Tests an den zwei Stellen des Menüs, an denen ein Fehler still bliebe. **Teamreihenfolge:** Sie steht an zwei Orten (Team und `erfahrungRef`), und laufen die auseinander, trägt die falsche Kreatur die falsche Erfahrung — sichtbar erst beim nächsten Stufenaufstieg. **Beutel ausserhalb des Kampfes:** `wendeAn` behauptet seit jeher, „Kampf und Beutel ausserhalb" gleich zu bedienen; aufgerufen hat es bis 20.08.2026 nur der Kampf. Der Kräutersud wird direkt aus `content/` gelesen und gegen dasselbe Zod-Schema geprüft, nicht als Attrappe — der Inhaltslader benutzt `import.meta.glob` und läuft ausserhalb von Vite nicht | **D415:** „Spielstandversion nicht gesprungen“ wird zu „Versionssprung nur mit Migration“ (Version 2, `MIGRATIONEN[1]`) — der Schutz liegt jetzt in `speicherformat.test.ts`
| `speicherformat.test.ts` | 43 Tests (D415). Zwei echte v1-Formen unter `staende/` (`v1-oental-unterwegs.json` mit allen Feldern bis D413, `v1-frueh-ohne-neue-felder.json` ohne die später ergänzten) laden **ohne Verlust**, Feld für Feld; der alte Schlüssel `aktuell` bleibt liegen; kaputt / neuere Fassung / fremd: aufbewahrt unter `sicherung/`, gemeldet, Rückfall auf die Rast; ein ungültiger Stand überschreibt keinen guten; Export/Import mit Prüfsumme (übersteht Umformatieren, nicht ein geändertes Feld). Die Beispielstände sind nach dem Code von `speichereStand` gebaut, nicht aus einem Browser exportiert **D416:** Version 3 — ein echter v2-Stand (`staende/v2-oental-mit-wild.json`) migriert ohne Verlust (jedes Feld, `geschrieben` bleibt), `begegnungen` leer, `reviere` ohne Rast; v1 läuft über die ganze Kette; `KOMMT_SPAETER` nennt die Eingriffe nicht mehr.
| `reviere.test.ts` | D416, 72 Tests: Lage (Zufluchten und verborgene Orte im richtigen Revier, `revierAnGeo` = `revierAn`, zwei Regionen nebeneinander nach ADR-0020), Schnittstelle D417 (`vermerkeBegegnung` hängt an, rundet, zählt dieselbe Meldung einmal, verwirft Ungültiges), Zustand aus `besiegt`/`gefangen` über die Zelle der Vorkommen-ID ohne Doppelzählung, Schwellen aus `oekonomie.json` (ein Griff befriedet nicht, ein Tod leert nicht), Marke an der Rast, Zähler vertraut/geduldet/abgewandt mit der echten Station, Rast: jedes zweite leere Revier zieht einen Verhärteten nach, Nachwachsen ab Rast 3, höchstens die Hälfte, nie ins ruhige Revier, nie nach der Heilung, nie ohne befallenen Nachbarn; Ökonomie mit echten Revieren: keine Spielweise dominiert, in beiden Bezügen |
| `einstellungen.test.ts` | 42 Tests (D415). Rangfolge Adresse › gespeichert › Stufe › Standard, Adresse wird nie gespeichert, Ungültiges/Unbekanntes fällt beim Laden weg, gesperrter Speicher läuft für die Sitzung, Stufenwechsel meldet die mitgezogenen Werte; Qualitätsvorschlag (M1 → Hoch, SwiftShader → Niedrig, RTX ohne WebGPU-Pfad → Hoch, Handy/4 Kerne höchstens Mittel) und Bildzeit-Anpassung. Logik, nicht Richtigkeit am Gerät
| `eingabe.test.ts` | 42 Tests (D415). Jede Taste, die vor D415 fest im Code stand, liegt auf derselben Handlung (26 Aktionen), ausser Blick heben/senken R/F → T/G; keine ungeduldete Kollision (Q/E und F in getrennten Spielzuständen, die vier Pfeile als Bestand D174 geduldet); freie Belegung meldet Kollisionen, hält Sperrliste und Esc fest; Gamepad: Totzone radial und neu skaliert, LT/RT-Schwelle, B tippen/halten, Stickruck
| `spielphase.test.ts` | 18 Tests (D415). Menü = echte Pause, verborgener Tab pausiert und bleibt pausiert bis „Fortsetzen“, Kontextverlust lässt sich nicht wegklicken und wird gemeldet, Ereignisse beim Laden wirken danach, Sichern beim Verbergen nie im Kampf
| `siedlung.test.ts` | 9 Tests an einer Kunstwelt: 400 × 400 m Wiese, zwei Häuser 12 m auseinander, eines 150 m entfernt allein. Prüft, dass zwischen den zwei Siedlung entsteht, dass die einzelne Hütte Wiese **bleibt** (D77), und dass kein Prop in einem Grundriss landet (G-82). Bewusst an einer Kunstwelt statt an `oental.json`: Eine Prüfung gegen die Datei bestünde, solange die Datei alt ist |
| `gleiten.test.ts` | 34 Tests (D412: +3, der Testfall fällt jetzt mit Endgeschwindigkeit; „Aus 400 m > 80 m/s“ ersetzt durch „= 53 m/s und tödlich“). Prüft **die Regel, nicht die Reichweite** — die hängt am Gelände und misst `npm run gleit`. Der wichtigste Test ist der unauffälligste: dass ein Sprung auf ebener Fläche den Gleiter **nicht** öffnet. Läge die Schwelle unter der Sprunghöhe von 1,49 m, schwebte man über jede Geländestufe |
| `reiten.test.ts` | 42 Tests für Reiten und Wasserfeld (D413: Tragen nach Tragfähigkeit — kein Wildtier trägt, das Tragtier schon, 140 kg nicht tragfähig; die alte Regel geprüft als Probe hinter `?reitprobe=1`). Hält fest, dass die Watbreite die **Linienbreite** ist (4 m) und nicht die Rasterweite (15,6 m) — genau diese Verwechslung hat `../tools/wassercheck.ts` im ersten Anlauf ruiniert |

## Warum kein Framework

Vitest oder Jest würden Abhängigkeiten, Konfiguration und eine zweite Art, TypeScript
zu laden, mitbringen — für Programme, die im Kern aus einer Vergleichsfunktion und
`console.log` bestehen. Die Ausgabe dieser Tests ist zugleich Dokumentation: Wer
`npm run test` laufen lässt, sieht die Erfahrungskurve als Tabelle und die
Kletterhöhe in Metern, nicht nur grüne Häkchen.

## Definition of Done

- **Input:** neue oder geänderte `*.test.ts`
- **Output:** in `package.json` unter `scripts.test` eingehängt, `make check` grün
- **Fehlerfall:** roter Test → erst prüfen, ob der **Test** falsch ist. Das war hier
  schon dreimal der Fall (Peilung, Ausdauer, Auftragsreihenfolge) und steht jeweils
  als Kommentar in der Datei
- **Rollback:** `git checkout -- tests/`
