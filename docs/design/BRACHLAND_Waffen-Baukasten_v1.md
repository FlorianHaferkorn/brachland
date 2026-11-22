---
last-reviewed: 2026-11-22
shelf-life-days: 180
---
# BRACHLAND — Waffen- und Ausrüstungs-Baukasten v1

> **Entwurf mit Bot-Messung (D403), nichts im Spiel verdrahtet.** Die geprüften Werte von Klinge, Axt und Speer
> (`content/waffen/`) sind unverändert und kommen als Referenzbau bitgleich aus dem Baukasten heraus (Test).
> Daten: `content/waffenteile.json`. Ableitung: `src/kampf/baukasten.ts`. Messung: `npx tsx tools/baukastensim.ts`.
> Fragen für Flo: Ledger **A-31**. Offen/erledigt steht im Ledger, nicht hier.
> **Fortgeschrieben mit D405** (unten, §11–§15): Waffenfamilien, Bogen und Armbrust, „Magie“, Zähler der Mönche.
>
> Anlass (Flo, 22.11.2026): ob jeder aus Material eigene Waffen und Ausrüstung schmieden, herstellen und gestalten
> können soll — „Das wäre doch ein innovativer Ansatz oder nicht?“ —, dazu der Nachtrag: „ja ich meinte auch ob man
> das Aussehen wirklich selbst frei designen kann und ob das sinnvoll ist“. Ausgearbeitet wird Stufe 2 (Baukasten
> Kopf × Schaft × Material × Härtung); Stufe 3 (Massarbeit) als Ausblick; das Aussehen in §7.
> Setzt fort: `BRACHLAND_Gegenstaende-und-Aufwertung_v1.md` (D393 Material und Schmiede, D400 Fortschritt). Dort
> wurde der Teile-Ansatz abgelehnt, weil jede Kombination geprüfte Kampfwerte bräuchte — hier misst der Kampfbot.

## 1. Bestand: was an einer Waffe Daten ist und was an der Animation hängt

| Was | Wo | Befund |
|---|---|---|
| Drei Waffen als Daten | `content/waffen/klinge.json`, `axt.json`, `speer.json`; Schema `WaffenSchlag` `src/data/schema.ts:1189`, `WaffenDaten` `:1198`, Kern `SchlagKern` `:1161` | je Waffe eine leichte Kette (Klinge 3, Axt 2, Speer 2 Schläge), ein schwerer, ein Laufschlag — zusammen 14 Schläge |
| Je Schlag frei setzbar | dieselben Dateien | `vorlauf`, `aktiv`, `erholung` (s), `reichweite` (m), `halbwinkelGrad`, `schaden`, `haltungsschaden`, `kosten` (Ausdauer), `nachdrehen` (rad/s), `schritt`, `rueckstoss`, `standfest`, `wirft` |
| Laden in die Regeln | `src/kampf/echtzeit.ts:169` `WAFFEN_DATEN`, `:176` `schlagAusDaten` (Grad → Radiant, Clipbild → Sekunde), `:290` `WAFFEN` | eine Waffe ist ein Eintrag in `WAFFEN`; `naechsterSchlag` (`:620`) liest daraus |
| Treffer | `echtzeit.ts:706` ff. (Bogen gegen Kapsel), `loeseTreffer` `:767` | Reichweite bis zum **Rand** der Zielkapsel, Winkel plus halber Sichtwinkel der Kapsel. Kein Raycast am Modell — die sichtbare Waffe trifft nichts |
| Clip je Schlag | `clip`, `hieb.scheitel`, `hieb.durchzug` (Clipbilder, 24/s) | Die Figur **spielt den Clip nicht ab, sie setzt die Clipzeit je Bild** (`src/scenes/RegionsSzene.tsx:4026–4031`): Vorlauf liegt auf 0 … Scheitel, Aktiv auf Scheitel … Durchzug, Erholung auf dem Rest |
| Clips und Regeln zusammenhalten | `tests/waffenclips.test.ts` | prüft, dass Scheitel und Durchzug auf Schlüsselbildern liegen und die Clips gebaut sind (`tools/waffenclips.py`, `tools/ual2uebertrag.py`) |
| Waffenmodelle | `public/figuren/kampf/waffen.glb` (79 kB), geladen `src/kampf/Kampfplatz.tsx:320`, Objekte `Klinge`, `Axt` | ein Modell je Waffe, fest |
| Schmiede | `src/spiel/schmiede.ts:16` `MAX_STUFE` 3, `:17` `JE_STUFE` 0,12, `:44` `schadenFaktor` | ein Faktor auf Schaden und Haltungsschaden der ganzen Waffe |

**Was daraus folgt — und es ist günstiger als befürchtet:**

- **Frei, weil reine Daten:** Schaden, Haltungsschaden, Ausdauerkosten, Nachdrehen, Rückstoss.
- **Frei in Grenzen:** Vorlauf und Erholung. Weil die Clipzeit je Phase gesetzt wird, dehnt oder staucht eine andere
  Dauer den Clip, statt ihn zu zerreissen. Der Hieb der Klinge läuft heute schon 1,39-fach schneller als sein Clip
  (Scheitel bei 0,25 s, Vorlauf 0,18 s). Wie viel Dehnung noch gut aussieht, ist **nicht gesehen**; gesetzt ist ±25 %.
- **Gebunden an die Form der Bewegung:** `halbwinkelGrad` und `linie` (der Clip schwingt so breit, wie er schwingt),
  `aktiv` (das Stück des Clips, in dem die Schneide durchzieht), `schritt`, und ob eine oder zwei Hände greifen.
- **Gebunden an das Modell:** `reichweite`. Sie ist eine Zahl in den Regeln, aber sie muss zur sichtbaren Länge
  passen, sonst trifft der Schlag, wo keine Waffe ist. Wer die Reichweite ändert, braucht ein anderes Modell.

Die Sorge aus D393 („jede Kombination bräuchte geprüfte Kampfwerte und Clips“) trifft also nur halb: **Clips braucht
es keine neuen, solange die Familie bleibt.** Geprüfte Werte braucht es — dafür §4.

## 2. Was andere tun

| Spiel | Wie man baut | Gelobt | Kritisiert | Für uns |
|---|---|---|---|---|
| Blades of Fire | Schmieden als Kernhandlung: Klingenform, Schaftart, Güte des Metalls wählen, dann am Amboss ausschlagen [BF1][BF2] | „makes whatever I create truly feel like mine“ [BF1]; „best forging system in gaming“ [BF2] | das Hämmern ist nicht so eingängig wie versprochen [BF3]; wiederholt sich; das Spiel insgesamt zieht sich [BF4]; gewünscht wird eine Vorlage per Knopf [BF2] | das nächste Vorbild. Übernommen: Form × Schaft × Güte. Vermieden: Minispiel bei jedem Bau; ein gebauter Entwurf bleibt als Vorlage |
| Lies of P | Klinge und Griff jeder Waffe tauschbar [LP1][LP2] | das meistgelobte Eigene des Spiels | Trefferverhalten einzelner Kombinationen | Teile-Prinzip; bei uns folgen die Werte aus Masse und Hebel statt aus einer Tabelle |
| Zelda TotK | jedes Fundstück an jede Waffe schmelzen; Aussehen = Wirkung | Erfindungsfreude; löst das Haltbarkeitsproblem des Vorgängers [TK1] | Auswahlmenü als eine lange Zeile, „massive time sink“; am Ende nimmt man immer das stärkste, häufigste Teil [TK2][TK3] (welche der beiden Quellen welchen Satz trägt, ist aus der Suchzusammenfassung nicht sicher) | Warnung: eine Bestform frisst die Vielfalt. Deshalb §4 |
| Enshrouded | **kein** Selberbauen der Form. Grosser Fertigkeitenbaum mit zwölf Richtungen (Tank, Heiler, Waldläufer …), viele Waffenarten, Edelsteinsockel [EN1][EN2] | freier Baum, Tiefe des Handwerks | Kampf „uninspiring“ [EN2]; Baum im Detail unausgewogen [EN3]; Sockel „doesn't add anything“, weil Steine nur Beute sind [EN3] | bestätigt die Antwort an Flo: nicht Breite, sondern wenige Waffen mit Tiefe. „Klassenlos“ steht in den Quellen nicht wörtlich |
| Monster Hunter, Tinkers' Construct / Vintage Story, Kenshi, Mordhau | *in dieser Recherche nicht belegt* | — | — | nichts, was sich auf eine Quelle stützen liesse |

**Was typischerweise scheitert** (belegt an TotK und Enshrouded, sonst Annahme): (1) eine Bestform, die jeder baut;
(2) Übersicht — zu viele Regler, lange Listen; (3) Bewegung und Form passen nicht zusammen; (4) Wiederholung der
Bauhandlung.

Quellen: [BF1] https://pcgamer.com/games/action/blades-of-fire-review ·
[BF2] https://gamingbolt.com/blades-of-fire-review-a-powerful-but-rugged-blade/amp ·
[BF3] https://gameluster.com/blades-of-fire-review-this-blade-does-cut/ ·
[BF4] https://www.techradar.com/gaming/blades-of-fire-review ·
[LP1] https://pcgamer.com/lies-of-p-review · [LP2] https://gamesradar.com/lies-of-p-review ·
[TK1] https://www.denofgeek.com/games/zelda-tears-of-the-kingdom-breakable-weapons ·
[TK2] https://www.digitaltrends.com/gaming/3-zelda-tears-of-the-kingdom-nitpicks/ ·
[TK3] https://kotaku.com/zelda-totk-tears-of-the-kingdom-fuse-weapons-break-1850446937 ·
[EN1] https://gamingbolt.com/enshrouded-1-0-review-finally-feels-complete ·
[EN2] https://www.gamerguides.com/enshrouded/reviews/review ·
[EN3] https://steamcommunity.com/app/1203620/discussions/0/600770015625539904 ·
[W] https://wikiwand.com/en/Arming_sword · https://thearma.org/essays/weights.htm

## 3. Entwurf Stufe 2: Kopf × Schaft × Material × Härtung

### 3.1 Die Teile

Masse in kg, Länge in m. Fett = Referenzteil (die heutige Waffe).

| Familie | Kopf / Klinge | Schaft / Griff |
|---|---|---|
| **Klinge** (Schwung) | **Gerades Blatt** 0,75 / 0,75 · Kurzes Blatt 0,60 / 0,60 · Langes Blatt 0,85 / 0,92 · Hiebblatt 0,95 / 0,72 (Wucht ×1,05) | **Einhandgriff** 0,35 · Langer Griff 0,45 (Kraft ×1,08, braucht Pose) · Schwerer Knauf 0,55 (wendig ×1,10) |
| **Axt** (Schwung) | **Spaltkopf** 1,40 · Bartaxt 0,85 (Schneide ×1,05) · Hammerkopf 1,60 (Schneide ×0,85, Wucht ×1,12) · Breitbeil 1,80 (Schneide ×1,05) | Kurzer Stiel 0,34 / 0,60 · **Stiel** 0,45 / 0,80 · Langer Stiel 0,56 / 1,00 |
| **Speer** (Stoss) | **Saufederblatt** 0,45 / 0,30 · Nadelspitze 0,25 / 0,25 (Schneide ×0,92) · Breitblatt 0,65 / 0,35 (Schneide ×1,08) | Kurzer Schaft 0,79 / 1,60 · **Schaft** 0,99 / 2,00 · Langer Schaft 1,19 / 2,40 |

