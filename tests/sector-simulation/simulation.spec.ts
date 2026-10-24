import { test, expect, type Page, type Route } from '@playwright/test';
import { arrivalOnlyFixture, failedRouteFixture, londonFixture, malformedRouteEnvelopeFixtures, placesFixture, singleMovingInstructionFixture, unequalStepDurationsFixture, unavailableRouteFixture, unusableRouteFixtures, zeroDurationMovingStepFixture } from './fixtures';
import { practiceStorageHarness } from './practice-settings-harness';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Explicitly held requests make ordering deterministic, without sleeps or real services.
async function recoveryHarness(page: Page) {
  const pending: Route[] = [];
  const bodies: unknown[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/route/preview', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    bodies.push(route.request().postDataJSON());
    pending.push(route);
  });
  let searchFailure = false;
  await page.route('**/api/places/search', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    expect(route.request().postDataJSON()).toEqual({ query: 'Fixture Museum' });
    await route.fulfill({
      status: searchFailure ? 503 : 200,
      headers: corsHeaders,
      json: searchFailure ? unavailableRouteFixture : placesFixture(),
    });
  });
  await page.goto('/search');
  return {
    bodies,
    failSearch: (fail: boolean) => { searchFailure = fail; },
    async take() {
      await expect.poll(() => pending.length).toBeGreaterThan(0);
      return pending.shift()!;
    },
    async respond(route: Route, response: { json?: unknown; body?: string; contentType?: string }, status = 200) {
      const completed = page.waitForResponse((response) => response.request() === route.request());
      await route.fulfill({ status, headers: corsHeaders, ...response });
      await (await completed).finished();
      // Let response handlers and React commit before asserting absence of stale UI.
      await page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }));
    },
    async reply(route: Route, json: unknown, status = 200) {
      await this.respond(route, { json }, status);
    },
    async healthy() {
      expect(errors).toEqual([]);
      expect(await page.evaluate(() => (globalThis as typeof globalThis & { fixtureGpsCalls?: number }).fixtureGpsCalls ?? 0)).toBe(0);
    },
  };
}

async function expectNoReplay(page: Page) {
  await expect(page.getByTestId('simulation-start')).toHaveCount(0);
  await expect(page.getByTestId('simulation-toggle')).toHaveCount(0);
  await expect(page.getByTestId('simulation-result-state')).toHaveCount(0);
}

