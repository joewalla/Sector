import type { SimulationRoute } from './route-simulation';
import { buildSimulationSectors, simulationSecondsAtDistance } from './sector-timing.ts';

export const SIMULATED_STOP_DURATIONS = [0, 10, 30, 60, 120] as const;
export type SimulatedStopDuration = (typeof SIMULATED_STOP_DURATIONS)[number];
export type SimulatedStopConfig = { sectorId: number; durationSeconds: SimulatedStopDuration };
export const MAX_SIMULATED_STOPS = 3;
export type SimulatedStop = {
  configIndex: number;
  sectorId: number;
  meters: number;
  referenceStartSeconds: number;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
};

/** Compatibility helper for a single optional hold. */
export function configureSimulatedStop(
  reference: SimulationRoute,
  sectorCount: number,
  config: SimulatedStopConfig,
): { model: SimulationRoute; stop: SimulatedStop | null } {
  const { model, stops } = configureSimulatedStops(reference, sectorCount, [config]);
  return { model, stop: stops[0] ?? null };
}

/**
 * Space holds strictly inside their sectors. All positions and original times
 * come from the reference, never from an already delayed model. Input order
 * breaks ties within a sector; chronological order determines cumulative offsets.
 */
export function configureSimulatedStops(
  reference: SimulationRoute,
  sectorCount: number,
  configs: readonly SimulatedStopConfig[],
): { model: SimulationRoute; stops: SimulatedStop[] } {
  if (configs.length > MAX_SIMULATED_STOPS) {
    throw new Error(`Choose at most ${MAX_SIMULATED_STOPS} simulated stops.`);
  }
  const sectors = buildSimulationSectors(reference, sectorCount);
  if (configs.some((config) => !Number.isInteger(config.sectorId) || config.sectorId < 1 || config.sectorId > sectors.length
    || !SIMULATED_STOP_DURATIONS.includes(config.durationSeconds))) {
    throw new Error('Choose a valid practice sector and a supported simulated stop duration.');
  }
  const enabled = configs.map((config, configIndex) => ({ ...config, configIndex }))
    .filter((config) => config.durationSeconds > 0);
  if (!enabled.length) return { model: reference, stops: [] };
  let offset = 0;
  const stops: SimulatedStop[] = sectors.flatMap((sector) => {
    const local = enabled.filter((config) => config.sectorId === sector.id);
    return local.map((config, index) => {
      const meters = sector.startMeters + (sector.endMeters - sector.startMeters) * (index + 1) / (local.length + 1);
      const referenceStartSeconds = simulationSecondsAtDistance(reference, meters);
      const startSeconds = referenceStartSeconds + offset;
      offset += config.durationSeconds;
      return { ...config, meters, referenceStartSeconds, startSeconds, endSeconds: startSeconds + config.durationSeconds };
    });
  });
  const segments: SimulationRoute['segments'] = [];
  let nextStop = 0;
  offset = 0;
  for (const segment of reference.segments) {
    let startSeconds = segment.startSeconds;
    let startMeters = segment.startMeters;
    while (nextStop < stops.length && stops[nextStop].meters <= segment.endMeters
      && segment.endMeters > segment.startMeters) {
      const stop = stops[nextStop++];
      if (stop.meters < startMeters) throw new Error('Ambiguous simulated stop position.');
      if (stop.referenceStartSeconds > startSeconds) {
        segments.push({ ...segment, startSeconds: startSeconds + offset, startMeters,
          endSeconds: stop.referenceStartSeconds + offset, endMeters: stop.meters });
      }
      segments.push({
        ...segment,
        instruction: `Configured simulated stop in S${stop.sectorId}`,
        startMeters: stop.meters,
        endMeters: stop.meters,
        startSeconds: stop.startSeconds,
        endSeconds: stop.endSeconds,
      });
      offset += stop.durationSeconds;
      startSeconds = stop.referenceStartSeconds;
      startMeters = stop.meters;
    }
    if (startSeconds < segment.endSeconds) {
      segments.push({ ...segment, startSeconds: startSeconds + offset, startMeters,
        endSeconds: segment.endSeconds + offset });
    }
  }
  if (nextStop !== stops.length) throw new Error('This route has no moving segment at a configured simulated stop.');
  return {
    model: { ...reference, durationSeconds: reference.durationSeconds + offset, segments },
    stops,
  };
}

export function sampleSimulatedStop(stop: SimulatedStop | null, elapsedSeconds: number) {
  if (!stop) return { phase: 'disabled' as const, elapsedSeconds: 0, remainingSeconds: 0 };
  const elapsed = Number.isNaN(elapsedSeconds) ? 0 : elapsedSeconds;
  const consumed = Math.max(0, Math.min(stop.durationSeconds, elapsed - stop.startSeconds));
  return {
    phase: elapsed < stop.startSeconds ? 'upcoming' as const
      : elapsed < stop.endSeconds ? 'holding' as const : 'passed' as const,
    elapsedSeconds: consumed,
    remainingSeconds: stop.durationSeconds - consumed,
  };
}
