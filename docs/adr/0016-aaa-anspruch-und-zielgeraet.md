---
last-reviewed: 2026-11-14
shelf-life-days: 180
---
# ADR-0016 — AAA-naher Qualitätsanspruch, neues Zielgerät, Scan-Assets und Charakter-Pipeline

**Status:** Proposed · 2026-11-14 · löst ab: **ADR-0004** (nur den Park-Punkt „Spiel, das primär von
Grafik lebt (Photoreal)“), **ADR-0006** (nur das Zielgerät M1); erweitert ADR-0005 (Qualität), ADR-0012
(Messlatte Soulframe), ADR-0013 (Lizenzen), ADR-0015 (WebGPU) · Bestätigung durch Flo offen

## Kontext

Flo, 14.11.2026: „Die ganze Welt muss wie echt wirken und erlebbar sein … besser als Soulframe, Phantom
Blade Zero, Elden Ring … auch Charaktere und NPCs … mit dem geringsten Token-Verbrauch, aber der höchsten
Individualität … Sky is the limit … zeitnah umsetzen.“ Dazu: „Mac ist egal, ich hole mir einen neuen
besseren Laptop.“

Drei bestehende Festlegungen stehen dem entgegen und dürfen nicht still übergangen werden:

- **ADR-0004** parkt ein Spiel, das primär von Grafik lebt (Photoreal), als eigenes späteres Projekt.
- **ADR-0006** setzt den MacBook M1 als Referenzgerät; jede Entscheidung in D261–D279 wurde gegen dessen
  Kosten abgewogen (Karten-Limit 600.000, kein höheres Instanzbudget, Messung A-16 offen).
- Bisher entsteht Qualität aus Selbstbau (Shader, gezeichnete Karten). D272 hat gezeigt, dass fertige
  CC0-Scans (Poly Haven) in einem Schritt mehr bringen als viele Runden Abstimmung.

Ehrliche Einordnung: Ein Spiel mit einer Person plus KI wird Elden Ring oder Soulframe in **Breite,
Animation und Charakterqualität insgesamt** nicht überholen — dort arbeiten 100–300 Leute über Jahre mit
Motion Capture. Erreichbar ist: **in ausgewählten Orten AAA-nah aussehen** und **eigenständiger sein**
(echte Region Œntal nach DGM/OSM, eigene Kreaturen, eigene Stimmung). Dieses ADR richtet die Arbeit darauf.

## Optionen

| | A — three.js/Web bleibt, WebGPU + Scans + MetaHuman-Export | B — Wechsel auf Unreal Engine 5 | C — beides: Web-Spiel + UE-Schaufenster |
|---|---|---|---|
| Bild am schnellsten AAA-nah | mittel (Licht/GI selbst bauen) | **hoch** (Lumen, Nanite, Megascans, MetaHuman nativ) | hoch, aber doppelt |
| Bestehender Code (Kampf, Daten, Tests, Welt aus DGM/OSM) | **bleibt** | neu in C++/Blueprints | Web bleibt, UE-Teil neu |
| Prüfbarkeit durch Claude/Codex in der Cloud | **ja** (Headless-Browser, Bilder) | nein (UE braucht GPU/Editor, nur Flo sieht Bilder) | teilweise |
| Verteilung | Browser/PWA, kein Installieren | Installation, Windows/Konsole | beides |
| Risiko | Grenze bei GI, Haaren, Gesichtsanimation | Neuanfang, Monate ohne spielbaren Stand | Aufwand verdoppelt |

## Entscheidung (Vorschlag)

**Option A, konsequent auf Qualität gestellt** — mit B als bewusst offenem Ausweg, falls A am Bild scheitert:

1. **Zielgerät:** Flos neuer Laptop (Desktop-Klasse-GPU, WebGPU) statt M1. Das Instanz- und Texturbudget
   richtet sich danach; der Web-Build bekommt eine **Qualitätsstufe „Ultra“** (WebGPU, alles an), die
   bisherigen Stufen bleiben für schwächere Geräte. Messung am neuen Gerät ersetzt A-16/A-17.
2. **Assets statt Selbstbau:** Pflanzen, Bäume, Boden, Felsen, Totholz aus Scan-Bibliotheken —
   **Poly Haven / ambientCG (CC0)** sofort; **Fab/Megascans** nur nach Prüfung, ob die Fab-Lizenz eine
   Auslieferung als Web-Dateien erlaubt (Browser-Spiele liefern Modelle/Texturen abgreifbar aus) — **UNKLAR**,
   vor Nutzung klären (ADR-0013). Backen zu Karten/Atlanten wie D272 (`tools/grashorste/`).
