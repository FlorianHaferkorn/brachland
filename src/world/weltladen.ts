/**
 * Weltdaten laden — aus dem Cache, sonst einmal aus dem Netz.
 *
 * ## Warum nicht einfach `fetch`
 *
 * `oental.json` ist 1,32 MB und damit ein Drittel der Erstladung. Bis heute ging
 * es beim ersten Besuch **zweimal** über die Leitung: einmal holte es diese
 * Anwendung, einmal der Precache des Service Workers. Gemessen 82 Anfragen für
 * 41 Dateien, 1.382 KB (G-92).
 *
 * Die naheliegende Behebung — Weltdaten aus dem Precache nehmen und dem Service
 * Worker eine CacheFirst-Laufzeitregel geben — **funktioniert nicht**, und das
 * ist gemessen: Sie spart zwar 456 KB, aber die Weltdaten landen danach beim
 * Erstbesuch in **gar keinem** Cache. Der Grund ist die Reihenfolge: Beim ersten
 * Aufruf steht die Seite noch nicht unter der Kontrolle eines Service Workers.
 * Der wird erst registriert, installiert und aktiviert, während die Anwendung
 * längst läuft — ihr `fetch` geht also am Service Worker vorbei, und eine
 * Laufzeitregel sieht es nie. Ergebnis: nach einem Besuch offline unspielbar,
 * also genau das Gegenteil des Ziels (G-100).
 *
 * ## Was stattdessen
 *
 * Die Cache-API gehört nicht dem Service Worker, sie steht der Seite direkt
 * offen. Diese Anwendung legt ihre Weltdaten deshalb **selbst** ab. Damit gibt
 * es genau einen Griff ins Netz, genau einen Besitzer der Daten, und offline
 * hält es ab dem ersten Besuch.
 *
 * Der Cachename trägt einen Inhaltsstempel, den `vite.config.ts` beim Bauen aus
 * den Dateien in `public/world` rechnet. Neue Weltdaten heißen damit anders,
 * werden neu geholt, und die alte Fassung fliegt. Ohne diesen Stempel wäre ein
 * `npm run world` unsichtbar — die Anwendung zeigte weiter die alte Welt, und
 * niemand käme darauf, warum.
 */

/** Von `vite.config.ts` eingesetzt: Inhaltsstempel über `public/world`. */
declare const __WELTSTAND__: string;

const CACHE = `brachland-welt-${__WELTSTAND__}`;

/**
 * Alte Weltstände wegräumen.
 *
 * Ohne das sammelt jedes `npm run world` eine weitere Fassung von 1,32 MB an,
 * und irgendwann räumt der Browser den ganzen Ursprung ab — mitsamt dem
 * Spielstand.
 */
async function raeumeAlte(): Promise<void> {
  for (const name of await caches.keys())
    if (name.startsWith('brachland-welt-') && name !== CACHE) await caches.delete(name);
}

/**
 * Weltdatei holen. Antwortet aus dem Cache, wenn sie schon einmal da war.
 *
 * Ohne Cache-API (unsicherer Ursprung — etwa `http://192.168.x.x` beim Test vom
 * Handy im WLAN) bleibt der einfache Weg übrig. Dann ist es eben nicht offline
 * verfügbar; das ist beim Entwickeln richtig und in der ausgelieferten PWA
 * unerreichbar, weil die über HTTPS oder localhost läuft.
 */
export async function holeWeltdaten(pfad: string): Promise<unknown> {
  if (typeof caches === 'undefined') {
    const a = await fetch(pfad);
    if (!a.ok) throw new Error(`HTTP ${a.status}`);
    return a.json();
  }

  const lager = await caches.open(CACHE);
  const treffer = await lager.match(pfad);
  if (treffer) return treffer.json();

  const antwort = await fetch(pfad);
  if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
  // `put` vor `json()`, und auf einer Kopie: Ein Body lässt sich nur einmal
  // lesen, und die Reihenfolge entscheidet, ob bei einem Abbruch mitten im
  // Entpacken wenigstens die Datei im Cache liegt.
  await lager.put(pfad, antwort.clone());
  await raeumeAlte();
  return antwort.json();
}
