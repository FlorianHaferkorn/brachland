---
last-reviewed: 2026-09-09
shelf-life-days: 365
---
# ADR-0005 — Qualitätsanspruch: die Welt hält überall, nicht an Messpunkten

**Status:** Accepted · 2026-09-09 · erweitert `../QUALITY.md`, absorbiert D137

## Kontext

Flo nannte drei Beispiele für das, was ihm fehlt: Wasser soll fliessen und nicht in der
Luft schweben, Häuser sollen keine Löcher haben und nicht im Boden versinken, Tiere,
NPCs und die Spielfigur sollen sich natürlich bewegen. Dazu der Satz, der diesen ADR
auslöst: **das waren nur Beispiele, daraus ist der Anspruch abzuleiten.**

Die drei haben eines gemeinsam. Keines ist ein feines Detail — jedes sieht ein Spieler
in den ersten dreissig Sekunden, ohne danach zu suchen. Und keines wäre in irgendeiner
Messung dieses Projekts aufgefallen: **Ein versunkenes Haus hat eine tadellose
Leuchtdichte.**

Das ist der eigentliche Befund. Die Tore messen, wie hell das Bild ist (Bildtor:
Leuchtdichte, Schwarzanteil, Median, Dreiecke, Aufrufe, Ladezeit), was eine Datei wiegt
(Quality: Korridore, Attribute, Budgets) und ob Inhalt zusammenpasst (Validate). Kein
einziger dieser Werte ändert sich, wenn Geometrie falsch in der Welt sitzt. Das Projekt
hat ein ungewöhnlich gutes **photometrisches** Tor und **kein geometrisches**.

Der Beleg steht im eigenen Ledger. G-128 (alle Häuser innen nach aussen), G-130
(Trafomarder nie in der Welt), G-131 (neun von zehn Anbauten still verloren), G-133
(Wanderin lief seit D143 als T-Pose), G-134 (Dorf ohne Häuser, und `--neu` schrieb den
Verlust als neuen Grundwert) — alle sind durch grüne Tore gelaufen, teils wochenlang,
und gefunden hat sie jedes Mal ein Mensch, der hingeschaut hat.

**Verschärfend:** Die Regel gab es teilweise schon. `QUALITY.md` 4a fordert seit dem
16.08.2026 „In Bewegung geprüft, nicht nur als Standbild" — und D143 lieferte eine
Figur, die beim Gehen die Arme ausbreitet, mit einem ⚠️ im Ledger als Ersatz fürs
Hinsehen. Eine Klausel ohne Tor und ohne festgehaltenen Nachweis verfällt. Das ist der
Grund, warum dieser ADR jede Klausel mit einem Nachweisweg und einem Status führt.

## Entscheidung

### Der Anspruch in einem Satz

**Die Welt muss überall zusammenhalten, nicht dort, wo gemessen wurde.** Nicht „gut an
vierzehn Kamerapunkten", sondern glaubwürdig an jedem Punkt, den der Spieler betreten
kann.

