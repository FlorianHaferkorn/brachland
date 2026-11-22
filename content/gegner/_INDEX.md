---
last-reviewed: 2026-11-22
shelf-life-days: 90
owns: *.json
---
# content/gegner — Gegner des Echtzeitkampfs (_INDEX)

> Bis D193 standen diese Werte als Konstanten (`KEILER` … `AXTMANN`) in `src/kampf/echtzeit.ts`.
> Seit D194 liegen sie hier, geprüft gegen `GegnerDaten` (`../../src/data/schema.ts`) beim Laden
> und in `npm run validate`. Die Umstellung war wertgleich: alle neun vorher/nachher tief gleich.
> Das **Warum** jedes Werts (Telegraf, Körperbau, Balancing-Läufe) steht weiter als Kommentar an
> der Konstante in `echtzeit.ts` — die Zahlen stehen nur hier.

## „Lies-wenn"-Routing

| Deine Aufgabe ist … | Lies |
|---|---|
| Einen Gegner nachstellen (Fenster, Leben, Haltung) | die Datei hier → `../../tests/echtzeit.test.ts` (Kampftor) → `../../tools/durchlauf.ts` (Siegquoten) |
| Einen neuen Gegner anlegen | eine Datei als Muster → Konstante + Doc-Kommentar in `../../src/kampf/echtzeit.ts` → Test; ein Tier zusätzlich in `TIERE` (`../../tools/reinigensim.ts`) und mit `npx tsx tools/reinigensim.ts 1000 gegner` messen |
| Die Reinigungsdauer eines Tiers ändern | `reinigen` in der Datei hier → `npx tsx tools/reinigensim.ts 1000 gegner` → Tabelle in `../../docs/design/BRACHLAND_Reinigen_v1.md` §6 nachziehen |
| Verstehen, wie die Werte wirken | `../../src/kampf/echtzeit.ts` (`gegnerAusDaten`, `naechtlich`) |

## Format

- `halbwinkelGrad` in Grad; Gegner haben keine `rolle` (der Lader setzt eine leere).
- `linien` nur bei Tieren (aus dem Körperbau), `mensch.linienFolge` nur bei Menschen — beides zugleich lehnt das Schema ab.
- `elemente` nur bei Tieren; der Test prüft sie gegen `../creatures/` (D189).
- `reinigen` (D389) nur bei Tieren: `dauer` = Kanal in Sekunden über alle Griffe, `halten` = Griffdauer (ohne Angabe `halten` aus `../reinigen.json`). Griffzahl = `ceil(dauer / halten)`, `npm run validate` hält sie im Band `griffe` aus `../reinigen.json` und verlangt den Block bei jedem Tier. Menschen tragen ihn nicht (D385) — ausser mit `freiwillig: true` (wer den Befall gewählt hat; noch kein solcher Gegner angelegt). Herleitung und Messung: `../../docs/design/BRACHLAND_Reinigen_v1.md` §6.
- Dateiname = `id`.

## Register

| Datei | Inhalt |
|---|---|
| `uebungsgegner.json` | Platzhalter ohne Asset (ADR-0007 Stufe 1), Vorlauf 0,75 s als Telegraf |
| `keiler.json` | Wurzelkeiler, Holz: Rammstoss geht durch jeden Block, Linie unten. Reinigen 5,4 s / 5 Griffe |
| `grathorn.json` | Grathorn, Stein: Gehörnstoss von oben, schneller als der Keiler. Reinigen 5,5 s / 5 Griffe |
| `wolf.json` | K7-Wolf, Alt-Tech/Frost: Doppelbiss (Kette), Linien links/rechts. Reinigen 4,25 s / 4 Griffe |
| `fuchs.json` | Spürfuchs, Alt-Tech: schnell und schwach, Linie unten. Reinigen 2,5 s / 3 Griffe |
| `gams.json` | Nebelgams, Stein: kurzer Kopfstoss mit weitem Rückstoss. Reinigen 4,0 s / 3 Griffe von 1,6 s |
| `wegelagerer.json` | Mensch mit Klinge: Linienfolge, Deckung, liest die Spielerin |
| `speermann.json` | Mensch mit Speer: sticht aus 3 m, deckt unten |
| `axtmann.json` | Mensch mit Axt: langsam, ein Treffer kostet ein Drittel des Lebens |