test.describe('route failure recovery', () => {
  // Saved through the UI, not fabricated history. API errors must preserve exact bytes.
  async function saveSearch(page: Page) {
    await page.getByTestId('destination-name').fill('Fixture Museum');
    await page.getByRole('button', { name: /Save this search on this device/ }).click();
    await expect(page.getByText('Search saved on this device', { exact: true })).toBeVisible();
    const stored = await page.evaluate(() => localStorage.getItem('sector.recent-searches.v1'));
    expect(JSON.parse(stored!)[0].query).toBe('Fixture Museum');
    return stored;
  }

  for (const failure of [
    { name: 'unavailable', status: 503, json: unavailableRouteFixture },
    { name: 'provider failure', status: 502, json: failedRouteFixture },
    { name: 'connection failure', status: 0, json: null },
  ]) {
    test(`demo ${failure.name} clears loading, preserves saved searches and retries successfully`, async ({ page }) => {
      const harness = await recoveryHarness(page);
      const saved = await saveSearch(page);
      await page.getByTestId('london-demo').click();
      const request = await harness.take();
      await expect(page.getByTestId('london-demo')).toBeDisabled();
      await expectNoReplay(page);
      if (failure.status) await harness.reply(request, failure.json, failure.status);
      else await request.abort('failed');
      await expect(page.getByRole('alert')).toContainText('London demo route could not be loaded');
      await expect(page.getByTestId('london-demo')).toBeEnabled();
      await expectNoReplay(page);
      expect(await page.evaluate(() => localStorage.getItem('sector.recent-searches.v1'))).toBe(saved);
      await expect(page.getByTestId('destination-name')).toHaveValue('Fixture Museum');
      await page.getByRole('button', { name: 'Retry', exact: true }).click();
      const retry = await harness.take();
      await expect(page.getByRole('alert')).toHaveCount(0);
      await expect(page.getByTestId('london-demo')).toBeDisabled();
      await harness.reply(retry, londonFixture());
      await expect(page.getByTestId('simulation-start')).toBeVisible();
      await expect(page.getByTestId('london-demo')).toBeEnabled();
      expect(harness.bodies).toHaveLength(2);
      for (const body of harness.bodies) expect(body).toEqual({
        origin: { longitude: -0.1276, latitude: 51.5007 },
        destination: { longitude: -0.0754, latitude: 51.5081 },
      });
      await page.getByTestId('simulation-start').click();
      await expect(page.getByTestId('simulation-toggle')).toBeVisible();
      await expect(page.getByTestId('simulation-playback-state')).toContainText('SIMULATING');
      expect(await page.evaluate(() => localStorage.getItem('sector.recent-searches.v1'))).toBe(saved);
      await harness.healthy();
    });
  }

  for (const fixture of unusableRouteFixtures()) {
    test(`${fixture.name} cannot fabricate a simulation and a fresh route recovers`, async ({ page }) => {
      const harness = await recoveryHarness(page);
      const saved = await saveSearch(page);
      await page.getByTestId('london-demo').click();
      await harness.reply(await harness.take(), fixture.response);
      await expect(page.getByRole('alert')).toContainText('London demo route could not be loaded');
      await expectNoReplay(page);
      await expect(page.getByText('traffic-aware estimate', { exact: true })).toHaveCount(0);
      await expect(page.getByText('PREVIEW INSTRUCTIONS', { exact: true })).toHaveCount(0);
      await expect(page.getByTestId('destination-name')).toHaveValue('Fixture Museum');
      expect(await page.evaluate(() => localStorage.getItem('sector.recent-searches.v1'))).toBe(saved);
      await expect(page.getByTestId('london-demo')).toBeEnabled();
      await page.getByRole('button', { name: 'Retry', exact: true }).click();
      await harness.reply(await harness.take(), londonFixture());
      await expect(page.getByRole('alert')).toHaveCount(0);
      await expect(page.getByTestId('simulation-start')).toBeVisible();
      await harness.healthy();
    });
  }

  for (const fixture of malformedRouteEnvelopeFixtures()) {
    for (const selected of [false, true]) {
      test(`${selected ? 'selected route' : 'demo'} rejects ${fixture.name} and recovers without losing saved searches`, async ({ page }) => {
        const harness = await recoveryHarness(page);
        const saved = await saveSearch(page);
        if (selected) {
          // Explicit synthetic location, never a device or browser GPS request.
          await page.evaluate(() => {
            Object.defineProperty(navigator, 'geolocation', {
              configurable: true,
              value: { getCurrentPosition(success: (position: unknown) => void) {
                success({ coords: { longitude: -0.12, latitude: 51.5 } });
              } },
            });
          });
          await page.getByRole('button', { name: /Search places/ }).click();
          await page.getByRole('button', { name: /Fixture Museum Synthetic Museum Road/ }).click();
        }
        const action = selected
          ? page.getByRole('button', { name: /Preview route/ })
          : page.getByTestId('london-demo');
        // First render a valid route so a later invalid response cannot retain stale data.
        await action.click();
        await harness.reply(await harness.take(), londonFixture(240));
        await expect(page.getByTestId('simulation-start')).toBeVisible();
        await action.click();
        await harness.respond(await harness.take(), fixture.response);
        await expect(page.getByRole('alert')).toContainText(selected
          ? 'Route preview is unavailable right now. No journey has been started or recorded.'
          : 'London demo route could not be loaded');
        await expect(action).toBeEnabled();
        await expectNoReplay(page);
        await expect(page.getByText('traffic-aware estimate', { exact: true })).toHaveCount(0);
        await expect(page.getByText('PREVIEW INSTRUCTIONS', { exact: true })).toHaveCount(0);
        await expect(page.getByText(/Fixture: depart Westminster/, { exact: true })).toHaveCount(0);
        await expect(page.getByTestId('destination-name')).toHaveValue('Fixture Museum');
        expect(await page.evaluate(() => localStorage.getItem('sector.recent-searches.v1'))).toBe(saved);
        if (selected) await expect(page.getByText('One-time location use', { exact: true })).toBeVisible();
        await (selected ? action : page.getByRole('button', { name: 'Retry', exact: true })).click();
        await harness.reply(await harness.take(), londonFixture());
        await expect(page.getByRole('alert')).toHaveCount(0);
        await expect(page.getByTestId('simulation-start')).toBeVisible();
        await expect(page.getByText('3 min', { exact: true })).toBeVisible();
        await expect(page.getByText('0.6 mi', { exact: true })).toBeVisible();
        await expect(page.getByText('PREVIEW INSTRUCTIONS', { exact: true })).toBeVisible();
        await expect(page.getByText('Fixture: depart Westminster', { exact: true })).toBeVisible();
        await expect(page.getByTestId('simulation-selected-time')).toContainText('0:00 / 3:00');
        await page.getByTestId('simulation-start').click();
        await expect(page.getByTestId('simulation-playback-state')).toContainText('SIMULATING');
        await expect(page.getByTestId('destination-name')).toHaveValue('Fixture Museum');
        expect(await page.evaluate(() => localStorage.getItem('sector.recent-searches.v1'))).toBe(saved);
        expect(harness.bodies).toHaveLength(3);
        for (const body of harness.bodies) expect(body).toEqual(selected ? {
          origin: { longitude: -0.12, latitude: 51.5 },
          destination: { longitude: -0.1, latitude: 51.51 },
        } : {
          origin: { longitude: -0.1276, latitude: 51.5007 },
          destination: { longitude: -0.0754, latitude: 51.5081 },
        });
        await harness.healthy();
      });
    }
  }

  for (const staleStatus of [200, 503]) {
    test(`late demo ${staleStatus} cannot replace a newer search and selection`, async ({ page }) => {
      const harness = await recoveryHarness(page);
      await page.getByTestId('london-demo').click();
      const stale = await harness.take();
      await page.getByTestId('destination-name').fill('Fixture Museum');
      await page.getByRole('button', { name: /Search places/ }).click();
      await page.getByRole('button', { name: /Fixture Museum Synthetic Museum Road/ }).click();
      await expect(page.getByRole('button', { name: /Preview route/ })).toBeEnabled();
      await harness.reply(stale, staleStatus === 200 ? londonFixture(999) : unavailableRouteFixture, staleStatus);
      await expect(page.getByTestId('destination-name')).toHaveValue('Fixture Museum');
      // RN Web does not emit aria-selected on role=button. The preview action
      // and location notice exist only while a destination remains selected.
      await expect(page.getByRole('button', { name: /Preview route/ })).toBeEnabled();
      await expect(page.getByText('One-time location use', { exact: true })).toBeVisible();
      await expect(page.getByTestId('london-demo')).toBeEnabled();
      await expect(page.getByRole('alert')).toHaveCount(0);
      await expectNoReplay(page);
      await expect(page.getByText('LONDON DEMO ROUTE · WESTMINSTER TO TOWER OF LONDON', { exact: true })).toHaveCount(0);
      await harness.healthy();
    });
  }

  test('late demo cannot undo clearing the destination', async ({ page }) => {
    const harness = await recoveryHarness(page);
    await page.getByTestId('destination-name').fill('Fixture Museum');
    await page.getByTestId('london-demo').click();
    const stale = await harness.take();
    await page.getByRole('button', { name: 'Clear destination', exact: true }).click();
    await harness.reply(stale, londonFixture());
    await expect(page.getByTestId('destination-name')).toHaveValue('');
    await expect(page.getByTestId('london-demo')).toBeEnabled();
    await expectNoReplay(page);
    await harness.healthy();
  });

  test('older demo finishing last cannot overwrite the newer demo', async ({ page }) => {
    const harness = await recoveryHarness(page);
    await page.getByTestId('london-demo').click();
    const older = await harness.take();
    await page.getByTestId('destination-name').fill('Fixture Museum');
    await page.getByTestId('london-demo').click();
    const newer = await harness.take();
    const latest = londonFixture(360);
    latest.steps[0].instruction = 'Fixture: newest response wins';
    await harness.reply(newer, latest);
    await expect(page.getByText('Fixture: newest response wins', { exact: true })).toBeVisible();
    await harness.reply(older, londonFixture(999));
    await expect(page.getByTestId('london-demo')).toBeEnabled();
    await expect(page.getByText('Fixture: newest response wins', { exact: true })).toBeVisible();
    await expect(page.getByText('6 min', { exact: true })).toBeVisible();
    await expect(page.getByTestId('simulation-start')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await harness.healthy();
  });

  test('failed place search preserves saved strings and recovers on resubmission', async ({ page }) => {
    const harness = await recoveryHarness(page);
    const saved = await saveSearch(page);
    harness.failSearch(true);
    await page.getByRole('button', { name: /Search places/ }).click();
    await expect(page.getByRole('alert')).toContainText('Place search is unavailable');
    await expect(page.getByRole('button', { name: /Search places/ })).toBeEnabled();
    await expectNoReplay(page);
    expect(await page.evaluate(() => localStorage.getItem('sector.recent-searches.v1'))).toBe(saved);
    await expect(page.getByTestId('destination-name')).toHaveValue('Fixture Museum');
    harness.failSearch(false);
    await page.getByRole('button', { name: /Search places/ }).click();
    await expect(page.getByRole('button', { name: /Fixture Museum Synthetic Museum Road/ })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('sector.recent-searches.v1'))).toBe(saved);
    await harness.healthy();
  });

  test('selected route failure preserves saved searches and retries with a synthetic location', async ({ page }) => {
    const harness = await recoveryHarness(page);
    const saved = await saveSearch(page);
    // This test alone supplies an explicit synthetic position, never real GPS.
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition(success: (position: unknown) => void) {
            success({ coords: { longitude: -0.12, latitude: 51.5 } });
          },
        },
      });
    });
    await page.getByRole('button', { name: /Search places/ }).click();
    await page.getByRole('button', { name: /Fixture Museum Synthetic Museum Road/ }).click();
    const preview = page.getByRole('button', { name: /Preview route/ });
    await preview.click();
    const failed = await harness.take();
    // Pending buttons intentionally show a spinner instead of their text.
    await expectNoReplay(page);
    await harness.reply(failed, failedRouteFixture, 502);
    await expect(page.getByRole('alert')).toHaveText('Route preview is unavailable right now. No journey has been started or recorded.');
    await expect(preview).toBeEnabled();
    await expectNoReplay(page);
    expect(await page.evaluate(() => localStorage.getItem('sector.recent-searches.v1'))).toBe(saved);
    await preview.click();
    await harness.reply(await harness.take(), londonFixture());
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByTestId('simulation-start')).toBeVisible();
    await expect(page.getByText('ROUTE PREVIEW · NOT ACTIVE NAVIGATION', { exact: true })).toBeVisible();
    for (const body of harness.bodies) expect(body).toEqual({
      origin: { longitude: -0.12, latitude: 51.5 },
      destination: { longitude: -0.1, latitude: 51.51 },
    });
    expect(harness.bodies).toHaveLength(2);
    expect(await page.evaluate(() => localStorage.getItem('sector.recent-searches.v1'))).toBe(saved);
    await harness.healthy();
  });
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Any accidental GPS access is an immediate failure, not a real location request.
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition() {
        const scope = globalThis as typeof globalThis & { fixtureGpsCalls?: number };
        scope.fixtureGpsCalls = (scope.fixtureGpsCalls ?? 0) + 1;
        throw new Error('Regression: London demo must not use GPS');
      } },
    });
  });
});