Das ist die Fortsetzung von `QUALITY.md` §1 („kein einziges Element unter der Latte")
mit einem Zusatz, der dort fehlte: Die Latte gilt nicht nur je **Element**, sondern je
**Ort in der Welt** — und der Nachweis muss die Fläche abdecken, nicht die Stichprobe.

Bei knapper Zeit gilt weiter `QUALITY.md` §1: **Umfang wird gestrichen, die Latte
nicht gesenkt.** Eine Region, die vollständig trägt, ist mehr wert als fünf, die
überall bröckeln.

---

### Teil 1 — Nachweisklauseln (N1–N6)

Wie belegt wird, dass etwas stimmt. Diese sechs gelten für **jede** Arbeit, nicht nur
für Geometrie.

**N1 — Abdeckung vor Genauigkeit.**
Vierzehn Standpunkte in 15,9 km² sind keine Prüfung. Eine Prüfung läuft über die
Grundgesamtheit (alle 2.033 Grundrisse, alle Wasserlinien, alle Vorkommen, alle
Figuren) oder sie **nennt ihre Stichprobengrösse im Ergebnis**. Eine Aussage ohne
genannte Abdeckung gilt als nicht belegt.

**N2 — Jeder Befund wird zur Gattung.**
Ein Fehler ist erst behoben, wenn seine **Gattung** unmöglich ist. Tremmel stand im
Hausgrundriss — behoben wäre: kein Ort darf je in einem Grundriss stehen, und das Tor
weiss es. Die Reiterin sass im Gehörn — behoben wäre: keine Sitzhöhe darf je im Anbau
liegen. Ein reparierter Einzelfall ist ein halber Fix und zählt nicht als erledigt.

**N3 — Nur die Spielersicht ist Abnahme.**
Messwinkel sind Diagnose. **Gesehen** ist etwas, wenn es aus der Spielkamera, in
Bewegung, unter Spielbedingungen gesehen wurde. Die Sitzpose brauchte vier Runden, weil
ich in Messwinkeln geprüft habe; Flo fand den Fehler in einer, weil er gespielt hat.

**N4 — Ganze Systeme, nicht die Stichprobe, die gerade offen war.**
Was für eine Art gilt, wird für alle Arten der Klasse geprüft, und die Prüfung nennt
die Zahl. D145 prüfte die Sitzpose auf **einem** Grathorn und lieferte; tragfähig waren
sechs Arten.

**N5 — „Ungesehen" ist kein Lieferzustand.**
Ein ⚠️ im Ledger ersetzt kein Hinsehen. Entweder in derselben Runde gemessen, oder das
Feature ist nicht fertig und wird nicht als fertig gemeldet. Offene Messungen sind
zulässig — als **offener Punkt mit Termin**, nicht als Fussnote unter einer Lieferung.

**N6 — Die Messung muss die Sache treffen, über die geredet wird.**
Ein grüner Median belegt keine Geometrie, ein Standbild keinen Gang, ein Mittelwert
keine Ruckler. Wer Qualität behauptet, nennt die Messung, die genau diese Eigenschaft
prüft — sonst ist es eine Meinung (`QUALITY.md` §1, zweiter Absatz).

---

### Teil 2 — Weltintegrität (W)

Die Klasse, aus der Flos Beispiele stammen. Alles hier ist geometrisch prüfbar; nichts
davon wird heute geprüft.

**W1 — Nichts schwebt, nichts versinkt.** Jedes platzierte Objekt (Haus, Prop, Kreatur,
Ort, Fundstelle, Figur) berührt den Boden: Unterkante über der Geländehöhe unter dem
tiefsten Punkt seines Grundrisses, und nicht tiefer als die Schürze darunter.

**W2 — Nichts durchdringt, was undurchdringlich aussieht.** Kein Baum im Haus, keine
Kreatur in der Wand, kein Ort im Grundriss, keine Figur im Tier.

**W3 — Geschlossene Körper sind geschlossen.** Ein Haus hat keine Kante mit nur einem
Nachbarn (Loch) und keine Fläche mit umgekehrtem Umlauf (G-128). Beides ist eine
Zählschleife über die Kanten, keine Kunst.

**W4 — Wasser liegt in seinem Bett.** Die Oberfläche liegt nie über dem Gelände
daneben, fliessendes Wasser läuft bergab, ein Wasserfall hängt am Band darüber und am
Becken darunter, stehendes Wasser hat **eine** Höhe. Der bauliche Weg dahin ist, das
Bett vor dem Höhenfeld **einzuschneiden** — dann kann Wasser gar nicht schweben, weil
die Ufer höher sind.

**W5 — Erreichbarkeit in beide Richtungen.** Was der Spieler sehen und erreichen soll,
ist erreichbar (`bruchkante` liegt 125 m ausserhalb der Region — G-102, seit Wochen als
Warnung geduldet). Und umgekehrt: keine unsichtbare Wand ohne sichtbaren Grund.

**W6 — Kollision deckt sich mit dem Bild.** Man läuft nicht durch, was solide aussieht,
und nicht gegen, was offen aussieht. Kamera und Figur benutzen dasselbe Feld.

**W7 — Der Maßstab stimmt überall.** 1 Einheit = 1 Meter (ADR-0001/MASSSTAB), also:
Türen über 1,8 m, Tiere in ihrer Widerristhöhe, Häuser in Geschosshöhen. Ein Reittier,
auf dem die Stiefel den Boden schleifen, ist ein Maßstabsfehler, keine Posenfrage.

---

### Teil 3 — Bewegung (B)

**B1 — Füsse stehen auf dem Boden.** Kein Rutschen (Zyklus an das Tempo gekoppelt),
kein Schweben und kein Versinken am Hang (Fuss-IK mit Strahl nach unten, Hüfte senkt
sich, wenn ein Bein nicht reicht). Das ist der grösste gefühlte Unterschied zwischen
„gleitet über den Hügel" und „geht den Hügel hinauf".

**B2 — Übergänge schnappen nicht.** Überblendet wird phasenrichtig, nicht zu einem
beliebigen Zeitpunkt, sonst versetzen sich die Füsse beim Wechsel.

**B3 — Bewegung wird in Bewegung geprüft.** Standbilder aus dem Stand sind kein Beleg
für einen Gang (G-133). Mehrere Aufnahmen **einer** Sitzung, in Bewegung, mit echter
GPU.

**B4 — Nichts steht still, was leben soll.** Und nichts zappelt, was ruhen soll: Ein
Tier, das atmet, ein NPC, der die Haltung wechselt, ein Baum im Wind — aber keine
Dauerbewegung, die im Blickfeld nervt.

**B5 — Die Steuerung überrascht nie.** Beschleunigen und Bremsen statt Ein-Aus, Drehen
auf der Stelle statt Schwenken um einen Punkt ausserhalb der Figur, Neigung in die
Kurve. Der Spieler soll die Figur nicht *bedienen*, sondern *führen*.

---

### Teil 4 — Sicht (S)

**S1 — Die Zielwerte aus D110 gelten weiter.** Median ≥ 0,15, Anteil unter 0,02 ≤ 10 %,
linear gemessen. Das ist der **Boden**, nicht die Decke — es sagt, dass nichts absäuft,
nicht dass es schön ist.

**S2 — Silhouette auf Spieldistanz lesbar** (`QUALITY.md` 4a, gilt unverändert).

**S3 — Kein sichtbares Popping.** LOD-Wechsel, Attrappen-Schwellen und Kachelaufbau
dürfen im Lauf nicht als Sprung auffallen. Prüfung: Aufnahmen entlang einer Fahrt über
die Schwelle, nicht davor und dahinter.

**S4 — Kein Z-Fighting, kein Flimmern.** Flächen liegen nicht koplanar aufeinander;
Kanten flackern nicht bei Bewegung.

**S5 — Keine Fläche aus identischen Klonen.** Farbe und Grösse streuen je Instanz. Ein
Wald aus einem einzigen Grünton ist eine Kulisse, kein Wald — die Slot-Mechanik aus
D146 kann das für alles liefern, was `COLOR_0` trägt.

**S6 — Licht ist eine Entscheidung, kein Restwert.** Warm/kalt getrennt zwischen
besonntem und beschattetem Material, Nebel als Tiefenstaffelung, AO in den Kehlen. Das
sind die billigsten Schönheitsgewinne in Low-Poly und die einzigen, die ohne mehr
Dreiecke kommen.

---

### Teil 5 — Regeln und Spielgefühl (R)

**R1 — Balance wird gegen ein erklärtes Ziel gemessen, nicht gefühlt.** Vor dem
Kalibrieren steht die Zielkurve als Zahl (Beispiel: gleiche Stufe ≈ 50 % Gewinnquote,
+5 Stufen ≈ 25 %, +10 ≈ 10 %, Typvorteil verschiebt um eine Stufenklasse). Belegt wird
mit einem Simulator über viele Kämpfe je Stufenpaar, nicht mit einem gespielten Kampf.
**Anlass:** Grathorn Stufe 8 schlägt Witterfuchs Stufe 17 mühelos — das ist entweder
die Stufenkurve, die Matrix oder die Gegner-KI, und keines davon ist heute gemessen.

**R2 — Jede Regenten-Phase konterbar** (bestehend, `npm run quality`).

**R3 — Keine dominante Strategie, keine tote Option.** Wenn ein Move, ein Element oder
ein Gegenstand nie die beste Wahl ist, ist er Verwaltung und wird gestrichen
(`QUALITY.md` §1: Umfang streichen).

**R4 — Jeder Inhalt ist erreichbar und tut etwas.** Bewohner ohne Auftrag, Fundstück
ausserhalb der Region, Gegenstand ohne Wirkung — teilweise geprüft, gehört vollständig
ins Tor.

**R5 — Fortschritt ohne Grind.** Der kritische Pfad ist ohne Wiederholungsfarmen
begehbar; wenn er es nicht ist, ist die Kurve falsch, nicht der Spieler.

---

### Teil 6 — Leistung (L)

**L1 — Auf dem Zielgerät gemessen, nicht vom M1 abgeleitet.** Der Mac unter Playwright
ist ein Vorfilter. Jede Leistungsaussage nennt das Gerät. Offen seit D115: Kontur-p95
und Ladezeit am Handy.

**L2 — Stabil, nicht im Mittel.** p95 statt Durchschnitt; ein Ruckler alle 32 m ist ein
Fehler, auch wenn die mittlere Bildrate stimmt.

**L3 — Ladezeit bis vollständig.** Nicht bis „irgendetwas steht" (G-134: das Bildtor
mass 15 s lang einen 90-%-Bau). Gemessen wird der Moment, in dem Gelände und Bänder
fertig sind.

