import { test, expect, type Page } from '@playwright/test';
import { londonFixture } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Any accidental GPS access is an immediate failure, not a real location request.
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition() { throw new Error('Regression: London demo must not use GPS'); } },
    });
  });
});

async function openDemo(page: Page) {
  let response = londonFixture();
  let requests = 0;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/route/preview', async (route) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    requests += 1;
    expect(route.request().postDataJSON()).toEqual({
      origin: { longitude: -0.1276, latitude: 51.5007 },
      destination: { longitude: -0.0754, latitude: 51.5081 },
    });
    await route.fulfill({ status: 200, headers, json: response });
  });
  await page.goto('/search');
  await page.getByTestId('london-demo').click();
  await expect(page.getByTestId('simulation-start')).toBeVisible();
  // Install only after fonts/network have loaded. No real waiting for a drive.
  const now = new Date('2026-01-01T12:00:00Z');
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date(now.getTime() + 1_000));
  return {
    requests: () => requests,
    replace: (duration: number) => { response = londonFixture(duration); },
    assertHealthy: () => expect(errors).toEqual([]),
  };
}

async function finish(page: Page, speed: 60 | 120, milliseconds: number, again = false) {
  if (again) {
    await page.getByTestId('simulation-again').click();
    await page.getByTestId(`simulation-speed-${speed}`).click();
  } else {
    await page.getByTestId(`simulation-speed-${speed}`).click();
    await page.getByTestId('simulation-start').click();
  }
  await page.clock.runFor(milliseconds);
  await expect(page.getByTestId('simulation-result-state')).toHaveText('SIMULATION COMPLETE');
}

async function expectCompleteSplits(page: Page, seconds: string, compared = false) {
  for (const id of [1, 2, 3]) {
    await expect(page.getByTestId(`sector-state-${id}`)).toHaveText('COMPLETE');
    await expect(page.getByTestId(`sector-split-time-${id}`)).toHaveText(`${seconds} split`);
    if (compared) await expect(page.getByTestId(`sector-comparison-${id}`)).toContainText('match');
  }
}

test('complete accelerated replay and second playback speed produce matching splits', async ({ page }, testInfo) => {
  const demo = await openDemo(page);
  await finish(page, 120, 2_000);
  await expectCompleteSplits(page, '1:00');
  await expect(page.getByTestId('sector-cumulative-time-3')).toHaveText('3:00 total');
  await finish(page, 60, 3_000, true);
  await expectCompleteSplits(page, '1:00', true);
  expect(demo.requests()).toBe(1);
  demo.assertHealthy();
  await page.getByTestId('simulation-result-state').scrollIntoViewIfNeeded();
  await testInfo.attach('completed-replay-comparison', { body: await page.screenshot(), contentType: 'image/png' });
});

test('scrubbing updates instructions and exact boundaries without creating a comparison baseline', async ({ page }) => {
  const demo = await openDemo(page);
  const slider = page.getByRole('slider', { name: 'Inspect elapsed route time' });
  await slider.fill('75');
  await expect(page.getByTestId('simulation-selected-time')).toContainText('1:15 / 3:00');
  await expect(page.getByTestId('simulation-playback-state')).toHaveText('INSPECTION · PAUSED');
  await expect(page.getByTestId('route-simulation').getByText('Fixture: continue along test road', { exact: true })).toBeVisible();
  await expect(page.getByTestId('sector-state-1')).toHaveText('COMPLETE');
  await expect(page.getByTestId('sector-split-time-2')).toHaveText('0:15 split');
  await expect(page.getByTestId('sector-state-3')).toHaveText('NOT REACHED');
  await expect(page.getByTestId('practice-sector-count-4')).toBeDisabled();
  await page.clock.runFor(30_000);
  await expect(page.getByTestId('simulation-selected-time')).toContainText('1:15 / 3:00');
  await page.getByTestId('simulation-seek-S1').click();
  await expect(page.getByTestId('sector-split-time-2')).toHaveText('0:00 split');
  await slider.press('Home');
  await expect(page.getByTestId('simulation-selected-time')).toContainText('0:00 / 3:00');
  await expect(page.getByTestId('route-simulation').getByText('Fixture: depart Westminster', { exact: true })).toBeVisible();
  await slider.press('End');
  await expect(page.getByTestId('route-simulation').getByText('Fixture: arrived', { exact: true })).toBeVisible();
  await expect(page.getByTestId('simulation-inspection-state')).toBeVisible();
  await expect(page.getByTestId('simulation-result-state')).toHaveCount(0);
  // Even resuming at the finish must not promote this run to a replay baseline.
  await page.getByTestId('simulation-toggle').click();
  await page.clock.runFor(1_000);
  await expect(page.getByTestId('simulation-result-state')).toHaveText('INSPECTION ONLY · NO BASELINE SAVED');
  await expect(page.getByTestId('sector-comparison-1')).toHaveCount(0);
  await finish(page, 120, 2_000, true);
  await expect(page.getByTestId('sector-comparison-1')).toHaveCount(0);
  await finish(page, 60, 3_000, true);
  await expectCompleteSplits(page, '1:00', true);
  expect(demo.requests()).toBe(1);
  demo.assertHealthy();
});

