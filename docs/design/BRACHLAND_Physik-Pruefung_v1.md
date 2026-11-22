---
last-reviewed: 2026-11-22
shelf-life-days: 180
---
# BRACHLAND — Physik-Prüfung der Bewegungs- und Weltwerte v1

> **D408, Prüfung mit Rechnung, kein Spielwert geändert.** Auftrag aus D398 (Flo, 22.11.2026: „Physik muss stimmen“ —
> Abweichungen zugunsten des Spiels benannt und begründet, nie still). Geprüft sind alle Bewegungs- und Weltwerte im
> Code, in den Daten und in den Entwürfen (Traversal v2, Quests v1 §2.7, Gegenstände v1 §11/§13.5, Weg nach Brannburg).
> Offen/erledigt steht im Ledger (`../_INDEX.md` D408, Fragen A-34), nicht hier. Rechnungen:
> `python3 tools/physik_pruefung.py` (numpy, nicht im Gate). **Nicht am M1 gesehen, nichts gespielt** — ob sich ein
> Tempo richtig anfühlt, entscheidet erst der Lauf dort (ADR-0005).
>
> **Stand D412 (22.11.2026):** Flo hat A-34 mit „ja“ entschieden (D411); umgesetzt in D412. Die Bewegungswerte stehen
> seit D412 in `content/bewegung.json` (Schema `Bewegung`, je mit Realwert und Begründung), Fall, Endgeschwindigkeit
> und Kälteuhr in `src/spieler/bewegung.ts` (`tests/bewegung.test.ts`). **Neun der zehn Fehler sind behoben**, einer
> bleibt offen (Tempo von Keiler und Grathorn, §4.8 — ein Kampfwert, nicht Teil von D411). Die Liste der benannten
> Abweichungen (§3) ist auf den neuen Stand gezogen; ersetzte Werte sind durchgestrichen. Weiter gilt: nicht am M1
> gesehen, nichts gespielt.

## 1. Ergebnis

| Urteil | Anzahl | Was |
|---|---|---|
| **stimmt** | 9 | Schwerkraft, Körpergrösse, Schwimmtiefe, Vorwärtstempo am Gleiter, Pfeil- und Bolzentempo, Geschossmassen, Wassertiefen, Verhältnis Waten zu Gehen |
| **bewusste Abweichung** (jetzt benannt, Liste §3) | 22 | Geh- und Renntempo, Sprung, Klettern, Schwimmen, Gleitzahl, Erholung, Tageslänge, Kampftempo der Tiere, Ladezeiten, Traglast |
| **Fehler** | 10 | Tauchtempo 6 m/s; „Tauchweg direkt 1.586 m“ (liegt auf dem Trockenen); Reiten auf dem 140-kg-Keiler; Gleitschirm nach 18 Jahren im Freien; kein Fallschaden; keine Endgeschwindigkeit trotz Kommentar; Sprungweite 12 m aus dem Rennen; Keiler langsamer als ein Mensch; Luftvorrat „13 Minuten“ ohne Arbeit und Reserve; Begründung „Schwimmen endet nach Minuten“ |
| → **behoben (D412)** | 9 | Tauchtempo (2,25 m/s, Entwurf); Tauchweg (1.863–2.364 m, „Weg ohne Kampf“); Reittier (Tragtier des Försterhofs, Entwurf); Gleitschirm (geborgene Leinen, neu genähte Kappe); Fallschaden; Endgeschwindigkeit 53 m/s; Sprungweite (9,4 m bei 8,5 m/s); Luftvorrat (Vorrat für Abstiege); Begründung Schwimmen (Quests v1 §2.7.3) |
| → **offen** | 1 | Keiler und Grathorn laufen mit 2,4 m/s langsamer als jeder Mensch (§4.8) — Kampfwert, verschiebt die Bot-Messungen, nicht in D411 entschieden |
| **offen** (real nicht belegt) | 6 | Tempo im Waten, Steigungsgrenzen zu Fuss und im Sattel, Füllzeit der Flut, Gerätegewichte, Rolle |

**Das Muster:** Die Figur bewegt sich an Land dreimal so schnell, wie ein Mensch geht (4,2 gegen 1,4 m/s), springt
dreimal so hoch und schwimmt dreimal so schnell wie ein Bekleideter. Das ist ein durchgehender **Spielfaktor 3** und
als solcher vertretbar. Vier Werte liegen weit darüber und fallen deshalb auf: Rennen (×7,9, schneller als der
100-m-Weltrekord, ohne Ermüdung), Klettern (×10 und mehr, zwei Drittel des Weltrekords im Speedklettern an jedem
Fels), Reiten (61 km/h als Dauertempo) und das Tauchtempo aus dem Entwurf (×12). Die Tiere dagegen sind im Kampf
drei- bis fünfmal **langsamer** als in echt. Zusammen heisst das: Der Brachgänger hängt rennend jeden Wolf ab.

**D380 hält nicht als Abkürzung, nur als Umgehung** (§4.1): Der Wasserweg zum Wehr ist länger als der Uferweg und
Wasser ist langsamer — bei jedem Tempo, das denselben Faktor wie das Gehen hat.

## 2. Bestand gegen Wirklichkeit

Quellen `[Qn]` in §6. „nicht belegt“ heisst: In dieser Recherche fand sich keine belastbare Quelle; der Wert ist dann
eine Einschätzung und so gekennzeichnet. Zeilennummern Stand `claude/epic-planck-86z6fy`, 22.11.2026, **vor D412**
(in D412 nachgesehen: sie stimmten). Seit D412 stehen Rennen, Reiten, Klettern, Gleiter, Fall, Kälte und die Entwürfe
Tauchen und Tragtier in `content/bewegung.json`; die Spalte „Urteil“ nennt den neuen Stand.

### 2.1 Im Code und in den Daten

