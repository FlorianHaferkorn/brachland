---
last-reviewed: 2026-09-17
shelf-life-days: 365
---
# ADR-0007 — Echtzeitkampf statt Runden: Soulframe als Vorlage für die Mechanik, nicht für die Gestalt

**Status:** Accepted · 2026-09-17 · löst das Rundensystem aus `docs/design/BRACHLAND_Kampfsystem_v2.md` ab · löst den Park-Punkt „Zelda-/Soulslike-Combat“ aus ADR-0004 für das Regelwerk ab (Nachtrag D196) · unverändert gültig bleiben ADR-0002 (CC0), ADR-0004 (fremdes IP), ADR-0005 (Qualitätsanspruch), ADR-0006 (Zielbild)

## Kontext

Flo am 17.09.2026: „Nochmal Soulframe als Vorlage für den Main Character und NPCs verwenden und
das Kampfsystem komplett übernehmen. Wir machen keinen Pokemon-Ableger mehr, sondern
Soulframe-Nachbau mit Realtime-Kampf. Die Story kann gleich bleiben."

Das ist keine Verfeinerung, sondern ein Wechsel des Genres. Bisher (GDD, `design/`): 1v1-Runden
mit Elementarkreis, Wechseln, Zehrung, Fangen und Mutationsstufen — ein durchgerechnetes System
mit 16 grünen Tests. Die Welt selbst ist davon **nicht** betroffen: Gelände, Bauwerke, Wege,
Bewohner, Fundstücke und Aufträge stehen und haben mit dem Kampf nichts zu tun.

## Entscheidung

### 1. Die Grenze: Mechanik ja, Gestalt nein

ADR-0004 sagt „fremdes IP tabu — eigene Kreaturen, Namen, Welt". Das gilt weiter und wird hier
**präzisiert**, weil „Soulframe als Vorlage" beides meinen kann:

- **Übernommen wird das Regelwerk.** Spielregeln sind nicht geschützt. Echtzeit-Nahkampf,
  Ausdauer als Kampfressource, Ausweichrolle mit Unverwundbarkeitsfenster, Parade und Konter,
  Zielaufschaltung, telegrafierte Gegnerangriffe mit Vorlauf und Erholung, Haltungsbruch,
  Rückgewinnungsschaden — all das darf eins zu eins nachgebaut werden, und genau das ist gemeint.
- **Nicht übernommen wird die Gestaltung.** Keine Figur, kein NPC, kein Gegner, keine Rüstung,
  kein Wappen, kein Name und keine Oberfläche wird Soulframes Entwürfen nachgebildet. Als
  **Stimmungsreferenz** — dunkle Naturfantasy, mittelalterlich, von der Natur zurückerobert — ist
  es so zulässig wie die Stilreferenz in ADR-0006 für den Look: Man misst daran, man kopiert es
  nicht.
- Die Wanderin (D126, Quaternius CC0) bleibt die Spielfigur und wird in diese Richtung
  **eigenständig** weiterentwickelt.

### 2. Was fällt, was bleibt, was fehlt

**Fällt** (rund 1.950 Zeilen Code, davon 541 getestet, plus rund 695 Zeilen Entwurf):

| | Zeilen |
|---|---|
| `src/engine/battle.ts` | 576 |
| `src/ui/BattleScreen.tsx` | 517 |
| `src/ui/Kampfbuehne.tsx` | 319 |
| `tests/battle.test.ts` | 124 |
| `tests/zustaende.test.ts` | 417 |
| `design/BRACHLAND_Kampfsystem_v2.md` + `_und_Roster_v1` + `Move-System_v1` | 597 |

**Bleibt unangetastet:** Welt, Gelände, Bauwerke, LOD, Bildtor, Geometrie-Tor, Story-Bibel,
Story-Struktur, Stilreferenz, Traversal, Fundstücke, Aufträge, Bewohner, Spielstand, Reiten,
Gleiten. `src/spieler/ausdauer.ts` bleibt und wird **aufgewertet**: Ausdauer war bisher
Traversal-Ressource, im Echtzeitkampf ist sie die zentrale Kampfressource.

