/**
 * BRACHLAND — der eine Schalter der Bewegungs-Laufzeit (D457): Einstellung `figurfein`
 * (`content/einstellungen.json`, Gruppe Zugänglichkeit; Adresse `?figurfein=0`). Aus heisst: Die Figuren spielen
 * ihre Clips wie vor D457 — Kreuzblende, Gang nach Schwelle, Fuss-IK von D214, kein Neigen, kein Nachdrehen,
 * kein Wanken. Für Bewegungsempfindliche, für schwache Geräte und für den Vergleich am M1.
 *
 * Einmal gelesen und über das Abonnement des Speichers aktuell gehalten — im Bild kostet die Abfrage nichts.
 */
import { einstellungen } from '../spiel/einstellungen.js';

let stand: boolean | null = null;

export function figurfeinAn(): boolean {
  if (stand === null) {
    const e = einstellungen();
    stand = e.wert('figurfein') !== false;
    e.abonniere('figurfein', (_id, w) => { stand = w !== false; });
  }
  return stand;
}
