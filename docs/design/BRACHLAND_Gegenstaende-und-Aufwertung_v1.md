---
last-reviewed: 2026-11-22
shelf-life-days: 180
---
# BRACHLAND — Gegenstände, Belohnungen und Aufwertung v1

> **Entwurf (D393), nichts davon ist im Spiel verdrahtet.** Daten: `content/gegenstaende/` (25 neu),
> `content/belohnungen.json`, `content/oekonomie.json`. Regeln: `src/spiel/belohnung.ts`, `src/spiel/oekonomie.ts`.
> Rechnung: `npx tsx tools/oekonomiesim.ts`. Entscheidungen für Flo: Ledger **A-28**. Offen/erledigt steht im Ledger.
> **Fortgeschrieben mit D400:** §13 „Fortschritt der Spielfigur“ (Vitalwerte, Erfahrung, Brauen, Töten als Abkürzung).
> §5.8 „kein Stufensystem“ und A-28 (8) sind dadurch abgelöst; die Zahlen in §3 gelten weiter, §13.3 ergänzt sie.
> **Fortgeschrieben mit D416:** §14 „Reviere“ — Reviere als Daten (`content/reviere/oental.json`, 13 statt 12 angenommene)
> und Logik (`src/spiel/reviere.ts`); die Rechnung aus §3/§13.3 ist dort mit den echten Revieren wiederholt.
>
> Auftrag (Flo, 22.11.2026): „mach weiter mit der Story, Quests, Items und Belohnung, Upgrade Materialien etc.
> orientiere dich auch hier einfach daran wie es andere Spiele in dem Genre machen die in den Disziplinen dafür gelobt
> wurden und versuche es noch besser zu machen und passend zu unserer Welt.“
>
> Nicht neu aufgerollt: Marke heilt statt tötet (D374), Belohnungsregel (D379), Fassung 4 + 2 je Regent, Verhärtete
> nur mit Reinkultur, Werkzeuge hinter Rätsel/Nebenaufgabe/Boss (D391), Handwerk ja, Motive nein (ADR-0004).
> Kein Kampfwert wurde geändert; die Schmiede rechnet weiter nach D177.

## 1. Was gelobte Genre-Titel tun — elf Regeln

Übernommen wird die Bauweise, nie Name, Gegenstand oder Gestalt. „Nicht belegt“ heisst: in dieser Recherche keine
Quelle gefunden; die Aussage steht dann als Annahme da.

| # | Befund (Quelle) | So setzen wir es um | So machen wir es besser |
|---|---|---|---|
| 1 | **Heilung füllt sich an der Rast, statt gesammelt zu werden.** Die Flasche mit festen Schlucken gilt als der Zug, der den Abnutzungskrieg beendet hat [E1][E2]; gesammelte Heilmittel gelten als die feindseligste Entscheidung des Nachfolgers [B4]. | **Sudflasche**: 3 Schlucke Kräutersud, voll an jeder Rast (§5.2). | Schlucke wachsen über **Setzlinge**, die nur in ruhigen Revieren stehen: Wer heilt, bekommt mehr Heilung — aus der Welt begründet, nicht aus einem Menü. |
| 2 | **Zu viele Materialstufen, zu knapp dosiert.** Neun Varianten je Sorte; Beute gibt „ein, zwei Steine“; man kann erst experimentieren, wenn das Spiel fast vorbei ist [ER1][ER2]. | **Vier** Stufen für das ganze Spiel, drei Waffenstufen (D177 bleibt). | Stufe 1 ist nie der Engpass: nach dem Lieferbuch tauscht die Schmiedin Span gegen Federstahl (§7). Eng ist nur, was eine Entscheidung trägt (Härtling). |
| 3 | **Nachkaufbares Grundmaterial über einen Fund** (Glockenkugel-Prinzip) löst die Knappheit, kommt im Vorbild aber spät [ER3]. | Ein Wissensgegenstand öffnet einen Tausch (`lieferbuch-esse`, `zettel-harz-auf-leinen`). | Er liegt in Region 1, nicht im Endspiel, und er ist ein Buch mit einer Geschichte, kein Zahlenschlüssel. |
| 4 | **Wenige Waffen, jede anders, schlägt viele gleiche** [B1]. Das oberste Material einmal je Durchlauf wurde nachträglich gelockert [B2][B3]. | Drei Waffen mit eigenen Fenstern (ADR-0008); zwei davon als **Fundwaffen** (§5.5). | Kein Einmal-je-Durchlauf-Flaschenhals auf dem Hauptweg: fünf Härtlinge im Tal, drei braucht die Stufe 3. Die Knappheit ist eine Wahl (töten oder reinigen), kein Zufall. |
| 5 | **Fortschritt über Fundstücke und Bosse statt über Stufen**: vier Perlen ergeben ein Stück Leben; Kürbiskerne mehr Schlucke [S1][S2]. | Der Brachgänger hat **keine Stufe**. Er wächst über Waffe, Marke, Flasche, Werkzeug, Zeug. | Die Marke wächst aus dem, was man **tut** (Läuterung je Gereinigtem), nicht nur aus dem, was man findet. |
| 6 | **Verbrauchsmittel als Währung für Werkzeuge werden gehortet**; besser ein Vorrat, der sich an der Rast füllt [S3]. | Markenladungen und Schlucke füllen sich an der Rast; Verbrauchsgüter haben eine Traglast. | Harzverband und Herzfunke hören auf, Schmiedewährung zu sein (heute D177): Niemand soll zwischen Heilen und Schmieden wählen müssen. |
| 7 | **Wenige Plätze, jeder Bonus mit Preis**: Kerben-Budget von 3 bis 11, „Bonus mit Nachteil“, Überladen als bewusstes Risiko [HK1]. | **Zeug**: ein Platz, vier Stücke, jedes mit Vor- und Nachteil (§5.6). | Jedes Stück gehört zu einer Fraktion und einer Spielweise; es färbt, wie man gesehen wird, nicht nur, was man aushält. |
| 8 | **Waffen aus Teilen zusammensetzen** ist das meistgelobte Eigene eines jüngeren Genre-Titels [LP1][LP2]. | **Nicht übernommen.** Jede Kombination bräuchte geprüfte Kampfwerte und Clips. | Statt Teiletausch der Kernfunke (D188): ein Elementkern, der in jede Waffe passt — schon gebaut. |
| 9 | **Material kommt aus dem Gegner, den man dafür gejagt hat** (Jagdspiel-Prinzip). *Quelle in dieser Recherche nicht belegt.* | Span vom Tier, Härtling vom Verhärteten, Kernschlacke vom Regenten — nur wenn getötet (D379). | Das Vorbild kennt nur den Jäger. Hier gibt derselbe Gegner dem Heiler etwas anderes; die Beute ist eine Aussage über den Spieler. |
| 10 | **Die liegengebliebene Währung** macht den Tod zum Einsatz; der zweite Tod löscht alles [E3]. Kritisiert: derselbe Anlauf wieder und wieder [E3]; ein Titel nimmt nur die Hälfte [S4]. | **Das Bündel**: loses Material bleibt am Ort (§8). | Nichts geht endgültig verloren. Beim zweiten Tod nimmt der Befall das Bündel auf — ein Tier trägt es, und es lässt los, wenn man es reinigt. |
| 11 | **Kopier-Belohnungen** in Nebenorten entwerten das Erkunden. *Als Kritik am Vorbild in dieser Recherche nicht belegt* (die Treffer waren Ratgeber) — als Annahme geführt. | Belohnungsleiter (§6): Jeder verborgene Ort und jede Figurenlinie trägt ein **Unikat**. | Das Gate erzwingt es: `validate` lehnt ein Unikat in zwei Vorräten ab, `verteile` gibt kein Stück zweimal aus. |

**Soulframe:** belegt sind schmiedbare Barren zum Aufwerten und Beute, die man sofort trägt oder zu Material zerlegt
(Preludes 15) [SF1][SF2]; Gewichtung und Kritik daran: nicht belegt. Wir zerlegen keine Beute — es gibt keine
Ausrüstungsbeute. **The Blood of Dawnwalker:** belegt (Ratgeber gemischter Güte) sind getrennte Systeme für
Verbrauchsgüter (Rezept + Zutat) und Aufwertung beim Schmied, und dass das beste Stück als Auftragslohn geschmiedet
statt hochgestuft wird [DW1][DW2]; Lob oder Kritik dazu: nicht belegt. Übernommen: Unikate kommen aus Aufträgen und
Figurenlinien. **Dark Souls 1–3:** belegt ist nur die Flasche [E1][E2]; Aufwertungspfade und Materialfülle der
einzelnen Teile: nicht belegt. **Hollow Knight:** Nagel-Aufwertung über seltenes Erz: nicht belegt.

Quellen:
[E1] https://pressstarttodiscuss.blogspot.com/2015/06/92-dark-souls-use-of-estus.html ·
[E2] https://stiemannkj1.gitlab.io/the-de-evolution-of-the-estus-flask ·
[E3] https://www.gamedeveloper.com/design/the-design-lessons-designers-fail-to-learn-from-dark-souls ·
[ER1] https://gamesradar.com/games/action-rpg/elden-ring-shadow-of-the-erdtree-makes-one-change-to-weapon-upgrading-thats-so-good-i-want-fromsoftware-to-patch-it-into-the-base-game-immediately ·
[ER2] https://eldenring.wiki.gg/wiki/Smithing_Stones ·
[ER3] https://www.windowscentral.com/elden-ring-list-smithing-stone-and-bell-bearing-locations ·
[B1] https://kotaku.com/bloodbornes-biggest-problems-have-been-fixed-1749281059 ·
[B2] https://gameinformer.com/b/news/archive/2015/12/21/new-bloodborne-update-eases-weapon-upgrading.aspx ·
[B3] https://gamesradar.com/buy-blood-rocks-bloodborne-and-get-all-your-weapons-10 ·
[B4] https://www.patreon.com/ProblemMachine/posts/bloodborne-55421950 ·
[S1] https://gameinformer.com/exclusive-feature/2019/01/08/how-character-progression-works-in-sekiro-shadows-die-twice ·
[S2] https://godisageek.com/reviews/sekiro-shadows-die-twice-review/ ·
[S3] https://www.gamedeveloper.com/design/how-i-broke-sekiro-shadows-die-twice ·
[S4] https://www.pcgamer.com/is-sekiro-too-hard/ ·
[HK1] https://saschb2b.github.io/game-mechanics/games/hollow-knight/charms-and-notches ·
[LP1] https://pcgamer.com/lies-of-p-review · [LP2] https://gamesradar.com/lies-of-p-review ·
[SF1] https://gamespace.com/all-articles/news/soulframes-preludes-15-gods-ghosts-overhauls-loot-builds-and-social-play/ ·
[SF2] https://www.pcgamesn.com/soulframe/preludes-13-virtue-prisms ·
[DW1] https://timesaver.gg/blog/blood-of-dawnwalker-crafting-upgrade-guide ·
[DW2] https://mobalytics.gg/gamebase/guides/the-blood-of-dawnwalker-legendary-gear

## 2. Bestandsaufnahme (Stand vor D393)

