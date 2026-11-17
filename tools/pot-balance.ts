// Writes docs/POT_BALANCE.md from the content pack: every level 1–50 of each pot line with stats,
// costs, materials, player level, look, skill and power score. Numbers come from the same code
// the game uses, so the table can never drift from the game. Run: npx tsx tools/pot-balance.ts
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadContentPack, type PotDef, type PotStatName } from '../src/core/content.ts';
import { potLook, powerScore, STAGE_NAMES, stageOf } from '../src/systems/pots.ts';

const dir = join(import.meta.dirname, '..', 'content', 'base');
const content = await loadContentPack(async (f) => JSON.parse(await readFile(join(dir, f), 'utf8')));
const STAT: Record<PotStatName, string> = { speed: 'Lớn nhanh', yield: 'Sản lượng', xp: 'Kinh nghiệm', luck: 'May mắn', attract: 'Hút bọ', care: 'Chăm sóc' };
const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
const item = (id: string) => content.items.get(id)?.name.vi ?? id;
const LINES = ['base:pot.terracotta', 'base:pot.bronze-tripod', 'base:pot.jade-lotus'];

function table(def: PotDef): string {
  const stats = [...new Set(def.levels.flatMap((l) => Object.keys(l.stats)))] as PotStatName[];
  const head = `| Cấp | Giai đoạn | ${stats.map((s) => STAT[s]).join(' | ')} | Xu | Nguyên liệu | Cấp người chơi | Ngoại hình | Kỹ năng mở | Điểm sức mạnh |`;
  const sep = `|${'---|'.repeat(stats.length + 8)}`;
  let coins = 0;
  const rows = def.levels.map((l) => {
    const c = l.upgradeCost;
    coins += c?.coins ?? 0;
    const { look, step } = potLook(def, l.level);
    const lookText = look ? (step === 0 ? `**${look.name.vi}** (mới)` : `${look.name.vi} +${step}`) : '—';
    const skill = def.skills.filter((s) => s.level === l.level).map((s) => `**${s.name.vi}**`).join(', ');
    const open = l.level <= def.openTo ? '' : ' 🔒';
    return `| ${l.level}${open} | ${STAGE_NAMES[stageOf(l.level)]} | ${stats.map((s) => pct(l.stats[s] ?? 0)).join(' | ')} | ${c ? c.coins.toLocaleString('vi') : '—'} | ${c ? Object.entries(c.items).map(([id, q]) => `${q} ${item(id)}`).join(', ') : '—'} | ${def.levelReq[l.level - 1]} | ${lookText} | ${skill} | ${powerScore(def, l.level)} |`;
  });
  const totals: Record<string, number> = {};
  for (const l of def.levels) for (const [id, q] of Object.entries(l.upgradeCost?.items ?? {})) totals[id] = (totals[id] ?? 0) + q;
  const sum = `Tổng chi phí cấp 1→${def.levels.length}: **${coins.toLocaleString('vi')} xu**, ${Object.entries(totals).map(([id, q]) => `${q} ${item(id)}`).join(', ')}.`;
  return [head, sep, ...rows, '', sum].join('\n');
}

const parts = [
  '# Bảng cân bằng chậu 50 cấp (sinh tự động)',
  '',
  '> Sinh bởi `npx tsx tools/pot-balance.ts` từ `content/base/pots.json`. Không sửa tay. 🔒 = cấp đã thiết kế, chưa mở trong bản này.',
  '> Điểm sức mạnh = Lớn nhanh×1 + Sản lượng×1 + Kinh nghiệm×0,6 + May mắn×0,5 + Hút bọ×0,3 + Chăm sóc×0,3 + kỹ năng (gấp đôi = cơ hội; Biến Dị ≈ 0,03×(hệ số−1)).',
  '',
  '## So sánh nhanh',
  '',
  '| Dòng | Nguồn | Hướng | Cấp 1 | Cấp 10 | Cấp 25 | Cấp 50 |',
  '|---|---|---|---|---|---|---|',
  ...LINES.map((id) => {
    const d = content.pots.get(id)!;
    return `| ${d.name.vi} | ${d.source?.vi ?? ''} | ${STAT[d.focus ?? 'speed']} | ${[1, 10, 25, 50].map((l) => powerScore(d, l)).join(' | ')} |`;
  }),
  '',
  ...LINES.flatMap((id) => {
    const d = content.pots.get(id)!;
    return [`## ${d.name.vi}`, '', d.description?.vi ?? '', '', `Kỹ năng: ${d.skills.map((s) => `cấp ${s.level} **${s.name.vi}** — ${s.desc.vi}`).join('; ')}`, '', table(d), ''];
  }),
];
// Directive 05: the 50 signature pots (shop), one row each. Full level tables follow the same
// growth rules as above; see tools/signature-balance.ts for how they are solved.
const RARITY: Record<string, string> = { common: 'Thường', good: 'Tốt', rare: 'Hiếm', epic: 'Sử Thi', legendary: 'Huyền Thoại' };
const sig = content.potList.filter((d) => d.id.startsWith('base:pot.sig-'));
const toTen = (d: PotDef) => d.levels.slice(1, 10).reduce((a, l) => a + (l.upgradeCost?.coins ?? 0), 0);
parts.push(
  '## 50 chậu đặc trưng (chỉ thị 05)',
  '',
  `Đất Nung (thường) để so: cấp 10 = ${powerScore(content.pots.get(LINES[0]!)!, 10)}, cấp 25 = ${powerScore(content.pots.get(LINES[0]!)!, 25)}, cấp 50 = ${powerScore(content.pots.get(LINES[0]!)!, 50)}. Mở tới cấp 10 trong bản này.`,
  '',
  '| # | Chậu | Nhóm | Độ hiếm | Hướng | Giá | Cấp mở | Xu nâng 1→10 | Cấp 1 | Cấp 10 | Cấp 25 | Cấp 50 | Kỹ năng (10 / 25 / 50) |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...sig.map((d, i) => `| ${i + 1} | ${d.name.vi} | ${d.theme ?? ''} | ${RARITY[d.rarity] ?? d.rarity} | ${STAT[d.focus ?? 'speed']} | ${(d.price ?? 0).toLocaleString('vi')} | ${d.unlockLevel} | ${toTen(d).toLocaleString('vi')} | ${[1, 10, 25, 50].map((l) => powerScore(d, l)).join(' | ')} | ${d.skills.map((s) => `${s.name.vi}: ${s.desc.vi}`).join(' / ')} |`),
  '',
);
await writeFile(join(import.meta.dirname, '..', 'docs', 'POT_BALANCE.md'), parts.join('\n'));
console.log('đã ghi docs/POT_BALANCE.md');
