# BRACHLAND — Asset-Workflow & Kostenmessung v1

Ergebnis des Kreatur-Spikes. Ergänzt Story-Bibel v1, Kampfsystem v1, Roster-Struktur v1.

---

## 1. Kernbefund

**Die Biotech-Anbauten brauchen kein Blender pro Kreatur — sie sind skriptbar.**

Nachgewiesen an einem echten animierten Quadruped-Rig (Khronos-Fox, glTF-Standard, 24 Knochen, 1.728 Vertices, 3 Animationen: Survey/Walk/Run). Der Anbau wird als **Kind-Node eines Knochens** eingehängt — dadurch folgt er automatisch jeder vorhandenen Animation, ohne dass neu geriggt, geskinnt oder gewichtet werden muss.

Damit ändert sich die Kostenschätzung grundlegend:

| | vorher angenommen | gemessen |
|---|---|---|
| Aufwand je Kreatur | Blender-Handarbeit, Rig-Kenntnis nötig | Datenzeile + Skript |
| Aufwand je Entwicklungsstufe | eigenes Modell | Parameter (Knochen + Skalierung) |
| Animationen | pro Kreatur neu | vom Basis-Rig geerbt |

## 2. Nachgewiesener Ablauf

Drei Mutationsstufen wurden aus **einem einzigen Rig** erzeugt — Rig unverändert (24 Knochen), Animationen vollständig erhalten (3/3):

| Stufe | Anbauten | Dateigröße | Anker |
|---|---|---|---|
| S1 Angepasst | 1 | 162,6 KB | Kopf |
| S2 Durchdrungen | 2 | 163,1 KB | Kopf, Brustwirbel |
| S3 Vollzogen | 4 | 164,5 KB | Kopf, Brustwirbel, Hüfte, Schwanz |

Der Größenzuwachs liegt bei ~1 KB pro Stufe. Bei ~200 Kreaturen bleibt der Anbau-Anteil im niedrigen einstelligen MB-Bereich — **unkritisch für die Offline-PWA**, wo das Gesamtpaket ins Cache-Budget passen muss.

Skripte: `stages.py` (Stufengenerator), `combat.py` (Kampfsimulation) im Spike-Ordner.

## 3. Daraus folgt: Kreaturen sind Datensätze

Eine Kreatur wird zur Konfiguration, nicht zum Modell:

```jsonc
{
  "id": "grathorn",
  "basisRig": "steinbock",           // 1 von ~40 Rigs
  "element": ["Stein"],
  "ursprung": "wildling",
  "spawn": { "osm": "natural=cliff", "minHoehe": 900 },
  "stufen": [
    { "name": "Grathorn",    "anbau": [{ "knochen": "Head", "teil": "chitinplatte", "skala": 1.0 }] },
    { "name": "Grathaupt",   "anbau": [{ "knochen": "Head", "skala": 2.0 },
                                       { "knochen": "Spine02", "teil": "plattenkamm", "skala": 1.2 }] },
    { "name": "Kalkvollzug", "anbau": [ /* 4 Anbauten */ ] }
  ],
  "werte": { "kp": 130, "ang": 58, "ver": 62, "ini": 44 }
}
```

**Anbau-Bibliothek statt Kreaturen-Bibliothek:** ~15–20 Anbauteile (Chitinplatte, Plattenkamm, Sporenfächer, Filterkiemen, Leuchtmyzel-Strang, Linsenauge, Sensorborsten, Wurzelgeflecht, Silikatsporn, Metallwucherung …) decken kombinatorisch den gesamten Roster ab. Die Anzahl der zu modellierenden Objekte sinkt damit von 200 auf **~40 Rigs + ~20 Anbauteile**.

## 4. Rig-Beschaffung

Benötigt: ~40 Basis-Rigs für den Gesamtroster, ~8–10 für Kapitel 1.

Substitutionsplan (freie Modelle → bayerische Fauna):
- Quadruped Huftier → Rothirsch, Reh, Gams, Steinbock (ein Rig, verschiedene Proportionen/Anbauten)
- Quadruped Raubtier (Fuchs/Wolf) → Fuchs, Luchs, Dachs, Marder
- Nager → Murmeltier, Biber, Siebenschläfer
- Vogel groß → Steinadler, Uhu, Bartgeier, Kolkrabe
- Vogel Boden → Auerhahn, Birkhuhn, Kranich
- Amphibie/Reptil → Feuersalamander, Bergmolch, Kreuzotter
- Fisch → Huchen, Wels, Renke

⚠️ Realistisch decken ~10–12 generische Rigs die ~45 Basisarten ab, wenn Proportionen skaliert und Anbauten variiert werden. Die Silhouetten-Unterschiede zwischen Reh und Gams sind bei Low-Poly klein — Wiedererkennbarkeit entsteht über Anbau, Farbe und Größe, nicht über die Grundform.

Quellen (Lizenz je Pack prüfen): Quaternius (CC0, Ultimate Animated Animal Pack — 12 Tiere mit je 12+ Animationen), Khronos glTF-Sample-Assets, OpenGameArt CC0-Sammlung, ithappy „Animals FREE" (7 Tiere, saubere Rigs), Poly Pizza (Aggregator, lizenzgefiltert), itch.io Low-Poly/PSX-Tierpacks.

## 5. Was Blender trotzdem braucht

Ehrlich abgegrenzt — skriptbar ist der *Anbau*, nicht alles:

1. **Die ~20 Anbauteile modellieren.** Einmalig, Low-Poly, je 15–45 Min. Das ist das eigentliche Handarbeits-Budget: rund 1–2 Wochenenden für die komplette Bibliothek.
2. **Rig-Normalisierung.** Fremde Packs haben unterschiedliche Knochennamen (`b_Head_05` vs. `Head` vs. `mixamorig:Head`). Einmal pro Pack eine Mapping-Tabelle anlegen, dann greift das Skript einheitlich.
3. **Proportions-Varianten** (Reh vs. Gams aus einem Rig): Skalierung reicht meist, Feinschliff gelegentlich manuell.
4. **Texturen/Material.** Anbauten brauchen ein Material (Chitin, Myzel-Emissive für die Biolumineszenz). Wenige Shared Materials genügen.

## 6. Bewertung

Der Roster von ~200 Kreaturen ist damit **nicht mehr der Flaschenhals**. Das teuerste Content-Element ist jetzt wieder das, was es immer war: **Weltdesign und Story-Authoring pro Region** — Maps, NPCs, Fundstücke, Balancing.

Nächste offene Punkte, nach Wichtigkeit:
1. **8×8-Elementmatrix** entwerfen und simulativ prüfen (5er-Version aus Kampfsystem v1 ist hinfällig).
2. **Team-Simulation** 3–6 Kreaturen gegen Regenten — Zehrung final tunen.
3. **Visuelle Kontrolle**: Die generierten Stufen einmal in three.js rendern und in Bewegung ansehen — die Zahlen belegen die Mechanik, nicht die Optik.
4. Danach: Repo aufsetzen, M0 bauen.
