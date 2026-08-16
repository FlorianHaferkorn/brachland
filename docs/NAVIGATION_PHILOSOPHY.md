# Navigations-Philosophie — warum dieses Repo so aufgebaut ist

Für Menschen **und** Agenten. Wer das verinnerlicht hat, arbeitet im Repo
token-effizient und ohne Nacharbeit.

## Problem, das es löst

Ein wachsendes Repo wird für einen Agenten (begrenztes Kontextfenster) und für
Menschen (begrenzte Aufmerksamkeit) schnell unnavigierbar. Zwei Failure-Modes:
- **Volltext-Scan**: der Agent liest halbe Ordner, um „den Überblick" zu kriegen →
  Token-Verschwendung, Fokusverlust, teure Halluzinationen über veralteten Stand.
- **Status-Drift**: offene Fragen/Entscheidungen liegen verstreut in Notizen →
  derselbe Punkt wird zweimal geklärt, Entschiedenes erneut gefragt.

## Drei Prinzipien

### 1. Navigieren statt scannen — `_INDEX.md` als L0
Jeder navigierbare Bereich hat **genau ein** `_INDEX.md`. Es ist der **einzige
Pflicht-Erstkontakt** und enthält eine **„lies-wenn"-Tabelle**: *„Deine Aufgabe ist
X → lies Doc A → Doc B; NICHT nötig: Rest."* Der Agent liest **L0 + ein Detail**,
nicht den Ordner. Regel: *ein L0 → ein-Detail-Pfad genügt für die meisten Aufgaben*.

### 2. Schichten + Ableitungsrichtung
Wo ein Bereich geschichtet ist (Strategie, Architektur, Roadmap), gilt L0→L4:
```
L0 Navigation → L1 Zielbild/Modell → L2 Detail → L3 Delivery → L4 Roadmap (DoD)
```
**Ableitung immer abwärts**: L4 leitet aus L1–L3 ab, nie umgekehrt. Das verhindert,
dass der Plan das Zielbild diktiert.

### 3. Ledger als Single Source of Truth
Pro Entität (Kunde/Projekt/Modul) ein `_INDEX.md`-Ledger:
- **Tabelle A** = offene Punkte / Datenmapping, je Zeile mit *Status · Quelle/Beleg ·
  Offene Frage · Owner · Antwort+Datum*.
- **Tabelle B** = getroffene Entscheidungen mit Begründung + Datum.
- **Regel: im selben Arbeitsschritt abhaken.** Wer einen Punkt klärt, trägt die
  Antwort sofort in A ein; wer entscheidet, in B. Themen-Notizen sind nur **Belege** —
  ihr offen/erledigt-Stand lebt ausschließlich im Ledger.
- **Fakten mit Beleg** (Feldname, Datei, Datum), nie ungeprüfte Annahmen.
- **Abgrenzung zu Auto-Memory:** Claude Codes eigenes Auto-Memory (`~/.claude/projects/.../memory/`)
  ist maschinenlokal und nicht git-tracked — es ergänzt den Ledger (Pointer, persönliche
  Arbeitspräferenzen), ersetzt ihn aber nicht. Bei Widerspruch gewinnt der Ledger.

Ergebnis: kein Re-Derive, keine Doppelfragen, kein veralteter Status.

## Das Drift-Gate (warum es hart ist)

„A stale wiki is worse than no wiki." `check_index.py` erzwingt deshalb maschinell:
1. **Vollständigkeit (hart)** — jede Datei im Bereich ist im `_INDEX.md` gelistet.
   Der Index darf nicht hinter dem Ordner herhinken.
2. **Pfad/Anker (hart)** — jeder konkrete Pfad/Anker im Index zeigt auf ein echtes Ziel.
3. **Staleness (advisory)** — `last-reviewed` + `shelf-life-days` im Frontmatter;
   überfällige Indizes werden gewarnt (nicht geblockt).

Ins `make check` / pre-commit / CI einhängen — dann kann der Index nicht still verrotten.

## Wie ein Agent das Repo betritt (Lese-Reihenfolge)

1. `GOI_DOKTRIN.md` (wie wird gearbeitet) → `CLAUDE.md` (Projekt-Regeln + Routing).
2. Aufgabentyp bestimmen → passenden Bereich `_INDEX.md` öffnen → „lies-wenn"-Zeile
   folgen → genau die 1–2 verlinkten Detail-Docs lesen.
3. Bei Entitäts-Arbeit: zuerst das Entitäts-Ledger lesen (was ist schon entschieden?).
4. Beim Abschluss: Ledger im selben Schritt nachziehen, Index-Gate grün halten.

Mehr Disziplin, weniger Tokens, kein Status-Chaos — das ist der ganze Trick.

## Wirkungsnachweis (ehrlich: nicht sauber gemessen)

