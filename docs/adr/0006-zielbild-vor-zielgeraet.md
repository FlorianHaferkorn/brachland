---
last-reviewed: 2026-09-15
shelf-life-days: 365
---
# ADR-0006 — Zielbild vor Zielgerät: der Look wird in Blender festgelegt, das Handy ist nachrangig

**Status:** Accepted · 2026-09-15 · ändert ADR-0001 (Zielplattform), löst D110/D111/D112 ab, erweitert ADR-0005

## Kontext

Flo am 15.09.2026: „Lass das Handybudget außen vor. Das ist mir nicht mehr wichtig. Ich will ein
geiles Spiel machen.“ Anlass war D152: Fünf Referenzbilder eines aktuellen Titels wurden gemessen,
und das Ergebnis der Lichtprobe `goldnebel` blieb — bewusst — an der D110-Grenze stehen, weil D110
für das Handy bei Tageslicht gesetzt war. Die Referenz liegt eine Blende dunkler, ist gesättigter
im Vordergrund und lebt von Dunst, warmem Schatten und Material (Stein, Moos, Rinde), das mit
`COLOR_0`-Vertexfarbe auf 500–3.000 Dreiecken nicht darstellbar ist.

Bisher galt (ADR-0001, D110–D112, `QUALITY.md`): offline-PWA fürs Handy, keine Texturen, Farbe
am Vertex, Dreieckskorridor je Objektklasse, Median ≥ 0,15 und dunkel ≤ 10 % an vier Bildtor-
Orten, Ladezeit < 5 s. Jede dieser Latten ist eine **Geräte**-Latte, keine Qualitätslatte. Sie
haben das Projekt messbar gemacht — und sie halten es jetzt unter dem Anspruch aus ADR-0005.

## Entscheidung

1. **Das Zielbild wird ausserhalb der Engine festgelegt.** `tools/szenenbau.py` baut einen
   realen Œntal-Ausschnitt (DGM1 + Biome aus `public/world/oental.json`) als Blender-Szene mit
   eigenen Motiven (Mauer mit Bogen, Hof mit Becken, Moosblöcke, Wurzeln, hohe Stämme, Dunst)
   und rendert ihn. Dieser Render ist die **Stilreferenz** — nicht ein fremdes Spiel und nicht
   die handgemalte Low-Poly-Referenz vom 02.09.2026. Gemessen wird er mit demselben Mass wie das
   Spiel (`.cache/mess/stil.mjs`), also Median, Drittel, Licht-/Schattenfarbe, Sättigung
   oben/unten, lokaler Kontrast.
2. **Die Engine folgt dem Render, nicht umgekehrt.** Stufe 2 bringt Texturen (gebackene
   prozedurale Materialien aus derselben Blender-Szene), Höhennebel, Nachbearbeitung und die
   Set-Pieces als GLB an dieselbe Stelle. Abnahme ist der Vergleich Spielbild gegen Render an
   derselben Kameraposition — Zahlen und Blick, ADR-0005 N3/N6.
3. **Das Handy ist nachrangig.** Zielgerät ist der Desktop-Browser (M1 als Referenzmaschine).
   Die PWA bleibt (ADR-0001, Engine three.js bleibt — ADR-0005 Abgrenzung), aber keine
   Entscheidung wird mehr mit „passt nicht ins Handybudget“ begründet. Wenn das Spiel später
   auf dem Handy laufen soll, ist das eine eigene Qualitätsstufe (LOD, Texturgrössen), kein
   Deckel auf dem Look.
4. **Abgelöst:** D110-Zielwerte (Median ≥ 0,15, dunkel ≤ 10 %), D111-Dreieckskorridor,
   D112 „keine Texturen“, die Latten in `QUALITY.md` (Texturen ≤ 1024 px, ≤ 8.000 Tris,
   Ladezeit < 5 s). Die Zahlen bleiben als Messwerte im Bildtor stehen — als Beobachtung,
   nicht als Tor. Neue Latten kommen aus dem Render (siehe Konsequenzen), nach `QUALITY.md` §6
   im eigenen Commit.
5. **Unverändert:** ADR-0002 (CC0), ADR-0004 (fremdes IP tabu — gebaut werden Gattungen,
   keine Designs), ADR-0005 (die Welt hält überall). Die D151-Befunde (681 Häuser mit Löchern,
   Wasser über dem Bett) werden mit besserem Licht sichtbarer und wandern in Stufe 3 mit.

## Konsequenzen

- **Stufe 1 (dieser Commit):** Terrainexport, `tools/szenenbau.py`, erster Render, `.blend`
  zum Öffnen. Zahlen im Ledger D153.
- **Stufe 2:** Materialpfad mit Texturen im Windmaterial oder daneben; Höhennebel als
  Shader-Term statt `THREE.Fog`; Set-Piece-Export (GLB mit gebackenen Texturen) aus derselben
  Szene; Kamera-Adresse im Spiel = Kamera der Blender-Szene; Vergleichslauf.
- **Stufe 3:** Set-Piece-Gattungen per Streuungsregel über Œntal (Hangfuss, Waldrand, Ufer,
  alte Wege), `goldnebel`-Licht in den Tageslauf, Bildtor mit Fernblick-Adressen neu gegrundet,
  Flussbett eingeschnitten, Hauslöcher geschlossen.
- **Was teurer wird:** Ladezeit, Speicher, Renderzeit auf schwachen Geräten. Das ist gewollt
  und wird gemessen, nicht gedeckelt.
- **Was nicht passiert:** Kein Engine-Wechsel, keine fremden Assets, keine Bilder fremder
  Spiele im Repo. Die Blender-Szene ist Quelle, nicht Ziel — das Spiel ist das Ziel.

## Grenze

Ein Render ist ein Standbild unter Cycles. Was er nicht beweisen kann: Bildrate, Bewegung,
Sicht aus jeder Richtung (N3). Der Render legt Licht, Palette, Werteaufbau und Motiv-Gattung
fest; ob die Engine es hält, entscheidet Stufe 2 am Spielbild.
