---
last-reviewed: 2026-08-16
shelf-life-days: 60
---
# BRACHLAND — Game Design Document

> Rekonstruiert am 16.08.2026 aus dem Entstehungs-Chat (20.06.–16.08.2026).
> Was hier steht, ist belegt; was fehlt, steht als offener Punkt im Ledger
> (`_INDEX.md`, Tabelle A) — nicht als Vermutung im Fließtext.

## Was es ist

Ein **3D-Creature-Collector mit Story**, eigenes IP, als installierbare
**offline-PWA** — spielbar auf dem Handy im Flugmodus. Rundenbasierte Kämpfe,
Third-Person, 1:1-Maßstab.

| Feld | Wert | Quelle |
|---|---|---|
| Welt | reale Alpenregion **Œntal**, aus OSM + EU-DEM erzeugt | `START.md` |
| Maßstab | 1:1 — eine Fichte ist 22 m | `props.ts` (`ZIELHOEHE`) |
| Kreaturen | Alpen-Fauna mit **Biotech-Anbauten**, ~200 geplant, davon **5 Regenten** + 5–8 Startkreaturen | Chat 16.08.2026 |
| Zielspielzeit | 40–50 Std, episodisch gewachsen | ADR-0004 |
| Plattform | PWA, primär Android-Handy; Test über WLAN-Adresse auf dem echten Gerät | ADR-0001 |

## Art Direction (gebaut, nicht geplant)

Die Werte stehen in `src/scenes/RegionsSzene.tsx` und sind erarbeitet, nicht geraten:

**Dämmerung, Nebel als Werkzeug, Silhouetten, eine Signalfarbe für Befall.**
Keine Texturen — alles Vertex-Farben und Geometrie. Mittagssonne verzeiht nichts,
deshalb gibt es sie nicht.

Drei umschaltbare Stimmungen: `daemmerung` (Nebel 60–420 m), `nebelmorgen`
(30–240 m), `nacht` (25–260 m). Jede mit eigener Sonnen-, Umgebungs- und Nebelfarbe.

## Stand — was läuft und was nicht

**Gebaut** (laut `START.md`, gemessen am 16.08.2026):

- Terrain aus OSM + EU-DEM: 4 km × 4 km, 18.050 Dreiecke, Vertex-Farben je Biom
- LOD-Kacheln und Mikrorelief sind **gebaut, aber nicht in der Szene verdrahtet** (Ledger G-6)
- Wege, Gewässer, Gebäude mit Dächern
- ~30.000 Props als Instanzen mit Entfernungs-Culling, 23 echte CC0-Modelle
- Drei Stimmungen umschaltbar, Third-Person-Kamera
- Kampf-Engine mit 16 grünen Tests · Kampf-UI · Inhalts-Schemas · Qualitätstor

**Nicht gebaut:**

- **Keine Spielerfigur, keine Bewegung** — die Kamera steht am Ursprung
- **Keine Kreaturen in der Welt** — Kampf-Engine und -UI sind nicht mit der Szene verbunden
- Keine Texturen, keine Animation über Auto-Rigging hinaus, kein Audio

**Im Repo:** Alles oben Gebaute ist am 16.08.2026 rekonstruiert und verifiziert —
`tsc` sauber, 16 Engine-Tests grün, Schema-Validierung bestanden, Build läuft.
Was noch fehlt (Weltdaten, Prop-Modelle, Inhalte jenseits von Grathorn): `RECOVERY.md`.

**Verbindliches Spieldesign:** `design/` — Story-Bibel, Kampfsystem v2.4, Roster
Kapitel 1 (16 Linien, 35 Kreaturen), Move-System. Simulationsgeprüft, nicht ausgedacht.

## Nächste Schritte (Reihenfolge ist begründet)

1. **Weltdaten erzeugen** (`npm run world oental 96`) und die 23 CC0-Prop-Modelle holen —
   danach startet die Szene.
2. **Szene einmal live auf dem Handy sehen.** Alle bisherigen Bewertungen beruhten auf
   Standbildern aus einem selbstgebauten Software-Renderer — kein tauglicher
   Stellvertreter für three.js auf echter Hardware.
3. **Grathorn-Modelle unter das 120-KB-Budget bringen** (Ledger A-6) — sonst skaliert die
   Offline-Auslieferung nicht.
4. **Stil-Referenz für die Kreaturen festzurren** (ADR-0002). Ein Bild definiert den
   Look für alle 200. Erst danach Stapelproduktion.

## Nicht-Ziele

- Online-Multiplayer · App-Store-Release · fremdes IP (keine Nintendo-Assets)
- Photoreal — dafür gäbe es ein eigenes Projekt mit Unreal (ADR-0001, Grenze)
- Zelda-/Soulslike-Combat und ein Party-Game — geparkt (ADR-0004)

## Definition of Done (Vertical Slice)

- **Input:** lauffähiges Repo, Stil-Referenz, eine geriggte Kreatur
- **Output:** 30–60 Min spielbar auf dem Handy im Flugmodus — Bewegung, ein Gebiet,
  Begegnung, Kampf, Fangen, Speichern
- **Fehlerfall:** trägt der Loop keine 30 Minuten, wird nicht poliert, sondern der Loop geändert
- **Rollback:** `main` bleibt baubar; der Slice lebt im Branch, bis er trägt
