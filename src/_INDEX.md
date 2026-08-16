---
last-reviewed: 2026-08-16
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
| Springen, Schwerkraft, Bodenkontakt ändern | `scenes/RegionsSzene.tsx` (`Spieler`, `SCHWERKRAFT`/`ABSPRUNG`) → `spieler/steuerung.ts` | world/, engine/ |
| Klettern, Steigungsgrenze, Ausdauer ändern | `spieler/ausdauer.ts` → `scenes/RegionsSzene.tsx` (`STEIGUNG_MAX`, `KLETTERN_TEMPO`) | world/, engine/ |
| Aufträge, Zufluchten, NPCs ändern | `spiel/auftraege.ts` → `ui/Ortsfenster.tsx` → `main.tsx` | world/, engine/ |
| Wald wirkt zu dunkel oder zu flach | `../tools/lichtcheck.ts` **erst messen**, dann `scenes/RegionsSzene.tsx` (`STIMMUNG`, `HEMI_BODEN`) | ui/, engine/ |
| Fundstücke platzieren oder ihre Wirkung ändern | `scenes/RegionsSzene.tsx` (`Fundstellen`) → `main.tsx` (`findeFragment`) | engine/, ui/ |
| Aussehen der Kreaturen, Pilzfächer, Mutationsstufen | `world/kreaturgestalt.ts` | engine/, ui/ |
| Vegetationsdichte, Varianten, Modellgrößen | `world/props.ts` | scenes/, engine/ |
| Bodendecker direkt um den Spieler | `world/streuung.ts` | props.ts |
| Oberfläche des Bodens, Rauschen, Farbvariation | `world/bodenmaterial.ts` | lod.ts |
| Terrain-Detail, LOD-Schwellen, Mikrorelief | `world/lod.ts` | scenes/, engine/ |
| Terrain-, Gewässer-, Gebäude-, Wege-Geometrie | `world/terrain.ts` | engine/, ui/ |
| OSM/DEM laden, Spawns, Weltdatentypen | `world/osm.ts` | scenes/, engine/ |
| Kampflogik, Schaden, Fokus, Wechsel | `engine/battle.ts` → `data/schema.ts` | world/, scenes/ |
| Kampf-UI, Buttons, Anzeige | `ui/BattleScreen.tsx` | world/ |
| Kreatur-, Move-, Regionsformat ändern | `data/schema.ts` | world/, scenes/ |
| Einstiegspunkt, Weltdaten laden | `main.tsx` | — |
| Steuerung anfassen (Tasten, Touch, Empfindlichkeit) | `spieler/steuerung.ts` | world/, engine/ |
| Aussehen der Spielerfigur | `spieler/figur.ts` | world/ |
| Wogegen man läuft | `spieler/kollision.ts` | scenes/ |

## Datei-Register (Drift-Gate erzwingt Vollständigkeit für `owns:`)

