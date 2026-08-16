---
last-reviewed: 2026-08-16
shelf-life-days: 90
owns: *.glb
---
# assets — Spielfertige Modelle (_INDEX)

> Hier liegt **nur, was durch die Kette gelaufen ist**: reduziert und geriggt.
> Rohe KI-Exporte gehören nicht ins Repo — ein Tripo-Export hat 1,9 Mio Flächen.
> Die Kette steht in `../tools/README.md` und `../docs/WORKFLOW.md`.

## Register

| Pfad | Inhalt |
|---|---|
| `creatures/Grathorn_S1_Angepasst.glb` | Grathorn Stufe 1 „Angepasst" — 163 KB (v1) |
| `creatures/Grathorn_S2_Durchdrungen.glb` | Grathorn Stufe 2 „Durchdrungen" — 163 KB (v1) |
| `creatures/Grathorn_S3_Vollzogen.glb` | Grathorn Stufe 3 „Vollzogen" — 164 KB (v1) |
| `creatures/Grathorn_v2_S1.glb` | Grathorn v2, Stufe 1 — 163 KB |
| `creatures/Grathorn_v2_S2.glb` | Grathorn v2, Stufe 2 — 164 KB |
| `creatures/Grathorn_v2_S3.glb` | Grathorn v2, Stufe 3 — 167 KB |
| `rigs/` | **Leer.** Archetyp-Rigs mit Animationen fehlen; `autorig.py` braucht sie (Ledger B-10) |

> Welche Grathorn-Fassung gilt, ist **nicht entschieden** — v1 und v2 liegen beide vor,
> `content/creatures/grathorn.json` referenziert keine Datei direkt. Vor der nächsten
> Kreatur klären und die unterlegene löschen, sonst wächst die Doppelung mit. Ledger A-8.

## Offener Blocker: Budget gerissen

`npm run quality` meldet für **alle sechs** Dateien 163–167 KB gegen ein Budget von
120 KB. Das ist kein Rundungsproblem: Bei ~200 Kreaturen × 3 Stufen entscheidet dieser
Faktor darüber, ob die PWA offline installierbar bleibt. Bemerkenswert ist, dass v2
**nicht kleiner** ist als v1 — die zweite Runde hat das Budgetproblem nicht angefasst.
Ansatzpunkt ist `../tools/reduce.mjs`, nicht das Budget. Ledger A-6.

## Warum nicht unter public/

`public/` wird vom Service Worker precacht (`**/*.glb`) — dort liegen die 23
Prop-Modelle, die im Spiel gebraucht werden. Hier liegen die Quellen der Asset-Kette;
was ins Spiel geht, wird bewusst kopiert. Die Trennung verhindert, dass ein
Zwischenstand versehentlich im Offline-Cache landet und das 60-MB-Budget frisst.

## Definition of Done (neues Modell)

- **Input:** Roh-GLB aus der Generierung
- **Output:** `npm run assets` durchgelaufen, `npm run quality` ohne **neuen** Blocker
- **Fehlerfall:** über Budget → weiter reduzieren, Budget bleibt
- **Rollback:** Datei löschen; `content/` referenziert sie über die Kreatur-ID
