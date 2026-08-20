---
last-reviewed: 2026-08-20
shelf-life-days: 90
owns: *.ts, *.mjs, *.py, *.sh
---
# tools — Bau-, Mess- und Asset-Werkzeuge (_INDEX)

> Läuft über `tsx`, nicht über den Vite-Build. Nicht zu verwechseln mit `../scripts/`:
> dort liegen Repo-Kit-Gate und ROI-Prüfung (Python, projektunabhängig).
>
> **Zwei Sorten:** *Bauschritte* verändern das Repo (Weltdaten, Assets), *Messungen*
> geben nur Zahlen aus. Messungen gehören nicht ins Gate — sie beantworten Fragen,
> sie stellen keine Bedingungen.

## „Lies-wenn"-Routing

| Deine Aufgabe ist … | Lies |
|---|---|
| Weltdaten für eine Region erzeugen | `buildworld.ts` → `../src/world/osm.ts` |
| Inhalte gegen das Schema prüfen | `validate.ts` → `../src/data/schema.ts` |
| Budgets und Blocker verstehen | `quality.ts` → `../docs/QUALITY.md` |
| KI-Modell spieltauglich machen | `README.md` → `pipeline.sh` → `voxelbau.py` → `autorig.py` → `entkleiden.mjs` → `nachbereiten.mjs` |
| Wissen wollen, warum Schritt 1 nicht mehr dezimiert | `voxelbau.py` → `quadtest.py` → `reduce.mjs` |
| Ganze Ordner durch die Kette schicken | `batch.mjs`, `pipeline.sh` |
| Prüfen, ob das Dreiecksbudget hält | `lodcheck.ts`, `scenecheck.ts` |
| Gelände- oder Baumqualität beurteilen | `hoehenvergleich.ts`, `baumcheck.ts` |
| Herausfinden, warum es ruckelt, obwohl die Geometrie passt | `lastcheck.ts` |
| Prüfen, ob man beim Spielen überhaupt Kreaturen findet | `vorkommencheck.ts` |
| Größenverhältnisse prüfen | `masstab.ts` |
| Beurteilen, ob der Wald zu dunkel ist — **bevor** man an Lichtwerten dreht | `lichtcheck.ts` |
| Vegetation aus dem Kenney-Kit nachziehen oder umfärben | `propbau.ts` → `../src/world/props.ts` |
| An `DICHTE` drehen oder wissen wollen, wie leer das Dorf ist | `dichtecheck.ts` → `../src/world/props.ts` |
| Prüfen, ob eine Bewegungsregel die Welt unbegehbar macht | `steigungcheck.ts` |
| Prüfen, ob Silhouetten ins Budget passen — **und ob man ihnen die Herkunft ansieht** | `gestaltcheck.ts` |
| Ein Gleitverhältnis wählen, ohne zu raten | `gleitcheck.ts` → `../src/spieler/gleiten.ts` |
| Entscheiden, ob eine Fähigkeit in dieser Region überhaupt einen Ort hat | `wassercheck.ts` |
| Klären, warum Bäche in der Luft hängen oder Häuser Lücken haben | `aufsatzcheck.ts` → `../src/world/lod.ts` |

## Bauschritte