| Was | Wo | Befund |
|---|---|---|
| 14 Gegenstände, sechs Wirkungen | `content/gegenstaende/`, Schema `GegenstandWirkung` | Für den Rundenkampf gebaut: Heilung in Anteilen der KP (`kraeutersud` 35 %, `harzverband` 70 %, `quellwasser` 100 %), `herzfunke` (Wiederbelebung), `reinkultur`, `zunder` (Fokus), `koeder`/`netzschlinge` (Fangchance — Fangen ist seit D374 entfallen), sechs Reinkultur-Komponenten |
| Beute | `beuteChance` je Gegenstand, `beute()` in `src/spiel/gegenstaende.ts` | Ein Wurf je Kampf, höchstens ein Fund; gilt für **jeden** Sieg, auch den, der reinigt. D379 („Material nur von Getöteten, Raten halbiert“) ist nicht gebaut |
| Schmiede | `src/spiel/schmiede.ts` (D177), `tests/schmiede.test.ts` | Drei Stufen je Waffe, +12 % Schaden und Haltungsschaden je Stufe. Preis in **Heilmitteln**: 1 / 2 / 3 Harzverband, ab Stufe 2 dazu 1 / 2 Herzfunken. Kernfunke einsetzen: 2 Harzverband (D188) |
| Waffen | `content/waffen/` (Klinge, Axt, Speer), `Spielstand.waffenStufen` | Alle drei von Anfang an im Besitz; keine Rüstung, kein Zeug |
| Fortschritt | `src/spiel/fortschritt.ts`, `tests/fortschritt.test.ts` | Stufe 1–40, Erfahrung, Mutation — für **Kreaturen im Team**. Das Team ist entfallen (Bibel v2 §2); der Brachgänger selbst hat keine Stufe (`SPIELERIN.lebenMax` 100, fest) |
| Marke | `content/reinigen.json` (`fassung`: 4 + 2 je Regent, `ladung` 1, Verhärtete 3) | Als Regelkern hinter Schalter (D376); Läuterung, Markenstufen, Reviergunst nur gerechnet (Reinigen v1 §4, A5/A6) |
| Heilung im Echtzeitkampf | `src/kampf/echtzeit.ts` | **Gibt es nicht.** Kein Schluck, kein Verband im Echtzeitkampf |
| Aufträge | `content/auftraege/` (19), `Auftrag.belohnung` = Gegenstand → Anzahl | Belohnungen fast durchweg Sud/Harz/Köder; zwei Werkzeug-Aufträge mit Platzhalter (D391) |
| Startbeutel | `LEERER_STAND.beutel` | 2 Kräutersud, 1 Köder |
| Tod | `Spielstand.letzteZuflucht` | Niederlage heilt voll, nichts geht verloren |

Drei Dinge passen nicht mehr zur Bibel v2: Heilmittel sind Schmiedewährung; Beute fällt auch beim Reinigen; die halbe
Gegenstandsliste dient einem Fangen, das es nicht mehr gibt.

## 3. Die Kernspannung als Ökonomie: zwei Achsen

**Töten gibt Stahl. Reinigen gibt Marke.** Beides wächst, aber nicht aus demselben Topf, und kein Tausch führt von
einem in den anderen.

| | Achse **Stahl** | Achse **Marke** |
|---|---|---|
| Wächst aus | dem, was Getötete hinterlassen (D379) | dem, was man reinigt: **Läuterung** |
| Wer nimmt es | die Schmiedin am Nordende der Terrasse | niemand — die Marke selbst, an der Rast |
| Einheit | Chitinspan (1), Federstahl (2), Härtling (3), Kernschlacke (4) | 1 je Tier, 5 je Verhärtetem, 15 je geheiltem Regenten |
| Stufen | Waffe 1 / 2 / 3: 8 Span · 14 Span + 3 Federstahl · 22 Span + 4 Federstahl + 3 Härtlinge | Schwellen 25 / 60 / 110 / 170: je +1 Fassung; Stufe 2 Griff +0,2 s, Stufe 4 Verhärtete ×1,5 statt ×2 (Reinigen v1 A5) |
| Wirkung | +12 % Schaden und Haltungsschaden je Stufe (D177, unverändert) | mehr Reinigungen zwischen zwei Rasten |
| Eigene Schleife | leere Reviere: keine Kämpfe mehr, aber auch nichts mehr zu holen | ruhige Reviere: Rast ohne Zuflucht, Setzlinge, Reinproben (§5.3) |
| Wer darauf schaut (D385) | das Erbe (Macht) | die Enklave (Anteil gereinigt) |

**Wo sie sich kreuzen** — vier Stellen, an denen eine Entscheidung liegt:

1. **Der Verhärtete.** Getötet gibt er einen Härtling; gereinigt 5 Läuterung, er bleibt, das Revier zählt. Die
   Waffenstufe 3 kostet drei Härtlinge: **Wer die Hauptwaffe ausschmiedet, hat drei von fünf Verhärteten getötet.**
2. **Der Regent.** Getötet: Kernschlacke. Geheilt: 15 Läuterung und überall ruhige Reviere. Beide Male +2 Fassung,
   Kernfunke, Protokoll (entschieden).
3. **Die kleine Gegengabe.** Was einmalig in der Welt liegt, gibt jeder Spielweise ein Stück der anderen Achse:
   10 Span und 6 Federstahl in Spinden und Wagen (der Heiler kommt auf Waffenstufe 1), 5 Eichsiegel zu je 5 Läuterung
   (der Schlächter kommt auf Markenstufe 1).
4. **Die Flasche.** Beide brauchen sie. Schlucke kommen aus Setzlingen (ruhige Reviere und vier Fundorte), Stärke aus
   Quellwasser (drei Fundorte über dem Befall, beschwerlicher Weg).

### Überschlagsrechnung Œntal

> **Seit D416** rechnet `tools/oekonomiesim.ts` über die 13 echten Reviere (§14.4); die Tabelle hier ist der Stand mit 12
> angenommenen gleich grossen Revieren und bleibt als Vergleich (die Funktion `bilanz` ist unverändert).

`npx tsx tools/oekonomiesim.ts` — Erwartungswerte, kein Kampf. **Annahmen** (Reinigen v1 §4 A1/A3, keine gemessen):
180 Begegnungen mit 280 Tieren, 20 Rasten, dazu **angenommen** 5 Verhärtete (3 verborgene Orte + 2 Engstellen am
Uferweg), 4 menschliche Gegner, 12 Reviere. Span 15 % je getötetem Tier, 1 Federstahl je getötetem Menschen. Alle
Spielweisen finden alles Einmalige ausser dem Umgeher (60 %).

| | Schlächter | Gemischt | Heiler | Umgeher |
|---|---|---|---|---|
| Tiere getötet / gereinigt / umgangen | 280 / 0 / 0 | 176 / 104 / 0 | 0 / 171 / 110 | 0 / 54 / 226 |
| Verhärtete getötet / gereinigt | 5 / 0 | 3 / 2 | 0 / 5 | 0 / 1 |
| Chitinspan / Federstahl / Härtling / Kernschlacke | 52 / 10 / 5 / 1 | 36 / 8 / 3 / 0 | 10 / 6 / 0 / 0 | 6 / 3 / 0 / 0 |
| Waffenstufen (Haupt / zweite / dritte) | 3 / 1 / 0 | 2 / 1 / 0 | 1 / 0 / 0 | 0 / 0 / 0 |
| Waffenschaden Hauptwaffe | +36 % | +24 % | +12 % | +0 % |
| Läuterung → Markenstufe | 25 → 1 | 154 → 3 | 236 → 4 | 89 → 2 |
| Fassung nach dem Regenten | 7 | 9 | 10 | 8 |
| ruhige Reviere | 0 von 12 | 0 von 12 | 12 von 12 | 0 von 12 |
| Flasche (Schlucke × Stärke) | 5 × 55 % | 5 × 55 % | 6 × 55 % | 4 × 45 % |
| Anteil gereinigt an den Eingriffen | 0 % | 37 % | 100 % | 100 % |

**Befunde:**

1. **Keine der drei kämpfenden Spielweisen schlägt eine andere auf beiden Achsen** (3/1, 2/3, 1/4; als Test
   festgehalten). Der Umgeher verzichtet auf beides; sein Lohn ist das Vertrauen der Mönche und die Flechtenkutte.
2. **Gemischt liegt 16 Läuterung unter der vierten Schwelle** (154 gegen 170). Fände er ein sechstes Eichsiegel oder
   reinigte er einen dritten Verhärteten, bliebe es bei 3 — aber die Spanne ist schmal. Die Schwellen sind die
   empfindlichste Zahl dieser Tabelle.
3. **Die Regel für das ruhige Revier aus Reinigen v1 (A6, „≥ 60 % der Begegneten gereinigt“) ist wörtlich nicht
   erreichbar:** Zwischen zwei Rasten liegen 14 Tiere, die Marke fasst 4–8. Wörtlich gerechnet hat der Heiler null
   ruhige Reviere und wird von Gemischt dominiert (2/3 gegen 1/3) — der Befund 2 aus Reinigen v1 §4, jetzt gerechnet.
   Gesetzt als Arbeitswert: ruhig, wenn ≥ 60 % der **Eingriffe** Reinigungen sind **und** ≥ 25 % der Tiere des Reviers
   gereinigt wurden (`ruhigAb`, `ruhigMindestens`). Zu bestätigen (A-28.3).
4. **Die Rast im ruhigen Revier ist der stärkste Hebel der ganzen Rechnung.** Mit voller Aufladung reinigt der Heiler
   231 Tiere (Läuterung 296), mit halber (`ruhigeRast` 0,5, gesetzt) 171. Die Schwellen 25 / 60 / 110 / 170 wären damit
   **im ersten von fünf Kapiteln** ausgeschöpft — sie stammen aus einer Rechnung mit 100 Reinigungen. Für das ganze
   Spiel braucht es weitere Schwellen oder einen flacheren Ertrag (A-28.4).
5. **Der Heiler ist durchspielbar gerechnet, nicht gemessen:** +12 % Waffe, Fassung 10, sechs Schlucke, vier
   Reinkulturen übrig. Ob das gegen den Flussvater reicht, weiss niemand — es gibt im Echtzeitkampf keinen Regenten.
6. Gegenüber Reinigen v1 §4: Der Schlächter bringt die Zweitwaffe auf Stufe 1 statt 2, Gemischt bleibt bei Stufe 2,
   der Heiler kommt sicher auf Stufe 1 (dort „+0 … +12 %“). Die Reihenfolge der Spielweisen ist dieselbe.

## 4. Stufenzahl: warum vier und drei

Vier Materialstufen für **fünf Regionen**, drei Waffenstufen (D177). Regel 2: neun Varianten je Sorte machen aus
Schmieden Buchhaltung; Regel 4: wenige Stufen, jede spürbar. +12 % je Stufe ist im Echtzeitkampf geprüft
(`tests/schmiede.test.ts`) — eine vierte Stufe wäre +48 % und ungeprüft. Deshalb ist Stufe 4 in den Daten ein
**Vorschlag** (`vorschlag: true`, zählt in keiner Rechnung): die Kernschlacke eines getöteten Regenten, je Region eine,
für genau eine Waffe (A-28.2).

## 5. Gegenstandsklassen

### 5.1 Aufwertungsmaterial (Achse Stahl)

| Stufe | Gegenstand | Herkunft in der Welt | Knapp oder nachwachsend | Beim Tod |
|---|---|---|---|---|
| 1 | **Chitinspan** | aus dem Befall: Platten getöteter Tiere (15 % je Tier); 10 einmalig in Spinden und Wagen | fliesst, solange man tötet; Tausch 5 Span → 1 Federstahl nach dem Lieferbuch | bleibt liegen |
| 2 | **Federstahl** | Altbestand der Betriebe: Blattfedern, Sägeblätter — 6 Fundorte; 1 je getötetem Menschen (sie tragen ihn als Werkzeug) | endlich in der Welt, über Tausch streckbar | bleibt liegen |
| 3 | **Härtling** | der Kern eines **getöteten** Verhärteten | 5 im Tal, dazu 1 aus der Linie des Erbes; nie nachwachsend | bleibt beim Träger |
| 4 | **Kernschlacke** | der zerschlagene Direktivkern eines **getöteten** Regenten | 1 je Region | bleibt beim Träger |

Ob getötete Tiere nachwachsen, ist offen (A-28.5). Die Rechnung nimmt an: nein.

### 5.2 Verbrauchsgüter und die Flasche