**L4 — Offline heisst offline.** Im Flugmodus vollständig spielbar, inklusive zweitem
Start. Wird heute nirgends automatisch geprüft.

---

### Teil 7 — Verlässlichkeit (V)

**V1 — Kein stiller Rückfall** (D137, gilt unverändert). Melden oder im Tor blocken —
nie `?? standard`.

**V2 — Die Konsole ist leer.** Immer, nicht stichprobenartig. Ein Fehler in der Konsole
ist ein Blocker, auch wenn das Bild stimmt (so wurde D134 gefunden).

**V3 — Der Spielstand überlebt.** Ein Versionswechsel kostet niemandem sein Team;
fehlende Felder bekommen sichere Standardwerte (steht so in `spielstand.ts` und gilt
als Klausel).

**V4 — Grundwerte werden nie ohne gelesenen Unterschied überschrieben.** `--neu` ist
kein Knopf, den man nach jeder Runde drückt. Ein Sprung von mehr als 25 % ist ein
Befund, kein neuer Grundwert (G-134, seitdem warnt der Lauf).

**V5 — Kein Zufall ohne Saat.** Alles Gestreute ist aus Saat reproduzierbar, sonst ist
kein Befund wiederholbar.

---

### Teil 8 — Bedienung (D)

**D1 — Einhändig am Handy spielbar.** Das ist die Prämisse (Reise-Downtime), also ein
Kriterium und keine Bequemlichkeit.