| Datei | Zweck |
|---|---|
| `buildworld.ts` | `npm run world <region> <raster> [dgm1\|eudem]` — OSM und Höhen abrufen, Welt bauen, gepackt nach public/world schreiben |
| `dgm1.ts` | Höhen aus dem 1-Meter-Geländemodell der Bayerischen Vermessungsverwaltung. Lädt Kilometerkacheln, interpoliert bilinear |
| `voxelbau.py` | `blender --background --python voxelbau.py -- <ein.glb> <aus.glb> [2700\|voxel:0.027]` — **Schritt 1 der Kette seit D81.** Baut die Oberfläche per Voxel-Remesh aus einem Distanzfeld neu, statt sie zu dezimieren, und sucht die Voxelgröße zur Zieldreieckszahl per Bisektion. Grund: KI-Modelle sind keine Körper — der Fuchs hatte **583 getrennte Teile und 30.216 offene Kanten**, deren Mindestflächen `reduce.mjs` bei 3.194 festnageln (G-88). Der Remesh wirft dabei die UV weg, deshalb überträgt derselbe Schritt die Farbe vorher per Nächster-Punkt und baryzentrischer UV in ein `COLOR_0`. Am Fuchs ganze Kette: **2.728 Dreiecke, 121 KB** gegen dezimiert 3.301 Dreiecke, 189 KB bei 190 KB Budget (G-97) |
| `reduce.mjs` | Flächenreduktion roher KI-Modelle auf die Zielzahl (gltf-transform + meshoptimizer). **Bis 20.08.2026 Schritt 1**, jetzt der Rückweg über `VERFAHREN=dezimieren` — richtig für Quellen, die schon ein sauberer geschlossener Körper sind, wo der Voxel-Remesh nur Kanten wegwürfe. Die Texturpackung rät nicht mehr, sondern rechnet verlustfrei und q90 aus und nimmt die kleinere: Das übernommene `lossless: true` aus `nachbereiten.mjs` stimmt für Blenders flächige PNG und blies Tripos fotografische JPEG **von 0,79 auf 6,45 MB** auf (G-87). Die Ausgabe weist Geometrie und Textur seitdem getrennt aus — die alte Zeile „Faktor 1.0x" verbarg, dass zwei gegenläufige Bewegungen von 56x und 8x sich aufhoben |
| `entkleiden.mjs` | `node entkleiden.mjs <in.glb> [out.glb]` — **Schritt 3, nach dem Rigging.** Tastet die Basisfarbtextur an jeder UV ab, legt sie als `COLOR_0` ab und wirft Texturen, UV und Normalen weg. Dieselbe Materialsprache wie die 36 Props seit D74 — und der einzige Weg ans 120-KB-Budget: gemessen am Fuchs 6.733 KB mit verlustfreier Textur, 900 KB mit q90, **90 KB** ohne. Nach dem Rigging aus demselben Grund wie Schritt 4 (D80). Bringt das Primitiv seine Farbe schon mit — im Voxel-Weg der Normalfall —, lässt der Schritt sie stehen und wirft nur noch Normalen und Materialreste weg; bis 20.08.2026 überschrieb er sie mit dem Grundfarbfaktor und färbte den Fuchs glatt weiß (G-96) |
| `nachbereiten.mjs` | `node nachbereiten.mjs <in.glb> [out.glb]` — **Schritt 4, nach dem Rigging.** Dünnt die von Blender gebackenen Animationskeys aus, quantisiert und wandelt die Textur. Muss hinter `autorig.py` laufen: Blender schreibt die Datei neu und macht alles rückgängig, was Schritt 1 an der Kodierung getan hat. Das war die Ursache von A-6 (163–167 → 100–103 KB), siehe G-63 |
| `batch.mjs` | Stapelverarbeitung ganzer Ordner durch die Reduktion |
| `autorig.py` | Automatisches Rigging über Blender anhand der Archetyp-Rigs |
| `rigausbau.mjs` | `node rigausbau.mjs <in.glb> <out.glb> [koerpermesh]` — schneidet aus einem fertigen Modell das **Archetyp-Rig** heraus: behält Skelett, Haut und Animationen, wirft alle Meshes außer dem benannten Körper weg. Damit ist `assets/rigs/quadruped.glb` entstanden, aus den Dateien, die als Grathorn geführt wurden und ein three.js-Beispielfuchs waren (G-65) |
| `rigbau.mjs` | `npm run rigs` — erzeugt `serpent.glb` und `biped_bird.glb` **rechnerisch**: Knochenkette, Skin und drei Bewegungen aus Sinuskurven. Kein Fremdmodell, keine CC-BY-Pflicht. `quadruped_small` fehlt mit Absicht — `autorig.py` skaliert das Skelett ans Mesh, also teilt es sich das Rig mit `quadruped` |
| `propbau.ts` | `npm run props:bau` — baut die Prop-GLB aus dem Kenney Nature Kit (CC0): Kenneys Palette raus, Projektfarbe je Materialrolle als Vertexfarbe rein, alle Primitive zu einem verschmolzen, Höhe aus `VARIANTEN` in echte Meter gerechnet. Braucht das Kit unter `.cache/kenney/natur` und sagt sonst, wie man es holt |
| `hoehenbild.mjs` | `node hoehenbild.mjs <a.json> <b.json> <raus.png> [ausschnitt]` — zwei Weltstände als Schummerung nebeneinander. Weil „mittlere Stufe 3,08 gegen 2,09 m" die richtige Zahl ist und trotzdem niemand ihr ansieht, ob ein Hang terrassiert wirkt |
| `pipeline.sh` | `npm run assets` — Roh-GLB → remeshed → geriggt → entkleidet → nachbereitet, in einem Durchlauf. `VERFAHREN=voxel` (Vorgabe) oder `dezimieren` schaltet Schritt 1 um |

