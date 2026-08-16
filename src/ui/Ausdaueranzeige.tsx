/**
 * BRACHLAND — Ausdaueranzeige
 *
 * Ein Balken, der die meiste Zeit nicht da ist.
 *
 * Ausdauer ist nur in dem Moment interessant, in dem sie knapp wird. Ein dauerhaft
 * sichtbarer Balken erzieht dazu, ihn anzusehen statt das Gelände; deshalb blendet
 * er bei vollem Vorrat aus und kommt zurück, sobald gezehrt wird. Dieselbe Logik
 * wie bei der Witterung: anzeigen, was gerade zählt, und sonst nichts.
 *
 * Rot heißt nicht „wenig", sondern **gesperrt**. Der Unterschied ist der, auf den
 * es beim Klettern ankommt: Bei 20 % kann man noch greifen, nach dem Nullpunkt
 * nicht mehr, auch wenn wieder 20 % da sind (Hysterese in `ausdauer.ts`).
 *
 * Schreibt direkt in den DOM-Knoten über requestAnimationFrame — ein React-State
 * je Bild wäre für einen Balken absurd.
 */
import { useEffect, useRef } from 'react';
import { anteil, type Ausdauer } from '../spieler/ausdauer.js';

export function Ausdaueranzeige({ ausdauer }: { ausdauer: React.RefObject<Ausdauer> }) {
  const huelle = useRef<HTMLDivElement>(null);
  const fuellung = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let laeuft = true;
    const schritt = () => {
      if (!laeuft) return;
      const a = ausdauer.current;
      const h = huelle.current, f = fuellung.current;
      if (a && h && f) {
        const t = anteil(a);
        h.style.opacity = t >= 0.999 ? '0' : '1';
        f.style.width = `${(t * 100).toFixed(1)}%`;
        f.style.background = a.erschoepft ? '#8d5148' : t < 0.35 ? '#9a8560' : '#7d9384';
      }
      requestAnimationFrame(schritt);
    };
    const id = requestAnimationFrame(schritt);
    return () => { laeuft = false; cancelAnimationFrame(id); };
  }, [ausdauer]);

  return (
    <div ref={huelle} style={{
      position: 'fixed', left: '50%', transform: 'translateX(-50%)',
      bottom: 'calc(env(safe-area-inset-bottom, 8px) + 58px)',
      width: 132, height: 4, zIndex: 10, pointerEvents: 'none',
      background: '#0d1210cc', borderRadius: 3, overflow: 'hidden',
      border: '1px solid #2a3632', opacity: 0, transition: 'opacity 300ms ease',
    }}>
      <div ref={fuellung} style={{
        height: '100%', width: '100%', background: '#7d9384',
        transition: 'background 200ms linear',
      }} />
    </div>
  );
}
