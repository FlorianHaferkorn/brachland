---
last-reviewed: 2026-09-02
shelf-life-days: 90
owns: *.ts, *.tsx
---
# src — Quellcode (_INDEX)

> Konventionen und Befehle: `../docs/TECH_STACK.md`. Die 3D-Schicht und die Kampf-Engine
> sind **entkoppelt** — `engine/` kennt kein three.js und ist deshalb ohne Renderer testbar.
> Genau daran hängen die 16 Tests.

## „Lies-wenn"-Routing

| Deine Aufgabe ist … | Lies | NICHT nötig |
|---|---|---|
| Licht, Nebel, Stimmung, Kamera ändern | `scenes/RegionsSzene.tsx` | world/, engine/ |
| Kreaturen in der Welt oder Begegnungen ändern | `world/vorkommen.ts` → `scenes/RegionsSzene.tsx` | data/inhalte.ts |
| Team, Fangen oder Speichern ändern | `main.tsx` → `spiel/spielstand.ts` | ui/BattleScreen.tsx |
| Fortschritt, Stufen oder Gegenstände ändern | `spiel/fortschritt.ts`, `spiel/gegenstaende.ts` | data/inhalte.ts, content/gegenstaende/ |
| Bewegung, Kamera oder Blickneigung ändern | `spieler/steuerung.ts` → `scenes/RegionsSzene.tsx` | spieler/figur.ts |
| Springen, Schwerkraft, Bodenkontakt ändern | `spieler/tempo.ts` (die Zahlen) → `scenes/RegionsSzene.tsx` (`Spieler`) → `spieler/steuerung.ts` | world/, engine/ |
| Klettern, Steigungsgrenze, Ausdauer ändern | `spieler/ausdauer.ts` → `scenes/RegionsSzene.tsx` (`STEIGUNG_MAX`, `KLETTERN_TEMPO`) | world/, engine/ |
| Reiten: wer trägt, wie schnell, wie steil | `spiel/reiten.ts` → `scenes/RegionsSzene.tsx` (`REIT_STEIGUNG_MAX`) | world/, engine/ |
| An Gehtempo, Renntempo, Schwerkraft oder Sprunghöhe drehen | `spieler/tempo.ts` — **nur dort**, sonst driftet es wieder (G-66) | — |
| Gleiten: Verhältnis, Sinkrate, wann der Gleiter aufgeht | `spieler/gleiten.ts` → `npm run gleit` → `../tests/gleiten.test.ts` | world/, engine/ |
| Waten, Wassertiefe, wo Wasser steht | `world/wasserfeld.ts` → `scenes/RegionsSzene.tsx` (`WATEN_AB`) | engine/, ui/ |
| Aufträge, Zufluchten, NPCs ändern | `spiel/auftraege.ts` → `ui/Ortsfenster.tsx` → `main.tsx` | world/, engine/ |
| Wald wirkt zu dunkel oder zu flach | `../tools/lichtcheck.ts` **erst messen**, dann `scenes/RegionsSzene.tsx` (`STIMMUNG`, `HEMI_BODEN`) | ui/, engine/ |
| Fundstücke platzieren oder ihre Wirkung ändern | `scenes/RegionsSzene.tsx` (`Fundstellen`) → `main.tsx` (`findeFragment`) | engine/, ui/ |
| Aussehen der Kreaturen, Pilzfächer, Anbauten wie das Chitinplatten-Gehörn, Mutationsstufen | `world/kreaturgestalt.ts` | engine/, ui/ |
| Vegetationsdichte, Varianten, Modellgrößen | `world/osm.ts` | OSM → Weltdaten: Höhen, Biomraster, Linien, Wege, Gebäude, Spawnzonen. Das Biomraster stempelt **Siedlung aus Gebäuden** (zwei in 20 m, D77) — ohne das standen 79 % der Häuser auf Wiese (G-81) |
| `world/props.ts` | scenes/, engine/ |
| Bodendecker direkt um den Spieler | `world/streuung.ts` | props.ts |
| Oberfläche des Bodens, Rauschen, Farbvariation | `world/bodenmaterial.ts` | lod.ts |
| Terrain-Detail, LOD-Schwellen, Mikrorelief | `world/lod.ts` | scenes/, engine/ |
| Terrain-, Gewässer-, Gebäude-, Wege-Geometrie | `world/terrain.ts` | engine/, ui/ |
| Höhe für alles, was auf dem Gelände **aufsitzt** | `world/lod.ts` → `aufsatzboden()` | world/terrain.ts |
| Wege, Bäche, Wasserfälle und Weiher | `world/osm.ts` | OSM → Weltdaten: Höhen, Biomraster, Linien, Wege, Gebäude, Spawnzonen. Das Biomraster stempelt **Siedlung aus Gebäuden** (zwei in 20 m, D77) — ohne das standen 79 % der Häuser auf Wiese (G-81) |
| `world/props.ts` | Verteilung, Varianten und Farben der Vegetation. `VARIANTEN` trägt Datei, Kenney-Quelle und **reale Höhe** je Variante — Gras reicht damit von 0,18 bis 0,85 m statt einer wegnormierten Einheitshöhe (G-77). `KENNEY_FARBE` bildet Kenneys Materialrollen auf die Projektpalette ab. `verteileProps` setzt nichts mehr in einen Grundriss (G-82) |
| `world/baender.ts` | world/lod.ts, scenes/ |
| OSM/DEM laden, Spawns, Weltdatentypen | `world/osm.ts` | scenes/, engine/ |
| Kampflogik, Schaden, Fokus, Wechsel | `engine/battle.ts` → `data/schema.ts` | world/, scenes/ |
| Kampf-UI, Buttons, Anzeige | `ui/BattleScreen.tsx` | world/ |
| Kreatur-, Move-, Regionsformat ändern | `data/schema.ts` | world/, scenes/ |
| Einstiegspunkt, Weltdaten laden | `main.tsx` → `world/weltladen.ts` | — |
| Weltdatei holen, cachen, offline halten | `world/weltladen.ts` | `main.tsx`, `../vite.config.ts`, `../index.html` |
| Menü, Karte, Beutel, Team, Verzeichnis | `ui/Menue.tsx` → `ui/karte.ts`, `spiel/team.ts` | `main.tsx`, `spiel/spielstand.ts` |
| Steuerung anfassen (Tasten, Touch, Empfindlichkeit) | `spieler/steuerung.ts` | world/, engine/ |
| Aussehen der Spielerfigur | `spieler/figur.ts` | world/ |
| Wogegen man läuft | `spieler/kollision.ts` | scenes/ |

