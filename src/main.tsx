import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Weltdaten } from './world/osm.js';
import { RegionsSzene, STIMMUNG, type StimmungsName } from './scenes/RegionsSzene.js';

function App() {
  const [welt, setWelt] = useState<Weltdaten | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [stimmung, setStimmung] = useState<StimmungsName>('daemmerung');

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
      <RegionsSzene welt={welt} stimmung={stimmung} />
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
    </>
  );
}

const Hinweis = ({ text }: { text: string }) => (
  <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 24,
                textAlign: 'center', color: '#7d8b85', fontSize: 14 }}>{text}</div>
);

createRoot(document.getElementById('app')!).render(<StrictMode><App /></StrictMode>);
