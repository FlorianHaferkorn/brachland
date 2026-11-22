---
last-reviewed: 2026-11-22
shelf-life-days: 180
---
# BRACHLAND — Traversal v2: Werkzeugweg statt Verbot

> **Ersetzt v1** (Versionsregel `_INDEX.md`) in Fortschrittslogik und Freischaltung. Grund: Flo hat am 22.11.2026
> entschieden (Ledger D374, Story-Bibel v2 §3): offene Welt, zu jedem Ziel zwei Wege — die Abkürzung mit einem neuen
> Werkzeug **oder** ein längerer, schwierigerer, beschwerlicher Weg ohne. Nichts ist gesperrt. v1 arbeitete mit
> „öffnet Gelände, das vorher zu war“. Entwurf vom 22.11.2026 (D388); Flo hat die fünf Fragen dazu am selben Tag
> entschieden (A-25, D391) — Abschnitt 5 und 6 gelten. Offen/erledigt steht im Ledger, nicht hier.
> **Nichts davon ist gebaut** — Abschnitt 8 ist die Umsetzungsliste.

Koordinaten in Metern wie in `BRACHLAND_Enklave_Lage_v2.md` (Mitte 0/0 = Spielstart, x Osten, z Süden). Höhen aus
`public/world/oental.json`, Flutlinie 499 m aus `content/regions/oental.json` (`flutlinie`). Alle Strecken, Flüge und
Zeiten ohne andere Quellenangabe kommen aus `python3 tools/traversal_wege.py` (Messung am 10,4-m-Raster, Luftlinien).

## 1. Das Prinzip

| | v1 (16.08.2026) | v2 (D374) |
|---|---|---|
| Was eine Fähigkeit tut | öffnet Gelände, das vorher zu war | kürzt einen Weg ab, den es auch ohne sie gibt |
| Wie man sie bekommt | Freischaltung an Regent, Team, Mutation | Werkzeug, das in der Welt hinter einem optionalen Boss, einem Rätsel oder einer Nebenaufgabe liegt (D391, Abschnitt 5) |
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
| „Gleiten ist eine Fähigkeit des Bergteils“ (unter +300 m fast kantenlos) | **gilt**, hier nachgemessen (Abschnitt 6b) |
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
billiger zu machen“). Keines liegt beim Regenten; wie man jedes bekommt, steht in Abschnitt 5 (D391).

### Tauchzeug (Schwimmen ohne Grenze, Tauchen)

| | |
|---|---|
| Kürzt ab | Flussvater durch die versunkene Stadt (D380); Kirchturm (447 m vom Ufer); Kapelle auf der Insel (380–396 m Querung); Fundstück im Absetzbecken ohne Erschöpfung |
| Ohne | Schwimmen 17,8 m je Leiste, danach Treiben. Reicht für Bäche und den Weiher (21 m), nicht für die Flut |
| Kosten ohne | Uferweg zum Flussvater 1.681 m mit drei Engstellen (D380); Kapelle und Kirchturm erst nach dem Wandel trocken (Abschnitt 6c) |
| Wo | Schuppen am Nordufer (438 / −1243, 508 m), hinter einem Rätsel — Abschnitt 5 |
| ⚠️ UNKLAR | Tempo. Der Wasserweg Abstieg → Wehr misst 1.586 m, über den Kirchturm 2.192 m — nicht kürzer als der Uferweg. „Wenige Minuten“ (D380) brauchen rund 6 m/s (264 s direkt, 365 s über den Turm) gegen 153 s reines Rennen am Ufer plus drei Kämpfe und Schlamm. Die Abkürzung liegt im Ausweichen, nicht in der Strecke; zu messen, sobald die Engstellen stehen |

### Kletterzeug (hohe Wände)

