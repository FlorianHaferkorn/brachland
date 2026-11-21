/**
 * BRACHLAND — Maßstab-Tor (D352)
 *
 *     npm run massstab            # Bericht, Exit 1 bei Verstoss gegen eine belegte Referenz
 *
 * ## Warum
 *
 * Kein Tor prüfte bisher, ob Dinge **so gross wie in echt** sind. Flo am 21.11.2026: Die
 * Efeublätter an den Milbinger Häusern wirken riesig. Nachgemessen lagen sie in dichten Partien bei
 * 15–34 cm, echter Efeu hat 4–12 cm. Solche Werte waren von Hand gesetzt und gegen nichts geprüft.
 *
 * ## Was
 *
 * `content/massstab.json` hält reale Spannen mit Quelle. Gemessen wird an der **gebauten
 * Geometrie** (N6 wie `tools/geometrie.ts`): Die Efeu-Bauer aus `src/world/hausbewuchs.ts` laufen
 * mit denselben Funktionen wie die Szene, jedes Blatt ist ein Dreiecksfächer um einen gemeinsamen
 * Mittelpunkt, seine Länge die grösste Ausdehnung des Fächers. Weil die Bauer Schalter aus der
 * Adresse lesen (`src/world/echt.ts`), läuft die Messung je Schalterstand in einem eigenen Prozess.
 *
 * Tor: Median innerhalb [min, max] und 95. Perzentil höchstens 1,25 × max. Ein einzelnes
 * Riesenblatt fällt im Perzentil auf, ein durchgehend falscher Massstab im Median.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Massstab, type MassReferenz } from '../src/data/schema.js';

/** Schalterstände, unter denen die Szene Efeu baut: Vorgabe und die volle Milbinger Kette. */
const MILBINGER_KETTE = ['hofgruen', 'hofhaeuser', 'hofboden', 'hofverfall', 'hofranke', 'hofruine', 'hofeinsturz',
  'hofziel', 'hofdachbruch', 'hoflicht', 'zieltreue', 'verfallverlauf', 'ortsalterung', 'westverfall', 'westdetail',
  'westdach', 'westfassade', 'westanschluss', 'wohnwegquerschnitt', 'milbingerbelag', 'milbingeroben',
  'milbingermasse', 'milbingerdetail', 'milbingerboden', 'milbingerlicht'];
const STAENDE: Record<string, string> = {
  vorgabe: '',
  milbinger: `?echt=1&stimmung=hofdachbruch&${MILBINGER_KETTE.map(s => `${s}=1`).join('&')}`,
};

type Punkt = [number, number, number];

/** Kindprozess: Efeu bauen und Blattlängen je Bauer melden. */
async function messeEfeu(suche: string): Promise<{ laengen: Record<string, number[]>; dreiecke: Record<string, number> }> {
  (globalThis as { location?: { search: string } }).location = { search: suche };
  const { Color } = await import('three');
  const { baueHausbewuchs, baueRankenkurve, EFEURINDE, KRONENRINDE } = await import('../src/world/hausbewuchs.js');

  const laengen: Record<string, number[]> = {};
  const dreiecke: Record<string, number> = {};
  const mitschnitt = (name: string) => {
    const faecher = new Map<string, Punkt[]>();
    const dreieck = (a: Punkt, b: Punkt, c: Punkt, farbe: InstanceType<typeof Color>) => {
      dreiecke[name] = (dreiecke[name] ?? 0) + 1;
      // Triebe und Holz zählen nicht als Blatt, auch wenn sie einen Ansatzpunkt teilen.
      if (rinde.some(r => r.equals(farbe))) return;
      const schluessel = a.map(v => v.toFixed(5)).join(':');
      const liste = faecher.get(schluessel) ?? [];
      liste.push(b, c);
      faecher.set(schluessel, liste);
    };
    const abschluss = () => {
      const raus = laengen[name] ??= [];
      for (const [schluessel, rand] of faecher) {
        // Blätter sind Fächer aus fünf und mehr Dreiecken; Triebe teilen höchstens zwei.
        if (rand.length < 10) continue;
        const mitte = schluessel.split(':').map(Number);
        const punkte = [mitte, ...rand];
        let groesste = 0;
        for (let i = 0; i < punkte.length; i++) for (let j = i + 1; j < punkte.length; j++)
          groesste = Math.max(groesste, Math.hypot(
            punkte[i][0] - punkte[j][0], punkte[i][1] - punkte[j][1], punkte[i][2] - punkte[j][2]));
        raus.push(groesste);
      }
    };
    return { dreieck, abschluss };
  };

  const farben = { blaetter: ['#303722', '#434c30', '#595d3c'].map(t => new Color(t)), trieb: new Color('#4e4233') };
  const rinde = [...EFEURINDE, ...KRONENRINDE, farben.trieb];
  const senkrecht = (u: number) => [0, .3, 1.2, 2.4, 3.6, 4.8].map((y, i) => ({
    ort: [u + Math.sin(i) * .15, y, .15] as Punkt, aussen: [0, 0, 1] as Punkt,
  }));

  for (const [stufe, dicht] of [[1, false], [2, false], [2, true]] as const) {
    const m = mitschnitt(`wandefeu-stufe${stufe}${dicht ? '-dicht' : ''}`);
    for (let saat = 1; saat <= 6; saat++)
      baueHausbewuchs(m.dreieck, [0, 0], [8, 0], [0, 1], () => 0, 6.5, stufe, saat * 7919, null, farben, dicht);
    m.abschluss();
  }
  for (const [name, zielbild, zielkrone] of [
    ['rankenkurve', false, false], ['efeukurve', true, false], ['efeukrone', true, true],
  ] as const) {
    const m = mitschnitt(name);
    for (let saat = 1; saat <= 6; saat++) baueRankenkurve(m.dreieck, senkrecht(saat), saat * 104729, farben, zielbild, zielkrone);
    m.abschluss();
  }
  return { laengen, dreiecke };
}

