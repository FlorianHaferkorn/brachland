---
last-reviewed: 2026-11-22
shelf-life-days: 180
---
# BRACHLAND — Traversal v2: Werkzeugweg statt Verbot

> **Ersetzt v1** (Versionsregel `_INDEX.md`) in Fortschrittslogik und Freischaltung. Grund: Flo hat am 22.11.2026
> entschieden (Ledger D374, Story-Bibel v2 §3): offene Welt, zu jedem Ziel zwei Wege — die Abkürzung mit einem neuen
> Werkzeug **oder** ein längerer, schwierigerer, beschwerlicher Weg ohne. Nichts ist gesperrt. v1 arbeitete mit
> „öffnet Gelände, das vorher zu war“. Entwurf vom 22.11.2026 (D388); offen/erledigt steht im Ledger (A-25), nicht hier.
> **Nichts davon ist gebaut** — Abschnitt 7 ist die Umsetzungsliste.

Koordinaten in Metern wie in `BRACHLAND_Enklave_Lage_v2.md` (Mitte 0/0 = Spielstart, x Osten, z Süden). Höhen aus
`public/world/oental.json`, Flutlinie 499 m aus `content/regions/oental.json` (`flutlinie`). Alle Strecken, Flüge und
Zeiten ohne andere Quellenangabe kommen aus `python3 tools/traversal_wege.py` (Messung am 10,4-m-Raster, Luftlinien).

## 1. Das Prinzip

| | v1 (16.08.2026) | v2 (D374) |
|---|---|---|
| Was eine Fähigkeit tut | öffnet Gelände, das vorher zu war | kürzt einen Weg ab, den es auch ohne sie gibt |
| Wie man sie bekommt | Freischaltung an Regent, Team, Mutation | Werkzeug, das in der Welt liegt oder gegeben wird (A-25.4) |
| Was ohne sie gilt | Sperre | Grundbewegung ab Start, teuer und kurz (Abschnitt 3) |
| Wer lenkt | die Reihenfolge der Freischaltungen | Gegnerstärke, Gelände, Wetter (weiche Tore, Bibel §3) |

**Prüfregel für jeden wichtigen Ort** (Regent, Reinkultur-Orte, Zufluchten, verborgene Orte): Er hat einen
Werkzeugweg und einen beschwerlichen Weg, und der beschwerliche ist ohne jedes Werkzeug gangbar. „Beschwerlich“
heißt länger, gefährlicher oder später — nicht Wartezeit. Harte Grenzen kommen nur aus der Welt: Flut,
Befallsgrenze über 1.000 m, Regionsübergänge (Bibel §3).

## 2. Was aus v1 weiter gilt

| v1 | Stand |
|---|---|
| Auswahl: Ausdauer, Springen, Klettern, Schwimmen, Reiten, Gleiten; sichere Rast | **gilt** |
| Enterhaken und Bauen nicht übernommen | **gilt** |
| Ausdauer als gemeinsame Währung; Gleiten und Reiten kosten keine | **gilt** — mit den Werten aus dem Code (Abschnitt 3), nicht denen der v1-Tabelle |
| Gleitverhältnis 3:1, Sinkrate 4,0 m/s, öffnet von selbst ab 3 m, kein eigener Knopf (Nachtrag 17.08.2026, D71) | **gilt** |
| „Gleiten ist eine Fähigkeit des Bergteils“ (unter +300 m fast kantenlos) | **gilt**, hier nachgemessen (Abschnitt 5b) |
| „Was technisch dranhängt“ | erledigt (G-41, G-44) |
| Tabelle „Reihenfolge und Freischaltung“ | **ersetzt** durch Abschnitt 4 |
| „jede Fähigkeit öffnet Gelände, das vorher zu war“ | **ersetzt** durch Abschnitt 1 |
| Schwimmen über „Kiemenbiber im Team“, Reiten über Mutation 2 | **entfällt** — Fangen, Team und Training gibt es nicht mehr (Bibel §2) |
| Ausweichrolle nicht übernommen („kein Echtzeitkampf“) | **überholt** durch ADR-0007 (Rolle ist Kampfregel) |
| Zahlen der Ausdauer-Tabelle (Rennen 6/s, Klettern 9/s, Schwimmen 4/s, Erholung 14/s) | **überholt** durch den Code (D55: Rennen zehrt nicht) |

