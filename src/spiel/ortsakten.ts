/** Vite bündelt alle Ortsakten für den Offlinebetrieb. Im Node-Messwerkzeug
 * löst dieselbe Paketadresse auf den Dateileser unter tools/ auf. */
import type { Ortsprobe } from './zielort.js';
export const ortsakten = Object.values(import.meta.glob<Ortsprobe>('../../tools/ort/*.json', { eager: true, import: 'default' }));
