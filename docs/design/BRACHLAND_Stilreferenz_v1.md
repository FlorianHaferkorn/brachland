---
last-reviewed: 2026-08-17
shelf-life-days: 365
---
# BRACHLAND — Stilreferenz Kreaturen v1

> **Status: verbindlich für WILDLINGE.** Damit ist ADR-0002 erfüllt und Ledger G-2
> geschlossen. Jedes Wildling-Modell wird gegen dieses Dokument geprüft.
> Abweichungen sind möglich — aber als Änderung dieses Dokuments, nicht als
> Einzelfall.
>
> **Übergeordnet:** `BRACHLAND_Creature-Bible_v1.1.md` regelt alle drei Herkünfte,
> die vier Zustände und die Narben. Dieses Dokument ist die feinere Auflösung für
> die Wildlinge und wurde aus dem Referenzbild vom 16.08.2026 abgeleitet, das
> ausschließlich Wildlinge zeigte.
>
> **Fidelity-Ziel: die Silhouette, nicht das Rendering.** Kreaturen stehen im Spiel
> bei 4.000 Dreiecken (`zielTris`) im Nebel; Referenzbilder haben Rim Light und
> Glow. Ein Modell ist richtig, wenn seine **Silhouette** und sein Farbwert
> stimmen — nicht, wenn es dem Bild näher kommt.

**Quelle:** Referenzbild von Flo, 16.08.2026. Vier Linien in je drei Mutationsstufen:
Steinbock, Gämse, Alpenmurmel, Alpenschneehuhn.

## Die Regel in einem Satz

**Ein erkennbares Alpentier, auf dem etwas wächst.** Nicht ein Monster, das an ein
Tier erinnert.

## Was das Bild festlegt

### 1. Das Tier bleibt das Tier

Auf allen drei Stufen ist die Art auf den ersten Blick bestimmbar. Der Steinbock
behält Hörner, Bart und Hufe; das Schneehuhn behält Schnabel, Kamm und Ständer. Die
Silhouette wird schwerer und breiter, aber sie wird **nie** zu einer Fantasiegestalt.

**Konsequenz für die Modelle:** Grundform aus der realen Anatomie, nicht aus einem
Kreaturen-Entwurf. Wer die Mutation wegdenkt, muss ein Bestimmungsbuch-Tier übrig
haben.

### 2. Der Befall ist Pilz und Flechte, nicht Technik

Was wächst, ist organisch: Porlinge, Hutpilze, Moospolster, Flechtenkrusten,
Schuppen. **Keine** Kabel, keine Platinen, keine Metallteile am Wildling. Alt-Tech
ist ein *Element* und gehört zu Verwachsenen wie dem Trafomarder — nicht zur
allgemeinen Kreaturenoptik.

**Nachtrag zur Creature Bible v1.1:** Bei **Zuchtlinien** ist der Körper von Bauart
technisch (symmetrisch, modular, VERIDIA-Fertigung). Diese Regel beschreibt dort
nur den **Befall** — der bleibt auch am K7-Wolf Pilz und Biolicht, nicht ein
zusätzliches Modul. Genau daran erkennt man, dass der Befall etwas ist, das dem
Konstrukt *widerfährt*, und nicht Teil seiner Bauweise.

### 3. Der Fächer ist das Leitmerkmal

Alle vier Linien tragen ab Stufe 1 einen **Fächer aus Baumpilzen** an Flanke oder
Hinterhand, der mit jeder Stufe wächst, bis er auf Stufe 3 fast so groß ist wie das
Tier. Das ist das eine Merkmal, an dem man BRACHLAND-Kreaturen von jedem anderen
Creature-Collector unterscheidet.

**Regel:** Jede Linie hat genau **ein** Leitmerkmal (Design-Regel `merkmal` im
Schema). Der Fächer ist die gemeinsame Klammer, nicht das Merkmal jeder einzelnen
Linie.

