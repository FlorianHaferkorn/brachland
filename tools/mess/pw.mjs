/**
 * Playwright laden — bewusst keine Abhaengigkeit im Manifest (wie `tools/bildtor.mjs`, `zaehlen.mjs`).
 * Reihenfolge: `node_modules/playwright` (Symlink oder npx), sonst `.cache/mess/node_modules/playwright`,
 * wo die Messlaeufe seit D152 ihr eigenes Playwright halten. Fehlt beides, sagt der Fehler, was zu tun ist.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function playwright() {
  try { return await import('playwright'); } catch { /* weiter */ }
  const eigen = path.resolve(process.cwd(), '.cache/mess/node_modules/playwright/index.mjs');
  if (existsSync(eigen)) return import(pathToFileURL(eigen).href);
  throw new Error('Playwright fehlt: `cd .cache/mess && npm init -y && npm i playwright && npx playwright install chromium` (docs/MESSLAUF.md)');
}
