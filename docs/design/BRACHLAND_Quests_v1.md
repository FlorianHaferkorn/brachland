---
last-reviewed: 2026-11-22
shelf-life-days: 90
---
# BRACHLAND — Quests und Figurenlinien Œntal v1

> **D392, Entwurf mit Daten.** Auftrag Flo, 22.11.2026: „mach weiter mit der Story, Quests, Items und Belohnung,
> Upgrade Materialien etc. orientiere dich auch hier einfach daran wie es andere Spiele in dem Genre machen die in den
> Disziplinen dafür gelobt wurden und versuche es noch besser zu machen und passend zu unserer Welt.“ Hier: Story und
> Quests der ersten Region. Gegenstände, Belohnungen und Aufwertungsmaterial macht D393; die Schnittstelle ist §8.
> Baut auf `BRACHLAND_Story-Bibel_v2.md` (D374, D380, D381, D385), `BRACHLAND_Enklave_Lage_v2.md` (D375),
> `BRACHLAND_Traversal_v2.md` (D388, D391), `BRACHLAND_Weg-nach-Brannburg_v1.md` (D390), `BRACHLAND_Reinigen_v1.md`
> (D376, D379). Offen/erledigt steht im Ledger (A-27), nicht hier.

Koordinaten in Metern wie in der Lage v2: Regionsmitte 0/0 = Spielstart, x nach Osten, z nach Süden.

**Worauf dieser Entwurf steht:** Start an der Regionsmitte, ein Grathorn am ersten Haus, Wolf an der Furt, kein
Mensch auf der Lehrstrecke, Kämpfe umgehbar, Ankunft bei der Magd — begonnen als Annahme nach den Empfehlungen in
A-26, **seit 22.11.2026 von Flo entschieden (D396)**; ebenso die Reinigungsdauern (D395). Und: **Physik muss stimmen
(D398)** — §2.7 prüft die Abläufe dagegen und nennt jede Abweichung.

**Was davon im Spiel wirkt:** vier Aufträge, sieben Fundstücke, die fünfte Station des Zählers und der Zähler der
Eingriffe als Stationsbedingung. Alles andere in diesem Dokument ist Entwurf (§9).

## 1. Recherche: zwölf Handwerksregeln

Übernommen wird Handwerk, kein Motiv (ADR-0004): keine Figur, kein Ort, keine Szene, kein Name aus den genannten
Spielen. „Nicht belegt“ heißt: In dieser Recherche (WebSearch, 22.11.2026) fand sich keine Quelle, die das trägt; es
steht dann nicht als Regel da.

| # | Regel | Beleg | So setzen wir es um | So machen wir es besser |
|---|---|---|---|---|
| 1 | **Figuren haben einen eigenen Weg, und Hilfe ist keine Transaktion.** Gelobt an Elden Ring: Wer einer Figur hilft, ohne dass ein Lohn angekündigt ist, baut eine Beziehung auf | Nathan Savant, „Narrative Design in Elden Ring“, Game Developer, 31.03.2022 [Q1] | Wanderfiguren mit 3–5 Stationen (D375); neun Linien in §5; der Lohn einer Linie wird nie vorher genannt | Jede Station nennt den **nächsten Ort in Worten** („am Gleis, das ins Wasser führt“) — die Figur verschwindet nie spurlos an einen Ort, den nichts andeutet |
| 2 | **Ohne Aufzeichnung verliert der Spieler den Faden.** Kritik an Elden Ring: „Without any record, I won't know what to do next“; FromSoftware hat mit Patch 1.03 Name und Symbol getroffener Figuren auf der Karte nachgereicht, was Kritiker ein Pflaster nannten | Savant [Q1]; PC Gamer zu Patch 1.03 und „just a Band-Aid“ [Q2] (Artikeltext nicht abrufbar, nur Titel und Zusammenfassung); VGC [Q3] | **Das Heft** (§2): hält wörtlich fest, was gesagt, gelesen, gesehen wurde, mit dem Ort in Worten. Logik gebaut (`src/spiel/notizbuch.ts`), Anzeige nicht | Ein Marker sagt *wo*, nicht *was*. Das Heft sagt, was die Figur wollte — und nie, was der Spieler tun soll. Es ist Gedächtnis, kein Auftragslog (Story-Struktur v1 bleibt gültig) |
| 3 | **Verpassbar ist gut, undurchsichtig nicht.** Kritik: Fortschritt hing an Auslösern, auf die nichts hinweist („never alluded to in any way“); Vorschlag dort: die Figur an mehreren Orten antreffbar machen | Savant [Q1] | Eine Figur zieht nur an **drei Weltwenden** weiter (Stauwehr gelesen, Flussvater besiegt, Region geheilt) oder durch eine Tat des Spielers — nie durch Rasten, Uhr oder Zufall (§2.4) | Wer zu spät kommt, findet an der leeren Station eine **Spur** (Zahl an der Wand, Kieselreihe, Stiefelabdruck): Man weiß, dass man etwas verpasst hat und wohin es ging |
| 4 | **Die Umgebung erzählt, indem sie Bekanntes in neuen Zusammenhang stellt.** Gelobt: Derselbe Baustein bedeutet in anderer Lage etwas anderes | Savant [Q1] | Verfallsregel ADR-0017 (Zeit, Bewohnung, Flut); Wasserlinie an jeder Wand unter 499 m; gereinigte Reviere ruhig, getötete leer (Bibel §2) | Die Welt ändert sich **durch den Spieler** sichtbar: ein Weltzustand je Region (Flut fällt), dazu Reviere und Wohnorte (§2.5) |
| 5 | **Fundtexte tragen Geschichte — aber viele lesen sie nicht.** Derselbe Autor, der die Technik lobt, schreibt, dass er Gegenstandstexte gar nicht liest. Entwickler-Primärquelle zur Absicht hinter Gegenstandstexten (Dark Souls, Bloodborne): **nicht belegt** | Savant [Q1] | Fundstücke höchstens 400 Zeichen, im Stehen lesbar (Schema `Fragment`) | Jedes zweite neue Fundstück trägt etwas **Brauchbares** (eine Zahl, eine Richtung, einen Namen), nicht nur Stimmung — wer liest, kommt weiter (`boot-kieloben`, `huettenbuch`, `pegellatte`) |
| 6 | **Wissen ist der Schlüssel, nicht der Gegenstand.** Outer Wilds: „The goal was to make a game where the only possible reason you could have to explore was for the sake of curiosity“; Wissen als das Einzige von Wert | Alex Beachum in Game Developer, „Live, die, repeat“ [Q4]; GamesRadar „The making of Outer Wilds“ [Q5] (nur Zusammenfassung abrufbar) | Rätsel am Schuppen: Die Zahl steht am Absetzbecken, das Schloss am Nordufer (Traversal v2 §5); verborgene Orte nur über Gelände, Licht, Fundstück | Wissen **und** Werkzeug: Zu jedem Ziel gibt es beide Wege (D374). Wer die Zahl nicht findet, kommt trotzdem an — später, über den beschwerlichen Weg |
| 7 | **Information erst, wenn der Spieler sie haben will.** „Are [players] ready to learn? Will they care about this information?“ Wie und warum das Logbuch dort entstand: **nicht belegt** | Beachum [Q4] | Reihenfolge je Linie: erst der Ort oder das Tier, dann der Satz, der es erklärt (Steg mit K7-Schild vor dem Auftrag „Die Runde“) | Das Heft ordnet nach **Ort und Person**, nicht nach Zeit — wer zurückkommt, findet beisammen, was zusammengehört |
| 8 | **Folgen müssen sichtbar sein.** „Design for the visibility of consequences“ — eine Folge, die der Spieler nicht bemerkt, hat es nicht gegeben | Paweł Sasko (CD Projekt Red), GDC 2023, berichtet in Game Developer [Q6] | Der Zähler der Mönche liegt als **Kieselreihe** in der Welt; Reviere, Flut, Wohnorte (§2.5) | Die Folge steht dort, wo die Tat war — nicht in einem Menü und nicht als Zahl |
| 9 | **Späte Folgen wirken am stärksten, wenn der Einsatz vorher klar war.** | Sasko [Q6] | Der Zähler sagt an Station 1, dass er zählt; die Rechnung kommt nach dem Regenten. Das Saatgut der Magd wird in Schritt 3 gebraucht und in Schritt 6 vermisst | Kein „hätte ich das gewusst“: Jede späte Folge ist an einer früheren Station **ausgesprochen** worden und steht im Heft |
| 10 | **Echte Zwickmühlen statt richtiger Antworten; Wahl durch Handeln.** Dilemmata, bei denen beide Seiten etwas für sich haben; dazu: Exposition in die Welt verlegen, Wiederholungen streichen | Sasko [Q6] | Kein Dialogbaum (Bibel §5): bringen, reinigen, töten, verschonen, verschweigen, vorbeigehen. Reinigen gegen Töten hat in F2, F4, F8, F9 und N1–N3 je eine eigene Folge | Die dritte Antwort ist immer möglich: **nicht eingreifen**. Die Mönche belohnen sie (D385) |
| 11 | **Man muss nicht erfahren, ob man recht hatte.** Pentiment: keine kanonische Auflösung, „we won't be telling the player they got it wrong“; man lebt mit der Entscheidung | Josh Sawyer, berichtet in PC Gamer [Q7] | Ob der Flussvater „nur reinigt“, bestätigt niemand. Jede Fraktion deutet dasselbe Wasser anders | Die drei Deutungen sind **spielbar verschieden** (töten, reinigen, mit den Reinkulturen zu Ende schreiben) statt nur erzählt |
| 12 | **Offene Reihenfolge, überspringbar, sogar nie entdeckt — und Nichthandeln zählt.** The Blood of Dawnwalker nennt das „narrative sandbox“; Kritiken (September 2026) loben Quests und Folgen, die Zeit als Ressource blieb umstritten, der Direktor stellt sie für einen Nachfolger in Frage | GamesRadar und PC Gamer zu Dawnwalker [Q8], Kritikenübersicht [Q9] (Schlagzeilen und Zusammenfassungen; Artikeltexte nicht abrufbar) | Drei Reinkulturen in beliebiger Reihenfolge, Regent ohne sie besiegbar (D380); jede Linie überspringbar | **Keine Uhr.** Nichthandeln hat Folgen nur an den drei Weltwenden — der Spieler bestimmt selbst, wann die Welt weiterrückt |