| Gegenstand | Heute | Vorschlag Echtzeit | Aufwertung |
|---|---|---|---|
| **Kräutersud** | Heilung 35 %, Beute 30 % | Inhalt der **Sudflasche**: 3 Schlucke zu 35 % Leben, voll an jeder Rast | Schlucke 3 → 6: je 2 Setzlinge bei der Magd (ein Beet). Stärke 35 → 45 → 55 %: je 1 Quellwasser im Ansatz |
| **Harzverband** | Heilung 70 %, Beute 10 %, Schmiedewährung | starker, langsamer Verband; Traglast 3; kein Schmiedepreis mehr | mit dem Zettel „Harz auf Leinen“ je Rast in Brannburg einer gegen Zunder |
| **Quellwasser** | Heilung 100 %, Beute 2 % | volle Heilung **oder** in die Flasche geben — drei im Tal | — (ist selbst die Aufwertung) |
| **Herzfunke** | Wiederbelebung 50 %, Schmiedewährung | einmal aufstehen mit halbem Leben, dann verbraucht; Traglast 1 | — |
| **Zunder** | Fokus +4 | lädt den Kernfunken sofort (D188) | — |
| **Köder** | Fangchance +15 | lockt Tiere von einer Stelle weg — das Werkzeug des Umgehers (D385) | — |
| **Netzschlinge** | Fangchance +35 | hält ein niedergerungenes Tier für einen Griff: ein sicheres Fenster zum Reinigen | — |

Die Wirkungen in den Dateien sind **nicht** geändert (Rundenkampf-Tests hängen daran); die rechte Spalte ist Entwurf.
Jede Echtzeitwirkung ist ein Kampfwert und braucht Messung (Kampfbot), bevor sie gilt.

### 5.3 Reinkulturen

- **Die drei Komponenten des Regenten** (Saatgut, Katalysator, Wasserprobe; D240) bleiben, wie sie sind.
- **Die Reinkultur für Verhärtete** (`reinkultur`) fällt nicht mehr aus Getöteten. Die Alte setzt sie aus zwei
  **Reinproben** an — Erde aus einem ruhigen Revier (eine je Revier, einmalig), zwei liegen in der Welt, zwei
  fertige Kulturen sind Belohnungen. Damit kann auch der Schlächter zwei Verhärtete reinigen, wenn er will; der
  Heiler alle fünf.
- **Ein ruhiges Revier gibt einmalig:** 1 Setzling, 1 Reinprobe, und es ist ein Rastplatz ohne Zuflucht.

### 5.4 Werkzeuge und Zugang

| Gegenstand | Art | Wo (D391) |
|---|---|---|
| **Tauchzeug** | Werkzeug `tauchen` | Spind unter dem Boot, Schuppen am Nordufer (Rätsel, Zahl von der Tafel im Absetzbecken). Seit D411 **auch Anzug**: hält die Kälteuhr im tiefen Wasser an |
| **Kletterzeug** | Werkzeug `klettern` | Auftrag `was-noch-drin-liegt` (Wart vom Bruch) — Belohnung in den Daten gesetzt |
| **Gleiter** | Werkzeug `gleiten` | verhärtetes Grathorn am Quelltopf (optionaler Boss) — seit D411 nur Leinen und Gurtzeug; die Kappe näht die Enklave neu aus gewachstem Leinen |
| **Halfter** | Werkzeug `reiten` | Auftrag `ein-schwieriger-nachbar` (Förster) — Belohnung in den Daten gesetzt. Seit D411 bindet es **das letzte verwilderte Tragtier des Försterhofs** (befallen, erst zu reinigen), nicht einen gereinigten Keiler |
| **Brechstange vom Bruch** | Zugang `stollenmauer` | der Vorarbeiter am Bruchweg — wenn man ihn verschont oder besiegt |
| **Plombenzange** | Zugang `werksspind` | öffnet alle verplombten Werksspinde: ein Grund, an bekannte Orte zurückzukehren |
| **Schlüssel zum Schieberhaus** | Zugang `schieberhaus` | Abkürzung am Wehr; liegt hinter dem Flussvater oder am Ende ~~des Tauchwegs~~ **des Wegs ohne Kampf** (D411) |

Die Zahl 09/41 ist **kein** Gegenstand: Ein Rätsel, dessen Lösung im Beutel liegt, ist keines.

### 5.5 Waffen

Keine neuen Waffen — jede bräuchte geprüfte Kampfwerte und Clips. Vorschlag: Man beginnt mit der **Klinge**; Axt und
Speer sind Fundwaffen (`fundwaffe-axt` „Spaltaxt vom Bruch“, `fundwaffe-speer` „Saufeder“). Eine Waffe zu finden ist
im Vorbild die meistgeliebte Belohnung, und hier kostet sie nichts ausser einer Zeile im Spielstand (A-28.6).

### 5.6 Zeug (Rüstung)

Ein Platz. Kein Stück ist „besser“; jedes verschiebt. **Alle Werte sind Entwurf und nicht simuliert.**

| Stück | Gibt | Nimmt | Herkunft |
|---|---|---|---|
| Lodenmantel (Start, kein Gegenstand) | — | — | — |
| **Chitinweste** | −15 % erlittener Schaden | −10 % Ausdauer-Erholung; „die Tiere riechen, woraus sie ist“ | Schmiedin: 20 Span + 2 Federstahl (§11) |
| **Wachstuchkittel** | im Griff ×1,10 statt ×1,25 verwundbar | — (nur im Griff wirksam) | Figurenlinie der Enklave |
| **Flechtenkutte** | Tiere bemerken einen 30 % später | +10 % erlittener Schaden; die Terrasse misstraut | Figurenlinie der Mönche |
| **Werkskluft** | Kernfunke lädt 20 % schneller | im Griff ×1,35 verwundbar; „wird für jemanden gehalten“ | Figurenlinie des Erbes |

### 5.7 Marke

Fassung 4, +2 je Regent (entschieden), +1 je Markenstufe. Läuterung entsteht beim Reinigen. **Eichsiegel** (5 im Tal,
je 5 Läuterung) sind die Gegengabe für den, der nicht reinigt; sie werden an der Rast eingesetzt.

### 5.8 Wissen

Wissen ist nur dann ein Gegenstand, wenn es etwas **öffnet**. Fundtexte ohne Nutzen bleiben Fragmente.

| Gegenstand | Form | Öffnet |
|---|---|---|
| **Lieferbuch der Esse** | Schrift | Tausch 5 Span → 1 Federstahl; die letzte Seite nennt die Höfe, an denen noch Federn liegen |
| **Zettel: Harz auf Leinen** | Rezept | Harzverband je Rast bei der Magd |
| **Flurkarte, Blatt West** | Karte | zeigt den alten Almweg als Zeichnung im Beutel — keine Marke auf dem Bildschirm (Story-Struktur v1) |
| **Pegelbuch** | Schrift | nennt, was bei welchem Wasserstand herausschaut: Vorschau auf den Wandel nach dem Flussvater |
| **Wartungsblatt K7** | Schrift | zeigt beim K7-Wolf das Griff-Fenster an (Anzeige, kein Kampfwert) |

## 6. Belohnungsleiter

Alles ist **einmalig**. Wiederholbar sind nur drei Dinge: Beute von Getöteten, Läuterung von Gereinigten, Tausch je Rast.

| Sprosse | Was | Unikat | Mengenware (eine Sorte je Stelle) | Regel |
|---|---|---|---|---|
| Kleine Entdeckung | Spind, Hochsitz, Wagen abseits | nie | 2 Span **oder** 1 Federstahl **oder** 1 Harzverband / 2 Köder / 1 Zunder | dazu immer ein Bild oder ein Satz; nie Stufe 3 |
| Verborgener Ort | mit eigenem Verhärteten | **immer eines** (Wissen, Zugang, Zeug, Fundwaffe) | 4 Span, 2 Federstahl, 1 Eichsiegel, 1 Setzling / Reinprobe / Quellwasser | der Verhärtete zahlt zusätzlich wie ein optionaler Boss |
| Nebenaufgabe | Auftrag eines Bewohners | am Ende einer Kette: Werkzeug, Wissen, Zugang oder Fundwaffe | 3 Span, 2 Federstahl, 1 Eichsiegel, 2 Verbrauch | kein Auftrag endet nur mit einem Sud |
| Figurenlinie | Abschluss nach 3–5 Stationen | **das Zeug der Fraktion** | Enklave: 1 Eichsiegel · Erbe: 1 Härtling · Mönche: Wissen; dazu 1 Reinkultur oder Herzfunke | Stationen davor: Mengenware der Sprosse „Nebenaufgabe“ |
| Optionaler Boss | Verhärteter | nie (das Unikat liegt am Ort, nicht im Tier) | **getötet:** 1 Härtling · **gereinigt:** 5 Läuterung, Tier bleibt | was er bewacht, liegt in beiden Fällen da |
| Regent | — | Direktivkern, Protokoll | **getötet:** 1 Kernschlacke · **geheilt:** 15 Läuterung, ruhige Reviere | immer +2 Fassung |

**Gegen Kopier-Belohnungen:** Unikate liegen je Region in einem Vorrat (`content/belohnungen.json` `unikate`);
`verteile()` gibt jedes Stück höchstens einmal aus und meldet einen leeren Vorrat als Fehler. Œntal hat 4 Werkzeuge,
2 Fundwaffen, 4 Zeug, 5 Wissen, 3 Zugänge = **18 Unikate** — genug für 3 verborgene Orte, 3 Figurenlinien und rund
ein Dutzend Auftragsenden.

**Vertrag mit D392:** Ein Auftrag nennt Kategorie und Sprosse; `verteile(tabelle, stellen)` liefert Gegenstand und
Menge. Bei `verbrauch` entscheidet die Auftrags-ID über die Sorte (derselbe Auftrag gibt immer dasselbe), ein
`wunsch` legt sie fest. `Auftrag.belohnung` (Gegenstand → Anzahl) bleibt das Format im Spiel.

## 7. Tausch in Brannburg, Rast und Aufladen

Kein Geld. Jeder Bewohner tauscht, was er kann, gegen das, was ihm fehlt (`content/oekonomie.json` `tausch`).

| Wer | Gibt | Nimmt | Bedingung |
|---|---|---|---|
| Schmiedin | Waffenstufen | Span, Federstahl, Härtling | — |
| Schmiedin | 1 Federstahl | 5 Chitinspan | Lieferbuch der Esse |
| Schmiedin | Chitinweste | 20 Span + 2 Federstahl | einmalig |
| Magd | +1 Schluck | 2 Setzlinge | bis 6 Schlucke |
| Magd | Sud eine Stufe stärker | 1 Quellwasser | zweimal |
| Magd | 1 Harzverband | 1 Zunder | Zettel; einmal je Rast |
| Alte | 1 Reinkultur | 2 Reinproben | — |
| Förster | 2 Köder | 1 Chitinspan | einmal je Rast |
| Wirt | 2 Zunder | 1 Köder | einmal je Rast |

| Rast | Marke | Flasche | Sonst |
|---|---|---|---|
| Zuflucht | voll | voll | speichern; Schmiede nur, wo ein Mensch lebt (Bibel §3) |
| **Ruhiges Revier** (Achse Marke) | halbe Fassung (`ruhigeRast`) | — | einmalig Setzling und Reinprobe |
| Leeres Revier (leergetötet) | — | — | nichts; es ist nur still |

## 8. Tod und Verlust

**Empfehlung — das Bündel.** Wer fällt, wacht an der letzten Zuflucht auf. Am Ort bleibt ein Bündel mit dem **losen
Material** (Chitinspan, Federstahl). Alles andere bleibt am Körper: Werkzeug, Zeug, Wissen, Härtlinge, Verbrauchsgüter,
Läuterung. Holt man das Bündel, ist nichts verloren. Fällt man vorher noch einmal, **nimmt der Befall es auf**: Das
nächste befallene Tier am Ort trägt es eingewachsen, sichtbar in der Signalfarbe. Getötet oder gereinigt gibt es das
Bündel zurück.

- **Aus der Welt:** „Der Befall nimmt auf, was Menschen liegen lassen“ (Traversal v2 §5, das Grathorn mit dem Schirm).
  Die Marke bringt ihren Träger zurück — er ist der Prototyp (Bibel v1 §3).
- **Aus der Recherche (Regel 10):** Der Einsatz bleibt, der endgültige Verlust nicht; statt desselben Anlaufs noch
  einmal gibt es eine neue kleine Begegnung.
- **Asymmetrie, gewollt:** Der Heiler trägt wenig loses Material und verliert wenig. Reinigen ist im Kampf das
  grössere Risiko (Reinigen v1 §3); der Tod kostet dafür den Schlächter mehr.

**Alternative — nichts bleibt liegen.** Der Tod kostet nur den Weg; dafür erholt sich das Revier (Verwundete sind
wieder heil, Gereinigte bleiben rein). Einfacher zu bauen, kein Einsatz, kein Genre-Moment.