## 3. Grundbewegung ab Start — der Stand im Code

Der beschwerliche Weg stützt sich auf das, was die Figur ohne Werkzeug kann. Befund: Klettern und Schwimmen sind im
Code **nicht** gesperrt; die v1-Freischaltungen dafür wurden nie gebaut. Gesperrt sind nur Gleiten und Reiten.

| Bewegung | Wert | Reichweite je Ausdauerleiste (100) | Sperre heute | Quelle |
|---|---|---|---|---|
| Gehen / Rennen | 4,2 / 11,0 m/s, zehrt nicht | — | keine | `src/spieler/tempo.ts`, D55 |
| Springen | 12 je Sprung, 1,49 m hoch | 8 Sprünge | keine | `src/spieler/ausdauer.ts`, `tempo.ts` |
| Klettern | 16/s bei 2,2 m/s, ab 40° Hang | **13,8 m Wand** — die höchsten Klippen messen 14 m | keine | `ausdauer.ts` `KLETTERN_JE_SEK`, `RegionsSzene.tsx` `KLETTERN_TEMPO` |
| Waten | ab 0,30 m Tiefe, 1,9 m/s, 7/s | 27 m | keine | `RegionsSzene.tsx` `WATEN_*` |
| Schwimmen | ab 1,35 m Tiefe, 1,6 m/s, 9/s | **17,8 m**, danach Treiben mit 0,72 m/s; man ertrinkt nicht | keine | `RegionsSzene.tsx` `SCHWIMMEN_*` |
| Tauchen | gibt es nicht | — | — | — |
| Gleiten | 12,0 m/s vorwärts, 4,0 m/s Sinken | — | **erst nach dem Regenten** | `src/spieler/gleiten.ts` `gleiterFrei` |
| Reiten | 7,5 / 17,0 m/s, bis 52° | — | **Vierbeiner ab Mutation 2 im Team** | `src/spiel/reiten.ts`, `src/main.tsx` |

Zwei Folgen:

- **Wasser ist langsam.** 1,6 m/s gegen 11,0 m/s Rennen: Ein Wasserweg ohne Werkzeug ist nie eine Abkürzung, und
  Treiben (0,72 m/s) ist Wartezeit. 380 m Querung dauern 8,6 Minuten.
- **Die Flut gibt es im Spiel nicht.** `flutlinie` ist nur Datum (Lage v2 §2); `wasserTiefe`
  (`src/world/wasserfeld.ts`) kennt Bäche und 11 Weiher. Alle Wasserwege unten setzen die Flut als Wasserfläche voraus.

## 4. Die Werkzeuge

Ein Werkzeug hebt die Grenze der Grundbewegung für seinen Zweck auf (v1: „nimmt die Ausdauergrenze ab, statt sie
billiger zu machen“). Fundorte sind **Vorschlag** (A-25.4), nach einer Regel: Jedes Werkzeug liegt am Ende eines
beschwerlichen Wegs in eine **andere** Richtung, keines beim Regenten.

### Tauchzeug (Schwimmen ohne Grenze, Tauchen)