**Ohne Regel geblieben, weil nicht belegt:** Hollow Knight (Team Cherry nennt laut PC Gamer [Q10] „Entdecken gegen
brauchbare Karte“ die größte Entwurfsaufgabe — das deckt unsere Karte, die nur Besuchtes zeigt; zu den Figurenlinien
fand sich keine Entwickleraussage). Soulframe (Game Informer, 02.04.2026 [Q11]: Hauptquests drehen sich um das Retten
befallener Tiere, Steve Sinclair: „We're not going to celebrate the destruction of human bodies“ — Thema belegt,
Questhandwerk nicht). Disco Elysium (keine verwertbare Quelle gefunden). Warum Elden Ring kein Auftragslog hat:
keine Aussage von Miyazaki gefunden.

**Abgrenzung zu Soulframe**, weil das Thema nahe liegt: Dort ist Retten das Gute. Bei uns ist Reinigen zweideutig —
es nimmt dem Land seine Therapie, und eine Fraktion zählt es wie Töten (D385). Das ist der eigene Kern und bleibt.

Quellen: [Q1] gamedeveloper.com/game-platforms/narrative-design-in-elden-ring · [Q2]
pcgamer.com/elden-rings-npc-quest-markers-are-just-a-band-aid, pcgamer.com/au/elden-ring-v1-03-patch-notes · [Q3]
videogameschronicle.com/news/elden-rings-new-patch-lets-players-record-npcs-on-the-map · [Q4]
gamedeveloper.com/design/live-die-repeat-how-i-outer-wilds-i-piques-curiosity-in-an-ambivalent-solar-system · [Q5]
gamesradar.com/the-making-of-outer-wilds · [Q6]
gamedeveloper.com/marketing/10-key-takeaways-from-the-quest-design-of-cyberpunk-2077-and-the-witcher-3 · [Q7]
pcgamer.com/in-obsidans-murder-mystery-pentiment-dont-expect-to-know-if-you-idd-the-right-killer · [Q8]
gamesradar.com/games/rpg/the-blood-of-dawnwalker-lead-say-the-medieval-vampire-rpg-is-a-narrative-sandbox-with-quests-that-can-be-completed-in-any-order-skipped-entirely-or-even-never-discovered-at-all,
pcgamer.com/games/rpg/the-blood-of-dawnwakers-design-director-explains-the-arpgs-time-as-resource-mechanic-and-how-both-action-and-inaction-have-consequences
· [Q9] opencritic.com/game/20499/-/reviews · [Q10] pcgamer.com/how-to-design-a-great-metroidvania-map · [Q11]
gameinformer.com/exclusive/2026/04/02/soulframe-is-a-response-to-the-cynicism-of-the-world-according-to-digital

## 2. Questgrammatik

### 2.1 Vier Arten, wie ein Auftrag entsteht

| Entsteht aus | Wie | Beispiel im Œntal | Im Schema |
|---|---|---|---|
| **Figur** | Sie sagt in ihren Worten, was ihr fehlt. Höchstens vier Sätze, Sie-Form, kein Lohn genannt | Wirt: „Lesen Sie die Latte selbst“ | `Auftrag` (Geber = Bewohner) |
| **Fundstück** | Ein Text nennt etwas, das woanders ist | `huettenbuch` → Quelltopf; `absetzbecken` → Spind | `Fragment`; die Verbindung zieht der Spieler |
| **Ort** | Etwas stimmt sichtbar nicht: verkeilte Tür, Kieselreihe, ein Dach im Wasser | Hütte im Bannwald, Kirchturm | `verborgeneOrte` (nur Datum) |
| **Beobachtung** | Tiere oder Menschen tun etwas Wiederkehrendes | vier Fuchsfährten zum Stadel; Abdrücke am Steg „hin und zurück“ | fehlt (§9.6) |

Regel: **Kein Auftrag ohne zweite Quelle.** Was eine Figur aufträgt, lässt sich auch ohne sie finden (Ort oder
Fundstück) — und umgekehrt führt jedes Fundstück einer Linie zu einem Menschen, der dazu etwas zu sagen hat. Wer nie
mit dem Wirt redet, findet die Pegellatte trotzdem; wer sie gelesen hat, bekommt vom Wirt einen anderen Satz.

### 2.2 Finden ohne Marker

1. **Worte statt Marken.** Jeder Auftragstext nennt Richtung und einen Anblick („am Hangweg ein Stadel, auf halbem Weg
   zum Wehr“). `validate` soll künftig prüfen, dass der Text eine Ortsangabe trägt (§9.7).
2. **Blickachse.** Vom Geber aus ist das Ziel oder der erste Wegpunkt zu sehen, wo es das Gelände hergibt (Bursche →
   Wasser; Feldscheune → Terrasse). Rasterprüfung wie in D390.
3. **Witterung** bleibt die einzige Anzeige (Story-Struktur v1) und zeigt Tiere, nie Ziele.
4. **Die Karte** zeichnet nur, was besucht ist (Bestand).

### 2.3 Das Heft

Der Brachgänger trägt ein Heft. Es ist ein Gegenstand der Welt — der Zähler hat eins, die Pegelwartin schreibt an die
Wand, die Alte zählt am Zaun: In Brannburg schreibt man mit, weil man der Erinnerung nicht traut.

| Es hält fest | Wortlaut | Beispiel |
|---|---|---|
| **Gesagt** | der Satz der Figur, mit Name und Ort in Worten | *Die Pegelwartin, Pegel unter der Terrasse:* „… Machen Sie, dass ich aufhören kann.“ |
| **Gelesen** | der Fundtext, mit Titel | *Auf dem Grund:* „… FREIGABE ERFOLGT SELBSTTÄTIG AB 09/41 …“ |
| **Gesehen** | der Satz einer Zuflucht oder einer Beobachtung | *Schuppen am Nordufer:* „… ein Boot kieloben, das Pech noch frisch.“ |

- Es zeigt **kein Ziel, keinen Fortschritt, keinen Haken** — nur bei einem Auftrag den Vermerk „erledigt“, wenn der
  Lohn abgeholt ist (die Sache zwischen zwei Menschen ist dann aus).
- Es ordnet nach **Person und Ort**. Unter einer Person steht alles, was sie je gesagt hat, an jeder Station.
- Es wird **abgeleitet**, nicht mitgeschrieben (`src/spiel/notizbuch.ts`, wie `spiel/auftraege.ts`). Neu im Spielstand
  ist nur der Stationsvermerk `wanderfigur-<id>:<n>` in `orte`.
