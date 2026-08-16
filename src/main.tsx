import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Weltdaten } from './world/osm.js';
import { RegionsSzene, STIMMUNG, type StimmungsName, type Messwerte } from './scenes/RegionsSzene.js';

function App() {
  const [welt, setWelt] = useState<Weltdaten | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [stimmung, setStimmung] = useState<StimmungsName>('daemmerung');
  const [messung, setMessung] = useState<Messwerte | null>(null);

  useEffect(() => {
    fetch('/world/oental.json')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => setWelt(d.welt))
      .catch(e => setFehler(String(e)));
  }, []);

  if (fehler) return <Hinweis text={`Weltdaten fehlen: ${fehler} — erst "npm run world oental 96" ausführen.`} />;
  if (!welt) return <Hinweis text="Œntal wird geladen …" />;

  return (
    <>
      <RegionsSzene welt={welt} stimmung={stimmung} onMessung={setMessung} />
      <div style={{
        position: 'fixed', top: 'env(safe-area-inset-top, 8px)', left: 8,
        display: 'flex', gap: 6, zIndex: 10,
      }}>
        {(Object.keys(STIMMUNG) as StimmungsName[]).map(s => (
          <button key={s} onClick={() => setStimmung(s)} style={{
            minHeight: 34, padding: '4px 10px', borderRadius: 8, fontSize: 12,
            background: s === stimmung ? '#1f2b27' : 'transparent',
            border: '1px solid #2a3632', color: s === stimmung ? '#3fd9a0' : '#7d8b85',
          }}>{s}</button>
        ))}
      </div>

      {/* Messwerte vom echten Gerät — die Grundlage, um das Dreiecksbudget zu belegen
          statt es zu behaupten. */}
      {messung && (
        <div style={{
          position: 'fixed', top: 'env(safe-area-inset-top, 8px)', right: 8, zIndex: 10,
          fontFamily: 'ui-monospace, monospace', fontSize: 11, lineHeight: 1.5,
          color: messung.bps < 30 ? '#d98b6b' : '#5c8f76', textAlign: 'right',
          background: '#0d121099', padding: '4px 7px', borderRadius: 6,
          pointerEvents: 'none',
        }}>
          {messung.bps.toFixed(0)} B/s<br />
          {Math.round(messung.dreiecke).toLocaleString('de')} Dreiecke<br />
          {messung.aufrufe} Aufrufe
        </div>
      )}

      {/* Ohne Hinweis findet niemand die Touch-Steuerung — sie ist unsichtbar. */}
      <div style={{
        position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 8px) + 8px)', left: 0, right: 0,
        textAlign: 'center', pointerEvents: 'none', zIndex: 10,
        color: '#5c6b64', fontSize: 11, letterSpacing: 0.2,
      }}>
        links wischen = gehen · rechts wischen = umsehen · WASD + Ziehen am Rechner
      </div>
    </>
  );
}

const Hinweis = ({ text }: { text: string }) => (
  <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 24,
                textAlign: 'center', color: '#7d8b85', fontSize: 14 }}>{text}</div>
);

createRoot(document.getElementById('app')!).render(<StrictMode><App /></StrictMode>);
