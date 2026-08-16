# BRACHLAND — Kreatur-Reduktionspipeline

Wandelt KI-generierte 3D-Modelle (Tripo, Hunyuan3D, Meshy) in spieltaugliche
Low-Poly-Assets für die Offline-PWA um.

## Warum

Tripo-Export: **1.938.332 Flächen**. Spieltauglich für Handy/PWA: **2.000–6.000 Tris**
pro Kreatur. Ohne Reduktion wäre ein Roster von 200 Kreaturen weder ladbar noch cachebar.

## Installation

```bash
npm install @gltf-transform/core @gltf-transform/extensions \
            @gltf-transform/functions meshoptimizer sharp
```

## Nutzung

Einzelne Datei:
```bash
node reduce.mjs steinbock.glb steinbock_lp.glb 4000
```

Ganzer Ordner:
```bash
node batch.mjs ./in ./out 4000
```

## Was die Pipeline macht

| Schritt | Zweck |
|---|---|
| `dedup` | doppelte Accessors/Meshes zusammenfassen |
| `flatten` + `join` | Node-Hierarchie glätten, Primitives vereinen — **nur bei statischen Meshes** |
| `weld` | Vertices verschweißen (Pflicht vor `simplify`) |
| `simplify` | Quadric Edge Collapse via meshoptimizer, Zielverhältnis aus Ist-Stand berechnet |
| `resample` | Animationskeys ausdünnen |
| `prune` | Verwaistes entfernen — bei Rigs mit `keepAttributes`/`keepLeaves` |
| `textureCompress` | Texturen → WebP, max. 1024×1024, Qualität 85 |
| `quantize` | Positionen/Normalen/UVs/Weights in kleinere Datentypen |

## Rig-Sicherheit

Die Pipeline erkennt Skins und Animationen automatisch und schaltet in einen
schonenden Modus: `flatten` und `join` werden übersprungen (sie zerstören Skins),
`prune` behält Knochen-Nodes und JOINTS/WEIGHTS-Attribute.

Verifiziert an einem geriggten Testmodell: Skins 1→1, Knochen 24→24,
Animationen 3→3, JOINTS_0 und WEIGHTS_0 erhalten.

## Gemessene Ergebnisse

Synthetisches Hochpoly-Modell (entspricht dem Tripo-Fall):

```
Flächen      1.955.802  →  4.907   (0,3 %)
Vertices       980.000  →  3.168
Dateigröße     33,60 MB →  0,05 MB   (Faktor 633x)
```

Hochrechnung: **~15 MB für 200 Kreaturen** — unkritisch für den Service-Worker-Cache
einer Offline-PWA.

## Hinweise

- `simplify` arbeitet mit einem Zielverhältnis; bei sehr niedrigen Zielwerten kann
  `error: 0.005` die Reduktion begrenzen. Für aggressivere Reduktion Wert erhöhen.
- Texturen von KI-Generatoren sind oft 2048–4096 px; 1024 reicht für stilisierte
  Kreaturen auf dem Handy, 512 für Nebenkreaturen.
- Nach dem Reduzieren visuell prüfen: Quadric Decimation kann dünne Strukturen
  (Hörner, Fächer, Beine) kollabieren lassen. Bei Verlusten Zielwert erhöhen oder
  betroffene Teile getrennt reduzieren.
