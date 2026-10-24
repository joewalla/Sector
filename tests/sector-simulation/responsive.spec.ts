import { test, expect, type Locator, type Page } from '@playwright/test';
import { londonFixture } from './fixtures';

const longInstruction = 'Fixture: continue towards the synthetic Westminster riverside entrance, passing the pedestrian crossing before following the signed approach to the museum';
const longNext = 'Fixture: turn towards the synthetic Tower of London visitor entrance and continue past the riverside information centre to the clearly marked destination';

async function openLayoutFixture(page: Page) {
  const fixture = londonFixture();
  fixture.steps[0].instruction = longInstruction;
  fixture.steps[1].instruction = longNext;
  const errors: string[] = [];
  let requests = 0;
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.clear();
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition() { throw new Error('Layout fixture must not request GPS'); } },
    });
  });
  await page.route('**/api/route/preview', async (route) => {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    requests++;
    expect(route.request().postDataJSON()).toEqual({
      origin: { longitude: -0.1276, latitude: 51.5007 },
      destination: { longitude: -0.0754, latitude: 51.5081 },
    });
    await route.fulfill({ headers, json: fixture });
  });
  await page.goto('/search');
  await page.getByTestId('london-demo').click();
  await expect(page.getByTestId('simulation-start')).toBeVisible();
  const now = new Date('2026-01-01T12:00:00Z');
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date(now.getTime() + 1_000));
  return () => {
    expect(errors).toEqual([]);
    expect(requests).toBe(1);
  };
}

// Scroll vertically, never horizontally: a control must fit the viewport, not
// merely exist in the DOM. Also catch clipped content inside a fitting box.
async function readable(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeInViewport();
  const bounds = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left, right: rect.right, viewport: innerWidth,
      clipped: element.scrollWidth > element.clientWidth + 1,
    };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(-1);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewport + 1);
  expect(bounds.clipped).toBe(false);
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.getByTestId('route-simulation').evaluate((root) =>
    [root, ...root.querySelectorAll<HTMLElement>('*')].flatMap((element) => {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return [];
      return rect.left < -1 || rect.right > innerWidth + 1 || element.scrollWidth > element.clientWidth + 1
        ? [element.getAttribute('data-testid') ?? element.textContent?.slice(0, 100) ?? element.tagName]
        : [];
    }));
  expect(overflow).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

