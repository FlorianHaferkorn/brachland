/**
 * BRACHLAND — Kampfbot (D171): spielt gegen jeden Gegner mit menschlicher Reaktionszeit und misst,
 * wie schwer der Kampf ist.
 *
 * Das Kampftor (`tests/echtzeit.test.ts`) prüft Fenster und Regeln einzeln. Ob die Summe fair ist —
 * ob ein Mensch, der aufpasst, einen Wolf schlägt und ein unaufmerksamer nicht immer —, sieht man
 * erst im ganzen Kampf. Der Bot spielt ihn aus, ohne Grafik, in denselben Teilschritten wie das Spiel.
 *
 * Der Bot tut, was man einem Anfänger nach zehn Minuten zutraut:
 *   * Er sieht den Gegner ausholen und rollt nach seiner Reaktionszeit (Normalverteilung, Mittel und
 *     Streuung je Profil) — bei einer Kette (Wolf) weg vom Gegner, sonst schräg zurück.
 *   * Steht der Gegner in der Erholung oder taumelt, geht er hin und schlägt: leicht in Kette, auf
 *     einen taumelnden Gegner schwer.
 *   * Er verschätzt sich: Mit `patzer` Wahrscheinlichkeit rollt er zu spät oder gar nicht.
 *
 *   npx tsx tools/kampfbot.ts [kämpfe=200]
 */
import {
  SPIELERIN, KEILER, GRATHORN, WOLF, UEBUNGSGEGNER, SCHRITT, WAFFEN,
  neuerKaempfer, blickAuf, puffere, ruesteAus, simuliere, frei, naechsterSchlag,
  type KampfWerte, type Kampfwelt, type WaffenArt,
} from '../src/kampf/echtzeit.js';

export interface Profil { name: string; reaktion: number; streuung: number; patzer: number }
export const PROFILE: Profil[] = [
  { name: 'aufmerksam', reaktion: 0.25, streuung: 0.05, patzer: 0.1 },
  { name: 'müde', reaktion: 0.4, streuung: 0.08, patzer: 0.25 },
];
/** Aufstellungen: einzeln und zu zweit (wie `?kampf=1` bzw. `?kampf=wolf`). */
export const GEGNER: Record<string, KampfWerte[]> = {
  kapsel: [UEBUNGSGEGNER], keiler: [KEILER], grathorn: [GRATHORN], wolf: [WOLF],
  'keiler+grathorn': [KEILER, GRATHORN], 'wolf+wolf': [WOLF, WOLF],
};

/** Kleiner deterministischer Zufall (mulberry32) — dieselbe Saat, dieselben Kämpfe. */
function zufall(saat: number) {
  let a = saat >>> 0;
  const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const normal = (m: number, s: number) => m + s * Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  return { r, normal };
}

export interface Ergebnis { sieg: boolean; zeit: number; erlitten: number; treffer: number }

