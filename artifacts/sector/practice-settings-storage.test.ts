import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-ignore Node's TypeScript stripping requires source extensions.
import { createPracticeSettingsStorage, defaultPracticeSettings, PRACTICE_SETTINGS_KEY, validatePracticeSettings } from './practice-settings-storage.ts';

function memoryStorage() {
  const values = new Map<string, string>();
  const calls: string[] = [];
  return {
    values, calls,
    async getItem(key: string) { calls.push(`get:${key}`); return values.get(key) ?? null; },
    async setItem(key: string, value: string) { calls.push(`set:${key}`); values.set(key, value); },
    async removeItem(key: string) { calls.push(`remove:${key}`); values.delete(key); },
  };
}

test('missing storage is opted out and reading/defaults never write', async () => {
  const raw = memoryStorage();
  const store = createPracticeSettingsStorage(raw);
  assert.equal(await store.load(), null);
  assert.deepEqual(defaultPracticeSettings(), { sectorCount: 3, stops: [] });
  assert.deepEqual(raw.calls, [`get:${PRACTICE_SETTINGS_KEY}`]);
});

test('round trips all supported counts, durations and up to three ordered stops', async () => {
  const store = createPracticeSettingsStorage(memoryStorage());
  for (const sectorCount of [2, 3, 4, 5] as const) {
    for (const durationSeconds of [10, 30, 60, 120] as const) {
      const value = { sectorCount, stops: [
        { sectorId: sectorCount, durationSeconds },
        { sectorId: 1, durationSeconds: 10 as const },
        { sectorId: sectorCount, durationSeconds: 120 as const },
      ] };
      await store.save(value);
      assert.deepEqual(await store.load(), value);
    }
  }
  await store.save({ sectorCount: 2, stops: [] });
  assert.deepEqual(await store.load(), { sectorCount: 2, stops: [] });
});

test('serialization whitelists settings and strips every unrelated field, including stop extras', async () => {
  const raw = memoryStorage();
  const store = createPracticeSettingsStorage(raw);
  const privateExtras = {
    geometry: ['private geometry'], steps: ['private steps'], destinationCoordinates: [51, -0.1],
    destinationName: 'private destination', splits: [10], baseline: [20], elapsed: 30, speed: 120,
  };
  await store.save({
    ...privateExtras,
    sectorCount: 5,
    stops: [{ sectorId: 5, durationSeconds: 60, ...privateExtras }],
  });
  assert.deepEqual(JSON.parse(raw.values.get(PRACTICE_SETTINGS_KEY)!), {
    version: 1, sectorCount: 5, stops: [{ sectorId: 5, durationSeconds: 60 }],
  });
  assert.deepEqual(raw.calls, [`set:${PRACTICE_SETTINGS_KEY}`]);
});

test('invalid counts and stops are rejected instead of applied or saved', async () => {
  const invalid: unknown[] = [
    null, [], {}, { sectorCount: 1, stops: [] }, { sectorCount: 6, stops: [] },
    { sectorCount: '3', stops: [] }, { sectorCount: 2.5, stops: [] },
    { sectorCount: 3, stops: null }, { sectorCount: 3, stops: {} },
    { sectorCount: 3, stops: Array(4).fill({ sectorId: 1, durationSeconds: 10 }) },
  ];
  for (const sectorId of [0, 4, -1, 1.5, '1', null, NaN, Infinity]) {
    invalid.push({ sectorCount: 3, stops: [{ sectorId, durationSeconds: 30 }] });
  }
  for (const durationSeconds of [0, -10, 15, 121, '30', null, NaN, Infinity]) {
    invalid.push({ sectorCount: 3, stops: [{ sectorId: 1, durationSeconds }] });
  }
  invalid.push({ sectorCount: 3, stops: [null] });
  for (const value of invalid) assert.throws(() => validatePracticeSettings(value));
  const raw = memoryStorage();
  const store = createPracticeSettingsStorage(raw);
  assert.throws(() => store.save({ sectorCount: 8, stops: [] } as never));
  assert.deepEqual(raw.calls, []);
});

test('malformed JSON, unsupported versions and invalid saved values fail safely without writes', async () => {
  const raw = memoryStorage();
  const store = createPracticeSettingsStorage(raw);
  for (const value of ['', '{', 'null', '[]', '{}',
    '{"version":2,"sectorCount":3,"stops":[]}',
    '{"version":1,"sectorCount":3,"stops":[{"sectorId":5,"durationSeconds":10}]}']) {
    raw.values.set(PRACTICE_SETTINGS_KEY, value);
    await assert.rejects(store.load());
  }
  assert.ok(raw.calls.every((call) => call.startsWith('get:')));
});

test('forget removes only practice settings, not saved searches or unrelated keys', async () => {
  const raw = memoryStorage();
  raw.values.set('sector.recent-searches.v1', 'unrelated saved searches');
  const store = createPracticeSettingsStorage(raw);
  await store.save({ sectorCount: 4, stops: [] });
  await store.forget();
  assert.equal(await store.load(), null);
  assert.equal(raw.values.get('sector.recent-searches.v1'), 'unrelated saved searches');
});

test('read, save and forget failures surface and do not poison later operations', async () => {
  const raw = memoryStorage();
  let fail = true;
  const store = createPracticeSettingsStorage({
    getItem: (key) => fail ? Promise.reject(new Error('read unavailable')) : raw.getItem(key),
    setItem: (key, value) => fail ? Promise.reject(new Error('write unavailable')) : raw.setItem(key, value),
    removeItem: (key) => fail ? Promise.reject(new Error('delete unavailable')) : raw.removeItem(key),
  });
  await assert.rejects(store.load(), /read unavailable/);
  await assert.rejects(store.save(defaultPracticeSettings()), /write unavailable/);
  await assert.rejects(store.forget(), /delete unavailable/);
  fail = false;
  await store.save(defaultPracticeSettings());
  assert.deepEqual(await store.load(), defaultPracticeSettings());
  await store.forget();
  assert.equal(await store.load(), null);
});

test('a delayed save cannot resurrect forgotten settings or be overtaken by a remount read', async () => {
  const raw = memoryStorage();
  let release!: () => void;
  const hold = new Promise<void>((resolve) => { release = resolve; });
  const store = createPracticeSettingsStorage({
    ...raw,
    async setItem(key, value) { await hold; await raw.setItem(key, value); },
  });
  const saving = store.save({ sectorCount: 5, stops: [{ sectorId: 5, durationSeconds: 120 }] });
  const forgetting = store.forget();
  const loading = store.load();
  release();
  await Promise.all([saving, forgetting]);
  assert.equal(await loading, null);
  assert.deepEqual(raw.calls, [
    `set:${PRACTICE_SETTINGS_KEY}`, `remove:${PRACTICE_SETTINGS_KEY}`, `get:${PRACTICE_SETTINGS_KEY}`,
  ]);
});
