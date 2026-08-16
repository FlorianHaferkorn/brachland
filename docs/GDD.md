---
last-reviewed: 2026-08-16
shelf-life-days: 30
---
# Game Design Document — game-dev

> **Status: Konzept offen.** Dieses Dokument ist absichtlich unvollständig. Die
> Engine-, Pipeline- und Scope-Entscheidungen stehen (ADR-0001 bis ADR-0004), das
> Spiel selbst nicht. Offene Punkte werden **im Ledger** (`docs/_INDEX.md`, Tabelle A)
> abgehakt, nicht hier im Fließtext.

## 1. Feststehender Rahmen

Kein Diskussionsgegenstand mehr — hier nur zur Orientierung, Begründung in den ADRs:

| Rahmen | Festlegung | Quelle |
|---|---|---|
| Engine | Godot 4.7, Forward+, Jolt, GDScript | ADR-0001 |
| Perspektive | 3D | Vorgabe |
| Kosten | ausschließlich frei/OSS, Assets nur CC0 | ADR-0002 |
| Ästhetik | stilisiert / Low-Poly — **nicht** photoreal | ADR-0004 |
| Genre-Korridor | Puzzle/Walking-Sim · Arena-Shooter · Physik-Sandbox · Roguelite | ADR-0004 |
| Team | eine Person + Claude als Code-Multiplikator | Vorgabe |

## 2. Was noch fehlt (Reihenfolge ist bewusst)

Die folgenden Punkte bauen aufeinander auf. Sie von unten nach oben zu beantworten
erzeugt Arbeit, die später weggeworfen wird.

1. **Genre-Wahl** aus dem Korridor in ADR-0004 → danach ist der Rest ableitbar.
2. **Core Loop in einem Satz.** Was tut die Spielerin in 30 Sekunden, und warum
   wiederholt sie es? Wenn das keinen Satz füllt, existiert das Spiel noch nicht.
3. **Vertical-Slice-Definition.** Welches *eine* Level in Zielqualität beweist, dass es trägt?
4. **Kernmechanik-Prototyp.** Graue Boxen, keine Assets — funktioniert die Mechanik ohne Politur?
5. **Art-Direction-Referenz.** 5–10 Referenzbilder + eine Farbpalette, bevor das erste
   Modell entsteht.
6. **Fertig-Kriterium.** Woran ist das Spiel fertig — und was ist explizit *nicht* drin?

## 3. Core Loop

*Noch nicht definiert — siehe Ledger-Punkt G-2.*

## 4. Vertical Slice

*Noch nicht definiert — siehe Ledger-Punkt G-3.*

## 5. Nicht-Ziele

Vorab gesetzt, damit sie nicht später „aus Versehen" hineinwachsen:

- Kein Online-Multiplayer (ADR-0004)
- Kein Konsolen-Port (ADR-0001, Grenze)
- Keine Sprachvertonung
- Keine Ingame-Käufe / kein Live-Service

## 6. Definition of Done (Vertical Slice)

- **Input:** entschiedenes Genre, Core Loop in einem Satz, Art-Direction-Referenz
- **Output:** ein spielbares Level, aus dem Editor **und** als exportierter Build startbar,
  in Zielästhetik, mit funktionierender Kernmechanik
- **Fehlerfall:** die Mechanik trägt keine 10 Minuten Spielzeit → Genre neu wählen,
  nicht Politur nachlegen
- **Rollback:** der Slice lebt in einem eigenen Branch, bis er trägt; `main` bleibt lauffähig
