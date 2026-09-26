---
last-reviewed: 2026-09-26
shelf-life-days: 180
---
# ADR-0009 — Richtungskampf: vier Linien, Block und Parade

**Status:** Proposed · 2026-09-26 · Konzept, nichts gebaut · baut auf ADR-0007 (Echtzeitkampf) und ADR-0008 (Waffenwerk) auf · ADR-0004 gilt: Regeln werden übernommen, Figuren, Namen und Oberfläche nicht

## Kontext

Flo (26.09.2026): mehr Anspruch im Kampf, „Richtung Blood of Dawnwalker mit directional combat
system". Gewünscht ist zuerst das Konzept, nicht der Bau.

**Was die Vorlage tut** (öffentliche Beschreibungen, Stand 09/2026, Quellen unten):

- Angriff und Block in **vier Linien**: oben, unten, links, rechts; gewählt per Stickbewegung oder Maus.
- **Block** in der Linie des Angriffs hält die Wucht ab, **kostet Ausdauer**, gehalten schnell viel.
- **Parade**: Block in der richtigen Linie im richtigen Moment (Anzeige wechselt die Farbe) —
  **kostet nichts** und öffnet den Angreifer für einen Konter. Das Fenster gilt als grosszügig.
- **Gegner decken eine Linie.** Wer hineinschlägt, zahlt Ausdauer statt Schaden zu machen; man wartet,
  bis der Gegner sich festlegt, und nimmt die freie Linie. Wer immer aus derselben Linie schlägt, wird gelesen.
- **Undurchdringliche Angriffe** (eigenes Zeichen) lassen sich weder blocken noch parieren — ausweichen.
- **Ausdauer ist im Duell das eigentliche Leben**: Angriff, Block und Ausweichen zehren daraus.
- Höhere Schwierigkeit: kürzere Fenster, am Ende keine Linienanzeige — man liest den Körper.

**Was wir haben (D166–D172):** Schlag mit drei Phasen, Kette je Waffe, schwerer Schlag, Laufangriff,
Rolle mit Unverwundbarkeit, Haltung/Taumeln, Zucken, Angriffsrecht mit Atempause, Rudel. Verteidigung
ist heute **nur** die Rolle. Das ist der Punkt, an dem der Anspruch fehlt: Wer das Telegraf liest,
rollt — es gibt keine zweite Antwort und keine Entscheidung zwischen Linien.

## Vorschlag

### Regeln (`src/kampf/echtzeit.ts`, getestet wie bisher)

| Regel | Wert (Startpunkt, im Tor zu messen) |
|---|---|
| Linien | `oben`, `unten`, `links`, `rechts` — jeder Schlag trägt eine (`Schlag.linie`) |
| Deckung der Spielerin | Linie, solange Block gehalten; Wechsel sofort |
| Block (Linie stimmt) | kein Leben, Ausdauerkosten = Haltungsschaden des Angriffs × 0,5; bei 0 Ausdauer Haltung gebrochen |
| Block (Linie falsch) | wie ungedeckt, aber halber Schaden (die Waffe fängt mit) |
| Parade | Block gedrückt ≤ **0,18 s** vor dem Aktiven, Linie stimmt → 0 Ausdauer, Angreifer **betäubt 0,6 s**, sein Haltungswert −40 % |
| Gegnerdeckung | Menschen decken eine Linie und wechseln sie nach Treffern und nach eigenem Angriff; Schlag in die gedeckte Linie → Angreifer verliert Ausdauer = Schaden × 0,5, Gegner nichts |
| Undurchdringlich | `Schlag.durch = true` — nur Rolle hilft; eigenes Zeichen am Telegraf |
| Lesen | Dreimal dieselbe Linie → Mensch deckt sie vorab |

### Eingabe

- **Mit Ziel (L):** Die Maus wählt die Linie statt die Kamera zu drehen (die Kamera rahmt ohnehin das
  Ziel). Linke Taste Schlag, rechte halten Block, rechts tippen im Fenster Parade. Pfeiltasten als
  Alternative; ohne Ziel wie heute (J/I/K).
