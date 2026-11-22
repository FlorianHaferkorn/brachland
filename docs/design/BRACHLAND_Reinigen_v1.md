---
last-reviewed: 2026-11-22
shelf-life-days: 180
---
# BRACHLAND — Reinigen v1 (D376)

> Entwurf mit Regelkern zu Story-Bibel v2 §2 (D374): Die Marke heilt statt zu töten. Der Regelkern liegt in
> `src/kampf/echtzeit.ts` hinter dem Schalter `Kampfwelt.marke`, die Werte in `content/reinigen.json`, die Dauer je Tier
> seit D389 in `content/gegner/` (§6 — die Dauern in §2 und die Tabelle in §3 sind der Stand davor). **Nicht gebaut:**
> Eingabe, Animation, Anzeige, Belohnung, Weltfolgen. Offen/erledigt steht im Ledger (`docs/_INDEX.md` A-24.2), nicht hier.

**Frage:** Wie wird Reinigen eine Kampfhandlung, die langsamer und riskanter ist als Töten, aber nie aussichtslos — und
was bekommt man dafür, damit beides eine Wahl bleibt?

## 1. Drei Varianten

Alle drei sind mit denselben Regeln gebaut und unterscheiden sich nur in den Werten (`tools/reinigensim.ts` `VARIANTEN`).

| | A — Gnadengriff | **B — Greifen in Fenstern (empfohlen)** | C — Binden ab dem ersten Bruch |
|---|---|---|---|
| Auslöser | Leben ≤ 25 %, dann betäubt oder in der Erholung | Leben ≤ 35 %, dann betäubt, in der Erholung oder lauernd | jeder Haltungsbruch, bei jedem Leben |
| Ablauf | **ein** Kanal von 3 s, die Marke hält bis zum Ende | Marke hält 1,2 s, dann steht das Tier wieder; 3–6 Griffe | ein Kanal von 3,5–6 s, die Marke hält bis zum Ende |
| Unterbrechung | ein Treffer löscht alles | ein Treffer halbiert; selbst gelöst bleibt alles, verfällt 2 %/s | ein Treffer halbiert |
| Einzeln gegen Töten | −11 … +5 % Kampfdauer: kein Preis. Fuchs nur in 15 % der Kämpfe gereinigt | **+21 … +49 %**, Gams −6 %; Schaden +1 … +4 | −28 … −5 %, nur Fuchs +28 % |
| Zu zweit/dritt, immer reinigen | Siege 12–77 % (Töten 93–100 %), Schaden bis +57; nur Wolf+Fuchs 99 %, weil der Bot dort den Fuchs meist tötet | **Siege 94–99 % zu zweit, 69–90 % zu dritt**; Schaden +6 … +32 | Siege 2–76 % (nur Keiler+Grathorn 100 %), Schaden bis +67 |
| Dafür | einfach zu erklären, ein klarer Moment | skaliert mit dem Gegner (jeder Griff kostet einen Angriff, dem man ausweichen muss), Fortschritt geht nie ganz verloren, Rudel bleibt machbar | entspricht dem Satz „Haltung gebrochen, dann reinigen“ wörtlich |
| Dagegen | einzeln kein Preis (so schnell wie Töten), im Rudel aussichtslos: alles oder nichts | mehr Regeln (Schwelle, Halten, Verfall); der Keiler dauert spürbar | Reinigen ist **schneller** als Töten, weil der Bruch vor dem Tod kommt — das Gegenteil der Vorgabe; im Rudel trotzdem aussichtslos |

**Befund, der die Wahl entscheidet:** Ein einzelner langer Kanal lässt sich nicht so einstellen, dass er einzeln etwas
kostet **und** im Rudel durchkommt. Allein greift niemand an, solange das Tier liegt — der Kanal ist geschenkt. Im Rudel
kommt der nächste Angriff nach rund 1,5 s — der Kanal reisst immer. Nur viele kurze Griffe haben einzeln einen Preis
(jeder kostet eine Angriffsrunde des Tiers) und im Rudel eine Chance (ein Griff passt in die Atempause, D172).

## 2. Empfehlung: Variante B

### Ablauf

1. **Niederringen.** Das Tier wird mit Waffen auf **35 %** Leben gebracht. Vorher greift die Marke nicht, auch nicht bei
   gebrochener Haltung.
2. **Fenster.** Greifbar ist das wunde Tier, wenn es **betäubt** ist (Haltungsbruch, Parade, Wurf der Axt, Flutstoss),
   in der **Erholung** nach seinem letzten Schlag steht — oder **lauert**, während die Meute Atem holt (D172).
3. **Griff.** Eine Eingabe in 1,8 m Reichweite. Die Marke hält das Tier **1,2 s** am Boden; ein schon betäubtes
   zusätzlich den Rest seiner Betäubung (das ist der Lohn des Haltungsbruchs: 0,8–1,0 s mehr). Solange kanalisiert die
   Spielerin: kein Schlag, keine Rolle, kein Block, Schaden ×1,25.
4. **Fortschritt** läuft mit `1 / Dauer`; die Dauer hängt an der Grösse des Tiers: `0,5 s + lebenMax / 24`. Nach dem
   Griff steht das Tier wieder und greift an. Der Fortschritt bleibt am Tier und verfällt mit 2 %/s.
5. **Unterbrechung.** Ein Treffer bricht den Kanal und halbiert den Fortschritt. Selbst lösen (Rolle drücken) kostet
   **0,2 s**, bevor die Rolle beginnt — gegen Fuchs (Vorlauf 0,40 s), Gams (0,45 s) und Wolf (0,50 s) ist das mit 0,25 s
   Reaktionszeit knapp oder zu spät; gegen Keiler (0,85 s) und Grathorn (0,60 s) reicht es.
