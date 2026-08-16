---
last-reviewed: 2026-08-16
shelf-life-days: 365
---
# ADR-0002 — Asset-Pipeline: Blender → glTF 2.0, Fremdassets nur CC0

**Status:** Accepted · 2026-08-16 · erweitert ADR-0001

## Kontext

Assets sind bei einem Solo-3D-Projekt der Flaschenhals — nicht der Code. Zwei Fragen
mussten vor dem ersten Modell entschieden werden, weil beide teuer nachträglich zu drehen sind:
welches Austauschformat, und unter welcher Lizenz Fremdassets ins Repo dürfen.

Die Lizenzfrage ist der kritischere Teil: ein CC-BY-NC-Sample, das sich in `assets/audio/`
einschleicht, macht eine spätere kommerzielle Verwertung unmöglich und ist nach Monaten
kaum noch zurückverfolgbar.

## Entscheidung

**Format:** Eigene Assets werden in Blender gebaut und als **glTF 2.0 (`.glb`)** exportiert —
das von der Godot-Doku explizit empfohlene Format. FBX (nur via ufbx), Collada und OBJ
werden nicht verwendet.

**Quellen:** `.blend`-Quelldateien liegen unter `src-assets/` (nicht im Godot-Projekt,
damit der Import-Scan sie nicht anfasst); die exportierten `.glb` unter `game/assets/models/`.

**Lizenz-Regel (hart):** Fremdassets nur unter **CC0** oder einer anderen Lizenz ohne
Attributions- und ohne NC-Klausel. Zugelassene Quellen:

| Quelle | Zweck | Lizenz |
|---|---|---|
| [Poly Haven](https://polyhaven.com/license) | HDRIs, Texturen, Modelle | CC0 |
| [ambientCG](https://docs.ambientcg.com/license/) | PBR-Materialien | CC0 |
| [Kenney](https://kenney.nl/support) | Low-Poly-Kits, UI, SFX | CC0 |
| Quaternius | stilisierte Modellpacks | CC0 — **pro Download auf der Seite prüfen** |
| [Freesound](https://freesound.org/help/faq/) | Audio | **gemischt** — nur CC0-Filter verwenden, CC-BY-NC ist verboten |

**Werkzeuge (alle frei/OSS):** Blender (GPL) für Modelle/Rigs/Animation · Material Maker 1.4
(MIT) für prozedurale Texturen · Krita (GPL) für 2D/Texturen · Audacity (GPL) für Audioschnitt ·
LMMS (GPL) für Musik.

**Nachweispflicht:** Jedes Fremdasset bekommt eine Zeile in `docs/ASSET_PIPELINE.md`
(Datei, Quelle, Lizenz, Downloaddatum). Kein Eintrag = das Asset gilt als unklar lizenziert
und fliegt raus.

## Konsequenzen

**Leichter:** Ein Format, ein Exportpfad, keine Attributions-Buchführung im Spiel selbst.
CC0 macht die spätere Monetarisierungsfrage zu einem Nicht-Thema.

**Schwerer:** CC0 schließt einen großen Teil des verfügbaren Materials aus — besonders bei
Audio, wo CC-BY dominiert. Das kostet Auswahl und gelegentlich Qualität. Der Tausch ist
bewusst: Rechtssicherheit schlägt Auswahl, weil die Korrektur später ungleich teurer ist.

**Offen:** `.glb`-Dateien sind binär und blähen die Git-History auf. Git-LFS ist **noch
nicht** eingerichtet — Schwelle und Entscheidung dazu stehen als offener Punkt im
Ledger (`docs/_INDEX.md`, Tabelle A).

## Grenze (bekannte Limitation)

Deckt **nicht** ab: gekaufte Assets (per Definition ausgeschlossen), KI-generierte Assets
(Rechtslage 2026 uneinheitlich — eigenes ADR nötig, falls das relevant wird) und
Motion-Capture-Daten.