export function kampf(aufstellung: KampfWerte[], waffe: WaffenArt, p: Profil, saat: number): Ergebnis {
  const z = zufall(saat);
  const s = neuerKaempfer('s', SPIELERIN, 0, 0, 0);
  ruesteAus(s, waffe);
  const alle = aufstellung.map((werte, i) => {
    const winkel = (z.r() - 0.5) * 1.2 + (i ? 0.9 : 0);
    const k = neuerKaempfer(`g${i}`, werte, -Math.sin(winkel) * (8 + 2 * i), -Math.cos(winkel) * (8 + 2 * i), 0);
    k.blick = blickAuf(k.x, k.z, 0, 0);
    return k;
  });
  const w: Kampfwelt = { spielerin: s, gegner: alle, ziel: null };
  let t = 0, rolleUm = Infinity, treffer = 0, kette = false;
  const gesehen = alle.map(g => g.schwung);
  while (t < 120 && s.phase !== 'gefallen' && alle.some(g => g.phase !== 'gefallen')) {
    // Wahrnehmen: ein neuer Angriff (erster Schlag, nicht die Kette) → Rolle nach der Reaktionszeit.
    alle.forEach((g, i) => {
      if (g.schwung === gesehen[i]) return;
      if (g.phase === 'vorlauf' && g.schlag === g.werte.schlag) {
        const patzt = z.r() < p.patzer;
        rolleUm = patzt && z.r() < 0.5 ? Infinity : t + Math.max(0.12, z.normal(p.reaktion, p.streuung)) + (patzt ? 0.2 : 0);
        kette = !!g.werte.kette?.length;
      }
      gesehen[i] = g.schwung;
    });
    // Ziel: wer gerade angreift, sonst der nächste Lebende.
    const lebend = alle.filter(g => g.phase !== 'gefallen');
    const g = lebend.find(k => k.id === w.recht) ?? lebend.reduce((a, b) =>
      Math.hypot(a.x - s.x, a.z - s.z) <= Math.hypot(b.x - s.x, b.z - s.z) ? a : b);
    w.ziel = g.id;
    const dx = g.x - s.x, dz = g.z - s.z, d = Math.hypot(dx, dz);
    const rand = d - g.werte.radius - (g.werte.halbLaenge ?? 0) * 0.5;
    if (t >= rolleUm) {
      // Bei einer Kette gerade weg; sonst zur Seite aus dem Bogen — dann steht man nach der Rolle
      // noch nah genug, um in seine Erholung zu schlagen.
      if (kette) puffere(s, 'rolle', -dx / d, -dz / d);
      else puffere(s, 'rolle', -dz / d, dx / d);
      rolleUm = Infinity;
    } else if (frei(s) || s.phase === 'erholung') {
      if (frei(s)) s.blick = blickAuf(s.x, s.z, g.x, g.z);
      const offen = g.phase === 'erholung' && g.folge.length === 0 || g.phase === 'betaeubt';
      // Wie lange er noch offen steht — ein Mensch schlägt nur, wenn der Schlag vorher ankommt.
      const rest = offen ? (g.phase === 'erholung' ? g.schlag.erholung : g.werte.betaeubt) - g.zeit : 0;
      const art = g.phase === 'betaeubt' ? 'schwer' : 'leicht';
      const naechster = naechsterSchlag(s, art).schlag;
      const reich = naechster.reichweite * 0.9;
      const weg = Math.max(0, rand - reich) / 4.5;
      const reicht = rest > weg + naechster.vorlauf;
      if (offen && reicht && rand <= reich) puffere(s, art);
      else if (!frei(s)) { /* in der Erholung: nicht nachsetzen, sie läuft aus */ }
      // Nachsetzen, wenn er offen steht; sonst stehen und auf das Telegraf warten. (Zurückweichen
      // gab es in der ersten Fassung — der Gegner rückte nach, schlug nie, 90 s Patt.)
      else if (offen && reicht && frei(s)) { const v = 4.5 * SCHRITT; s.x += dx / d * v; s.z += dz / d * v; }
    }
    for (const e of simuliere(w, SCHRITT)) if (e.von === 's' && e.schaden > 0) treffer++;
    t += SCHRITT;
  }
  return { sieg: alle.every(g => g.phase === 'gefallen'), zeit: t, erlitten: s.werte.lebenMax - s.leben, treffer };
}

export interface Zeile { gegner: string; waffe: WaffenArt; profil: string; siege: number; zeit: number; erlitten: number }

export function messe(kaempfe = 200): Zeile[] {
  const zeilen: Zeile[] = [];
  for (const [name, werte] of Object.entries(GEGNER)) for (const waffe of Object.keys(WAFFEN) as WaffenArt[]) {
    for (const p of PROFILE) {
      let siege = 0, zeit = 0, erlitten = 0;
      for (let i = 0; i < kaempfe; i++) {
        const e = kampf(werte, waffe, p, 1000 + i);
        if (e.sieg) { siege++; zeit += e.zeit; }
        erlitten += e.erlitten;
      }
      zeilen.push({ gegner: name, waffe, profil: p.name, siege: siege / kaempfe, zeit: siege ? zeit / siege : NaN, erlitten: erlitten / kaempfe });
    }
  }
  return zeilen;
}

if (process.argv[1]?.endsWith('kampfbot.ts')) {
  const n = Number(process.argv[2] ?? 200);
  console.log(`Kampfbot — ${n} Kämpfe je Zeile, Start 8 m`);
  console.log('Gegner           Waffe   Profil       Siege   Zeit bis Sieg   Schaden erlitten');
  for (const z of messe(n)) {
    console.log(`${z.gegner.padEnd(16)} ${z.waffe.padEnd(7)} ${z.profil.padEnd(12)} ${(z.siege * 100).toFixed(0).padStart(4)} %`
      + `   ${Number.isNaN(z.zeit) ? '   –' : z.zeit.toFixed(1).padStart(5) + ' s'}        ${z.erlitten.toFixed(0).padStart(4)}`);
  }
}