6. **Ergebnis.** Bei vollem Fortschritt ist das Tier **gereinigt**: aus dem Kampf, Zustand `rueckgefuehrt`, eine
   Markenladung verbraucht. Töten bleibt jederzeit möglich — wer weiterschlägt, tötet.

### Werte (`content/reinigen.json`, Schema `ReinigenDaten`)

| Wert | Zahl | Warum |
|---|---|---|
| `schwelle` / `wundAb` | 0,35 | Ohne Schwelle ist Reinigen schneller als Töten (Variante C); bei 25 % (Variante A) stirbt der Fuchs meist am Schlag, der ihn unter die Schwelle bringen soll (15 % gereinigt). Bei 35 % bleibt das Risiko am kleinsten Tier: Fuchs 21 von 60 Leben, ein Klingenhieb macht 22–26 |
| `reichweite` | 1,8 m | näher als die Klinge (2,4 m): man muss heran. 1,6 m und 2,0 m gemessen (Schritt 4 der Kurve), der Unterschied war klein; 1,8 m ist die Mitte |
| `halten` | 1,2 s | passt in die Atempause der Meute (1,0 s) plus Anlauf des Nächsten. Mit 2,0–2,5 s war Reinigen einzeln so schnell wie Töten (Schritt 4) |
| `grunddauer` + `lebenMax / lebenJeSekunde` | 0,5 s + L / 24 | Fuchs 3,0 s · Wolf 4,3 s · Gams 4,7 s · Grathorn 5,5 s · Keiler 6,3 s — also 3 bis 6 Griffe. **Seit D389 nur noch Rückfall:** Jedes Tier trägt seine Dauer selbst (§6: Fuchs 2,5 · Gams 4,0 · Wolf 4,25 · Keiler 5,4 · Grathorn 5,5 s) |
| `loesen` | 0,2 s | macht den Kanal im Rudel zum Wagnis; ohne ihn (0 s) kostete „immer reinigen“ gegen zwei Wölfe keinen Schaden mehr als Töten (Schritt 6) |
| `nachhall` | 0,4 s | so lange bleibt das Tier nach einem Abbruch noch benommen — Zeit für die Rolle, nicht für einen Schlag |
| `behaltBeiTreffer` | 0,5 | ein Treffer tut weh, aber die Reinigung ist nicht verloren (Variante A: 0 → Rudel aussichtslos) |
| `verfallJeSekunde` | 0,02 | ein Griff bringt 0,19–0,40; eine Runde von 3 s kostet 0,06. Wer das Tier liegen lässt, fängt nach 50 s von vorn an |
| `verwundbar` | ×1,25 | wie der Flutstoss (D188) — spürbar, nicht tödlich |
| `ausdauer` | 0 | bewusst: Eine Reinigung braucht 3–6 Griffe, und zwischen den Griffen braucht man die Rolle aus derselben Kasse. Der Preis ist Zeit und Deckung. Mit Kosten > 0 im Endstand nicht gemessen |
| `ladung` / `fassung` | 1 je Reinigung / 4 + 2 je Regent | Markenladung füllt sich bei der Rast; begrenzt, wie viele Tiere je Ausflug gereinigt werden (§4) |
| `verhaertet` | Dauer ×2, 3 Ladungen, nur mit Reinkultur | Bibel §2; Verhärtete sind die optionalen Bosse |

Alle Werte sind **Arbeitswerte aus der Bot-Messung**, nicht am Gerät gespielt (CLAUDE.md „Das Zielgerät ist der Test“).

### Gegenspiel

- **Das Tier selbst:** Nach jedem Griff steht es auf und greift an. Reinigen heisst also drei bis sechs weitere Angriffe
  ausweichen — bei jedem kann man patzen.
- **Andere Gegner:** Wer nicht gehalten wird, greift normal an (Angriffsrecht D167). Der Griff passt in die Atempause;
  wer ihn überzieht, wird getroffen (×1,25, Fortschritt halbiert).
- **Regenten (Entwurf, nicht gebaut):** nur mit vollständigem Satz Reinkulturen (Bibel §6). Vorschlag: Der Regent ist
  `verhaertet` mit eigener Dauer je Phase; jede Phase endet mit einem Griff statt mit dem Phasensturz, und zwischen den
  Griffen ruft er Befallene. Braucht eigene Messung, sobald es einen Regenten im Echtzeitkampf gibt.

### Zustände und Narben (Creature-Bible §3–§4)

`befallen` → `rueckgefuehrt` durch die Reinigung; `verhaertet` nur mit Reinkultur; Menschen sind nicht befallen, die
Marke greift nicht. Die **Narbe** bleibt, was sie in der Creature-Bible ist: Sie entsteht durch die Reinigung und folgt
aus der Herkunft (Wildling Krit, Zuchtlinie Resistenz, Verwachsener Panzer). Im Echtzeitkampf wirkt sie nur am **einen**
gebundenen Reittier (Bibel §2); alle anderen Gereinigten stehen als reine Tiere im Revier.

### Eingabe

Eine Taste am aufgeschalteten Ziel, sonst am nächsten greifbaren (`setzeReinigenAn`). Rolle im Kanal heisst lösen und
rollen. Vorschlag für die Belegung: **F** / Schultertaste — nicht gebaut. Die Anzeige braucht zwei Dinge: ob das Ziel
greifbar ist, und den Fortschritt am Tier.

### Richtungskampf (ADR-0009) und Kernfunken (D188)

