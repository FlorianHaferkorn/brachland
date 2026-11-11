/**
 * Audio ohne Browser: Die Vorbereitungsphase darf keinen Klanggraphen starten,
 * und eine verweigerte fruehe Kontextanlage muss in der naechsten Geste gehen.
 * Zwei eigene Prozesse isolieren die Modulzustandsvariablen des echten Moduls.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const fall = process.argv[2];
if (fall === 'vorbereitet' || fall === 'fallback' || fall === 'geste-zuerst') {
  let leerlauf: (() => void) | undefined;
  const gesten = new Map<string, () => void>();
  let versuche = 0, kontexte = 0, quellen = 0, starts = 0, resumes = 0, inGeste = false;
  const parameter = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
  const knoten = () => ({
    gain: parameter(), frequency: parameter(), Q: parameter(),
    connect<T>(ziel: T): T { return ziel; }, disconnect() {}, start() { starts++; }, stop() {},
  });
  class AudioAttrappe {
    sampleRate = 48_000;
    destination = knoten();
    currentTime = 0;
    constructor() {
      versuche++;
      if (fall === 'fallback' && versuche === 1) throw new Error('Vorbereitung verweigert');
      kontexte++;
    }
    createGain() { return knoten(); }
    createBuffer() { return { getChannelData: () => new Float32Array(96_000) }; }
    createBufferSource() { quellen++; return knoten(); }
    createBiquadFilter() { return knoten(); }
    createOscillator() { quellen++; return knoten(); }
    resume() { assert.equal(inGeste, true, 'resume muss synchron in der Eingabegeste passieren'); resumes++; return Promise.resolve(); }
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    AudioContext: AudioAttrappe,
    requestIdleCallback: (f: () => void) => { leerlauf = f; },
    addEventListener: (art: string, f: () => void) => { gesten.set(art, f); },
  } });
  await import('../src/ton/lagerton.js');
  assert.equal(kontexte, 0, 'vor dem Leerlauf noch kein Kontext');
  assert.ok(leerlauf, 'Vorbereitung wurde geplant');
  if (fall !== 'geste-zuerst') leerlauf();
  assert.equal(kontexte, fall === 'vorbereitet' ? 1 : 0);
  assert.equal(quellen, 0, 'vor der Geste duerfen keine Klangquellen entstehen');
  assert.equal(starts, 0, 'vor der Geste darf keine Quelle starten');
  const geste = (art: string) => {
    const f = gesten.get(art); assert.ok(f, `${art}-Handler fehlt`);
    inGeste = true; try { f(); } finally { inGeste = false; }
  };
  geste('keydown');
  assert.equal(kontexte, 1, 'nach Geste genau ein Kontext');
  assert.equal(versuche, fall === 'fallback' ? 2 : 1, 'Fallback versucht Kontextanlage erneut');
  assert.equal(starts, 3, 'zwei Oszillatoren und eine Quelle werden einmal gestartet');
  assert.equal(resumes, 1);
  if (fall === 'geste-zuerst') leerlauf();
  geste('pointerdown');
  assert.equal(kontexte, 1, 'weitere Geste erzeugt keinen zweiten Kontext');
  assert.equal(starts, 3, 'weitere Geste startet keine doppelten Quellen');
  assert.equal(resumes, 2, 'weitere Geste kann resume erneut versuchen');
  console.log(`✓ Lagerton: ${fall}`);
} else {
  for (const szenario of ['vorbereitet', 'fallback', 'geste-zuerst']) {
    const lauf = spawnSync(process.execPath, ['--import', 'tsx', process.argv[1], szenario], { stdio: 'inherit' });
    if (lauf.error) throw lauf.error;
    if (lauf.status !== 0) process.exit(lauf.status ?? 1);
  }
}