async function openDemo(page: Page, initialRoute = londonFixture()) {
  let response = initialRoute;
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

async function expectMapPracticeStopNumbers(page: Page, expectedNumbers: number[]) {
  const labels = await page.getByTestId('route-simulation').locator('svg text').allTextContents();
  const actualNumbers = labels
    .filter((label) => label.startsWith('SIM '))
    .flatMap((label) => label.match(/\d+/g)?.map(Number) ?? [])
    .sort((a, b) => a - b);
  expect(actualNumbers).toEqual([...expectedNumbers].sort((a, b) => a - b));
}

test.describe('saved practice settings', () => {
  const saved = { version: 1, sectorCount: 4, stops: [{ sectorId: 2, durationSeconds: 30 }] };
  const seed = JSON.stringify(saved);
  const readError = 'Saved settings could not be read or were invalid. Using defaults; nothing new will be saved unless you opt in. You can retry saving or forget them.';
  const saveError = 'Could not save these settings. They work for this preview, but an older saved version may remain. Retry saving or forget them.';
  const savedMessage = 'Practice settings saved on this device. Future changes will be remembered.';
  const forgotMessage = 'Forgot saved practice settings. Reset to 3 sectors and no stops; remembering is off.';

  async function defaults(page: Page) {
    await expect(page.getByTestId('sector-state-3')).toHaveText('ESTIMATE');
    await expect(page.getByTestId('sector-state-4')).toHaveCount(0);
    await expect(page.getByTestId('simulated-stop-config')).toContainText('Off · replay only the Mapbox route estimate.');
    await expect(page.getByTestId('practice-settings-remember')).toHaveText('Save and remember practice settings');
  }

  async function expectStored(storage: Awaited<ReturnType<typeof practiceStorageHarness>>, value: unknown) {
    await expect.poll(async () => {
      const { raw } = await storage.snapshot();
      return raw === null ? null : JSON.parse(raw);
    }).toEqual(value);
  }

  async function expectStorageOperationPending(page: Page, storage: Awaited<ReturnType<typeof practiceStorageHarness>>) {
    await expect(page.getByTestId('practice-settings-status')).toHaveText('Updating saved settings…');
    for (const id of [
      'practice-sector-count-4',
      'simulated-stop-duration-60',
      'practice-settings-remember',
      'practice-settings-forget',
    ]) {
      await expect(page.getByTestId(id)).toBeDisabled();
      // A programmatic click verifies that disabled controls cannot start more
      // writes, removals, or settings changes while the original call is held.
      await page.getByTestId(id).dispatchEvent('click');
    }
    await expect(page.getByTestId('practice-settings-status')).toHaveText('Updating saved settings…');
    expect(await storage.snapshot()).toMatchObject({ calls: { write: 1, remove: 0 } });
  }

  async function expectSettingsUnlocked(page: Page) {
    for (const id of [
      'practice-sector-count-4',
      'simulated-stop-duration-60',
      'practice-settings-remember',
      'practice-settings-forget',
    ]) {
      await expect(page.getByTestId(id)).toBeEnabled();
    }
  }

  test('saving requires explicit opt-in; later sector and stop edits update only whitelisted settings and restore on reload', async ({ page }) => {
    const storage = await practiceStorageHarness(page);
    const demo = await openDemo(page);
    await defaults(page);
    await expect(page.getByTestId('practice-settings-status')).toHaveText('Not saved. Remembering is optional.');
    await page.getByTestId('practice-sector-count-4').click();
    await page.getByTestId('simulated-stop-duration-30').click();
    await page.getByTestId('simulated-stop-sector-2').click();
    expect(await storage.snapshot()).toMatchObject({ raw: null, calls: { write: 0, remove: 0 } });
    await page.getByTestId('practice-settings-remember').click();
    await expect(page.getByTestId('practice-settings-status')).toHaveText(savedMessage);
    await expectStored(storage, saved);
    await page.getByTestId('practice-sector-count-5').click();
    await expectStored(storage, { ...saved, sectorCount: 5 });
    await page.getByTestId('simulated-stop-duration-60').click();
    await expectStored(storage, { ...saved, sectorCount: 5, stops: [{ sectorId: 2, durationSeconds: 60 }] });
    await page.getByTestId('simulated-stop-add').click();
    const latest = { ...saved, sectorCount: 5, stops: [{ sectorId: 2, durationSeconds: 60 }, { sectorId: 1, durationSeconds: 30 }] };
    await expectStored(storage, latest);
    await expect(page.getByTestId('practice-settings-status')).toHaveText(savedMessage);
    await page.reload();
    await page.getByTestId('london-demo').click();
    await expect(page.getByTestId('practice-settings-status')).toHaveText('Saved settings restored. Changes will be remembered on this device.');
    await expect(page.getByTestId('sector-state-5')).toHaveText('ESTIMATE');
    await expect(page.getByTestId('simulated-stop-config')).toContainText('+60s in S2');
    await expect(page.getByTestId('simulated-stop-config')).toContainText('+30s in S1');
    expect(await storage.snapshot()).toMatchObject({ calls: { write: 0, remove: 0 } });
    // A restored opt-in is still active, not merely a one-time load.
    await page.getByTestId('simulated-stop-2-duration-0').click();
    await expectStored(storage, { ...latest, stops: [latest.stops[0]] });
    demo.assertHealthy();
  });

  test('forget resets defaults, clears even an identical-configuration comparison, and disables automatic saving', async ({ page }) => {
    const storage = await practiceStorageHarness(page);
    const demo = await openDemo(page);
    await page.getByTestId('practice-settings-remember').click();
    await expectStored(storage, { version: 1, sectorCount: 3, stops: [] });
    await finish(page, 120, 2_000);
    await finish(page, 120, 2_000, true);
    await expectCompleteSplits(page, '1:00', true);
    // The settings already equal defaults: comparison clearing must come from
    // onReset, not just a changed sector/stop configuration.
    await page.getByTestId('practice-settings-forget').click();
    await expect(page.getByTestId('practice-settings-status')).toHaveText(forgotMessage);
    await defaults(page);
    await expect(page.getByTestId('sector-comparison-1')).toHaveCount(0);
    await expect(page.getByTestId('simulation-start')).toBeVisible();
    expect((await storage.snapshot()).raw).toBeNull();
    await finish(page, 120, 2_000);
    await expect(page.getByTestId('sector-comparison-1')).toHaveCount(0);
    await page.getByTestId('practice-sector-count-4').click();
    await page.getByTestId('simulated-stop-duration-60').click();
    expect(await storage.snapshot()).toMatchObject({ raw: null, calls: { write: 1, remove: 1 } });
    await page.reload();
    await page.getByTestId('london-demo').click();
    await defaults(page);
    await expect(page.getByTestId('practice-settings-status')).toHaveText('Not saved. Remembering is optional.');
    demo.assertHealthy();
  });

  test('save and forget controls stay locked during running and paused playback without touching storage', async ({ page }) => {
    const storage = await practiceStorageHarness(page, { seed });
    const demo = await openDemo(page);
    await page.getByTestId('simulation-start').click();
    for (const state of ['SIMULATING 20x', 'PAUSED']) {
      await expect(page.getByTestId('simulation-playback-state')).toHaveText(state);
      for (const id of ['practice-settings-remember', 'practice-settings-forget', 'practice-sector-count-5', 'simulated-stop-duration-60']) {
        await expect(page.getByTestId(id)).toBeDisabled();
        // A programmatic click also exercises the rendered disabled handler.
        await page.getByTestId(id).dispatchEvent('click');
      }
      await expect(page.getByTestId('practice-settings')).toContainText('End playback before saving or resetting settings.');
      expect(await storage.snapshot()).toMatchObject({ raw: seed, calls: { write: 0, remove: 0 } });
      if (state === 'SIMULATING 20x') await page.getByTestId('simulation-toggle').click();
    }
    await page.getByTestId('simulation-end').click();
    await expect(page.getByTestId('practice-settings-remember')).toBeEnabled();
    await expect(page.getByTestId('practice-settings-forget')).toBeEnabled();
    demo.assertHealthy();
  });

  test('a held initial read blocks playback until restored settings replace defaults', async ({ page }) => {
    const storage = await practiceStorageHarness(page, { seed, holdRead: true });
    const harness = await recoveryHarness(page);
    await page.getByTestId('london-demo').click();
    await harness.reply(await harness.take(), londonFixture());
    await expect(page.getByTestId('practice-settings-loading')).toBeVisible();
    await expect.poll(async () => (await storage.snapshot()).calls.read).toBe(1);
    await expectNoReplay(page);
    await expect(page.getByTestId('practice-sector-count-3')).toHaveCount(0);
    await expect(page.getByTestId('practice-settings-remember')).toHaveCount(0);
    expect(await storage.snapshot()).toMatchObject({ raw: seed, calls: { write: 0, remove: 0 } });
    await storage.release();
    await expect(page.getByTestId('practice-settings-loading')).toHaveCount(0);
    await expect(page.getByTestId('practice-settings-status')).toContainText('Saved settings restored.');
    await expect(page.getByTestId('sector-state-4')).toHaveText('ESTIMATE');
    await expect(page.getByTestId('simulated-stop-config')).toContainText('+30s in S2');
    await expect(page.getByTestId('simulation-selected-time')).toContainText('0:00 / 3:30');
    await page.getByTestId('simulation-start').click();
    await expect(page.getByTestId('simulation-playback-state')).toHaveText('SIMULATING 20x');
    await expect(page.getByTestId('sector-state-4')).toHaveText('NOT REACHED');
    await harness.healthy();
  });

  for (const shouldFail of [false, true]) {
    test(`held first save reports ${shouldFail ? 'failure' : 'success'} and unlocks settings after settlement`, async ({ page }) => {
      const storage = await practiceStorageHarness(page, { hold: 'write' });
      await openDemo(page);
      await page.getByTestId('practice-settings-remember').click();
      await expect.poll(async () => (await storage.snapshot()).calls.write).toBe(1);
      await expectStorageOperationPending(page, storage);
      expect(await storage.snapshot()).toMatchObject({ raw: null, calls: { write: 1, remove: 0 } });

      await storage.release(shouldFail);
      await expect(page.getByTestId('practice-settings-status')).toHaveText(shouldFail ? saveError : savedMessage);
      await expectSettingsUnlocked(page);

      if (shouldFail) {
        await expect(page.getByTestId('practice-settings-remember')).toHaveText('Save and remember practice settings');
        await page.getByTestId('practice-settings-remember').click();
        await expect(page.getByTestId('practice-settings-status')).toHaveText(savedMessage);
      }
      await expectStored(storage, { version: 1, sectorCount: 3, stops: [] });
    });
  }

  for (const shouldFail of [false, true]) {
    test(`held forget reports ${shouldFail ? 'failure' : 'success'} and unlocks settings after settlement`, async ({ page }) => {
      const storage = await practiceStorageHarness(page, { seed, hold: 'remove' });
      await openDemo(page);
      await expect(page.getByTestId('practice-settings-status')).toContainText('Saved settings restored.');
      await page.getByTestId('practice-settings-forget').click();
      await expect.poll(async () => (await storage.snapshot()).calls.remove).toBe(1);
      await expect(page.getByTestId('practice-settings-status')).toHaveText('Updating saved settings…');
      for (const id of [
        'practice-sector-count-5',
        'simulated-stop-duration-60',
        'practice-settings-remember',
        'practice-settings-forget',
      ]) {
        await expect(page.getByTestId(id)).toBeDisabled();
        await page.getByTestId(id).dispatchEvent('click');
      }
      await expect(page.getByTestId('practice-settings-status')).toHaveText('Updating saved settings…');
      expect(await storage.snapshot()).toMatchObject({ raw: seed, calls: { write: 0, remove: 1 } });

      await storage.release(shouldFail);
      await expect(page.getByTestId('practice-settings-status')).toHaveText(
        shouldFail ? 'Could not forget saved settings. Nothing was reset. Please try again.' : forgotMessage,
      );
      await expectSettingsUnlocked(page);
      if (shouldFail) {
        await expect(page.getByTestId('sector-state-4')).toHaveText('ESTIMATE');
        await expect(page.getByTestId('simulated-stop-config')).toContainText('+30s in S2');
        await expect(page.getByTestId('practice-settings-remember')).toHaveText('Save practice settings again');
        await page.getByTestId('practice-settings-forget').click();
        await expect(page.getByTestId('practice-settings-status')).toHaveText(forgotMessage);
      }
      await defaults(page);
      expect(await storage.snapshot()).toMatchObject({ raw: null, calls: { write: 0, remove: shouldFail ? 2 : 1 } });
    });
  }

  for (const corrupt of [
    { name: 'malformed JSON', raw: '{broken' },
    { name: 'unsupported version', raw: JSON.stringify({ ...saved, version: 99 }) },
    { name: 'invalid stop sector', raw: JSON.stringify({ ...saved, stops: [{ sectorId: 5, durationSeconds: 30 }] }) },
    { name: 'read failure', raw: seed, fail: 'read' as const },
  ]) {
    test(`${corrupt.name} shows an accurate read warning and unsaved defaults until explicit retry`, async ({ page }) => {
      const storage = await practiceStorageHarness(page, { seed: corrupt.raw, fail: corrupt.fail });
      const demo = await openDemo(page);
      await expect(page.getByTestId('practice-settings-status')).toHaveText(readError);
      await defaults(page);
      await page.getByTestId('practice-sector-count-2').click();
      await page.getByTestId('simulated-stop-duration-10').click();
      await finish(page, 120, 2_000);
      await expect(page.getByTestId('practice-settings-status')).toHaveText(readError);
      expect(await storage.snapshot()).toMatchObject({ raw: corrupt.raw, calls: { write: 0, remove: 0 } });
      await storage.fail('read', false);
      await page.getByTestId('practice-settings-remember').click();
      await expect(page.getByTestId('practice-settings-status')).toHaveText(savedMessage);
      await expectStored(storage, { version: 1, sectorCount: 2, stops: [{ sectorId: 1, durationSeconds: 10 }] });
      demo.assertHealthy();
    });
  }

  test('failed first save does not opt in; explicit retry saves the current preview and enables updates', async ({ page }) => {
    const storage = await practiceStorageHarness(page, { fail: 'write' });
    const demo = await openDemo(page);
    await page.getByTestId('practice-settings-remember').click();
    await expect(page.getByTestId('practice-settings-status')).toHaveText(saveError);
    await expect(page.getByTestId('practice-settings-remember')).toHaveText('Save and remember practice settings');
    await page.getByTestId('practice-sector-count-4').click();
    await page.getByTestId('simulated-stop-duration-10').click();
    expect(await storage.snapshot()).toMatchObject({ raw: null, calls: { write: 1 } });
    await finish(page, 120, 2_000);
    await storage.fail('write', false);
    await page.getByTestId('practice-settings-remember').click();
    await expect(page.getByTestId('practice-settings-status')).toHaveText(savedMessage);
    await expectStored(storage, { version: 1, sectorCount: 4, stops: [{ sectorId: 1, durationSeconds: 10 }] });
    await page.getByTestId('simulated-stop-duration-60').click();
    await expectStored(storage, { version: 1, sectorCount: 4, stops: [{ sectorId: 1, durationSeconds: 60 }] });
    demo.assertHealthy();
  });

  test('failed automatic update preserves older bytes, keeps the new preview usable, and can be retried', async ({ page }) => {
    const storage = await practiceStorageHarness(page, { seed, fail: 'write' });
    const demo = await openDemo(page);
    await page.getByTestId('practice-sector-count-5').click();
    await expect(page.getByTestId('practice-settings-status')).toHaveText(saveError);
    await expect(page.getByTestId('practice-settings-remember')).toHaveText('Save practice settings again');
    expect(await storage.snapshot()).toMatchObject({ raw: seed, calls: { write: 1 } });
    await finish(page, 120, 2_000);
    await expect(page.getByTestId('sector-state-5')).toHaveText('COMPLETE');
    await storage.fail('write', false);
    await page.getByTestId('practice-settings-remember').click();
    await expect(page.getByTestId('practice-settings-status')).toHaveText(savedMessage);
    await expectStored(storage, { ...saved, sectorCount: 5 });
    demo.assertHealthy();
  });

  test('failed forget never reports success or resets settings/comparisons; retry really removes and resets', async ({ page }) => {
    const storage = await practiceStorageHarness(page, { seed, fail: 'remove' });
    const demo = await openDemo(page);
    await finish(page, 120, 2_000);
    await finish(page, 120, 2_000, true);
    await expect(page.getByTestId('sector-comparison-2')).toContainText('match');
    await page.getByTestId('practice-settings-forget').click();
    await expect(page.getByTestId('practice-settings-status')).toHaveText('Could not forget saved settings. Nothing was reset. Please try again.');
    await expect(page.getByText(forgotMessage, { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('sector-state-4')).toHaveText('COMPLETE');
    await expect(page.getByTestId('simulated-stop-config')).toContainText('+30s in S2');
    await expect(page.getByTestId('sector-comparison-2')).toContainText('match');
    await expect(page.getByTestId('practice-settings-remember')).toHaveText('Save practice settings again');
    expect(await storage.snapshot()).toMatchObject({ raw: seed, calls: { write: 0, remove: 1 } });
    await storage.fail('remove', false);
    await page.getByTestId('practice-settings-forget').click();
    await expect(page.getByTestId('practice-settings-status')).toHaveText(forgotMessage);
    await defaults(page);
    await expect(page.getByTestId('sector-comparison-2')).toHaveCount(0);
    expect(await storage.snapshot()).toMatchObject({ raw: null, calls: { write: 0, remove: 2 } });
    await finish(page, 120, 2_000);
    await expect(page.getByTestId('sector-comparison-1')).toHaveCount(0);
    demo.assertHealthy();
  });
});

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

test('instruction shortcuts pause at each turn and arrival with synchronized marker and splits', async ({ page }) => {
  const demo = await openDemo(page);
  const previous = page.getByRole('button', { name: 'Previous instruction', exact: true });
  const next = page.getByRole('button', { name: 'Next instruction', exact: true });
  const instruction = page.getByTestId('simulation-instruction');
  const marker = page.getByTestId('route-simulation').locator('svg circle').last();
  const selectedTime = page.getByTestId('simulation-selected-time');
  await expect(previous).toBeDisabled();
  await next.click(); // Inspection from idle must not start a comparable replay.
  await expect(selectedTime).toContainText('1:00 / 3:00');
  await expect(instruction).toHaveText('Fixture: continue along test road');
  await expect(page.getByTestId('sector-state-1')).toHaveText('COMPLETE');
  await expect(page.getByTestId('sector-split-time-2')).toHaveText('0:00 split');
  const turnPosition = [await marker.getAttribute('cx'), await marker.getAttribute('cy')];
  await previous.click();
  await expect(selectedTime).toContainText('0:00 / 3:00');
  await expect(instruction).toHaveText('Fixture: depart Westminster');
  await expect(previous).toBeDisabled();
  const startPosition = [await marker.getAttribute('cx'), await marker.getAttribute('cy')];
  expect(startPosition).not.toEqual(turnPosition);
  await expect(page.getByTestId('sector-state-2')).toHaveText('NOT REACHED');
  await page.getByTestId('simulation-toggle').click();
  await page.clock.runFor(750); // 15 seconds into the first instruction at default 20x.
  await next.click();
  await expect(selectedTime).toContainText('1:00 / 3:00');
  await expect(page.getByTestId('simulation-playback-state')).toHaveText('INSPECTION · PAUSED');
  expect([await marker.getAttribute('cx'), await marker.getAttribute('cy')]).toEqual(turnPosition);
  await expect(page.getByTestId('practice-sector-count-4')).toBeDisabled();
  await expect(page.getByTestId('simulated-stop-duration-30')).toBeDisabled();
  await page.clock.runFor(30_000);
  await expect(selectedTime).toContainText('1:00 / 3:00');
  await next.click();
  await expect(selectedTime).toContainText('2:00 / 3:00');
  await expect(instruction).toHaveText('Fixture: approach destination');
  await expect(page.getByTestId('sector-state-2')).toHaveText('COMPLETE');
  await expect(page.getByTestId('sector-split-time-3')).toHaveText('0:00 split');
  await next.click();
  await expect(selectedTime).toContainText('3:00 / 3:00');
  await expect(instruction).toHaveText('Fixture: arrived');
  await expect(next).toBeDisabled();
  await expect(previous).toBeEnabled();
  await expectCompleteSplits(page, '1:00');
  const destination = page.getByTestId('route-simulation').locator('svg circle').nth(1);
  expect([await marker.getAttribute('cx'), await marker.getAttribute('cy')])
    .toEqual([await destination.getAttribute('cx'), await destination.getAttribute('cy')]);
  await expect(page.getByTestId('simulation-result-state')).toHaveCount(0);
  await previous.click();
  await expect(selectedTime).toContainText('2:00 / 3:00');
  await expect(instruction).toHaveText('Fixture: approach destination');
  await next.click();
  await page.getByTestId('simulation-toggle').click();
  await page.clock.runFor(1_000);
  await expect(page.getByTestId('simulation-result-state')).toHaveText('INSPECTION ONLY · NO BASELINE SAVED');
  await finish(page, 120, 2_000, true);
  await expect(page.getByTestId('sector-comparison-1')).toHaveCount(0);
  expect(demo.requests()).toBe(1);
  demo.assertHealthy();
});

const unusualShortcutCases = [
  {
    name: 'unequal raw step durations normalize to the route timeline',
    route: unequalStepDurationsFixture(),
    duration: 240,
    stages: [
      { seconds: 40, instruction: 'Fixture: second unequal segment', markerCircle: 2, states: ['COMPLETE', 'CURRENT', 'NOT REACHED'], splits: ['0:40 split', '0:00 split', '--:-- split'] },
      { seconds: 160, instruction: 'Fixture: third unequal segment', markerCircle: 3, states: ['COMPLETE', 'COMPLETE', 'CURRENT'], splits: ['0:40 split', '2:00 split', '0:00 split'] },
      { seconds: 240, instruction: 'Fixture: arrived', markerCircle: 1, states: ['COMPLETE', 'COMPLETE', 'COMPLETE'], splits: ['0:40 split', '2:00 split', '1:20 split'] },
    ],
    previousSeconds: 160,
    previousInstruction: 'Fixture: third unequal segment',
  },
  {
    name: 'a positive-distance zero-duration step receives a simulation interval',
    route: zeroDurationMovingStepFixture(),
    duration: 120,
    stages: [
      { seconds: 60, instruction: 'Fixture: timed moving segment', markerCircle: 2, states: ['COMPLETE', 'CURRENT', 'NOT REACHED'], splits: ['1:00 split', '0:00 split', '--:-- split'] },
      { seconds: 120, instruction: 'Fixture: arrived', markerCircle: 1, states: ['COMPLETE', 'COMPLETE', 'COMPLETE'], splits: ['1:00 split', '0:30 split', '0:30 split'] },
    ],
    previousSeconds: 60,
    previousInstruction: 'Fixture: timed moving segment',
  },
  {
    name: 'a single moving instruction jumps directly to arrival',
    route: singleMovingInstructionFixture(),
    duration: 180,
    stages: [
      { seconds: 180, instruction: 'Fixture: arrived', markerCircle: 1, states: ['COMPLETE', 'COMPLETE', 'COMPLETE'], splits: ['1:00 split', '1:00 split', '1:00 split'] },
    ],
    previousSeconds: 0,
    previousInstruction: 'Fixture: follow the road',
  },
  {
    name: 'arrival-only input uses the model fallback segment',
    route: arrivalOnlyFixture(),
    duration: 180,
    stages: [
      { seconds: 180, instruction: 'Fixture: arrived', markerCircle: 1, states: ['COMPLETE', 'COMPLETE', 'COMPLETE'], splits: ['1:00 split', '1:00 split', '1:00 split'] },
    ],
    previousSeconds: 0,
    previousInstruction: 'Follow the route to your destination',
    initialInstruction: 'Follow the route to your destination',
  },
] as const;

for (const scenario of unusualShortcutCases) {
  test(`instruction shortcuts stay aligned when ${scenario.name}`, async ({ page }) => {
    const demo = await openDemo(page, scenario.route);
    const previous = page.getByRole('button', { name: 'Previous instruction', exact: true });
    const next = page.getByRole('button', { name: 'Next instruction', exact: true });
    const instruction = page.getByTestId('simulation-instruction');
    const selectedTime = page.getByTestId('simulation-selected-time');
    const map = page.getByTestId('route-simulation').locator('svg circle');
    const marker = map.last();

    await expect(previous).toBeDisabled();
    await expect(next).toBeEnabled();
    if (scenario.initialInstruction) {
      await page.getByTestId('simulation-start').click();
      await expect(instruction).toHaveText(scenario.initialInstruction);
    }

    for (const stage of scenario.stages) {
      await next.click();
      await expect(selectedTime).toContainText(`${Math.floor(stage.seconds / 60)}:${String(stage.seconds % 60).padStart(2, '0')} / ${Math.floor(scenario.duration / 60)}:${String(scenario.duration % 60).padStart(2, '0')}`);
      await expect(instruction).toHaveText(stage.instruction);
      if (stage.seconds === scenario.duration) await expect(next).toBeDisabled();
      else await expect(next).toBeEnabled();

      const expectedMarker = map.nth(stage.markerCircle);
      expect([await marker.getAttribute('cx'), await marker.getAttribute('cy')])
        .toEqual([await expectedMarker.getAttribute('cx'), await expectedMarker.getAttribute('cy')]);

      for (const [index, state] of stage.states.entries()) {
        await expect(page.getByTestId(`sector-state-${index + 1}`)).toHaveText(state);
      }
      for (const [index, split] of stage.splits.entries()) {
        await expect(page.getByTestId(`sector-split-time-${index + 1}`)).toHaveText(split);
      }
    }

    await expect(previous).toBeEnabled();
    await previous.click();
    await expect(selectedTime).toContainText(`${Math.floor(scenario.previousSeconds / 60)}:${String(scenario.previousSeconds % 60).padStart(2, '0')} /`);
    await expect(instruction).toHaveText(scenario.previousInstruction);
    await expect(next).toBeEnabled();
    expect(demo.requests()).toBe(1);
    demo.assertHealthy();
  });
}

test('instruction shortcuts follow synthetic-stop transitions and retain the completed baseline', async ({ page }) => {
  const demo = await openDemo(page);
  await page.getByTestId('simulated-stop-duration-30').click();
  await page.getByTestId('simulated-stop-sector-2').click();
  await finish(page, 120, 2_000);
  // Shortcuts also inspect an already completed run without replacing its baseline.
  const previous = page.getByRole('button', { name: 'Previous instruction', exact: true });
  const next = page.getByRole('button', { name: 'Next instruction', exact: true });
  await expect(next).toBeDisabled();
  await previous.click();
  await expect(page.getByTestId('simulation-selected-time')).toContainText('2:30 / 3:30');
  await expect(page.getByTestId('simulation-instruction')).toHaveText('Fixture: approach destination');
  await previous.click();
  await expect(page.getByTestId('simulation-selected-time')).toContainText('2:00 / 3:30');
  await expect(page.getByTestId('simulation-instruction')).toHaveText('Fixture: continue along test road');
  await previous.click();
  await expect(page.getByTestId('simulation-selected-time')).toContainText('1:30 / 3:30');
  await expect(page.getByTestId('simulation-instruction')).toHaveText('Configured simulated stop in S2');
  await expect(page.getByText('Synthetic stop · 30s left', { exact: true })).toBeVisible();
  await expect(page.getByTestId('sector-split-time-2')).toHaveText('0:30 split');
  const marker = page.getByTestId('route-simulation').locator('svg circle').last();
  const heldPosition = [await marker.getAttribute('cx'), await marker.getAttribute('cy')];
  await next.click();
  await expect(page.getByTestId('simulation-selected-time')).toContainText('2:00 / 3:30');
  await expect(page.getByTestId('simulation-instruction')).toHaveText('Fixture: continue along test road');
  expect([await marker.getAttribute('cx'), await marker.getAttribute('cy')]).toEqual(heldPosition);
  await expect(page.getByTestId('sector-split-time-2')).toHaveText('1:00 split');
  await expect(page.getByTestId('simulated-stop-duration-60')).toBeDisabled();
  await expect(page.getByTestId('sector-comparison-1')).toHaveCount(0);
  await page.getByTestId('simulation-end').click();
  await expect(page.getByTestId('simulation-result-state')).toContainText('INSPECTION ONLY');
  await finish(page, 60, 4_000, true);
  await expect(page.getByTestId('sector-comparison-2')).toContainText('Previous replay 1:30');
  await expect(page.getByTestId('sector-comparison-2')).toContainText('match');
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

test('configured stop numbers stay aligned between choices, map badges, and an ended result', async ({ page }) => {
  const demo = await openDemo(page);

  // Deliberately configure sector 3, then 1, then 2: display order is not route order.
  await page.getByTestId('simulated-stop-duration-30').click();
  await page.getByTestId('simulated-stop-sector-3').click();
  await page.getByTestId('simulated-stop-add').click();
  await page.getByTestId('simulated-stop-add').click();
  await page.getByTestId('simulated-stop-3-sector-2').click();
  await expectMapPracticeStopNumbers(page, [1, 2, 3]);

  // Turning the middle entry off removes it and shifts the later entry's number.
  await page.getByTestId('simulated-stop-2-duration-0').click();
  await expectMapPracticeStopNumbers(page, [1, 2]);

  // Re-add a stop, then remove another entry to confirm numbering closes up again.
  await page.getByTestId('simulated-stop-add').click();
  await expectMapPracticeStopNumbers(page, [1, 2, 3]);
  await page.getByTestId('simulated-stop-2-duration-0').click();
  await expectMapPracticeStopNumbers(page, [1, 2]);
  await expect(page.getByTestId('simulated-stop-config')).toContainText('+30s in S3');
  await expect(page.getByTestId('simulated-stop-config')).toContainText('+30s in S1');

  // Stop 2 is in S1 and occurs first in route order; end halfway through its hold.
  await page.getByTestId('simulation-start').click();
  await page.clock.runFor(2_250); // 45 simulated seconds: 30 moving + 15 holding.
  await expect(page.getByText('Synthetic stop · 15s left', { exact: true })).toBeVisible();
  await expectMapPracticeStopNumbers(page, [1, 2]);
  await page.getByTestId('simulation-end').click();

  await expect(page.getByTestId('simulation-result-state')).toHaveText('SIMULATION ENDED EARLY');
  await expectMapPracticeStopNumbers(page, [1, 2]);
  await expect(page.getByText(/Stop 1 · S3: \+0:00 of 0:30 configured \(not reached\)/)).toBeVisible();
  await expect(page.getByText(/Stop 2 · S1: \+0:15 of 0:30 configured \(partial\)/)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('sector.practice-settings.v1'))).toBeNull();
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