function perzentil(werte: number[], p: number): number {
  const s = [...werte].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

async function hauptlauf() {
  const daten = Massstab.parse(JSON.parse(readFileSync('content/massstab.json', 'utf8')));
  const ref = (messung: MassReferenz['messung']) => daten.referenzen.filter(r => r.messung === messung);
  let verstoesse = 0;
  const cm = (m: number) => `${(m * 100).toFixed(1)} cm`;
  const zeile = (r: MassReferenz, name: string, werte: number[], einheit: (m: number) => string) => {
    if (!werte.length) { console.log(`  ! [${r.id}] ${name}: keine Messwerte`); return; }
    const median = perzentil(werte, .5), p95 = perzentil(werte, .95);
    const ok = median >= r.min && median <= r.max && p95 <= r.max * 1.25;
    const marke = ok ? '✓' : r.belegt ? '✗' : '!';
    if (!ok && r.belegt) verstoesse++;
    console.log(`  ${marke} [${r.id}] ${name}: n=${werte.length} · Median ${einheit(median)} · p95 ${einheit(p95)}`
      + ` · max ${einheit(Math.max(...werte))} (Soll ${einheit(r.min)}–${einheit(r.max)})`);
  };

  console.log('\nMaßstab-Tor — content/massstab.json\n');
  const [efeu] = ref('hausbewuchs');
  if (efeu) for (const [stand, suche] of Object.entries(STAENDE)) {
    const roh = execFileSync(process.execPath, [...process.execArgv, process.argv[1], '--efeu', suche],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
    const { laengen, dreiecke } = JSON.parse(roh.trim().split('\n').at(-1)!) as
      { laengen: Record<string, number[]>; dreiecke: Record<string, number> };
    for (const [bauer, werte] of Object.entries(laengen)) zeile(efeu, `${stand} · ${bauer}`, werte, cm);
    console.log(`    Dreiecke je Probe (6 Saaten): ${Object.entries(dreiecke).map(([b, n]) => `${b} ${n}`).join(' · ')}`);
  }

  const { FIGUR_HOEHE } = await import('../src/spieler/figur.js');
  for (const r of ref('figur')) zeile(r, 'FIGUR_HOEHE', [FIGUR_HOEHE], m => `${m.toFixed(2)} m`);

  const { BORD_ABSENKUNG, BORD_HOEHE } = await import('../src/world/strassenquerschnitt.js');
  for (const r of ref('bordstein')) zeile(r, 'Hochbord ohne Absenkung', [BORD_HOEHE], cm);
  if (BORD_ABSENKUNG > .04) { console.log(`  ✗ [bordstein] Absenkung ${cm(BORD_ABSENKUNG)} über 4 cm`); verstoesse++; }

  const register = JSON.parse(readFileSync('public/props/baeume.json', 'utf8')) as { baeume: { art: string; stufe: string; hoehe: number }[] };
  for (const r of ref('baum')) {
    const art = r.id.replace(/^baum-/, '');
    zeile(r, `baeume.json ${art} (Nahstufe, unskaliert)`,
      register.baeume.filter(b => b.art === art && b.stufe === 'nah').map(b => b.hoehe), m => `${m.toFixed(1)} m`);
  }

  console.log(verstoesse ? `\n${verstoesse} Verstoss/Verstösse gegen belegte Referenzen` : '\n0 Verstösse');
  process.exit(verstoesse ? 1 : 0);
}

if (process.argv[2] === '--efeu') {
  console.log(JSON.stringify(await messeEfeu(process.argv[3] ?? '')));
} else {
  await hauptlauf();
}
