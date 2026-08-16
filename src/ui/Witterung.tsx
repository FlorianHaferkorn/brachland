/**
 * BRACHLAND — Witterungsanzeige
 *
 * Zeigt Richtung und Abstand zur nächsten Kreatur.
 *
 * Der Grund ist gemessen, nicht gefühlt: Im Œntal stehen im Schnitt 3,7 Kreaturen
 * in Sichtweite, die nächste 62 m entfernt. Eine 0,9 m hohe Silhouette ist auf 62 m
 * bei 55° Sichtfeld aber nur **zwölf Pixel** hoch — im Dämmerlicht, im Nebel, gegen
 * einen dunklen Hang. Wer nichts findet, hat nicht schlecht gesucht; das Auge kann
 * das nicht leisten. Mehr Kreaturen hätten daran nichts geändert.
 *
 * Bewusst zurückhaltend: ein Strich, ein Zahlenwert, gedämpfte Farbe. **Nicht** die
 * Signalfarbe — die gehört dem Befall (ADR-0002). Der Balken wird kräftiger, je
 * näher die Kreatur ist; das ersetzt eine Karte, die es nicht geben soll.
 *
 * Läuft über requestAnimationFrame und schreibt direkt in den DOM-Knoten. Ein
 * React-State bei 60 Bildern je Sekunde wäre für einen gedrehten Strich absurd.
 */
import { useEffect, useRef } from 'react';
import type { Naehe } from '../scenes/RegionsSzene.js';

/** Weiter entfernte Kreaturen zeigt die Anzeige nicht — sonst führt sie quer durchs Tal. */
const REICHWEITE = 260;

export function Witterung({ naehe }: { naehe: React.RefObject<Naehe> }) {
  const huelle = useRef<HTMLDivElement>(null);
  const pfeil = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let laeuft = true;
    let letzterText = '';
    const schritt = () => {
      if (!laeuft) return;
      const n = naehe.current;
      const h = huelle.current;
      if (h && n) {
        const sichtbar = n.abstand < REICHWEITE;
        h.style.opacity = sichtbar ? '1' : '0';
        if (sichtbar) {
          // Nah = kräftig, fern = blass. Der Verlauf ist die eigentliche Information.
          const naeher = 1 - Math.min(1, n.abstand / REICHWEITE);
          if (pfeil.current) {
            pfeil.current.style.transform = `rotate(${n.winkel}rad)`;
            pfeil.current.style.opacity = String(0.35 + 0.65 * naeher);
          }
          const neu = `${Math.round(n.abstand)} m`;
          if (text.current && neu !== letzterText) { text.current.textContent = neu; letzterText = neu; }
        }
      }
      requestAnimationFrame(schritt);
    };
    const id = requestAnimationFrame(schritt);
    return () => { laeuft = false; cancelAnimationFrame(id); };
  }, [naehe]);

  return (
    <div ref={huelle} style={{
      position: 'fixed', left: '50%', transform: 'translateX(-50%)',
      bottom: 'calc(env(safe-area-inset-bottom, 8px) + 30px)',
      display: 'flex', alignItems: 'center', gap: 8, zIndex: 10,
      pointerEvents: 'none', transition: 'opacity 400ms ease',
      background: '#0d1210aa', padding: '5px 11px', borderRadius: 20,
      border: '1px solid #2a3632',
    }}>
      <div ref={pfeil} style={{
        width: 15, height: 15, color: '#9db0a6',
        display: 'grid', placeItems: 'center',
      }}>
        {/* Ein Strich mit Spitze — kein Symbol, das erklärt werden muss. */}
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <path d="M7.5 1.5 L11.5 12 L7.5 9.4 L3.5 12 Z" fill="currentColor" />
        </svg>
      </div>
      <span ref={text} style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#9db0a6',
        letterSpacing: 0.3, minWidth: 42,
      }}>—</span>
    </div>
  );
}