| # | Wert | Bestand | Wo | Real | Urteil | Vorschlag |
|---|---|---|---|---|---|---|
| 1 | Gehen | 4,2 m/s (15 km/h) | `src/spieler/tempo.ts:35` | bevorzugtes Gehtempo 1,2–1,4 m/s [Q1]; 4,2 m/s ist ein Dauerlauf — Cooper-Test „gut“ 2.400–2.800 m in 12 min = 3,3–3,9 m/s [Q2] | **bewusst**, ×3 (G-27, D18) | bleibt. Benennen als „Laufschritt“, nicht als Gehen |
| 2 | Rennen | ~~11,0 m/s (39,6 km/h)~~ **8,5 m/s (30,6 km/h)**, zehrt nicht | `tempo.ts:36`, `src/spieler/ausdauer.ts:7–14`; seit D412 `content/bewegung.json` `laufen` | 100-m-Weltrekord im Mittel 10,44 m/s, Spitze 12,3–12,4 m/s [Q3]; Sprint mit Marschlast: nicht belegt | **bewusst** (G-27, D55), ~~×7,9 — aber über dem Weltrekord und auf Dauer~~ **geändert D412:** ×6,1 zum Gehen, unter dem Weltrekord | ~~§4.7: am M1 8,5 und 7,0 probieren~~ am M1 `?renntempo=7` gegen den Standard 8,5 laufen |
| 3 | Schwerkraft | 9,81 m/s² | `tempo.ts:39` | 9,81 | **stimmt** | — |
| 4 | Sprunghöhe | 1,49 m (Absprung 5,4 m/s) | `tempo.ts:40`, `:43` | Standhochsprung Erwachsene 41–50 cm, Profi-Basketballer 35–39 cm (andere Messart) [Q4] | **bewusst**, bisher still, ×3–4 | bleibt (passt zum Faktor 3); benannt in §3 |
| 5 | Sprungweite | 4,6 m aus dem Gehen, **12,1 m aus dem Rennen** (Flugzeit 1,10 s) | abgeleitet aus `tempo.ts:36`, `:40` | Standweitsprung „sehr gut“ über 2,5 m [Q4]; Weltrekord Weitsprung 8,95 m (hier nicht belegt) | **Fehler** — Folge von Zeile 2, niemand hat 12 m gewollt → **behoben (D412)** mit dem Renntempo: 9,4 m (bei `?renntempo=7` 7,7 m) | sinkt mit dem Renntempo (8,5 m/s → 9,4 m; 7,0 m/s → 7,7 m); sonst im Sprung auf Gehtempo begrenzen |
| 6 | Fallhöhe ohne Schaden | unbegrenzt — es gibt keinen Fallschaden | `src/scenes/RegionsSzene.tsx:3385–3389` | Stürze über 1,5 m vervierfachen das Verletzungsrisiko (Kinder, Spielplatz); halbe Sterblichkeit bei 12–15 m [Q5] | **Fehler** — nirgends als Absicht vermerkt → **behoben (D412):** schadlos bis 4,5 m, tödlich ab 15 m, Rolle halbiert; gemessen am Aufprall (`src/spieler/bewegung.ts` `fallschaden`). Folge im Spiel heute nur „tödlich“ (Aufwachen in der Zuflucht), weil es ausserhalb des Kampfs kein Leben gibt | §4.6 |
| 7 | Endgeschwindigkeit im Fall | Kommentar „bis zu 50 m/s“, im Code keine Grenze | `src/spieler/gleiten.ts:52`, `RegionsSzene.tsx:3385` | Grössenordnung 50–55 m/s in Bauchlage (hier nicht belegt) | **Fehler**, klein — Kommentar und Code widersprechen sich; greift erst ab rund 140 m freiem Fall → **behoben (D412):** 53 m/s, `begrenzeFall` in der Bildschleife, `fallgeschwindigkeit` gedeckelt | Diff in §5 |
| 8 | Klettertempo | ~~2,2 m/s (7.920 m/h)~~ **1,0 m/s** | `RegionsSzene.tsx:3068`; seit D412 `content/bewegung.json` `klettern`, über `tempo.ts` `KLETTERN_TEMPO` | Weltrekord Speedklettern 15 m in 4,64 s = 3,2 m/s an genormter Wand; Seilschaft 20–30 min je Seillänge ≈ 0,02–0,03 m/s [Q8]; freies Steigen im leichten Fels: nicht belegt | **bewusst**, ~~bisher still, ×10 und mehr — der grösste Faktor im Bestand~~ **geändert D412:** Faktor 3 auf rund 0,3 m/s, benannt (§3) | §4.5: 1,0 m/s bei gleicher Reichweite — umgesetzt |
| 9 | Kletterausdauer | ~~16/s = 6,25 s~~ **rund 7,3/s = 13,75 s** = 13,8 m Wand (D412, aus der Reichweite gerechnet) | `ausdauer.ts:31` | Sekundenmass ohne reale Entsprechung | **bewusst** (im Code begründet: höchste Klippe 14 m) | D391: halbieren nach Messung der Wandhöhen |
| 10 | Steigungsgrenze zu Fuss | 40°, Stufen bis 0,9 m ohne Klettern | `RegionsSzene.tsx:3093`, `:3080` | nicht belegt; 40° Grashang geht real nur mit Händen | **offen** | — |
| 11 | Tempo bergauf | wie in der Ebene | `RegionsSzene.tsx:3293–3302` | 300 Höhenmeter je Stunde (Wanderformel, Quests v1 §2.7); im Spiel 3.252 Hm/h zum Oberstollen | **bewusst**, ×11 im Anstieg (Quests §2.7 hatte es als ungeprüft markiert — geprüft: Steigung bremst nicht) | bleibt vorerst; ein Bremsen ab 25° wäre die billigste Art, dem Almweg sein Gewicht zu geben |
| 12 | Waten | ab 0,30 m, 1,9 m/s, 7/s | `RegionsSzene.tsx:3108–3110` | nicht belegt; 45 % des Gehtempos | **stimmt** im Verhältnis | — |
| 13 | Waten, absolut | 1,9 m/s | ebd. | schneller als ein Mensch trocken geht (1,4) | **offen** — folgt dem Faktor 3 | — |
| 14 | Schwimmen ab | 1,35 m Tiefe | `RegionsSzene.tsx:3125` | Brusthöhe bei 1,80 m Körpergrösse | **stimmt** | — |
| 15 | Schwimmtempo | 1,6 m/s | `RegionsSzene.tsx:3126` | Freizeitschwimmer 0,67–0,83 m/s; Kleidung kostet rund 31 % [Q7]; bekleidet in 12 °C: 815 m in 39 min = 0,35 m/s [Q7] | **bewusst**, bisher still, ×2–4,6 | bleibt (Faktor 3 auf 0,5 m/s) |
| 16 | Schwimmausdauer | 9/s = 11 s = 17,8 m | `RegionsSzene.tsx:3127` | bekleidet in 12 °C im Mittel 815 m (Streuung ±482 m) [Q7] | **bewusst** (Traversal v2 §3: Grundbewegung in Grenzen), 1/46 der realen Strecke | bleibt |
| 17 | Treiben | 0,72 m/s ohne Ende, kein Ertrinken, keine Kälte | `RegionsSzene.tsx:3293–3296` | Kälteschock in der ersten Minute, Schwimmversagen nach 2–30 min, Bewusstlosigkeit nach rund einer Stunde [Q6] | **bewusst** („Ertrinken bestraft Erkundung“) — die Kälte fehlt aber still → **geändert D412:** Kälteuhr im tiefen Wasser (Leben sinkt nach 4 min, leer nach 10), Ufer setzt zurück, Tauchzeug als Anzug hält sie an | §4.4 |
| 18 | Gleitzahl | 3 : 1 | `gleiten.ts:50` | Freizeitschirm 9,3, Wettkampf 11,3; Wingsuit 2,5–3 [Q11] [Q12] | **bewusst** (D71, gemessen: 4 : 1 macht die Karte zur Kulisse), ein Drittel von real — seit D411 begründet in der Welt (geborgene Leinen, neu genähte Kappe) | bleibt; §4.3 gibt ihr einen Grund in der Welt — umgesetzt (`gleiter.json`) |
| 19 | Sinkrate | 4,0 m/s | `gleiten.ts:53` | 1,0–1,2 m/s (aus Trimmtempo und Gleitzahl gerechnet) [Q11] | **bewusst**, ×3,6 — Folge von Zeile 18 | bleibt; Landung mit 4 m/s entspricht einem Sprung aus 0,82 m und ist unter Fallschirm-Sinkraten (bis 4,3 m/s) [Q5] |
| 20 | Vorwärtstempo am Gleiter | 12,0 m/s (43 km/h) | `gleiten.ts:56` | Trimm 32–40 km/h, Bereich 22–55 km/h [Q11] | **stimmt** | — |
| 21 | Gleiter öffnet von selbst | ab 3,0 m Fallhöhe | `gleiten.ts:66` | ein Schirm wird am Boden aufgezogen und trägt ab dem Abheben; Öffnen im Fall: nicht belegt | **bewusst** (D71: kein eigener Knopf) | bleibt, benannt |
| 22 | Reittempo | ~~7,5 / 17,0 m/s (27 / 61 km/h)~~ **5 / 13 m/s (18 / 47 km/h)** (D412) | `src/spiel/reiten.ts:36–37`; seit D412 `content/bewegung.json` `reiten` | Wildschwein Spitze 40–48 km/h [Q15]; Maultier unter Last 32 km am Tag [Q14]; Pferdegalopp: nicht belegt | **bewusst** (×1,55 zum Rennen) — 61 km/h auf Dauer liegt über dem Sprint jedes Tiers der Welt → **geändert D412:** ×1,53 zum Rennen, 13 m/s im Sprintbereich | folgt dem Renntempo: 5 / 13 m/s — umgesetzt |
| 23 | Wer trägt | Vierbeiner ab 1,2 m Widerrist | `reiten.ts:24`, `:33` | 20 % des Körpergewichts als Grenze, 25–30 % belasten messbar [Q14] | **bewusst** — die Schwelle selbst ist brauchbar (§4.2), der Entwurf dazu nicht (Zeile 42) | §4.2 |
| 24 | Steigung im Sattel | 52° | `reiten.ts:48` | nicht belegt | **offen** | — |
| 25 | Erholung der Ausdauer | 26/s nach 0,7 s — voll in 3,8 s | `ausdauer.ts:37`, `:46` | Minuten (hier nicht belegt) | **bewusst** (im Code begründet: „kurz genug, um nicht zu warten“) | bleibt |
| 26 | Tageslänge | 24 min | `src/main.tsx:129` | 24 h | **bewusst** (D178), ×60 — Wege laufen ×3, die Uhr ×60: der Almweg dauert auf der Spieluhr 8 Stunden | bleibt; kein Text nennt Stunden (Quests §2.7) |
| 27 | Tempo der Tiere im Kampf | Fuchs 4,5 · Wolf 4,0 · Gams 3,5 · Keiler und Grathorn 2,4 m/s | `content/gegner/fuchs.json:17`, `wolf.json:32`, `gams.json:18`, `src/kampf/echtzeit.ts:439` | Fuchs 48–50 km/h, Wolf 45–60 km/h [Q17]; Wildschwein 40–48 km/h [Q15]; Gams rund 50 km/h (schwach belegt) | **bewusst** als Kampftempo, bisher still: ein Drittel bis ein Fünftel von real | §4.8 |
| 28 | Keiler gegen Mensch | Keiler 2,4 m/s, Menschen 2,6–3,0 m/s | `echtzeit.ts:439`, `content/gegner/axtmann.json:18`, `wegelagerer.json:33` | ein Wildschwein ist dreimal so schnell wie ein rennender Mensch | **Fehler** — Rangfolge verkehrt, Keiler und Grathorn haben nur die Vorgabe. **Offen nach D412** (Kampfwert, nicht in D411 entschieden) | §4.8: eigener Wert, mindestens Wolf |
| 29 | Rolle | 3,8 m in 0,55 s (6,9 m/s) | `echtzeit.ts:210` | nicht belegt | **offen** — Gattungsregel (ADR-0007) | — |
| 30 | Stoss der Marke, Flutstoss | wirft 3 m zurück | `content/wirken.json` (`stoss`), `echtzeit.ts:232` | keine Entsprechung | **bewusst** — Fiktion der Welt | — |
| 31 | Pfeil | 55 m/s, 30 g | `content/waffenfamilien.json` (`fernkampf`) | Langbogen 50–55 m/s; 80-lb-Eibe: 50-g-Pfeil 53 m/s [Q18] | **stimmt** | — |
| 32 | Bolzen | 65 m/s, 70 g | ebd. | moderne 90-lb-Armbrust 62 m/s [Q18] | **stimmt** | — |
| 33 | Bogen spannen | 0,9 s | ebd. (`spannenReal`: 1–2 s) | Quelle der Realangabe hier nicht belegt | **bewusst**, benannt (D405) | — |
| 34 | Armbrust laden | 6 s | ebd. (`spannenReal`: 15–60 s) | Quelle der Realangabe hier nicht belegt | **bewusst**, benannt (D405, ADR-0019), ×2,5–10 | — |
| 35 | Wassertiefen | Fluss 1,6 · Bach 0,85 · Graben 0,45 · Weiher 2,4 m | `src/world/wasserfeld.ts:31`, `:41` | ortsabhängig; für Gebirgsbach und Weiher plausibel | **stimmt** | — |
| 36 | Fluttiefe | Flutlinie 499 m; Kirchturm 15,6 m unter Wasser; Wasserweg am Ufer im Mittel 1,7 m | `content/regions/oental.json:31`, Messung | Füllzeit „in Tagen“ (Quests §2.7.4): 3,73 km² × rund 8 m ≈ 30 Mio. m³, bei 50 m³/s eine Woche — Abfluss des Flusses nicht belegt | **offen** | — |
| 37 | Figur | 1,8 m; Kampfkapsel 1,7 m hoch, 0,4 m Radius | `content/massstab.json` (`figur`), `echtzeit.ts:212` | Frauen 1,66 m, Männer 1,79 m (Destatis, in `massstab.json`) | **stimmt** | — |
| 38 | Geschossmassen, Reichweiten der Hiebe | 30–70 g; 1,8–3,0 m | `waffenfamilien.json`, `content/gegner/*.json` | Testpfeile 50–90 g [Q18]; Speer 3,0 m mit Ausfall plausibel | **stimmt** | — |

