---
last-reviewed: 2026-10-07
shelf-life-days: 365
---
# ADR-0004 — Scope: episodisch bauen, nicht 40–50 Stunden planen

**Status:** Accepted · 2026-08-16 · erweitert ADR-0001 · Park-Punkt „Soulslike-Combat“ teilweise abgelöst durch ADR-0007 (Nachtrag D196)

## Kontext

Die Zielspielzeit wanderte im Verlauf von 100 über ~12 auf **40–50 Stunden,
erweiterbar**. Die entscheidende Einsicht steckt nicht in der Zahl, sondern im Wort
„erweiterbar": Kein Indie-RPG dieser Länge entsteht als Block.

Die harte Asymmetrie, die den Scope bestimmt: Ein KI-Agent multipliziert Code, Systeme
und **Content-Werkzeuge** (Editoren, datengetriebene Formate, Generatoren,
Balancing-Skripte). Er multipliziert **nicht** Playtesting, Balancing-Gefühl, Polish
und die Entscheidung, was gut ist. Bei Pokémon-Maßstab sind Design, Content-Authoring
und Balancing 70–80 % des Aufwands, Art nur 20–30 % — CC0-Assets lösen also den
kleineren Teil.

## Entscheidung

**Zielspielzeit 40–50 Stunden über 1–2 Jahre, episodisch gebaut.** Verbindliche
Meilenstein-Reihenfolge:

1. **Vertical Slice** — 30–60 Minuten spielbar, in Zielqualität. Der ehrliche Test,
   ob der Authoring-Grind überhaupt liegt.
2. **Content-Pipeline** — Kreaturen, Moves, Typen-Matrix, Dialoge, Encounter-Tabellen
   als **Daten mit Schema-Validierung**, nie hartkodiert. Der Schritt, der jede weitere
   Spielstunde billiger macht. Teilweise gebaut (`npm run validate`).
3. **Kapitel 1** — ~5–8 Stunden Spielzeit, fertig und spielbar.
4. **Kapitel anhängen**, solange es Spaß macht.

**Nicht planen, was nicht gebaut wird:** 40–50 Stunden als *Umfang, den wir jetzt
planen* ist der Weg, auf dem das Projekt stirbt. Als *Decke, die offen bleibt*, ist es
realistisch. Der Unterschied ist nicht Semantik, sondern was in den nächsten vier Wochen
passiert.

**Geparkt (jeweils ein eigenes späteres Projekt, kein Umbau von BRACHLAND):**

- ~~Zelda-/Soulslike-Combat~~ — *Nachtrag D196 (07.10.2026):* Das **Regelwerk** (Echtzeit-Nahkampf,
  Ausdauer, Rolle, Parade, Lock-On, Haltung) ist durch ADR-0007 in BRACHLAND geholt und damit hier
  abgelöst. Weiter geparkt bleibt, was der Punkt ausserdem meinte: kein Umbau zu einem Spiel, das
  primär aus Kampf besteht, und keine Gestalt fremder Vorbilder (ADR-0007 §1).
- Ein Spiel, das primär von Grafik lebt (dann Unreal — ADR-0001, Grenze)
- Party-Game im Schlag-den-Star-Format (anderer Anlass: Gemeinschaftsabend statt
  Reise-Downtime; ein Artefakt kann nicht beides)

**Ausgeschlossen:** Online-Multiplayer (widerspricht offline-first und kostet
Serverbetrieb) · fremdes IP — eigene Kreaturen, Namen, Welt (Nintendo-Assets sind
tabu, die Mechanik rundenbasierten Typen-Battlings ist es nicht).

## Konsequenzen

**Leichter:** Es gibt jederzeit einen nächsten Meilenstein, der in Wochen erreichbar
ist. Scope Creep hat eine dokumentierte Hürde.

**Schwerer:** Die Decke bleibt offen, also gibt es kein „fertig". Das verlangt
Ausdauer statt eines Endspurts — und genau daran, nicht an der Machbarkeit, scheitert
diese Art Projekt üblicherweise.

## Grenze (bekannte Limitation)

„40–50 Stunden über 1–2 Jahre" ist eine **Ausdauer-Annahme, keine Schätzung**.
Belastbare Daten zu Fertigstellungsquoten KI-unterstützter Solo-3D-Projekte gibt es
nicht. Die Meilenstein-*Reihenfolge* ist robuster als jede Zeitangabe darin.
