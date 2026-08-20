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

  # `quadruped_small` teilt sich das Rig mit `quadruped`.
  #
  # Nicht aus Bequemlichkeit: `autorig.py` skaliert das SKELETT an die Bounding
  # Box des Meshes, je Achse einzeln ("Nicht das Mesh ans Skelett anpassen,
  # sondern das Skelett ans Mesh"). Ein Murmeltier bekommt damit dasselbe
  # Skelett wie ein Steinbock, nur gestaucht — und das ist genau richtig, weil
  # beide vier Beine, eine Wirbelsäule und einen Schwanz haben.
  #
  # Der Unterschied zwischen den beiden Bauformen ist die reale Widerristhöhe
  # (`RIG_HOEHE` in src/world/kreaturgestalt.ts: 1,0 m gegen 0,4 m), also eine
  # Angabe fuers Spiel — keine Aussage ueber die Knochen.
  case "$arch" in
    quadruped_small) rigdatei="quadruped" ;;
    *)               rigdatei="$arch" ;;
  esac
  rig="$RIGS/$rigdatei.glb"
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

  # 3) Entkleiden — Textur raus, Farbe als Vertexattribut rein.
  #
  # Auch das MUSS nach dem Rigging laufen, und aus demselben Grund wie Schritt 4:
  # Blender schreibt die Datei neu. Ein COLOR_0, das davor entstuende, muesste
  # Import und Export unbeschadet ueberstehen — das haengt an Materialknoten und
  # Exporteinstellungen und ist genau die Art stiller Abhaengigkeit, die hier
  # schon zweimal Stunden gekostet hat. Nach dem Rigging sind Textur und UV noch
  # da, und danach braucht sie niemand mehr.
  #
  # Gemessen am Fuchs bei 4.464 Flaechen: 6.733 KB mit verlustfreier Textur,
  # 900 KB mit q90, **90 KB** ohne Textur. Nur das Letzte haelt die 120 KB aus
  # quality.ts — und es ist zugleich das Einzige, das dieselbe Sprache spricht
  # wie die 36 Props seit D74.
  node entkleiden.mjs "$OUT/${name}.glb" || {
    echo "   Entkleiden fehlgeschlagen"; ((fail++)); continue; }

  # 4) Nachbereitung — MUSS nach dem Rigging laufen, nicht davor.
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
