/**
 * BRACHLAND — Heilung einer Region (D240): besiegen → Reinkulturen einsetzen → geheilt.
 */
import { fehlende, heile, heillage, wildZustand } from '../src/spiel/heilung.js';

let bestanden = 0, gefallen = 0;
function pruefe(name: string, bedingung: boolean, hinweis = '') {
  if (bedingung) { bestanden++; return; }
  gefallen++;
  console.log(`  ✗ ${name}${hinweis ? ` — ${hinweis}` : ''}`);
}

const r = { id: 'flussvater', reinkulturen: ['saatgut-rein', 'katalysator-v3', 'wasserprobe-quell'] };
const voll = { 'saatgut-rein': 1, 'katalysator-v3': 2, 'wasserprobe-quell': 1, kraeutersud: 3 };

pruefe('unbesiegt, auch mit vollem Satz', heillage(r, { regenten: [], geheilt: [], beutel: voll }) === 'unbesiegt');
pruefe('unbesiegt: heile tut nichts', heile(r, { regenten: [], geheilt: [], beutel: voll }) === null);

const halb = { regenten: ['flussvater'], geheilt: [], beutel: { 'saatgut-rein': 1 } };
pruefe('besiegt, Satz unvollständig', heillage(r, halb) === 'unvollstaendig');
pruefe('fehlende in Reihenfolge', fehlende(r, halb).join() === 'katalysator-v3,wasserprobe-quell');
pruefe('unvollständig: heile tut nichts', heile(r, halb) === null);

const bereit = { regenten: ['flussvater'], geheilt: [], beutel: voll };
pruefe('besiegt mit vollem Satz: bereit', heillage(r, bereit) === 'bereit');
const neu = heile(r, bereit);
pruefe('heile setzt geheilt', !!neu && neu.geheilt.includes('flussvater'));
pruefe('je eine Komponente verbraucht, Rest bleibt',
  !!neu && neu.beutel['katalysator-v3'] === 1 && !('saatgut-rein' in neu.beutel) && neu.beutel.kraeutersud === 3,
  JSON.stringify(neu?.beutel));
pruefe('Eingabe unverändert', voll['saatgut-rein'] === 1);
pruefe('geheilt ist Endlage', heillage(r, { ...bereit, geheilt: ['flussvater'] }) === 'geheilt');
pruefe('zweimal heilen geht nicht', heile(r, { ...bereit, geheilt: ['flussvater'] }) === null);

// ---- Wildlinge vor und nach der Heilung (D241) ----------------------------
{
  const ids = Array.from({ length: 2000 }, (_, i) => `oental:${i}`);
  const befallen = ids.filter(id => wildZustand(id, 0.3, false) === 'befallen').length / ids.length;
  pruefe('vorher: Anteil befallen ≈ 0,3', Math.abs(befallen - 0.3) < 0.04, befallen.toFixed(3));
  pruefe('nachher: alle rein', ids.every(id => wildZustand(id, 0.3, true) === 'rein'));
  pruefe('befall 0: alle rein', ids.every(id => wildZustand(id, 0, false) === 'rein'));
  pruefe('fest je Vorkommen', ids.every(id => wildZustand(id, 0.3, false) === wildZustand(id, 0.3, false)));
}

console.log(`${bestanden} bestanden, ${gefallen} fehlgeschlagen`);
if (gefallen) process.exit(1);