**Bleibt aus dem Entwurf verwertbar:** der **Elementarkreis mit acht Elementen** und der
Elementvorteil. Er ist eine Schadensmatrix und überlebt den Wechsel des Genres unverändert; nur
Wechseln, Schutzschild, Ohnmachtskosten und Zehrung sind rundenspezifisch und fallen.

**Fehlt — und das ist der eigentliche Posten, nicht der Code:**

- Die Spielerfigur hat genau **drei Clips** (Idle/Walk/Run, `AnimationMixer`, D143). Es fehlen
  Angriff (mindestens drei Kettenglieder), Ausweichrolle, Parade, Trefferreaktion, Sturz.
- Die **14 Kreaturen haben kein Skelett.** D136 löst Atmen und Kopfwenden im Shader
  (`world/windmaterial.ts` `uRollen`), Gehen ist Positionsänderung (D138), Anstossen ist
  Kollision (D141). Für einen telegrafierten Angriff mit Trefferzone braucht es Rig und Clips.
- Es gibt **keine Trefferabfrage**. `spieler/kollision.ts` schiebt die Figur aus Hindernissen
  heraus; Waffenbögen gegen Gegnerkapseln sind etwas anderes.

### 3. Der Gegnerbestand — entschieden

Flo am 17.09.2026: „Kreaturen und Menschen werden Gegner. Menschen können aber auch NPCs werden.
Regenten sind Endbosse. Weitere Nebenbosse wären wünschenswert."

Also der volle Zuschnitt, nicht der sparsame. Damit ist die Asset-Arbeit der Hauptposten des
Vorhabens — aber sie ist **kleiner als 14 Rigs**, und das ist der Grund, warum sie zu machen ist:

**Es sind fünf Körperbaupläne, nicht vierzehn Arten.** `content/creatures/` nennt zu jeder Art ihr
Vorbild, und die fallen in wenige Gruppen:

| Bauplan | Arten | Zahl |
|---|---|---|
| Huftier | grathorn (Steinbock), nebelgams (Gams), wurzelkeiler (Wildschwein) | 3 |
| Raubtier/Nager | k7-wolf, spuerfuchs, trafomarder, kiemenbiber, alpenmurmel, firnhase | 6 |
| Vogel | linsenuhu (Uhu), schneehuhn, sporenhahn | 3 |
| Schlange | moderotter (Kreuzotter) | 1 |
| Kriechend/Molch | myzelmolch (Feuersalamander) | 1 |

Ein Rig je Bauplan, die Arten darunter unterscheiden sich in Proportion, Grösse (`widerrist`) und
Farbe — genau die drei Achsen, die das Projekt seit D125/D130/D146 ohnehin je Art fährt. Der
zweite Bauplan allein deckt sechs Arten.

**Menschengestalten kosten nichts Neues.** Der Quaternius-Rig trägt bereits elf geskinnte Figuren
(`public/figuren/`, D143/D144) mit Idle/Walk/Run. Er braucht denselben Kampfclipsatz wie die
Spielerfigur und ist damit derselbe Posten, nicht ein zweiter. Dass dieselbe Gestalt einmal
Gegner und einmal NPC ist, ist eine Zustandsfrage, keine Asset-Frage.

**Regenten sind Endbosse.** Heute existiert genau einer (`content/regenten/flussvater.json`), und
`RegionsSzene` kennt ihn bereits als eigene Gestalt (`REGENT_HOEHE`, `onRegentNah`). Endbosse und
die gewünschten Nebenbosse sind Einzelstücke mit eigenem Rig — sie skalieren nicht über einen
Bauplan und werden einzeln geplant, nicht als Menge.

**Geschätzter Umfang:** 5 Kreaturenrigs + 1 vorhandener Menschenrig, je rund sieben Clips
(Idle, Gehen, Laufen, ein bis zwei Angriffe, Treffer, Sturz) — grob **40 Clips statt der 60**,
die eine Rechnung je Art ergeben hätte, und die Bosse obendrauf.

### 4. Stufenplan — Fassade zuerst, Schnitt zuletzt

