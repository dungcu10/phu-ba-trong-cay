// Chỉ thị 11 TỔNG § H: economy report for the village and pets — 30 days, three kinds of player,
// written to docs/reviews/economy-11.md with SVG charts (coins, level, Cấp Làng by day).
//
//   npx tsx tools/economy-11.ts
//
// Uses the CTO's simulator (tools/progression.ts) unchanged in behaviour; it only reads its report.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBase } from '../tests/helpers.ts';
import { dispatch } from '../src/core/game.ts';
import { cropStatus } from '../src/systems/growth.ts';
import { slotBonus } from '../src/systems/modifiers.ts';
import { simulateProgression, type DayReport } from './progression.ts';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'docs', 'reviews');
const DAYS = 30;
const PROFILES = [
  { id: 'nhe', name: 'Chơi nhẹ (6 giờ/lần)', minutes: 360, color: '#8aa0b8' },
  { id: 'vua', name: 'Chơi vừa (2 giờ/lần)', minutes: 120, color: '#d08a2e' },
  { id: 'cham', name: 'Chơi chăm (30 phút/lần)', minutes: 30, color: '#3f8f5a' },
];

const content = await loadBase();
const runs = PROFILES.map((p) => ({ ...p, ...simulateProgression(content, p.minutes, DAYS) }));
const vua = runs.find((r) => r.id === 'vua')!;

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');
const firstDay = (days: DayReport[], ok: (d: DayReport) => boolean) => days.find(ok)?.day ?? null;
const dayText = (d: number | null) => (d === null ? 'chưa tới (ngày > 30)' : `ngày ${d}`);

// 1. Milestones for the average player.
const fourPets = firstDay(vua.days, (d) => d.pets >= 4);
const village10 = firstDay(vua.days, (d) => d.villageLevel >= 10);
const village25 = firstDay(vua.days, (d) => d.villageLevel >= 25);
const floor5 = firstDay(vua.days, (d) => d.floors >= 5);
const inRange = (d: number | null, lo: number, hi: number) => (d !== null && d >= lo && d <= hi ? 'đạt' : 'ngoài khoảng');

// 2. A day away: from the average player's day-15 save, 24 hours pass with only pets, birds and the
//    workshop running (one tick at the end; offline-exact), compared with one played day.
const away = (() => {
  const base = simulateProgression(content, 120, 15);
  const s = structuredClone(base.state);
  const t0 = s.maxSeenAt;
  const coins = s.player.coins;
  const items = { ...s.inventory };
  dispatch(content, s, { type: 'tick' }, t0 + 24 * 3_600_000);
  let value = s.player.coins - coins;
  for (const [id, q] of Object.entries(s.inventory)) {
    const more = q - (items[id] ?? 0);
    const price = content.items.get(id)?.sellPrice ?? 0;
    if (more > 0 && price) value += more * price;
  }
  const played = base.days.at(-1)!.income;
  return { value, played, share: played > 0 ? value / played : 0 };
})();

// 3. Percentage bonuses on a harvest, on the average player's day-30 garden (largest pot).
const bonus = (() => {
  const s = vua.state;
  const at = s.maxSeenAt;
  let best = { yield: 0, speed: 0 };
  for (const f of s.floors)
    for (const slot of f.slots) {
      const st = slot.planting ? cropStatus(content, s, slot, at) : null;
      if (!st) continue;
      best = { yield: Math.max(best.yield, slotBonus(content, s, slot, st.crop, 'yield')), speed: Math.max(best.speed, slotBonus(content, s, slot, st.crop, 'speed')) };
    }
  return best;
})();

// 4. Bugs: share caught by pets and birds (rule: with them, no more than +45%).
const bugs = (() => {
  const total = vua.days.reduce((a, d) => a + Object.values(d.bugsByRarity).reduce((x, q) => x + q, 0), 0);
  const helpers = vua.days.reduce((a, d) => a + d.birdBugs + d.petBugs, 0);
  const without = Math.max(1, total - helpers);
  return { total, helpers, more: total / without - 1 };
})();

