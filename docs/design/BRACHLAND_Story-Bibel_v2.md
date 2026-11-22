---
last-reviewed: 2026-11-22
shelf-life-days: 180
---
# BRACHLAND — Story-Bibel v2

> **Ersetzt v1** (Versionsregel `_INDEX.md`). Grund: v1 beschrieb einen rundenbasierten Creature-Collector; seit
> ADR-0007 ist BRACHLAND ein Echtzeit-Nahkampfspiel, und Flo hat am 22.11.2026 vier Grundsatzfragen entschieden
> (Ledger D374). Unverändert aus v1 und hier nicht wiederholt: Vorgeschichte VERIDIA/Faulbrand (§2), Regenten-Tabelle
> (§5), Namensschema (§8), Kapitel-Template (§10). Offen/erledigt steht im Ledger, nicht hier.

Genre: 3D-Action-RPG mit Echtzeit-Nahkampf (ADR-0007), offene Welt auf realer Karte, Erzählung über Welt und Fundstücke.
Messlatte Erlebnis: Elden Ring (Flo, 22.11.2026) — entdecken statt geführt werden, Wege, die man verpassen kann,
Bewohner mit eigenen Wegen, ein Ende, das man sich erspielt. Übernommen wird die Bauweise, nicht die Gestalt (ADR-0004).

## 1. Der Kern in drei Sätzen

VERIDIA hat die Natur ersetzt; der Faulbrand ist ihr Notfallprotokoll, eine Bodensanierung, in der der Mensch nicht
mehr vorkommt. Der Brachgänger trägt eine Marke, mit der er Befallene **heilt statt tötet** — und mit jedem geheilten
Regenten liest er mehr vom Protokoll. Am Ende entscheidet er, wem das geheilte Land gehört.

## 2. Die Marke: heilen statt töten (D374)

- **Im Kampf:** Befallene werden niedergerungen (Haltung gebrochen, ADR-0007) und dann über die Marke **gereinigt**.
  Töten bleibt möglich und ist schneller; Reinigen kostet ein Zeitfenster, in dem der Brachgänger verwundbar ist.
- **In der Welt:** Gereinigte Tiere bleiben als reine Tiere im Revier und greifen nicht mehr an. Ein Revier, in dem
  überwiegend gereinigt wurde, wird ruhiger; eines, in dem getötet wurde, wird leer. Beides ist sichtbar.
- **Verhärtete** (Endstadium) lassen sich nur mit Reinkulturen reinigen — das sind die optionalen Bosse.
- **Die Marke wächst** mit jedem Regenten: mehr Fassungsvermögen, ein Direktivkern als Elementarangriff
  (`BRACHLAND_Kernfunken_v1.md`), und ein weiteres Stück lesbares Protokoll.
  **Seit D411:** Als eigene Wirkung behält die Marke nur **Orten und Rufen** (Sensor, Rückruf); Elementangriffe kommen
  aus **Geräten** des Altbestands (Abflammgerät, Kohlensäurelöscher, Weidezaungerät, Räucherkanne in Kapitel 1,
  Kalkstreuer in Kapitel 2), die über denselben Elementkreis wirken (`BRACHLAND_Waffen-Baukasten_v1.md` §16–§23).
- **Gewicht:** Reinigen ist die Handlung der Enklaven-Erzählung („zurückverwandeln“). Mit dem Twist wird sie
  zweideutig: Wer reinigt, nimmt dem Land seine Therapie. Die Grünen Mönche zählen mit.
- Fangen, Team und Training aus v1 entfallen. Reiten bleibt als Bindung **eines** ~~gereinigten Tieres~~ Tieres: seit
  D411 **des letzten verwilderten Tragtiers des Försterhofs** (Bergpferd oder Maultier), befallen und zu reinigen —
  kein Wildtier des Œntals trägt in echter Grösse einen Erwachsenen (`BRACHLAND_Traversal_v2.md` §5,
  `BRACHLAND_Physik-Pruefung_v1.md` §4.2).
- **Setzung über die Welt (Flo, 22.11.2026, D411): Rauch beruhigt den Befall.** Real beruhigt Rauch nur Bienen: Er
  überdeckt den Alarmduft, das Volk frisst sich voll und wird träge. Im Spiel antwortet der Symbiont des Faulbrands auf
  Rauch **wie ein Bienenvolk** — Befallene werden ruhig und lassen sich von der Marke greifen (Zustand „ruhig“,
  Griff-Fenster ohne Schaden), sterben davon aber nicht und werden davon nicht rein. Das ist eine **benannte Abweichung** (D398), keine Physik: Sie gibt dem
  Heiler sein Gerät (die Räucherkanne öffnet das Griff-Fenster ohne Schaden) und der Imkerei der Enklave einen Platz.
  Was Rauch nicht tut: töten und heilen — das Heilen bleibt bei der Marke.

