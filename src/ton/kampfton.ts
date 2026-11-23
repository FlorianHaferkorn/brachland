/**
 * BRACHLAND — Kampfton (D427, Entscheidung D423): freie Aufnahmen (CC0, `assets/HERKUNFT.md`) für Schwung,
 * Treffer nach Oberfläche, Block, Parade, Rolle, Schritt und den Reinigen-Griff. **Tonhöhe und Pegel nach
 * Masse** kommen aus `toene()` (`src/kampf/gewicht.ts`): Eine Axt klingt tiefer und schlägt lauter ein als die
 * Klinge, ein Hirschfänger heller. Gegen Wiederholung: drei Aufnahmen je Band, nie zweimal dieselbe
 * hintereinander, dazu ± Pegel und ± Halbtöne (`content/kampfton.json`).
 *
 * Zwei Teile:
 *  * `planeKlang` — rein, ohne WebAudio (`tests/kampfton.test.ts`): welches Band, welche Datei, welcher Pegel,
 *    welche Abspielrate.
 *  * `spieleKampfton` — WebAudio wie der Lagerton (`lagerton.ts`): Kontext erst nach einer Eingabe entsperrt
 *    (Autoplay-Regel), Dateien beim ersten Kampfereignis geladen und dekodiert. Ein Effekte-Bus
 *    (`GainNode`) unter dem Gesamtregler: `lautstaerke-gesamt` × `lautstaerke-effekte` aus dem
 *    Einstellungs-Speicher (D415), stumm im Hintergrund nach `tonStumm` (`spiel/spielphase.ts`).
 *
 * Der Lagerton hängt weiter direkt am Ausgang (ihn an den Gesamtregler zu hängen, machte ihn 20 % leiser als
 * heute — Menü-Dokument §8 Phase 0.1); der Kampfton ist neu und hat kein „heute“.
 */
import ROH from '../../content/kampfton.json';
import type { Kampfton as KampftonDaten } from '../data/schema.js';
import { GEWICHT, toene } from '../kampf/gewicht.js';
import type { Gewicht } from '../data/schema.js';
import { einstellungen } from '../spiel/einstellungen.js';
import { tonStumm } from '../spiel/spielphase.js';

/** Geprüft von `npm run validate`. */
export const KAMPFTON = ROH as KampftonDaten;

export type Band = keyof KampftonDaten['baender'];

/** Was im Kampf hörbar wird. `waffe` ist die Waffenfamilie (`content/gewicht.json` `waffen`). */
export type KampfEreignis =
  | { art: 'schwung'; waffe: string; schwer: boolean; wucht?: number }
  /** Treffer der Spielerin; `ziel` ist der Bauplan des Gegners (`content/gegner/<id>.json`). */
  | { art: 'treffer'; waffe: string; wucht?: number; ziel: string }
  /** In die gedeckte Linie eines Menschen geschlagen: Waffe auf Waffe. */
  | { art: 'gedeckt'; waffe: string; wucht?: number }
  /** Die Spielerin wurde getroffen. */
  | { art: 'erlitten'; schaden: number }
  /** Die Spielerin hat einen Angriff mit der Waffe gefangen bzw. pariert. */
  | { art: 'block'; waffe: string }
  | { art: 'parade'; waffe: string }
  | { art: 'rolle' }
  | { art: 'schritt' }
  | { art: 'griff' };

export interface Klangplan {
  band: Band;
  datei: string;
  /** 0…1 vor dem Effekte-Bus. */
  pegel: number;
  /** Abspielrate (1 = Aufnahme), in `rate.min`…`rate.max`. */
  rate: number;
}

const begrenze = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** Zufällig eine der `n` Aufnahmen, nie die zuletzt gespielte (bei mehr als einer). */
export function waehle(n: number, zuletzt: number | undefined, zufall: () => number): number {
  if (n <= 1) return 0;
  if (zuletzt === undefined || zuletzt < 0 || zuletzt >= n) return Math.min(n - 1, Math.floor(zufall() * n));
  const i = Math.min(n - 2, Math.floor(zufall() * (n - 1)));
  return i >= zuletzt ? i + 1 : i;
}

/** Oberfläche des Getroffenen nach seinem Bauplan. */
export function oberflaeche(ziel: string, d: KampftonDaten = KAMPFTON): KampftonDaten['oberflaechen']['standard'] {
  return d.oberflaechen.je[ziel] ?? d.oberflaechen.standard;
}

/**
 * Band, Datei, Pegel und Abspielrate für ein Ereignis. `zuletzt` merkt je Band die letzte Datei (wird
 * fortgeschrieben). Masse wirkt über `toene()`: Schwung — Pegel und Tonhöhe der Waffe im Schwung;
 * Treffer, Block, Parade, gedeckt — Tonhöhe der Waffe im Treffer (Grösse), Pegel nach ihrem Impuls.
 */