| Material (ersetzt die Waffenstufe) | Güte | | Härtung | Schneide / Wucht |
|---|---|---|---|---|
| **Altstahl** | ×1,00 | | **Zäh angelassen** | ×1,00 / ×1,00 |
| Einsatzgehärtet (Chitinkohle) | ×1,12 | | Hart | ×1,04 / ×0,96 |
| Federstahl | ×1,24 | | Federnd | ×0,96 / ×1,04 |
| Härtlingsschneide | ×1,36 | | | |

4 × 3 + 4 × 3 + 3 × 3 = **33 Formen**, mal vier Güten und drei Härtungen = 396 Bauten. Die Fassung für den Kernfunken
(D188) bleibt, wie sie ist: Der Funke gehört der Marke, nicht dem Stahl.

**Anker (D398):** Ein Einhandschwert wiegt im Mittel 1,1 kg bei 90 cm Gesamtlänge und 75 cm Klinge [W] — der
Referenzbau der Klinge wiegt 1,10 kg bei 75 cm Blatt. **Axt und Speer sind Überschläge** (Esche 700 kg/m³, Stiel
Ø 3,2 cm = 0,56 kg/m, Schaft Ø 3 cm = 0,49 kg/m; Spaltkopf 1,4 kg; Saufeder um 2 m) und **nicht belegt** — so steht es
auch in den Daten (`anker`). Referenzbau Axt 1,85 kg, Speer 1,44 kg.

### 3.2 Die Formel

Jeder Bau wird als Faktor gegen den Referenzbau seiner Familie gerechnet (`src/kampf/baukasten.ts`):

| Grösse | Formel | Begründung |
|---|---|---|
| Masse M, Trägheit I um die Griffhand | Kopf und Schaft als Stäbe: m · (L²/12 + a²), a = Abstand des Schwerpunkts von der Hand | Steinerscher Satz |
| Schwungzeit T | ∝ ((I_Arm + I) / Kraft)^(1/3), I_Arm = 0,5 kg·m² | konstante Muskel**leistung** dreht Arm und Waffe: ½·I·ω² = P·t, ω ∝ 1/t ⇒ t ∝ I^(1/3) |
| Stosszeit T | ∝ ((m_Arm + M) / Kraft)^(1/3), m_Arm = 6 kg | dasselbe geradeaus |
| Energie E | ∝ Kraft · T | Leistung mal Zeit |
| **Schaden** | × E · Schneide · Güte · Härtung | Schnittarbeit folgt der Energie |
| **Haltungsschaden**, Rückstoss | × Impuls · Wucht · Güte · Härtung; Impuls ∝ √(E · I) / d (Schwung), √(E · M) (Stoss) | was den Gegner aus dem Stand bringt, ist Impuls, nicht Energie |
| **Ausdauerkosten** | × (0,7 · E + 0,3 · M) | 70 % Schlagarbeit, 30 % Tragen und Halten |
| **Vorlauf, Erholung** | × T (Speer: Vorlauf × Stosszeit, Erholung × Drehzeit) | der Stoss ist schnell, das Zurückholen eines langen Schafts nicht |
| **Nachdrehen** | × wendig / Drehzeit | |
| **Reichweite** | + (Spitze − Spitze des Referenzbaus), in Metern | ein längerer Stiel reicht um das weiter, was vor der Hand liegt |
| Aktivfenster, Bogen, Linie, Schritt, Clip | **unverändert** | hängen an der Animation (§1) |

**Abweichungen, benannt:** (1) Muskelleistung ist nicht konstant, und ein Hieb kommt aus Hüfte und Schritt, nicht nur
aus dem Arm; die Formel dämpft das mit I_Arm, mehr nicht. (2) „Schaden folgt der Energie“ gilt für Wucht besser als
für Schnitt — eine scharfe leichte Klinge schneidet real besser, als ihre Energie hergibt. (3) Schneide, Wucht, Kraft
und wendig sind **gesetzt**, nicht abgeleitet; jedes Teil, das einen davon trägt, sagt es in seinem Text. (4) Die Güte
als ×1,12 je Stufe ist der Spielwert aus D177, keine Physik (D393 §11). (5) Spielmeter: Die Klinge reicht 2,4 m bei
0,75 m Blatt, weil Arm, Schritt und Ausfall mitzählen — deshalb wird die Länge **addiert**, nicht skaliert.

**Rückwärtskompatibilität (Test `tests/baukasten.test.ts`):** Für den Referenzbau sind alle Faktoren genau 1 und der
Reichweitenzuschlag genau 0; die abgeleitete Waffe ist bitgleich mit `content/waffen/<id>.json` und mit `WAFFEN.<id>`
in den Kampfregeln.

### 3.3 Was die Physik hergibt

Über alle 33 Formen: Tempo −14 … +17 %, Reichweite −0,32 … +0,32 m, Schaden −22 … +22 %, Haltungsschaden −27 … +28 %,
Kosten −21 … +20 %. **Das ist der ganze Spielraum der Form** — die Güte allein bringt +36 %.

## 4. Bot-Messung

`npx tsx tools/baukastensim.ts 100` — Kampfbot D171, jede Form einzeln gegen Keiler, Grathorn, Wolf, Fuchs, Gams,
drei Profile (aufmerksam, müde, parierend), **100 Kämpfe je Tier und Profil = 1.500 je Form**, Saat 7000 + Kampfnummer
(jede Form dieselben Würfe), Altstahl, zäh. 22.11.2026. „Zeit“ = mittlere Dauer gewonnener Kämpfe, „gegen Ref.“ =
gegen den Referenzbau. „Schlägt“ heisst: bei Siegen, Zeit und erlittenem Schaden nirgends schlechter und irgendwo
deutlich besser (über 2 Punkte Siege, 3 % Zeit, 1 Schaden).

### Klinge (Referenz 14,8 s, 99 % Siege, 25 Schaden)

| Blatt | Griff | Tempo | Reichweite | Schaden | Haltung | Siege | Zeit gegen Ref. | erlitten | Befund |
|---|---|---|---|---|---|---|---|---|---|
| gerade | einhand | ±0 | ±0 | ±0 | ±0 | 99 % | — | 25 | Referenz |
| gerade | langgriff | −2 % | ±0 | +6 % | +5 % | 99 % | −9 % | 22 | **dominant** |
| gerade | knaufschwer | ±0 | ±0 | ±0 | ±0 | 98 % | ±0 | 25 | wirkungslos |
| kurz | einhand | −3 % | −0,15 m | −3 % | −10 % | 97 % | +11 % | 29 | **nutzlos** |
| kurz | langgriff | −5 % | −0,15 m | +2 % | −4 % | 99 % | −2 % | 24 | mittel |
| kurz | knaufschwer | −3 % | −0,15 m | −3 % | −9 % | 97 % | +14 % | 30 | **nutzlos** |
| lang | einhand | +4 % | +0,17 m | +4 % | +7 % | 100 % | −12 % | 20 | **dominant** |
| lang | langgriff | +2 % | +0,17 m | +10 % | +12 % | 100 % | −13 % | 21 | **dominant** |
| lang | knaufschwer | +4 % | +0,17 m | +4 % | +8 % | 100 % | −10 % | 21 | **dominant** |
| wuchtig | einhand | +3 % | −0,03 m | +3 % | +13 % | 97 % | +7 % | 27 | **nutzlos** |
| wuchtig | langgriff | +1 % | −0,03 m | +9 % | +17 % | 99 % | −4 % | 23 | **dominant** |
| wuchtig | knaufschwer | +3 % | −0,03 m | +3 % | +13 % | 97 % | +10 % | 28 | **nutzlos** |

### Axt (Referenz 9,4 s, 100 % Siege, 7 Schaden)

| Kopf | Stiel | Tempo | Reichweite | Schaden | Haltung | Siege | Zeit gegen Ref. | erlitten | Befund |
|---|---|---|---|---|---|---|---|---|---|
| spaltkopf | kurz | −10 % | −0,17 m | −10 % | −6 % | 100 % | +10 % | 11 | **nutzlos** |
| spaltkopf | mittel | ±0 | ±0 | ±0 | ±0 | 100 % | — | 7 | Referenz |
| spaltkopf | lang | +11 % | +0,17 m | +11 % | +6 % | 100 % | +29 % | 13 | **nutzlos** |
| bartaxt | kurz | −14 % | −0,14 m | −10 % | −27 % | 100 % | −3 % | 10 | mittel |
| bartaxt | mittel | −7 % | +0,03 m | −2 % | −23 % | 100 % | −7 % | 8 | **dominant** |
| bartaxt | lang | +1 % | +0,20 m | +7 % | −18 % | 100 % | −4 % | 7 | **dominant** |
| hammerkopf | kurz | −8 % | −0,19 m | −22 % | +13 % | 100 % | +42 % | 14 | **nutzlos** |
| hammerkopf | mittel | +2 % | −0,02 m | −13 % | +20 % | 100 % | +23 % | 9 | **nutzlos** |
| hammerkopf | lang | +14 % | +0,15 m | −3 % | +28 % | 100 % | +38 % | 13 | **nutzlos** |
| breitbeil | kurz | −7 % | −0,16 m | −2 % | +8 % | 100 % | −2 % | 8 | **dominant** |
| breitbeil | mittel | +5 % | +0,01 m | +10 % | +15 % | 100 % | +7 % | 9 | mittel |
| breitbeil | lang | +17 % | +0,18 m | +22 % | +22 % | 99 % | +34 % | 15 | **nutzlos** |

### Speer (Referenz 16,7 s, 99 % Siege, 35 Schaden)

| Blatt | Schaft | Tempo | Reichweite | Schaden | Haltung | Siege | Zeit gegen Ref. | erlitten | Befund |
|---|---|---|---|---|---|---|---|---|---|
| saufeder | kurz | −1 % | −0,27 m | −1 % | −8 % | 93 % | +21 % | 39 | **nutzlos** (müde 81 %) |
| saufeder | mittel | ±0 | ±0 | ±0 | ±0 | 99 % | — | 35 | Referenz |
| saufeder | lang | +1 % | +0,27 m | +1 % | +7 % | 99 % | −5 % | 33 | **dominant** |
| nadel | kurz | −2 % | −0,32 m | −10 % | −16 % | 91 % | +24 % | 40 | **nutzlos** (müde 80 %) |
| nadel | mittel | −1 % | −0,05 m | −9 % | −8 % | 93 % | +12 % | 38 | **nutzlos** |
| nadel | lang | ±0 | +0,22 m | −8 % | ±0 | 95 % | +8 % | 36 | **nutzlos** |
| breitblatt | kurz | ±0 | −0,22 m | +8 % | ±0 | 99 % | +2 % | 34 | mittel |
| breitblatt | mittel | +1 % | +0,05 m | +9 % | +7 % | 99 % | −6 % | 32 | **dominant** |
| breitblatt | lang | +2 % | +0,32 m | +10 % | +14 % | 99 % | −9 % | 30 | **dominant** |

