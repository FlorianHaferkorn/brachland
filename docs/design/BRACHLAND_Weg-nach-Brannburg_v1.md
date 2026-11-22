---
last-reviewed: 2026-11-22
shelf-life-days: 90
---
# BRACHLAND — Der Weg nach Brannburg v1 (Lehrstrecke, D390)

> Entwurf mit Daten zu Story-Bibel v2 §6 Schritt 0 (D381): Das Spiel beginnt draussen, man kämpft sich zur Enklave
> durch, und dieser Weg ist die Lehrstrecke — ohne Texttafeln, die Welt lehrt. Die Strecke liegt als Datensatz in
> `content/strecken/weg-nach-brannburg.json` (Schema `Strecke`). **Nicht gebaut:** Das Spiel liest sie nicht; kein
> Gegner steht, der Spielbeginn ist nicht umgestellt. Offen/erledigt steht im Ledger (`docs/_INDEX.md` A-25), nicht hier.
> Nichts davon am M1 gesehen oder gespielt; alle Kampfzahlen sind Bot-Messung.

Weltkoordinaten wie in `BRACHLAND_Enklave_Lage_v2.md`: Meter, Regionsmitte 0/0, x nach Osten, z nach Süden (negatives
z = Norden). Höhen bilinear aus dem Raster `public/world/oental.json` (384 × 384, 10,4 m je Zelle), Wege aus
`welt.wege` (OSM). „Wegmeter“ zählt entlang des kürzesten Weges über das Wegenetz ab 0/0.

## 1. Startpunkt

**Regionsmitte, 0 / 0, 629 m** (47,73300 / 12,08150), Wiese, nächste Wand 84 m entfernt. Blick −77° (Ost-Nordost).

| Warum hier | Beleg |
|---|---|
| D381 nennt die Regionsmitte | Ledger D381: „Start bleibt draussen im Brachland (Regionsmitte, ~1 km zur Enklave)“ |
| Es ist nichts umzustellen | `LEERER_STAND.position` ist `[0, 0]` (`src/spiel/spielstand.ts`); Lastmessungen (`tools/lastcheck.ts`, `aufsatzcheck.ts`, `scenecheck.ts`) und die 900-m-Regel der Reinkulturen (`tools/validate.ts`) stehen an 0/0 |
| Es geht bergab ins Bild | 629 m am Start, 514 m am Wirt: 116 m Gefälle auf 957 m Luftlinie |
| Man sieht, worum es geht | Sichtlinie im Raster (Auge 1,7 m) auf den gefluteten Talboden bei 1300 / −300 ist frei (+1,8 m) |
| Der Bestand um 0/0 liegt in der Gegenrichtung | Unterstand (88 m), Tremmel (465 m), Wart (565 m), zwei Wegelager, `silo-hof`, `stollenmund` liegen südlich und westlich; die Strecke geht nach Nordosten |

**Was man vom Start nicht sieht:** die Terrasse selbst. Eine Kuppe bei 51 / −48 verdeckt sie um 4,5 m (Raster, ohne
Bäume und Häuser). Deshalb führt das erste Bild über **Rauch** (§3, Station 1), nicht über Dächer; Dächer sieht man
erst ab den Höfen (+2,0 m) und am besten von der Oberkante des Steigs (+3,9 m).

`start` steht als vorbereitetes Feld in der Strecke. Der wirksame Spielbeginn bleibt die Konstante im Code; weil
beide auf 0/0 liegen, ändert die spätere Umstellung nur den Blick (A-25.1).

## 2. Route

Kürzester Weg über das OSM-Wegenetz von 0/0 zum Wirt (696 / −657), nur Knoten über der Flutlinie: **1.329 m**, davon
**1.182 m bis zur Magd** am Westrand der Enklave. 11 m Anstieg, 127 m Abstieg; tiefster Punkt 513 m (Wirt), an der Furt
529 m — die Strecke bleibt überall mindestens 13 m über der Flutlinie (499 m).

