/** Referenz Apple M1, D485: zwei vollständige Hof–Weststraße-Läufe bei 960 × 540. */
export function hofBefund(laeufe) {
  if (laeufe.length !== 2 || laeufe.some(l => ![l.fps, l.p95, l.max].every(x => Number.isFinite(x) && x > 0)
      || l.max < l.p95 || !Array.isArray(l.spitzen))) return ['Unvollständige Bildzeitmessung'];
  const befund = [];
  if (laeufe.some(l => l.p95 > 35)) befund.push('p95 über 35 ms');
  if (laeufe.reduce((s, l) => s + l.fps, 0) / laeufe.length < 50) befund.push('Mittel unter 50 B/s');
  if (laeufe.some(l => l.max >= 100)) befund.push('Einzelbild ab 100 ms');
  if (laeufe.reduce((s, l) => s + l.spitzen.length, 0) > 2) befund.push('Mehr als zwei Bilder über 50 ms');
  return befund;
}
