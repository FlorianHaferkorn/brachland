#!/usr/bin/env bash
# BRACHLAND — komplette Asset-Kette in einem Befehl
#
#   ./pipeline.sh raw/ final/ 4000
#
# raw/    generierte GLB (Tripo, Hunyuan3D, Meshy) — beliebig hochpoly
# final/  spielfertige, reduzierte, geriggte, animierte GLB
#
# Voraussetzungen: node + npm-Pakete (siehe README), Blender im PATH.

set -euo pipefail

IN="${1:-raw}"
OUT="${2:-final}"
TARGET="${3:-4000}"
RIGS="${RIGS:-rigs}"          # Ordner mit Archetyp-Rigs (quadruped.glb, bird.glb, ...)
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

command -v blender >/dev/null || { echo "Blender nicht im PATH."; exit 1; }
mkdir -p "$OUT"

shopt -s nullglob
files=("$IN"/*.glb)
[ ${#files[@]} -eq 0 ] && { echo "Keine .glb in $IN"; exit 0; }

ok=0; fail=0
for f in "${files[@]}"; do
  name="$(basename "${f%.glb}")"

  # Archetyp aus dem Dateinamen: steinbock__quadruped.glb -> rigs/quadruped.glb
  arch="${name##*__}"
  [ "$arch" = "$name" ] && arch="quadruped"
  rig="$RIGS/$arch.glb"
  if [ ! -f "$rig" ]; then
    echo "→ $name  ÜBERSPRUNGEN (Archetyp-Rig $rig fehlt)"; ((fail++)); continue
  fi

  echo "→ $name  [Archetyp: $arch]"

  # 1) Reduktion auf Spielgröße
  node reduce.mjs "$f" "$TMP/$name.lp.glb" "$TARGET" >/dev/null 2>&1 || {
    echo "   Reduktion fehlgeschlagen"; ((fail++)); continue; }

  # 2) Rigging + Animationen erben
  blender --background --python autorig.py -- \
          "$rig" "$TMP/$name.lp.glb" "$OUT/${name}.glb" 2>/dev/null \
          | grep '\[autorig\]' || true

  if [ ! -f "$OUT/${name}.glb" ]; then echo "   Rigging fehlgeschlagen"; ((fail++)); continue; fi

  # 3) Nachbereitung — MUSS nach dem Rigging laufen, nicht davor.
  #
  # Blender schreibt die Datei in Schritt 2 komplett neu: Die Quantisierung aus
  # Schritt 1 ist danach weg, die Textur wieder PNG, und die Animationen, die
  # Blender gerade erst angelegt hat, sind pro Bild gebacken. Ohne diesen Schritt
  # landeten die sechs Grathorn-Dateien bei 163-167 KB gegen 120 KB Budget
  # (Ledger A-6) — nicht weil zu schwach komprimiert wurde, sondern weil
  # komprimiert wurde, bevor es etwas zu komprimieren gab.
  node nachbereiten.mjs "$OUT/${name}.glb" || {
    echo "   Nachbereitung fehlgeschlagen"; ((fail++)); continue; }

  ((ok++))
done

echo
echo "Fertig: $ok erfolgreich, $fail fehlgeschlagen"
du -sh "$OUT" 2>/dev/null || true