- Was es bewusst nicht kann: suchen, filtern, auf der Karte zeigen. Wer wissen will, wo der Stadel ist, liest den Satz.

Damit ist die Elden-Ring-Kritik (Regel 2) beantwortet, ohne die Bauweise aufzugeben: Der Spieler vergisst nichts, und
trotzdem sagt ihm niemand, wohin.

### 2.4 Verpassbarkeit und ihre Grenzen

1. **Die Hauptlinie ist nicht verpassbar.** Regent, Reinkulturen und Wandel hängen an Orten, nicht an Figuren.
2. **Eine Figurenlinie geht nur verloren durch (a) eine Tat des Spielers oder (b) eine der drei Weltwenden.** Keine
   Uhr, kein Rasten, kein Zufall. Die Weltwenden löst der Spieler selbst aus.
3. **Vor jeder Weltwende warnt die Welt.** Am Stauwehr stehen zwei Figuren in Sichtweite (Pegelwartin am Bahnhof,
   Zähler am Hof); der Regentenkampf beginnt nicht aus Versehen.
4. **Verpasst hinterlässt eine Spur** an der leeren Station und einen zweitbesten Ausgang. Keine Linie endet im
   Nichts.
5. **Verloren geht nie Notwendiges.** Was nur über eine Figur zu haben ist, ist `wissen`, eine Variante oder ein
   Zugang zu einem Ende — nie ein Werkzeug und nie die einzige Quelle einer Aufwertungsstufe (§8).
6. **Zerstören ist möglich und endgültig:** Wer einen Menschen tötet, hat seine Linie beendet. Das Heft behält, was er
   gesagt hat.

### 2.5 Folgen in der Welt

| Tat | Folge, sichtbar | Stand |
|---|---|---|
| Revier überwiegend gereinigt | reine Tiere bleiben, greifen nicht an; Rast dort erholt mehr (D379) | Entwurf Reinigen v1 |
| Revier überwiegend getötet | leer, still; Material (D379) | Entwurf |
| Flussvater besiegt | Wasser sinkt (ein Weltzustand); versunkene Stadt, Kirchturm, Kapelle fallen trocken | Datum `flutlinie`, kein Wasser gebaut |
| Region geheilt (drei Reinkulturen eingesetzt) | Rückkehrer (D241); Pegelwartin, Zähler, Bote wechseln die Station | gebaut (Stationen), Rückkehrer Bestand |
| Auftrag einer Bewohnerin erfüllt | sie zieht um oder ändert den Tageslauf (Magd geht den Uferweg wieder; Bursche verlässt die Wache) | fehlt (§9.4) |
| Mensch verschont / vertrieben / getötet | Lager leer, besetzt von anderen, oder er steht später woanders | fehlt (D385 nicht gebaut) |
| Jeder Eingriff | ein Kiesel in der Reihe des Zählers | **gebaut** als Bedingung `eingriffe`, die Reihe als Bild fehlt |

### 2.6 Der Zähler der Mönche

`eingriffe` = Zahl der getöteten **und** gereinigten Vorkommen (jedes einmal; der Regent zählt nicht, über ihn
urteilt die Station selbst). Abgeleitet aus dem Spielstand (`src/spiel/wanderfiguren.ts` `eingriffe`).

- **Sichtbar** an drei Stellen: die Kieselreihe am Hof am Stau (Länge = Eingriffe, zweite Reihe ab Station 3), das Heft
  im Opferstock der Kirche am Nordhang (`opferstock`), und die fünfte Station des Zählers.
- **Schwelle 40** für das Œntal — ⚠️ Annahme, nicht gemessen. Herleitung: Lehrstrecke 7 Gegner, vier Aufträge mit
  zusammen 12 Tieren, drei Engstellen am Uferweg; wer alles mitnimmt, liegt nach Schätzung bei 50–70, wer umgeht, bei
  15–25. Die Zahl steht in `content/wanderfiguren/zaehler.json`, nicht im Code.
- **Wirkung:** Unter der Schwelle und Region geheilt → Zähler auf der Wehrkrone, der Weg „Vollenden“ bleibt offen.
  Über der Schwelle → er sitzt abgewandt an der Kirche; im Œntal ist seine Linie dann zu Ende, die Fraktion nicht (§6).
- Die Enklave schaut auf den **Anteil** der Gereinigten, das Erbe auf die **Stärke** von Waffe und Marke (D385) — beide
  Maße sind noch nicht als Bedingung gebaut (§9.2).

### 2.7 Physik (D398): was die Abläufe voraussetzen

> **Nachgeprüft in `BRACHLAND_Physik-Pruefung_v1.md` (D408):** Die Wegzeiten macht das Rennen (11 m/s), nicht die
> 4,2 m/s; Steigung bremst im Code nicht; Punkt 3 ist zu streng begründet (bekleidet in 12 °C sind real rund 800 m
> schwimmbar); die Luft aus Punkt 2 reicht für Abstiege, nicht für die Strecke.

Flo, 22.11.2026: Physik muss stimmen. Geprüft sind die Questabläufe dieses Dokuments; Strecken und Höhen aus
`tools/traversal_wege.py` (D388, D391) und der Lage v2. Echte Zeit: Gehen 4 km/h in der Ebene, 300 Höhenmeter je
Stunde im Anstieg, der kleinere Wert halb gezählt (Wanderformel DIN 33466). Spielzeit: Die Lehrstrecke rechnet
1.182 m in 4,7 min (D390), also rund 4,2 m/s — Dauerlauf.

| Weg | Strecke / Anstieg | Echt zu Fuß | Im Spiel (4,2 m/s, ohne Kämpfe) |
|---|---|---|---|
| Start → Magd (Lehrstrecke) | 1.182 m / 11 m auf, 127 m ab | 18 min | 4,7 min |
| Brannburg → Wehr, Uferweg | 1.681 m / 10 m | 25 min | 6,7 min |
| Brannburg → Absetzbecken, Hangweg | 1.096 m / 18 m, dann 21 m Wasser | 17 min + 1 min schwimmen | 4,3 min |
| Brannburg → Oberstollen, Almweg | 2.097 m / 451 m | 1 h 45 min | 8,3 min ⚠️ |
| Brannburg → Saatkammer | 1.856 m / 99 m | 38 min | 7,4 min |
| Start → Quelltopf | 1.959 m / 343 m | 1 h 25 min | 7,8 min ⚠️ |

**Abweichungen, benannt:**

1. **Tempo.** Der Brachgänger läuft dreimal so schnell, wie ein Mensch geht, und bergauf im Spiel so schnell wie
   eben (⚠️ ob Steigung bremst, ist im Code nicht geprüft). Begründung: Spielfluss; die **Strecken** sind echt. Folge
   für die Quests: Kein Text nennt Minuten oder Stunden als Maß — die Figuren sagen „auf halbem Weg“, „eine Wand hoch“.
   Der Almweg ist ein halber Tag; die Linie F9 behandelt ihn so (keine Rückkehr „eben schnell“).
2. **Tauchen kürzt nicht über Tempo ab.** Mit Flossen 1–1,5 m/s: Der Tauchweg zum Wehr (1.586 m) dauert echt 18–26 min
   und ist damit **nicht schneller** als der Uferweg. Er kürzt ab, weil er die drei Engstellen umgeht. Das Tauchtempo
   6 m/s aus Traversal v2 wird geprüft; keine Quest hier hängt daran. Ein Atemgerät der Wartung hält in 10 m Tiefe
   grob eine Viertelstunde — der Weg zum Wehr geht nur in Etappen mit Auftauchen (Dächer, Kirchturm). Das passt zur
   Linie: Der Kirchturm ist die Rast auf halbem Weg.
3. **Warum man nicht einfach schwimmt.** Stauwasser eines Alpenflusses im Frühjahr hat 8–12 °C; ohne Kälteschutz
   endet Schwimmen nach Minuten, nicht nach Metern. Die Grenze der Grundbewegung (17,8 m je Leiste) ist damit
   plausibel, die 380-m-Querung zur Kapelle ohne Werkzeug nicht (D391 lässt sie richtig erst nach dem Wandel zu).
   **Folge für D393:** Das Tauchzeug ist Atemgerät **und** Anzug.
