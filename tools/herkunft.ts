/**
 * Herkunft der Fremdmodelle ins Spiel: `assets/HERKUNFT.md` → `public/herkunft.json`.
 *
 * CC BY verlangt die Namensnennung **dort, wo das Werk gezeigt wird** (D127).
 * Die Tabelle in `assets/HERKUNFT.md` ist die eine Quelle — das Tor prüft sie
 * gegen die Dateien —, aber `assets/` wird nicht ausgeliefert. Dieses Werkzeug
 * liest die Tabellen „## Modelle" und „## Menschen" und schreibt sie als JSON nach `public/`, wo
 * das Verzeichnis im Menü sie unter „Herkunft" zeigt. Keine zweite Pflege:
 * Wer die Tabelle ändert, lässt `npm run herkunft` laufen; `npm run quality`
 * blockt, wenn JSON und Tabelle auseinanderliegen.
 */
import { readFileSync, writeFileSync } from 'node:fs';

export interface Herkunft {
  datei: string;
  rolle: string;
  autor: string;
  lizenz: string;
  quelle: string;
}

export function leseHerkunft(pfad = 'assets/HERKUNFT.md'): Herkunft[] {
  const text = readFileSync(pfad, 'utf8');
  // Beide Tabellen: Kreaturen (## Modelle) und Menschen (## Menschen, D143).
  const bloecke = ['## Modelle', '## Menschen'].map(kopf => {
    const ab = text.indexOf(kopf);
    if (ab < 0) return '';
    const bis = text.indexOf('\n## ', ab + 1);
    return text.slice(ab, bis < 0 ? undefined : bis);
  });
  const zeilen: Herkunft[] = [];
  for (const zeile of bloecke.join('\n').split('\n')) {
    if (!zeile.startsWith('| `')) continue;
    const felder = zeile.split('|').slice(1, -1).map(f => f.trim());
    if (felder.length < 5) continue;
    const saeubern = (f: string) => f.replace(/\*\*/g, '').replace(/`/g, '').trim();
    zeilen.push({
      datei: saeubern(felder[0]), rolle: saeubern(felder[1]), autor: saeubern(felder[2]),
      lizenz: saeubern(felder[3]), quelle: saeubern(felder[4]),
    });
  }
  return zeilen;
}

export function herkunftJson(): string {
  return JSON.stringify(leseHerkunft(), null, 1) + '\n';
}

if (process.argv[1] && /herkunft\.ts$/.test(process.argv[1])) {
  const json = herkunftJson();
  writeFileSync('public/herkunft.json', json);
  console.log(`${leseHerkunft().length} Einträge → public/herkunft.json`);
}
