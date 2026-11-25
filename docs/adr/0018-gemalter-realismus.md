---
last-reviewed: 2026-11-21
shelf-life-days: 365
---
# ADR-0018 — Gemalter Realismus: reale Substanz, gemalte Darstellung

**Status:** Accepted · 2026-11-21 (Flo, D370) · löst ADR-0016 ab, soweit es „Hyperrealismus ist Ziel“ festlegt
(Entscheidung 21.11.2026, Zeile Park-Punkt Photoreal); WebGPU als Qualitätspfad (ADR-0015) und „Qualität vor den
M1-Grenzen“ bleiben · konkretisiert ADR-0012 (Messlatte Soulframe ingame) · Zielbild neu nach ADR-0006 (Stufe 2)

## Kontext

Flo, 21.11.2026: „ehrlich gesagt sind wir Meilenweit von AAA weg. Entweder wir lassen es und nehmen einen
einfacheren Stil oder wir machen es endlich richtig.“ Befund (D369): Browser, Solo-Entwicklung mit KI und nur
kostenlose Assets tragen keinen AAA-Fotorealismus — kein Nanite/Lumen, wenige freie Scan-Bäume, und bis heute
wurde der Look ohne GPU aus Standbildern beurteilt. Die eigene Messlatte (ADR-0012, Soulframe ingame) ist selbst
kein Fotorealismus, sondern gemalter Realismus. Die Filterstudie D369 zeigte drei Richtungen; Flo wählte A
(„gemalt“) mit der Bedingung: „die Assets müssen trotzdem noch Maserungen, Brüche, Tiefe etc. bekommen. Echter
wie Bäume.“

## Entscheidung

**Was ein Ding ist, ist real; wie es gezeigt wird, ist gemalt.**

1. **Substanz real.** Formen, Masse und Oberflächen folgen der Wirklichkeit: Holzmaserung, Risse, Abplatzungen,
   Kantenabnutzung, Fugen mit Tiefe, Rinde, Moos dort, wo Wasser steht. Quellen: freie Scans (ADR-0013), Sculpt
   und Bake in Blender, Masse aus `content/massstab.json`. Grösse und Tiefe sind nicht stilisiert.
2. **Darstellung gemalt.** Licht, Farbe und Luft werden gestaltet statt simuliert: warmes Führungslicht gegen
   kühle Schatten, Luftschichten nach hinten (Nebel als Werkzeug), Bloom an Lichtquellen, eine Signalfarbe für
   Befall. Im Grossen dürfen Flächen zu Pinselflächen zusammenlaufen (Ferne, Kronenmassen, Himmel); im Nahbereich
   bleibt das Detail der Substanz lesbar.
3. **Kein Mikrorauschen.** Was als Korn, Schachbrett oder Pixelflimmern erscheint, ist ein Fehler, kein Detail.
   Detail entsteht aus Form und Licht, nicht aus hochfrequenter Textur.
4. **Zielbild neu.** Ein in Blender gebauter A-Frame der Felsmulde (D370 ff.) löst das bisherige Zielbild ab. Die
   Engine folgt ihm (ADR-0006).
5. **Beurteilung nur mit GPU in Bewegung.** Look-Entscheidungen fallen am Zielgerät (CLAUDE.md, ADR-0005), nicht an
   SwiftShader-Standbildern; die bleiben Form- und Grössenvergleich.

## Konsequenzen

- Positiv: erreichbares, eigenständiges Ziel im Browser; Soulframe-Linie passt zur bestehenden Art Direction
  (Dämmerung, Nebel, Silhouetten, eine Signalfarbe). Fehler im Detail fallen weniger auf als im Fotorealismus.
- Positiv: Arbeit aus D353–D368 bleibt gültig, soweit sie Substanz betrifft (Massstab, Efeuwuchs, Rinde, Wurzeln,
  Streudecke, Parallax am Sockel).
- Negativ: Ein gestalteter Look braucht ein Bild, gegen das gemessen wird — ohne A-Frame keine Abnahme.
- Negativ: Der physikalische Himmel (D368) bleibt Werkzeug, nicht Ziel; Licht wird gestaltet.
- Pflicht: Postprocessing (Tonkurve, Luftschichten, Bloom, Kantenglättung) wird Teil des Looks und braucht
  WebGL- und WebGPU-Pfad.

## Grenze

- Regelt den Look der Welt. Charaktere und Kreaturen folgen der Stilreferenz (`design/BRACHLAND_Stilreferenz_v1.md`)
  und ziehen bei Bedarf nach.
- „Gemalt“ heisst nicht Toon-Shading und keine Konturlinien (Richtung B aus D369 verworfen), und nicht monochrom
  (Richtung C verworfen, bleibt als Stimmung für einzelne Orte möglich).
- Scope-Grenzen aus ADR-0004 (Online-Multiplayer, Party-Game) bleiben unberührt.
