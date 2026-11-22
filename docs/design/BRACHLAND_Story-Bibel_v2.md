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
- **Gewicht:** Reinigen ist die Handlung der Enklaven-Erzählung („zurückverwandeln“). Mit dem Twist wird sie
  zweideutig: Wer reinigt, nimmt dem Land seine Therapie. Die Grünen Mönche zählen mit.
- Fangen, Team und Training aus v1 entfallen. Reiten bleibt als Bindung **eines** gereinigten Tieres (Traversal v1).

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
- Traversal v1 §„Reihenfolge und Freischaltung“ wird dadurch zur Tabelle der **Werkzeugwege**, nicht der Verbote:
  Klettern ist ab Start in Grenzen möglich (kurze Wände, hohe Ausdauerkosten), das Werkzeug macht es billig und hoch.

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
| Flussvater am Wehr (≈ 1,4 km über Flutgrund) | durch die versunkene Stadt schwimmen/tauchen | über den Osthang und die Kalkbruch-Kante, an Verhärteten vorbei |
| Reinkultur Nord (Absetzbecken) | Bachlauf schwimmen | Waldrücken umgehen |
| Reinkultur West (Stollen, hoch am Hang) | Wand klettern | alter Almweg mit Lawinenstrich |
| Reinkultur Süd/Ost (neu zu setzen, nicht am Start) | Gleiten von der Terrasse | Abstieg durch den Hangwald |

Die Westhälfte bekommt damit Zweck; die versunkene Stadt wird das Erkundungsgebiet des Kapitels.

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
- **Kapitel 1 setzt die drei Figuren:** eine aus der Enklave (will den Flussvater tot), einen Mönch am Stau („Er
  reinigt nur“), einen Boten des Erbes (erscheint nach dem Wandel mit einem Handel).

## 6. Kapitel 1 — „Œntal“ (Bogen, ersetzt v1 §9)

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
5. Traversal v1 auf „Werkzeugweg statt Verbot“ umstellen.
