---
last-reviewed: 2026-08-17
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
| Kampfregeln, Elemente, Fokus oder Phasen ändern | `battle.test.ts` → `../src/engine/battle.ts` |
| Die Witterungsanzeige oder eine Richtung anfassen | `peilung.test.ts` → `../src/spieler/peilung.ts` |
| An Erfahrungskurve, Stufen oder Mutation drehen | `fortschritt.test.ts` → `../src/spiel/fortschritt.ts` |
| Klettern, Springen oder Zehrraten ändern | `ausdauer.test.ts` → `../src/spieler/ausdauer.ts` |
| Auftragsziele oder Vorbedingungen ändern | `auftraege.test.ts` → `../src/spiel/auftraege.ts` |
| Reiten oder Waten ändern | `reiten.test.ts` → `../src/spiel/reiten.ts`, `../src/world/wasserfeld.ts` |
| Zustände, Narben, Volltreffer, Genauigkeit oder Move-Wirkungen ändern | `zustaende.test.ts` → `../docs/design/BRACHLAND_Creature-Bible_v1.1.md` |
| Am Gleitverhältnis, an Tempo oder Schwerkraft drehen | `gleiten.test.ts` → `../src/spieler/gleiten.ts`, `../src/spieler/tempo.ts`, `npm run gleit` |
| Am Biomraster, an der Siedlungsregel oder der Prop-Verteilung drehen | `siedlung.test.ts` → `../src/world/osm.ts`, `../src/world/props.ts` |

## Register

| Datei | Was festgehalten wird |
|---|---|
| `battle.test.ts` | 16 Tests: Elementmatrix ausgewogen, Fokus-Ökonomie, Elementvorteil entscheidet, Phasen erzwingen Wechseln, Zehrung, Determinismus, Kampfdauer im Korridor |
| `peilung.test.ts` | 11 Tests. Anlass war ein **Vorzeichenfehler**, der nur bei Blickrichtung 0 unauffällig war — der Pfeil zeigte beim Drehen in die falsche Richtung |
| `fortschritt.test.ts` | 20 Tests. Anlass: Die erste Kurve machte Kreaturen bei der Mutation **schwächer** (L13 = 184 KP, L14 = 162 KP). Hält jetzt Monotonie und die Zahl der Kämpfe je Mutation fest |
| `ausdauer.test.ts` | 20 Tests. Hält die Kletterhöhe als **Rechnung** fest (16/s × 2,2 m/s = 13,8 m gegen 14 m Klippe) und die Hysterese am Nullpunkt |
| `auftraege.test.ts` | 25 Tests. Der Fortschritt wird abgeleitet, nicht gezählt — geprüft wird unter anderem, dass `schneehuhn` nicht `schneehuhn-alt` mitzählt |
| `zustaende.test.ts` | 38 Tests zur Creature Design Bible v1.1. Hält drei Befunde fest, die beim Zusammenführen von Blatt und Code herauskamen: **Resistenz und Verteidigung wären derselbe Effekt gewesen**, **Krit gab es nicht**, und **Move-Effekte wurden nie angewendet** — `moveDef()` warf sie weg |
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