| | |
|---|---|
| Kürzt ab | Flussvater durch die versunkene Stadt (D380); Kirchturm (447 m vom Ufer); Kapelle auf der Insel (380–396 m Querung); Fundstück im Absetzbecken ohne Erschöpfung |
| Ohne | Schwimmen 17,8 m je Leiste, danach Treiben. Reicht für Bäche und den Weiher (21 m), nicht für die Flut |
| Kosten ohne | Uferweg zum Flussvater 1.681 m mit drei Engstellen (D380); Kapelle und Kirchturm erst nach dem Wandel trocken (Abschnitt 5c) |
| Wo | **Vorschlag:** Schuppen am Nordufer (438 / −1243, 508 m), 641 m von der Enklave, am beschwerlichen Weg nach Nord |
| ⚠️ UNKLAR | Tempo. Der Wasserweg Abstieg → Wehr misst 1.586 m, über den Kirchturm 2.192 m — nicht kürzer als der Uferweg. „Wenige Minuten“ (D380) brauchen rund 6 m/s (264 s direkt, 365 s über den Turm) gegen 153 s reines Rennen am Ufer plus drei Kämpfe und Schlamm. Die Abkürzung liegt im Ausweichen, nicht in der Strecke; zu messen, sobald die Engstellen stehen |

### Kletterzeug (hohe Wände)

| | |
|---|---|
| Kürzt ab | Oberstollen: die Stufe unter dem Grat (−1031 / −47, 963 m) statt außen herum; allgemein jede Wand über der Grundreichweite |
| Ohne | Klettern ab Start in Grenzen (Bibel §3). **Vorschlag:** Grundwert 32/s = 6,9 m je Leiste, Kletterzeug = heutiger Wert 16/s = 13,8 m (A-25.5). Heute trägt eine Leiste fast jede Wand — das Werkzeug hätte nichts abzukürzen |
| Kosten ohne | alter Almweg (OSM-Pfad 5 m neben dem Mundloch): ab Enklave 2.097 m, 451 Höhenmeter (Lage v2 §1); Lawinenstrich (Bibel §4) |
| Wo | **Vorschlag:** Wart vom Bruch (167 / 540, 626 m), 1.309 m von der Enklave, 565 m vom Start — gegen einen Dienst, ⚠️ UNKLAR welchen |
| ⚠️ UNKLAR | Wandhöhen. Das Raster sieht keine Wände (Lage v2 §3.4); wie viele der 4.031 Klippen über 6,9 m liegen, ist nicht gemessen |

### Gleiter (Abstieg in einem Zug)

| | |
|---|---|
| Kürzt ab | Abstiege von den Westhängen: Almhütte → Absetzbecken 1.649 m, davon 1.553 m in einem Flug (129 s); Oberstollen → Start 1.032 m, 96 % in der Luft; Quelltopf → Saatkammer 2.152 m, längster Flug 1.462 m; Absprung Südwest (−896 / 916, 975 m) → Saatkammer 1.330 m |
| Ohne | Abstieg zu Fuß: Hänge über 40° sind Kletterstrecke (bergab wie bergauf), dazu der Umweg um Klippen. v1 misst 29,6 s Ersparnis im Median je Absprung |
| Kosten ohne | Zeit und Ausdauer, keine Gefahr — der Gleiter ist das Werkzeug der **Rückwege** (Bibel §3: „Rückwege werden zu Abkürzungen“) |
| Wo | **Vorschlag:** Almhütte (−1474 / −1415, 1.055 m), die höchste Zuflucht, 2.299 m von der Enklave — der Aufstieg zahlt sich mit dem ersten Flug aus |
| Nicht | von der Terrasse: höchstens 26 m über der Flutlinie, also höchstens 78 m Flug aufs Wasser (Abschnitt 5b) |

### Reittier (Tempo auf dem Weg)

| | |
|---|---|
| Kürzt ab | lange, flache Wege: Uferweg zur Saatkammer 1.856 m in 109 s statt 169 s Rennen (ohne Gegner gerechnet) |
| Ohne | Rennen 11,0 m/s. Das ist die Notlösung aus G-27 und bleibt, bis es Reiten wieder gibt |
| Kosten ohne | Zeit |
| Wo | ⚠️ UNKLAR. Bibel §2: „Bindung **eines** gereinigten Tieres“ — nicht entworfen. Kandidaten aus v1 (Grathorn, Wurzelkeiler) stehen als Verhärtete an Quelltopf und Jagdhütte (Lage v2 §1) |
| Stand | Im Code hängt Reiten am Team (`besteReittier` in `src/main.tsx`); ohne Team ist es unerreichbar |