| Wegmeter | Abschnitt | Wegart (OSM) | Höhe | Gelände |
|---|---|---|---|---|
| 0–297 | Fahrweg nach Osten, an zwei Höfen vorbei | `service` | 629 → 601 | Wiese, 9 % Gefälle |
| 297–514 | **Der Steig**: Fussweg durch eine Hangstufe | `footway` | 601 → 557 | im Raster 24–35° quer zum Weg, Wegstücke mit 21–45 % Gefälle |
| 514–664 | Fahrweg am Hangfuss, Remise, Gabelung an der Halle | `service`, `unclassified` | 557 → 550 | Wiese, eben |
| 664–793 | Zufahrt südlich um die Halle | `service` | 550 → 542 | Wiese |
| 793–1.060 | Fussweg nach Norden, **Furt** bei 939 m, erste Häuser ab 1.040 m | `footway` | 542 → 529 → 532 | Bachgraben (Bach 502 / −341 → 578 / −382), 17 % zum Bach hinunter |
| 1.060–1.329 | Wohnstrasse in die Enklave: Magd bei 1.182 m, Saal und Wirt bei 1.316–1.329 m | `residential` | 530 → 513 | Siedlung |

**Gehzeit** (Tempi aus `src/spieler/tempo.ts`): bis zur Magd 4,7 min im Gehen (4,2 m/s), 1,8 min im Rennen (11 m/s),
ohne Ausdauerpausen gerechnet. Kämpfe nach Bot (§4): 106 s, wenn alles getötet, 141 s, wenn alles gereinigt wird.
Erster Durchgang mit Lesen, Sterben und Umsehen geschätzt 15–25 min — **Annahme, nicht gemessen**.

**Der zweite Weg.** An der Halle (664 m) teilt sich der Weg. Der Fahrweg nach Osten und ums Nordende der Terrasse
ist 1.527 m lang (242 m mehr), fast eben, und endet 90 m vor der Schmiedin (765 / −259). Er ist ohne Station.

## 3. Stationen

Acht Stationen (`stationen` in der Strecke). Reihenfolge nach D381: Bewegung → erster Kampf → erstes Reinigen → erste
Zuflucht → harter Gegner vor dem Tor.

| # | Station | Wegmeter | x / z | Höhe | lernt | Gegner | erzählt |
|---|---|---|---|---|---|---|---|
| 1 | Am Talweg (`aufbruch`) | 0 | 0 / 0 | 629 | Bewegen, Kamera | – | Bild |
| 2 | Zwei Höfe am Fahrweg (`hof-am-fahrweg`) | 237 | 185 / 43 | 609 | leichter Angriff, Ausdauer | 1 Fuchs | Fundstück `hoftor-fahrweg` |
| 3 | Im Steig (`steig`) | 401 | 286 / −66 | 586 | Rolle | 1 Keiler | Bild |
| 4 | Unter dem Steig (`steigfuss`) | 514 | 354 / −118 | 557 | Reinigen mit der Marke | 1 Keiler | Bild |
| 5 | Remise am Steig (`remise`) | 560 | 366 / −163 | 558 | Rast, Zuflucht | – | Zuflucht `remise-am-steig`, Bild |
| 6 | Halle an der Gabelung (`halle`) | 664 | 470 / −156 | 550 | Lock-On (Zielwechsel) | 2 Füchse | Fundstück `halle-gabelung` |
| 7 | An der Furt (`furt`) | 915 | 569 / −358 | 532 | Richtungsblock, Parade | 1 Wolf | Fundstück `steg-an-der-furt` |
| 8 | Vor dem ersten Haus (`tor`) | 1.021 | 511 / −441 | 532 | Haltung | 1 Grathorn | Fundstück `erstes-haus` |
| – | Ankunft: Magd am Bach | 1.182 | 597 / −566 | 522 | – | – | Erstsatz (`ankunft.text`) |