- **Parade** betäubt den Angreifer 0,45 s — an einem wunden Tier ist das ein Fenster, und die Marke hält es dann
  1,65 s. Wer pariert statt rollt, steht nach dem Angriff schon in Reichweite. Mit `richtung: false` (D355) ändert sich
  nichts: Tiere schlagen ohnehin nur mit Körperlinie, die Parade bleibt.
- **Flutstoss** (Wasser) betäubt 0,7 s und wirft dreifach zurück: Fenster ja, aber man muss nachsetzen. **Bruchschlag** (Stein) bricht die Haltung fast sicher: der verlässlichste Weg zum langen Griff.
- **Vorschlag, nicht gebaut:** Ein Griff lädt den Funken wie eine Parade (+35 %). Dann nährt Reinigen den
  Elementarangriff, und der Elementarangriff öffnet das nächste Fenster.

## 3. Messreihe

`npx tsx tools/reinigensim.ts 1000 alle` — Kampfbot D171 (Klinge, Profil „aufmerksam“: Reaktion 0,25 s, 10 % Patzer),
1.000 Kämpfe je Zeile, Start 8 m. „immer“: jedes Tier reinigen. „gemischt“: töten, solange ein anderer steht, den
Letzten reinigen. „gebrochen“: Anteil der Kanäle, die ein Treffer beendet hat.

| Aufstellung | Modus | Siege | Zeit bis Sieg | gegen Töten | Schaden erlitten | gegen Töten | gereinigt | Kanäle/Kampf | gebrochen | selbst gelöst |
|---|---|---|---|---|---|---|---|---|---|---|
| keiler | töten | 100 % | 17,9 s | – | 10 | – | – | – | – | – |
| keiler | immer | 100 % | 26,7 s | +49 % | 14 | +4 | 100 % | 6,9 | 0 % | 85 % |
| grathorn | töten | 100 % | 24,5 s | – | 14 | – | – | – | – | – |
| grathorn | immer | 100 % | 29,6 s | +21 % | 16 | +2 | 100 % | 5,7 | 0 % | 83 % |
| wolf | töten | 100 % | 15,7 s | – | 16 | – | – | – | – | – |
| wolf | immer | 100 % | 19,2 s | +22 % | 17 | +1 | 88 % | 3,5 | 0 % | 75 % |
| fuchs | töten | 100 % | 11,5 s | – | 8 | – | – | – | – | – |
| fuchs | immer | 100 % | 16,8 s | +45 % | 12 | +4 | 100 % | 3,0 | 0 % | 67 % |
| gams | töten | 100 % | 40,7 s | – | 38 | – | – | – | – | – |
| gams | immer | 100 % | 38,3 s | -6 % | 36 | -3 | 100 % | 4,8 | 0 % | 79 % |
| wolf+fuchs | töten | 100 % | 24,9 s | – | 20 | – | – | – | – | – |
| wolf+fuchs | immer | 95 % | 32,0 s | +28 % | 53 | +32 | 92 % | 7,4 | 9 % | 66 % |
| wolf+fuchs | gemischt | 100 % | 29,9 s | +20 % | 23 | +3 | 49 % | 3,8 | 0 % | 75 % |
| wolf+wolf | töten | 100 % | 43,4 s | – | 35 | – | – | – | – | – |
| wolf+wolf | immer | 94 % | 48,2 s | +11 % | 54 | +19 | 87 % | 8,4 | 2 % | 77 % |
| wolf+wolf | gemischt | 99 % | 48,3 s | +11 % | 38 | +3 | 47 % | 3,8 | 0 % | 75 % |
| gams+gams | töten | 100 % | 37,6 s | – | 31 | – | – | – | – | – |
| gams+gams | immer | 99 % | 43,9 s | +17 % | 37 | +6 | 99 % | 10,8 | 1 % | 80 % |
| gams+gams | gemischt | 99 % | 35,6 s | -5 % | 29 | -2 | 46 % | 4,6 | 0 % | 80 % |
| keiler+grathorn | töten | 100 % | 30,8 s | – | 15 | – | – | – | – | – |
| keiler+grathorn | immer | 99 % | 59,1 s | +92 % | 27 | +13 | 99 % | 17,0 | 0 % | 88 % |
| keiler+grathorn | gemischt | 100 % | 36,3 s | +18 % | 17 | +3 | 44 % | 5,3 | 0 % | 83 % |
| wolf+wolf+wolf | töten | 93 % | 66,1 s | – | 49 | – | – | – | – | – |
| wolf+wolf+wolf | immer | 69 % | 78,8 s | +19 % | 73 | +24 | 70 % | 12,4 | 2 % | 81 % |
| wolf+wolf+wolf | gemischt | 92 % | 70,9 s | +7 % | 51 | +2 | 27 % | 3,3 | 0 % | 75 % |
| wolf+fuchs+fuchs | töten | 96 % | 37,5 s | – | 25 | – | – | – | – | – |
| wolf+fuchs+fuchs | immer | 90 % | 42,2 s | +12 % | 57 | +32 | 82 % | 10,3 | 15 % | 62 % |
| wolf+fuchs+fuchs | gemischt | 95 % | 41,5 s | +11 % | 27 | +2 | 30 % | 3,3 | 0 % | 73 % |

**Lesart.** - **Einzeln ist Reinigen langsamer, nicht gefährlicher:** +21 … +49 % Kampfdauer bei vier von fünf Tieren (Mittel über
  alle fünf: +26 %), Schaden +1 … +4. Der Richtwert +20–40 % ist für Grathorn und Wolf getroffen, Keiler (+49 %) und
  Fuchs (+45 %) liegen darüber.
