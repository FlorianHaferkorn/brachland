---
last-reviewed: 2026-08-20
shelf-life-days: 365
---
# ADR-0002 — Assets: CC0-Props sofort, Kreaturen über Stil-Referenz und Kette

**Status:** Accepted · 2026-08-16 · erweitert ADR-0001

## Kontext

Der Engpass dieses Projekts war nie der Code — es sind die Assets. Der Chat trennt
sauber zwischen zwei Problemen, von denen nur eines schwer ist:

- **Props** (Bäume, Felsen, Gras, Sträucher) sind generisch. Die muss niemand erfinden.
- **Kreaturen** sind das eigentliche Problem: Alpen-Fauna mit Biotech-Anbauten gibt es
  nirgends fertig, und geplant sind ~200 Stück.

## Entscheidung

**Props: CC0-Packs, erledigt.** 23 Modelle aus dem **Kenney Nature Kit 2.1 (CC0)** —
2.778 Dreiecke gesamt, 130 KB, +200 KB Precache für den kompletten Ersatz aller
Platzhalter-Primitive. Zwei Details sind Teil der Entscheidung, nicht Beiwerk:

- **4 Varianten je Art** (Totholz 3). Ein Baummodell 25.000-mal geklont fällt sofort
  als Muster auf; erst Varianten lassen einen Wald wie einen Wald wirken.
- **Automatische Maßstabskorrektur.** Kenney modelliert in Blockeinheiten (Baum = 2,
  Findling = 0,51). Die Szene misst jedes Modell beim Laden und normiert auf die reale
  Zielhöhe (Fichte 22 m, Busch 1,3 m, Grasbüschel 0,35 m). Damit passt jedes neue
  Modell automatisch in den 1:1-Maßstab — keine Handarbeit.

Weitere zulässige CC0-Quellen: Quaternius Nature MegaKit (~68 Modelle), OpenGameArt
CC0-Sammlung, Poly Haven (HDRIs/Texturen), ambientCG (PBR).

**Kreaturen: Stil-Referenz zuerst, dann Kette, dann Stapel.** Verbindliche Reihenfolge:

1. **Stil-Referenz festzurren.** Ein einziges gutes 2D-Referenzbild definiert den Look
   für alle 200 Kreaturen — Bild-zu-3D erbt ihn. Das ist der Hebel gegen die Stil-Drift,
   die 200 KI-Modelle sonst unweigerlich auseinanderlaufen lässt. Der bereits generierte
   Steinbock war nah dran; **der Prompt, mit dem er entstand, gehört festgehalten.**
2. **Eine Kreatur komplett durch die Kette:** generieren → `reduce.mjs` → `autorig.py`
   → Szene, inklusive Blender-Rigging. Damit ist die letzte ungetestete Stelle geprüft.
3. **Erst danach Stapelproduktion.**

**Generierungsweg:** Hunyuan3D über Google Colab (Gratis-GPU, kommerziell nutzbar,
keine Downloadlimits wie bei Tripo). Kosten null, dafür Einrichtungsaufwand und
schwankende Qualität.

**Offen gelassen:** Für die 5 Regenten plus 5–8 Startkreaturen ist ein Artist
(ArtStation/Fiverr, wenige hundert Euro je Stück) eine bewusste Option — Qualität und
Eigenständigkeit dort, wo es zählt, Rest KI-generiert. Das ist die einzige Stelle, an
der Geld ins Projekt fließen dürfte, und sie ist noch nicht entschieden (Ledger A-4).

**Verworfen:** Bezahlte Packs (Synty & Co.) — kohärent und gut, aber ohne Alpenfauna,
und das Spiel sähe aus wie jedes andere mit demselben Pack. Blender selbst lernen —
volle Kontrolle, aber Monate Lernkurve und faktisch ein zweites Hobby.

## Konsequenzen

**Leichter:** Die Landschaft ist heute schon fertig bestückt, ohne Kosten und ohne
Lizenzrisiko. Die Maßstabsnormierung macht jeden künftigen Modell-Import trivial.