### Sichere Rast

Kein Werkzeug, sondern die Gegenprobe (v1): neun Zufluchten in drei Ringen (Lage v2 §1). Auf dem Uferweg zum
Flussvater steht bewusst keine (D380).

## 5. Die drei Geländepunkte aus D375

### a) Reinkultur Nord: das Fundstück liegt im Wasser

Befund: `absetzbecken` (170 / −1534, 502 m) liegt auf der Sohle eines eigenen Weihers (62 × 71 m, 2,40 m tief), 30 m
vom Ufer, Auslöser 9 m (`content/fragmente/_INDEX.md`) — also **21 m Schwimmen**. Der Weiher liegt 2,5 m über der
Flutlinie; die Flut beginnt 29 m daneben (192 / −1554). Mit der Grundbewegung ist das heute schon zu erreichen:
17,8 m schwimmen, die letzten 3 m erschöpft treiben (4,4 s). „Ohne Werkzeug kein Weg“ (Lage v2 §3.3) galt nur gegen
die v1-Sperre, die nie gebaut wurde.

| | Weg | Länge | Preis |
|---|---|---|---|
| Beschwerlich | Hangweg über Feldscheune und Schuppen am Nordufer bis ans Ufer, dann in den Weiher | 1.082 m, 18 m Anstieg (Lage v2 §1) + 21 m Schwimmen | Ausdauer ist am Fundstück leer; wer dort angegriffen wird, treibt. Der Zähler steht am Ufer (150 / −1499) |
| Werkzeug | Tauchzeug: vom Abstieg an der Ostkante (851 / −700, 505 m) durch die Flut zum Nordufer, 29 m Land, Weiher | 1.079 m Wasser | kein Landgegner, keine Erschöpfung; nicht kürzer als der Hangweg — Tempo wie oben ⚠️ UNKLAR |

- **Empfehlung:** Schwimmen bleibt Grundbewegung in Grenzen, wie es im Code steht; das Fundstück bleibt auf dem Grund.
  Kein Datum und kein Code ändert sich. Der Weiher wird die Stelle, die Schwimmen lehrt.
- **Alternative:** Fundstück ans Ufer legen (`content/fragmente/absetzbecken.json` `ort`, Titel „Auf dem Grund“ und
  Text neu). Preis: Der einzige Ort, der Schwimmen vor der Flut einen Grund gibt, entfällt; Nord hätte dann gar keinen
  Werkzeugweg mehr, weil der Wasserweg nichts spart.

### b) Von der Hangterrasse gibt es kein Gleiten

Befund: Terrasse 505–525 m, Flutlinie 499 m → höchstens 78 m Flug, und der endet im Wasser. Die Saatkammer
(421 / 1104) liegt mit 601 m **über** der Terrasse. Von Enklave oder Start trägt nichts dorthin (2 % und 8 % der Strecke
in der Luft). Absprünge, die die Saatkammer erreichen, liegen alle am Südwesthang um −896 / 916 (975–996 m, knapp
unter der Befallsgrenze), 2.238 m von der Enklave. Die Zeile „Gleiten von der Terrasse“ (Bibel §4) gibt das Gelände
nicht her.

| | Weg | Länge | Preis |
|---|---|---|---|
| Beschwerlich | Uferweg über den Stadel am Hangweg (814 / 112, 519 m), dann bergauf | 1.856 m, 99 Höhenmeter (Lage v2 §1) | teilt den Anfang mit dem Weg zum Flussvater; ⚠️ UNKLAR, wie viele der drei Engstellen (D380) vor dem Abzweig liegen |
| Werkzeug | Gleiter vom Westhang: Absprung −896 / 916 (975 m) → Saatkammer | 1.330 m Flug, 111 s | nur für den, der oben ist — nach dem Oberstollen (970 m entfernt) oder dem Quelltopf (830 m) |

