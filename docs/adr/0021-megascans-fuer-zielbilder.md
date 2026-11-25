---
last-reviewed: 2026-11-22
shelf-life-days: 180
---
# ADR-0021 — Megascans: sofort für Zielbilder, im Spiel erst nach Lizenzprüfung

**Status:** Accepted · 2026-11-22 (Flo, D424) · erweitert [ADR-0013](0013-gratis-lizenzen-statt-nur-cc0.md) (bisher: Fab/Megascans ausgeschlossen)

## Kontext

Quixel hat am 05.11.2026 die gesamte Megascans-Bibliothek auf Fab kostenlos gemacht (Rollout bis 12.11.2026). Es gilt
die Fab Standard License; laut ihrer Zusammenfassung auf fab.com/eula ist der Einsatz in jeder Engine und kommerziell
erlaubt, verboten ist das Weiterverkaufen oder Weitergeben eines Assets „on a standalone basis“. Der verbindliche
Volltext der EULA war beim Abruf am 22.11.2026 auf der Seite nicht enthalten. Ein Sekundärquelle (Licenseware)
nennt zusätzlich eine Pflicht, Endnutzer am Herauslösen der Inhalte zu hindern — nicht am Volltext bestätigt.

Ein Browser-Spiel liefert Modelle und Texturen als Dateien an den Browser aus; ob das als Einzelweitergabe gilt, ist
offen. Zielbilder in Blender (ADR-0006) dagegen geben nichts weiter.

## Entscheidung

1. **Zielbilder (Blender-Renders): Megascans sofort erlaubt.** Die Scans werden lokal geladen (`.cache/`, nie ins
   Repo), Herkunft je Bild in der Ledgerzeile. Download nur über Flos Epic-Konto am M1 — die Cloud-Sitzung loggt
   sich nirgends ein.
2. **Im Spiel (ausgelieferte Dateien unter `public/`): erst nach Prüfung des vollen EULA-Texts.** Bis dahin gilt
   ADR-0013 unverändert. Wenn die Prüfung es erlaubt, nur in umgearbeiteter Form (gebacken, in Atlanten
   zusammengelegt, verkleinert, komprimiert), nie die Originaldateien.
3. Jede Megascans-Datei im Repo bräuchte einen Eintrag in `assets/HERKUNFT.md` mit Lizenz „Fab Standard License“
   — das ist bis zur Prüfung ein Fehler, den `make check` künftig abfangen soll.

## Konsequenzen

- Die Zielbilder können Substanz auf Scan-Niveau zeigen, ohne Risiko für das Spiel.
- Zielbild und Spiel driften auseinander, solange das Spiel nur freie Assets nutzt — genau der Abstand, den die
  Engine-Arbeit schliessen muss. Das ist gewollt: die Engine folgt dem Render (ADR-0006).
- Megascans sind für Unreal gebaut (hohe Auflösung, viele Dreiecke); für den Browser wären sie ohnehin umzuarbeiten.

## Grenze

Keine Rechtsberatung. Die Prüfung von Punkt 2 heisst: Volltext lesen (Fab-Konto, Kaufbestätigung) und die Frage
„Browser-Auslieferung = Einzelweitergabe?“ beantworten; im Zweifel bei Epic nachfragen.
