---
last-reviewed: 2026-11-22
shelf-life-days: 90
owns: *.json
---
# content/strecken — Lehrstrecken (_INDEX)

> Story-Bibel v2 §6 Schritt 0 (D381): Das Spiel beginnt draussen, man kämpft sich zur Enklave durch, und dieser
> Weg ist die Lehrstrecke — ohne Texttafeln, die Welt lehrt. Eine Strecke ist die Folge ihrer Stationen: was man dort
> lernt, wer dort steht, was dort erzählt wird. Angelegt mit D390.
>
> **Nur Daten.** Das Spiel liest diesen Ordner noch nicht (kein Lader in `src/data/inhalte.ts`): Es stellt weder die
> Gegner auf noch setzt es den Spielbeginn um. Was dazu fehlt, steht in
> `../../docs/design/BRACHLAND_Weg-nach-Brannburg_v1.md` §7.

## „Lies-wenn"-Routing

| Deine Aufgabe ist … | Lies |
|---|---|
| Wissen, wo die Stationen liegen und warum (Koordinaten, Höhen, Wegmeter) | `../../docs/design/BRACHLAND_Weg-nach-Brannburg_v1.md` |
| Eine Station anlegen oder umbesetzen | `weg-nach-brannburg.json` als Muster → `../../src/data/schema.ts` (`Strecke`, `LEKTIONEN`) → danach `npx tsx tools/streckensim.ts` |
| Verstehen, was geprüft wird | `../../tools/validate.ts` (Abschnitt „Lehrstrecken“) → `../../tests/strecken.test.ts` |
| Einen Gegner der Strecke nachstellen | `../gegner/_INDEX.md` — die Werte liegen dort, hier steht nur Art und Zahl |

## Register

| Datei | Region | Inhalt |
|---|---|---|
| `weg-nach-brannburg.json` | Œntal | **Der Weg nach Brannburg** (D390): Start an der Regionsmitte (0/0, 629 m), 1.182 Wegmeter und 107 Höhenmeter hinunter bis zur Magd am Westrand der Enklave. Acht Stationen: Am Talweg (Bewegen, Kamera) → Zwei Höfe am Fahrweg (1 Fuchs: leichter Angriff, Ausdauer) → Im Steig (1 Keiler: Rolle) → Unter dem Steig (1 Keiler: Reinigen) → Remise am Steig (Zuflucht: Rast) → Halle an der Gabelung (2 Füchse: Lock-On) → An der Furt (1 Wolf: Block, Parade) → Vor dem ersten Haus (1 Grathorn: Haltung). Ankunft: `dorf-magd`, dann `terrasse-saal` |

## Was eine Station ist

`id`, `name`, `ort` (lat, lon — dort stehen die Gegner), `lehrt` (ein bis drei Lektionen), dazu:

- **`gegner`** — Art (ID aus `../gegner/`) und Zahl. Leer heisst: kein Kampf.
- **`bild`** oder **`fragment`** — jede Station erzählt etwas: ein Bild (Vorgabe für die Szene, kein Text im Spiel)
  oder ein Fundstück aus `../fragmente/`.
- **`zuflucht`** — die Zuflucht der Station aus `../orte/`.
- **`wege`** — Wege zur nächsten Station nach Story-Bibel v2 §3: `beschwerlich` oder `werkzeug` (mit `werkzeug`:
  `klettern`, `schwimmen`, `gleiten`, `reiten`).

`start` ist der **vorbereitete** Spielbeginn (Ort, Blick). Der wirksame steht in `LEERER_STAND.position`
(`../../src/spiel/spielstand.ts`) und ist nicht umgestellt. `ankunft` nennt den Bewohner, den man als Ersten trifft,
seinen Satz beim ersten Mal und die Zuflucht, in der die Strecke endet.

## Regeln

- **Erste Station kampffrei**, dann D381 der Reihe nach: erster Kampf → erstes Reinigen → erste Rast → Kampf vor dem
  Tor (`../../tests/strecken.test.ts`).
- **Jede Lektion mindestens einmal** (`LEKTIONEN` im Schema) — `npm run validate`.
- **Nur Gegner aus `../gegner/`**, kein Übungsgegner. Reinigen lernt man an einem Tier (D385: die Marke greift bei
  Menschen nicht), den Zielwechsel an mindestens zweien, die Rast an einer Zuflucht.
- **Über der Flutlinie, nicht im Grundriss, jede Station näher an der Ankunft als die davor.** Fundstück und Zuflucht
  höchstens 40 m von ihrer Station.
- **Kein Fundstück eines verborgenen Orts.**
- **Keine Kampfwerte hier.** Leben, Schaden, Fenster stehen in `../gegner/`; wer die Strecke schwerer will, besetzt um
  und misst mit `tools/streckensim.ts`.

## Definition of Done

- **Input:** neue oder geänderte `.json` in diesem Ordner
- **Output:** `npm run validate` und `npm test` grün; Tabelle aus `npx tsx tools/streckensim.ts` in die Design-Notiz
- **Fehlerfall:** Lektion fehlt oder Station liegt falsch → Strecke ändern, nicht die Prüfung lockern
- **Rollback:** Datei löschen; nichts im Spiel hängt daran
