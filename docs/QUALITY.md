# BRACHLAND — Qualitätsstandard und Tore

---

## 1. Zuerst: „Premium" ist als Ziel unbrauchbar

Ein Solo-Hobbyprojekt erreicht keine AAA-Produktionsqualität — das wurde beim
Art-Direction-Spike geklärt und gilt weiter. Ein undefiniertes „high premium" wird im
Zweifelsfall wegverhandelt, weil niemand sagen kann, wann es erreicht ist.

**Deshalb die Umdeutung:** Qualität heißt hier nicht *hohe Decke*, sondern
**kein einziges Element unter der Latte**. Der Hebel eines Einzelentwicklers ist nicht,
das Beste besser zu machen, sondern das Schwächste zu entfernen. Konsequenz:
Bei knapper Zeit wird **Umfang gestrichen, nie die Latte gesenkt** — lieber 10 Kreaturen,
die alle gut sind, als 35 mit acht Ausreißern.

Jede Latte unten ist **eine Zahl oder eine Ja/Nein-Frage**. Was sich nicht so fassen lässt,
ist kein Qualitätskriterium, sondern eine Meinung.

---

## 2. Die sechs Säulen mit Schwellen

| Säule | Latte | Prüfung |
|---|---|---|
| **Performance** | 60 fps auf einem Mittelklasse-Handy, Ladezeit < 5 s, Gesamtpaket < 60 MB, im Flugmodus vollständig spielbar | automatisch + Gerätetest |
| **Assets** | ≤ 8.000 Tris, ≤ 120 KB je Kreatur, Texturen ≤ 1024 px, < 5 % ungebundene Vertices nach Rigging | automatisch |
| **Inhalt** | keine Platzhalter, Beschreibung ≥ 40 Zeichen, genau ein Biotech-Merkmal je Kreatur | automatisch |
| **Balance** | Werte-Zuwachs je Stufe 15–45 %, ≥ 4 Elemente je Region, **jede Regenten-Phase konterbar**, Fokus-Effizienz normal = schwer | automatisch |
| **Visuelle Kohärenz** | Palette eingehalten, Silhouette auf Spieldistanz erkennbar, Stil-Referenz getroffen | manuell, Checkliste |
| **Spielgefühl** | Playtest-Ritual bestanden | manuell, feste Fragen |

---

## 3. Automatisches Tor: `npm run quality`

Läuft in CI, blockt den Merge. Zwei Stufen: **Blocker** stoppen, **Warnungen**
verlangen eine bewusste Entscheidung.

Verifiziert an echten Inhalten — das Tor hat beim ersten Lauf sofort vier echte
Probleme im Œntal gefunden:

```
✗ [Balance] oental.json: nur 3 Elemente vertreten — Region wird eintönig (min. 4)
✗ [Balance] oental.json: Regenten-Phase 2 (faeulnis) hat KEINEN Konter in der Region
✗ [Balance] oental.json: Regenten-Phase 3 (alt-tech,stein) hat KEINEN Konter
✗ [Assets]  testgross.glb: 1431 KB über Budget 120 KB
! [Balance] oental.json: Phase 1 nur über 'alt-tech' konterbar — bewusst als Engpass?
```

Die **Konterbarkeitsprüfung** ist der wertvollste Teil: Sie leitet aus der Elementmatrix
ab, ob jede Regenten-Phase mit den Kreaturen der Region überhaupt schlagbar ist. Ein
unfairer Bosskampf fällt damit beim Commit auf, nicht im Playtest nach drei Wochen.
Wenn ein Engpass gewollt ist — wie der Firnhase in Kapitel 1 — erscheint er als Warnung,
die man bewusst abnickt.

Ergänzend prüft `npm run validate` die Struktur (Zod-Schemas + Matrix-Selbsttest).
Beides zusammen ist das automatische Tor.

---

## 4. Manuelles Tor: was sich nicht messen lässt

### 4a. Visuelle Kohärenz — Checkliste je Asset

Vor dem Einchecken einer Kreatur, alles Ja:

- [ ] Silhouette auf 20 m Spieldistanz erkennbar (Screenshot in Spielgröße prüfen)
- [ ] Basistier bleibt lesbar — das Merkmal bricht die Form, ersetzt sie nicht
- [ ] Palette eingehalten: gedämpfte Umgebungstöne + **eine** Signalfarbe für Befall
- [ ] Detailgrad passt zum Rest des Rosters (Stichprobe mit drei vorhandenen Kreaturen)
- [ ] Anbauten wirken gewachsen, nicht aufgeklebt
- [ ] In Bewegung geprüft, nicht nur als Standbild

### 4b. Playtest-Ritual — feste Fragen, ehrlich beantwortet

Nach jedem Meilenstein, immer dieselben Fragen. Antworten schriftlich, damit sie
vergleichbar bleiben:

1. Habe ich freiwillig weitergespielt, oder habe ich getestet?
2. Wo habe ich mich das erste Mal gelangweilt? (Zeitstempel)
3. Was habe ich nicht verstanden, ohne nachzusehen?
4. Welcher Kampf war der interessanteste — und warum genau?
5. Was würde ich löschen, wenn ich nur noch die Hälfte behalten dürfte?

Frage 5 ist die wichtigste: **Was dort genannt wird, wird tatsächlich gelöscht.** Das
ist der Mechanismus, der die Latte hebt, ohne Zeit zu kosten.

### 4c. Fremdtest

Mindestens eine Person außerhalb des Projekts spielt M0 und M1 ohne Erklärung.
Kriterium: Sie kommt ohne Nachfragen durch den ersten Kampf und kann danach
in eigenen Worten sagen, worum es im Spiel geht.

---

## 5. Wo die Tore greifen

| Zeitpunkt | Tor |
|---|---|
| bei jedem Commit | `npm run validate` |
| bei jedem Merge (CI) | `npm run quality` — Blocker verhindern den Merge |
| beim Einchecken eines Assets | Checkliste 4a |
| Ende eines Meilensteins | Abnahmekriterien (ROADMAP) + Playtest-Ritual 4b |
| Ende von M0 und M1 | Fremdtest 4c |

---

## 6. Wie Schwellen geändert werden

Schwellen stehen als Konstante `BUDGET` in `tools/quality.ts`. Sie dürfen geändert
werden — aber nur in einem eigenen Commit, dessen Nachricht die Begründung enthält.
Nie im selben Commit wie der Inhalt, der die Schwelle reißt.

Das ist die ganze Regel, und sie ist der eigentliche Schutz: Sie macht das Absenken
der Latte zu einer sichtbaren Entscheidung statt zu einem stillen Nachgeben.

---

## 7. Was das Tor bewusst NICHT prüft

- **Ob die Story gut ist.** Nicht automatisierbar. Gate ist der Fremdtest.
- **Ob sich der Kampf gut anfühlt.** Gate ist das Playtest-Ritual.
- **Ob die Welt schön ist.** Gate ist Checkliste 4a plus ehrliches Hinschauen.

Diese drei entscheiden am Ende über die wahrgenommene Qualität mehr als jede Zahl.
Die automatischen Tore halten nur den Boden — sie heben nicht die Decke.