## 9. Itemtexte als Erzählträger

Regel: zwei bis drei Sätze, einer nennt die Sache, einer einen Menschen oder eine Zahl. Kein Adjektiv, das wertet.
Die Texte stehen als `beschreibung` in den Daten.

1. **Chitinspan** — „Platte von einem, der nicht mehr aufsteht. Leicht wie Horn, hart wie Blech. Die Schmiedin nimmt sie, ohne zu fragen, woher.“
2. **Federstahl** — „Blattfeder von einem Hänger, der seit vierzig Jahren steht. Besseren Stahl macht hier keiner mehr. Es gibt, was noch da ist.“
3. **Härtling** — „Der Kern eines Verhärteten, faustgross, noch warm. Wer ihn in der Hand hat, hat sich entschieden.“
4. **Kernschlacke** — „Was von einem Direktivkern bleibt, wenn man ihn nicht liest, sondern zerschlägt. Schwer, glasig, in einem Stück.“
5. **Eichsiegel** — „Prüfplombe aus einem Werkskoffer, Aufdruck VERIDIA Feldabgleich. Die Marke nimmt sie an wie eine Hand ein Werkzeug.“
6. **Setzling** — „Bergkraut mit Wurzelballen, in feuchtes Moos geschlagen. Wächst nur, wo niemand mehr etwas aufreisst.“
7. **Reinprobe** — „Ein Glas Erde aus einem Revier, das zur Ruhe gekommen ist. Zwei davon, und die Alte setzt eine Kultur an.“
8. **Kletterzeug** — „Geschirr, Seil und Eisen aus dem Bruch. Vierzehn Jahre benutzt, dann eingemauert. Wer zumauert, will nicht wiederkommen.“
9. **Gleiter** — ~~„Ein Schirm, der lange in einem Geweih hing. Die Nähte halten. Jemand wollte damit über die Grenze und kam bis zur Quelle.“~~
   **seit D412:** „Leinen und Gurte aus einem Geweih, die Kappe neu genäht aus gewachstem Leinen. Sinkt schneller, als sein Vorbild es tat. Jemand wollte damit über die Grenze und kam bis zur Quelle.“ (Physik-Prüfung v1 §5 (b))
10. **Halfter** — ~~„Hing im Stall am Haken, seit es keine Pferde mehr gibt. Bindet ein Tier, das geblieben ist. Eines, nicht zwei.“~~
   **seit D412:** „Hing im Stall am Haken, seit es keine Pferde mehr gibt. Eines ist geblieben: das letzte Tragtier des Hofs, verwildert und befallen. Erst reinigen, dann anlegen. Eines, nicht zwei.“
- **Tauchzeug** (Text seit D412, vorher ohne Anzug): „Atemgerät der Klärwerkswartung, Anzug und Leine. Der Anzug hält die Kälte ab, die Flasche reicht für Abstiege, nicht für Strecken. Auf dem Zettel im Spind dieselbe Zahl, andere Handschrift.“
11. **Flechtenkutte** — „Grobes Tuch, von Flechten überwachsen. Die Tiere sehen einen später. Die Leute auf der Terrasse früher.“
12. **Werkskluft** — „Jacke mit eingewebten Leitbahnen, Brustschild VERIDIA. Der Kern lädt schneller. Wer sie trägt, wird für jemanden gehalten.“
13. **Zettel: Harz auf Leinen** — „Drei Zeilen in Bleistift. Fichte, nicht Kiefer. Warm auftragen, kalt binden. Darunter: Hat bei Sepp nicht mehr gereicht.“
14. **Pegelbuch** — „Jeden Morgen eine Zahl, seit dem Frühjahr. Am Rand, mit anderem Stift: was bei welchem Stand wieder herausschaut.“
15. **Brechstange vom Bruch** — „Sechskant, ein Ende flachgeschmiedet. Der Vorarbeiter hat sie mitgenommen, damit die Mauer zubleibt.“

## 10. Umsetzungsliste — was Schema und Code noch nicht können

| # | Was fehlt | Wo |
|---|---|---|
| 1 | Schmiede auf Material umstellen (`angebot()` liest `oekonomie.json`); `tests/schmiede.test.ts` prüft heute den Harzpreis | `src/spiel/schmiede.ts` |
| 2 | Beute nur von Getöteten, je Gegnerart (`oekonomie.json` `beute`); `beuteChance` der Altgegenstände auf 0 | `src/spiel/gegenstaende.ts`, Kampfplatz |
| 3 | Läuterung, Markenstufe, Eichsiegel im Spielstand; Wirkung der Stufen 2 und 4 im Regelkern | `Spielstand`, `src/kampf/echtzeit.ts` |
| 4 | ~~**Reviere gibt es nicht als Daten** — Grenzen, Zählung gereinigt/getötet, Zustand ruhig/leer~~ **D416:** Daten (`content/reviere/`, Schema `Revierkarte`), Zählung und Zustand (`src/spiel/reviere.ts`), Spielstand v3; offen ist, was die Welt daraus macht (§14.6) | ~~Schema `Region`, Spielstand~~ §14 |
| 5 | Heilung im Echtzeitkampf: Flasche, Verband, Herzfunke — jede Wirkung ein Kampfwert, erst messen | `src/kampf/echtzeit.ts`, `tools/kampfbot.ts` |
| 6 | Tod: Bündel am Ort, Aufnahme durch den Befall | Spielstand, Kampfplatz |
| 7 | Tausch-Fenster je Bewohner; „je Rast“ zählen | `src/ui/`, `Ort.dienst` kennt nur die Schmiede |
| 8 | Werkzeuge wirken: Klettern-Grundwert, Tauchen, Gleiter-Schalter, Bindung (Traversal v2 §8) | `src/world/`, `src/spiel/reiten.ts` |
| 9 | Fundwaffen: Besitz je Waffe im Spielstand (heute alle drei ab Start) | `Spielstand.waffenStufen` |
| 10 | Zeug: Platz im Spielstand, Werte im Kampf — jede Zahl ungeprüft | Schema, `echtzeit.ts` |
| 11 | Aufträge mit Kategorie statt Gegenstand (D392); Auftragsziel „Lager“ und „Mensch verschont“ fehlen — `was-noch-drin-liegt` gibt das Kletterzeug deshalb schon fürs Lesen des Fundstücks | Schema `Auftrag`, `Auftragsziel` |
| 12 | Fundorte der einmaligen Dinge (10 Span, 6 Federstahl, 5 Eichsiegel, 4 Setzlinge, 3 Quellwasser …) als Daten mit Koordinaten | `content/fragmente/` oder neue Art „Fund“ |
| 13 | Fortschritt `fortschritt.ts` (Stufe, Mutation der Kreaturen) hat seit dem Wegfall des Teams keinen Nutzer | entscheiden: entfernen oder für Reittier nutzen |

## 11. Physik (D398): was stimmt, was nicht, und wo das Spiel abweicht

> **Bewegungs- und Weltwerte** (Tempo, Tauchen, Luftvorrat mit Arbeit und Reserve, Gleitzahl, Reittier, Fallhöhe)
> sind in `BRACHLAND_Physik-Pruefung_v1.md` geprüft (D408); dort auch die Liste der benannten Abweichungen.
> **Entschieden D411, nachgezogen D412:** Tauchzeug ist auch Anzug und Luft ein Vorrat für Abstiege; der Gleiter ist aus
> geborgenen Leinen mit neu genähter Kappe; das Halfter bindet das letzte Tragtier des Försterhofs. Die Zeilen unten
> sind entsprechend markiert.

Flo, 22.11.2026 (D398): Physik muss stimmen; Abweichungen zugunsten des Spiels werden benannt, nie still gemacht.
Gewichte stehen als `gewicht` (kg) an jedem Gegenstand, `validate` verlangt sie. Zahlen sind Überschläge aus
Dichte × Volumen oder aus üblichen Gerätegewichten, **nicht gewogen**.

### Material und Verarbeitung

| Schritt | Was real geht | Im Spiel | Abweichung |
|---|---|---|---|
| **Chitinspan** (0,1 kg; Platte etwa 12 × 15 cm, 4 mm, Dichte ≈ 1,35 g/cm³) | Chitin schmilzt nicht und lässt sich **nicht schmieden**; es verkohlt. Verkohltes Horn, Huf und Knochen sind aber das klassische Mittel zum **Einsatzhärten**: Eisen im dichten Kasten in stickstoff- und kohlenstoffreicher Kohle glühen, die Randschicht nimmt Kohlenstoff auf | Stufe 1 = Schneide im Chitinkohle-Kasten einsatzgehärtet; 8 Span = 0,8 kg Packung | keine in der Art; in der Wirkung: Härten hält die Schneide länger scharf, macht den Hieb aber nicht 12 % stärker — **+12 % ist Spielwert** (D177) |
| **Federstahl** (1,0 kg; ein abgelängtes Blatt) | Blattfedern sind Federstahl (Typ 55Si7/5160) und das übliche Ausgangsmaterial für Klingen aus Altbestand; mit Holzkohle-Esse schmied- und in Öl härtbar. Neuen Stahl erschmelzen kann eine Dorfesse nicht | Stufe 2 = neue Schneide aus Federstahl angeschweisst; 3 Stück = 3 kg für Klinge samt Abbrand, bei der Axt reichlich | keine; „Besseren Stahl macht hier keiner mehr“ stimmt |
| **Härtling** (0,6 kg, faustgross ≈ 250 cm³) | **erfunden** — ein Symbiontenkern hat keine reale Entsprechung | Stufe 3 | benannt: Fiktion der Welt. Gedacht als harter Einsatz in der Schneide (wie ein Hartmetallplättchen), nicht als Legierung |
| **Kernschlacke** (2,5 kg, ein Liter Glas) | Schlacke und Glas sind spröde; als Schneide unbrauchbar | nur Vorschlag (Stufe 4) | spricht **gegen** die vierte Waffenstufe (A-28.2) — physikalisch wäre sie ein Rückschritt |
| **Chitinweste** (4,0 kg) | Rumpf vorn und Schultern ≈ 0,37 m² × 4 mm × 1,35 = 2,0 kg Platten, dazu 2 kg Leder und Nieten | 20 Span + 2 Federstahl (für Nieten und Schliessen reichlich) | Preis von 10 auf 20 Span gehoben, damit die Fläche stimmt |
| **Beute 15 % je Tier** | Ein Keiler mit Wurzelpanzer trüge etliche Kilo Platten | ein brauchbarer Span von jedem siebten Tier | **zugunsten des Spiels**: brauchbar ist nur die Platte, die der Kampf heil gelassen hat. Real wäre nach wenigen Tieren genug da |
| **Harzverband** (80 g) | Fichtenharzsalbe ist ein überliefertes Wundmittel mit nachgewiesener keimhemmender Wirkung; Zunderschwamm wurde als blutstillende Auflage genutzt — daher der Tausch Zunder gegen Verband | Heilung 70 % | **Wirkdauer:** real Tage, im Spiel sofort. Benannt, Genre-Regel |
| **Kräutersud / Flasche** | 3 Schlucke ≈ 0,5 l, 6 Schlucke ≈ 1 l (1,2 kg mit Flasche) | 35–55 % Leben je Schluck | sofortige Wirkung: Spielwert. Ein Beet aus zwei Setzlingen trägt real erst nach einer Saison — im Spiel ab der nächsten Rast |
| **Quellwasser im Ansatz** | Wasser macht einen Aufguss nicht stärker | +10 Punkte Stärke | **Fiktion der Welt** (unbefallenes Wasser), nicht Physik |
| **Reinkultur aus zwei Reinproben** | Eine Kultur anzusetzen dauert Tage bis Wochen | sofort bei der Alten | zugunsten des Spiels; Vorschlag: fertig erst nach der nächsten Rast |

### Werkzeuge