### Material und Härtung (am Referenzbau)

| | Klinge Zeit | Axt Zeit | Speer Zeit |
|---|---|---|---|
| Einsatzgehärtet (×1,12) | −18 % | −7 % | −7 % |
| Federstahl (×1,24) | −27 % | −11 % | −19 % |
| Härtlingsschneide (×1,36) | −31 % | −29 % | −25 % |
| Härtung hart | −3 % | ±0 | −5 % |
| Härtung federnd | +3 % | +10 % | +9 % (müde 86 % Siege) |

### Befunde

1. **Die Form bewegt die Kampfdauer um −13 … +42 %, die Güte um −7 … −31 %.** Die Form ist also spürbar, aber die
   Güte bleibt der grössere Hebel. Die Siegquote verschiebt sich durch die Form kaum (Klinge 97–100 %, Axt 99–100 %),
   nur beim Speer deutlich (91–99 %, für den Müden 80–98 %).
2. **Ohne Budget gibt es in jeder Familie eine Bestform:** das lange Blatt, die Bartaxt, das Breitblatt am langen
   Schaft. Und es gibt tote Teile: kurzes Blatt, Hammerkopf, langer Axtstiel, Nadelspitze, kurzer Speerschaft,
   federnde Härtung. 14 von 33 Formen sind nach dieser Messung nutzlos, 11 dominant; nur 8 liegen dazwischen.
3. **Die Physik allein balanciert nicht.** Sie sagt richtig: leichter ist schneller, länger reicht weiter. Sie sagt
   nichts darüber, was der Bot daraus macht — und der Bot liebt Reichweite und Schaden und kann mit Haltungsschaden,
   Wendigkeit und Ausdauer wenig anfangen. **Der Hammer verliert, weil der Bot tötet.**
4. **Der schwere Knauf wirkt im Bot gar nicht** (±0): Nachdrehen entscheidet gegen einzelne Tiere nichts.
5. **Der lange Griff ist zu billig** (Kraft ×1,08 für 100 g): −9 % Kampfdauer ohne Preis. Er braucht ohnehin eine
   zweihändige Pose.
6. **Die Animationsbindung begrenzt den Spielraum nicht auf wenige Prozent** — Tempo ist frei (§1). Sie begrenzt die
   *Art* der Teile: nichts, was Bogen, Linie oder Griffhaltung ändert.

### Was baut der Heiler? (Stichprobe)

`npx tsx tools/baukastensim.ts 60 klinge - reinigen` — der Bot reinigt immer (D376), 900 Kämpfe je Form.

| Klinge, Referenzform | gereinigt statt getötet | Zeit |
|---|---|---|
| Altstahl | 90 % | 18,1 s |
| Einsatzgehärtet | 81 % | 16,6 s |
| Federstahl | 70 % | 15,4 s |
| Härtlingsschneide | 71 % | 14,3 s |

**Je schärfer die Klinge, desto öfter stirbt das Tier, bevor die Marke greift** (90 → 70 %): Der Schlag trägt es über
die Schwelle hinweg. Das lange Blatt reinigt 79 %, das gerade und das wuchtige 90–91 %. Bei der Axt springt der Wert
zwischen 80 und 100 % ohne erkennbare Ordnung (ein Tier von fünf kippt je nach Schadenszahl) — daraus lässt sich
nichts ablesen. Belegt ist damit nur für die Klinge: **Der Heiler will keine Härtlingsschneide.** Dass er stumpf baut
(Hammerkopf), ist naheliegend, aber **nicht gemessen**.

### Vorschlag fürs Budget

Nicht in den Daten umgesetzt — erst nach Flos Entscheidung und dann mit einer zweiten Messrunde.

| Massnahme | Wirkung, erwartet |
|---|---|
| **Ausgleichsfaktor je Kopf auf den Schaden**, aus der Messung: langes Blatt −8 %, kurzes Blatt +8 %, Bartaxt −5 % (Schneide ×1,00 statt ×1,05), Breitblatt −5 %, Nadelspitze +8 % | holt jede Form in ±5 % der Referenz-Kampfdauer; benannt als Spielausgleich, nicht als Physik |
| Langer Griff: Kraft ×1,03 statt ×1,08 | nimmt die Dominanz; die Pose bleibt Bedingung |
| Langer Axtstiel und kurzer Speerschaft: Zeitexponent prüfen (0,33 → 0,25) | der lange Hebel ist im Bot härter bestraft, als er sich anfühlen dürfte |
| **Haltungsbruch etwas wert machen**, bevor der Hammer beurteilt wird: Messung mit Reinigen und gegen Menschen (Haltungsbruch beendet den Kampf, D385) | gibt Hammerkopf, Hiebblatt und federnder Härtung einen Zweck — den des Heilers |
| Schwerer Knauf: streichen oder durch ein Teil ersetzen, das der Kampf sieht (z. B. Parierstange: Blockkosten) | ein Teil ohne Wirkung ist Verwaltung |

**Was die Messung nicht sieht:** Rudel (Bogenbreite, Standfestigkeit), Menschen, Ausdauer über lange Strecken,
Reinigen ausser der Stichprobe, und alles, was ein Mensch mit Reichweite anders macht als der Bot. Sie ist ein
Vorfilter gegen Bestformen, kein Urteil über das Spielgefühl.

## 5. Ausblick Stufe 3: Massarbeit

Drei Regler tragen physikalisch, weil sie schon in der Formel stehen:

| Regler | Grenzen | Was er bewegt | Was dafür nötig wäre |
|---|---|---|---|
| **Länge** (Blatt, Stiel, Schaft) | ±0,30 m um die Referenz | Reichweite, Trägheit, Tempo | Modell in der Länge skalierbar oder aus Profil erzeugt (§7 B) |
| **Kopfmasse** | ±30 % | Trägheit, Wucht, Kosten | sichtbar über Breite/Dicke, sonst unsichtbare Zahl |
| **Schwerpunkt** (Gegengewicht, Verjüngung) | ±5 cm | Trägheit, Wendigkeit | nichts am Clip; lesbar nur über eine Anzeige |

**Risiko:** Drei stufenlose Regler sind ein Optimierungsproblem mit genau einer Lösung je Gegner — die Bestform aus
§4, nur feiner. Stufe 3 lohnt erst, wenn Stufe 2 ein Budget hat, das hält. Bei der Animation genügt die Dehnung aus
§1, solange Tempo in ±25 % bleibt; ausserhalb braucht es eigene Clips (schweres Ausholen, kurzer Stich).

## 6. Ausrüstung („Zeug“) nach demselben Aufbau

Grundstück × Material × Futter (`content/waffenteile.json` `zeug`). **Keine Ableitung, keine Messung** — der Kampf
kennt noch kein Zeug (D393 §5.6).

| Grundstück | Gewicht | Vorteil | Nachteil |
|---|---|---|---|
| Weste (Chitinweste) | 2,0 kg | deckt Rumpf und Schultern | sitzt schwer, kostet Ausdauer-Erholung |
| Kittel (Wachstuchkittel) | 1,2 kg | knielang, im Griff weniger verwundbar | schützt nicht gegen Hiebe |
| Kutte (Flechtenkutte) | 1,5 kg | Tiere bemerken einen später | dünn; die Terrasse misstraut |
| Kluft (Werkskluft) | 1,0 kg | Leitbahnen: der Kernfunke lädt schneller | im Griff verwundbarer |

| Material | Gewicht × | Vorteil | Nachteil | | Futter | Gewicht + | Vorteil | Nachteil |
|---|---|---|---|---|---|---|---|---|
| Leinen | ×1,0 | leicht, trocknet schnell | hält keinen Biss | | ungefüttert | 0 | nichts wiegt mit | kalt über 900 m |
| Leder | ×1,5 | hält Bisse und Dornen ab | Leder braucht ein totes Tier | | Loden | 0,8 kg | warm und leise | saugt sich im Wasser voll |
| Chitinplatten auf Leder | ×2,0 | hält Hiebe ab | die Tiere riechen, woraus es ist | | Wachstuch | 0,4 kg | bleibt im Wasser leicht | raschelt |

Schwerstes Stück: Weste aus Chitinplatten mit Loden = 4,8 kg; leichtestes: Kluft aus Leinen, ungefüttert = 1,0 kg.
Zeug zählt nicht in die Traglast des Bündels (D393 §11: begrenzt ist nur loses Material). **Die Spielweise zeigt sich
am Material:** Leder und Platten gibt es nur von Getöteten; wer nie tötet, trägt Leinen, Loden, Wachs.

## 7. Aussehen selbst gestalten

Flo: „ob man das Aussehen wirklich selbst frei designen kann und ob das sinnvoll ist“.

| | (A) Auswahl | (B) Parametrisch formen | (C) Freiform |
|---|---|---|---|
| Was | Teileformen wählen (§3.1), dazu Wicklung, Schlagmarke/Kerbe, Brandmuster, Färbung, Patina | Blatt oder Kopf entsteht aus einem Profil: Länge, Breite, Krümmung, Ort, Hohlkehle, Parierform; Stiellänge, Kopfform | Umriss frei zeichnen oder modellieren |
| Machbar? | ja, mit dem Bestand: ein Modell je Teil (10 Köpfe, 9 Schäfte), Oberfläche aus dem Materialsystem | ja: Kurven als Daten, Geometrie zur Laufzeit (Extrusion mit Fase), Material und Oberfläche aus dem System | technisch ja (Umriss extrudieren) |
| Sinnvoll? | **ja** — jede Form ist gestaltet und im Stil (ADR-0018) | **ja, in engen Grenzen** — „Schmieden als Handlung“; jede Form bleibt im Stil, weil Oberfläche, Fase und Verhältnis vom System kommen | **nein** — bricht die Art Direction, Ergebnisse meist unschön, Trefferbogen und Clip passen nicht zur Form; im Einzelspieler sieht es niemand sonst |
| Physik (D398) | Masse je Teil steht in den Daten | Masse aus dem Volumen (Fläche × Dicke × 7,85 g/cm³), Schwerpunkt aus dem Profil → **das ist Stufe 3**; Grenzen als Regeln: Breite ≥ Länge / 25, Krümmung ≤ 15°, Masse im Band der Familie | keine Gewähr, dass die Form hält |
| Aufwand | **M** (Modelle S je Teil, zusammen M; UI S) | **L** (Erzeuger M, Regeln und Grenzen M, Vorschau und UI M, Prüfung am M1 offen) | **L** und danach Dauerpflege |
| Risiko | gering | Stil hält nur, wenn die Grenzen eng sind; viel Abstimmung für wenige Prozent Wirkung (§3.3) | hoch |

