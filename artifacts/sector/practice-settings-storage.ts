import type { PracticeSectorCount } from './simulation/sector-timing';
import type { SimulatedStopConfig } from './simulation/simulated-stop';

export const PRACTICE_SETTINGS_KEY = 'sector.practice-settings.v1';
export type PracticeSettings = {
  sectorCount: PracticeSectorCount;
  stops: SimulatedStopConfig[];
};
export const defaultPracticeSettings = (): PracticeSettings => ({ sectorCount: 3, stops: [] });

/** Deliberately whitelist scalars, never serialize route or playback objects. */
export function validatePracticeSettings(value: unknown): PracticeSettings {
  if (!value || typeof value !== 'object') throw new Error('Invalid practice settings.');
  const data = value as Record<string, unknown>;
  if (![2, 3, 4, 5].includes(data.sectorCount as number)
    || !Array.isArray(data.stops) || data.stops.length > 3) {
    throw new Error('Invalid practice settings.');
  }
  const stops = data.stops.map((value: unknown): SimulatedStopConfig => {
    if (!value || typeof value !== 'object') throw new Error('Invalid simulated stop.');
    const stop = value as Record<string, unknown>;
    if (!Number.isInteger(stop.sectorId) || (stop.sectorId as number) < 1
      || (stop.sectorId as number) > (data.sectorCount as number)
      || ![10, 30, 60, 120].includes(stop.durationSeconds as number)) {
      throw new Error('Invalid simulated stop.');
    }
    return {
      sectorId: stop.sectorId as number,
      durationSeconds: stop.durationSeconds as SimulatedStopConfig['durationSeconds'],
    };
  });
  return { sectorCount: data.sectorCount as PracticeSectorCount, stops };
}

type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
  removeItem(key: string): Promise<unknown>;
};

export function createPracticeSettingsStorage(storage: Storage) {
  // Reads/removals on a new route must not overtake a pending save on the old one.
  let queue: Promise<unknown> = Promise.resolve();
  function serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation);
    queue = result.catch(() => undefined);
    return result;
  }
  return {
    load: () => serial(async () => {
      const raw = await storage.getItem(PRACTICE_SETTINGS_KEY);
      if (raw === null) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || (parsed as { version?: unknown }).version !== 1) {
        throw new Error('Unsupported practice settings.');
      }
      return validatePracticeSettings(parsed);
    }),
    save: (value: PracticeSettings) => {
      const safe = validatePracticeSettings(value);
      return serial(async () => {
        await storage.setItem(PRACTICE_SETTINGS_KEY, JSON.stringify({ version: 1, ...safe }));
      });
    },
    forget: () => serial(async () => { await storage.removeItem(PRACTICE_SETTINGS_KEY); }),
  };
}
