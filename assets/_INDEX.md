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
| `creatures/Grathorn_S1_Angepasst.glb` | Grathorn, Stufe 1 „Angepasst" — 163 KB |
| `creatures/Grathorn_S2_Durchdrungen.glb` | Grathorn, Stufe 2 „Durchdrungen" — 163 KB |
| `creatures/Grathorn_S3_Vollzogen.glb` | Grathorn, Stufe 3 „Vollzogen" — 164 KB |
| `rigs/` | **Leer.** Archetyp-Rigs mit Animationen fehlen; `autorig.py` braucht sie (Ledger B-10) |

## Offener Blocker: Budget gerissen

`npm run quality` meldet für alle drei Grathorn-Dateien **163–164 KB gegen 120 KB Budget**.
Das ist kein Rundungsproblem: Bei ~200 Kreaturen × 3 Stufen entscheidet dieser Faktor
darüber, ob die PWA offline installierbar bleibt. Die Modelle sind reduziert, aber nicht
weit genug — Ansatzpunkt ist `../tools/reduce.mjs`, nicht das Budget. Ledger A-6.

## Warum nicht unter public/

`public/` wird vom Service Worker precacht (`**/*.glb`). Hier liegen die Quellen der
Asset-Kette; was ins Spiel geht, wird bewusst dorthin kopiert. Diese Trennung verhindert,
dass ein Zwischenstand versehentlich im Offline-Cache landet.

## Definition of Done (neues Modell)

- **Input:** Roh-GLB aus der Generierung
- **Output:** `npm run assets` durchgelaufen, `npm run quality` ohne neuen Blocker
- **Fehlerfall:** über Budget → weiter reduzieren, Budget bleibt
- **Rollback:** Datei löschen; `content/` referenziert sie über die Kreatur-ID