- **Anzeige:** eine kleine Raute um das Ziel mit vier Feldern — gewählte eigene Linie, gedeckte Linie
  des Gegners, kommende Linie (Farbe wechselt im Paradefenster). Stufe „lesen" später: Anzeige aus.

### Gegner

- **Menschen** sind die eigentlichen Duellgegner — ADR-0007 sieht sie vor, die Figuren (Quaternius,
  elf Gestalten) liegen bereit. Für sie trägt das System voll: Linien, Deckung, Finten.
- **Tiere** haben keinen Schwertarm. Sie bekommen **Linien aus ihrem Körperbau**, nicht vier:
  Keiler `unten` (Stoss von unten), Grathorn `oben` (von oben herab), Wolf `links`/`rechts`
  (Kopfdrehung vor dem Biss). Der Rammstoss des Keilers aus vollem Lauf wird **undurchdringlich** —
  ein Tier, das 140 kg auf dich wirft, pariert man nicht.
- Das Rudel bleibt die Prüfung der Übersicht, das Duell mit Menschen die Prüfung der Linien.

### Clips

Je Waffe vier gerichtete Schläge und vier Blockhaltungen plus Paraden-Rückstoss — rund 20 Clips.
Die Universal Animation Library 2 (Quaternius, CC0) bringt in der freien Fassung Schwertkombos mit
Erholung, Rückstoss und Schildhaltung; der Rest entsteht mit `tools/waffenclips.py` (Posen in
Weltmetern, IK) — dort ist eine Linie nur eine andere Handbahn. Tiere: Kopfdrehung links/rechts
als Überlagerung des vorhandenen `Attack`-Clips.

## Abwägung

| | Für | Gegen |
|---|---|---|
| **A: voller Richtungskampf** (dieser Vorschlag) | Echte Entscheidung in jedem Austausch; trägt Menschengegner, Nebenbosse und Regenten; Ausdauer bekommt Gewicht | ~20 Clips, eine Anzeige, neues Tor; Tiere passen nur mit eigenen Regeln; lernt sich schwerer |
| **B: Block und Parade ohne Linien** | Klein (keine Linienclips), sofort auf Tiere anwendbar, zweite Antwort neben der Rolle | Kein Lesen von Linien — der Teil, der Dawnwalker ausmacht, fehlt |

**Empfehlung:** A, aber **in drei Stufen**, jede spielbar und gemessen:

1. **Block und Parade** (ohne Linien) — Regeln, Tor, Kampfbot mit Parade-Profil. Prüft, ob die zweite
   Antwort das Rollen nicht entwertet (Ziel: aufmerksam pariert ≥ 30 % der Angriffe, rollt den Rest).
2. **Linien gegen Menschen** — erster menschlicher Gegner (Wegelagerer mit Klinge), Linienanzeige,
   Mauswahl bei Aufschaltung, Gegnerdeckung und Lesen.
3. **Linien der Tiere und Undurchdringliches** — Keiler/Grathorn/Wolf nach Körperbau.

## Konsequenzen

- Der Kampfbot braucht ein drittes Verhalten (Parade mit Reaktionszeit), das Tor ein Band für
  „Parade lohnt sich, ersetzt die Rolle aber nicht".
- `Schlag` bekommt `linie` und `durch`; alle vorhandenen Schläge bekommen eine Linie (Hieb `rechts`,
  Rückhand `links`, Stich und Laufstich `mitte` → `oben`/`unten` festzulegen, Zweihand und Spalthieb `oben`).
- **Offen für Flo:** (1) Maus bei Aufschaltung als Linienwahl — oder Tasten? (2) Wie hart: Anzeige
  immer an, oder als spätere Stufe aus? (3) Soll die Rolle teurer werden, damit Block/Parade sich
  lohnen (Vorlage: Ausweichen kostet), oder bleibt sie wie sie ist?

## Quellen

- Method.gg: „The Blood of Dawnwalker Combat Explained" (Richtungen, Block, Parade, Undurchdringliches)
- timesaver.gg und thebloodofdawnwalkerwiki.com (Parade kostet nichts, Gegnerdeckung, Lesen, Schwierigkeitsstufen)