### 1 — Am Talweg

- **Lernt:** Gehen, Rennen, Kamera. 237 m Fahrweg ohne Gegner, 9 % bergab; die Kamera hat ein Ziel (Wasser, Rauch).
- **Bild:** Unten steht Wasser, wo das Tal war. Dächer schauen heraus. Links davon, hinter der nächsten Kuppe und
  über der Wasserlinie, steigt Rauch auf — der einzige weit und breit. Ein Fahrweg führt in diese Richtung.
- **Warum Rauch:** Führung über Blickachsen statt Kartenmarke (Bibel §3); Bewohnte Häuser rauchen (ADR-0017), also ist
  der einzige Rauch die Enklave. Braucht eine Rauchfahne über Brannburg (§7.8).

### 2 — Zwei Höfe am Fahrweg

- **Lernt:** leichter Angriff, Ausdauer. **1 Fuchs** — der schwächste Gegner (60 Leben, Schnappen 10 Schaden,
  Vorlauf 0,40 s). Der Spürfuchs „streunt um die Enklaven“ (`content/creatures/spuerfuchs.json`), sein Biotop ist der
  Hof (`landuse=farmyard`). Die Dreierkette der Klinge kostet 54 von 100 Ausdauer; nach zwei Ketten ohne Pause fehlt sie für die Rolle
  (24). Der Fuchs ist schnell genug (4,5 m/s), das zu bestrafen, und zu schwach, um daran zu sterben (Bot müde: 100 % Siege, 12 Schaden).
- **Fundstück „Am Hoftor“** (185 / 10, Gebäude 691 und 699): Das Tor ist ausgehängt und liegt im Gras. Im Hof steht
  ein Wagen, beladen und abgedeckt, die Deichsel zeigt talwärts. Die Plane ist an einer Ecke aufgerissen, von unten.
  Auf dem Bock liegt eine Liste, mit Blei geschrieben. Der letzte Punkt heißt: Hühner. Er ist nicht abgehakt.

### 3 — Im Steig

- **Lernt:** Rolle. **1 Keiler** — sein Rammstoss geht durch jeden Block (`durch`, D173); die Rolle ist die einzige
  Antwort. Zugleich das längste Telegraf im Spiel (0,85 s, er senkt den Kopf und scharrt) und der schmalste Bogen
  (±35°): Wer zur Seite rollt, steht neben einem Tier, das 1,0 s offen ist. Nach Bot ist er trotz 140 Leben der
  zweitleichteste Gegner (aufmerksam 10 Schaden, müde 19, je 100 % Siege).
- **Bild:** Der Steig ist quer zum Hang aufgewühlt, immer an derselben Stelle. Die Buchenwurzeln liegen frei und sind
  blank gescheuert. Über die Kante sieht man zum ersten Mal Dächer, aus denen es raucht.
- **Wege (D374):** beschwerlich — der Steig in Kehren, 170 m für 37 Höhenmeter, am Keiler vorbei. Werkzeug (Klettern)
  — die Stufe in der Falllinie, rund 60 m. ⚠️ Im 10-m-Raster ist die Stufe 24–35° steil und damit gehbar
  (`GEHEN_MAX_GRAD` 40); eine Abkürzung für Kletternde wird es erst, wenn dort eine Wand als Set-Piece steht.

### 4 — Unter dem Steig

- **Lernt:** Reinigen. **1 Keiler**, derselbe Gegner wie eben: Das Muster ist bekannt, die Aufmerksamkeit ist frei
  für die neue Handlung. Der Keiler ist das gutmütigste Tier für den ersten Griff (Reinigen v1 §3): Lösen kostet
  0,2 s gegen 0,85 s Vorlauf, kein Kanal bricht (0 %), 100 % gereinigt, auch müde 98 % Siege. Der Fuchs wäre das
  falsche erste Tier (15 % gebrochene Kanäle im Verbund; ein Klingenhieb tötet ihn unter der Schwelle).