**Schwerer:** Die Kreatur-Kette hat eine ungetestete Stelle (Rigging), und die
Stil-Referenz ist unwiderruflich in dem Sinn, dass ein Wechsel nach 50 generierten
Kreaturen deren Neuproduktion bedeutet. Deshalb steht sie **vor** der Stapelproduktion.

## Nachtrag 16.08.2026 — Präzisierung „keine Texturen"

Die Regel meint **Textur-Assets**: Dateien, die ins Offline-Budget zählen und einen
Art-Stil erzwingen, den ein Solo-Projekt über 200 Kreaturen nicht durchhält.
Sie meint **nicht** prozedurale Oberflächenvariation im Shader. Die kostet null Bytes,
wird aus der Weltposition berechnet und bleibt über Kachelgrenzen und LOD-Stufen
stabil. Umgesetzt in `src/world/bodenmaterial.ts` (Ledger D21).

Grund für die Präzisierung: Ohne diese Ebene liest sich der Boden als Fläche, egal
wie fein er tesselliert ist — Flat Shading auf 2-m-Quads hat nichts, woran das Auge
Oberfläche erkennt.

## Nachtrag 20.08.2026 — Schritt 2 ist erledigt, der Generierungsweg muss weg

Diese ADR schließt mit dem Satz, die Lizenzlage KI-generierter Modelle sei
uneinheitlich und „vor einer Veröffentlichung erneut zu prüfen". Das ist jetzt
geschehen, und das Ergebnis kippt den hier festgelegten Generierungsweg.

### Was die Prüfung ergeben hat

**Hunyuan3D ist in der EU nicht nutzbar.** Die Tencent-Community-Lizenz definiert
„Territory" wortgleich in 2.0 und 2.1 als die Welt **ohne** EU, Vereinigtes
Königreich und Südkorea, mit einem Hinweis in Versalien, dass sie in der EU nicht
gilt. Ein gehostetes Colab heilt das nicht — die Lizenz hängt am Modell, nicht am
Rechner. Offene Gewichte von 2.5 / PolyGen / 3.x gibt es nicht; das sind
API-Produkte. Der in dieser ADR gewählte Weg ist damit hinfällig.

**Tripo im Gratistarif ebenfalls nicht.** ToS §5.2.1: Bei Free Users behält Tripo
sämtliche Rechte an Ein- und Ausgaben; eine Lizenz an den Nutzer wird nicht
eingeräumt. Erst ein bezahltes Abo (§5.2.2) räumt Rechte ein. Urheberrechtlich hat
an rein KI-generierter Ausgabe vermutlich ohnehin niemand Rechte (AG München,
13.02.2026, Az. 142 C 9786/25) — das Problem ist vertraglich, nicht urheberrechtlich.

**Ersatz: SPAR3D (Stability AI).** Stability Community License: keine geografische
Klausel, kommerziell frei bis 1 Mio. USD Jahresumsatz, erzeugte Meshes sind
ausdrücklich *Outputs* und keine *Derivative Works*, also ohne Namensnennungspflicht
beim Ausliefern. Dazu zwei praktische Gründe: offizieller Apple-Silicon-Pfad (Metal,
rund 10,5 GB, Sparmodus ~7 GB) und ein eingebauter Remesher.

**Korrektur noch am selben Tag (G-94):** Der zweite Grund trug nicht. Getestet wurde
nicht SPAR3D, sondern der Mechanismus — mit dem Quadriflow, den Blender ohnehin
mitbringt. Er **scheitert an dieser Geometrie stillschweigend**: 205.328 → 205.328
Flächen bei jedem Ziel, ohne Fehlermeldung, weil er geschlossene Netze verlangt und
die Quelle 583 getrennte Teile mit 30.216 offenen Kanten hat. Was die Untergrenze
tatsächlich bricht, ist der **Voxel-Remesher**: 205.328 → 1.756 Dreiecke bei 3,5 cm,
583 Teile → 2, und die Silhouette wird dabei sauberer als die dezimierte. Der steckt
in Blender, das seit heute installiert ist.

Für SPAR3D bleibt damit **nur** das Lizenzargument — das aber unverändert.