**Muss der Trefferbogen an die Form gekoppelt sein?** Für **eine** Grösse ja, für alle anderen nein:

- **Länge → Reichweite: gekoppelt, zwingend.** Die Regel dieses Projekts steht in `tests/waffenclips.test.ts`: Was
  trifft, bevor es ankommt, spürt man im Spiel und findet es im Bild nie. Ein Blatt, das 20 cm länger aussieht und
  gleich weit trifft, ist derselbe Fehler. In (A) ist das erfüllt, weil die Länge am Teil hängt; in (B) wird die
  Länge der eine Regler, der direkt in die Regeln greift (±0,30 m).
- **Breite, Dicke, Kopfform → Masse: gekoppelt, schwach.** Über das Volumen in Trägheit, Tempo und Wucht — wenige
  Prozent, und nur wenn Stufe 3 gebaut wird. Bis dahin: entkoppelt.
- **Krümmung, Ort, Hohlkehle, Parierform, Wicklung, Marke, Farbe, Patina: entkoppelt.** Reines Aussehen. Der Bogen
  kommt vom Clip (§1), nicht von der Schneide.

**Kleidung am Rig:** Der Schnitt hängt am Skelett — ein frei geformter Mantel bräuchte neue Gewichte für jede Form.
Dort deshalb nur (A): Material (Leinen, Leder, Platten), Färbung, Besatz, Patina; allenfalls zwei, drei Längen als
vorbereitete Varianten. Kein (B), kein (C).

**Wie wurde freies Aussehen anderswo aufgenommen?** Belegt ist Blades of Fire: Die Wahl von Form, Schaft und Metall
gilt als das Beste am Spiel, weil die Waffe sich „wie meine“ anfühlt [BF1][BF2] — kritisiert wird die Wiederholung
der Bauhandlung [BF3]. Belegt ist TotK: Aussehen folgt der Wirkung, gelobt für Erfindung, kritisiert für Menü und
Bestform [TK2][TK3]. **Für echte Freiform (zeichnen, modellieren) ist in dieser Recherche nichts belegt.**

**Empfehlung:** (A) als Ziel mit Stufe 2, darin Wicklung, Marke, Brand und Färbung als Stufe 1 (`gestalten` in den
Daten). (B) erst als Ausbau zusammen mit Stufe 3 — und zuerst nur die Länge und die Krümmung, weil sie am meisten
sichtbar sind. (C) nicht.

## 8. Was es umwirft

- **Die drei Waffenstufen werden zur Materialgüte.** Dieselben Faktoren (×1,12 je Stufe, als Test an
  `schadenFaktor` gebunden), dieselben Preise (8 Span · 14 Span + 3 Federstahl · 22 Span + 4 Federstahl +
  3 Härtlinge, D393 §3). „Drei Verhärtete für die beste Schneide“ bleibt.
- **Dazu kommen Teilpreise:** Kopf 1–2 Federstahl, Schaft 1–2 Chitinspan (Bindung, Keil, Wicklung — der Schaft selbst
  ist Holz aus dem Wald). Ein Umbau kostet im Mittel 2 Span + 2 Federstahl (`content/oekonomie.json` `baukasten`).
- **„Material nur von Getöteten“ bleibt** (D379). Die Waffe zeigt damit ihren Träger: Der Schlächter führt die
  Härtlingsschneide; der Heiler Altstahl oder Einsatzhärtung — und nach §4 *will* er nichts Schärferes.

`npx tsx tools/oekonomiesim.ts`, Œntal, mit einem Umbau der Hauptwaffe vor dem Aufhärten:

| | Schlächter | Gemischt | Heiler | Umgeher |
|---|---|---|---|---|
| Chitinspan / Federstahl / Härtling | 52 / 10 / 11 | 36 / 8 / 8 | 10 / 6 / 0 | 6 / 3 / 0 |
| Umbau bezahlt | ja | ja | ja | ja |
| Güte Hauptwaffe / zweite | 3 / **0** (vorher 3 / 1) | 2 / 1 | 1 / 0 | 0 / 0 |

Der Umbau kostet den Schlächter die erste Stufe der Zweitwaffe; der Heiler kommt mit 10 Span genau auf Umbau und
Einsatzhärtung (2 + 8). Die Reihenfolge der Spielweisen und der Dominanztest (D400) bleiben.

## 9. Aufwand und Reihenfolge

| # | Schritt | Grösse | Vor dem ersten Fremdtest? |
|---|---|---|---|
| 1 | Budget nach §4 setzen, zweite Messrunde, dazu Rudel, Menschen, Reinigen | S | **ja** — ohne das ist alles Weitere auf Sand |
| 2 | Waffe im Spielstand als Bau statt als Stufe; `WAFFEN` aus dem Bau ableiten | M | nein |
| 3 | Modelle: 10 Köpfe, 9 Schäfte, im Rig an Kopf- und Griffpunkt zusammengesetzt | M | nein |
| 4 | Schmiede-Fenster nach Menü v1 (Rahmen „Aufwertung“): links die Waffe, vier Plätze, rechts Vorher/Nachher als Zahlen; ein gebauter Entwurf bleibt als Vorlage | M | nein |
| 5 | Pose für den langen Griff; Sichtprüfung der Clip-Dehnung ±25 % am M1 | S–M | nein |
| 6 | Stufe 1 Gestalten (Wicklung, Marke, Brand, Färbung) | S | nein |
| 7 | Zeug: Wirkung im Kampf, dann Material × Futter | L | nein |
| 8 | Stufe 3 / Aussehen (B) | L | nein |

**Für den ersten Fremdtest sinnvoll ist nur Schritt 1** — und die Frage, ob die drei festen Waffen mit Güte nicht
genügen. Die Messung sagt: Die Form ändert die Kampfdauer um ein Zehntel bis ein Drittel, die Siegquote kaum. Das ist
genug, um sich eine eigene Waffe zu wünschen, und zu wenig, um den ersten Test darauf zu bauen.

## 10. Unklar

- ⚠️ Gewichte von Axt und Speer und alle Stiel- und Schaftmasse sind Überschläge ohne Quelle.
- ⚠️ I_Arm (0,5 kg·m²), m_Arm (6 kg), der Exponent 1/3 und die Aufteilung 70/30 der Ausdauerkosten sind gesetzt.
- ⚠️ Ob eine Clip-Dehnung von ±25 % gut aussieht, hat niemand gesehen. Nicht am M1.
- ⚠️ Die Messung ist Bot gegen einzelne Tiere im Tötungsmodus; Rudel, Menschen und Ausdauer fehlen. Die
  Reinigen-Stichprobe (60 Kämpfe je Tier und Profil) trägt nur die Aussage zur Klinge.
- ⚠️ Der Budgetvorschlag ist aus einer Messrunde abgelesen und nicht gegengemessen.
- ⚠️ Zeug: nichts abgeleitet, nichts gemessen.
- ⚠️ Monster Hunter, Tinkers' Construct, Vintage Story, Kenshi, Mordhau und jede echte Freiform sind nicht belegt.

---

# Fortschreibung D405: Waffenfamilien, Fernkampf, „Magie“, Zähler

> **Entwurf, nichts verdrahtet — mit einer Ausnahme:** `eingriffe()` in `src/spiel/wanderfiguren.ts` liest seit D405
> die Gewichte des Zählers aus den Daten (§14). Sonst: `content/waffenfamilien.json` (Plan, keine Kampfwerte),
> `content/wirken.json`, ADR-0019 (**Proposed**). Fragen für Flo: Ledger **A-32**.
> Entschieden und nicht neu aufgerollt (D404): 6–8 Familien gestaffelt, Kapitel 1 mit etwa fünf; Ausgleichsfaktor je
> Teil; Schärfe senkt die Reinigungsquote und wird ausgesprochen; Aussehen erst auswählen; Bogen und Armbrust gewollt;
> Reinigen zählt beim Zähler deutlich weniger als Töten.

## 11. Waffenfamilien

### 11.1 Wie andere Vielfalt schaffen

| Spiel | Wie | Gelobt | Kritisiert | Für uns |
|---|---|---|---|---|
| Elden Ring / Dark Souls | viele Waffenklassen, je Klasse ein gemeinsamer Satz Schläge, dazu Skalierung und Sonderangriff | Breite; für jeden Stil etwas | viele Waffen tragen nicht durchs ganze Spiel [ER6]; Bögen gelten als schwache Hauptwaffe, gut nur als Ergänzung [ER7] — eine Besprechung des Ablegers nennt ihn „the first FromSoftware game where bows don't suck“ [ER8]. *Dass gleiche Schlagsätze die Vielfalt entwerten, ist in dieser Recherche nicht belegt* | Familie = eigener Schlagsatz; Vielfalt **innerhalb** kommt aus dem Baukasten, nicht aus weiteren Familien |
| Bloodborne | wenige Waffen, jede anders, jede mit zwei Formen | „each weapon feels different, vital, hand-crafted“ [B1] | weniger Auswahl [B5] | die Messlatte: lieber acht Familien, die sich anders spielen, als dreissig, die sich gleichen |
| Sekiro | eine Waffe, dazu Werkzeuge am Arm mit knappem Vorrat [S3] | Tiefe statt Breite | Werkzeuge über einen Verbrauchsvorrat [S3] | Vorbild für das Wirken der Marke (§13), nicht für die Waffen |
| Lies of P | Klinge × Griff [LP1][LP2] | siehe §2 | — | Baukasten |
| Nioh | *nicht belegt* | — | — | — |

Neue Quellen: [ER6] https://www.gamedeveloper.com/game-platforms/the-cracks-in-elden-ring-s-combat-design ·
[ER7] https://mobalytics.gg/gamebase/guides/elden-ring-bow-build ·
[ER8] https://gamesradar.com/games/action-rpg/new-elden-ring-nightreign-trailer-is-all-about-the-archer-class-that-wasnt-in-the-beta-and-this-might-be-the-first-fromsoftware-game-where-bows-dont-suck ·
[B1] https://kotaku.com/bloodbornes-biggest-problems-have-been-fixed-1749281059 ·
[B5] https://fextralife.com/bloodborne-the-best-rpg-of-its-generation ·
[S3] https://www.gamedeveloper.com/design/how-i-broke-sekiro-shadows-die-twice

### 11.2 Acht Familien für BRACHLAND

Aus der Welt: Forst, Jagd, Steinbruch, Hof, Werk. Keine fremden Motive (ADR-0004) — jede Waffe ist ein Werkzeug, das
im Inntal real herumliegt. Daten: `content/waffenfamilien.json`. **Für die fünf neuen gibt es keine Kampfwerte** —
die entstehen erst mit der Messung.

