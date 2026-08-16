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

- Terrain aus OSM + EU-DEM mit LOD-Kacheln (4 Stufen, 72–76k Dreiecke je Standort) und hangabhängigem Mikrorelief
- Wege, Gewässer, Gebäude mit Dächern
- ~30.000 Props als Instanzen mit Entfernungs-Culling, 23 echte CC0-Modelle
- Drei Stimmungen umschaltbar, Third-Person-Kamera
- Kampf-Engine mit 16 grünen Tests · Kampf-UI · Inhalts-Schemas · Qualitätstor

**Nicht gebaut:**

- **Keine Spielerfigur, keine Bewegung** — die Kamera steht am Ursprung
- **Keine Kreaturen in der Welt** — Kampf-Engine und -UI sind nicht mit der Szene verbunden
- Keine Texturen, keine Animation über Auto-Rigging hinaus, kein Audio

**Nicht im Repo:** Ein Großteil des oben Gebauten existiert nur als Beschreibung —
die Sandbox ist weg. Was wirklich vorliegt: `docs/RECOVERY.md`.

## Nächste Schritte (Reihenfolge ist begründet)

1. **Szene einmal live auf dem Handy sehen.** Alle bisherigen Bewertungen beruhten auf
   Standbildern aus einem selbstgebauten Software-Renderer — kein tauglicher
   Stellvertreter für three.js auf echter Hardware. Blockiert durch die fehlenden Module.
2. **Stil-Referenz für die Kreaturen festzurren** (ADR-0002). Ein Bild definiert den
   Look für alle 200. Erst danach Generierung.
3. **Eine Kreatur komplett durch die Kette** inkl. Rigging — die letzte ungetestete Stelle.
4. Dann erst Stapelproduktion.

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
