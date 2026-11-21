/** Palette des Flussvaters als JSON für `bau.py` (Blender liest kein TypeScript): `npx tsx tools/flussvater/palette.ts > .cache/flussvater/palette.json`. */
import { PALETTE } from '../../src/world/palette.js';
console.log(JSON.stringify({ wels: PALETTE.wels, befall: PALETTE.befall }));
