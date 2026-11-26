/** Gegenstück zum Vite-Glob für Node-Werkzeuge und Tests. */
import { readdirSync, readFileSync } from 'node:fs';
import type { Ortsprobe } from '../src/spiel/zielort.js';

const ordner = new URL('./ort/', import.meta.url);
export const ortsakten: Ortsprobe[] = readdirSync(ordner).filter(name => name.endsWith('.json'))
  .map(name => JSON.parse(readFileSync(new URL(name, ordner), 'utf8')) as Ortsprobe);