export function planeKlang(e: KampfEreignis, zufall: () => number = Math.random,
  zuletzt: Partial<Record<Band, number>> = {}, d: KampftonDaten = KAMPFTON, g: Gewicht = GEWICHT): Klangplan {
  let band: Band, masse = 1, hoehe = 1;
  switch (e.art) {
    case 'schwung': {
      const t = toene(e.waffe, e.wucht, g).schwung;
      band = e.schwer ? 'schwung-schwer' : 'schwung-leicht'; hoehe = t.tonhoehe;
      // Gegen die Referenzwaffe gelesen, damit der Grundpegel des Bands für die Klinge gilt.
      masse = t.pegel / toene(g.ton.referenz, 1, g).schwung.pegel;
      break;
    }
    case 'treffer': case 'gedeckt': case 'block': case 'parade': {
      const t = toene(e.waffe, 'wucht' in e ? e.wucht : 1, g).treffer;
      band = e.art === 'treffer' ? `treffer-${oberflaeche(e.ziel, d)}`
        : e.art === 'gedeckt' ? `treffer-${d.oberflaechen.gedeckt}` : e.art;
      masse = t.pegel / toene(g.ton.referenz, 1, g).treffer.pegel; hoehe = t.tonhoehe;
      break;
    }
    case 'erlitten':
      band = `treffer-${d.oberflaechen.spielerin}`;
      masse = (d.erlitten.grund + d.erlitten.jeSchaden * e.schaden) / d.erlitten.grund;
      break;
    default:
      band = e.art;
  }
  const b = d.baender[band];
  if (!b) throw new Error(`Kampfton: Band '${band}' fehlt in content/kampfton.json`);
  const i = waehle(b.dateien.length, zuletzt[band], zufall);
  zuletzt[band] = i;
  const streuP = 1 + (zufall() * 2 - 1) * b.streuPegel;
  const streuH = Math.pow(2, ((zufall() * 2 - 1) * b.streuHalbton) / 12);
  return {
    band, datei: b.dateien[i],
    pegel: begrenze(b.pegel * masse * streuP, 0, 1),
    rate: begrenze(hoehe * streuH, d.rate.min, d.rate.max),
  };
}

// ---------------------------------------------------------------- WebAudio (nur im Browser)

let ctx: AudioContext | null = null;
let bus: GainNode | null = null;
const puffer = new Map<string, AudioBuffer | 'laedt' | 'fehlt'>();
const zuletzt: Partial<Record<Band, number>> = {};

/** Pegel des Effekte-Busses: Gesamt × Effekte, 0 wenn der Ton schweigen soll. */
export function busPegel(gesamt: number, effekte: number, stumm: boolean): number {
  return stumm ? 0 : begrenze(gesamt / 100, 0, 1) * begrenze(effekte / 100, 0, 1);
}

function stellBus(): void {
  if (!ctx || !bus) return;
  const e = einstellungen();
  const verborgen = typeof document !== 'undefined' && document.hidden;
  const stumm = tonStumm({ phase: 'spielt', gruende: verborgen ? ['verborgen'] : [], meldung: null }, e.wert('stumm-im-hintergrund') === true);
  bus.gain.setTargetAtTime(busPegel(Number(e.wert('lautstaerke-gesamt')), Number(e.wert('lautstaerke-effekte')), stumm), ctx.currentTime, 0.02);
}

function kontext(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === 'undefined') return null;
  const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  try {
    ctx = new C();
    bus = ctx.createGain(); bus.gain.value = 0; bus.connect(ctx.destination);
    stellBus();
  } catch { ctx = null; bus = null; }
  return ctx;
}

function lade(datei: string): void {
  const c = kontext();
  if (!c || puffer.has(datei)) return;
  puffer.set(datei, 'laedt');
  const basis = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  fetch(`${basis}${KAMPFTON.ordner}/${datei}`)
    .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
    .then(b => c.decodeAudioData(b))
    .then(p => { puffer.set(datei, p); })
    // Ohne Ogg-Opus (älteres Safari) oder ohne Netz bleibt der Kampf stumm, nicht kaputt.
    .catch(() => { puffer.set(datei, 'fehlt'); });
}

/** Alle Dateien vorladen — beim Betreten des Kampfplatzes, damit der erste Hieb nicht stumm bleibt. */
export function ladeKampfton(): void {
  if (!kontext()) return;
  for (const b of Object.values(KAMPFTON.baender)) for (const f of b.dateien) lade(f);
}

/** Ein Ereignis hörbar machen; `verzoegerung` in s (der Schritt am Ende der Rolle). */
export function spieleKampfton(e: KampfEreignis, verzoegerung = 0): void {
  const c = kontext();
  if (!c || !bus || c.state !== 'running') return;
  const plan = planeKlang(e, Math.random, zuletzt);
  const p = puffer.get(plan.datei);
  if (!(p instanceof AudioBuffer)) { lade(plan.datei); return; }
  const q = c.createBufferSource(); q.buffer = p; q.playbackRate.value = plan.rate;
  const v = c.createGain(); v.gain.value = plan.pegel;
  q.connect(v).connect(bus);
  q.onended = () => { q.disconnect(); v.disconnect(); };
  q.start(c.currentTime + Math.max(0, verzoegerung));
}

if (typeof window !== 'undefined') {
  // Entsperren in der Eingabegeste (Autoplay-Regel); der Bus folgt den Reglern und dem Tab.
  const an = () => {
    const c = kontext();
    try { void c?.resume().catch(() => { /* nächste Geste */ }); } catch { /* synchron verweigert */ }
  };
  window.addEventListener('pointerdown', an, { passive: true });
  window.addEventListener('keydown', an);
  document.addEventListener('visibilitychange', stellBus);
  einstellungen().abonniere('*', stellBus);
}
