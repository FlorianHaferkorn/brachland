---
last-reviewed: 2026-08-16
shelf-life-days: 365
---
# ADR-0001 — Godot 4.7 als Engine

**Status:** Accepted · 2026-08-16 · —

## Kontext

Ein 3D-Spiel, gebaut von **einer** Person ohne Game-Dev-Vorerfahrung, mit einem
LLM-Coding-Agenten als Hauptmultiplikator. Zwei harte Randbedingungen:

1. **Kostenfrei oder Open Source** — keine Lizenzgebühren, keine Royalties, keine Subscription.
2. **Agentensteuerbar** — der Agent muss Szenen, Ressourcen und Buildlogik lesen,
   diffen und schreiben können. Eine Engine, deren Projektzustand in Binärdateien liegt,
   entwertet genau den Multiplikator, auf dem dieses Projekt beruht.

Kandidaten geprüft am 16.08.2026: Godot 4.7, Unreal Engine 5.x, Unity 6, O3DE, Bevy 0.19, Stride.

## Entscheidung

**Godot 4.7** (stabil seit 18.06.2026, Patch 4.7.1 vom 14.07.2026), Renderer **Forward+**,
Physik **Jolt**, Sprache **GDScript**.

Begründung in einem Satz: Godot ist die einzige Kandidatin, die *gleichzeitig* echte
Open Source (MIT, keine Umsatzgrenze, keine Royalty) und vollständig textbasiert
(`.tscn`/`.tres`/`.gd`/`project.godot`) ist — bei einem kompletten Headless-CLI-Zyklus
für Import, Test und Export.

Warum nicht die Alternativen:

| Engine | Lizenz frei? | 3D-Obergrenze solo | Agent-Tauglichkeit | Ausschlussgrund |
|---|---|---|---|---|
| Unreal 5.x | Faktisch ja (frei bis 1 Mio USD Lifetime-Gross, danach 5 %), aber **source-available, nicht OSS** | Höchste (Nanite/Lumen) | Niedrig — `.uasset`/`.umap` binär | Agent kann den Projektzustand nicht lesen; lange C++-Builds |
| Unity 6 | Personal frei bis **200k USD** Umsatz *und* Funding; proprietär | Hoch (HDRP) | Mittel — YAML, aber GUID-lastig und merge-feindlich | Umsatz-Cap + Vendor-Risiko nach der Runtime-Fee-Episode |
| O3DE | Ja (Apache 2.0) | Hoch auf dem Papier | Niedrig — dünne Doku, kleine Community | Wartungs- und Supportrisiko für einen Solo-Dev |
| Bevy 0.19 | Ja (MIT/Apache-2.0) | Mittel, **kein Editor** | Hoch (alles Code) | Rust-Lernkurve + laufende API-Brüche im Erstprojekt |
| Stride | Ja (MIT) | Mittel | Mittel (C#) | Zu kleine Community für Solo-Betrieb |

## Konsequenzen

**Leichter:**

- Jede Änderung ist ein lesbarer Git-Diff — Code-Review und Agent-Edits funktionieren auf
  Szenen genauso wie auf Skripten.
- `godot --headless` deckt Import, Skriptausführung und Export ab → CI ohne GUI, Gate lokal
  identisch zu CI (siehe `Makefile`, `.github/workflows/ci.yml`).
- Keine Lizenz-Buchführung, kein Umsatz-Schwellenwert, keine Vendor-Abhängigkeit.

**Schwerer:**

- **Photoreal ist realistisch nicht erreichbar.** Godots 3D-Renderer liegt hinter Unreal;
  hochskalierte Open Worlds und Film-Look sind out of scope. Die Gegenmaßnahme ist
  Art-Direction, nicht Rendering-Leistung — siehe ADR-0004.
- Kleinerer Asset-Store und weniger fertige Middleware als Unity/Unreal → mehr Eigenbau,
  was mit Agent-Unterstützung aber der günstigere Tausch ist.
- GDScript ist keine Hochleistungssprache. Für heiße Pfade bleibt GDExtension (C++) offen,
  wird aber erst bei gemessenem Bedarf gezogen — nicht vorab.

## Grenze (bekannte Limitation)

Diese Entscheidung deckt **nicht** ab: Konsolen-Portierung (Godot-Konsolen-Exports laufen
über kostenpflichtige Drittanbieter und würden die Kostenfrei-Bedingung brechen) und
Online-Multiplayer (Serverbetrieb kostet Geld — siehe ADR-0004).

**Sollbruchstelle:** Wenn sich im Prototyp zeigt, dass die Zielästhetik ohne Nanite/Lumen
nicht erreichbar ist, ist die Entscheidung teuer umkehrbar — dann steht Photoreal gegen
Agent-Tauglichkeit, und diese Abwägung gehört in ein neues ADR, nicht in einen stillen Wechsel.

## Quellen

- [Godot License (MIT)](https://godotengine.org/license/) · [Godot 4.7 Release](https://godotengine.org/releases/4.7/)
- [Unreal Engine License](https://www.unrealengine.com/en-US/license) · [Unity Pricing](https://unity.com/pricing)
- [Bevy 0.19](https://bevy.org/news/bevy-0-19/)
