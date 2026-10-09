---
last-reviewed: 2026-10-09
shelf-life-days: 365
---
# ADR-0013 — Assets: jede kostenlose Lizenz statt nur CC0

**Status:** Accepted · 2026-10-09 · erweitert ADR-0002 (CC0) und ersetzt dessen Ausnahme „CC-BY nur für Kreaturen“ (`assets/HERKUNFT.md`, 31.08.2026) · ADR-0004, ADR-0006 und ADR-0012 gelten unverändert

## Kontext

ADR-0012 setzt Soulframe-Ingame als Messlatte. Nach D199–D218 lag der verbleibende Abstand weniger am
Code als an den Assets: selbst gebaute Pflanzen mit 200–400 Dreiecken, stilisierte Figuren und keine
gescannten Materialien. Für realistische Menschen und Pflanzen gibt es unter CC0 kaum etwas.

Flo hat am 09.10.2026 zwei Vorgaben gemacht: „keine kostenpflichtigen Assets, nur gratis“ (D219) und
„wenn die Lizenz nichts kostet, können wir es machen“.

## Entscheidung

1. **Erlaubt ist jede Lizenz, die nichts kostet** und die Nutzung in diesem Spiel zulässt: CC0, CC-BY
   (mit Namensnennung), kostenlose Inhalte unter der Fab-Standardlizenz, MetaHuman und vergleichbare
   Gratis-Lizenzen.
2. **Nicht erlaubt:** alles, was Geld kostet (Kauf, Abo, Punkte), und Lizenzen, die die Nutzung für
   dieses Projekt ausschliessen, etwa „NC“ bei kommerzieller Absicht, „ND“, wenn verändert wird, oder
   eine Bindung an eine Engine, die das Spiel nicht benutzt.
3. **Jede Fremddatei bekommt eine Zeile in `assets/HERKUNFT.md`** mit Autor, Lizenz und Quelle. Für
   CC-BY ist die Namensnennung im Spiel Pflicht (Menü „Herkunft“, `public/herkunft.json`). Das
   Qualitätstor prüft das schon heute für Kreaturen und Figuren und wird auf jeden neuen Asset-Ordner
   ausgedehnt.
4. **Lizenz vor Download prüfen und mit Datum festhalten.** Gratis-Bedingungen ändern sich: Megascans
   waren bis Ende 2024 frei und kosten seit 2025. Massgeblich ist der Stand am Tag der Übernahme.

## Konsequenzen

- Der grösste Hebel im Browser sind die CC0-Scans von Poly Haven und ambientCG: Boden, Fels, Rinde und
  einige Pflanzen. Aus der Cloud-Umgebung sind diese Domains gesperrt, sie brauchen eine Freigabe
  unter Network access.
- CC-BY öffnet Sketchfab und ähnliche Quellen für Pflanzen und Figuren. Die Qualität ist sehr
  unterschiedlich, jedes Modell braucht einen Blick vor der Übernahme.
- Das 60-MB-Precache-Budget bleibt das Gate (CLAUDE.md). Gescannte Assets sind grösser, also gilt
  Laden nach Bedarf wie bei den Bauwerken (D155).
- Offen bleibt, ob der Browser bleibt oder Unreal kommt (ADR-0004). Mit Unreal wären auch MetaHuman
  und die freien Fab-Inhalte nutzbar. Ob MetaHuman ausserhalb von Unreal erlaubt ist, widersprechen
  sich die Quellen (Stand 09.10.2026); vor jeder Nutzung in three.js ist die Lizenz von Epic zu prüfen.

## Grenze

Kostenlos heisst nicht realistisch. Figuren auf dem Niveau von Elden Ring sind gratis nur mit
MetaHuman erreichbar, und das ist an Unreal gebunden oder lizenzrechtlich unklar.
