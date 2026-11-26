/** BRACHLAND — Karte, Beutel und Fundstücke des Brachgängers. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Weltdaten } from '../world/osm.js';
// Im Bündel, nicht per fetch: Die Nennung muss auch im Flugmodus da sein, und
// `herkunft.json` liegt nicht im Precache (nur js/css/html/glb, D82).
import HERKUNFT from '../../public/herkunft.json';
import { GEGENSTAENDE, FRAGMENTE, ORTE, nachMetern }
  from '../data/inhalte.js';
import { zeichneKarte, zeichneMarken, type Kartenmarke } from './karte.js';
import { aktionenVon } from '../spieler/eingabe.js';

export type Reiter = 'karte' | 'beutel' | 'heft';

export interface MenueProps {
  welt: Weltdaten;
  beutel: Record<string, number>;
  /** Gelesene Fundstücke — die Leseliste. */
  fragmente: string[];
  besuchteOrte: string[];
  /** Weltposition des Spielers. */
  spieler: [number, number];
  /** Verfolgtes Auftragsziel, falls eines gesetzt ist. */
  ziel?: { x: number; z: number; name: string };
  onSchliessen: () => void;
  /** Charakter-Editor öffnen (D175). */
  onFigur?: () => void;
  /** D355: Richtungskampf (vier Linien) an oder aus. */
  richtung?: boolean;
  onRichtung?: (an: boolean) => void;
}

const FARBE = {
  // Vollständig deckend, nicht `f2`. Bei 95 % schienen die Team-Zeilen, der
  // Beuteltext und der Steuerungshinweis der Welt durch — auf einem Bildschirmfoto
  // gut sichtbar, und in Bewegung noch schlechter, weil sich darunter etwas rührt.
  grund: '#0d1210',
  feld: '#131c19',
  rand: '#2a3632',
  akzent: '#3fd9a0',
  text: '#9fb0a8',
  matt: '#6f8079',
  aus: '#5c6b64',
};

const REITER: [Reiter, string][] = [
  ['karte', 'Karte'],
  ['beutel', 'Beutel'],
  ['heft', 'Heft'],
];

