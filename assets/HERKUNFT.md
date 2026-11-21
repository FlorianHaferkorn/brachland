---
last-reviewed: 2026-10-08
owns: []
---

# Herkunft der Fremdmodelle

## Efeukarten (D358)

| Datei unter `public/material/` | Inhalt | Herkunft |
|---|---|---|
| `efeu-karten-farbe.webp` | Vier Efeufelder 1 × 1 m als 2 × 2-Atlas, Grundfarbe und Deckung, 2048 × 2048 | Projektintern prozedural in Blender 5.3 erzeugt (`tools/efeukarten.py`, `tools/efeukarten_pack.py`), Blattgrösse nach `content/massstab.json`. Eigene Arbeit, CC0. |
| `efeu-karten-normal.webp` | Normale im Tangentenraum und Wandabstand (Alpha) derselben Felder | wie oben, gleicher Lauf |
| `streu-karten-farbe.webp` | D361: vier Bodenstreu-Felder 1 × 1 m als 2 × 2-Atlas, Grundfarbe und Deckung | Projektintern prozedural in Blender 5.3 (`tools/streukarten.py`), Grössen nach `content/massstab.json`. Eigene Arbeit, CC0. |
| `streu-karten-normal.webp` | Normale und Höhe über Grund derselben Felder | wie oben |

## Eigenes Material für Haus 308 (D317)