| Werkzeug | Gewicht | Was real gilt | Abweichung |
|---|---|---|---|
| **Tauchzeug** | 5,0 kg (kleine Flasche, Regler, Leine; seit D411 auch Anzug — Gewicht ⚠️ nicht nachgerechnet) | 2 l bei 200 bar = 400 l Luft; in 5 m Tiefe (1,5 bar) bei 20 l/min rund **13 Minuten** (in Ruhe, ohne Reserve — Nachtrag D412); **mit 50 bar Reserve und Arbeit (40 l/min) 5,0 min in 5 m, 2,9 min am Kirchturm** (Physik-Prüfung v1 §4.1). Gummi und Membranen halten keine 40–60 Jahre, eine Flasche ohne Prüfung ist ein Risiko, und ohne Kompressor füllt sie niemand | Zustand und Nachfüllen sind **zugunsten des Spiels** übergangen (Nachfüllen an der Rast, benannt). ~~Die 380-m-Querung zur Kapelle (Traversal v2) passt in 13 Minuten; „Tauchen ohne Grenze“ passt nicht — eine Luftanzeige wäre ehrlicher~~ **Seit D411:** Luft ist ein Vorrat für Abstiege, nicht für Strecken — an der Oberfläche schwimmt und atmet man, der Anzug hält die Kälteuhr an. Werte in `content/bewegung.json` `tauchen` (Entwurf) |
| **Kletterzeug** | 4,5 kg (Gurt 0,5; 40 m Seil zu 65 g/m = 2,6; Haken und Karabiner 1,4) | Ein vierzehn Jahre benutztes und dann eingemauertes Kunstfaserseil würde niemand mehr belasten; Eisen überdauert | benannt. Stimmiger wäre: Eisen und Geschirr aus dem Stollen, das Seil neu geschlagen (Hanf, Enklave) |
| **Gleiter** | 8,0 kg (Schirm 5, Gurtzeug 3; die neu genähte Kappe aus gewachstem Leinen wäre schwerer — ⚠️ nicht nachgerechnet) | Gleitzahl real 8–9; verlangt sind 1.330 m Strecke auf 374 m Höhe = **3,6** — weit im Möglichen. Tuch, das jahrelang im Freien hing, wird luftdurchlässig und trägt nicht mehr | ~~Zustand des Tuchs zugunsten des Spiels übergangen~~ **Seit D411 keine Abweichung mehr im Tuch:** Leinen und Gurtzeug sind geborgen, die Kappe ist neu genäht; sie gleitet schlecht (3 : 1) und sinkt schnell (4 m/s) — ob gewachstes Leinen genau diese Werte gibt, ist nicht belegt; die Flugstrecke selbst stimmt |
| **Halfter / Reiten** | 0,5 kg | Faustregel: ein Reittier trägt etwa 20 % seines Gewichts. Ein Keiler von 140 kg trüge 28 kg, ein Steinbock um 100 kg noch weniger — **keinen Erwachsenen** | ~~⚠️ grösste Abweichung der Liste, gehört zu D391: Reiten geht nur auf einem durch den Befall deutlich vergrösserten Tier. Das müsste die Welt zeigen (Schulterhöhe, Masse)~~ **Behoben (D411):** Das Reittier ist das letzte verwilderte Tragtier des Försterhofs (Bergpferd oder Maultier, 450–500 kg, trägt 90 kg bei 20 %; Masse nicht belegt). Entwurf `content/bewegung.json` `tragtier`, ohne Kampfwerte |

### Traglast

| Posten | Gewicht |
|---|---|
| Loses Material, volle Traglast (40 Span, 6 Federstahl) | 4,0 + 6,0 = **10 kg** — das ist das Bündel |
| Vier Werkzeuge | 18,0 kg |
| Drei Waffen (Klinge ≈ 1,2, Axt 2,0, Speer 1,8) | 5,0 kg |
| Flasche, Verbände, Kleinzeug | ≈ 3 kg |
| **Summe** | **≈ 36 kg** |

Real sind zum Marschieren 20–25 kg tragbar (rund 30 % des Körpergewichts), zum Rollen und Fechten deutlich weniger.
**Benannte Abweichung zugunsten des Spiels:** Werkzeuge und Zweitwaffen wiegen im Spiel nichts. Begrenzt wird nur, was
eine Entscheidung trägt: loses Material (`traglast` 40 Span, 6 Federstahl — der Rest liegt bei der Schmiedin) und
Verbrauchsgüter (Harzverband 3, Herzfunke 1). Die Rechnung in §3 ist davon nicht berührt: Sie zählt, was anfällt,
nicht, was man auf einmal trägt.

## 12. Unklar

- ⚠️ Zahl der Verhärteten (5), der Menschen (4) und der Reviere (12) im Œntal ist **angenommen**; belegt sind nur drei
  verborgene Orte und „drei Engstellen mit je einem Verhärteten oder Rudel“.
- ⚠️ Alle Zeug-Werte, die Flaschenwerte und jede Echtzeitwirkung der Verbrauchsgüter: nicht simuliert.
- ⚠️ Ob der Heiler mit +12 % den Flussvater niederringt: nicht messbar, solange es ihn im Echtzeitkampf nicht gibt.
- ⚠️ Gewichte und Verarbeitungsschritte in §11 sind Überschläge aus Allgemeinwissen, nicht recherchiert und nicht gewogen.
- ⚠️ Die Recherche stützt sich auf Suchtreffer-Zusammenfassungen, nicht auf gelesene Volltexte; vier Punkte sind als
  „nicht belegt“ markiert.

## 13. Fortschritt der Spielfigur (D400)

> **Fortschreibung zu §3–§5, Entwurf, nichts verdrahtet.** Anlass: Flo hat A-28 (8) „kein Stufensystem“ nicht
> bestätigt, sondern am 22.11.2026 geantwortet (D399): „Kombination aus Waffe und Marke sowie Erfahrung durch Quests.
> Töten könnte eine Abkürzung sein aber das muss ziemliche Folgen haben. Ggf. könnte man das auch irgendwie koppeln mit
> erhöhung der vitalwerte durch bestimmte items oder Besiegen von Bossen oder sowas. Wie machen es andere? Oder man
> muss sich bestimmte Potions brauen und die Ingredients sind verstreut.“
> Daten: `content/techniken.json`, `content/oekonomie.json` (`brauen`, `erfahrung`, `toeten`), neun Gegenstände,
> Kategorien `vital` und `erfahrung`. Rechnung: `npx tsx tools/oekonomiesim.ts`. Fragen: Ledger A-28 (8).
> **Leben (100) und Ausdauer (100) sind geprüfte Kampfwerte und unverändert.**

### 13.1 Wie machen es andere?

| Spiel | Woher die Stärke kommt | Was Töten gibt | Vorteil | Nachteil | Was wir übernehmen |
|---|---|---|---|---|---|
| Dark Souls / Elden Ring | Währung aus jedem getöteten Gegner → Stufen; liegt beim Tod am Ort [E3]. Flasche: Saat = mehr Schlucke, Träne = stärkerer Schluck; dazu ein mischbares Fläschchen aus zwei von 32 Tränen [ER4][ER5] | alles: jeder Kill ist Fortschritt | Abfarmen als Notausgang, jeder Kampf lohnt | Töten ist die einzige Sprache; wer ausweicht, bleibt schwach | Die drei Flaschen-Regler (Zahl, Stärke, Mischung). **Nicht** die Kill-Währung — sie widerspräche der Marke |
| Sekiro | keine Stufen. Leben: vier Perlen von Zwischenbossen = ein Stück [S1]; Angriff: Erinnerung je Hauptboss, an der Rast eingesetzt [S5]; Fertigkeitspunkte aus Kampferfahrung, beim Tod die Hälfte des Angesparten weg [S5] | Fertigkeitspunkte, Geld | Stärke ist ein Ort und ein Sieg, kein Balken; nicht abfarmbar | Fertigkeitspunkte doch wieder aus Kills | Vitalwert aus vier Teilen, einer davon vom Boss; Techniken statt Zahlen. Punkte **nicht** aus Kills |
| Hollow Knight | Maskensplitter und Gefässfragmente, verstreut und schwer zu finden; genug Stücke ergeben ein Ganzes [HK2] | Geld | Erkunden ist Wachsen | Stücke sind austauschbar, erzählen nichts | Bruchstück-Prinzip — bei uns ist jedes Stück eine Pflanze mit Fundort |
| Zelda BotW | vier Zeichen aus Rätselorten = ein Herz **oder** ein Stück Ausdauer, wählbar [Z1]. Kritik: langsam, begrenzter Ertrag [Z2] | Material, Waffen | Wahl zwischen Leben und Ausdauer | über hundert gleichartige Quellen | Die Wahl Leben/Ausdauer — bei uns hängt sie am Ausgang des Bosskampfs |
| The Witcher 3 | Erfahrung fast nur aus Aufträgen: „mainly … from quests“, Monster geben wenig, damit der Held kein Schlächter um des Gewinns willen wird [W1] | wenig Erfahrung, Zutaten | Geschichten sind der Fortschritt | Stufenzahlen sperren Gebiete | Erfahrung aus Aufträgen. **Keine** Gegnerstufen |
| Witcher-Alchemie | *in dieser Recherche nicht belegt* | Zutaten aus Monstern | Vorbereitung als Spiel | Menüarbeit | Vorbereitung an der Rast, eine Beigabe statt eines Tränkeschranks |
| Bloodborne, Lies of P | Kill-Währung → Stufen wie oben; *Einzelheiten nicht belegt* | alles | — | — | nichts Eigenes |
| Soulframe | Tugenden nach Waffenart, Stufen der Waffen [SF2]; *Lob/Kritik nicht belegt* | *nicht belegt* | — | — | nichts |
| Blood of Dawnwalker | *Fortschritt der Figur nicht belegt* | — | — | — | nichts |

Quellen (neu; die übrigen in §1): [W1] https://gamesradar.com/witcher-3s-world-building-and-quest-design-explained-cd-projekt-red-2 ·
[S5] https://www.gamepressure.com/sekiro-shadows-die-twice/character-development/z8c1a3 ·
[HK2] https://gamespot.com/hollow-knight/user-reviews/2200-12808571/ ·
[ER4] https://www.gamespot.com/articles/elden-ring-golden-seed-and-sacred-tear-locations/1100-6501100/ ·
[ER5] https://pcgamer.com/elden-ring-tears-locations-sacred-crystal-flask-of-wondrous-physick ·
[Z1] https://www.zeldadungeon.net/wiki/Spirit_Orb ·
[Z2] https://www.giantbomb.com/profile/gamer_152/blog/korok-seeds-meaningful-play-in-the-legend-of-zelda/264957/

**Was daraus folgt:** Kein gelobtes Vorbild trennt Töten sauber vom Wachsen — selbst der Titel ohne Stufen zahlt
Fertigkeitspunkte aus Kills. Das ist die Stelle, an der BRACHLAND es anders machen muss, weil seine Hauptfigur heilt.

### 13.2 Der Entwurf in fünf Punkten

**1. Stahl und Marke bleiben** (§3). Sie sind die zwei Achsen der Wahl.

**2. Vitalwerte wachsen durch Dauersude — vier Teile, einer vom Boss.** Die vorgeschlagenen „Bruchstücke“ und das
Brauen sind **ein** System, nicht zwei nebeneinander: Die Bruchstücke *sind* die Zutaten.

| Dauersud | Hebt | Braucht | Bossteil |
|---|---|---|---|
| **Marksud** | Leben +5 | 3 Meisterwurz | Mark **oder** Abwurf |
| **Bittersud** | Ausdauer +5 | 3 Enzianwurzel | **nur** Abwurf |

- **Bruchstücke** (Kategorie `vital`): Meisterwurz und Enzianwurzel. Je 6 im Œntal, alle einmalig, alle an Sprossen
  ab „verborgener Ort“ (§6) — nie an kleinen Entdeckungen, nie als Beute. Ein Kapitel trägt damit höchstens zwei
  Sude je Wert (+10 / +10). Höchstens zehn je Wert im ganzen Spiel (Leben 150, Ausdauer 150).
- **Bossteil**: was ein Verhärteter oder Regent hinterlässt. Getötet **Mark**, gereinigt **Abwurf**.
- **Nie über gewöhnliche Tiere.** Kein Kill und keine Reinigung eines Gewöhnlichen hebt einen Vitalwert.
- Gebraut wird bei der Alten oder an jeder Zuflucht mit Feuerstelle. Jeder Sud ist ein Kampfwert: **+5 gilt erst
  nach Messung** (Kampfbot, alle Gegner, drei Profile).

