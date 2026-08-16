---
last-reviewed: {{YYYY-MM-DD}}
shelf-life-days: 60
---
# {{Entität/Kunde}} — Ledger (_INDEX)

> **Single Source of Truth für diese Entität.** Vor jeder neuen Analyse/Fragenliste
> zuerst hier lesen — nichts neu ableiten oder erneut fragen, was unten als
> entschieden steht. Beantwortete Punkte → Tabelle A, Entscheidungen → Tabelle B,
> **im selben Arbeitsschritt** abhaken. Detail-Notizen sind Belege; ihr
> offen/erledigt-Stand lebt ausschließlich hier.

## Notizen-Register (was steht wo)

| Datei | Inhalt |
|---|---|
| `{{Status.md}}` | {{Phasen-Status, nächste Schritte}} |
| `{{Notizen/JJJJ-MM-TT_Thema.md}}` | {{Detail-Beleg, kurz}} |
| `{{Diagnose/…}}` | {{technischer Befund}} |

## A — Offene Punkte & {{Datenmapping}} (mit Beleg + Owner + Antwort)

> Status-Legende: ✅ geklärt · 🟡 teils/offen · 📄 wartet auf Input · ❌ out of scope

| # | {{Block}} | Quelle (verifiziertes Feld/Beleg) | Status | Offene Frage | Owner | Antwort + Datum |
|---|---|---|---|---|---|---|
| 1 | {{…}} | `{{tabelle.feld}}` / Datei | ✅ | — | — | **{{Antwort. JJJJ-MM-TT}}** |
| 2 | {{…}} | {{unklar — Kandidat …}} | 🟡 | {{präzise Frage}} | {{Name}} | {{offen}} |

## B — Entscheidungen (getroffen, mit Begründung + Datum)

> Spalte `ADR`: zeigt auf den vollen Entscheidungs-Record `docs/adr/NNNN-*.md` (Vorlage
> `_ADR.md`), wenn das *durable Warum* + die Supersession-Kette dokumentiert sind — sonst „—".

| ID | Entscheidung | Begründung | Datum | ADR |
|---|---|---|---|---|
| D1 | {{…}} | {{warum}} | {{JJJJ-MM-TT}} | {{ADR-NNNN / —}} |

<!-- Regeln:
     • Fakten IMMER mit Quelle/Beleg (Feldname, Datei, Datum) — keine ungeprüften Annahmen.
     • Eine offene Frage gehört in Tabelle A (Spalte „Offene Frage" + Owner), nie nur
       in den Fließtext einer Themen-Notiz.
     • Driftende Alt-Listen in Notizen oben mit Pointer „→ Stand siehe _INDEX.md" markieren. -->