| Datei unter `public/material/` | Inhalt | Herkunft |
|---|---|---|
| `hof-ziel-farbe.webp` | Farbwerte für Kalkputz, Holzschalung, Dachschindeln und Feldsteinsockel | Projektintern mit ImageGen aus dem [eigenen Hof-Zielbild](../docs/bilder/d315-hof-einsturz.webp) erzeugt. [Prompt und Aufbereitung](../docs/HOF_ZIELBILDER.md#spielbare-fassung-von-haus-308-d317). |
| `hof-ziel-normal.webp` | Relief derselben vier Materialien | Projektintern aus den Helligkeitsgradienten der Farbkarte abgeleitet. |
| `hof-efeu-farbe.webp` | Farbkarte für die modellierten Efeublätter an Haus 308, 512 × 512 | D320, eigenes [Hof-Zielbild](../docs/bilder/d315-hof-einsturz.webp) als Referenz für das eingebaute ImageGen. [Prompt](../docs/HOF_ZIELBILDER.md#ausarbeitung-am-zielbild-d320). |
| `hof-himmel-farbe.webp` | Panoramakarte für Wolken über der Hofruine, 1280 × 640 | D320, mit dem eingebauten ImageGen nach der Wolkendecke aus dem [eigenen Hof-Zielbild](../docs/bilder/d315-hof-einsturz.webp) erzeugt. [Prompt](../docs/HOF_ZIELBILDER.md#ausarbeitung-am-zielbild-d320). |

D299: Die Hofvegetation nutzt den bereits eingebundenen MIT-Generator EZ-Tree mit den hier
nachgewiesenen CC0-Ersatzkarten. Neue Mehrstamm-Sträucher werden in `src/world/hofstrauch.ts`
aus dem Seed erzeugt und verwenden den vorhandenen CC0-Atlas `laub-bueschel.webp`.
Keine neuen Fremdmodelle oder Texturdateien; keine Bibliotheks-Bilder ungeklärter Herkunft.

## Milbinger Wolkenaufnahme (D344)

| Datei unter `public/material/` | Inhalt | Herkunft |
|---|---|---|
| `milbinger-wolkendecke.webp` | Fotografierte obere Himmelshalbkugel für Milbinger vor der Heilung, 1024 × 256 | D344, CC0. [Overcast Soil (Pure Sky)](https://polyhaven.com/a/overcast_soil_puresky) von Sergej Majboroda (Foto) und Jarod Guest (Himmelsbearbeitung). 1K-Radiance-Quelle, Belichtung auf den oberen Himmel normiert, danach sRGB-WebP. |

## Straßenmobiliar (D347)

| Datei unter `public/` | Rolle | Autor | Lizenz | Quelle |
|---|---|---|---|---|
| `bauten/milbinger-kleinwagen.glb` | Verlassener Kompaktwagen | tevy | CC0 1.0 | [Five-Door Hatchback](https://tevy.dev/models/hatchback), v1 LOD1. Quelle mit `tools/kompaktwagen-pack.mjs` für WebGL gepackt. Rost, Schmutz und veränderte Glasoberflächen entstehen im Spiel. |

Laternen, Schilder, Reifen, Spielzeug und Sandrahmen sind eigene prozedurale Modelle.

## Vergleichsmodell D250

`public/vergleich/triposr-fels-d250.glb` wurde mit dem MIT-lizenzierten
[TripoSR](https://github.com/VAST-AI-Research/TripoSR) auf dem öffentlichen Host
`codemaker2015/TripoSR` (Stand `9ba6f9a8fc9a2d13253d5f63c184767b101173ad`,
Gitter 128, keine Hintergrundentfernung) aus einem eigenen Blender-Render erzeugt.
Die Vorlage zeigt `findling_scan_e.glb` und `fels-moos-1-farbe.webp` aus dem
CC0-Scan [rock_moss_set_01](https://polyhaven.com/a/rock_moss_set_01) von Kless Gyzen.
GLB: 641.048 Byte, 31.948 Dreiecke, SHA-256
`e809c48254898971571639dace268c5581b54daef2600646d939f802c34da023`.
Das Modell ist eine isolierte Vergleichsprobe, keine Freigabe fuer Spielinhalte.

Jede Datei unter `public/creatures` und `public/figuren` steht hier mit Autor und Lizenz. Das ist
keine Höflichkeit: **CC-BY verlangt die Namensnennung**, und ohne diese Tabelle
wäre die Bedingung nicht erfüllt. `tools/quality.ts` prüft deshalb, dass jede
Modelldatei einen Eintrag hat und jeder Eintrag eine Datei — ein Modell ohne
Zeile ist ein **Blocker**, keine Warnung.

## Warum überhaupt CC-BY

ADR-0002 sagt CC0. Am 31.08.2026 hat Flo die Abweichung für Kreaturmodelle
freigegeben: Die Alpennischen des Rosters — Steinbock, Gams, Wildschwein,
Murmeltier, Schneehase, Baummarder, Feuersalamander — kommen in CC0-Paketen
schlicht nicht vor (G-123, G-124). Die Alternative wäre ein Generator gewesen,
und der ist auf beiden Rechnern nicht lauffähig (G-119).

**Für Props bleibt es bei CC0.** Die Ausnahme gilt nur für `public/creatures`.

## Modelle

| Datei | Rolle | Autor | Lizenz | Quelle |
|---|---|---|---|---|
| `spuerfuchs.glb` | Spürfuchs | Quaternius | CC0 | poly.pizza, Animated Animal Pack |
| `k7-wolf.glb` | K7-Wolf | Quaternius | CC0 | poly.pizza, Animated Animal Pack |
| `kampf/k7-wolf.glb` | K7-Wolf mit Rig für den Kampf (D172) | Quaternius | CC0 | dasselbe Modell, gebunden an Skelett und Clips der Quelle (Animated Animal Pack, „Wolf“: Idle, Walk, Gallop, Attack, HitReact, Death) mit `tools/kampftierbau.py` |
| `kampf/grathorn.glb` | Grathorn mit Rig für den Kampf (D172) | Quaternius | CC0 | dasselbe Modell, Skelett und Clips der Quelle (Animated Animal Pack, „Stag“: Idle, Walk, Gallop, Attack_Headbutt, HitReact, Death) |
| `kampf/spuerfuchs.glb` | Spürfuchs mit Rig für den Kampf (D173) | Quaternius | CC0 | dasselbe Modell, Skelett und Clips der Quelle (Animated Animal Pack, „Fox“: Idle, Walk, Gallop, Attack, HitReact links/rechts, Death), `tools/kampftierbau.py` |
| `kampf/nebelgams.glb` | Nebelgams mit Rig für den Kampf (D173) | Quaternius | CC0 | dasselbe Modell, Skelett und Clips der Quelle (Animated Animal Pack, „Deer“: Idle, Walk, Gallop, Attack_Headbutt, HitReact links/rechts, Death) |
| `kampf/waffen.glb` | Schwert und Axt der Wanderin (D173) | Quaternius | CC0 | Medieval Weapons Pack („Sword“, „Axe“, OBJ), gedreht, skaliert und im Griff zentriert mit `tools/waffenbau.py` |
| `held/m-waldlaeufer.glb`, `held/m-bauer.glb`, `held/w-waldlaeufer.glb`, `held/w-bauer.glb` | Hauptfigur-Gestalten (D175) | Quaternius | CC0 | Universal Base Characters (Standard: Kopf/Augen/Brauen der Superhero-Körper, Frisuren „Rigged to Head Bone") + Modular Character Outfits – Fantasy (Standard: Ranger, Peasant), zusammengesetzt mit `tools/heldbau.py`, gepackt mit `tools/heldpack.ts` |
| `held/held-clips.glb` | Clips der Hauptfigur (D175, nur Knochen) | Quaternius | CC0 | Universal Animation Library 2 (Schwertkombos, Block, Rückstoss, Taumeln) und die Clips der alten Wanderin (Quaternius-Rig, eigene Waffenclips), übertragen mit `tools/heldbau.py` |
| `held/m-waldlaeufer-leicht.glb`, `held/m-bauer-leicht.glb`, `held/w-waldlaeufer-leicht.glb`, `held/w-bauer-leicht.glb` | Leichte Gestalten für Bewohner (D176) | Quaternius | CC0 | wie die Hauptfigur-Gestalten, Kleidung 3 500 / Kopf 1 800 Dreiecke, Haare halbiert, Texturen 512 |
| `grathorn.glb` | Grathorn | Quaternius | CC0 | poly.pizza, Animated Animal Pack (Stag) |
| `nebelgams.glb` | Nebelgams | Quaternius | CC0 | poly.pizza, Animated Animal Pack (Deer) |
| `wurzelkeiler.glb` | Wurzelkeiler | Poly by Google | **CC BY 3.0** | poly.pizza, „Boar" |
| `alpenmurmel.glb` | Alpenmurmel | Poly by Google | **CC BY 3.0** | poly.pizza `2IatILCJa3X`, „Gopher" (aufrecht, Wachposten-Haltung) |
| `firnhase.glb` | Firnhase | Poly by Google | **CC BY 3.0** | poly.pizza `biNOm96olTH`, „Jackrabbit" |
| `kiemenbiber.glb` | Kiemenbiber | Poly by Google | **CC BY 3.0** | poly.pizza `fwtA7VLrXPr`, „Beaver" |
| `linsenuhu.glb` | Linsenuhu | Poly by Google | **CC BY 3.0** | poly.pizza `fNkq9CwSG6d`, „Great horned owl" — der Ast unter dem Vogel ist bis auf ein Stück unter den Krallen abgeschnitten |
| `moderotter.glb` | Moderotter | Poly by Google | **CC BY 3.0** | poly.pizza `dJW3JeUWXQ-`, „River otter" |
| `myzelmolch.glb` | Myzelmolch | Poly by Google | **CC BY 3.0** | poly.pizza `eqjMAgmr-pM`, „Salamander" |
| `schneehuhn.glb` | Schneehuhn | Poly by Google | **CC BY 3.0** | poly.pizza `4A0kLzM65Mg`, „Quail" |
| `sporenhahn.glb` | Sporenhahn | Poly by Google | **CC BY 3.0** | poly.pizza `6NTegstc5Jy`, „Rooster" |
| `trafomarder.glb` | Trafomarder | Poly by Google | **CC BY 3.0** | poly.pizza `4I1SBFHWuSo`, „Ferret" |
| `flussvater.glb` | Flussvater, Regent (D241) | eigene Arbeit | CC0 | prozedural mit `tools/welsbau.ts` (Riesenwels × Kläranlagen-Organik, Story-Bibel §5); kein Fremdmodell |

## Menschen (`public/figuren`, D143)

Spielerfigur und Bewohner kommen aus den Quaternius-Paketen **Ultimate Modular
Women** und **Ultimate Modular Men** — CC0 auf quaternius.com wie auf poly.pizza
(fünf Figuren des Women-Packs führt poly.pizza als CC BY 3.0, die bleiben draussen).
Seit D145 auch **Varianten aus Teilen**: Kopf, Rumpf, Beine, Füße verschiedener
Figuren an einer Armature — alle Figuren teilen die Knochen, aber nur innerhalb
derselben Ruhepose (Männer ohne „Adventurer“, Frauen) lassen sie sich mischen. Verarbeitet mit `tools/menschbau.py`: Schwert und
Icosphere weg, Finger-Knochen ans Handgelenk, vier Teile zu einem Netz, Farbe je
Materialrolle aus `PALETTE.figur` an den Vertex, planar dezimiert, Rig und drei
bis vier Animationen des Pakets behalten, `tools/menschpack.ts` packt Farbe und
Gewichte auf 8 Bit.

| Datei | Rolle | Autor | Lizenz | Quelle |
|---|---|---|---|---|
| `wanderin.glb` | Spielerfigur | Quaternius | CC0 | poly.pizza `y9KWOVG21R`, Ultimate Modular Women, „Hooded Adventurer" |
| `wanderin-waffen.glb` | Kampfclips der Spielerin (nur Knochen und Animation, `figuren/kampf/`) | Quaternius (Rig), Clips selbst gebaut | CC0 | Rig aus poly.pizza `y9KWOVG21R`; die neun Clips (Klinge/Axt: Haltung, Kette, schwer, Lauf) aus `tools/waffenclips.py`, abgetrennt mit `tools/waffenteilen.ts` (D171); seit D173 dazu sieben Clips aus der Universal Animation Library 2 (Quaternius, CC0: Sword_Regular_A/B/C, Sword_Dash, Sword_Block, Hit_Knockback, Idle_Shield_Break), übertragen mit `tools/ual2uebertrag.py` |
| `bauer.glb` | Bewohner (frei) | Quaternius | CC0 | poly.pizza `7pn3R6hPvE`, Ultimate Modular Men, „Farmer" |
| `arbeiter.glb` | Der Wart vom Bruch | Quaternius | CC0 | poly.pizza `Yg2bQZO6Hj`, Ultimate Modular Men, „Worker" |
| `wanderer.glb` | Bewohner (frei) | Quaternius | CC0 | poly.pizza `kZ3DmIoGip`, Ultimate Modular Men, „Casual Character" |
| `baeuerin.glb` | Tremmel, Hofbesitzerin | Quaternius | CC0 | poly.pizza `nIItLV9nxS`, Ultimate Modular Women, „Animated Woman" |
| `werkfrau.glb` | Die Frau am Werkstor | Quaternius | CC0 | poly.pizza `qJ2gsTUBHL`, Ultimate Modular Women, „Animated Woman" (zweite) |
| `foerster.glb` | Der Förster | Quaternius | CC0 | Teile aus poly.pizza `kZ3DmIoGip` (Rumpf, „Casual Character“), `7pn3R6hPvE` (Kopf, „Farmer“), `Yg2bQZO6Hj` (Beine, Füße, „Worker“), Ultimate Modular Men |
| `wirt.glb` | Der Wirt | Quaternius | CC0 | poly.pizza `JFrLIKqvCH`, Ultimate Modular Men, „Business Man“ |
| `bursche.glb` | Der Bursche | Quaternius | CC0 | Teile aus poly.pizza `gKLBoRsyKe` (Rumpf, Kopf, Füße, „Hoodie Character“) und `kZ3DmIoGip` (Beine, „Casual Character“), Ultimate Modular Men |
| `alte.glb` | Die Alte am Zaun | Quaternius | CC0 | Teile aus poly.pizza `nIItLV9nxS` (Rumpf, Beine, Füße, „Animated Woman“) und `qJ2gsTUBHL` (Kopf, zweite „Animated Woman“), Ultimate Modular Women |
| `magd.glb` | Die Magd vom Unterhof | Quaternius | CC0 | Teile aus poly.pizza `qJ2gsTUBHL` (Rumpf, Beine, Füße) und `ZwF0K7WBmu` (Kopf, „Adventurer“), Ultimate Modular Women |

Alle Dateien sind gegenüber dem Original verändert: Materialfarbe an den Vertex
gebacken (bei den Poly-by-Google-Modellen aus der Base-Color-Textur je Fläche
abgetastet, D124), Leuchtdichte in die Palette der Welt gezogen, Dreiecke auf `zielTris`
reduziert, auf Widerristhöhe genormt und um 180° gedreht (`tools/kreaturbau.py`).
Bei CC BY ist das ausdrücklich erlaubt und muss als Bearbeitung kenntlich sein —
diese Zeile ist die Kenntlichmachung.

Zwei Eingriffe gehen darüber hinaus und stehen deshalb einzeln hier. Aus allen
vier Quaternius-Dateien fällt eine mitgelieferte `Icosphere` heraus, die zu
nichts gehört. Und beim **Grathorn** fällt das Hirschgeweih weg — es ist im
Original ein eigenes Netz (`Stag_Horns`, 1.616 Flächen), und die Linie trägt laut
`content/creatures/grathorn.json` ein Chitinplatten-Gehörn. Das kommt als Anbau
aus `src/world/kreaturgestalt.ts` und ist BRACHLAND-eigen.

## Materialien (`public/material`, D206, seit D223 Scans)

Gescannte Bodenschichten von Poly Haven. CC0, also ohne Pflicht zur Nennung; hier steht die
Herkunft trotzdem, damit niemand rätseln muss. Lizenz geprüft am 15.10.2026 auf
<https://polyhaven.com/license> („Our assets are all licensed as CC0“). Geladen in 2K (Diffuse,
`nor_gl`, Displacement, JPG) über `api.polyhaven.com/files/<id>`, gepackt auf 1024² WebP:
`*-farbe` = Diffuse linear durch den Scan-Mittelwert geteilt (Mittel 0,5, linear gespeichert)
+ Displacement im Alphakanal; `*-normal` = `nor_gl` verkleinert. Rohdaten liegen nicht im Repo
(`.cache/scans/`, gitignored).

| Datei | Rolle | Autor | Lizenz | Quelle |
|---|---|---|---|---|
| wiese-farbe.webp, wiese-normal.webp | Offener Boden, planar | Rob Tuytel | CC0-1.0 | Poly Haven `forrest_ground_01` (2 × 2 m) |
| waldboden-farbe.webp, waldboden-normal.webp | Waldboden (Laub, Moos), planar | Rob Tuytel | CC0-1.0 | Poly Haven `forest_leaves_02` (3 × 3 m) |
| schutt-farbe.webp, schutt-normal.webp | Schutt am Hangfuss, planar | Rob Tuytel | CC0-1.0 | Poly Haven `rocks_ground_01` (2 × 2 m) |
| fels-farbe.webp, fels-normal.webp | Fels an steilen Hängen, triplanar | Rob Tuytel | CC0-1.0 | Poly Haven `mossy_rock` (3 × 3 m) |
| rinde-farbe.webp | Rinde der Blender-Bäume (D224), nur Farbe + Höhe, Relief im Shader | Dimitrios Savva | CC0-1.0 | Poly Haven `knotted_pine_bark` (1,7 × 1,7 m), Lizenz geprüft 15.10.2026 |
| ez-nadel-cc0-v5.webp | EZ-Tree-Nadelkarte: Ausschnitt aus Farb- und Alphakarte, 512², mit eigener Randmaske | Rob Tuytel, Rico Cilliers | CC0-1.0 | Poly Haven [`pine_tree_01`](https://polyhaven.com/a/pine_tree_01), offizielle `twig_diff`/`twig_alpha` 1K-Modelltexturen; erzeugt mit `tools/eztexturen.mjs`, geprüft 08.11.2026 |
| ez-laub-cc0-v5.webp | EZ-Tree-Laubkarte: Ausschnitt aus Farb- und Alphakarte, 512², mit eigener Randmaske | Rico Cilliers | CC0-1.0 | Poly Haven [`tree_small_02`](https://polyhaven.com/a/tree_small_02), offizielle `leaves_diff`/`leaves_alpha` 1K-Modelltexturen; erzeugt mit `tools/eztexturen.mjs`, geprüft 08.11.2026 |
| farn-farbe.webp, farn-normal.webp, ../props/farn_scan_a–d.glb | Scan-Farne (D229): vier Varianten, Modulation + Alpha, Normale; ×1,6 skaliert, Windgewicht ergänzt (`tools/farnscan.ts`) | Rob Tuytel (Scan), Rico Cilliers (Modell) | CC0-1.0 | Poly Haven Modell `fern_02`, 1K-glTF, Lizenz geprüft 17.10.2026 |
| fels-moos-1-farbe.webp, fels-moos-1-normal.webp, ../props/findling_scan_d–f.glb | Bemooste Findlinge (D230), reduziert auf 2.200–2.400 Dreiecke | Kless Gyzen | CC0-1.0 | Poly Haven Modell `rock_moss_set_01`, 1K-glTF, Lizenz geprüft 17.10.2026 |
| fels-moos-2-farbe.webp, fels-moos-2-normal.webp, ../props/findling_scan_a–c.glb | Bemooste Findlinge (D230), reduziert auf 1.500–1.800 Dreiecke | Kless Gyzen | CC0-1.0 | Poly Haven Modell `rock_moss_set_02`, 1K-glTF, Lizenz geprüft 17.10.2026 |
| stumpf-1-farbe.webp, stumpf-1-normal.webp, ../props/totholz_scan_stumpf.glb | Baumstumpf (D230), 41.046 → 2.400 Dreiecke | Rob Tuytel | CC0-1.0 | Poly Haven Modell `tree_stump_01`, Lizenz geprüft 17.10.2026 |
| stumpf-2-farbe.webp, stumpf-2-normal.webp, ../props/totholz_scan_dick.glb | Baumstumpf (D230), 62.345 → 2.399 Dreiecke | Rob Tuytel | CC0-1.0 | Poly Haven Modell `tree_stump_02`, Lizenz geprüft 17.10.2026 |
| ast-farbe.webp, ast-normal.webp, ../props/totholz_scan_ast.glb, ../props/totholz_scan_zweig.glb | Liegende Äste (D230) | Rico Cilliers | CC0-1.0 | Poly Haven Modell `dry_branches_medium_01`, Lizenz geprüft 17.10.2026 |
| wurzelstock-farbe.webp, wurzelstock-normal.webp, ../props/totholz_scan_wurzelstock.glb | Wurzelstock (D233), 225.261 → 2.389 Dreiecke | Jenelle van Heerden, Rico Cilliers | CC0-1.0 | Poly Haven Modell `root_cluster_01`, Lizenz geprüft 17.10.2026 |
| wurzelstrang-farbe.webp, wurzelstrang-normal.webp, ../props/totholz_scan_wurzelstrang.glb | Wurzelstrang (D233), 213.939 → 2.400 Dreiecke | Jenelle van Heerden | CC0-1.0 | Poly Haven Modell `root_cluster_02` (Teil `_a`), Lizenz geprüft 17.10.2026 |
| wurzel-einzel-farbe.webp, wurzel-einzel-normal.webp, ../props/totholz_scan_wurzel_einzel.glb | Einzelwurzel (D233), 61.027 → 1.799 Dreiecke | Jenelle van Heerden | CC0-1.0 | Poly Haven Modell `single_root`, Lizenz geprüft 17.10.2026 |
| gras-farbe.webp, gras-normal.webp, ../props/gras_scan_a–f.glb | Grasbüschel (D234), Blattkarten mit Alpha, nicht reduziert, auf 0,18–0,85 m skaliert | Rico Cilliers | CC0-1.0 | Poly Haven Modell `grass_medium_02`, Lizenz geprüft 17.10.2026 |
| gras-horste.webp, gras-horste.json | Foto-Büschel und -Kräuter für den Grasteppich (D272, `?gras=3`): 22 Kacheln à 384² (7 grün, 5 trocken, 4 Kraut, 3 Blüten, 3 Halme mit Samenständen), Alpha aus der Silhouette, Farbe unter dem Rand nach aussen gefüllt; je Kachel Rechteck und Kantenlänge in Metern in der JSON. Gerendert, nicht fotografiert: jedes Scan-Netz seitlich orthografisch (`tools/grashorste/bake.mjs`, `pack.py`) | Rob Tuytel (Foto), Rico Cilliers (Modell), Jenelle van Heerden und weitere laut Poly-Haven-Seite des jeweiligen Assets | CC0-1.0 | Poly Haven [`grass_medium_01`](https://polyhaven.com/a/grass_medium_01) (Kacheln 0, 1, 2, 3, 4, 5, 6, 7, 9, 10), [`grass_medium_02`](https://polyhaven.com/a/grass_medium_02) (0–4), [`weed_plant_02`](https://polyhaven.com/a/weed_plant_02) (0, 1), [`nettle_plant`](https://polyhaven.com/a/nettle_plant) (4), [`shrub_sorrel_01`](https://polyhaven.com/a/shrub_sorrel_01) (4), [`dandelion_01`](https://polyhaven.com/a/dandelion_01) (0, 1), [`periwinkle_plant`](https://polyhaven.com/a/periwinkle_plant) (0); 2K-glTF, Lizenz geprüft 13.11.2026 (<https://polyhaven.com/license>, CC0). Autoren der vier neuen Assets: UNKLAR, nicht einzeln nachgesehen — CC0 verlangt keine Nennung |
| laub-bueschel.webp | Laubbüschel für die Laubkarten (D282, `?laub=2`): 16 Kacheln à 512², je ein 1-m-Ausschnitt der Aussenkrone, Alpha aus der Silhouette, Farbe unter dem Rand gefüllt und je Kanal auf das Mittel von `ez-laub-cc0-v5.webp` gebracht. Gerendert, nicht fotografiert: echte Blattgeometrie der Modelle orthografisch mit Tiefenabdunklung (`tools/laubbueschel/bake.mjs`, `pack.py`) | Rico Cilliers (`tree_small_02`), Rob Tuytel + Rico Cilliers (`island_tree_02`) | CC0-1.0 | Poly Haven [`tree_small_02`](https://polyhaven.com/a/tree_small_02) (12 Kacheln), [`island_tree_02`](https://polyhaven.com/a/island_tree_02) (4 Kacheln), glTF 1K, geprüft 14.11.2026 |
| nadel-bueschel.webp | Nadelbüschel für die Nadelkarten (D282, `?laub=2`): 16 Kacheln à 512², je ein 0,8-m-Ausschnitt der Aussenkrone, Alpha aus der Silhouette, Farbe unter dem Rand gefüllt und je Kanal auf das Mittel von `ez-nadel-cc0-v5.webp` gebracht. Gerendert: echte Nadelgeometrie orthografisch mit Tiefenabdunklung (`tools/laubbueschel/bake.mjs`, `pack.py nadel`) | Rob Tuytel (Foto), Rico Cilliers (Modell) | CC0-1.0 | Poly Haven [`pine_sapling_small`](https://polyhaven.com/a/pine_sapling_small) (12 Kacheln), [`fir_sapling`](https://polyhaven.com/a/fir_sapling) (4 Kacheln), glTF 1K, geprüft 14.11.2026 |
| weide-bueschel.webp | Weidenruten für die Hängekarten der Weide (D283, `?laub=2`): 16 Kacheln à 256 × 768 (0,3 × 0,9 m), lanzettliche Blätter mit silbriger Unterseite an gebogenen Ruten, Farbe je Kanal auf das Mittel von `ez-laub-cc0-v5.webp` gebracht | eigene Arbeit | CC0 | prozedural mit `tools/laubbueschel/weide.html` gerendert (`bake.mjs weide`, `pack.py weide`); kein Fremdmodell, keine Fremdtextur |
| hof-scans.webp, hof-scans-nor.webp, hof-scans-arm.webp, hof-scans.json | D298: Original-sRGB-Albedo, OpenGL-Normalen, AO/Rauheit; 2×2-Atlas mit 1008² Innenfläche und 8px Rand je1024²-Kachel; `tools/hofscans.mjs`, Quellen/Hashes in JSON | siehe Quelle | CC0-1.0 | Poly Haven [plastered_wall_03](https://polyhaven.com/a/plastered_wall_03), [weathered_planks](https://polyhaven.com/a/weathered_planks), grey_roof_tiles und old_stone_wall. Autoren Rob Tuytel, Dario Barresi/Dimitrios Savva, Charlotte Baglioni. [Lizenz](https://polyhaven.com/license), geprüft 17.11.2026 |
| hof-kies-farbe.webp, hof-kies-normal.webp, hof-kies-arm.webp, hof-kies.json | D298 Endfassung: heller Kies, originaler Farbraum, 1024²; `tools/hofscans.mjs kies` | Jenelle van Heerden, Dimitrios Savva | CC0-1.0 | Poly Haven [gravel_floor_02](https://polyhaven.com/a/gravel_floor_02), 2m; [Lizenz](https://polyhaven.com/license), geprüft 17.11.2026 |
| hof-boden-farbe.webp, hof-boden-normal.webp, hof-boden-arm.webp | D298 Erstversuch roter Erdboden (Endfassung ungenutzt, kein Precache), originaler Farbraum, 1024²; `tools/hofscans.mjs` | Amal Kumar | CC0-1.0 | Poly Haven [gravel_road](https://polyhaven.com/a/gravel_road), 2m Wiederholung; [Lizenz](https://polyhaven.com/license), geprüft 17.11.2026 |
| hof-fels-moos-1-farbe.webp, hof-fels-moos-1-normal.webp, hof-fels-moos-1-arm.webp, hof-fels-moos-2-farbe.webp, hof-fels-moos-2-normal.webp, hof-fels-moos-2-arm.webp, hof-props.json | D298 Originalkarten für bestehende Scanstein-UV; neue Normalen nur Quellenbeleg, Laufzeit nutzt bestehende Normalen; 1024²; `tools/hofscans.mjs props`, Quellen/Hashes in JSON | Kless Gyzen | CC0-1.0 | Poly Haven [rock_moss_set_01](https://polyhaven.com/a/rock_moss_set_01) und [rock_moss_set_02](https://polyhaven.com/a/rock_moss_set_02); [Lizenz](https://polyhaven.com/license), geprüft 17.11.2026 |
| hof-farn-farbe.webp, hof-farn-normal.webp, hof-farn-arm.webp, hof-gras-farbe.webp, hof-gras-normal.webp, hof-gras-arm.webp | D298 Originalfarben für bestehende Pflanzen-UV; neue Normalen nur Quellenbeleg, Laufzeit nutzt bestehende Normalen; Alpha pixelgenau aus Quelle erhalten, 1024²; `tools/hofscans.mjs props` | Rob Tuytel (Farnscan), Rico Cilliers (Modelle) | CC0-1.0 | Poly Haven [fern_02](https://polyhaven.com/a/fern_02) und [grass_medium_02](https://polyhaven.com/a/grass_medium_02); [Lizenz](https://polyhaven.com/license), geprüft 17.11.2026 |
| haus-scans.webp, haus-scans-nor.webp, haus-scans.json | Hausscans (D284, `?haus=1`/`?echt=1`): 2 × 2-Atlas 512² je Kachel, Farbe als Modulation (je Kanal durch das Mittel geteilt, Mittel 0,5), Normale OpenGL; erzeugt mit `tools/hausscans.py` | siehe Quelle | CC0-1.0 | Poly Haven [`grey_plaster_02`](https://polyhaven.com/a/grey_plaster_02) (putz, 1.0 m, Rob Tuytel), [`old_planks_02`](https://polyhaven.com/a/old_planks_02) (schalung, 2.0 m, Rob Tuytel), [`grey_roof_tiles`](https://polyhaven.com/a/grey_roof_tiles) (dach, 3.0 m, Rob Tuytel), [`old_stone_wall`](https://polyhaven.com/a/old_stone_wall) (sockel, 2.0 m, Charlotte Baglioni), Texturen 1K, geprüft 14.11.2026 |
| haus-scans-hoehe.webp, hof-scans-hoehe.webp, hof-ziel-hoehe.webp, hoehe.json | D365: Höhenkarten für Parallax Occlusion Mapping an den Hauswänden (`src/world/hauspom.ts`), Graustufen, Weiß = oben, je Kachel auf 1.–99. Perzentil gestreckt, Layout wie die zugehörigen Farb-/Normalatlanten in halber Auflösung (512², 1024², 640²); erzeugt mit `tools/hoehenkarten.py`, Belege (URL, Bytes, SHA-256) in `hoehe.json` | siehe Quelle | CC0-1.0 | Poly-Haven-Displacement (1k PNG) derselben Scans wie `haus-scans` ([`grey_plaster_02`](https://polyhaven.com/a/grey_plaster_02), [`old_planks_02`](https://polyhaven.com/a/old_planks_02), [`grey_roof_tiles`](https://polyhaven.com/a/grey_roof_tiles), [`old_stone_wall`](https://polyhaven.com/a/old_stone_wall)) und `hof-scans` ([`plastered_wall_03`](https://polyhaven.com/a/plastered_wall_03), [`weathered_planks`](https://polyhaven.com/a/weathered_planks), `grey_roof_tiles`, `old_stone_wall`); [Lizenz](https://polyhaven.com/license), geprüft 21.11.2026. `hof-ziel-hoehe.webp` projektintern aus der Helligkeit von `hof-ziel-farbe.webp` (Hochpass), wie `hof-ziel-normal.webp` |
| weg-scans.webp, weg-scans-nor.webp, weg-scans.json | Wegscans (D285, `?belag=1`/`?echt=1`): 2 × 2-Atlas 512² je Kachel, Farbe als Modulation; erzeugt mit `tools/hausscans.py weg` | siehe Quelle | CC0-1.0 | Poly Haven [`worn_asphalt`](https://polyhaven.com/a/worn_asphalt) (asphalt, 2.0 m, Amal Kumar), [`gravel_road`](https://polyhaven.com/a/gravel_road) (schotter, 2.0 m, Amal Kumar), [`stony_dirt_path`](https://polyhaven.com/a/stony_dirt_path) (erdpfad, 2.17 m, eye-candy.xyz), [`grass_path_2`](https://polyhaven.com/a/grass_path_2) (graspfad, 1.0 m, Rob Tuytel), Texturen 1K, geprüft 15.11.2026 |
| wurzel-a-farbe.webp, wurzel-a-normal.webp, wurzel-b-farbe.webp, wurzel-b-normal.webp, ../props/totholz_scan_wurzel.glb, ../props/totholz_scan_wurzel2.glb | Wurzelteller (D230), je ~81k → 2.400 Dreiecke | Rob Tuytel | CC0-1.0 | Poly Haven Modell `pine_roots`, Lizenz geprüft 17.10.2026 |

Bis D222 lagen hier zwei Detailnormalen aus npm `@pmndrs/assets` 1.7.0 (`normals/0005`, `0015`,
Poimandres, CC0-1.0); D223 hat sie ersetzt.

## Himmel (`public/himmel`, D265)

| Datei | Was | Urheber | Lizenz | Quelle |
|---|---|---|---|---|
| alps_field_1k.hdr | Himmelsfoto (HDRI, 1k, Radiance) als Umgebungslicht der Probe `?hdri=1` und der WebGPU-Probe | Andreas Mischok | CC0-1.0 | Poly Haven [`alps_field`](https://polyhaven.com/a/alps_field) |

## Weltdaten (`public/world`, D290)

| Datei | Rolle | Urheber | Lizenz | Quelle |
|---|---|---|---|---|
| `oental-lod2.json` | Gebäudedachmaße aus CityGML, auf Trauf- und Firsthöhe, Dachform und Firstrichtung verdichtet und den OSM-Grundrissen zugeordnet. D331 ergänzt die aus Firstendpunkten berechnete Richtung für 508, 510 und 512 sowie die Dachkörpermaße für 512. D340 übernimmt die Dachflächen und Teilbauten für 410, 413, 444, 506, 507, 509, 511 und 513 aus Kachel 732_5290. Die Dachfarben stammen aus Dachpixeln der Orthophotos (D291). `tools/lod2import.py` erzeugt die Daten. | Bayerische Vermessungsverwaltung – www.geodaten.bayern.de | CC BY 4.0 | 3D-Gebäudemodelle LoD2 (OpenData), Kacheln 728–732 / 5288–5292 (UTM 32), abgerufen 15.11.2026, für D331 Kachel 732_5290 am 19.11.2026. Digitale Orthophotos DOP20 (WMS `by_dop20c`, OpenData), 121 Kacheln à 256 m, abgerufen 15.11.2026 |
| `content/regions/oental.json`, `nahhoehen` | D340. DGM1-Kachel 732_5290, ins lokale Spielraster resampelt, in Zentimetern relativ zum lokalen Datum gespeichert | Bayerische Vermessungsverwaltung – www.geodaten.bayern.de | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) · bearbeitet | [DGM1 OpenData](https://geodaten.bayern.de/opengeodata/OpenDataDetail.html?pn=dgm1) |
| `oental-fern-sued.json` | D345. 25 DGM1-Kacheln zum Fernraster des südöstlichen Hangs resampelt und auf Meter gerundet. Erzeugt mit `npm run fernland -- oental --dgm1-sued`. | Bayerische Vermessungsverwaltung – www.geodaten.bayern.de | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) · bearbeitet | [DGM1 OpenData](https://geodaten.bayern.de/opengeodata/OpenDataDetail.html?pn=dgm1) |
| `oental-fern-ring.json` | D349. 100 DGM1-Kacheln (E 726–735, N 5286–5295) auf 277² Punkte im Fernraster-Ring resampelt und auf Meter gerundet, 0 % Lücken. Erzeugt mit `npm run fernland -- oental --dgm1-ring`. | Bayerische Vermessungsverwaltung – www.geodaten.bayern.de | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) · bearbeitet | [DGM1 OpenData](https://geodaten.bayern.de/opengeodata/OpenDataDetail.html?pn=dgm1) |
| `fahlmoos-fern-ring.json` | D351. 100 DGM1-Kacheln (E 724–733, N 5292–5301) auf 277² Punkte im Fernraster-Ring resampelt und auf Meter gerundet, 0 % Lücken. Erzeugt mit `npm run fernland -- fahlmoos --dgm1-ring`. | Bayerische Vermessungsverwaltung – www.geodaten.bayern.de | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) · bearbeitet | [DGM1 OpenData](https://geodaten.bayern.de/opengeodata/OpenDataDetail.html?pn=dgm1) |

## Hof-Baukasten (D363)

| Datei | Was | Urheber | Lizenz | Quelle |
|---|---|---|---|---|
| `bauten/hof-708.glb` | Inntaler Einfirsthof, Verfallsstufe 1, für Gebäude 708 (Œntal) | BRACHLAND (prozedural) | eigenes Werk | `tools/hofbaukasten.py` Saat 708 Stufe 1, Masse 36 × 14,7 m aus dem OSM-Grundriss; Materialien prozedural in Blender gebacken, gepackt mit `tools/hofbau_pack.mjs`. Keine Fremdtexturen. |

## Was im Spiel stehen muss

Für CC BY reicht die Nennung in einer mitgelieferten Datei; ein Impressum im
Menü ist die sauberere Form. **Offen**, solange das Verzeichnis im Menü keinen
Abschnitt „Herkunft" hat.

## Nicht übernommen

| Modell | Autor | Lizenz | Warum nicht |
|---|---|---|---|
| `ibex` | Syl | CC BY 3.0 | Beine stehen in einer eingefrorenen Sprungpose schräg nach hinten weg — die Hörner stimmen, der Rest ist unbrauchbar (28.08.2026 gerendert und verworfen) |
| `Rabbit` (`mKev485XTR`) | Quaternius | CC0 | Ein Cartoon-Hase in T-Pose mit Armen — eine Figur, kein Tier (07.09.2026 gerendert und verworfen; der CC-BY-Jackrabbit ist ein Hase) |
| `Pheasant` (`1wqLCnNFCgv`) | Poly by Google | CC BY 3.0 | Geladen als Alternative zur Wachtel, nicht gebraucht |
