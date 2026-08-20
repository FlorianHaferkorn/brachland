---
last-reviewed: 2026-08-20
shelf-life-days: 180
owns: *.md
---
# docs/design — Verbindliche Design-Dokumente (_INDEX)

> Diese Dateien sind die **Quelle für alles, was gebaut wird**. Sie sind
> simulationsgeprüft (1.200–4.000 Kämpfe je Zeile im Kampfsystem), nicht ausgedacht.
> Bei Widerspruch zwischen Code und Design-Dokument gewinnt das Dokument — oder das
> Dokument wird geändert. Stillschweigend auseinanderlaufen darf beides nicht.
>
> Versionsregel: Eine höhere Versionsnummer **ersetzt** die niedrigere. `Kampfsystem_v2`
> ersetzt `Kampfsystem_und_Roster_v1`; letzteres bleibt nur wegen des Rosterteils.

## „Lies-wenn"-Routing

| Deine Aufgabe ist … | Lies |
|---|---|
| Welt, Ton, Fraktionen, Erzählung verstehen | `BRACHLAND_Story-Bibel_v1.md` |
| Kampflogik ändern oder Werte balancieren | `BRACHLAND_Kampfsystem_v2.md` |
| Einen Move anlegen oder ändern | `BRACHLAND_Move-System_v1.md` |
| Eine Kreatur anlegen | `BRACHLAND_Roster-Struktur_v1.md` → `BRACHLAND_Roster_Kapitel1.md` |
| Wissen, was in Kapitel 1 vorkommt | `BRACHLAND_Roster_Kapitel1.md` |
| Modelle beschaffen und aufbereiten | `BRACHLAND_Asset-Workflow_v1.md` → `../WORKFLOW.md` |
| Ein Kreaturenmodell bauen oder beurteilen | `BRACHLAND_Creature-Bible_v1.1.md` → für Wildlinge zusätzlich `BRACHLAND_Stilreferenz_v1.md` |
| Wissen, was Zustände, Narben oder Herkünfte mechanisch tun | `BRACHLAND_Creature-Bible_v1.1.md` → `../../src/engine/battle.ts` |
| Bewegung, Klettern, Reiten, Gleiten planen | `BRACHLAND_Traversal_v1.md` |
| Aufträge, Fragmente oder Story-Aufbau planen | `BRACHLAND_Story-Struktur_v1.md` |

## Dokument-Register

| Doc | Inhalt |
|---|---|
| `BRACHLAND_Story-Bibel_v1.md` | Arbeitstitel, Genre, Ton (dunkel, wortkarg — Fragmente statt Cutscenes), Welt, Fraktionen |
| `BRACHLAND_Kampfsystem_v2.md` | **Gültige Fassung (v2.4).** 1v1 nach Pokémon-Schema, Team von 6, Wechsel kostet den Zug; Doppel-Elemente, Fundstücke, Konzentrate — alles simulationsgeprüft |
| `BRACHLAND_Kampfsystem_und_Roster_v1.md` | Vorgänger. Kampfteil **überholt** durch v2; Rosterteil weiter gültig |
| `BRACHLAND_Move-System_v1.md` | Move-System v1.1: planbarer Kern, dynamischer Rand |
| `BRACHLAND_Roster-Struktur_v1.md` | ~200 Kreaturen über 5 Regionen, Entwicklungssystem, Art-Budget |
| `BRACHLAND_Roster_Kapitel1.md` | Œntal: 16 Linien, 35 Kreaturen, 7 der 8 Elemente (Brand erst im Aschefeld) |
| `BRACHLAND_Asset-Workflow_v1.md` | Ergebnis des Kreatur-Spikes: Kette und Kostenmessung |
| `BRACHLAND_Creature-Bible_v1.1.md` | **Oberste Kreatur-Referenz seit 17.08.2026.** Textfassung des Blattes: drei Herkünfte, drei Stufen, vier Zustände, drei Narben — mit den Stellen, an denen Blatt und Code auseinanderlagen, und wer jeweils gewonnen hat |
| `BRACHLAND_Stilreferenz_v1.md` | **Verbindlich für Wildlinge seit 16.08.2026.** Ein erkennbares Alpentier, auf dem etwas wächst — Pilzfächer als Leitmerkmal, Signalfarbe nur als Punkt. Schließt ADR-0002. Der Bible untergeordnet |
| `BRACHLAND_Traversal_v1.md` | Ausdauer, Springen, Klettern, Schwimmen, Reiten, Gleiten — Auswahl gegen Enshrouded, Reihenfolge, Freischaltung |
| `BRACHLAND_Story-Struktur_v1.md` | Vier übliche Bauweisen, Auswahl für BRACHLAND (kritischer Pfad + Fragmente + Weltzustand, keine Nabe), Auftrags- und Fragmentschema |

## Umsetzungsstand

Von 35 Kreaturen aus Kapitel 1 ist **eine** als Inhalt angelegt (`content/creatures/grathorn.json`,
3 Mutationsstufen als GLB). Das Move-System ist im Schema abgebildet, aber
`content/moves/` ist leer. Ledger B-9.
