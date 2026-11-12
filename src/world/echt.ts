/**
 * BRACHLAND — Schalter des Vertikalschnitts „so echt wie möglich“ (Stauwehr, 11.11.2026)
 *
 * Flo am 11.11.2026: „so realistisch, plastisch und echt wie möglich“. Alles, was dafür neu ist,
 * hängt zunächst an Schaltern, damit der erarbeitete Look daneben bitgleich bleibt und am M1 in
 * Bewegung verglichen werden kann (ADR-0005/0006). `?echt=1` schaltet alles zusammen ein,
 * die Einzelschalter erlauben den Vergleich Stück für Stück.
 */
const suche = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search);
const an = (name: string) => suche.get(name) === '1';

/**
 * Malerischer Look (D269): `?malerei=1` = `?echt=1` plus Pinsel und Malfilter. Anlass: Reel
 * „oil-paint“ (patch.gg/blendi, three.js r186, WebGL2) vom 12.11.2026 und Flos „ne A“ — Realismus
 * allein ist dem Film nicht gewachsen, ein gemalter Look verzeiht Flimmern und fehlende Mikrodetails.
 * Einzeln: `?echt=1&pinsel=1` (nur B), `?echt=1&kuwahara=1` (nur C), oder `?malerei=1&pinsel=0`.
 */
export const MALEREI = an('malerei');
export const ECHT = an('echt') || MALEREI;
/** Einzelschalter: `?x=1` schaltet ein, `?x=0` nimmt ihn aus `?echt=1` heraus. */
const teil = (name: string) => (suche.get(name) === '0' ? false : ECHT || an(name));
/** Foto-Blattkarten auf den Kronen der Blender-Szenen (`laubkarten.ts`). */
export const LAUBKARTEN_AN = teil('laubkarten');
/**
 * Bachufer grün statt Schlamm: Bäche werden mit einer ganzen Rasterzelle (~10 m bei 384) als Biom
 * `wasser` gestempelt. Wo dort trocken ist, zählt die Zelle als Wiese — Farbe, Gras, Streu.
 */
export const UFER_GRUEN = teil('ufer');
/**
 * Rinde und Stammfuss an den Waldstämmen der Blender-Szenen (D262): `WaldHolz` bekommt den
 * Rinden-Scan, den die Engine-Bäume seit D224 tragen, und jedes Holz der Szene die Verdeckung am
 * Boden (`stammfuss.ts`).
 */
export const STAMM_AN = teil('stamm');
/**
 * Farbabgleich im Zwischenbild (D262): nimmt einen Teil des Sepiastichs der Stimmung heraus und
 * setzt eine sanfte S-Kurve. Berührt die entschiedene Tagesstimmung nicht — die Stimmung bleibt
 * `zielbild`, nur das fertige Bild wird abgeglichen. Gegenentwurf mit kühler Palette bleibt
 * ADR-0011 (Proposed).
 */
export const ABGLEICH_AN = teil('abgleich');
/**
 * Ruhige Verdeckung (D263): Der AO-Pass dreht seine Proben je Pixel mit weissem Rauschen und wird
 * nur mit vier Proben weichgezeichnet — es bleibt Korn, das in Bewegung flimmert. Mit dem Schalter
 * Bayer-Muster plus 4×4-Weichzeichnung mit Tiefengewicht (`Kontur.tsx`).
 */
export const AO_RUHIG = teil('aoruhig');
/**
 * Gras wie Gras (D266, `grasteppich.ts`): satteres Grün mit Farbflecken statt grau-weisser Spitzen,
 * Büschel (Höhe in ~70-cm-Flecken), dunkle Basis (Verdeckung im Rasen), Durchlicht im Gegenlicht,
 * kein Glanz. Der Teppich selbst — Dichte, Ringe, Wind — bleibt.
 */
/**
 * Gras-Vielfalt (D271, `?gras=2`): Pflanzenarten (Gras, Stroh, Kraut), Büschel mit kahlen Stellen, Halmkante
 * und -rippe. Anlass: Vergleich mit Phantom-Blade-Zero-Pressebildern am 12.11.2026 — dort fällt nicht die
 * Dichte auf, sondern Vielfalt. Schaltet `?gras=1` (Nahfeld, D268) mit ein.
 */
export const GRAS_VIEL = suche.get('gras') === '2';
export const GRAS_ECHT = teil('gras') || GRAS_VIEL;
/**
 * Bach im Wald (D267, `bandmaterial.ts`): Die Spiegelung zeigt unterhalb einer Waldkante (~7–27° über
 * dem Wasser) das dunkle Ufer statt Himmel. Ohne Szenenspiegelung reflektierte das Wasser gerade dort,
 * wo Fresnel am stärksten ist (flacher Blick), den hellen Himmel — es lag weiss im Wald.
 */
