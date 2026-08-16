---
last-reviewed: 2026-08-16
shelf-life-days: 180
---
# BRACHLAND — Story-Struktur und Missionen v1

> Wie Geschichte in einem Spiel dieser Bauart normalerweise gemacht wird, welche
> Variante zu BRACHLAND passt, und wie sie technisch aussieht.

## Wie man das normalerweise macht

Es gibt im Wesentlichen vier Bauweisen. Sie schließen sich nicht aus; jedes große
Spiel mischt.

### 1. Kritischer Pfad mit Toren

Eine Kette von Pflichtaufgaben. Jede schaltet die nächste Region frei. Alles andere
ist optional. **Pokémon ist genau das:** acht Arenen, jede ein Tor, dazwischen freie
Welt. Der Fortschritt ist eine Liste, die man abhaken kann.

*Stark:* immer klar, was als Nächstes dran ist. *Schwach:* fühlt sich linear an,
wenn die Tore zu eng stehen.

### 2. Nabe und Speichen

Ein zentraler Ort mit Auftraggebern, von dem Aufträge in die Welt gehen. Zwischen den
Aufträgen kehrt man zurück. Klassisch für Rollenspiele mit Gilden.

*Stark:* leicht zu erweitern, jede Speiche ist unabhängig. *Schwach:* das Zurückkehren
wird zur Pflicht, und die Welt fühlt sich wie eine Auftragsbörse an.

### 3. Ortsgebundene Fragmente

Keine Auftraggeber. Die Geschichte liegt **in der Welt**: Notizen, Ruinen, Leichen,
Aufzeichnungen. Der Spieler setzt sie selbst zusammen. Dark Souls, Outer Wilds.

*Stark:* die Welt trägt die Geschichte, kein Dialogbaum nötig. *Schwach:* wer nicht
sucht, bekommt keine Geschichte — und viele suchen nicht.

### 4. Zustandsgetriebene Welt

Die Welt hat Zustände (Fluss gestaut / frei, Enklave verseucht / geheilt), und
Handlungen ändern sie sichtbar. Aufträge sind dann nur die Anleitung dazu.

*Stark:* Fortschritt ist sichtbar statt in einem Menü. *Schwach:* teuer — jeder
Zustand braucht eine eigene Darstellung.

## Was zu BRACHLAND passt

Die Story-Bibel legt „**Fragmente statt Cutscenes**" fest, wortkarg und melancholisch.
Das ist Bauweise 3. Nur mit 3 allein bekommt aber ein Teil der Spieler nie eine
Geschichte, und es gibt keinen Grund, irgendwo hinzugehen.

**Empfehlung: 1 + 3 + 4, ohne 2.**

- **Kritischer Pfad (1)** über die Regenten. Fünf Regionen, fünf Regenten, jeder
  schaltet eine Traversal-Fähigkeit frei. Das ist die Pokémon-Struktur, und sie ist
  hier schon halb gebaut: Regent, Region, Traversal stehen als Felder im Schema.
- **Fragmente (3)** als Haupterzählform. Sie liegen an Orten, die aus den OSM-Daten
  ohnehin existieren — Ruinen, Bunker-Silos, Steinbrüche, Trafostationen. Die Welt
  liefert die Orte umsonst, sie muss nur belegt werden.
- **Weltzustand (4)** an genau **einer** Stelle je Region: dem Regenten. Vor dem
  Kampf steht das Stauwasser, danach sinkt es — der Fluss ändert sein Bett, Ufer
  werden begehbar, neue Fragmente werden zugänglich. Ein Zustand je Region ist
  bezahlbar; fünf wären es nicht.
- **Keine Nabe (2).** Es gibt keine Auftraggeber. Wer Aufträge will, findet sie an
  Orten, nicht bei Personen.

### Was das für NPCs heißt

Wenige, ortsfest, ohne Dialogbaum. Ein NPC sagt zwei bis vier Sätze, abhängig vom
Weltzustand — mehr nicht. Ein Dialogsystem mit Verzweigung ist Bauweise 2 durch die
Hintertür und kostet ein Vielfaches.

## Technische Form

Alles als validierte Daten, wie Kreaturen und Moves.

### Auftrag

```
content/auftraege/<id>.json
{
  id, titel, region,
  auslöser:   { art: 'ort' | 'fragment' | 'regent' | 'kreatur', ... },
  schritte:   [ { text, bedingung } ],
  belohnung:  { gegenstaende?, faehigkeit?, fragment? },
  bedingung?: { vorher?: <auftrag-id>, regentBesiegt?: <regent-id> }
}
```

Ein Schritt ist erfüllt, wenn seine `bedingung` wahr wird. Die Bedingungen sind eine
**geschlossene Liste** von Prüfungen gegen den Spielstand — nicht Skript, nicht Code:

| Bedingung | wahr, wenn |
|---|---|
| `betrete` | Spieler war im Umkreis eines Orts |
| `besiege` | Kreaturenart n-mal besiegt |
| `fange` | Kreaturenart im Team |
| `finde` | Fragment gelesen |
| `bringe` | Gegenstand im Beutel |
| `regent` | Regent besiegt |

Damit bleibt das Missionssystem eine **Zustandsmaschine über dem Spielstand** und
braucht keinen Interpreter. Das ist die Sorte Entscheidung, die dieses Projekt
tragen kann; ein Skriptsystem wäre die, an der es stirbt.

### Fragment

```
content/fragmente/<id>.json
{ id, region, ort: [lat, lon], titel, text, gefundenBei?: 'ruine' | 'bunker' | ... }
```

Kurz, wortkarg, ohne Erklärung. Höchstens 400 Zeichen — der Ton der Story-Bibel
verträgt keine Textwand.

### Im Spielstand

```
auftraege: { [id]: { schritt: number, erledigt: boolean } }
fragmente: string[]     // gelesene
weltzustand: { [region]: { regentBesiegt: boolean } }
```

## Konkreter Plan für Kapitel 1

| # | Schritt | Ergebnis |
|---|---|---|
| 1 | Schemas `Auftrag` und `Fragment`, Spielstand erweitern | Gate prüft Inhalte wie bisher |
| 2 | 8–12 Fragmente an OSM-Orten (Ruinen, Silos, Steinbruch, Trafostation) | die Welt erzählt |
| 3 | Fragment-Anzeige beim Betreten, Leseliste im Beutel | Fundstücke haben einen Ort |
| 4 | 3 Aufträge: „Finde den Grat", „Das Stauwasser", „Was im Schaltschrank lebt" | ein Faden durch die Region |
| 5 | Weltzustand Flussvater: Wasserstand vor/nach dem Kampf | Sieg ist sichtbar |
| 6 | 2–3 ortsfeste NPCs mit zustandsabhängigen Zeilen | jemand ist da |

Schritte 1–3 sind das Fundament und in sich nützlich. 4–6 bauen darauf auf und
können warten.

## Was ausdrücklich nicht kommt

- Dialogbäume mit Auswahl
- Vertonung
- Zwischensequenzen
- Ein Auftragslog mit Kartenmarkierungen — die Witterungsanzeige ist die einzige
  Führung, die dieses Spiel haben soll