- **Bild:** Ein zweiter Keiler steht in der Wiese vor der Remise und frisst nicht. Der Schimmer sitzt ihm zwischen
  den Schultern. Wenn er wund ist und den Kopf hängen lässt, meldet sich das Zeichen am Arm.
- **Wie die Welt es lehrt:** Die Marke zeigt selbst an, wann sie greift (die Anzeige „greifbar“ braucht Reinigen v1
  ohnehin). Wer weiterschlägt, tötet — dann bleibt die Wiese leer (Bibel §2), und Station 5 zeigt den Unterschied
  nicht. Beides ist ein gültiger Ausgang.

### 5 — Remise am Steig (Zuflucht)

- **Lernt:** Rast. Neue Zuflucht `remise-am-steig` (Gebäude 860, 328 m², kein Nachbar in 70 m, 344 / −160),
  Aufwachpunkt 5 m vor der Ostwand am Weg. 46 m hinter Station 4: Die Rast ist die Antwort auf den ersten Griff —
  die Marke füllt sich bei der Rast im ruhigen Revier (D379).
- **Bild:** Der Keiler von vorhin grast vor dem Tor und hebt den Kopf nicht. Drinnen ist es still genug zum Schlafen.
  Wer hier geschlafen hat, dessen Zeichen greift wieder.
- **Ortstext:** Eine Remise am Fuß des Steigs, das Tor nur angelehnt. Drinnen ein Schlitten ohne Kufen und eine
  Feuerstelle aus Ziegeln, die jemand sauber hält. An der Wand Striche in Fünferbündeln. Das letzte Bündel hat vier.
- Aufgewacht wird an der Zuflucht, an der zuletzt gerastet wurde (`letzteZuflucht`). Wer vor der ersten Rast fällt,
  hat keine — §7.6.

### 6 — Halle an der Gabelung

- **Lernt:** Lock-On und Zielwechsel. **2 Füchse** — die erste Mehrzahl, aus dem schon bekannten Gegner (Bot:
  100 % Siege in allen Profilen, 11 Schaden aufmerksam, 25 müde). Hier zeigt sich auch der Preis des Reinigens in der
  Gruppe: immer reinigen kostet 23 statt 11 Schaden.
- **Fundstück „Am Rolltor“** (Gebäude 7 und 6, 1.807 m²): Die Halle steht offen. Paletten bis unters Dach, die Folie
  hängt in Streifen. Am Rolltor eine Tafel, mit Kreide: ANNAHME GESCHLOSSEN. Darunter, von anderer Hand: Brannburg
  nimmt noch. Fußweg, über den Bach, dann siehst du es. Darunter ein Strich für jeden, der es gelesen hat. Es sind elf.
- **Wege (D374):** beschwerlich — der Fussweg über die Furt, 518 m bis zur Magd, an Wolf und Grathorn vorbei.
  Werkzeug (Reiten) — der Fahrweg ums Nordende zur Schmiedin: zu Fuss 242 m länger und ohne Station; mit Reittier
  (17 m/s) sind die 1.527 m bis zum Talweg 90 s statt 5,3 min. Das ist der Rückweg, der zur Abkürzung wird (Bibel §3).

### 7 — An der Furt

- **Lernt:** Richtungsblock und Parade. **1 Wolf** (K7) — der einzige Tiergegner mit zwei Linien (links/rechts, die
  Kopfdrehung vor dem Biss, ADR-0009) und mit Kette (Doppelbiss): Wer nach dem ersten Biss die Deckung fallen lässt,
  bekommt den zweiten. Bot: aufmerksam 100 % / 16 Schaden, müde 97 % / 46, parierend 5,6 s statt 15,7 s — die Parade
  lohnt sich hier messbar.