- **Die Gams fällt heraus (−6 %):** Der Bot braucht zum Töten der Gams 40,7 s, weil er in ihre kurze Erholung (0,7 s)
  selten einen Schlag bringt; ein Griff muss dort nur **beginnen**. Das ist eine Eigenheit des Bots gegen dieses Tier,
  nicht belegt für Menschen.
- **Im Rudel kostet „immer reinigen“ Leben:** zu zweit im Mittel 43 statt 25 Schaden (+70 %), zu dritt 65 statt 37
  (+76 %); Siege zu zweit 94–99 %, zu dritt 69 % (drei Wölfe, Töten 93 %) und 90 %. Schwer, nicht aussichtslos.
- **Gemischt ist der sichere Weg:** +7 … +20 % Kampfdauer (Gams-Paar −5 %), Schaden −2 … +3, Siege wie beim Töten.
- **Abgebrochene Kanäle:** Ein Treffer bricht 0–2 % der Kanäle gegen Wolf, Gams, Keiler, Grathorn und 9–15 %, sobald ein
  Fuchs dabei ist (Vorlauf 0,40 s gegen 0,25 s Reaktion + 0,2 s Lösen). 62–88 % der Kanäle löst der Bot selbst, der
  Rest läuft aus oder reinigt.
- **Versehentlich getötet:** Wolf 12 % — der Bot schlägt einen Betäubten knapp über der Schwelle schwer und tötet ihn
  dabei. Er schont erst unter 35 %.
- **Keiler + Grathorn (+92 %)** ist die längste Zeile: 17 Griffe, weil beide gross sind und sich abwechseln.

**Dieselbe Reihe, müder Spieler** (Reaktion 0,40 s, 25 % Patzer):

| Aufstellung | Siege töten | Siege immer | Siege gemischt | Schaden töten → immer | gereinigt (immer) |
|---|---|---|---|---|---|
| keiler | 100 % | 98 % | – | 19 → 31 | 98 % |
| grathorn | 100 % | 97 % | – | 43 → 54 | 97 % |
| wolf | 97 % | 78 % | – | 46 → 58 | 34 % |
| fuchs | 100 % | 100 % | – | 12 → 27 | 100 % |
| gams | 77 % | 34 % | – | 67 → 92 | 34 % |
| wolf+fuchs | 87 % | 65 % | 61 % | 62 → 78 | 41 % |
| keiler+grathorn | 95 % | 49 % | 84 % | 46 → 81 | 52 % |
| wolf+wolf | 55 % | 22 % | 28 % | 83 → 94 | 11 % |
| wolf+wolf+wolf | 6 % | 1 % | 3 % | 97 → 99 | 2 % |

Wer müde spielt, verliert schon beim Töten jeden zweiten Kampf zu zweit; Reinigen macht daraus eine Niederlage. Das ist
gewollt (Kampfbot-Tor D172: „das Rudel schlägt einen müden Spieler meistens“), aber die Gams einzeln (77 → 34 %) ist zu
hart — siehe Ledger A-24.2.

**Die Kurve** (wie die Werte entstanden, je 100–200 Kämpfe, Klinge, aufmerksam):

| Schritt | Einstellung | Befund |
|---|---|---|
| 1 | Binden bis zum Ende ab dem ersten Bruch, Dauer 1,5 s + Restleben/30 (Vorläufer von Variante C) | Keiler −39 %, Grathorn −19 % Kampfdauer: schneller als Töten. Bei Grathorn, Wolf, Fuchs und Gams brach der Bot die Haltung nur in 14–68 % der Kämpfe, bevor das Tier tot war — der Bruch allein ist kein verlässlicher Auslöser |
| 2 | Kanal nur, solange das Tier von selbst offen steht (kein Halten) | Griffe von 0,02–0,1 s: Nach der Rolle ist die Erholung fast um. Der Bot kam bei vier von fünf Tieren nie durch (0 % Siege) |
| 3 | Halten 1,2–2,0 s, ohne Schwelle, Dauer nach Restleben | uneinheitlich: Keiler −20 … +17 %, Fuchs +64 … +171 %, Grathorn und Gams mit Niederlagen (67–72 % Siege bei 1,2 s) |
| 4 | Schwelle 35 %, Halten 1,5–2,0 s, Dauer nach Restleben | einzeln −4 … −23 % (zwei Griffe genügen), Fuchs +66 % |
| 5 | Dauer nach `lebenMax` statt Restleben, Halten 1,2 s | Keiler, Grathorn, Wolf +15 … +39 %, aber zwei Wölfe 16–26 % Siege — vermutlich liegt das Fenster nach dem Doppelbiss nach der Doppelrolle ausser Reichweite |
| 6 | lauernde Tiere in der Atempause greifbar | zwei Wölfe 100 %, drei 90 % — und kein Mehrschaden: Der Bot löste jeden Kanal rechtzeitig |
| 7 | Lösen kostet 0,2 s | der Stand der Tabelle oben |

## 4. Belohnungsökonomie (gerechnet, nicht gebaut)

**Annahmen (alle markiert, keine ist gemessen):**

- **A1 Umfang.** Œntal: 6 h Zielspielzeit (`content/regions/oental.json`), 1.018 Tier-Vorkommen (`npm run vorkommen`,
  22.11.2026). Angenommen: **180 Tierbegegnungen mit 280 Tieren** (100 einzeln, 60 Paare, 20 Dreier) — 27 % des
  Bestands, 30 Begegnungen je Stunde. Menschen (nicht reinigbar), Verhärtete und der Regent stehen daneben.