| | |
|---|---|
| Kürzt ab | Oberstollen: die Stufe unter dem Grat (−1031 / −47, 963 m) statt außen herum; allgemein jede Wand über der Grundreichweite |
| Ohne | Klettern ab Start in Grenzen (Bibel §3). **Entschieden (D391):** Grundwert halbiert (32/s = 6,9 m je Leiste), Kletterzeug bringt den heutigen Wert (16/s = 13,8 m) — im Code erst nach Messung der Wandhöhen. Heute trägt eine Leiste fast jede Wand |
| Kosten ohne | alter Almweg (OSM-Pfad 5 m neben dem Mundloch): ab Enklave 2.097 m, 451 Höhenmeter (Lage v2 §1); Lawinenstrich (Bibel §4) |
| Wo | Stollenmund (−255 / 292, 693 m), über eine Nebenaufgabe des Warts vom Bruch — Abschnitt 5 |
| ⚠️ UNKLAR | Wandhöhen. Das Raster sieht keine Wände (Lage v2 §3.4); wie viele der 4.031 Klippen über 6,9 m liegen, ist nicht gemessen |

### Gleiter (Abstieg in einem Zug)

| | |
|---|---|
| Kürzt ab | Abstiege von den Westhängen: Almhütte → Absetzbecken 1.649 m, davon 1.553 m in einem Flug (129 s); Oberstollen → Start 1.032 m, 96 % in der Luft; Quelltopf → Saatkammer 2.152 m, längster Flug 1.462 m; Absprung Südwest (−896 / 916, 975 m) → Saatkammer 1.330 m |
| Ohne | Abstieg zu Fuß: Hänge über 40° sind Kletterstrecke (bergab wie bergauf), dazu der Umweg um Klippen. v1 misst 29,6 s Ersparnis im Median je Absprung |
| Kosten ohne | Zeit und Ausdauer, keine Gefahr — der Gleiter ist das Werkzeug der **Rückwege** (Bibel §3: „Rückwege werden zu Abkürzungen“) |
| Wo | Quelltopf (−1683 / 650, 971 m), bei einem optionalen Boss — Abschnitt 5 |
| Nicht | von der Terrasse: höchstens 26 m über der Flutlinie, also höchstens 78 m Flug aufs Wasser (Abschnitt 6b) |

### Reittier (Tempo auf dem Weg)

| | |
|---|---|
| Kürzt ab | lange, flache Wege: Uferweg zur Saatkammer 1.856 m in 109 s statt 169 s Rennen (ohne Gegner gerechnet) |
| Ohne | Rennen 11,0 m/s. Das ist die Notlösung aus G-27 und bleibt, bis es Reiten wieder gibt |
| Kosten ohne | Zeit |
| Wo | Förster (401 / −813), Nebenaufgabe über Reinigen; gebunden wird **ein** gereinigter Vierbeiner (Bibel §2) — Abschnitt 5 |
| Stand | Im Code hängt Reiten am Team (`besteReittier` in `src/main.tsx`); ohne Team ist es unerreichbar |

### Sichere Rast

Kein Werkzeug, sondern die Gegenprobe (v1): neun Zufluchten in drei Ringen (Lage v2 §1). Auf dem Uferweg zum
Flussvater steht bewusst keine (D380).

## 5. Wie man die Werkzeuge bekommt (D391)

Flo, 22.11.2026: „werkzeuge gerne hinter optionalen Bossen oder Puzzlen oder Sidequests verbergen also mehr in die
Welt einbinden und bauen als stumpf platzieren“. Je Werkzeug ein Entwurf. Bedingung: Jedes Versteck ist ohne ein
anderes Werkzeug erreichbar, und keines setzt ein anderes voraus.

| Werkzeug | Art | Ort | Beteiligt (Bestand) |
|---|---|---|---|
| Tauchzeug | **Rätsel** | Schuppen am Nordufer (438 / −1243, 508 m) und Tafel im Absetzbecken (170 / −1534, 502 m) | Wirt (`was-der-tresen-weiss`), Zähler am Ufer (150 / −1499) |
| Kletterzeug | **Nebenaufgabe** mit Menschen | Wart vom Bruch (167 / 540, 626 m) → Stollenmund (−255 / 292, 693 m) | Wart, Lager „Klinge am Bruchweg“ (`lager-bruchweg`, 222 / 580: Wegelagerer + Wolf) |
| Gleiter | **optionaler Boss** | Quelltopf (−1683 / 650, 971 m), verborgener Ort | verhärtetes Grathorn (`verborgeneOrte` `quelltopf`) |
| Reittier | **Nebenaufgabe** über Reinigen | Förster (401 / −813, 566 m), Hangwald | Förster (`bis-zur-kante` als Vorauftrag), Wurzelkeiler |

