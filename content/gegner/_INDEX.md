---
last-reviewed: 2026-10-07
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
| Einen neuen Gegner anlegen | eine Datei als Muster → Konstante + Doc-Kommentar in `../../src/kampf/echtzeit.ts` → Test |
| Verstehen, wie die Werte wirken | `../../src/kampf/echtzeit.ts` (`gegnerAusDaten`, `naechtlich`) |

## Format

- `halbwinkelGrad` in Grad; Gegner haben keine `rolle` (der Lader setzt eine leere).
- `linien` nur bei Tieren (aus dem Körperbau), `mensch.linienFolge` nur bei Menschen — beides zugleich lehnt das Schema ab.
- `elemente` nur bei Tieren; der Test prüft sie gegen `../creatures/` (D189).
- Dateiname = `id`.

## Register

| Datei | Inhalt |
|---|---|
| `uebungsgegner.json` | Platzhalter ohne Asset (ADR-0007 Stufe 1), Vorlauf 0,75 s als Telegraf |
| `keiler.json` | Wurzelkeiler, Holz: Rammstoss geht durch jeden Block, Linie unten |
| `grathorn.json` | Grathorn, Stein: Gehörnstoss von oben, schneller als der Keiler |
| `wolf.json` | K7-Wolf, Alt-Tech/Frost: Doppelbiss (Kette), Linien links/rechts |
| `fuchs.json` | Spürfuchs, Alt-Tech: schnell und schwach, Linie unten |
| `gams.json` | Nebelgams, Stein: kurzer Kopfstoss mit weitem Rückstoss |
| `wegelagerer.json` | Mensch mit Klinge: Linienfolge, Deckung, liest die Spielerin |
| `speermann.json` | Mensch mit Speer: sticht aus 3 m, deckt unten |
| `axtmann.json` | Mensch mit Axt: langsam, ein Treffer kostet ein Drittel des Lebens |