test('scrubbed active runs keep the previous replay and synthetic-stop timing intact', async ({ page }) => {
  const demo = await openDemo(page);
  await page.getByTestId('simulated-stop-duration-30').click();
  await page.getByTestId('simulated-stop-sector-2').click();
  await finish(page, 120, 2_000);
  await page.getByTestId('simulation-again').click();
  await page.getByTestId('simulation-speed-1').click();
  const slider = page.getByRole('slider', { name: 'Inspect elapsed route time' });
  await slider.fill('100');
  await expect(page.getByText('Synthetic stop · 20s left', { exact: true })).toBeVisible();
  await expect(page.getByTestId('sector-split-time-2')).toHaveText('0:40 split');
  await expect(page.getByTestId('simulated-stop-duration-60')).toBeDisabled();
  await slider.fill('50');
  await expect(page.getByTestId('sector-state-1')).toHaveText('CURRENT');
  await expect(page.getByTestId('sector-state-2')).toHaveText('NOT REACHED');
  await expect(page.getByTestId('sector-comparison-1')).toHaveCount(0);
  await page.getByTestId('simulation-seek-finish').click();
  await page.getByTestId('simulation-end').click();
  await expect(page.getByTestId('simulation-result-state')).toContainText('INSPECTION ONLY');
  await finish(page, 120, 2_000, true);
  await expect(page.getByTestId('sector-comparison-1')).toContainText('match');
  await expect(page.getByTestId('sector-comparison-2')).toContainText('Previous replay 1:30');
  await expect(page.getByTestId('sector-comparison-2')).toContainText('match');
  expect(demo.requests()).toBe(1);
  demo.assertHealthy();
});

test('pause, resume, restart and partial endings retain only the last completed baseline', async ({ page }) => {
  const demo = await openDemo(page);
  await finish(page, 120, 2_000);
  await page.getByTestId('simulation-again').click();
  await page.getByTestId('simulation-speed-1').click();
  await page.clock.runFor(80_000);
  await page.getByTestId('simulation-toggle').click();
  await expect(page.getByTestId('simulation-playback-state')).toHaveText('PAUSED');
  const pausedSplit = await page.getByTestId('sector-split-time-2').textContent();
  await page.clock.runFor(60_000);
  await expect(page.getByTestId('sector-split-time-2')).toHaveText(pausedSplit!);
  await page.getByTestId('simulation-toggle').click();
  await page.clock.runFor(10_000);
  await expect(page.getByTestId('sector-split-time-2')).toHaveText('0:30 split');
  await page.getByTestId('simulation-restart').click();
  await page.clock.runFor(1_000);
  await expect(page.getByTestId('sector-split-time-1')).toHaveText('0:01 split');
  await page.clock.runFor(79_000);
  await page.getByTestId('simulation-end').click();
  await expect(page.getByTestId('simulation-result-state')).toHaveText('SIMULATION ENDED EARLY');
  await expect(page.getByTestId('sector-state-1')).toHaveText('COMPLETE');
  await expect(page.getByTestId('sector-state-2')).toHaveText('PARTIAL');
  await expect(page.getByTestId('sector-state-3')).toHaveText('NOT REACHED');
  await expect(page.getByTestId('sector-split-time-2')).toHaveText('0:20 split');
  await expect(page.getByTestId('sector-split-time-3')).toHaveText('--:-- split');
  await expect(page.getByTestId('sector-cumulative-time-2')).toHaveText('--:-- total');
  await expect(page.getByTestId('sector-comparison-1')).toContainText('match');
  await expect(page.getByTestId('sector-comparison-2')).toHaveText('Previous replay 1:00');
  await finish(page, 120, 2_000, true);
  await expectCompleteSplits(page, '1:00', true);
  demo.assertHealthy();
});