### Tauchzeug — das Boot kieloben (Rätsel)

1. Der Hangweg nach Nord führt über die Zuflucht Schuppen am Nordufer. Ihr Text steht schon: ein Boot kieloben, das
   Pech frisch, „wer es gestrichen hat, ist nicht zurückgekommen“. Neu: unter dem Boot ein Werksspind mit Zahlenschloss.
2. Am Absetzbecken steht der Zähler bis zu den Knien im Wasser („Was Sie auf dem Grund finden, gehört nicht der
   Terrasse“). 21 m hinausschwimmen, erschöpft ankommen, die Tafel lesen (`absetzbecken`).
3. Die Tafel trägt die Zahl: „FREIGABE ERFOLGT SELBSTTÄTIG AB 09/41“, nachträglich überschlagen. 0941 öffnet den Spind.
4. Im Spind: Atemgerät der Klärwerkswartung, eine Leine, ein Zettel mit derselben Zahl in anderer Handschrift.

- **Erzählt:** Vor dem Brachgänger wollte schon jemand aus Brannburg hinunter und hat sich die Zahl geholt, bevor er
  das Gerät hatte. Und: Die Freigabe war datiert und selbsttätig — erster Hinweis, dass der Faulbrand ein Protokoll ist.
- **Wie man darauf stößt:** Der Auftrag des Wirts schickt nach Nord, der Hangweg läuft über den Schuppen; der Spind
  steht im Raum, in dem man rastet. Die Zahl liest man nur, wenn man schwimmt. Niemand sagt, dass beides zusammengehört.
- **Alternative:** Nebenaufgabe der Pegelwartin am Pegel unter der Terrasse (889 / −653) — bindet das Werkzeug an die
  Enklave-Figur, braucht aber Aufträge für Wanderfiguren (gibt es nicht) und liegt 190 m vom Wirt, also ohne Weg.

### Kletterzeug — was noch drin liegt (Nebenaufgabe)

1. Fundstück `stollenmund`, 389 m Fußweg vom Start: „Sie haben den Stollen zugemauert … Die Werkzeuge liegen noch drin.“
2. Der Wart gibt den Auftrag `was-noch-drin-liegt`: Geschirr, Seil und Eisen liegen hinter der Mauer. Die Stange für
   den Schlussstein hat sein früherer Vorarbeiter — die „Klinge am Bruchweg“, 70 m neben ihm.
3. Am Lager: ein Mensch und ein Wolf. Der Wolf ist reinigbar, der Mensch nicht (D385): Haltung brechen, dann töten,
   vertreiben oder verschonen. Verschont gibt er die Stange und sagt, warum sie zugemauert haben.
4. Mauer am Stollenmund öffnen: das Kletterzeug. Der Stollen dahinter ist kurz und leer.

- **Erzählt:** Die Überlebenden haben vierzehn Jahre Kalk gebrochen und dann selbst aufgehört — „wer zumauert, will
  nicht wiederkommen“. Der erste Gegner, der nicht befallen ist, ist ein Nachbar. Was man mit ihm macht, zählt (Bibel §5).
- **Wie man darauf stößt:** der Fundtext auf der Lehrstrecke; der Satz des Warts im West-Auftrag („Den unteren Stollen
  haben wir zugemauert“); das Lagerfeuer ist zu hören (`src/ton/lagerton.ts`), bevor man es sieht.
- **Alternative:** reines Rätsel an der Mauer (ein Stein sitzt anders, kein Wart) — spart den Menschenkampf, verliert
  aber die einzige frühe Stelle, an der „Menschen sind nicht reinigbar“ gespielt statt erklärt wird.

Beschwerlich ist hier der Kampf zu zweit, nicht die Strecke: Das Versteck liegt früh. Das passt zu „Klettern ab Start
in Grenzen“ (Bibel §3) und gibt der Lehrstrecke (D381) eine Abzweigung.

### Gleiter — das Tuch am Quelltopf (optionaler Boss)

1. Dem Bach im Südwesten bis zur Quelle folgen (Spur des verborgenen Orts, Lage v2): 1.959 m Fußweg vom Start, 343 m
   Anstieg, knapp unter der Befallsgrenze.
