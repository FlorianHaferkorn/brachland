---
last-reviewed: 2026-09-25
shelf-life-days: 365
---
# ADR-0008 — Waffenwerk: zwei Klassen, jede mit eigenem Fenster

**Status:** Accepted · 2026-09-25 · baut auf ADR-0007 (Echtzeitkampf) auf · ADR-0002 (CC0) und ADR-0004 (fremdes IP) gelten unverändert

## Kontext

ADR-0007 liess offen, ob die Spielerin eine Waffe führt, mehrere, oder Klassen mit eigenen
Fenstern — mit dem Hinweis, dass das die Zahl der Clips vervielfachen kann. Zur Wahl standen
(25.09.2026): ein Bewegungssatz für alle Waffen, zwei Klassen leicht/schwer, eine feste Waffe.
**Flo hat zwei Klassen gewählt.**

Der Bestand: Das Quaternius-Paket (CC0), aus dem die Wanderin stammt, hat genau einen
Waffenschlag (`Sword_Slash`, 1,29 s), dazu Faustschlag und Tritt. Einen schweren Hieb gibt es
nicht.

## Entscheidung

1. **Zwei Klassen: Klinge (leicht) und Axt (schwer).** Jede Klasse hat ihre eigenen drei Phasen,
   Reichweite, Bogen, Schaden, Haltungsschaden und Kosten (`WAFFEN` in `src/kampf/echtzeit.ts`).
   Die Klinge ist der Schlag aus D166, unverändert.

   | | Vorlauf | aktiv | Erholung | Reichweite | Bogen | Schaden | Haltung | Kosten |
   |---|---|---|---|---|---|---|---|---|
   | Klinge | 0,18 s | 0,12 s | 0,32 s | 2,4 m | ±55° | 22 | 34 | 18 |
   | Axt | 0,42 s | 0,16 s | 0,55 s | 2,9 m | ±40° | 38 | 52 | 30 |

2. **Klassen sind Werkzeuge, keine Stufen.** Das Tor (`tests/echtzeit.test.ts`, Abschnitt 12)
   hält fest: Die Axt macht je Sekunde **nicht** mehr Schaden als die Klinge (33,6 gegen 35,5),
   je Ausdauer höchstens 20 % anders (1,27 gegen 1,22), reicht weiter und bricht die Haltung des
   Übungsgegners mit einem Treffer, wo die Klinge zwei braucht. Wer eine dritte Klasse einführt,
   muss sich an dieselben Prüfungen halten.

3. **Wechsel nur aus dem Stand** (1/2 oder Tab). Nie mitten im Schlag oder in der Rolle.

4. **Ein Clip, drei Abschnitte — vorerst.** Beide Klassen spielen `Sword_Slash`, aber jede Phase
   der Regel liegt auf ihrem eigenen Abschnitt des Clips (Ausholen bis 0,29, Durchzug bis 0,52 der
   Cliplänge, gemessen an der Winkelgeschwindigkeit der Armknochen). Die Axt holt dadurch sichtbar
   lange aus und zieht schnell durch. **Das ist ein Platzhalter.** Die Axt braucht einen eigenen
   Clip mit Überkopf-Ausholen; er muss selbst gebaut werden (Blender, auf dem Quaternius-Rig),
   weil fremde Clips an ADR-0002 scheitern.

5. **Waffen sind Geometrie, kein Asset.** Kasten und Zylinder an `Wrist.R`, in der Lage, die das
   Paket für sein Schwert vorgibt. Ein gestaltetes Modell kommt mit dem eigenen Axt-Clip.

## Konsequenzen

- Clipbedarf der Spielerin: +1 (Axthieb) statt eines Satzes je Waffe. Für Gegner ändert sich
  nichts — sie führen keine wählbaren Waffen.
- Jede neue Klasse braucht einen Clip **und** eine Zeile im Tor. Eine dritte Klasse wird erst
  eingeführt, wenn die zwei im Spiel getragen haben.
- Fortschritt über Ausrüstung (bessere Klinge, schwerere Axt) ist damit möglich und hängt an der
  offenen Frage aus ADR-0007, welche Währung Fangen und Mutationsstufen ersetzt.
