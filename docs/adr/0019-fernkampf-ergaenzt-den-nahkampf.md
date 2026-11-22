---
last-reviewed: 2026-11-22
shelf-life-days: 365
---
# ADR-0019 — Fernkampf ergänzt den Echtzeit-Nahkampf

**Status:** Proposed · 2026-11-22 (Entwurf zu D405; Flo hat Bogen und Armbrust als Familie gewollt, D404, das
Regelwerk dazu aber nicht bestätigt) · erweitert ADR-0007 (Echtzeit-Nahkampf: Ausdauer, Rolle, Parade, Lock-On,
Haltung) um Geschosse · ADR-0004 (keine fremden Motive, kein Online-Multiplayer) und die Regel „Kampf-Engine bleibt
renderfrei“ gelten unverändert

## Kontext

ADR-0007 legt den Kampf als Nahkampf fest: Treffer sind ein Bogen gegen eine Kapsel, alles geschieht in
Schlagreichweite. Flo am 22.11.2026 (D404): „wie brauchen auch eine höhere Waffenvielfalt so wie bei Soulslikes
üblich“ und, zum Fernkampf, „mit Bogen und Armbrust…gibt es sowas wie Magie?“. Bogen und Armbrust passen zur Welt
(Jagd, Forst, Werk). Sie berühren aber den Kern des Spiels: Die Marke **heilt statt zu töten** und greift nur in
1,8 m (D374, D379). Eine Waffe, die aus sicherer Entfernung tötet, macht genau das bequem, was Folgen haben soll.

## Entscheidung

Fernkampf wird eine **Waffenfamilie neben** dem Nahkampf, kein zweites Kampfsystem:

1. **Geschosse sind Daten** und fliegen in denselben Teilschritten wie der Kampf, gegen dieselben Kapseln; Sicht
   über das vorhandene Kollisionsfeld (`src/kampf/sichtlinie.ts`). Kein Raycast am Modell, kein three.js in der Regel.
2. **Spannen und Laden nur im Stand.** Gespannt halten kostet Ausdauer (Bogen); die Armbrust lädt lange und schiesst einmal.
3. **Ein Schuss ist höchstens ein Hieb:** Pfeil wie ein leichter, Bolzen wie ein schwerer Schlag der Klinge. Kein
   Bonus für Distanz, keine Kopftreffer.
4. **Fernkampf reinigt nie.** Er kann ein Tier wund machen; die Marke braucht weiter Nähe. Aus der Ferne getötet
   zählt beim Zähler der Mönche voll.
5. **Munition ist Material** und knapp; ein stumpfes Geschoss (Kolbenpfeil) nimmt Haltung statt Leben.
6. **Tiere antworten:** Befallene gehen an, scheue fliehen; was ausser Sicht flieht, ist fort.

Entwurf und Zahlen: `docs/design/BRACHLAND_Waffen-Baukasten_v1.md` §12, `content/waffenfamilien.json` `fernkampf`.

## Konsequenzen

- **Leichter:** eine sechste Familie, die sich wirklich anders spielt; ein Werkzeug gegen Gegner, die man nicht
  erreicht; der Kolbenpfeil gibt dem Heiler einen eigenen Auftakt.
- **Schwerer:** `echtzeit.ts` bekommt Geschosse, einen Zustand „gespannt“ und eine KI-Reaktion auf Beschuss; der
  Kampfbot braucht ein Fernprofil; sechs neue Clips und eine Zielkamera. Jede geprüfte Messreihe (Kampfsystem,
  Reinigen v1) gilt weiter nur für den Nahkampf und muss um den Fall „mit Eröffnungsschuss“ ergänzt werden.
- **Risiko:** Töten wird bequemer. Dagegen stehen nur Regeln 2–6; ob sie reichen, zeigt erst die Messung.

## Grenze (bekannte Limitation)

Nicht entschieden und nicht entworfen: Gegner, die schiessen; Wurfwaffen; Fernkampf vom Reittier oder im Gleiten;
Geschosse mit Element (Kernfunke). „Magie“ ist kein Teil dieses ADR — der Vorschlag dazu (Wirken der Marke) steht
im Design-Dokument §13 und braucht kein neues Kampfsystem. Wird der Entwurf verworfen, bleibt ADR-0007 unverändert
und die Familie „Bogen und Armbrust“ entfällt aus `content/waffenfamilien.json`.