**3. Erfahrung kommt aus Aufträgen, nicht aus Kämpfen — und sie ist etwas Gelerntes.** Die Einheit heisst
**Einsicht** (Kategorie `erfahrung`): 1 je Nebenaufgabe mit Gewicht und je verborgenem Ort, 2 je Figurenlinie und
je Regent. Im Œntal 5 + 3 Linien × 2 + 2 = höchstens 13. Ausgegeben wird sie an der Rast für **Techniken**
(`content/techniken.json`):

| Technik | Zweig | Kosten | Was sie tut | Berührt |
|---|---|---|---|---|
| Linie lesen | Kampf | 2 | Angriffslinie bekannter Tierarten zeigt sich schon im Vorlauf | Anzeige |
| Nachsetzen | Kampf | 3 | nach einer Parade trifft der nächste leichte Schlag die Haltung härter | **Kampfwert** — Kampfbot, Profil parierend |
| Wechsel im Fluss | Kampf | 2 | zweite Waffe in der Erholung ziehen | **Kampfwert** — Kampfbot je Waffenpaar |
| Wundblick | Reinigen | 1 | man sieht, wann ein Tier wund genug für die Marke ist | Anzeige |
| Ruhige Hand | Reinigen | 3 | Treffer im Griff nimmt weniger Fortschritt (`behaltBeiTreffer`) | **Kampfwert** — `reinigensim` |
| Zweiter Griff | Reinigen | 2 | Fortschritt am Tier verfällt nicht (`verfallJeSekunde`) | **Kampfwert** — `reinigensim`, Profil müde |
| Fährte | Bewegung | 1 | Witterung zeigt Reviergrenze und Zustand (befallen, ruhig, leer) | Anzeige |
| Sammlerblick | Bewegung | 1 | bekannte Kräuter, Pilze, Wurzeln fallen in der Witterung auf | Anzeige |
| Leiser Tritt | Bewegung | 2 | im Gehen bemerken einen Tiere später | Welt (Wahrnehmung, kein Kampfwert) |
| Langer Atem | Bewegung | 2 | Schwimmen und Klettern zehren weniger | **Traversal** — `traversal_wege.py` neu |
| Zweite Beigabe | Bewegung | 3 | die Flasche trägt zwei Beigaben | **Ökonomie** — Sim und Kampfbot |

Elf Techniken, 22 Einsicht. **Fünf berühren keinen geprüften Wert** und sind ohne Messung baubar (Linie lesen,
Wundblick, Fährte, Sammlerblick, Leiser Tritt); sechs brauchen eine Messung, die in den Daten steht (`messung`).
**ADR-0007:** Das Regelwerk der Gattung (Ausdauer, Rolle, Parade, Lock-On, Haltung) ist ab Start vollständig da —
keine Technik schaltet ein Grundverb frei. Das passt; es wäre verletzt, sobald etwa die Parade eine Technik würde.

**4. Brauen und Flasche sind eins.** Die Sudflasche (§5.2) hat drei Regler, alle an der Rast:

| Regler | Womit | Dauer |
|---|---|---|
| Schlucke 3 → 6 | Setzlinge (§5.2) | dauerhaft |
| Stärke 35 → 55 % | Quellwasser (§5.2) | dauerhaft |
| **Beigabe** (ein Platz) | ein Kraut aus dem Beutel | bis zur nächsten Rast |

| Beigabe | Wirkung (5 Minuten nach dem Schluck) | Wofür |
|---|---|---|
| Fichtenspitzen | Ausdauer erholt sich 15 % schneller | lange Wege, Rudel |
| Baldrianwurzel | im Griff 10 Punkte weniger verwundbar, Ausdauer erholt sich 10 % langsamer | Reinigen |
| Schafgarbe | jeder Schluck heilt zehn Sekunden nach (+10 %) | lange Kämpfe |
| Birkenporling | Befallswirkungen halten 30 % kürzer | Regent, Verhärtete |

Beigaben wachsen an Sammelstellen nach und sind Mengenware der kleinen Sprossen. Die Dauersude nutzen denselben
Kessel und dieselbe Alte wie die Reinkultur (§5.3). Ein Tränkeschrank entsteht nicht: Es gibt **eine** Flasche.

**5. Töten ist die Abkürzung — mit Folgen, die vorher ausgesprochen werden.**

| Töten gibt schneller | | Töten kostet dauerhaft | Wer es vorher sagt |
|---|---|---|---|
| Material sofort (Span, Federstahl) | | das Revier wird **nie ruhig**: keine Rast im Freien, kein Setzling, keine Reinprobe | der Förster („der Wald merkt sich das“, Auftragstext) |
| den Härtling — Waffenstufe 3 | | **Verhärtung** (neu, Vorschlag): In ein leergetötetes Revier wandert Befall nach (D399) und bringt in jedem zweiten einen neuen Verhärteten mit | der Zähler an Station 1; das erste nachgewanderte Tier steht sichtbar in der Signalfarbe |
| das Bossteil ohne Reinkultur und ohne drei Ladungen: **Mark** | | Mark trägt nur den Marksud. **Ausdauer wächst nur aus Abwurf** — wer nie reinigt, hebt sie nie | die Alte, wenn man ihr das erste Mark bringt |
| Zeit: Reinigen dauert +20 … +40 % (Reinigen v1) | | jeder Eingriff ist ein Kiesel beim Zähler (Schwelle 40, `content/wanderfiguren/zaehler.json`) — das gilt auch fürs Reinigen | der Zähler; die Reihe liegt sichtbar |
| den Regenten ohne drei Reinkulturen | | das Tal fällt trocken, bleibt aber befallen (Bibel §6); keine ruhigen Reviere | der Mönch am Stau |
| Federstahl von Menschen | | getötete Figuren schliessen ihre Linie (D399): kein Zeug der Fraktion, 2 Einsicht weniger, ein Ende weniger | — die Tat selbst; das Heft hält sie fest |

Die Folge steht nie in einem Menü. Sie wird gesagt, bevor man es das erste Mal tut, und sie ist danach zu sehen.

### 13.3 Rechnung der vier Spielweisen (Œntal)

`npx tsx tools/oekonomiesim.ts`; Annahmen wie §3, dazu: 6 Meisterwurz, 6 Enzianwurzel, 5 Einsicht einmalig; drei
Figurenlinien zu 2 Einsicht; Verhärtung 0,5 je leerem Revier (leer ab 60 % getötet). Abgeschlossene Linien nach der
Vertrauenstabelle aus Reinigen v1 §4: Schlächter 1 (Erbe), Gemischt 2, Heiler 2, Umgeher 1 (Mönche). Der Umgeher
kämpft hier nur noch 12 % der Begegnungen (in §3: 20 %), sonst läge er über der Schwelle des Zählers.

| | Schlächter | Gemischt | Heiler | Umgeher |
|---|---|---|---|---|
| Hauptwaffe / Markenstufe | 3 / 1 | 2 / 3 | 1 / 4 | 0 / 2 |
| Eingriffe (Zähler: höchstens 40) | 291 | 291 | 176 | 34 |
| Mönche trauen | nein | nein | nein | **ja** |
| leere Reviere → neue Verhärtete | 12 → 6 | 12 → 6 | 0 → 0 | 0 → 0 |
| Verhärtete getötet / gereinigt | 11 / 0 | 8 / 3 | 0 / 5 | 0 / 1 |
| Bossteile Mark / Abwurf | 12 / 0 | 8 / 4 | 0 / 6 | 0 / 2 |
| Dauersude Leben / Ausdauer | +10 / **+0** | +10 / +10 | +10 / +10 | +5 / +5 |
| Figurenlinien | 1 von 3 | 2 von 3 | 2 von 3 | 1 von 3 |
| Einsicht (22 für alle Techniken) | 9 | 11 | 11 | 7 |
| ruhige Reviere | 0 | 0 | 12 | 0 |

**Befunde:**

1. **Keine der vier Spielweisen schlägt eine andere auf allen sechs Achsen** (Waffe, Marke, Leben, Ausdauer,
   Einsicht, Mönche) — als Test festgehalten. Der Umgeher ist jetzt nicht mehr „dominiert“: Er hat als Einziger die Mönche.
2. **Vitalwerte hängen an den Bruchstücken, nicht an den Kills.** Der Schlächter hat 12 Mark und braut davon zwei
   Sude — mehr Meisterwurz gibt es nicht. Zehn Mark bleiben liegen. Das ist die Regel „nie über Töten“ als Zahl.
3. **Der Schlächter hebt die Ausdauer nie.** Das ist die härteste ausgesprochene Folge und zugleich die riskanteste
   Zahl: Ob +36 % Schaden und +10 Leben das aufwiegen, ist nicht gemessen.
4. **Gemischt und Heiler sind bei Leben, Ausdauer und Einsicht gleich.** Die neuen Achsen trennen den Schlächter und
   den Umgeher von der Mitte, aber nicht die Mitte vom Heiler; dessen Vorsprung bleibt Marke, ruhige Reviere und
   Flasche (§3). Wer das schärfen will, bindet einen dritten Dauersud je Kapitel an ein ruhiges Revier.
5. **Die Verhärtung trifft Gemischt so hart wie den Schlächter** (63 % getötet = jedes Revier leer). Gemischt kann
   die Nachgewanderten aber reinigen, solange Reinkulturen reichen (hier 1 von 6).
6. **Der Heiler verliert die Mönche deutlich** (176 Eingriffe gegen 40). Das ist D385 („jeder Eingriff zählt“) in
   Zahlen und gewollt — sollte aber einmal gespielt werden, bevor die Schwelle steht.

### 13.4 Wo die vorgeschlagene Richtung nicht trägt

- **Bruchstücke und Brauen getrennt** wären zwei Sammelsysteme für denselben Zweck. Zusammengelegt (Punkt 2).
- **„Ein Vital-Bruchstück vom Boss sofort beim Töten“** trägt nur mit Preis: Das Mark kommt sofort, taugt aber nur
  für Leben. Ohne diese Schranke wäre Töten auch hier der schnellere *und* gleich gute Weg.
- **Erfahrung als Fertigkeitspunkte** trägt, solange kein Grundverb dahinter liegt. Sechs der elf Techniken ändern
  aber geprüfte Werte; bis zur Messung sind nur fünf baubar — das sind die leiseren.
- **Vitalwerte überhaupt:** Leben und Ausdauer sind die Grundlage jeder Messreihe (Kampfsystem v2, Reinigen v1 §3/§6).
  Jede Erhöhung verschiebt alle Tabellen. +5 ist bewusst klein; trotzdem gilt: erst messen.
- **`src/spiel/fortschritt.ts` lässt sich dafür nicht wiederverwenden.** Es rechnet eine Erfahrungskurve
  (Exponent 2,3) gegen Siege und daraus Stufe und Mutation einer Kreatur. Einsicht ist eine kleine ganze Zahl ohne
  Kurve und kommt nie aus Siegen. Brauchbar bleibt nur `wildStufe` (Stärke folgt der Entfernung), das
  `src/world/vorkommen.ts` nutzt; `gutschrift`, `erfahrungAusSieg` und `werteBei` hängen am entfallenen Team
  (`src/main.tsx`, `src/data/inhalte.ts`) und sollten mit ihm gehen.

### 13.5 Physik (D398)