| # | Familie | Kapitel | Spielgefühl | Was sie trennt | Verhältnis zum Reinigen | Aufwand |
|---|---|---|---|---|---|---|
| 1 | **Klinge** (Bestand) | 1 | schnell angesetzt, lang erholt | drei Linien, höchster Schaden je Sekunde | mit Güte sinkt die Reinigungsquote (D403) | — |
| 2 | **Axt** (Bestand) | 1 | langer Vorlauf, der durchgeht | standfest, wirft, bricht Haltung | öffnet Griff-Fenster, tötet Kleines mit einem Hieb | — |
| 3 | **Saufeder** (Bestand) | 1 | Abstand statt Wucht | 3,1–4,0 m, schmal, weiter Rückstoss | hält auf Abstand — die Marke braucht Nähe | — |
| 4 | **Hirschfänger** | 1 | nah und schnell | kürzeste Reichweite und Fenster, wenig Schaden je Treffer | **Waffe des Heilers:** bringt an die Schwelle, ohne darüber zu tragen | **S** |
| 5 | **Schlägel** | 1 | stumpf und schwer | zweihändig, höchster Haltungsschaden, niedrigster Schaden | bricht die Haltung, ohne zu töten; gegen Menschen endet der Kampf so (D385) | **M** |
| 6 | **Bogen und Armbrust** | 1 (Bogen), später (Armbrust) | der erste Treffer gehört dir | einzige Familie auf Distanz (§12) | schwächt, reinigt nie | **L** |
| 7 | **Sapie** | 2 | Haken an der Stange | zieht heran und aus der Haltung | schliesst als einzige Waffe den Abstand für die Marke | **M** |
| 8 | **Langes Messer** | 2 | zwei Hände, weiter Bogen | breiteste Bögen, die Antwort aufs Rudel | schlecht: trifft auch, was man schonen wollte | **L** |

**Zurückgestellt, mit Grund:** **Kriegsflegel** — ein Dreschflegel ist real schwer zu führen und gefährdet den
Träger; gemeint wäre die Kriegsform mit Beschlag, sie braucht ein Gelenk im Modell, einen ganzen Clipsatz und eine
neue Regel („umgeht Block“): Aufwand L für eine Nische. **Kriegssense** — eine Mähsense ist real eine schlechte
Waffe (Schneide quer zum Stiel, nach innen); nur die umgeschmiedete Kriegssense taugt, und die deckt sich im Spiel
mit Saufeder und Sapie.

### 11.3 Clips: was da ist, was fehlt (nachgesehen)

| Quelle | Was sie hergibt | Stand |
|---|---|---|
| `tools/ual2uebertrag.py` (UAL2, Quaternius, CC0, freie Fassung) | sieben Clips übertragen: `Sword_Regular_A/B/C`, `Sword_Dash`, `Sword_Block`, `Hit_Knockback`, `Idle_Shield_Break` | Klinge |
| `tools/waffenclips.py` (selbst gebaut, Schlüsselbilder) | 13 Clips: `Klinge_Stand`, `Klinge_Stich`, `Axt_Stand/Block/Quer/Schwer/Lauf`, `Speer_Stand/Stoss/Weit/Lauf/Block` | Axt und Speer komplett eigen |
| Paket der Figur | `Sword_Slash`, `Axe_Overhead` | Bestand |

- **Die UAL2-Datei liegt auf dieser Maschine nicht** (`.cache/ual2/` fehlt). Welche weiteren Clips ihre freie Fassung
  enthält — Bogen, Zweihand, Hammer —, liess sich deshalb **nicht nachsehen**. Belegt ist nur: rund 130 Animationen,
  darunter „melee and armed combos“, die freie Fassung umfasst etwa 70 % [UAL]. Vor dem Bau am M1 nachsehen.
- **Der sichere Weg ist der, den Axt und Speer gegangen sind:** Clips aus Schlüsselbildern in `waffenclips.py`.
  Der Speer brauchte fünf (D184).

| Familie | Vorhandene Clips nutzbar | Fehlen |
|---|---|---|
| Hirschfänger | alle sieben der Klinge (einhändig, kürzere Reichweite) | **keine** — nur ein Modell |
| Schlägel | `Axt_Stand`, `Axe_Overhead`, `Axt_Schwer`, `Axt_Block` | 2: zweihändiger Stand, tiefer Querschlag |
| Sapie | `Speer_Stand`, `Speer_Block` | 3: Hieb über Kopf, Zug, Lauf |
| Langes Messer | `Klinge_U_C` (Zweihandhieb) | 5: Stand, zwei Querhiebe, Lauf, Block |
| Bogen und Armbrust | keine | 6: je Stand/Anlegen, Spannen/Laden, Lösen/Schuss |

[UAL] https://quaternius.itch.io/universal-animation-library-2 · https://80.lv/articles/get-this-animation-asset-library-with-over-130-diverse-items

### 11.4 Physik (D398)

| Familie | Real | Anker | Abweichung |
|---|---|---|---|
| Hirschfänger | jagdliche Seitenwaffe, Klinge 40–70 cm | 0,6–0,8 kg — **Überschlag** | keine |
| Schlägel | Vorschlaghammer real 3–5 kg, zum Kämpfen zu träge | 2–3 kg — **Überschlag** | gemeint ist ein leichter Schlägel am langen Stiel; benannt |
| Sapie | Forstwerkzeug zum Ziehen und Wenden von Stämmen, 1,2–1,6 m, kopflastig | 1,5–2,5 kg — **Überschlag** | keine: Sie bleibt, was sie ist — langsam, zieht |
| Langes Messer | zweihändiges Kriegsmesser, süddeutsch | 1,2–1,8 kg, 1,1–1,3 m — **Überschlag** | keine |
| Bogen | Jagdbogen 20–25 kg Zuggewicht, Pfeil um 30 g, 50–60 m/s | **Überschlag** | Spannen 0,9 s statt 1–2 s |
| Armbrust | Spannen mit Hebel 15–20 s, mit Winde 30–60 s | **Überschlag** | **6 s im Spiel** — grösste Abweichung, benannt |

Belegt ist in diesem Dokument nur das Einhandschwert (§3.1). Alle neuen Anker sind Allgemeinwissen ohne Quelle.

### 11.5 Staffelung und Reihenfolge

Kapitel 1: **Klinge, Axt, Saufeder, Hirschfänger, Schlägel** — dazu der Bogen als sechste, wenn ADR-0019 angenommen
wird. Reihenfolge nach Aufwand und Nutzen:

1. **Hirschfänger** (S): kein Clip, ein Modell, eigene Fenster, eine Messrunde. Und er löst das Problem aus D403:
   Der Heiler bekommt eine Waffe, die für ihn gebaut ist.
2. **Schlägel** (M): zwei Clips, Messung mit Reinigen und gegen Menschen — dieselbe Messung, die D404 für das Budget
   ohnehin verlangt.
3. **Bogen** (L): braucht Regeln (ADR-0019), sechs Clips, Zielen, KI-Reaktion.
4. Kapitel 2: **Sapie** (M, neue Wirkung „zieht heran“), **Langes Messer** (L, fünf Clips, Rudelmessung), **Armbrust**.

## 12. Bogen und Armbrust

Entwurf zu ADR-0019 (Proposed). Zahlen in `content/waffenfamilien.json` `fernkampf` sind **ungeprüft**.

1. **Zielen.** Halten (rechte Maustaste) schaltet auf die Schulterkamera, die es für die Zielaufschaltung schon gibt
   (Versatz 0,85 m, `src/kampf/sichtlinie.ts`); die Maus ist im Kampf bereits gefangen (Pointer Lock,
   `src/kampf/Kampfplatz.tsx`). Aufgeschaltet zielt der Schuss auf die Kapselmitte, frei dorthin, wohin man sieht.
   Kein Kopftreffer, kein Schadensbonus für Distanz.
2. **Spannen und Laden mit Gewicht.** Bogen: 0,9 s bis schussbereit, gespannt halten zehrt 14 Ausdauer je Sekunde
   (20–25 kg Zuggewicht hält niemand lange). Armbrust: 6 s laden, bleibt dann geladen, ein Schuss. **Beides nur im
   Stand** — wer sich bewegt, entspannt. Das ist die Regel, die Rückwärtslaufen-und-Schiessen verhindert.
3. **Munition ist Material.** Jagdpfeil (Spitze aus Federstahl, 12 tragbar, jeder zweite wiederzufinden), Bolzen
   (6 tragbar), **Kolbenpfeil** (stumpfer Holzkopf, wie man ihn real für Vögel schnitzt: 30 % Schaden, 2,2-facher
   Haltungsschaden, kostet nur Span) — die Munition des Heilers.
4. **Die Tiere antworten.** Ein Pfeil trifft wie ein leichter Hieb der Klinge (24), ein Bolzen wie ein schwerer (46).
   Ein Keiler hat 140 Leben und überbrückt acht Meter in rund drei Sekunden: Das sind ein bis zwei Schüsse, dann
   Nahkampf. Beschossene Befallene gehen an; scheue reine Tiere fliehen — und was ausser Sicht flieht, ist fort,
   ohne Material und ohne Reinigung.
5. **Verhältnis zum Reinigen.** Die Marke greift in 1,8 m. Ein Geschoss kann ein Tier wund machen (unter 35 %),
   **nie reinigen**. Aus der Ferne getötet zählt beim Zähler voll. Der Bogen eröffnet also; beenden muss man selbst.

**Was Engine und Regelwerk brauchen:** Geschoss als Daten (Abgangstempo, Fall, Radius, Wirkung), Flug in denselben
Teilschritten gegen die Kapseln der Kämpfer, Sicht gegen das Kollisionsfeld (`sichtFrei`, schon rein und getestet),
Zustand „gespannt“ am Kämpfer, KI-Reaktion „beschossen“ (angehen oder fliehen). `echtzeit.ts` bleibt renderfrei.
**Bot-Messbedarf:** ein Fernprofil für den Kampfbot — wie viele Schüsse vor dem Kontakt, Kampfdauer und erlittener
Schaden gegen Nahkampf allein, Anteil geflohener Tiere, Reinigungsquote mit Kolbenpfeil.

**Risiken:** (1) Töten wird bequem — dagegen stehen Stand-Regel, knappe Munition, der Zähler und dass Fliehende
verloren sind. (2) Die Gams ist heute das schwierigste Tier (Reinigen v1 §6); ein Bogen könnte genau dieses Problem
wegnehmen statt es zu lösen. (3) Sechs Clips, Zielkamera, Geschossregeln: der grösste Posten der Liste. (4) Gegner,
die schiessen, sind eine eigene Aufgabe und hier nicht entworfen.

## 13. „Gibt es sowas wie Magie?“

> **Abgelöst durch D409/D410** (unten, §16–§23): Flo will keine Marken-Fähigkeiten als Magie, sondern Geräte mit
> Elementangriffen. Der Abschnitt bleibt als Beleg stehen; von den sieben Wirken gelten nur noch Lesen und Rufen.

**Antwort: Nein — und es sollte keine geben. Aber es gibt die Marke, und sie kann mehr als reinigen.**

Die Welt hat keine Magie und braucht keine: VERIDIA ist ein Betrieb, der Faulbrand ein Protokoll, die Marke eine
Armklammer Typ B aus dem Werk, elf ausgegeben, zehn zurück (Quests v1). Was wie Zauber aussähe, ist hier Technik,
deren Bedienungsanleitung fehlt.

