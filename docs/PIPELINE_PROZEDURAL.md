---
last-reviewed: 2026-11-21
shelf-life-days: 90
---
# Prozedurale Asset-Pipeline: Blender 5.3 headless → glTF → three.js (Entwurf)

**Status:** Entwurf vom 21.11.2026, noch keine Entscheidung (Ledger A-23).

Flo, 21.11.2026: Nicht jedes Asset einzeln bauen, sondern skalierbar und mit möglichst wenig KI arbeiten, auf dem
Niveau aktueller Blender-Community-Arbeiten, nur mit kostenlosen Lizenzen (ADR-0013 bleibt).

## Belegter Stand

- **Blender 5.3** ist seit 10.11.2026 die aktuelle Version, **5.2 LTS** wird bis Juli 2028 gepflegt
  ([Release Notes](https://developer.blender.org/docs/release_notes/)).
- Für die Pipeline relevante Neuerungen:
  - 5.2: Listen und Geometry Bundles in Geometry Nodes; Werte von Node-Tools lassen sich per Python setzen.
  - 5.2: glTF-Export mit Meshopt-Kompression.
  - 5.3: glTF-Export mit KTX2-Texturen; besseres Texturbacken bei dünnen Dreiecken.
  - Quellen: [5.2 Geometry Nodes](https://developer.blender.org/docs/release_notes/5.2/geometry_nodes/),
    [5.2 Import/Export](https://developer.blender.org/docs/release_notes/5.2/pipeline_io/),
    [5.3 Import/Export](https://developer.blender.org/docs/release_notes/5.3/pipeline_io/),
    [5.3 Cycles](https://developer.blender.org/docs/release_notes/5.3/cycles/)
- **Hier in der Cloud getestet** (21.11.2026): Blender 5.3.0 läuft unter Linux ohne Bildschirm (`--background`).
  Cycles rendert auf der CPU eine Efeuwand mit 32.000 Blättern in 1280 × 720 in rund 50 s.
  - Skript: `../tools/efeuwand.py`
  - Bild: `.cache/bilder/blender-probe/efeuwand-cycles.png`
- **Mitgelieferte Node-Bausteine** (Lizenzdatei im Paket: CC0 1.0):
  - `geometry_nodes_essentials`: Scatter on Surface, Curve to Tube, Instance on Elements, Randomize Transforms u. a.
  - `procedural_hair_node_assets`: Generate, Clump, Curl und Shrinkwrap Hair Curves u. a.
  - `geometry_nodes_dynamics_assets`: Haar- und Stoffdynamik

## Freie Bausteine aus der Community (Lizenz laut Quelle; ohne Bildschirm noch nicht getestet)

| Bereich | Baustein | Lizenz |
|---|---|---|
| Efeu | [Ivy Generator](https://extensions.blender.org/add-ons/ivygen/) | GPL-2.0+ |
| Efeu | [ivy-generator (Geometry Nodes)](https://github.com/alexustexus/ivy-generator) | MIT |
| Bäume | [Modular Tree](https://extensions.blender.org/add-ons/modular-tree/), [Sapling](https://extensions.blender.org/add-ons/sapling-tree-gen/), [Easy Tree](https://extensions.blender.org/add-ons/easy-tree/); außerhalb Blenders [EZ-Tree](https://github.com/dgreenheck/ez-tree) | GPL-3.0+ / MIT |
| Gebäude | [Building Tools](https://github.com/ranjian0/building_tools) | MIT |
| Gebäude | [Buildify](https://paveloliva.gumroad.com/l/buildify) | frei, Wortlaut ⚠️ UNKLAR |

Für den Inntaler Einfirsthof (Blockbau, Laube) gibt es keinen freien Baukasten. Den müssten wir selbst als
Geometry-Nodes-Baukasten bauen.

GPL bei Add-ons betrifft das Werkzeug, nicht die erzeugten Modelle.

## Kostenlose Asset-Quellen und Auslieferung im Browser

| Quelle | Lizenz | Browser-Auslieferung |
|---|---|---|
| [Poly Haven](https://polyhaven.com/license) | CC0 | erlaubt |
| [ambientCG](https://docs.ambientcg.com/license/) | CC0 | erlaubt |
| [Quaternius](https://quaternius.com/faq.html) | CC0 | erlaubt |
| Sketchfab CC0/CC-BY-Scans (`ASSET_KANDIDATEN.md`) | CC0 / CC-BY | erlaubt; bei CC-BY mit Namensnennung (ADR-0013) |
| [BlenderKit](https://www.blendkit.com/docs/licenses/) | CC0 oder „Royalty Free“ | nur die CC0-Assets: Royalty Free verlangt, dass Modelle nicht direkt extrahierbar sind |
| Megascans über Fab | kostenlos seit 11/2026, [Fab Standard License](https://www.fab.com/eula) | **⚠️ UNKLAR / eher nein**: Die EULA verlangt laut Forenzitat, dass Endnutzer nichts extrahieren können; eine Anfrage zu Web-Apps blieb unbeantwortet ([Forum](https://forums.unrealengine.com/t/can-i-use-3d-assets-from-fab-s-standard-license-in-a-revenue-generating-web-app/2453541)) |

## Erster Fall umgesetzt: Efeukarten (D358)

`tools/efeukarten.py` → `tools/efeukarten_pack.py` → `public/material/efeu-karten-*.webp` → `src/world/efeukarten.ts` (`?efeukarten=1`). Vorher/Nachher unter `.cache/bilder/d358-efeukarten/`.

## Vorgeschlagener Ablauf

1. **Version:** Blender 5.2 LTS oder 5.3 festlegen. Aufruf immer
   `blender -b --factory-startup -P tools/<bau>.py -- <args>`.
2. **Bausteine:** Eigene Node-Gruppen (Efeu, Verfall, Hof-Baukasten) als `.blend` im Repo ablegen, Fremdbausteine
   nur aus CC0-, MIT- oder GPL-Quellen.
3. **Werte aus `content/`:**
   - Maße aus `massstab.json` (D352).
   - Verfall aus ADR-0017.
   - Seed aus dem Repo.
4. **Unikate:**
   - realisieren (Instanzen in echte Geometrie umwandeln),
   - auf der CPU mit Cycles backen: Farbe, Normalen, AO, Rauheit, von High- auf Low-Poly,
   - Detailstufen erzeugen.
5. **Masse** (Gras, Steine, Efeufläche, Laub) nicht als Einzelgeometrie exportieren:
   - entweder als gebackene Karten (Farbe, Normalen, Tiefe) oder als Instanzen,
   - die Positionen entstehen in three.js aus dem Seed (Performance-Invariante).
6. **Export:** glTF mit Meshopt und KTX2/WebP, danach glTF-Transform, gemessen gegen die Budgets.
7. **Prüfung:**
   - `npm run massstab` (Größen), `make check`,
   - Bildpaar Blender-Zielbild gegen Spielbild (`.cache/bilder/<Dxxx>/`),
   - Abnahme in Bewegung am Zielgerät.