4. **Warum der Pegel steht.** Das Wasser ist an der Wehrkrone (499 m) angekommen und läuft über. Die Latte kann seit
   neunzehn Tagen nicht mehr steigen — die Lüge der Pegelwartin (F1) ist an der Latte und am Geräusch des Überlaufs
   prüfbar. Die Flut „seit dem Frühjahr“ ist plausibel schnell gekommen: Ein Fluss dieser Größe füllt den Talboden
   (3,73 km²) in Tagen, nicht Monaten.
5. **Der Wandel braucht Zeit.** Dieselbe Rechnung rückwärts: Der Talboden läuft nach dem Sieg nicht in Sekunden
   leer. Vorschlag (A-27.11): Das Wasser fällt **über die nächste Rast**; am Morgen danach steht Schlamm, die
   Wasserlinie an den Wänden bleibt. Bis dahin sinkt es sichtbar, die Orte sind noch nicht trocken.
6. **Was unter Wasser bleibt.** Kreide nicht — die Inschrift an der Haustür ist deshalb geschnitten
   (`tuer-im-schlamm`). Papier nicht — der Aushang am Werkstor hängt hinter Glas und über der Flutlinie.
7. **Was ein Mensch trägt.** Ein plombierter Saatgutsack wiegt um 25 kg; der Brachgänger nimmt den **Probenbeutel**
   des jüngsten Jahres (F7). Seil und Eisen (Kletterzeug) rund 8 kg, die Brechstange des Vorarbeiters ebenso.
8. **Die Glocke** (N6) läutet nicht im Wind — sie wiegt ein paar hundert Kilo. Losgebunden lässt sie sich am Seil
   läuten; bis Brannburg sind es 1.000 m, der Schlag kommt dort nach drei Sekunden an.
9. **Nicht von hier, aber im Weg:** Ein Gleitschirm, der achtzehn Jahre im Freien hing, trägt niemanden mehr
   (UV zersetzt das Tuch in wenigen Jahren). Der Gleiter aus D391 braucht eine Begründung (im Geweih eingewachsen und
   vom Pilzfächer überdeckt? neues Tuch aus der Hütte?) — ⚠️ UNKLAR, gehört zu D391/D393. Ebenso die Mauer am
   Stollenmund: Eine vermörtelte Bruchsteinmauer öffnet einer allein mit einer Stange nur am lose gesetzten
   Schlussstein, so wie D391 es beschreibt.

## 3. Hauptlinie Œntal

| # | Schritt | Wo (x / z) | Auslöser | Werkzeugweg | Beschwerlicher Weg | Daten |
|---|---|---|---|---|---|---|
| 0 | **Der Weg nach Brannburg** — acht Stationen, sechs Kämpfe, erste Zuflucht | 0/0 → 597/−566 | Spielstart | keiner nötig | der Weg selbst; jeder Kampf umgehbar (D396) | `strecken/weg-nach-brannburg` |
| 1 | **Ankunft.** Die Magd am Bach, dann der Saal. Brannburg misstraut der Marke; sechs Bewohner mit je einem ersten Satz | 597/−566, 657/−694 | Ort | — | — | `orte/dorf-*` |
| 2 | **Das stehende Wasser.** Vom Abstieg an der Ostkante sieht man die versunkene Stadt. Drei Stimmen deuten sie: Pegelwartin („Machen Sie, dass ich aufhören kann“), Wirt (Absetzbecken, Latte), Frau am Werkstor („eine Antwort, keine Vermutung“) | 889/−653; 696/−657; 1307/1177 | Figur | — | — | `das-stehende-wasser`, `was-der-tresen-weiss`, `die-letzte-kerbe` |
| 3 | **Drei Reinkulturen**, Reihenfolge frei | | | | | |
| 3a | Nord: Wasserprobe am Absetzbecken | 170/−1534 | Wirt | Tauchzeug: von der Ostkante durch die Flut | Hangweg über Feldscheune und Schuppen, 21 m schwimmen | `was-der-tresen-weiss` |
| 3b | West: Katalysator am Oberstollen | −1031/−47 | Wart vom Bruch | Kletterzeug: die Stufe unter dem Grat | alter Almweg, 451 Höhenmeter | `was-am-stollen-steht` |
| 3c | Süd: Saatgut in der Saatkammer | 421/1104 | Magd | Gleiter vom Westhang (−896/916) | Uferweg über den Stadel, dann bergauf | `nach-vorher-schmecken` |
| 4 | **Am Stauwehr.** Das Fundstück lesen ist die erste Weltwende: Pegelwartin und Zähler ziehen weiter | 1072/871 | Fundstück `stauwehr` | Tauchen durch die versunkene Stadt in Etappen, Rast am Kirchturm — nicht schneller, aber an den Engstellen vorbei (§2.7) | Uferweg 1.681 m, drei Engstellen, keine Zuflucht | `stauwehr` |
| 5 | **Der Flussvater.** Töten — oder mit allen drei Reinkulturen reinigen. Ohne Reinkulturen erreichbar und besiegbar (D380) | Wehr | Regent | wie 4 | wie 4; ohne Reinkulturen bleibt nur Töten | `was-im-stau-liegt` |
| 6 | **Wandel** (zweite Weltwende). Wasser sinkt über die nächste Rast (§2.7, A-27.11); altes Dorf, Kirchturm, Kapelle trocken. Der Bote kommt über das erste trockene Gleis. Der Flussvater ist ansprechbar: erstes Protokoll-Fragment | 839/857 | Weltzustand | — | — | Wanderfigur `bote-erbe` |
| 7 | **Zu Ende schreiben** (dritte Weltwende, freiwillig). Drei Reinkulturen am Regentenort einsetzen: Region geheilt. Wer getötet hat und sie nicht hat, lebt mit dem trockenen, befallenen Tal | Wehr | `heile` | — | — | `was-danach-waechst` |
| 8 | **Was danach offen ist** | | | | | |

**Schritt 8 im Einzelnen:** der Weg ins Fahlmoos (Nachbar Nord; der Bote wartet am Hof über dem Nordufer,
−315/−1310); die verborgenen Orte, soweit nicht gefunden; die trockengefallene Stadt mit den Fundstücken, die vorher
nur mit Tauchzeug zu lesen waren (`alter-tresen`, `tuer-im-schlamm`, `kirchturm`); alle Figurenlinien ab ihrer
Station nach dem Wandel. Der Bote bietet seinen Handel **nach** Schritt 6 und **vor** Schritt 7 an: Wer zu Ende
schreibt, hat ihn ausgeschlagen (Station 2: „Das war nicht der Handel“).

**Drei Zustände, mit denen man weiterspielt:** getötet und nicht geheilt (trocken, befallen — Enklave zufrieden,
Zähler fort, Bote am Bahnhof); gereinigt/geheilt (Zähler auf der Krone, Pegelwartin „sieht nicht hin“); getötet und
später geheilt (beides: die Pegelwartin hat ihr Dorf gesehen, der Zähler rechnet ab).

## 4. Wer zu welcher Fraktion gehört

| Fraktion | Wanderfigur (D375) | In Brannburg | Draussen |
|---|---|---|---|
| Enklave | Pegelwartin | Wirt, Bursche, Magd | Tremmel |
| Grüne Mönche | Zähler | die Alte am Zaun (heimlich), Förster (duldet sie) | der Verkeilte im Bannwald |
| Das Erbe | Bote | Schmiedin (über ihren Vater, unwissend) | Frau am Werkstor (hält das Schichtbuch weiter) |
| keine | — | — | Wart vom Bruch, der Vorarbeiter |

## 5. Neun Figurenlinien

Je Linie: Wunsch, Lüge oder Geheimnis, Stationen, Ausgänge, Wirkung auf die Enden, womit man sie verpasst oder
zerstört. „Daten“ nennt, was davon in `content/` steht; alles andere ist Entwurf.

### F1 — Die Pegelwartin (Enklave, Wanderfigur)

- **Wunsch:** aufhören zu schreiben. Das Wasser soll weg, das Ding im Wehr tot.
- **Lüge:** Sie schreibt jeden Morgen eine höhere Zahl an die Wand. Die Latte zeigt seit neunzehn Tagen dieselbe Höhe
  (`pegellatte`). Sie braucht das steigende Wasser, damit Brannburg den Flussvater tot will.
- **Geheimnis:** Ihr Mann ist im Haus im alten Dorf geblieben, freiwillig („Einer muss da sein, wenn es fertig ist“,
  `tuer-im-schlamm`). Was man heilt, kommt wieder — sie meint ihn.

