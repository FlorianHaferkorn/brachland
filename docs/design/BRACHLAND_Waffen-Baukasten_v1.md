---
last-reviewed: 2026-11-22
shelf-life-days: 180
---
# BRACHLAND — Waffen- und Ausrüstungs-Baukasten v1

> **Entwurf mit Bot-Messung (D403), nichts im Spiel verdrahtet.** Die geprüften Werte von Klinge, Axt und Speer
> (`content/waffen/`) sind unverändert und kommen als Referenzbau bitgleich aus dem Baukasten heraus (Test).
> Daten: `content/waffenteile.json`. Ableitung: `src/kampf/baukasten.ts`. Messung: `npx tsx tools/baukastensim.ts`.
> Fragen für Flo: Ledger **A-31**. Offen/erledigt steht im Ledger, nicht hier.
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
