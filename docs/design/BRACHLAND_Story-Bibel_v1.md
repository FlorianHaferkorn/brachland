# BRACHLAND — Story-Bibel v1

Arbeitstitel: **BRACHLAND** (Alternativen: *Reinkultur*, *Brachgang*)
Genre: 3D-Creature-Collector-RPG (Low-Poly), rundenbasierte Kämpfe, reale Karte (OSM Bayern, umbenannt), regionsweise erweiterbar, offline-fähig (PWA).
Ton: dunkel, wortkarg, melancholisch — Elden-Ring-Fragmente statt Cutscenes.

---

## 1. Elevator Pitch

Ein namenloser Wanderer zieht durch ein Bayern, das es nicht mehr gibt: Der Biotech-Konzern VERIDIA wollte das Artensterben lösen und hat stattdessen die Natur ersetzt. Die Menschheit überlebt in Enklaven. Der Wanderer trägt eine verbotene Marke, mit der er befallene Kreaturen binden, stabilisieren und trainieren kann — und er ist der Einzige, der die korrumpierten Regenten der Regionen besiegen und die Heilungsprotokolle umschreiben kann. Doch je tiefer er vordringt, desto klarer wird: Die Korruption ist keine Krankheit. Sie ist eine Therapie, in der Menschen nicht vorgesehen sind.

---

## 2. Weltgesetz & Vorgeschichte

**VERIDIA** entwickelte die **Symbionten**: gezüchtete Organismen, die Wälder schneller wachsen lassen, Böden filtern, Ernten sichern. Ausgebracht flächendeckend, gesteuert über einen biologischen Trägererreger. Dann mutierte der Erreger — **der Faulbrand** — und die Symbionten liefen frei. Binnen einer Generation: Landwirtschaft kollabiert, Städte aufgegeben, Restmenschheit in Enklaven hinter Filterzäunen. Die übernommene Natur ist nicht tot, sondern fremd: überwuchert, biolumineszent, gefährlich schön.

**Der Twist (früh andeuten, spät enthüllen — Nausicaä-Prinzip):** Der Faulbrand ist keine Fehlfunktion. Die Symbionten führen VERIDIAs **Notfallprotokoll** aus: radikale Bodensanierung nach irreversibler Kontamination. Die Korruption *ist* die Heilung — nur wurde der Mensch aus der Gleichung gestrichen. Das Spielziel verschiebt sich dadurch im Verlauf von „Natur zurückverwandeln" zu „das Protokoll mit den Menschen versöhnen".

Zeitebene: ~40–60 Jahre nach dem Kollaps. Niemand Lebendes hat die alte Welt als Erwachsener gesehen. VERIDIA existiert nur noch als Ruinen, Archive, Artefakte — Vergangenheit wird archäologisch erzählt (Horizon-Prinzip), nie als Rückblende.

---

## 3. Protagonist: der Namenlose

Soulslike-Konvention: kein Name, keine Vorgeschichte, keine eigene Stimme. Die Welt gibt ihm Titel — die Enklaven nennen ihn **den Brachgänger** (einer, der freiwillig ins Brachland geht), abfälliger auch *den Markierten*.

- **Die Marke:** Ein VERIDIA-Implantat im Unterarm unbekannter Herkunft. Sie erlaubt, Befallene zu binden und zu stabilisieren — Technologie, die es offiziell nie für Menschen gab. NPCs reagieren auf die Marke mit Angst oder Gier; sie ist der einzige „Backstory-Anker" und zugleich das zentrale Mysterium.
- **Twist-Option (offen halten, Kapitel 3+ entscheiden):** Der Brachgänger ist selbst eine Zuchtlinie — VERIDIAs stille Antwort auf die Frage, wie Menschen im sanierten Land überleben sollten. Er heilt das Land nicht *für* die Menschen; er ist der Prototyp der Menschen, die darin leben können.
- **Erzählweise dadurch:** Story läuft komplett über NPC-Monologe, Fundstücke (Item-Beschreibungen, VERIDIA-Logs, Grabinschriften) und die sichtbare Welt. Kein Dialogbaum für den Protagonisten → massiv reduzierter Authoring-Aufwand, passt zum Ton.

---

## 4. Kreaturen-Ontologie: Alpen-Fauna × Biotech

**Eine Designregel für alles:** Jede Kreatur = heimisches Alpen-/Voralpentier × genau **ein** dominantes Biotech-Merkmal. Sofort lesbar, kohärent, Low-Poly-tauglich.