## Datei-Register (Drift-Gate erzwingt Vollständigkeit für `owns:`)

| Datei | Zweck |
|---|---|
| `main.tsx` | Einstiegspunkt. Lädt Weltdaten **und Fernland** (getrennt, ohne Fehlerzustand — die Kulisse ist kein Spielinhalt), montiert `RegionsSzene`, schaltet Stimmungen, entprellt die Randmeldung. Kennt `?absetzen=x,z[,grad]`: Absetzpunkt und Blickrichtung für Messläufe (D86) — ohne das war in SwiftShader bei 2–5 B/s und 0,1 s Simulationsschritt nichts ausserhalb der Startumgebung anschaubar |
| `world/weltladen.ts` | `holeWeltdaten(pfad)` — Weltdatei aus der Cache-API, sonst einmal aus dem Netz und dann hinein. Seit D82 liegen Weltdaten **nicht** mehr im Service-Worker-Precache: Sie gingen beim ersten Besuch zweimal über die Leitung (G-92, 456 von 1.382 KB). Eine CacheFirst-Laufzeitregel behebt das nicht — beim ersten Aufruf steht die Seite noch nicht unter Service-Worker-Kontrolle, ihr `fetch` geht daran vorbei, und die Weltdaten landen in **gar keinem** Cache (G-100). Der Cachename trägt einen Inhaltsstempel aus `vite.config.ts`, sonst wäre ein `npm run world` unsichtbar |
| `ui/Menue.tsx` | Vier Reiter in **einer** Oberfläche: Karte, Beutel, Team, Verzeichnis. Bewusst zusammen und nicht einzeln — sie teilen Rahmen, Schliessgeste und Spielstandanbindung; getrennt gebaut entstünden vier Oberflächen, die nicht zueinander passen (G-101). Aufgemacht über einen 44-px-Knopf **oben links** und `Escape`: Die linke Bildhälfte ist der virtuelle Stick, unten wäre der Knopf im Weg. Kein Schnellreisen — bei 4 km Kantenlänge ist der Weg der Inhalt |
| `ui/karte.ts` | Zeichnet die Region auf ein Canvas: Biomraster als Grund, Höhenlinien alle 100 m, Wege nach Klasse, Bäche, Gebäude als Punkthaufen. **Biome statt Schummerung**, weil eine Schummerung auf 300 px Handybreite ein grauer Fleck ist. Eingezeichnet wird nur, was der Spieler selbst gefunden hat — besuchte Orte (`spielstand.orte`), gelesene Fundstücke, das verfolgte Auftragsziel |
| `spiel/team.ts` | `verschiebe(liste, von, nach)` — Teamreihenfolge. Eigene Datei für sechs Zeilen, weil die Reihenfolge an **zwei** Stellen steht (Team und `erfahrungRef`, weil die Engine keinen Fortschritt kennt) und beide dieselbe Bewegung machen müssen. Getrennt bewegt, trägt die falsche Kreatur die falsche Erfahrung, und man sieht es erst beim nächsten Stufenaufstieg |
| `data/schema.ts` | Zod-Schemas für Kreatur, Move, Region **plus Elementmatrix** — der Drift-Schutz. `npm run validate` prüft alle Inhalte dagegen |
| `data/inhalte.ts` | Lädt `content/` ins Spiel und macht aus Kreatur + Stufe einen `Kaempfer` der Engine. Prüft die Daten auch im Browser |
| `spiel/spielstand.ts` | Spielstand über IndexedDB: Team, gefangene und besiegte Vorkommen, Position, Beutel, gelesene Fragmente. Nur Taten, keine Weltdaten |
| `spiel/bildrate.ts` | Bildzeit der **Seite** über requestAnimationFrame — läuft auch, wenn die Szene steht. Trennt „Szene zu teuer" von „Gerät gedeckelt" |
| `spiel/fortschritt.ts` | Stufe (1–40), Erfahrung und Mutation. Kurve durchgerechnet, nicht geschätzt — `tests/fortschritt.test.ts` |
| `spiel/gegenstaende.ts` | Wirkung von Gegenständen auf einen Kämpfer, plus Beuteverteilung nach einem Sieg |
| `world/vorkommen.ts` | Kreaturen in der Welt: aus Spawn-Zonen deterministische Vorkommen, Stufe abhängig von der Entfernung zur Regionsmitte |
| `world/kreaturgestalt.ts` | Silhouetten als Platzhalter, vier Bauformen nach `basisRig`, Farbe nach Element (ADR-0002 sperrt echte Modelle). Trägt den **Pilzfächer** der Stilreferenz, Deckung und Größe je Mutationsstufe. Enthält seit D93 `reitsitz()`: Widerrist und Rumpfversatz **aus der Geometrie gemessen** statt aus `RIG_HOEHE` — die feste 1 passte zu einer Silhouette, die bei Mutation 2 gemessen 2,28 m hoch ist. Seit D109 ausserdem die **Anbauten**: `baueGehoern()` baut das Chitinplatten-Gehörn des Grathorn aus überlappenden Kegelstümpfen (0,13 · 0,55 · 0,97 Widerristhöhen je Mutationsstufe, 80 · 156 · 216 Dreiecke), `widerristPunkt()` misst den Ansatzpunkt an einem **Modell** — nicht dasselbe wie `reitsitz()`, das die Rückenmitte für den Reiter sucht. Welche Kreatur ein Gehörn trägt, steht als `MIT_GEHOERN` |
| `engine/battle.ts` | Kampflogik ohne 3D: Schaden, Elementfaktor, Fokus-Ökonomie, Phasen, Zehrung, deterministischer RNG |
| `ui/BattleScreen.tsx` | Kampfoberfläche: Moves, Wechsel, Fangen, Rückzug. An die Szene angebunden |
| `ui/Kampfbuehne.tsx` | Kreaturen im Kampfbild — eine kleine Leinwand für beide Seiten, Leerlaufatmung und Trefferzucken |
| `world/bandmaterial.ts` | Wasser und Wege: weiche Ränder statt Plattenkante, Strömung und Spurrinnen im Shader |
| `world/baum.ts` | Fichte und Buche als Geometrie statt als Datei. 872 bzw. 782 Dreiecke, null Bytes Download — EZ-Tree hätte 4 MB gekostet. Seit D92 teilen sich Ast und Laub **eine** Richtung — vorher legten sie denselben Winkel komplementär aus, was bei der Buche haardünne Antennen aus der Krone stehen liess. Die Buche hat jetzt eine Kuppel statt eines V |
| `world/himmel.ts` | Verlaufshimmel im Shader: Zenit zu Horizont, Dunstband in Nebelfarbe, Sonnenscheibe mit Hof, Gegenlicht. 320 Dreiecke, null Bytes |
| `world/windmaterial.ts` | Silhouettenlicht (Fresnel gegen die Himmelsfarbe) und Wind für Prop-Instanzen. Was schwingen darf, steht als Attribut `aWind` in der Geometrie |
| `world/fernland.ts` | Die Berge jenseits der Region: grobes Gelände aus `public/world/oental-fern.json` (125 m Zellen, 11,9 × 12,0 km). Ein Draw Call, kein LOD, `fog: false` mit **eingebackenem** Dunst — unter dem Szenennebel (Ende bei 240–420 m) wäre alles eine einfarbige Fläche. Randpunkte werden auf die Regionskante geschoben und bekommen dort die Höhe aus dem feinen Höhenfeld, sonst läge ein 125 m breiter grober Streifen über dem Nahgelände (D85) |
| `world/klippen.ts` | Felswände aus der Hangneigung. Ein Höhenraster kann per Bauart keine senkrechte Wand — deshalb aufgesetzt statt geschnitzt. Seit D87 verjüngte, gescherte und **verdrehte** Körper mit First, Kluft und Schutt statt gekippter Quader (36–48 → 110–150 Dreiecke, 5 Varianten), und die Auswahl läuft über die **Nachbarschaft** statt über einen Würfel: Ein Würfel je Zelle ergab ein Feld von Menhiren auf einer Wiese (G-108) |
| `ui/Witterung.tsx` | Richtung und Abstand zur nächsten Kreatur. Notwendig, weil eine Kreatur auf 62 m nur zwölf Pixel hoch ist |
| `spieler/peilung.ts` | Richtung zu einem Punkt relativ zum Blick. Rein und getestet — hier steckte ein Vorzeichenfehler |
| `spieler/ausdauer.ts` | Ausdauer für Klettern und Springen. **Rennen zehrt bewusst nicht** — die Begründung steht in der Datei. Rein und getestet |
| `spiel/reiten.ts` | Wer trägt (nur `quadruped` ab Mutation 2), Reittempo, Steigungsgrenze im Sattel, und ein Satz dazu, warum es noch nicht geht |
| `spieler/tempo.ts` | Gehen, Rennen, Schwerkraft, Absprung — an **einer** Stelle. Vorher standen dieselben Zahlen in `scenes/RegionsSzene.tsx`, im Ledger D18 und in `tools/masstab.ts`, und alle drei waren verschieden (G-66). Rein, damit die Werkzeuge sie importieren können |
| `spieler/gleiten.ts` | Gleiten: Verhältnis 3:1, Sinkrate 4,0 m/s, Öffnen ab 3 m Fallhöhe. Das Verhältnis ist **gemessen** (`npm run gleit`, D71), nicht gewählt. Freigeschaltet mit dem Regenten, abgeleitet statt gespeichert. Rein und getestet |
| `world/wasserfeld.ts` | Wassertiefe an einem Punkt: 1.506 Bachsegmente in 32-m-Eimern **plus 11 Weiher als Polygone**. Grundlage von Waten, Schwimmen und dem aus dem Gelände geschnittenen Bett |
| `spiel/auftraege.ts` | Auftragsfortschritt, **abgeleitet** aus besiegten/gefangenen Vorkommen und gelesenen Fragmenten. Kein eigener Zähler, deshalb keine zweite Wahrheit |
| `ui/Ortsfenster.tsx` | Zuflucht und Bewohner in einem Fenster: rasten oder Aufträge annehmen und abschließen. Kein Dialogbaum |
| `ui/Stockanzeige.tsx` | Zwei Daumenknüppel, die dem Finger folgen statt in einer Ecke zu stehen — sichtbar nur, solange ein Finger liegt. Rückmeldung vom Gerät war „kein sichtbarer Stick“: Ohne Anzeige sieht man weder, wo der Stock angesetzt hat, noch ob der Finger noch greift. Liest einen Ref über `requestAnimationFrame`, `pointerEvents: none` (D89) |
| `ui/Ausdaueranzeige.tsx` | Ausdauerbalken, der bei vollem Vorrat ausblendet. Rot heißt gesperrt, nicht wenig — das ist der Unterschied, der beim Klettern zählt |
| `scenes/RegionsSzene.tsx` | Art Direction als Code: 4 Stimmungen mit Nebel-, Sonnen- und Umgebungswerten; Props als `InstancedMesh`; Schwerkraft und Sprung des Spielers; `Fundstellen` als Marker der Fragmente. Die Kamera **zieht ein** (D91): zehn Proben auf der Sichtlinie gegen dasselbe Kollisionsfeld wie die Figur plus die Geländefläche — ohne das steht sie im Wald regelmäßig im Stamm. Messparameter in der Adresse: `?absetzen=` (D86), `?aus=` (`abschalter.ts`), `?zeit=` (D101, in `main.tsx`) und seit G-126 **`?belichtung=`** — überschreibt die Belichtung der laufenden Stimmung, damit eine Belichtungsreihe reproduzierbar ist. Die Reihe hat gezeigt, dass der Regler nicht der Hebel für einen helleren Tag ist (D110) |
| `scenes/propauswahl.ts` | Welcher Prop-Chunk in die Nahliste geht und welcher ins Attrappenbündel. Als reine Funktion ausgelagert, weil hier genau ein Fehler möglich ist, den kein Bildschirmfoto zeigt: ein Chunk in **keiner** der beiden Listen. Beide entscheiden über denselben Anker — den Punkt, an dem das Bündel zuletzt gebaut wurde |
| `scenes/abschalter.ts` | `?aus=fels,gras,baeume,kulisse,haeuser` lässt Gruppen weg. Messwerkzeug: Die ersten Zahlen vom Zielgerät zeigten 177.780 Dreiecke bei 155 Aufrufen mit p95 21,0 ms gegen 224.818 bei 111 Aufrufen mit 18,0 ms — weniger Geometrie, schlechteres Bild. Drei Kandidaten (Dreiecke, Aufrufe, Füllrate) und zwei verschiedene Orte ergeben keine Antwort; vier Messungen am **selben** Punkt mit je einer fehlenden Gruppe schon |
| `scenes/sichtweiten.ts` | Entfernungsschwellen der Szene (Terrainsicht, Attrappen, Neubewertung). Eigenes Modul, damit `tools/lastcheck.ts` dieselben Zahlen nutzt, ohne React zu laden |
| `world/osm.ts` | OSM- und EU-DEM-Abruf, Weltdatentypen (`Weltdaten`, `Biom`), Biom-Ableitung, Spawn-Zonen |
| `world/terrain.ts` | Terrain-Mesh mit Vertex-Farben und **Gebäude**: orientiertes Dach, Sockelband, Gesims je Geschoss, Haustür, Fenster, Balkon (G-71, G-80). `orientierteHuelle()` ist die eine Achse, aus der Dach, Balkon und Garten kommen. Wände reichen bis `FUNDAMENT_MAX` unter den Sockel (G-71). Wege und Gewässer sind seit D73 nicht mehr hier. **Seit D90 ein Giebelfeld je Grundrisskante** statt zwei fester an den Hüllenenden — jede Kante eines Winkelgrundrisses endete vorher unter einem höheren Dach, und dazwischen war nichts. Der Balkon sitzt an der gefundenen Wand statt an der Hüllenkante, seine Stützen reichen bis zum Boden, und seine Tiefe ist auf den Dachüberstand begrenzt |
| `world/osm.ts` | OSM → Weltdaten: Höhen, Biomraster, Linien, Wege, Gebäude, Spawnzonen. Das Biomraster stempelt **Siedlung aus Gebäuden** (zwei in 20 m, D77) — ohne das standen 79 % der Häuser auf Wiese (G-81) |
| `world/props.ts` | Verteilung, Varianten und Farben der Vegetation. `VARIANTEN` trägt Datei, Kenney-Quelle und **reale Höhe** je Variante — Gras reicht damit von 0,18 bis 0,85 m statt einer wegnormierten Einheitshöhe (G-77). `KENNEY_FARBE` bildet Kenneys Materialrollen auf die Projektpalette ab. `verteileProps` setzt nichts mehr in einen Grundriss (G-82) |
| `world/baender.ts` | Wege, Bäche, Wasserfälle, Weiher, **Gärten** und die Kachelzuordnung der Häuser — je Kachel auf der LOD-Stufe, die dort gezeichnet wird. Gemessen 0,000 m Abweichung zur gezeichneten Fläche an vier Standorten (D73). `WEGBELAG` gibt jeder der neun OSM-Wegklassen Farbe, Spurrinne und Randschärfe als Vertexattribut (G-79) |
| `world/osm.ts` | OSM → Weltdaten: Höhen, Biomraster, Linien, Wege, Gebäude, Spawnzonen. Das Biomraster stempelt **Siedlung aus Gebäuden** (zwei in 20 m, D77) — ohne das standen 79 % der Häuser auf Wiese (G-81) |
| `world/props.ts` | Vegetation: deterministische Verteilung per Seed, Dichten je Biom, 4 Varianten je Art, Normierung auf reale Zielhöhen, Chunking |
| `world/lod.ts` | Terrain-Detail: 5 LOD-Stufen (2/4/8/16/32 m), hangabhängiges Mikrorelief in 4 Oktaven (<1,2 m), Schürzen gegen Kachelrisse. `hoeheAufFlaeche` und `spiegelAufFlaeche` geben die **gezeichnete** Fläche auf einer wählbaren Stufe — auf dem Dreieck, nicht bilinear (G-74). `aufsatzboden()` ist die einzige Höhenquelle für Gebäude; Szene und Werkzeuge hatten vorher je eine eigene (G-73) |
| `world/bodenmaterial.ts` | Bodenmaterial mit prozeduraler Oberflächenvariation im Shader — zwei Oktaven Rauschen aus der Weltposition, null Bytes Textur |
| `world/streuung.ts` | Nahfeld-Streuschicht: deterministische Bodendecker im 28-m-Umkreis, beim Gehen nachgezogen. Antwort auf „0 Props im 10-m-Umkreis" |
| `spieler/steuerung.ts` | Eingabe für Bewegung, Blick und **Sprung** (Leertaste, Tippen unter 12 px auf der rechten Hälfte). Touch **und** Tastatur/Maus. Zustand im Ref statt im State — 60 Re-Renders je Sekunde wären sinnlos. **Seit D89 zwei Ratenstöcke statt Wischen** (nur für Touch — die Maus zieht weiter, sie hat unbegrenzten Weg): Der Ausschlag setzt `drehRate`/`neigRate`, also dieselben Felder wie die Tastatur; vorher lief der Blick über die zurückgelegte **Strecke**, und eine halbe Drehung brauchte bei 320 px/rad drei bis vier volle Wischer. `touch-action: none` und `pointermove`/`up` am `window` statt `setPointerCapture` am Element — das war die Ursache dafür, dass zwei Finger nicht gleichzeitig ankamen |
| `spieler/figur.ts` | Spielerfigur als Platzhalter, 1,8 m. **Größenreferenz**, kein Charakterdesign — monochrom, unter 300 Dreiecke |
| `spieler/kollision.ts` | Kollision über ein Raster: Kreise für Stämme, Findlinge, Totholz; Rechtecke für Gebäudegrundrisse. Büsche und Gras bleiben durchlässig |

## Was hier NICHT liegt

Werkzeuge (`buildworld`, `quality`, `validate`, Asset-Kette) liegen in `../tools/`,
Inhalte in `../content/`, Modelle in `../assets/`. Tests in `../tests/`.

## Definition of Done (Code-Änderung)

- **Input:** Änderung an `.ts`/`.tsx`
- **Output:** `npm run typecheck` sauber, `npm run test` 16/16, `make check` grün
- **Fehlerfall:** Typfehler oder roter Test → nicht committen; der pre-commit-Hook blockt
- **Rollback:** `git checkout -- src/`
