---
last-reviewed: 2026-08-20
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
  gewachsen · Signal nur als Punkt am Befall · unter `zielTris` und ~~120~~ **190 KB**
- **Fehlerfall:** Tier nicht bestimmbar → Grundform überarbeiten, nicht den Befall
  reduzieren
- **Rollback:** Modell entfernen, prozedurale Silhouette greift automatisch

## Nachtrag 20.08.2026 — die Kette steht, drei Zahlen ändern sich

Die Kette ist seit heute vollständig durchgetestet (ADR-0002, Nachtrag). Damit sind
**beide** Vorbedingungen der verbindlichen Reihenfolge erfüllt — dieses Dokument
schließt Schritt 1 seit dem 17.08.2026, der Kettentest schließt Schritt 2. Die
Stapelproduktion ist nicht mehr blockiert.

Drei Angaben oben sind überholt:

- **Budget 120 → 190 KB je Modell.** Die 120 waren eine Sperrklinke aus einem alten
  Asset. Die neue Zahl ist aus dem abgeleitet, was beim ersten Besuch über die
  Leitung geht: 2 MB komprimiert, davon 886 KB fest, geteilt durch 14 Kreaturen
  (G-91). Was hier steht, bleibt richtig: Die Referenz ändert das Aussehen, nicht
  die Physik des Budgets — aber die Physik war falsch gerechnet.
- **„4.000 Dreiecke im Nebel"** ist zu hoch gegriffen. `zielTris` steht bei den
  Kreaturen auf 3.000, und mit Voxel-Remeshing sind **1.756** erreichbar, ohne dass
  die Silhouette leidet (G-94). Für ein Dokument, dessen erster Satz „die Silhouette,
  nicht das Rendering" lautet, ist das die bessere Zahl.
- **Der Prompt fehlt weiterhin.** ADR-0002 verlangt ausdrücklich, den Prompt des
  Referenzbildes festzuhalten. Dieses Dokument beschreibt das Ergebnis sehr genau,
  aber ohne den Prompt lässt sich das Bild nicht reproduzieren, und genau das wäre
  bei einem Werkzeugwechsel nötig. **Offen.**

### Geltungsbereich — was hier steht, gilt nicht für jede Kreatur

Diese Klarstellung fehlte und hat prompt zu einer falschen Prüfung geführt. Die
**Creature Bible v1.1 §6** ist diesem Dokument übergeordnet und schneidet zu:

> „Befall ist Pilz, Flechte und Biolicht — keine Technikaufkleber. Diese Regel aus
> Stilreferenz v1 gilt **für Wildlinge**. Zuchtlinien und Verwachsene sind von
> Bauart technisch; dort beschreibt die Regel den *Befall*, nicht den Körper."

Technik ist also sehr wohl Teil der Erzählung — als **Herkunft**, nicht als Befall:

| Herkunft | Körper | Befall | Beispiel im Bestand |
|---|---|---|---|
| Wildling | reales Tier, gestreut | Pilz, Flechte, Biolicht | 11 der 14 |
| Zuchtlinie | VERIDIA-Fertigung: symmetrisch, modular, Rückenmodul aus fünf gleichen Platten | Pilz, Biolicht — nicht ein weiteres Modul | `k7-wolf` |
| Verwachsener | Tier und Infrastruktur sind eins, Sockel bis auf den Boden | Pilz, Biolicht | `trafomarder` |

Der Satz „keine Kabel, keine Platinen" in §2 meint also: **nicht am Befall und nicht
am Wildlingskörper.** Er verbietet Technik nicht im Spiel — er hält sie dort, wo sie
etwas bedeutet. Genau daran erkennt man, dass der Befall etwas ist, das einem
Konstrukt *widerfährt*, statt Teil seiner Bauweise zu sein.

### ⚠️ Offen: die zwei Alt-Tech-Wildlinge

`spuerfuchs` (Merkmal **Sensor-Fell**) und `linsenuhu` (**Facetten-Linsenaugen**)
sind beide `ursprung: wildling` mit `elemente: ['alt-tech']`. Damit ist ihr Körper
laut Tabelle oben **nicht** technisch und ihr Befall Pilz — ihr Merkmal heißt aber
Sensor beziehungsweise Linse. Wie ein Sensor an einem nicht-technischen Körper
aussieht, sagt kein Dokument. Drei Auflösungen sind denkbar:

1. **Biologisch lesen.** Das „Sensor-Fell" ist Fell, das wie ein Sensor *funktioniert*
   — Tasthaare, Fühlerborsten, Wärmegruben. Kein Metall. Passt zur Regel, passt zum
   Faulbrand als Biologie, und Alt-Tech bliebe reines Kampfelement.
2. **Alt-Tech als Fundstück.** Das Tier trägt etwas Gefundenes am Körper, kein
   Implantat — ein Splitter Leiterplatte im Fell verfilzt. Erzählerisch reizvoll,
   verwischt aber genau die Grenze, die §2 zieht.
3. **Herkunft ändern.** Wären beide `zuchtlinie`, wäre die Frage weg — sie kostet
   aber zwei Wildlinge und widerspricht „Fuchs streunt um die Enklaven".

**Empfehlung: (1).** Sie hält die Regel unangetastet, braucht keine Datenänderung
und ist die einzige, die auch dann noch trägt, wenn irgendwann fünf Alt-Tech-Linien
im Roster stehen. Zu entscheiden ist es trotzdem, nicht hier zu setzen.

### ⚠️ Innerer Widerspruch: der Fächer

§3 sagt: „Jede Linie hat genau **ein** Leitmerkmal … Der Fächer ist die gemeinsame
Klammer, **nicht das Merkmal jeder einzelnen Linie**." Der Abschnitt „Was daraus
folgt" sagt zwei Seiten später das Gegenteil: „Der Fächer gehört an **jede**
Kreatur." Beides kann nicht stimmen. Im Bestand trägt genau eine Linie einen Fächer
als Merkmal (`sporenhahn`, „Sporenfächer"), eine weitere einen verwandten
(`schneehuhn`, „Frostfeder-Fächer"); die übrigen zwölf haben etwas anderes.

Die Creature Bible §6 entscheidet es zugunsten von §3: „**Ein** Auswuchs je Kreatur,
aus genau einer der sechs Funktionskategorien." Der Satz unter „Was daraus folgt"
ist damit hinfällig. *(Die sechs Kategorien stehen allerdings nur auf dem Blatt und
in keinem Text — auch das ist offen.)*

### Prüfung der drei Fuchsmodelle — korrigiert

Die erste Fassung dieser Tabelle war falsch: Sie forderte einen Fächer, den der
Spürfuchs laut seinem eigenen `merkmal` gar nicht haben soll.

| Regel | fantasy fox | stylized fox | fantasy creature |
|---|---|---|---|
| 1 — Tier bleibt bestimmbar | grenzwertig | ✅ | ✗ (mehrere Ruten) |
| 2 — Befall ist Pilz und Flechte *(gilt, weil Wildling)* | ✗ (geweihartige Auswüchse) | ✗ (gar kein Befall) | ✗ |
| 3 — ~~Fächer~~ **das eigene Merkmal**, hier Sensor-Fell | ✗ | ✗ | ✗ |
| 4 — Signal nur als Punkt | ✗ (blaue Flächen an den Läufen) | ✗ (dito) | ✗ |

Das Ergebnis bleibt: alle drei fallen durch. Der Grund ist ein anderer als zuerst
notiert, und dass er ein anderer ist, hätte auffallen müssen, bevor die Tabelle
geschrieben wurde. Sie waren ein **Kettentest**, kein Inhalt.
