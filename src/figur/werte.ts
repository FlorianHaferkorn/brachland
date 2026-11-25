/**
 * BRACHLAND — Werte der Bewegungs-Laufzeit (D457): `content/figurlaufzeit.json`, geprüft von `npm run validate`
 * (Schema `Figurlaufzeit`). Nur Darstellung — hier steht kein Kampfwert und kein Tempo. Rein, ohne three.js.
 */
import ROH from '../../content/figurlaufzeit.json';
import type { Figurlaufzeit } from '../data/schema.js';

export const FIGUR = ROH as Figurlaufzeit;

/** Fallbeschleunigung in m/s² — für die Kurvenlage (dieselbe Zahl wie `spieler/tempo.ts`). */
export const G = 9.81;

export const GRAD = Math.PI / 180;