| Station | Wo (x / z) | Bis | Was der Spieler tun kann |
|---|---|---|---|
| 1 Pegel unter der Terrasse | 889/−653 | `stauwehr` gelesen | zuhören; die Latte lesen (907/−637); dem Wirt berichten oder schweigen |
| 2 Bahnhof am Wehr | 858/852 | Flussvater besiegt | sie sagt „Nicht heilen“. Ihre Haustür (1340/390) ist schon jetzt lesbar, wenn man hinkommt — ⚠️ Wassertiefe und Abstand zum Ufer dort nicht gemessen; ihr Satz an Station 3 nennt die Wasserlinie auf Schulterhöhe |
| 3 Altes Dorf, trockengefallen | 1327/397 | Region geheilt | die Tür für sie öffnen — oder zu lassen |
| 4 Terrasse, letzte Zahl | 878/−656 | — | — |

- **Ausgänge:** (a) *Getötet, Tür zu:* Sie hat, was sie wollte, und bleibt an Station 3 stehen; Enklave-Ende offen.
  (b) *Geheilt:* letzte Zahl, Strich darunter, „sie sieht nicht hin“; sie verzeiht es nicht, die Enklave schon.
  (c) *Latte dem Wirt gemeldet* (`die-letzte-kerbe` abgeholt): Brannburg weiß, dass sie gelogen hat. Sie schreibt
  weiter, aber die Wand liest keiner mehr; der Wirt wird zur Stimme der Enklave für die nächsten Regionen.
- **Enden:** Zurückdrehen steht über sie **oder** über den Wirt offen (c). Wer (b) wählt und (c) nicht, hat im Œntal
  keinen Fürsprecher der Enklave.
- **Verpassen/Zerstören:** Station 1 verpasst, wer das Stauwehr liest, bevor er an der Ostkante war — die Wand mit den
  Zahlen bleibt als Spur. Zerstört: die Tür an Station 3 gegen ihren Willen öffnen, bevor sie davorsteht (nach dem
  Wandel ist sie offen zugänglich).
- **Daten:** Wanderfigur (Bestand, unverändert), `pegellatte`, `tuer-im-schlamm`, Auftrag `die-letzte-kerbe` (neu).

### F2 — Der Zähler (Grüne Mönche, Wanderfigur)

- **Wunsch:** dass das Land fertig wird — und dass einer es aushält.
- **Geheimnis:** Er ist der Sohn der Alten am Zaun; das Zählen hat er von ihr. Und er sucht nicht irgendeinen: Er
  sieht „auf Ihren Arm, nicht in Ihr Gesicht“. Er weiß, was die Marke aus ihrem Träger macht (Twist, Bibel v1 §3).

| Station | Wo (x / z) | Ab / Bis | Was der Spieler tun kann |
|---|---|---|---|
| 1 Hof am Stau | 988/764 | bis `stauwehr` | „Zählen Sie nach, bevor Sie etwas tun“ |
| 2 Ufer am Absetzbecken | 150/−1499 | bis `absetzbecken` | er steht dort, wo die Zahl für den Spind liegt |
| 3 Hof am Stau, zweite Reihe | 995/747 | bis Flussvater besiegt | die Reihe zeigt die eigenen Eingriffe |
| 4 Wehrkrone | 1050/861 | **ab** Region geheilt, **bis** 40 Eingriffe | „Jetzt fehlt nur noch, dass es einer aushält“ |
| 5 Kirche am Nordhang, Stufe | −264/−1761 | — | er hat das Heft zugeklappt |

- **Ausgänge:** (a) *Geheilt, unter 40 Eingriffen:* Wehrkrone; Vollenden offen. (b) *Über 40:* Kirchenstufe, „Das Land
  merkt den Unterschied nicht“ — gleich, ob getötet oder gereinigt wurde. (c) *Getötet, nicht geheilt, zurückhaltend:*
  Er ist nirgends, bis geheilt wird.
- **Reinigen gegen Töten:** für ihn kein Unterschied — das ist seine Aussage und der dritte Spielstil (D385).
- **Verpassen/Zerstören:** Station 2 verpasst, wer die Tafel liest, ohne ihn am Ufer anzusprechen (Spur: Fußstapfen
  im Schlamm, ins Wasser und zurück). Zerstört durch die Schwelle.
- **Daten:** Wanderfigur mit Bedingung `eingriffe` und fünfter Station (neu), `opferstock` (neu).

### F3 — Der Bote (Das Erbe, Wanderfigur)

- **Wunsch:** Die drei Reinkulturen bleiben, wo sie sind; das Protokoll soll gehorchen, nicht enden.
- **Lüge:** Er tut, als käme er von weit. Seine Stiefel sind sauber, weil das Erbe nah sitzt — hinter dem Werkstor.
- **Geheimnis:** Die Marke ist eine Armklammer Typ B des Werks, elf ausgegeben, zehn zurück (`werkstor-aushang`). Er
  kennt sie „beim Namen“, weil sie nach seiner Lesart Werkseigentum ist — und der Träger mit ihr.

| Station | Wo (x / z) | Ab / Bis | Was der Spieler tun kann |
|---|---|---|---|
| 1 Bahnhof, nach dem Wandel | 839/857 | ab Flussvater besiegt, bis Region geheilt | den Handel hören; nicht heilen heißt annehmen |
| 2 Silo drei, trockengefallen | 1030/−580 | bis `was-danach-waechst` abgeholt | er misst, was gewachsen ist |
| 3 Hof über dem Nordufer | −315/−1310 | — | er nennt eine Zahl (die Seriennummer der elften Klammer) |

- **Ausgänge:** (a) *Handel gehalten* (Regent besiegt, nicht geheilt, mindestens eine Reinkultur behalten): Übernehmen
  offen; er gibt im Fahlmoos weiter. (b) *Zu Ende geschrieben:* „Das war nicht der Handel. Er klingt, als hätte er
  Zeit“ — das Erbe wartet, die Tür ist angelehnt, nicht zu. (c) *Den Aushang gelesen, bevor er kommt:* Er weiß, dass
  man es weiß, und sagt die Zahl schon am Bahnhof.
- **Verpassen/Zerstören:** Station 1 verpasst, wer sofort heilt (Spur: saubere Stiefelabdrücke auf dem Gleis).
  Menschen sind nicht reinigbar (D385): Wer ihn angreift, bricht seine Haltung und er geht — endgültig.
- **Daten:** Wanderfigur (Bestand, unverändert), `werkstor-aushang` (neu).

### F4 — Der Bursche und sein Bruder (Enklave)

- **Wunsch:** Der Bruder soll zurückkommen. Er ist mit dem Spieß des Vaters den Uferweg hinunter, zum Wehr.
- **Geheimnis:** Der Bruder ist nicht am Flussvater gescheitert. Er hat im Stadel am Hangweg umgedreht — „mit dem Kopf
  zum Hang“ (`mulde-im-heu`) — und ist zum Zähler gegangen. Die Füchse folgen seiner Spur, nicht der Terrasse.

| Station | Wo (x / z) | Bedingung | Reinigen gegen Töten |
|---|---|---|---|
| 1 Ostkante, Wache | 851/−700 | Auftrag `schritte-auf-der-strasse` (4 Spürfüchse) | **Gereinigt** laufen die Füchse die Spur weiter und führen sichtbar zum Stadel; **getötet** ist die Spur weg — der Stadel bleibt auffindbar, aber nur über die Worte |
| 2 Stadel am Hangweg | 818/108 | Auftrag `wer-wirklich-kommt`, Fundstück `mulde-im-heu` | — |
| 3 Hof am Stau | 988/764 | nach `stauwehr`: Der Bruder sitzt beim Zähler, wenn dieser an Station 3 steht | ihn ansprechen, oder es dem Burschen sagen, oder beides lassen |
| 4 Ostkante | 851/−700 | zurück beim Burschen | sagen, wo er ist — oder nur den Spieß bringen |

- **Ausgänge:** (a) *Gesagt:* Der Bursche verlässt die Wache und geht selbst; die Ostkante ist danach unbewacht (in
  Brannburg hört man nachts mehr). (b) *Nur der Spieß:* Er hält ihn für tot, bleibt, und die Enklave hat einen Grund
  mehr gegen das Wehr. (c) *Füchse getötet und nie nachgesehen:* Der Bruder bleibt bei den Mönchen; nach dem Wandel
  steht er auf der Kirchenstufe neben dem Zähler.
