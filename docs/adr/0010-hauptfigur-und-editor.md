---
last-reviewed: 2026-09-26
shelf-life-days: 365
---
# ADR-0010 — Hauptfigur aus den Universal Base Characters, Charakter-Editor vor dem Start

**Status:** Accepted · 2026-09-26 (D175) · ADR-0002 (CC0) und ADR-0004 (keine fremden Figuren) gelten

## Kontext

Flo (26.09.2026): Die Menschen sollen realistischer werden und besser aussehen, „so wie bei Soulframe";
die Hauptfigur soll vor Beginn anpassbar sein, männlich, weiblich oder neutral.

Die alten Figuren (Quaternius Modular, D143) haben ~2 900 Dreiecke, Vertexfarben und kein Gesicht.
Soulframe-Figuren sind handgebaute AAA-Modelle — frei (CC0) gibt es das nicht. Zur Wahl standen:

| | Für | Gegen |
|---|---|---|
| **Quaternius Universal Base Characters + Modular Outfits (gewählt)** | CC0; Gesichter mit Augen und Brauen, Texturen mit Normalen; zwei Körper, Frisuren, Kleidung modular; **dasselbe Skelett wie die UAL2** | Stilisiert, nicht fotorealistisch; ~13 k Dreiecke und ~1 MB je Gestalt; freie Fassung nur zwei Körper, zwei Outfits |
| MakeHuman | Realistische Proportionen, Regler für Körper und Gesicht | Schweres Netz, eigenes Rig, magere Kleidung/Haare, Stil passt schlechter zur Welt |

## Entscheidung

- **Gestalt = Körper × Kleidung** (`tools/heldbau.py`): Kopf und Hals vom Grundkörper, Kleidung aus den
  Outfits (sie trägt die Hautteile), alle Frisuren und der Bart als versteckte Netze am Kopfknochen.
  Vier Gestalten: `m|w` × `waldlaeufer|bauer`. Gepackt mit `tools/heldpack.ts` (WebP ≤ 1024).
- **Clips gemeinsam** in `held-clips.glb`: UAL2 direkt, die alten Clips (Idle, Gang, Rolle, Waffenhaltungen)
  per Weltformel. Vorher werden beide Skelette in der Welt gleich ausgerichtet (Schulterlinie und
  Hochachse, auf Vierteldrehungen eingerastet) — ohne das grätschte die Figur im Stand (D175 gefunden).
- **Geschlecht und Körper getrennt**: männlich/weiblich setzen den Körper vor, neutral lässt ihn frei;
  die Texte verzichten dann auf Pronomen (`pronomen()` in `spieler/held.ts`).
- **Editor** (`ui/HeldEditor.tsx`) vor dem ersten Schritt, wenn der Stand keine Figur hat; aus dem Menü
  („Figur") jederzeit. Die Wahl steht im Spielstand (`held`), ohne Versionssprung.
- Messadressen (`?absetzen`, `?kampf` …) nehmen die Vorgabefigur und zeigen keinen Editor; `?figur=alt`
  zeigt die alte Wanderin, `?held=editor` erzwingt den Editor.

## Konsequenzen

- Hauptfigur ~1 MB statt 240 KB; nicht im Precache, Laufzeit-Cache (`vite.config.ts`).
- Die Bewohner tragen noch die alten Figuren — Umstellung ist Budgetfrage (13 k Dreiecke × Dutzende).
- Hautton ist eine Tönung der mittleren Textur; sehr helle Töne werden flau. Die „Source"-Fassung hätte
  Shader für Haut und Augen (kostenpflichtig) — nicht nötig für Stufe 1.
- Reitsitz, Waffenlage (`WAFFE_AN_HELD_HAND`) und Sitzknochen laufen über die neuen Knochennamen.
