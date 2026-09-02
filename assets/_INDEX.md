---
last-reviewed: 2026-09-02
shelf-life-days: 90
owns: *.glb, *.md
---
# assets — Quellen der Asset-Kette (_INDEX)

> Hier liegt **nur, was durch die Kette gelaufen ist**: reduziert, geriggt,
> nachbereitet. Rohe KI-Exporte gehören nicht ins Repo — ein Tripo-Export hat
> 1,9 Mio Flächen. Die Kette steht in `../tools/README.md` und `../docs/WORKFLOW.md`.

## Register

| Pfad | Inhalt |
|---|---|
| `rigs/quadruped.glb` | **Archetyp-Rig Vierbeiner** — 100 KB, ein Mesh, 24 Knochen, Animationen `Survey`/`Walk`/`Run`. Die Vorlage, von der `../tools/autorig.py` Skelett und Bewegung erbt |
| `rigs/serpent.glb` | **Archetyp-Rig Schlange** — 23 KB, 10 Knochen in einer Kette, Animationen `Ruhe`/`Gehen`/`Rennen`. **Gerechnet, nicht geliehen** (`../tools/rigbau.mjs`): Schlangenbewegung ist eine Sinuswelle durch den Körper, und die schreibt man besser hin, als sie zu suchen |
| `rigs/biped_bird.glb` | **Archetyp-Rig Vogel** — 26 KB, 15 Knochen, zwei Beine, zwei Flügel. Ebenfalls gerechnet. Beine im Gegentakt (31° Ausschlag beim Gehen, 54° beim Rennen), im Leerlauf atmen nur die Flügel (2,9°) |
| `creatures/` | **Leer, und das ist kein Versehen.** Die Kette aus D105 (`../tools/kreaturbau.py`) schreibt direkt nach `../public/creatures` — ein CC0-Handmodell braucht keine Zwischenstufe, weil es weder Reduktion noch Rigging durchlaeuft. Der Ordner bleibt fuer den Weg ueber `npm run assets` stehen. **Das Budget wird an `public/creatures` gemessen**, nicht hier (D107); die Schleife zeigte zwoelf Tage lang auf diesen leeren Ordner und hat deshalb nie etwas gefunden |
| `HERKUNFT.md` | **Autor und Lizenz je Modelldatei** in `../public/creatures`. Pflichtlektuere vor jedem neuen Modell: `wurzelkeiler.glb` steht unter **CC BY 3.0** und muss genannt werden, die vier anderen sind CC0. Das Qualitaetstor blockiert jede `.glb` in `public/creatures` ohne Zeile hier — eine Namensnennung, die man vergessen kann, ist keine |

## Was hier gestanden hat — und was es wirklich war

Bis 17.08.2026 lagen hier **sechs Dateien als „Grathorn"**, in zwei Fassungen. Welche
gilt, war als Ledger A-8 offen; A-6 stritt darüber, dass sie mit 163–167 KB über dem
120-KB-Budget lagen. Beim Rendern für diese Entscheidung kam heraus, dass beide
Fassungen **einen Fuchs** zeigen. Der Grathorn ist ein Steinbock mit
Chitinplatten-Gehörn (`../content/creatures/grathorn.json`).

Nachgesehen, was in den Dateien steht:

```
Meshes      : fox1, chitinhorn_b_Head_05, plattenkamm_b_Spine02_03, …
Materialien : fox_material
Animationen : Survey, Walk, Run
Knochen     : _rootJoint, b_Root_00, b_Hip_01, b_Spine01_02, …
```

Das ist Zeile für Zeile das **three.js-Beispielmodell `Fox.glb`**. BRACHLAND-eigen
waren nur die aufgesetzten Auswüchse, die über die drei Stufen wuchsen.

Damit erklären sich zwei Zahlen, die vorher nicht zusammenpassten:

- **582–672 Dreiecke gegen `zielTris: 3000`** — kein Überschuss der Reduktion,
  sondern ein Beispielmodell, das von Haus aus so klein ist.
- **„v2 ist nicht kleiner als v1"** (so stand es hier als Rätsel) — natürlich nicht,
  es ist derselbe Fuchs mit einem anderen Aufsatz.

Der Fuchs ist als Grathorn wertlos, als **Archetyp-Rig** aber genau das, was fehlte:
`rigs/` war leer, und `autorig.py` braucht dort einen geriggten Vierbeiner mit
Lauf-Animationen (Ledger B-10). `../tools/rigausbau.mjs` schneidet die Auswüchse ab
und behält Skelett, Haut und Bewegung. Die sechs Kreaturdateien sind gelöscht;
rückholbar über `git revert`. Ledger G-65.

## Herkunft und Lizenz — wandert mit

Modell **„Fox" von PixelMannen, CC0.** Animationen **von @tomkranis, CC-BY 4.0.**

Die CC-BY-Pflicht wandert weiter: Jede Kreatur, die über `autorig.py` dieses Skelett
und diese Bewegungen erbt, trägt sie mit. Wer `rigs/quadruped.glb` durch ein eigenes
Rig ersetzt, wird diesen Absatz los — vorher nicht.

Für die **ausgelieferten** Kreaturmodelle steht dasselbe in `HERKUNFT.md`, Datei für
Datei. Der Unterschied zu diesem Absatz: Dort prüft es das Qualitätstor.

## Warum nicht unter public/

`public/` wird vom Service Worker precacht (`**/*.glb`) — dort liegen die 23
Prop-Modelle und seit D105 die fünf Kreaturmodelle, die im Spiel gebraucht werden.
Hier liegen die **Quellen** der Asset-Kette; was ins Spiel geht, wird bewusst kopiert.
Die Trennung verhindert, dass ein Zwischenstand versehentlich im Offline-Cache landet
und das 60-MB-Budget frisst.

**Die Kreaturmodelle sind die Ausnahme, die die Regel bestätigt.** Sie haben hier
keine Quelle, weil ihre Quelle ein fremdes CC0-Paket ist, das nicht ins Repo gehört
(`.cache/cc0`, 5 MB Rohdateien für 540 KB Ergebnis). Was das Repo davon braucht,
ist die Namensnennung — die steht in `HERKUNFT.md`, und `kreaturbau.py` lässt sich
mit einem dritten Argument auf ein anderes Ziel umbiegen, damit ein Kandidat mit
unklarer Lizenz sich ansehen lässt, **ohne** dabei in `public/` zu landen.

## Definition of Done (neues Modell)

- **Input:** Roh-GLB aus der Generierung, benannt `<linie>__<archetyp>.glb`
- **Output:** `npm run assets` durchgelaufen (Reduktion → Rigging → **Nachbereitung**),
  `npm run quality` ohne neuen Blocker
- **Fehlerfall:** über Budget → **erst prüfen, ob die Nachbereitung gelaufen ist**
  (Ledger G-63), dann weiter reduzieren. Das Budget bleibt
- **Rollback:** Datei löschen; `content/` referenziert sie über die Kreatur-ID
