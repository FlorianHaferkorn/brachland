---
last-reviewed: 2026-08-16
shelf-life-days: 365
---
# ADR-0001 — three.js/React als offline-PWA statt einer Game-Engine

**Status:** Accepted · 2026-08-16 · dokumentiert die im Chat vom 20.06.–16.08.2026 gewachsene Entscheidung

## Kontext

Zwei Anforderungen stehen über allem und sind im Verlauf mehrfach gegen Alternativen geprüft worden:

1. **Offline auf dem Handy spielbar** — konkret: im Flugzeug, ohne Netz, ohne App-Store.
2. **Claude als Mitbauer, nicht als Berater** — der gesamte Projektzustand muss text-
   basiert, diffbar und agentenschreibbar sein.

Geprüfte Alternativen und warum sie ausscheiden:

| Weg | Warum verworfen |
|---|---|
| **Unreal Engine 5** (zweimal geprüft) | Beste Grafik, aber: PWA wäre tot (native App, dreistellige MB, Sideload/Store statt „aufs Handy legen"). Binäre `.uasset`/`.umap` machen Git-Merges praktisch unmöglich und Claude zum Berater. Löst ein Problem, das ohne Engine-Wechsel lösbar war (siehe „LOD" unten). |
| **Godot 4** | Exportiert nativ auf Android, besseres App-Feel — aber editor-gebunden, damit weniger Agent-Hebel, und die Offline-PWA-Zustellung entfällt. |
| **Phaser 3 (2D)** | War die Empfehlung, solange das Ziel 2D war. Mit der 3D-Entscheidung obsolet. |

Der Auslöser der letzten Unreal-Prüfung war ein Terrain-Problem: Der Boden vor dem
Spieler war eine große Fläche, weil ein 96×96-Raster über 4 km lag. Das erwies sich
als **nicht implementierte Funktion, keine Grenze von three.js** — LOD-Kacheln plus
prozedurales Mikrorelief haben es gelöst (`src/world/lod.ts`).

## Entscheidung

**three.js + React (`@react-three/fiber`, `@react-three/drei`) + Vite 5 + TypeScript,
ausgeliefert als installierbare offline-PWA** (Service Worker via `vite-plugin-pwa`,
Speicherstände lokal). Deployment über Vercel, kein App-Store, kein Backend.

`--legacy-peer-deps` ist Pflicht bei `npm install`: `@vitejs/plugin-react` v6 verlangt
Vite 8, das Projekt bleibt bei Vite 5.

## Konsequenzen

**Leichter:** Jede Datei ist Text und diffbar. Der Test läuft auf dem echten Zielgerät
über `server.host` und eine WLAN-Adresse — kein Build-Zyklus zum Ausprobieren.
Auslieferung ist eine URL.

**Schwerer:** Kein Nanite, kein Lumen, keine fertigen Engine-Systeme. Alles, was eine
Engine mitbringt — Terrain-LOD, Instancing, Chunking, Speicherstände — ist Eigenbau.
Genau dieser Eigenbau ist aber der bereits geleistete Teil und der Grund, warum ein
Wechsel teuer wäre: Kampf-Engine mit 16 Tests, Inhalts-Schemas, Qualitätstor,
Reduktions- und Rigging-Pipeline, Kampf-UI, Prop- und Chunk-System wären verloren.

**Budget statt Bauchgefühl:** Der Build wird gemessen, nicht geschätzt —
968 kB JS (269 kB gzip), 2,18 MB Precache gegen ein 60-MB-Budget. Auch mit
200 Kreaturen (~16 MB) bleibt Luft.

## Grenze (bekannte Limitation)

Deckt **nicht** ab: Photoreal-Grafik und ein Spiel, das primär von Grafik lebt. Der
Chat hält dafür ausdrücklich fest: Wenn ein solches Spiel gewollt ist, wird es ein
**neues Projekt** mit Unreal — kein Umbau von BRACHLAND. Zelda-/Soulslike-Ambitionen
sind aus demselben Grund als separates späteres Projekt geparkt (ADR-0004).

iOS schränkt PWAs ein; für Single-Player mit lokalen Speicherständen ist das
unkritisch, auf Android läuft es voll. Nicht auf echter iOS-Hardware verifiziert.
