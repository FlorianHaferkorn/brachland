/** Spielbare Ortsproben aus derselben Akte wie Messkamera, Quellen und Leistungsbudget.
 * Die Auswahl ergänzt Adresswerte im Speicher. Explizite Messschalter haben Vorrang. */
import { ortsakten } from '#ortsakten';

interface Kamera {
  name: string; ort: readonly number[]; blick: readonly number[]; brennweite: number; sensor: number;
}
export interface Ortsprobe {
  id: string; region: string; ursprung: { x: number; z: number }; h0: number; hoehenversatz?: number;
  kameras: readonly Kamera[];
  spiel: { stimmung: string; schalterNachher: readonly string[] };
  laufzeit: {
    start: readonly number[]; bildstart?: readonly number[]; modellgruppe?: string;
    bodenrand?: number; pixeldichte?: number; kamerastellen?: number;
  };
}
const ORTE = new Map(ortsakten.filter(ort => ort.laufzeit).map(ort => [ort.id, ort]));

export function weltpunkt(a: Pick<Ortsprobe, 'ursprung' | 'h0' | 'hoehenversatz'>, p: readonly number[]): [number, number, number] {
  return [a.ursprung.x + p[0], a.h0 + (a.hoehenversatz ?? 0) + p[2], a.ursprung.z - p[1]];
}

export function bildwinkel(brennweite: number, sensor = 36, verhaeltnis = 16 / 9): number {
  return 2 * Math.atan(sensor / verhaeltnis / 2 / brennweite) * 180 / Math.PI;
}

export function waehleZielort(suche: string) {
  const parameter = new URLSearchParams(suche);
  const id = parameter.get('ziel');
  const ort = id ? ORTE.get(id) : undefined;
  // Ein Regionswechsel darf die Spielfigur nicht an Koordinaten der verlassenen Karte setzen.
  if (!ort || (parameter.has('region') && parameter.get('region') !== ort.region)) return { parameter, ort: undefined };
  const setze = (name: string, wert: string) => { if (!parameter.has(name)) parameter.set(name, wert); };
  setze('region', ort.region);
  setze('stimmung', ort.spiel.stimmung);
  for (const [name, wert] of new URLSearchParams(ort.spiel.schalterNachher.join('&'))) setze(name, wert);
  const ansicht = parameter.get('zielkamera');
  const kamera = ansicht === '1' ? ort.kameras[0] : ort.kameras.find(k => k.name === ansicht);
  if (kamera) {
    const werte = [...weltpunkt(ort, kamera.ort), ...weltpunkt(ort, kamera.blick)];
    setze('kamera', werte.map(v => Number(v.toFixed(ort.laufzeit.kamerastellen ?? 2))).join(','));
    setze('fov', String(Number(bildwinkel(kamera.brennweite, kamera.sensor).toFixed(2))));
  }
  setze('absetzen', ((kamera && ort.laufzeit.bildstart) || ort.laufzeit.start).join(','));
  return { ort, parameter };
}

export const { ort: ZIELORT, parameter: ORTSPARAMETER } = waehleZielort(typeof location === 'undefined' ? '' : location.search);
