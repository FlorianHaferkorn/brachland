/**
 * BRACHLAND — die beiden Daumenknüppel
 *
 * Zwei Ringe mit je einem Knopf darin, die nur da sind, solange ein Finger liegt.
 *
 * ## Warum es sie gibt
 *
 * Bis zum 26.08.2026 stand unten am Bild ein Satz: „links wischen = gehen ·
 * rechts wischen = umsehen“. Das ist eine Gebrauchsanweisung, keine Bedienung.
 * Rückmeldung vom Gerät war unter anderem „kein sichtbarer Stick“ — und das ist
 * genau der Punkt: Ohne Anzeige sieht man weder, **wo** der Stock angesetzt hat,
 * noch **ob** der Finger noch greift. Wenn Safari einen Zeiger abbricht (und das
 * tat es, siehe `spieler/steuerung.ts`), merkt man es erst daran, dass sich
 * nichts mehr bewegt.
 *
 * ## Warum sie dem Daumen folgen statt fest zu stehen
 *
 * Ein fester Knüppel in einer Ecke zwingt den Daumen an eine Stelle, die er im
 * Dunkeln nicht findet. Hier wächst der Ring dort, wo der Finger aufsetzt —
 * irgendwo auf der jeweiligen Bildhälfte —, und der Knopf zeigt den Ausschlag.
 * Man muss nichts treffen.
 *
 * ## Warum das hier und nicht in der Szene liegt
 *
 * Dieselbe Trennung wie bei `Ausdaueranzeige`: Die Szene rechnet, die Anzeige
 * liegt im DOM und liest einen Ref. Geschrieben wird direkt in den Knoten über
 * `requestAnimationFrame` — ein React-State je Bild wäre für zwei Kreise absurd.
 * `pointerEvents: 'none'` ist Pflicht: Ein Knüppel, der Berührungen abfängt,
 * nimmt der Steuerung genau die Finger weg, die er anzeigen soll.
 */
import { useEffect, useRef } from 'react';
import type { Stoecke } from '../spieler/steuerung.js';

/** Muss zu `STOCK_RADIUS` in `spieler/steuerung.ts` passen. */
const RADIUS = 64;
const KNOPF = 26;

export function Stockanzeige({ stoecke }: { stoecke: React.RefObject<Stoecke> }) {
  const ringe = useRef<(HTMLDivElement | null)[]>([]);
  const knoepfe = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let laeuft = true;
    const schritt = () => {
      if (!laeuft) return;
      const s = stoecke.current;
      for (const [i, seite] of (['links', 'rechts'] as const).entries()) {
        const ring = ringe.current[i], knopf = knoepfe.current[i];
        if (!ring || !knopf) continue;
        const stock = s?.[seite] ?? null;
        if (!stock) { ring.style.opacity = '0'; continue; }
        ring.style.opacity = '1';
        ring.style.transform =
          `translate(${stock.x - RADIUS}px, ${stock.y - RADIUS}px)`;
        knopf.style.transform =
          `translate(${RADIUS - KNOPF / 2 + stock.dx * RADIUS}px, `
          + `${RADIUS - KNOPF / 2 + stock.dy * RADIUS}px)`;
      }
      requestAnimationFrame(schritt);
    };
    const id = requestAnimationFrame(schritt);
    return () => { laeuft = false; cancelAnimationFrame(id); };
  }, [stoecke]);

  return (
    <>
      {[0, 1].map(i => (
        <div key={i}
          ref={(el) => { ringe.current[i] = el; }}
          style={{
            position: 'fixed', left: 0, top: 0,
            width: RADIUS * 2, height: RADIUS * 2, borderRadius: '50%',
            border: '1.5px solid #7d938455', background: '#0d121033',
            zIndex: 20, pointerEvents: 'none', opacity: 0,
            transition: 'opacity 120ms linear',
          }}>
          <div ref={(el) => { knoepfe.current[i] = el; }}
            style={{
              position: 'absolute', left: 0, top: 0, width: KNOPF, height: KNOPF,
              borderRadius: '50%', background: '#7d938466',
              border: '1.5px solid #9fb0a888',
            }} />
        </div>
      ))}
    </>
  );
}