3. **Charaktere/NPCs:** MetaHuman (laut Epic seit 2025 auch ausserhalb von Unreal nutzbar — vor Nutzung die
   aktuelle EULA prüfen, Quellen widersprechen sich für 2026) als **Basis**, Export über Unreal/Blender nach
   glTF, auf Web-Budget reduziert (LOD 2–3, 2K-Texturen, Gesicht mit Blendshapes), Retarget auf das
   bestehende Skelett. Eigenständigkeit entsteht durch Kleidung, Ausrüstung, Silhouette und Stimme, nicht
   durch das Gesicht allein. Kreaturen bleiben eigene Entwürfe (ADR-0002).
4. **Ein Ort nach dem anderen fertig:** Das **Stauwehr** wird als Vertikalschnitt komplett auf AAA-nahes
   Niveau gebracht (Gras ✔ D272, Wasser D280, Bäume, Boden, Licht/GI, ein NPC, Ton), bevor die Welt in der
   Breite folgt. Fertig heisst: Flo hält es am neuen Gerät neben Soulframe/PBZ-Material aus.
5. **Ausweg B:** Zeigt der Vertikalschnitt am neuen Gerät, dass Licht/GI oder Charaktere im Browser die
   Messlatte nicht erreichen, wird ein **UE5-Prototyp desselben Orts** gebaut (Stauwehr, gleiche
   DGM-Daten), und erst dann über einen Wechsel entschieden — per eigenem ADR.

## Umsetzung — zeitnah, mit wenig Tokens

| Schritt | Inhalt | Wer prüft |
|---|---|---|
| 1 (Tage) | Wasser D280 abschliessen; Bäume: Poly-Haven-Bäume (`tree_small_02`, `island_tree_*`, `fir_tree_01`, `pine_tree_01`) als Scan-Laubkarten wie D272 statt der hellen Kartenflecken; Boden: Poly-Haven-Streu/Moos/Steine als Atlas | Claude (Standbild) |
| 2 (Tage) | Qualitätsstufe „Ultra“: WebGPU-Pfad (ADR-0015) für Licht — SSGI/GTAO, Schatten-Kaskaden, volumetrischer Dunst; Ziel-Instanzbudget anheben | Flo am neuen Laptop |
| 3 (1–2 Wochen) | Charakter-Pipeline: ein MetaHuman-NPC am Stauwehr (Export, Reduktion, Retarget, Idle-/Sprech-Animation), Held danach | Flo (UE-Export), Claude (Web-Teil) |
| 4 | Leben: Wind in allem, Insekten, Vögel, Wasserlaufgeräusch, Schritte nach Boden | Claude + Flo |
| 5 | Breite: Biom-Kits aus Schritt 1 auf die Region (Felsmulde, Fahlmoos) | Claude |

Token-sparend: Claude rendert nur noch **ein** Prüfbild je Paket (SwiftShader-Standbilder kosten ~15 min
und viel Kontext); die Beurteilung in Bewegung macht Flo am neuen Gerät. Asset-Pipelines (Laden, Backen,
Packen, Lizenz) laufen als Werkzeuge im Repo, wiederholbar ohne Gespräch.

## Konsequenzen

- **+** Der Weg zu AAA-nahem Bild führt über fertige Scans und Export statt Handarbeit — schneller und
  messbar. Bestehender Code, Tests, Kampf und die echte Region bleiben.
- **+** Individualität bleibt Kern: echte Landschaft, eigene Kreaturen, eigene Stimmung.
- **−** Das Spiel wird schwerer (Paketgrösse, GPU-Last). Das 60-MB-Precache-Tor (`npm run quality`) und das
  12-MB-Materialbudget werden für „Ultra“ nicht halten — sie müssen per eigener Ledger-Entscheidung neu
  gesetzt werden (z. B. Ultra-Assets nachladen statt precachen).
- **−** Schwächere Geräte (Handy, M1) fallen auf niedrigere Stufen zurück; das Handy ist ohnehin nachrangig.
- **−** Lizenzen von Fab/Megascans und MetaHuman sind für Web-Auslieferung **nicht geklärt** — bis dahin nur CC0.

## Grenze

- Kein Versprechen, Elden Ring/Soulframe/PBZ als Ganzes zu übertreffen; Massstab ist der Vertikalschnitt
  am Stauwehr neben Vergleichsmaterial.
- Online-Multiplayer und Party-Game bleiben ausgeschlossen bzw. geparkt (ADR-0004 unverändert ausser dem
  Photoreal-Punkt). Echtzeitkampf bleibt ADR-0007.
- Gilt erst nach Flos Bestätigung; bis dahin bleiben alle neuen Teile hinter Schaltern, die Vorgabe
  unverändert.
