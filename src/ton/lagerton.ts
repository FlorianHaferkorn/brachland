/**
 * Lagerton (D181): Knistern und gedämpftes Murmeln an besetzten Wegelagern — nachts hörbar,
 * bevor man das Feuer sieht. Ganz aus WebAudio erzeugt, keine Tondateien (CC0-Frage entfällt).
 *
 * Knistern: kurze Rauschimpulse mit zufälligem Abstand, hochpassgefiltert. Murmeln: Rauschen durch
 * zwei Formantfilter (≈ 500 / 1500 Hz) mit langsam wanderndem Pegel — liest sich als Stimmen hinter
 * einer Wand, nicht als Sprache. Lautstärke fällt mit dem Abstand (voll bei 8 m, still ab 45 m).
 * Der AudioContext startet erst mit der ersten Eingabe (Browser-Regel).
 */
const VOLL = 8, STILL = 45;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let knisterPegel: GainNode | null = null;
let murmelPegel: GainNode | null = null;
let rauschen: AudioBuffer | null = null;
let naechsterKnack = 0;

function starte(): void {
  if (ctx) return;
  const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return;
  ctx = new C();
  master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  rauschen = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = rauschen.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  knisterPegel = ctx.createGain(); knisterPegel.gain.value = 0.9; knisterPegel.connect(master);

  // Murmeln: Dauerrauschen → zwei Formanten → langsam modulierter Pegel.
  murmelPegel = ctx.createGain(); murmelPegel.gain.value = 0.0; murmelPegel.connect(master);
  const quelle = ctx.createBufferSource(); quelle.buffer = rauschen; quelle.loop = true;
  for (const [f, q] of [[520, 6], [1450, 8]] as const) {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.7 + Math.random();
    const tiefe = ctx.createGain(); tiefe.gain.value = f * 0.12;
    lfo.connect(tiefe).connect(bp.frequency); lfo.start();
    quelle.connect(bp).connect(murmelPegel);
  }
  quelle.start();
}

function knack(): void {
  if (!ctx || !rauschen || !knisterPegel) return;
  const t = ctx.currentTime;
  const q = ctx.createBufferSource(); q.buffer = rauschen;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800 + Math.random() * 2500;
  const g = ctx.createGain();
  const laut = 0.15 + Math.random() * 0.5;
  g.gain.setValueAtTime(laut, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.02 + Math.random() * 0.05);
  q.connect(hp).connect(g).connect(knisterPegel);
  q.start(t, Math.random() * 1.5, 0.08);
}

if (typeof window !== 'undefined') {
  const an = () => { starte(); void ctx?.resume(); };
  window.addEventListener('pointerdown', an, { passive: true });
  window.addEventListener('keydown', an);
}

/** Pro Bild: Abstand zum nächsten besetzten Lager (m) und ob es Nacht ist. `Infinity` = kein Lager. */
export function lagerTon(abstand: number, nacht: boolean): void {
  if (!ctx || !master || !murmelPegel) return;
  const t = ctx.currentTime;
  const nah = Math.max(0, Math.min(1, (STILL - abstand) / (STILL - VOLL)));
  const ziel = nacht ? nah * nah * 0.35 : nah * nah * 0.12;
  master.gain.setTargetAtTime(ziel, t, 0.3);
  // Stimmen nur nachts; tags sitzt man stumm am kalten Feuer.
  const wandel = 0.5 + 0.5 * Math.sin(t * 0.9) * Math.sin(t * 0.37 + 1);
  murmelPegel.gain.setTargetAtTime(nacht ? 0.25 + 0.35 * wandel : 0, t, 0.15);
  if (nacht && t >= naechsterKnack) {
    knack();
    naechsterKnack = t + (Math.random() < 0.2 ? 0.02 : 0.05 + Math.random() * 0.35);
  }
}
