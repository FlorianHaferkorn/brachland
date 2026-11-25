---
last-reviewed: 2026-11-22
shelf-life-days: 365
---
# ADR-0020 — Zusammenhängende Welt mit Nachladen

**Status:** Accepted · 2026-11-22 (Flo, D418) · löst [ADR-0014](0014-regionen-als-eigene-karten.md) ab

## Kontext

ADR-0014 hat jede Region als eigene Karte gebaut: `?region=<id>`, eigene Weltdaten, Übergang an der Kante mit
Neuladen der Seite. Die Wahl zwischen (a) eigenen Karten und (b) einer zusammenhängenden Welt mit Streaming war
nie bestätigt (Ledger A-14); umgesetzt war die Empfehlung (a).

Seither hat sich der Anspruch verschoben: Story und Erlebnis sollen sich wie Elden Ring anfühlen (D374), die
Welt ist offen mit zwei Wegen zu jedem Ziel (D374, D391), und Sichtweite über Kilometer gehört zur Messlatte
(ADR-0012, A-12). Eine Karte mit Ladebildschirm an der Kante bricht genau dieses Erlebnis.

Flo, 22.11.2026, auf die Frage „eigene Karten mit Übergang oder zusammenhängende Welt mit Nachladen“:
**zusammenhängende Welt mit Nachladen.**

## Entscheidung

**Die Regionen bilden eine zusammenhängende Welt, die beim Gehen nachlädt.** Man sieht von einer Region in die
nächste und geht ohne Ladebildschirm hinüber.

1. **Daten bleiben je Region getrennt** (Weltdaten, Inhalte mit `region`, Bbox) — das war in ADR-0014 schon so
   angelegt und ist die Voraussetzung fürs Nachladen.
2. **Gemeinsamer Weltursprung mit verschiebbarem Bezugspunkt** (floating origin): Die Szene rechnet relativ zur
   Figur, nicht in absoluten Metern. D387 hat gezeigt, was 32-Bit-Weltlagen bei 1,4 km anrichten (Putzkorn);
   bei mehreren Regionen werden die Abstände grösser.
3. **Nachladen in Kacheln** für Terrain, Props, Grasteppich, Kollision, Bauwerke und Gegner-Vorkommen, mit
   Fernstufe (Impostoren, Fernland) für die Nachbarregion.
4. **Übergänge werden Gelände:** Pässe, Täler, Wege statt Kantenknopf. Die Lage der Regionen zueinander folgt
   dem echten Gelände (Fahlmoos nördlich des Œntals, ADR-0014 Kontext).

## Konsequenzen

- **Teuer:** Streaming ist im Browser ein grosses Technikthema (Speicherbudget, Ladeprioritäten,
  Shader-Vorwärmung, Kollision über Kachelgrenzen). Grobe Schätzung ohne Messung: mehrere Wochen.
- **Reihenfolge:** Umgesetzt wird nach dem Vertikalschnitt Œntal (Kapitel 1 fertig an einer Stelle, ADR-0018
  „eine Stelle fertig vor der Breite“). Bis dahin bleibt die Kartenmechanik aus ADR-0014 als Übergangslösung im
  Code. **Neue Arbeit darf nichts bauen, was das Nachladen verbaut** — keine absoluten Weltlagen in Shadern,
  keine Logik, die „eine Region = ganze Welt“ annimmt.
- **Leichter:** Sichtweite, Fernstaffelung und offene Wege über Regionsgrenzen; Reviere (D416) und Vorkommen
  können über Grenzen hinweg gelten.
- Der Spielstand merkt sich weiter die Region der Position (ADR-0014 Punkt 5), damit der Ursprung beim Laden
  stimmt.

## Grenze

Diese Entscheidung legt weder Kachelgrösse noch Speicherbudget noch Ladestrategie fest — das braucht einen
Messlauf am M1 (A-16) und einen eigenen Entwurf. Ob eine Region mit eigener Stimmung (Fahlmoos: Moor, Nebel)
einen weichen Stimmungsübergang braucht, ist offen.
