/**
 * BRACHLAND — Kampfanzeige (Stufe 1, ADR-0007)
 *
 * Drei Dinge, sonst nichts: eigenes Leben, Leben + Haltung des aufgeschalteten
 * Ziels, eine kurze Meldung („ausgewichen", „Haltung gebrochen"). Die Haltung
 * steht nur beim Ziel, weil sie dort die Entscheidung trägt (jetzt nachsetzen
 * oder zurück); die eigene liest man an der Figur.
 *
 * Wie die Ausdaueranzeige: `Kampfplatz` schreibt einen Stand in eine Ref, diese
 * Komponente liest ihn per requestAnimationFrame und schreibt direkt in den DOM.
 * Kein React-State je Bild.
 */
import { useEffect, useRef } from 'react';

export interface KampfStand {
  leben: number;
  lebenMax: number;
  phase: string;
  ziel: { leben: number; lebenMax: number; haltung: number; haltungMax: number; phase: string } | null;
  gegnerUebrig: number;
  gegnerGesamt: number;
  /** Phase@Abstand je Gegner — nur für `tools/mess/kampf.mjs`, steht als data-Attribut am Knoten. */
  protokoll: string;
  meldung: string;
  /** Zeitpunkt der Meldung in Sekunden (Uhr des Canvas). */
  meldungSeit: number;
  /** Name der geführten Waffe (ADR-0008). */
  waffe: string;
  /** Wartet der Platz noch auf die erste Eingabe? Dann steht die Meldung ohne Ausblenden. */
  ruhig: boolean;
  /** Zählt erlittene Treffer — ein neuer Wert lässt den Rand rot aufblitzen (D171). */
  getroffen: number;
  /** Name des laufenden eigenen Schlags oder leer — für `tools/mess/kampf.mjs`. */
  schlag: string;
}

/** So lange glüht der rote Rand nach einem Treffer nach (D171). */
const RAND_DAUER = 0.45;

const MELDUNG_DAUER = 1.6;

const balken = (breite: number, hoehe: number): React.CSSProperties => ({
  width: breite, height: hoehe, background: '#0d1210cc', borderRadius: 2,
  border: '1px solid #2a3632', overflow: 'hidden',
});
const fuellung: React.CSSProperties = { height: '100%', width: '100%' };

export function Kampfanzeige({ stand }: { stand: React.RefObject<KampfStand | null> }) {
  const eigen = useRef<HTMLDivElement>(null);
  const zielHuelle = useRef<HTMLDivElement>(null);
  const zielLeben = useRef<HTMLDivElement>(null);
  const zielHaltung = useRef<HTMLDivElement>(null);
  const meldung = useRef<HTMLDivElement>(null);
  const zaehler = useRef<HTMLSpanElement>(null);
  const wurzel = useRef<HTMLDivElement>(null);
  const rand = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let laeuft = true;
    let letzteMeldung = -1;
    let meldungAb = 0;
    let getroffen = -1, randAb = -99;
    const schritt = (ms: number) => {
      if (!laeuft) return;
      const s = stand.current;
      if (s) {
        const t = ms / 1000;
        if (eigen.current) {
          const a = Math.max(0, s.leben / s.lebenMax);
          eigen.current.style.width = `${(a * 100).toFixed(1)}%`;
          eigen.current.style.background = a < 0.3 ? '#8d5148' : '#9c7d62';
        }
        if (zielHuelle.current) zielHuelle.current.style.opacity = s.ziel ? '1' : '0';
        if (s.ziel && zielLeben.current && zielHaltung.current) {
          zielLeben.current.style.width = `${(Math.max(0, s.ziel.leben / s.ziel.lebenMax) * 100).toFixed(1)}%`;
          const h = Math.max(0, s.ziel.haltung / s.ziel.haltungMax);
          zielHaltung.current.style.width = `${(h * 100).toFixed(1)}%`;
          zielHaltung.current.style.background = s.ziel.phase === 'betaeubt' ? '#6f8fb0' : '#b89a5a';
        }
        // Roter Rand beim Treffer (D171): Man merkt den Treffer, bevor man auf den Balken schaut.
        if (s.getroffen !== getroffen) { if (getroffen >= 0 && s.getroffen > getroffen) randAb = t; getroffen = s.getroffen; }
        if (rand.current) {
          const alter = t - randAb;
          rand.current.style.opacity = alter < RAND_DAUER ? String((1 - alter / RAND_DAUER) * 0.85) : '0';
        }
        if (wurzel.current) {
          wurzel.current.dataset.ich = `${s.phase}${s.schlag ? `:${s.schlag}` : ''} ${Math.round(s.leben)}`;
          wurzel.current.dataset.gegner = s.protokoll;
        }
        if (zaehler.current) zaehler.current.textContent = `${s.gegnerUebrig}/${s.gegnerGesamt} · ${s.waffe}`;
        // Meldungszeit kommt aus der Canvas-Uhr, die Anzeige hat ihre eigene —
        // deshalb auf den Wechsel reagieren statt die Zeiten zu vergleichen.
        if (s.meldungSeit !== letzteMeldung) { letzteMeldung = s.meldungSeit; meldungAb = t; }
        if (meldung.current) {
          const alter = t - meldungAb;
          meldung.current.textContent = s.meldung;
          meldung.current.style.opacity = s.ruhig ? '1' : s.meldung && alter < MELDUNG_DAUER
            ? String(Math.min(1, (MELDUNG_DAUER - alter) / 0.4)) : '0';
        }
      }
      requestAnimationFrame(schritt);
    };
    const id = requestAnimationFrame(schritt);
    return () => { laeuft = false; cancelAnimationFrame(id); };
  }, [stand]);

  const text: React.CSSProperties = {
    font: '11px/1.2 system-ui, sans-serif', color: '#c9bfae', letterSpacing: 0.3,
    textShadow: '0 1px 2px #000',
  };

  return (
    <div ref={wurzel} data-kampf="" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 11 }}>
      <div ref={rand} style={{
        position: 'absolute', inset: 0, opacity: 0,
        background: 'radial-gradient(ellipse at center, transparent 55%, #7a1a12aa 100%)',
      }} />
      {/* Ziel oben mittig */}
      <div ref={zielHuelle} style={{
        position: 'absolute', top: 'calc(env(safe-area-inset-top, 8px) + 54px)', left: '50%',
        transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: 3,
        alignItems: 'center', opacity: 0, transition: 'opacity 200ms ease',
      }}>
        <div style={balken(220, 6)}><div ref={zielLeben} style={{ ...fuellung, background: '#a0654f' }} /></div>
        <div style={balken(220, 3)}><div ref={zielHaltung} style={{ ...fuellung, background: '#b89a5a' }} /></div>
      </div>
      {/* Meldung */}
      <div ref={meldung} style={{
        ...text, position: 'absolute', top: '38%', left: '50%', transform: 'translateX(-50%)',
        fontSize: 15, opacity: 0, transition: 'opacity 120ms linear',
      }} />
      {/* eigenes Leben unten links über der Ausdauer */}
      <div style={{
        position: 'absolute', left: '50%', transform: 'translateX(-50%)',
        bottom: 'calc(env(safe-area-inset-bottom, 8px) + 68px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}>
        <div style={balken(132, 5)}><div ref={eigen} style={{ ...fuellung, background: '#9c7d62' }} /></div>
        <div style={{ ...text, opacity: 0.7 }}>
          J leicht · I schwer · Shift+J im Lauf · K Rolle · L Ziel · Q/E · 1/2 Waffe · <span ref={zaehler} />
        </div>
      </div>
    </div>
  );
}