- **A2 Kampfwerte** aus der Messreihe oben, gemittelt je Gruppengrösse (aufmerksam, Klinge).
- **A3 Rast** alle 9 Begegnungen (20 Rasten); die Marke füllt sich dort.
- **A4 Material nur von Getöteten** (Vorschlag): je Kampf ein Wurf wie heute (`beuteChance`, höchstens ein Fund), mal
  Anteil getöteter Tiere. Raten **halbiert** gegenüber heute: Harzverband 5 %, Herzfunke 2,5 %. Schmiede unverändert
  (D177: je Waffe 6 Harz + 3 Herzfunken bis Stufe 3, +12 % Schaden je Stufe).
- **A5 Läuterung** (Markenfortschritt, Vorschlag): 1 je gereinigtem Tier, 5 je Verhärtetem, 15 je Regent. Markenstufen
  bei 25 / 60 / 110 / 170: je **+1 Fassung**; Stufe 2 zusätzlich `halten` +0,2 s, Stufe 4 Verhärtete nur noch ×1,5.
- **A6 Reviergunst** (Vorschlag): Ein Revier, in dem ≥ 60 % der Begegneten gereinigt sind, ist **ruhig**: Die Tiere
  greifen nicht mehr an (Bibel §2), die Witterung zeigt dort einen verborgenen Ort oder ein Fundstück, und eine Rast im
  Revier füllt die Marke **ohne Zuflucht**. Ein leergetötetes Revier ist ebenfalls still, gibt aber nichts.

**Drei Spielweisen über das Kapitel:**

| | Schlächter (tötet alles) | Gemischt (reinigt den Letzten, solange Ladung da ist) | Heiler (reinigt, bis die Marke leer ist; umgeht den Rest) |
|---|---|---|---|
| Kämpfe | 180 | 180 | 78 (102 umgangen) |
| getötet / gereinigt | 280 / 0 | 180 / 100 | 0 / 100 |
| Kampfzeit | 88 min | 95 min (+8 %) | 41 min, dazu Umwege |
| erlittener Schaden | 3.975 (22 je Kampf) | 4.147 (23 je Kampf) | 1.999 (26 je Kampf) |
| erwartete Niederlagen | 1 | 1–2 | 1–2 |
| Material (Harz / Herzfunke) | 9 / 4,5 → Hauptwaffe Stufe 3, Zweitwaffe Stufe 2 | 5,2 / 2,6 → Hauptwaffe Stufe 2 | 0 → nur Lagerbeute (heute 1 / 1) |
| Waffenschaden | +36 % | +24 % | +0 … +12 % |
| Läuterung → Fassung | 0 → 4 | 100 → 6 | 100 → 6; mit ruhigen Revieren (A6) geschätzt 130–160 → 7 |
| Bilanz gereinigt | 0 % | 36 % | 100 % |
| Reviere | leer | gemischt | ruhig |

Rechnung Ladung: 20 Rasten × Fassung 4, mit den Stufen bei 25 und 60 Läuterung 5 bzw. 6 — ergibt rund 100 Reinigungen
im Kapitel, egal ob Gemischt oder Heiler. **Die Marke begrenzt, nicht die Kampfstärke.**

**Befunde:**

1. **Mit den heutigen Beuteraten (10 % / 5 %) dominiert Gemischt.** Der Schlächter bekäme 18 / 9 (alle drei Waffen
   voll), Gemischt 10 / 5 — genug für die Hauptwaffe auf Stufe 3. Da man eine Waffe führt, hätte Gemischt dieselbe
   Schlagkraft **und** die Marke. Deshalb A4: Raten halbieren oder die Schmiede vertiefen, sodass die Hauptwaffe den
   Ertrag des Schlächters braucht.
2. **Ohne A6 dominiert Gemischt den Heiler:** gleiche Marke, bessere Waffe. Die Reviergunst muss etwas Greifbares
   tragen — vorgeschlagen ist die Rast im ruhigen Revier, die dem Heiler das gibt, was die Schmiede dem Schlächter gibt:
   eine Schleife, die sich selbst nährt.
3. **Reinigen kostet in der Summe wenig Zeit** (+8 % für Gemischt). Der Preis liegt im einzelnen Kampf und im Rudel,
   nicht im Kapitel.

### Wirkung auf die Enden (Bibel §5 — Vorschlag)

Die Bilanz **färbt**, sie sperrt nie allein: Sie verschiebt je Fraktionsfigur eine Station (eine mehr oder eine weniger).

| Fraktion (Ende) | zählt | traut ab | Schlächter | Gemischt | Heiler |
|---|---|---|---|---|---|
| Enklaven (Zurückdrehen) | Anteil gereinigt an allen Eingriffen | ≥ 50 % | misstraut | neutral (36 %) | traut |
| Das Erbe (Übernehmen) | Macht: Hauptwaffe Stufe 3 oder Marke Stufe 3 | eines von beiden | traut | neutral | traut erst mit A6 (Stufe 3 bei 110) |
| Grüne Mönche (Vollenden) | Zurückhaltung: Anteil der Begegnungen **ohne** Eingriff | ≥ 50 % | misstraut (0 %) | misstraut (0 %) | traut knapp (57 % umgangen) |

Damit führt jede Spielweise zu einer anderen Tür, und keine öffnet alle drei: Wer alles tötet, ist dem Erbe recht; wer
reinigt, der Enklave; wer das Land in Ruhe lässt, den Mönchen. „Die Grünen Mönche zählen mit“ (Bibel §2) heisst dann:
Sie zählen **Eingriffe**, nicht Tote.

## 5. Was im Code liegt