Die naheliegende Reihenfolge wäre, zuerst das Rundensystem herauszureissen. **Sie ist die
falsche**, und mit dem vollen Gegnerbestand aus Punkt 3 erst recht: Zwischen Schnitt und erstem
spielbaren Gegner hätte das Spiel **gar keinen** Kampf, und diese Strecke ist jetzt lang. Also
andersherum:

1. **Fassade.** Zielaufschaltung, Ausdauer als Kampfressource, Ausweichrolle mit
   Unverwundbarkeitsfenster, Waffenbogen gegen Kapsel — mit der vorhandenen Spielerfigur und
   einem Platzhaltergegner, **ohne ein einziges neues Asset**. Das Rundensystem bleibt in dieser
   Stufe unangetastet daneben stehen. Abnahme: ein eigenes Tor (siehe Konsequenzen).
2. **Erster echter Gegner.** Ein Bauplan — sinnvollerweise **Raubtier/Nager**, weil er sechs
   Arten trägt — mit Rig, Telegraf, Treffer- und Sturzreaktion, im Gelände. Abnahme nach
   ADR-0005 N3: angesehen, nicht nur gezählt.
3. **Menschengestalten.** Derselbe Clipsatz wie die Spielerfigur auf dem vorhandenen
   Quaternius-Rig; der Zustand entscheidet, ob eine Gestalt NPC oder Gegner ist.
4. **Schnitt.** Erst jetzt Rundensystem und seine Tests entfernen, Elementarkreis als
   Schadensmatrix retten, GDD und `design/_INDEX.md` nachziehen. Ein Commit, `make check` grün.
   Bis hierher hat das Spiel durchgehend einen Kampf — erst den alten, dann beide, dann den neuen.
5. **Bestand.** Die übrigen vier Baupläne, danach Regenten als Endbosse und die Nebenbosse.

## Konsequenzen

- **GDD und `design/` werden teilweise ungültig.** Das ist Absicht und gehört in denselben
  Commit wie der Schnitt, nicht später (QUALITY.md §6).
- **Die Messlatten aus ADR-0005/0006 bleiben unberührt.** Der Kampf ändert nichts am Bild.
- **Neue Latte nötig:** Ein Echtzeitkampf hat Zahlen, die kein Bildtor sieht — Fenster in
  Millisekunden, Reichweiten in Metern, Trefferraten. Dafür braucht es ein eigenes Tor, sonst
  gilt N6 nicht mehr („gemessen wird, was gezeichnet würde" hat kein Gegenstück für Timing).
- **Risiko, benannt und entschärft:** Der Wechsel tauscht ein fertiges, getestetes System gegen
  ein unfertiges. Die Reihenfolge in Punkt 4 hält deshalb beide Systeme eine Weile nebeneinander.
  Das kostet Code, erzeugt aber nie einen Zustand ohne Kampf — und es hält die Rückfahrt offen,
  solange der Schnitt nicht gemacht ist.
- **Was D136 kostet:** Kreaturen bewegen sich heute ohne Rig (Atmen und Kopfwenden im Shader,
  Gehen als Positionsänderung). Das war eine gute Entscheidung für eine Welt, durch die man
  läuft, und sie trägt den Kampf nicht. D136 gilt weiter für alles, was **nicht** kämpft —
  Vögel, Kleintiere, Ferngetier. Es wird also kein Rig erzwungen, wo keiner gebraucht wird.

## Was offen bleibt

- **Die Bosse sind noch kein Bestand.** Ein Regent existiert; „weitere Nebenbosse" ist ein Wunsch
  ohne Liste. Das gehört in die Story-Bibel, bevor es in die Asset-Kette geht.
- **Waffen.** Der Entwurf kennt Elemente, aber kein Waffenwerk. Ob es eine Waffe gibt, mehrere,
  oder Waffenklassen mit eigenen Fenstern, ist eine offene Designfrage, die die Zahl der Clips
  vervielfachen kann.
- **Was aus Fangen und Mutationsstufen wird.** Beides steckt in `spiel/fortschritt.ts` und
  `spiel/team.ts` und ist im Entwurf mit dem Rundensystem verwoben. Ohne Team-Mechanik braucht
  der Fortschritt eine neue Währung — das ist die nächste Designentscheidung nach dieser hier.