| Zutat | Real | Im Spiel | Abweichung |
|---|---|---|---|
| **Meisterwurz** (*Peucedanum ostruthium*) | Doldenblütler der Hochstaudenfluren, in den Alpen vor allem subalpin; der Wurzelstock galt in der Volksmedizin als Allheilmittel, als Abkochung oder Ansatz | Bruchstück für den Marksud, „von oberhalb der Grenze“ | Standort passt zur Befallsgrenze; **dauerhaft +5 Leben ist Fiktion** |
| **Gelber Enzian** (*Gentiana lutea*) | Kalkmagerrasen und Almen; die Wurzel ist ein klassisches Bittermittel (Magen, Appetit). Der Stock braucht viele Jahre und ist geschützt | Bruchstück für den Bittersud; „an der Stelle wächst so bald nichts nach“ | Knappheit ist real begründet; dauerhaft +5 Ausdauer ist Fiktion |
| **Mark** | Knochenmark ist Fett und nahrhaft; eine Markbrühe kocht Stunden | Bossteil, getötet | Kochzeit passt zur Rast; Wirkung Fiktion |
| **Abwurf** | **erfunden**; nächste reale Entsprechung sind Geweihbast und abgeworfene Stangen (Hirschhorn wurde zu Arznei verkocht) | Bossteil, gereinigt | benannt: Fiktion der Welt |
| **Fichtenspitzen** | junge Triebe, reich an Vitamin C, als Sirup oder Tee; nur im Mai/Juni | Beigabe | **Jahreszeit übergangen** — im Spiel jederzeit |
| **Baldrian** (*Valeriana officinalis*) | feuchte Wiesen, Ufer; die Wurzel beruhigt, wirkt aber erst nach längerer Einnahme deutlich | Beigabe: ruhige Hand, langsamere Ausdauer | Richtung stimmt (ruhiger, träger), Sofortwirkung ist Spielwert |
| **Schafgarbe** (*Achillea millefolium*) | Wiesen, Wegränder; überliefert blutstillend | Beigabe: Nachheilung | Richtung stimmt, Stärke ist Spielwert |
| **Birkenporling** (*Fomitopsis betulina*) | nur an toten Birken; bitter, im Labor keimhemmend; der Mann vom Tisenjoch trug ihn bei sich | Beigabe gegen Befallswirkungen | Wirkung gegen einen erfundenen Befall ist Fiktion |

Zubereitung, wie sie real wäre: Wurzeln als Abkochung (20 Minuten), Kraut als Aufguss (10 Minuten), der Pilz lange
gekocht. Eine Rast trägt das. Drei Meisterwurz ≈ 150 g frisch — genug für einen Topf. Gewichte stehen an den Gegenständen.

### 13.6 Belohnungsleiter und Auftragsvertrag

Kategorien `vital` und `erfahrung` sind in `LOHNKATEGORIEN` und `content/belohnungen.json` ergänzt:

| Sprosse | `vital` | `erfahrung` |
|---|---|---|
| Kleine Entdeckung | — | — |
| Verborgener Ort | 1 Bruchstück | 1 Einsicht |
| Nebenaufgabe | 1 Bruchstück | 1 Einsicht |
| Figurenlinie | 1 Bruchstück | 2 Einsicht |
| Optionaler Boss | — (er gibt das Bossteil) | — |
| Regent | — (er gibt das Bossteil) | 2 Einsicht |

**Zeilen in Quests v1 §8, die umgehängt werden sollten** (nur Liste; die Quest-Dateien sind nicht angefasst —
`Auftrag.lohn` fasst höchstens drei Kategorien):

| Quest | Heute | Vorschlag |
|---|---|---|
| `das-stehende-wasser` (H2) | `verbrauch`, `wissen` | + `erfahrung` |
| `was-im-stau-liegt` (H5) | `marke`, `aufwertung-3` | + `erfahrung` (Regent: 2) |
| `was-danach-waechst` (H7) | `marke`, `zugang`, `aufwertung-3` | `aufwertung-3` → `vital` |
| F1 Ausgang a, F2 Wehrkrone, F3 Handel (Linienenden) | `ruestung` / `marke` / `waffe` | je + `erfahrung` (2) und `vital` |
| `was-im-heft-steht` (F5) | `marke`, `wissen` | + `erfahrung` |
| `bis-zur-kante` (F8) | `verbrauch`, `wissen` | `verbrauch` → `vital` (Felsband 853 m, Enzian) |
| `eine-fuer-den-hof` (N1) | `aufwertung-1`, `zugang` | `aufwertung-1` → `vital` (Almweg, Meisterwurz) |
| `die-runde` (N2) | `aufwertung-2` | + `erfahrung` |
| Glocke (N6) | `wissen` | + `erfahrung` |
| Kirchturm, Hütte, Quelltopf (verborgene Orte) | `aufwertung-3`, `ruestung` u. a. | je + `vital` und `erfahrung` |
| Brett beim Wirt (W2, wiederholbar) | `aufwertung-1` oder `verbrauch` | **bleibt** — nie `vital`, nie `erfahrung` |

Das wären 6 Bruchstücke aus Aufträgen und Orten; die übrigen 6 liegen in der Welt (oberhalb der Grenze, am Almweg).

### 13.7 Umsetzungsliste (Ergänzung zu §10)

| # | Was fehlt | Wo |
|---|---|---|
| 14 | Leben und Ausdauer als veränderliche Werte der Spielfigur (`SPIELERIN.lebenMax`, `AUSDAUER_MAX` sind Konstanten) | `src/kampf/echtzeit.ts`, `src/spieler/ausdauer.ts` |
| 15 | Kampfbot-Messung für +5 / +10 Leben und Ausdauer und für jede Beigabe | `tools/kampfbot.ts` |
| 16 | Einsicht und gelernte Techniken im Spielstand; Technik-Fenster an der Rast | `Spielstand`, `src/ui/` |
| 17 | Die fünf messfreien Techniken: Anzeige der Linie im Vorlauf, Wundanzeige, Reviergrenzen, Sammelstellen, Wahrnehmungsabstand | `src/kampf/`, `src/world/` |
| 18 | Sammelstellen für Beigaben (nachwachsend) und Fundorte der zwölf Bruchstücke als Daten mit Koordinaten | `content/` |
| 19 | Bossteil je Ausgang; Brauen bei der Alten | Kampfplatz, `Ort.dienst` |
| 20 | Verhärtung: leere Reviere, Nachwandern, neuer Verhärteter — hängt an den Revieren (§10 Punkt 4) **D416:** als Regel an der Rast ausgewertet und im Stand gehalten (`werteRastAus`); in der Welt steht kein Verhärteter (§14.6) | ~~Schema `Region`, Spielstand~~ §14 |
| 21 | `fortschritt.ts` aufräumen, sobald das Team aus `main.tsx` und `inhalte.ts` entfernt ist | `src/spiel/` |

### 13.8 Unklar

- ⚠️ Kein Wert dieses Abschnitts ist gemessen: +5 je Sud, jede Beigabe, sechs Techniken.
- ⚠️ Zahl der Bruchstücke (6 + 6) und der Einsicht (höchstens 13) im Œntal sind gesetzt, nicht aus der Ortsliste gezählt.
- ⚠️ Die Verhärtung ist eine neue Mechanik ohne Vorlage in der Bibel; sie ist mein Vorschlag, nicht Flos Entscheidung.
- ⚠️ Ob der Schlächter ohne Ausdauerzuwachs im dritten Kapitel noch besteht, lässt sich erst sagen, wenn die
  Gegner späterer Regionen stehen.
- ⚠️ Standorte und Wirkungen der Pflanzen in 13.5 sind Allgemeinwissen, nicht recherchiert; Witcher-Alchemie,
  Bloodborne, Lies of P, Soulframe und Dawnwalker sind für diese Frage nicht belegt.

## 14. Reviere (D416)

> Auftrag (D416): Reviere als Daten und Logik — an ihnen hängen ruhige Reviere und das Aufladen der Marke an der Rast
> (D379, D393, A-28 (3)), die Stufe „vertraut“ des Zählers (D406), die Verhärtung (D400/D402) und das Nachwachsen
> (D393/D399). Seit ADR-0020 (D418) ist die Welt zusammenhängend: nichts hier nimmt „eine Region = ganze Welt“ an.

### 14.1 Die Reviere des Œntals

Erzeugt von `npx tsx tools/reviere.ts oental --schreiben`: **Kerne von Hand** (je einer, mit Begründung in den Daten),
**Grenzen gerechnet** — jede Zelle des 64×64-Rasters (≈ 62 m) gehört zum Kern, den man von ihr mit dem geringsten Weg
erreicht. Weg nach Naismith (1 Std. je 5 km + 1 Std. je 600 m Anstieg, also 1 Höhenmeter ≈ 8,3 m Strecke), Wasser unter
der Flutlinie (499 m) ×4, Ein- und Ausstieg an der Flutlinie wie eine Wand. Grate und die Flutlinie werden so zu Grenzen.
Dreizehn statt zwölf, weil die Flut (2,8 + 1,0 km²) als ein Revier ein Viertel der Region wäre.

| | Revier | Fläche km² | Höhe m | Zuflucht | verborgen | Tiere (Bestand) | häufigste |
|---|---|---|---|---|---|---|---|
| A | Terrasse von Brannburg | 0,52 | 499–557 | Saal auf der Terrasse | — | 21 | Spürfuchs 8, Myzelmolch 5 |
| B | Waldrand am Nordufer | 0,57 | 500–685 | Feldscheune, Schuppen am Nordufer | — | 36 | Wurzelkeiler 21, Sporenhahn 10 |
| C | Nordhang unter der Kirche | 0,75 | 499–789 | Kirche am Nordhang | — | 62 | Sporenhahn 35, Myzelmolch 16 |
| D | Alm unter dem Grat | 1,05 | 758–1.113 | Almhütte | — | 84 | Sporenhahn 36, Myzelmolch 13, Grathorn 11 |
| E | Bannwald | 1,17 | 638–912 | — | Hütte im Bannwald | 83 | Sporenhahn 51, Myzelmolch 19 |
| F | Steig und Talweg | 0,59 | 542–661 | Remise am Steig | — | 26 | Wurzelkeiler 14, Sporenhahn 6 |
| G | Grat am Oberstollen | 1,06 | 787–1.022 | — | — | 68 | Sporenhahn 33, Myzelmolch 13 |
| H | Grabenweg und Bruch | 1,30 | 592–883 | Heustadel, Unterstand am Talweg | — | 93 | Sporenhahn 52, Myzelmolch 23 |
| I | Quellhang | 2,11 | 846–1.139 | — | Quelltopf | 178 | Sporenhahn 52, Nebelgams 36, Grathorn 23 |
| J | Südhang mit Saatkammer | 1,68 | 517–837 | — | — | 118 | Sporenhahn 41, Wurzelkeiler 40 |
| K | Uferweg zum Wehr | 1,27 | 499–831 | Stadel am Hangweg | — | 75 | Wurzelkeiler 39, Sporenhahn 24 |
| L | Seeboden vor der Terrasse | 2,80 (100 % Flut) | 465–499 | — | Kirchturm | 118 | Wurzelkeiler 75, Spürfuchs 25 |
| M | Stau am Kalkbruch | 1,03 (89 % Flut) | 482–529 | Kapelle über dem Kalkbruch (Insel) | — | 57 | Wurzelkeiler 39, Spürfuchs 7 |

Zusammen 1.019 Tiere — der ganze Bestand aus `verteileKreaturen` (Seed 7), gezählt nach der Zelle der Vorkommen-ID, also
so, wie der Spielstand sie später liest. **Befund:** Die Flutreviere tragen 175 Tiere, weil die Flut nur ein Datum ist
(ADR-0017) — das Vorkommen kennt sie nicht. Sobald Wasser gebaut wird, ist der Bestand dort neu zu zählen. Fünf Reviere
haben keine Zuflucht (E, G, I, J, L): Dort lädt die Marke nur, wenn das Revier ruhig ist. Eine Unschönheit der Rechnung:
Die Terrasse greift mit einem ein bis zwei Zellen breiten Uferstreifen nach Norden (der flache Uferweg ist von ihr aus
billiger als vom Hang); belassen, weil es dem Weg folgt.

### 14.2 Logik (`src/spiel/reviere.ts`, renderfrei)

- **Lage:** `baueRevierwelt(karten, regionen)` → `revierAn(region, x, z)`, `revierAnGeo(lat, lon)` (sucht erst die
  Region, ADR-0020), `vorkommenLage(region, 'kreatur:i:j')`. Nachbarn dürfen Reviere anderer Regionen sein; `validate`
  verlangt dann nur, dass es sie gibt und die Nachbarschaft symmetrisch ist.