- **Fundstück „Am Steg“** (563 / −380): Zwei Bohlen über dem Bach, die dritte liegt im Wasser. Im Schlamm am Ufer
  Abdrücke, in gleichem Abstand gesetzt, hin und zurück, hin und zurück. Am Geländerpfosten ein Blechschild,
  angenietet: K7 · RUNDE 4 · NICHT ANSPRECHEN. Jemand hat mit dem Messer daruntergeritzt: läuft noch.
- ⚠️ Die K7 hat bisher nur drei Vorkommen im Industriegelände, und der Auftrag `die-runde` ist der einzige Hinweis auf
  sie. Ein K7 an der Furt gibt diese Seltenheit auf (A-25.3).

### 8 — Vor dem ersten Haus (das Tor)

- **Lernt:** Haltung. **1 Grathorn** — der Gehörnstoss von oben nimmt 44 von 60 Haltung der Spielerin, wenn die
  Deckung nicht stimmt; zwei Fehler, und man taumelt. Umgekehrt bricht seine Haltung (60) nach zwei bis drei Klingenhieben (34 und 30 je Hieb),
  und ein Betäubter ist das längste Fenster für die Marke. Der längste Kampf der Strecke (Bot aufmerksam 24,5 s,
  müde 43 Schaden) und der erste, in dem alles Gelernte zusammenkommt. 80 m vor der ersten Haustür.
- **Fundstück „Am ersten Haus“** (Gebäude 118): Das erste Haus hat neue Läden und zur Wegseite keine Tür mehr. Sie ist
  zugemauert, der Mörtel ist noch hell. Am Zaun hängen Blechdosen an einer Schnur. Unter einem Stein auf dem Pfosten
  liegt ein Zettel: Wer das liest, ist am Bock vorbei. Bleib auf dem Weg. Wir sehen dich schon.
- ⚠️ Das Grathorn lebt sonst an Fels über 900 m (`content/creatures/grathorn.json`). Hier steht es auf 532 m: das
  Wappentier der Region, heruntergekommen, „greift erst an, wenn man den Grat betritt“ — sein Grat ist jetzt der Weg.
  Das ist eine Setzung (A-25.2).

### Ankunft — die Magd am Bach

Der Fussweg wird zur Wohnstrasse und läuft 10 m an der Magd vorbei (`dorf-magd`, 597 / −566, Westrand am Bach). Sie
ist die Erste, die man trifft — keine Wache, keine Begrüssung. Erstsatz (`ankunft.text`, statt ihres Ortstexts):

> Sie stellt die Eimer nicht ab. Sie sieht auf Ihren Arm, dann den Weg hinauf, den Sie gekommen sind. Am Bock ist
> seit Wochen keiner vorbeigekommen, sagt sie. Im Saal ist ein Platz frei. Zeigen Sie das Zeichen keinem, der nicht
> fragt.

Der Satz gilt, ob das Grathorn getötet, gereinigt oder umgangen wurde. Er trägt Bibel §6.1 („Die Enklave misstraut der
Marke“) und zeigt auf die Zuflucht `terrasse-saal` (147 Wegmeter weiter, „Ein Platz ist frei“). Dort endet die Strecke.

## 4. Gegner: vom schwächsten aufsteigend

`npx tsx tools/streckensim.ts 1000` — Kampfbot D171, Klinge, 1.000 Kämpfe je Zeile, Reinigen nach
`content/reinigen.json`. „müde“: Reaktion 0,40 s, 25 % Patzer.