### 4. Die Signalfarbe sind Leuchtpunkte, keine Flächen

Auf den Pilzhüten und im Moos sitzen kleine **hellblaue bis weiße Leuchtpunkte**,
sparsam gesetzt — Dutzende, keine Hunderte, und immer als Punkt, nie als leuchtende
Fläche. Dazu leuchten die Augen schwach in derselben Farbe.

Das ist die Umsetzung von „eine Signalfarbe für Befall" aus der Art Direction: Sie
erscheint **nur** am Befall, nie am Tier selbst.

### 5. Farbvokabular

| Rolle | Ton |
|---|---|
| Fell / Gefieder | warme Grau- und Sandtöne, Umbra, gebrochenes Weiß |
| Befall (Moos, Kruste) | gedämpftes Oliv- und Graugrün |
| Pilze | Ocker, helles Beige, an einzelnen Linien warmes Orange |
| Signal | kaltes Weißblau, nur als Punkt |
| Horn, Huf, Schnabel | dunkles Graubraun bis Anthrazit |

Kein Ton ist gesättigt. Der einzige kalte Akzent im Bild ist das Signal.

### 6. Was die Stufen tun

| | Stufe 1 „Angepasst" | Stufe 2 „Durchdrungen" | Stufe 3 „Vollzogen" |
|---|---|---|---|
| Befallsanteil | ~15 % der Oberfläche | ~40 % | ~65 % |
| Fächer | angedeutet, wenige Lamellen | halbe Körperlänge | fast körpergroß |
| Silhouette | reales Tier | schwerer, breiter | massig, Rücken überwachsen |
| Signalpunkte | wenige, nur am Fächer | über Rücken und Fächer | dicht, auch am Kopf |
| Größe | 100 % | 115–125 % | 135–150 % |

Der Aufstieg ist **Zuwachs**, nicht Umbau: Stufe 3 muss neben Stufe 1 als dasselbe
Wesen lesbar sein.

### 7. Präsentation

Neutraler dunkler Hintergrund, Seitenansicht, weiches Licht von schräg vorn, Tier
steht auf allen Vieren bzw. Ständern. Kein Boden, keine Effekte, keine Pose.

## Was daraus für die Umsetzung folgt

- **Prozedurale Silhouetten** (`src/world/kreaturgestalt.ts`) bleiben bis auf
  Weiteres der Weltstand — mit **einer** Nachbesserung: Der Fächer gehört an jede
  Kreatur, weil er das Leitmerkmal ist. Ohne ihn sieht man BRACHLAND nicht an.
- **Modelle** werden Linie für Linie gebaut, nicht alle 200 auf einmal. Reihenfolge
  nach Vorkommen im Spiel: Wurzelkeiler und Sporenhahn zuerst (je ~320 Vorkommen),
  Kiemenbiber und Moderotter zuletzt (je ~30).
- **Budget** je Modell bleibt bei 120 KB und dem `zielTris` der Kreatur — die
  Referenz ändert das Aussehen, nicht die Physik des Auslieferungsbudgets.
- Die vier Tiere des Referenzbildes sind **nicht** identisch mit dem Roster: Gämse
  entspricht der Nebelgams, Steinbock dem Grathorn, Alpenschneehuhn hat noch keine
  Linie. Alpenmurmel ebenfalls nicht. Beide sind Kandidaten für Kapitel 1.

## Definition of Done (neues Kreaturenmodell)

- **Input:** Linie aus `content/creatures/`, drei Stufen
- **Output:** Art ohne Beschriftung bestimmbar · Fächer vorhanden und mit der Stufe
  gewachsen · Signal nur als Punkt am Befall · unter `zielTris` und 120 KB
- **Fehlerfall:** Tier nicht bestimmbar → Grundform überarbeiten, nicht den Befall
  reduzieren
- **Rollback:** Modell entfernen, prozedurale Silhouette greift automatisch