| Wo | Was | Schalter |
|---|---|---|
| `src/kampf/echtzeit.ts` Abschnitt „Reinigen“ | `neueMarke`, `kannReinigen`, `setzeReinigenAn`, `loeseReinigen`, `reinigenFenster`, `reinigungsDauer`, Phase `reinigen`, `Kaempfer.reinigung`/`zustand`/`ausgang` | `Kampfwelt.marke` — ohne sie rechnet `simuliere` wie vor D376 (Test: gleiche Spur über 12 s; Kampfbot-Ausgabe über 117 Zeilen à 30 Kämpfe bytegleich mit dem Stand davor) |
| `content/reinigen.json`, `ReinigenDaten` in `src/data/schema.ts` | alle Werte | `npm run validate` |
| `tools/kampfbot.ts` | Bot mit Marke (`MarkenSpiel`: `immer`/`sicher`) | letzter Parameter von `kampf()`; ohne ihn unverändert |
| `tools/reinigensim.ts` | Messreihe und die drei Varianten | — |
| `tests/reinigen.test.ts` | 115 Prüfungen (D389: Daten je Gegner, Griffband, Schema, Auswertung) | `npm run test` |
| `content/gegner/*.json` `reinigen`, `GegnerReinigen` in `src/data/schema.ts` | D389: Kanaldauer und Griffdauer je Tier; `freiwillig` für den befallenen Menschen (D385) | `npm run validate` (jedes Tier trägt den Block, Griffzahl im Band) |

`phase === 'gefallen'` heisst seit D376 „aus dem Kampf“; ob besiegt oder gereinigt, steht in `Kaempfer.ausgang`. Die
Szene (`Kampfplatz.tsx`) kennt das noch nicht — sie setzt keine Marke und ist unverändert.

**Vorschlag für die Auftragsdaten (nicht angelegt, `content/auftraege` gehört gerade einem anderen Umbau):** ein
Auftragsziel `{ "art": "reinige", "kreatur": "<id>", "anzahl": n }` neben `besiege`, und für die Fraktionsfiguren
`{ "art": "bilanz", "mindestensGereinigt": 0.5 }`.

## 6. Dauer je Gegner (D389)

D379 liess offen, ob jedes Tier eine eigene Reinigungsdauer bekommt (genannt: Gams, Keiler). Seit D389 trägt jedes
reinigbare Tier in `content/gegner/<id>.json` einen Block `reinigen` (Schema `GegnerReinigen`): `dauer` ist der Kanal
über alle Griffe, `halten` die Dauer eines Griffs (ohne Angabe 1,2 s aus `content/reinigen.json`). Die Griffzahl folgt
daraus (`ceil(dauer / halten)`) und muss im bestätigten Band 3–6 liegen (`griffe` in `reinigen.json`, geprüft von
`npm run validate`). Die Grössenformel aus §2 gilt nur noch für Gegner ohne Block.

**Nicht reinigbar** bleiben Menschen (D385) und der Übungsgegner; das Schema lehnt `reinigen` bei ihnen ab. Die Ausnahme
aus D385 ist im Schema angelegt: `reinigen.freiwillig: true` an einem Menschen (Mönch im Endstadium). Einen solchen
Gegner gibt es in `content/gegner/` noch nicht; seine Dauer ist nicht gemessen.

**Regenten** haben keine Werte bekommen: `content/regenten/` beschreibt sie für den Rundenkampf (KP, Phasen, Moves), im
Echtzeitkampf gibt es keinen Regenten, an dem sich etwas messen liesse (§2 „Regenten (Entwurf, nicht gebaut)“).

### Werte und Herleitung

| Tier | Angriff (Vorlauf / Erholung / Schaden je Runde) | Tempo | `dauer` | `halten` | Griffe | vorher (Formel) | Warum |
|---|---|---|---|---|---|---|---|
| Keiler | 0,85 s / 1,0 s / 28, geht durch jeden Block | 2,4 m/s | **5,4 s** | 1,2 s | 5 | 6,33 s, 6 Griffe | Das schwerste Tier, aber das lesbarste: langer Vorlauf, lange Erholung. Mit 6,33 s kostete es +49 % Kampfdauer (über dem Richtwert), mit 5,0 s nur noch +23 % — 5,4 s hält es mit +34 % das teuerste Tier im Korridor |
| Grathorn | 0,60 s / 0,8 s / 24 | 2,4 m/s | **5,5 s** | 1,2 s | 5 | 5,50 s, 5 Griffe | Die Formel traf den Richtwert schon (+21 %); 6,0 s brächte +22 % bei mehr Schaden für den Müden. Unverändert, jetzt als Datum |
| Wolf | 0,50 s + Nachbiss 0,10 s / 0,9 s / 14 + 16 | 4,0 m/s | **4,25 s** | 1,2 s | 4 | 4,25 s, 4 Griffe | +22 % beim Aufmerksamen. Kürzer (3,6 s) fällt unter den Richtwert (+15 %), länger (4,8 s) kostet den Müden zehn Punkte Siegquote. Unverändert, jetzt als Datum |
| Fuchs | 0,40 s / 0,95 s / 10 | 4,5 m/s | **2,5 s** | 1,2 s | 3 | 3,00 s, 3 Griffe | Das kleinste und schnellste Tier: Jede Runde ist die am schwersten zu lesende, also so wenige wie das Band erlaubt. 3,0 s lagen mit +45 % über dem Richtwert; 2,5 s geben +37 % und dem Müden zwei statt drei Kanäle |
| Gams | 0,45 s / 0,7 s / 18, Rückstoss 0,9 m | 3,5 m/s | **4,0 s** | **1,6 s** | 3 | 4,67 s, 4 Griffe | Kürzeste Erholung aller Tiere und ein Stoss, der aus der Griffweite wirft: Das Fenster ist das engste, jede weitere Runde die teuerste. Deshalb wenige lange Griffe statt vieler kurzer — einziges Tier mit eigener Griffdauer. Müde 34 → 58 % Siege |

