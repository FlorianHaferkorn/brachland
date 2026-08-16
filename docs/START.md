# BRACHLAND — starten

Ziel dieses Schritts: **selbst hinschauen.** Alle bisherigen Bilder stammen aus einem
selbstgebauten Software-Renderer und sind ein schlechter Stellvertreter für das, was
three.js auf echter Hardware zeigt.

## Einmalig

```bash
npm install --legacy-peer-deps
```

(`--legacy-peer-deps`, weil `@vitejs/plugin-react` v6 Vite 8 verlangt, wir aber
bei Vite 5 bleiben.)

## Starten

```bash
npm run dev
```

Vite läuft mit `host: true`, gibt also eine Netzwerk-Adresse aus. **Diese Adresse auf
dem Handy im selben WLAN öffnen** — das ist der eigentliche Test, nicht der Laptop.

Die Weltdaten für das Œntal liegen bereits unter `public/world/oental.json` (1,1 MB).
Neu erzeugen ginge mit `npm run world oental 96`, dauert wegen der Höhendaten-API
etwa 2 Minuten.

## Was funktioniert

- Terrain aus OSM + EU-DEM mit LOD-Kacheln und prozeduralem Mikrorelief
- Wege, Gewässer, Gebäude mit Dächern
- ~30.000 Props als Instanzen mit Entfernungs-Culling
- Drei Stimmungen umschaltbar (Knöpfe oben links)
- Third-Person-Kamera im 1:1-Maßstab

## Was noch nicht

- **Keine Spielerfigur, keine Bewegung.** Die Kamera steht am Ursprung.
- **Props sind Primitive** — Kegel, Ikosaeder, Zylinder. Keine echten Modelle.
- **Keine Texturen**, nur Vertex-Farben.
- **Keine Kreaturen in der Welt.** Kampf-Engine und Kampf-UI existieren, sind aber
  noch nicht mit der Szene verbunden.

## Prüfen

```bash
npm run typecheck   # TypeScript über alles
npm run test        # 16 Tests der Kampf-Engine
npm run validate    # Inhalte gegen Schema + Matrix-Selbsttest
npm run quality     # Qualitätstor (Blocker verhindern den Merge)
npm run lod         # LOD-Budget je Standort
npm run masstab     # Größenverhältnisse Spieler/Kreatur/Umgebung
```

## Build-Kennzahlen

```
dist/assets/index.js   968 kB  (269 kB gzip)
Service-Worker-Cache   1,98 MB inkl. Weltdaten
```

Beide gemessen, nicht geschätzt. Das Paket bleibt weit unter dem 60-MB-Budget aus
QUALITY.md — auch mit 200 Kreaturen (~16 MB) bleibt Luft.

---

## Assets: Stand

**Props: erledigt.** 23 Modelle aus dem **Kenney Nature Kit 2.1 (CC0)** liegen unter
`public/props/`, reduziert und auf reale Meter normiert:

```
23 Modelle · 2.778 Dreiecke gesamt · 130 KB
Varianten je Art: 4 (Totholz 3) — ein Baummodell 25.000-mal geklont fällt als Muster auf
Skalierung: Kenney modelliert in Blockeinheiten (Baum = 2), im Spiel ist eine Fichte 22 m
```

Build danach: **2.180 KB Precache** statt 1.977 — 200 KB für den kompletten Ersatz
aller Platzhalter-Primitive.

**Kreaturen: offen.** Der eigentliche Engpass. Nächste Schritte in dieser Reihenfolge:
1. Stil-Referenz festzurren (ein gutes 2D-Bild definiert den Look für alle 200)
2. Eine Kreatur komplett durch die Kette: generieren → `reduce.mjs` → `autorig.py` → Szene
3. Erst danach Stapelproduktion