### 2.2 Nur im Entwurf

| # | Wert | Bestand | Wo | Real | Urteil | Vorschlag |
|---|---|---|---|---|---|---|
| 39 | Tauchtempo | ~~rund 6 m/s~~ **2,25 m/s** (Entwurf) | Traversal v2 §4; seit D412 `content/bewegung.json` `tauchen` | Taucher mit Gerät 0,26–0,5 m/s, im Versuch höchstens 1,0 m/s (1,9 kn) [Q9] | **Fehler**, ×12–23 → **behoben (D412)**, Faktor 3 auf 0,75 m/s; Tauchen gibt es im Code nicht | §4.1: 2,25 m/s (0,75 m/s × Faktor 3) |
| 40 | Tauchweg zum Wehr | ~~„1.586 m direkt“~~ **1.863–2.364 m, „der Weg ohne Kampf“** | Traversal v2 §4, §7; D388 | die Gerade Abstieg → Wehr liegt zu 97 % auf dem Trockenen; der kürzeste Weg durchs Wasser misst 1.863 m (am Ufer entlang), über den Kirchturm 2.364 m | **Fehler** (Luftlinie statt Wasserweg) → **behoben (D412)** in Traversal v2 §4, §6, §7, Bibel §4, Quests §2.7 | §4.1 |
| 41 | Luftvorrat | „rund 13 Minuten“ → Vorrat für Abstiege | Gegenstände v1 §11; seit D412 `content/bewegung.json` `tauchen` | 2 l × 200 bar = 400 l; 20–25 l/min in Ruhe [Q10]. Mit 50 bar Reserve und Arbeit (40 l/min): 5,0 min in 5 m, 2,9 min am Kirchturm | **Fehler** in der Annahme (Ruhe, keine Reserve) — die Rechnung selbst stimmt → **behoben (D412)** in Gegenstände v1 §11 und den Daten | §4.1: Luft ist ein Vorrat für Abstiege, nicht für die Strecke |
| 42 | Reittier | ~~gereinigter Wurzelkeiler, 140 kg~~ **das letzte verwilderte Tragtier des Försterhofs, 450–500 kg** (Entwurf) | D391, Traversal v2 §5; seit D412 `content/bewegung.json` `tragtier` | trägt bei 20 % 28 kg; Reiter mit Zeug 90 kg verlangen 450 kg [Q14] | **Fehler** → **behoben im Entwurf (D412)**; `validate` prüft die Traglast. ~~Im Code trägt weiter jeder Vierbeiner ab Mutation 2~~ **Seit D413 auch im Code:** `traegt()` lässt nur das tragfähige Tragtier tragen; die alte Regel nur hinter `?reitprobe=1` | §4.2 |
| 43 | Gleitschirm | hing 18 Jahre in einem Geweih, „die Nähte halten“ → Leinen geborgen, Kappe neu genäht | D391, `content/gegenstaende/gleiter.json` | UV und Wetter machen das Tuch durchlässig und schwach; Wartung nach 100 Stunden Sonne empfohlen [Q13] | **Fehler** → **behoben (D412)**, Text nach §5 (b) | §4.3 |
| 44 | Gerätegewichte | Tauchzeug 5,0 · Kletterzeug 4,5 · Gleiter 8,0 · Halfter 0,5 kg | `content/gegenstaende/*.json` (`gewicht`) | plausibel, nicht belegt | **offen** | — |
| 45 | Traglast | rund 36 kg, Werkzeuge wiegen im Spiel nichts | Gegenstände v1 §11 | Gefechtslast 22 kg (30 % des Körpergewichts), Marschlast 33 kg (45 %) [Q19] | **bewusst**, benannt — 36 kg sind eine Marschlast, kein Zustand zum Fechten und Rollen | — |
| 46 | „Schwimmen endet nach Minuten, nicht nach Metern“; 380 m zur Kapelle „nicht plausibel“ | Begründung | Quests v1 §2.7.3 | geübte Schwimmer schaffen bekleidet in 12 °C im Mittel 815 m in 39 min [Q7] — 380 m sind real 18 min und für einen guten Schwimmer machbar | **Fehler** in der Begründung; die Regel (D391: Kapelle erst nach dem Wandel) braucht sie nicht → **behoben (D412)** in Quests v1 §2.7.3 | §4.4 |
| 47 | Heilung, Brauen, Wachstum | sofort | Gegenstände v1 §11, §13.5 | Tage bis Wochen | **bewusst**, dort benannt | — |

## 3. Benannte Abweichungen — die Liste

Damit gilt D398 („benannt und begründet, nie still“) für die Bewegung. Faktor = Spiel geteilt durch real.
**Stand D412:** Werte nach den Entscheidungen D411; ersetzte Zahlen durchgestrichen, neue Zeilen am Ende markiert.
Jeder Wert steht mit `real` und `warum` auch in `content/bewegung.json`.

