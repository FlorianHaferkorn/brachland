#!/usr/bin/env node
/** Stapelverarbeitung: alle GLB aus einem Ordner reduzieren.
 *  Aufruf: node batch.mjs <inDir> <outDir> [zielTris] */
import { readdirSync, mkdirSync, statSync } from 'node:fs';
import { join as pjoin, basename } from 'node:path';
import { execFileSync } from 'node:child_process';

const [,, IN='./in', OUT='./out', TARGET='4000'] = process.argv;
mkdirSync(OUT, { recursive: true });
const files = readdirSync(IN).filter(f => f.toLowerCase().endsWith('.glb'));
if (!files.length) { console.log(`Keine .glb in ${IN}`); process.exit(0); }

let inMB = 0, outMB = 0, ok = 0;
for (const f of files) {
  const src = pjoin(IN, f), dst = pjoin(OUT, f.replace(/\.glb$/i, '_lp.glb'));
  process.stdout.write(`→ ${basename(f)} `);
  try {
    execFileSync('node', ['reduce.mjs', src, dst, TARGET], { stdio: 'pipe' });
    inMB += statSync(src).size / 1048576; outMB += statSync(dst).size / 1048576; ok++;
    console.log('ok');
  } catch (e) { console.log('FEHLER:', e.message.split('\n')[0]); }
}
console.log(`\n${ok}/${files.length} verarbeitet · ${inMB.toFixed(1)} MB → ${outMB.toFixed(1)} MB`);
console.log(`Hochrechnung 200 Kreaturen: ~${(outMB / Math.max(ok,1) * 200).toFixed(0)} MB Gesamtpaket`);
