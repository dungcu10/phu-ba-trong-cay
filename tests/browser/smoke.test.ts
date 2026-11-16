// Browser smoke test on the production build (ACCEPTANCE_CHECKLIST C, steps that can be
// automated off-device): play loop, save in IndexedDB, reload, close tab abruptly, offline.
// Uses the system Chrome (Playwright cannot download browsers here). Safari/iPad still needs
// a real device. Run: npm run test:browser

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

const PORT = 4179;
const URL = `http://localhost:${PORT}/?dev=1&renderer=webgl`;
let server: ChildProcess;
let browser: Browser;

before(async () => {
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`http://localhost:${PORT}/`)).ok) break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
});

after(async () => {
  await browser?.close();
  server?.kill();
});

type Snap = { coins: number; harvests: number; level: number; inv: Record<string, number> };

async function open(ctx: BrowserContext): Promise<{ page: Page; errors: string[] }> {
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(URL);
  await page.waitForFunction(() => (window as unknown as { __pbtc?: unknown }).__pbtc, null, { timeout: 30_000 });
  return { page, errors };
}

const snap = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as { __pbtc: { session: { state: { player: { coins: number; level: number }; stats: { harvests: number }; inventory: Record<string, number> } } } }).__pbtc.session.state;
    return { coins: s.player.coins, harvests: s.stats.harvests, level: s.player.level, inv: { ...s.inventory } } as Snap;
  });

async function playOneRound(page: Page): Promise<void> {
  await page.click('[data-test=open-seeds]');
  await page.click('[data-test="seed-base:crop.cotton-daisy"]');
  await page.click('text=+1 phút');
  await page.waitForTimeout(400);
  await page.mouse.move(200, 470);
  await page.mouse.down();
  for (let x = 200; x <= 1160; x += 20) await page.mouse.move(x, 470);
  await page.mouse.up();
  await page.waitForTimeout(300);
}

test('vòng chơi: gieo cả tầng → tua 1 phút → kéo tay thu hoạch → bán; không lỗi console', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1194, height: 834 }, hasTouch: true });
  const { page, errors } = await open(ctx);
  assert.match((await page.textContent('[data-test=trial-badge]')) ?? '', /BẢN THỬ/);
  await playOneRound(page);
  const s = await snap(page);
  assert.equal(s.harvests, 10);
  assert.equal(s.inv['base:item.cotton-daisy'], 20);
  assert.equal(s.level, 2);
  await page.click('[data-test=open-storage]');
  await page.click('[data-test="sell-base:item.cotton-daisy"]');
  const sold = await snap(page);
  assert.ok(sold.coins > s.coins, `xu ${s.coins} → ${sold.coins}`);
  assert.equal(sold.inv['base:item.cotton-daisy'], undefined);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('IndexedDB: tải lại trang giữ nguyên tiến trình', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1194, height: 834 } });
  const { page } = await open(ctx);
  await playOneRound(page);
  const s = await snap(page);
  await page.waitForTimeout(2000); // debounce save
  await page.reload();
  await page.waitForFunction(() => (window as unknown as { __pbtc?: unknown }).__pbtc);
  assert.deepEqual(await snap(page), s);
  await ctx.close();
});

test('đóng tab ngay sau thao tác (pagehide) vẫn không mất tiến trình', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1194, height: 834 } });
  const { page } = await open(ctx);
  await playOneRound(page);
  const s = await snap(page);
  await page.close({ runBeforeUnload: true });
  const again = await open(ctx);
  assert.deepEqual(await snap(again.page), s);
  await ctx.close();
});

test('offline: sau lần tải đầu, tắt mạng rồi tải lại vẫn vào được game và chơi được', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1194, height: 834 } });
  const { page } = await open(ctx);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload(); // now controlled by the Service Worker
  await page.waitForFunction(() => (window as unknown as { __pbtc?: unknown }).__pbtc);
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => (window as unknown as { __pbtc?: unknown }).__pbtc, null, { timeout: 30_000 });
  await playOneRound(page);
  assert.equal((await snap(page)).harvests, 10);
  await ctx.close();
});