**D2 — Tippziele gross genug** (≥ 44 px) und nicht unter dem Daumenballen.

**D3 — Text in Spielgrösse lesbar**, auf dem Gerät geprüft, nicht im Browserfenster.

---

## Definition of Done je Feature

Ein Feature gilt als fertig, wenn **alle** Punkte zutreffen. Der Ledger-Eintrag nennt
die Zahlen, nicht nur das Ergebnis.

1. **Gebaut** und typgeprüft, `make check` grün.
2. **Aus der Spielkamera gesehen**, in Bewegung, unter Spielbedingungen (N3, B3).
3. **Über die ganze Klasse geprüft**, mit genannter Zahl — alle Arten, alle Stimmungen,
   alle Figuren (N4).
4. **Abdeckung genannt**: Grundgesamtheit oder Stichprobengrösse (N1).
5. **Gattung geschlossen**: Das Tor, das diesen Fehler künftig fängt, existiert — oder
   der Ledger nennt, warum es nicht geht (N2).
6. **Konsole leer**, keine Warnung ausser bekannten (V2).
7. **Keine offene Messung als Fussnote** — offene Punkte stehen als offene Punkte (N5).

## Status: welche Klausel hat heute ein Tor

| Klausel | Tor heute |
|---|---|
| S1 Leuchtdichte, S2 Silhouette | Bildtor, Checkliste 4a — **da** |
| L2 p95, L3 Ladezeit, Dreiecke/Aufrufe | Bildtor seit D146 — **da** (nur Mac) |
| R2 Konterbarkeit, R4 teilweise | `npm run quality` / `validate` — **da** |
| V1 stiller Rückfall, V4 Grundwerte | D137 / Bildtor seit G-134 — **da** |
| Assets: Korridore, Attribute, Budgets | `npm run quality` — **da** |
| **W1–W7 Weltintegrität** | **fehlt vollständig** |
| **B1, B2, B4, B5 Bewegung** | **fehlt vollständig** |
| **S3–S6 Popping, Flimmern, Streuung, Licht** | **fehlt** |
| **R1 Balance-Zielkurve, R3, R5** | **fehlt** |
| **L1 Zielgerät, L4 Offline** | **fehlt** |
| **V3 Spielstand, V5 Saat** | **fehlt** |
| **D1–D3 Bedienung** | **fehlt** |
| N1–N6 Nachweisklauseln | Prozess, kein Tor — durch DoD erzwungen |

