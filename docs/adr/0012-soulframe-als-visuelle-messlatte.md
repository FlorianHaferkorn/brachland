---
last-reviewed: 2026-10-07
shelf-life-days: 365
---
# ADR-0012 — Soulframe-Ingame als visuelle Messlatte, Browser bleibt

**Status:** Accepted · 2026-10-07 · erweitert ADR-0006 (Zielbild) · ADR-0001 (three.js), ADR-0002 (CC0), ADR-0004 (Scope) und ADR-0005 (Qualitätsanspruch) gelten unverändert

## Kontext

Flo hat am 07.10.2026 vorgegeben: Messlatte für das Aussehen sind Ingame-Bilder und -Videos aus
Soulframe, und zwar als **Mindestqualität**. Auf die Gegenfrage (Browser behalten, Unreal oder beides)
kam die Antwort: „bringe es so nah es geht an die visuelle Darstellung heran.“

Das ist ein Ziel, kein erreichbarer Endzustand. Soulframe läuft auf der eigenen Evolution-Engine von
Digital Extremes, hinter der ein AAA-Team und zehn Jahre Warframe stehen, und ist im Oktober 2026 noch
Pre-Alpha. Was dort das Bild trägt, sind handgemachte PBR-Materialien, Laub mit Lichtdurchlass,
Figuren und Animation aus Motion Capture. Genau das ist der Teil, den ein KI-Agent nicht vervielfacht
(ADR-0004, Asymmetrie).

## Entscheidung

1. **Soulframe-Ingame ist die Messlatte, das eigene Blender-Zielbild (ADR-0006) bleibt der
   Messpunkt.** Gemessen wird weiter an festen Kameras gegen den Render (`docs/MESSLAUF.md`). Soulframe
   liefert die Richtung: wohin Licht, Dunst, Material und Dichte sich bewegen sollen. Bilder fremder
   Spiele kommen nicht ins Repo (wie D152).
2. **Browser und three.js bleiben.** Kein Engine-Wechsel. Wenn die Lücke an einer Stelle nur mit
   einer anderen Engine zu schließen ist, wird das als Befund festgehalten und nicht still umgangen.
3. **Reihenfolge der Hebel** nach Bildfläche und Aufwand:
   1. Bodenform: glatte Normalen statt Facetten, Fels an Hängen (D201)
   2. Fernland: der helle, kantige Fernberg
   3. Himmel: Verlauf, Wolken, Sonnenhof
   4. Laub: Lichtdurchlass, Farbvariation je Instanz, weichere Ausschnittkanten
   5. Material des Bodens und der Felsen aus CC0-Scans (Poly Haven, ambientCG). Diese Quellen sind
      CC0 und damit nach ADR-0002 erlaubt. Gesperrt ist nur der Netzzugriff der Cloud-Umgebung.
   6. Nachbearbeitung: Bloom, Lichtschächte im Dunst
   7. Figuren und Animation (der größte Abstand, der kleinste Hebel im Browser)
4. **Jeder Schritt mit Vorher/Nachher an denselben Kameras.** Die Abnahme macht Flo am Zielgerät
   (ADR-0005 N3/N6). Software-Rendering in der Cloud belegt nur, dass gerendert wird, nicht wie es wirkt.

## Konsequenzen

- „Die Werte in `RegionsSzene.tsx` sind erarbeitet“ gilt weiter: Jede Änderung braucht einen Grund
  und einen Vergleich, und dieser ADR ist der Grund für Änderungen am Bild.
- Ladezeit und Speicher steigen mit Hebel 5. Das 60-MB-Budget (`npm run quality`) bleibt das Gate.
- ADR-0011 (kühle Palette) bleibt offen und wird mit dieser Messlatte entschieden, nicht davor.

## Grenze

Soulframe-Niveau wird im Browser mit CC0-Assets nicht erreicht, nur angenähert. Am weitesten bleiben
Figuren, Animation und Materialtiefe zurück. Soll die Lücke ganz geschlossen werden, ist das der Fall
aus ADR-0004 („Spiel, das primär von Grafik lebt“), also ein eigenes Projekt.