| Station | Aufstellung | töten, aufmerksam: Siege · Zeit · Schaden | töten, müde: Siege · Schaden | immer reinigen, aufmerksam: Zeit · Schaden · gereinigt | immer reinigen, müde: Siege · Schaden |
|---|---|---|---|---|---|
| 2 Höfe | Fuchs | 100 % · 11,5 s · 8 | 100 % · 12 | 16,8 s · 12 · 100 % | 100 % · 27 |
| 3 Steig | Keiler | 100 % · 17,9 s · 10 | 100 % · 19 | 26,7 s · 14 · 100 % | 98 % · 31 |
| 4 Steigfuss | Keiler | 100 % · 17,9 s · 10 | 100 % · 19 | 26,7 s · 14 · 100 % | 98 % · 31 |
| 6 Halle | Fuchs + Fuchs | 100 % · 18,9 s · 11 | 100 % · 25 | 21,5 s · 23 · 94 % | 100 % · 49 |
| 7 Furt | Wolf | 100 % · 15,7 s · 16 | 97 % · 46 | 19,2 s · 17 · 88 % | 78 % · 58 |
| 8 Tor | Grathorn | 100 % · 24,5 s · 14 | 100 % · 43 | 29,6 s · 16 · 100 % | 97 % · 54 |

**Lesart.**

- Der erlittene Schaden steigt von Station zu Station (müde: 12 → 19 → 19 → 25 → 46 → 43); die Reihenfolge folgt
  dieser Messung, nicht den Lebenspunkten — der Keiler hat die meisten (140) und ist trotzdem der zweitleichteste.
- **Das Tor ist nach Bot nicht härter als die Furt** (müde 43 gegen 46 Schaden, aufmerksam 14 gegen 16). Es ist der
  längste Kampf, nicht der gefährlichste. Wer es härter will: Keiler + Grathorn (Reinigen v1 §3: töten 100 % / 15
  Schaden / 30,8 s, müde 95 %; immer reinigen müde 49 %) — A-25.2.
- **Summe ohne Rast:** aufmerksam 69 Schaden über die ganze Strecke bei 100 Leben. Müde 50 bis zur Remise und 114
  danach — ein müder Spieler kommt ohne Kräutersud (Startbeutel: zwei) nicht von der Remise bis in die Enklave. Das
  ist die Stelle, an der die Strecke den Rückweg zur Zuflucht lehrt.
- Der parierende Bot reinigt den Wolf nie (0 %): Er tötet ihn mit dem Konter, bevor die Schwelle greift. Eigenheit
  des Bots, kein Befund über Menschen.
- **Weggelassen:** die Gams (einzeln 40,7 s und 38 Schaden, müde 77 % Siege — fällt aus dem Band, A-24.2), der
  Übungsgegner (Platzhalter ohne Körperbau) und alle Menschen (unten).

**Kein Mensch auf der Strecke.** Die Marke greift bei Menschen nicht, und ihr Kampf soll mit dem Haltungsbruch enden
(Flucht oder Aufgabe, D385) — das ist nicht gebaut. Heute hiesse ein Mensch auf der Lehrstrecke: töten als einziger
Ausgang. Dazu sind sie für müde Spieler die härtesten Einzelgegner (400 Kämpfe: Wegelagerer 61 % Siege, Speermann
81 %, Axtmann 42 %). Der erste Mensch bleibt das Wegelager abseits des Weges (A-25.4).

## 5. Zwei Wege (D374) — soweit es das Gelände hergibt

Am Spielbeginn hat der Brachgänger kein Werkzeug; die Lehrstrecke **ist** der beschwerliche Weg. Das Raster zeigt auf
ihr keine Stelle, die ohne Werkzeug unpassierbar wäre (keine Stufe über 40°, kein stehendes Wasser, der Bach ist
schmal). Sinnvoll sind deshalb nur zwei Stellen, beide als Rückwege, die später zur Abkürzung werden:

| Stelle | Beschwerlicher Weg | Werkzeugweg | Stand |
|---|---|---|---|
| Steig (297–514 m) | Fussweg in Kehren, 170 m für 37 Höhenmeter | Klettern: die Hangstufe in der Falllinie, ~60 m | ⚠️ im Raster gehbar (24–35°); braucht eine gebaute Wand, sonst ist es einfach der kürzere Fussweg |
| Halle → Enklave (ab 664 m) | Fussweg über die Furt, 518 m, zwei Kämpfe | Reiten: Fahrweg ums Nordende, 1.527 m gesamt, 8 m Anstieg und 129 m Abstieg | zu Fuss 242 m länger; als Reitweg 90 s bis zum Talweg |