Beispiele: Steinbock mit Chitinplatten-Gehörn · Biber mit Filterkiemen-Kragen · Auerhahn mit Sporenfächer · Feuersalamander mit Leuchtmyzel-Adern · Fuchs mit Sensor-Fell · Gams mit Silikat-Hufen · Uhu mit Linsen-Facettenaugen · Wildschwein mit Wurzelpanzer.

**Drei Ursprünge:**

| Ursprung | Beschreibung | Rolle im Spiel |
|---|---|---|
| **Wildlinge** | Mutierte echte Fauna | Häufig, fangbar, Kernroster |
| **Zuchtlinien** | Reine Laborkreaturen aus VERIDIA-Anlagen; „zu perfekt": symmetrisch, seriennummeriert | Selten, stark, Story-relevant |
| **Verwachsene** | Tier + Infrastruktur verschmolzen (Marder × Trafostation, Reiher × Baukran, Dachs × Bunker) | Ruinen-Wächter, brechen Natur-Monotonie |

**Elemente (schlank, 5):** Holz · Wasser · Stein · Alt-Tech · Sporen. Klassische Effektivitätsmatrix (5×5), bewusst klein für Balancing-Hoheit.

**Zustand (Querachse zu Element):**
- **rein** — stabil, Basiswerte
- **befallen** — stärker, aber instabil: zehrt pro Kampf an sich selbst; fangbar
- **verhärtet** — Endstadium; nicht fangbar, nur besiegbar oder (mit Reinkulturen) heilbar. Geheilte Verhärtete werden zu *rein* mit Narben-Bonus — der emotionale Payoff des Fang-Systems.

**Fang-Fiktion:** Binden = Stabilisieren über die Marke. Training = kontrollierte Stabilisierung (Werte). Entwicklung = bewusst ausgelöste nächste Mutationsstufe — riskant inszeniert, mechanisch klassisch.

---

## 5. Die Regenten (Serie REGENT)

VERIDIAs Terraformer: je Region ein Schlüssel-Organismus, gebaut, um das Ökosystem zu dirigieren. Der Faulbrand zwingt sie ins Notfallprotokoll — sie „sanieren" ihre Region gegen die Menschen. Jeder Regent ist ein Bosskampf + Heilungs-Sequenz + sichtbarer Regionswandel.

| Region (real → Spielname) | Regent | Konzept | Sanierungs-Verhalten |
|---|---|---|---|
| Inntal/Mühldorf → **Œntal** | **Der Flussvater** | Riesenwels × Kläranlagen-Organik | Staut den Fluss, flutet das Tal „zur Reinigung" |
| Moorgebiete → **Fahlmoos** | **Die Brutmutter** | Kreuzotter × Inkubator | Brütet Befallene aus, überzieht das Moor mit Gelegen |
| Chiemgau → **Spiegelland** | **Der Spiegelgänger** | Hirsch × Algenpanzer | Läuft über Wasser, hält den See in Dauerblüte |
| Alpenrand → **Hochstand** | **Der Lawinenhirte** | Steinadler × Wetterturm | Hält Pässe mit Sturm und Lawinen geschlossen |
| Industrieruine → **Aschefeld** | **Der Werksleib** | Erster REGENT, halb Gebäude | Finalgebiet; Quelle des Notfallprotokolls |

Regenten sind nicht böse — sie funktionieren. Nach dem Sieg sind sie ansprechbar (Fragmente ihrer Direktiven), was den Twist schrittweise trägt.

---

## 6. Heilungs-Loop (Terra-Nil-Prinzip)

Heilung ist ein **Prozess**, kein Knopf:

1. **Besiegen** — Regent im Bosskampf niederringen (öffnet sein Protokoll).
2. **Umschreiben** — Reinkulturen einsetzen, die in der Region gesammelt/erspielt wurden: unbefallenes Saatgut, VERIDIA-Katalysatoren aus Ruinen, Wasserproben, Enklaven-Wissen. Ohne vollständigen Satz keine Heilung → Sammeln und Nebeninhalte tragen direkt zum Hauptziel bei.
3. **Wandel** — die Region kippt sichtbar (Ōkami-Moment): Licht-/Farb-/Asset-Swap, Wasser klärt sich, Enklave öffnet sich — neue Händler, Quests, Trainingsmöglichkeiten, neue reine Kreaturen-Spawns.

Heilung verändert Spielsysteme, nicht nur Kulisse (Biomutant-Falle vermeiden).

---