| Was | Spiel | Real | Faktor | Warum | Benannt seit |
|---|---|---|---|---|---|
| **Spielfaktor Bewegung** | Laufschritt 4,2 m/s als Grundtempo | Gehen 1,4 m/s | 3 | Region 4 km breit, sonst reine Wartezeit; die **Strecken** sind 1 : 1 | G-27, D18 |
| Rennen ohne Ermüdung | ~~11,0~~ **8,5** m/s, unbegrenzt | Gehen 1,4 m/s; 100-m-Weltrekord 10,44 m/s | ~~7,9~~ **6,1** (0,81 des Weltrekords) | wie oben; Ausdauer aufs Rennen ergäbe Stop-and-Go (D55) | G-27, D55 — ~~Rückgang offen (A-34)~~ **Rückgang entschieden D411, umgesetzt D412**; am M1 gegen 7,0 (`?renntempo=7`) |
| Kein Tempoverlust bergauf | 3.252 Hm/h | 300 Hm/h | 11 | nie entschieden; Quests v1 §2.7 führt den Almweg deshalb erzählerisch als halben Tag | D408 |
| Sprunghöhe | 1,49 m | 0,4–0,5 m | 3–4 | Gelände lesbar machen: Stufen bis Brusthöhe ohne Klettern | D408 |
| Klettertempo | ~~2,2~~ **1,0** m/s | unter 0,3 m/s; Weltrekord 3,2 m/s | ~~10+~~ **rund 3** | ~~nie entschieden; Wert stammt aus dem ersten Wurf~~ Faktor 3 wie die übrige Bewegung | D408 — ~~Vorschlag 1,0 m/s (§4.5)~~ **D411, umgesetzt D412** |
| Kletterausdauer | ~~6,25 s~~ **13,75 s** je Leiste, 13,75 m Wand | keine Entsprechung | — | höchste Klippe (14 m) soll gerade nicht in einem Zug gehen | Code, D388; Reichweite unverändert seit D412 in den Daten |
| Schwimmtempo | 1,6 m/s | 0,35–0,8 m/s | 2–4,6 | Faktor 3 | D408 |
| Schwimmstrecke | 17,8 m je Leiste | Hunderte Meter | 1/46 | Grundbewegung in Grenzen, das Werkzeug hebt sie auf | Traversal v2 §3 |
| Kein Ertrinken, ~~keine Kälte~~ **Kälteuhr** | Treiben ohne Ende; **seit D412:** Leben sinkt nach 4 min im tiefen Wasser, leer nach 10 min; das Ufer setzt sie **sofort** zurück (real dauert Aufwärmen, benannt D413) | Schwimmversagen nach Minuten bis einer halben Stunde; Bewusstlosigkeit nach rund 1 h | ~~—~~ **1/3** (10 gegen rund 30 min) | „Ertrinken bestraft Erkundung“ — ertrinken weiter nicht, auskühlen schon; Zeitfaktor 3 | Code — ~~Kälte offen (A-34)~~ **D411, umgesetzt D412** |
| Gleitzahl und Sinkrate | 3 : 1, 4,0 m/s | 9,3 : 1, 1,1 m/s (heiler Schirm) | 1/3 | bei 4 : 1 trägt ein Flug die halbe Region (D71); **seit D411 begründet in der Welt:** geborgene Leinen, Kappe neu genäht aus gewachstem Leinen — gleitet schlecht, sinkt schnell (ob genau diese Werte: nicht belegt) | D71, Gegenstände v1 §11, D411 |
| Gleiter öffnet im Fall | ab 3 m, von selbst | Start nur mit aufgezogener Kappe | — | kein eigener Knopf (Handy-Bedienung, D71) | D71 |
| Reittempo | ~~17~~ **13** m/s auf Dauer, Schritt 5 m/s | Sprint 11–13 m/s | ~~1,3–1,5~~ **1,0–1,2** | spürbar schneller als Rennen (×1,53) | D408 — folgt dem Renntempo, **umgesetzt D412** |
| Erholung | 3,8 s | Minuten | — | nicht warten müssen | Code |
| Tageslänge | 24 min | 24 h | 60 | ein Abend dauert gut fünf Minuten (D178) | D178 |
| Kampftempo der Tiere | 2,4–4,5 m/s | 11–16 m/s | 1/3–1/5 | Kämpfe bleiben lesbar und umgehbar (D374: kein Ziel hart verschlossen) | D408 |
| Laden und Spannen | Armbrust 6 s, Bogen 0,9 s | 15–60 s, 1–2 s | 2,5–10 | sonst kein Schuss im Kampf | D405 |
| Traglast | 36 kg ohne Folge | 22 kg zum Kämpfen | 1,6 | begrenzt wird nur, was eine Entscheidung trägt | Gegenstände v1 §11 |
| Zustand von Tauchgerät und Seil nach Jahrzehnten | brauchbar | nicht belastbar | — | Werkzeuge sollen Fundstücke sein | Gegenstände v1 §11 |
| Sofortige Heilung, Brauen, Kultur | sofort | Tage bis Wochen | — | Gattungsregel | Gegenstände v1 §11, §13.5 |
| **Neu D412:** Fallschaden ab 4,5 m | schadlos bis 4,5 m, tödlich ab 15 m, Rolle halbiert | Verletzungsrisiko steigt ab 1,5 m; halbe Sterblichkeit bei 12–15 m | 3 bis zur Schwelle, 1 beim Tod | dieselbe Figur springt 1,49 m hoch und landet daraus (Faktor 3 der Beine); Knochen haben keinen Faktor | D411, D412 |
| **Neu D412:** Endgeschwindigkeit als harte Grenze | 53 m/s ab rund 143 m, davor freier Fall ohne Luftwiderstand | Annäherung an 50–55 m/s (nicht belegt) | unter 140 m etwas zu schnell | eine Zeile Code statt eines Widerstandsmodells; ändert nur Fälle, die ohnehin tödlich sind | D412 |
| **Neu D412:** Tauchtempo (Entwurf) | 2,25 m/s | 0,26–0,5, höchstens 1,0 m/s | 3 auf 0,75 | Faktor 3 der Bewegung | D411, D412 |
| **Neu D412:** Luft an der Rast nachgefüllt (Entwurf) | Flasche voll nach jeder Rast | ohne Kompressor füllt sie niemand | — | Luft ist ein Vorrat für Abstiege; ohne Nachfüllen gäbe es nur drei bis vier Abstiege im Spiel | D411, D412 |
| **Neu D412:** Rauch beruhigt den Befall | Räucherkanne öffnet das Griff-Fenster | Rauch beruhigt nur Bienen | — | Setzung über die Welt (Story-Bibel v2 §2): der Symbiont antwortet wie ein Bienenvolk | D410, D411 |

**Regel für neue Werte:** Bewegung darf den Faktor 3 haben, ohne eigene Begründung. Was darüber liegt, braucht eine
Zeile in dieser Liste. Was Gewicht, Tragfähigkeit, Material und Wasser betrifft, hat **keinen** Faktor — dort gilt 1 : 1.

## 4. Problemfälle

### 4.1 Tauchen und der Weg zum Flussvater (D380, D393)

**Befund 1 — den geraden Tauchweg gibt es nicht.** Traversal v2 misst „1.586 m direkt“ als Luftlinie Abstieg → Wehr.
Diese Linie liegt zu 97 % auf dem Trockenen: Das Wehr steht am Westufer, die Gerade läuft den Hang entlang.

| Weg | zu Fuss ans Wasser | im Wasser | mittlere / grösste Tiefe |
|---|---|---|---|
| Uferweg (D375) | — | 0 m (1.681 m zu Fuss) | — |
| Wasserweg am Ufer entlang, Abstieg → Wehr | 77 m | **1.863 m** | 1,7 / 3,9 m |
| Wasserweg über den Kirchturm („durch die versunkene Stadt“) | 77 m | **2.364 m** (944 + 1.420) | 9,6 / 16,9 m |

Kürzeste Wege nur über Rasterzellen unter der Flutlinie; das Wasser endet 45 m vor dem Wehr.

**Befund 2 — Wasser ist bei jedem ehrlichen Tempo langsamer.**

| | Tempo | Uferweg 1.681 m | Wasserweg am Ufer 1.863 m | über den Kirchturm 2.364 m |
|---|---|---|---|---|
| real | Gehen 1,4 · Flossen 0,5 m/s | 20 min | 62 min | 79 min |
| real, Flossen am Anschlag | 1,0 m/s | 20 min | 31 min | 39 min |
| Spiel, Faktor 3 auf beiden Seiten | 4,2 · 2,25 m/s | 6,7 min | 13,8 min | 17,5 min |
| Spiel, Uferweg mit drei Engstellen je 47 s | 4,2 m/s | 9,0 min | — | — |
| … dazu 400 m Schlamm mit dem Tempo des Watens (Länge angenommen) | 4,2 / 1,9 m/s | 10,9 min | — | — |
| Entwurf Traversal v2 | 6 m/s | — | 5,2 min | 6,6 min |

Damit der Wasserweg bei 2,25 m/s zeitlich gewinnt, müsste **jede** der drei Engstellen 143 s aufhalten (gegen Gehen;
gegen das heutige Rennen 225 s). Der Kampfbot misst 25–47 s je Begegnung. Mit Schlamm und Kämpfen liegt der Uferweg
bei 9–11 min, der Weg durch die Stadt bei 17,5 min.

**Befund 3 — die Luft reicht für Abstiege, nicht für die Strecke.** 2 l bei 200 bar sind 400 l, mit 50 bar Reserve
300 l nutzbar. Schwimmen ist Arbeit (rund 40 l/min an der Oberfläche gerechnet, doppelter Ruhewert [Q10]):

| Tiefe | Druck | in Ruhe | bei Arbeit | Strecke bei 0,5 m/s |
|---|---|---|---|---|
| 3 m | 1,30 bar | 11,5 min | 5,8 min | 173 m |
| 5 m | 1,50 bar | 10,0 min | 5,0 min | 150 m |
| 10 m | 2,00 bar | 7,5 min | 3,8 min | 112 m |
| 15,6 m (Kirchturm, Grund) | 2,56 bar | 5,9 min | 2,9 min | 88 m |

