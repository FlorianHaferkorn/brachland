---
last-reviewed: 2026-10-07
shelf-life-days: 90
owns: *.json
---
# content/waffen — Waffen des Echtzeitkampfs (_INDEX)

> Bis D190 standen diese Werte als `WAFFEN` in `src/kampf/echtzeit.ts` — gegen die Regel
> „Inhalte sind Daten, nie Code". Seit D191 liegen sie hier, werden beim Laden gegen
> `WaffenDaten` (`../../src/data/schema.ts`) geprüft und von `npm run validate` gegengeprüft.
> Die Umstellung war wertgleich: `WAFFEN` und `SPIELERIN` vorher/nachher tief gleich.

## „Lies-wenn"-Routing

| Deine Aufgabe ist … | Lies |
|---|---|
| Einen Schlag nachstellen (Fenster, Schaden, Kosten) | die Waffendatei hier → `../../tests/echtzeit.test.ts` (Waffen-Tor, ADR-0008 Abschnitt 12) |
| Eine dritte/vierte Klasse einführen | `../../docs/adr/0008-waffenwerk-zwei-klassen.md` — Clip **und** Zeile im Tor Pflicht |
| Verstehen, wie die Werte wirken | `../../src/kampf/echtzeit.ts` (`schlagAusDaten`, `WAFFEN`) |

## Format

- `halbwinkelGrad` in Grad (die Regeln rechnen in Radiant).
- `hieb.scheitel`/`hieb.durchzug` in **Clipbildern bei 24 fps** — Scheitel = Ende Vorlauf, Durchzug = Ende Aktiv.
- Der erste Eintrag in `leicht` ist der Grundschlag (`Waffe.schlag`); der Grundschlag der Klinge ist zugleich `SPIELERIN.schlag`.
- Schlagnamen sind über alle Waffen eindeutig — `istSchwer` erkennt den schweren Schlag am Namen (`npm run validate` prüft das).
- Dateiname = `id`.

## Register

| Datei | Inhalt |
|---|---|
| `klinge.json` | Klinge (leicht): Hieb, Rückhand, Stich · schwer Zweihandhieb · Laufstich |
| `axt.json` | Axt (schwer, standfest): Axthieb, Querhieb · schwer Spalthieb · Laufhieb |
| `speer.json` | Speer (Abstand): Stoss, Nachstoss · schwer Weitstoss · Anlauf |