| Datei | Zweck |
|---|---|
| `main.tsx` | Einstiegspunkt. Lädt die Weltdaten, montiert `RegionsSzene`, schaltet Stimmungen |
| `data/schema.ts` | Zod-Schemas für Kreatur, Move, Region **plus Elementmatrix** — der Drift-Schutz. `npm run validate` prüft alle Inhalte dagegen |
| `data/inhalte.ts` | Lädt `content/` ins Spiel und macht aus Kreatur + Stufe einen `Kaempfer` der Engine. Prüft die Daten auch im Browser |
| `spiel/spielstand.ts` | Spielstand über IndexedDB: Team, gefangene und besiegte Vorkommen, Position, Beutel, gelesene Fragmente. Nur Taten, keine Weltdaten |
| `spiel/bildrate.ts` | Bildzeit der **Seite** über requestAnimationFrame — läuft auch, wenn die Szene steht. Trennt „Szene zu teuer" von „Gerät gedeckelt" |
| `spiel/fortschritt.ts` | Stufe (1–40), Erfahrung und Mutation. Kurve durchgerechnet, nicht geschätzt — `tests/fortschritt.test.ts` |
| `spiel/gegenstaende.ts` | Wirkung von Gegenständen auf einen Kämpfer, plus Beuteverteilung nach einem Sieg |
| `world/vorkommen.ts` | Kreaturen in der Welt: aus Spawn-Zonen deterministische Vorkommen, Stufe abhängig von der Entfernung zur Regionsmitte |
| `world/kreaturgestalt.ts` | Silhouetten als Platzhalter, vier Bauformen nach `basisRig`, Farbe nach Element (ADR-0002 sperrt echte Modelle). Trägt den **Pilzfächer** der Stilreferenz, Deckung und Größe je Mutationsstufe |
| `engine/battle.ts` | Kampflogik ohne 3D: Schaden, Elementfaktor, Fokus-Ökonomie, Phasen, Zehrung, deterministischer RNG |
| `ui/BattleScreen.tsx` | Kampfoberfläche: Moves, Wechsel, Fangen, Rückzug. An die Szene angebunden |
| `ui/Kampfbuehne.tsx` | Kreaturen im Kampfbild — eine kleine Leinwand für beide Seiten, Leerlaufatmung und Trefferzucken |
| `world/bandmaterial.ts` | Wasser und Wege: weiche Ränder statt Plattenkante, Strömung und Spurrinnen im Shader |
| `world/baum.ts` | Fichte und Buche als Geometrie statt als Datei. 872 bzw. 782 Dreiecke, null Bytes Download — EZ-Tree hätte 4 MB gekostet |
| `world/himmel.ts` | Verlaufshimmel im Shader: Zenit zu Horizont, Dunstband in Nebelfarbe, Sonnenscheibe mit Hof, Gegenlicht. 320 Dreiecke, null Bytes |
| `world/windmaterial.ts` | Silhouettenlicht (Fresnel gegen die Himmelsfarbe) und Wind für Prop-Instanzen. Was schwingen darf, steht als Attribut `aWind` in der Geometrie |
| `world/klippen.ts` | Felswände aus der Hangneigung. Ein Höhenraster kann per Bauart keine senkrechte Wand — deshalb aufgesetzt statt geschnitzt |
| `ui/Witterung.tsx` | Richtung und Abstand zur nächsten Kreatur. Notwendig, weil eine Kreatur auf 62 m nur zwölf Pixel hoch ist |
| `spieler/peilung.ts` | Richtung zu einem Punkt relativ zum Blick. Rein und getestet — hier steckte ein Vorzeichenfehler |
| `spieler/ausdauer.ts` | Ausdauer für Klettern und Springen. **Rennen zehrt bewusst nicht** — die Begründung steht in der Datei. Rein und getestet |
| `spiel/auftraege.ts` | Auftragsfortschritt, **abgeleitet** aus besiegten/gefangenen Vorkommen und gelesenen Fragmenten. Kein eigener Zähler, deshalb keine zweite Wahrheit |
| `ui/Ortsfenster.tsx` | Zuflucht und Bewohner in einem Fenster: rasten oder Aufträge annehmen und abschließen. Kein Dialogbaum |
| `ui/Ausdaueranzeige.tsx` | Ausdauerbalken, der bei vollem Vorrat ausblendet. Rot heißt gesperrt, nicht wenig — das ist der Unterschied, der beim Klettern zählt |
| `scenes/RegionsSzene.tsx` | Art Direction als Code: 4 Stimmungen mit Nebel-, Sonnen- und Umgebungswerten; Props als `InstancedMesh`; Schwerkraft und Sprung des Spielers; `Fundstellen` als Marker der Fragmente |
| `scenes/sichtweiten.ts` | Entfernungsschwellen der Szene (Terrainsicht, Attrappen, Neubewertung). Eigenes Modul, damit `tools/lastcheck.ts` dieselben Zahlen nutzt, ohne React zu laden |
| `world/osm.ts` | OSM- und EU-DEM-Abruf, Weltdatentypen (`Weltdaten`, `Biom`), Biom-Ableitung, Spawn-Zonen |
| `world/terrain.ts` | Terrain-Mesh mit Vertex-Farben, Gewässer, Gebäude mit Dächern, Wege; `MASSSTAB`, `GROESSE`, `BIOM_FARBE` |
| `world/props.ts` | Vegetation: deterministische Verteilung per Seed, Dichten je Biom, 4 Varianten je Art, Normierung auf reale Zielhöhen, Chunking |
| `world/lod.ts` | Terrain-Detail: 4 LOD-Stufen (2/4/8/16 m), hangabhängiges Mikrorelief in 4 Oktaven (<1,2 m), Schürzen gegen Kachelrisse |
| `world/bodenmaterial.ts` | Bodenmaterial mit prozeduraler Oberflächenvariation im Shader — zwei Oktaven Rauschen aus der Weltposition, null Bytes Textur |
| `world/streuung.ts` | Nahfeld-Streuschicht: deterministische Bodendecker im 28-m-Umkreis, beim Gehen nachgezogen. Antwort auf „0 Props im 10-m-Umkreis" |
| `spieler/steuerung.ts` | Eingabe für Bewegung, Blick und **Sprung** (Leertaste, Tippen unter 12 px auf der rechten Hälfte). Touch **und** Tastatur/Maus. Zustand im Ref statt im State — 60 Re-Renders je Sekunde wären sinnlos |
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
