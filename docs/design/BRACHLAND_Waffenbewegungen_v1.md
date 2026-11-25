---
last-reviewed: 2026-11-23
shelf-life-days: 180
---
<!-- BRACHLAND — Waffenbewegungen aus freien Quellen (D428, D430, D452, D456). Stand 23.11.2026. -->

# BRACHLAND — Waffenbewegungen aus freien Quellen v1 (D428)

> **D456 (23.11.2026):** Alle Waffenclips der Spielfigur neu gebaut (jedes Bild gerechnet: Bögen, Überlappung, stehende Füsse,
> Blick, eine Hut je Waffe mit dem linken Fuss vor), Klinge mit eigenen Hieben statt der UAL2-Drehungen, Saufeder nach Meyer,
> Hirschfänger mit eigenen Clips, vier Körperclips, Marken für Ketten — §9; Widersprüche 5, 6, 7 aus §5 behoben. Fragen: **A-51**.
>
> **D452 (23.11.2026):** Körper von `Axt_Hieb` und `Axt_Schwer` nach dem Spaltvideo nachgezogen (tieferes Becken, Hüftknick,
> Schwerpunkt über den Füssen), Trefferfenster A gegen B mit dem Kampfbot gemessen — A übernommen, B Vorschlag (§5.2, A-49).
> **D453 (23.11.2026):** Fertige Bewegungsquellen (Mocap, Animationspakete, Datensätze, KI, Werkzeuge) mit
> Lizenzurteil für den Browser, CMU-Probe, Empfehlung in drei Stufen und Übergangssystem in §8; Fragen: Ledger **A-50**.
>
> **D430 (23.11.2026):** Bewegungen aus frei lizenzierten Videos — Quellen, Kette (`tools/videoposen.py`), Probeclip und
> ehrliche Bewertung in §7; Fragen an Flo: Ledger **A-45**.
>
> **D429 (22.11.2026):** Die Axt ist jetzt eine Zweihand-Fällaxt nach *An Ax to Grind* — Widersprüche 2, 3 und 5 (Axt)
> aus §5 sind behoben, Ausführung und Messwerte in §5.1.
>
> **Recherche und Probe, nichts verdrahtet.** Kein Clip in `public/figuren/held/held-clips.glb` geändert, keiner
> Waffe zugewiesen, kein Kampfwert berührt (D423: Bestandsclips erst nach der Messung). Offene Fragen an Flo:
> Ledger **A-43**. Prüfbilder unter `.cache/bilder/D428/` (Formprüfung in Blender Cycles, keine Look-Abnahme,
> Bewegung nur am M1 — ADR-0005). Grundsatz (D431): reale Techniken und Handwerk ja, fremde Gestaltung nein
> (ADR-0007 §1 Nachtrag); ob Material benutzt werden darf, regelt ADR-0013 Punkt 5. Physik nach D398, Gewicht sichtbar
> nach D419.

**Kurzfassung.**
1. **UAL2 geladen** (itch.io, Fassung vom 16.06.2026, und OpenGameArt, Fassung vom 23.01.2026), Lizenz in beiden
   Archiven **CC0 1.0**. Die freie Fassung hat **43 Clips** (nicht ~90: „60–70 %“ meint die Pakete insgesamt). Davon
   tragen nur zehn eine Waffe — alle **einhändig**, alle Schwert, Wurf, Schild oder Hacke. Für Langes Messer
   (zweihändig), Fällaxt (zweihändig), Saufeder und Räucherkanne gibt die freie UAL2 **nichts** her. Neu gegenüber
   dem Stand von D173 ist nur `Sword_Heavy_Combo`.
2. **Weg zur Hauptfigur bestätigt:** Der D173-Clip `Klinge_U_A`, mit der neuen Datei über `weltformel.py`
   nachgebaut, trifft den ausgelieferten auf **0,1 cm** (Hände, Füsse, Kopf, alle 34 Bilder). Ruhelagen gleich
   (66 Knoten, `clipnachbau.mjs einfuegen`, nur in eine Kopie).
3. **Fechtbücher:** Lecküchner (Cgm 582, 1482) lehrt das Messer **einhändig** — „firstly, you should fence with one
   hand with the Messer and you should have the other one on the back“. Unser Langes Messer ist zweihändig gebaut
   (D406/D414). Das ist der grösste Widerspruch dieser Arbeit (§5, A-43).
4. **Fällaxt:** Kein Fechtbuch kennt sie (Talhoffers „axst“ ist die Mord-/Kampfaxt am langen Schaft). Die Vorlage
   ist das Forsthandwerk: USDA Forest Service, *An Ax to Grind* (1999, gemeinfrei als Werk der US-Regierung) — beide
   Hände, die linke **fest am Stielende**, die rechte gleitet. Unsere Axt-Clips halten es umgekehrt, `Axe_Overhead`
   ist einhändig und trifft mit dem Nacken voran.

---

## 1. UAL2: Herkunft und Lizenz

| Fassung | Quelle | Datei, Grösse, SHA-256 | Inhalt |
|---|---|---|---|
| itch.io „Standard“ (Name-your-own-price, 0 $) | https://quaternius.itch.io/universal-animation-library-2 | `Universal Animation Library 2[Standard].zip`, 18,7 MB, `4008ea20…2a68` | `UAL2_Standard.glb` (ohne Wurzelbewegung) und `UAL2_Standard_RM.glb` (mit), FBX, Mannequin F; Zeitstempel 16.06.2026 (v2.0) |
| OpenGameArt | https://opengameart.org/content/universal-animation-library-2 | `universal_animation_library_2standard.zip`, 10,3 MB, `ec0e40d6…9217` | Fassung 23.01.2026 (v1): ohne `Sword_Heavy_Combo`, vier Clips heissen `…_RM` |
| Website | https://quaternius.com/packs/universalanimationlibrary2.html | — | verweist auf beide; Lizenz „CC0“ |

`License.txt` in beiden Archiven: „CC0 1.0 Universal (CC0 1.0) Public Domain Dedication“. Abgelegt **nur lokal**
unter `.cache/ual2-d428/` (nicht im Repo, nicht an der Stelle `.cache/ual2/`, die `tools/ual2uebertrag.py` erwartet).
Die Seite nennt eine Fassung v2.2 (28.09.2026: Endbilder der `Sword_Light_*` korrigiert); das Archiv trägt
Zeitstempel vom 16.06.2026 — `Sword_Light_*` sind ohnehin nur in der Bezahlfassung. **Die Bezahlfassung „Source“
(14,99 $, ebenfalls CC0)** fällt unter ADR-0013 Nr. 2 („nicht erlaubt: alles, was Geld kostet“) und ist nicht geladen.

Die vollständige Liste der Source-Fassung (134 Namen) steht in der Animationsvorschau von Quaternius
(https://quaternius.com/animviewer.html; Namen aus deren Datenpaket gelesen, nicht angesehen). **Nur dort, nicht frei:**
`Sword_Heavy_A–D` (+ `_Rec`), `Sword_Light_A–D` (+ `_Rec`), `Sword_Light_Combo`, `Sword_Aerial_*`,
`Sword_GroundPound_RM`, `Sword_UpperCut_RM`, `Melee_Combo`, `Melee_Knee(_Rec)`, `Melee_Uppercut`, **`Mining`**
(Spitzhacke, vermutlich zweihändig — nicht angesehen), **`Bow_Aim_*`, `Bow_Notch`, `Bow_Shoot`, `Bow_RapidShoot`**
(für den Bogen nach ADR-0019), `Bandage`, `Fish_*`, `Farm_PickingTree`, `Farm_ScatteringSeeds`, Zombie-Gänge,
Parkour (`WallRun_*`, `Turn180_*`, `KipUp` …). Ob sich der Kauf lohnt, ist Frage A-43 (3).

## 2. Clipliste der freien Fassung (43 Clips, `UAL2_Standard.glb`, 24 Bilder/s)

Gemessen in Blender 5.3 am UAL2-Mannequin (Skript im Arbeitsordner, Werte wiederholbar mit `tools/ual2probe.py`):
**Hände** = Abstand rechte–linke Hand, kleinster–mittlerer Wert in cm (unter ~30 cm über den ganzen Clip hiesse:
beide an einer Waffe — kein Waffenclip erreicht das); **Becken** = wie tief es unter die Ausgangslage geht (cm);
**Schultern** = Drehung der Schulterlinie gegen Bild 0 (°, ±180 heisst: der Körper dreht sich ganz herum).
**Einsatz** = ob schon ausgeliefert (D173 `ual2uebertrag.py`, D176 `heldbau.py`).

| Clip | Bilder | s | Hände cm | Becken cm | Schultern ° | Art | Hand | Einsatz | Zuordnung zu unseren Familien |
|---|---|---|---|---|---|---|---|---|---|
| `Sword_Regular_A` | 11 | 0,42 | 45–71 | 30 | ±178 | Hieb, Kombo-Glied 1 | 1 | `Klinge_U_A` (+ `_Rec`) | Klinge, Hirschfänger (Bestand) |
| `Sword_Regular_A_Rec` | 24 | 0,96 | 43–70 | 0 | ±180 | Erholung | 1 | in `Klinge_U_A` | wie oben |
| `Sword_Regular_B` | 14 | 0,54 | 25–144 | 9 | −156…179 | Hieb, Kombo-Glied 2 | 1 | `Klinge_U_B` (+ `_Rec`) | Klinge, Hirschfänger |
| `Sword_Regular_B_Rec` | 26 | 1,04 | 67–124 | 1 | 0…31 | Erholung | 1 | in `Klinge_U_B` | wie oben |
| `Sword_Regular_C` | 49 | 2,00 | 67–91 | 0 | −171…138 | Hieb mit Sprung, Kombo-Glied 3 | 1 | `Klinge_U_C` | Klinge; **nicht** Messer (D414: Sprung, linke Hand weg) |
| `Sword_Regular_Combo` | 73 | 3,00 | 24–89 | 39 | ±178 | Kombo A+B+C am Stück | 1 | — | nichts Neues (= A, B, C) |
| `Sword_Heavy_Combo` | 105 | 4,33 | 27–91 | 38 | ±178 | Kombo, vier weite Hiebe mit Drehungen | 1 | — | **neu**; Klinge allenfalls, siehe §3 |
| `Sword_Dash` | 39 | 1,58 | 30–128 | 40 | −20…134 | Laufangriff | 1 | `Klinge_U_Lauf` | Klinge, Hirschfänger |
| `Sword_Block` | 31 | 1,25 | 64–97 | 23 | −6…44 | Block | 1 | `Klinge_U_Block`, Fingergriff | Klinge, Hirschfänger |
| `Hit_Knockback` | 21 | 0,83 | 66–81 | 57 | −2…3 | Treffer (Rückstoss) | — | `Kampf_Rueckstoss` | alle |
| `Idle_Shield_Break` | 27 | 1,08 | 70–93 | 5 | 0…65 | Treffer (Taumeln) | — | `Kampf_Taumeln` | alle |
| `Idle_Shield_Loop` | 61 | 2,50 | 67–69 | 1 | 0 | Stand mit Schild | 1 + Schild | — | keine (kein Schild im Spiel) |
| `Shield_OneShot` | 21 | 0,83 | 67–75 | 4 | −30…0 | Schildstoss | Schild | — | keine |
| `Shield_Dash` | 27 | 1,08 | 67–101 | 0 | 0…95 | Anlauf mit Schild | Schild | — | keine |
| `Melee_Hook` | 12 | 0,46 | 40–110 | 30 | −83…51 | Faustschlag (Haken) | leer | — | keine Waffe; allenfalls Ringen (Lecküchner) |
| `Melee_Hook_Rec` | 15 | 0,58 | 40–66 | 0 | −50…0 | Erholung | leer | — | wie oben |
| `OverhandThrow` | 33 | 1,33 | 67–112 | 25 | −58…69 | Wurf über die Schulter mit Ausfallschritt | 1 | — | Axt „wirft“ (`waffenfamilien.json`), siehe §3 |
| `TreeChopping_Loop` | 24 | 0,96 | 92–114 | 2 | 0…79 | Hacken (Schleife) | **1** | Fingergriff links (D188) | Beil, **nicht** Fällaxt, siehe §3 |
| `Farm_Harvest` | 61 | 2,50 | 62–67 | 16 | 0…18 | Ernten (Sichel?) | 1 | — | keine |
| `Zombie_Scratch` | 44 | 1,79 | 74–88 | 17 | −45…58 | Kratzen | leer | — | allenfalls Befallene |
| `Idle_FoldArms_Loop` | 61 | 2,50 | 15–16 | 1 | 0 | Stand | — | `Idle_Ruhig` | Bewohner |
| `Yes` | 61 | 2,50 | 64–94 | 1 | 0 | Nicken | — | `Gruss` | Bewohner |
| `A_TPose`, `Chest_Open`, `ClimbUp_1m`, `Consume`, `Farm_PlantSeed`, `Farm_Watering`, `Idle_Lantern_Loop`, `Idle_No_Loop`, `Idle_Rail_Call`, `Idle_Rail_Loop`, `Idle_TalkingPhone_Loop`, `LayToIdle`, `NinjaJump_Idle_Loop`, `NinjaJump_Land`, `NinjaJump_Start`, `Slide_Start`, `Slide_Loop`, `Slide_Exit`, `Walk_Carry_Loop`, `Zombie_Idle_Loop`, `Zombie_Walk_Fwd_Loop` | — | — | — | — | — | Alltag, Bewegung, Befallene | — | — | keine Waffe |

**Kein Clip:** Rolle, Tod, Stich mit Speer, zweihändiger Hieb, Axt am Stiel mit beiden Händen. **Familien ohne
Kandidaten:** Langes Messer, Fällaxt (Hieb), Saufeder, Räucherkanne. Hirschfänger hat die Klingenclips (D414).

## 3. Probe auf der Hauptfigur (drei Clips, nicht eingefügt)

Weg D414/D176: `node tools/clipnachbau.mjs figur …` → `tools/ual2probe.py` (neu, Weltformel aus `weltformel.py`,
Finger aus der Quelle) → Messung → `clipnachbau.mjs einfuegen` **in eine Kopie** von `held-clips.glb` (Ruhelagen:
66 Knoten gleich; 785 → 899 KB — das Budget von 800 KB hielte das nicht) → `kontaktbogen.py`/`.mjs` mit den
Modellen aus `waffen.glb`. Messwerte am Ziel (Lage der Waffe wie im Spiel, `WAFFE_AN_HELD_HAND`):

| Clip | Waffe | s | Scheitel/Durchzug (Bild) | Spitze m/s | Nachschwung m | Schneide ↔ Schlag | linke Hand neben Griff cm | Becken tiefer cm | Schultern ° | Gewicht hinten→vorn | Fuss nah am Boden m/s |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `Probe_Schwer` (`Sword_Heavy_Combo`) | Klinge | 4,33 | Hiebe bei 13, 29, 46, 64 | 45,6 | 0,92 | 21° | 57 | 38 | ±179 | −0,31…1,16 | 17,0 |
| `Probe_Hacken` (`TreeChopping_Loop`) | Axt | 0,96 | 5/5 | 28,2 | 0 | 9° | 70 | 2 | −16…62 | 0,51…0,66 | 0,25 |
| `Probe_Wurf` (`OverhandThrow`) | Axt | 1,33 | 10/11 | 17,6 | 0,30 | 59° | 75 | 25 | −49…75 | 0,44…0,94 | 2,9 |

Lesart: **Scheitel** = schnellstes Bild der Spitze, **Durchzug** = letztes Bild danach mit ≥ 50 % davon,
**Nachschwung** = Weg der Spitze danach bis unter 20 %. **Gewicht**: Becken auf der Linie hinterer → vorderer Fuss
(0 = über dem hinteren, 1 = über dem vorderen; ausserhalb = Ausfall oder Sprung). **Fuss nah am Boden**: grösste
waagrechte Geschwindigkeit eines Fusses, solange er unter 5 cm über dem Boden ist (Gleiten **oder** flacher Schritt —
die Messung trennt das nicht). Spitzengeschwindigkeiten sind Werte des Clips; reale Vergleichswerte sind in dieser
Recherche **nicht belegt**.

Bewertung gegen D398/D419 und die Trefferfenster:

- **`Sword_Heavy_Combo`** — Bilder `.cache/bilder/D428/probe_schwer_kontakt.png`. Vier Hiebe mit klaren Spitzen
  (Scheitel/Durchzug auf 12/14, 28/30, 45/47, 63/65 legbar). Aber: Ausfälle bis 38 cm tief, der Körper dreht sich
  zweimal ganz herum, die Füsse gleiten nah am Boden bis 17 m/s, das Gewicht liegt zeitweise vor dem vorderen Fuss.
  Das ist Schauwert, kein Gewicht — ein 1,2-kg-Schwert reisst niemanden so herum. **Nicht empfohlen** (D419); höchstens
  der vierte Hieb (Bild 61–105, mit langem Halten danach) als Vorlage für einen schweren Klingenhieb — nach D423.
- **`TreeChopping_Loop`** — `.cache/bilder/D428/probe_axt_kontakt.png`. **Einhändig** (linke Hand 57–105 cm weg),
  Becken fast still (−2 cm), Gewicht verlagert sich kaum (0,51 → 0,66): ein Beil aus dem Arm. Die Schneide führt
  (9°). Mit der Fällaxt (2,1 kg, 1 m) physikalisch falsch (D421/D426: zweihändig). Nebenbei: D188 nahm den
  linken Fingergriff „Axt mit beiden Händen“ aus diesem Clip — die linke Hand hält dort **nichts**; der Griff stimmt
  trotzdem als Faust, die Begründung im Kommentar von `tools/heldbau.py` nicht.
- **`OverhandThrow`** — Wurf mit Ausfallschritt, Becken −25 cm, Gewicht wandert von 0,44 auf 0,94 nach vorn, Rumpf
  dreht 124°: der einzige freie Clip mit Gewicht im ganzen Körper. **Kandidat für „Axt wirft“** — aber nur mit einem
  Wurfbeil (real um 0,6–1 kg, *nicht belegt*), nicht mit der 2,1-kg-Fällaxt; die Schneide steht im Scheitel 59° zur
  Wurfrichtung (beim Wurf dreht sich die Waffe ohnehin). Im Bild 10–12 ist die Waffe hinter dem Körper.
- Nicht geprobt, weil schon ausgeliefert: `Sword_Regular_A/B/C`, `Sword_Dash`, `Sword_Block`, `Hit_Knockback`,
  `Idle_Shield_Break`. **Ergebnis Teil 1:** Die freie UAL2 bringt für Kapitel 1 keinen Clip, der unsere Lücken
  schliesst. Der Weg über Schlüsselbilder (`waffenclips.py`, D184/D414) bleibt der richtige — mit den Vorgaben aus §4.

## 4. Fechtbücher und Handwerk als Vorlage

Alle Quellen gemeinfrei (Handschriften des 15./16. Jh.; *An Ax to Grind* als Werk der US-Bundesregierung). Texte
und Übersetzungen nach Wiktenauer (https://wiktenauer.com, Übersetzungen dort unter CC-BY-SA — **zitiert, nicht
übernommen**). Bilder **nur lokal** unter `.cache/referenz/fechtbuecher/` (Quellenliste dort, `QUELLEN.md`); ins Repo
ist keine Abbildung übernommen. Folio = Blatt der genannten Handschrift; die Zuordnung der Wiktenauer-Spalten zur
Handschrift ist bei Lecküchner (Cgm 582) und Talhoffer (Cod.icon. 394a) am Scan geprüft, bei Ringeck (Dresden) nur aus
der Spaltenfolge geschlossen (**UNKLAR**, §6).

**Achsen der Posenfelder** (`tools/waffenclips.py`): `hand` (rechts, vorn, hoch) in Metern vom Standpunkt, `richt`
Richtung der Klinge/des Stiels, `rumpf` (Drehung + = rechte Schulter vor, Neigung + = vor), `huefte` (Becken vor
der Brust, °), `koerper` (vor, hoch) Schwerpunkt, `fuss_l`/`fuss_r` (vor, rechts), `zwei` linke Hand an die Waffe,
`links` linke Hand frei. Höhen an der Hauptfigur: Schulter ≈ 1,45 m, Hüfte ≈ 1,0 m, Knie ≈ 0,5 m.

### 4.1 Langes Messer — Johannes Lecküchner, *Kunst des Messerfechtens*, Cgm 582 (BSB München, 1482)

Grundsatz (Wiktenauer Lecküchner, Abschnitt „how one should hold himself“): **einhändig**, die andere Hand auf dem
Rücken; sie kommt nach vorn zum Greifen, Ringen, Messernehmen. Beide Hände an den Griff nur als „Nachhilfe“ in
Ringstücken („come with your left hand to help your right hand down on your hilt … pull with your both hands firmly
downwards“, Abschnitt [294]). Alle Leger mit dem **linken Fuss vor** (Rechtshänder).

| Original | Deutsch heute | Beschreibung | Füsse | Gewicht | Schneide | Quelle |
|---|---|---|---|---|---|---|
| Pastey (Bastei) | Bastei | Arm gestreckt vor dir, Spitze auf der Erde, kurze Schneide oben | links vor | mittig | kurze oben | Cgm 582 fol. 33r |
| Lug ins Land | Ausguck | Arm hoch gestreckt vor dem Kopf, lange Schneide gegen den Mann | links vor | hinten, sprungbereit | lange vorn | fol. 33v |
| Eber | Eber | Messer am rechten Bein, Gehilz an der Hüfte, stumpfe Schneide oben, Spitze zum Gesicht; auch links | links vor | mittig, tief | stumpfe oben | fol. 33v |
| Stier | Stier | Gehilz vor dem Kopf (links oder rechts), kurze Schneide zu dir, Spitze zum Gesicht | links vor | mittig | kurze zu dir | fol. 34r |
| Schrankhut | Schrankhut | Spitze rechts (oder links) auf dem Boden, kurze Schneide zum Mann | links vor | hinten | kurze vorn | fol. 17r |
| Zornhau | Zornhau | von rechts oben „zornig“ mit ihm zusammen, Spitze gleich vor zum Gesicht oder zur Brust | — (nicht genannt) | nach vorn | lange | fol. 3v |
| Wecker | Wecker | von der rechten Schulter, **Sprung mit dem rechten Fuss weit nach rechts**, lange Schneide auf sein Messer, Spitze ins Gesicht winden | rechts seitwärts | über den rechten Fuss | lange | fol. 14v–15r |
| Entrüsthau | Entrüsthau | gegen den Ausguck: Messer flach am Leib, Sprung nach rechts, Gehilz vor den Kopf (Daumen unten), mit der stumpfen Schneide zu seiner oberen Blösse | rechts seitwärts | über den rechten Fuss | stumpfe | fol. 25r |
| Zwinger | Zwinger | bricht den Eber (Stich von unten), von beiden Seiten | — | — | — | fol. 28v |
| Geferhau | Geferhau | aus dem Ausguck mit gestrecktem Arm von oben, Sprung mit dem rechten Fuss, lange Schneide | Sprung rechts vor | ganz nach vorn | lange | fol. 29r–29v |
| Winker | Winker | von der rechten Schulter lang mit gestrecktem Arm, am Messer winden, kurze Schneide zum Kopf | links vor | nach vorn | lange, dann kurze | fol. 30r |

Plattenbilder: https://wiktenauer.com/wiki/Johannes_Lecküchner (Cgm 582: BSB-Digitalisat, Wiktenauer-Dateien
`Cgm_582_003v.jpg` … `Cgm_582_034r.jpg`).

