---
last-reviewed: 2026-08-16
shelf-life-days: 365
---
# ADR-0004 — Scope-Guardrails: welche 3D-Genres solo überhaupt fertig werden

**Status:** Accepted · 2026-08-16 · erweitert ADR-0001

## Kontext

Die häufigste Todesursache von Solo-3D-Projekten ist nicht fehlendes Können, sondern
ein Scope, dessen Content-Menge **linear mit der Spielzeit** wächst. Ein KI-Agent
multipliziert Code, Systeme und Werkzeugbau — er multipliziert **nicht** Level-Design,
Vertonung, Balancing und Playtesting. Genau diese Asymmetrie muss die Genrewahl abbilden,
sonst produziert die Beschleunigung im Code nur eine größere unfertige Baustelle.

Diese Entscheidung fällt **vor** dem Game Design Document, weil sie dessen Lösungsraum
begrenzt — nicht umgekehrt.

## Entscheidung

Das Konzept in `docs/GDD.md` muss aus dem machbaren Korridor stammen. Verbindlich:

**Zugelassen (realistisch 6–12 Monate solo):**

- **First-/Third-Person-Puzzle oder Walking-Sim** — wenig Content, Tiefe liegt in Systemen und Level-Geometrie.
- **Arena-/Wave-Shooter** — eine Kernmechanik, Assets werden wiederverwendet, Content-Kurve flach.
- **Physik-/Fahr-Sandbox** — Jolt ist seit Godot 4.6 Default; Systemtiefe statt Assetmasse.
- **Roguelite mit prozeduraler Levelgenerierung** — Content wird *generiert* statt handgebaut. Der stärkste Hebel für einen Code-Multiplikator.

**Ausgeschlossen (ohne neues ADR nicht zulässig):**

- **Open World / Survival-Crafting** — Content-Menge skaliert mit Spielzeit. Keine KI kompensiert das.
- **Story-RPG mit Dialogen, Quests, NPCs** — Schreiben, Vertonen und Balancing sind nicht codebar.
- **Online-Multiplayer** — Netcode, laufender Serverbetrieb (verletzt die Kostenfrei-Bedingung) und ein Playtesting-Bedarf, den eine Person nicht deckt.

**Zwei begleitende Regeln:**

1. **Vertical Slice zuerst.** Bevor Content in die Breite geht, muss *ein* Level in
   Zielqualität spielbar sein. Das ist die Abbruch-Entscheidungsgrundlage.
2. **Art-Direction vor Rendering.** Stilisiert/Low-Poly ist gesetzt, nicht Photoreal —
   der mit Abstand größte Qualitätshebel pro Stunde und die direkte Konsequenz aus ADR-0001.

## Konsequenzen

**Leichter:** Die Genrewahl ist keine offene Diskussion mehr, sondern eine Auswahl aus vier
Optionen. Scope Creep hat eine dokumentierte Hürde: er braucht ein ADR, das dieses ablöst.

**Schwerer:** Die Ausschlussliste enthält genau die Genres, die am meisten Spaß machen zu
*planen*. Das ist Absicht. Wer Open World will, muss begründen, warum diese Analyse hier
nicht gilt — nicht einfach anfangen.

## Grenze (bekannte Limitation)

Die Zeitschätzung „6–12 Monate" ist **Erfahrungsheuristik, keine Statistik**. Belastbare
Daten zu Fertigstellungsquoten KI-unterstützter Solo-3D-Projekte existieren nicht
(Recherchestand 16.08.2026). Die Genre-*Rangfolge* ist robuster als die absoluten Zahlen —
sie folgt aus der Content-Skalierung, nicht aus Benchmarks.
