#!/usr/bin/env python3
"""Ledger-ID-Gate: jede ID in `docs/_INDEX.md` (Tabelle A und B) gibt es genau einmal.

Anlass: Claude und Codex haben am 11.11.2026 auf getrennten Branches dieselben Nummern
D249 und D250 für verschiedene Entscheidungen vergeben. Das Drift-Gate (`check_index.py`,
Kit-Mechanik, nicht lokal umbauen) prüft Pfade und Register, keine Dubletten — der
Zusammenstoss fiel nur beim Lesen auf. Dieses Gate macht ihn hart: Eine doppelte ID
lässt `make check` und CI rot werden, auch nach einem Merge, der textlich sauber war.

Exit 0 = keine Dubletten, 1 = Befund. Nur stdlib.
"""
from __future__ import annotations

import re
import sys
from collections import defaultdict
from pathlib import Path

LEDGER = Path(__file__).resolve().parent.parent / "docs" / "_INDEX.md"
# Erste Spalte einer Tabellenzeile: D248, G-143, A-15, H-255a …
ZEILEN_ID = re.compile(r"^\| ((?:[A-Z]-\d+[a-z]?)|(?:D\d+)) \|")


def finde_dubletten(text: str) -> dict[str, list[int]]:
    """ID → Zeilennummern, nur für IDs, die mehr als einmal vorkommen."""
    fundorte: dict[str, list[int]] = defaultdict(list)
    for nr, zeile in enumerate(text.splitlines(), start=1):
        treffer = ZEILEN_ID.match(zeile)
        if treffer:
            fundorte[treffer.group(1)].append(nr)
    return {k: v for k, v in fundorte.items() if len(v) > 1}


def naechste_d(text: str) -> int:
    nummern = [int(m.group(1)) for m in re.finditer(r"^\| D(\d+) \|", text, re.M)]
    return max(nummern, default=0) + 1


def main() -> int:
    text = LEDGER.read_text(encoding="utf-8")
    dubletten = finde_dubletten(text)
    if dubletten:
        for kennung, zeilen in sorted(dubletten.items()):
            print(f"FEHLER [Ledger-ID] {kennung} steht {len(zeilen)}× in docs/_INDEX.md (Zeilen {', '.join(map(str, zeilen))})")
        print("→ Die später gemergte Seite nummeriert um (nächste freie D-Nummer auf main) "
              "und zieht Verweise in Ledger und Code nach.")
        return 1
    print(f"[check-ledger-ids] keine doppelten IDs · nächste freie D-Nummer: D{naechste_d(text)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