2. Bachaufwärts hängen Leinen und Tuchfetzen im Geäst, mit jedem Absatz mehr.
3. Am Quelltopf steht ein verhärtetes Grathorn. In Geweih und Pilzfächer ist ein Gleitschirm eingewachsen; es trägt
   ihn wie einen Mantel.
4. Niederringen. **Reinigen** (Verhärtete nur mit einer Reinkultur, `BRACHLAND_Reinigen_v1.md`): Das Tier lässt den
   Schirm los und bleibt als reines Tier an der Quelle. **Töten** geht ohne Reinkultur; den Schirm schneidet man heraus.
5. Erster Flug vom Absprung 830 m weiter (−896 / 916, 975 m): 1.330 m bis zur Saatkammer.

- **Erzählt:** Jemand wollte über die Grenze hinausfliegen und kam bis zur Quelle. Der Befall nimmt auf, was Menschen
  liegen lassen. Der Becher am Rand (`quelltopf`) liegt noch mit der Öffnung nach unten.
- **Wie man darauf stößt:** nur über Gelände und Spur — kein Auftrag, kein Bewohner nennt den Ort (`validate` verbietet
  es für verborgene Orte). Wer den Almweg zum Oberstollen geht, kreuzt den Bach.
- **Alternative:** Almhütte (−1474 / −1415, 1.055 m) hinter dem Lager „Zwei am Almsteig“ (`lager-almsteig`) — Bestand,
  kein neuer Gegner, aber ein zweiter Menschenkampf und kein reinigbarer Boss.

Der Gleiter liegt damit auf dem Weg, den A-25.2 vorsieht: erst West, dann nach Süd segeln.

### Reittier — ein schwieriger Nachbar (Nebenaufgabe über Reinigen)

1. Der Förster redet abends vom Wald „als wäre der ein schwieriger Nachbar“. Sein erster Auftrag `bis-zur-kante`
   schickt zum Felsband (−784 / 474, 853 m; 984 m Fußweg vom Start).
2. Danach `ein-schwieriger-nachbar`: Drei Wurzelkeiler reißen auf, was er setzt. Er will sie nicht geschossen haben.
   Drei reinigen — der Keiler ist der zäheste Fall der Messreihe (+49 % Kampfdauer, Reinigen v1).
3. Gereinigte Tiere bleiben im Revier (Bibel §2). Der Förster gibt ein Halfter aus dem Stall und zeigt den Griff.
4. Bindung: Ein gereinigter Vierbeiner, der im Revier geblieben ist, lässt sich mit dem Halfter binden — **einer**,
   Wechsel löst die alte Bindung. Getötete tragen niemanden.

- **Erzählt:** Heilen zahlt sich aus, aber es bleibt ein Eingriff: Der Zähler zählt die drei Keiler mit (D385). Der
  Förster ist der Einzige auf der Terrasse, der mit dem Wald lebt statt gegen ihn.
- **Wie man darauf stößt:** der Förster wohnt abseits (334 m vom Wirt, 366 m Fußweg); aufgerissene Setzlinge und
  Suhlen im Hangwald; ein gereinigter Keiler läuft nicht weg, wenn man kommt.
- **Alternative:** Boss — der verhärtete Wurzelkeiler an der Hütte im Bannwald (−746 / −649) wird gereinigt zum
  Reittier; stärkeres Bild, kostet aber eine Reinkultur und ist verloren, wenn man ihn tötet.

### Keine Kette: jedes Versteck ohne anderes Werkzeug

Fußweg = kürzester Weg im Raster ohne einen Schritt über 40° und ohne Zelle unter der Flutlinie
(`tools/traversal_wege.py`, Teil 4).

| Werkzeug | Versteck | Fußweg ab Start / ab Enklave | Wasser | Wand | Flug | Beschwerlich woran |
|---|---|---|---|---|---|---|
| Tauchzeug | Schuppen am Nordufer; Tafel im Absetzbecken | 1.424 / 693 m; 1.606 / 1.096 m | 21 m mit der Grundbewegung (17,8 m + 3 m Treiben) | nein | nein | Hangweg, erschöpft im Wasser |
| Kletterzeug | Stollenmund; Wart; Lager am Bruchweg | 389 / 1.346 m; 602 / 1.410 m | nein | nein | nein | Kampf gegen Mensch und Wolf |
| Gleiter | Quelltopf | 1.959 / 2.929 m, 971 m hoch | nein | im Raster nein ⚠️ | nein | längster Anstieg der Region, Verhärteter |
| Reittier | Förster; Felsband; Hangwald | 978 / 366 m; 984 / 1.953 m | nein | nein | nein | Auftragskette, drei Keiler reinigen |