- **Zustand je Revier** (`revierZustaende`): getötet, gereinigt, umgangen, begegnet — aus `begegnungen` (seit v3, Revier
  aus der Lage) und aus `besiegt`/`gefangen` über die Zelle der Vorkommen-ID. `gefangen` zählt als gereinigt, bis der
  Kampf eigene Meldungen schreibt (D375). Eine ID zählt nie doppelt, der Regent nie, Umgehen berührt nicht.
- **Ruhig:** ≥ 60 % der Eingriffe gereinigt **und** ≥ 25 % der „Tiere des Reviers“ gereinigt (A-28 (3)). **Leergetötet:**
  ≥ 60 % der Tiere des Reviers getötet. **Unberührt:** kein Eingriff. Die „Tiere des Reviers“ sind die Begegneten
  (`reviere.bezug: begegnet`, so rechnete D393), **mindestens aber ein Viertel des Bestands** (`mindestBestand: 0,25`) —
  ohne diesen Boden machte im Spiel ein einziger Griff ein Revier ruhig und ein einziger Tod es leer (genau das hat D393
  verworfen). Im Graben (93 Tiere) heisst das: 6 Reinigungen für ruhig, 14 Getötete für leer.
- **Marke an der Rast** (`ladungNachRast`): Zuflucht voll; im Freien nur im ruhigen Revier, dann + ½ Fassung
  (abgerundet, nie über die Fassung); im leeren oder befallenen Revier nichts (§7).
- **Zähler** (`zaehlerStufe`, Bedingung `misstraut`): *geduldet* = gewichteter Stand ≤ 40; *vertraut* = geduldet **und**
  ≥ 50 % der Reviere unberührt (D406). Werte an der Station in `content/wanderfiguren/zaehler.json`.
- **Rast** (`werteRastAus`) gibt den neuen `Revierstand` und eine Liste von Änderungen zurück, statt sie in der Szene zu
  verteilen: (1) Reviere, die die Rast als leer sieht, kommen in `leerFolge`; (2) das n-te leergetötete zieht
  ⌊n·0,5⌋ − ⌊(n−1)·0,5⌋ Verhärtete nach — jedes zweite einen; (3) in ein Revier, in dem getötet wurde, wandern nach
  `abRasten` = 3 Rasten je Rast 2 Tiere aus einem befallenen Nachbarn (weder ruhig noch leer) zu, bis zur Hälfte der
  Getöteten und nie über die Hälfte des Bestands; nie in ein ruhiges Revier (die Gunst bleibt), nie aus ihm selbst.
  (2) und (3) nur, solange die Region nicht geheilt ist. Ein leergetötetes Revier, in das die Hälfte nachgewachsen ist,
  ist wieder befallen und damit selbst Quelle — Farmen gibt je Welle höchstens die Hälfte zurück.

### 14.3 Schnittstelle zum Kampf (D417) und Spielstand v3

Der Kampf meldet je Tier `{ art: 'getoetet' | 'gereinigt' | 'umgangen', gegnerId, region, x, z, zeit }`.
`vermerkeBegegnung(stand, ereignis)` hängt sie an `stand.begegnungen` (Lage auf 10 cm gerundet; dieselbe Meldung zweimal
zählt einmal; Ungültiges ändert nichts). In `main.tsx` liegt dafür der Haken `meldeBegegnungRef.current(ereignis)`; ihn
ruft noch niemand. Gespeichert wird die Lage, nicht das Revier: Ändern sich die Grenzen in den Daten, folgt der Zustand.
Der Zähler (`eingriffe`) zählt gemeldete Begegnungen je Meldung mit — ein Lager ist nach seiner Ruhe wieder besetzt,
dieselbe Gegner-ID heisst dann ein anderes Tier.

**Spielstand v3** (`MIGRATIONEN[2]`): `begegnungen: []` und `reviere: { rasten: 0, leerFolge: [], je: {} }`; ein v2-Stand
behält jedes Feld und auch `geschrieben`; was vorher geschah, steht schon in `besiegt`/`gefangen` und wird abgeleitet,
nicht kopiert (`tests/speicherformat.test.ts`, `tests/staende/v2-oental-mit-wild.json`). `KOMMT_MIT_V3` heisst jetzt
`KOMMT_SPAETER` und nennt die Eingriffe nicht mehr.

### 14.4 Rechnung mit den echten Revieren

`npx tsx tools/oekonomiesim.ts` (`bilanzMitRevieren`). **Annahmen:** wie §3 (280 begegnete Tiere, 20 Rasten), jetzt nach
dem Bestand auf die 13 Reviere verteilt (27 % je Revier); Reviere in der Reihenfolge ihres Abstands vom Start (Steig →
Graben → Terrasse → Uferweg → Bannwald → Grat → Nordufer → Südhang → Stau → Seeboden → Nordhang → Quellhang → Alm);
Verhärtete je verborgenem Ort einer, zwei an den Engstellen des Uferwegs; wer reinigt, holt stehen gebliebene Verhärtete
später nach; **der Umgeher meidet die äussere Hälfte der Reviere ganz** (neu, `meidet: 0,5` — sonst wäre er nie
„vertraut“) und kämpft in den übrigen so viel dichter, dass sein Anteil an allen Begegnungen gleich bleibt (12 %).

| | Schlächter | Gemischt | Heiler | Umgeher |
|---|---|---|---|---|
| Tiere getötet / gereinigt / umgangen | 280 / 0 / 0 | 178 / 102 / 0 | 0 / 173 / 107 | 0 / 31 / 249 |
| Verhärtete getötet / gereinigt | 11 / 0 | 8 / 3 | 0 / 5 | 0 / 3 |
| Hauptwaffe / Markenstufe | 3 / 1 | 2 / 3 | 1 / 4 | 0 / 2 |
| Läuterung | 25 | 157 | 238 | 76 |
| ruhige / leere / unberührte Reviere (von 13) | 0 / 13 / 0 | 0 / 13 / 0 | 13 / 0 / 0 | 6 / 0 / 7 |
| nachgewanderte Verhärtete | 6 | 6 | 0 | 0 |
| bis Kapitelende nachgewachsen | 87 | 62 | 0 | 0 |
| Stand beim Zähler (gewichtet) → Stufe | 291 → abgewandt | 212 → abgewandt | 45 → abgewandt | 9 → **vertraut** |
| Leben / Ausdauer / Einsicht | +10 / +0 / 9 | +10 / +10 / 11 | +10 / +10 / 11 | +5 / +5 / 7 |

**Dominanztest** (Waffe, Marke, Leben, Ausdauer, Einsicht, Zähler-Stufe 0/1/2): **grün** — keine Spielweise schlägt eine
andere auf allen Achsen, mit beiden Bezügen (`tests/reviere.test.ts`).

**Was sich gegenüber §3/§13.3 verschiebt (ehrlich):**

1. **Der Heiler liegt jetzt klar über dem Zähler** (45 statt 41): Er holt alle fünf Verhärteten nach und bekommt in 13
   statt 12 Revieren die ruhige Rast. Bei D406 („geduldet“ ≤ 40) ist er damit abgewandt — wie D385 es meint, aber nicht
   mehr „knapp“. Wer als Heiler geduldet bleiben will, muss rund 20 Reinigungen weniger machen.
2. **Der Umgeher hat jetzt ruhige Reviere** (6 von 13, Markenstufe 2 wie vorher): Weil er seine wenigen Eingriffe auf
   die innere Hälfte ballt, reinigt er dort ein Drittel der Begegneten. Er ist der einzige, der „vertraut“ wird — sein
   Eigenes, das ihm D405 genommen hatte, ist über die zweite Stufe zurück.
3. **Schlächter und Gemischt leeren alle 13 Reviere** (vorher 12 von 12) und ziehen sechs Verhärtete nach — gleich.
   Bis Kapitelende wüchsen beim Schlächter 87 Tiere nach (die Hälfte seiner Getöteten aus der ersten Hälfte des Wegs).
4. **Mit Bezug „Bestand“** (die wörtliche Lesart „25 % der Tiere des Reviers“, alle 1.019 gezählt) wird in Kapitel 1
   **kein** Revier ruhig und **keines** leer: 280 Begegnete sind 27 % des Bestands, die Schwellen liegen bei 25 %
   gereinigt bzw. 60 % getötet. Der Heiler fällt auf Markenstufe 3, bleibt aber geduldet; der Test bleibt grün, doch die
   Verhärtung und die ruhige Rast — die eigenen Schleifen beider Ränder — gibt es dann nicht. Deshalb steht in den Daten
   „begegnet“ mit Boden (Frage an Flo: A-38).

### 14.5 Was verdrahtet ist

| Was | Wo | Sichtbar? |
|---|---|---|
| Reviere geladen und geprüft | `data/inhalte.ts` `REVIERWELT`, `REVIERREGELN`; `validate` | nein |
| Rast wertet die Reviere aus und hält `reviere` im Stand | `main.tsx` `raste` | nein |
| Zähler nutzt „vertraut“ | `zaehler.json` Station 4 `bis: misstraut`; `main.tsx` `figurOrte`, `oeffneOrt` | **im Ablauf ja:** Wer nach der Heilung ≤ 40 gewichtete Eingriffe hat, aber in mehr als der Hälfte der Reviere eingegriffen hat, findet den Zähler an der Kirche statt auf der Krone |
| Haken für den Kampf | `main.tsx` `meldeBegegnungRef` | nein (ruft niemand) |

Kein Bildpaar: Am Bild der Welt ändert sich nichts.

### 14.6 Umsetzungsliste (Ergänzung zu §10 und §13.7)

| # | Was fehlt | Wo |
|---|---|---|
| 22 | Die Marke steht nicht im Stand (`markenLadung`, `KOMMT_SPAETER`): `ladungNachRast` hat noch keinen Leser; eine Rast im Freien gibt es nicht (nur an Zufluchten) | `Spielstand`, `main.tsx` `raste`, Kampfplatz |
| 23 | Nachwachsen und Verhärtung in der Welt: `verteileKreaturen` kennt nur „verbraucht“ (`besiegt` ∪ `gefangen`), keine Zuwanderer und keinen nachgezogenen Verhärteten; Verhärtete gibt es im Echtzeitkampf nicht | `src/world/vorkommen.ts`, `RegionsSzene.tsx` `Kreaturen` |
| 24 | Der Kampf meldet keine Begegnung je Tier (`meldeBegegnungRef`): heute zählen nur `besiegt`/`gefangen` des Rundenkampfs | D417 |
| 25 | Die einmalige Gabe des ruhigen Reviers (Setzling, Reinprobe) wird nicht vergeben | `main.tsx` `raste`, `oekonomie.json` `ruhigesRevier` |
| 26 | Feste Vorkommen (`trafomarder:fest`) und Rückkehrer (`:heil:`) zählen keinem Revier, solange niemand `vorkommenLage` übergibt | `main.tsx` |
| 27 | Technik „Fährte“ (Reviergrenze und Zustand in der Witterung) — die Daten wären jetzt da | `src/ui/`, `src/world/` |
| 28 | Bestand der Flutreviere neu zählen, sobald die Flut gebaut ist | `tools/reviere.ts` |

### 14.7 Unklar

- ⚠️ Ob „Tiere des Reviers“ die Begegneten (mit Boden) oder der Bestand sind, ist eine Lesart von A-28 (3), keine
  Entscheidung (A-38). Die Rechnung kippt daran (§14.4 Punkt 4).
- ⚠️ Die Kosten im Weg (Naismith ×8,3, Wasser ×4, Ufer als Wand) sind gesetzt; die Grenzen sind am M1 nicht abgegangen.
- ⚠️ `besiegt`/`gefangen` tragen keine Region. Ein Stand, der im Fahlmoos Vorkommen besiegt hat, zählt sie dem Œntal zu,
  solange `begegnungen` sie nicht ersetzen. Mit ADR-0020 brauchen Vorkommen-IDs eine Regionsvorsilbe.
- ⚠️ Die Reihenfolge der Reviere in der Rechnung (nach Abstand vom Start) und „Umgeher meidet die äussere Hälfte“ sind
  Annahmen; die Spielweisen sind Rechnung, nicht gespielt.
- ⚠️ `abRasten` 3, `jeRast` 2: „nach einigen Rasten“ (A-28 (5)) als Zahl gesetzt, nicht gemessen.