⚠️ UNKLAR (Balance, nicht Story): Belohnung für Reinigen gegen Töten, damit beides eine echte Wahl bleibt. Vorschlag:
Töten gibt Material (Schmiede), Reinigen gibt Markenfortschritt und Reviergunst.

## 3. Weltstruktur: offen, mit zwei Wegen zu jedem Ziel (D374)

Flo, 22.11.2026: „Es soll entweder die Abkürzung mit einem neuen Tool geben oder einen längeren, schwierigeren,
beschwerlichen Lösungsweg ohne.“

**Regel:** Kein Ziel ist hart verschlossen. Zu jedem wichtigen Ort führen zwei Wege:

| | Der Werkzeugweg | Der beschwerliche Weg |
|---|---|---|
| Was | kurz, direkt, braucht eine Fähigkeit (Klettern, Schwimmen/Tauchen, Gleiten, Reiten) oder ein Fundstück | lang, gefährlich, ohne Werkzeug gangbar |
| Preis | man muss das Werkzeug erst verdienen | stärkere Gegner, Umwege, Ausdauer, Orientierung |
| Lohn | Tempo, und Rückwege werden zu Abkürzungen | eigene Fundstücke, die nur dort liegen; man ist „zu früh“ da |

- **Weiche Tore:** Stärke der Gegner, Gelände und Wetter lenken; nichts sagt „hier noch nicht“.
- **Harte Barrieren nur aus der Welt:** die Flut (Talboden), die Befallsgrenze (über 1.000 m hört es auf) und die
  Regionsübergänge (ADR-0014). Auch sie haben den beschwerlichen Weg, wo es die Geografie hergibt.
- **Je Region:** ein Pflichtkern (Regent), drei Reinkultur-Orte in drei Himmelsrichtungen, und mindestens drei
  **verborgene Orte** mit eigenem Verhärteten, die niemand erwähnt — man findet sie über Gelände, Licht oder Fundstücke.
- **Zufluchten** sind Rastpunkte (Speichern, Rasten, Schmiede dort, wo ein Mensch lebt), verteilt in Ringen um die
  Enklave, je weiter draussen, desto seltener.
- **Führung:** Witterungsanzeige und Blickachsen, kein Auftragslog mit Kartenmarken (Story-Struktur v1 bleibt hier
  gültig).
- **Werkzeuge** (D388, D391, `BRACHLAND_Traversal_v2.md`): Schwimmen und Klettern sind ab Start in Grenzen möglich
  (17,8 m Wasser, kurze Wände); Tauchzeug, Kletterzeug, Gleiter und Reittier heben die Grenze auf. Keines liegt beim
  Regenten und keines einfach herum: jedes hinter einem optionalen Boss, einem Rätsel oder einer Nebenaufgabe.

## 4. Œntal: Flut und Enklave (D374, schliesst A-21 Punkt 2 und 3)

- **Die Flut kommt vom Stauwehr.** Der Flussvater staut die Œn; der Talboden unter der Wehrkrone ist abgesoffen.
  `flutlinie` **499 m** (Wehrkrone, `content/orte`/Höhenraster; Arbeitswert, in den Regionsdaten festzuschreiben).
  Unter 495 m stehen 1.314 von 2.033 Gebäuden: Das ist die versunkene Stadt.
- **Die Enklave liegt auf der Hangterrasse** (x 650–750, z −280…−740, 505–525 m), über jeder Flutlinie, mit Blick
  auf den gefluteten Talboden. Sechs Bewohner ziehen dorthin um; das alte Dorf ist geräumt.
- **Die Milbinger Straße ist Brache in der Flutzone** (A-21 Option b): Wasserlinie, Schlamm, Treibgut; D346–D348
  bleiben und bekommen die Flutspuren.
- **Der Name** bleibt ⚠️ UNKLAR („Mildorf“ ist ein Echo von Mühldorf, die Region ist Brannenburg) — Vorschlag folgt
  mit der Ortsliste.