| | (a) **Wirken der Marke** | (b) Befallskräfte der Fraktionen | (c) Klassische Zauber |
|---|---|---|---|
| Was | wenige Funktionen der Klammer; jede kostet **Ladungen** — dieselben, die das Reinigen braucht | vom Befall Geliehenes (Mönche), mit Preis am Körper | Zauber mit eigener Leiste |
| Passt zur Welt | **ja** — erklärt aus dem Werk; jedes Wirken hat einen Namen im Wartungsblatt | ja, erzählerisch stark; macht den Twist (der Brachgänger als Prototyp) früh sichtbar | **nein** — widerspricht „Technik, kein Zauber“ und ADR-0004 (fremde Motive) |
| Gleichgewicht | bindet sich selbst: Wer wirkt, reinigt weniger | eine dritte Ressource; berührt die drei Enden | zweite Kampfart neben dem Nahkampf, zweite Leiste, neue Messreihen |
| Aufwand | **M** — sieben Einträge, zwei davon ohne Kampfwert | **L** — Figuren, Folgen, Körperveränderung | **L** und dauerhaft |
| Andere | Werkzeuge am Arm mit knappem Vorrat [S3]; kritisiert wird dort der Verbrauchsvorrat — besser ein Vorrat, der sich an der Rast füllt [S3] | *nicht belegt* | Zauber und Anrufungen (Elden Ring), Zauber aus gesammelter Kraft (Hollow Knight), Jägerwerkzeuge (Bloodborne): *in dieser Recherche nicht belegt* |

**Empfehlung: (a).** Alternative: (a) jetzt und (b) als Linie der Mönche ab Region 2 — dann als Erzählung mit Preis,
nicht als Fähigkeitenbaum.

### Sieben Wirken (`content/wirken.json`)

| Wirken | Ladungen | ab Markenstufe | Einsicht | Was es tut | Im Werk hiess es | Berührt |
|---|---|---|---|---|---|---|
| **Lesen** | 1 | 0 | 1 | 20 s lang zeigt sich jeder Befallene in 40 m durch Gelände, mit Zustand | Feldabgleich | Anzeige |
| **Rufen** | 1 | 1 | 1 | ein gereinigtes Tier des Reviers kommt; mit Halfter das Reittier | Rückruf | Welt |
| **Stillen** | 1 | 1 | 2 | ein Befallener in 6 m hält 3 s inne, wenn er nicht gerade ausholt | Ruhigstellen vor dem Eingriff | **Kampfwert** |
| **Stoss** | 1 | 2 | 2 | wirft Befallene in 2,5 m drei Meter zurück, nimmt Haltung, kein Schaden | Abstandsimpuls | **Kampfwert** |
| **Binden** | 2 | 2 | 3 | ein gegriffenes Tier bleibt 2 s länger am Boden | Haltestrom verlängern | **Kampfwert** |
| **Schirm** | 2 | 3 | 3 | 4 s lang macht der Griff nicht verwundbarer | Eigenschutz des Trägers | **Kampfwert** |
| **Nachhall** | 3 | 4 | 3 | reinigt ein wundes gewöhnliches Tier aus 6 m, ohne Griff | Fernabgleich, „nicht freigegeben“ | **Kampfwert** |

Zusammen 15 Einsicht; mit den Techniken (22) sind es 37 gegen höchstens 13 je Kapitel. Zwei Wirken (Lesen, Rufen)
berühren keinen geprüften Wert; fünf brauchen eine Messung, die in den Daten steht. **Nachhall ist das riskanteste
Stück:** Er hebt die Regel „Reinigen braucht Nähe“ auf — nur vertretbar als letzte Stufe, zu dreifachem Preis.
Kein Wirken macht Schaden.

### In der Rechnung der vier Spielweisen

Angenommen (gesetzt, nicht gemessen): Der Schlächter gibt die Hälfte seiner Ladungen fürs Wirken aus (er reinigt ja
nicht), der Umgeher 40 % (Lesen, Rufen, Stillen), Gemischt und Heiler 15 %.

| | Schlächter | Gemischt | Heiler | Umgeher |
|---|---|---|---|---|
| Ladungen ins Wirken | 50 | 17 | 27 | 38 |
| Tiere gereinigt (vorher) | 0 | 90 (104) | 138 (171) | 32 (33) |
| Läuterung → Markenstufe (vorher) | 25 → 1 | 145 → 3 (154) | 203 → 4 (236) | 67 → 2 |

**Das Wirken gibt dem Schlächter zum ersten Mal einen Grund, die Marke zu benutzen** — und es kostet den Heiler ein
Fünftel seiner Reinigungen. Die Markenstufen bleiben, wo sie waren.

## 14. Der Zähler der Mönche: Reinigen wiegt ein Viertel

**Umgesetzt** (die eine erlaubte Änderung an Spiellogik): Die Gewichte stehen als Daten an der Station des Zählers,
`content/wanderfiguren/zaehler.json` → `bis: { art: "eingriffe", anzahl: 40, gewichte: { getoetet: 1, gereinigt: 0.25 } }`
(Schema `Stationsbedingung`). `eingriffe(w, gewichte)` in `src/spiel/wanderfiguren.ts` rechnet damit; ohne Gewichte
zählt beides voll wie vor D405. Ein Vorkommen zählt einmal — erst gereinigt, dann getötet zählt als getötet.

| | Schlächter | Gemischt | Heiler | Umgeher |
|---|---|---|---|---|
| Eingriffe ungewichtet (vor D405) | 291 | 291 | 143 | 33 |
| **Stand beim Zähler (gewichtet)** | **291** | **221** | **36** | **8** |
| Unter der Schwelle 40 | nein | nein | **ja** | ja |

**Befund, und er ist nicht harmlos:** Mit dem Viertel bleibt bei Schwelle 40 auch der **Heiler** unter dem Zähler
(36). Damit hat er alles, was der Umgeher hat, und mehr — der Umgeher verliert sein einziges Eigenes und wird auf
allen sechs Achsen geschlagen (1 / 4 / +10 / +10 / 11 / ja gegen 0 / 2 / +5 / +5 / 7 / ja). Der dritte Spielstil
(D385) wäre damit nur noch ein schwächerer Heiler.

| Schwelle | darunter bleiben | Wer trennt sich |
|---|---|---|
| 30 | nur der Umgeher (8) | Heiler (36) und Umgeher wieder getrennt; kein Stil schlägt einen anderen auf allen Achsen (Test) |
| **40 (heute)** | Heiler (36), Umgeher (8) | Heiler schlägt Umgeher |
| 50–60 | Heiler, Umgeher | dasselbe |

**Vorschlag: Schwelle 30.** Dann darf man rund 120 Tiere reinigen oder 30 töten, bevor die Mönche sich abwenden: Der
gründliche Heiler (138) verliert sie knapp, ein zurückhaltender behält sie. Der Heiler liegt bei 36 nur sechs
Punkte darüber — die Zahl hängt an der Annahme, wie viel er wirkt (ohne Wirken: 44). **Die Schwelle in den Daten ist
nicht geändert**; das ist Flos Entscheidung (A-32). Der Test hält fest, was bei 40 und was bei 30 gilt.

## 15. Unklar (D405)

- ⚠️ Kein Kampfwert für Hirschfänger, Schlägel, Sapie, Langes Messer, Bogen, Armbrust; die Fernkampf-Zahlen sind
  gesetzt und ungemessen.
- ⚠️ Die UAL2-Datei war nicht einsehbar; welche Clips die freie Bibliothek für Zweihand, Hammer oder Bogen hergibt,
  ist offen.
- ⚠️ Alle neuen Gewichtsanker sind Überschläge ohne Quelle.
- ⚠️ Der Anteil der Ladungen, der ins Wirken geht (50 / 15 / 15 / 40 %), ist gesetzt.
- ⚠️ Recherche zu Magie in anderen Spielen: bis auf Sekiro nicht belegt.
- ⚠️ Die von D404 verlangte Nachmessung „Haltungsbruch mit Reinigen und gegen Menschen“ ist **nicht** Teil dieser
  Arbeit; sie ist Schritt 1 in §9 und Voraussetzung für Schlägel und Budget.

---

# Fortschreibung D410: Geräte mit Elementangriffen statt Magie

> **Entwurf, nichts verdrahtet, kein Kampfwert geändert.** Löst §13 („Wirken der Marke“ als Magie-Ersatz) ab.
> Flo, 22.11.2026 (D409): „Magie ersetzen durch tools die Elementattacken ausführen können was dann wie Magie ist.
> Ähnlich wie bei Elden Ring mit Siegeln“. Daten: `content/geraete.json`, vier Betriebsstoffe in
> `content/gegenstaende/`, `content/wirken.json` (fünf Einträge als ersetzt markiert). Regeln:
> `src/kampf/geraete.ts`. Fragen für Flo: Ledger **A-35**. Seit D406 gilt: Fernkampf erst nach Kapitel 1; Kapitel 1 =
> Klinge, Axt, Saufeder, Hirschfänger, Langes Messer; Befallskräfte geparkt.
>
> **Entschieden (Flo, 22.11.2026, „ja“, D411; nachgezogen D412):** alle fünf Empfehlungen aus A-35 gelten — vier Geräte
> in Kapitel 1 (Abflammgerät, Kohlensäurelöscher, Weidezaungerät, Räucherkanne), die **Räucherkanne als erste Probe**
> vor dem Fremdtest; Kalkstreuer Kapitel 2; Sporenbalg geparkt; **Betriebsstoff je Gerät**; **Rauch beruhigt den
> Befall** als Setzung über die Welt (Story-Bibel v2 §2); die Marke behält nur **Orten und Rufen**; Brand im Gelände
> als Regel, als gebaute Mechanik erst nach Kapitel 1. Unten sind die Stellen markiert; ersetzter Wortlaut ist
> durchgestrichen. Kein Wirkwert ist gemessen, nichts gebaut.

## 16. Bestand: das Elementsystem

| Was | Wo | Befund |
|---|---|---|
| Acht Elemente | `src/data/schema.ts:13` `ELEMENTE` | holz, stein, alt-tech, sporen, wasser, brand, frost, faeulnis — in dieser Reihenfolge |
| Der Kreis | `schema.ts:24` `effektivitaet` | Zirkulant: Element i schlägt i+1 und i+2 (×2,0), wird von i−1 und i−2 geschlagen (×0,5), sonst ×1,0. Erzeugt, nicht gepflegt: jedes Element zwei Stärken, zwei Schwächen, drei neutral (Selbsttest in `tools/validate.ts`) |
| Doppeltyp | `schema.ts:35` `schadensfaktor` | Faktoren multiplizieren sich: 4 / 2 / 1 / 0,5 / 0,25 |
| Rundenkampf | `src/engine/battle.ts:245`, Moves, Kreaturen, Regenten (`content/moves/`, `creatures/`, `regenten/`) | voll genutzt — dafür wurde der Kreis gebaut. Der Flussvater wechselt wasser → faeulnis → alt-tech + stein |
| **Echtzeitkampf** | `src/kampf/echtzeit.ts:113` `KampfWerte.elemente`, `content/gegner/*.json` Zeile 3 | **kennt Elemente der Tiere:** Keiler holz, Grathorn und Gams stein, Fuchs alt-tech, Wolf alt-tech + frost. Menschen haben keins |
| Kernfunke | `echtzeit.ts:230` (`Element = 'wasser' \| 'stein'`), `:244` `funkenFaktor`, Entladung `:782–827` | **Das Vorbild im eigenen Haus:** Der schwere Schlag mit voller Ladung trägt ein Element; der Kreis gilt **gedämpft mit der Wurzel** (×1,41 / ×1 / ×0,71), weil er ein Zuschlag ist, kein Ersatz für den Hieb (D189). Bisher nur Wasser (Flutstoss) umgesetzt |