- **Enden:** (a) macht den Burschen zum zweiten Faden der Mönche in späteren Regionen; (b) stärkt Zurückdrehen.
- **Verpassen/Zerstören:** Wer den Flussvater besiegt, bevor er im Stadel war, findet die Mulde kalt und den Spieß
  fort (Ausgang c).
- **Daten:** Auftrag `wer-wirklich-kommt` (neu), `mulde-im-heu` (neu). Der Bruder selbst, Station 3–4 und die
  Fuchsspur sind Entwurf (§9.3, §9.6).

### F5 — Die Alte am Zaun (heimlich Mönche)

- **Wunsch:** dass die Zahl stimmt. Sie zählt jede Nacht die Tiere über der Terrasse.
- **Geheimnis:** Sie zählt für ihren Sohn. Was sie am Zaun zählt, steht eine Woche später im Heft im Opferstock.
  Brannburg weiß das nicht.

| Station | Wo (x / z) | Bedingung |
|---|---|---|
| 1 Kirchhofzaun | 745/−725 | `die-zahl-am-morgen` (2 Firnhasen reinigen) |
| 2 Kirche am Nordhang | −288/−1788 | `was-im-heft-steht`, Fundstück `opferstock` |
| 3 Kirchhofzaun | 745/−725 | zurück: „ob meine Zahl darin vorkommt“ |
| 4 beim Wirt, abends | 696/−657 | nach dem Wandel sagt sie es im Saal — oder nie |

- **Ausgänge:** (a) *Zahl bestätigt, geschwiegen:* Sie stärkt die Marke (sie kennt den Griff, ihr Mann trug die
  zehnte Klammer). (b) *Dem Wirt gesagt:* Brannburg stellt sie kalt; der Zähler spricht ab da kürzer. (c) *Firnhasen
  getötet statt gereinigt:* Ihre Zahl stimmt nie wieder; Station 2 bleibt ihr verschlossen, das Heft liegt trotzdem
  in der Kirche.
- **Reinigen gegen Töten:** Der erste Auftrag verlangt Reinigen; wer tötet, erfüllt ihn nicht — die Hasen sind fort.
- **Daten:** Auftrag `was-im-heft-steht` (neu), `opferstock` (neu).

### F6 — Die Schmiedin (Erbe-Spur)

- **Wunsch:** den Kern des Flussvaters in Harz fassen. „Fragen Sie mich nicht, wie.“
- **Geheimnis:** Ihr Vater hat die elf Armklammern geschmiedet. Sie weiß es halb und will es nicht ganz wissen.

| Station | Wo (x / z) | Bedingung |
|---|---|---|
| 1 Esse am Nordende | 765/−259 | `harz-fuer-die-esse` (2 Trafomarder) |
| 2 Werkstor | 1318/1194 | `was-am-werkstor-haengt`, Fundstück `werkstor-aushang` |
| 3 Esse | 765/−259 | `der-kern-im-stau` (Flussvater besiegt): Kern fassen |
| 4 Esse, nach dem Boten | 765/−259 | Der Bote will den Kern; sie fragt, wem sie ihn geben soll |

- **Ausgänge:** (a) *Kern an der Marke* (Markenstärkung, Kernfunken v1). (b) *Kern an den Boten:* Übernehmen rückt
  näher, die Marke bleibt, wie sie ist. (c) *Aushang nie gelesen:* Sie fasst den Kern, ohne zu wissen, was sie
  vollendet — der Bote sagt es ihr nach dem Wandel an ihrer Stelle.
- **Reinigen gegen Töten:** Harz gibt es nur, wenn die Marder weg sind — getötet sofort; gereinigt bleiben sie an den
  Kiefern, greifen aber nicht mehr an (gleicher Lohn, anderes Revier). Der Kern fällt bei Töten **und** Reinigen des
  Regenten an; beim Reinigen ist er kalt und fasst sich anders (D393: zwei Ausprägungen derselben `marke`-Belohnung).
- **Daten:** Auftrag `was-am-werkstor-haengt` (neu), `werkstor-aushang` (neu).

### F7 — Die Magd vom Unterhof (Enklave)

- **Wunsch:** wieder säen. Das Wasser vom Bach „schmeckt noch nach vorher“; sie will, dass etwas so wächst.
- **Zwickmühle:** Das reine Saatgut aus der Saatkammer ist eine der drei Reinkulturen — der plombierte Probenbeutel
  des jüngsten Jahres, einer (die Säcke wiegen 25 kg und bleiben, wo sie sind). Im Beet der Magd bricht die Plombe und
  es wächst ein Sommer; im Wehr heilt er das Tal.

| Station | Wo (x / z) | Bedingung |
|---|---|---|
| 1 Bach am Westrand | 597/−566 | erste Begegnung (D396); `nach-vorher-schmecken` |
| 2 Saatkammer | 421/1104 | Fundstück `saatkammer`; Reinkultur Süd |
| 3 Bach | 597/−566 | „Sagen Sie mir das Jahr“ — und sie fragt nach dem Sack |
| 4 Unterhof, trockengefallen | unter der Flutlinie; Ort noch zu setzen | nach dem Wandel: ein zweiter Beutel, im Blechkasten auf dem Dachboden ihres Hofs (im Keller wäre er verfault) |

- **Ausgänge:** (a) *Beutel der Magd gegeben:* Beet am Bach, sichtbar; die Heilung der Region wartet, bis der zweite
  Beutel gefunden ist (mit Tauchzeug früher, sonst nach dem Wandel). (b) *Beutel behalten:* Sie sagt nichts und trägt
  weiter Wasser. (c) *Zweiten Beutel gebracht:* beides geht — aber nur für den, der ihren Hof findet.
- **Enden:** (a) vor (c) ist der stärkste Vertrauensbeweis für die Enklave.
- **Daten:** Bestand (`nach-vorher-schmecken`). Die Zwickmühle braucht die Zielart `bringe` (§9.1). ⚠️ UNKLAR: ob eine
  Reinkultur-Komponente überhaupt weggegeben werden darf — heute nicht; A-27.6.

### F8 — Der Förster und der Verkeilte (Mönch im Endstadium)

- **Wunsch (Förster):** mit dem Wald leben. „Schießen will ich sie nicht, der Wald merkt sich das.“
- **Geheimnis:** Hinter der Kante liegt der Bannwald, und in der Hütte dort sitzt ein Mönch, der sich hat einkeilen
  lassen — **von außen**, vom Förster. Zwei Teller auf dem Tisch. Was den Kreis um die Hütte geht, bewacht ihn.

| Station | Wo (x / z) | Bedingung |
|---|---|---|
| 1 Hofgruppe am Waldrand | 401/−813 | `bis-zur-kante` (Felsband −784/474 lesen) |
| 2 Hangwald | um 401/−813 | `ein-schwieriger-nachbar` (3 Wurzelkeiler reinigen) → Halfter (Traversal v2 §5) |
| 3 Hütte im Bannwald | −746/−649 | verborgener Ort; kein Auftrag nennt ihn. Verhärteter Wurzelkeiler davor |
| 4 in der Hütte | −746/−649 | der Verkeilte: freiwillig befallen, als Einziger im Œntal **reinigbar** (D385) |

- **Ausgänge:** (a) *Tür zu lassen:* Die Mönche rechnen es an; der Förster sagt beim nächsten Besuch einen Satz mehr.
  (b) *Reinigen:* ein Übergriff. Er lebt, ist wieder Mensch und will es nicht sein; der Zähler zählt es **doppelt**.
  (c) *Töten:* Die Hütte ist leer, der Keiler bleibt verhärtet am Kreis.
- **Reinigen gegen Töten:** Der Keiler davor ist nur mit einer Reinkultur zu reinigen (Verhärteter). Gereinigt gibt er
  den Weg frei und bleibt; getötet auch — aber dann fehlt der Wächter, und was in der Hütte sitzt, kommt nach dem
  Wandel heraus.
- **Enden:** (a) ist im Œntal der zweite Weg zu Vollenden, wenn der Zähler über der Schwelle ist.
- **Verpassen:** nicht verpassbar (Ort), nur zerstörbar.
- **Daten:** Bestand (zwei Aufträge, `jagdhuette`, `felsband`). Der Verkeilte ist Entwurf; das Schema kennt
  `freiwillig` am Gegner (D389), einen solchen Gegner gibt es nicht.

### F9 — Der Wart und sein Vorarbeiter (keine Fraktion; Menschen)