test('hidden document and lost browser focus auto-pause without automatic resumption', async ({ page }) => {
  const demo = await openDemo(page);
  await page.getByTestId('simulation-speed-1').click();
  await page.getByTestId('simulation-start').click();
  await page.clock.runFor(20_000);
  // Explicitly dispatch the browser lifecycle event; no reliance on headless tab heuristics.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByTestId('simulation-playback-state')).toHaveText('PAUSED · SCREEN LEFT');
  await page.clock.runFor(500_000);
  await expect(page.getByTestId('sector-split-time-1')).toHaveText('0:20 split');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByTestId('simulation-playback-state')).toHaveText('PAUSED · SCREEN LEFT');
  await page.getByTestId('simulation-toggle').click();
  await page.clock.runFor(5_000);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByTestId('simulation-playback-state')).toHaveText('PAUSED · SCREEN LEFT');
  await page.clock.runFor(500_000);
  await expect(page.getByTestId('sector-split-time-1')).toHaveText('0:25 split');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByTestId('simulation-playback-state')).toHaveText('PAUSED · SCREEN LEFT');
  demo.assertHealthy();
});

test('new route response and changed sector configuration clear prior comparisons', async ({ page }) => {
  const demo = await openDemo(page);
  await finish(page, 120, 2_000);
  await finish(page, 120, 2_000, true);
  await expectCompleteSplits(page, '1:00', true);
  demo.replace(240);
  await page.getByTestId('london-demo').click();
  await expect(page.getByTestId('simulation-start')).toBeVisible();
  await expect(page.getByTestId('sector-comparison-1')).toHaveCount(0);
  await finish(page, 120, 2_000);
  await expectCompleteSplits(page, '1:20');
  await expect(page.getByTestId('sector-comparison-1')).toHaveCount(0);
  await page.getByTestId('practice-sector-count-4').click();
  await expect(page.getByTestId('simulation-start')).toBeVisible();
  await expect(page.getByTestId('sector-state-4')).toHaveText('ESTIMATE');
  await finish(page, 120, 2_000);
  await expect(page.getByTestId('sector-split-time-4')).toHaveText('1:00 split');
  await expect(page.getByTestId('sector-comparison-1')).toHaveCount(0);
  expect(demo.requests()).toBe(2);
  demo.assertHealthy();
});

test('synthetic stop countdown and settings remain frozen when paused; partial delay is honest', async ({ page }) => {
  const demo = await openDemo(page);
  await page.getByTestId('simulated-stop-duration-30').click();
  await page.getByTestId('simulated-stop-sector-2').click();
  await page.getByTestId('simulation-start').click(); // Default 20x.
  await expect(page.getByTestId('practice-sector-count-2')).toBeDisabled();
  await page.clock.runFor(4_500); // Route time 90s: halfway through S2.
  await expect(page.getByText('Synthetic stop · 30s left', { exact: true })).toBeVisible();
  await page.getByTestId('simulation-toggle').click();
  await expect(page.getByTestId('simulated-stop-duration-0')).toBeDisabled();
  await page.clock.runFor(60_000);
  await expect(page.getByText('Synthetic stop · 30s left', { exact: true })).toBeVisible();
  await page.getByTestId('simulation-toggle').click();
  await page.clock.runFor(750); // 15 simulated stop seconds.
  await expect(page.getByText('Synthetic stop · 15s left', { exact: true })).toBeVisible();
  await page.getByTestId('simulation-end').click();
  await expect(page.getByText(/Replayed Mapbox time 1:30 \+ 0:15 synthetic delay/)).toBeVisible();
  await expect(page.getByText(/Stop 1 · S2: \+0:15 of 0:30 configured \(partial\)/)).toBeVisible();
  await expect(page.getByTestId('sector-state-2')).toHaveText('PARTIAL');
  expect(demo.requests()).toBe(1);
  demo.assertHealthy();
});

