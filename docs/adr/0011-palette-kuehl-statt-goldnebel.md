---
last-reviewed: 2026-10-07
shelf-life-days: 365
---
# ADR-0011 — Palette: kühl statt Goldnebel?

**Status:** Proposed · 2026-10-07 · würde ADR-0006 (Zielbild, Licht und Palette) ändern, falls angenommen · ADR-0004 und ADR-0005 gelten unverändert

> **Entwurf.** Hier ist noch nichts entschieden. Flo entscheidet. Bis dahin gilt ADR-0006: Der Tag
> ist `zielbild` = `goldnebel`, also warm (`src/scenes/RegionsSzene.tsx`, `STIMMUNG.tag`).

## Kontext

Flo hat am 07.10.2026 ein Zielbild-Briefing eingebracht. Es verlangt eine „gedämpfte Farbpalette:
düstere, kühle Blau-, Grau- und Brauntöne“, dazu sparsame Akzente wie glühende Augen oder
beleuchtete Runen. Das widerspricht dem, was ADR-0006 entschieden und D152–D172 gemessen haben:

| | Stand (ADR-0006, gemessen) | Briefing 07.10.2026 |
|---|---|---|
| Licht | warm, Sonne `#f2dcc0` | nicht genannt, kühle Grundstimmung |
| Schatten | **warm**: „Kein blauer Schatten“ (D152, Referenz 8 Bilder) | kühl, blaugrau |
| Dunst | hell, trägt die Lichtfarbe (`#5a4b40`) | weicher, volumetrischer Nebel, kühl |
| Farbton | 80–95 % der Sättigung in 0–60° | Blau, Grau, Braun |
| Akzent | eine Signalfarbe für Befall (Art Direction) | sparsam: Augen, Runen |

Bei den **Akzenten** gibt es keinen Konflikt. „Eine Signalfarbe“ und „sparsame Akzente“ meinen
dasselbe Prinzip. Der Konflikt liegt allein in **Grundlicht und Schattenfarbe**.

Schon im Bestand vorhanden: `daemmerung` und `abendrot` verwenden kaltes Umgebungslicht. Der Grund
steht beim Abendrot: warmes Direktlicht und blauer Himmel im Schatten sind physikalisch richtig. Für
Abend und Nacht ist „kühl“ also schon gelöst. Offen ist nur der **Tag**.

## Optionen

1. **Bleiben (ADR-0006 unverändert).** Kostet nichts. Düster und bedrohlich wirkt das Spiel weiter
   über Dämmerung, Nebel und Silhouetten. Dagegen spricht: Die Palette des Briefings käme am Tag
   nie an.
2. **Probe neben dem Tag (Empfehlung).** Eine neue Stimmung `kaltnebel`, wie seinerzeit
   `goldnebel` (D152): nur per `?stimmung=kaltnebel`, **nicht im Tageslauf**. Gemessen wird an den
   Bildtor-Adressen mit `.cache/mess/stil.mjs`, danach wird verglichen, und zwar am Zielgerät, nicht
   am Standbild. Kostet etwa einen Arbeitsschritt, ist voll umkehrbar und ändert die Art Direction
   nicht still.
3. **Vollwechsel.** Ein neues Referenzbild in Blender (`tools/szenenbau.py`) mit kühlem Licht, dann
   `tag` = kühl und das Bildtor neu gegrundet. Das heisst: Stufe 1–3 aus ADR-0006 laufen erneut,
   und die Abstimmung D152–D172 (Sonne/Himmel-Verhältnis, Fülllicht, Schattenkarte) wird zur Hälfte
   entwertet. Teuer umkehrbar.

## Vorschlag

**Option 2.** Option 3 erst dann, wenn die Probe am Zielgerät überzeugt. Die Gründe:

- Die Warm-Entscheidung beruht auf Messungen gegen eine Referenz, nicht auf Geschmack. Für Kühl gibt
  es bisher nur einen Satz im Briefing. Bevor eine gemessene Grundlage ersetzt wird, braucht es
  eine gleichwertige.
- Ob kühles Tageslicht „bedrohlich“ oder bloss „grau“ wirkt, lässt sich nicht vorab sagen
  (`CLAUDE.md`: keine Look-Aussage aus Standbildern).

## Konsequenzen, falls angenommen

- Option 2: Eine Stimmung kommt dazu, ein Ledger-Eintrag mit Messwerten folgt, Tageslauf und
  Bildtor bleiben unberührt.
- Option 3 (später): Dieses ADR wird auf Accepted gesetzt und ändert ADR-0006 Punkt 1 (Referenzbild)
  und die Stimmungswerte. `QUALITY.md` bekommt neue Latten aus dem neuen Render (§6, eigener Commit).

## Grenze

Dieses ADR legt nur Licht und Palette fest. Fotorealismus als Ziel gehört nicht dazu. Ein Spiel,
das primär von Grafik lebt, bleibt nach ADR-0004 geparkt. Gedämpfte PBR-Materialien, die zum
Referenzbild passen, sind dagegen schon durch ADR-0006 gedeckt.
