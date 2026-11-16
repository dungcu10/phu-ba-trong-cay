// Directive 04 step 3: writes the 50 signature pots into content/base/pots.json.
// - Old catalog pots base:pot.NN-… keep their ids and gain "retired": true (hidden from the shop,
//   still loadable, owned ones keep working).
// - New base:pot.sig-NN-<slug> take name and theme (shop group) from tools/potgen/lines/signature_all.json,
//   sprite "pots/sig/NN", and copy the economy fields of old pot NN exactly (no new numbers).
// Re-running is idempotent. Usage: npx tsx tools/make-signature-pots.mts

import { readFileSync, writeFileSync } from 'node:fs';

const POTS = 'content/base/pots.json';
const LINE = 'tools/potgen/lines/signature_all.json';
const INHERIT = ['rarity', 'price', 'unlockLevel', 'favoredFamily', 'levelRule', 'set', 'group'] as const;

type Pot = Record<string, unknown> & { id: string; sprite: string };
const pots = JSON.parse(readFileSync(POTS, 'utf8')) as Pot[];
const line = JSON.parse(readFileSync(LINE, 'utf8')) as { pots: Array<{ id: number; group: string; name: string }> };

export const slug = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const kept = pots.filter((p) => !p.id.startsWith('base:pot.sig-'));
const old = new Map<number, Pot>();
for (const p of kept) {
  const m = /^pots\/catalog\/(\d+)$/.exec(p.sprite);
  if (!m) continue;
  p.retired = true;
  old.set(Number(m[1]), p);
}
if (old.size !== 50) throw new Error(`cần 50 chậu cũ pots/catalog, thấy ${old.size}`);
if (line.pots.length !== 50) throw new Error(`cần 50 chậu đặc trưng, thấy ${line.pots.length}`);

const sig: Pot[] = line.pots.map((s) => {
  const nn = String(s.id).padStart(2, '0');
  const src = old.get(s.id);
  if (!src) throw new Error(`thiếu chậu cũ số ${nn}`);
  const p: Pot = { id: `base:pot.sig-${nn}-${slug(s.name)}`, name: { vi: s.name }, sprite: `pots/sig/${nn}`, theme: s.group } as Pot;
  for (const k of INHERIT) p[k] = structuredClone(src[k]);
  p.art = { frames: `pots/sig/${nn}/50`, levels: '50 (chỉ có ảnh mốc cấp 50)' };
  return p;
});

writeFileSync(POTS, JSON.stringify([...kept, ...sig], null, 2) + '\n');
console.log(`ok: ${old.size} chậu cũ đánh dấu retired, ${sig.length} chậu đặc trưng`);