Nicht sinnvoll: Gleiten (Verhältnis 3 : 1 trägt von 629 m rund 345 m weit, die Terrasse liegt 957 m entfernt) und
Schwimmen (kein Gewässer auf der Strecke).

**Umgehen.** Alle Stationen liegen in offenem Gelände. Wer den Weg verlässt, kommt an jedem Kampf vorbei; die Luftlinie
0/0 → Wirt (957 m) ist im Raster durchgehend gehbar (höchstens 26°). Das passt zu „kein Ziel ist hart verschlossen“
und zum dritten Spielstil (D385, die Mönche zählen jeden Eingriff), heisst aber: Die Strecke lehrt nur den, der auf
dem Weg bleibt (A-25.5).

## 6. Was in `content/` angelegt ist — und was davon im Spiel wirkt

| Datei | Was | Wirkt im Spiel? |
|---|---|---|
| `content/strecken/weg-nach-brannburg.json` | Start, acht Stationen, Ankunft | **nein** — kein Lader |
| `content/orte/remise-am-steig.json` | Zuflucht | **ja**: Marke, Rasten, Aufwachpunkt; der Bewohnt-Radius (D289, 150 m) setzt sechs Häuser am Steig (710, 850, 860, 862, 1860, 1889) auf Stufe 0 |
| `content/fragmente/hoftor-fahrweg.json`, `halle-gabelung.json`, `steg-an-der-furt.json`, `erstes-haus.json` | vier Fundstücke | **ja**: liegen aus und sind lesbar |
| Schema `Strecke`, `LEKTIONEN` (`src/data/schema.ts`) | neue Inhaltsart | nur in `validate`, Test und `streckensim` |

Kein Auftrag: Ein Auftrag braucht einen Geber, und am Start steht niemand. Die Schritte der Strecke sind ihre
Stationen; geführt wird über Blickachsen und Fundstücke (Bibel §3), nicht über ein Log.

`npm run validate` prüft je Strecke: Region; Stationen in der Bbox, über der Flutlinie, nicht im Grundriss, jede
näher an der Ankunft als die davor; Gegner aus `content/gegner` (kein Übungsgegner); Reinigen an einem Tier,
Zielwechsel an mindestens zweien, Rast an einer Zuflucht; Fundstück und Zuflucht höchstens 40 m von der Station; kein
Fundstück eines verborgenen Orts; Ankunft bei einem Bewohner der Enklave; alle elf Lektionen.

## 7. Umsetzungsliste (Code, der fehlt)

Nichts davon ist gebaut. Reihenfolge nach Abhängigkeit.

1. **Lader.** `STRECKEN` in `src/data/inhalte.ts` (wie `WANDERFIGUREN`), damit die Daten auch im Browser geprüft sind.
2. **Reinigen im Spiel** (offen seit D376/D379): `Kampfwelt.marke` in `src/kampf/Kampfplatz.tsx` verdrahten, Eingabe,
   Animation, Anzeige „greifbar“ und Fortschritt am Tier, Markenladung im Spielstand. Ohne das hat Station 4 nichts zu lehren.
3. **Streckengegner in der Welt.** Die Wegelager stehen als Konstante `WEGELAGER` in `src/main.tsx` (Ort, Versatz,
   Aufstellung, Meldung, Beute, Stufe). Daraus eine Datenquelle machen, die auch Stationen liest. Unterschiede zum
   Lager: Tiere stehen **sichtbar** in der Welt, bevor der Kampf beginnt; keine Meldungszeile, keine Feuerstelle;
   kein Wiederkehren nach 40 Minuten.