⚠️ UNKLAR: Das Raster sieht keine Klippen. Ob der Bachlauf zum Quelltopf eine Wand über 6,9 m quert (Grundwert nach
A-25.5), zeigt erst die Messung der Wandhöhen — dieselbe, an der der Klettern-Grundwert hängt.

**Nicht gebaut.** Als Daten vorbereitet sind nur die zwei Aufträge (`was-noch-drin-liegt`, `ein-schwieriger-nachbar`)
mit Platzhalter-Belohnung, weil es den Gegenstand „Werkzeug“ noch nicht gibt (Abschnitt 8).

## 6. Die drei Geländepunkte aus D375

Flo hat am 22.11.2026 alle drei Empfehlungen bestätigt (A-25.1–3, D391); die Alternativen bleiben als Beleg stehen.

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

- **Entschieden (D391), wie empfohlen:** Schwimmen bleibt Grundbewegung in Grenzen, wie es im Code steht; das Fundstück bleibt auf dem Grund.
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

- **Entschieden (D391), wie empfohlen:** Gleiten ist das Werkzeug der Westhänge, nicht der Terrasse. Der Werkzeugweg nach Süd beginnt im
  Westen („erst West, dann nach Süd segeln“); von der Enklave aus bleibt der Uferweg. Das belohnt die Reihenfolge
  West → Süd, erzwingt sie aber nicht. Bibel §4 und Lage v2 §1 sind nachgezogen.
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

- **Entschieden (D391), wie empfohlen:** Der beschwerliche Weg ist hier die **Zeit**: wer kein Tauchzeug hat, erreicht beide über den
  Flussvater. Braucht keine neue Mechanik außer dem Weltzustand „Wasser sinkt“, der ohnehin geplant ist. Die lange
  Querung ohne Werkzeug bleibt möglich, wird aber nicht als Weg gebaut.
- **Alternative:** Die Querung ohne Werkzeug zum Weg machen — Treiben kostet Leben oder Wassergegner (Kiemenbiber)
  jagen. Preis: neue Mechanik, und 9 Minuten Treiben bleiben Wartezeit (v1: „Wartezeit, kein Spiel“).

### Flussvater — übernommen aus D380, nicht neu aufgerollt

Uferweg (1.681 m, 10 m Anstieg, drei Engstellen, Schlamm, keine Zuflucht) ist der beschwerliche Weg; Tauchen durch
die versunkene Stadt am Kirchturm vorbei die Abkürzung. Offen ist nur das Tauchtempo (Abschnitt 4).

## 7. Zwei Wege je Ziel — Œntal im Überblick

| Ziel | x / z, Höhe | Werkzeugweg | Beschwerlicher Weg | Stand |
|---|---|---|---|---|
| Flussvater am Wehr | 1072 / 871, 499 m | Tauchzeug, 1.586–2.192 m | Uferweg 1.681 m, drei Engstellen | D380 |
| Reinkultur Nord `absetzbecken` | 170 / −1534, 502 m | Tauchzeug durch die Flut, 1.079 m | Hangweg 1.082 m + 21 m Schwimmen | D391 |
| Reinkultur West `oberstollen` | −1031 / −47, 963 m | Kletterzeug: Stufe unter dem Grat | alter Almweg 2.097 m, 451 Hm | D391; Grundwert erst nach Messung |
| Reinkultur Süd `saatkammer` | 421 / 1104, 601 m | Gleiter vom Westhang, 1.330 m Flug | Uferweg 1.856 m, 99 Hm | D391 |
| Kapelle über dem Kalkbruch (Zuflucht) | 1798 / 669, 525 m | Tauchzeug, 380 m Querung | nach dem Flussvater trocken | D391 |
| Kirchturm im Wasser (verborgen) | 1639 / −317, 483 m | Tauchzeug, 447 m vom Ufer | nach dem Flussvater trocken | D391 |
| Hütte im Bannwald (verborgen) | −746 / −649, 704 m | ⚠️ UNKLAR | zu Fuß durch den Westwald | nicht untersucht |
| Quelltopf (verborgen) | −1683 / 650, 971 m | keiner — hier liegt der Gleiter (Abschnitt 5) | dem Bachlauf folgen, 1.959 m Fußweg ab Start | D391 |

