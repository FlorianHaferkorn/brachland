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
npm run validate  Schema + Elementmatrix ausgewogen
npm run build     dist gebaut · Precache 4 Einträge · 1.096 KiB
npm run quality   3 Blocker (Asset-Budget, siehe unten)
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

## Versionskorrektur

Die `package.json` aus dem Chat kombinierte **React 18.3.1 mit `@types/react` 19.2.18** —
das ist in sich widersprüchlich. Mit React 18 + `@react-three/fiber` 8 erzeugt
`RegionsSzene.tsx` 20 Typfehler (`JSX.IntrinsicElements` kennt `mesh`, `group`,
`instancedMesh` nicht, weil fiber 8 den React-18-JSX-Namensraum erweitert, die Typen aber
aus React 19 stammen). Mit **React 19 + fiber 9 + drei 10** ist `tsc` sauber.

Das ist keine Geschmacksentscheidung: `RegionsSzeneProps.spielerRef` ist als
`React.RefObject<THREE.Object3D | null>` typisiert — React-19-Notation. Der Code war für
React 19 geschrieben, nur die Laufzeit-Abhängigkeit hinkte hinterher. Korrigiert.

## Was weiterhin fehlt

| Fehlend | Beleg | Wiederbeschaffung |
|---|---|---|
| `tools/lodcheck.ts`, `tools/masstab.ts`, `tools/scenecheck.ts` | Skripte `lod`, `masstab`, `szene` in `package.json` | neu bauen |
| Weltdaten-JSON unter public/world/ | `buildworld.ts` schreibt sie dorthin | **regenerierbar**: `npm run world oental 96` (~2 min, OSM + Höhen-API) |
| Prop-Modelle unter public/props/ (23 Stück, Kenney Nature Kit 2.1) | `propPfad()` in `src/world/props.ts` | **neu herunterladen** (CC0) |
| Move- und Regions-Inhalte | `content/moves/`, `content/regions/` leer, `quality.ts` liest sie | neu anlegen — Inhalte stehen in `design/BRACHLAND_Move-System_v1.md` |
| Kreaturen jenseits von Grathorn | `content/creatures/` enthält 1 von ~200 | schrittweise, siehe ADR-0002 |

## Offener Blocker aus dem Qualitätstor

Die drei Grathorn-Mutationsstufen liegen bei **163–164 KB gegen ein Budget von 120 KB**.
Das ist eine echte Feststellung des Original-Gates, kein Rekonstruktionsartefakt: Die
Modelle sind reduziert, aber nicht weit genug. Bei 200 Kreaturen × 3 Stufen entscheidet
diese Zahl über die Offline-Tauglichkeit. Ledger A-6.

## Lektion (bindend)

Arbeit an BRACHLAND läuft **in diesem Repo** — Claude Code im Ordner oder eine
Cowork-Aufgabe „auf deinem Computer", nie in einer Chat-Sandbox. Was nicht als Datei auf
der Platte liegt, existiert nicht. Diese Rekonstruktion hat einen vollen Arbeitstag
gekostet und wäre vermeidbar gewesen.