## Tore (blocken den Merge)

| Datei | Zweck |
|---|---|
| `validate.ts` | `npm run validate` — alle Inhalte gegen die Zod-Schemas plus Elementmatrix-Selbsttest. Teil von `make check` |
| `quality.ts` | `npm run quality` — Kreatur-, Regions-, Balance- und Asset-Budgets. **Seit 17.08.2026 Teil von `make check`**: A-6 und A-7 sind erledigt, das Tor steht auf 0 Blockern. Blockt außerdem eine Brand-Kreatur im Œntal (G-62) |

## Messungen (geben Zahlen, keine Bedingungen)

| Datei | Zweck |
|---|---|
| `lodcheck.ts` | `npm run lod` — Dreiecke je LOD-Stufe, Detail vor dem Spieler, Wirkung des Mikroreliefs |
| `masstab.ts` | `npm run masstab` — Kamera, Spielerhöhe, Bildanteil, Querungszeiten der Region |
| `scenecheck.ts` | `npm run szene` — tatsächlich gezeichnete Dreiecke je Kamerastandort, über **alle drei** Prop-Stufen: bis 45 m das volle Modell, bis 110 m die Mittelstufe, dann das Primitiv. Die Stufe bei 45 m fehlte lange, und für Nicht-Bäume wurde das Rückfall-Primitiv statt der GLB gezählt — Bäume zwölffach zu teuer, alles andere zu billig (G-85). Ein Urteil gibt das Werkzeug nicht ab: Das 400k-Budget war ein Literal, kein Messwert (G-18) |
| `terraincheck.ts` | `npm run terrain` — Terrain-Auflösung. Braucht einen Vorschau-Cache unter .cache/ |
| `lastcheck.ts` | `npm run last` — Objekte im Szenengraph je Standort. Die Größe, die zählt, wenn kein Grafikschalter wirkt |
| `vorkommencheck.ts` | `npm run vorkommen` — Kreaturen je Linie und je km², Weg bis zur nächsten Begegnung, Stufenverteilung |
| `hoehenvergleich.ts` | `npm run hoehen` — Geländeauflösung im Vergleich: mittlere Stufe zwischen Nachbarpunkten je Raster |
| `baumcheck.ts` | `npm run baum` — Dreiecke, Höhe und Bauzeit der prozeduralen Bäume |
| `klippencheck.ts` | `npm run klippen` — Zahl, Höhe und Dreiecke der Felswände, und wie viele je Standort in Reichweite stehen |
| `propcheck.ts` | `npm run props` — **wie viele Props sehen genau gleich aus?** Zählt je *Erscheinung* (Form × Farbe), nicht je Datei: Vorher trugen 53.815 Fichten vier Formen und eine Farbe je Form, die größte identische Gruppe umfasste 13.572 Stück, jetzt 60 (D79). Dazu Dreiecke, Größe und der Helligkeitsverlauf **im** Modell — 15 der 36 Modelle hatten gar keinen. Die erste Fassung las `assets/props`, einen Ordner, den es seit `propbau.ts` nicht mehr gibt, und lief ins Leere, ohne es zu sagen |
| `lichtcheck.ts` | `npm run licht` — Bildschirmhelligkeit je Material und Stimmung, den ganzen Weg über Lambert, ACES, sRGB und Nebel. Beantwortet „ist der Wald zu dunkel" mit einer Zahl statt mit einem Gefühl |
| `steigungcheck.ts` | `npm run steigung` — was die 40°-Grenze an begehbarer Welt kostet: 108.568 Prüfpunkte, Anteil offener Standorte, Kessel ohne Ausweg, Gewinn durchs Klettern |
| `gestaltcheck.ts` | `npm run gestalt` — Dreiecke je Silhouette und Mutationsstufe gegen die Grenze von 600, plus zwei Bedingungen, die kein Kommentar sichern kann: dass die drei **Herkünfte verschieden bauen** (Creature Design Bible §1) und dass derselbe Seed dieselbe Gestalt ergibt. Entstanden, weil der Dateikopf „unter 250 Dreiecken" versprach und bei 492 lag (G-61) |
| `gleitcheck.ts` | `npm run gleit` — 9.600 simulierte Flüge über das echte Höhenfeld: Höhenvorrat, Absprungkanten (596/km²), erreichte Weiten je Gleitverhältnis und der Vergleich gegen den Fußweg. Hat das Verhältnis **3:1** entschieden (D71) und dabei aufgedeckt, dass Gehen und Rennen an drei Orten dreimal verschieden standen (G-66) |
| `wassercheck.ts` | `npm run wasser` — Länge, Breite und Tiefe der Gewässer, und prüft, dass `baueWasserfeld` alle 190 Läufe trifft. Hat Schwimmen zuerst **verworfen** (breitestes Fließgewässer 4,0 m gegen 4,6 m Sprungweite) und dann selbst widerlegt: Der erste Lauf las nur `welt.linien` und übersah elf `natural=water`-Polygone (G-50). Waten trägt die Bäche, Schwimmen die Weiher |
| `voxelgrenze.py` | `blender --background --python tools/voxelgrenze.py -- [--glb <ordner>] [voxel …]` — wie dünn darf ein Glied sein, damit der Voxel-Remesh es behält? Misst an einem Prüfkörper mit bekannten Dicken (sechs Platten, sechs Stäbe, 0,005–0,060 der längsten Achse). Antwort: **nichts verschwindet** — unter 0,8× Gitterweite wird das Glied dicker als vorgegeben, unter 0,4× wird es fransig und die Spitze verliert Länge (G-99). Der Prüfkörper wird **schief** remeshed, weil er achsparallel jede Dicke überlebt und damit nichts beweist |
| `quadtest.py` | `blender --background --python tools/quadtest.py -- <in.glb> <ziel>` — bricht Remeshing die Dezimierer-Untergrenze aus G-88? Zählt zuerst die Ursache (583 getrennte Teile, 30.216 offene Kanten am Fuchs), dann Quadriflow gegen Voxel-Remesh bei mehreren Zielgrößen. Quadriflow verweigert an offenen Netzen **ohne Fehlermeldung** — wer nur die Zielzahl liest, hält das für Erfolg. Voxel geht auf 1.756 Dreiecke und schweißt 583 Teile auf 2 (G-94) |
| `dichtecheck.ts` | `npm run dichte` — wie dicht steht der Bewuchs, je Biom **und** je Abstand zum nächsten Grundriss? Die zweite Staffelung ist die wichtigere: das Biom ist eine Rasterzelle, das Dorf ist das, was in 30 m Umkreis wächst. Fand, dass die Siedlung mit 25 Props je Hektar die kahlste Fläche der Karte war (Wiese 66, freie Flur 128) und dass 4.975 Props auf dem Wegbelag standen, darunter 1.488 Fichten (G-84). Rechnet außerdem vor, was der Siedlungsstempel am Bewuchs gekostet hat |
| `aufsatzcheck.ts` | `npm run aufsatz` — sitzen Wasserbänder, Wege und Hauswände auf der Fläche, die gezeichnet wird? Misst **je LOD-Stufe**, weil der Fehler entfernungsabhängig ist, und **an der Bandkante**, weil dort die Böschung entschieden wird. Der erste Lauf maß gegen `terrain.hoeheAn` und damit gegen einen Pfad, den die Szene gar nicht benutzt (G-73) |
| `lodpreview.ts` | `npm run lodpreview` — Vorschau der LOD-Kachelung |

## Sonstiges

| Datei | Zweck |
|---|---|
| `README.md` | Die Reduktionspipeline im Detail: warum 1,9 Mio Flächen auf 2.000–6.000 müssen, und wie |

## Definition of Done

- **Input:** Änderung an einem Werkzeug
- **Output:** `npm run validate` grün, `npm run quality` ohne **neuen** Blocker
- **Fehlerfall:** neuer Blocker → Ursache beheben, nicht das Budget anheben
- **Rollback:** `git checkout -- tools/`