Tempo ohne Angabe in den Daten ist `GEGNER_KI.tempo` (Keiler, Grathorn). Die Kurve zu den Werten (je 150–200 Kämpfe, Klinge, Saat 5000…):
Keiler 6,33 / 5,4 / 5,0 / 4,5 s → +50 / +34 / +23 / +20 %; Fuchs 3,0 / 2,6 / 2,5 / 2,4 s → +45 / +39 / +38 / +38 %;
Gams mit 1,2-s-Griffen 3,6 / 4,67 / 6,0 s → −12 / −5 / +2 % (aufmerksam) bei 45 / 36 / 5 % Siegen (müde) — an der Gams
verschiebt die Dauer den Aufmerksamen kaum und den Müden stark.

### Messung

`npx tsx tools/reinigensim.ts 1000 gegner` — Kampfbot D171, Klinge, jedes Tier einzeln, Start 8 m, „immer reinigen“
gegen „töten“, **1.000 Kämpfe je Zelle, Saat 5000 + Kampfnummer** (Töten und Reinigen mit denselben Würfen),
22.11.2026. Spielerprofile sind die drei des Kampfbots: **aufmerksam** (Reaktion 0,25 s, 10 % Patzer), **müde**
(0,40 s, 25 %), **parierend** (0,25 s, 10 %, pariert statt zu rollen). „vorher“: dieselben Kämpfe mit der Grössenformel.

**Zielkorridor** (`ZIELKORRIDOR` in `tools/reinigensim.ts`): Kampfdauer **+20 … +40 %** für den Aufmerksamen (Richtwert
aus D376); **Annahme D389, nicht von Flo bestätigt:** höchstens 1,5× der Tötungszeit für jedes Profil, und Reinigen darf
gegenüber Töten höchstens 15 Punkte Siegquote kosten (riskanter, nicht aussichtslos).

| Tier | Profil | Siege töten → reinigen | Zeit töten → reinigen | gegen Töten | Schaden töten → reinigen | gereinigt | Kanäle | vorher (Formel) | Befund |
|---|---|---|---|---|---|---|---|---|---|
| Keiler | aufmerksam | 100 → 100 % | 17,9 → 24,0 s | +34 % | 10 → 12 (+3) | 100 % | 5,9 | +49 % | im Korridor |
| Keiler | müde | 100 → 99 % | 15,8 → 23,1 s | +46 % | 19 → 27 (+8) | 99 % | 5,4 | +64 %, Siege 98 % | im Korridor |
| Keiler | parierend | 100 → 100 % | 17,6 → 23,8 s | +36 % | 10 → 12 (+3) | 100 % | 5,8 | +51 % | im Korridor |
| Grathorn | aufmerksam | 100 → 100 % | 24,5 → 29,6 s | +21 % | 14 → 16 (+2) | 100 % | 5,7 | gleich | im Korridor |
| Grathorn | müde | 100 → 97 % | 18,0 → 24,7 s | +37 % | 43 → 54 (+11) | 97 % | 5,2 | gleich | im Korridor |
| Grathorn | parierend | 100 → 100 % | 11,5 → 15,9 s | +39 % | 37 → 41 (+4) | 100 % | 4,1 | gleich | im Korridor |
| Wolf | aufmerksam | 100 → 100 % | 15,7 → 19,2 s | +22 % | 16 → 17 (+1) | 88 % | 3,5 | gleich | im Korridor |
| Wolf | müde | 97 → 78 % | 9,1 → 11,5 s | +26 % | 46 → 58 (+12) | 34 % | 1,9 | gleich | **zu hart**; selten gereinigt |
| Wolf | parierend | 100 → 100 % | 5,6 → 5,6 s | ±0 % | 25 → 25 (±0) | 0 % | 0,0 | gleich | **nie gereinigt** (der Bot tötet vorher) |
| Fuchs | aufmerksam | 100 → 100 % | 11,5 → 15,9 s | +37 % | 8 → 12 (+4) | 100 % | 2,7 | +45 % | im Korridor |
| Fuchs | müde | 100 → 100 % | 4,1 → 6,7 s | +64 % | 12 → 19 (+7) | 100 % | 2,0 | +99 % | **über 1,5×** (absolut +2,6 s) |
| Fuchs | parierend | 100 → 100 % | 4,7 → 7,2 s | +55 % | 6 → 9 (+3) | 100 % | 2,0 | +72 % | **über 1,5×** (absolut +2,5 s) |
| Gams | aufmerksam | 100 → 100 % | 40,7 → 34,6 s | −15 % | 38 → 32 (−6) | 100 % | 3,0 | −6 % | **zu leicht**, nicht riskanter |
| Gams | müde | 77 → 58 % | 11,4 → 15,1 s | +32 % | 67 → 81 (+14) | 58 % | 2,3 | +42 %, Siege 34 % | **zu hart** (−19 Punkte) |
| Gams | parierend | 100 → 100 % | 9,1 → 11,5 s | +26 % | 26 → 24 (−2) | 100 % | 2,6 | +42 % | nicht riskanter (Schaden −2) |

Die Befundspalte folgt `bewerte` in `tools/reinigensim.ts`; die Regel „selten gereinigt“ kam nach dem Lauf dazu und ist
an denselben Zahlen abgelesen.

**Ergebnis.** Aufmerksam liegen vier von fünf Tieren im Richtwert (+21 … +37 %, vorher zwei); das Mittel über alle
fünf ist +20 % (vorher +26 %, getragen von Keiler und Fuchs über dem Band). Keiler, Grathorn und Fuchs werden in allen
drei Profilen zu 97–100 % gereinigt.

### Ausreisser

