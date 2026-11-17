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

/** Screen point of a world-space point inside a view object (pots, floor signs, locked floor). */
const globalPoint = (page: Page, expr: string, x: number, y: number) =>
  page.evaluate(
    ([e, px, py]) => {
      const view = (window as unknown as { __pbtc: { view: Record<string, any> } }).__pbtc.view;
      const obj = new Function('view', `return ${e}`)(view) as { toGlobal(p: { x: number; y: number }): { x: number; y: number } };
      const g = obj.toGlobal({ x: px as number, y: py as number });
      return { x: g.x, y: g.y };
    },
    [expr, x, y] as const,
  );

const EMPTY_POTS = 6;

async function playOneRound(page: Page): Promise<void> {
  // "Hạt giống" opens the seed tray; "Chi tiết" opens the full seed stall, which plants every empty pot.
  await page.click('[data-test=open-seeds]');
  await page.click('[data-test=seed-shop]');
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
  assert.equal(s.harvests, EMPTY_POTS);
  // Yield 2 each; a lucky harvest may be a mutated variant (its own item id).
  const daisies = Object.entries(s.inv).filter(([id]) => id.startsWith('base:item.cotton-daisy')).reduce((n, [, q]) => n + q, 0);
  assert.equal(daisies, EMPTY_POTS * 2);
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
  assert.equal((await snap(page)).harvests, EMPTY_POTS);
  await ctx.close();
});

