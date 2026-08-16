/**
 * BRACHLAND — Bildrate der Seite, unabhängig von three.js
 *
 * Warum eine zweite Messung neben der in der Szene: Die Szenenmessung hängt an
 * `useFrame` und schweigt, sobald die Bildschleife steht. Genau dann ist die Frage
 * aber am interessantesten — wenn im Kampf **nichts** gezeichnet wird und die Seite
 * trotzdem nicht auf 60 kommt, liegt die Grenze nicht in der Szene.
 *
 * Gemessen wird die **Bildzeit in Millisekunden**, nicht nur die Rate. Der Grund:
 * Vsync rastet die Rate auf 60/30/20 ein. „30 B/s“ kann 17,1 ms bedeuten (knapp
 * daneben) oder 33 ms (Faktor zwei daneben) — als Rate sieht beides gleich aus, als
 * Zeit nicht. Ohne diese Unterscheidung optimiert man ins Blaue.
 */
import { useEffect, useState } from 'react';

export interface Bildrate {
  bps: number;
  /** Median der Bildzeit in ms. Bei Vsync auf 60 Hz sind 16,7 das Ziel. */
  mittel: number;
  /** 95. Perzentil — hier zeigen sich Ruckler, die der Median verschluckt. */
  p95: number;
}

/** Fenster in Sekunden, über das gemittelt wird. */
const FENSTER = 0.5;

export function benutzeBildrate(): Bildrate | null {
  const [wert, setWert] = useState<Bildrate | null>(null);

  useEffect(() => {
    let laeuft = true;
    let letzte = performance.now();
    let zeiten: number[] = [];
    let summe = 0;

    const schritt = (jetzt: number) => {
      if (!laeuft) return;
      const dt = jetzt - letzte;
      letzte = jetzt;
      // Der erste Wert nach einem Tab-Wechsel ist Unsinn — verwerfen.
      if (dt < 500) { zeiten.push(dt); summe += dt; }

      if (summe >= FENSTER * 1000 && zeiten.length > 2) {
        const sortiert = [...zeiten].sort((a, b) => a - b);
        setWert({
          bps: (zeiten.length * 1000) / summe,
          mittel: sortiert[sortiert.length >> 1],
          p95: sortiert[Math.min(sortiert.length - 1, Math.floor(sortiert.length * 0.95))],
        });
        zeiten = []; summe = 0;
      }
      requestAnimationFrame(schritt);
    };

    const id = requestAnimationFrame(schritt);
    return () => { laeuft = false; cancelAnimationFrame(id); };
  }, []);

  return wert;
}
