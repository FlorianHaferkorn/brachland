/**
 * Entfernungsschwellen der Regionsszene.
 *
 * Eigenes Modul, weil die Messwerkzeuge dieselben Zahlen brauchen. Sie liegen
 * headless unter `tsx` und dürfen `RegionsSzene.tsx` nicht importieren — das zöge
 * React und den ganzen Renderer mit.
 */

/**
 * Sichtweite des Terrains. Der Nebel endet je nach Stimmung bei 240–420 m;
 * 500 m deckt alle drei ab, alles dahinter wäre gezeichnete Nebelfarbe.
 */
export const TERRAIN_SICHT = 500;

/** Erst ab dieser Bewegung wird die LOD-Zuordnung neu bestimmt. */
export const NEUAUFBAU_AB = 32;

/**
 * Ab dieser Entfernung wird die Attrappe gezeichnet.
 *
 * 75 m ist kein Geschmackswert: Gemessen kostet der dichteste Standort ohne
 * Attrappen 1,4 Mio Dreiecke, ab 160 m noch 524.000, ab 110 m 435.000 und ab 70 m
 * 250.000. Zusammen mit Terrain (~84.000) und Streuschicht (~22.000) ist 75 m der
 * größte Wert, der unter das Handybudget von 400.000 passt.
 */
export const ATTRAPPE_AB = 110;

/**
 * Ab hier reicht die Mittelstufe der Bäume.
 *
 * Drei Bänder statt zwei: voll bis 45 m, mittel bis 110 m, danach Attrappe. Der
 * Sprung von 872 auf 12 Dreiecke war zu groß für eine einzige Schwelle — entweder
 * zu teuer oder zu früh Kegel. Gemessen an einem Waldstandort:
 * 565.000 → 465.000 → mit Mittelstufe deutlich darunter.
 */
export const MITTEL_AB = 45;

/**
 * Erst nach dieser Bewegung wird neu bestimmt, welche Prop-Chunks montiert sind.
 *
 * 8 m ist der Abstand, bei dem sich die sichtbare Menge merklich ändert; kleiner
 * bedeutet häufigeres Montieren ohne sichtbaren Gewinn.
 */
export const PROP_NEUBEWERTUNG = 8;

/**
 * Eigene Schwelle für die **Attrappenstufe**.
 *
 * Seit alle Attrappen einer Art in einem Aufruf liegen (G-111), kostet eine
 * Neubewertung dort das Schreiben von 3.000 bis 7.500 Instanzmatrizen — gemessen
 * über vier Standorte. Bei den 8 m der Nahstufe wäre das alle anderthalb
 * Sekunden Lauf ein Ruckler.
 *
 * 60 m sind vertretbar, weil sich an einem Primitiv jenseits von 110 m über
 * diese Strecke nichts ändert, was man sähe: Es bleibt derselbe Klotz, nur
 * geringfügig anders gross im Bild.
 */
export const FERN_NEUBEWERTUNG = 60;
