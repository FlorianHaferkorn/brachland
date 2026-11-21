/** D365: Parallax Occlusion Mapping an den Hauswänden — Gewicht, Lagenzahl und die Strahlschleife (CPU-Gegenstück). */
import { POM, pomGewicht, pomSchritte, pomVersatz, pomPars, pomWahl } from '../src/world/hauspom.js';

let ok = 0, fehler = 0;
function pruefe(name: string, gut: boolean, info = '') {
  console.log('  ' + (gut ? '✓' : '✗') + ' ' + name + ' ' + info); gut ? ok++ : fehler++;
}
const nah = (a: number, b: number, e = 1e-3) => Math.abs(a - b) < e;

console.log('Gewicht und Lagen');
pruefe('voll im Nahbereich bei steilem Blick', pomGewicht(5, 0.8) === 1);
pruefe('aus jenseits 25 m', pomGewicht(26, 0.8) === 0);
pruefe('aus bei streifendem Blick (< 7°)', pomGewicht(5, 0.1) === 0);
pruefe('weicher Übergang 18–25 m', pomGewicht(21.5, 0.8) > 0 && pomGewicht(21.5, 0.8) < 1);
pruefe('senkrecht 8 Lagen', pomSchritte(1) === POM.schritteMin);
pruefe('streifend 24 Lagen', pomSchritte(0) === POM.schritteMax);

console.log('Strahlschleife');
const blick: [number, number, number] = [0.6, 0, 0.8];
const eben = pomVersatz(() => 1, blick, 0.05);
pruefe('ebene Oberfläche: kein Versatz', eben.u === 0 && eben.v === 0 && eben.tiefe === 0);
const tief = pomVersatz(() => 0, blick, 0.05);
pruefe('überall tief: voller Versatz gegen den Blick', nah(tief.u, -0.6 / 0.8 * 0.05, 4e-3) && nah(tief.tiefe, 1, 0.1),
  `u=${tief.u.toFixed(4)} t=${tief.tiefe.toFixed(3)}`);
// Stufe: links (u < -0.01) hoch, rechts tief. Ein Strahl, der rechts startet, trifft die Stufenkante.
const stufe = pomVersatz((u) => (u < -0.01 ? 1 : 0), blick, 0.05);
pruefe('Stufe wird an der Kante getroffen', nah(stufe.u, -0.01, 3e-3), `u=${stufe.u.toFixed(4)}`);
pruefe('Tiefe an der Kante zwischen 0 und 1', stufe.tiefe > 0.1 && stufe.tiefe < 0.6, `t=${stufe.tiefe.toFixed(3)}`);
const senk = pomVersatz(() => 0, [0, 0, 1], 0.05);
pruefe('senkrechter Blick: kein seitlicher Versatz', nah(senk.u, 0) && nah(senk.v, 0));

console.log('Shadertext');
const pars = pomPars(true, true), wahl = pomWahl({ hof: true, ziel: true, west: true, milbinger: true, normale: true });
pruefe('Schleife mit fester Obergrenze', pars.includes(`i < ${POM.schritteMax}`));
pruefe('Umleitung der Weltlage', pars.includes('#define vHausPos pomPos'));
pruefe('rohe Lage vor den Ableitungen', wahl.indexOf('pomPos = hausPosRoh()') < wahl.indexOf('dFdx(pomPos)'));
pruefe('ohne Hof keine Hofkarte', !pomPars(false, false).includes('uPomHof')
  && !pomWahl({ hof: false, ziel: false, west: false, milbinger: false, normale: false }).includes('uHofMitte'));

console.log(`\n${ok} bestanden, ${fehler} fehlgeschlagen`);
if (fehler) process.exit(1);
