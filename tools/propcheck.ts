/** Prop-Modelle inventarisieren: Dreiecke, Größe, Maßstabskorrektur. */
import { readdirSync, statSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';

/** Reale Zielhöhen in Metern — Kenney-Modelle sind in Blockeinheiten. */
export const ZIELHOEHE: Record<string, number> = {
  nadelbaum: 22, laubbaum: 14, busch: 1.3, findling: 1.1, totholz: 0.9, grasbuschel: 0.35,
};

const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
let gesamtTris = 0, gesamtKB = 0;
console.log(`${'Datei'.padEnd(18)} ${'Tris'.padStart(6)} ${'KB'.padStart(6)}  Rohhöhe → Skalierung auf real`);
console.log('-'.repeat(74));

for (const f of readdirSync('assets/props').filter(f => f.endsWith('.glb')).sort()) {
  const doc = await io.read(`assets/props/${f}`);
  let tris = 0;
  let minY = Infinity, maxY = -Infinity;
  for (const m of doc.getRoot().listMeshes()) {
    for (const p of m.listPrimitives()) {
      const idx = p.getIndices();
      const pos = p.getAttribute('POSITION')!;
      tris += idx ? idx.getCount() / 3 : pos.getCount() / 3;
      const el = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, el);
        minY = Math.min(minY, el[1]); maxY = Math.max(maxY, el[1]);
      }
    }
  }
  const roh = maxY - minY;
  const art = f.split('_')[0];
  const skal = (ZIELHOEHE[art] ?? 1) / (roh || 1);
  const kb = statSync(`assets/props/${f}`).size / 1024;
  gesamtTris += tris; gesamtKB += kb;
  console.log(`${f.padEnd(18)} ${String(Math.round(tris)).padStart(6)} ${kb.toFixed(1).padStart(6)}  ${roh.toFixed(2).padStart(5)} → x${skal.toFixed(2)}`);
}
console.log(`\n  ${readdirSync('assets/props').length} Modelle · ${Math.round(gesamtTris).toLocaleString('de')} Dreiecke gesamt · ${gesamtKB.toFixed(0)} KB`);
console.log('  Lizenz: CC0 (Kenney Nature Kit 2.1) — keine Namensnennung nötig, aber fair.');