// A real Tab transition, not just programmatic focus on the target.
async function keyboardNext(page: Page, from: Locator, target: Locator) {
  await from.focus();
  await page.keyboard.press('Tab');
  await expect(target).toBeFocused();
  await readable(target);
  expect(await target.evaluate((element) => {
    const style = getComputedStyle(element);
    return (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none';
  })).toBe(true);
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 1440, height: 900 },
]) {
  test(`responsive simulation at ${viewport.width}px keeps configuration, playback and comparisons reachable`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const healthy = await openLayoutFixture(page);
    await expect(page.getByRole('radiogroup', { name: 'Number of practice sectors' })).toBeVisible();
    const threeSectors = page.getByTestId('practice-sector-count-3');
    const fourSectors = page.getByTestId('practice-sector-count-4');
    const fiveSectors = page.getByRole('radio', { name: '5 equal-distance practice sectors', exact: true });
    await expect(threeSectors).toHaveAttribute('aria-checked', 'true');
    await expect(fourSectors).toHaveAttribute('aria-checked', 'false');
    await expect(threeSectors).toHaveAttribute('tabindex', '0');
    await expect(fiveSectors).toHaveAttribute('tabindex', '-1');
    await threeSectors.focus();
    await page.keyboard.press('ArrowRight');
    await expect(fourSectors).toBeFocused();
    await expect(fourSectors).toHaveAttribute('aria-checked', 'true');
    await expect(threeSectors).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('ArrowRight');
    await expect(fiveSectors).toBeFocused();
    await expect(fiveSectors).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('ArrowLeft');
    await expect(fourSectors).toBeFocused();
    await expect(fourSectors).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('ArrowLeft');
    await expect(threeSectors).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(fiveSectors).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('sector-state-5')).toHaveText('ESTIMATE');
    const firstStopOff = page.getByRole('radio', { name: 'Stop 1: No simulated stop', exact: true });
    await keyboardNext(page, fiveSectors, firstStopOff);
    await expect(firstStopOff).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('ArrowRight');
    const firstStopTen = page.getByRole('radio', { name: 'Stop 1: 10 simulated seconds', exact: true });
    await expect(firstStopTen).toBeFocused();
    await expect(firstStopTen).toHaveAttribute('aria-checked', 'true');
    await expect(firstStopOff).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Enter');
    await page.getByTestId('simulated-stop-add').click();
    await page.getByTestId('simulated-stop-add').click();
    for (const stop of [1, 2, 3]) {
      await expect(page.getByRole('radiogroup', { name: `Stop ${stop}: duration`, exact: true })).toBeVisible();
      const off = page.getByRole('radio', { name: `Stop ${stop}: No simulated stop`, exact: true });
      await readable(off);
      const ten = page.getByRole('radio', { name: `Stop ${stop}: 10 simulated seconds`, exact: true });
      await expect(off).toHaveAttribute('aria-checked', 'false');
      await off.focus();
      await page.keyboard.press('ArrowRight');
      await expect(ten).toBeFocused();
      await expect(ten).toHaveAttribute('aria-checked', 'true');
      await page.keyboard.press('Enter');
      for (const seconds of [10, 30, 60, 120]) {
        await readable(page.getByRole('radio', { name: `Stop ${stop}: ${seconds} simulated seconds`, exact: true }));
      }
      if (stop === 1) {
        const firstSector = page.getByRole('radio', { name: 'Stop 1 in sector 1', exact: true });
        const lastSector = page.getByRole('radio', { name: 'Stop 1 in sector 5', exact: true });
        await expect(firstSector).toHaveAttribute('aria-checked', 'true');
        await expect(lastSector).toHaveAttribute('aria-checked', 'false');
        await firstSector.focus();
        await page.keyboard.press('ArrowLeft');
        await expect(lastSector).toBeFocused();
        await expect(lastSector).toHaveAttribute('aria-checked', 'true');
        await expect(firstSector).toHaveAttribute('aria-checked', 'false');
        await page.keyboard.press('ArrowRight');
        await expect(firstSector).toBeFocused();
        await expect(firstSector).toHaveAttribute('aria-checked', 'true');
      }
      // Keep the first two route instructions adjacent; an earlier synthetic
      // stop correctly becomes the next instruction instead of the long turn.
      await page.getByRole('radio', { name: `Stop ${stop} in sector ${stop + 2}`, exact: true }).click();
      await readable(page.getByRole('radio', { name: `Stop ${stop} in sector 5`, exact: true }));
    }
    await noHorizontalOverflow(page);
    const speed20 = page.getByTestId('simulation-speed-20');
    const speed60 = page.getByTestId('simulation-speed-60');
    await expect(speed20).toHaveAttribute('aria-checked', 'true');
    await expect(speed60).toHaveAttribute('aria-checked', 'false');
    await speed20.focus();
    await page.keyboard.press('ArrowDown');
    await expect(speed60).toBeFocused();
    await expect(speed60).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('ArrowUp');
    await expect(speed20).toBeFocused();
    await expect(speed20).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('radio', { name: '1 times playback speed', exact: true }).click();
    await keyboardNext(page, page.getByTestId('simulation-speed-1'), page.getByRole('button', { name: 'Start simulation', exact: true }));
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('simulation-instruction')).toHaveText(longInstruction);
    await expect(page.getByTestId('simulation-next-instruction')).toHaveText(`Next: ${longNext}`);
    await readable(page.getByTestId('simulation-instruction'));
    await readable(page.getByTestId('simulation-next-instruction'));
    // Upcoming instructions must wrap too, not hide the end behind line clamping.
    expect(await page.getByTestId('simulation-next-instruction').evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    await noHorizontalOverflow(page);
    await keyboardNext(page, page.getByTestId('simulation-speed-1'), page.getByRole('button', { name: 'Pause', exact: true }));
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('simulation-playback-state')).toHaveText('PAUSED');
    await readable(page.getByRole('button', { name: 'Resume', exact: true }));
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('simulation-playback-state')).toHaveText('SIMULATING 1x');
    await keyboardNext(page, page.getByTestId('simulation-toggle'), page.getByRole('button', { name: 'Restart', exact: true }));
    await page.keyboard.press('Enter');
    await keyboardNext(page, page.getByTestId('simulation-restart'), page.getByRole('button', { name: 'End early', exact: true }));
    await page.getByTestId('simulation-speed-120').click();
    await page.clock.runFor(2_000); // 180 estimated + 30 synthetic seconds, all complete.
    await expect(page.getByTestId('simulation-result-state')).toHaveText('SIMULATION COMPLETE');
    await page.getByRole('button', { name: 'Simulate again', exact: true }).click();
    await page.getByTestId('simulation-speed-60').click();
    await page.clock.runFor(4_000);
    for (const sector of [1, 2, 3, 4, 5]) {
      await expect(page.getByTestId(`sector-state-${sector}`)).toHaveText('COMPLETE');
      const comparison = page.getByTestId(`sector-comparison-${sector}`);
      await expect(comparison).toContainText('match');
      await readable(comparison);
    }
    await noHorizontalOverflow(page);
    await testInfo.attach('completed-comparisons', { body: await page.screenshot(), contentType: 'image/png' });
    await page.getByTestId('simulation-again').click();
    await page.getByTestId('simulation-speed-1').click();
    await page.clock.runFor(60_000); // S1 complete, S2 partial, S3–S5 not reached.
    await page.getByRole('button', { name: 'End early', exact: true }).click();
    await expect(page.getByTestId('simulation-result-state')).toHaveText('SIMULATION ENDED EARLY');
    await expect(page.getByTestId('sector-state-1')).toHaveText('COMPLETE');
    await expect(page.getByTestId('sector-state-2')).toHaveText('PARTIAL');
    await expect(page.getByTestId('sector-state-3')).toHaveText('NOT REACHED');
    for (const sector of [1, 2, 3, 4, 5]) {
      await readable(page.getByTestId(`sector-split-${sector}`));
      await readable(page.getByTestId(`sector-comparison-${sector}`));
    }
    await readable(page.getByRole('button', { name: 'Simulate again', exact: true }));
    await noHorizontalOverflow(page);
    await testInfo.attach('partial-comparisons', { body: await page.screenshot(), contentType: 'image/png' });
    healthy();
  });
}