Ehrlich gelesen: **gemessen wird das Bild, nicht die Welt.** Das ist die Lücke, die
dieser ADR schliesst.

## Umsetzungsreihenfolge

Nach Wirkung je Aufwand, nicht nach Nummer:

1. **Geometrie-Tor (W1–W3)** — Strahl nach unten je Gebäudeecke gegen `hoeheAufFlaeche`,
   Kantenzählung für Löcher und Umlauf. Schlägt zwei von Flos drei Beispielen auf
   einmal und sagt zuerst, wie gross der Schaden wirklich ist.
2. **Flussbett einschneiden (W4)** — Gelände entlang der Wasserlinien absenken, Wasser
   aus demselben Höhenfeld wie das Gelände.
3. **Fuss-IK (B1, B2)** — Spielerin, Bewohner, danach Kreaturen.
4. **Balance-Simulator (R1)** — Zielkurve festlegen, Gewinnquoten je Stufenpaar messen,
   dann kalibrieren.
5. **Kreatur-Rigs statt Shader-Gang (B1 für Tiere)** — vier Rig-Typen decken alle Arten.
6. **Streuung und Licht (S5, S6)** — billigster Schönheitsgewinn.

## Konsequenzen

**Schwerer:** Jedes Feature kostet mehr, weil die Prüfung über die Klasse läuft statt
über die Stichprobe. Der Vertical Slice wird später fertig.

**Leichter:** Die Nacharbeitsschleifen fallen weg. Vier Runden Sitzpose waren teurer als
ein Prüflauf über sechs Arten gewesen wäre; drei Wochen Häuser-innen-nach-aussen teurer
als eine Umlaufprüfung.

**Für den Scope:** Œntal wird lückenlos, bevor Region 2 beginnt. Die Tore, die dafür
gebaut werden, machen die Regionen 2–5 fast umsonst — und ohne sie skaliert man den
Fehler mit.

**Für den Ledger:** Ein Eintrag ohne genannte Abdeckung und ohne Spielersicht ist kein
erledigter Eintrag. `⚠️` bleibt erlaubt, aber nur in Tabelle A (offene Punkte), nicht
als Fussnote unter einer Lieferung.

## Abgrenzung — was dieser ADR nicht fordert

- **Keine Fotorealistik.** Der Stil bleibt handgemalter Low-Poly ohne Texturen (D112).
  „Real" heisst hier *in sich stimmig*, nicht *fotografisch*.
- **Keine Fehlerfreiheit.** Gefordert ist, dass nichts durchkommt, was ein Spieler im
  normalen Spiel als kaputt bemerkt — nicht, dass es keine Fehler gibt.
- **Keine neue Engine.** ADR-0001 gilt: Godot oder Unreal gäben Wasser, Terrain und IK
  fertig, kosten aber Monate und kippen die Offline-PWA-Prämisse.
- **Keine KI-Assetflut.** Nicht der Bestand ist der Engpass, sondern die Integration;
  Stilkonsistenz über ~200 Kreaturen ist genau die Schwäche generierter Meshes
  (ADR-0002, Stil-Referenz zuerst).

## Grenze (bekannte Limitation)

Die Klauseln B4, B5, S6, R3, R5 und D1 sind **nicht vollständig automatisierbar**. Für
sie gilt der manuelle Weg aus `QUALITY.md` 4a/4b — mit einer Verschärfung: Das Ergebnis
wird schriftlich festgehalten (Ledger oder Playtest-Protokoll), sonst gilt N5. Was nur
im Kopf geprüft wurde, wurde nicht geprüft.