## 7. Fraktionen (alle ambivalent)

- **Die Enklaven** — Restmenschen hinter Filterzäunen. Wollen Sicherheit, nicht unbedingt Wahrheit. Geben Quests, Zuflucht, Vorurteile.
- **Das Erbe** — Nachfahren von VERIDIA-Personal mit Archivzugang. Liefern Werkzeuge und Reinkultur-Wissen — wollen die Symbionten aber *wieder kontrollieren*. Preisfrage: Was kostet ihre Hilfe?
- **Die Grünen Mönche** — verehren die neue Natur als Vollendung, sabotieren Heilungen. Mit dem Twist im Rücken haben sie teilweise recht — die moralische Reibungsfläche des Spiels.

---

## 8. Ton & Erzählweise

- Dunkel, still, erwachsen. Schönheit und Bedrohung im selben Bild (biolumineszente Wälder über verlassenen Höfen).
- Wortkarg: kurze NPC-Monologe, Fundstück-Fragmente, Umwelt-Erzählung. Keine Cutscene-Exposition.
- Die reale Geographie bleibt (Flussläufe, Seeformen, Bergkämme aus OSM), alle Namen sind erodierte Echos: Inn → Œn, Chiemsee → Spiegelsee, Mühldorf → Mildorf. Wiedererkennen ist Teil der Erfahrung.

---

## 9. Kapitel 1 — „Œntal" (Bogen)

Umfang: ~15 km² Kartenausschnitt (Inn-Schleife + Umland), Ziel 5–8 Std.

1. **Ankunft:** Der Brachgänger erreicht die Enklave Mildorf. Misstrauen wegen der Marke; erste Bindung eines Wildlings als Tutorial.
2. **Das steigende Wasser:** Der Flussvater staut die Œn, das Tal säuft ab. Die Enklave will ihn tot; ein Mönch warnt: „Er reinigt nur."
3. **Reinkulturen sammeln:** Drei Komponenten quer durchs Tal (Ruine, Moorrand, Altstollen) — dabei Fraktionen, Nebenkreaturen, erste Zuchtlinie.
4. **Der Flussvater:** Bosskampf im gefluteten Werk. Nach dem Sieg: Protokoll-Fragment — erster Hinweis auf den Twist.
5. **Wandel:** Das Tal fällt trocken, die Enklave öffnet sich — und ein Bote des Erbes bietet einen Handel für Kapitel 2 an.

---

## 10. Kapitel-Template (Erweiterbarkeit)

Jede neue Region liefert nach demselben Muster (Enshrouded-Prinzip: additiv, ohne Bestehendes zu ändern):

- 1 Kartenausschnitt (OSM → Pipeline)
- 1 Regent + Sanierungs-Verhalten, das die Region spielerisch prägt
- 3 Reinkultur-Fundorte (= 3 Nebenschauplätze)
- 8–12 neue Kreaturen (Regelsatz: Tier × 1 Merkmal)
- 1 Traversal-Freischaltung (Kreaturen-Fähigkeit: Klettern, Gleiten, Wasser)
- 1 Fraktions-Beat + 2–3 Fundstück-Serien
- 1 Wandel-Zustand (geheilt-Variante der Region)

---

## 11. M0 — Vertical Slice (erster Meilenstein)

Ziel: 20–30 Min spielbar, offline auf dem Handy. Kein Story-Polish — Beweis des Kernloops.

- Kartenausschnitt ~2 km² Œntal aus OSM-Pipeline (Terrain + Fluss + 1 Ruine + Enklaven-Platzhalter)
- Third-Person-Bewegung, Low-Poly-Look
- 3 Kreaturen (je 1 Wildling/Zuchtlinie/Verwachsener), 2 Elemente, Zustände rein/befallen
- Rundenbasierter Kampf (4 Moves, Effektivität, Zehrung bei Befallenen)
- Binden/Fangen + Team von 3
- Speichern lokal (IndexedDB), PWA installierbar, Flugmodus-tauglich

Tech: three.js + React Three Fiber + TypeScript · OSM-Extrakt (Geofabrik) → eigene Pipeline → Terrain/Spawn-Layer · Content vollständig datengetrieben (JSON/TS-Schemas) · Assets: Quaternius/Kenney (CC0) + eigene Merkmal-Anbauten.

---

*v1 — Diskussionsstand. Offene Punkte: finaler Titel, Twist-Option Protagonist (Kap. 3+), Namensschema-Feinschliff, Element-Matrix-Werte.*
