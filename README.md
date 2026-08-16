# game-dev — 3D-Spiel, solo, ausschließlich frei/OSS

Ein 3D-Spiel, gebaut von einer Person mit Claude als Code-Multiplikator. Harte
Randbedingung: **kostenlos oder Open Source** — keine Lizenzgebühren, keine Royalties,
keine Subscription.

**Engine:** Godot 4.7 (MIT) · Forward+ · Jolt · GDScript — Begründung: `docs/adr/0001-engine-godot-4.md`

> **Konzeptstand:** Der technische Rahmen steht (ADR-0001 bis ADR-0004). **Welches Spiel**
> gebaut wird, ist noch offen — siehe `docs/GDD.md` und das Ledger in `docs/_INDEX.md`.

## Schnellstart

```bash
brew install --cask godot     # falls noch nicht da
make import                   # Ressourcen-Cache bauen (nach frischem Clone Pflicht)
make run                      # Spiel starten
make editor                   # Godot-Editor öffnen
```

## Vor dem Commit

```bash
make check        # Drift-Gate (strict) + Godot-Smoke-Tests — MUSS grün sein
```

## Vor der Arbeitssession

```bash
make roi-check    # Läuft die OTel-Messung? Ungemessene Zeit ist dauerhaft verloren.
```

## Navigation

Dieses Repo wird über `_INDEX.md`-Dateien navigiert, nicht durch Volltext-Scan:

| Einstieg | Wofür |
|---|---|
| `CLAUDE.md` | Arbeitsregeln für Claude — Pflicht-Erstkontakt für Agenten |
| `docs/_INDEX.md` | L0-Navigation aller Dokumente **+ Ledger** (offene Punkte, Entscheidungen) |
| `docs/GDD.md` | Game Design Document — Konzept, aktuell offen |
| `docs/TECH_STACK.md` | Befehle, Konventionen, 3D-Qualitätshebel |
| `docs/ASSET_PIPELINE.md` | Blender→Godot-Workflow + Lizenz-Register |
| `docs/ROI.md` | Wie Aufwand und Wert gemessen werden — und was die Messung nicht kann |
| `game/_INDEX.md` | Godot-Projektstruktur |

## Struktur

```
game/          Godot-Projekt (project.godot liegt HIER, nicht im Repo-Root)
  scenes/      .tscn
  scripts/     .gd
  assets/      importierte .glb / Materialien / Audio
src-assets/    Blender-Quellen (.blend) — außerhalb des Godot-Scans
docs/          Doku + ADRs + Ledger
scripts/       Gate + ROI-Checks (zero-dependency Python)
tests/         Headless-Smoke-Tests
```