Für später, falls die Qualität nicht reicht: TRELLIS.2-4B oder TripoSG, beide MIT,
beide ohne Territoriumsklausel, aber CUDA-gebunden und damit nur auf gemieteter GPU.

### Was jetzt gilt

Der Absatz „**Generierungsweg:** Hunyuan3D über Google Colab" ist **überholt**.
An seine Stelle tritt: **SPAR3D, lokal auf dem Mac**, Lizenzvermerk im Repo als
„Stability AI Community License, ≤ 1 Mio. USD Umsatz", mit Generierungsdatum und
einer Kopie des Lizenztexts.

### Schritt 2 der verbindlichen Reihenfolge ist erledigt

„Eine Kreatur komplett durch die Kette, inklusive Blender-Rigging" — die letzte
ungetestete Stelle ist geprüft. Drei Fuchsmodelle liefen am 20.08.2026 vollständig
durch `pipeline.sh`: 24 Knochen, 3 Animationen, **0 % Vertices ohne Gewicht**,
4.342 bis 7.373 Flächen, 212 bis 300 KB. Die Kette hat dabei drei eigene Fehler
offengelegt (G-87, G-88, G-89) und einen neuen Schritt bekommen (D80: entkleiden,
Farbe je Vertex statt Textur).

~~**Schritt 1 bleibt offen — und er ist der unwiderrufliche.**~~ **Falsch, und zwar
von mir.** Schritt 1 ist seit dem **17.08.2026** erledigt:
`docs/design/BRACHLAND_Stilreferenz_v1.md` ist verbindlich, aus einem Referenzbild
vom 16.08.2026 abgeleitet und schließt in seinem eigenen Kopf ausdrücklich diese
ADR und Ledger G-2. Ich hatte das behauptet, ohne nachzusehen.

Damit sind **beide** Vorbedingungen erfüllt und die Stapelproduktion ist frei:

    Stil-Referenz (erledigt 17.08.) → Kette (erledigt 20.08.) → Stapel (frei)

Offen bleibt an Schritt 1 nur eine Kleinigkeit, die diese ADR ausdrücklich
verlangt: **der Prompt des Referenzbildes ist nirgends festgehalten.** Die
Stilreferenz beschreibt das Ergebnis sehr genau, aber ohne den Prompt lässt sich
das Bild nicht reproduzieren — und genau das wäre bei einem Werkzeugwechsel nötig.

Die drei Füchse bleiben trotzdem ein Kettentest und kein Inhalt: Gegen die
Stilreferenz geprüft fallen sie durch (kein Fächer, kein Pilzbefall, Signalfarbe
als Fläche statt als Punkt, beim „fantasy creature" mehrere Ruten). Die Prüftabelle
steht im Nachtrag der Stilreferenz.

### Was ausdrücklich **nicht** entschieden wurde

Dass die Silhouetten aus `kreaturgestalt.ts` durch Modelle ersetzt werden. Diese ADR
hat echte Kreaturmodelle immer vorgesehen — die Silhouetten sind der Platzhalter
davor (G-23), nicht eine konkurrierende Entscheidung. Es gibt hier nichts zu kippen.
Was gesperrt bleibt, ist der Teilausstieg: **drei Modelle neben elf Silhouetten
sehen schlechter aus als vierzehn Silhouetten oder vierzehn Modelle.** Gebaut wird
erst, wenn alle vierzehn in einem Zug entstehen können — die Stil-Referenz steht
dafür bereit.

## Grenze (bekannte Limitation)

Deckt **nicht** ab: Animation über das Auto-Rigging hinaus (Kampfposen, Idle-Zyklen),
Texturen (aktuell Vertex-Farben) und Audio. Die Lizenzlage KI-generierter 3D-Modelle
ist 2026 uneinheitlich. ~~Hunyuan3D ist laut Anbieter kommerziell nutzbar, vor einer
Veröffentlichung ist das erneut zu prüfen.~~ — **Geprüft am 20.08.2026, siehe Nachtrag:
Hunyuan3D schließt die EU ausdrücklich aus, Tripos Gratistarif räumt gar keine Rechte
ein. Der Generierungsweg ist auf SPAR3D umgestellt.**