test('nhiều tầng + chậu: vuốt lên, mở tầng mới, mua chậu ở Lò Gốm, đặt chậu vào tầng mới', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1194, height: 834 }, hasTouch: true });
  const { page, errors } = await open(ctx);
  await page.evaluate(() => {
    const w = window as unknown as { __pbtc: { session: { state: { player: { level: number; coins: number } }; refresh(): void } } };
    w.__pbtc.session.state.player.level = 5;
    w.__pbtc.session.state.player.coins = 3000;
    w.__pbtc.session.refresh();
  });
  // Climb: vertical drag on the sky to the right of the floor.
  await page.mouse.move(1100, 200);
  await page.mouse.down();
  for (let y = 200; y <= 760; y += 20) await page.mouse.move(1100, y);
  await page.mouse.up();
  await page.waitForTimeout(600);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/locked-floor.png` });
  const sign = await globalPoint(page, 'view.locked.container', 0, 86);
  await page.mouse.click(sign.x, sign.y);
  await page.waitForSelector('[data-test=floor-panel]');
  await page.click('[data-test=unlock-floor]');
  await page.waitForTimeout(1800);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/floor-opened.png` });
  const floors = await page.evaluate(() => (window as unknown as { __pbtc: { session: { state: { floors: unknown[]; player: { coins: number } } } } }).__pbtc.session.state.floors.length);
  assert.equal(floors, 2);
  await page.click('[data-test=open-shop]');
  await page.click('[data-test="buy-base:pot.porcelain"]');
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/pot-shop.png` });
  await page.click('.win .knob.close');
  await page.waitForTimeout(300);
  const stock = await page.evaluate(() => (window as unknown as { __pbtc: { session: { state: { potStock: string[] } } } }).__pbtc.session.state.potStock);
  assert.equal(stock.length, 1);
  // Tap the first pot of the new floor (now on screen), open the bench, place the bought pot.
  const pos = await page.evaluate(() => {
    const v = (window as unknown as { __pbtc: { view: { slotView(f: number, i: number): { getGlobalPosition(): { x: number; y: number } } } } }).__pbtc.view;
    const g = v.slotView(1, 0).getGlobalPosition();
    return { x: g.x, y: g.y };
  });
  await page.mouse.click(pos.x, pos.y - 20);
  await page.waitForSelector('[data-test=seed-panel]');
  await page.click('[data-test=swap-pot]');
  await page.waitForSelector('[data-test=pot-panel]');
  await page.click(`[data-test="place-${stock[0]}"]`);
  const placed = await page.evaluate(() => {
    const s = (window as unknown as { __pbtc: { session: { state: { floors: { slots: { potInstanceId: string }[] }[]; pots: Record<string, { potId: string }> } } } }).__pbtc.session.state;
    return s.pots[s.floors[1]!.slots[0]!.potInstanceId]!.potId;
  });
  assert.equal(placed, 'base:pot.porcelain');
  await page.waitForTimeout(400);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/pot-placed.png` });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('khay hạt: kéo hạt qua các chậu trống thì gieo từng chậu; chạm hạt thì chọn để vuốt gieo', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1194, height: 834 }, hasTouch: true });
  const { page, errors } = await open(ctx);
  await page.click('[data-test=open-seeds]');
  await page.waitForSelector('[data-test=seed-tray]:not(.hidden)');
  const chip = (await page.locator('[data-test="tray-base:crop.cotton-daisy"]').boundingBox())!;
  const first = await globalPoint(page, 'view.slotView(0, 0)', 0, -60);
  const last = await globalPoint(page, 'view.slotView(0, 5)', 0, -60);
  await page.mouse.move(chip.x + chip.width / 2, chip.y + chip.height / 2);
  await page.mouse.down();
  await page.mouse.move(first.x, first.y, { steps: 10 });
  for (let x = first.x; x <= last.x; x += 15) await page.mouse.move(x, first.y);
  await page.mouse.up();
  const planted = await page.evaluate(() => (window as unknown as { __pbtc: { session: { state: { floors: { slots: { planting: unknown }[] }[] } } } }).__pbtc.session.state.floors[0]!.slots.filter((s) => s.planting).length);
  assert.equal(planted, EMPTY_POTS);
  assert.equal(await page.locator('.seed-ghost').count(), 0, 'hạt bay theo tay đã biến mất khi thả');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('mở rộng tầng (ô +) và nâng sao tầng (biển gỗ); thăm vườn hàng xóm, giúp tưới/bắt bọ, về vườn', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1194, height: 834 }, hasTouch: true });
  const { page, errors } = await open(ctx);
  await page.evaluate(() => {
    const w = window as unknown as { __pbtc: { session: { state: { player: { level: number; coins: number }; inventory: Record<string, number> }; refresh(): void } } };
    w.__pbtc.session.state.player.level = 3;
    w.__pbtc.session.state.player.coins = 5000;
    w.__pbtc.session.state.inventory['base:item.cotton-daisy'] = 10;
  });
  // The "+" spot sits where the 7th pot will go: right of pot 6.
  const p6 = await globalPoint(page, 'view.slotView(0, 5)', 0, -60);
  const p5 = await globalPoint(page, 'view.slotView(0, 4)', 0, -60);
  await page.mouse.click(p6.x + (p6.x - p5.x), p6.y);
  await page.waitForSelector('[data-test=floor-info]');
  await page.click('[data-test=expand-floor]');
  await page.click('[data-test=star-floor]');
  const st = await page.evaluate(() => {
    const s = (window as unknown as { __pbtc: { session: { state: { floors: { slots: unknown[]; stars: number }[] } } } }).__pbtc.session.state;
    return { slots: s.floors[0]!.slots.length, stars: s.floors[0]!.stars };
  });
  assert.deepEqual(st, { slots: 7, stars: 1 });
  await page.click('.win .knob.close');
  await page.waitForTimeout(400);
  // Visit the neighbour with the most help needed right now and help until the limit.
  await page.click('[data-test=open-neighbors]');
  const bot = await page.evaluate(() => (window as unknown as { __pbtc: { session: { content: { bots: Map<string, unknown> } } } }).__pbtc.session.content.bots.keys().next().value as string);
  await page.click(`[data-test="visit-${bot}"]`);
  await page.waitForSelector('[data-test=visit-bar]');
  await page.waitForTimeout(900);
  const needs = await page.evaluate(() => {
    const view = (window as unknown as { __pbtc: { view: Record<string, any> } }).__pbtc.view;
    const out: { f: number; i: number }[] = [];
    view.floors.forEach((fv: { slots: { markerKind: string; shownBugs: number }[] }, f: number) => fv.slots.forEach((s, i) => (s.markerKind === 'water' || s.shownBugs > 0) && out.push({ f, i })));
    return out;
  });
  const coins0 = (await snap(page)).coins;
  let helped = 0;
  for (const n of needs.filter((n) => n.f === 0).slice(0, 3)) {
    const pt = await globalPoint(page, `view.slotView(${n.f}, ${n.i})`, 0, -60);
    await page.mouse.click(pt.x, pt.y);
    helped++;
  }
  if (helped > 0) assert.ok((await snap(page)).coins > coins0, 'giúp hàng xóm được xu');
  await page.click('[data-test=visit-home]');
  await page.waitForTimeout(400);
  assert.equal(await page.locator('[data-test=visit-bar]').count(), 0);
  assert.equal(await page.evaluate(() => (window as unknown as { __pbtc: { view: { mode: string } } }).__pbtc.view.mode), 'home');
  assert.deepEqual(errors, []);
  await ctx.close();
});
