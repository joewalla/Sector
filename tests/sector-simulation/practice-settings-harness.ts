import type { Page } from '@playwright/test';

// Keep browser fault injection outside the app. Only this key is intercepted;
// recent searches and other browser storage keep their normal behaviour.
export const settingsKey = 'sector.practice-settings.v1';
type Operation = 'read' | 'write' | 'remove';
type Options = { seed?: string; fail?: Operation; holdRead?: boolean; hold?: Exclude<Operation, 'read'> };
type StorageHarness = {
  failures: Record<Operation, boolean>;
  calls: Record<Operation, number>;
  raw: () => string | null;
  release: (fail?: boolean) => void;
};

declare global {
  interface Window {
    practiceStorageHarness: StorageHarness;
  }
}

export async function practiceStorageHarness(page: Page, options: Options = {}) {
  await page.addInitScript(({ key, options }) => {
    const original = {
      read: Storage.prototype.getItem,
      write: Storage.prototype.setItem,
      remove: Storage.prototype.removeItem,
    };
    // Seed once per test context, never overwrite changes on a browser reload.
    if (!sessionStorage.getItem('practice-fixture-seeded')) {
      sessionStorage.setItem('practice-fixture-seeded', 'yes');
      if (options.seed !== undefined) original.write.call(localStorage, key, options.seed);
    }
    let release = (_fail = false) => {};
    const harness: StorageHarness = {
      failures: { read: options.fail === 'read', write: options.fail === 'write', remove: options.fail === 'remove' },
      calls: { read: 0, write: 0, remove: 0 },
      raw: () => original.read.call(localStorage, key),
      release: (fail = false) => release(fail),
    };
    window.practiceStorageHarness = harness;
    Storage.prototype.getItem = function (name) {
      if (this !== localStorage || name !== key) return original.read.call(this, name);
      harness.calls.read += 1;
      if (harness.failures.read) throw new Error('Fixture: settings read denied');
      const raw = original.read.call(this, name);
      if (options.holdRead) {
        // AsyncStorage web resolves getItem's return value inside a Promise.
        // A thenable holds that resolution (not the JS thread), modelling the
        // asynchronous native read without changing app code or using sleeps.
        return new Promise<string | null>((resolve) => {
            release = () => {
              release = () => {};
              resolve(raw);
            };
        }) as unknown as string;
      }
      return raw;
    };
    let heldOperationUsed = false;
    Storage.prototype.setItem = function (name, value) {
      if (this === localStorage && name === key) {
        harness.calls.write += 1;
        if (harness.failures.write) throw new Error('Fixture: settings write denied');
        if (options.hold === 'write' && !heldOperationUsed) {
          heldOperationUsed = true;
          const storage = this;
          return new Promise<void>((resolve, reject) => {
            release = (fail = false) => {
              release = () => {};
              if (fail) {
                reject(new Error('Fixture: held settings write denied'));
                return;
              }
              original.write.call(storage, name, value);
              resolve();
            };
          }) as unknown as void;
        }
      }
      return original.write.call(this, name, value);
    };
    Storage.prototype.removeItem = function (name) {
      if (this === localStorage && name === key) {
        harness.calls.remove += 1;
        if (harness.failures.remove) throw new Error('Fixture: settings removal denied');
        if (options.hold === 'remove' && !heldOperationUsed) {
          heldOperationUsed = true;
          const storage = this;
          return new Promise<void>((resolve, reject) => {
            release = (fail = false) => {
              release = () => {};
              if (fail) {
                reject(new Error('Fixture: held settings removal denied'));
                return;
              }
              original.remove.call(storage, name);
              resolve();
            };
          }) as unknown as void;
        }
      }
      return original.remove.call(this, name);
    };
  }, { key: settingsKey, options });
  return {
    snapshot: () => page.evaluate(() => ({
      raw: window.practiceStorageHarness.raw(),
      calls: window.practiceStorageHarness.calls,
    })),
    fail: (operation: Operation, enabled: boolean) => page.evaluate(({ operation, enabled }) => {
      window.practiceStorageHarness.failures[operation] = enabled;
    }, { operation, enabled }),
    release: (fail = false) => page.evaluate(({ fail }) => window.practiceStorageHarness.release(fail), { fail }),
  };
}