- **Wunsch (Wart):** wissen, ob die Mauer hält. Er bewacht einen Bruch, den es nicht mehr gibt.
- **Geheimnis:** Sie haben nicht wegen des Befalls zugemauert. Im unteren Stollen liegt die Sprengladung vom Freitag
  vor achtzehn Jahren (`bruchkante`) — und der Vorarbeiter wollte sie zünden, um den Hang über dem Werk abzugehen.

| Station | Wo (x / z) | Bedingung |
|---|---|---|
| 1 Stollenmund | −255/292 | Fundstück auf dem Weg vom Start |
| 2 Wart vom Bruch | 167/540 | `was-noch-drin-liegt`; `was-am-stollen-steht` (Reinkultur West) |
| 3 Lager am Bruchweg | 222/580 | Vorarbeiter und sein Wolf |
| 4 Stollenmund | −255/292 | Mauer öffnen: Kletterzeug |

- **Ausgänge am Lager:** Wolf **gereinigt** und Mensch **verschont** → er gibt die Stange und sagt, warum zugemauert
  wurde; der Wolf bleibt bei ihm. Wolf **getötet**, Mensch verschont → er gibt die Stange und schweigt. Mensch
  **vertrieben** → Stange liegt im Lager, er taucht am Uferweg als dritte Engstelle wieder auf. Mensch **getötet** →
  Stange liegt im Lager; der Wart fragt nie wieder nach ihm und gibt den West-Auftrag nicht mehr (die Tafel am
  Oberstollen bleibt lesbar, die Reinkultur liegt dann im Regal statt beim Wart — §2.4 Regel 5).
- **Daten:** Bestand (zwei Aufträge). Menschen als Gegner mit Aufgabe/Flucht fehlen (D385, §9.5).

## 6. Wirkung auf die drei Enden

Ein Ende steht offen, wenn die Geschichte seiner Fraktion verfolgt wurde (Bibel §5). Vorschlag für die Rechnung
(⚠️ Annahme, A-27.5): Je Region zählt für eine Fraktion **ein Faden**, wenn mindestens eine ihrer Linien dort nicht
zerstört ist. Ein Ende steht am Werksleib offen bei drei Fäden aus fünf Regionen.

| Ende | Œntal: Faden hält, wenn | Zweiter Weg im Œntal |
|---|---|---|
| Zurückdrehen (Enklave) | F1 Ausgang a oder b — oder der Wirt nach `die-letzte-kerbe` | F7 a, F4 b |
| Vollenden (Mönche) | F2 Ausgang a (geheilt, unter der Schwelle) | F8 a (Tür zu lassen), F5 a |
| Übernehmen (Erbe) | F3 Ausgang a (Handel gehalten) | F6 b (Kern an den Boten) |

Im Œntal lassen sich höchstens zwei Fäden zugleich halten: Zurückdrehen und Übernehmen vertragen sich (töten, nicht
heilen), Vollenden und Zurückdrehen auch (heilen, wenig eingreifen), Vollenden und Übernehmen nie (heilen gegen nicht
heilen). Das ist gewollt: Die Region stellt die Frage, sie beantwortet sie nicht.

## 7. Nebenaufgaben, Weltereignisse, verborgene Orte

### Einmalige Nebenaufgaben

| # | Was | Wo (x / z) | Reinigen gegen Töten | Daten |
|---|---|---|---|---|
| N1 | Tremmel: Sporenhähne an der Silage, dann ein Alpenmurmel für den Hang | −195/422 | Gereinigte Murmel graben weiter, der Hang hält (ein Rutsch am Almweg bleibt aus); getötet rutscht er | `streuner`, `eine-fuer-den-hof` |
| N2 | Frau am Werkstor: einen K7 stillstellen, nicht töten | 1307/1177 | Getötet läuft die Runde mit einem weniger; gereinigt bleibt er stehen und die anderen laufen um ihn herum | `die-runde` |
| N3 | Schmiedin: Harz | 765/−259 | siehe F6 | `harz-fuer-die-esse` |
| N4 | Das Boot kieloben (Rätsel, Tauchzeug) | 442/−1240 und 170/−1534 | — | `boot-kieloben` (neu), `absetzbecken` |
| N5 | Das Tuch am Quelltopf (optionaler Boss, Gleiter) | −1683/650 | Gereinigt lässt das Grathorn den Schirm los und bleibt; getötet schneidet man ihn heraus (Traversal v2 §5) | `huettenbuch` (neu, Spur an der Almhütte −1470/−1412) |
| N6 | Die Glocke im Kirchturm: Der Klöppel ist festgebunden. Losbinden und am Seil läuten — in Brannburg, 1.000 m entfernt, dreht sich jeder um; einmal, nicht wieder | 1639/−317 | — | `kirchturm` |

### Wiederholbare, kleine Dinge

| # | Was | Regel |
|---|---|---|
| W1 | **Die Zahl an der Wand:** Jeden Morgen steht am Pegel eine neue Zahl. Sie ist die einzige Uhr des Spiels und zeigt nichts an außer sich selbst | nur Bild |
| W2 | **Das Brett beim Wirt:** Zettel der Bewohner über Reviere („Hangwald, drei Keiler“). Kein Kopfgeld auf Tote: Der Lohn hängt am ruhigen Revier, gleich ob gereinigt oder vertrieben | braucht Reviere (§9.8) |
| W3 | **Die Nachtzahl der Alten:** Wer nachts über die Terrasse geht, wird mitgezählt und hört es am Morgen | nur Satz |
| W4 | **Wegelager** (Bestand): besetzt, geräumt, neu besetzt | Bestand D178 |

### Weltereignisse (einmalig, an Weltwenden)

| Wende | Ereignis |
|---|---|
| `stauwehr` gelesen | Pegelwartin und Zähler ziehen weiter; die Füchse an der Ostkante werden mehr |
| Flussvater besiegt | Wasser fällt; Bote kommt; die Kapelle ist zu Fuß erreichbar; am alten Tresen stehen die Stühle noch auf den Tischen |
| Region geheilt | Rückkehrer (D241); das Beet der Magd trägt; die Kieselreihe liegt im Wasser |

### Verborgene Orte (Bestand D375, hier nur die Einbindung)

| Ort | x / z | Verhärteter | Spur | Hängt an |
|---|---|---|---|---|
| Kirchturm im Wasser | 1639/−317 | Kiemenbiber | Licht; der Tauchweg zum Wehr führt vorbei | N6 |
| Hütte im Bannwald | −746/−649 | Wurzelkeiler | Gelände; „dann hört es auf, seines zu sein“ (Förster) | F8 |
| Quelltopf | −1683/650 | Grathorn | Gelände; `huettenbuch` | N5 |

Kein Auftrag zeigt auf sie (`validate`). Fundstücke und Sätze dürfen sie andeuten, ohne Koordinate.

## 8. Belohnung je Quest — Vertrag mit D393

Nur Kategorie und Stufe. Welcher Gegenstand das ist, entscheidet D393. Kategorien: `aufwertung-1..4`
(Aufwertungsmaterial der Stufe), `verbrauch`, `werkzeug`, `waffe`, `ruestung`, `marke` (Stärkung oder Ladung),
`wissen` (Fundtext, Rezept, Karte), `zugang` (Abkürzung, Ort). Im Schema als `Auftrag.lohn` (optional); solange es
gesetzt ist, ist `belohnung` Platzhalter. **Die vier neuen Aufträge tragen `lohn`; bei den Bestandsaufträgen steht die
Kategorie nur hier**, damit zwei Arbeiten nicht dieselben Dateien ändern.

