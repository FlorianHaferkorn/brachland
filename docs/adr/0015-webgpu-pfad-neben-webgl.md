---
last-reviewed: 2026-11-11
shelf-life-days: 180
---
# ADR-0015 — three.js aktuell halten und einen WebGPU-Pfad neben WebGL aufbauen

**Status:** Proposed · 2026-11-11 · erweitert ADR-0001 (three.js/PWA bleibt), ADR-0006 (Zielgerät
Desktop-Browser, M1) und ADR-0012 (Messlatte) gelten unverändert · Bestätigung durch Flo offen

## Kontext

Am 11.11.2026 zeigte Flo Beispiele, die besser aussehen als BRACHLAND und nach eigener Angabe
mit **three.js, WebGPU und Blender** im Browser laufen (Instagram-Reels chetanankola,
mbilalkhan: „1 BILLION triangles with Three.js“). Der Stack ist also derselbe — der Stand nicht:

- BRACHLAND stand auf **three r169** mit dem WebGL-Renderer. `"three": "^0.169.0"` lässt bei
  einer 0.x-Version kein Minor-Update zu; three ist deshalb seit August nicht mitgewachsen.
  Aktuell ist r187 (30.10.2026).
- Codex (H-249, D249) konnte die Takram-Atmosphäre nicht vollständig prüfen, weil sie
  three ≥ 0.170 verlangt.
- Der WebGPU-Renderer von three (`three/webgpu`, Materialien in TSL) bringt GPU-seitiges
  Culling und Compute. Darauf bauen die Virtual-Geometry-Ansätze auf (Cluster-LOD,
  Milliarden Quelldreiecke; Angaben der Autoren, unabhängig nicht geprüft). Genau diese
  Grenze — Dreiecke und Aufrufe — hält Gras, Bäume und Ufer bei uns auf Budget-Niveau.

Der Haken: Unsere Materialien sind **GLSL-Patches über `onBeforeCompile`** (14 Stellen in
9 Dateien: Boden, Gras, Wind, Laub, Band, Haus, Streuung, Held, EZ-Probe) plus 10 eigene
`ShaderMaterial`s (Kontur, AO, Nachbearbeitung). Der WebGPU-Renderer kennt beides nicht;
jedes davon muss als TSL-Knoten neu geschrieben werden. Ein Umstieg in einem Schritt hiesse
wochenlang ein Spiel, dessen Look niemand prüfen kann.

## Entscheidung

1. **three.js wird aktuell gehalten.** Sofort auf r187 (`^0.187.0`, @types/three gleich).
   Danach bei jedem Arbeitsblock prüfen, ob eine neue Version da ist; ein Rückstand über
   drei Minor-Versionen ist ein Ledger-Befund. Ein Update gilt erst als fertig, wenn
   `make check`, `npm run build` und ein Konsolenlauf ohne Shader-Fehler grün sind
   (alle gepatchten `#include <…>`-Chunks existieren noch — sonst greift ein Patch still nicht).
2. **WebGL bleibt Vorgabe.** Der WebGPU-Pfad entsteht **daneben**, hinter `?renderer=webgpu`,
   Material für Material. Fehlt einem Material die TSL-Fassung, fehlt es im WebGPU-Pfad
   sichtbar (Probe-Kennzeichnung), nicht still.
3. **Reihenfolge der Portierung nach Hebel:** Grasteppich (grösste Instanzzahl) → Boden →
   Wind/Laub (Vegetation) → Wasser/Band → Rest → Kontur/Nachbearbeitung.
4. **Umschalten der Vorgabe nur nach Messung am M1** in Bewegung (ADR-0005/0006), gleiche
   Stelle, gleiche Kamera: Bildrate (Mittel, p95), Dreiecke, Aufrufe, Bildvergleich gegen
   das Blender-Zielbild. Kriterium: gleich gut aussehend bei mindestens gleicher Bildrate,
   oder sichtbar besser bei höchstens 10 % längerer Bildzeit. Safari und Chrome auf dem M1.
5. **Virtual Geometry erst nach dem Umstieg.** Bibliotheken wie `three-virtual-geometry`
   werden erst geprüft, wenn der WebGPU-Pfad das ganze Spiel trägt — vorher misst man zwei
   Unbekannte zugleich.

## Begründung

- Es ist der kleinste Schritt, der die Grenze angeht, an der BRACHLAND tatsächlich hängt
  (Geometrie und Aufrufe, nicht die Engine an sich). Unreal bleibt auf dem M1 mit 8 GB
  ausgeschlossen (D221) und ist ein eigenes Projekt (D222).
- Das Update allein ist billig und entblockt Codex' Takram-Probe (H-249).
- Paralleler Pfad statt Umbau: Die erarbeiteten Werte (Nebel, LOD, Gras) bleiben im
  WebGL-Pfad bitgleich nachprüfbar, bis der neue Pfad sie eingeholt hat.

## Folgen

- Doppelte Pflege, solange beide Pfade leben: Jede Material-Änderung braucht beide
  Fassungen oder einen Vermerk, dass der WebGPU-Pfad nachzieht. Darum zügig portieren
  oder den Pfad abbrechen — kein dauerhafter Zustand.
- Die Cloud-Sessions von Claude rendern ohne GPU (SwiftShader); WebGPU läuft dort nicht.
  Jede Aussage über den WebGPU-Pfad braucht eine Messung auf dem M1 (Codex oder Flo).
- Firefox: WebGPU dort nicht vorausgesetzt; der WebGL-Pfad bleibt als Rückfall erhalten.

## Nicht entschieden

- Ob der WebGPU-Pfad die Vorgabe wird — das entscheidet die Messung nach Punkt 4.
- Ob `postprocessing` (Codex, D249) oder die eingebaute Nachbearbeitung von `three/webgpu`
  die Kontur-/AO-Pässe trägt.
