---
last-reviewed: 2026-08-16
shelf-life-days: 365
---
# ADR-0002 — Assets: CC0-Props sofort, Kreaturen über Stil-Referenz und Kette

**Status:** Accepted · 2026-08-16 · erweitert ADR-0001

## Kontext

Der Engpass dieses Projekts war nie der Code — es sind die Assets. Der Chat trennt
sauber zwischen zwei Problemen, von denen nur eines schwer ist:

- **Props** (Bäume, Felsen, Gras, Sträucher) sind generisch. Die muss niemand erfinden.
- **Kreaturen** sind das eigentliche Problem: Alpen-Fauna mit Biotech-Anbauten gibt es
  nirgends fertig, und geplant sind ~200 Stück.

## Entscheidung

**Props: CC0-Packs, erledigt.** 23 Modelle aus dem **Kenney Nature Kit 2.1 (CC0)** —
2.778 Dreiecke gesamt, 130 KB, +200 KB Precache für den kompletten Ersatz aller
Platzhalter-Primitive. Zwei Details sind Teil der Entscheidung, nicht Beiwerk:

- **4 Varianten je Art** (Totholz 3). Ein Baummodell 25.000-mal geklont fällt sofort
  als Muster auf; erst Varianten lassen einen Wald wie einen Wald wirken.
- **Automatische Maßstabskorrektur.** Kenney modelliert in Blockeinheiten (Baum = 2,
  Findling = 0,51). Die Szene misst jedes Modell beim Laden und normiert auf die reale
  Zielhöhe (Fichte 22 m, Busch 1,3 m, Grasbüschel 0,35 m). Damit passt jedes neue
  Modell automatisch in den 1:1-Maßstab — keine Handarbeit.

Weitere zulässige CC0-Quellen: Quaternius Nature MegaKit (~68 Modelle), OpenGameArt
CC0-Sammlung, Poly Haven (HDRIs/Texturen), ambientCG (PBR).

**Kreaturen: Stil-Referenz zuerst, dann Kette, dann Stapel.** Verbindliche Reihenfolge:

1. **Stil-Referenz festzurren.** Ein einziges gutes 2D-Referenzbild definiert den Look
   für alle 200 Kreaturen — Bild-zu-3D erbt ihn. Das ist der Hebel gegen die Stil-Drift,
   die 200 KI-Modelle sonst unweigerlich auseinanderlaufen lässt. Der bereits generierte
   Steinbock war nah dran; **der Prompt, mit dem er entstand, gehört festgehalten.**
2. **Eine Kreatur komplett durch die Kette:** generieren → `reduce.mjs` → `autorig.py`
   → Szene, inklusive Blender-Rigging. Damit ist die letzte ungetestete Stelle geprüft.
3. **Erst danach Stapelproduktion.**

**Generierungsweg:** Hunyuan3D über Google Colab (Gratis-GPU, kommerziell nutzbar,
keine Downloadlimits wie bei Tripo). Kosten null, dafür Einrichtungsaufwand und
schwankende Qualität.

**Offen gelassen:** Für die 5 Regenten plus 5–8 Startkreaturen ist ein Artist
(ArtStation/Fiverr, wenige hundert Euro je Stück) eine bewusste Option — Qualität und
Eigenständigkeit dort, wo es zählt, Rest KI-generiert. Das ist die einzige Stelle, an
der Geld ins Projekt fließen dürfte, und sie ist noch nicht entschieden (Ledger A-4).

**Verworfen:** Bezahlte Packs (Synty & Co.) — kohärent und gut, aber ohne Alpenfauna,
und das Spiel sähe aus wie jedes andere mit demselben Pack. Blender selbst lernen —
volle Kontrolle, aber Monate Lernkurve und faktisch ein zweites Hobby.

## Konsequenzen

**Leichter:** Die Landschaft ist heute schon fertig bestückt, ohne Kosten und ohne
Lizenzrisiko. Die Maßstabsnormierung macht jeden künftigen Modell-Import trivial.

**Schwerer:** Die Kreatur-Kette hat eine ungetestete Stelle (Rigging), und die
Stil-Referenz ist unwiderruflich in dem Sinn, dass ein Wechsel nach 50 generierten
Kreaturen deren Neuproduktion bedeutet. Deshalb steht sie **vor** der Stapelproduktion.

## Grenze (bekannte Limitation)

Deckt **nicht** ab: Animation über das Auto-Rigging hinaus (Kampfposen, Idle-Zyklen),
Texturen (aktuell Vertex-Farben) und Audio. Die Lizenzlage KI-generierter 3D-Modelle
ist 2026 uneinheitlich — Hunyuan3D ist laut Anbieter kommerziell nutzbar, vor einer
Veröffentlichung ist das erneut zu prüfen.