- **Empfehlung:** Gleiten ist das Werkzeug der Westhänge, nicht der Terrasse. Der Werkzeugweg nach Süd beginnt im
  Westen („erst West, dann nach Süd segeln“); von der Enklave aus bleibt der Uferweg. Das belohnt die Reihenfolge
  West → Süd, erzwingt sie aber nicht. Bibel §4 und Lage v2 §1 entsprechend umschreiben, sobald Flo zustimmt.
- **Alternative:** Reiten auf dem Uferweg als Werkzeugweg (so Lage v2 §1). Preis: derselbe Weg, nur 60 s schneller —
  kein zweiter Weg; und es hängt an der nicht entworfenen Bindung eines Tieres.

### c) Kapelle und Kirchturm stehen im Wasser

Befund: Der Kalkbruch-Rücken mit der Kapelle (1798 / 669, 525 m) ist bei 499 m eine Insel von 11,4 ha; kürzeste
Querung 380 m im Raster (Lage v2: 396 m, bis 9,9 m tief, kein Watweg). Der Kirchturm (1639 / −317, Grund 483 m, 15,6 m
unter der Flutlinie) liegt 447 m vom Festland (1238 / −120) und 354 m von der Insel. Ohne Werkzeug sind das heute 8,6
und 10,1 Minuten, fast alles Treiben, ohne jede Gefahr. Ein Dächerweg scheidet aus: Von 1.446 versunkenen Gebäuden
steht bei 227 die Traufe über Wasser, aber die längste Lücke bleibt 248 m (Kapelle) und 337 m (Kirchturm) — das
alte Flussbett ist unbebaut.

| | Weg | Länge | Preis |
|---|---|---|---|
| Werkzeug | Tauchzeug: vom Abstieg (851 / −700) zum Kirchturm 876 m, weiter zum Wehr 1.316 m; Kapelle über die Querung | 380–876 m Wasser | früh am verborgenen Ort und an der äußersten Zuflucht; der Kirchturm liegt auf dem Tauchweg zum Flussvater (D380) |
| Beschwerlich | **erst der Flussvater**: Uferweg (D380), Regent besiegen — das Wasser sinkt, Turm und Insel fallen trocken (Bibel §6.5, Lage v2 §1) | 1.681 m Uferweg + Kampf, danach zu Fuß | man kommt spät: Der Turm ist dann ein Fundort, kein Wasserort; die Kapelle ist als Zuflucht erst nach dem Regenten nutzbar |

- **Empfehlung:** Der beschwerliche Weg ist hier die **Zeit**: wer kein Tauchzeug hat, erreicht beide über den
  Flussvater. Braucht keine neue Mechanik außer dem Weltzustand „Wasser sinkt“, der ohnehin geplant ist. Die lange
  Querung ohne Werkzeug bleibt möglich, wird aber nicht als Weg gebaut.
- **Alternative:** Die Querung ohne Werkzeug zum Weg machen — Treiben kostet Leben oder Wassergegner (Kiemenbiber)
  jagen. Preis: neue Mechanik, und 9 Minuten Treiben bleiben Wartezeit (v1: „Wartezeit, kein Spiel“).

### Flussvater — übernommen aus D380, nicht neu aufgerollt

Uferweg (1.681 m, 10 m Anstieg, drei Engstellen, Schlamm, keine Zuflucht) ist der beschwerliche Weg; Tauchen durch
die versunkene Stadt am Kirchturm vorbei die Abkürzung. Offen ist nur das Tauchtempo (Abschnitt 4).

## 6. Zwei Wege je Ziel — Œntal im Überblick

