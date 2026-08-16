# BRACHLAND — Asset-Kette: von der KI-Generierung zur spielfertigen Kreatur

Ziel: automatisch, kostenlos, beste erreichbare Qualität.
Alle Werkzeuge sind Open Source. Laufende Kosten: 0 €.

---

## Der Ablauf

```
Referenzbild  →  KI-3D  →  reduce.mjs  →  autorig.py  →  spielfertiges GLB
 (2D, frei)     (frei)     (frei)         (Blender)      3–8k Tris, animiert
```

Ein Befehl für den ganzen Ordner:

```bash
./pipeline.sh raw/ final/ 4000
```

---

## Einmalige Einrichtung

```bash
# 1) Node-Werkzeuge für die Reduktion
npm install @gltf-transform/core @gltf-transform/extensions \
            @gltf-transform/functions meshoptimizer sharp

# 2) Blender (kostenlos) — muss im PATH liegen
#    macOS: brew install --cask blender
#    danach ggf.:
#    ln -s /Applications/Blender.app/Contents/MacOS/Blender /usr/local/bin/blender
```

### Archetyp-Rigs anlegen (der wichtigste Schritt)

Lege einen Ordner `rigs/` mit **einem Rig je Körperbauplan** an — jedes mit
seinem eigenen Animationssatz (Idle, Walk, Run, Angriff, Treffer, K.o.):

| Datei | Deckt ab |
|---|---|
| `quadruped.glb` | Steinbock, Gams, Hirsch, Fuchs, Luchs, Dachs, Wildschwein |
| `quadruped_small.glb` | Murmeltier, Marder, Siebenschläfer |
| `bird.glb` | Steinadler, Uhu, Kolkrabe, Auerhahn |
| `reptile.glb` | Kreuzotter, Salamander, Molch |
| `fish.glb` | Huchen, Wels, Renke |
| `insect.glb` | Hirschkäfer, Alpenbock |

**Das ist die Rechnung, die 200 Kreaturen trägt:** Animationen werden ~10× erstellt,
nicht 200×. Jede neue Kreatur erbt den kompletten Satz ihres Archetyps.

Quellen für fertige animierte Archetyp-Rigs (CC0): Quaternius (Ultimate Animated
Animal Pack — 12 Tiere mit je 12+ Animationen), Khronos glTF-Sample-Assets,
OpenGameArt.

---

## Nutzung

Dateibenennung steuert die Archetyp-Zuordnung:

```
raw/steinbock__quadruped.glb     → rigs/quadruped.glb
raw/sporenhahn__bird.glb         → rigs/bird.glb
raw/myzelmolch.glb               → rigs/quadruped.glb   (Standard)
```

Einzelne Schritte lassen sich auch separat fahren:

```bash
node reduce.mjs roh.glb klein.glb 4000
blender -b -P autorig.py -- rigs/quadruped.glb klein.glb fertig.glb
```

---

## Warum das Skelett ans Mesh angepasst wird, nicht umgekehrt

Der naive Weg — Mesh in die Skelett-Proportionen zwängen — zerstört die Kreatur:
ein Steinbock, der auf Fuchs-Maße gestreckt wird, verliert Hörner und Beinform.

`autorig.py` skaliert stattdessen das **Skelett** auf die Bounding-Box des Meshes.
Die Animationen liegen auf Knochenrotationen und überleben das unbeschädigt, die
Proportionen der Kreatur bleiben erhalten.

Mit `--uniform` wird gleichmäßig statt pro Achse skaliert — sinnvoll, wenn
Kreatur und Archetyp ähnlich gebaut sind (Gams auf Steinbock-Rig).

---

## Qualitätskontrolle

`autorig.py` meldet den Anteil **ungebundener Vertices**. Über 5 % heißt: Das Mesh
ist nicht wasserdicht — typisch für KI-Generierung mit dünnen, freistehenden Teilen
(Fächer, Geweihe, Flügel).

Abhilfen, in dieser Reihenfolge:
1. Voxel-Remesh in Blender vor dem Rigging (schließt Löcher, kostet Detail)
2. Anderen Archetyp wählen (Bauplan passt nicht)
3. Reduktionsziel erhöhen (dünne Teile überleben mehr Tris)

---

## Empfohlene Zielwerte

| Kreaturtyp | Tris |
|---|---|
| Regenten, Story-Bosse | 8.000 |
| Standard-Kreaturen | 4.000 |
| Kompakte Formen (Steinbock) | 3.000 |
| Filigrane Formen (Fächer, Geweihe) | 6.000 — darunter zerfallen sie |
| Ferne Nebenkreaturen | 1.500 |

Gemessen: ~40–80 KB je Kreatur → **~16 MB für 200 Kreaturen**. Unkritisch für den
Service-Worker-Cache der Offline-PWA.

---

## Fallstricke aus der Praxis

- **Referenzbild freistellen.** Ein Screenshot mit UI erzeugt ein Mesh, das die
  Bedienleiste mitmodelliert. Nur die Kreatur, neutraler Hintergrund, gleichmäßiges Licht.
- **Stil-Drift.** Jede Generierung würfelt neu. Festen Prompt-Baustein für Palette,
  Detailgrad und Materialsprache verwenden und ein gelungenes Modell als Stil-Referenz
  für alle weiteren einsetzen.
- **Reduktionsgrenze.** `simplify` bricht bei `error: 0.005` ab, bevor die Form zu stark
  abweicht — bei filigranen Modellen wird das Ziel nicht immer erreicht. Das ist ein
  Schutz, kein Fehler.
- **Lizenz.** Hunyuan3D erlaubt kommerzielle Nutzung der erzeugten Assets.
  Tripo im Gratisplan nur CC BY 4.0 ohne kommerzielle Rechte.

---

## Status

`reduce.mjs` ist an echten Modellen verifiziert (81k und 428k Flächen, mit und ohne Rig).
`autorig.py` ist **noch nicht ausgeführt** — Blender ließ sich in der Entwicklungsumgebung
nicht als Python-Modul installieren. Erster Lauf steht aus; die ungebundenen Vertices sind
dabei der Wert, auf den es ankommt.