Den Weg über den Kirchturm ganz am Grund zu tauchen, bräuchte 6.180 l — **21 Flaschenfüllungen**. Real füllt eine
Flasche nur ein Kompressor. Die „13 Minuten“ aus Gegenstände v1 §11 gelten für Ruhe ohne Reserve in 5 m.

**Was real ginge:** an der Oberfläche schwimmen, mit Anzug, Maske und Flossen; die Flasche für das, was unten liegt —
der Kirchturm (hinunter, suchen, hinauf: zwei bis drei Minuten am Grund), die Tafel im Absetzbecken, der Fuss des Wehrs.

**Hält D380?** Als **Abkürzung in Minuten nein** — weder real noch mit dem Spielfaktor. Als **zweiter Weg ja**, wenn
er ehrlich heisst, was er ist: der längere, stille Weg.

- **Entschieden (D411), umgesetzt in Dokumenten und Daten (D412):** so wie hier empfohlen. Traversal v2 §4/§6/§7,
  Bibel §4, Quests v1 §2.7 sind umgeschrieben; Tempo und Luft stehen als Entwurf in `content/bewegung.json` `tauchen`.
- **Empfehlung:** Der Wasserweg ist der Weg **ohne Kampf**, nicht der schnelle. Er dauert etwa doppelt so lang
  (17,5 gegen 9–11 min), kostet keine Begegnung, führt am Kirchturm vorbei (Rast auf halbem Weg, Quests §2.7) und
  kommt am Wehr von der Wasserseite an — dort liegt nach Gegenstände v1 §5.4 ohnehin der Schlüssel zum Schieberhaus
  („am Ende des Tauchwegs“). Das trägt D374 (zwei Wege, keiner verschlossen) und D385 (der dritte Spielstil umgeht).
  Werte als Daten: Schwimmtempo mit Tauchzeug **2,25 m/s**, benannt als Faktor 3 auf 0,75 m/s; Luft als **Vorrat**
  (300 l, Verbrauch nach Tiefe wie in der Tabelle, durch den Zeitfaktor 3 geteilt: am Kirchturm rund eine Minute
  Grundzeit je Abstieg, drei bis vier Abstiege je Füllung); nachgefüllt an der Rast — **benannte Abweichung**, real
  geht das ohne Kompressor nicht. Die Dächer als Rastpunkte braucht es dann nicht: An der Oberfläche atmet man.
  D380 und Traversal v2 §4 wären im Wortlaut zu ändern („Abkürzung“ → „der Weg ohne Kampf“); ~~**nicht geändert**, A-34~~
  **geändert in D412**.
- **Alternative:** das **Boot** aus dem Schuppen am Nordufer („kieloben, das Pech frisch“) macht das Wasser wirklich
  zur Abkürzung — ein Ruderboot ist real schneller als ein Fussgänger (Tempo hier nicht belegt). Preis: ein neues
  Fahrzeug (Mechanik, Modell, Anlegestellen), und das Tauchzeug verliert die Strecke ganz und behält nur den Grund.
- **Nicht empfohlen:** 6 m/s behalten und benennen. Das wäre der Faktor 12, in einer Bewegung, in der jeder Spieler
  das Gefühl für das richtige Tempo mitbringt.

### 4.2 Reittier (D391)

Ein Reittier trägt Reiter und Zeug bis etwa 20 % seines Gewichts ohne messbare Belastung; 25 % und 30 % heben Puls,
Laktat und Muskelschmerz [Q14]. Maultiere im Gebirge: 20 %, rund 91 kg, 32 km am Tag [Q14].

| | Masse | trägt bei 20 % | bei 30 % |
|---|---|---|---|
| Reiter mit dem Nötigsten | 90 kg | verlangt 450 kg Tier | verlangt 300 kg Tier |
| Keiler, in Mitteleuropa üblich [Q15] | 75–100 kg | 18 kg | 27 kg |
| Keiler aus dem Entwurf | 140 kg | 28 kg | 42 kg |
| Keiler, grösste in Mitteleuropa [Q15] | 200 kg | 40 kg | 60 kg |
| Keiler der Ussuri-Form, 125 cm Schulter [Q15] | 300–350 kg | 65 kg | 98 kg |
| Alpensteinbock, Bock [Q16] | 67–117 kg | 20 kg | 30 kg |

Kein Wildtier des Œntals trägt in seiner echten Grösse einen Erwachsenen. Die Schwelle im Code (1,2 m Widerrist,
`reiten.ts:33`) ist dagegen brauchbar: Masse wächst mit der dritten Potenz — ein Keiler von 0,8 m und 90 kg wöge mit
1,25 m Schulter 343 kg, so viel wie die grösste reale Unterart.

- **Entschieden (D411): Option A.** Umgesetzt als Entwurf in `content/bewegung.json` `tragtier` (450–500 kg, kein
  Kampfwert; `validate` prüft, dass das leichteste Tier 90 kg bei 20 % trägt), Auftragstext und Halfter neu. Nicht
  gebaut: Modell, Ort, Bindung — ~~im Code trägt weiter jeder Vierbeiner ab Mutation 2~~. **D413:** `traegt()`
  (`src/spiel/reiten.ts`) bindet das Tragen an die Daten (leichteste Masse × Traglastanteil ≥ 90 kg); weil nur das
  Tragtier eine Masse hat, trägt im Spiel heute kein Tier. `?reitprobe=1` setzt die alte Regel für den Test am M1 ein.
- **Option A (Empfehlung) — ein verwildertes Tragtier.** Im Stall des Försters hing das Halfter, „seit es keine
  Pferde mehr gibt“ — ein Halfter ist Pferdezeug. Ein verwildertes Bergpferd oder Maultier (rund 400–500 kg, Masse
  hier nicht belegt) trägt 90 kg bei 20 %. Die Nebenaufgabe bleibt, wie sie ist (drei Keiler reinigen, D391); der
  Lohn ist das Halfter **und** der Hinweis, wo das letzte Tier des Hofs steht — befallen, zu reinigen, dann gebunden.
  **Preis:** ein neues Tier (Modell und Zielbild; das Vierbeiner-Rig gibt es), ein Reinigungskampf mehr, und die
  Zeile „gebunden wird ein gereinigter Vierbeiner“ (Bibel §2) verengt sich auf dieses eine Tier. Kein Kampfwert nötig,
  wenn es nicht als Gegner dient.
- **Option B — der Riesenkeiler.** Nur ein **verhärteter** Keiler trägt: 1,25 m Schulter, über 300 kg — die
  Alternative, die Traversal v2 §5 schon nennt (verhärteter Wurzelkeiler an der Hütte im Bannwald). Real die obere
  Grenze der Art, also Fiktion mit Mass. **Preis:** kostet eine Reinkultur; wer ihn tötet, hat kein Reittier; 28 %
  Last sind nur für kurze Strecken ehrlich, das Reittempo müsste auf den Sprint eines Keilers (11–13 m/s) und unter
  das Dauertempo eines Pferds; und die Welt muss die Grösse zeigen (Zielbild Tiere, D384).
- **Rückfall — Lasttier statt Reittier.** Ein gereinigter Keiler oder Steinbock trägt 20–28 kg: das Bündel (10 kg)
  und die Werkzeuge (18 kg). Real stimmig, kostet aber das Verb Reiten (Code und Tests stehen) und den Werkzeugweg
  nach Süd.

### 4.3 Gleiter (D391)

**Tuch.** Polyamid-Schirmtuch verliert unter UV, Wärme und Zug seine Beschichtung und Festigkeit; die
Luftdurchlässigkeit steigt, im Versuch fiel der Sicherheitsfaktor auf 1,33 („sichert keinen sicheren Gebrauch“) [Q13].
Achtzehn Jahre in einem Geweih, in Sonne und Regen, ergeben einen Lappen. „Die Nähte halten“ (`gleiter.json`) stimmt
nicht. Eine Stundenzahl bis zum Versagen: nicht belegt.

**Gleitzahl.** Verlangt sind auf dem längsten Werkzeugflug 1.330 m auf 374 m Höhe = 3,6 : 1; der Code gibt 3 : 1 bei
12 m/s vorwärts und 4 m/s Sinken. Ein heiler Freizeitschirm hätte 9,3 : 1 bei 9–11 m/s und rund 1,1 m/s Sinken [Q11] —
er trüge von derselben Kante 3.478 m, fast die ganze Region. Das Spiel liegt also **weit unter** real, und zwar aus
gutem Grund (D71). Was fehlt, ist der Grund in der Welt.

