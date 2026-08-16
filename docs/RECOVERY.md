---
last-reviewed: 2026-08-16
shelf-life-days: 90
---
# Rekonstruktion — abgeschlossen

BRACHLAND entstand am 20.06.–16.08.2026 in einem claude.ai-Chat mit Code-Ausführung.
Diese Sandbox ist ephemer; der Arbeitsordner existiert nicht mehr. Am 16.08.2026 wurde
das Projekt aus dem Chat rekonstruiert. **Der Stand ist wiederhergestellt und lauffähig.**

Quelle: Chat „Neues Projekt außerhalb der Arbeit"
(`https://claude.ai/chat/ff16fcaf-0241-41f6-97fd-8e12c06a59fc`) — 172 Nachrichten,
19 `create_file`-Aufrufe, 187 `bash_tool`-Aufrufe.

## Verifiziert nach der Rekonstruktion

```
tsc --noEmit      sauber
npm run test      16 bestanden, 0 fehlgeschlagen   (Kampf-Engine)
npm run validate  2 Kreaturen gültig · Elementmatrix ausgewogen
npm run build     dist gebaut · Precache 29 Einträge · 2.256 KiB
npm run lod       LOD-Budget gemessen
npm run masstab   Größenverhältnisse gemessen
npm run quality   9 Blocker (Asset-Budget + Regionsbalance, siehe unten)
```

## Wie es zurückkam

Der Weg über die Oberfläche scheiterte mehrfach: Der Chat ist zu groß zum Scrollen,
`~/Downloads` hängt auf Syscall-Ebene, die Zwischenablage ist im Skriptkontext gesperrt,
und ein lokaler HTTP-Empfänger wird von der CSP der Seite blockiert. Was funktioniert
hat: die claude.ai-API im Browser gibt den Chat als Rohdaten aus — darüber ließ sich
belegen, **was** existiert. Heruntergeladen wurden die Dateien anschließend manuell.

## Eingriffe in den geretteten Code

Sechs Stellen, jede entfernt ausschließlich ein ungenutztes Symbol (`noUnusedLocals`):

| Datei | Änderung |
|---|---|
| `src/engine/battle.ts` | ungenutzter Import `ELEMENTE` |
| `src/scenes/RegionsSzene.tsx` | `Object.entries` → `Object.values` (Schlüssel ungenutzt) |
| `src/ui/BattleScreen.tsx` | ungenutzter Typ-Import `Ereignis` |
| `src/world/osm.ts` | ungenutzte Destrukturierung `[s, w, n, e]` |
| `src/world/terrain.ts` | ungenutztes `mittelLat` in `baueGewaesser` |
| `tools/quality.ts` | ungenutzter Import `Kreatur` |

Keine Logik berührt. Die 16 Tests waren vor und nach den Änderungen grün.

## Versionsentscheidung — mit Korrektur

Die `package.json` aus dem Chat kombinierte React 18.3.1 mit `@types/react` 19.2.18.
Ohne weiteres Zutun erzeugt das 20 Typfehler in `RegionsSzene.tsx`: `JSX.IntrinsicElements`
kennt `mesh`, `group` und `instancedMesh` nicht, weil fiber 8 den React-18-Namensraum
erweitert, die Typen aber aus React 19 stammen.

**Korrektur zur ersten Einschätzung:** Das Original war *nicht* widersprüchlich. Die
Nachlieferung enthielt `react-three.d.ts` — eine 12-zeilige Brücke, die `ThreeElements`
in `React.JSX` nachträgt und genau diesen Konflikt auflöst. Diese Datei fehlte mir beim
ersten Durchgang; die Diagnose „in sich widersprüchlich" war deshalb falsch.

Beibehalten wird trotzdem **React 19 + fiber 9 + drei 10**: fiber 9 deklariert seine
Elemente nativ für React 19, der Shim entfällt ersatzlos. Ein Rückbau auf 18/8 ist
möglich, kostet aber die Zusatzdatei. `react-three.d.ts` wurde daher nicht übernommen.

## Zweite Lieferung (`chat dateien.zip`, 100 Dateien, 14 MB)

Die Nachlieferung schloss die verbliebenen Lücken:

| Zurück | Wirkung |
|---|---|
| `public/world/oental.json` (1,05 MB) | **Die Szene startet.** Vorher der harte Blocker |
| 23 Prop-Modelle unter public/props/ | Precache wächst von 4 auf **29 Einträge / 2.256 KiB** |
| 6 Mess-Werkzeuge (`lodcheck`, `masstab`, `scenecheck`, `terraincheck`, `propcheck`, `lodpreview`) | `npm run lod`, `masstab` usw. laufen wieder |
| `content/regions/oental.json`, `content/regenten/flussvater.json`, `content/creatures/trafomarder.json` | Das Qualitätstor kann Regionsbalance prüfen — und meldet prompt 3 echte Blocker |
| Grathorn v2 (3 Stufen) | Zweite Modellfassung; welche gilt, ist offen (Ledger A-8) |

49 Dateien waren identisch zum Bestand, 12 wichen ab — und zwar **genau** um meine sechs
dokumentierten Symbol-Entfernungen plus die bewusst geänderten Konfigurationen. Kein
Inhaltsverlust.

Nachinstalliert für die neuen Werkzeuge: `@gltf-transform/core`, `-/extensions`,
`-/functions`, `meshoptimizer`, `sharp`. Drei weitere ungenutzte Symbole entfernt
(`tools/lodpreview.ts`, `tools/scenecheck.ts` ×2).

## Was weiterhin fehlt

| Fehlend | Beleg | Wiederbeschaffung |
|---|---|---|
| Move-Definitionen | `content/moves/` leer; `flussvater.json` verweist auf 4 Moves, die es nicht gibt | anlegen — Inhalte stehen in `design/BRACHLAND_Move-System_v1.md` |
| Kreaturen 3–35 aus Kapitel 1 | `content/creatures/` enthält 2 | schrittweise, siehe ADR-0002 |
| Archetyp-Rigs unter assets/rigs/ | `autorig.py` braucht sie | neu bauen |
| Spielerfigur, Bewegung, Anbindung der Kampf-UI | `GDD.md` | offen |

## Offene Blocker aus dem Qualitätstor

**Asset-Budget (A-6).** Alle sechs Grathorn-Dateien liegen bei 163–167 KB gegen 120 KB.
Auffällig: v2 ist **nicht kleiner** als v1 — die zweite Modellrunde hat das Budget nicht
angefasst. Bei ~200 Kreaturen × 3 Stufen entscheidet diese Zahl über die
Offline-Tauglichkeit. Ansatzpunkt ist `tools/reduce.mjs`.

**Regionsbalance (A-7).** Œntal hat 2 von 35 Kreaturen, deshalb nur 3 Elemente, und die
Regenten-Phasen 2 (`faeulnis`) und 3 (`alt-tech`/`stein`) haben **keinen Konter** in der
Region. Der Flussvater ist derzeit schlicht unfair. Kein Fehler im Tor — die ehrliche
Aussage über einen unfertigen Inhalt.

## Lektion (bindend)

Arbeit an BRACHLAND läuft **in diesem Repo** — Claude Code im Ordner oder eine
Cowork-Aufgabe „auf deinem Computer", nie in einer Chat-Sandbox. Was nicht als Datei auf
der Platte liegt, existiert nicht. Diese Rekonstruktion hat einen vollen Arbeitstag
gekostet und wäre vermeidbar gewesen.
