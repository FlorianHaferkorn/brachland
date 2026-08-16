---
last-reviewed: {{YYYY-MM-DD}}
shelf-life-days: 90
# owns: *.ts, *.sql     # optional: Code-Completeness — Gate erzwingt HART, dass diese Dateien gelistet sind
# status: living        # optional: living | historical | superseded — frozen → staleness-frei
---
# {{Bereich}} — Zentraler Anlaufpunkt (_INDEX)

> **Einstieg in die {{Bereich}}-Ebene.** Ein neuer Chat/Agent liest **zuerst diese
> Datei** und navigiert von hier gezielt weiter — **nicht** den ganzen Ordner.
> Jede Zeile trägt Zweck + „lies-wenn". SoT-Disziplin: offene/erledigte Punkte und
> Ableitungsketten leben **hier**, nicht verstreut im Fließtext.

| Feld | Wert |
|---|---|
| Stand | {{YYYY-MM-DD}} |
| Rolle | L0-Navigation des {{Bereich}}-Betriebssystems (Schichten L0–L4) |
| Verlinkt von | `CLAUDE.md` (Pflicht-Erstkontakt für {{Bereich}}-Aufgaben) |

---

## 1. Schichtenmodell (optional — wenn der Bereich geschichtet ist)

```
L0  _INDEX.md ......... Navigation (diese Datei) — einziger Pflicht-Erstkontakt
L1  {{ZIELBILD}} ...... Übergeordnetes Modell / Operating-Model
L2  {{Detail}} ........ Einzeldokumente (Markt / Methodik / Technik …)
L3  {{Delivery}} ...... Workflow / Umsetzung (abgeleitet aus L1)
L4  {{Roadmap}} ....... Meilensteine → Tasks → Definition of Done (aus L1–L3)
```

Ableitungsrichtung ist **immer abwärts**: L4 leitet aus L1–L3 ab, nie umgekehrt.

---

## 2. „Lies-wenn"-Routing (Token-Disziplin — nur das Nötige lesen)

| Deine Aufgabe ist … | Lies (in dieser Reihenfolge) | NICHT nötig |
|---|---|---|
| {{Aufgabe A}} | `{{doc1}}` → `{{doc2}}` | {{Rest}} |
| {{Aufgabe B}} | `{{doc3}}` | {{Rest}} |
| {{Aufgabe C}} | `{{doc4}}` → `{{doc5}}` | — |
| {{Architektur-Entscheidung treffen}} | neuestes `docs/adr/NNNN-*.md` (Vorlage `_ADR.md`) | {{Rest}} |

Faustregel: **Ein L0 → (ein Detail)-Pfad genügt** für die meisten Aufgaben.

---

## 3. Dokument-Register (jede `*.md` im Bereich MUSS hier stehen — Drift-Gate)

| Doc | Zweck | Lies-wenn |
|---|---|---|
| `{{doc1}}` | {{Zweck}} | {{wann}} |
| `{{doc2}}` | {{Zweck}} | {{wann}} |
<!-- check_index.py erzwingt: jede *.md ist hier gelistet. Code-Bereiche: `owns:`-Glob im
     Frontmatter setzen → das Gate erzwingt auch *.ts/*.sql etc. (Granularität wählst DU:
     wenige Files direkt vs. Subdir-Module statt 193 Zeilen). Datierte/eingefrorene Docs:
     `status: historical` (raus aus Staleness). >20 Zeilen → in Sub-Bereiche gruppieren.
     Legitime {{…}}-Syntax dokumentieren (z. B. Handlebars/Jinja-Beispiele)? Dann
     `<!-- kit:allow-placeholder -->` irgendwo in der Datei — schaltet den Platzhalter-
     Check für genau diese Datei aus (pro Datei, kein globaler Bypass). -->

---

## 4. Offene Punkte (Ledger — hier abhaken, NICHT im Fließtext)

| ID | Punkt | Status | Datum |
|---|---|---|---|
| {{S-1}} | {{…}} | offen / **erledigt** | {{YYYY-MM-DD}} |

---

## 5. Definition of Done (nur für Bereiche mit operativen Läufen — sonst entfernen)

Konkret, nicht als Checkbox: was rein/raus geht und wie der Fehlerfall aussieht.

- **Input:** {{was muss vorliegen}}
- **Output:** {{was entsteht, wo}}
- **Fehlerfall:** {{woran erkennt man Scheitern, was dann}}
- **Rollback:** {{wie zurück in den Vorzustand}}