- **Entschieden (D411), umgesetzt (D412):** Text von `gleiter.json` nach §5 (b); Gleitzahl und Sinkrate unverändert,
  seit D412 in `content/bewegung.json` `gleiter`. Wer in der Enklave näht, ist offen.
- **Empfehlung — geborgen und neu vernäht.** Am Grathorn hängen Leinen, Tragegurte und Gurtzeug (Aramid und
  Polyester, dick, im Fächer verschattet) und Fetzen der Kappe. Die Kappe näht die Enklave neu, aus dem, was sie hat:
  gewachstes Leinen, Zeltbahn, die alte Kappe als Schnittmuster. Ein solches Tuch ist schwerer und dichter gewebt,
  aber rauer und kleiner zu schneiden — ein Schirm, der **schlecht gleitet und schnell sinkt**. Damit sind 3 : 1 und
  4 m/s keine Abweichung mehr, sondern die Eigenschaft dieses Geräts (ob gewachstes Leinen genau diese Werte ergibt:
  nicht belegt). **Preis:** ein Schritt mehr zwischen Boss und Flug (eine Figur der Enklave, Material — der Zettel
  „Harz auf Leinen“ und der Wachstuchkittel liegen als Gegenstände schon vor), Text von `gleiter.json` neu.
- **Alternative — der Schirm war nie im Freien.** Er liegt verpackt im Packsack, in der Almhütte oder unter dem
  Fächer des Grathorns, dunkel und trocken. Dunkel gelagertes Tuch altert langsam (Dauer nicht belegt). **Preis:**
  keiner in der Arbeit, aber das Bild „Gleitschirm im Geweih wie ein Mantel“ (D391) entfällt, und ein heiler Schirm
  macht 3 : 1 wieder zur unbegründeten Abweichung.
- **Verworfen:** ein anderes Fluggerät (Drachen mit Gestänge) — real bessere Gleitzahl (bis 16 : 1 [Q12]), sperrig,
  passt weder zur Tragbarkeit noch zum Öffnen im Fall.

Das selbsttätige Öffnen im Fall ab 3 m (D71) bleibt eine benannte Abweichung: Ein Schirm wird aufgezogen und trägt
erst gefüllt.

### 4.4 Schwimmen und Kälte

Das Spiel schwimmt 11 s schnell (1,6 m/s) und treibt danach ohne Ende mit 0,72 m/s. Real schwimmt ein Bekleideter in
12 °C mit 0,35 m/s und kommt im Mittel 815 m weit, bevor er aufgibt [Q7]; davor liegen der Kälteschock der ersten
Minute und das Schwimmversagen nach zwei bis dreissig Minuten [Q6].

| Querung | Spiel heute | real, bekleidet, 12 °C | Faktor |
|---|---|---|---|
| Absetzbecken, 21 m | 0,3 min | 1,0 min | 3,9 |
| Kapelle, 380 m | 8,6 min | 18 min | 2,1 |
| Kirchturm, 447 m | 10,1 min | 21 min | 2,1 |

Über die lange Strecke liegt das Spiel also **nahe am Faktor 3** — das Zwei-Phasen-Modell ist im Mittel ehrlicher,
als es aussieht. Falsch ist nur das Ende: Treiben kostet nichts. Und Quests v1 §2.7.3 begründet die Grenze zu streng
(„nach Minuten, nicht nach Metern“); die Querung zur Kapelle ist real für einen guten Schwimmer machbar und
gefährlich, nicht unmöglich.

- **Entschieden (D411), umgesetzt (D412):** `src/spieler/bewegung.ts` (`kaelteSchritt`, `kaelteLeben`), Werte in
  `content/bewegung.json` `kaelte`. Gebaut ist nur das Ufer als Rücksetzer — Feuer und Rast setzen die Uhr noch nicht
  zurück (**D413 geprüft:** Rasten gibt es als Ereignis, aber nur an Land in der Zuflucht, wo das Ufer die Uhr schon auf
  null gesetzt hat — ein Rücksetzen dort änderte nichts; ein Ereignis „am Feuer“ gibt es nicht. Erst wenn das Aufwärmen
  am Ufer langsam wird, wie es real wäre, bekommen Feuer und Rast eine Wirkung — Traversal v2 §8 Punkt 17. **Benannte
  Abweichung:** Das Ufer wärmt sofort); und weil es ausserhalb des Kampfs kein Leben gibt, hat nur „aufgebraucht“ eine Folge (Aufwachen in der
  Zuflucht), „sinkt“ ist ein Hinweis.
- **Empfehlung — die Kälte als Uhr.** Im tiefen Wasser läuft eine Kälteuhr: nach rund 4 min sinkt das Leben, nach
  rund 10 min ist es aufgebraucht (reale 30 min durch den Faktor 3; **Arbeitswerte, ungemessen**). Ufer, Feuer und
  Rast setzen sie zurück; das Tauchzeug ist Gerät **und Anzug** (so schon Quests §2.7.3) und hält sie an. Folge: Die
  Kapelle (8,6 min) wird ohne Werkzeug ein knapper, gefährlicher Weg statt neun Minuten Wartezeit — das ist
  „beschwerlich“ im Sinn von D374 und löst den Einwand aus Traversal v2 §6c („Wartezeit, kein Spiel“). Der Kirchturm
  (10,1 min) bleibt knapp ausser Reichweite. Bäche und der Weiher (21 m) sind nicht berührt.
- **Alternative — nichts ändern, benennen.** Steht dann in §3: „keine Kälte“. Preis: Die Flut bleibt ohne Werkzeug
  folgenlos durchquerbar, und der Satz „warum man nicht einfach schwimmt“ (Quests §2.7.3) hat keine Deckung im Spiel.

### 4.5 Klettern

2,2 m/s senkrecht sind 68 % des Weltrekords im Speedklettern (15 m in 4,64 s an genormten Griffen [Q8]) — an jedem
Fels, mit Waffen und Gepäck. Eine Seilschaft braucht 20–30 min für eine Seillänge [Q8]. Die Reichweite (13,8 m je
Leiste) ist im Code begründet, das Tempo nirgends.

**Entschieden (D411), umgesetzt (D412):** 1,0 m/s, Reichweite 13,75 m unverändert (`content/bewegung.json`
`klettern`; die Zehrung rechnet `ausdauer.ts` daraus, rund 7,3/s). Die Halbierung aus D391 wartet weiter auf die
Wandhöhen.

D391 hat entschieden, den Grundwert zu halbieren, sobald die Wandhöhen gemessen sind. **Vorschlag dazu:** nicht die
Zehrung verdoppeln, sondern das Tempo senken und die Zehrung anpassen — gleiche Reichweiten, ehrlichere Bewegung:

| | heute | D391 wörtlich | Vorschlag |
|---|---|---|---|
| Tempo | 2,2 m/s | 2,2 m/s | **1,0 m/s** (Faktor 3 auf rund 0,3 m/s; Realwert nicht belegt) |
| Grundwert | 16/s → 13,8 m in 6,3 s | 32/s → 6,9 m in 3,1 s | **14,5/s → 6,9 m in 6,9 s** |
| mit Kletterzeug | — | 16/s → 13,8 m in 6,3 s | **7,2/s → 13,8 m in 13,8 s** |

Drei Sekunden an einer Wand sind kein Klettern, sondern ein Sprung mit Animation; sieben Sekunden lassen Zeit, die
Leiste zu lesen und einen Absatz zu suchen. **Preis:** 14 s für die höchste Wand — am M1 zu prüfen, ob das trägt.
Nichts geändert; hängt weiter an der Messung der 4.031 Klippen (Traversal v2 §8 Punkt 6).

### 4.6 Fallschaden

Es gibt keinen. Die Figur fällt aus jeder Höhe und steht (`RegionsSzene.tsx:3385–3389`); wer beim Klettern
erschöpft, „fällt aus der erreichten Höhe“ (Kommentar `:3376`) ohne Folge. Real steigt das Verletzungsrisiko ab etwa
1,5 m deutlich, die Hälfte der Gestürzten stirbt bei 12–15 m [Q5]. Eine Absicht dahinter ist nirgends vermerkt.

- **Entschieden (D411), umgesetzt (D412):** `src/spieler/bewegung.ts` `fallschaden`, Werte in `content/bewegung.json`
  `fall`. Gemessen wird der **Aufprall** (gleichwertige Höhe v²/2g), nicht die Höhe des Falls — sonst nähme der
  Gleiter nach 300 m Flug Schaden. Die Rolle halbiert nur den Schaden unter 15 m; ausserhalb des Kampfs gibt es keine
  Rolle, ~~die Funktion kennt sie, die Szene übergibt sie nicht~~ **seit D413** zählt die Rolltaste K in den letzten
  0,3 s vor dem Aufsetzen (`gerolltBeiLandung`, `fall.rolleFenster`) — ohne Clip, die Figur rollt nicht sichtbar.
  Folge heute nur bei „tödlich“; seit D413 endet ein tödlicher Sturz in einem laufenden Kampf als Niederlage dieses
  Kampfs (`koerperFolge`), statt die Figur aus dem Kampf in die Zuflucht zu versetzen.