Der Kreis in Worten: holz › stein, alt-tech · stein › alt-tech, sporen · alt-tech › sporen, wasser · sporen › wasser,
brand · wasser › brand, frost · brand › frost, faeulnis · frost › faeulnis, holz · faeulnis › holz, stein.

**Folge:** Die Geräte brauchen kein neues System. Sie tragen ein Element aus `ELEMENTE` und rechnen wie der Kernfunke
(`elementFaktor` in `src/kampf/geraete.ts` ist dieselbe Wurzel; als Test gegen `funkenFaktor` gebunden).

## 17. Wie das Vorbild funktioniert

| Spiel | Handwerk | Gelobt | Kritisiert | Für uns |
|---|---|---|---|---|
| Elden Ring | Ein **Katalysator** in der Hand (Stab oder Siegel) ist Bedingung; die Zauber selbst werden an der Rast in eine begrenzte Zahl Plätze gelegt (zwei zu Beginn, bis zwölf), manche kosten mehrere; jeder Einsatz kostet aus einer Leiste; die Stärke kommt vom Katalysator und von Werten [EM1][EM2] | Trennung von Träger und Ladung: Ein besserer Katalysator hebt alles, was man hat | „some abilities are somewhat overpowered“ [EM3]; *dass Fernzauber Bosse trivialisieren, ist in dieser Recherche nicht belegt* | Gerät = Katalysator, Aufsatz = Ladung, gewechselt an der Rast. **Keine** Fernwirkung, **keine** Skalierung über Werte |
| Sekiro | Werkzeuge am Arm, gespeist aus einem Verbrauchsvorrat [S3] | Werkzeuge öffnen Fenster, statt den Kampf zu ersetzen | der Verbrauchsvorrat; besser ein Vorrat je Rast [S3] | Geräte öffnen Fenster (Griff, Haltung); Betriebsstoff füllt sich beim Tausch, nicht beim Töten |
| Bloodborne (Jägerwerkzeuge gegen Kugeln), Lies of P (Legionsarm) | *nicht belegt* | — | — | — |

[EM1] https://eldenring.wiki.fextralife.com/Memory+Slots · [EM2] https://eldenring.wiki.gg/wiki/Spells ·
[EM3] https://www.pcgamesn.com/elden-ring/spell-incantation-sorcery-best · [S3] siehe §11.1

## 18. Die Geräte

Sechs Geräte, je ein Element, alle aus Hof, Wirtshaus, Weide, Imkerei, Bruch — Technik, die im Inntal real
herumsteht. Keine fremden Namen, keine fremden Formen (ADR-0004). Alle Wirkzahlen sind **Entwurf und ungemessen**;
`schaden` und `haltung` zählen in leichten Klingenhieben (22 / 34), bevor der Kreis greift.

| Gerät | Element | Was es real ist | Stark gegen (Kapitel 1) | Status (entschieden D411) |
|---|---|---|---|---|
| **Abflammgerät** | brand | Unkrautbrenner mit Stechkartusche, Flamme um 1.800 °C | Wolf (frost) | **Kapitel 1** |
| **Kohlensäurelöscher** | frost | CO₂-Handlöscher, 2 kg, Schnee von −78 °C | Keiler (holz) | **Kapitel 1** |
| **Weidezaungerät** | alt-tech | Impulsgerät, 5–10 kV, höchstens 5 J | — (Flussvater Phase 1, wasser) | **Kapitel 1** |
| **Räucherkanne** | holz | Smoker der Imker mit Blasebalg | Grathorn, Gams (stein), Fuchs (alt-tech) | **Kapitel 1, erste Probe vor dem Fremdtest** |
| **Kalkstreuer** | stein | Streubüchse mit Branntkalk | Fuchs, Wolf (alt-tech) | **Kapitel 2** |
| **Sporenbalg** | sporen | erfunden (Stäubebalg mit Sporen) | — | **geparkt** mit den Befallskräften (D406) |

Wasser bleibt beim Kernfunken (Flutstoss); für faeulnis gibt es bewusst kein Gerät — sie ist das, was man bekämpft.

### Aufsätze (das Austauschbare — an der Rast gewechselt, einer ist eingesetzt)

| Gerät | Aufsatz | Form, Reichweite | Schaden / Haltung | Zustand | Verbrauch |
|---|---|---|---|---|---|
| Abflammgerät | Breitbrenner | Kegel 2,0 m | 0,8 / 0,4 | brennt 4 s | 1 von 6 |
| | Stichflamme | Stoss 2,5 m | 1,4 / 1,0 | brennt 2 s | 2 |
| | Glutnest | Fläche 1,5 m | 0,5 / 0,2 | brennt 6 s (am Boden) | 2 |
| Kohlensäurelöscher | Schneerohr | Kegel 2,5 m | **0** / 0,8 | verlangsamt 3 s | 1 von 5 |
| | Stossdüse | Stoss 2,0 m | **0** / 1,6 | verlangsamt 1 s, wirft | 1 |
| | Reifhaut | Berührung 1,0 m | 0,6 / 0,6 | verlangsamt 5 s | 2 |
| Weidezaungerät | Treibstab | Berührung 1,2 m | 0,2 / 0,6 | zuckt 0,6 s | 1 von 10 |
| | Litze | Linie 4,0 m am Boden | 0,1 / 0,4 | zuckt 0,6 s | 2 |
| | Speicherschlag | Stoss 1,5 m | 0,9 / 1,4 | zuckt 1,2 s | 3 |
| Räucherkanne | Harzrauch | Fläche 3,0 m | **0 / 0** | ruhig 6 s | 1 von 4 |
| | Rainfarn | Kegel 2,5 m | **0** / 0,3 | ruhig 3 s, Tiere weichen | 1 |
| | Nasses Laub | Fläche 3,5 m | **0 / 0** | geblendet 5 s — alle, auch der Träger | 2 |
| Kalkstreuer | Branntkalk | Kegel 2,5 m | 0,5 / 0,5 | geblendet 4 s | 1 von 6 |
| | Steinmehl | Kegel 2,5 m | **0** / 0,3 | geblendet 3 s | 1 |

- **Nahbereich:** Kein Aufsatz reicht weiter als 4,0 m — das ist die Reichweite des weitesten Speerstosses (Test).
  Geräte ergänzen den Nahkampf; sie sind kein Fernkampf durch die Hintertür (D406).
- **Kein Aufsatz trifft härter als 1,5 leichte Hiebe.** Mit dem Kreis höchstens 1,4 × 1,41 ≈ 2,0 — ein schwerer Hieb.
- **Ein Geräteplatz.** Das Gerät hängt am Gurt und wird mit der freien Hand geführt. Mit einhändiger Waffe (Klinge,
  Hirschfänger, Axt) bleibt die Waffe in der Hand; mit zweihändiger (Saufeder, Langes Messer) muss sie erst weg —
  doppelter Vorlauf. Das ist der Preis der Reichweite.
- **Clips:** Kein Clip ist für Geräte gebaut. Tragen kann `Klinge_Stich` (Arm nach vorn) als Sprühhaltung und
  `Speer_Stoss` für den Treibstab; es fehlen drei: `Geraet_Spruehen` (Schleife), `Geraet_Wurf` (Streuen),
  `Geraet_Auslegen` (Litze). Selbst zu bauen wie Axt und Speer (`tools/waffenclips.py`).

### Physik (D398): was stimmt, was nicht

| Gerät | Stimmt | Abweichung, benannt | Risiko für den Träger |
|---|---|---|---|
| Abflammgerät (1,6 kg) | offene Flamme, zündet Trockenes | Flamme real 0,5–1 m, im Spiel bis 2,5 m; eine Kartusche brennt real rund eine Stunde, im Spiel sechs Stösse | zündet Gras und Laub — die Fläche brennt weiter und trifft auch ihn; **ein verbranntes Revier wird nie ruhig**. **Entschieden (D411):** gilt als Regel; gebaut erst nach Kapitel 1 — bis dahin brennt nur das Getroffene (benannte Abweichung) |
| Kohlensäurelöscher (5,0 kg) | 2 kg CO₂ sind in 8–10 s leer: fünf Stösse zu zwei Sekunden passen genau; −78 °C | dass Kälte ein Tier sekundenlang lähmt, ist Spielwert | CO₂ sammelt sich in Mulden und Stollen: Ausdauer sinkt; das Horn friert an |
| Weidezaungerät (3,5 kg) | 5–10 kV, höchstens 5 J: schmerzt, lässt zucken, tötet nicht | eine Batterie hält real Wochen, im Spiel zehn Einheiten; ein 140-kg-Tier stoppt real kaum | im Wasser und bei Regen trifft es den Träger |
| Räucherkanne (1,2 kg) | Zunderschwamm ist realer Räucherstoff und glimmt lange; Rauch beruhigt **Bienen** | **Säugetiere beruhigt Rauch nicht.** Im Spiel beruhigt er den Befall — Fiktion der Welt, seit D411 **Setzung in der Story-Bibel v2 §2** („Rauch beruhigt den Befall“: der Symbiont antwortet wie ein Bienenvolk) | Wind dreht: Husten, langsamere Erholung |
| Kalkstreuer (2,0 kg) | Branntkalk ätzt, wird mit Wasser über 100 °C heiss, Stallhygiene seit jeher | **Kalk hilft real gegen Fäulnis; der Kreis sagt das Gegenteil** (faeulnis schlägt stein). Der Kreis gilt | Wind und Regen tragen ihn zurück; nie im Bach |
| Sporenbalg | — | ganz Fiktion | Preis am eigenen Körper, nicht entworfen |

### Erwerb (wie D391: nie bloss abgelegt)

| Gerät | Wo | Wie |
|---|---|---|
| Abflammgerät | Geräteschuppen eines Hofs in der Flutzone | hinter einem verplombten Spind (Plombenzange, D393) |
| Kohlensäurelöscher | Schankraum des Wirts | Nebenaufgabe; er füllt danach gegen Tausch nach |
| Weidezaungerät | Stadel am Hangweg | Rätsel mit der Litze: welcher Pfahl hat noch Strom |
| Räucherkanne | Bienenstand am Waldrand | die Magd gibt sie für einen Schwarm, den man zurückbringt |
| Kalkstreuer | Wart vom Bruch | Kapitel 2, wenn der Ofen am Kalkbruch wieder brennt |