test('three-stop scenarios lock every edit and replay identically before configuration changes clear comparisons', async ({ page }) => {
  const demo = await openDemo(page);
  await page.getByTestId('simulated-stop-duration-10').click();
  await page.getByTestId('simulated-stop-sector-2').click();
  await page.getByTestId('simulated-stop-add').click();
  await page.getByTestId('simulated-stop-2-sector-2').click();
  await page.getByTestId('simulated-stop-add').click();
  await page.getByTestId('simulated-stop-3-sector-3').click();
  await page.getByTestId('simulated-stop-3-duration-60').click();
  await expect(page.getByTestId('simulated-stop-add')).toBeDisabled();
  await page.getByTestId('simulation-start').click();
  for (const id of ['simulated-stop-duration-0', 'simulated-stop-2-sector-1', 'simulated-stop-3-duration-0', 'simulated-stop-add']) {
    await expect(page.getByTestId(id)).toBeDisabled();
  }
  await page.getByTestId('simulation-toggle').click();
  await expect(page.getByTestId('simulated-stop-2-duration-60')).toBeDisabled();
  await page.clock.runFor(60_000);
  await expect(page.getByTestId('simulation-selected-time')).toContainText('0:00 / 4:40');
  await page.getByTestId('simulation-toggle').click();
  await page.getByTestId('simulation-speed-120').click();
  await page.clock.runFor(2_500);
  await expect(page.getByTestId('simulation-result-state')).toHaveText('SIMULATION COMPLETE');
  for (const [id, seconds] of [[1, '1:00'], [2, '1:40'], [3, '2:00']] as const) {
    await expect(page.getByTestId(`sector-split-time-${id}`)).toHaveText(`${seconds} split`);
  }
  await expect(page.getByText(/Original Mapbox estimate 3:00.*Replayed Mapbox time 3:00 \+ 1:40 synthetic delay/)).toBeVisible();
  await expect(page.getByText(/Stop 1 · S2: \+0:10 of 0:10 configured \(complete\)/)).toBeVisible();
  await expect(page.getByText(/Stop 2 · S2: \+0:30 of 0:30 configured \(complete\)/)).toBeVisible();
  await expect(page.getByText(/Stop 3 · S3: \+1:00 of 1:00 configured \(complete\)/)).toBeVisible();
  await finish(page, 60, 5_000, true);
  await expect(page.getByTestId('sector-comparison-2')).toContainText('match');
  // Removing an entry resets the completed replay even if its remaining neighbours match.
  await page.getByTestId('simulated-stop-2-duration-0').click();
  await expect(page.getByTestId('simulation-start')).toBeVisible();
  await expect(page.getByTestId('sector-comparison-2')).toHaveCount(0);
  await expect(page.getByTestId('simulation-selected-time')).toContainText('0:00 / 4:10');
  await finish(page, 120, 2_500);
  await expect(page.getByTestId('sector-comparison-2')).toHaveCount(0);
  // Moving a surviving stop also invalidates the full scenario comparison.
  await page.getByTestId('simulated-stop-2-sector-1').click();
  await expect(page.getByTestId('simulation-start')).toBeVisible();
  await finish(page, 120, 2_500);
  await expect(page.getByTestId('sector-comparison-1')).toHaveCount(0);
  // Adding a new stop invalidates the newly completed comparison as well.
  await page.getByTestId('simulated-stop-add').click();
  await finish(page, 120, 2_500);
  await expect(page.getByTestId('sector-comparison-1')).toHaveCount(0);
  expect(demo.requests()).toBe(1);
  demo.assertHealthy();
});

test('ending within the second stop attributes consumed delay without counting the third', async ({ page }) => {
  const demo = await openDemo(page);
  await page.getByTestId('simulated-stop-duration-10').click(); // S1 midpoint at 30 seconds.
  await page.getByTestId('simulated-stop-add').click();
  await page.getByTestId('simulated-stop-2-sector-2').click(); // S2 midpoint at 90 + 10 seconds.
  await page.getByTestId('simulated-stop-add').click();
  await page.getByTestId('simulated-stop-3-sector-3').click();
  await page.getByTestId('simulation-start').click();
  await page.clock.runFor(5_750); // 115 simulated seconds: 10 full + 15 partial synthetic seconds.
  await page.getByTestId('simulation-end').click();
  await expect(page.getByText(/Replayed Mapbox time 1:30 \+ 0:25 synthetic delay/)).toBeVisible();
  await expect(page.getByText(/Stop 1 · S1: \+0:10 of 0:10 configured \(complete\)/)).toBeVisible();
  await expect(page.getByText(/Stop 2 · S2: \+0:15 of 0:30 configured \(partial\)/)).toBeVisible();
  await expect(page.getByText(/Stop 3 · S3: \+0:00 of 0:30 configured \(not reached\)/)).toBeVisible();
  await expect(page.getByTestId('sector-state-2')).toHaveText('PARTIAL');
  await expect(page.getByTestId('sector-state-3')).toHaveText('NOT REACHED');
  await expect(page.getByTestId('sector-split-2')).toContainText('Consumed synthetic delay: +0:15 of 0:30 configured');
  expect(demo.requests()).toBe(1);
  demo.assertHealthy();
});