export const BACH_ECHT = teil('bach');
/** Stauweiher hinter dem Wehr, aus dem GLB abgeleitet (D268, `weiher.ts`). */
export const WEIHER_AN = teil('weiher');
/**
 * Zeitliche Kantenglättung (D268, `Kontur.tsx`): Kamera-Jitter nach Halton (8 Stellungen), das fertige
 * Bild (nach Kontur, Verdeckung, Bloom) wird gegen das Vorbild aufgelöst — Reprojektion aus der
 * Tiefe, Nachbarschafts-Begrenzung. Gegen das Flimmern von Halmen und Blattkanten in Bewegung, das
 * MSAA nicht fasst (Kantenglättung wirkt nur an Dreieckskanten, nicht in Teilbildpunkt-Strukturen).
 * Kostet drei Vollbild-Ziele (~125 MB bei 2880×1800) und zwei Vollbildpässe.
 */
export const TAA_AN = teil('taa');
/**
 * Flur um die Set-Pieces (D267, `lod.ts`): Industrie- und Siedlungsboden zählt im Häuser-Freihaltekreis
 * eines Bauwerks (`frei.haeuser`) als Wiese. Die Häuser sind dort seit D155 weg, ihre Bodenfarbe blieb —
 * am Stauwehr eine flache, betongraue Ebene im Wald, die wie ein zugefrorener See las.
 */
export const FLUR_GRUEN = teil('flur');
/**
 * Weg B der Gegenüberstellung (D265): ein Himmelsfoto (HDRI, Poly Haven `alps_field`, CC0) als
 * Umgebungslicht für alle Standardmaterialien statt nur der gerechneten Hemisphäre. **Nicht** Teil
 * von `?echt=1`: Es ändert die entschiedene Lichtstimmung (`zielbild`, A-9/ADR-0011) — eine Probe
 * zum Ansehen, keine Vorgabe. `?hdri=1`; die Stärke mit `?hdristaerke=` (Vorgabe 0,8).
 */
export const HDRI_AN = an('hdri');
export const HDRI_STAERKE = (() => { const v = Number(suche.get('hdristaerke')); return Number.isFinite(v) && v > 0 ? v : 0.8; })();
/**
 * Querbett (D263, `lod.ts`): Breite in Metern jenseits der Uferkante, auf der die hohe Böschung auf
 * den Spiegel abgestochen wird; 0 = aus (Vorgabe). Zwei Netzecken (2 m) plus Rand.
 */
export const BETT_QUER = teil('bett') ? 3 : 0;
/**
 * Schattenkarte (D263): 2048² auf ±250 m sind ~24 cm je Schattenpixel, Schattenkanten im Gras
 * werden zu Treppen. `?echt=1` nimmt 4096² (~12 cm). `?schattenkarte=` überschreibt weiter.
 */
export const SCHATTEN_AUFLOESUNG = ECHT && suche.get('schattenkarte') === null ? 4096 : 2048;
/**
 * Szenenspiegelung im Wasser am Stauwehr (D255): nur einzeln mit `?wasserreflex=1`, **nicht** Teil von
 * `?echt=1`. Sechs Szenenpässe je Aufnahme (~22 Mio Dreiecke) machten das Bild unter SwiftShader so
 * schwer, dass kein Bildschirmfoto mehr zustande kam (12.11.2026), und D255 belegt keinen sichtbaren
 * Gewinn — der dunkle Keil am Wehr ist Geometrie (H-156c).
 */
export const WASSERREFLEX_AN = an('wasserreflex');
/**
 * Kantenglättung im Zwischenbild (`Kontur.tsx`): Seit D155 zeichnet die Szene für AO/Kontur/Bloom
 * in ein Renderziel mit `samples: 0` — `antialias` am Canvas wirkt dann nie, jede Kante hat
 * Treppen. `?msaa=0|2|4|8` setzt die Samples für die Messung am M1; `?echt=1` nimmt 4.
 */
export const MSAA: number = (() => {
  const roh = suche.get('msaa');
  const n = roh === null ? NaN : Number(roh);
  if ([0, 2, 4, 8].includes(n)) return n;
  return ECHT ? 4 : 0;
})();

/**
 * B — Pinselstriche (D269, `laubkarten.ts`, `grasteppich.ts`): Laub als grosse Striche mit Pinselbogen
 * statt Foto-Blättern, drei Farbbänder (Licht, Halbton, Schatten) nach der Beleuchtung der Hülle;
 * Gras mit breiteren Halmen und denselben Bändern. Braucht `laubkarten` (steckt in `echt` und `malerei`).
 */
export const PINSEL_AN = teil('pinsel') && (MALEREI || an('pinsel'));
/**
 * C — Malfilter (D269, `Kontur.tsx`): Kuwahara über das Szenenbild vor Kontur und Verdeckung. Vier
 * Sektoren, der mit der kleinsten Varianz gewinnt — Flächen werden glatt, Kanten bleiben. Nachteil:
 * Die „Striche“ liegen am Bildschirm, nicht an der Welt (Schiebefenster-Effekt in Bewegung).
 */
export const KUWAHARA_AN = teil('kuwahara') && (MALEREI || an('kuwahara'));