export function Menue(p: MenueProps) {
  const [reiter, setReiter] = useState<Reiter>('karte');
  useEffect(() => {
    // D415: Aktion `menue` (Esc, Gamepad Start) aus `spieler/eingabe.ts`; `key` bleibt als Rückfall.
    const auf = (e: KeyboardEvent) => { if (e.key === 'Escape' || aktionenVon(e.code).includes('menue')) p.onSchliessen(); };
    window.addEventListener('keydown', auf);
    return () => window.removeEventListener('keydown', auf);
  }, [p.onSchliessen]);

  return (
    <div style={{
      // z-60, nicht 40: Die Bildratenanzeige in `main.tsx` liegt auf **50** (sie
      // muss im Kampf über der Gegnerkarte stehen) und lag damit quer über der
      // Reiterzeile. Der Kampfbildschirm liegt auf 40 — das Menü darf ihn nicht
      // verdecken, tut es aber auch nicht: Im Kampf gibt es keinen Menüknopf.
      position: 'fixed', inset: 0, zIndex: 60, background: FARBE.grund,
      display: 'flex', flexDirection: 'column',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {/* Kopfzeile: Reiter links, Schliessen rechts. Schliessen ist immer an
          derselben Stelle — in einem Menü, das man mitten im Gelände aufmacht,
          ist der schnelle Rückweg die wichtigste Taste. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px',
        borderBottom: `1px solid ${FARBE.rand}`, flexWrap: 'wrap',
      }}>
        {REITER.map(([id, text]) => (
          <button key={id} onClick={() => setReiter(id)}
            style={{
              minHeight: 34, padding: '4px 11px', borderRadius: 7, fontSize: 12,
              background: reiter === id ? '#1f2b27' : 'transparent',
              border: `1px solid ${reiter === id ? FARBE.rand : 'transparent'}`,
              color: reiter === id ? FARBE.akzent : FARBE.matt,
            }}>{text}</button>
        ))}
        {p.onRichtung && <button onClick={() => p.onRichtung!(!p.richtung)}
          title="Richtungskampf: Block und Angriff in vier Linien (ADR-0009)" style={{
          minHeight: 34, padding: '4px 11px', borderRadius: 7, fontSize: 12, marginLeft: 'auto',
          background: 'transparent', border: `1px solid ${FARBE.rand}`, color: p.richtung ? FARBE.akzent : FARBE.matt,
        }}>Richtung {p.richtung ? 'an' : 'aus'}</button>}
        {p.onFigur && <button onClick={p.onFigur} style={{
          minHeight: 34, padding: '4px 11px', borderRadius: 7, fontSize: 12, marginLeft: p.onRichtung ? 0 : 'auto',
          background: 'transparent', border: '1px solid transparent', color: FARBE.matt,
        }}>Figur</button>}
        <button onClick={p.onSchliessen} style={{
          marginLeft: p.onFigur || p.onRichtung ? 0 : 'auto', minHeight: 34, minWidth: 44, borderRadius: 7,
          background: 'transparent', border: `1px solid ${FARBE.rand}`,
          color: FARBE.text, fontSize: 15,
        }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
        {reiter === 'karte' && <KartenReiter {...p} />}
        {reiter === 'beutel' && <BeutelReiter {...p} />}
        {reiter === 'heft' && <Heft {...p} />}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Karte

function KartenReiter(p: MenueProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [kante, setKante] = useState(320);

  const marken = useMemo<Kartenmarke[]>(() => {
    const m: Kartenmarke[] = [];
    // Nur **besuchte** Orte und **gelesene** Fundstücke. Eine Karte, die alles
    // verrät, ersetzt das Suchen; eine, die nichts zeigt, ersetzt gar nichts.
    for (const id of p.besuchteOrte) {
      const o = ORTE.get(id);
      if (!o) continue;
      const [x, z] = nachMetern(o.ort, p.welt.bbox);
      m.push({ x, z, art: o.art === 'zuflucht' ? 'zuflucht' : 'ort', name: o.name });
    }
    for (const id of p.fragmente) {
      const f = FRAGMENTE.get(id);
      if (!f) continue;
      const [x, z] = nachMetern(f.ort, p.welt.bbox);
      m.push({ x, z, art: 'fund', name: f.titel });
    }
    if (p.ziel) m.push({ x: p.ziel.x, z: p.ziel.z, art: 'ziel', name: p.ziel.name });
    m.push({ x: p.spieler[0], z: p.spieler[1], art: 'spieler' });
    return m;
  }, [p.besuchteOrte, p.fragmente, p.ziel, p.spieler, p.welt.bbox]);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const px = Math.round(kante * dpr);
    c.width = px; c.height = px;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const { breiteMeter, tiefeMeter } = zeichneKarte(ctx, p.welt, px);
    zeichneMarken(ctx, marken, px, breiteMeter, tiefeMeter);
  }, [p.welt, marken, kante]);

  useEffect(() => {
    const messe = () => setKante(Math.min(window.innerWidth - 28, window.innerHeight - 150, 460));
    messe();
    window.addEventListener('resize', messe);
    return () => window.removeEventListener('resize', messe);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <canvas ref={canvas} style={{
        width: kante, height: kante, borderRadius: 8, border: `1px solid ${FARBE.rand}`,
      }} />
      <div style={{
        display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center',
        fontSize: 11, color: FARBE.matt,
      }}>
        <Legende farbe="#3fd9a0" text="du" />
        <Legende farbe="#7fc8a0" text="Zuflucht" />
        <Legende farbe="#c8a86b" text="Ort" />
        <Legende farbe="#8a93c8" text={`Fundstück (${p.fragmente.length} von ${FRAGMENTE.size})`} />
        {p.ziel && <Legende farbe="#e0743f" text={p.ziel.name} />}
      </div>
      <div style={{ fontSize: 11, color: FARBE.aus, textAlign: 'center', maxWidth: 380 }}>
        Eingezeichnet ist nur, was du selbst gefunden hast. Kein Schnellreisen —
        der Weg ist die Region.
      </div>
    </div>
  );
}

const Legende = ({ farbe, text }: { farbe: string; text: string }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
    <span style={{ width: 8, height: 8, borderRadius: 4, background: farbe }} />{text}
  </span>
);

// ----------------------------------------------------------------- Beutel

function BeutelReiter(p: MenueProps) {
  const vorrat = Object.entries(p.beutel).filter(([id, n]) => n > 0 && GEGENSTAENDE.has(id));
  return (
    <Abschnitt titel="Gegenstände">
      {vorrat.length === 0 && <Leer text="Der Beutel ist leer." />}
      {vorrat.map(([id, n]) => {
        const g = GEGENSTAENDE.get(id)!;
        return (
          <div key={id} style={{ border: `1px solid ${FARBE.rand}`, borderRadius: 8, padding: 9, background: FARBE.feld }}>
            <div style={{ fontSize: 13 }}>{g.name} <span style={{ color: FARBE.matt }}>×{n}</span></div>
            <div style={{ fontSize: 11, color: FARBE.matt, marginTop: 2 }}>{g.beschreibung}</div>
          </div>
        );
      })}
    </Abschnitt>
  );
}

function Heft(p: MenueProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Abschnitt titel={`Fundstücke — ${p.fragmente.length} von ${FRAGMENTE.size}`}>
        {p.fragmente.length === 0 && <Leer text="Noch nichts gefunden." />}
        {p.fragmente.map(id => {
          const f = FRAGMENTE.get(id);
          if (!f) return null;
          return (
            <details key={id} style={{
              border: `1px solid ${FARBE.rand}`, borderRadius: 8,
              padding: '7px 9px', background: FARBE.feld,
            }}>
              <summary style={{ fontSize: 12, color: FARBE.text, cursor: 'pointer', minHeight: 24 }}>
                {f.titel}
              </summary>
              <div style={{ fontSize: 12, color: FARBE.matt, marginTop: 6, lineHeight: 1.5 }}>
                {f.text}
              </div>
            </details>
          );
        })}
      </Abschnitt>
      <Herkunft />
    </div>
  );
}

/** Lizenznachweise stehen offline im Heft bereit. */
function Herkunft() {
  const [offen, setOffen] = useState(false);
  const liste: { rolle: string; autor: string; lizenz: string; quelle: string }[] = HERKUNFT;
  return (
    <div style={{ marginTop: 10, borderTop: `1px solid ${FARBE.rand}`, paddingTop: 8 }}>
      <button onClick={() => setOffen(o => !o)} style={{
        background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
        fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', color: FARBE.aus,
      }}>
        {offen ? '▾' : '▸'} Herkunft der Modelle
      </button>
      {offen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6, fontSize: 11, color: FARBE.matt }}>
          {liste.map(e => (
            <div key={e.rolle}>
              <span style={{ color: FARBE.text }}>{e.rolle}</span> — {e.autor}, {e.lizenz}
              <span style={{ color: FARBE.aus }}> · {e.quelle.split(',')[0]}</span>
            </div>
          ))}
          <div style={{ color: FARBE.aus, marginTop: 4 }}>
            Alle Modelle bearbeitet: Farbe an den Vertex, Leuchtdichte in die Palette, gedreht und genormt.
            Häuser, Pflanzen, Felsen und die Figur sind prozedural (BRACHLAND).
            CC BY 3.0: creativecommons.org/licenses/by/3.0
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- Bausteine

const Abschnitt = ({ titel, children }: { titel: string; children: React.ReactNode }) => (
  <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <h2 style={{
      margin: 0, fontSize: 11, fontWeight: 500, letterSpacing: 0.4,
      textTransform: 'uppercase', color: FARBE.aus,
    }}>{titel}</h2>
    {children}
  </section>
);

const Leer = ({ text }: { text: string }) => (
  <div style={{ fontSize: 12, color: FARBE.aus, padding: '4px 0' }}>{text}</div>
);