- **Zeit:** 40–60 Jahre nach dem Kollaps gilt. Die Flut ist jung („seit dem Frühjahr“): der Flussvater hat das Wehr
  erst jetzt geschlossen. „Achtzehn Jahre“ und „zwei Jahre“ in Fundtexten sind lokale Zeiten und werden beim
  Überarbeiten der Texte gegen diese Linie geprüft.

**Folgen für die Erkundung:**

| Ziel | Werkzeugweg | Beschwerlicher Weg |
|---|---|---|
| Flussvater am Wehr (Westufer; D380) | durch die versunkene Stadt schwimmen/tauchen, am verborgenen Kirchturm vorbei — ~~wenige Minuten~~ **„der Weg ohne Kampf“** (D411): länger als der Uferweg (1,9–2,4 km Wasser), keine Begegnung, der Kirchturm als Rast, Ankunft am Schieberhaus | **der Uferweg** (≈ 1,7 km, fast eben, trocken): drei Engstellen mit je einem Verhärteten oder Rudel, unterspülte Abschnitte (Schlamm kostet Ausdauer, Einsturz zwingt an den Hang), keine Zuflucht bis hinter das Wehr |
| Reinkultur Nord (Absetzbecken) | mit Tauchzeug vom Abstieg durch die Flut ans Nordufer (1.079 m, kein Landgegner) | Hangweg über Feldscheune und Schuppen (1.082 m), dann 21 m ohne Werkzeug schwimmen — das Fundstück liegt auf dem Grund |
| Reinkultur West (Oberstollen, 963 m) | mit Kletterzeug die Stufe unter dem Grat | alter Almweg mit Lawinenstrich (2.097 m, 451 Höhenmeter) |
| Reinkultur Süd (Saatkammer, 601 m) | mit Gleiter vom Westhang (Absprung um −896 / 916, 1.330 m Flug) — erst West, dann segeln | Uferweg über den Stadel am Hangweg, dann bergauf (1.856 m, 99 Höhenmeter) |
| Kapelle auf der Insel, Kirchturm im Wasser | mit Tauchzeug (380 m Querung, 447 m vom Ufer) | erst der Flussvater: Das Wasser sinkt, beides fällt trocken |

Von der Terrasse selbst lässt sich nicht gleiten (höchstens 26 m über der Flutlinie); Gleiten gehört den Westhängen
(D391). Die Westhälfte bekommt damit Zweck; die versunkene Stadt wird das Erkundungsgebiet des Kapitels.

**Zugang zum Flussvater (Flo, 22.11.2026, D380):** Das Gelände gibt keinen Weg „über Flutgrund“ her — das Wehr liegt am
Westufer, und von der Enklave führt ein trockener Uferweg hin (`BRACHLAND_Enklave_Lage_v2.md`). Entschieden: Der
Uferweg bleibt offen und **ist** der beschwerliche Weg; der Regent rückt nicht ins Wasser. Wer sich durchbeisst, steht
früh vor dem Flussvater — das ist gewollt (siehe §6: besiegbar ohne Reinkulturen, das Tal fällt dann trocken, bleibt
aber befallen).

**Der Weg zum Flussvater, nachgeschärft (Flo, 22.11.2026, D411):** Der Wasserweg ist **keine Abkürzung** — er ist länger
als der Uferweg und Wasser ist bei jedem ehrlichen Tempo langsamer (`BRACHLAND_Physik-Pruefung_v1.md` §4.1). Er heisst
deshalb **„der Weg ohne Kampf“**: wer das Tauchzeug hat, schwimmt an der Oberfläche durch die versunkene Stadt, rastet am
Kirchturm, taucht nur für das, was unten liegt, und kommt am Wehr von der Wasserseite an — am Schieberhaus, wo der
Schlüssel liegt. Der Uferweg ist der kurze, harte Weg mit drei Engstellen. D380 gilt im Ziel (zwei Wege, keiner
verschlossen, D374) und ändert sich in der Begründung: Der eine Weg kostet Kämpfe, der andere Zeit.

## 5. Fraktionen und die drei Enden (D374)

Am Werksleib (Aschefeld) entscheidet der Brachgänger, was mit dem Protokoll geschieht:

| Ende | Fraktion | Was geschieht | Preis |
|---|---|---|---|
| **Zurückdrehen** | Enklaven | Menschenland kehrt zurück | die neue Natur stirbt; der Boden ist wieder der kranke von früher |
| **Übernehmen** | Das Erbe | die Symbionten gehorchen wieder | eine neue Herrschaft über alles, was wächst |
| **Vollenden** | Grüne Mönche | das Land heilt zu Ende | der Mensch muss sich wandeln — der Brachgänger ist der Prototyp (Twist §3 v1) |