## 8. Umsetzungsliste (nichts gebaut)

In `content/` und im Schema hängt an Traversal nur `Region.traversal` (Œntal „Klettern“, Fahlmoos „Wasser“); die
Beschreibung des Felds ist auf v2 umgestellt (D388), der Wert wird von keinem Code gelesen. Alles Weitere braucht
Spielmechanik und ist deshalb hier Liste, nicht Änderung:

| # | Was | Wo | Hängt an |
|---|---|---|---|
| 1 | Flut als Wasserfläche: `wasserTiefe` kennt die Fläche unter `flutlinie` | `src/world/wasserfeld.ts`, Darstellung | ADR-0017, D375 |
| 2 | Werkzeuge als Inhalt: Gegenstand mit Wirkung „Werkzeug“, Besitz im Spielstand | `src/data/schema.ts` `GegenstandWirkung`, `content/gegenstaende/` | D391; danach die Platzhalter-Belohnungen der zwei Aufträge ersetzen |
| 3 | Gleiten am Werkzeug statt am Regenten | `src/spieler/gleiten.ts` `gleiterFrei` | D391 |
| 4 | Reiten ohne Team: Bindung eines gereinigten Vierbeiners mit dem Halfter (Abschnitt 5) | `src/spiel/reiten.ts`, `src/main.tsx` | Kampfhandlung Reinigen im Spiel (D379) |
| 5 | Tauchen: Bewegung unter Wasser, Tempo und Grenze als Daten | neu | D380, Tempo messen |
| 6 | Klettern: Grundwert und Werkzeugwert als Daten statt als Konstante | `src/spieler/ausdauer.ts` → `content/` | D391: **erst** Wandhöhen der 4.031 Klippen messen, dann 32/s und 16/s setzen |
| 7 | Uferweg: drei Engstellen, Schlamm, Einsturz | `content/`, Gelände | D380 |
| 8 | Weltzustand „Wasser sinkt“ nach dem Regenten | Spielstand, Wasserfläche | Bibel §6.5 |
| 9 | Zwei Wege als Datum je Ziel, von `validate` geprüft (jedes Ziel hat einen Weg ohne Werkzeug) | `Region`, `tools/validate.ts` | — |
| 10 | ~~Bibel §4 und Lage v2 §1 nachziehen~~ | `docs/design/` | erledigt (D391) |
| 11 | Rätsel Tauchzeug: Spind am Schuppen, öffnet, wenn `absetzbecken` gelesen ist (Bedingung wie `Wanderfigur.bis`) | `content/orte/`, Ortsfenster | 2 |
| 12 | Kletterzeug: Auftragsziel „Lager bezwungen“; Aufgabe/Flucht menschlicher Gegner (D385); Mauer am Stollenmund als Ding, das sich öffnet | `Auftragsziel`, `src/kampf/echtzeit.ts`, `src/main.tsx` `lager-bruchweg` | 2 |
| 13 | Gleiter: Gegnerwerte für Verhärtete (Bedarf: **verhärtetes Grathorn**), Verhärtete an den verborgenen Orten aufstellen, Spur am Bach | `content/gegner/`, `Region.verborgeneOrte` | 2, Reinigen im Spiel |
| 14 | Zählweise `reinige`: zählt bis zur Kampfhandlung das alte Aufnehmen (Lage v2 §2) — `ein-schwieriger-nachbar` ist erst danach, was er sagt | `src/spiel/auftraege.ts` | D379 |

## 9. Messung

`python3 tools/traversal_wege.py` (numpy, nicht im Gate). Grenzen: Luftlinien am 10,4-m-Raster; Klippen sind
Instanzen und fehlen darin; Gleitflug als Gerade ohne Steuern („gehen, wo der Boden höher liegt als die Flugbahn“);
Dachhöhe = Grund + Ebenen × 3 m (`METER_JE_EBENE`, `src/world/terrain.ts`). Nichts davon ist im Spiel gegangen,
geschwommen oder geflogen worden.