- **Gams — zugleich zu leicht und zu hart, und die Dauer ist nicht die Ursache.** Der aufmerksame Bot braucht zum
  Töten 40,7 s, der müde 11,4 s, der parierende 9,1 s: Wer sauber rollt, bringt in 0,7 s Erholung kaum einen Schlag an,
  wer Treffer nimmt oder pariert, schon. Gegen diese 40,7 s ist jede Reinigung „schneller als Töten“ (−15 %; mit
  7,2 s Kanal +2 %, dann gewinnt der Müde noch 20 %). Für den Müden ist die Gams das gefährlichste Einzeltier
  (Vorlauf 0,45 s gegen 0,40 s Reaktion): Jede weitere Runde kostet ihn oft einen Treffer von 18, deshalb drei lange Griffe. Das hebt
  ihn von 34 auf 58 % — gegen 77 % beim Töten bleibt es zu hart. Gegen die beiden anderen Profile (+32 %, +26 %) sitzt
  der Wert. **Der Hebel liegt an der Tötungszeit der Gams (Erholung 0,7 s) oder am Bot, nicht an `reinigen`** — beides
  sind geprüfte Kampfwerte und hier nicht angefasst.
- **Wolf — für den Müden zu hart, und kaum eine Reinigung:** 97 → 78 % Siege, nur 34 % gereinigt; der parierende Bot
  reinigt nie (0 Kanäle, der Wolf ist nach 5,6 s tot). Kürzere Dauer hilft wenig (3,6 s: 82 % Siege, 38 % gereinigt).
  Vermutete Ursache, nicht einzeln nachgewiesen: der Doppelbiss und der Schlag, der den Wolf über die Schwelle hinweg
  tötet (D376: „versehentlich getötet 12 %“ schon beim Aufmerksamen) — ein Thema der Schwelle oder des Bots, nicht
  der Dauer.
- **Fuchs — relativ zu lang für Müde und Parierende** (+64 %, +55 %), absolut 2,5 s und 3–7 Leben: Diese Profile töten
  ihn in 4–5 s, und zwei Kanäle sind das Minimum, das drei Griffe erlauben. Unter 1,5× käme er nur mit zwei Griffen —
  ausserhalb des bestätigten Bands.
- **Keiler — vorher der Ausreisser nach oben (+49 %), jetzt im Korridor.** Er bleibt mit 5,9 Kanälen das Tier mit den
  meisten Runden.

### In der Gruppe

`npx tsx tools/reinigensim.ts 300 empfohlen` (300 Kämpfe je Zeile, aufmerksam, Klinge, Saat 5000…) gegen die Zeilen
aus §3 (1.000 Kämpfe, Grössenformel — heute `… 1000 formel`):

| Aufstellung | Modus | Siege | Zeit gegen Töten | Schaden gegen Töten | gebrochen | vorher (§3) |
|---|---|---|---|---|---|---|
| wolf+fuchs | immer | 96 % | +22 % | +27 | 8 % | 95 %, +28 %, +32, 9 % |
| wolf+fuchs | gemischt | 100 % | +20 % | +3 | 0 % | 100 %, +20 %, +3 |
| gams+gams | immer | 100 % | −21 % | +14 | 12 % | 99 %, +17 %, +6, 1 % |
| gams+gams | gemischt | 100 % | −16 % | −6 | 0 % | 99 %, −5 %, −2 |
| keiler+grathorn | immer | 99 % | +66 % | +9 | 0 % | 99 %, +92 %, +13 |
| keiler+grathorn | gemischt | 100 % | +19 % | +3 | 0 % | 100 %, +18 %, +3 |
| wolf+fuchs+fuchs | immer | 93 % | +4 % | +27 | 14 % | 90 %, +12 %, +32, 15 % |
| wolf+fuchs+fuchs | gemischt | 95 % | +10 % | +2 | 0 % | 95 %, +11 %, +2 |

Wolf-Rudel ohne Fuchs sind unverändert (gleiche Werte; 300 Kämpfe: zwei Wölfe 91 %, drei 70 % Siege bei „immer“).
**Keiler + Grathorn** fällt von +92 % auf +66 % (14 statt 17 Kanäle) und bleibt die längste Zeile. **Zwei Gämsen**
zeigen die Kehrseite des langen Griffs: 12 % der Kanäle bricht jetzt ein Treffer (vorher 1 %), der Mehrschaden steigt
von +6 auf +14 — im Rudel ist die Gams damit riskanter als vorher, die Zeit bleibt wegen der Tötungszeit des Bots
unter null. Kein Rudel wird aussichtslos (Siege „immer“ 91–100 % zu zweit, 70–93 % zu dritt).

Die Tabelle in §3 und die Belohnungsrechnung in §4 (Annahme A2) stehen auf dem Stand D376 (Grössenformel) und sind
nicht neu gerechnet.

### Offen (Ledger A-24)

1. Gams: 4,0 s in drei Griffen zu 1,6 s (gesetzt) oder die alte Formel (4,67 s, vier Griffe zu 1,2 s) — und ob die
   Gams selbst nachgemessen wird (Tötungszeit 40,7 s gegen 9–11 s je nach Profil).
2. Fuchs: bei drei Griffen bleiben (gesetzt) oder zwei erlauben.
3. Zielkorridor: Obergrenze 1,5× und „höchstens 15 Punkte Siegquote“ sind Annahmen.
4. Wolf und Müde: Schwelle oder Bot, nicht Dauer.
5. Regenten und der freiwillig befallene Mönch: keine Werte, weil es beide im Echtzeitkampf nicht gibt.

Alle Werte sind Bot-Messung, nichts davon am Gerät gespielt.