- **Erspielt, nicht gewählt:** Ein Ende steht nur offen, wenn die Geschichte seiner Fraktion verfolgt wurde. Jede
  Fraktion hat je Region **eine Figur** mit eigenem Weg (3–5 Stationen, zieht weiter, kann scheitern oder sterben,
  wenn man sie verpasst oder falsch handelt). Kein Dialogbaum: Die Figur spricht, der Spieler handelt (bringen,
  reinigen, töten, verschweigen).
- **Das Verhalten zählt mit:** Reinigen/Töten-Bilanz und der Umgang mit den Regenten (nach dem Sieg ansprechbar)
  färben, welche Figuren einem trauen.
- **Wer worauf schaut (D385):** Die Enklave schaut auf den Anteil der Gereinigten (geheilt oder geschlachtet?). Das
  Erbe schaut auf Macht (Waffe, Marke). Die Mönche zählen **jeden Eingriff** — ein gereinigtes Tier nimmt dem Land
  genauso etwas wie ein getötetes; ihr Vertrauen gewinnt, wer ausweicht und umgeht. Das ist der dritte Spielstil neben
  Schlächter und Heiler.
- **Menschen sind nicht reinigbar (D385).** Sie sind nicht befallen. Gegen menschliche Gegner endet der Kampf mit dem
  Haltungsbruch: Sie fliehen oder ergeben sich, und der Brachgänger entscheidet — töten, vertreiben, verschonen.
  **Ausnahme:** Menschen, die sich dem Befall freiwillig ausgesetzt haben (Mönche im Endstadium), sind reinigbar. Dort
  ist Reinigen ein Übergriff gegen den Willen des anderen.
- **Kapitel 1 setzt die drei Figuren:** eine aus der Enklave (will den Flussvater tot), einen Mönch am Stau („Er
  reinigt nur“), einen Boten des Erbes (erscheint nach dem Wandel mit einem Handel).

## 6. Kapitel 1 — „Œntal“ (Bogen, ersetzt v1 §9)

0. **Der Weg nach Brannburg (D381).** Das Spiel beginnt draussen im Brachland, rund einen Kilometer von der Enklave.
   Man kämpft sich hin: Bewegung, erster Kampf, erstes Reinigen, erste Zuflucht, ein harter Gegner vor dem Tor. Das
   ist die Lehrstrecke — ohne Texttafeln, die Welt lehrt.
1. **Ankunft auf der Terrasse.** Die Enklave misstraut der Marke. Unten liegt die versunkene Stadt.
2. **Das stehende Wasser.** Die Enklave will den Flussvater tot; der Mönch warnt. Erste Reinigung als Lehrstück.
3. **Drei Reinkulturen in drei Richtungen**, in beliebiger Reihenfolge, je mit Werkzeugweg und beschwerlichem Weg.
   Unterwegs: die drei Fraktionsfiguren, verborgene Orte, die versunkene Stadt.
4. **Der Flussvater** im gefluteten Werk. Töten oder — mit vollständigem Satz Reinkulturen — reinigen. Danach ist er
   ansprechbar: erstes Protokoll-Fragment.
5. **Wandel.** Das Wasser sinkt (ein Weltzustand je Region), die versunkene Stadt fällt trocken und öffnet neue Orte.
   Der Bote des Erbes kommt.

Der Flussvater ist **ohne** Reinkulturen erreichbar und besiegbar (beschwerlicher Weg: töten). Das Tal fällt dann
trocken, bleibt aber befallen; die Heilung der Region braucht die Reinkulturen. Auch das ist ein Zustand, mit dem
man weiterspielen kann.

## 7. Was daraus als Nächstes folgt

1. Ortsliste Œntal neu setzen (Enklave, Zufluchten in Ringen, drei Reinkulturen, drei verborgene Orte, drei
   Fraktionsfiguren mit Stationen) — `BRACHLAND_Enklave_Lage_v1.md` wird zur v2 mit Koordinaten.
2. `flutlinie` in die Regionsdaten, Verfallsregel ADR-0017 daran hängen.
3. Aufträge und Fundtexte gegen Zeitlinie und neue Lage prüfen (17 Aufträge, 14 Fundstücke).
4. Reinigen als Kampfhandlung entwerfen (Kampfsystem, ADR-0007) und simulieren.
5. Traversal v1 auf „Werkzeugweg statt Verbot“ umstellen — `BRACHLAND_Traversal_v2.md` (D388, D391).