4. **Ausgang je Station im Spielstand:** getötet, gereinigt oder umgangen. Gereinigte bleiben als reine Tiere stehen
   und greifen nicht an (Bibel §2) — Station 5 braucht den grasenden Keiler.
5. **Rast lädt die Marke**, im ruhigen Revier (D379). Heute heilt die Rast nur.
6. **Spielbeginn aus den Daten:** `LEERER_STAND.position` und ein Startblick aus `Strecke.start` statt der Konstante.
   Ort ist gleich (0/0), neu ist nur der Blick. **Umschalten erst am M1.** Dazu: wo man aufwacht, wenn man vor der
   ersten Rast fällt (heute ist `letzteZuflucht` dann leer).
7. **Erstsatz bei der Ankunft:** `src/ui/Ortsfenster.tsx` zeigt `Ort.text`; für `ankunft.text` braucht es „zum ersten
   Mal angesprochen“ (steht in `stand.orte`) und die Strecke als Quelle.
8. **Bilder als Set-Pieces:** Rauchfahne über Brannburg (Blickführung von Station 1 und 3), aufgewühlter Steig, Wagen
   im Hof, Kreidetafel am Rolltor, Steg mit Blechschild, zugemauerte Tür mit Blechdosen. Jedes mit Vorher/Nachher-Bildpaar.
9. **Wildvorkommen im Korridor.** `src/world/vorkommen.ts` setzt Wurzelkeiler auf jede Wiese und Sporenhähne in den
   Wald; ungeordnet stehen sie vor dem Fuchs. Braucht einen Freihalte-Radius um Stationen oder einen Korridor.
10. **Eingabehinweise.** „Ohne Texttafeln“ lässt offen, wie die Taste für Rolle, Block, Zielen und Marke gezeigt
    wird (A-25.6). Kein Code, bevor das entschieden ist.
11. **Startausstattung.** `LEERER_STAND.beutel` gibt zwei Kräutersude und einen Köder; der Köder ist Fanghilfe aus v1.
12. **Flucht und Aufgabe menschlicher Gegner** (D385), bevor ein Mensch auf die Strecke kommt.

## 8. Was unklar ist

- ⚠️ UNKLAR: **Sicht.** Alle Sichtlinien sind Rasterrechnung ohne Bäume, Häuser und Nebel. Ob man vom Start das Wasser
  und vom Steig die Dächer wirklich sieht, zeigt nur das Gerät.
- ⚠️ UNKLAR: **Der Steig als Engstelle.** Das 10-m-Raster zeigt 24–35°; ob der Keiler dort tatsächlich den Weg sperrt
  oder man ihn in der Wiese umläuft, hängt an Bäumen und Klippen-Instanzen, die das Raster nicht kennt.
- ⚠️ UNKLAR: **Die Furt.** Die Station liegt 23 m vor der Bachquerung auf trockenem Grund; wie tief der Bach im Spiel
  ist und ob dort gewatet wird (`WATEN_AB` 0,30 m), ist nicht gemessen.
- ⚠️ UNKLAR: **Spielzeit.** 15–25 min sind geschätzt. Gemessen sind nur Wegzeit und Bot-Kampfzeit.
- ⚠️ UNKLAR: **Schwierigkeit für Menschen.** Der Bot kennt jedes Fenster; ein Mensch am ersten Abend nicht. Die Tabelle
  ordnet die Stationen, sie sagt nicht, wie oft man stirbt.
- ⚠️ UNKLAR: **Sechs Häuser am Steig werden „bewohnt“**, weil die Remise eine Zuflucht ist (D289). Ob das an einem
  Weg durchs Brachland richtig aussieht, ist ungesehen.
- ⚠️ UNKLAR: **Zählt der Wolf an der Furt für `die-runde`?** Der Auftrag zählt gereinigte Vorkommen der Art
  `k7-wolf`; wie ein Streckengegner im Spielstand heisst, ist nicht entschieden.
