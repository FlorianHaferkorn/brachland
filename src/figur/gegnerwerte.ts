/**
 * BRACHLAND — Werte für die Körpersprache der Tiere und Gegner (D458): `content/figurgegner.json`, geprüft von
 * `npm run validate` (Schema `Figurgegner`). Nur Darstellung — kein Kampfwert, kein Tempo. Rein, ohne three.js.
 */
import ROH from '../../content/figurgegner.json';
import type { Figurgegner } from '../data/schema.js';
import type { Ansageprofil } from './ansage.js';

export const GEGNERBILD = ROH as Figurgegner;

/** Ansageprofil zum Bauplan eines Gegners (`content/gegner/<id>.json`); unbekannt → das der Kapsel. */
export function ansageProfil(bauplan: string): Ansageprofil {
  const p = GEGNERBILD.ansage.profile;
  return p[bauplan] ?? p.uebungsgegner;
}
