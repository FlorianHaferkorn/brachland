---
last-reviewed: 2026-09-26
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
| Geometriekompression oder Bauwerk-Export ändern | `bautenpack.test.ts` → `../tools/bautenpack.ts` |
| Kampfregeln, Elemente, Fokus oder Phasen ändern | `battle.test.ts` → `../src/engine/battle.ts` |
| Echtzeitkampf: Fenster, Reichweiten, Kosten, KI ändern | `echtzeit.test.ts` → `../src/kampf/echtzeit.ts` |
| Waffenclips oder ihre Regelzeiten ändern | `waffenclips.test.ts` → `../tools/waffenclips.py`, `../src/kampf/echtzeit.ts` |
| Schwierigkeit prüfen (ganze Kämpfe mit Reaktionszeit) | `kampfbot.test.ts` → `../tools/kampfbot.ts` |
| Die Witterungsanzeige oder eine Richtung anfassen | `peilung.test.ts` → `../src/spieler/peilung.ts` |
| An Erfahrungskurve, Stufen oder Mutation drehen | `fortschritt.test.ts` → `../src/spiel/fortschritt.ts` |
| Klettern, Springen oder Zehrraten ändern | `ausdauer.test.ts` → `../src/spieler/ausdauer.ts` |
| Auftragsziele oder Vorbedingungen ändern | `auftraege.test.ts` → `../src/spiel/auftraege.ts` |
| Reiten oder Waten ändern | `reiten.test.ts` → `../src/spiel/reiten.ts`, `../src/world/wasserfeld.ts` |
| Zustände, Narben, Volltreffer, Genauigkeit oder Move-Wirkungen ändern | `zustaende.test.ts` → `../docs/design/BRACHLAND_Creature-Bible_v1.1.md` |
| Am Gleitverhältnis, an Tempo oder Schwerkraft drehen | `gleiten.test.ts` → `../src/spieler/gleiten.ts`, `../src/spieler/tempo.ts`, `npm run gleit` |
| Am Biomraster, an der Siedlungsregel oder der Prop-Verteilung drehen | `siedlung.test.ts` → `../src/world/osm.ts`, `../src/world/props.ts` |
| An der Teamreihenfolge oder am Beutel ausserhalb des Kampfes drehen | `menue.test.ts` → `../src/spiel/team.ts`, `../src/spiel/gegenstaende.ts` |
| `propauswahl.test.ts` | Die zwei Prop-Listen dürfen keinen Chunk verlieren. Seit die Attrappen gebündelt werden (G-111), wird die Nahliste alle 8 m neu bestimmt und das Bündel alle 60 m. D157 prüft Baumvarianten über alle Stufen; D158 den Randfall, dass ein neuer Fernanker trotz gerade erfolgter Nahbewertung beide Listen erneuert. Geprüft wird zusätzlich ein **Lauf** über 76 Schritte: jeder Chunk in Reichweite steht genau einmal |

## Register

| Datei | Was festgehalten wird |
|---|---|
| `bautenpack.test.ts` | Tatsächlicher Runtime-Decoder: Attribute, Weltmatrizen, Materialwerte/-gruppen, Namen und orientierte Dreiecke bleiben beim verlustfreien Meshopt-Roundtrip erhalten; Quellschutz und Größenstabilität bei Wiederkompression. |
| `echtzeit.test.ts` | 79 Prüfungen, das Kampftor (D166–D170): Reichweite ±5 cm, Winkel, ein Treffer je Schwung, Rollenfenster in 5-ms-Schritten (≥ 200 ms, nach Reaktionszeit erreichbar), Ausdauer 5 Schläge/4 Rollen, Haltung bricht beim 2. Treffer, Zielwahl, KI aus 12 Anlaufrichtungen, Angriffsrecht: zwei Gegner nie zugleich im Schlag, im Wechsel, der Wartende ausser Reichweite (D167), Waffenklassen als Werkzeuge statt Stufen und Zielwahl/Zielwechsel (D168), der Keiler als erster echter Gegner (D169), Zucken, Pille statt Kreis und der Grathorn (D170), Moveset/Puffer/Kette/Vorschritt/Rückstoss/Trefferstopp und der Wolf mit Doppelbiss (D171, 127 Prüfungen), gleiches Ergebnis bei 10/30/144 B/s. Druckt die Messtabelle |
| `waffenclips.test.ts` | D171: Scheitel und Durchzug jedes Schlags (`hieb`, Clipsekunden) liegen auf Schlüsselbildern von `tools/waffenclips.py`, Haltungen sind Schleifen, `menschbau.ANIM_WAFFEN` = `waffenclips.CLIPS`, die Waffendatei trägt jeden gebrauchten Clip, die Wanderin keinen |
| `kampfbot.test.ts` | D171: Band statt Punkt — einzeln gewinnt ein aufmerksamer Bot ≥ 90 %, zu zweit ≥ 60 %, ein müder verliert zu zweit manchmal, kein Kampf läuft in die Zeitgrenze (24 Zeilen à 60 Kämpfe, ~3 s) |
| `battle.test.ts` | 16 Tests: Elementmatrix ausgewogen, Fokus-Ökonomie, Elementvorteil entscheidet, Phasen erzwingen Wechseln, Zehrung, Determinismus, Kampfdauer im Korridor |
| `peilung.test.ts` | 11 Tests. Anlass war ein **Vorzeichenfehler**, der nur bei Blickrichtung 0 unauffällig war — der Pfeil zeigte beim Drehen in die falsche Richtung |
| `fortschritt.test.ts` | 20 Tests. Anlass: Die erste Kurve machte Kreaturen bei der Mutation **schwächer** (L13 = 184 KP, L14 = 162 KP). Hält jetzt Monotonie und die Zahl der Kämpfe je Mutation fest |
| `ausdauer.test.ts` | 20 Tests. Hält die Kletterhöhe als **Rechnung** fest (16/s × 2,2 m/s = 13,8 m gegen 14 m Klippe) und die Hysterese am Nullpunkt |
| `auftraege.test.ts` | 25 Tests. Der Fortschritt wird abgeleitet, nicht gezählt — geprüft wird unter anderem, dass `schneehuhn` nicht `schneehuhn-alt` mitzählt |
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
