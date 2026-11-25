#!/bin/bash
# BRACHLAND — Ortkette (D469): eine Zielbild-Szene (.blend) in einem Lauf ins Spiel bringen.
#
#   tools/ortkette.sh <zielbild.blend> <name> <terrain.json> [schritte]
#   Beispiel: tools/ortkette.sh .cache/blender/felsmulde/szene4.blend felsmulde .cache/blender/felsmulde/terrain.json
#   schritte (Vorgabe: alle): pruefen,bauten,boden,pflanzen,schatten — z. B. "pflanzen,schatten" für einen Teil.
#
# Ergebnis: public/bauten-ziel/<name>-{bauten,wasser,boden,pflanzen,schatten}.glb und register.json.
# Anleitung, Prüfpunkte und Fallen: docs/WELT_METHODE.md. Jeder Blender-Lauf hält die Sperre .cache/blender.sperre
# (8 GB Arbeitsspeicher: nie zwei Blender gleichzeitig). Protokolle: .cache/ortkette/<name>/*.log
set -u
BLEND="${1:?zielbild.blend fehlt}"; NAME="${2:?name fehlt}"; TERRAIN="${3:?terrain.json fehlt}"; SCHRITTE="${4:-pruefen,bauten,boden,pflanzen,schatten}"
cd "$(dirname "$0")/.." || exit 1
ZIEL=public/bauten-ziel; LOG=.cache/ortkette/$NAME; SPERRE="$PWD/.cache/blender.sperre"; mkdir -p "$ZIEL" "$LOG"
[ -f "$BLEND" ] || { echo "FEHLER: $BLEND gibt es nicht"; exit 1; }
[ -f "$TERRAIN" ] || { echo "FEHLER: $TERRAIN gibt es nicht"; exit 1; }
will() { case ",$SCHRITTE," in *",$1,"*) return 0;; *) return 1;; esac; }
blender_lauf() {   # blender_lauf <protokoll> <argumente…>
  local log="$1"; shift
  until mkdir "$SPERRE" 2>/dev/null; do sleep 0.5; done
  PYTHONUNBUFFERED=1 blender --background "$BLEND" --python-use-system-env "$@" > "$log" 2>&1; local rc=$?
  rmdir "$SPERRE" 2>/dev/null; sleep 5
  if grep -aq "Traceback" "$log"; then echo "FEHLER in $log:"; grep -a -A6 "Traceback" "$log" | head -12; return 1; fi
  [ $rc -eq 0 ] || { echo "FEHLER: Blender endete mit $rc (137 = Speicher) — siehe $log"; return 1; }
}
register_merke() {   # Register-Einträge, die szenenexport beim Neuschreiben verliert, wieder anhängen
  python3 - "$ZIEL/register.json" "$NAME" "$@" <<'PY'
import json, sys
p, name, teile = sys.argv[1], sys.argv[2], sys.argv[3:]
r = json.load(open(p))
for b in r['bauwerke']:
    if b['name'] == name:
        for t in teile:
            if t not in b['dateien']: b['dateien'].append(t)
        print('REGISTER', name, b['dateien'], 'boden' in b and 'boden ok' or 'boden FEHLT')
json.dump(r, open(p, 'w'), indent=1, ensure_ascii=False)
PY
}

if will pruefen; then
  echo "== 1/5 prüfen: Bildpfade der Szene (fehlende Bilder backen magenta)"
  cat > "$LOG/pruefen.py" <<'PY'