- **Empfehlung — Fallschaden mit dem Faktor der Beine.** Schadlos bis **4,5 m** (reale 1,5 m × Faktor 3 — dieselbe
  Figur springt 1,49 m hoch und landet jedes Mal daraus), darüber linear, **tödlich ab 15 m** (real, kein Faktor:
  Knochen haben keinen). Rolle bei der Landung halbiert. Folgen: Der Gleiter öffnet ab 3 m und liegt damit immer
  unter der Schwelle — wer ihn hat, fällt nie; wer ihn nicht hat, muss Abstiege lesen. Die Klettergrenze bekommt
  Gewicht: Erschöpfen in 13 m Höhe ist dann fast tödlich, der Absatz zum Verschnaufen wird wirklich zur Route.
  **Arbeitswerte, ungemessen;** als Daten nach `content/`, nicht als Konstante.
- **Alternative — keiner, benannt.** Zeile in §3: „kein Fallschaden, damit Erkundung nichts kostet“. Preis: Höhe
  bleibt folgenlos, und der Gleiter ist nur schneller, nie nötig.

### 4.7 Spieltempo

Quests v1 §2.7 rechnet mit 4,2 m/s („dreifaches Gehtempo, Dauerlauf“). Das stimmt für den Laufschritt. Die
Wegzeiten des Spiels macht aber das **Rennen**: 11,0 m/s, ohne Ausdauer, immer verfügbar — `fussweg()` rechnet
damit als Vorgabe (`tempo.ts:55`). Das ist schneller als der 100-m-Weltrekord im Mittel, mit 36 kg Last, bergauf wie
eben.

| Weg | Strecke / Anstieg | real | gehen 4,2 | rennen 11,0 | rennen 8,5 | rennen 7,0 |
|---|---|---|---|---|---|---|
| Start → Magd | 1.182 m / 11 m | 19 min | 4,7 min | 1,8 min | 2,3 min | 2,8 min |
| Brannburg → Wehr | 1.681 m / 10 m | 26 min | 6,7 min | 2,5 min | 3,3 min | 4,0 min |
| Brannburg → Saatkammer | 1.856 m / 99 m | 38 min | 7,4 min | 2,8 min | 3,6 min | 4,4 min |
| Brannburg → Oberstollen | 2.097 m / 451 m | 106 min | 8,3 min | 3,2 min | 4,1 min | 5,0 min |
| Region quer | 4.000 m | 60 min | 15,9 min | 6,1 min | 7,8 min | 9,5 min |

- **Entschieden (D411), umgesetzt (D412):** Rennen 8,5 m/s, Reiten 5 / 13, Laufschritt 4,2. Schalter `?renntempo=7`
  für den Vergleich am M1 (`src/spieler/tempo.ts` `renntempoAusAdresse`, nur die Werte aus `laufen.rennenProbe`).
  Nachgemessen: `npm run gleit` — 3 : 1 spart gegen 8,5 m/s 51,9 s im Median (gegen 11 m/s 29,6 s). Nicht nachgemessen:
  die Lastmessungen, die mit 11 m/s über die Kacheln liefen (welche, ist hier nicht festgehalten; `tools/lastcheck.ts`
  liest kein Tempo) — ⚠️ UNKLAR.
- **Empfehlung:** Laufschritt **4,2 m/s bleibt** (Faktor 3, benannt, in Spielen üblich — das „üblich“ ist hier nicht
  belegt). **Rennen sinkt**, Zielwert 8,5 m/s (Faktor 2 zum Laufschritt, 6 zum Gehen), Reiten folgt auf 5 / 13 m/s.
  G-27 hat den Rückgang selbst angekündigt („geht zurück, sobald es Traversal gibt“), und mit Reittier und Gleiter
  ist Traversal entworfen. Folgen: reine Wegzeit +29 % (bei 7,0 m/s +57 %); die Region quer 7,8 statt 6,1 min; der
  Sprung aus dem Rennen 9,4 statt 12,1 m; Reiten bleibt ×1,5 schneller; der Gleiter (12 m/s) wird deutlicher zur
  Abkürzung — die Messung zu D71 (2 : 1 spart nur 0,7 s) wäre mit dem neuen Wert zu wiederholen (`npm run gleit`),
  ebenso die Lastmessungen, die mit 11 m/s über die Kacheln laufen. **Nicht geändert:** Das Gefühl beurteilt sich am
  M1; dort 8,5 und 7,0 nebeneinander laufen.
- **Alternative — 11,0 bleibt.** Dann steht es in §3 als Faktor 7,9, und Sprungweite, Reittempo und das Abhängen
  jedes Tiers (§4.8) bleiben Folgen davon.

### 4.8 Tempo der Tiere

Im Kampf laufen die Tiere 2,4–4,5 m/s; real sprinten Fuchs, Wolf, Gams und Wildschwein 11–16 m/s [Q15] [Q17]. Als
Kampftempo ist das vertretbar (lesbare Angriffe) und ab jetzt benannt. Zwei Punkte bleiben:

1. **Keiler und Grathorn laufen mit der Vorgabe 2,4 m/s** — langsamer als jeder Mensch im Spiel (2,6–3,0). Das ist
   ein Platzhalterwert (`GEGNER_KI`, „Gegnerverhalten des Platzhalters“), keine Entscheidung, und verkehrt die
   Rangfolge. Vorschlag: eigener `tempo`-Wert in `content/gegner/keiler.json` und `grathorn.json`, mindestens der des
   Wolfs (4,0), gemessen mit dem Kampfbot. **Kein Diff**, weil jeder dieser Werte die Bot-Ergebnisse (Reinigen v1,
   Lehrstrecke D390) verschiebt.
2. **Flucht ist geschenkt.** 11 m/s gegen 4,5 m/s: Wer rennt, ist jeden Kampf los. D374 will Kämpfe umgehbar, aber
   Umgehen soll Wegwahl sein, nicht Tastendruck. Sobald das Renntempo sinkt (§4.7), braucht ein hetzendes Tier ein
   **Hetztempo** als zweites Datum (Wolf und Fuchs über dem Rennen des Spielers, Keiler darunter) — erst dann ist
   „der Wolf holt dich ein, der Keiler nicht“ eine Eigenschaft der Tiere.

## 5. Vorschläge mit Diff

Nur wo ein Wert offensichtlich ohne Gestaltungsabsicht falsch ist. ~~**Nichts davon ist angewendet.**~~
**Stand D412:** (a) angewendet — als Datum (`content/bewegung.json` `fall.endgeschwindigkeit`) und Funktion
(`src/spieler/bewegung.ts` `begrenzeFall`, `FALL_MAX`) statt als Konstante in `tempo.ts`, weil Spielwerte nach
`content/` gehören; (b) angewendet wörtlich; (c) angewendet in Traversal v2 §4, §6, §7.

**(a) Endgeschwindigkeit im Fall.** Der Kommentar nennt 50 m/s, der Code begrenzt nichts — ein Fall aus 500 m endet
bei 99 m/s. Greift nur ohne Gleiter und über rund 140 m, ist aber ein reiner Widerspruch zwischen Kommentar und Code:

```diff
--- a/src/spieler/tempo.ts
+++ b/src/spieler/tempo.ts
@@
 export const SCHWERKRAFT = 9.81;
 export const ABSPRUNG = 5.4;
+/** Endgeschwindigkeit im freien Fall, m/s: Luftwiderstand eines Menschen in Bauchlage (Physik-Prüfung v1 Zeile 7). */
+export const FALL_MAX = 53;
--- a/src/scenes/RegionsSzene.tsx
+++ b/src/scenes/RegionsSzene.tsx
@@
-      steigen.current -= SCHWERKRAFT * dt;
+      steigen.current = Math.max(-FALL_MAX, steigen.current - SCHWERKRAFT * dt);
```

**(b) Der Text des Gleiters** widerspricht §4.3 — erst nach der Entscheidung zu A-34 ändern:

```diff
--- a/content/gegenstaende/gleiter.json
-  "text": "Ein Schirm, der lange in einem Geweih hing. Die Nähte halten. Jemand wollte damit über die Grenze und kam bis zur Quelle.",
+  "text": "Leinen und Gurte aus einem Geweih, die Kappe neu genäht aus gewachstem Leinen. Sinkt schneller, als sein Vorbild es tat. Jemand wollte damit über die Grenze und kam bis zur Quelle.",
```

**(c) Tauchtempo und Tauchweg in Traversal v2 §4 und §7:** „rund 6 m/s“ → 2,25 m/s, „1.586–2.192 m“ →
1.863–2.364 m, „Abkürzung“ → „der Weg ohne Kampf“. Dort steht seit D408 nur ein Pointer hierher; umgeschrieben wird
nach A-34.

