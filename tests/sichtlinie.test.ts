/**
 * Tests für die Sichtlinie der Schulterkamera (D192).
 *
 * Festgehalten wird, was beim Ändern umkippt: Ein Hindernis zwischen Kamera und Ziel zieht den Arm
 * ein; eines nur neben dem Ziel (innerhalb `ZIEL_RAND`) nicht; ohne Hindernis bleibt der volle Arm;
 * und der Schulterversatz zählt mit — eine Kamera, die erst durch den Versatz in einem Stamm steht,
 * wird nicht genommen.
 */
import { armMitSicht, sichtFrei, ZIEL_RAND, type Versperrt } from '../src/kampf/sichtlinie.js';

let ok = 0, fehler = 0;
function pruefe(was: string, gut: boolean, info = '') {
  console.log(`  ${gut ? '✓' : '✗'} ${was.padEnd(64)} ${info}`);
  gut ? ok++ : fehler++;
}

/** Stamm als senkrechter Zylinder, Boden bei y = 0. */
const stamm = (sx: number, sz: number, radius: number): Versperrt =>
  (x, y, z) => y < 0 || Math.hypot(x - sx, z - sz) < radius;
const leer: Versperrt = (_x, y) => y < 0;

console.log('Sichtlinie — Figur im Ursprung, Kamera hinten (+z), Ziel vorn (−z)\n');

const blick = [0, 1.5, 0] as const;
const richtung = [0, 0, 1] as const;
const ziel = [0, 1.2, -4] as const;
const basis = { blick, richtung, versatz: [0.85, 0.25, 0] as const, ziel, min: 1.3, max: 6 };

pruefe('freie Strecke ist frei', sichtFrei([0, 1, 0], [0, 1, -10], leer));
pruefe('Stamm auf der Strecke versperrt', !sichtFrei([0, 1, 0], [0, 1, -10], stamm(0, -5, 0.6)));
pruefe(`Stamm innerhalb ${ZIEL_RAND} m vor dem Ziel zählt nicht`,
  sichtFrei([0, 1, 0], [0, 1, -10], stamm(0, -9.6, 0.3), ZIEL_RAND));
pruefe('schmaler Stamm (r 0,3) auf 10 m wird nicht übersprungen',
  !sichtFrei([0, 1, 0], [0.37, 1, -10], stamm(0.2, -4.9, 0.3)));

const frei = armMitSicht({ ...basis, versperrt: leer });
pruefe('ohne Hindernis voller Arm', frei === 6, `${frei} m`);

// Stamm hinter der Figur, genau dort, wo die Kamera mit Versatz stünde (x 0,85, z 5).
const hinten = armMitSicht({ ...basis, versperrt: stamm(0.85, 5, 0.6) });
pruefe('Kamera mit Versatz im Stamm → Arm kürzer', hinten < 5 && hinten >= 1.3, `${hinten.toFixed(2)} m`);

// Stamm, der nur die Strecke Kamera → Ziel schneidet, nicht Figur → Kamera: seitlich hinter der
// Schulter zwischen Kamera (x 0,85, z 6) und Ziel (z −4); die Strecke Figur → Kamera läuft 0,4 m daneben.
const zwischen = armMitSicht({ ...basis, versperrt: stamm(0.55, 1, 0.25) });
pruefe('Stamm zwischen Kamera und Ziel → Arm kürzer', zwischen < 6, `${zwischen.toFixed(2)} m`);
pruefe('… ohne Ziel (nur Figur) bliebe der volle Arm',
  armMitSicht({ ...basis, ziel: null, versperrt: stamm(0.55, 1, 0.25) }) === 6);

const zu = armMitSicht({ ...basis, versperrt: (x, y, z) => y < 0 || z > 0.5 });
pruefe('alles versperrt → Mindestarm', zu === 1.3, `${zu} m`);

console.log(`\n${ok} bestanden, ${fehler} fehlgeschlagen\n`);
process.exit(fehler > 0 ? 1 : 0);