**Vorgaben für Schlüsselbilder** (einhändige Fassung; zweihändig siehe §5 Nr. 1):

| Lage | `hand` | `richt` | `rumpf` | `huefte` | `koerper` | Füsse | linke Hand |
|---|---|---|---|---|---|---|---|
| Stand = Stier rechts | (0,15, 0,25, 1,62) | (−0,1, 0,95, −0,2) | (−15, 4) | 0 | (0, −0,06) | `fuss_l` (0,18, −0,02), `fuss_r` (−0,12, 0,06) | `links` (−0,12, −0,18, 1,05) — hinter dem Rücken |
| Ausholen Zornhau (= Luginsland/Schulter) | (0,28, −0,05, 1,6) | (0,2, −0,5, 0,85) | (−35, −4) | 10 | (−0,04, −0,06) | wie Stand | an der Brust (Lecküchner: „turn the hand from the back to the chest“) |
| Scheitel Zornhau | (0,05, 0,55, 1,35) | (−0,3, 0,9, −0,3) | (10, 12) | −8 | (0,12, −0,1) | `fuss_r` (0,35, 0,05) — Schritt | locker vorn |
| Wecker: Sprung | (0,35, 0,35, 1,45) | (−0,6, 0,75, 0,1) | (0, 10) | −5 | (0,08, −0,08) | `fuss_r` (0,15, 0,40) — seitwärts | frei |
| Bastei | (0,12, 0,45, 1,0) | (0, 0,55, −0,83) | (−8, 8) | 0 | (0, −0,08) | linker vor | hinter dem Rücken |
| Eber | (0,25, 0,12, 1,0) | (−0,05, 0,9, 0,42) | (−20, 6) | 8 | (0, −0,1) | linker vor | hinter dem Rücken |

Schneide: lange Schneide führt bei Zorn-, Gefer- und Winkerhau, die **kurze** oder stumpfe beim Wecker aus der
Schrankhut und beim Entrüsthau — `waffenclips.py` dreht heute immer die (lange) Schneide in die Bewegung; ein
Feld für „kurze Schneide führt“ fehlt (Vorschlag §5 Nr. 4).

### 4.2 Klinge (Seitschwert, einhändig) — Liechtenauer-Tradition und Lecküchner

Die Liechtenauer-Lehre ist eine Lehre des **Langen Schwerts** (zweihändig). Unsere Klinge ist ein einhändiges
Seitschwert (D421, 1,21 kg). Übertragbar sind Fussarbeit, Leger und Schlagwege; der Griff ist der des Messers (§4.1).

Leger wörtlich nach der Ringeck-Glosse; die fünf Meisterhäue nur kurz nach Stichwort und Blatt (Beschreibung aus
der Glosse zusammengefasst, nicht Satz für Satz geprüft).

| Original | Deutsch heute | Beschreibung (Ringeck-Glosse) | Füsse | Schneide | Quelle |
|---|---|---|---|---|---|
| Ochs | Ochs | Schwert neben dem rechten Kopf, Gehilz vor dem Haupt, Spitze zum Gesicht | links vor | — | Liechtenauers Zettel, Verse 68–69; Glosse Mscr.Dresd.C.487 fol. 34r |
| Pflug | Pflug | Schwert über dem rechten Knie, Spitze zum Gesicht | links vor | — | fol. 34r |
| Alber | Narr | Arme gestreckt, Spitze auf der Erde | **rechts** vor | — | fol. 34r–34v |
| Vom Tag | Vom Dach | Schwert an der rechten Schulter oder gestreckt über dem Kopf | links vor | — | fol. 34v |
| Zornhau | Zornhau | Oberhau von rechts, gleich in den Ort | — | lange | fol. 18r–21v |
| Krumphau | Krumphau | von der Schulter über seine Hände, zur Seite tretend | seitwärts | lange, gekreuzte Hände | fol. 24v–26v |
| Zwerchhau | Zwerchhau | waagrecht, Gehilz hoch vor dem Kopf | — | kurze, dann lange | um fol. 29v |
| Schielhau | Schielhau | Oberhau mit der kurzen Schneide | — | kurze | fol. 31r |
| Scheitelhau | Scheitelhau | senkrecht von oben | — | lange | um fol. 33r |

Wiktenauer: https://wiktenauer.com/wiki/Liechtenauer (Zettel), https://wiktenauer.com/wiki/Sigmund_ain_Ringeck (Glosse).
**Vorgabe:** `Klinge_Stand` steht heute mit dem **rechten** Fuss vor (Alber-Stellung) — das stimmt mit einer
Spitze vorn-oben nur für den Alber; für Ochs/Pflug/Lecküchner-Leger linker Fuss vor (§5 Nr. 6).

### 4.3 Axt — Talhoffer (Kampfaxt) und das Forsthandwerk (Fällaxt)

**Benannt:** Talhoffers „axst“ (Cod.icon. 394a, BSB München, 1467, fol. 41r ff.; Thott 290 2°, 1459) ist die
**Mord- bzw. Kampfaxt** des gerichtlichen Zweikampfs: Schaft etwa mannshoch, Haken, Stossspitze, im Harnisch,
Hände weit auseinander, Binden und Ringen am Schaft. **Das ist keine Fällaxt.** Übernehmen lässt sich nur: zwei Hände,
die hintere am Ende, Hebel statt Kraft. Für unsere Fällaxt (2,1 kg, 1 m) gilt das Handwerk:

USDA Forest Service, Bernie Weisgerber, *An Ax to Grind: A Practical Ax Manual* (1999), Kapitel „Chopping Technique“
(https://www.fs.usda.gov/t-d/pubs/htmlpubs/htm99232823/page04.htm, Abb. 76–79):
„place your **left hand** about 1 or 2 inches from the butt end … your **right hand** about three–fourths of the way up
the handle“; „Raise the ax over your right shoulder … your right hand sliding down the handle toward your left hand“;
„You will end this motion with both hands at the end of the handle when the ax strikes the wood“; „Your left hand never
leaves the end of the handle“; Rückhand ebenfalls über die rechte Schulter, „shift your body well to the left“;
„Changing hand positions instead of … the back swing technique is not considered acceptable ax use.“ Schnitt 45–50°
zur Faser.

| Name | Beschreibung | Füsse | Gewicht | Schneide | Quelle |
|---|---|---|---|---|---|
| Griff | links am Stielende (fest), rechts ¾ oben (gleitet) | schulterbreit | mittig | — | USFS Abb. 76 |
| Vorhand | über die rechte Schulter ausholen, rechte Hand gleitet beim Schlag zur linken, im Treffen beide am Ende | stehen | nach vorn ins Ziel | führt, 45° | USFS Abb. 77–78 |
| Rückhand | ebenfalls über die rechte Schulter, Körper weit nach links verlagert | stehen | nach links | führt | USFS Abb. 79 |
| Anbinden (Kampfaxt) | Schäfte gekreuzt, beide Hände weit auseinander | Ausfall | vorn | Haken | Cod.icon. 394a fol. 41r |
| Frei schlagen (Kampfaxt) | „Der will fry schlahen“ — Schlag von oben aus dem Binden | — | — | Schneide | fol. 42r |

**Vorgabe Fällaxt** (`zwei` ändert die Seite, §5 Nr. 2): Ausholen `hand` (0,25, −0,15, 1,75), `richt`
(0,15, −0,7, 0,7), `rumpf` (−30, −10), `koerper` (−0,04, 0); Scheitel `hand` (0,05, 0,45, 1,2), `richt`
(0, 0,85, −0,5), `rumpf` (5, 25), `koerper` (0,1, −0,12); Treffen beide Hände am Stielende; Nachschwung: der Kopf
folgt bis unter die Hüfte, das Becken bremst (D420), die Füsse bleiben stehen (USFS: keine Schritte beim Hieb).

### 4.4 Saufeder — Joachim Meyer, halbe Stange (1570), und Jagd

Meyer, *Gründtliche Beschreibung der … Kunst des Fechtens* (Strassburg 1570), Buch III, fol. 16r–17v, „Von den Legern
oder Huten“ der **halben Stange** („Fundament aller langen Wehren“); https://wiktenauer.com/wiki/Joachim_Meyer.
Talhoffer (Thott 290 2°, 1459) zeigt den Spiess vor allem als Wurf. Eine gemeinfreie Jagdquelle mit Saufeder im
Bild: Gaston Phébus, *Livre de la chasse*, BnF fr. 616, um fol. 94r (Wildschweinjagd) — **nicht am Scan geprüft**;
*The Master of Game* (Gutenberg) war beim Abruf nicht erreichbar.

| Original | Deutsch heute | Beschreibung | Füsse | Gewicht | Quelle |
|---|---|---|---|---|---|
| Oberhut | Oberhut | hinteres Ende an der Brust, vorderes gerade nach oben (auch zu den Seiten) | **links vor**, nicht zu weit | mittig | Meyer III fol. 16v |
| Underhut | Unterhut | hinteres Ende an der rechten Weiche, vorderes gestreckt auf die Erde (links, rechts, gerade) | links vor | mittig | fol. 16v |
| Nebenhut | Nebenhut | Mitte der Stange an der linken Hüfte, kurzes Ende zum Mann | rechts vor | hinten | fol. 16v–17v |
| Mittelhut | Mittelhut | „die gerade Versatzung vor dem Mann, daraus man am meisten ficht“ | links vor | mittig | fol. 17v |
| Steirhut | Steuerhut | vorderes Ende vor dem linken Fuss am Boden, das hintere mit gestreckten Armen vor dem Gesicht | links vor | hinten | fol. 17v |

**Vorgabe:** Grundhaltung Mittelhut, **linker Fuss vor** (linke Hand ist die vordere), hinteres Ende an der rechten
Weiche/Hüfte; Stoss mit Vorschritt des linken oder Nachtritt des rechten Fusses, Gewicht wandert auf den vorderen
Fuss. Für das Abfangen eines anlaufenden Tiers (Jagd) Unterhut, Schaftende am Boden oder an der Hüfte — **nicht
belegt** an einer geprüften Quelle.

### 4.5 Hirschfänger und Räucherkanne

**Hirschfänger:** jagdliche Seitenwaffe zum Abfangen; ein eigenes Fechtbuch ist in dieser Recherche nicht gefunden.
Einhändig wie Lecküchners Messer, kürzer — die Klingenclips (D414) passen dazu. **Räucherkanne:** Werkzeug, keine
Waffe; keine Fechtquelle (Haltung aus der Imkerei, D414).

## 5. Abgleich: unsere Clips gegen Fechtbuch und Handwerk

Gemessen mit `tools/ual2probe.py` (`BESTAND=…`) an der ausgelieferten Figur, Bilder
`.cache/bilder/D428/bestand_abgleich_kontakt.png`. **Clips nicht geändert** (D423); jeder Vorschlag ist ein
Kampfwert-Wechsel und braucht die Messung.

| Clip | s | Scheitel/Durchzug (gemessen) | Schneide ↔ Schlag | linke Hand neben Griff cm | Becken tiefer cm | Schultern ° | Gewicht | Nachschwung m |
|---|---|---|---|---|---|---|---|---|
| `Klinge_U_A` | 1,38 | 7/8 | 20° | 55 | 30 | −164…47 | 0,23…0,99 | 0 |
| `Klinge_U_B` | 1,58 | 8/8 | 24° | 73 | 9 | −156…44 | 0,13…0,85 | 0,65 |
| `Klinge_U_C` | 2,00 | 17/18 | 7° | 63 | 0 | −179…165 | 0,29…3,51 | 0,61 |
| `Klinge_Stich` | 1,21 | 11/11 | (Stich) | 50 | 0 | −13…40 | 0,46…0,56 | 0,41 |
| `Klinge_U_Lauf` | 1,58 | 9/10 | 9° | 68 | 40 | −114…39 | −0,05…0,83 | 0 |
| `Axe_Overhead` | 1,38 | 13/14 | **119°** | **34 (6–72)** | 0 | **0…0** | 0,60 (fest) | 0 |
| `Axt_Quer` | 1,21 | 12/13 | 15° | 3 | 0 | −42…53 | 0,50…0,68 | 2,20 |
| `Axt_Schwer` | 1,62 | 22/25 | 23° | 5 | 1 | 6…16 | 0,33…0,76 | 0 |
| `Axt_Lauf` | 1,04 | 11/11 | 30° | 1 | 0 | −31…48 | 0,55…0,60 | 0 |
| `Speer_Stoss` | 0,96 | 8/10 | (Stoss) | 5 | 0 | 3…22 | 0,49…0,60 | 1,67 |
| `Speer_Weit` | 1,21 | 14/14 | (Stoss) | 7 | 0 | 0…28 | 0,51…0,60 | 0,28 |
| `Messer_Quer_A` | 1,21 | 11/13 | 21° | **2** | 13 | −46…58 | 0,17…0,67 | 1,37 |
| `Messer_Quer_B` | 1,12 | 10/11 | 18° | **2** | 13 | −32…63 | −0,14…0,36 | 1,98 |
| `Messer_Schwer` | 1,46 | 14/16 | 22° | **1** | 24 | 8…22 | 0,14…0,70 | 0,38 |
| `Messer_Lauf` | 1,04 | 11/11 | 36° | **2** | 13 | −36…50 | 0,27…0,73 | 0,43 |

Die gemessenen schnellsten Bilder liegen bei allen Clips im Fenster `hieb` aus `content/waffen/*.json` — die
Trefferfenster sitzen auf den Schlüsselbildern.

**Widersprüche und Vorschläge:**

1. **Langes Messer zweihändig** (`Messer_*`, linke Hand 1–2 cm am Griff) — Lecküchner lehrt einhändig, die zweite
   Hand frei (§4.1). Unser Modell (1,17 m, 1,39 kg, Griffpunkt 27 cm vom Knauf) liegt an der Grösse eines
   zweihändigen Kriegsmessers; dafür gibt es in dieser Recherche **keine** gemeinfreie Fechtlehre. Vorschlag: (a)
   einhändig nach Lecküchner, Modell kürzer (Klinge um 70 cm, *Anker nicht belegt*), linke Hand frei — sie passt dann
   zum Wirken der Marke und zum Greifen (Reinigen, D417); oder (b) zweihändig lassen und als Kriegsmesser benennen,
   Vorlage dann die Leger des Langen Schwerts (§4.2). → **A-43 (1)**.
2. ~~**Axt: Hände vertauscht**~~ — **behoben D429** (§5.1). (`zwei='axt'`: rechte Hand am Stielende, linke 0,22 m darüber; `Axt_*`) — Handwerk:
   linke Hand fest am Ende, rechte gleitet, Hieb über die **rechte** Schulter (§4.3). Mit der rechten Hand am Ende ist
   die natürliche Ausholseite die linke. Vorschlag: Waffe an die linke Hand (Ende) hängen, rechte Hand per IK am Stiel
   gleiten lassen (Ausholen ¾ oben, Treffen am Ende) — braucht eine Lage der Waffe an der linken Hand
   (`WAFFE_AN_HELD_HAND`, `src/kampf/waffenhand.ts`) und eine Gleit-IK in `weltformel.greife_links`. → A-43 (2).
3. ~~**`Axe_Overhead` einhändig, ohne Körper, Nacken voran**~~ — **behoben D429** (§5.1, ersetzt durch `Axt_Hieb`). (erster leichter Axthieb, `content/waffen/axt.json`
   `leicht[0]`): linke Hand 34 cm (bis 72) vom Stiel, Schultern und Becken bewegen sich **gar nicht** (0°, 0 cm,
   Gewicht fest 0,60), die Schneide steht im Scheitel 119° zur Schlagrichtung. Widerspricht D419/D421 und dem
   Handwerk. Vorschlag: durch einen eigenen zweihändigen Vorhandhieb aus `waffenclips.py` ersetzen (Vorgabe §4.3),
   Fenster neu messen (D423).
4. **Schneide immer in Schlagrichtung** — richtig für Axt (15–30°) und für die langen Messerhiebe (18–36°); bei
   Lecküchners Wecker/Entrüsthau/Schielhau führt aber die **kurze** oder stumpfe Schneide. Vorschlag: Posenfeld
   `kurz=True` in `waffenclips.py` (Handgelenk um 180° um die Klingenachse), erst wenn ein solcher Hieb gebaut wird.
5. **Kein Nachschwung bei `Axt_Schwer`, `Axt_Lauf`, `Klinge_U_A`, `Klinge_U_Lauf`** — für die Axt **behoben D429** (§5.1),
   für die Klinge **behoben D456** (§9: eigene Hiebe mit Nachschwung 46°, Halt 53 %). (Spitze steht unmittelbar nach
   dem Durchzug) — bekannt aus D420/D423 („Bestandsclips nach der Messung“). Handwerk: Kopf folgt bis ins Holz,
   beide Hände am Ende. Keine neue Erkenntnis, hier nur gemessen.
6. **Standbein** — **behoben D456** (§9.1: linker Fuss vor in jeder Hut, gemessen 21–33 cm; dabei gefunden, dass der Schritt des
   `Idle` jede Hut verschob). `Klinge_Stand` und `Speer_Stand` stehen mit dem **rechten** Fuss vor. Liechtenauer (Ochs, Pflug,
   Vom Tag), Lecküchner (alle Leger) und Meyer (Ober-, Unter-, Mittelhut der Stange, die linke Hand vorn) stellen den
   **linken** Fuss vor. Bei der Saufeder ist das deutlich: vordere Hand links, vorderer Fuss rechts dreht den Rumpf
   gegen die Waffe. Vorschlag: linker Fuss vor, Stoss mit Nachtritt rechts. `Messer_Stand` stimmt (links vor).
7. **Ganze Drehungen in den UAL2-Klingenhieben** — **behoben D456** für die Spielfigur (§9.2: `Klinge_Hieb_A/B`, `Klinge_Schwer`,
   `Klinge_Lauf` mit Schritt, Rumpf 64–66°; der Wegelagerer spielt die UAL2-Clips noch). (`Klinge_U_A/B/C`: Schulterlinie dreht bis ±180°, Ausfall bis
   30 cm, Füsse nah am Boden bis 6 m/s) — in den hier gelesenen Stellen von Lecküchner und Ringeck schlägt man mit
   Schritt oder Sprung zur Seite, eine Drehung um die eigene Achse kommt dort nicht vor (eine Gradzahl für die
   Rumpfdrehung nennen die Quellen nicht). Gehört zur Klingen-Überarbeitung nach D423, nicht jetzt.
8. **Kommentar in `tools/heldbau.py`** (D188: Fingergriff links „aus TreeChopping_Loop (Axt mit beiden Händen)“) —
   der Clip ist einhändig (§3). Der Griff selbst taugt; nur die Begründung stimmt nicht. Bei der nächsten Arbeit an
   `heldbau.py` korrigieren (die Datei gehört nicht zu diesem Auftrag).

### 5.1 D429: die Zweihand-Fällaxt — ausgeführt

Flo 22.11.2026 (Ledger D429): vier Fehler an der Axt, alle bestätigt. Gebaut nach §4.3 (Forsthandbuch), geprüft an den
ausgelieferten Dateien (`tests/axtgriff.test.ts`: three.js spielt `held-clips.glb` und `waffen.glb` ab wie das Spiel).

**Wie die Hände halten.** Das Modell hängt weiter an `hand_r` (Spielhand). Sein Ursprung ist die **vordere** Griffstelle
(¾ den Stiel hinauf, 65 cm vor dem Ende), das Stielende liegt als `griff_links` 0,62 m dahinter (3 cm vor dem Ende, der
kleine Finger auf dem Knauf). Die Clips legen die linke Hand je Bild auf die Stielachse an die Stelle `griff`
(`tools/waffenclips.py` Posenfeld, `tools/weltformel.py` `stiel`); die Szene schiebt das Modell nach jedem Mixer-Schritt
entlang seiner Achse, bis das Stielende in der linken Hand liegt (`gleiteAmStiel`, `src/kampf/waffenhand.ts`; Spielerin und
Axtmann). So **gleitet die rechte Hand**, wie das Handbuch es verlangt: in der Hut 40 cm vom Ende, beim Ausholen 63 cm (zum
Kopf), im Treffen 14 cm (beide Hände am Ende); die linke verlässt das Ende nie. Liegt die linke Hand nicht am Stiel (Rolle,
Gang, Treffer), hält die rechte die Axt allein an der vorderen Griffstelle.

**Clips** (alle aus Schlüsselbildern, Hüfte führt, Gewicht nach vorn, Füsse stehen vom Scheitel bis zum Durchzug,
Nachschwung nach D420 — Soll Axt seit D429 44° / 67 %):

| Clip | Dauer | Scheitel / Durchzug | Schneide ↔ Bahn im Scheitel / Durchzug (vorher) | rechte Hand vom Stielende Scheitel → Durchzug | Nachschwung / Halt |
|---|---|---|---|---|---|
| `Axt_Hieb` (statt `Axe_Overhead`) | 1,417 s | 12 / 16 | **19° / 6°** (160° / 60°) | 63 → 14 cm | 49° / 72 % |
| `Axt_Quer` | 1,250 s | 10 / 15 | **4° / 2°** (8° / 16°) | 63 → 14 cm | 86° / 73 % |
| `Axt_Schwer` | 1,667 s | 20 / 25 | **1° / 4°** (108° / 5°) | 44 → 14 cm | endet am Boden, Becken −5 cm / 73 % |
| `Axt_Lauf` | 1,083 s | 7 / 11 | **10° / 5°** (43° / 26°) | 63 → 14 cm | 53° / 73 % |
| `Axt_Stand`, `Axt_Block` | 2,042 / 0,333 s | — | — | Hut 40 cm, Block 60 cm | — |

Dauer, Scheitel und Durchzug **wie vor D429** (Test). Schneide gemessen als Winkel zwischen Schneide und Bahn der Kopfmitte
quer zum Stiel, im Scheitel die Richtung des beginnenden Schlags, im Durchzug die, aus der er kommt; dazwischen bis 4° (Lauf
19°). Vorher = dieselbe Messung an der Fassung aus git (Axt starr an der rechten Hand). Die Schneide führt, weil das
Handgelenk jetzt nach der Bahn des **Kopfs** gedreht wird (vorher nach der der Hand) und schon beim Ausholen in die künftige
Schlagrichtung steht. Das Modell legt die Schneide nach −X — wie `waffenclips.py` annimmt (Test `waffenmodelle.test.ts`).

**Abweichungen, benannt:** (1) Im Spalthieb reicht die rechte Hand im Scheitel nur 44 cm vom Ende hinauf (nicht ¾): Hängt
der Kopf tiefer hinter dem Rücken, reicht der linke Arm nicht mehr ans Stielende (geprüft: die Hand verliesse den Stiel um
13 cm) — der Scheitel liegt deshalb mit waagrechtem Stiel über dem Kopf. (2) Auch in der Hut rückt die linke Hand 5 cm zur
rechten (Arm zu kurz für 0,42 m). (3) Der Querhieb und der Laufhieb sind Kampfhiebe; das Forsthandbuch kennt nur den Hieb über
die rechte Schulter (Vor- und Rückhand) — die Griffregel gilt für alle, die Bahn nicht.

**Timing — Vorschlag, nicht angewendet** (Kampfwerte, Messbedarf Kampfbot D407 mit Siegquoten gegen Menschen): Der Kopf
schwingt im Aktivfenster 165° (Hieb), 170° (Quer), 137° (Spalthieb), 172° (Lauf). Aus voller Leistung (zwei Hände,
`content/gewicht.json`: 840 W, Trägheit 0,68 kg·m² + Arm 0,5) braucht 120° 0,19 s, also t = 0,19 s · (θ/120°)^⅔: Axthieb
**0,23 s** (Regel 0,16), Querhieb **0,24 s** (0,20), Spalthieb **0,21 s** (0,18), Laufhieb **0,24 s** (0,16). Die Regel
ist 15–50 % schneller als die Physik (Überschlag — Leistung und Zweihandfaktor sind nicht belegt). Ein längeres Aktivfenster
heisst aber auch länger treffen; die Physik verlangt eigentlich den **Schwung**, nicht das Fenster. Vorschlag: Aktiv wie oben,
dafür Vorlauf um dieselbe Zeit kürzen (Axthieb 0,37 → 0,30 s), damit die Schlagzeit gleich bleibt — erst messen.

**Nachtrag D452 (23.11.2026):** gemessen — Variante B (dieser Vorschlag) geht durch das Kampftor, bleibt aber Vorschlag (§5.2).

### 5.2 D452: Körper nach dem Spaltvideo, Trefferfenster A gegen B

Flo 23.11.2026 („mach 2“, A-45 (2)): den Körper der Axtclips nach dem Befund aus §7.4 nachziehen und das Timing per Kampfbot
messen. **Geändert:** `Axt_Hieb` und `Axt_Schwer` (`tools/waffenclips.py`), eingefügt in die Fassung aus git von
`public/figuren/held/held-clips.glb` (786 → **789 KB**, Budget 800; die übrigen 34 Clips unverändert). Bilder, Scheitel,
Durchzug und Clipdauer bleiben (Test), ebenso Zweihandgriff, Schneide in Schlagrichtung und alle Prüfungen aus D429
(`tests/waffenclips.test.ts` 203/203, `tests/axtgriff.test.ts` 53/53). **Kein Kampfwert geändert.**

**Was das Video wirklich zeigt.** Die Schlüsselposen von Hieb 2 (`.cache/d430/cleaving/cleaving.json`) lesen sich anders, als
die Kurzform „Gewicht 0,43 m nach vorn“ in §7.4 nahelegt: Die 0,43 m sind die **Spanne des Beckens**, und das Becken geht im
Schlag **zurück** (Scheitel +0,21 m, Treffen −0,20 m), während der Rumpf bis 68° vorklappt — ein Hüftknick. Der Schwerpunkt
wandert über das Vorbeugen nach vorn, nicht über das Becken. Würde man bei 50–60° Vorbeugen auch das Becken nach vorn
schieben, läge der Schwerpunkt vor den Zehen (Physik D398). Die Prüfung aus D414 („`koerper` v steigt vom Scheitel zum
Durchzug um > 0,1 m“) verlangt aber, dass das Becken vorwandert; sie hält, weil das Gewicht im Scheitel jetzt auf dem
hinteren Fuss liegt (Fechtbuch, §4) und das Becken von dort nur 13–14 cm vor geht. **Vorschlag:** die Prüfung auf den
Schwerpunkt umstellen (Becken + Rumpfneigung), nicht auf das Becken — nicht gemacht, weil es eine Prüfung aus D414/D429 ist.

**Körperwerte alt → neu** (Pose + Hut wie im Clip; Becken und Rumpf aus den Schlüsseln, Schwerpunkt als Überschlag:
Rumpf+Kopf 58 % bei 0,6 × 0,45 m entlang des Rumpfs, Beine 32 %, Arme 10 %, Axt 3 %; Stütze = Ferse hinten bis Zehen vorn;
Axtkopf = Hand + Stielrichtung × Abstand nach D429; Video aus §7.4):

| | `Axt_Hieb` D429 → **D452** | `Axt_Schwer` D429 → **D452** | Video Spalten (Hieb 2) |
|---|---|---|---|
| Becken im Scheitel über der Hut | −1 cm → **+4 cm** (aufgerichtet) | 0 → **+3 cm** | +8 cm |
| Becken Scheitel → tiefster Punkt | 17 → **29 cm** | 25 → **33 cm** | 30 cm |
| Rumpf vor (grösste Neigung) | 35° → **51°** | 41° → **63°** | 68° |
| Becken vor Scheitel → Durchzug | 14 → **13 cm** | 24 → **14 cm** | −40 cm (zurück) |
| Schwerpunkt vor Scheitel → Durchzug (Überschlag) | 28 → **32 cm** | 40 → **35 cm** (bis 38) | — (nicht gemessen) |
| Schwerpunkt im Durchzug / vordere Stützgrenze | 0,22 / 0,31 → **0,24 / 0,41 m** | 0,28 / 0,43 → **0,24 / 0,43 m** | — |
| linker Fuss | steht in der Hut → **setzt beim Ausholen 10 cm weiter vor, steht ab Bild 9** | +12 cm ab Bild 17 (unverändert) | stehen, 0,32 m auseinander |
| Axtkopf im Durchzug (Treffhöhe) | 0,72 → **0,79 m** (Hüfthöhe 0,96 m kurz vor dem Durchzug durchlaufen) | 0,15 → **0,15 m** (am Boden) | Spaltblock in Kniehöhe |
| Schneide ↔ Bahn Scheitel / Durchzug (`axtgriff.test.ts`) | 19° / 6° → **7° / 4°** | 1° / 4° → **1° / 7°** | — |
| rechte Hand vom Stielende Scheitel → Durchzug | 63 → 14 cm (gleich) | 44 → 14 cm (gleich) | — |
| Nachschwung / Halt (Soll 44° / 67 %) | 49° / 72 % → **46° / 72 %** | endet am Boden, Becken −6 cm (Test ≥ 4) / 73 % | Holz hält die Axt |

Die Hände treffen im Hieb tiefer und weiter vorn (Durchzug 1,15 → 0,98 m hoch, 0,45 → 0,62 m vor), weil die Schultern mit
dem Vorbeugen 13 cm tiefer liegen; im Spalthieb liegt der Stiel im Treffen flacher (Spitze ≥ 5 cm über dem Boden, Test).
Der Fällhieb bleibt flacher gebeugt als das Spalten (51° gegen 68°), weil er auf Hüfthöhe zielt, nicht auf Kniehöhe.
**Abweichungen, benannt:** (1) Der Schritt des linken Fusses im Hieb gleitet zwischen Bild 5 und 9 am Boden (Schlüssel ohne
Anheben, wie die Messerhiebe seit D414). (2) Im Spalthieb reicht die rechte Hand in Bild 17 nur 41 statt 50 cm hinauf (Arm zu
kurz, die linke Hand rückt am Stiel nach, `_pose` — ob die Fassung D429 dort schon kürzte, nicht geprüft). (3) Der Schwerpunkt ist ein Überschlag, keine Rechnung am Rig.

**`Axt_Quer` und `Axt_Lauf` nicht geändert.** Befund: Der Querhieb senkt das Becken vom Scheitel nur 5 cm (13 cm aus der
Hut), Rumpf 17°, das Gewicht wandert 16 cm vor — für einen waagrechten Hieb auf Hüfthöhe stimmig; das einzige freie Video eines
Querhiebs (*Standing Block*, §7.4) zeigt 2 cm auf/ab, die Hände sind dort verdeckt — kein Beleg für mehr Körper. Der
Laufhieb trägt den Körper schon mit einem Schritt von 45 cm, Becken 30 cm vor, Rumpf 33° — nicht offensichtlich steif.

**Timing: A gegen B.** (A) Trefferfenster unverändert (`content/waffen/axt.json`), nur Körper; (B) Aktiv nach Physik/Video
(§5.1), Vorlauf um dieselbe Zeit kürzer, Schlagzeit gleich: Axthieb 0,37/**0,16** → 0,30/**0,23** s, Querhieb 0,30/0,20 →
0,26/0,24, Spalthieb 0,90/0,18 → 0,87/0,21, Laufhieb 0,20/0,16 → 0,12/0,24 (Erholung, Schaden, Kosten gleich; die Clipbilder
bleiben, die Szene legt jede Phase auf ihren Clipabschnitt). Gemessen mit `tools/waffenmessung.ts` (Bot D407, Axt, Saat 5000…,
**1.000 Kämpfe je Zelle**, 90 Zellen: elf Tieraufstellungen aus `reinigensim.ts` × drei Profile × töten / immer reinigen,
dazu Wegelagerer, Speermann, Axtmann, Wegelagerer+Wolf × drei Profile × bis zum Tod / Aufgabe D426). Rohdaten:
`.cache/d452/messung_A.json`, `.cache/d452/messung_B.json`.

- **Kampftor** (`tests/kampfbot.test.ts`, beide Bots) mit B: **348/348 grün** — kein Band reisst.
- **Andere Prüfungen mit B:** `tests/echtzeit.test.ts` **fällt** an „die Axt holt länger aus“ (Axthieb-Vorlauf > 2 × Klinge,
  D180/ADR-0008: 0,30 gegen 2 × 0,18 s) — eine Regel des Waffenwerks, kein Messband; `tests/kampfprotokoll.test.ts` fällt am
  Fingerabdruck von D171 (erwartet: der Fingerabdruck hält die Kampfwerte fest). Baukasten, Gewicht, Trefferwucht, Aufgabe,
  Waffenclips grün.
- **Mittel über alle Zellen:** Tiere Siege −0,6 Punkte (−7,9 … +2,6), Zeit −2 % (−41 … +63 %); Menschen Siege −0,6 Punkte
  (−9,2 … +3,8), Zeit −4 % (−17 … +3 %). 62 von 90 Zellen bleiben unter 3 Punkten und 5 %.

Zellen mit ≥ 3 Punkten Siege oder ≥ 5 % Zeit (28 von 90):

| Aufstellung | Spiel | Profil | Siege A → B | Zeit A → B | erlitten A → B | Δ Siege | Δ Zeit |
|---|---|---|---|---|---|---|---|
| grathorn | töten | parierend | 100 % → 100 % | 7.1 s → 6.7 s | 7 → 24 | +0.0 | -6 % |
| grathorn | immer reinigen | aufmerksam | 99 % → 96 % | 28.7 s → 46.6 s | 12 → 29 | -3.6 | +63 % |
| grathorn | immer reinigen | müde | 95 % → 93 % | 27.8 s → 29.8 s | 52 → 60 | -1.3 | +7 % |
| fuchs | töten | aufmerksam | 100 % → 100 % | 4.2 s → 3.4 s | 2 → 0 | +0.0 | -20 % |
| fuchs | töten | müde | 100 % → 100 % | 3.8 s → 3.3 s | 9 → 0 | +0.0 | -14 % |
| fuchs | töten | parierend | 100 % → 100 % | 4.8 s → 2.8 s | 7 → 0 | +0.0 | -41 % |
| fuchs | immer reinigen | aufmerksam | 100 % → 100 % | 4.2 s → 3.4 s | 2 → 0 | +0.0 | -20 % |
| fuchs | immer reinigen | müde | 100 % → 100 % | 3.8 s → 3.3 s | 9 → 0 | +0.0 | -14 % |
| fuchs | immer reinigen | parierend | 100 % → 100 % | 4.8 s → 2.8 s | 7 → 0 | +0.0 | -41 % |
| wolf+fuchs | töten | aufmerksam | 100 % → 100 % | 24.2 s → 20.9 s | 19 → 20 | -0.1 | -14 % |
| wolf+fuchs | töten | parierend | 100 % → 100 % | 5.8 s → 5.1 s | 5 → 3 | +0.0 | -11 % |
| gams+gams | töten | aufmerksam | 99 % → 95 % | 22.9 s → 21.9 s | 22 → 33 | -4.5 | -4 % |
| gams+gams | immer reinigen | müde | 54 % → 48 % | 21.9 s → 22.3 s | 84 → 87 | -6.1 | +2 % |
| keiler+grathorn | immer reinigen | aufmerksam | 99 % → 98 % | 48.1 s → 54.1 s | 21 → 24 | -0.8 | +12 % |
| keiler+grathorn | immer reinigen | müde | 74 % → 66 % | 46.8 s → 52.0 s | 56 → 67 | -7.9 | +11 % |
| wolf+wolf+wolf | töten | parierend | 14 % → 12 % | 14.5 s → 13.8 s | 15 → 16 | -1.7 | -5 % |
| wolf+wolf+wolf | immer reinigen | müde | 2 % → 2 % | 29.1 s → 30.6 s | 99 → 99 | +0.1 | +5 % |
| wolf+fuchs+fuchs | töten | parierend | 3 % → 3 % | 14.0 s → 11.0 s | 7 → 6 | +0.6 | -21 % |
| wolf+fuchs+fuchs | immer reinigen | parierend | 10 % → 12 % | 18.0 s → 13.1 s | 35 → 33 | +2.6 | -27 % |
| axtmann | bis zum Tod | müde | 67 % → 58 % | 21.6 s → 20.0 s | 61 → 71 | -9.2 | -7 % |
| axtmann | bis zum Tod | parierend | 100 % → 99 % | 7.6 s → 7.0 s | 14 → 31 | -0.9 | -7 % |
| axtmann | Aufgabe D426 | aufmerksam | 99 % → 98 % | 5.4 s → 4.9 s | 6 → 8 | -1.2 | -9 % |
| axtmann | Aufgabe D426 | müde | 76 % → 68 % | 11.6 s → 9.6 s | 39 → 44 | -7.4 | -17 % |
| axtmann | Aufgabe D426 | parierend | 100 % → 100 % | 3.7 s → 3.5 s | 4 → 3 | +0.0 | -6 % |
| wegelagerer+wolf | bis zum Tod | aufmerksam | 100 % → 100 % | 25.2 s → 23.7 s | 23 → 24 | +0.1 | -6 % |
| wegelagerer+wolf | bis zum Tod | müde | 60 % → 64 % | 22.8 s → 22.2 s | 76 → 76 | +3.4 | -3 % |
| wegelagerer+wolf | Aufgabe D426 | aufmerksam | 100 % → 100 % | 24.9 s → 23.4 s | 22 → 24 | +0.1 | -6 % |
| wegelagerer+wolf | Aufgabe D426 | müde | 61 % → 65 % | 22.3 s → 21.5 s | 75 → 74 | +3.8 | -3 % |

**Lesart.** B macht die Axt nicht schwerer, sondern anders: Das längere Aktivfenster fängt schnelle Gegner (Fuchs 20–41 %
schneller, Wolf+Fuchs −14 %), der kürzere Vorlauf kostet den müden Spieler gegen Haltung und Zweiergruppen Siege (Axtmann
müde −9/−7 Punkte, Keiler+Grathorn reinigen müde −8, Gämsen müde −6) und lässt mehr Schaden zu (Grathorn parierend 7 → 24,
Axtmann parierend 14 → 31 — die Parade kommt mit weniger Vorlauf später). Grathorn reinigen aufmerksam +63 % Zeit (28,7 →
46,6 s). Dass B das Gewicht besser zeigt, gilt nur für die Bewegung zwischen Scheitel und Durchzug (0,16 → 0,23 s, Video
0,28 s); das Ausholen wird dafür kürzer (Axthieb 0,37 → 0,30 s) — genau der Teil, an dem man im Spiel die Masse liest
(D419, Telegraf).

**Empfehlung: A übernommen** (Körper neu, Trefferfenster wie bisher). B geht sauber durch das Kampftor, aber (1) es bricht
die Regel des Waffenwerks „die Axt holt mehr als doppelt so lange aus wie die Klinge“ (ADR-0008, D180) — das wäre Flos
Entscheidung, nicht die einer Messung; (2) es zeigt das Gewicht nicht eindeutig besser (Schwung langsamer, Ausholen kürzer);
(3) es verschiebt die Balance gegen schnelle Tiere zugunsten und gegen Menschen und Paare zulasten des müden Spielers. **B bleibt
Vorschlag** (A-49). Nicht gemessen und vielleicht der physikalisch richtigere Weg: **C** — Aktiv verlängern, Vorlauf lassen
(Schlagzeit +0,03 … +0,08 s, die Axt wird langsamer, nicht nur anders verteilt); braucht eine eigene Messung.

## 6. Unklar

- **UNKLAR:** Folio der Ringeck-Glosse — die Zuordnung der ersten Wiktenauer-Spalte zu Mscr.Dresd.C.487 ist aus der
  Spaltenfolge geschlossen, nicht am Scan geprüft.
- **UNKLAR:** Ob die Source-Fassung der UAL2 einen zweihändigen Hieb enthält (`Mining`, `Sword_Heavy_A–D`) — nur
  die Namen sind gelesen, die Clips nicht angesehen.
- **UNKLAR:** Reale Spitzengeschwindigkeiten von Schwert- und Axthieben und das Gewicht eines Wurfbeils — nicht belegt.
- **UNKLAR:** Saufeder in der Jagd (Phébus fol. 94r) nicht am Bild geprüft.
- Die Messung „Fuss nah am Boden“ trennt Gleiten nicht von flachem Schritt; Urteil über Fussgleiten nur am M1 in
  Bewegung.

## 7. Bewegungen aus Videos (D430)

Flo 23.11.2026: „suche videos im Web und nimm die“ — nur frei lizenzierte (gemeinfrei, CC0, CC-BY, CC-BY-SA). Ob ein
Video benutzt werden darf, regeln die Rechte am Material und die Nutzungsbedingungen der Plattform (ADR-0013 Punkt 5,
D431); YouTube, Instagram, Vimeo und Spiel- oder Filmszenen ohne freie Lizenz sind deshalb nicht gesucht. Die Videos
liegen **nur lokal** unter `.cache/videos-d430/` (nicht im Repo); abgeleitete Schlüsselposen sind eigene Arbeit mit
Quellenangabe. **Nichts ausgeliefert:** kein Clip in `held-clips.glb`, keiner Waffe zugewiesen, kein Kampfwert berührt.

### 7.1 Suche und Quellen

Gesucht (23.11.2026) auf Wikimedia Commons (Volltextsuche `filemime:video` nach sword, fencing, longsword, axe, chopping,
spear, halberd, reenactment fight, bayonet; Kategorien Historical European martial arts, Videos of fencing, Videos of
martial arts, Videos of reenactments, Bastard swords, Wood chopping, Wood chopping sports, Wood cleaving, People with
axes) und auf Archive.org (Suche nach axe, chopping, longsword, HEMA, fencing in den Prelinger-Filmen, sword mit freier
Lizenz). Commons drosselte das Laden der Originale (HTTP 429); geladen sind die von Commons selbst erzeugten
Umwandlungen (720p/1080p/480p, dieselbe Datei, dieselbe Lizenz). Bildrate und Auflösung unten = geladene Fassung.

| Titel (Commons) | Lizenz, Urheber | Bilder/s | Auflösung | Blickwinkel | Bewegung | Eignung |
|---|---|---|---|---|---|---|
| [Wood cleaving - 2016](https://commons.wikimedia.org/wiki/File:Wood_cleaving_-_2016.webm) | CC BY-SA 4.0, Jarek Tuszyński (27.08.2015) | 29,97, **Zeitlupe** (Faktor geschätzt 4, §7.4) | 400 × 720 | seitlich (rechte Seite), ruhige Kamera, ganzer Körper | Spalten von oben, zweihändig, die obere Hand gleitet; zwei Hiebe | **gut** — bester Fund; Probeclip |
| [Wood chopping competition (standing block cut)](https://commons.wikimedia.org/wiki/File:Wood_chopping_competition_(standing_block_cut).webm) | CC BY-SA 3.0, Kerry Raymond (Ekka Brisbane, 15.08.2015) | 30 | 1280 × 720 | erhöht, schräg von hinten, Zaun davor, fünf Holzfäller | Querhiebe am stehenden Block (Wettkampf, zweihändig) | **bedingt** — Körper gut, Hände im Schlag verdeckt und unscharf |
| [Bucking, splitting and stacking logs for firewood in Kõrvemaa, Estonia (October 2022)](https://commons.wikimedia.org/wiki/File:Bucking,_splitting_and_stacking_logs_for_firewood_in_K%C3%B5rvemaa,_Estonia_(October_2022).webm) | CC BY-SA 4.0, Sillerkiil (04.10.2022) | 25 | 1280 × 720 | nah und tief, Person oft halb ausserhalb, Schnitte | Kettensäge, dann Spalten mit der Axt (ab 0:34) | **schlecht** — nur Zeitbezug in Echtzeit |
| ["IMG 8252" Hand-and-a-half sword (Bastard sword) exercises](https://commons.wikimedia.org/wiki/File:%22IMG_8252%22_Hand-and-a-half_sword_(Bastard_sword)_exercises.webm) | CC BY-SA 4.0, Kuroczynski (02.09.2023) | 29,97 | 608 × 1080 (hochkant) | erst von hinten, nach einem Schnitt seitlich; ruhig | Übungen mit dem Anderthalbhänder, beidhändig: Ober- und Querhaue in die Luft | **bedingt** — einzige freie Fechtaufnahme; Klinge klein und unscharf |
| [Jomvikings Winkinger Kampftraining](https://commons.wikimedia.org/wiki/File:Jomvikings_Winkinger_Kampftraining.webm) | CC BY-SA 3.0, HelgeRieder (02.11.2013) | 24 | 854 × 480 | Handkamera mitten in der Gruppe, Regen | Gruppenkampf (Schild, Speer, Axt) | **unbrauchbar** |
| [Batalo per glavoj en la Abalaka amuzejo](https://commons.wikimedia.org/wiki/File:Batalo_per_glavoj_en_la_Abalaka_amuzejo.webm) | CC BY-SA 4.0, RG72 (30.07.2021) | 30 | 1280 × 720 | weit weg (Figur ~60 Bildpunkte) | Schwert und Schild, Schaukampf | **unbrauchbar** |
| [Modern Sword Fighting Moscow VDNHA](https://commons.wikimedia.org/wiki/File:Modern_Sword_Fighting_Moscow_VDNHA.webm) | CC BY 4.0, Predatorsamsung (18.08.2025) | 59 | 270 × 480 | weit, Zuschauer davor | Rollenspiel-Schaukampf | **unbrauchbar** |

**Nicht genommen:** *Felling a tree* (Commons, CC BY-SA 4.0) — Kettensäge; *Wood Chopping* (Commons, CC0, Uganda) —
laut Beschreibung Kettensäge, nicht angesehen; *Cutting down an uprooted tree…* — Säge; *Renaissance Martial Arts – the
Web Documentary* (Archive.org) — CC BY-ND 3.0, „keine Bearbeitungen“ ist keine der erlaubten Lizenzen; *Akademia
Szermierzy … medieval longsword techniques* (Archive.org) — keine Lizenzangabe; Ausbildungsfilme der US-Armee mit
Bajonettdrill (Commons, 1939/1943, Werke der US-Streitkräfte) — andere Waffe, nicht als Saufeder genommen; *Hand Tools for Wildfire*
(US Forest Service, 1970er) — nur über einen kostenpflichtigen Archivhändler; einen Axt-Lehrfilm des US Forest Service
führt der Katalog der National Agricultural Library (16 mm), ein Digitalisat war nicht zu finden.

**Je Waffe:**

| Waffe | Freie Videos | Bemerkung |
|---|---|---|
| Fällaxt (zweihändig) | Spalten (gut), Standing Block (bedingt), Kõrvemaa (schlecht) | Spalten ist ein Hieb von oben auf einen Block in Kniehöhe — näher am Spalthieb (`Axt_Schwer`) als am Fällhieb |
| Langes Messer | **keins** | Ersatzweise der Anderthalbhänder (zweihändig wie unser Messer seit D414, A-43 (1) offen); ein Messer führt sich anders (eine Schneide, kürzer) |
| Klinge (Seitschwert, einhändig) | **keins** brauchbar | Abalak: Schwert und Schild, zu weit |
| Saufeder | **keins** | Nur Bajonettdrill (andere Waffe) — nicht ausgewichen |
| Hirschfänger | **keins** | — |

### 7.2 Kette (`tools/videoposen.py`, nicht im Gate)

Video (OpenCV) → MediaPipe PoseLandmarker *heavy* (Apache 2.0, CPU, ~12 Bilder/s auf diesem Rechner) → 33 Punkte je
Bild in 2D und als 3D-Weltschätzung → Median über 3 Bilder und Savitzky–Golay (5) → **Füsse am Boden**: MediaPipe
legt jedes Bild auf die Hüftmitte; die Verschiebung des Körpers wird aus dem Fuss zurückgerechnet, der im Bild stillsteht
→ Körperachsen aus der Ruhe, vertauschte Seiten (Ansicht von hinten) über die Zehen erkannt, Linkshänder gespiegelt →
Maßstab je Glied auf die Wanderin (Becken und Füsse nach Beinlänge, ihr Rumpf, Arme nach Armlänge von ihren
Schultern aus) → Phasen aus dem Tempo der Hände **im Bild** (Ausholbeginn, Ausholspitze, Scheitel als Umkehrpunkt,
schnellstes Bild, Durchzug = letztes Bild ≥ 50 %, Halt < 20 %) → Schlüsselposen im Format der Posenfelder
(`hand`, `richt`, `zwei`, `griff`, `rumpf`, `huefte`, `koerper`, `fuss_l`/`fuss_r`, `pol`/`pol_l`; Ramer–Douglas–Peucker,
≤ 5 cm) in 24 Bildern/s Echtzeit. **Waffe nach Regel:** zwei sichtbare Hände geben die Achse; ist die ferne Hand verdeckt,
gilt die Armflucht. Bei der Axt (`--regel`) folgen Stielwinkel und Griff dem Forsthandbuch (D429): angewinkelt beim
Ausholen, spät gelöst im Schlag, im Durchzug in der Armflucht; `griff` −0,42 → −0,62 → −0,11. Bau des Probeclips:
`PROBE=<name.json>:<Clip>` in `tools/clipnachbau.py`, dann `clipnachbau.mjs einfuegen` in eine **Kopie**,
`kontaktbogen.py`. MediaPipe braucht zum Laden `libEGL`/`libGLESv2`; ohne Grafiktreiber genügen leere
Ersatzbibliotheken (Docstring des Werkzeugs).

### 7.3 Was die Erkennung leistet — gemessen

| Video | Person erkannt | Zittern in Ruhe (Hand, 3D / 2D) | Unterarm in 3D (5.–95. Perzentil; ein starrer Knochen) | Handhöhe 2D minus 3D | Ferne Hand verdeckt (Sichtbarkeit < 0,5) |
|---|---|---|---|---|---|
| Spalten | 245 / 245 Bilder | 1,1 cm / 0,3 px | 17–26 cm | −8 … +27 cm | 55 % der Bilder |
| Standing Block | 421 / 421 | 0,2 cm / 0,1 px | 15–26 cm | −10 … +1 cm | 98 % |
| Anderthalbhänder | 539 / 539 | 0,8 cm / 1,1 px | 19–25 cm | −9 … +102 cm (Schnitt, Ansicht von hinten) | 69 % |

### 7.4 Vergleich mit unseren Clips

Bilder bei 24/s; Bestand aus `tools/waffenclips.py` gelesen (`videoposen.py vergleich`), Video aus den Schlüsselposen.
`huefte` und Schultern in Grad wie die Posenfelder; Becken vor = Spanne von `koerper` v, auf/ab = Spanne von `koerper` h.

| Clip | Scheitel / Durchzug | Ausholen | Schlag (Scheitel→Durchzug) | Nachschwung | `huefte` ° | Schultern ° | Becken vor (m) | Becken auf/ab (m) | Füsse |
|---|---|---|---|---|---|---|---|---|---|
| `Axt_Hieb` (D429) | 12 / 16 | 11 Bilder (0,46 s) | 4 Bilder (0,17 s) | bis Bild 29 (Halt 72 %) | −6 … 12 | −30 … 8 | −0,04 … 0,12 | 0,18 tiefer | stehen ab dem Scheitel |
| `Axt_Schwer` (D429) | 20 / 25 | 19 (0,79 s) | 5 (0,21 s) | endet am Boden | 0 … 8 | −10 … 0 | −0,09 … 0,16 | 0,25 tiefer | stehen |
| **Spalten** (Hieb 2, Zeitlupe ×4) | 16 / 23 | 15 (0,63 s) | **7 (0,28 s)** | 0,03 s — das Holz hält die Axt an | −16 … 23 | −35 … 59 ¹ | **−0,21 … 0,22** | **0,30** (+0,08 aufgerichtet im Scheitel, −0,21 im Treffen) | stehen (≤ 11 cm, Messfehler), 0,32 m auseinander; Rumpf bis **68°** vor |
| `Axt_Quer` (D429) | 10 / 15 | 9 (0,38 s) | 5 (0,21 s) | 86°, Halt 73 % | −8 … 14 | −50 … 55 | −0,04 … 0,14 | 0,13 tiefer | linker Fuss tritt vor |
| Standing Block (Hieb 2) ² | 33 / 37 | 32 (1,33 s) | 4 (0,17 s) | 0,37 s | −54 … −26 | −37 … −16 | −0,30 … −0,23 | 0,02 | Ausfallstellung 0,88 m vor/zurück, stehen |
| `Messer_Quer_A` (D414/D420) | 9 / 13 | 8 (0,33 s) | 4 (0,17 s) | 82°, ab Bild 23 zurück | −8 … 14 | −48 … 56 | −0,04 … 0,17 | 0,14 tiefer | linker Fuss tritt vor |
| `Messer_Schwer` | 12 / 17 | 11 (0,46 s) | 5 (0,21 s) | endet am Boden | 0 | −12 … 0 | −0,06 … 0,19 | 0,25 tiefer | linker Fuss tritt vor |
| Anderthalbhänder (Hieb 13, Querhau) ³ | 15 / 25 | 14 (0,57 s) | 10 (0,43 s) | 0,1 s | −6 … 42 | 13 … 69 | −0,02 … 0,14 | 0,04 | Schrittstellung ~0,8 m, stehen |

¹ Seitenansicht: Die Schulterlinie liegt in der Bildtiefe, ihre Drehung schätzt die 3D-Erkennung schlecht (94° Spanne in
einem geraden Hieb von oben ist nicht glaubhaft). ² Hände in 98 % der Bilder verdeckt, die Phasen sind nicht verlässlich
(Spitzentempo 1–3 m/s — die Unschärfe verschluckt den Schlag). ³ Übung in die Luft, langsam; kein Kampftempo.

**Lesart.** (1) **Timing:** Das Spalten braucht vom Scheitel bis zum Durchzug 7 Bilder (0,28 s) gegen 4 bei `Axt_Hieb`
und holt 4 Bilder länger aus. Das stützt den Vorschlag aus §5.1 (Physik: Aktiv 0,23 s statt Regel 0,16 s) — mit dem
Vorbehalt, dass der Zeitlupenfaktor geschätzt ist (Faktor 3–5 gäbe 0,21–0,35 s; **UNKLAR**). Kampfwerte bleiben, wie sie
sind (D423). (2) **Körper:** Im Video arbeitet der ganze Körper viel mehr als in unseren Clips — das Becken fällt 30 cm
vom Scheitel zum Treffen, der Rumpf beugt sich bis 68° vor, das Becken bewegt sich über 0,43 m (**D452:** vom Scheitel zum
Treffen geht es **zurück**, der Schwerpunkt wandert über das Vorbeugen — §5.2); `Axt_Hieb`: 18 cm, 32°,
0,16 m. Teils liegt das am Ziel (Spaltblock in Kniehöhe, Fällkerbe in Hüfthöhe), teils ist es genau das, was D419
(Gewicht sichtbar) verlangt. (3) **Füsse:** stehen im Video während des Hiebs (USFS und D429 bestätigt); im Scheitel
richtet sich der Körper auf (+8 cm), statt sich hinten hineinzulegen. (4) **Hüftdrehung:** aus einer Kamera nicht
verlässlich messbar (¹); ob die Hüfte vor den Schultern dreht, ist aus diesen Videos **nicht** belegt.

### 7.5 Probeclip und Prüfbilder

**`Axt_Video_cleaving_2`** — aus Hieb 2 des Spaltvideos, 27 Bilder (1,13 s), 21 Schlüssel, Scheitel 16 / Durchzug 23,
Grundhaltung `Idle`, Waffe nach Regel (`--regel`). Gebaut mit `PROBE=` über `clipnachbau.py` auf die Hauptfigur:
Klinge ≤ 3° neben `richt`; die rechte Hand trifft ihr Ziel bis Bild 25 auf ≤ 3 cm, in Bild 26–27 (tiefstes Bücken)
bis 8 cm daneben; die linke Hand liegt bis 25 cm neben der Stielachse, wo die Regel den Stiel anders legt, als der Arm
der Figur reicht. Nur in einer Kopie von `held-clips.glb` (786 → 809 KB, Ruhelagen 66 Knoten gleich), **nicht**
eingefügt, keiner Waffe zugewiesen. Datei `.cache/bilder/D430/probe_axt_video_cleaving_2.glb`. Zwei weitere Proben
nur für die Bilder: `Axt_Video_standingblock_2`, `Messer_Video_langschwert_13`.

Prüfbilder (Formprüfung in Blender Cycles, keine Look-Abnahme, Bewegung nur am M1 — ADR-0005; je Spalte oben das
Videobild mit erkanntem Skelett, in der Mitte die 3D-Schätzung von der Seite mit der Waffe nach Regel, unten der
Probeclip auf unserer Figur): `.cache/bilder/D430/axt_spalten_kontakt.png`, `.cache/bilder/D430/axt_quer_kontakt.png`,
`.cache/bilder/D430/messer_langschwert_kontakt.png`; dazu der Bestand mit derselben Kamera:
`.cache/bilder/D430/bestand_axt_hieb_kontakt.png`, `.cache/bilder/D430/bestand_axt_quer_kontakt.png`,
`.cache/bilder/D430/bestand_messer_quer_kontakt.png`. Kein Vorher/Nachher-Paar, weil im Spiel nichts geändert ist.
Im Spaltbogen folgt die Figur dem Video in Absenken, Aufrichten im Scheitel, Vorbeugen im Treffen; Querhieb und
Anderthalbhänder zeigen eine stimmige Stellung, aber keine brauchbare Waffenführung.

### 7.6 Bewertung — ehrlich

- **2D gut, 3D schwach.** Die Person wird in jedem Bild gefunden, das 2D-Skelett sitzt. Die 3D-Schätzung aus einer
  Kamera schwankt in der Tiefe: Ein starrer Unterarm misst 17–26 cm (±20 %), die Handhöhe weicht über dem Kopf bis
  27 cm vom Bild ab, die Schulterdrehung in der Seitenansicht ist nicht zu gebrauchen. In Ruhe zittert es kaum (≤ 1 cm);
  das Problem ist die Tiefe, nicht das Zittern.
- **Bewegungsunschärfe.** Bei 30 Bildern/s springt das Treffbild (einzelne Bilder 2–3× schneller als die Nachbarn); das
  Spitzentempo ist nicht messbar (Spalten mit Faktor 4: 19 m/s — Artefakt; Standing Block 1–3 m/s — verschluckt). Die
  Phasengrenzen stimmen auf ±1 Bild (33 ms) — für Ausholen und Halt genug, für einen Schlag von 4–7 Bildern grob.
- **Die verdeckte Hand.** Von der Seite oder von hinten ist die ferne Hand in 55–98 % der Bilder verdeckt; MediaPipe
  rät sie. Damit fehlt die zweite Hand für die Waffenachse, und die Fingerpunkte (Hand ~20 Bildpunkte) lagen bis 125°
  neben der wahren Stielrichtung. **Die Waffe ist reine Regel** — plausibel, aber erfunden.
- **Was die Kette kann:** die Körperlinie realer Menschen — Gewichtsverlagerung, Absenken, Rumpfneigung, Fussstellung
  und der Rhythmus Ausholen/Pause/Schlag/Halt. Genau das fehlt unseren Clips (§5, D419).
- **Lohnt sie gegenüber Fechtbuch + Hand?** Als **Ergänzung ja** — für Körper und Timing einer Bewegung, für die es ein
  gutes freies Video gibt (je Video etwa eine Stunde mit Prüfung). Als **Ersatz nein**: Für Langes Messer, Klinge,
  Saufeder und Hirschfänger gibt es kein freies Video, die Waffe fehlt, und Tiefen- und Seitenfehler müssen von Hand
  korrigiert werden. Fechtbuch und Forsthandbuch bleiben die Vorlage für Stellung und Waffenführung.
- **Reicht das für die Messlatte D432 (Dawnwalker, Soulframe, For Honor)? Nein.** Gewicht, Lesbarkeit des Ausholens,
  Fluss zwischen Hieben und Richtungsführung leben dort von sauber erfasster Bewegung samt Waffe (optisches Motion
  Capture mit vielen Kameras, hohe Bildrate) und von Hand nachgearbeiteten Übergängen. Eine Kamera mit 30 Bildern/s ohne
  Waffe liefert das nicht. Was es bräuchte: **eigene Aufnahmen** — eine Person, Übungswaffen in Länge und Gewicht
  unserer Modelle mit zwei Farbmarken am Ende und an der Spitze, **2–3 Kameras** (seitlich, vorn, schräg) mit ≥ 120
  Bildern/s und gemeinsamem Startsignal; dann Triangulation statt Schätzung (Tiefe und verdeckte Hand gelöst, Waffe aus
  den Marken). Freie Werkzeuge dafür gibt es; ihre Lizenzen sind in dieser Arbeit **nicht geprüft** (**UNKLAR**). Ein
  besseres 3D-Verfahren aus einer Kamera löst die Waffe nicht und braucht oft Körpermodelle mit nicht-kommerzieller
  Lizenz (nicht im Einzelnen geprüft).

### 7.7 Unklar (D430)

- **UNKLAR:** Zeitlupenfaktor des Spaltvideos — geschätzt 4 (120 Bilder/s, aus der Dauer des Abwärtsschwungs, real
  ~0,3 s); 8 (240 Bilder/s) gäbe einen Schlag von 0,14 s. Ein Messpunkt (Fallzeit eines Scheits) fehlt.
- **UNKLAR:** Lizenzen freier Mehrkamera-Werkzeuge (Triangulation) — nicht geprüft.
- Die Phasenerkennung braucht Hilfe (`--abwaerts`, `--hiebe`, `--ausschnitt`), sobald mehrere Personen im Bild sind oder
  der Mensch zwischen den Hieben umhergeht (Kõrvemaa: 13 „Hiebe“, die meisten Gehen und Holz Legen).

## 8. Fertige Bewegungsquellen (D453)

Flo 23.11.2026: „ich will die Videos nicht selber machen und ich kenn auch niemanden. Es muss doch hierzu schon etwas
geben was man nutzen kann und passt oder wir als Vorlage nehmen können und bei uns implementieren.“ Ziel bleibt die
Messlatte D432 (Gewicht, lesbares Ausholen, flüssige Übergänge, Richtungsführung) — als Qualität, nicht als Kopie
(D431). Gesucht: fertiges Motion Capture und Animationen für Nahkampf mit Waffen, frei **und** kostenpflichtig.
Lizenzen an der Primärquelle gelesen, wo erreichbar, **Abruf 23.11.2026**; wo nur eine Wiedergabe erreichbar war, steht
das dabei. **Keine Rechtsberatung.** Ledger D453, Fragen A-50.

**Die Kernfrage ist dieselbe wie bei ADR-0021:** Ein Browser-Spiel liefert jede Animation als Datei (`.glb`) aus, die
jeder Besucher mit den Entwicklerwerkzeugen des Browsers speichern kann. Fast alle kommerziellen Mocap-Lizenzen
erlauben den Einsatz in Spielen nur, wenn die Daten **nicht herauslösbar** bzw. **kompiliert** sind. Ein komprimierter
GLB-Clip ist umgearbeitet, aber herauslösbar. Darum lautet bei diesen Quellen die Antwort „unklar“ bis „nein“, auch
wenn der Preis klein ist.

### 8.1 Vergleich

**Browser** = darf es in einem Browser-Spiel mitgeliefert werden: **ja** / **nein** / **unklar** (mit Grund).

| Quelle | Inhalt (Waffen, Hände, Clips, Art) | Format, Skelett | Lizenz (Primärzitat, Quelle, Abruf 23.11.2026) | Browser | Preis |
|---|---|---|---|---|---|
| **Quaternius UAL2 Standard** | 43 Clips, zehn mit Waffe, alle einhändig (Schwertkombo, Block, Wurf, Hacken), von Hand animiert (§1–3) | GLB/FBX, UE-Mannequin | „CC0 1.0 Universal“ (`License.txt`; https://quaternius.itch.io/universal-animation-library-2, D428) | **ja** | 0 $ (geladen, D428) |
| **Quaternius UAL2 Source** | +~90 Clips: `Sword_Heavy_A–D`, `Sword_Light_A–D` (+ `_Rec`), `Sword_Aerial_*`, `Melee_Combo`, `Mining` (Spitzhacke, vermutlich zweihändig), Bogen; von Hand animiert, stilisiert; nicht angesehen | `.blend` + Exporte, UE-Mannequin | CC0 wie oben; Source-Zip „if you pay $14.99 USD or more“ (itch.io) | **ja** (CC0) | 14,99 $ |
| **CMU Graphics Lab Mocap** | 2.605 Aufnahmen, optisch, 120/s. Mit Waffe: **`02_07`–`02_09` „swordplay“** (Stab ohne Marker, zweihändig, langsam: Hand ≤ 2,7 m/s), **`79_01`, `80_71` „chopping wood“** (Pantomime ohne Axt, zweihändig, Hand 7–10 m/s); dazu Schläge, Tritte, Karate-Formen (`135_*`) | ASF/AMC (eigenes Skelett, 31 Knochen); BVH-Umwandlungen Dritter | „free for all uses“ (Startseite); „You may include this data in commercially-sold products, but you may not resell this data directly“ (http://mocap.cs.cmu.edu/faqs.php) | **ja** — im Spiel eingebaut ist „include … in products“; nicht als eigenes Datenpaket anbieten | 0 $ |
| **Mixamo (Adobe)** | Pakete u. a. *Sword And Shield*, *Great Sword* (zweihändig); Axt- oder Speerpaket nicht gefunden (Liste nicht am Primärtext geprüft); Mocap mit Nacharbeit | FBX, Mixamo-Skelett | Adobe-FAQ (helpx vom Rechner aus **HTTP 403**; Wortlaut aus Community-FAQ vom 29.09.2022 und Suchauszug): Spiele royalty-free erlaubt; „the only thing you can't do is distribute the raw character and animation files“; „may not distribute the files to customers“ (https://community.adobe.com/t5/mixamo-discussions/mixamo-faq-licensing-royalties-ownership-eula-and-tos/td-p/13234775); kein ML-Training | **unklar → eher nein**: ein GLB-Clip im Browser ist die Animationsdatei beim Kunden | 0 $ (Adobe-Konto) |
| **MoCap Online**, freies *T.C. Sword* | Schwertkampf-Auswahl (Angriff, Block, Bewegung), Mocap | FBX, BIP, Blender, Unity, UE; MotusMan v55 | Standard License §1.1: „prevents their extraction for further distribution, reproduction“; §2.1: „cannot be extractable in a format that allows their reuse“, „Distribution is allowed only as binary-only“ (https://mocaponline.com/pages/license) | **nein** — GLB im Browser ist herauslösbar | 0 $ |
| **MoCap Online**, Bezahlpakete | Im Shop (Katalog mit 34 Produkten) **kein** Schwert-, Axt- oder Speerpaket mehr; Nahkampf nur *Ninja* (139,99 $), *Punch* (10,99 $) | wie oben | wie oben | **nein** | — |
| **Unity Asset Store** (z. B. Kubold *Spear And Halberd Animset*: 176 Mocap-Clips, Stangenwaffe, laut Anbieter auch Zweihandschwert/-axt; Protofactor *Animset 2-Handed Melee Weapon*; Kubolds *Longsword Animset Pro* ist zurückgezogen) | Mocap (Kubold); Protofactor-Inhalt auf der Seite nicht lesbar | FBX, Humanoid/HumanIK | EULA §2.2.1(b): Weitergabe nur „as incorporated and embedded in that Licensed Product“; keine Engine-Bindung (https://unity.com/legal/as-terms). Kubold-FAQ: andere Engines ja, das Spiel muss vor der Weitergabe kompiliert („built“, „cooked“) sein (https://www.kubold.com/faq-unity) | **unklar** (EULA) / **eher nein** (Kubold: „kompiliert“ trifft auf GLB nicht zu) | Kubold 49,99 $, Protofactor 21,99 $ |
| **Fab** (Epic; z. B. Kubold *FPP Melee Animset* — nur Ich-Perspektive) und itch.io-Pakete (GameDevHero *Two Handed Sword V3*: 471 Clips, UE5-Manny/Mixamo) | Mocap/Hand, meist UE-Skelett | FBX, UE | Fab Standard License: Endnutzer am Herauslösen hindern (nur Wiedergabe aus dem Forum; Volltext wie bei ADR-0021 nicht gelesen); GameDevHero: externe Lizenz nicht gelesen | **unklar** (gleiche Frage wie ADR-0021) | 19,99–74,99 $ |
| **Rokoko Motion Library** | 100 freie Clips nach Anmeldung, Rest „for the price of a coffee“; Waffenpakete nicht erwähnt | FBX über Rokoko Studio | Preisseite: „Export and use in any of your projects, including commercial ones.“ (https://rokoko.com/pricing/); Bedingungen der Bibliothek nicht gefunden | **unklar** (Weitergabe nicht geregelt) | 0 $ bis wenige $ je Clip |
| **ActorCore / Reallusion** | Mocap-Bibliothek (u. a. Kampf) | FBX/iClone | Content-EULA §6.3: „must be packaged in proprietary, compiled, or encrypted formats“; „strictly prohibited from distributing Content in any deployment architecture that permits end-users to extract“ (https://www.reallusion.com/Content/EULA/EULA.htm) | **nein** | kostenpflichtig |
| **Bandai Namco Research Motiondataset 1/2** | Alltag, Kampf (Waffe nicht genannt), Tanz in Stilen; drei Profi-Darsteller | BVH | „CC BY-NC 4.0“ (https://github.com/BandaiNamcoResearchInc/Bandai-Namco-Research-Motiondataset) | **nein** (NC) | 0 $ |
| **LaFAN1 (Ubisoft)** | 77 Sequenzen, 4,6 h, 30/s; 5 × „fight“, Zielen mit Gewehr | BVH | „Attribution-NonCommercial-NoDerivatives 4.0“ (https://github.com/ubisoft/ubisoft-laforge-animation-dataset) | **nein** (NC, ND) | 0 $ |
| **AMASS** und alles daraus (**HumanML3D**, MDM, MotionGPT) | Sammlung vieler Datensätze, SMPL | SMPL/NPZ | „for the sole purpose of performing non-commercial scientific research“; verboten u. a. „incorporation in a commercial product“ (https://amass.is.tue.mpg.de/license.html); HumanML3D „originates from a combination of HumanAct12 and Amass“ | **nein** | 0 $ |
| **100STYLE** | 100 Gangstile, kein Kampf | BVH | „Creative Commons Attribution 4.0“ (https://ianxmason.github.io/100style/) | **ja**, aber ohne Waffe | 0 $ |
| **SFU / NUS Mocap** | gemischt | BVH | nur Forschung, keine kommerziellen Produkte (https://mocap.cs.sfu.ca/) | **nein** | 0 $ |
| **BONES-SEED** (Hugging Face) | 142.220 Bewegungen, 120/s, 20 „Martial Arts“, keine Waffe genannt | BVH (SOMA) | eigene „bones-seed-license“, zugangsbeschränkt, Text nicht gelesen | **unklar** | 0 $ (Anmeldung) |
| **Text-zu-Bewegung, Forschung** (MDM, MotionGPT) | aus Text erzeugt; Trainingsdaten ohne Waffen — Waffenhiebe taugen nicht | SMPL | trainiert auf HumanML3D/AMASS (s. o.); Ausgabe-Lizenz nicht geregelt | **nein** (Herkunft NC) | 0 $ |
| **DeepMotion** (Animate 3D, SayMotion) | KI aus Video/Text; Waffe wird nicht erfasst | FBX/GLB | Nutzungsbedingungen unter der verlinkten Adresse **404**; 2024 (Beta) laut CG Channel kommerziell erlaubt | **unklar** | Abo |
| **Cascadeur** (Werkzeug: Schlüsselbilder mit Physikhilfe, AutoPosing) | kein Inhalt — eigene Animation, Schwerpunkt-, Impuls- und Flugbahnprüfung | Export FBX/DAE/USD ab Indie | Free: „Only non-commercial use“, Export nur im eigenen CASC-Format, 300 Bilder; Indie: „The revenue must be less than $100k per year“; Pro: „Commercial use with no limits“ (https://cascadeur.com/plans) | Ausgabe ist **eigene Arbeit** → **ja** ab Indie; Free **nein** (kein Export) | Indie 96 $/Jahr, Pro 396 $/Jahr |

Nicht geprüft: Plask, Move.ai (Bibliotheken), Kevin Iglesias und weitere Asset-Store-Anbieter einzeln — die
Asset-Store-EULA gilt für alle gleich, Anbieter-FAQs können strenger sein.

### 8.2 Probe: CMU auf der Hauptfigur

Die einzige freie **und** eindeutig erlaubte Quelle mit zweihändiger Waffenbewegung ist CMU. Geladen nach
`.cache/mocap-d451/cmu-daten/` (`02.asf`, `02_07–09.amc`, `79.asf`, `79_01.amc`, `80.asf`, `80_71.amc` und die Videos
`.mpg` zur Ansicht; nichts im Repo). Weg (`tools/cmuprobe.py`, neu, nicht im Gate): ASF/AMC → BVH mit eigener Umrechnung
(Welt = Eltern · C · R · C⁻¹ nach CMU-Dokumentation) → **Ruhelage auf die der Hauptfigur gedreht** (die ASF-Ruhe spreizt
die Beine 20° und hebt das Schlüsselbein; ohne diese Drehung stand die Figur im ersten Versuch mit gebeugten Knien in
der Luft) → Blender-BVH-Import → `weltformel.py` wie bei UAL2 → `clipnachbau.mjs einfuegen` **in eine Kopie** von
`held-clips.glb` (66 Knoten gleiche Ruhelage, 786 → 880 KB) → `kontaktbogen.py`. Keine Waffe zugewiesen, kein Kampfwert
berührt.

| Probeclip (Quelle, Bilder bei 120/s) | s | Hände auseinander cm (min/Median/max) | rechte Hand max m/s (Bild) | Becken tiefer cm | Rumpf ° | Fuss nah am Boden m/s |
|---|---|---|---|---|---|---|
| `Axt_CMU_Hieb` (`79_01`, 220–420) | 1,67 | 8 / 10 / 19 | 10,4 (26) | 6 | −13…49 | 0,37 |
| `Axt_CMU_Hacken` (`80_71`, 240–600, drei Hiebe) | 3,0 | 2 / 4 / 8 | 7,5 (56) | 1 | −36…16 | 0,53 |
| `Messer_CMU_Stab` (`02_07`, 1440–1800) | 3,0 | 13 / 18 / 23 | 2,6 (6) | 1 | −54…104 | 0,31 |

Bilder: `.cache/bilder/D453/cmu_axt_hieb_kontakt.png`, `.cache/bilder/D453/cmu_axt_hacken_kontakt.png`,
`.cache/bilder/D453/cmu_messer_stab_kontakt.png`, Vergleich mit derselben Kamera
`.cache/bilder/D453/bestand_axt_hieb_kontakt.png`; Probedatei `.cache/bilder/D453/probe_cmu.glb`, Messung
`.cache/bilder/D453/probe_cmu_messung.json`. Formprüfung in Blender Cycles (CPU), keine Look-Abnahme, Bewegung nur am
M1 (ADR-0005). Kein Vorher/Nachher-Paar, weil im Spiel nichts geändert ist.

**Ehrlich:** Der Körper überträgt sauber — Füsse stehen, Stellung und Ausholen über den Kopf lesen sich, beide Hände
bleiben zusammen. **Die Waffe nicht:** Die Darsteller hielten keine Axt bzw. einen unmarkierten Stab; die Klinge folgt
der Drehung der rechten Hand und zeigt deshalb in vielen Bildern quer (die Spitze rechnet sich auf 30 m/s hoch —
Artefakt). Gewicht fehlt: Pantomime ohne Last, Becken nur 1–6 cm tiefer (Spaltvideo D430: 30 cm, `Axt_Hieb` 18 cm). Das
CMU-„swordplay“ ist langsam und unbestimmt, kein Fechten. **Brauchbar als Vorlage für Körper und Rhythmus des
Ausholens, nicht als fertiger Waffenclip.** Mit der Waffe nach Regel (`--regel` aus D430) wäre ein Fällaxt-Hieb
daraus baubar — Gewicht und Waffenführung kämen dann wieder von Hand.

Die UAL2 Standard ist schon in D428 geprobt (§3); weitere freie und klar erlaubte Quellen mit Waffe gibt es nicht.

### 8.3 Empfehlung in drei Stufen

1. **Frei und sofort nutzbar.** Mehr als heute gibt es nicht: **CMU** (zweihändiges Hacken und Stabübungen, Körper und
   Rhythmus, optisch erfasst, „free for all uses“), die **UAL2 Standard** (einhändige Schwertclips, schon verwendet),
   **100STYLE** (Gangstile, kein Kampf) und die freien Videos aus D430. Keine dieser Quellen bringt eine erfasste Waffe
   oder Kampfqualität nach D432. Ehrliche Antwort auf Flos Frage: **Fertiges, freies, browser-taugliches Waffen-Mocap
   gibt es nicht.**
2. **Kostet wenig und wäre klar erlaubt** (bräuchte Flos Ausnahme von ADR-0013 Punkt 2):
   - **UAL2 Source, 14,99 $ einmalig, CC0** — die einzige Kaufquelle mit Waffenhieben, deren Lizenz die Auslieferung im
     Browser **zweifelsfrei** erlaubt. Schwere und leichte Schwerthiebe einzeln mit Erholung, `Mining` (zweihändig?);
     handanimiert und stilisiert, also Gerüst, nicht Messlatte (gleiche Frage wie A-43 (3)).
   - **Cascadeur Indie, 96 $/Jahr** (unter 100.000 $ Umsatz; Pro 396 $/Jahr) — kein Inhalt, sondern das Werkzeug, mit dem
     wir selbst Schlüsselbilder mit Physikhilfe bauen (Schwerpunkt, Impuls, Flugbahn); die Ausgabe ist eigene Arbeit. Die
     Free-Fassung taugt nicht: nur nicht kommerziell und kein FBX-Export.
   - **Nicht** in dieser Stufe: Kubold, MoCap Online, Mixamo, Reallusion, Fab-Pakete — günstig (0–75 $), aber ihre
     Lizenzen verlangen „nicht herauslösbar“ oder „kompiliert“. Möglich wäre eine **schriftliche Zusage** des Anbieters
     für die Browser-Auslieferung (A-50 (2)); Kubolds *Spear And Halberd Animset* (49,99 $, 176 Mocap-Clips) deckt
     Saufeder und laut Anbieter Zweihandwaffen ab.
3. **Vorlage zum Nachbauen** (ansehen, eigene Schlüsselbilder bauen). Reale Bewegung gehört niemandem (D431); fremde
   Gestaltung — unverwechselbare Kombos — bleibt tabu. Ohne Bedenken: **Fechtbücher** (§4, gemeinfrei),
   **Forsthandbuch** (§4.3), **CMU** (frei, auch zum Ableiten), **freie Videos** (D430). Öffentliche Vorschauvideos von
   Mocap-Paketen dürfen im Browser angesehen werden (nicht herunterladen — Plattformbedingungen, ADR-0013 Punkt 5 b), als
   Eindruck von Gewicht und Timing, nicht Bild für Bild. **Nicht** als Vorlage: Datensätze mit NC/ND (Bandai Namco,
   LaFAN1, AMASS) — schon das Ableiten nutzt das Material für ein Spiel, das kommerziell werden könnte (**UNKLAR**, ob es
   das soll). Der Bauweg bleibt `waffenclips.py` (D184/D414) mit den Vorgaben aus §4 und §5.1; die Qualität nach D432
   kommt aus Handwerk — klare Phasen (Ausholen lesbar lang, Schlag kurz, Halt), Körper vor Arm, Gewichtsverlagerung,
   Nachschwung — und aus den Übergängen (§8.4).

### 8.4 Übergänge: welches System wir brauchen

Heute: `AnimationMixer.crossFadeTo` mit 0,08–0,2 s (`src/kampf/Kampfplatz.tsx`), Clips mit eigener Anfangs- und
Endhaltung. Ein Kreuzblenden mittelt zwei Posen; bei schnellen Wechseln (Hieb → Parade, Kombo-Glied → nächstes) sieht man
das als Weichzeichnen, Füsse rutschen. Was die Vorbilder (D432) flüssig macht, ist kein einzelnes Verfahren, sondern:

1. **Gemeinsame Grundhaltung je Waffe** — jeder Clip beginnt und endet in derselben Hut (z. B. Pflug fürs Messer, Stand
   mit linker Hand am Stielende für die Axt); dann genügen kurze Blenden.
2. **Abbruch- und Kettenfenster im Clip** (Daten, `content/waffen/*.json`): ab wann ein Hieb in den nächsten, in Parade
   oder Rolle übergehen darf — Kampfwert (D423), nicht Darstellung.
3. **Inertialisierung statt Kreuzblende** (David Bollo, GDC 2018, *Gears of War 4*): Beim Wechsel spielt sofort nur der
   neue Clip; der Unterschied zur alten Pose klingt je Knochen über 0,1–0,2 s mit einer Kurve ab, die Tempo der alten
   Bewegung erhält. Billiger als zwei Clips gleichzeitig, kein Weichzeichnen; ein kleines eigenes Modul neben dem Mixer
   (Knochenversatz + Abklingkurve), renderfrei testbar.
4. **Ebenen:** Oberkörper-Angriff über Unterkörper-Gang (Maske ab `spine_01`), Treffer-Reaktion additiv obendrauf.
5. **Füsse:** Fussverriegelung bzw. Bein-IK, solange ein Fuss steht — gegen Rutschen beim Blenden und am Hang.
6. **Richtung (ADR-0009):** je Hieb drei bis vier Richtungsvarianten aus derselben Grundhaltung, gewählt statt gemischt.

*Motion Matching* (aus grossen Mocap-Mengen die passende Stelle suchen) bräuchte genau die Mengen, die es frei nicht gibt
— nicht empfohlen. Empfehlung: 1–3 vor neuen Clips (A-50 (3)), 4–6 danach.

### 8.5 Unklar (D453)

- **UNKLAR:** Ob BRACHLAND kommerziell werden soll — entscheidet über NC-Quellen und über Cascadeur Indie/Pro.
- **UNKLAR:** Adobe-Primärtext (helpx-FAQ, Nutzungsbedingungen) war vom Rechner aus nicht abrufbar (HTTP 403); die
  Mixamo-Zitate stammen aus einer Community-Wiedergabe von 2022 und einem Suchauszug.
- **UNKLAR:** Fab-EULA-Volltext und externe Lizenzen einzelner Anbieter (GameDevHero, Protofactor) nicht gelesen;
  DeepMotion-Bedingungen nicht erreichbar (404); Rokoko-Bibliotheksbedingungen nicht gefunden.
- **UNKLAR:** Inhalt der UAL2-Source-Clips nur nach Namen bekannt (wie §6).
- Die CMU-Lizenz verlangt keine Namensnennung; ein Eintrag in `assets/HERKUNFT.md` wäre trotzdem fällig, sobald ein
  CMU-abgeleiteter Clip ausgeliefert wird (ADR-0013 Punkt 3).

### 8.6 Laufzeit der Bewegung (D457)

Auftrag D455, Teil 2 von 3: alles, was **zwischen und über den Clips** geschieht. Gebaut am 23.11.2026, **nicht am M1
in Bewegung gesehen** (ADR-0005) — Formeln renderfrei geprüft (`tests/figurlaufzeit.test.ts`, 83 Prüfungen), Form im
SwiftShader-Standbild. Kein Kampfwert, kein Tempo, kein Trefferfenster geändert; `echtzeit.ts` ist nicht angefasst.

**Wo es liegt.** `src/figur/` — sieben reine Module ohne three.js und ein Adapter:

| Modul | Was |
|---|---|
| `inertial.ts` | Inertialisierung: Kurve fünften Grades, Versatz je Knochen als Achse + Winkel (Drehung) und Richtung + Betrag (Lage) |
| `kette.ts` | Dauer je Übergangsart; Clipsekunde eines Hiebs aus Phase der Regel, mit Kettenmarken |
| `clipmarken.ts` | Leser für die Marken von D456 (`content/clipmarken.json`, §9.3) → `einstieg`, `kettenpose`, `halt` in Clipsekunden |
| `ebenen.ts` | Rigplan (welcher Knochen ist was), Ober-/Unterkörper nach Knochenbaum |
| `fussboden.ts` | Flächennormale, Klemmung, Standfuss halten/lösen, Zwei-Gelenk-Dreieck |
| `fortbewegung.ts` | Tempo eines Gangclips messen, Gangmischung (Frequenz × Weite), Kurvenlage, Drehkette, Blick, Atem |
| `trefferantwort.ts` | Kippung nach Richtung und Schaden, schwingt aus |
| `feder.ts` | kritische Feder und gedämpfte Schwingung, geschlossen gelöst (unabhängig von der Bildrate) |
| `laufzeit.ts` | **einziges Modul mit three.js**: `PosenTraegheit`, `Koerperfein`, `teileClip`, `messeGang` |

Werte in `content/figurlaufzeit.json` (Schema `Figurlaufzeit`, `npm run validate`). Ein Schalter für alles: Einstellung
**„Feine Körperbewegung“** (`figurfein`, Zugänglichkeit) bzw. `?figurfein=0` — dann läuft unverändert der Weg von vor
D457 (Kreuzblende, Gang nach Schwelle, Fuss-IK von D214).

**1. Übergänge.** David Bollo, „Inertialization: High-Performance Animation Transitions in ‚Gears of War‘“, GDC 2018
([GDC Vault](https://gdcvault.com/play/1025165/Inertialization-High-Performance-Animation-Transitions)): Die Blende
zwischen zwei Clips entfällt; der Wechsel ist eine Nachbearbeitung, die den Versatz zur alten Pose mit der
Geschwindigkeit der alten Bewegung ausklingen lässt, für Vektoren und Quaternionen. Hier: Beim Wechsel wird der alte
Clip **gestoppt** und nur der neue gespielt; `PosenTraegheit` kennt die zwei zuletzt gezeigten Posen und legt den
abklingenden Versatz auf die neue. Dauer je Art aus den Daten:

| Übergang | s | | Übergang | s |
|---|---|---|---|---|
| Hut → Hieb | 0,10 | | Hieb → Hut | 0,25 |
| Hieb → Hieb (Kette) | 0,12 | | Rolle → Hut/Gang | 0,22 |
| → Rolle | 0,10 | | Treffer → Hut | 0,25 |
| → Treffer | 0,10 | | Stand ↔ Gang | 0,25 |
| → Deckung | 0,10 | | Deckung → Hut | 0,12 |
| → Fall | 0,15 | | sonst | 0,20 |

Die Formeln sind aus den Randbedingungen hergeleitet (Lage, Tempo am Anfang; Lage, Tempo, Beschleunigung null am Ende)
und geprüft, **nicht gegen die Folien gelesen** — der Vortrag war von hier aus nur als Zusammenfassung abrufbar. Läuft die
alte Bewegung vom Ziel weg, hält der Versatz an (kein Überschwingen); dort ist das Tempo nicht stetig, das ist gewollt.
Auch die menschlichen Gegner (Wegelagerer, Speermann, Axtmann; `Kampfplatz.tsx` `spieleRig`) wechseln so.

**2. Ketten.** `KOMBO_AB` (0,35 der Erholung) bleibt, wie es ist. Die Darstellung folgt den **Clipmarken von D456**
(`content/clipmarken.json`, §9.3; gelesen von `clipmarken.ts`): In der Erholung läuft der Clip bis `KOMBO_AB` vom Durchzug
genau bis `kette` (Kettenpose) — in dem Augenblick, in dem die Regel den nächsten Hieb erlaubt, steht die Figur in der
Pose, aus der er kommt; der gekettete Hieb steigt bei `einstieg` ein statt bei Bild 1, sein Vorlauf (unverändert lang)
verteilt sich auf Einstieg → Scheitel. Der Umweg über die Hut entfällt. Wird nicht gekettet, läuft der Rest der Erholung
von der Kettenpose in die Hut. Beispiel `Klinge_Hieb_A` (Durchzug 9, Kette 12, Ende 26; Erholung 0,32 s): 0,11 s für
drei Bilder Nachschwung, 0,21 s für den Rückweg — der Körper folgt der Masse langsamer, als er zurückkehrt (D419).
**Ohne Marke** für einen Clip (alte Wanderin, UAL2-Clips der Gegner) gilt die Zuordnung von D168/D171 unverändert, und
der Versatz klingt über 0,12 s ab. Abbruch (Rolle, Deckung) blendet aus der Pose, die gerade gezeigt wird. `halt` und
`vorn` werden gelesen, aber noch nicht ausgewertet (Fuss vorn in der Kettenpose → welcher Standfuss hält).

**3. Ebenen.** Geprüft, was die Regel sperrt: Im Schlag (Vorlauf, Aktiv, Erholung), in der Rolle und betäubt ist das
Gehen gesperrt (`frei()` in `echtzeit.ts`, `gesperrt` im Kampfplatz); bewegt wird die Figur dort nur um `schritt` des
Schlags. Dort gehört der ganze Körper dem Hiebclip — er bringt seinen Ausfallschritt mit. Auch die Deckung sperrt das Gehen
(`frei()` gilt nur für `bereit`). **Geschichtet wird, wo die Regel Bewegung erlaubt:** kampfbereit im Gehen — Beine
aus dem Gang, Oberkörper in der Hut der Waffe; vorher fiel die Figur beim ersten Schritt in den Wandergang mit
schwingendem Waffenarm. (Deckung über Gang ist mitgebaut, greift aber erst, falls die Regel das Gehen in der Deckung
je erlaubt — das wäre ein Kampfwert und ist hier nicht geändert.) Technik: Jeder Clip wird an `spine_01` in zwei
Teilclips geschnitten (`teileClip`); der Mixer kennt keine Masken. **Neue Clips von D456 verdrahtet:** die Deckung der
Klinge spielt `Klinge_Block` (beginnt in der Hut) statt `Klinge_U_Block`, der Markengriff (D417) `Koerper_Griff` statt
des Block-Clips. **Nicht verdrahtet:** `Koerper_Landung_Weich`/`_Hart` (die Figur kennt keinen Landemoment als Zustand)
und `Koerper_Aufgabe` (Gegner, D458). **Seit D458 verdrahtet** — Landung und Aufgabe, §8.7 (7) und (5).

**4. Füsse.** Zu D214 (Höhe, Becken) kommen: **Sohle auf der Fläche** (Normale aus vier Höhen, höchstens 22° — ein
Sprunggelenk kippt nicht beliebig; nur solange der Fuss bodennah ist) und der **Standfuss** (steht ein Fuss laut Clip,
bleibt er in der Welt stehen, auch wenn der Körper darüber dreht; ab 10 cm lässt er los, der Versatz klingt in 70 ms
ab). In Rolle, Fall und Treffer und wo die Füsse das Tempo nicht abdecken (siehe 5) hält er nicht.

**5. Fortbewegung — und ein Befund.** Das Tempo der Gangclips wird beim Laden **gemessen** (Fussbahn im Raum der
Figur, Geschwindigkeit in der Standphase): **`Walk` 1,03 m/s, `Run` 2,07 m/s.** Angenommen waren seit D145 1,7 und
6,5 m/s. Vor D457 lief der Laufschritt (4,2 m/s) als `Walk` mit 2,4-facher Geschwindigkeit — die Füsse deckten
2,5 m/s, **41 % der Strecke glitt die Figur**. Jetzt teilen sich Schrittfrequenz und Schrittweite den Faktor (je √F,
wie ein Mensch schneller läuft): bei 4,2 m/s `Run` mit Frequenz ×1,45 (174 Schritte/min; real 170–180) und Weite ×1,4
(die Fuss-IK setzt den Fuss in Laufrichtung weiter von der Hüfte) — rechnerisch **kein Gleiten bis 5,5 m/s**.
**Rennen 8,5 m/s deckt auch das nicht:** Frequenz und Weite schlagen an (×2,2 / ×1,4), rund **25 % gleiten weiter**.
Dafür braucht es einen **Sprintclip** (Standphase ≥ 4 m/s bei Rate 1) und besser einen Laufschritt-Clip mit ~3 m/s —
Sache von D456; die Kopplung misst neu, sobald die Clips da sind. **Nachtrag D460:** `Run` ist seit D460 ein Laufschritt mit 4,2 m/s
bei Rate 1 (die Laufzeit misst 4,04), der Sprintclip liegt als `Koerper_Sprint` bereit (§10.3, §10.4). **Nachtrag D461:** Die Spielfigur mischt jetzt drei Gangarten (Gang / Laufschritt / Sprint) und misst am Aufstandspunkt — bei 8,5 m/s spielt der Sprint bei Rate 1 (§10.6). Gehen und Rennen werden im selben Schritt gemischt
(die Clips beginnen 0,32 Zyklen versetzt; gemessen, ausgeglichen).

Dazu: **Kurvenlage** atan(v·ω/g) × 0,4, höchstens 10°; **Anlaufen/Abstoppen** atan(a/g) × 0,5, höchstens 6° (das Tempo
selbst setzt die Regel weiter ohne Anlauf — Spielwert; die Lage zeigt nur die Beschleunigung, die dazu gehörte);
**Drehkette** Kopf 30 ms, Schultern 70 ms, Hüfte 110 ms Halbwert, höchstens 35° Rückstand, im Schlag und in der Rolle
ohne Verzögerung (die Figur zeigt, wohin die Regel schlägt); **Blick** zum aufgeschalteten Ziel bis 70° seitlich und
30° hoch/tief, verteilt auf Brust 15 %, Hals 30 %, Kopf 55 %, ab 110° aufgegeben; **Atem** 0,25 Hz in Ruhe, bis 0,7 Hz
nach Anstrengung, klingt über 8 s ab. **Benannte Abweichungen (D398):** Kurvenlage und Schublage sind Anteile der
physikalischen Lage, weil Drehrate und Tempo von der Eingabe springen. **Blinzeln geht nicht:** `Eyes`/`Eyebrows`
sind Netze ohne Knochen und ohne Morph-Ziele.

**6. Treffer.** Der Oberkörper kippt vom Angreifer weg, 0,3° je Schadenspunkt (höchstens 14°), und schwingt mit 2,6 Hz
bei Dämpfung 0,55 aus; der Kopf bleibt ein Viertel zurück. Additiv über dem Rückstoss-Clip. Mass ist der Schaden, weil
Gegner in den Daten keine Waffenmasse führen (D427 rechnet für Treffer der Spielerin mit Impuls). **Sekundäre
Bewegung:** Das Rig hat keine Knochen für Kapuze, Haar, Köcher oder Gürteltasche (65 Knochen: Körper und Finger) —
Umsetzungsliste: je zwei bis drei Knochen in `tools/heldbau.py` einziehen, dann trägt `schwingSchritt` aus `feder.ts`
sie ohne weiteren Bau.

**7. Kosten und Wiederverwendung.** `npx tsx tools/figurbank.ts` (63 Knochen, Trägheit dauernd im Abklingen, Drehkette,
Blick, Atem, Füsse mit IK): **35–70 µs je Bild** auf dem Cloud-Rechner (Node, ein Kern, unter Last gemessen); im
Browser unter SwiftShader 0,2–0,6 ms (derselbe Rechner rendert dabei in Software). Ziel war < 0,3 ms; **am M1 zu
messen:** `window.__figurfein.msMittel` in der Konsole (Mittel über 120 Bilder, dazu gemessenes Clip-Tempo, Rate,
Weite, Gleiten). Alles ist gegen einen `Rigplan` gebaut: Menschen teilen `RIG_MENSCH`; ein Vierbeiner bringt einen
Plan mit vier Beinen (D458) — Standfuss, Normale und Zwei-Gelenk-IK rechnen je Bein, die Drehkette über beliebig
viele Wirbel. Für Tiere offen: das Becken senkt sich heute um den tiefsten Fuss aller Beine (für Vierbeiner braucht
es Vorder- und Hinterhand getrennt). **Erledigt mit D458:** Rumpf je Beinpaar, §8.7 (1).

**Was Standbilder nicht zeigen** und am M1 zu prüfen ist — siehe Ledger D457.

### 8.7 Tiere und Gegner an der Laufzeit (D458)

Auftrag D455, Teil 3 von 3. Gebaut am 23.11.2026, **nicht am M1 in Bewegung gesehen** (ADR-0005) — Formeln ohne
Renderer geprüft (`tests/gegnerbewegung.test.ts`, 178 Prüfungen, davon an den echten Skeletten von Wolf, Grathorn,
Fuchs und Gams), Form im SwiftShader-Standbild (`.cache/bilder/D458/`). **Kein Kampfwert geändert:** `echtzeit.ts`
und `content/gegner/*.json` sind nicht angefasst, Kampftor und Fingerabdruck unverändert grün. Alles hinter dem
Schalter `figurfein` (D457); aus heisst der Weg von vor D458.

**Bestand vor D458** (`src/kampf/Kampfplatz.tsx`, Stand D457):

| Gegner | Körper | Clips | Zuordnung zur Regel | Befund |
|---|---|---|---|---|
| Wolf, Fuchs | Skelett (D172, 51 Knochen) | `Attack`, `Death`, `Gallop`, `Idle`, `Idle_HitReact_Left/Right`, `Walk` | Vorlauf 0 → Scheitel, Aktiv → Durchzug, Erholung → Rest (Zeit je Bild gesetzt); betäubt `Idle_HitReact` mit 0,55; getroffen 450 ms `Idle_HitReact`; sonst `Idle`/`Walk`/`Gallop` nach Schwelle 0,15 / 2,6 m/s | Kreuzblende 0,08–0,2 s; `Walk` lief mit v / 1,1, `Gallop` mit v / 4 für jedes Tier — gemessen kommt der Wolf im `Walk` mit 1,39 m/s über den Boden, das Grathorn mit 0,84 (bei 1,1 m/s Füsse 26 % zu langsam bzw. 31 % zu schnell); am Hang waagerecht auf der Höhe der Mitte; kein Blick, kein Nachdrehen |
| Grathorn, Nebelgams | Skelett (38/46 Knochen) | wie oben, Angriff `Attack_Headbutt` | wie oben | wie oben; Fuchs und Gams hatten **keine** Ansage am Körper (nur Clip, Bogen, Glühen) |
| Wurzelkeiler | **kein Skelett** — Gang im Shader (D138) | keine | starrer Leib: Vorlauf/Aktiv/Erholung als Lage und Neigung (D169) | linear wachsende Ansage; am Hang vorn in der Erde, hinten in der Luft |
| Wegelagerer, Speerfrau, Axtmann | Skelett der Spielfigur (D175) | Klinge `Klinge_U_A/B/C` + `Klinge_Stich`; `Speer_Stoss`/`_Weit`; `Axt_Quer`/`_Schwer`/`_Lauf`; `Death`, `Kampf_Taumeln`, `Kampf_Rueckstoss`, `Walk` | Clip je Linie; Inertialisierung seit D457 | die UAL2-Clips beginnen nicht in der Hut; **`Kampf_Rueckstoss` wirft die Figur zu Boden** (Becken nach 0,3 s auf 21 cm, am Clip gemessen) und lief bei jedem Treffer 0,45 s an; im Gehen fiel die Waffenhaltung; aufgegeben (D426) stand er nur da |
| alle | | | gereinigt/verschont: 0,9 s stehen, dann Richtung um 180° **gesprungen** und im Schritt ab | Tod der Tiere mit Skelett: der `Death`-Clip legt sie auf die Seite **und** der Leib kippte starr um 90° dazu — sie lagen auf dem Rücken |

**Wo es liegt.** Drei reine Module in `src/figur/` und die Verdrahtung im Kampfplatz:

| Modul | Was |
|---|---|
| `vierbeiner.ts` | `RIG_VIERBEINER`; Rumpf je Beinpaar (`paarHoehe`, `rumpfLage`, `seitLage`), starrer Leib am Hang (`hangLage`), Gangart und Rate (`tierGang`) |
| `ansage.ts` | Ansage (`ansagePose`), Taumeln, Schütteln, Sturz, Wende; Typ `Zusatz` |
| `landung.ts` | Landezustand der Spielfigur |
| `laufzeit.ts` | `Koerperfein` um Vierbeiner und `zusatz` erweitert, `fussKnoten` |
| `kampf/Kampfplatz.tsx` | `zeichnePuppe` (Körpersprache je Phase), `spieleRigFein` (Clips über die Laufzeit) |

Werte in `content/figurgegner.json` (Schema `Figurgegner`), Landung in `content/figurlaufzeit.json` `landung`.

**1. Vierbeiner: jedes Beinpaar trägt seinen Gürtel.** Der offene Punkt aus §8.6 (7). Die Tierskelette (Quaternius
Animal Pack) teilen ihre Knochennamen; die Läufe enden **ohne Fussknochen**, `fussKnoten` legt je Lauf einen
Sohlenpunkt ans Ende des Unterlaufs. Je Bild: (1) Sohlen lesen, wie der Clip sie setzt; (2) Bodenhöhe unter jeder
Sohle; (3) die Gerade durch Vorder- und Hinterhand gibt Hub und Nicken des Rumpfs — er dreht um **seine eigene
Höhe**, Schulter und Becken bleiben über ihren Füssen; (4) jeder Lauf per Zwei-Gelenk-IK zurück auf seine Stelle
am Boden. Am echten Wolfsskelett bei 20° bergauf: Rumpf 20,5°, alle Sohlen am Boden (±2 cm), Läufe ±1 cm an ihrer
Stelle. Grenzen: Nicken höchstens 28° (darüber folgt der Rumpf dem tieferen Paar, das andere beugt sich — ein Lauf
kann sich beugen, aber nicht strecken; die Vorderläufe stehen im Clip fast gestreckt, 1,7 cm Reserve beim Wolf);
am Querhang geht der Rumpf 40 % mit (höchstens 8°), den Rest gleichen die Läufe aus; der Kopf nimmt 60 % des
Nickens zurück (er bleibt waagerecht). **Der Wurzelkeiler hat kein Skelett** — er liegt als Ganzes auf der Geraden
Bug–Heck (`hangLage`); **benannte Abweichung (D398):** seine Läufe stehen damit senkrecht zum Hang statt lotrecht.

**2. Gang ans Tempo.** Wie D457 für `Walk`/`Run` der Spielfigur wird jeder Tierclip beim Laden **gemessen**
(Bahn der Sohlen, Tempo in der Standphase):

| Tier | `Walk` | `Gallop` | Wechsel bei |
|---|---|---|---|
| Wolf | 1,39 m/s | 4,38 m/s | 2,47 m/s |
| Fuchs | 1,29 | 4,20 | 2,33 |
| Grathorn | 0,84 | 3,76 | 1,78 |
| Nebelgams | 0,95 | 4,02 | 1,95 |

Die Abspielrate ist Tempo / Cliptempo (0,5–1,8), die Gangart wechselt am geometrischen Mittel mit 10 % Hysterese.
Schritt und Galopp werden **nicht gemischt** (verschiedene Fussfolgen). **Benannt:** Ein Trab fehlt als Clip —
zwischen rund 2 und 3 m/s läuft der Schritt bis 1,8-fach bzw. der Galopp ab 0,56-fach. Bei den Tempi der Regel
(Wolf 4, Fuchs 4,5, Gams 3,5 m/s) deckt der Galopp die Strecke ohne Gleiten. Menschen: `Walk` 1,03 / `Run` 2,07 m/s
wie die Spielfigur; kampfbereit gehen sie mit den Beinen des Gangs und dem Oberkörper in der Hut ihrer Waffe.

**3. Drehkette, Blick, Atem.** Die Gruppe (mit Bogen und Kranz) zeigt, wohin die Regel zeigt; der Leib folgt mit
dem Becken nach (Halbwert Kopf 0,05 s, Schulter 0,12 s, Becken 0,20 s, höchstens 40° Rückstand; im Schlag ohne
Verzögerung). Der Blick geht zur Spielfigur (Brusthöhe), verteilt auf Brust, Halskette und Kopf; im Taumeln, im Tod
und im Abgang nicht. Der Atem liegt beim Tier am letzten Wirbel (am zweiten hängen die Vorderläufe — sie schwängen
sonst mit jedem Atemzug 1,7 cm über den Boden; im Test gefunden).

**4. Ansage — der Vorlauf als Körperbewegung.** `ansagePose` liest Phase und Zeit der Regel und gibt einen Zusatz
über dem Clip: Gewicht zurück, Ducken oder Steigen, Rumpf nicken, Kopf senken, Scharren, Zittern, und für
Richtungsangriffe (ADR-0009) die **Seite**. Die Spannung steigt früh (1 − (1 − u)³) und **steht nach `anstieg`
des Vorlaufs** (0,45–0,65), dann hält sie bis zum Schlag — ein gespannter Bogen, kein gleichmässiges Wachsen; im
Aktiv entlädt sie sich. Vorlauf, Aktiv und Erholung bleiben, wie sie in `content/gegner/*.json` stehen.

| Gegner | Ansage (Endwerte) | Seite / Linie |
|---|---|---|
| Keiler | 30 cm zurück, vorn 9° runter, scharrt 2,5 Hz (D169) | unten |
| Grathorn | steigt 18°, 12 cm hoch, 25 cm zurück (D170) | oben |
| Wolf | duckt 10 cm, 22 cm zurück, Kopf 12° tief, zittert (D171) | links/rechts: Kopf 20°, Schultern 4°, Rollen 6° |
| Fuchs (neu) | duckt 6 cm, 12 cm zurück, Kopf 10° tief | unten: Kopf 8° tiefer |
| Nebelgams (neu) | steigt 10°, 8 cm hoch, 15 cm zurück, stampft | oben |
| Wegelagerer, Speerfrau, Axtmann (neu) | Rumpf lehnt 2–4° zurück und dreht 8–16° ins Ausholen | oben hebt, unten senkt den Kopf |

Beim Tier mit Skelett bewegt die Ansage den **Rumpf über stehenden Läufen** (Gewicht zurück heisst: die Füsse
bleiben); im Aktiv trägt der Rumpf, was vom Zurücklehnen übrig ist, und der Leib nur den Satz selbst — zusammen der
Weg von D169–D171, ohne dass die Läufe beim Wechsel springen. **Seite, festgelegt:** `rechts` ist die Seite, die
die Spielerin rechts im Bild sieht (so zeigt es die Linienraute), also die **Linke des Angreifers**. Für den
Wegelagerer heisst das `rechts` → `Klinge_Hieb_B` (Hand am Scheitel 22 cm links des Beckens, am Clip gemessen),
`links` → `Klinge_Hieb_A` — so lag es mit `Klinge_U_A/B` auch. **Offen:** Axtmann (`Axt_Quer` gibt es nur von
rechts) und Speerfrau (alle Linien ein Stoss) zeigen die Seite nur über die Rumpfdrehung; gespiegelte Clips wären
Sache der Clips (D460).

**5. Treffer, Taumeln, Tod, gereinigt, Aufgabe.** *Treffer:* Die Neigung aus D427 (Δv = Impuls / Masse) geht als
Stoss in die Feder von D457 (`stossGrad`) — sie schwingt aus, statt nach 0,22 s abzubrechen; beim Menschen kippt
die Wirbelsäule (die Füsse bleiben), beim Tier der Rumpf über stehenden Läufen; der Versatz bleibt der von D427.
Menschen spielen getroffen `HitRecieve` statt `Kampf_Rueckstoss`. *Taumeln:* ein Körper, der um seine Füsse schwankt,
ist ein umgekehrtes Pendel — f ∝ 1/√Höhe (Mensch 0,82 Hz, Wolf 1,16 Hz; vorher 1,43 Hz für alle); der Schwerpunkt
wandert zur Seite, die Beine geben 6 cm nach, der Kopf hängt und kommt mit Verzug nach. Ausschlag und Dauer wie
bisher (D427 bzw. `betaeubt` der Regel). *Tod:* Tiere mit Skelett legt ihr `Death`-Clip auf die Seite, das starre
Kippen entfällt dort; der starre Leib und der Mensch (sein `Death` knickt nur, das Becken bleibt oben) kippen
beschleunigt statt gleichmässig und federn einmal nach. *Gereinigt (D417):* das Tier steht, **schüttelt sich**
(Welle vom Kopf nach hinten; Frequenz nach Masse, Dickerson/Mills/Hu 2012: Wolf 4,2 Hz, Keiler 3,5 Hz, Fuchs
6,2 Hz — der Exponent −0,22 ist aus dem Gedächtnis, im Volltext nicht nachgelesen), **wendet sich** mit 200°/s ab
und geht, wohin es schaut (anfangs im Bogen). *Aufgabe (D426):* `Koerper_Aufgabe` passt (gleiches Skelett) — im
Zurückweichen der Regel nur der Oberkörper (Hände gehoben) über rückwärts gehenden Beinen, im Stand der ganze Clip
(aufs rechte Knie); die Waffe liegt am Boden. Verschont hält er 1,2 s, steht auf, wendet sich ab und geht.

**6. Menschliche Gegner auf den Clips von D456 (A-51 (1)).** Wegelagerer: `Klinge_Hieb_A/B`, `Klinge_Schwer`,
`Klinge_Stich` — Scheitel und Durchzug aus den Clipmarken (6/9, 6/9, 14/18, 9/13: dieselben Bilder wie zuvor);
Folgeschläge steigen am Einstieg ein, die Erholung davor endet in der Kettenpose (`hiebClipzeit`). Geht ein Hieb der
Spielerin in die gedeckte Linie, heben alle drei kurz die Deckung (`Klinge_Block`, `Speer_Block`, `Axt_Block`).
`BLOCKCLIP` der Spielfigur nennt `Klinge_Block`. **Damit unbenutzt:** `Klinge_U_A`, `Klinge_U_B`, `Klinge_U_C`,
`Klinge_U_Lauf`, `Klinge_U_Block` (rund 60 KB in `held-clips.glb`; genannt noch in `content/waffenfamilien.json`
und im Posenblick des Figureneditors) — **nicht entfernt**, das Entfernen gehört zu den Clips.

**7. Landung der Spielfigur.** `landeArt` aus dem Aufprall, den `spieler/bewegung.ts` ohnehin misst (gleichwertige
Fallhöhe v²/2g): unter 0,6 m nichts, bis zur schadlosen Höhe (4,5 m, D412) `Koerper_Landung_Weich`, darüber
`Koerper_Landung_Hart`, mit der Rolltaste (D413) die vorhandene Rolle (`Roll`, auf 0,75 s gestaucht), bis es einen
eigenen Clip gibt. Im Stand der ganze Clip, in Bewegung federt nur der Oberkörper nach (55 % des Clips) und die
Beine laufen. **Nachtrag D461:** Die Lande-Rolle ist `Koerper_Rolle` ab Bild 5 bei Rate 1, und vor der Landung liegt der Sprung (`Koerper_Sprung_Ab`, `_Flug`) — §10.6. **Kein Spielwert:** Die Landung sperrt keine Eingabe. *Vorschlag (nicht gebaut, wäre eine Regel):*
nach hartem Aufprall 0,4–0,6 s Landestarre, damit die Hocke nicht über laufenden Beinen liegt.

**8. Kosten.** `npx tsx tools/figurbank.ts`, sechs Gegner gleichzeitig an echten Skeletten (zwei Wölfe, Fuchs,
Grathorn, zwei Menschen; Clip, Trägheit mit Wechsel alle 12 Bilder, Drehkette, Blick, Atem, Ansage, Trefferfeder,
Füsse am Hang): **rund 0,29 ms je Bild für alle sechs** (48 µs je Gegner; Cloud-Rechner, Node, ein Kern, unter
Last), der Mixer allein 0,09 ms. Der Kampfplatz stellt höchstens drei Gegner. **Am M1 zu messen:**
`window.__gegnerfein` in der Konsole (`msMittel` über 120 Bilder für alle Gegner samt Zeichnen der Puppen, dazu
gemessenes Cliptempo und Gleiten je Gegner).

**Messadresse.** `?posenprobe=1` (Übungsplatz): nichts rechnet, die Gegner stehen im Profil, der erste an der
steilsten Stelle in der Nähe, und zeigen die Phase aus `window.__posenprobe = { phase, anteil, linie }`.

## 9. D456: alle Clips der Spielfigur nach den Handwerksregeln — ausgeführt

Flo 23.11.2026 (D455): „Optimiere alle Bewegungen und mach sie AAA Niveau like ohne dass ich was machen oder hochladen
muss.“ Messlatte D432 als Qualität (Gewicht, lesbares Ausholen, Fluss, Richtungsführung), nicht als Kopie (D431); nichts
gekauft (D454), keine fremde Animation ausser den schon ausgelieferten CC0-Clips. **Ehrliche Grenze:** kein Motion
Capture, kein GPU-Blick — die Prüfbilder sind Formprüfung, was „AAA“ ist, entscheidet sich am M1 in Bewegung (ADR-0005).
Gemessen wird an der ausgelieferten Datei (`tests/clipguete.test.ts`, three.js spielt `held-clips.glb` wie das Spiel).

### 9.1 Was am Bau anders ist (`tools/waffenclips.py`, `tools/weltformel.py`)

| Regel | bis D455 | D456 | Prüfung |
|---|---|---|---|
| Zwischenbilder | nur Schlüssel; Blender mischte jede Knochendrehung für sich | **jedes Bild** aus den Posenfeldern gerechnet und per IK gestellt | — |
| Bögen | gerade Stücke von Schlüssel zu Schlüssel | Hand auf einer Kurve durch die Schlüssel (Hermite), Anfang und Ende mit Tangente null | Handbahn im Hieb ≥ 6 % der Sehne neben der Sehne (gemessen 18–43 %) |
| Überlappung | alle Ebenen im selben Bild | Becken 1,5 Bilder, Schwerpunkt 1, Füsse 1,5, Rumpf 0,75 Bilder **vor** der Hand; die Waffe hängt 0,5 Bilder nach (im Durchzug steht sie genau), die freie Hand 1 Bild | Tempospitze des Beckens vor der der Waffenspitze, nicht nach der der Hand |
| kein gemeinsamer Halt | alle Gelenke hielten am Schlüssel | folgt aus dem Versatz | Becken/Brust/Hand/Spitze fallen nicht im selben Bild unter ¼ ihres Spitzentempos |
| Füsse | FK zwischen den Schlüsseln, am Ziel dazu der Fehler der Übertragung | IK je Bild in der Quelle **und** am Ziel (`stelle_fuesse`); reicht ein Bein nicht, sinkt das Becken nach; ein Schritt hebt den Fuss (⅓ der Schrittlänge, 3–10 cm) | stehender Fuss ≤ 2 cm je Bild (vorher bis 14 cm), beide Füsse vom Scheitel bis zum Durchzug ≤ 1,5 cm, Schritt hebt ≥ 2 cm |
| Blick | Kopf drehte ¾ gegen den Rumpf | ganz (Hals ≤ 35°, Kopf ≤ 40°), beim Vorbeugen hebt er vier Fünftel zurück | Kopf bis zum Durchzug ≤ 25° neben geradeaus (gemessen 0–3°, vorher 5–15°) |
| Ellbogen | Pol je Schlüssel von Hand | ein Feld über die Armrichtung (`_pol`): hängt in Brusthöhe, weicht über dem Kopf nach aussen | Zwischenbilder treu |
| Verdrehung der Arme | kleinste Drehung aus der Grundhaltung — kippte, wenn der Arm ihr entgegen zeigte | aus der Gelenkebene (Schulter–Ellbogen–Hand), an einer gebeugten Pose geeicht | **Zwischenbilder treu:** Hand, Ellbogen, Spitze im halben Bild ≤ 3 cm neben dem Bogen (vorher `Axt_Lauf` 18,5 cm) |
| Schneide | Axt nach der Bahn des Kopfs (D429), Messer nach der Bahn der Hand, Klinge schlug um | alle Hiebe nach der Bahn des Schlagpunkts; zwischen den Schlüsseln mit der Klinge mitgeführt; beide Hände greifen in jedem Bild gleich um die Waffe | Langes Messer ≤ 20° im Scheitel und Durchzug (gemessen 3–6° / 1–3°; vorher bis 90° / 35°) |
| eine Hut je Waffe | Speerclips auf dem Stand gebaut, Laufclips ohne festes Ende | jeder Clip beginnt (ausser Lauf: Anlaufpose) und endet in Bild 1 der Hut | jeder Knochen ≤ 2°, Füsse und Becken ≤ 1,5 cm |

**Zwei Befunde am Bestand, beide behoben:** (1) Der Stand der Hauptfigur (`Idle`) steht am Ziel 22 cm im Schritt (rechter
Fuss vor), obwohl die Quelle gleichauf steht — die Beine beider Skelette ruhen verschieden. Jede Hut erbte das: `Messer_Stand`
und `Axt_Stand` („linker Fuss vor“) standen gleichauf (1 cm, −2 cm), `Klinge_Stand` und `Speer_Stand` mit dem rechten Fuss
55 und 53 cm vor. Jetzt gemessen linker Fuss vor: Klinge 28, Axt 21, Saufeder 33, Messer 23, Hirschfänger 27 cm (Widerspruch 6
aus §5 damit erst wirklich behoben; `Idle` selbst ist nicht angefasst — A-51 (3)). (2) Die Arme sprangen in ihrer Verdrehung von
Bild zu Bild um bis 180°; im Standbild unsichtbar, zwischen den Bildern (60 Bilder/s, Trefferstopp, jede Überblendung) fliegt
die Hand aus der Bahn.

### 9.2 Je Waffe

Alle Werte an der ausgelieferten Datei, vorher → nachher; „—“ = Clip gab es nicht. Nachschwung/Halt aus den Schlüsseln
(`tests/waffenclips.test.ts`, Soll `gewicht.ts`).

| Clip | Bilder, Scheitel/Durchzug | Becken vor / tiefer cm | Schritt (Hub) cm | Gleiten cm/Bild | Blick ° | Nachschwung / Halt (Soll) |
|---|---|---|---|---|---|---|
| `Klinge_Hieb_A` (statt `Klinge_U_A`) | 26, 6/9 | 15 / 11 | 42 (7,9) | 0,8 | 1 | 46° / 53 % (18° / 47 %) |
| `Klinge_Hieb_B` (statt `Klinge_U_B`) | 28, 6/9 | 11 / 11 | 21 (5,9) | 0,3 | 0 | 46° / 53 % |
| `Klinge_Stich` | 30, 9/13 | 1 → 22 / 0 → 14 | 4 → 29 (8,0) | 1,3 → 0,5 | 10 → 1 | Halt 53 % |
| `Klinge_Schwer` (statt `Klinge_U_C`) | 40, 14/18 | 18 / 24 | 44 (8,0) | 0,4 | 1 | endet tief, Becken −5 cm / 50 % |
| `Klinge_Lauf` (statt `Klinge_U_Lauf`) | 30, 7/11 | 18 / 15 | 59 (9,6) | 0,9 | 2 | Halt 53 % |
| `Axt_Hieb` | 34, 12/16 | 12 → 10 / 24 | 6 → 10 | 3,1 → 0,4 | 10 → 1 | 46° / 72 % (44° / 67 %) |
| `Axt_Quer` | 30, 10/15 | 15 → 13 / 12 | 11 → 15 | 2,7 → 0,9 | 15 → 1 | 86° / 73 % |
| `Axt_Schwer` | 40, 20/25 | 13 → 11 / 29 | 8 → 12 | 0,2 → 0,7 | 5 → 0 | am Boden / 73 % |
| `Axt_Lauf` | 26, 7/11 | 17 → 12 / 12 | 42 → 43 (4,6 → 9,6) | **14,0 → 0,2** | 13 → 3 | 53° / 73 % |
| `Speer_Stoss` | 24 → 27, 9/13 | 0 → 18 / 0 → 13 | 16 → 25 (1,0 → 7,0) | 5,2 → 1,1 | 6 → 0 | Halt 57 % (56 %) |
| `Speer_Weit` | 30 → 33, 14/18 | 0 → 25 / 0 → 20 | 24 → 38 | 2,2 → 1,1 | 7 → 1 | Halt 60 % |
| `Speer_Lauf` | 22 → 28, 7/11 | 0 → 16 / 0 → 18 | 27 → 53 | 2,0 → 1,1 | 5 → 1 | Halt 59 % |
| `Messer_Quer_A` | 30, 9/13 | 17 → 14 / 13 | 25 → 29 | 4,8 → 0,6 | 15 → 1 | 82° / 59 % (21° / 53 %) |
| `Messer_Quer_B` | 28, 8/12 | 16 → 12 / 13 | 20 → 22 | **8,3 → 0,5** | 12 → 1 | 80° / 56 % |
| `Messer_Schwer` | 36, 12/17 | 21 → 17 / 24 | 28 → 31 | 4,2 → 0,5 | 6 → 0 | am Boden / 58 % |
| `Messer_Lauf` | 26, 7/11 | 20 → 14 / 13 | 46 → 48 | 0,6 → 1,4 | 13 → 3 | 31° / 60 % |
| `Hirsch_Hieb_A` / `_B` / `_Stich` (neu) | 20/20/21, 5/8, 5/8, 6/9 | 8 / 8, 7 / 8, 16 / 11 | 13, 13, 23 | 0,4–0,7 | 0 | 18° / 21° / — , Halt 50 % (8° / 37 %) |

- **Klinge:** Hut ist der Pflug rechts, linker Fuss vor (§4.2). `Klinge_Hieb_A` ist ein Oberhau von der rechten Schulter mit dem
  Schritt des rechten Fusses, `Klinge_Hieb_B` die Rückhand mit Vorrücken des linken, `Klinge_Schwer` der Hieb von oben mit beiden
  Händen (die linke kommt an den Knauf), `Klinge_Lauf` ein Laufstich. Der Rumpf dreht 66° / 64° statt der ganzen Drehung der
  UAL2-Clips (Schulterlinie ±178°, Widerspruch 7); die freie Hand arbeitet 43–75 cm gegen die Brust. Die Regel
  (`content/waffen/klinge.json`) nennt nur die neuen **Clipnamen**; Scheitel/Durchzug 6/9, 6/9, 9/13, 14/18, 7/11 unverändert.
  Die UAL2-Clips `Klinge_U_A/B/C/Lauf/Block` bleiben in der Datei: Der Wegelagerer (`Kampfplatz.tsx`) und der Block
  (`BLOCKCLIP` in `RegionsSzene.tsx`) spielen sie noch — A-51 (1). `Klinge_Block` aus Schlüsselbildern liegt bereit.
- **Saufeder:** Mittelhut nach Meyer, linker Fuss vor, hinteres Ende an der rechten Hüfte. Die hintere Hand führt: Der Abstand
  der Hände sinkt im Stoss von 0,55 auf 0,2 m (der Schaft läuft durch die vordere Hand), der Stoss kommt aus dem Ausfallschritt
  (Becken 18–25 cm vor, 13–20 cm tiefer; vorher 0 / 0), wird gestreckt gehalten und erst nach 57–60 % der Erholung gelöst. Die linke
  Hand liegt jetzt je Bild auf der Schaftachse (vorher bis 10 cm daneben). Clips 3–6 Bilder länger, Scheitel/Durchzug gleich.
- **Langes Messer:** bleibt zweihändig (D406, A-43 offen). Schlüssel unverändert bis auf `Messer_Lauf` (die Hände lagen im Schlag
  am Leib; 21–24 cm weiter vor). Schneide 2°/7°, 90°/5°, 25°/14°, 24°/35° → **5°/1°, 3°/3°, 3°/3°, 6°/1°** (Quer_A, Quer_B, Schwer,
  Lauf; Scheitel/Durchzug).
- **Hirschfänger:** geprüft — nach `gewicht.ts` schlägt er nur 4 % schneller als die Klinge (0,165 gegen 0,171 s; der Arm
  bestimmt die Zeit), bremst aber auf 8° statt 17,5° und hält 37 % statt 47 %. Darum eigene, engere Clips (`Hirsch_Stand`,
  `Hirsch_Hieb_A/B`, `Hirsch_Stich`): Hut tiefer und dichter, Rumpf dreht 46° / 44°, Schritt 13 cm. **Keine Kampfwerte**; die
  Fenster 5/8, 5/8, 6/9 sind Vorschlag (A-51 (2)).
- **Axt:** Schlüssel von `Axt_Hieb`, `Axt_Quer`, `Axt_Schwer` unverändert (D452), `Axt_Lauf` mit den Händen 10–24 cm weiter vor
  (wie `Messer_Lauf`). Alle vier gewinnen über den Bau: Füsse stehen, der Schritt hebt, der Blick hält, der linke Arm springt
  nicht mehr. Schneide 5–6° / 0–1° (`tests/axtgriff.test.ts` 53/53).
- **Axt und Variante B (D454):** geprüft — die Clips passen. Die Szene legt jede Phase der Regel auf ihren Clipabschnitt
  (Vorlauf → Bild 1 bis Scheitel, Aktiv → Scheitel bis Durchzug); mit B läuft der Schlag von `Axt_Hieb` in 0,23 s statt 0,16 s
  über dieselben vier Bilder (165° Kopfbogen — das ist die Physik aus §5.1), das Ausholen in 0,30 s über elf. Nichts
  nachzuziehen, solange `hieb` bleibt. **Vorschlag, nicht angewendet:** Wer die Clips im eigenen Tempo abspielen will (ohne
  Strecken), bräuchte `hieb` 7/13 statt 12/16 für den Axthieb — das wäre ein Kampfwert-Wechsel ohne sichtbaren Gewinn.

### 9.3 Marken für Übergänge und Ketten (`content/clipmarken.json`)

Schema `Clipmarken` in `src/data/schema.ts`, geprüft von `npm run validate` und `tests/clipguete.test.ts`. Alle Zahlen sind
Bildnummern bei 24 Bildern/s wie in `waffenclips.py` (Clipzeit = Bild / 24). `hut` je Waffe; je Clip `waffe`, `art`, `beginn`
(`hut` | `anlauf` | `frei`), `ende` (`hut` | `gehalten` | `schleife` | `liegt`), `bilder`; je Hieb und Stoss `einstieg` (ab hier darf
ein geketteter Schlag beginnen), `scheitel`, `durchzug`, `kette` (Kettenpose: erstes Schlüsselbild nach dem Durchzug), `halt`
(letztes vor der Rückkehr), `vorn` (Fuss in der Kettenpose). **Nur Darstellung:** Ab wann die Regel ketten oder abbrechen
lässt, ist ein Kampfwert und gehört in `content/waffen/` (D457).

### 9.4 Fortbewegung und Körper — Sichtung

| Clip in `held-clips.glb` | Herkunft | Befund | D456 |
|---|---|---|---|
| `Idle`, `Walk`, `Run`, `Roll`, `Death`, `HitRecieve` | Quaternius (alte Wanderin, übertragen D175) | `Idle` steht 22 cm im Schritt; `Roll` 1,67 s auf 0,55 s gestaucht (Szene) — liest sich als Wischer; Gehen/Laufen tragen die Waffe starr in der rechten Hand, die linke schwingt leer (Zweihandwaffen einhändig) | nicht geändert — Gang und Rolle sind Paketclips ohne Schlüssel; sie umzubauen hiesse sie ersetzen |
| `Kampf_Rueckstoss`, `Kampf_Taumeln`, `Idle_Ruhig`, `Gruss`, `Klinge_U_*` | UAL2 (CC0, D173) | passen nicht an die Huten an (eigene Anfangspose) | nicht geändert |
| Sprung, Landung, Klettern, Schwimmen, Gleiten, Wenden, Anlaufen/Abstoppen, Rast | **fehlen** | die Laufzeit zeigt dafür Stand/Lauf | **neu:** `Koerper_Landung_Weich` (16 Bilder, federt 22 cm), `Koerper_Landung_Hart` (30 Bilder, Hocke 45 cm, linke Hand am Boden, hält) |
| Griff fürs Reinigen (D417) | fehlte (Block-Clip als Ersatz) | — | **neu:** `Koerper_Griff` (12 Bilder, Schritt links, linke Hand greift vor, gehalten) |
| „aufgegeben“ (D426) | fehlte | — | **neu:** `Koerper_Aufgabe` (16 Bilder, auf das rechte Knie, Hände offen gehoben, gehalten) |

Die vier Körperclips sind **nicht verdrahtet** (Laufzeit D457) und nur als Formprüfung gesehen. **Nicht geschafft:** Wenden auf
der Stelle, Anlaufen/Abstoppen, Rolle mit Gewicht, Rolle bei der Landung (D413), Sprung/Absprung, Klettern, Schwimmen, Tauchen,
Gleiten, Rast, ein Tragen der Zweihandwaffen im Gehen und Laufen (beide Hände am Schaft) — die Posenfelder können den Körper
nicht um die eigene Achse drehen oder legen (Rolle, Schwimmen), und Gang/Lauf brauchen einen Zyklus mit Fussabrollen, den es
hier nicht gibt. Treffer, Taumeln und Tod (Paket/UAL2) nicht angefasst. **Nachtrag D460:** Wenden, Anlauf/Abstoppen, Rolle, Sprung, Klettern, Schwimmen,
Trage-Huten und die Gangzyklen sind in §10 gebaut (Rast, Tauchen, Gleiten weiter offen).

### 9.5 Offen und am M1 zu prüfen

- Lesen sich die Klingenhiebe mit Schritt als Gewicht oder als Stolpern (der Schritt von 42 cm liegt im Vorlauf von 0,18 s)?
- Wirkt der Versatz (Hüfte vor Hand, Waffe nach) als Fluss oder als Gummi? Stellschrauben: `VORAUS` in `waffenclips.py`.
- Greift die linke Hand im `Klinge_Schwer` sichtbar an den Knauf (keine IK am Ziel, nur Übertragung)?
- Stehen die Huten mit dem linken Fuss vor gut im Übergang aus Gehen und Laufen (deren Clips beginnen anders)?
- Ellbogen: Das Feld ersetzt die Pole von Hand — über dem Kopf stehen sie jetzt etwas weiter hinten-aussen.
- Budget: `held-clips.glb` 789 → **1024 KB** (Grenze in `tools/quality.ts` 800 → 1100, begründet dort).
- **UNKLAR:** Ob der Schritt des `Idle` (22 cm) gewollt ist; ob die Saufeder in der Mittelhut das Ende an der Hüfte oder in der
  Hand trägt (Meyer nennt die Hüfte für die Unterhut, für die Mittelhut nur „gerade Versatzung“).

Prüfbilder (Formprüfung, keine Look-Abnahme, Bewegung nur am M1; vorher │ nachher, gleiche Kamera, von vorn und von oben):
`.cache/bilder/D456/klinge_vorher_nachher.png`, `.cache/bilder/D456/axt_vorher_nachher.png`,
`.cache/bilder/D456/speer_vorher_nachher.png`, `.cache/bilder/D456/messer_vorher_nachher.png`,
`.cache/bilder/D456/hirschfaenger_nachher.png`, `.cache/bilder/D456/koerper_nachher.png`, `.cache/bilder/D456/hut_je_waffe.png`.

## 10. D460: Fortbewegung der Spielfigur als Clips — ausgeführt

Auftrag D455 (Flo, 23.11.2026), der Teil, den D456 offen liess (§9.4) und den D457 als Lücke gemessen hat (§8.6 Nr. 5):
Gehen, Laufschritt, Sprint, Anlauf, Abstoppen, Wenden, Rolle, Sprung, dazu Klettern, Schwimmen und Trage-Huten für die
Zweihandwaffen. **Ehrliche Grenze:** Das sind gerechnete Zyklen, kein Motion Capture — sie stimmen in Tempo, Kontakt,
Abrollen und Gegenschwung, aber ihnen fehlt, was eine Aufnahme mitbringt (Asymmetrie, Nachfedern von Weichteilen, kleine
Unregelmässigkeit von Schritt zu Schritt). Gesehen nur als Standbild-Reihe (Formprüfung); **am M1 in Bewegung prüfen**
(ADR-0005). Kein Kampfwert, kein Tempo, keine Regel geändert; `src/` nicht angefasst ausser dem Schema der Marken.

### 10.1 Bauweg (`tools/waffenclips.py` Abschnitt „D460“, `tools/weltformel.py`, `tools/clipnachbau.py`/`.mjs`)

D456 rechnete jedes Bild aus wenigen Schlüsseln. Ein Zyklus hat keine Schlüssel — hier kommt die Pose **je Bild aus einer
Funktion** (`RECHNE`, `_melde`), und `_pose` kennt dafür neue Felder:

| Feld | Was | Wofür |
|---|---|---|
| `fuss_*` 4. Wert | Abrollwinkel des Fusses, Grad (+ Zehen hoch) | Ferse → Sohle → Ballen |
| `fuss_*` 5. Wert, `('kreis', Grad, Hub)` | Fuss um die Hochachse; `kreis` stellt ihn um die Mitte des Stands (Quelle und Ziel getrennt gerechnet) | Wenden |
| `koerper` 3. Wert, `kippe` | Becken seitlich; Becken um die Längsachse gekippt, die Wirbelsäule richtet sich darüber auf | Beckenbahn |
| `arm_r`, `arm_l`, `arm_w` | Handziel von der Schulter aus im Rahmen der Brust; Gewicht 0…1 gegen die Grundhaltung | Armschwung, weich aus dem Stand |
| `gier` | ganzer Körper um die Hochachse durch das Becken | Wenden |
| `lage` (`nick`, `roll`, `gier`, `um`, `schub`) | den fertig gestellten Körper samt Füssen starr drehen und versetzen | Rolle, Schwimmen |
| `kopf`, `knie` | Kopf zusätzlich; Knie gespreizt | Blick voraus, Hocke, Froschbeine |

**Gangmodell** (`_gangpose`, `_fussbahn`, `_becken`): Der Standfuss liegt in der Welt fest — im Raum der Figur wandert sein
Aufstandspunkt mit genau dem Tempo nach hinten. Er steht erst auf der Fersenkante (Drehpunkt Ferse), dann flach, dann auf
dem Ballen (Drehpunkt Ballen; am Ziel biegen die Zehen auf und bleiben liegen — `ZEHEN`, die Quelle hat keine Zehen). Im
Schwung läuft er nach dem Abdruck noch mit dem Boden zurück, schwingt vor und hat **beim Aufsetzen wieder das Tempo des
Bodens** (kein Bremsstoss). Das Becken: im Gehen ein umgekehrtes Pendel (hoch über dem Standbein, tief im Doppelstand); im
Laufen Feder und Wurf — Einfederung D = g·t_f·t_c / 2π, Steighöhe g·t_f² / 8, damit das Steigtempo am Absprung stetig
ist (D398). Es pendelt über den Standfuss, die Schwungseite sinkt, die Seite des Schwungbeins dreht vor; die Schultern
drehen dagegen, die Arme schwingen gegengleich (im Lauf ist der Arm vorn, wenn das Gegenbein abdrückt). Die Grundhöhe des
Beckens wird so gelegt, dass kein Bein über seine Länge muss (`_beckenbasis`): Das Knie ist am Aufsetzen und am Abdruck
fast gestreckt und beugt dazwischen. Am Ziel stehen die Füsse dafür eben und gleichauf (`fuesse='eben'`; der Stand trägt
den rechten Fuss 22 cm vor und 8 mm tiefer).

**Takt:** `clipnachbau.mjs einfuegen --takt=Clip:48` — ein Clip mit eigener `bildrate` beginnt bei 0 s (Bild b bei
(b − 1) / Rate; Schleifen ohne das gehaltene erste Vierundzwanzigstel), Lauf und Sprint mit 48 Bildern/s (im Sprint
steht der Fuss 0,10 s — bei 24/s wären das 2,4 Bilder). `--um=Alt:Neu` benennt einen Bestandsclip um, `--auch=Clip:Name`
liefert einen neuen zusätzlich unter einem Bestandsnamen (dieselben Daten, `dedup`).

**Realwerte als Anker (D398).** „belegt“ = am 23.11.2026 nachgeschlagen; „Gedächtnis“ = aus der Fachliteratur zitiert,
von hier nicht im Volltext geprüft; „Überschlag“ = eigene Rechnung.

| Grösse | Real | Clip | Quelle, Stand |
|---|---|---|---|
| Gehen: Tempo | 1,30–1,46 m/s frei gewählt | 1,40 | belegt: [Normal Gait, Univ. of Missouri](https://medicine.missouri.edu/sites/default/files/pm-r/Normal_Gait.pdf), [Kinematic analyses of gait, OUHSC](https://ouhsc.edu/bserdac/dthompso/web/gait/knmatics/gait.htm) |
| Gehen: Schritte/min, Schrittlänge | 100–115 (Quellen streuen 80–120); 0,68–0,85 m | 120; 0,70 m | belegt (ebd.). **Benannt:** obere Kante der Frequenz, untere der Länge — die Figur hat 0,87 m Beinlänge |
| Gehen: Standphase, Doppelstand | 60 %; 10 % je Seite | 62 %; 12 % | belegt (ebd.) |
| Gehen: Hub des Schwerpunkts | rund 5 cm | Becken 3,9 cm | belegt für den Schwerpunkt (Perry, ebd.); fürs Becken Gedächtnis (Saunders, Inman & Eberhart 1953: 4–5 cm) |
| Gehen: seitlich, Beckendrehung, Kippen | ±2 cm; ±4°; 4–5° | ±2 cm; ±4°; 4° | Gedächtnis (Saunders/Inman/Eberhart 1953; Perry & Burnfield, *Gait Analysis*, 2010) — **nicht belegt** |
| Laufen 4,2 m/s: Schritte/min, Kontakt, Flug | 165–180; 0,21–0,24 s; 0,10–0,13 s | 180; 0,21 s; 0,125 s | Gedächtnis (Cavanagh & Kram 1989; [Dorn, Schache & Pandy 2012](https://pubmed.ncbi.nlm.nih.gov/22573774/), J Exp Biol 215:1944 — Arbeit belegt, die Tabellenwerte von hier nicht abrufbar) |
| Laufen: Hub | 6–10 cm | 6,0 cm | Überschlag aus t_c, t_f (Feder + Wurf); reale Spanne Gedächtnis |
| Sprint 8,5 m/s: Schritte/min, Schrittlänge, Kontakt, Flug | 250–280; 1,9–2,2 m; 0,10–0,12 s; 0,12–0,13 s | 262; 1,95 m; 0,10 s; 0,13 s | Gedächtnis (Weyand et al. 2000, J Appl Physiol 89:1991; Dorn et al. 2012: über 7 m/s steigt vor allem die Frequenz — das belegt). **Benannt:** Kontakt an der kurzen Kante, weil das Bein der Figur (0,87 m) den Körper nicht über 0,93 m Standweg trägt |
| Anlauf 6,3 m/s², Abstoppen 8,4 m/s² | Antritt aus dem Stand 4–6 m/s² über die ersten Schritte | 0 → 4,2 m/s in 0,67 s; 4,2 → 0 in 0,5 s | Überschlag — **nicht belegt**, scharf gewählt (Spiel) |

### 10.2 Clips und Messwerte

Gemessen an der ausgelieferten Datei (`BERICHT=1 npx tsx tests/clipguete.test.ts`). „Aufstandspunkt“ = Fersenkante oder
Ballen, solange er aufliegt; „Laufzeit“ = die Messung von D457 (`natuerlichesTempo`: Mittel der Knöchelbahn, solange der
Knöchel tief steht) — sie stellt Frequenz und Weite danach.

| Clip | Bilder, Rate, Dauer | deckt bei Rate 1 (Aufstandspunkt) | Laufzeit misst | Schritt, Frequenz | Kontakt, Flug | Fussgleiten | Becken auf/ab, seitlich |
|---|---|---|---|---|---|---|---|
| `Walk` (Paket, unverändert) | 40, 24/s, 1,67 s | — (kein Abrollen, Sohle nicht bestimmbar) | 1,03 m/s | 0,86 m, 72/min | — | — | 0,0 cm, 0,0 cm |
| `Run_Paket` (bis D460 `Run`) | 24, 24/s, 1,0 s | — | 2,07 m/s | 1,04 m, 120/min | — | — | 0,3 cm, 0,0 cm |
| `Koerper_Gang` | 25, 24/s, 1,0 s | **1,40 m/s** | 1,23 m/s (−12 %, siehe 10.4) | 0,70 m, 120/min | 0,62 s, kein Flug | 0,0 cm je Bild | 3,9 cm, 4,0 cm |
| `Koerper_Laufschritt` = **`Run`** | 33, 48/s, 0,667 s | **4,19 m/s** | 4,04 m/s (−4 %) | 1,40 m, 180/min | 0,21 s, 0,125 s (im Raster der Bilder 0,23 / 0,10) | 0,1 cm je Bild | 6,0 cm, 2,4 cm |
| `Koerper_Sprint` | 23, 48/s, 0,458 s | **8,49 m/s** | 8,19 m/s (−4 %) | 1,95 m, 262/min | 0,10 s, 0,13 s | 0,0 cm je Bild | 4,0 cm, 1,6 cm |

| Clip | Bilder (24/s) | Was |
|---|---|---|
| `Koerper_Anlauf` | 17 (0,67 s) | Stand → Laufschritt in zwei Schritten: tief, 30° Vorlage, endet in Phase 0,53 des Laufschritts. Füsse stehen in der Welt, **wenn** der Körper gleichmässig beschleunigt |
| `Koerper_Abstoppen` | 13 (0,5 s) | Laufschritt (Phase 0,5) → Stand: linker Fuss stemmt mit der Ferse vor, Rumpf 9° zurück, Becken 13 cm tief, rechter zieht nach |
| `Koerper_Wenden_Links` / `_Rechts` | 13 (0,5 s) | 90° auf der Stelle: beginnt in der alten Richtung, **endet im Stand** — die Regel dreht sofort, der Clip holt nach; Kopf voraus, zwei Tritte |
| `Koerper_Kehrt_Links` / `_Rechts` | 19 (0,75 s) | 180°, vier Tritte |
| `Koerper_Rolle` = **`Roll`** | 19 (0,75 s) | Hechtrolle mit Gewicht: tief, Abdruck, gestreckt, linke Hand fängt ab, über linke Schulter und Rücken, auf die Füsse bei Bild 14 (0,54 s = Ende der Regel), Aufstehen aus der Hocke. Liegt auf (tiefster Punkt je Bild gemessen, `TIEF=Koerper_Rolle`). Ab Bild 5 als **Lande-Rolle** (D413) nutzbar |
| `Koerper_Sprung_Ab`, `Koerper_Sprung_Flug` | 8; 25 (Schleife) | Abdruck gestreckt → Flughaltung; Flughaltung mit kleinem Wiegen. Landung: `Koerper_Landung_Weich` / `_Hart` (D456) |
| `Koerper_Klettern` | 25 (Schleife, 1 s = 1 m) | diagonal, greifende Hand und Fuss wandern mit 1 m/s nach unten (`klettern.tempo`) |
| `Koerper_Schwimmen` | 33 (Schleife, 1,33 s) | Brustschwimmen, Körper liegt 78° |
| `Axt_Trage`, `Speer_Trage`, `Messer_Trage` | 25 (Schleife) | Trage-Hut: Waffe quer und tief vor dem Leib, beide Hände am Holz — für den Oberkörper über dem Gang |

`held-clips.glb` 1024 → **1339 KB** (49 → 68 Clips; Budget in `tools/quality.ts` 1100 → 1400, begründet dort). Die fünf
UAL2-Klingenclips sind **nicht** entfernt (D458 stellt die Gegner um); `Run_Paket` und `Roll_Paket` (rund 30 KB) bleiben
für Vergleich und Rückweg.

### 10.3 Was ohne Codeänderung greift

- **`Run` ist jetzt der Laufschritt.** Nur die Spielfigur spielt `Run` (`RegionsSzene.tsx` `SpielerFigur`); die Laufzeit
  misst beim Laden neu: 4,04 statt 2,07 m/s. Bei Laufschritt 4,2 m/s läuft der Clip mit Rate ×1,02 und Weite ×1,02 statt
  ×1,45 / ×1,4 — **keine Schrittweiten-Streckung mehr**. Bei Rennen 8,5 m/s: Rate ×1,5 (270 Schritte/min), Weite ×1,4,
  rechnerisch kein Gleiten mehr (vorher 25 %) — aber noch der gestreckte Laufschritt, nicht der Sprint.
- **`Roll` ist jetzt die Hechtrolle.** Die Szene spielt ihn über 0,75 s — genau seine Länge (Rate 1, vorher ×2,2).
- **Nicht ersetzt: `Walk`.** Ihn spielen auch die menschlichen Gegner und Bewohner mit einer auf 1,1 m/s geeichten Rate
  (`Kampfplatz.tsx` `timeScale = v / 1.1`, `RegionsSzene.tsx` Bewohner) — ein Clip mit 1,4 m/s liesse ihre Füsse 27 % zu
  schnell laufen, und D458 arbeitet dort gerade. Die alte Figur (`?figur=alt`) lädt `wanderin.glb` und ist unberührt.
- Weg ohne feine Laufzeit (`figurfein` aus): `run.timeScale = tempo / 6,5` deckt bei 8,5 m/s jetzt 5,5 statt 2,7 m/s;
  der Schrittabgleich Gehen ↔ Laufen (D217) nimmt denselben Anfangsfuss an — `Run` beginnt jetzt mit dem linken Aufsetzen,
  dort kann ein Hüpfer entstehen (nicht gemessen).

### 10.4 Was Code braucht (nächste Runde, `src/figur/` und `RegionsSzene.tsx` — hier nicht angefasst)

> **Stand D461 (23.11.2026):** Punkte 1, 2, 3, 4, 6 (im Stand) und 9 sind gebaut — §10.6. Offen: 5, 7, 8; der Stand lebt im Ledger (`../_INDEX.md` A-54).

1. **Drei Gangclips statt zwei** (`RegionsSzene.tsx` `SpielerFigur`, dort wo `gehClip`/`laufClip` aus `'Walk'`/`'Run'`
   gesucht und `geh = teil('Walk')`, `lauf = teil('Run')` gebaut werden; `gangMischung` in `src/figur/fortbewegung.ts`):
   `Koerper_Gang` (1,4) ↔ `Koerper_Laufschritt` (4,2) ↔ `Koerper_Sprint` (8,5), je zwei benachbarte gemischt. Dann laufen
   beide Spieltempi bei Rate 1.
2. **Tempo am Median messen** (`natuerlichesTempo` in `fortbewegung.ts`): Ein Fuss, der abrollt, lässt den Knöchel dem
   Boden ein Stück vorauslaufen; das Mittel liest `Koerper_Gang` 12 % zu langsam (1,23 statt 1,40 m/s). Der Median der
   Standbilder läge näher (Überschlag 1,3–1,4); genau ist die Messung am Aufstandspunkt (`messeGangclip` in
   `tests/clipguete.test.ts`). Lauf und Sprint setzen deshalb fast flach auf (−4 %).
3. **Rolle:** `clips.rolle = einmal('Roll')` greift schon. Für die Lande-Rolle (D413): beim Aufsetzen mit `gerolltBeiLandung`
   `Koerper_Rolle` ab Clipzeit 4 / 24 s spielen; sonst `Koerper_Landung_Weich`/`_Hart` (braucht einen Landezustand).
4. **Sprung:** in der Luft (`!amBoden`, nicht gleitend) `Koerper_Sprung_Ab` einmal, dann `Koerper_Sprung_Flug`.
5. **Klettern, Schwimmen:** `klettert` → `Koerper_Klettern` mit Rate = Steigtempo / 1,0 m/s; `schwimmt` →
   `Koerper_Schwimmen`, Figur an die Wasserlinie setzen (der Clip liegt in Beckenhöhe über der Wurzel).
6. **Wenden:** bei einem Sprung der Blickrichtung im Stand (> 60° → `Koerper_Wenden_*`, > 135° → `Koerper_Kehrt_*`,
   Seite nach Vorzeichen) den Clip ab dem Sprung spielen und die Drehkette (`drehSchritt`) für seine Dauer straff stellen
   — sonst dreht die Figur doppelt.
7. **Trage-Hut:** ausserhalb des Kampfs mit Axt, Saufeder oder Langem Messer im Gang `oben = teil('<Waffe>_Trage').ober`
   (dieselbe Stelle, an der kampfbereit `teil(k.haltung)` gesetzt wird).
8. **Anlauf/Abstoppen** brauchen eine Regel, die das Tempo über 0,67 / 0,5 s fährt (heute springt es — Spielwert, D457
   §8.6). Ohne das gleitet ihr Standfuss; **nicht verdrahten, solange das Tempo springt**.
9. `content/figurlaufzeit.json` `gang.rennen` (Rückfall 2,07) auf 4,04 nachziehen, wenn dort ohnehin gearbeitet wird.

### 10.5 Wo es hölzern bleibt, offen

- **Gang und Lauf sind spiegelgleich und periodisch** — links und rechts dieselbe Kurve, jeder Schritt gleich. Am M1 liest
  sich das vermutlich sauber, aber mechanisch; die Paketclips hatten Handschrift, dafür weder Beckenhub noch Abrollen.
- **Rumpf:** eine feste Vorlage und eine Sinusdrehung; kein Nachgeben der Wirbelsäule beim Aufsetzen, Kopf sehr ruhig.
- **Arme:** Ellbogenwinkel fast fest, Handgelenk starr; die Waffe zeigt im Lauf starr nach aussen-unten.
- **Rolle:** Die Körperlage stimmt je Bild (liegt auf, taucht nicht ein), aber Schulter und Rücken rollen nicht über eine
  durchgehende Auflagelinie ab — die Höhe ist je Bild nachgestellt. Die Füsse laufen beim Abdruck dem Becken bis 8 cm
  davon (das Becken wird nachgezogen). 3,8 m in 0,55 s (Regel) sind 6,9 m/s: schneller als ein Mensch hechtet (benannt).
- **Klettern, Schwimmen, Sprung:** je ein einfacher Zyklus bzw. zwei Haltungen; Hände und Füsse greifen in die Luft (keine
  Wand im Clip), die Waffe bleibt in der Hand. Als Platzhalter besser als Stand/Lauf, nicht mehr.
- **Trage-Huten:** drei Haltungen mit kleinem Wiegen; die linke Hand liegt bei der Axt 2 cm neben der Stielachse.
- **Wenden:** der Fuss dreht auf einem Kreis um die Standmitte; ein Mensch dreht auf dem Ballen des Standfusses.
- **UNKLAR:** ob `Run` als Laufschritt am M1 besser liest als der Paketclip (Rückweg: `Run_Paket` → `Run` umbenennen); ob
  die Hechtrolle zur Ausweichrolle der Regel passt oder eine seitliche Rolle gebraucht wird (`rolleX/Z` kann seitlich
  sein — der Clip rollt immer nach vorn, die Szene dreht die Figur in Rollrichtung); Schwimmtempo ist kein Datum.

Prüfbilder (Formprüfung, keine Look-Abnahme, Bewegung nur am M1; vorher │ nachher, gleiche Kamera von der Seite, mit
Bodenlinie und Fussspur — Knöchelbahn beider Füsse, links liegt unter rechts): `.cache/bilder/D460/gang_vorher_nachher.png`,
`.cache/bilder/D460/laufschritt_vorher_nachher.png`, `.cache/bilder/D460/sprint_vorher_nachher.png`,
`.cache/bilder/D460/rolle_vorher_nachher.png`, `.cache/bilder/D460/uebrige_nachher.png`.

### 10.6 D461: die Fortbewegungs-Clips in der Laufzeit — ausgeführt

Auftrag D461 (23.11.2026): die Anschlüsse aus §10.4 verdrahten. Gebaut hinter dem Schalter `figurfein` (D457); mit
`?figurfein=0` läuft unverändert der Weg von vor D457. **Nicht am M1 in Bewegung gesehen** (ADR-0005) — Formeln und
Clips ohne Renderer geprüft (`tests/gangclips.test.ts`, 72 Prüfungen, an der ausgelieferten `held-clips.glb`), Form im
SwiftShader-Standbild. Kein Kampfwert, kein Tempo, keine Regel geändert; `echtzeit.ts`, `content/bewegung.json` und
`held-clips.glb` sind nicht angefasst. `Walk` bleibt für Gegner und Bewohner, wie es ist.

| §10.4 | Stand | Wo |
|---|---|---|
| 1 Drei Gangclips | **gebaut** | `gangStufen` (`src/figur/fortbewegung.ts`), `SpielerFigur` in `src/scenes/RegionsSzene.tsx`, `content/figurlaufzeit.json` `gang.stufen` |
| 2 Tempo richtig messen | **gebaut** (Aufstandspunkt) | `aufstandsTempo`, `kontaktMitte`, `messeGang` mit `Sohlenmessung` (`src/figur/laufzeit.ts`), `gang.sohle` |
| 3 Lande-Rolle | **gebaut** | `landung.clipRolle` = `Koerper_Rolle`, `landung.rolleAb` |
| 4 Sprung | **gebaut** | `src/figur/sprung.ts`, Daten `sprung` |
| 5 Klettern, Schwimmen | nicht gebaut (nicht Teil von D461) | offen, A-54 |
| 6 Wenden | **gebaut im Stand**, aus dem Lauf weggelassen (Grund unten) | `src/figur/wende.ts`, Daten `wenden` |
| 7 Trage-Huten | nicht gebaut (nicht Teil von D461) | offen, A-54 |
| 8 Anlauf/Abstoppen | nicht gebaut — die Regel springt das Tempo, der Standfuss glitte | offen, braucht eine Regel |
| 9 Rückfallwerte | **nachgezogen** | `gang.rennen` 2,07 → 4,04; `gang.stufen` 1,40 / 4,19 / 8,49 |

**1. Drei Gangarten.** Die Spielfigur mischt `Koerper_Gang` ↔ `Koerper_Laufschritt` ↔ `Koerper_Sprint`, je die zwei
Nachbarn, zwischen deren Tempi sie läuft (`gangStufen` ruft dafür `gangMischung` von D457: Strecke je Zyklus gemischt,
der Rest auf Frequenz und Weite). Alle drei laufen an derselben Stelle des Schritts: Versatz der **Kontaktmitten** des
ersten Fusses gegen den Gang (Laufschritt 0,86, Sprint 0,80 Zyklen; an der Sohle gelesen, nicht an der Knöchelhöhe —
beim Abrollen steigt der Knöchel, lange bevor der Ballen abhebt). Fehlt einer der drei Clips in der Datei, gilt das
Paar `Walk`/`Run` von D457. Gemessen (`BERICHT=1 npx tsx tests/gangclips.test.ts`):

| Tempo | vorher (Stand D460, `figurfein` an) | nachher (D461) |
|---|---|---|
| 1,4 m/s | `Walk`/`Run` 88 : 12 gemischt, Rate ×1,17, Weite ×1,08, Restgleiten nicht bestimmbar (`Walk` rollt nicht ab) | `Koerper_Gang` allein, Rate ×1,001, Weite ×1,001, Restgleiten 0,0 % |
| 4,2 m/s (Laufschritt) | `Run`, Rate ×1,02, Weite ×1,02, **Füsse 3,8 % schneller als der Boden** | `Koerper_Laufschritt` allein, Rate ×1,001, Weite ×1,000, 0,0 % |
| 8,5 m/s (Rennen) | `Run`, Rate ×1,50, Weite ×1,40 (Schritt per IK gestreckt), Füsse 3,8 % schneller als der Boden | `Koerper_Sprint` allein, Rate ×1,002, Weite ×1,002, 0,0 % |

„Rate“ ist die Abspielrate gegen den Clip, der am meisten trägt; „Restgleiten“ der Anteil des Tempos, den die Füsse
nicht decken (negativ: sie laufen dem Boden voraus), gerechnet mit dem Tempo am Aufstandspunkt. Die −3,8 % vorher sind
die Messabweichung von Punkt 2: Die Laufzeit hielt `Run` für 4,04 m/s und stellte Rate × Weite auf 4,2 / 4,04 — der
Clip deckt aber 4,19. **Die Null nachher ist gerechnet**, auf die Genauigkeit der Messung (Sprint 8,47 statt 8,49 m/s
aus §10.2: 0,2 %); was die Fuss-IK am Hang daraus macht, zeigt nur der M1.

**2. Tempo am Aufstandspunkt.** `aufstandsTempo` zählt je Fuss nur den Punkt, der in zwei aufeinanderfolgenden Proben
aufliegt — den Ballen, sonst die Fersenkante (höchstens 6 mm über dem tiefsten Punkt, wie `tests/clipguete.test.ts`) —
und mittelt den Weg als Vektor. Die Sohle (Fersenkante und Ballen gegen Knöchel und Ballenknochen) steht in den Daten
(`gang.sohle`, dieselben Masse wie `tools/waffenclips.py`); der Rigplan nennt den Ballenknochen (`ballen`). 64 Proben
je Zyklus, weil der Sprint nur 0,10 s am Boden steht. Ergebnis: **1,40 / 4,19 / 8,47 m/s** (Soll 1,40 / 4,19 / 8,49;
die Knöchelmessung liest 1,23 / 4,04 / 8,02). Rollt ein Clip nicht ab (`Walk`), gilt weiter die Knöchelmessung;
`natuerlichesTempo` selbst ist unverändert, weil Tiere und Gegner (D458) darauf geeicht sind.

**3. Lande-Rolle.** Mit der Rolltaste im Fenster (D413) spielt die Landung `Koerper_Rolle` ab Bild 5 (4/24 s:
gestreckt in der Luft — Tiefgehen und Abdruck davor entfallen) bei Rate 1 bis zum Clipende (0,58 s), statt `Roll`
auf 0,75 s gestaucht. **Benannt:** Die Regel sperrt in der Landung nichts; steht die Figur dabei, rollt sie auf der
Stelle (der Clip trägt keinen Weg, die Regel bewegt). Eine Landerolle mit Weg wäre eine Regel.

**4. Sprung.** Die Bewegung meldet je Bild, ob die Figur in der Luft ist und ob sie abgesprungen ist (`meldeLuft`;
nicht am Gleiter, im Wasser, am Fels, im Sattel). Nach dem Absprung einmal `Koerper_Sprung_Ab` (0,33 s), dann
`Koerper_Sprung_Flug` bis zum Aufsetzen; über eine Kante ohne Absprung die Flughaltung erst nach 0,15 s (ein Absatz
ist kein Flug). Das Aufsetzen ist die Landung von D458 (`Koerper_Landung_Weich` beim eigenen Sprung, 1,49 m).
**Benannte Abweichung (D398):** Die Regel hebt im Bild des Tastendrucks ab; der Abdruck läuft, während die Figur
schon steigt. Ein echtes Beugen und Strecken am Boden (0,2–0,3 s) hiesse den Sprung verzögern — Spielwert, nicht gebaut.

**5. Wenden im Stand.** Die Blickrichtung dreht stufenlos (Maus, Tasten); folgte ihr die Hüfte wie bisher, drehten die
Füsse auf dem Boden mit. Im **freien Stand** (kein Kampf, kein Tempo, nicht im Sattel, keine Landung) gilt jetzt:

- Die Hüfte hält ihre Standrichtung; Rumpf (60 %) und Hals (40 %) drehen zum Blick (`drehSchritt` mit `Standdrehung`).
- Ab 60° Abstand tritt die Figur mit `Koerper_Wenden_*` um 90° um, ab 135° mit `Koerper_Kehrt_*` um 180° (Schwellen aus
  §10.4). Die Hüfte springt im selben Bild um **genau den Clipwinkel**, der Clip beginnt um ihn zurückgedreht. Wurzel
  und Beine wechseln dabei hart (`PosenTraegheit.wechsel(…, hart)`): Ein abklingender Versatz liesse den Körper kreiseln.
- Die Clips drehen um die Mitte des Stands, die Figur um ihren Ursprung (6 cm daneben). Die Standmitte bleibt deshalb
  in der Welt liegen (`standVersatz`): Die Figur wird bis zu 13 cm gegen den Ort der Regel versetzt gezeichnet, beim
  Losgehen klingt das ab (Halbwert 0,12 s).

Am echten Skelett, verdrahtet wie in der Szene (ohne Fuss-IK): Der Körper endet bei ±90° / 180°, die Hüftlinie dreht
höchstens 6,7° je Bild (das Tempo des Clips), ein stehender Fuss wandert höchstens **3,3 mm je Bild** — einmal je
Wende, im Bild des Wechsels (der Stand `Idle` wiegt, der Clip beginnt in dessen erstem Bild). **Aus dem Lauf
weggelassen:** Die Figur schaut immer in Blickrichtung und geht seitwärts und rückwärts, ohne sich zu drehen — ihre
Richtung springt im Lauf nie; und die Clips enden im Stand, während die Regel das Tempo hält (bei 4,2 m/s glitten die
Füsse über 0,5–0,75 s rund 2–3 m). **Im Kampf nicht:** Mit aufgeschaltetem Ziel soll der Körper dorthin zeigen, wohin
die Regel schlägt. `wenden.an = false` stellt den Stand von vor D461 her (Hüfte folgt dem Blick).

**Am M1 messen:** `window.__figurfein` trägt jetzt `clips`, `tempi` (gemessen, m/s), `amAufstand`, `knoechel`, und im
Bild `stufe`, `anteil`, `clipRate`, `weite`, `gleiten`, `wenden`.

**Was Standbilder nicht zeigen, am M1 zu prüfen:** ob der Sprint bei Rate 1 als Rennen liest; ob der Wechsel
Laufschritt ↔ Sprint (das Tempo springt, die Mischung springt mit, der Versatz klingt 0,25 s ab) ohne Hüpfer läuft; ob
der verdrehte Stand (Hüfte hält, Schultern bis 36°, Kopf weitere 24°) natürlich oder verrenkt wirkt und ob das
Umtreten bei 60° zu spät oder zu oft kommt; ob Abdruck und Flughaltung über 1,1 s Sprung tragen; ob die Lande-Rolle
im Stand (auf der Stelle) stört.

**UNKLAR:** (a) ob das Umtreten im Stand gewollt ist oder die Figur wie bisher starr dem Blick folgen soll — es
ändert, was man bei jeder Kameradrehung im Stand sieht; (b) ob die 13 cm Versatz um die Standmitte an Wänden auffallen;
(c) Gegner und Bewohner spielen weiter `Walk` und `Run` — sollen sie auf die neuen Clips (Frage aus A-54, bleibt).

Prüfbilder (SwiftShader 640×360, Formprüfung, keine Look-Abnahme; gleiche Kamera, „vorher“ derselbe Build mit
`?figurfein=0`): `.cache/bilder/D461/rennen_vorher_nachher.png` (Rennen 8,5 m/s, je drei Bilder), `.cache/bilder/D461/sprung_vorher_nachher.png` (Sprung aus Rennen und Stand: Abdruck und Flughaltung statt Gang/Stand in der Luft), `.cache/bilder/D461/wenden_vorher_nachher.png` (Q gehalten im Stand: Füsse bleiben stehen und treten um, drei Wenden in der Folge). Die Bilder sind nicht bildgenau synchron (rund 1 Bild/s, Phase des Schritts zufällig).
