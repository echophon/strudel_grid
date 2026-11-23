import { expect, test, type Page } from '@playwright/test';

const cell = (page: Page, x: number, y: number) => page.locator(`#vgrid [data-x="${x}"][data-y="${y}"]`);
const level = async (page: Page, x: number, y: number) => Number((await cell(page, x, y).getAttribute('data-lv')) ?? 0);
const tapCell = async (page: Page, x: number, y: number) => {
  const box = (await cell(page, x, y).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
};

test('default project: runs, pages from the grid, edits steps, captures to code', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.cm-editor')).toBeVisible();

  await page.click('#play');
  await expect(page.locator('#status')).toHaveText('playing', { timeout: 45_000 });
  await expect(page.locator('#pages .tab')).toHaveText(['drums', 'lead', 'fx', 'perform']);

  // bottom row: page buttons (current bright), snapshots, transport
  await expect.poll(() => level(page, 0, 7)).toBe(12);
  expect(await level(page, 1, 7)).toBe(4);

  // tap "lead" on the grid's page strip
  await tapCell(page, 1, 7);
  await expect(page.locator('#pages .tab.active')).toHaveText('lead');
  await tapCell(page, 0, 7);
  await expect(page.locator('#pages .tab.active')).toHaveText('drums');

  // toggle step 1 of the kick row, then capture it into the code
  expect(await level(page, 1, 0)).toBeLessThan(5);
  await tapCell(page, 1, 0);
  await expect.poll(() => level(page, 1, 0)).toBeGreaterThanOrEqual(5);
  await page.click('#capture');
  await expect(page.locator('.cm-content')).toContainText("init: 'xx..x...x...x.x.'");
  await expect(page.locator('#log')).toContainText('captured: kick');

  // transport stops from the grid
  await tapCell(page, 15, 7);
  await expect(page.locator('#status')).toHaveText('stopped');
  expect(errors).toEqual([]);
});

test('examples menu: loads a project with a vertical sidebar, fresh state, and runs it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await expect(page.locator('.cm-editor')).toBeVisible();

  await page.selectOption('#examples', { label: '11 sidebar' });
  await expect(page.locator('#status')).toHaveText('playing', { timeout: 45_000 });
  await expect(page.locator('.cm-content')).toContainText('11 · sidebar');
  await expect(page.locator('#pages .tab')).toHaveText(['beat', 'lead', 'bass']);
  await expect(page.locator('#log')).toContainText('loaded 11-sidebar.js');

  // page buttons run down x 15: first page bright, the others dim
  await expect.poll(() => level(page, 15, 0)).toBe(12);
  expect(await level(page, 15, 1)).toBe(4);
  await tapCell(page, 15, 1);
  await expect(page.locator('#pages .tab.active')).toHaveText('lead');
  await expect(page.locator('#legend')).toContainText('mel');
  await expect(page.locator('#legend')).not.toContainText('kick');

  // the transport button sits at x 15, y 4
  await tapCell(page, 15, 4);
  await expect(page.locator('#status')).toHaveText('stopped');

  // loading another example replaces the code
  await page.selectOption('#examples', { label: '01 first steps' });
  await expect(page.locator('.cm-content')).toContainText('01 · first steps');
  expect(errors).toEqual([]);
});

test('hydra examples: visuals start behind the page, follow the grid, and go away with the code', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && /hydra|webgl/i.test(m.text())) errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await expect(page.locator('.cm-editor')).toBeVisible();

  for (const label of ['13 hydra', '14 hydra beat', '15 hydra scenes']) {
    await page.selectOption('#examples', { label });
    await expect(page.locator('#status')).toHaveText('playing', { timeout: 45_000 });
    await expect(page.locator('#hydra-canvas')).toHaveCount(1, { timeout: 30_000 });
    await expect(page.locator('html')).toHaveAttribute('data-hydra', 'on');
  }
  // the grid still receives taps (the canvas is behind it, not over it)
  await page.locator('#pages .tab', { hasText: 'visuals' }).click();
  await tapCell(page, 0, 2); // scene 2
  await expect.poll(() => level(page, 0, 2), { timeout: 5_000 }).toBeGreaterThanOrEqual(9);
  await page.waitForTimeout(500); // let hydra draw a few frames with the new values
  expect(errors).toEqual([]);

  await page.selectOption('#examples', { label: '01 first steps' });
  await expect(page.locator('#hydra-canvas')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveAttribute('data-hydra');
});