| Quest | Schritt / Linie | Kategorie + Stufe | Heute in `belohnung` (Platzhalter) |
|---|---|---|---|
| Lehrstrecke, Remise | H0 | `verbrauch` | — |
| `das-stehende-wasser` | H2 | `verbrauch`, `wissen` | Quellwasser 2, Kräutersud 2 |
| `was-der-tresen-weiss` | H3a | Reinkultur Nord (Bestand) + `verbrauch` | Kräutersud 2, Wasserprobe |
| `was-am-stollen-steht` | H3b | Reinkultur West (Bestand) + `aufwertung-2` | Harzverband 2, Katalysator |
| `nach-vorher-schmecken` | H3c | Reinkultur Süd (Bestand) + `verbrauch` | Kräutersud 1, Reinkultur 1, Saatgut |
| `was-im-stau-liegt` | H5 | `marke` (Fassungsvermögen), `aufwertung-3` | Herzfunke 1, Reinkultur 2, Quellwasser 3 |
| `der-kern-im-stau` | H5 / F6 | `marke` (Direktivkern; zwei Ausprägungen: getötet / gereinigt) | Harzverband 2 |
| `was-danach-waechst` | H7 | `marke`, `zugang` (Fahlmoos-Weg), `aufwertung-3` | Reinkultur 1, Quellwasser 3 |
| `die-letzte-kerbe` **neu** | F1 | `verbrauch`, `wissen` | Kräutersud 2 |
| F1 Ausgang a (Tür) | F1 | `ruestung` | — (kein Auftrag) |
| F2 Wehrkrone | F2 | `marke` | — (Wanderfigur, §9.3) |
| F3 Handel | F3 | `waffe` **oder** `aufwertung-4` (nur Ausgang a) | — |
| `schritte-auf-der-strasse` | F4 | `verbrauch` | Quellwasser 2 |
| `wer-wirklich-kommt` **neu** | F4 | `aufwertung-1`, `wissen`; Ausgang b zusätzlich `waffe` (der Spieß) | Harzverband 1, Kräutersud 1 |
| `die-zahl-am-morgen` | F5 | `verbrauch` | Köder 2 |
| `was-im-heft-steht` **neu** | F5 | `marke` (Ladung), `wissen` | Quellwasser 1, Zunder 1 |
| `harz-fuer-die-esse` | F6 | `aufwertung-1` | Harzverband 2 |
| `was-am-werkstor-haengt` **neu** | F6 | `aufwertung-2`, `wissen` | Harzverband 2 |
| F7 Beet | F7 | `verbrauch` (wiederkehrend, je Rast in Brannburg) | — |
| `bis-zur-kante` | F8 | `verbrauch`, `wissen` | Harzverband 1, Zunder 1 |
| `ein-schwieriger-nachbar` | F8 | `werkzeug` (Reittier/Halfter) | Kräutersud 2 |
| F8 Hütte, Ausgang a | F8 | `wissen`; Ausgang b/c `aufwertung-3` | — |
| `was-noch-drin-liegt` | F9 | `werkzeug` (Kletterzeug) | Harzverband 1 |
| `streuner` | N1 | `verbrauch` | Kräutersud 3, Köder 1 |
| `eine-fuer-den-hof` | N1 | `aufwertung-1`, `zugang` (Almweg ohne Rutsch) | Netzschlinge 1, Quellwasser 1 |
| `die-runde` | N2 | `aufwertung-2` | Reinkultur 1, Kräutersud 2 |
| Boot kieloben | N4 | `werkzeug` (Tauchzeug) | — |
| Tuch am Quelltopf | N5 | `werkzeug` (Gleiter); gereinigt zusätzlich `marke`, getötet `aufwertung-3` | — |
| Glocke | N6 | `wissen` | — |
| Kirchturm, Verhärteter | verborgen | `aufwertung-3`, `ruestung` | — |
| Brett beim Wirt | W2 | `aufwertung-1` oder `verbrauch`, wiederholbar | — |

**Verteilungsregeln für D393:** (1) Stufe 1 in Brannburg und auf der Lehrstrecke, Stufe 2 an den Reinkultur-Wegen,
Stufe 3 beim Regenten und an den verborgenen Orten, Stufe 4 im Œntal nur einmal (Handel des Boten) — sie gehört sonst
der nächsten Region. (2) Kein Werkzeug hinter einer verpassbaren Figur (§2.4). (3) Reinigen gibt `marke` und `wissen`,
Töten gibt `aufwertung` (D379) — wo beide Wege offen sind, stehen beide Kategorien in der Zeile. (4) Köder und
Netzschlinge (Fanghilfe) sind Altbestand aus dem Creature-Collector und sollten als Belohnung verschwinden (A-24.11).

## 9. Umsetzungsliste — was Schema und Code noch nicht können

| # | Was fehlt | Wofür | Aufwand grob |
|---|---|---|---|
| 1 | Zielart `bringe` (Gegenstand abgeben) und Abgeben von Komponenten | F7, F6 Ausgang b, F4 Ausgang b | Schema + `auftraege.ts`, klein; die Regel „Komponente weggeben“ ist eine Entscheidung |
| 2 | Stationsbedingungen `anteil-gereinigt` (Enklave) und `staerke` (Erbe); UND-Verknüpfung | F1, F3, §6 | klein; `eingriffe` ist das Muster |
| 3 | Wanderfiguren mit Gabe und mit Auftrag; mehr als eine Figur je Fraktion (`validate` verlangt genau eine); Nebenfiguren ohne Fraktion (Bruder, Vorarbeiter, Verkeilter) | F2–F4, F8, F9 | mittel |
| 4 | Verzweigte Ausgänge: Eine Linie endet je nach Tat anders; Bewohner ziehen um oder ändern den Satz nach einem Auftrag | alle Linien | mittel; als Zustandsliste je Ort (`textNach: { bedingung, text }[]`), kein Skript |
| 5 | Menschen als Gegner mit Aufgabe/Flucht; töten/vertreiben/verschonen als Eintrag im Spielstand | F3, F9 | fehlt in `echtzeit.ts` (D385) |
| 6 | Beobachtungen: Tiere, die eine Spur laufen; Spuren an verlassenen Stationen | F4, §2.4 Regel 4 | mittel; Spur als Dekal an der Station mit `bis` |
| 7 | `validate`: Auftragstext nennt eine Richtung oder einen Anblick; jede Linie hat eine zweite Quelle | §2.1, §2.2 | klein |
| 8 | Reviere als Datum (Fläche, Bilanz gereinigt/getötet) und ihre Darstellung | §2.5, W2 | groß; Entwurf Reinigen v1 |
| 9 | Das Heft als Anzeige (Seite im Menü, nach Person und Ort) | §2.3 | klein; Logik steht |
| 10 | Kieselreihe als Bild (Länge aus `eingriffe`) | §2.6 | klein |
| 11 | Rätsel (Zahlenschloss), optionaler Boss, Verhärtete an den verborgenen Orten | N4, N5, F8 | Traversal v2 §8 Punkte 11–14 |
| 12 | Weltzustand „Regent besiegt, nicht geheilt“ durchgängig (Wasser, Texte) | H6 | D380 |
| 13 | Eigene Liste `gereinigt` im Spielstand; bis dahin zählt das alte Aufnehmen | §2.6, alle `reinige`-Aufträge | hängt an der Kampfhandlung Reinigen |
| 14 | Fundstücke unter der Flutlinie sind heute ohne Wasser erreichbar (`tuer-im-schlamm`, `alter-tresen`, `pegellatte`) | H8 | hängt an der Flut |
| 15 | Wandel über eine Rast statt sofort; Tauchen in Etappen (Luftvorrat), Kälte als Grund der Schwimmgrenze | §2.7 | hängt an Flut und Tauchen (Traversal v2 §8) |

## 10. Was in dieser Runde angelegt wurde

| Art | Dateien | Wirkt im Spiel |
|---|---|---|
| Aufträge (19 → 23) | `wer-wirklich-kommt` (Bursche), `die-letzte-kerbe` (Wirt), `was-im-heft-steht` (Alte), `was-am-werkstor-haengt` (Schmiedin) | ja — bei den vier Bewohnern annehmbar, Lohn Platzhalter |
| Fundstücke (24 → 31) | `pegellatte`, `mulde-im-heu`, `boot-kieloben`, `opferstock`, `huettenbuch`, `werkstor-aushang`, `tuer-im-schlamm` | ja — liegen aus |
| Wanderfigur | `zaehler`: Wehrkrone mit `bis` 40 Eingriffe, fünfte Station an der Kirche | ja |
| Schema | `Stationsbedingung` `eingriffe`; `Auftrag.lohn` mit `LOHNKATEGORIEN` | — |
| Logik | `src/spiel/wanderfiguren.ts` `eingriffe`; `src/spiel/notizbuch.ts`; `main.tsx` vermerkt die Station | Zähler ja, Heft ohne Anzeige |
| Tests | `tests/notizbuch.test.ts` (18), `tests/wanderfiguren.test.ts` (+7) | — |

Lage der neuen Fundstücke aus Koordinaten der Nachbarorte abgeleitet, **nicht im Spiel gesehen**: ob Latte, Aushang
und Tür an einer Wand oder im Freien liegen, zeigt erst der Blick am Gerät.