| Ziel | x / z, Höhe | Werkzeugweg | Beschwerlicher Weg | Stand |
|---|---|---|---|---|
| Flussvater am Wehr | 1072 / 871, 499 m | Tauchzeug, 1.586–2.192 m | Uferweg 1.681 m, drei Engstellen | D380 |
| Reinkultur Nord `absetzbecken` | 170 / −1534, 502 m | Tauchzeug durch die Flut, 1.079 m | Hangweg 1.082 m + 21 m Schwimmen | A-25.1 |
| Reinkultur West `oberstollen` | −1031 / −47, 963 m | Kletterzeug: Stufe unter dem Grat | alter Almweg 2.097 m, 451 Hm | Lage v2; Grundwert A-25.5 |
| Reinkultur Süd `saatkammer` | 421 / 1104, 601 m | Gleiter vom Westhang, 1.330 m Flug | Uferweg 1.856 m, 99 Hm | A-25.2 |
| Kapelle über dem Kalkbruch (Zuflucht) | 1798 / 669, 525 m | Tauchzeug, 380 m Querung | nach dem Flussvater trocken | A-25.3 |
| Kirchturm im Wasser (verborgen) | 1639 / −317, 483 m | Tauchzeug, 447 m vom Ufer | nach dem Flussvater trocken | A-25.3 |
| Hütte im Bannwald (verborgen) | −746 / −649, 704 m | ⚠️ UNKLAR | zu Fuß durch den Westwald | nicht untersucht |
| Quelltopf (verborgen) | −1683 / 650, 971 m | ⚠️ UNKLAR (Kletterzeug am Bachlauf?) | dem Bachlauf folgen | nicht untersucht |

## 7. Umsetzungsliste (nichts gebaut)

In `content/` und im Schema hängt an Traversal nur `Region.traversal` (Œntal „Klettern“, Fahlmoos „Wasser“); die
Beschreibung des Felds ist auf v2 umgestellt (D388), der Wert wird von keinem Code gelesen. Alles Weitere braucht
Spielmechanik und ist deshalb hier Liste, nicht Änderung:

| # | Was | Wo | Hängt an |
|---|---|---|---|
| 1 | Flut als Wasserfläche: `wasserTiefe` kennt die Fläche unter `flutlinie` | `src/world/wasserfeld.ts`, Darstellung | ADR-0017, D375 |
| 2 | Werkzeuge als Inhalt: Gegenstand mit Wirkung „Werkzeug“, Besitz im Spielstand | `src/data/schema.ts` `GegenstandWirkung`, `content/gegenstaende/` | A-25.4 |
| 3 | Gleiten am Werkzeug statt am Regenten | `src/spieler/gleiten.ts` `gleiterFrei` | A-25.4 |
| 4 | Reiten ohne Team: Bindung eines gereinigten Tieres | `src/spiel/reiten.ts`, `src/main.tsx` | Entwurf fehlt (Bibel §2) |
| 5 | Tauchen: Bewegung unter Wasser, Tempo und Grenze als Daten | neu | D380, Tempo messen |
| 6 | Klettern: Grundwert und Werkzeugwert als Daten statt als Konstante | `src/spieler/ausdauer.ts` → `content/` | A-25.5; Wandhöhen messen |
| 7 | Uferweg: drei Engstellen, Schlamm, Einsturz | `content/`, Gelände | D380 |
| 8 | Weltzustand „Wasser sinkt“ nach dem Regenten | Spielstand, Wasserfläche | Bibel §6.5 |
| 9 | Zwei Wege als Datum je Ziel, von `validate` geprüft (jedes Ziel hat einen Weg ohne Werkzeug) | `Region`, `tools/validate.ts` | nach A-25 |
| 10 | Bibel §4 (Zeilen Nord und Süd) und Lage v2 §1 (Spalten Werkzeugweg) nachziehen | `docs/design/` | A-25.1, A-25.2 |

## 8. Messung

`python3 tools/traversal_wege.py` (numpy, nicht im Gate). Grenzen: Luftlinien am 10,4-m-Raster; Klippen sind
Instanzen und fehlen darin; Gleitflug als Gerade ohne Steuern („gehen, wo der Boden höher liegt als die Flugbahn“);
Dachhöhe = Grund + Ebenen × 3 m (`METER_JE_EBENE`, `src/world/terrain.ts`). Nichts davon ist im Spiel gegangen,
geschwommen oder geflogen worden.