## 6. Quellen

Stand der Recherche: 22.11.2026, Websuche. **Gelesen sind die Zusammenfassungen der Suchergebnisse, nicht die
Volltexte** — jede Zahl ist vor einer Verwendung ausserhalb dieses Dokuments an der Quelle nachzuschlagen.

| | Was | Quelle |
|---|---|---|
| Q1 | Gehtempo: verbreitet 1,42 m/s; Laufband 1,24 ± 0,17 m/s; neuere Studie 1,12–1,16 m/s | https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10884095/ · https://en.wikipedia.org/wiki/Preferred_walking_speed |
| Q2 | Cooper-Test, Männer 20–29: „gut“ 2.400–2.800 m in 12 min; Untrainierte 1.600–2.200 m (Sportportal, Richtwert) | https://www.topendsports.com/testing/norms/cooper-12minute.htm |
| Q3 | 100 m in 9,58 s = 10,44 m/s im Mittel; Spitze 12,3–12,4 m/s | https://www.britannica.com/story/how-fast-is-the-worlds-fastest-human |
| Q4 | Standhochsprung Männer 41–50 cm, Standweitsprung „sehr gut“ über 250 cm (Sportportal, eigene Skala des Betreibers); Profi-Basketballer 34,9–38,9 cm | https://www.topendsports.com/testing/norms/vertical-jump.htm · https://www.topendsports.com/testing/tests/longjump.htm · https://pmc.ncbi.nlm.nih.gov/articles/PMC9213321/ |
| Q5 | Sturzhöhe mit 50 % Sterblichkeit: lange 12,1 m, neuere Auswertung eines Traumazentrums 14,8 m; Sterblichkeit steigt mit der Höhe; Stürze über 1,5 m: 4,1-faches Verletzungsrisiko (Spielplatz, Kinder); Fallschirmlandung 2,4–4,3 m/s Sinken, Beispielrechnung 6,7 m/s = 2,3 m Fallhöhe | https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7312001/ · https://pmc.ncbi.nlm.nih.gov/articles/PMC1730203 · https://sites.nd.edu/biomechanics-in-the-wild/?p=4598 |
| Q6 | Kaltwasser 1-10-1: Kälteschock rund eine Minute, Schwimmversagen in rund zehn (zwei bis dreissig) Minuten, Bewusstlosigkeit nach rund einer Stunde | https://csbc.ca/1-10-1-principle/ · https://www.siriusmedx.com/en_CA/blog/instructor-s-blog-5/the-1-10-1-had-it-right-52 |
| Q7 | Schwimmen bekleidet in 12 °C: 815 (482) m in 39 (19) min gegen 1.264 m unbekleidet; Kleidung kostet in 29 °C 30,8 % Tempo und 31 % Strecke. Freizeitschwimmer 2:00–2:30 je 100 m (Ratgeberseite) | https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4819756/ · https://www.hakaru.io/guides/swimming-pace-calculator-guide |
| Q8 | Speedklettern 15 m: 4,64 s (Mai 2025); Mehrseillänge 20–30 min je Seillänge, Zustieg 400–500 Hm/h | https://en.wikipedia.org/wiki/Speed_climbing · https://www.bergwelten.com/a/lab-rock-kapitel-2-tourenplanung-beim-klettern |
| Q9 | Taucher: 0,5 kn = 0,26 m/s, 1,0 kn = 0,51 m/s; höchstes Tempo im Widerstandsversuch rund 1,9 kn | https://core.ac.uk/download/288388512.pdf |
| Q10 | Luftverbrauch an der Oberfläche: BSAC rechnet 25 l/min, sonst 28 l/min; Verbrauch × Umgebungsdruck; doppeltes Tempo, vierfache Arbeit | https://www.bsac.com/news-and-blog/so-you-think-you-use-too-much-gas/ · https://dan.org/alert-diver/article/estimating-your-air-consumption/ |
| Q11 | Gleitschirm: Gleitzahl 9,3 (Freizeit), 11,3 (Wettkampf); Trimm 32–40 km/h, Bereich 22–55 km/h | https://en.wikipedia.org/wiki/Paragliding |
| Q12 | Wingsuit 2,5–3 : 1; Hängegleiter 9,5–16,5 : 1. **Nicht belegt:** früher Rogallo-Drachen 4 : 1 | https://en.wikipedia.org/wiki/Wingsuit_flying · https://www.ushpa.org/page/what-is-hang-gliding-and-paragliding |
| Q13 | Schirmtuch (Polyamid 6.6) unter UV, Wärme, Zug: Luftdurchlässigkeit steigt, Festigkeit fällt, Sicherheitsfaktor im Versuch 1,33; Wartung jährlich oder nach 100 Stunden. **Nicht belegt:** eine Stundenzahl bis zum Versagen | https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10420326/ · https://xcmag.com/?p=68075 |
| Q14 | Pferd: 15–20 % der Körpermasse ohne Befund, 25–30 % heben Arbeit, Puls, Laktat, Muskelschmerz; Kavallerie 20 % samt Sattel. Maultier: US-Armee 20 % (rund 91 kg) bei 32 km am Tag im Gebirge; Versuch mit 20–42 % über 2 km | https://ker.com/?p=11997 · https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7071094/ · https://en.wikipedia.org/wiki/Pack_animal · https://www.frontiersin.org/journals/veterinary-science/articles/10.3389/fvets.2025.1725279/full |
| Q15 | Wildschwein: Keiler in Europa meist 75–100 kg bei 75–80 cm Schulter, grösste in Mitteleuropa 200 kg, Ussuri 300–350 kg bei 125 cm; Spitze 40 km/h, andere Angaben 48–55 km/h (Tierportale, keine Messung) | https://en.wikipedia.org/wiki/Wild_boar · https://www.redzet.lv/en/info/Wild_boar_(Sus_scrofa) |
| Q16 | Alpensteinbock, Bock: 67–117 kg, 90–101 cm Widerrist; 99 kg im Herbst, 79 kg im Frühjahr | https://en.wikipedia.org/wiki/Alpine_ibex |
| Q17 | Rotfuchs 48–50 km/h, Wolf 45–60 km/h, Reisetempo 8 km/h (Tierportale und eine Tabelle ohne Methode; Angaben widersprechen sich). **Nicht belegt:** Gams 50 km/h, Sprungmasse von Gams und Steinbock | https://www.open.edu/openlearn/nature-environment/natural-history/studying-mammals-meat-eaters/content-section-3.1 · https://tpwd.texas.gov/publications/nonpwdpubs/young_naturalist/animals/animal_speeds/ |
| Q18 | Langbogen 50–55 m/s; 80-lb-Eibe: 50-g-Pfeil 53 m/s, 90 g 43 m/s; moderne 90-lb-Armbrust 62 m/s (Forum und Lexikon) | https://en.wikipedia.org/wiki/English_longbow · https://myarmoury.com/talk/viewtopic.php?p=331759 |
| Q19 | Soldatenlast: Gefechtslast 22 kg oder 30 % des Körpergewichts, Marschlast 33 kg oder 45 %; Gehtempo fällt von 1,95 auf 1,48 m/s bei 66 % Last | https://pubmed.ncbi.nlm.nih.gov/14964502/ · https://researchconnect.buffalo.edu/en/publications/effects-of-modern-military-backpack-loads-on-walking-speed-and-ca/ |

**Gesucht und nicht belegt:** Sprint mit Marschlast in m/s; Klettertempo ohne Seil; Tempo im Waten; Tempo eines
Ruderboots; Pferdegalopp und Masse eines Bergpferds; Endgeschwindigkeit im freien Fall; Öffnungshöhe eines Schirms;
Lebensdauer dunkel gelagerten Schirmtuchs; Abfluss des Flusses im Œntal; reale Ladezeiten von Bogen und Armbrust
(stehen ohne Quelle in `waffenfamilien.json`); „in Spielen übliche“ Lauftempi.

## 7. Messung und Grenzen

`python3 tools/physik_pruefung.py` rechnet alle Zahlen aus §4 (Tiefenprofil und kürzester Wasserweg aus dem
10,4-m-Raster, Zeiten, Luft, Sprung, Gleiten, Traglast, Wegetabelle). Grenzen: Spielwerte sind abgeschrieben, nicht
importiert; die Flut gibt es im Spiel nicht als Wasserfläche (Traversal v2 §3); die Engstellen des Uferwegs sind
nicht gebaut, ihre Kampfzeit ist aus der Lehrstrecke übertragen, die Schlammlänge angenommen; der Spielfaktor 3 für
Tauchen, Kälte und Fallschaden ist ein Vorschlag, kein Befund. Nichts davon ist im Spiel gegangen, geschwommen,
getaucht oder geflogen worden.
