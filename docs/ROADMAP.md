# BRACHLAND — Entwicklungsplan

Ziel: ein offline spielbares 3D-Creature-Collector-RPG auf dem Handy, regionsweise
erweiterbar. Erste Region Œntal (Inntal-Süd), ~16 km².

**Grundprinzip: episodisch bauen.** Kein Meilenstein plant mehr als den nächsten.
Jeder liefert etwas Spielbares. Wer M1 abschließt, hat ein Spiel — nur ein kurzes.

---

## Tech-Entscheidungen (festgezurrt)

| Bereich | Wahl | Grund |
|---|---|---|
| Sprache | TypeScript | Schemas, Tooling, ein Stack für alles |
| 3D | three.js + React Three Fiber | Szenen als Code → Git-freundlich, Claude kann mitarbeiten |
| Build | Vite + vite-plugin-pwa | Service Worker out of the box |
| Speichern | IndexedDB (`idb`) | offline, kein Backend |
| Inhalte | JSON + Zod | Validierung als Drift-Schutz |
| Welt | OSM (Overpass) + EU-DEM | verifizierte Pipeline, siehe Spike |
| Assets | KI-Generierung → `reduce.mjs` → `autorig.py` | siehe brachland-pipeline |
| Hosting | Vercel | statisch, kostenlos |

Bewusst **nicht**: Backend, Multiplayer, App-Store, Unity/Unreal/Godot.

---

## Drift-Schutz

Das eigentliche Risiko ist nicht Technik, sondern schleichende Umgestaltung.
Vier Mechanismen:

1. **Schemas sind bindend.** Jeder Inhalt läuft durch `src/data/schema.ts`. Neue Inhalte
   passen ins Schema, oder das Schema wird *bewusst* geändert. Verifiziert: Eine absichtlich
   fehlerhafte Kreatur wird mit fünf konkreten Regelverstößen abgewiesen.
2. **Die Elementmatrix wird erzeugt, nicht gepflegt.** Als Zirkulant konstruiert, mit
   Selbsttest in der Validierung. Ein unausgewogener Zustand ist nicht erreichbar.
3. **Abnahmekriterien je Meilenstein.** Ein Meilenstein ist fertig, wenn seine Liste
   abgehakt ist — nicht, wenn er sich fertig anfühlt.
4. **Design-Dokumente sind die Quelle.** Kampfsystem v2.4, Move-System v1.1,
   Roster Kapitel 1, Story-Bibel. Was dort nicht steht, wird nicht gebaut, bevor es
   dort steht.

---

## M0 — Vertical Slice

**Ziel:** 20–30 Minuten spielbar, offline auf dem Handy. Beweis des Kernloops.
**Umfang:** ~2 km² Ausschnitt des Œntals, 3 Kreaturen, keine Story.

Abnahmekriterien:

- [ ] Terrain aus OSM + DEM generiert, begehbar, Third-Person-Kamera
- [ ] 3 Kreaturen aus der Pipeline: reduziert, geriggt, animiert, im Spiel sichtbar
- [ ] Spawn nach OSM-Tag (nicht hartkodiert)
- [ ] Rundenbasierter Kampf: 2 Elemente, 4 Move-Slots, Fokus-Ökonomie (1/2/3, Regen 2)
- [ ] Wechseln mit Schutzschild (50 %)
- [ ] Binden/Fangen, Team von 3
- [ ] Speichern in IndexedDB, überlebt Neustart
- [ ] Als PWA installierbar, **im Flugmodus spielbar**
- [ ] Alle Inhalte als validiertes JSON, keine Werte im Code

**Der eigentliche Test:** Macht der 30-Minuten-Loop Spaß? Wenn nein, wird es 40 Stunden
auch nicht. Hier wird ehrlich entschieden, ob es weitergeht.

## M1 — Kapitel 1 „Œntal"

**Ziel:** ein fertiges, abgeschlossenes Spiel von 5–8 Stunden.
Ab hier existiert etwas, das man spielen und weglegen kann.

Abnahmekriterien:

- [ ] Vollständige Region (~16 km²) mit Höhenrelief und Biomen
- [ ] Alle 16 Linien / 35 Kreaturen aus dem Roster
- [ ] Alle 8 Elemente implementiert (Brand ohne Kreaturen, aber vorhanden)
- [ ] Move-System vollständig: Grund-, Signatur-, Biom-Moves, Erbeuten
- [ ] Entwicklung: 3 Stufen, drei Auslöser je Ursprung
- [ ] Rückführung mit Reinkulturen
- [ ] Regent Flussvater mit 3 Phasen und Elementwechsel
- [ ] Heilungs-Loop: besiegen → Reinkulturen einsetzen → sichtbarer Regionswandel
- [ ] 2 Konzentrate (Kalkkern, Akkuherz) mit ihren Beschaffungswegen
- [ ] Story-Bogen mit NPCs, Fundstücken, 3 Fraktionen
- [ ] Weltkarte Bayern mit gesperrten Folgeregionen
- [ ] Zielspielzeit im Playtest bestätigt

## M2 — Erweiterbarkeit beweisen

**Ziel:** Eine zweite Region anhängen, ohne die erste anzufassen.
Der Beweis, dass das Modell trägt. Erst hier ist klar, ob 40–50 Stunden erreichbar sind.

Abnahmekriterien:

- [ ] Fahlmoos als reines Content-Paket (Daten + Assets, kein Engine-Umbau)
- [ ] Traversal-Freischaltung gated den Zugang
- [ ] Zweiter Regent mit eigenem Sanierungsverhalten
- [ ] Kreaturen wandern regionsübergreifend (Überschneidung im Roster)
- [ ] Aufwand dokumentiert: **wie lange hat Region 2 gedauert?** Das ist die Zahl,
      aus der sich die Gesamtdauer hochrechnen lässt.

## M3+ — Kapitel anhängen

Spiegelland, Hochstand, Aschefeld. Je Region nach dem Kapitel-Template.
Kein fester Plan — es geht weiter, solange es Spaß macht.

---

## Reihenfolge innerhalb von M0

1. Repo, Vite, PWA-Grundgerüst, „läuft offline auf dem Handy"
2. Schemas + Validierung in CI
3. OSM/DEM-Pipeline → Terrain-Mesh
4. Bewegung + Kamera
5. Kampf-Engine (rein logisch, ohne 3D, gegen die Simulationen testbar)
6. Kreatur-Assets durch die Pipeline
7. Kampf-UI und Anbindung
8. Speichern
9. Playtest

Schritt 5 vor Schritt 7: Die Kampflogik ist ohne Grafik testbar, und die Simulationen
aus dem Designprozess sind bereits die Testfälle.

---

## Realistische Einschätzung

- M0: Wochen, nicht Monate — wenn die Asset-Kette einmal läuft.
- M1: der große Brocken. Nicht der Code, sondern **Content-Authoring**: Maps, NPCs,
  Fundstücke, Balancing. Das ist die Arbeit, die 70 % ausmacht.
- M2 entscheidet über alles Weitere. Wenn Region 2 halb so lange dauert wie Region 1,
  sind 40–50 Stunden über ein bis zwei Jahre erreichbar. Wenn sie genauso lange dauert,
  stimmt am Kapitel-Template etwas nicht.

Größtes Restrisiko bleibt die **Ausdauer**, nicht die Machbarkeit.