Orte und Aufträge sind **Vorschläge ohne Koordinaten**; keine Quest-Datei ist angefasst.

## 19. Womit gespeist

~~**Empfehlung (a)**~~ **Entschieden (D411): (a) Betriebsstoff je Gerät.** Gaskartusche, Kohlensäureflasche,
Zaunbatterie, Branntkalk — und für die Räucherkanne der **Zunder**, den es schon gibt.

| Betriebsstoff | Gewicht | Traglast | Füllung reicht für | Woher |
|---|---|---|---|---|
| Gaskartusche | 0,35 kg | 3 | 6 Einheiten | **Altbestand** — Funde in Höfen und Werk, endlich |
| Kohlensäureflasche | 3,0 kg | 2 | 5 | **Altbestand** — der Wirt füllt nach, solange die grosse Flasche Druck hat |
| Zaunbatterie | 1,2 kg | 2 | 10 | **Altbestand** — lädt am Solarmodul beim Stadel, in zwei Tagen (im Spiel: je Rast in Brannburg) |
| Zunder | 0,05 kg | 4 | 4 | **nachwachsend** — Baumschwamm, Tausch beim Wirt (D393) |
| Branntkalk | 0,5 kg | 4 | 6 | **nachwachsend** — aus dem Bruch gebrannt |

Warum (a): Es ist die einzige Speisung, die zur Welt und zur Ökonomie passt. D393 trennt, was knapp ist (Altbestand),
von dem, was nachwächst — und genau so fällt es hier: **Was töten kann, läuft auf Altbestand; was nicht töten kann,
wächst nach** (Test). Eine Leiste (b) wäre eine Zauberleiste unter anderem Namen. Die Ladungen der Marke (c) würden
die Geräte wieder an die Marke binden — das hat D409 gerade aufgelöst.

**Alternative (c), nicht gewählt (D411): Ladungen der Marke.** Einfacher (kein Betriebsstoff, keine Traglast), und die Geräte stünden wie
das alte Wirken in Konkurrenz zum Reinigen. Preis: Der Schlächter, der nie reinigt, hätte sie umsonst.

## 20. Verhältnis zum Reinigen und zum Zähler

- **Brand tötet und zählt voll.** Das Abflammgerät hat keinen Aufsatz ohne Schaden. Wer damit ein Revier leert, hat
  es verbrannt: nie ruhig, voller Zähler, Verhärtung (D400).
- **Frost, Rauch, Steinmehl öffnen das Griff-Fenster, ohne zu töten.** „Verlangsamt“, „ruhig“ und „geblendet“ sind
  Zustände, in denen die Marke greifen kann — neben betäubt, Erholung und lauernd (Reinigen v1 §2). Das sind die
  **Geräte des Heilers**; sie ersetzen den Haltungsbruch, den seine schwache Waffe nicht liefert.
- **Ein Aufsatz ohne Schaden kann nicht töten** und zählt beim Zähler nicht. Erst der Griff zählt (ein Viertel).
- **„Die Marke heilt“ bleibt unberührt:** Kein Gerät reinigt. Reinigen aus der Ferne (der alte „Nachhall“) entfällt.

**Schwächen der fünf Tiere** — abgeleitet aus `content/gegner/*.json`, nichts gesetzt (Test):

| Tier | Elemente | stark (×1,41) | schwach (×0,71) | Gerät der Wahl in Kapitel 1 |
|---|---|---|---|---|
| Keiler | holz | frost, faeulnis | stein, alt-tech | **Löscher** — das zäheste Tier beim Reinigen bekommt sein Fenster |
| Grathorn | stein | holz, faeulnis | alt-tech, sporen | **Räucherkanne** |
| Gams | stein | holz, faeulnis | alt-tech, sporen | **Räucherkanne** — das heikelste Tier der Messreihe (Reinigen v1 §6) wird ruhiger |
| Fuchs | alt-tech | holz, stein | sporen, wasser | Räucherkanne |
| Wolf | alt-tech + frost | stein, brand | faeulnis, sporen | **Abflammgerät** — nur Töten wirkt stark; für den Heiler bleibt der Wolf schwer |

Gegen jedes der fünf Tiere wirkt in Kapitel 1 ein Gerät stark, keines gegen alle (Test). Der Flussvater: Phase 1
(wasser) Weidezaungerät, Phase 2 (faeulnis) Abflammgerät und Löscher, Phase 3 (alt-tech + stein) Räucherkanne ×2,0.

**Rechnung der vier Spielweisen** (`npx tsx tools/oekonomiesim.ts`). Die Kontroll-Wirken sind weg; für Lesen und
Rufen bleiben gesetzt 0 / 5 / 5 / 15 % der Ladungen.

| | Schlächter | Gemischt | Heiler | Umgeher |
|---|---|---|---|---|
| Ladungen ins Wirken (D405 → D410) | 50 → **0** | 17 → 6 | 27 → 9 | 38 → 14 |
| Tiere gereinigt (D405 → D410) | 0 | 90 → 100 | 138 → 158 | 32 → 32 |
| Stand beim Zähler, gewichtet (Schwelle 40) | 291 | 214 | **41** | 8 |
| Hauptwaffe / Markenstufe | 3 / 1 | 2 / 3 | 1 / 4 | 0 / 2 |

- **Der Heiler liegt wieder genau an der Schwelle** (41 gegen 40): Ohne die Kontroll-Wirken reinigt er mehr. Nach der
  Zwei-Stufen-Regel aus D406 ist er damit knapp nicht mehr „geduldet“. Die Zahl hängt an einer einzigen Annahme
  (5 % der Ladungen für Lesen und Rufen) und ist nicht belastbar.
- **Die Geräte ändern die Rechnung sonst nicht** — sie kosten Betriebsstoff, keine Ladungen. Was sie am Kampf ändern
  (Kampfdauer, Reinigungsquote, erlittener Schaden), kann nur der Kampfbot sagen, und der kennt keine Geräte.
- **Der Schlächter hat die Marke wieder nur als Zähler.** Dafür hat er Brand und Strom.

## 21. Was aus dem Wirken der Marke wird

~~**Empfehlung:**~~ **Entschieden (D411):** Die Marke zaubert nicht — sie **ortet und ruft** (bisher „misst und ruft“).
Als eigene Wirkung behält sie nur diese beiden. Zwei Wirken bleiben als Funktion der Armklammer
(Sensor, kein Angriff), fünf entfallen. In `content/wirken.json` ist nichts gelöscht: Jeder Eintrag trägt `status`
und, wenn ersetzt, `ersetztDurch`. Das Schema lässt ein geltendes Wirken mit Kampfwert nicht mehr zu.

| Wirken | Status | Was daraus wird |
|---|---|---|
| **Lesen** | gilt | Funktion der Klammer: zeigt Befallene und ihren Zustand (1 Ladung) |
| **Rufen** | gilt | Funktion der Klammer: ruft ein gereinigtes Tier, mit Halfter das Reittier — seit D411 das Tragtier des Försterhofs (1 Ladung) |
| Stillen | ersetzt | Räucherkanne, Harzrauch |
| Stoss | ersetzt | Kohlensäurelöscher, Stossdüse |
| Binden | ersetzt | Kohlensäurelöscher, Schneerohr |
| Schirm | ersetzt | entfällt — kein Gerät schützt im Griff |
| Nachhall | ersetzt | entfällt — Reinigen braucht Nähe, ohne Ausnahme |

**Alternative, nicht gewählt (D411):** Auch Lesen und Rufen streichen; Lesen wird eine Technik (Fährte und Wundblick decken es halb ab),
Rufen eine Eigenschaft des Halfters. Dann kostet die Marke nur noch fürs Reinigen — sauberer, aber die Klammer wäre
ein reines Werkzeug ohne eigene Stimme, und ihr Geheimnis (Typ B aus dem Werk, Quests v1) hätte nichts mehr zu zeigen.

## 22. Messbedarf und Aufwand

| Was | Womit | Grösse |
|---|---|---|
| Zustände „brennt“, „verlangsamt“, „ruhig“, „geblendet“ in den Kampfregeln („zuckt“ gibt es als Phase) | `src/kampf/echtzeit.ts`, renderfrei | M |
| Geräteeinsatz als Handlung (Vorlauf, Form, Kegel gegen Kapsel wie der Trefferbogen) | ebd. | M |
| Kampfbot mit Gerät: Kampfdauer, erlittener Schaden, im Rudel | `tools/kampfbot.ts` | M |
| Reinigen mit Löscher und Räucherkanne: Quote und Dauer gegen Keiler und Gams | `tools/reinigensim.ts` (D407 arbeitet dort) | S, nach D407 |
| Brand im Gelände (Fläche brennt weiter) | Welt, Props | L — ~~getrennt entscheiden~~ **entschieden (D411):** Regel ja, Mechanik nach Kapitel 1; bis dahin brennt nur das Getroffene |
| Modelle (5), Clips (3), Effekte (Flamme, Schnee, Rauch, Staub, Funke) | Blender, Shader | L |
| Geräteplatz in Ausrüstung und Schmiede/Rast-Fenster | UI nach Menü v1 | M |

Vor dem ersten Fremdtest sinnvoll: **ein** Gerät des Heilers (Räucherkanne — kein Schaden, ein Zustand, nachwachsender
Stoff) als Probe, ob das Prinzip trägt. **So entschieden (D411).**

## 23. Unklar (D410)

- ⚠️ Keine Wirkzahl ist gemessen. Der Echtzeitkampf kennt weder Geräte noch die Zustände ausser „zuckt“.
- ⚠️ Gewichte, Entleerzeiten, Spannungen sind Allgemeinwissen ohne Quelle.
- ~~⚠️ Dass Rauch den Befall beruhigt, ist eine neue Setzung über die Welt (der Symbiont antwortet wie ein Bienenvolk).
  Sie steht in keiner Bibel und müsste dorthin, wenn Flo sie annimmt.~~ **Erledigt:** Flo hat sie angenommen (D411);
  sie steht seit D412 in der Story-Bibel v2 §2.
- ⚠️ Kalk gegen Fäulnis: Physik und Elementkreis widersprechen sich. Gewählt ist der Kreis.
- ⚠️ Der Wolf hat kein Gerät des Heilers, das stark wirkt. Ob das eine gewollte Härte ist, ist offen.
- ⚠️ Brand im Gelände ist ein eigenes, grosses Thema (Performance, Weltzustand) ~~und hier nur als Risiko benannt~~ —
  entschieden als Regel (D411), die Mechanik kommt nach Kapitel 1; Performance und Weltzustand bleiben offen.
- ⚠️ Fundorte ohne Koordinaten; Bloodborne und Lies of P nicht belegt.
- ⚠️ `tools/baukastensim.ts`, `content/waffenteile.json` und Reinigen v1 §6 sind nicht angefasst (D407).
