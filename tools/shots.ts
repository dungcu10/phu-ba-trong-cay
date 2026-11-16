// Chụp màn hình bản build (vite preview) ở khung iPad Pro 11" ngang, để tự kiểm bằng mắt.
// Chạy: npm run build && npx tsx tools/shots.ts <thư-mục-ra> [kịch-bản]
// Kịch bản: "basic" (mặc định) — vào game, tua giờ, chụp vườn, chụp từng bảng.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'shots';
const PORT = 4181;
mkdirSync(out, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
for (let i = 0; i < 50; i++) {
  try {
    if ((await fetch(`http://localhost:${PORT}/`)).ok) break;
  } catch {
    await new Promise((r) => setTimeout(r, 200));
  }
}
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1194, height: 834 }, deviceScaleFactor: 1 });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.stack ?? e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`http://localhost:${PORT}/?dev=1&renderer=webgl`);
await page.waitForFunction(() => (window as unknown as { __pbtc?: unknown }).__pbtc, null, { timeout: 30_000 });
await page.waitForTimeout(1500);
const shot = async (name: string) => page.screenshot({ path: `${out}/${name}.png` });
await shot('01-vao-game');

// Kịch bản riêng của khu vườn mẫu (nếu có): window.__pbtc.demo?.(name)
const demo = await page.evaluate(() => typeof (window as unknown as { __pbtc: { demo?: unknown } }).__pbtc.demo === 'function');
if (demo) {
  for (const step of (process.argv[3] ?? 'garden,grown,tray,floor2,floor-info,shop,missions,neighbors,visit,home').split(',')) {
    const ok = await page.evaluate((s) => (window as unknown as { __pbtc: { demo: (s: string) => boolean } }).__pbtc.demo(s), step);
    if (!ok) continue;
    await page.waitForTimeout(900);
    await shot(`02-${step}`);
  }
}
console.log(errors.length ? `LỖI:\n${errors.join('\n')}` : 'không có lỗi console');
await browser.close();
server.kill();
