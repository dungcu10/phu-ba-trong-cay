// GAME_SYSTEMS.md § 6: the one gate. Runs typecheck, every test, the content check, the build and a
// quick simulation (one player style: a visit every 2 hours, 30 days), prints the metric table and
// fails when a step fails or a blocking metric is out of range.
//
// Which metrics block is set in tools/check-metrics.json: a metric whose directive has not been
// reached yet only warns (GAME_SYSTEMS § 6: "in cảnh báo, không chặn").
// Run: npm run check   (add --quick to skip the test suite, for a fast look at the metrics)

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { simulateProgression } from './progression.ts';
import { loadBase } from '../tests/helpers.ts';

type Metric = { id: string; label: string; min: number; max: number; block: boolean };
const metrics = JSON.parse(readFileSync(join(import.meta.dirname, 'check-metrics.json'), 'utf8')) as { visitMinutes: number; days: number; metrics: Metric[] };
const quick = process.argv.includes('--quick');

let failed = false;
const step = (name: string, cmd: string, args: string[]) => {
  const t = Date.now();
  const r = spawnSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', shell: false });
  const ok = r.status === 0;
  console.log(`${ok ? '✓' : '✗'} ${name} (${Math.round((Date.now() - t) / 1000)} s)`);
  if (!ok) {
    failed = true;
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    const lines = out.split('\n').filter((l) => /^not ok|error|Error|expected|actual|✗|problem/i.test(l)).slice(0, 30);
    console.log((lines.length ? lines : out.split('\n').slice(-30)).map((l) => `    ${l}`).join('\n'));
  }
};

step('typecheck', 'npx', ['tsc', '--noEmit', '-p', '.']);
if (!quick) step('test', 'npx', ['tsx', '--test', ...readTests()]);
step('validate-content', 'npx', ['tsx', 'tools/validate-content.ts']);
step('build', 'npx', ['vite', 'build', '--logLevel', 'error']);

const content = await loadBase();
const t = Date.now();
const { days, coinFlow } = simulateProgression(content, metrics.visitMinutes, metrics.days);
console.log(`✓ mô phỏng ${metrics.days} ngày, ${metrics.visitMinutes} phút/lần (${Math.round((Date.now() - t) / 1000)} s)\n`);

const at = (n: number) => days[Math.min(n, days.length) - 1]!;
// Rare outcomes (a Rất hiếm bug, a signature pot) are a handful per run: average 4 seeds (CTO 18/11).
let seedCache: (typeof days)[] | null = null;
const seedRuns = () => (seedCache ??= [42, 7, 99, 1234].map((seed) => (seed === 42 ? days : simulateProgression(content, metrics.visitMinutes, 30, seed).days)));
const span = (from: number, to: number) => days.slice(from - 1, to);
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const value: Record<string, () => number[]> = {
  level1: () => [at(1).level],
  level7: () => [at(7).level],
  level30: () => [at(30).level],
  milestonesPerDay: () => span(10, 30).map((d) => d.milestones),
  coinsPerUnit: () => days.map((d) => d.coins / d.unit),
  storageSpendShare: () => {
    const spent = Object.values(coinFlow).filter((v) => v < 0).reduce((a, v) => a - v, 0);
    return [spent > 0 ? -(coinFlow.upgradeStorage ?? 0) / spent : 0];
  },
  bazaarSpendShare: () => {
    const spent = Object.values(coinFlow).filter((v) => v < 0).reduce((a, v) => a - v, 0);
    return [spent > 0 ? -((coinFlow.rerollBazaar ?? 0) + (coinFlow.buyBazaar ?? 0)) / spent : 0];
  },
  giftsPerDay: () => [avg(span(7, 30).map((d) => d.gifts))],
  coinsDaysIncome: () => span(3, 30).map((d) => d.coins / Math.max(1, d.income)),
  commonBugsPerDay: () => span(7, 30).map((d) => d.bugsByRarity.common ?? 0),
  commonBugsPerPot: () => [avg(span(7, 30).map((d) => d.commonBugsPerPot))],
  bugStockDays: () => [at(30).bugStock / Math.max(1, avg(span(24, 30).map((d) => Object.values(d.bugsByRarity).reduce((a, q) => a + q, 0))))],
  // A Rất hiếm bug is ~1 per 4 days, so one run sees only a handful: average 4 seeds (CTO 18/11).
  epicBugsPerDay: () => [avg(seedRuns().map((run) => avg(run.slice(6, 30).map((d) => d.bugsByRarity.epic ?? 0))))],
  signaturePots30: () => [avg(seedRuns().map((run) => run[29]!.signaturePots))],
  storageFullShare: () => [avg(days.map((d) => d.storageFullShare))],
  ordersPerDay: () => [avg(span(3, 30).map((d) => d.ordersDelivered))],
};
const fmt = (n: number) => (Math.abs(n) >= 100 ? Math.round(n).toLocaleString('vi-VN') : n.toFixed(Number.isInteger(n) ? 0 : 2));
console.log('| Chỉ số | Khoảng đạt | Đo được | Kết quả |\n|---|---|---|---|');
for (const m of metrics.metrics) {
  const xs = value[m.id]?.() ?? [];
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const ok = xs.length > 0 && lo >= m.min && hi <= m.max;
  const shown = lo === hi ? fmt(lo) : `${fmt(lo)} – ${fmt(hi)}`;
  const verdict = ok ? 'đạt' : m.block ? 'TRƯỢT (chặn)' : 'ngoài khoảng (cảnh báo)';
  if (!ok && m.block) failed = true;
  console.log(`| ${m.label} | ${fmt(m.min)} – ${fmt(m.max)} | ${shown} | ${verdict} |`);
}
console.log(failed ? '\nCHECK: TRƯỢT' : '\nCHECK: XANH');
process.exit(failed ? 1 : 0);

function readTests(): string[] {
  const dir = join(import.meta.dirname, '..', 'tests');
  return spawnSync('ls', [dir], { encoding: 'utf8' }).stdout.split('\n').filter((f) => f.endsWith('.test.ts')).map((f) => join('tests', f));
}
