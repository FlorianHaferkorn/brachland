---
last-reviewed: 2026-08-16
shelf-life-days: 180
---
# BRACHLAND — Traversal v1

> Welche Bewegungen das Spiel braucht, in welcher Reihenfolge sie kommen, und warum
> jede einzelne existiert. Enshrouded diente als Vorlage für die Auswahl — **nicht**
> als Vorlage für die Menge.

## Der Maßstab ist das Problem

Œntal ist 3,97 × 4,01 km, 461 bis 1.144 m Höhe. Bei realistischem Tempo (1,4 m/s
gehen, 5 m/s rennen) ist eine Querung 13 Minuten Gehen — Wartezeit, kein Spiel.
Aktuell steht das Tempo deshalb auf 4,2 und 11,0 m/s, also **schneller als ein
Mensch laufen kann**. Das ist eine Notlösung und im Ledger als G-27 markiert.

**Traversal ist die richtige Lösung dafür.** Nicht schneller laufen, sondern anders
bewegen: klettern statt umrunden, gleiten statt absteigen, reiten statt gehen. Das
ist zugleich die Fortschrittskurve — jede Fähigkeit öffnet Gelände, das vorher zu
war, und das ersetzt unsichtbare Wände.

## Auswahl

Enshrouded hat: Springen, Klettern mit Ausdauer, Gleiter, Schwimmen und Tauchen,
Enterhaken, Sprinten, Ausweichrolle, Bauen. Davon übernehmen wir sechs und lassen
drei liegen.

### Übernommen

| Fähigkeit | Warum sie hier gebraucht wird | Aufwand |
|---|---|---|
| **Ausdauer** | Ohne Grenze ist jede andere Fähigkeit frei. Ausdauer ist nicht selbst eine Bewegung, sie ist der Preis aller anderen | klein |
| **Springen** | Ein 1-m-Absatz ist im 1:1-Maßstab überall. Ohne Sprung ist jede Geländestufe eine Wand | klein |
| **Klettern** | Das Œntal hat jetzt 4.031 Felswände. Klettern ist im Regionsdokument als Traversal von Kapitel 1 gesetzt — die Wände sind der Grund, warum es sie gibt | mittel |
| **Schwimmen** | 2.422 Wasserzellen, 190 Bachläufe. Ohne Schwimmen ist jeder Bach eine Grenze, und das Tal wird von seinem eigenen Fluss zerschnitten | mittel |
| **Reiten** | Die eigentliche Antwort auf die 4 km. Eine Reitkreatur macht aus dem Tempo eine **Spielentscheidung** statt einer Konstante — und passt zum Kern des Spiels: Man reitet, was man gefangen hat | groß |
| **Gleiten** | 680 Höhenmeter Gefälle. Ein Gleiter macht aus jedem Aufstieg eine Investition, die sich auszahlt. Der stärkste einzelne Freischaltmoment, den dieses Gelände hergibt | mittel |

### Nicht übernommen

- **Enterhaken** — überschneidet sich vollständig mit Klettern und Gleiten. Zwei
  Systeme für dieselbe Aufgabe sind eins zu viel.
- **Ausweichrolle** — es gibt keinen Echtzeitkampf. Eine Rolle ohne etwas zum
  Ausweichen ist eine Animation.
- **Bauen** — ein eigenes Spiel. Der Umfang ist bereits jetzt die größte Gefahr für
  das Projekt (ADR-0004).

### Zusätzlich, weil BRACHLAND es braucht

- **Sichere Rast** — kein Bewegungssystem, aber die Gegenprobe dazu: ein Ort, an dem
  Team und Ausdauer voll herstellen. Ohne Rastpunkte ist eine große Welt eine
  Zumutung, egal wie schnell man sich darin bewegt.

## Ausdauer als gemeinsame Währung

Eine Leiste, alles zahlt daraus:

| Handlung | Kosten |
|---|---|
| Rennen | 6 je Sekunde |
| Springen | 12 einmalig |
| Klettern | 9 je Sekunde |
| Schwimmen | 4 je Sekunde |
| Gleiten | 0 — Gleiten kostet Höhe, nicht Kraft |
| Reiten | 0 — die Kreatur trägt |

Voll bei 100, Erholung 14 je Sekunde nach 1,2 s Pause, an einer Rast sofort.
**Reiten und Gleiten kosten nichts** — das ist der Punkt: Beide Freischaltungen
nehmen dem Spieler die Ausdauergrenze für ihren jeweiligen Zweck ab, statt sie
billiger zu machen.

Die Zahlen sind ein erster Wurf. Sie gehören in einen Test wie die Fortschrittskurve:
Wie hoch kommt man mit einer Leiste, wie weit schwimmt man, wie lange rennt man.

## Reihenfolge und Freischaltung

| # | Fähigkeit | Freigeschaltet durch | Öffnet |
|---|---|---|---|
| 0 | Ausdauer, Springen | von Anfang an | Geländestufen bis 1,1 m |
| 1 | **Klettern** | Regent Œntal (Flussvater) besiegt | Felswände bis 14 m — also alle |
| 2 | **Schwimmen** | Kiemenbiber im Team | Bäche und Seen |
| 3 | **Reiten** | Grathorn oder Wurzelkeiler auf Mutation 2 | Tempo als Entscheidung |
| 4 | **Gleiten** | Kapitel 2 | Abstiege in einem Zug |

Punkt 2 ist die interessanteste Kopplung: **Die Fähigkeit hängt an einer Kreatur, die
man fangen muss.** Das verbindet Sammeln und Bewegung, statt beides nebeneinander
laufen zu lassen — und es gibt dem Kiemenbiber einen Zweck, obwohl er gegen den
Regenten nutzlos ist.

## Was technisch dranhängt

- **Kollision** kennt heute nur Zylinder und Rechtecke in der XZ-Ebene. Springen und
  Klettern brauchen eine Höhenkomponente — das ist die größte Einzeländerung.
- **Klettern** braucht eine Anfrage „ist hier eine Wand und wie steht sie", also
  einen Strahltest gegen die Klippen-Instanzen.
- **Schwimmen** braucht den Wasserstand an einer Position. Der Biomraster kennt
  Wasserzellen bereits; die Wasserhöhe liegt fest 6 cm über Grund und muss zu einer
  echten Oberfläche werden.
- **Reiten** ist vor allem Kamera und Kollisionsradius, nicht Animation.
- **Gleiten** braucht Fallgeschwindigkeit und Auftrieb — beides Physik, die es noch
  gar nicht gibt: Der Spieler klebt heute am Boden (`p.y = hoeheAufFlaeche`).

**Die Reihenfolge oben ist auch die technische:** Ohne Vertikalbewegung geht keins
der anderen. Der erste Schritt ist deshalb nicht „Springen", sondern
**Schwerkraft** — der Spieler muss überhaupt fallen können.
