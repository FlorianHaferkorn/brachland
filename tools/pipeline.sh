#!/usr/bin/env bash
# BRACHLAND — komplette Asset-Kette in einem Befehl
#
#   ./pipeline.sh raw/ final/ 2700
#
# raw/    generierte GLB (Tripo, Hunyuan3D, Meshy) — beliebig hochpoly
# final/  spielfertige, reduzierte, geriggte, animierte GLB
#
# Voraussetzungen: node + npm-Pakete (siehe README), Blender im PATH.
#
# VERFAHREN=voxel|dezimieren steuert Schritt 1. Vorgabe ist `voxel`, siehe dort.

set -euo pipefail

IN="${1:-raw}"
OUT="${2:-final}"
TARGET="${3:-2700}"
VERFAHREN="${VERFAHREN:-voxel}"
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

  # 1) Auf Spielgröße bringen — per Voxel-Remesh, nicht per Dezimierung.
  #
  # KI-Modelle sind keine geschlossenen Körper. Der Fuchs kam mit **583
  # getrennten Teilen und 30.216 offenen Kanten**; jede Fellsträhne ist eine
  # eigene Schale. Deren Mindestflächen summieren sich zu einer Untergrenze von
  # 3.194 Flächen, die `reduce.mjs` mit keiner Fehlertoleranz unterschreitet
  # (G-88) — bei Vorgabe 1.800 lieferte es 3.416.
  #
  # Der Voxel-Remesh dezimiert nicht, er baut die Oberfläche aus einem
  # Distanzfeld neu und trifft die Vorgabe. Am Fuchs, jeweils fertig geriggt
  # mit drei Animationen, gegen 190 KB Budget:
  #
  #   Voxel 1.772  106 KB   Schnauze wird ein stumpfer Keil
  #   Voxel 2.728  121 KB   Schnauze und Ohren lesbar, Netz ruhig   ← Vorgabe
  #   Voxel 3.608  135 KB   minimal feiner, dafür unruhiger Rücken
  #   dezimiert 3.301  189 KB   schärfste Ohrspitzen, aber Hals und Rücken
  #                             voller Splitter — der Rest der Fellschalen
  #
  # Die dezimierte Fassung wirkt im Standbild schärfer und ist es an den
  # Ohrspitzen auch. Überall sonst ist sie lauter, und sie kommt mit 189 gegen
  # 190 KB ohne jede Luft an (G-97).
  #
  # `VERFAHREN=dezimieren` schaltet auf den alten Weg zurück. Der ist nicht
  # tot: Er ist richtig für Quellen, die schon ein sauberer geschlossener
  # Körper sind — dort wirft der Voxel-Remesh nur Kanten weg, die es zu
  # erhalten gälte.
  case "$VERFAHREN" in
    voxel)
      blender --background --python voxelbau.py -- \
              "$f" "$TMP/$name.lp.glb" "$TARGET" 2>/dev/null \
              | grep '\[voxelbau\] \(Voxel\|Mittl\|FEHLER\)' || true
      [ -f "$TMP/$name.lp.glb" ] || {
        echo "   Remesh fehlgeschlagen"; ((fail++)); continue; }
      ;;
    dezimieren)
      node reduce.mjs "$f" "$TMP/$name.lp.glb" "$TARGET" >/dev/null 2>&1 || {
        echo "   Reduktion fehlgeschlagen"; ((fail++)); continue; }
      ;;
    *)
      echo "VERFAHREN muss 'voxel' oder 'dezimieren' sein, nicht '$VERFAHREN'."; exit 1 ;;
  esac

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
  # 900 KB mit q90, **90 KB** ohne Textur. Nur das Letzte haelt das Budget aus
  # quality.ts — und es ist zugleich das Einzige, das dieselbe Sprache spricht
  # wie die 36 Props seit D74.
  #
  # Im Voxel-Weg ist die Farbe schon uebertragen (dort **muss** sie das sein,
  # weil der Remesh die UV nicht behaelt). Dann laesst dieser Schritt sie in
  # Ruhe und wirft nur noch Normalen und Materialreste weg. Bis 20.08.2026 tat
  # er das nicht: Er fand keine Textur, nahm den Grundfarbfaktor und faerbte
  # den Fuchs glatt weiss (G-96).
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
