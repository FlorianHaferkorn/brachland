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
| Am Biomraster, an der Siedlungsregel oder der Prop-Verteilung drehen | `siedlung.test.ts` → `../src/world/osm.ts`, `../src/world/props.ts` |
| An der Teamreihenfolge oder am Beutel ausserhalb des Kampfes drehen | `menue.test.ts` → `../src/spiel/team.ts`, `../src/spiel/gegenstaende.ts` |
| `ezlod.test.ts` | Prüft stetige, lückenlose Dreistufenblenden auch bei schnellen Wechseln und Richtungsumkehr. |
| `propauswahl.test.ts` | Die zwei Prop-Listen dürfen keinen Chunk verlieren. Seit die Attrappen gebündelt werden (G-111), wird die Nahliste alle 8 m neu bestimmt und das Bündel alle 60 m. D157 prüft Baumvarianten über alle Stufen; D158 den Randfall, dass ein neuer Fernanker trotz gerade erfolgter Nahbewertung beide Listen erneuert. Geprüft wird zusätzlich ein **Lauf** über 76 Schritte: jeder Chunk in Reichweite steht genau einmal |

## Register

| Datei | Was festgehalten wird |
|---|---|
| `heldmaterial.test.ts` | D343: Kleiderprobe vor dem Skinning, ursprüngliche Farb- und Normalenkarten, getrennter Hautshader und Materialrückfall. |
| `lagerton.test.ts` | Vorbereitung ohne Klangquellen und synchrones Resume bei Eingabegeste; eine Kontextinstanz bei mehreren Gesten sowie Fallback nach verweigerter Vorbereitung. |
| `bautenpack.test.ts` | Tatsächlicher Runtime-Decoder: Attribute, Weltmatrizen, Materialwerte/-gruppen, Namen und orientierte Dreiecke bleiben beim verlustfreien Meshopt-Roundtrip erhalten; Quellschutz und Größenstabilität bei Wiederkompression. |
| `echtzeit.test.ts` | 188 Prüfungen (Stand D355; D355: Richtungskampf aus), das Kampftor (D166–D170): Reichweite ±5 cm, Winkel, ein Treffer je Schwung, Rollenfenster in 5-ms-Schritten (≥ 200 ms, nach Reaktionszeit erreichbar), Ausdauer 5 Schläge/4 Rollen, Haltung bricht beim 2. Treffer, Zielwahl, KI aus 12 Anlaufrichtungen, Angriffsrecht: zwei Gegner nie zugleich im Schlag, im Wechsel, der Wartende ausser Reichweite (D167), Waffenklassen als Werkzeuge statt Stufen und Zielwahl/Zielwechsel (D168), der Keiler als erster echter Gegner (D169), Zucken, Pille statt Kreis und der Grathorn (D170), Moveset/Puffer/Kette/Vorschritt/Rückstoss/Trefferstopp und der Wolf mit Doppelbiss (D171), das Rudel umzingelt (D172, 130 Prüfungen), gleiches Ergebnis bei 10/30/144 B/s. Druckt die Messtabelle |
| `waffenclips.test.ts` | D171: Scheitel und Durchzug jedes Schlags (`hieb`, Clipsekunden) liegen auf Schlüsselbildern von `tools/waffenclips.py`, Haltungen sind Schleifen, `menschbau.ANIM_WAFFEN` = `waffenclips.CLIPS`, die Waffendatei trägt jeden gebrauchten Clip, die Wanderin keinen |
| `kampfbot.test.ts` | D171/D172: Band statt Punkt — einzeln gewinnt ein aufmerksamer Bot ≥ 90 %, zu zweit ≥ 60 %, das Rudel (drei Wölfe) ≥ 40 % und schlägt einen müden meistens; kein Kampf läuft in die Zeitgrenze (28 Zeilen à 60 Kämpfe) |
| `schmiede.test.ts` | D177: Stufen enden bei 3, bezahlt wird nur, was im Beutel ist, eine geschmiedete Klinge trifft im Echtzeitkampf härter |
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
| `streukarten.test.ts` | D361: Bodenstreu deterministisch je Zelle, Wald dicht, Wiese < 1/5, Wasser frei, Karten 1,5 cm über dem Gelände und nach der Neigung gekippt, Streckung in Toleranz, gehäuft statt gleichmässig (Variationskoeffizient in 5-m-Feldern > 0,45). |
| `atmosphaere.test.ts` | D368: physikalischer Himmel (`?himmel=physik`) — klare Luft gibt blaues Zenit, die Luft von `zielbild` ein warmes nahe am Kunstwert; Kopplung hält Helligkeit von Nebel, Sonne und Fülllicht und alle Stärken, Fernland-Dunst = Nebel; tiefe Sonne wärmer; Tabellen unter 400 ms je Stimmung. |
| `hofbau.test.ts` | D363: Hof-Baukasten-Lage aus dem Grundriss — gedrehtes Rechteck 36 × 14 m: Masse, Modellmitte auf der Grundrissmitte (< 0,1 m), Höhe an der tiefsten Ecke, Gebäude als ersetzt gemeldet. |
| `hoftrittplatten.test.ts` | D307: geschlossene Platten, Außennormalen, Schwellenabstand und Hangkontakt. |
| `hofplatz.test.ts` | D298: Grundrissauswahl, Hofmaske und Ausschluss des Hausinneren; Scan-Shader-Hook bleibt beim Klonen für Wind erhalten (33 Prüfungen, einschliesslich deterministischer Randgruppen und gesperrter Wege). |
| `referenzhaus.test.ts` | D303: lokale Auswahl, echte Fenster-/Türtiefe, Umlauf, UV und vollständige Geometrieattribute. |
| `hausindex.test.ts` | D305: exakte Rückexpansion, harte Kanten/UV/Seeds, Hashkollisionen, Vorzeichen von Null, 16-/32-Bit-Grenze sowie reales Haus-/Garten-Merge. |
| `hausspar.test.ts` | D305: Shader-Gegenläufe, Gradienten vor räumlichen Zweigen, vollständige Rauheits-/Glas-/Glutpfade und unveränderter Rückfall. |
| `laubenkasten.test.ts` | D306: geschlossene Pflanzkörper, Rand/Erde, Außenwinding, Fläche/Budget, Determinismus und örtliche Hausintegration. |
| `hofhaeuser.test.ts` | D304: begrenzte Hofauswahl, freie Eingänge trotz Garagen/Nachbarn, Gebäudemitte und Integration der Referenzbauteile. |
| `hausfront.test.ts` | D297: Raum-UV/Seed auf allen Scheibenecken und neutral auf anderen Bauteilen, vollständige Fenster-UV und deterministische Varianten bei 0°/37°; Raycasts auf obere Scheiben entdecken verbliebene opake Vorhänge; Gärten mit neutralen Raumdaten, Haus/Garten per mergeGeometries gemeinsam renderbar; Pflegezone: Kanten, Ecken und 1,6-m-Grenze, Wald ausgeschlossen (31 Prüfungen) |
| `fenstertiefe.test.ts` | D296: erzeugte Hausgeometrie bei 0°/37°, Fenster an allen vier Fassaden; Frontstrahlen passieren die Fassadenebene und treffen Scheiben 18 cm dahinter, schräge Strahlen die nach innen gerichtete Laibung; vollständige Attribute, endliche Normalen, keine entarteten Dreiecke, Glut nur auf Scheiben |
| `staemme.test.ts` | G-136: Jede Blender-Szene hat Stämme im Kollisionsfeld (≥ 100, alle im Freihalte-Radius, also richtige Achsenlage), der Stauwehr-Stamm aus dem Lock-On-Video ist bekannt und verdeckt die Sicht, `public/bauten/staemme.json` passt zu den GLB |
| `fortschritt.test.ts` | 20 Tests. Anlass: Die erste Kurve machte Kreaturen bei der Mutation **schwächer** (L13 = 184 KP, L14 = 162 KP). Hält jetzt Monotonie und die Zahl der Kämpfe je Mutation fest |
| `ausdauer.test.ts` | 20 Tests. Hält die Kletterhöhe als **Rechnung** fest (16/s × 2,2 m/s = 13,8 m gegen 14 m Klippe) und die Hysterese am Nullpunkt |
| `auftraege.test.ts` | 25 Tests. Der Fortschritt wird abgeleitet, nicht gezählt — geprüft wird unter anderem, dass `schneehuhn` nicht `schneehuhn-alt` mitzählt |
| `heilung.test.ts` | 15 Tests (D240, D241 `wildZustand`): unbesiegt oder unvollständig heilt nicht, je eine Komponente verbraucht, Eingabe unverändert, zweimal heilen geht nicht |
| `stube.test.ts` | 40 Tests (D242): jede Raumart ohne NaN, in ihren Wänden, Anker (Fenster, Glut, Figur, Kamera) am richtigen Ort, fest je Id |
| `region.test.ts` | 21 Tests (D248, ADR-0014): Region aus der Adresse, Kante aus der Position (Nord ist −z), Nachbarn aus `content/regions/`, Ankunft an der Gegenkante, andere Schalter bleiben beim Hinübergehen erhalten; ohne Adresse behält das Œntal seine Blender-Szenen |
| `weltbau.test.ts` | Multipolygon-Relationen mit Lichtungen, Moorbiom und Kompatibilität alter Weltdateien. D333 prüft den Rundlauf der OSM-Straßenattribute und den Umgang mit uneindeutigen Breiten und Beleuchtungswerten. |
| `zustaende.test.ts` | 38 Tests zur Creature Design Bible v1.1. Hält drei Befunde fest, die beim Zusammenführen von Blatt und Code herauskamen: **Resistenz und Verteidigung wären derselbe Effekt gewesen**, **Krit gab es nicht**, und **Move-Effekte wurden nie angewendet** — `moveDef()` warf sie weg |
| `menue.test.ts` | 25 Tests an den zwei Stellen des Menüs, an denen ein Fehler still bliebe. **Teamreihenfolge:** Sie steht an zwei Orten (Team und `erfahrungRef`), und laufen die auseinander, trägt die falsche Kreatur die falsche Erfahrung — sichtbar erst beim nächsten Stufenaufstieg. **Beutel ausserhalb des Kampfes:** `wendeAn` behauptet seit jeher, „Kampf und Beutel ausserhalb" gleich zu bedienen; aufgerufen hat es bis 20.08.2026 nur der Kampf. Der Kräutersud wird direkt aus `content/` gelesen und gegen dasselbe Zod-Schema geprüft, nicht als Attrappe — der Inhaltslader benutzt `import.meta.glob` und läuft ausserhalb von Vite nicht |
| `siedlung.test.ts` | 9 Tests an einer Kunstwelt: 400 × 400 m Wiese, zwei Häuser 12 m auseinander, eines 150 m entfernt allein. Prüft, dass zwischen den zwei Siedlung entsteht, dass die einzelne Hütte Wiese **bleibt** (D77), und dass kein Prop in einem Grundriss landet (G-82). Bewusst an einer Kunstwelt statt an `oental.json`: Eine Prüfung gegen die Datei bestünde, solange die Datei alt ist |
| `gleiten.test.ts` | 31 Tests. Prüft **die Regel, nicht die Reichweite** — die hängt am Gelände und misst `npm run gleit`. Der wichtigste Test ist der unauffälligste: dass ein Sprung auf ebener Fläche den Gleiter **nicht** öffnet. Läge die Schwelle unter der Sprunghöhe von 1,49 m, schwebte man über jede Geländestufe |
| `reiten.test.ts` | 26 Tests für Reiten und Wasserfeld. Hält fest, dass die Watbreite die **Linienbreite** ist (4 m) und nicht die Rasterweite (15,6 m) — genau diese Verwechslung hat `../tools/wassercheck.ts` im ersten Anlauf ruiniert |

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