import bpy, os
fehlt = [im.name for im in bpy.data.images if im.source == 'FILE' and not im.packed_file and not os.path.exists(bpy.path.abspath(im.filepath))]
print('BILDER', len(bpy.data.images), 'fehlen', len(fehlt), fehlt[:8])
print('OBJEKTE', len(bpy.data.objects), 'terrain' in bpy.data.objects and 'terrain ok' or 'terrain FEHLT')
PY
  blender_lauf "$LOG/pruefen.log" --python "$LOG/pruefen.py" || exit 1
  grep -a "^BILDER\|^OBJEKTE" "$LOG/pruefen.log"
  grep -aq "fehlen 0 " "$LOG/pruefen.log" || { echo "FEHLER: Bilder fehlen — Pfade in der .blend reparieren (docs/WELT_METHODE.md, Falle 1)"; exit 1; }
  grep -aq "terrain ok" "$LOG/pruefen.log" || { echo "FEHLER: kein Objekt 'terrain' in der Szene"; exit 1; }
fi

BODEN_ALT=""; [ -f "$ZIEL/register.json" ] && BODEN_ALT=$(python3 -c "
import json,sys
for b in json.load(open('$ZIEL/register.json'))['bauwerke']:
    if b['name']=='$NAME' and 'boden' in b: print(json.dumps(b['boden']))")

if will bauten; then
  echo "== 2/5 bauten: Mauern, Felsen, Steine, Streu backen (25–35 min)"
  SZENE_ZIEL=1 SZENE_TERRAIN="$TERRAIN" blender_lauf "$LOG/bauten.log" --python tools/szenenexport.py -- "$ZIEL" "$NAME" 1024 || exit 1
  grep -a "^niedrig\|^verschoben" "$LOG/bauten.log" | wc -l | xargs echo "  Körper mit Relief:"
  npx tsx tools/bautenpack.ts --kante 2048 "$ZIEL/$NAME-bauten.glb" "$ZIEL/$NAME-wasser.glb" 2>&1 | grep MiB
  # szenenexport schreibt den Registereintrag neu: Boden-Angabe und Zusatzdateien zurückholen
  if [ -n "$BODEN_ALT" ]; then python3 - "$ZIEL/register.json" "$NAME" "$BODEN_ALT" <<'PY'
import json, sys
p, name, boden = sys.argv[1], sys.argv[2], json.loads(sys.argv[3]); r = json.load(open(p))
for b in r['bauwerke']:
    if b['name'] == name: b['boden'] = boden
json.dump(r, open(p, 'w'), indent=1, ensure_ascii=False)
PY
  fi
  for t in boden pflanzen schatten; do [ -f "$ZIEL/$NAME-$t.glb" ] && register_merke "$t" >/dev/null; done
fi
if will boden; then
  echo "== 3/5 boden: Scan-Boden backen (10–12 min)"
  blender_lauf "$LOG/boden.log" --python tools/bodenexport.py -- "$ZIEL" "$NAME" 30 4096 || exit 1
  npx tsx tools/bautenpack.ts --kante 2048 "$ZIEL/$NAME-boden.glb" 2>&1 | grep MiB; rm -rf "$ZIEL/.zielboden"
fi
if will pflanzen; then
  echo "== 4/5 pflanzen: Gras, Kraut, Efeu, Laub als Instanzen (3–5 min)"
  blender_lauf "$LOG/pflanzen.log" --python tools/pflanzenexport.py -- "$ZIEL" "$NAME" || exit 1
  grep -a "^PFLANZEN\|^AUSGERECHNET" "$LOG/pflanzen.log" | cut -c1-110
  npx tsx tools/bautenpack.ts --kante 1024 --instanz "$ZIEL/$NAME-pflanzen.glb" 2>&1 | grep MiB
fi
if will schatten; then
  echo "== 5/5 schatten: grobe Schattenhülle"
  node tools/schattenhuelle.mjs "$ZIEL/$NAME-bauten.glb" "$ZIEL/$NAME-schatten.glb" 0.1 0.01 2>&1 | tail -1
  register_merke schatten
fi
register_merke
ls -la "$ZIEL"/"$NAME"-*.glb | awk '{printf "  %6.1f MB  %s\n", $5/1048576, $NF}'
echo "FERTIG. Weiter mit Messbild und Bildrate: docs/WELT_METHODE.md, Schritt 4."
