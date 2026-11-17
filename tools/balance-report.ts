// Prints the balance table as Markdown. Run: npx tsx tools/balance-report.ts [output.md]

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadContentPack } from '../src/core/content.ts';
import { balanceTable, bestForCoins, fittingStyle, PLAY_STYLES } from './balance.ts';

const dir = join(import.meta.dirname, '..', 'content', 'base');
const content = await loadContentPack(async (f) => JSON.parse(await readFile(join(dir, f), 'utf8')));
const table = balanceTable(content);
const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

const lines: string[] = [];
lines.push('# Bảng cân bằng — 1 chậu cấp 1, 24 giờ, trung bình 5 hạt giống', '');
lines.push(`Sinh bởi \`npx tsx tools/balance-report.ts\` (content v${content.contentVersion}). Mỗi lần ghé: bắt hết bọ, thu hoạch, bán hết, tưới nếu khát, gieo lại. Xu = tiền bán − tiền hạt.`, '');
for (const style of PLAY_STYLES) {
  const rows = table[style.id]!;
  const best = bestForCoins(rows);
  lines.push(`## ${style.label}`, '', '| Cây | Cấp mở | Xu/giờ | XP/giờ | Bọ/giờ |', '|---|---|---|---|---|');
  for (const r of rows) {
    const mark = r === best ? ' **(nhiều xu nhất)**' : '';
    lines.push(`| ${r.crop.name.vi}${mark} | ${r.crop.unlockLevel} | ${fmt(r.coinsPerHour)} | ${fmt(r.xpPerHour)} | ${fmt(r.bugsPerHour)} |`);
  }
  lines.push('');
}
lines.push('## Kiểu chơi phù hợp từng cây (bọ/giờ trong kiểu đó)', '', '| Cây | Kiểu chơi phù hợp | Bọ/giờ |', '|---|---|---|');
for (const crop of content.cropList) {
  const style = fittingStyle(table, crop.id);
  const row = table[style.id]!.find((r) => r.crop.id === crop.id)!;
  lines.push(`| ${crop.name.vi} | ${style.label} | ${fmt(row.bugsPerHour)} |`);
}
const text = lines.join('\n') + '\n';
const out = process.argv[2];
if (out) await writeFile(out, text);
process.stdout.write(text);