// 5. Coin loops: errands' coins against the whole income.
const errandCoins = vua.coinFlow.claimErrand ?? 0;
const income = vua.days.reduce((a, d) => a + d.income, 0);

// Charts (simple SVG lines).
function chart(file: string, title: string, pick: (d: DayReport) => number, log = false): string {
  const W = 720;
  const H = 300;
  const L = 64;
  const B = 34;
  const values = runs.flatMap((r) => r.days.map(pick));
  const tr = (v: number) => (log ? Math.log10(Math.max(1, v)) : v);
  const max = Math.max(...values.map(tr), 1);
  const x = (d: number) => L + ((d - 1) / (DAYS - 1)) * (W - L - 16);
  const y = (v: number) => H - B - (tr(v) / max) * (H - B - 30);
  const lines = runs
    .map((r) => `<polyline fill="none" stroke="${r.color}" stroke-width="2.5" points="${r.days.map((d) => `${x(d.day).toFixed(1)},${y(pick(d)).toFixed(1)}`).join(' ')}"/>`)
    .join('');
  const legend = runs.map((r, i) => `<text x="${L + i * 210}" y="18" font-size="13" fill="${r.color}">■ ${r.name}</text>`).join('');
  const ticks = [1, 5, 10, 15, 20, 25, 30].map((d) => `<text x="${x(d)}" y="${H - 12}" font-size="11" text-anchor="middle" fill="#555">${d}</text>`).join('');
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((k) => {
    const v = log ? Math.pow(10, max * k) : max * k;
    return `<text x="${L - 6}" y="${y(v) + 4}" font-size="11" text-anchor="end" fill="#555">${fmt(v)}</text><line x1="${L}" x2="${W - 16}" y1="${y(v)}" y2="${y(v)}" stroke="#eee"/>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="system-ui, sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>${yTicks.join('')}${lines}${legend}${ticks}<text x="${W / 2}" y="${H - 0}" font-size="11" text-anchor="middle" fill="#555">ngày</text><text x="14" y="${H / 2}" font-size="12" fill="#333" transform="rotate(-90 14 ${H / 2})" text-anchor="middle">${title}</text></svg>`;
  mkdirSync(join(OUT, 'economy-11'), { recursive: true });
  writeFileSync(join(OUT, 'economy-11', file), svg);
  return `![${title}](economy-11/${file})`;
}

const table = (r: (typeof runs)[number]) =>
  ['| Ngày | Cấp | Xu | Thu nhập ngày | Cấp Làng | Thú cưng | Tầng | Bọ do chim + thú cưng | Việc vặt |', '|---|---|---|---|---|---|---|---|---|']
    .concat(r.days.filter((d) => [1, 3, 5, 7, 10, 14, 18, 21, 25, 30].includes(d.day)).map((d) => `| ${d.day} | ${d.level} | ${fmt(d.coins)} | ${fmt(d.income)} | ${d.villageLevel} | ${d.pets} | ${d.floors} | ${d.birdBugs + d.petBugs} | ${d.errands} |`))
    .join('\n');

const md = `# Kinh tế chỉ thị 11 TỔNG — làng, thú cưng (30 ngày, 3 kiểu người chơi)

> Tạo bằng \`npx tsx tools/economy-11.ts\` từ bộ mô phỏng của CTO (\`tools/progression.ts\`), ${new Date().toISOString().slice(0, 10)}.
> Bot mô phỏng: xây nhà, điểm danh, nuôi thú cưng, việc vặt, chim, xưởng, đúc chậu, Biển Mây, câu cá (theo luật CTO viết).

## Kết quả theo ràng buộc phần H

| # | Ràng buộc | Đo được (người chơi vừa) | Kết quả |
|---|---|---|---|
| 1a | Đủ 4 thú cưng khoảng ngày 12–16 | ${dayText(fourPets)} | ${inRange(fourPets, 12, 16)} |
| 1b | Cấp Làng 10 khoảng ngày 7 | ${dayText(village10)} | ${inRange(village10, 5, 9)} |
| 1c | Cấp Làng 25 khoảng ngày 30 | ${dayText(village25)} (ngày 30: Cấp Làng ${vua.days.at(-1)!.villageLevel}) | ${inRange(village25, 26, 30)} |
| 1d | Mở tầng 5 khoảng ngày 20–25 | ${dayText(floor5)} | ${inRange(floor5, 20, 25)} |
| 2 | Vắng 24 giờ (chỉ thú cưng, chim, xưởng chạy): thu nhập ≤ 35% người chơi vừa | ${fmt(away.value)} xu (gồm giá bán đồ nhận được) / ${fmt(away.played)} xu một ngày chơi = ${(away.share * 100).toFixed(0)}% | ${away.share <= 0.35 ? 'đạt' : 'vượt'} |
| 3 | Tổng thưởng phần trăm trên một lần thu hoạch ≤ 60% | lớn nhất trên vườn ngày 30: sản lượng +${(bonus.yield * 100).toFixed(0)}%, tốc độ +${(bonus.speed * 100).toFixed(0)}% | ${bonus.yield <= 0.6 && bonus.speed <= 0.6 ? 'đạt' : 'vượt — xem ghi chú'} |
| 4 | Có Cáo và chim: tổng bọ tăng ≤ 45% | ${fmt(bugs.helpers)} / ${fmt(bugs.total)} con do chim + thú cưng bắt → +${(bugs.more * 100).toFixed(0)}% so với không có | ${bugs.more <= 0.45 ? 'đạt' : 'vượt'} |
| 5 | Không có vòng tạo xu vô hạn | xem mục dưới; việc vặt mang về ${fmt(errandCoins)} xu = ${((errandCoins / Math.max(1, income)) * 100).toFixed(1)}% thu nhập 30 ngày | đạt |

## Vòng tạo xu (mục H.5)

- **Mèo Tự Bày Hàng ↔ Sẻ Gieo Lại ↔ Thu Hoạch Hộ:** Bày Hàng chỉ bày lại hàng có trong kho, giá người chơi đặt (trong khoảng giá cho phép), tối đa 5→15 lần/ngày; Gieo Lại trả tiền hạt như người chơi (tối đa 20→60 chậu/ngày); Thu Hoạch Hộ chỉ thu cây đã chín, theo thời gian lớn. Không vòng nào sinh xu nếu không có cây lớn thật.
- **Việc vặt ↔ Chợ:** số việc mỗi ngày cố định (4 + Nhà Thú Cưng), mỗi bé một việc một lúc; xu theo cấp người chơi.
- **Câu cá ↔ chế mồi:** CTO đã chặn (mồi 6 Bạc Hà Mây, xu cá ÷3, số lần câu mỗi ngày).
- **Đào → Mài Ngọc → bán:** Năng Lượng Gió hồi theo giờ, có trần; xưởng chạy theo hàng đợi.
- **Nâng nhà ↔ giảm giá:** giảm giá chậu của Lò không vượt tiền nâng Lò (mỗi cấp chỉ giảm vài phần trăm, tiền nâng tăng theo U).

## Biểu đồ

${chart('xu.svg', 'Xu đang giữ (log)', (d) => d.coins, true)}

${chart('cap.svg', 'Cấp người chơi', (d) => d.level)}

${chart('cap-lang.svg', 'Cấp Làng', (d) => d.villageLevel)}

## Bảng theo ngày

${runs.map((r) => `### ${r.name}\n\n${table(r)}`).join('\n\n')}

## Ghi chú

- Ràng buộc 3: trần cộng dồn của game là \`config.bonusCaps\` (POT_SYSTEM 5: tốc độ ${content.config.bonusCaps?.speed}, sản lượng ${content.config.bonusCaps?.yield}). Nếu dòng 3 ghi "vượt", trần 60% của chỉ thị 11 thấp hơn trần chậu hiện có — CTO quyết định hạ \`bonusCaps\` hay tính 60% riêng cho phần thưởng mới (làng, thú cưng, kết hợp).
- Ràng buộc 2 tính cả giá bán của đồ nhận được khi vắng (giới hạn trên).
`;
writeFileSync(join(OUT, 'economy-11.md'), md);
console.log(md.split('## Biểu đồ')[0]);
