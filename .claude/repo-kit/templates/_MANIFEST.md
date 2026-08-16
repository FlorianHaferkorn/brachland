---
last-reviewed: {{YYYY-MM-DD}}
shelf-life-days: 90
---
# {{REPO_NAME}} — Manifest (zuerst lesen)

> Deklarierter „read-first"-Einstieg: **Zweck + Datenfluss + Invarianten** des Repos.
> `CLAUDE.md` routet das *Arbeiten*; dieses Manifest erklärt, *was* das Repo ist und
> wie Daten durchfließen. Nur anlegen, wenn es eine Pipeline/Architektur zu erklären gibt.

## Zweck
{{1–2 Sätze: was tut dieses Repo, für wen.}}

## Datenfluss
```
{{Quelle}}  →  {{normalize}}  →  {{verarbeiten}}  →  {{Output}}
```

## Struktur
```
{{ordner/}}   {{Rolle}}
{{ordner/}}   {{Rolle}}
```

## Invarianten / Konventionen
- {{Eine benannte Architektur-Invariante, z. B. „nur EINE Stelle kennt die Quellformate;
  alles Downstream sieht die normalisierte Form" (so weit wie möglich upstream transformieren).}}
- {{Konfig oben in der Datei statt hartkodiert · Snapshots/Baselines append-only · …}}