Der Fable-5-Review (2026-07-04, `CUT_PLAN_v3.2.md`) hat explizit offengelassen, ob sich der
Gesamt-Prozessumfang (~2.400 LOC Mechanik für einen Solo-Betrieb über ~7 Repos) amortisiert —
weder Prior Art noch eine eigene Messung belegen das. Eine saubere Vorher/Nachher-Messung
(Sessions-Stichprobe über 2 Wochen, mit/ohne Index-Routing, gelesene Dateien/Tokens pro Task)
ist **nicht** durchgeführt worden — das würde echte, über Zeit verteilte Arbeitssessions in
mehreren Repos brauchen, keine einzelne Sitzung.

**Gegenevidenz, die man kennen muss (Stand 09.08.2026).** Zwei unabhaengige Ablations-Studien
pruefen genau den Mechanismus dieser Seite — und finden nichts. **McMillan** (arXiv 2605.10039)
variiert faktoriell Dateigroesse, Position der Instruktion, **flach gegen hierarchisch-verweisend**
und Widersprueche, ueber 1.650 Claude-Code-Sessions und 16.050 Beobachtungen: Nullbefund auf allen
vier Faktoren. **Khatri** (arXiv 2607.27250) vergleicht in 288 Laeufen keine Datei / Volltext-Injektion
/ **selektiven On-Demand-Abruf themenorganisierter Dateien, also Routing** — kein messbarer
Unterschied. Dazu die ETH-Zuerich-Studie (arXiv 2602.11988): entwicklergeschriebene Kontextdateien
+4 % Erfolg, LLM-generierte -3 %, beide ~+20 % Kosten — wobei diese Kosten **nicht** das Gewicht der
Datei sind, sondern das Verhalten, das sie ausloest (2-4 zusaetzliche Schritte, weil die Agenten den
Instruktionen folgen und breiter explorieren).

**Was das heisst, ohne Beschoenigung:** Die These „ein L0 plus ein Detail statt halber Ordner" hat
zwei direkte Nullbefunde gegen sich und keinen Beleg fuer sich.

**Was es nicht heisst:** dass sie widerlegt ist. Alle drei Studien messen **Einzelsitzungen** mit
kleinen Stichproben (17 bzw. 5 Aufgaben, Aequivalenzgrenzen ~10-15 Prozentpunkte). Die Wirkung, auf
die diese Seite zielt — kein Re-Derive, keine Doppelfragen ueber Sitzungen hinweg — kann dort
konstruktionsbedingt gar nicht auftreten. **MemoryArena** (arXiv 2602.16313) zeigt zudem, dass
Entscheidungskontinuitaet eine andere Faehigkeit ist als Faktenerinnerung und von keinem gaengigen
Benchmark gemessen wird.

**Was robust bleibt und deshalb kuenftig die Begruendung traegt:** (a) *wie* eine Datei entsteht
schlaegt jede Strukturfrage, (b) Laenge und Redundanz sind der einzige breit gestuetzte
Negativhebel, (c) der Ledger haelt Information, die nirgends sonst existiert — ein Existenz-, kein
Effizienzargument. **Token-Ersparnis ist ab hier keine Begruendung mehr**, solange sie nicht
gemessen ist. Belege und Einordnung: `RESEARCH_2026-08-graphs.md` (G5, G6), Entscheidung: D14.

**Seit v3.7 gibt es wenigstens das Messwerkzeug** (im Kit-Repo: `bin/measure_navigation.py`).
Es liest Claude Codes maschinenlokale Session-Transcripts und gibt pro Session aus: wie viele
DISTINKTE Dateien per Read-Tool gelesen wurden, ob zuerst ein `_INDEX.md`/`CLAUDE.md` geöffnet
wurde (Routing genutzt) oder direkt eine Inhaltsdatei (gescannt), plus die Token-Summen. Damit ist
die These prüfbar geworden — geprüft ist sie damit **nicht**.

Wer sie prüfen will, braucht eine Vergleichsgruppe, die sich nur im Routing unterscheidet:
dasselbe Repo vor und nach dem Kit-Einbau (`--since <adoptionsdatum>`), oder zwei vergleichbare
Repos mit und ohne `_INDEX.md`. Und drei Grenzen gehören bei jeder Zitierung dazu: es sind
Beobachtungsdaten (verschiedene Sessions lösen verschiedene Aufgaben), gezählt wird nur das
Read-Tool (wer per `grep`/`cat` in Bash liest, taucht nicht auf), und Transcripts sind
maschinenlokal — wer messen will, misst ab jetzt.

Ein anekdotischer, nicht belastbarer Datenpunkt aus der Praxis: beim Aufbau von
`powerbi-theme/tools/_INDEX.md` (14 Python-Module) genügte das „lies-wenn"-Routing, um bei
Folgeaufgaben gezielt 1-2 Dateien zu lesen statt den ganzen `tools/`-Ordner zu scannen — aber
ein einzelnes Beispiel ist kein Beweis, nur eine Beobachtung. **Die Annahme bleibt Annahme**,
bis eine echte Messung existiert oder das Kit aufgrund gegenteiliger Erfahrung verschlankt wird.
